'use strict';

/**
 * server/queue.js
 *
 * In-memory job queue — one scan at a time.
 *
 * Job object is structured so the interface can be migrated to Redis
 * without changing callers: all mutation goes through queue.js functions,
 * all reads use the plain job object shape.
 *
 * Job shape:
 * {
 *   id:            string       UUID
 *   userId:        number|null  authenticated user id
 *   url:           string
 *   name:          string|null  optional human label
 *   outputDir:     string       absolute path to results dir for this scan
 *   status:        'queued'|'running'|'done'|'failed'
 *   step:          string       current progress key
 *   progress:      string       current human-readable progress message
 *   queuePosition: number|null  1-based position if queued; null if running/done/failed
 *   reportPath:    string|null  absolute path to report.html once done
 *   findings:      object|null  { CRITICAL, HIGH, REVIEW, ADVISORY } counts once done
 *   framework:     string       selected legal framework
 *   scanType:      string       selected scan profile
 *   error:         string|null  error message if failed
 *   createdAt:     string       ISO timestamp
 *   startedAt:     string|null  ISO timestamp
 *   completedAt:   string|null  ISO timestamp
 * }
 */

const crypto = require('crypto');
const path = require('path');
const { runScan } = require('../run-scan');
const { saveScan } = require('./db');

const RESULTS_BASE = path.join(__dirname, '..', 'results');

// ── Store & queue ─────────────────────────────────────────────────────────────
const jobStore = new Map();   // id → job
const pending = [];          // ordered list of queued job IDs
let active = false;       // true while a scan is running

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Enqueue a new scan job and return the job object immediately.
 */
function enqueue({ url, name, maxPages, region, framework, scanType, scanProfile, crawlMode, journeys, includePatterns, excludePatterns, subdomainPolicy, interactive, customJourneys, userId }) {
  const id = crypto.randomUUID();
  const outputDir = path.join(RESULTS_BASE, id);

  const job = {
    id,
    userId: userId || null,
    url,
    name: name || null,
    maxPages: maxPages || 1,
    region: region || null,
    framework: framework || 'uk-pecr',
    scanType: scanType || 'consent',
    scanProfile: scanProfile || 'standard',
    crawlMode: crawlMode || 'homepage',
    journeys: journeys || ['no-interaction', 'accept-all', 'reject-all'],
    customJourneys: customJourneys || [],
    includePatterns: includePatterns || [],
    excludePatterns: excludePatterns || [],
    subdomainPolicy: subdomainPolicy || 'same-domain',
    interactive: Boolean(interactive),
    outputDir,
    status: 'queued',
    step: 'queued',
    progress: pending.length > 0 || active
      ? `Waiting — position ${pending.length + 1} in queue`
      : 'Starting shortly',
    queuePosition: pending.length + (active ? 1 : 0) + 1,
    reportPath: null,
    findings: null,
    error: null,
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
  };

  jobStore.set(id, job);
  pending.push(id);
  _drain();
  return job;
}

/**
 * Return a job by ID, or null if not found.
 */
function getJob(id) {
  return jobStore.get(id) || null;
}

/**
 * Return all jobs that are currently queued or running.
 */
function listActiveJobs() {
  return [...jobStore.values()]
    .filter(j => j.status === 'queued' || j.status === 'running')
    .sort((a, b) => (a.queuePosition ?? 999) - (b.queuePosition ?? 999));
}

/**
 * Return a serialisable status snapshot (safe to send as JSON to the browser).
 */
function jobStatus(id) {
  const job = jobStore.get(id);
  if (!job) return null;
  return {
    id: job.id,
    url: job.url,
    name: job.name,
    status: job.status,
    step: job.step,
    progress: job.progress,
    queuePosition: job.queuePosition,
    reportPath: job.reportPath,
    findings: job.findings,
    error: job.error,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
  };
}

// ── Internal ──────────────────────────────────────────────────────────────────

