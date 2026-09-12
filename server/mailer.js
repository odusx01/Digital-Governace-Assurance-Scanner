'use strict';

const nodemailer = require('nodemailer');

function getTransport() {
    const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
    const missing = required.filter(name => !process.env[name]);
    if (missing.length) throw new Error(`Email delivery is not configured. Missing: ${missing.join(', ')}`);

    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
}

async function sendVerificationEmail({ to, name, token }) {
    const baseUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
    const verifyUrl = `${baseUrl}/verify-email/${encodeURIComponent(token)}`;
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;

    await getTransport().sendMail({
        from,
        to,
        subject: 'Complete your ConsentLens registration',
        text: `Hi ${name},\n\nComplete your ConsentLens registration by opening this link:\n${verifyUrl}\n\nThis link expires in 24 hours. If you did not create this account, you can ignore this email.`,
        html: `<p>Hi ${escapeHtml(name)},</p><p>Complete your ConsentLens registration by clicking the button below.</p><p><a href="${verifyUrl}" style="display:inline-block;padding:11px 16px;background:#6366f1;color:#fff;text-decoration:none;border-radius:6px;font-weight:700">Verify email address</a></p><p>Or open this link:</p><p>${verifyUrl}</p><p>This link expires in 24 hours. If you did not create this account, you can ignore this email.</p>`,
    });
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

async function sendMonitorDigest({ to, userName, monitors, baseUrl }) {
    if (!to) return;
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    const appUrl = (baseUrl || process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
    const subject = 'ConsentLens — Weekly monitor digest';
    const alertCount = monitors.filter(m => m.last_run_status === 'alert').length;
    const rows = monitors.map(m => {
        const statusColor = m.last_run_status === 'alert' ? '#dc2626' : m.last_run_status === 'ok' ? '#16a34a' : '#6b7280';
        const statusLabel = m.last_run_status || 'not run';
        return `<tr>
<td style="padding:8px 12px;border:1px solid #e5e7eb">${escapeHtml(m.name)}</td>
<td style="padding:8px 12px;border:1px solid #e5e7eb;font-size:0.8em;color:#6b7280">${escapeHtml(m.url)}</td>
<td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:700;color:${statusColor}">${escapeHtml(statusLabel)}</td>
<td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:center">${m.threshold_critical || 1}</td>
<td style="padding:8px 12px;border:1px solid #e5e7eb"><a href="${appUrl}/app/monitors/${m.id}" style="color:#6366f1">View →</a></td>
</tr>`;
    }).join('');
    const alertNote = alertCount > 0
        ? `<p style="background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;padding:10px 14px;color:#dc2626;font-weight:700">${alertCount} monitor${alertCount !== 1 ? 's are' : ' is'} in alert state.</p>`
        : `<p style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:10px 14px;color:#16a34a;font-weight:700">All monitors are passing.</p>`;
    const html = `<div style="font-family:sans-serif;max-width:680px">
<h2 style="color:#111827">ConsentLens — Weekly Monitor Digest</h2>
<p>Hi ${escapeHtml(userName || 'there')},</p>
${alertNote}
<table style="border-collapse:collapse;width:100%;font-size:0.9em">
<thead><tr style="background:#f9fafb">
<th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left">Monitor</th>
<th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left">URL</th>
<th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left">Last status</th>
<th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:center">Critical threshold</th>
<th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left">Link</th>
</tr></thead>
<tbody>${rows}</tbody>
</table>
<p style="margin-top:20px"><a href="${appUrl}/app/monitors" style="display:inline-block;padding:10px 16px;background:#6366f1;color:#fff;text-decoration:none;border-radius:6px;font-weight:700">View all monitors</a></p>
<p style="color:#9ca3af;font-size:0.8em">You receive this weekly digest because you have monitors configured in ConsentLens. To stop receiving these emails, remove recipients from your monitors.</p>
</div>`;
    const text = `ConsentLens Weekly Monitor Digest\n\n${monitors.map(m => `${m.name} (${m.url}): ${m.last_run_status || 'not run'}`).join('\n')}\n\nView monitors: ${appUrl}/app/monitors`;
    await getTransport().sendMail({ from, to, subject, text, html });
}

async function sendMonitorAlert({ monitor, status, criticalCount, highCount, reportUrl }) {
    const recipients = typeof monitor.recipients === 'string' ? JSON.parse(monitor.recipients) : monitor.recipients || [];
    if (!recipients.length) return;
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    const baseUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
    const url = reportUrl || `${baseUrl}/app/monitors/${monitor.id}`;
    const subject = `[ConsentLens Alert] ${escapeHtml(monitor.name)} — threshold exceeded`;
    const lines = [];
    if (criticalCount > 0) lines.push(`${criticalCount} critical finding${criticalCount !== 1 ? 's' : ''}`);
    if (highCount > 0) lines.push(`${highCount} high finding${highCount !== 1 ? 's' : ''}`);
    const summary = lines.join(', ') || 'threshold exceeded';
    const text = `ConsentLens Monitor Alert\n\nMonitor: ${monitor.name}\nURL: ${monitor.url}\nStatus: ${status}\nFindings: ${summary}\n\nView report: ${url}`;
    const html = `<div style="font-family:sans-serif;max-width:600px">
<h2 style="color:#dc2626">ConsentLens Monitor Alert</h2>
<table style="border-collapse:collapse;width:100%">
<tr><td style="padding:6px 12px;border:1px solid #e5e7eb;font-weight:700;background:#f9fafb">Monitor</td><td style="padding:6px 12px;border:1px solid #e5e7eb">${escapeHtml(monitor.name)}</td></tr>
<tr><td style="padding:6px 12px;border:1px solid #e5e7eb;font-weight:700;background:#f9fafb">URL</td><td style="padding:6px 12px;border:1px solid #e5e7eb">${escapeHtml(monitor.url)}</td></tr>
<tr><td style="padding:6px 12px;border:1px solid #e5e7eb;font-weight:700;background:#f9fafb">Status</td><td style="padding:6px 12px;border:1px solid #e5e7eb;color:#dc2626;font-weight:700">${escapeHtml(status)}</td></tr>
<tr><td style="padding:6px 12px;border:1px solid #e5e7eb;font-weight:700;background:#f9fafb">Critical findings</td><td style="padding:6px 12px;border:1px solid #e5e7eb">${criticalCount}</td></tr>
<tr><td style="padding:6px 12px;border:1px solid #e5e7eb;font-weight:700;background:#f9fafb">High findings</td><td style="padding:6px 12px;border:1px solid #e5e7eb">${highCount}</td></tr>
</table>
<p style="margin-top:20px"><a href="${url}" style="display:inline-block;padding:11px 16px;background:#6366f1;color:#fff;text-decoration:none;border-radius:6px;font-weight:700">View monitor report</a></p>
</div>`;
    await getTransport().sendMail({ from, to: recipients.join(', '), subject, text, html });
}

module.exports = { sendVerificationEmail, sendMonitorAlert, sendMonitorDigest };
