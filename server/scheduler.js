'use strict';

/**
 * server/scheduler.js
 *
 * Checks for due monitors every minute and triggers scans via the queue.
 * Sends alert emails when new critical findings exceed the configured threshold.
 */

const cron = require('node-cron');
const cronParser = require('cron-parser');
const nodemailer = require('nodemailer');
const { getAllDueMonitors, updateMonitorAfterRun, createMonitorRun, saveScan } = require('./db');
const { enqueue, getJob } = require('./queue');

let _started = false;

function nextRunDate(schedule, timezone) {
  try {
    const interval = cronParser.parseExpression(schedule, {
      currentDate: new Date(),
      tz: timezone || 'UTC',
    });
    return interval.next().toDate();
  } catch {
    // Fall back to 24h if cron expression is unparseable
    return new Date(Date.now() + 24 * 60 * 60 * 1000);
  }
}

async function sendAlertEmail({ monitor, criticalCount, scanId }) {
  if (!monitor.recipients?.length) return;
  const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
  if (required.some(k => !process.env[k])) return; // Email not configured

  try {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    const baseUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
    const reportLink = scanId ? `${baseUrl}/reports/${scanId}` : baseUrl;

    await transport.sendMail({
      from,
      to: monitor.recipients.join(', '),
      subject: `[SPIDAC Alert] ${criticalCount} critical finding${criticalCount !== 1 ? 's' : ''} — ${monitor.name}`,
      text: `Monitor: ${monitor.name}\nURL: ${monitor.url}\n\nA scheduled scan found ${criticalCount} critical finding${criticalCount !== 1 ? 's' : ''}, which meets or exceeds your alert threshold (${monitor.threshold_critical}).\n\nView report: ${reportLink}\n\nTo manage this monitor, log in at ${baseUrl}.`,
      html: `<p><strong>Monitor:</strong> ${monitor.name}<br><strong>URL:</strong> ${monitor.url}</p>
<p>A scheduled scan found <strong>${criticalCount} critical finding${criticalCount !== 1 ? 's' : ''}</strong>, which meets or exceeds your alert threshold (${monitor.threshold_critical}).</p>
<p><a href="${reportLink}" style="display:inline-block;padding:10px 16px;background:#dc2626;color:#fff;text-decoration:none;border-radius:6px;font-weight:700">View report</a></p>
<p style="color:#64748b;font-size:12px">Sent by SPIDAC - Digital Tech Assurance scheduled monitor.</p>`,
    });
  } catch (err) {
    console.error('[scheduler] Failed to send alert email:', err.message);
  }
}

async function fireWebhook({ monitor, runStatus, criticalCount, highCount, findings, scanId }) {
  if (!monitor.webhook_url) return;
  const baseUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  const reportUrl = scanId ? `${baseUrl}/report/${scanId}` : `${baseUrl}/app/monitors/${monitor.id}`;
  const payload = {
    event: 'monitor_run',
    monitor: { id: monitor.id, name: monitor.name, url: monitor.url },
    run: { status: runStatus, criticalCount, highCount: highCount || 0, runAt: new Date().toISOString() },
    findings,
    scanId: scanId || null,
    reportUrl,
    timestamp: new Date().toISOString(),
  };
  try {
    const https = require('https');
    const http = require('http');
    const body = JSON.stringify(payload);
    const parsed = new URL(monitor.webhook_url);
    const lib = parsed.protocol === 'https:' ? https : http;
    await new Promise((resolve, reject) => {
      const req = lib.request(monitor.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'User-Agent': 'SPIDAC-Monitor/1.0' },
        timeout: 10000,
      }, (res) => { res.resume(); resolve(); });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Webhook timeout')); });
      req.write(body);
      req.end();
    });
    console.log(`[scheduler] Webhook fired for monitor #${monitor.id} → ${monitor.webhook_url}`);
  } catch (err) {
    console.error(`[scheduler] Webhook failed for monitor #${monitor.id}:`, err.message);
  }
}

