'use strict';

const { enqueue } = require('./queue');
const { getMonitor, updateMonitor, createMonitorRun, getMonitorRuns, getMonitorsForUser, getUsersNeedingDigest, updateUserDigestAt } = require('./db');
const { runScan } = require('../run-scan');
const { sendMonitorAlert, sendMonitorDigest } = require('./mailer');

const CHECK_INTERVAL_MS = 60 * 1000;
let running = false;

async function checkMonitors() {
  if (running) return;
  running = true;
  try {
    const pool = require('./db').pool;
    const [rows] = await pool.query('SELECT * FROM monitors WHERE enabled = 1 AND next_run_at <= NOW()');
    for (const monitor of rows) {
      await executeMonitor(monitor);
    }
    await checkAndSendDigests();
    await cleanupExpiredSharedReports();
  } catch (err) {
    console.error('Monitor check failed:', err.message);
  } finally {
    running = false;
  }
}

async function cleanupExpiredSharedReports() {
  try {
    const pool = require('./db').pool;
    const [res] = await pool.query('DELETE FROM shared_reports WHERE expires_at IS NOT NULL AND expires_at < NOW()');
    if (res.affectedRows > 0) console.log(`[monitor] Deleted ${res.affectedRows} expired shared report link(s)`);
  } catch (err) {
    console.error('[monitor] cleanupExpiredSharedReports failed:', err.message);
  }
}

async function checkAndSendDigests() {
  try {
    const users = await getUsersNeedingDigest();
    for (const user of users) {
      try {
        const monitors = await getMonitorsForUser(user.id);
        if (!monitors.length) continue;
        const allRecipients = new Set();
        for (const m of monitors) {
          for (const r of (m.recipients || [])) allRecipients.add(r);
        }
        if (!allRecipients.size) continue;
        const baseUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
        await sendMonitorDigest({
          to: [...allRecipients].join(', '),
          userName: user.full_name || user.email,
          monitors,
          baseUrl,
        });
        await updateUserDigestAt(user.id);
        console.log(`[monitor] Sent weekly digest to ${user.email}`);
      } catch (err) {
        console.error(`[monitor] Digest failed for user ${user.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[monitor] checkAndSendDigests failed:', err.message);
  }
}

async function executeMonitor(monitor) {
  console.log(`[monitor] Running monitor ${monitor.id}: ${monitor.name}`);
  const scanConfig = typeof monitor.scan_config === 'string' ? JSON.parse(monitor.scan_config) : monitor.scan_config;
  const recipients = typeof monitor.recipients === 'string' ? JSON.parse(monitor.recipients) : monitor.recipients || [];
  const outputDir = require('path').join(require('./queue').RESULTS_DIR, `monitor-${monitor.id}-${Date.now()}`);

  try {
    const output = await runScan({
      url: monitor.url,
      outputDir,
      name: `[Monitor] ${monitor.name}`,
      maxPages: scanConfig.maxPages || 1,
      region: scanConfig.region || 'uk',
      framework: scanConfig.framework || 'uk-pecr',
      scanType: scanConfig.scanType || 'consent',
      scanProfile: scanConfig.scanProfile || 'standard',
      crawlMode: scanConfig.crawlMode || 'homepage',
      journeys: scanConfig.journeys || ['no-interaction', 'accept-all', 'reject-all'],
      includePatterns: scanConfig.includePatterns || [],
      excludePatterns: scanConfig.excludePatterns || [],
      subdomainPolicy: scanConfig.subdomainPolicy || 'same-domain',
      interactive: scanConfig.interactive || false,
    });

    const criticalCount = (output.findings || []).filter(f => f.severity === 'CRITICAL').length;
    const highCount = (output.findings || []).filter(f => f.severity === 'HIGH').length;
    const criticalAlert = criticalCount >= monitor.threshold_critical;
    const highAlert = monitor.threshold_high != null && highCount >= monitor.threshold_high;
    const status = (criticalAlert || highAlert) ? 'alert' : 'ok';
    const lastRunAt = new Date().toISOString();

    await createMonitorRun({
      monitorId: monitor.id,
      scanId: output.scanId || null,
      status,
      newCriticalCount: criticalCount,
      details: { criticalCount, highCount, threshold: monitor.threshold_critical, thresholdHigh: monitor.threshold_high },
    });

    await updateMonitor(monitor.id, {
      lastRunAt,
      lastRunStatus: status,
      nextRunAt: computeNextRun(monitor.schedule, monitor.timezone),
    });

    if (status === 'alert' && recipients.length) {
      console.log(`[monitor] Alert for ${monitor.name}: ${criticalCount} critical, ${highCount} high findings`);
      try {
        const baseUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
        const reportUrl = output.scanId ? `${baseUrl}/app/reports/${output.scanId}` : `${baseUrl}/app/monitors/${monitor.id}`;
        await sendMonitorAlert({ monitor, status, criticalCount, highCount, reportUrl });
      } catch (mailErr) {
        console.error(`[monitor] Failed to send alert email for monitor ${monitor.id}:`, mailErr.message);
      }
    }
  } catch (err) {
    console.error(`[monitor] Failed to run monitor ${monitor.id}:`, err.message);
    await updateMonitor(monitor.id, {
      lastRunAt: new Date().toISOString(),
      lastRunStatus: 'error',
      nextRunAt: computeNextRun(monitor.schedule, monitor.timezone),
    });
  }
}

function computeNextRun(cronExpr, timezone) {
  const now = new Date();
  const [minutes, hours, dayOfMonth, month, dayOfWeek] = cronExpr.split(' ');
  const next = new Date(now);
  next.setMinutes(next.getMinutes() + 5);
  next.setSeconds(0);
  next.setMilliseconds(0);
  return next.toISOString();
}

function start() {
  checkMonitors();
  setInterval(checkMonitors, CHECK_INTERVAL_MS);
  console.log('[monitor] Monitoring service started');
}

module.exports = { start, checkMonitors };