function _updateQueuePositions() {
  pending.forEach((id, i) => {
    const j = jobStore.get(id);
    if (j) {
      j.queuePosition = i + 1;
      j.progress = `Waiting — position ${i + 1} in queue`;
    }
  });
}

async function _drain() {
  if (active || pending.length === 0) return;

  const id = pending.shift();
  const job = jobStore.get(id);
  if (!job) { _drain(); return; }

  _updateQueuePositions();
  active = true;

  job.status = 'running';
  job.step = 'starting';
  job.progress = 'Launching browser';
  job.queuePosition = null;
  job.startedAt = new Date().toISOString();

  try {
    await runScan({
      url: job.url,
      outputDir: job.outputDir,
      name: job.name,
      maxPages: job.maxPages || 1,
      region: job.region || null,
      framework: job.framework || 'uk-pecr',
      scanType: job.scanType || 'consent',
      scanProfile: job.scanProfile || 'standard',
      crawlMode: job.crawlMode || 'homepage',
      journeys: job.journeys,
      customJourneys: job.customJourneys,
      includePatterns: job.includePatterns,
      excludePatterns: job.excludePatterns,
      subdomainPolicy: job.subdomainPolicy || 'same-domain',
      interactive: job.interactive || false,
      onProgress(step, message, extra) {
        job.step = step;
        job.progress = message;

        // Capture findings summary when scan finishes
        if (step === 'done' && extra?.findings) {
          const counts = { CRITICAL: 0, HIGH: 0, REVIEW: 0, ADVISORY: 0 };
          for (const f of extra.findings) counts[f.severity] = (counts[f.severity] || 0) + 1;
          job.findings = counts;
        }
      },
    }).then(({ output, reportPath }) => {
      // Persist finding counts from the completed output
      const counts = { CRITICAL: 0, HIGH: 0, REVIEW: 0, ADVISORY: 0 };
      for (const f of output.findings || []) counts[f.severity] = (counts[f.severity] || 0) + 1;

      job.status = 'done';
      job.step = 'done';
      job.progress = 'Scan complete';
      job.reportPath = reportPath;
      job.findings = counts;
      job.completedAt = new Date().toISOString();

      if (job.userId) {
        saveScan(job.userId, {
          name: job.name,
          url: job.url,
          resultDir: path.basename(job.outputDir),
          scanStatus: output.scanStatus || 'ok',
          output,
        }).then((result) => {
          if (result?.insertId) {
            try {
              const jsonPath = path.join(job.outputDir, 'scan-result.json');
              if (fs.existsSync(jsonPath)) {
                const existing = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
                existing.scanId = result.insertId;
                fs.writeFileSync(jsonPath, JSON.stringify(existing, null, 2));
              }
            } catch (_) { }
          }
        }).catch(() => { });
      }
    });

  } catch (err) {
    const msg = _friendlyError(err);
    job.status = 'failed';
    job.step = 'failed';
    job.progress = msg;
    job.error = msg;
    job.completedAt = new Date().toISOString();

  } finally {
    active = false;
    _drain();
  }
}

function _friendlyError(err) {
  const msg = err?.message || String(err);
  if (/invalid url/i.test(msg)) return `Invalid URL — check the address and try again`;
  if (/net::err_name_not_resolved/i.test(msg)) return `Domain not found — check the URL and your internet connection`;
  if (/timeout/i.test(msg)) return `Scan timed out — the site took too long to respond`;
  if (/net::err_connection_refused/i.test(msg)) return `Connection refused — the site may be down`;
  if (/blocked|access denied|forbidden/i.test(msg)) return `Site blocked the scanner — the site's WAF refused access`;
  if (/executable doesn.t exist/i.test(msg)) return `Playwright browser not installed — run: npx playwright install chromium`;
  return `Scan failed: ${msg.slice(0, 200)}`;
}

module.exports = { enqueue, getJob, jobStatus, listActiveJobs };