async function runDueMonitors() {
  let monitors;
  try {
    monitors = await getAllDueMonitors();
  } catch (err) {
    console.error('[scheduler] Failed to fetch due monitors:', err.message);
    return;
  }

  for (const monitor of monitors) {
    // Immediately advance next_run_at so a slow scan doesn't double-trigger
    const nextRun = nextRunDate(monitor.schedule, monitor.timezone);
    await updateMonitorAfterRun(monitor.id, { status: 'running', nextRunAt: nextRun }).catch(() => {});

    console.log(`[scheduler] Triggering monitor #${monitor.id} "${monitor.name}" → ${monitor.url}`);

    const cfg = monitor.scanConfig || {};
    const job = enqueue({
      url: monitor.url,
      name: `[Monitor] ${monitor.name}`,
      userId: monitor.user_id,
      region: cfg.region || 'gb',
      framework: cfg.framework || 'uk-pecr',
      scanType: cfg.scanType || 'consent',
      scanProfile: cfg.scanProfile || 'standard',
      crawlMode: cfg.crawlMode || 'homepage',
      journeys: cfg.journeys || ['no-interaction', 'accept-all', 'reject-all'],
      maxPages: cfg.maxPages || 1,
    });

    // Poll for job completion (non-blocking, max 30 min)
    const pollInterval = 15000; // 15s
    const maxAttempts = 120;    // 30 min
    let attempts = 0;

    const poll = setInterval(async () => {
      attempts++;
      const j = getJob(job.id);
      if (!j || attempts >= maxAttempts) {
        clearInterval(poll);
        await updateMonitorAfterRun(monitor.id, { status: 'error', nextRunAt: nextRun }).catch(() => {});
        await createMonitorRun({ monitorId: monitor.id, scanId: null, status: 'error', newCriticalCount: 0 }).catch(() => {});
        return;
      }
      if (j.status !== 'done' && j.status !== 'failed') return;

      clearInterval(poll);

      const counts = j.findings || {};
      const criticalCount = counts.CRITICAL || 0;
      const highCount = counts.HIGH || 0;
      const criticalAlert = criticalCount >= (monitor.threshold_critical || 1);
      const highAlert = monitor.threshold_high != null && highCount >= monitor.threshold_high;
      const runStatus = j.status === 'failed' ? 'error' : (criticalAlert || highAlert) ? 'alert' : 'ok';

      // Find the DB scan ID (saved by queue.js)
      let dbScanId = null;
      try {
        const { pool } = require('./db');
        const [rows] = await pool.query(
          'SELECT id FROM scans WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
          [monitor.user_id]
        );
        dbScanId = rows[0]?.id || null;
      } catch { /* best-effort */ }

      await updateMonitorAfterRun(monitor.id, { status: runStatus, nextRunAt: nextRun }).catch(() => {});
      await createMonitorRun({
        monitorId: monitor.id,
        scanId: dbScanId,
        status: runStatus,
        newCriticalCount: criticalCount,
        details: { findings: counts, highCount, jobError: j.error || null },
      }).catch(() => {});

      if (runStatus === 'alert') {
        await sendAlertEmail({ monitor, criticalCount, scanId: dbScanId });
      }
      // Always fire webhook on completion (status ok, alert, or error)
      await fireWebhook({ monitor, runStatus, criticalCount, highCount, findings: counts, scanId: dbScanId });

      console.log(`[scheduler] Monitor #${monitor.id} "${monitor.name}" completed — status: ${runStatus}, critical: ${criticalCount}`);
    }, pollInterval);
  }
}

function start() {
  if (_started) return;
  _started = true;

  // Check every minute
  cron.schedule('* * * * *', () => {
    runDueMonitors().catch(err => console.error('[scheduler] Error:', err.message));
  });

  console.log('[scheduler] Monitor scheduler started');
}

module.exports = { start, fireWebhook };
