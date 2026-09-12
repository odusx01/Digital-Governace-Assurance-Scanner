'use strict';

/**
 * report.js
 *
 * Generates a standalone HTML report from a scan-result.json file.
 *
 * Usage:
 *   node report.js <scan-result.json> [--output <file.html>]
 */

const fs = require('fs');
const path = require('path');

const PLAYBOOK_DIR = path.join(__dirname, 'playbooks');

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
    });
  } catch (_) { return iso; }
}

function imgToDataUri(filePath, scanDir) {
  try {
    const abs = path.isAbsolute(filePath)
      ? filePath
      : path.join(scanDir, path.basename(filePath));
    if (!fs.existsSync(abs)) return null;
    const buf = fs.readFileSync(abs);
    return `data:image/png;base64,${buf.toString('base64')}`;
  } catch (_) { return null; }
}

function countBySev(findings) {
  const c = { CRITICAL: 0, HIGH: 0, REVIEW: 0, ADVISORY: 0 };
  for (const f of findings) c[f.severity] = (c[f.severity] || 0) + 1;
  return c;
}

function severityColour(sev) {
  return { CRITICAL: '#991b1b', HIGH: '#92400e', REVIEW: '#78350f', ADVISORY: '#1e3a5f' }[sev] || '#374151';
}

function severityBg(sev) {
  return { CRITICAL: '#fef2f2', HIGH: '#fff7ed', REVIEW: '#fffbeb', ADVISORY: '#eff6ff' }[sev] || '#f9fafb';
}

function severityBorder(sev) {
  return { CRITICAL: '#fca5a5', HIGH: '#fed7aa', REVIEW: '#fde68a', ADVISORY: '#bfdbfe' }[sev] || '#e5e7eb';
}

function loadPlaybook(cmpName) {
  const slug = (cmpName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const candidates = [slug, 'generic'];
  for (const s of candidates) {
    const p = path.join(PLAYBOOK_DIR, `${s}.json`);
    if (fs.existsSync(p)) {
      try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { }
    }
  }
  return null;
}

function scenarioLabel(s) {
  return { 'no-interaction': 'No interaction', 'accept-all': 'Accept all', 'reject-all': 'Reject all' }[s] || s;
}

function frameworkLabel(framework) {
  return {
    'uk-pecr': 'UK GDPR / PECR',
    'ccpa-cpra': 'California CCPA / CPRA',
    both: 'UK GDPR / PECR + California CCPA / CPRA',
  }[framework] || 'UK GDPR / PECR';
}

function scanTypeLabel(scanType) {
  return {
    consent: 'Consent and cookie controls',
    'ccpa-signals': 'California privacy signals',
    full: 'Full consent and privacy signals',
  }[scanType] || 'Consent and cookie controls';
}

function listJoin(arr) {
  if (arr.length === 1) return `"${arr[0]}"`;
  return arr.slice(0, -1).map(a => `"${a}"`).join(', ') + ` and "${arr[arr.length - 1]}"`;
}

// Plain-English "what this means" per finding type (aimed at marketing managers)
function plainEnglish(finding) {
  const t = finding.title.toLowerCase();
  const et = finding.evidenceType;

  // Network-request evidence — must be checked BEFORE generic "before consent" match
  if (et === 'network-request' || t.includes('third-party tracking request')) {
    return `A third-party tracking request was sent to an advertising or analytics domain before the user gave any consent. Even without setting a cookie, these requests can transmit the visitor's IP address, device fingerprint, and browsing behaviour to the third party. Under PECR, any non-essential transmission of data to third parties requires prior consent — cookies are not the only mechanism that triggers this obligation.`;
  }

  if (t.includes('storage written') || t.includes('browser storage')) {
    return `Data was written to the browser's local storage or session storage before the user gave any consent. Web storage is subject to the same PECR rules as cookies when used for tracking, analytics, or cross-session identification. Not all storage writes require consent — strictly necessary storage (login state, CSRF tokens, shopping cart) is exempt — but each key must be assessed individually.`;
  }

  if (t.includes('before consent')) {
    return `A tracking cookie was placed on the visitor's device before they had any opportunity to agree to it. Under UK law (PECR), you must obtain consent <em>before</em> setting non-essential cookies — not afterwards. Think of it as sending someone a marketing letter before asking whether they want to receive post.`;
  }
  if (t.includes('set by rejection')) {
    return `When the visitor clicked "reject", your website responded by setting <em>more</em> tracking cookies. This is the most serious pattern detected: the act of saying "no" triggered tracking. A reject click must not fire any analytics or advertising code — not even to record the rejection in a third-party system.`;
  }
  if (t.includes('persists after reject')) {
    return `This tracking cookie was still present after the visitor chose to reject all non-essential cookies. The consent choice was not honoured — the website set the cookie and then failed to remove it when the user said no. Under UK GDPR, withdrawal of consent must be acted on immediately.`;
  }
  if (t.includes('reject is harder')) {
    return `Accepting cookies takes one click from the banner, but rejecting them requires navigating into a preferences panel and making changes there. ICO guidance is clear: it must be just as easy to say no as it is to say yes. If accepting is one click, rejecting must also be one click from the same banner layer.`;
  }
  if (t.includes('no accept-all')) {
    return `The banner does not offer an "Accept all" button. Instead, visitors can only accept individual categories of cookies. While this may be intentional, it means the accept-all scenario in this scan captured a smaller cookie footprint than may occur in practice, and the banner design may not meet user expectations for a clear accept mechanism.`;
  }
  if (t.includes('lifespan')) {
    return `This cookie is set to last longer than 13 months on the visitor's device. The ICO recommends that cookie lifespans are proportionate and do not exceed 13 months. A shorter lifespan reduces the period over which tracking data can be collected without renewed consent.`;
  }
  if (t.includes('security attributes')) {
    return `This cookie is missing recommended security attributes. Cookies without the Secure flag can be transmitted over unencrypted HTTP connections, exposing their contents to interception. Cookies without a SameSite policy are vulnerable to cross-site request forgery attacks.`;
  }
  if (t.includes('policy') && t.includes('missing')) {
    return `No link to a cookie or privacy policy was found on the consent banner or anywhere on the page. Visitors must be able to read clear information about how cookies are used before making a consent decision — providing that information is a legal requirement under PECR and UK GDPR.`;
  }
  if (t.includes('persisted') || t.includes('revisit')) {
    return `After accepting consent and returning to the site, the consent banner reappeared as if no choice had been made. The site is not storing the user's consent decision correctly. Users should only be asked once per consent period — repeatedly showing the banner undermines the validity of consent.`;
  }
  if (t.includes('unclassified') || (t.includes('manual review') && !finding.scenario)) {
    return `This cookie was not found in the classification database and could not be automatically categorised. It may be strictly necessary, or it may require consent — this cannot be determined without manual investigation. It must not be assumed to be compliant until its purpose is confirmed.`;
  }
  if (t.includes('blocked') || t.includes('inconclusive')) {
    return `The automated scanner was blocked before it could collect any data. This report cannot make any determination about the site's cookie practices. The site must be assessed manually.`;
  }
  if (t.includes('incomplete') || t.includes('suspect')) {
    return `The scan returned results that appear incomplete. Manual verification is recommended.`;
  }
  if (t.includes('manual review') && finding.scenario) {
    return `The ${scenarioLabel(finding.scenario)} scenario could not be completed automatically. Results for this scenario are absent from the report and must be verified by a human tester.`;
  }
  return finding.description || '';
}

// ── Verdict builder ───────────────────────────────────────────────────────────

function buildVerdict(data) {
  const { findings, scanStatus, scenarios } = data;
  const bySev = countBySev(findings);

  if (scanStatus === 'blocked') {
    return `Automated scanning was blocked by the site's security or access-control layer. No cookie data was captured. <strong>This report is inconclusive</strong> and cannot be used to support a finding of compliance or non-compliance. The site must be assessed using a manual audit in a real browser session.`;
  }

  const manualScenarios = (scenarios || [])
    .filter(s => s.status === 'manual-review-needed')
    .map(s => scenarioLabel(s.scenario));

  const incompleteNote = manualScenarios.length
    ? ` <strong>Note:</strong> the ${listJoin(manualScenarios)} scenario${manualScenarios.length > 1 ? 's' : ''} could not be fully automated — results for ${manualScenarios.length > 1 ? 'those scenarios are' : 'that scenario is'} not included and must be verified manually before this report can be considered complete.`
    : '';

  if (bySev.CRITICAL > 0) {
    const preConsentCookies = findings.filter(f => f.severity === 'CRITICAL' && f.evidenceType === 'cookie' && f.title.toLowerCase().includes('before consent'));
    const preConsentRequests = findings.filter(f => f.severity === 'CRITICAL' && f.evidenceType === 'network-request');
    const preConsent = [...preConsentCookies, ...preConsentRequests]; // combined for count
    const postReject = findings.filter(f => f.severity === 'CRITICAL' && f.title.toLowerCase().includes('persists after'));
    const byRejection = findings.filter(f => f.severity === 'CRITICAL' && f.title.toLowerCase().includes('set by rejection'));

    const parts = [];
    if (preConsentCookies.length)
      parts.push(`${preConsentCookies.length} non-essential cookie${preConsentCookies.length > 1 ? 's were' : ' was'} set before the user had any opportunity to give or withhold consent`);
    if (preConsentRequests.length)
      parts.push(`tracking requests were sent to known advertising or analytics domains before any consent was given`);
    if (postReject.length)
      parts.push(`${postReject.length} cookie${postReject.length > 1 ? 's' : ''} continued to be present after the user rejected all non-essential cookies`);
    if (byRejection.length)
      parts.push(`${byRejection.length} cookie${byRejection.length > 1 ? 's were' : ' was'} set in direct response to the user clicking "reject" — the rejection event itself triggered tracking`);

    const highNote = bySev.HIGH > 0
      ? ` Additionally, ${bySev.HIGH} high-severity issue${bySev.HIGH > 1 ? 's were' : ' was'} identified relating to the design of the consent mechanism.`
      : '';

    return `Testing identified <strong>${bySev.CRITICAL} critical issue${bySev.CRITICAL > 1 ? 's' : ''}</strong>: ${parts.join('; ')}. These are direct technical indicators of potential PECR and UK GDPR non-compliance and warrant prompt remediation.${highNote}${incompleteNote}`;
  }

  if (bySev.HIGH > 0) {
    return `No critical issues were detected in the tests performed. However, <strong>${bySev.HIGH} high-severity issue${bySev.HIGH > 1 ? 's were' : ' was'} found</strong>: the consent mechanism's design may not meet ICO guidance on equal prominence — rejecting consent appears to require more steps than accepting it.${incompleteNote}`;
  }

  if (bySev.REVIEW > 0) {
    return `No critical or high-severity issues were detected in the tests performed. <strong>${bySev.REVIEW} cookie${bySev.REVIEW > 1 ? 's require' : ' requires'} manual classification</strong> before this assessment can be considered complete — unclassified cookies may or may not require consent.${bySev.ADVISORY > 0 ? ` ${bySev.ADVISORY} advisory item${bySev.ADVISORY > 1 ? 's were' : ' was'} also noted.` : ''}${incompleteNote}`;
  }

  if (bySev.ADVISORY > 0) {
    return `No critical, high, or review-severity issues were detected in the tests performed. ${bySev.ADVISORY} advisory item${bySev.ADVISORY > 1 ? 's were' : ' was'} noted — these do not indicate non-compliance but are recommended for attention.${incompleteNote}`;
  }

  return `No issues were detected in the tests performed. The tests covered three scenarios: no interaction with the banner, accepting all cookies, and rejecting all cookies. This report does not constitute a certification of compliance.${incompleteNote}`;
}

// ── CSS ───────────────────────────────────────────────────────────────────────

const CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --accent:      #1a3461;
  --accent-mid:  #1f3e7a;
  --accent-light:#e8edf8;
  --text:       #111827;
  --muted:      #6b7280;
  --border:     #e5e7eb;
  --bg:         #ffffff;
  --bg-alt:     #f9fafb;
  font-size: 14px;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, Roboto, sans-serif;
  color: var(--text);
  background: #ffffff;
  line-height: 1.6;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  font-size: 15px;
}

/* Nav — full width, identical structure to home page */
nav {
  background: #0b1629;
  width: 100%;
  padding: 0 clamp(20px, 4vw, 48px);
  display: flex;
  align-items: center;
  gap: 0;
  height: 60px;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 100;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
nav a { color: #fff; font-weight: 700; font-size: 0.95rem; text-decoration: none; letter-spacing: -0.015em; }
nav a:hover { opacity: 0.88; text-decoration: none; }
.nav-title {
  font-size: 0.75rem; font-weight: 400;
  color: rgba(255,255,255,0.35); letter-spacing: 0;
  margin-left: 14px; padding-left: 14px;
  border-left: 1px solid rgba(255,255,255,0.1);
}
.nav-actions { margin-left: auto; display: flex; gap: 6px; align-items: center; }
.nav-btn {
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.15);
  color: rgba(255,255,255,0.85);
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 12.5px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  text-decoration: none;
  white-space: nowrap;
  letter-spacing: -0.005em;
  transition: background 0.15s, border-color 0.15s;
}
.nav-btn:hover { background: rgba(255,255,255,0.16); border-color: rgba(255,255,255,0.28); opacity: 1; text-decoration: none; }

/* Content container — centers content, no background (body is white) */
.container {
  max-width: 1040px;
  width: 100%;
  margin: 0 auto;
  padding: 40px clamp(20px, 4vw, 48px) 56px;
  flex: 1;
}

/* ── Typography ── */
h1 { font-size: 1.55rem; font-weight: 800; color: #0a0a0a; letter-spacing: -0.03em; }
h2 { font-size: 1.05rem; font-weight: 700; color: #0a0a0a; margin: 2rem 0 0.75rem; border-bottom: 1px solid #e5e5e5; padding-bottom: 0.5rem; letter-spacing: -0.015em; }
h3 { font-size: 0.97rem; font-weight: 700; margin: 1.25rem 0 0.5rem; }
h4 { font-size: 0.82rem; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; margin: 0.75rem 0 0.25rem; }
p  { margin: 0.5rem 0; }
a  { color: var(--accent); }
code { font-family: 'Courier New', Courier, monospace; font-size: 0.85em; background: var(--bg-alt); padding: 0.1em 0.35em; border-radius: 3px; border: 1px solid var(--border); }
em { font-style: italic; }
strong { font-weight: 700; }

/* ── Header ── */
.report-header {
  border-bottom: 1px solid #e5e5e5;
  padding-bottom: 1.25rem;
  margin-bottom: 1.75rem;
}
.report-header .meta {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 0.75rem;
}
.meta-item { display: flex; flex-direction: column; }
.meta-item .label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); font-weight: 600; }
.meta-item .value { font-size: 0.92rem; font-weight: 500; }

/* ── Status badges ── */
.badge {
  display: inline-block;
  padding: 0.18em 0.55em;
  border-radius: 4px;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  vertical-align: middle;
  border: 1px solid currentColor;
}
.badge-ok       { color: #166534; background: #dcfce7; border-color: #86efac; }
.badge-blocked  { color: #7f1d1d; background: #fef2f2; border-color: #fca5a5; }
.badge-suspect  { color: #78350f; background: #fffbeb; border-color: #fde68a; }
.badge-manual   { color: #1e3a5f; background: #eff6ff; border-color: #bfdbfe; }
.badge-critical { color: #991b1b; background: #fef2f2; border-color: #fca5a5; }
.badge-high     { color: #92400e; background: #fff7ed; border-color: #fed7aa; }
.badge-review   { color: #78350f; background: #fffbeb; border-color: #fde68a; }
.badge-advisory { color: #1e3a5f; background: #eff6ff; border-color: #bfdbfe; }

/* ── Executive summary ── */
.summary-box {
  background: var(--accent-light);
  border-left: 4px solid var(--accent);
  padding: 1rem 1.25rem;
  border-radius: 0 6px 6px 0;
  margin: 1rem 0 1.5rem;
}
.summary-box.blocked {
  background: #fef2f2;
  border-left-color: #dc2626;
}
.summary-box p { margin: 0.35rem 0; }
.next-actions {
  margin: 1rem 0 0;
  padding: 0.85rem 1rem;
  border: 1px solid #dbe3ee;
  border-radius: 6px;
  background: #fff;
}
.next-actions-title { font-size: 0.78rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: var(--accent); }
.next-actions ol { margin: 0.45rem 0 0 1.2rem; }
.next-actions li { margin: 0.3rem 0; }
.next-actions a { font-weight: 600; }

.severity-counts {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin: 1rem 0;
}
.sev-count {
  flex: 1 1 120px;
  text-align: center;
  padding: 0.75rem;
  border-radius: 6px;
  border: 1px solid;
}
.sev-count .num { font-size: 2rem; font-weight: 800; display: block; line-height: 1; }
.sev-count .lbl { font-size: 0.75rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; display: block; margin-top: 0.2rem; }
.sev-count-link { cursor: pointer; transition: transform 0.12s, box-shadow 0.12s; text-decoration: none; }
.sev-count-link:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
.sev-count-link .sev-hint { display: block; font-size: 0.68rem; opacity: 0.6; margin-top: 0.25rem; }

/* ── Cookie category breakdown ── */
.cat-breakdown {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  margin: 0.75rem 0 0;
  font-size: 0.82rem;
}
.cat-breakdown-label {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-right: 0.25rem;
}
.cat-breakdown-pill {
  display: inline-block;
  padding: 0.2em 0.6em;
  border-radius: 4px;
  border: 1px solid;
  font-weight: 700;
  font-size: 0.8rem;
  white-space: nowrap;
}

/* ── Coverage note ── */
.coverage-note {
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 6px;
  padding: 0.65rem 1rem;
  margin: 0.75rem 0;
  font-size: 0.88rem;
}
.coverage-note strong { color: #92400e; }

/* ── Scan integrity and journey comparison ── */
.integrity-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:.65rem; margin:.75rem 0; }
.integrity-card { padding:.75rem; border:1px solid var(--border); border-radius:6px; background:var(--bg-alt); }
.integrity-card strong { display:block; font-size:1.35rem; line-height:1.1; }
.integrity-card span { display:block; margin-top:.25rem; color:var(--muted); font-size:.72rem; font-weight:700; text-transform:uppercase; letter-spacing:.04em; }
.integrity-warning { margin-top:.65rem; padding:.65rem .75rem; border-left:3px solid #f59e0b; background:#fffbeb; color:#92400e; font-size:.82rem; }
.journey-matrix { width:100%; border-collapse:collapse; font-size:.82rem; margin-top:.75rem; }
.journey-matrix th,.journey-matrix td { padding:.5rem .6rem; border-bottom:1px solid var(--border); text-align:center; }
.journey-matrix th:first-child,.journey-matrix td:first-child { text-align:left; }
.journey-matrix th { color:var(--muted); background:var(--bg-alt); font-size:.7rem; text-transform:uppercase; letter-spacing:.04em; }
.journey-pass { color:#166534; font-weight:800; }.journey-review { color:#92400e; font-weight:800; }.journey-fail { color:#991b1b; font-weight:800; }
@media (max-width:640px) { .integrity-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }

/* ── Assurance overview table ── */
.ao-table { border:1px solid var(--border); border-radius:8px; overflow:hidden; margin:.75rem 0 0; font-size:.875rem; }
.ao-head { display:grid; grid-template-columns:200px 110px 1fr; gap:12px; padding:.5rem .85rem; background:var(--bg-alt); color:var(--muted); font-size:.7rem; font-weight:700; text-transform:uppercase; letter-spacing:.05em; }
.ao-row { display:grid; grid-template-columns:200px 110px 1fr; gap:12px; padding:.65rem .85rem; border-top:1px solid var(--border); align-items:center; }
.ao-row:first-of-type { border-top:none; }
.ao-label { font-weight:600; color:var(--ink); }
.ao-result { }
.ao-detail { color:var(--muted); font-size:.82rem; }
@media (max-width:640px) { .ao-head { display:none; } .ao-row { grid-template-columns:1fr auto; } .ao-detail { display:none; } }

/* ── California privacy signals ── */
.signal-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.65rem;
  margin: 0.75rem 0 0;
}
.signal-card {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-alt);
}
.signal-card strong { font-size: 1.05rem; }
.signal-label {
  color: var(--muted);
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.signal-note, .signal-disclaimer { color: var(--muted); font-size: 0.82rem; }
.signal-controls { margin: 0.4rem 0 0 1.2rem; font-size: 0.85rem; }
.signal-controls li { margin: 0.25rem 0; word-break: break-word; }
.signal-disclaimer {
  margin-top: 1rem;
  padding: 0.65rem 0.75rem;
  background: #eff6ff;
  border-left: 3px solid #60a5fa;
}

/* ── Findings ── */
.findings-group { margin: 1.25rem 0; }
.findings-group-header {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0.75rem;
  border-radius: 6px 6px 0 0;
  font-weight: 700;
  font-size: 0.9rem;
}
.finding {
  border: 1px solid var(--border);
  border-top: none;
  margin: 0;
}
.finding:last-child { border-radius: 0 0 6px 6px; }

.finding-header {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  padding: 0.7rem 1rem;
  cursor: pointer;
  background: var(--bg-alt);
  list-style: none;
  user-select: none;
}
.finding-header::-webkit-details-marker { display: none; }
.finding-header:hover { background: #eef1f3; }
.finding[open] > .finding-header { border-bottom: 1px solid var(--border); }

.finding-expand {
  flex-shrink: 0;
  font-size: 0.6rem;
  color: var(--muted);
  margin-top: 0.35em;
  display: inline-block;
  transition: transform 0.15s;
}
.finding[open] > .finding-header .finding-expand { transform: rotate(90deg); }

.finding-id {
  font-family: 'Courier New', monospace;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--muted);
  flex-shrink: 0;
  margin-top: 0.1em;
}
.finding-header-content { flex: 1; min-width: 0; }
.finding-title { font-weight: 600; font-size: 0.95rem; display: block; }
.finding-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem;
  margin-top: 0.2rem;
  font-size: 0.78rem;
  color: var(--muted);
}
.finding-meta-cookie { font-family: 'Courier New', monospace; font-weight: 700; color: var(--text); }
.finding-meta-scenario {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 3px;
  padding: 0.05em 0.35em;
  font-size: 0.72rem;
}

.finding-body {
  padding: 0.75rem 1rem;
  display: grid;
  gap: 0.75rem;
}

.remediation-box {
  padding: 0.75rem;
  background: #f8fafc;
  border: 1px solid var(--border);
  border-radius: 8px;
  display: grid;
  gap: 0.5rem;
}

.remediation-box label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
}

.remediation-box select,
.remediation-box input,
.remediation-box textarea {
  width: 100%;
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 0.85rem;
  background: #fff;
  color: var(--ink-1);
}

.remediation-box textarea {
  min-height: 3.5rem;
  resize: vertical;
}

.remediation-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.remediation-status {
  font-size: 0.8rem;
  padding: 0.35rem 0.6rem;
  border-radius: 6px;
  background: #eef2ff;
  color: #4338ca;
  font-weight: 700;
}
.remediation-widget { margin-top: 0.75rem; }
.remediation-saved-badge { font-size:.78rem; padding:.25rem .6rem; border-radius:5px; font-weight:700; background:#f1f5f9; color:#475569; }
.rem-status-open { background:#fef9c3; color:#713f12; }
.rem-status-investigating { background:#e0f2fe; color:#0c4a6e; }
.rem-status-fixed { background:#dcfce7; color:#14532d; }
.rem-status-accepted-risk { background:#fce7f3; color:#831843; }
.rem-toggle-btn { font-size:.75rem; color:var(--accent); cursor:pointer; font-weight:700; margin-left:auto; }
.rem-save-btn { padding:.4rem .9rem; border:none; border-radius:6px; background:var(--accent); color:#fff; font-size:.82rem; font-weight:700; cursor:pointer; }
.rem-save-btn:hover { background:var(--accent-hover); }
.rem-feedback.ok { color:#166534; }.rem-feedback.err { color:#991b1b; }

/* Inline per-finding evidence timeline */
.ev-timeline-block { margin-top: 0.75rem; border: 1px solid #e2e8f0; border-radius: 6px; }
.ev-tl-toggle { cursor: pointer; font-size: 0.8rem; font-weight: 600; color: var(--accent); padding: 0.4rem 0.75rem; list-style: none; }
.ev-tl-toggle::-webkit-details-marker { display: none; }
.ev-tl-table { width: 100%; font-size: 0.75rem; border-collapse: collapse; }
.ev-tl-table th { background: #f8fafc; padding: 0.3rem 0.5rem; text-align: left; font-weight: 600; color: var(--muted); border-bottom: 1px solid #e2e8f0; }
.ev-tl-table td { padding: 0.25rem 0.5rem; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
.ev-tl-table tr:last-child td { border-bottom: none; }
.ev-ts { font-family: monospace; color: #64748b; white-space: nowrap; }
.ev-method { font-weight: 600; white-space: nowrap; }
.ev-type { color: var(--muted); font-size: 0.7rem; }
.ev-url { font-family: monospace; font-size: 0.7rem; max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ev-init { font-size: 0.7rem; color: var(--muted); max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.findings-controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.55rem;
  margin: 0.75rem 0 1rem;
  padding: 0.7rem;
  background: #f8fafc;
  border: 1px solid var(--border);
  border-radius: 8px;
}
.findings-filter-label {
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
  margin-right: 0.15rem;
}
.findings-controls input,
.findings-controls select {
  min-height: 34px;
  padding: 0.35rem 0.55rem;
  border: 1px solid #cbd5e1;
  border-radius: 5px;
  background: #fff;
  color: var(--text);
  font: inherit;
  font-size: 0.82rem;
}
.findings-controls input {
  flex: 1 1 220px;
  min-width: 170px;
}
.findings-controls select { flex: 0 1 150px; }
.findings-controls input:focus,
.findings-controls select:focus {
  outline: 2px solid rgba(31, 62, 122, 0.25);
  border-color: var(--accent-mid);
}
.findings-controls button {
  min-height: 34px;
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 5px;
  color: var(--accent);
  font-size: 0.78rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  padding: 0.35rem 0.65rem;
}
.findings-controls button:hover {
  background: var(--accent-light);
  border-color: var(--accent-mid);
}
.findings-actions {
  display: flex;
  gap: 0.4rem;
  margin-left: auto;
}
.findings-result-count {
  flex: 0 0 100%;
  color: var(--muted);
  font-size: 0.78rem;
}

.finding.is-hidden { display: none; }
.findings-group.is-hidden { display: none; }
.findings-empty {
  display: none;
  padding: 1.25rem;
  border: 1px dashed #cbd5e1;
  border-radius: 7px;
  color: var(--muted);
  text-align: center;
  background: #f8fafc;
}
.findings-empty.is-visible { display: block; }
}

.finding-section-label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  margin-bottom: 0.25rem;
}

.finding-plain { font-size: 0.9rem; line-height: 1.65; }

.detail-grid {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.2rem 1rem;
  font-size: 0.86rem;
  background: var(--bg-alt);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0.6rem 0.75rem;
}
.detail-grid .dk { color: var(--muted); font-weight: 600; white-space: nowrap; }
.detail-grid .dv { font-family: 'Courier New', monospace; font-size: 0.82rem; word-break: break-all; }

.reg-ref {
  font-size: 0.82rem;
  color: var(--muted);
  font-style: italic;
}

.guidance-box {
  background: var(--accent-light);
  border-radius: 4px;
  padding: 0.6rem 0.75rem;
  font-size: 0.87rem;
  line-height: 1.65;
}

/* ── Playbook ── */
.playbook { margin: 1rem 0; }
.playbook-intro { font-size: 0.9rem; margin-bottom: 1rem; }
.playbook-section { margin: 1rem 0; }
.playbook-section h3 {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--accent);
  margin: 0 0 0.4rem;
}
.playbook-section ol { padding-left: 1.25rem; font-size: 0.88rem; line-height: 1.65; }
.playbook-section ol li { margin: 0.3rem 0; }

/* ── Cookie inventory ── */
details { margin: 0.5rem 0; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
summary {
  padding: 0.65rem 1rem;
  background: var(--bg-alt);
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  list-style: none;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
summary::before { content: '▶'; font-size: 0.7em; color: var(--muted); }
details[open] summary::before { content: '▼'; }
summary::-webkit-details-marker { display: none; }

.cookie-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}
.cookie-table th {
  background: var(--bg-alt);
  text-align: left;
  padding: 0.4rem 0.6rem;
  border-bottom: 2px solid var(--border);
  font-size: 0.76rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
  font-weight: 700;
}
.cookie-table td {
  padding: 0.35rem 0.6rem;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
}
.cookie-table tr:last-child td { border-bottom: none; }
.cookie-table tr:nth-child(even) td { background: var(--bg-alt); }
.cookie-name { font-family: 'Courier New', monospace; font-weight: 700; word-break: break-all; }
.cat-pill {
  display: inline-block;
  padding: 0.1em 0.45em;
  border-radius: 3px;
  font-size: 0.75rem;
  font-weight: 700;
  background: var(--bg-alt);
  border: 1px solid var(--border);
}
.cat-analytics    { background: #eff6ff; border-color: #bfdbfe; color: #1e3a5f; }
.cat-advertising  { background: #fef2f2; border-color: #fca5a5; color: #7f1d1d; }
.cat-functional   { background: #f0fdf4; border-color: #86efac; color: #14532d; }
.cat-strictly-necessary { background: #f9fafb; border-color: #d1d5db; color: #374151; }
.cat-unknown      { background: #fffbeb; border-color: #fde68a; color: #78350f; }

/* ── Request evidence ── */
.request-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
  margin-top: 0.5rem;
}
.request-table th {
  background: var(--bg-alt);
  text-align: left;
  padding: 0.4rem 0.6rem;
  border-bottom: 2px solid var(--border);
  font-size: 0.76rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
  font-weight: 700;
}
.request-table td {
  padding: 0.35rem 0.6rem;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
  font-family: 'Courier New', monospace;
  font-size: 0.78rem;
}
.request-table tr:last-child td { border-bottom: none; }
.request-table tr:nth-child(even) td { background: var(--bg-alt); }
.request-url { word-break: break-all; }
.request-method { font-weight: 700; }
.request-status-ok { color: #14532d; }
.request-status-err { color: #7f1d1d; }
.request-init { color: var(--muted); font-style: italic; }
.request-meta { color: var(--muted); font-size: 0.72rem; }

/* ── Cookie Inventory: category groups ── */
.inv-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  padding: 0.75rem 1rem;
  background: var(--bg-alt);
  border-bottom: 1px solid var(--border);
}
.inv-summary .cat-pill { font-size: 0.8rem; padding: 0.2em 0.55em; }
.inv-summary .cat-pill strong { margin-left: 0.3em; }
.inv-pill-link { text-decoration: none; cursor: pointer; transition: opacity 0.15s, box-shadow 0.15s; }
.inv-pill-link:hover { opacity: 0.8; box-shadow: 0 0 0 2px currentColor; }
.badge-total {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #e5e7eb;
  color: #374151;
  border-radius: 10px;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.1em 0.5em;
  margin-left: 0.4em;
  vertical-align: middle;
}
.cat-group { margin-bottom: 0; border: none; }
.cat-group + .cat-group { border-top: 1px solid var(--border); }
.cat-group-summary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 1rem;
  cursor: pointer;
  list-style: none;
  background: var(--bg-alt);
  user-select: none;
}
.cat-group-summary::-webkit-details-marker { display: none; }
.cat-group-summary::marker { display: none; }
.cat-group[open] > .cat-group-summary { border-bottom: 1px solid var(--border); }
.cat-count { font-size: 0.78rem; color: var(--muted); }
.scenario-tag {
  display: inline-block;
  font-size: 0.68rem;
  font-weight: 600;
  padding: 0.1em 0.35em;
  border-radius: 3px;
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  color: #475569;
  margin-right: 3px;
  margin-bottom: 2px;
}
/* Colour-coded consent scenario tags */
.st-none   { background: #fff7ed; border-color: #fed7aa; color: #9a3412; }
.st-accept { background: #f0fdf4; border-color: #86efac; color: #14532d; }
.st-reject { background: #fef2f2; border-color: #fca5a5; color: #991b1b; }
/* Cookie inventory extras */
.purpose-cell { max-width: 200px; }
.purpose-text { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; cursor: default; }
.domain-cell  { font-size: 0.78rem; color: var(--muted); white-space: nowrap; }
.life-cell    { font-size: 0.78rem; color: var(--muted); }
.seenin-cell  { white-space: nowrap; }
.party-1st { font-size: 0.7rem; background: #f1f5f9; border: 1px solid #cbd5e1; color: #475569; border-radius: 3px; padding: 0.05em 0.3em; }
.party-3rd { font-size: 0.7rem; background: #fef3c7; border: 1px solid #fcd34d; color: #92400e; border-radius: 3px; padding: 0.05em 0.3em; }
.row-unclassified td { background: #fffbeb !important; }
.unclassified-note { font-size: 0.8rem; color: #92400e; background: #fff7ed; border-left: 3px solid #f59e0b; padding: 0.5rem 0.75rem; margin: 0; }
/* Classification confidence badges */
.conf-badge { font-size: 0.68rem; font-weight: 600; padding: 0.1em 0.4em; border-radius: 3px; white-space: nowrap; }
.conf-high { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
.conf-medium { background: #fef9c3; color: #854d0e; border: 1px solid #fde047; }
.conf-unknown { background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1; }
.conf-cell { white-space: nowrap; }
.inv-hint { font-size: 0.7rem; color: #64748b; margin-top: 0.2em; font-style: italic; max-width: 260px; }
/* Pages found-on cell */
.pages-cell { font-size: 0.75rem; color: var(--muted); min-width: 90px; }
.pages-one  { font-family: 'Courier New', monospace; }
.pages-details { display: inline-block; }
.pages-summary { cursor: pointer; color: var(--link, #2563eb); font-weight: 600; font-size: 0.75rem; list-style: none; }
.pages-summary::-webkit-details-marker { display: none; }
.pages-list { list-style: none; margin: 4px 0 0; padding: 4px 0 0; border-top: 1px solid var(--border); }
.pages-list-item { font-family: 'Courier New', monospace; font-size: 0.7rem; color: var(--ink); padding: 1px 0; }
.pages-all  { color: var(--muted); font-size: 0.75rem; }
.pages-some { font-size: 0.75rem; }
.page-specific-divider td { background: #f8fafc; border-top: 2px solid #e2e8f0; border-bottom: 2px solid #e2e8f0; padding: 4px 8px; font-size: 0.72rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; }

/* ── Multi-page breakdown ── */
.page-table .num-cell { text-align: right; font-variant-numeric: tabular-nums; }
.page-table .page-link { color: var(--link); font-size: 0.82rem; word-break: break-all; }
.page-table .cell-critical { color: #991b1b; font-weight: 700; }
.badge-homepage { font-size: 0.68rem; background: #eff6ff; border: 1px solid #bfdbfe; color: #1e3a5f; border-radius: 3px; padding: 0.05em 0.3em; margin-left: 0.25em; font-weight: 600; }
.page-risk-high td:first-child { border-left: 3px solid #ef4444; }
.page-risk-medium td:first-child { border-left: 3px solid #f59e0b; }
.page-risk-low td:first-child { border-left: 3px solid #10b981; }
.site-wide-block { padding: 1rem 1.25rem; border-top: 1px solid var(--border); }
.site-wide-title { font-size: 0.9rem; font-weight: 700; margin: 0 0 0.4rem; color: var(--ink); }
.site-wide-pills { display: flex; flex-wrap: wrap; gap: 0.3rem; }

/* ── Policy links ── */
.policy-links-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
  margin-top: 0.5rem;
}
@media (max-width: 640px) { .policy-links-grid { grid-template-columns: 1fr; } }
.policy-links-col h3 {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
  margin: 0 0 0.5rem;
}
.policy-link-row {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  padding: 0.35rem 0;
  border-bottom: 1px solid var(--border);
  font-size: 0.85rem;
}
.policy-link-row:last-child { border-bottom: none; }
.policy-link-label {
  font-size: 0.72rem;
  font-weight: 700;
  background: var(--bg-alt);
  border: 1px solid var(--border);
  border-radius: 3px;
  padding: 0.05em 0.4em;
  white-space: nowrap;
  color: var(--muted);
  flex-shrink: 0;
}
.policy-link-text { flex: 1; min-width: 0; word-break: break-word; }
.policy-link-href {
  font-family: 'Courier New', monospace;
  font-size: 0.75rem;
  color: var(--muted);
  word-break: break-all;
}
.policy-none { font-size: 0.86rem; color: var(--muted); font-style: italic; }

/* ── Screenshots ── */
.screenshots { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; margin: 1rem 0; }
.screenshot-card { border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
.screenshot-card .sc-label {
  padding: 0.4rem 0.75rem;
  background: var(--bg-alt);
  font-weight: 600;
  font-size: 0.82rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-bottom: 1px solid var(--border);
}
.screenshot-card img { display: block; width: 100%; height: auto; }
.screenshot-missing { padding: 1rem; font-size: 0.85rem; color: var(--muted); font-style: italic; }

/* ── Collapsible report sections ── */
.report-section { margin: 1.5rem 0; border: none; overflow: visible; border-radius: 0; }
.section-summary {
  list-style: none; cursor: pointer;
  display: flex; align-items: center; gap: 0.5rem;
  padding-bottom: 0.4rem;
  border-bottom: 2px solid var(--accent-light);
  margin-bottom: 0.75rem;
  user-select: none;
}
.section-summary::-webkit-details-marker { display: none; }
.section-summary h2 { margin: 0; border: none; padding: 0; flex: 1; }
.section-summary:hover h2 { color: var(--accent-mid); }
.section-toggle { font-size: 0.6rem; color: var(--muted); transition: transform 0.15s; flex-shrink: 0; }
.report-section[open] > .section-summary .section-toggle { transform: rotate(90deg); }

/* ── Footer ── */
.report-footer {
  margin-top: 3rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--border);
  font-size: 0.8rem;
  color: var(--muted);
  line-height: 1.7;
}
.global-footer {
  background: #0b1629;
  color: rgba(255,255,255,0.35);
  font-size: 0.77rem;
  text-align: center;
  padding: 1rem 24px;
  flex-shrink: 0;
  border-top: 1px solid rgba(255,255,255,0.05);
}
.global-footer a { color: rgba(255,255,255,0.55); text-decoration: none; }
.global-footer a:hover { color: rgba(255,255,255,0.85); text-decoration: underline; }

/* ── Per-provider fix guidance ── */
.fix-what { font-size: 0.86rem; margin: 0 0 0.4rem; line-height: 1.5; }
.fix-tool { font-size: 0.82rem; color: var(--muted); margin: 0 0 0.35rem; }
.fix-steps { padding-left: 1.3rem; margin: 0.25rem 0 0; font-size: 0.86rem; line-height: 1.65; }
.fix-steps li { margin: 0.18rem 0; }
.fix-fallback { font-size: 0.81rem; color: var(--muted); margin-top: 0.45rem; font-style: italic; border-top: 1px solid rgba(0,0,0,0.08); padding-top: 0.35rem; }

/* ── Print ── */
@media print {
  /* Hide navigation and interactive UI */
  nav, .global-footer, .findings-controls, .findings-actions,
  .remediation-widget, .rem-toggle-btn, .ev-timeline-block,
  .nav-export-menu { display: none !important; }

  /* Layout */
  body { font-size: 9.5pt; color: #000; background: #fff; }
  .container { padding: 0; max-width: 100%; margin: 0; }
  * { box-shadow: none !important; }

  /* Typography */
  h1 { font-size: 20pt; margin-bottom: 4pt; }
  h2 { font-size: 13pt; break-before: auto; }
  h3 { font-size: 11pt; }

  /* Force-open all <details> sections */
  details, details[open] { display: block !important; }
  details > *:not(summary) { display: block !important; }
  details summary { pointer-events: none; }

  /* Report sections — no collapsible chrome */
  .report-section { border: none !important; margin-bottom: 18pt; }
  .section-summary { border-bottom: 1.5pt solid #94a3b8; margin-bottom: 8pt; padding-bottom: 4pt; }
  .section-toggle { display: none; }

  /* Findings */
  .finding { break-inside: avoid; page-break-inside: avoid; border: 0.5pt solid #cbd5e1 !important; margin-bottom: 8pt; border-radius: 0 !important; }
  .finding-header { background: #f8fafc !important; padding: 6pt 8pt !important; }
  .finding-body { padding: 6pt 8pt !important; }
  details.finding > summary { display: flex !important; }

  /* Tables */
  .cookie-table { border-collapse: collapse; width: 100%; font-size: 8pt; }
  .cookie-table th, .cookie-table td { border: 0.5pt solid #cbd5e1; padding: 3pt 5pt; }
  .cookie-table thead { background: #f1f5f9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  tr { break-inside: avoid; }

  /* Badges — keep colour for print */
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
  .badge, .cat-pill, .conf-badge, .party-3rd, .party-1st { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  /* Screenshots — limit size */
  .screenshot-card img { max-height: 160px; object-fit: contain; object-position: top; border: 0.5pt solid #e2e8f0; }
  .screenshots { grid-template-columns: repeat(3, 1fr); gap: 6pt; }

  /* Assurance overview */
  .ao-table { break-inside: avoid; }

  /* Page breaks */
  .report-section + .report-section { page-break-before: auto; }
  .report-header { page-break-after: avoid; }
}

@media (max-width: 640px) {
  .signal-grid { grid-template-columns: 1fr; }
  .findings-actions { width: 100%; margin-left: 0; }
  .findings-actions button { flex: 1; }
  .findings-controls input,
  .findings-controls select { flex: 1 1 100%; }
  .finding-header { padding: 0.7rem 0.75rem; }
  .finding-body { padding: 0.75rem; }
}
`;

// ── Per-provider fix instructions ────────────────────────────────────────────

const PROVIDER_FIX = {
  'google analytics': {
    what: 'Cross-session user identifier used by Google Analytics (GA4 / Universal Analytics) to track visits, sessions, bounce rate, and user events.',
    tool: 'Google Tag Manager',
    steps: [
      'In GTM, open the GA4 Configuration tag (or Universal Analytics tag).',
      'Under "Advanced Settings → Consent Settings", enable the consent check and require the "analytics_storage" consent type.',
      'Add a "Default Consent State" tag that sets analytics_storage=denied on every page load (required for Google Consent Mode v2).',
      'Republish the GTM container, then test: confirm _ga and _gid are absent on a no-interaction page load.',
    ],
    fallback: 'If GA is loaded via a hardcoded <script> tag (not GTM), wrap it in a consent callback from your CMP so it only loads after analytics consent is granted.',
  },
  'google ads': {
    what: 'Tracks ad clicks, conversions, and builds remarketing audiences for Google Ads campaigns.',
    tool: 'Google Tag Manager',
    steps: [
      'In GTM, find the Google Ads Conversion Tracking tag and/or Remarketing tag.',
      'Under "Consent Settings", require "ad_storage" and "ad_user_data" consent types.',
      'Add a Default Consent State tag setting ad_storage=denied and ad_user_data=denied at page load.',
      'Enable Google Consent Mode v2 to allow cookieless conversion modelling when consent is withheld.',
      'Publish the GTM container.',
    ],
    fallback: 'If Google Ads tags are hardcoded, wrap them in a consent callback from your CMP.',
  },
  'google (doubleclick)': {
    what: 'DoubleClick (Google Marketing Platform) sets cookies for display ad targeting, campaign measurement, and cross-site remarketing.',
    tool: 'Google Tag Manager / Campaign Manager 360',
    steps: [
      'In GTM, add "ad_storage" and "ad_user_data" consent requirements to all Floodlight activity tags.',
      'In Campaign Manager 360 / DV360, enable Consent Mode in the floodlight tag settings.',
      'Set Default Consent State to ad_storage=denied at page load via a GTM consent initialisation tag.',
    ],
    fallback: 'If Floodlight tags are deployed outside GTM, wrap them in a consent callback from your CMP.',
  },
  'meta (facebook)': {
    what: 'The Meta Pixel sends page views, custom events, and conversions to Meta for Facebook and Instagram ad targeting and measurement.',
    tool: 'Meta Pixel / Google Tag Manager',
    steps: [
      'If deployed via GTM: open the Meta Pixel tag and add a blocking trigger that prevents it firing until advertising consent is granted.',
      'If hardcoded: wrap the fbq("init") and fbq("track", "PageView") calls in a consent callback from your CMP.',
      'Ensure fbevents.js is not loaded in the page <head> without consent gating.',
      'Consider the Meta Conversions API as a server-side supplement for consented users.',
    ],
    fallback: 'Never call fbq() on page load — always gate it behind explicit advertising consent.',
  },
  'microsoft clarity': {
    what: 'Microsoft Clarity records session replays, heatmaps, click maps, and scroll-depth data for UX analysis.',
    tool: 'Microsoft Clarity Dashboard / Google Tag Manager',
    steps: [
      'In the Clarity project settings, enable "GDPR Consent Mode" — Clarity will defer initialisation until JavaScript calls clarity("consent").',
      'Connect your CMP\'s analytics consent event to call clarity("consent") so it fires only after consent is granted.',
      'If deploying via GTM: gate the Clarity tag on an analytics consent trigger.',
    ],
    fallback: 'Session replay data is highly sensitive. Clarity must never initialise before the user grants analytics consent.',
  },
  'microsoft advertising': {
    what: 'The Microsoft (Bing) Advertising UET tag tracks conversions and builds audiences for Microsoft Ads campaigns.',
    tool: 'Google Tag Manager / UET Tag',
    steps: [
      'In GTM, add a consent trigger to the UET tag requiring advertising consent before it fires.',
      'If hardcoded: wrap the UET tag script in a consent callback from your CMP.',
      'Enable Microsoft Consent Mode to send anonymised conversion signals when consent is withheld.',
    ],
  },
  'linkedin': {
    what: 'The LinkedIn Insight Tag tracks website conversions, enables LinkedIn audience targeting, and powers campaign analytics.',
    tool: 'LinkedIn Campaign Manager / Google Tag Manager',
    steps: [
      'In GTM, add a consent trigger to the LinkedIn Insight Tag requiring advertising consent.',
      'If hardcoded: wrap the _linkedin_data_partner_id initialisation in a consent callback from your CMP.',
      'In LinkedIn Campaign Manager, enable the "Consent Management" setting for the Insight Tag.',
    ],
    fallback: 'Do not load the Insight Tag until advertising consent is explicitly granted.',
  },
  'twitter / x': {
    what: 'The Twitter/X Pixel tracks site visitors for ad targeting and conversion measurement on Twitter/X Ads.',
    tool: 'Google Tag Manager / X Ads',
    steps: [
      'In GTM, gate the Twitter Universal Website Tag on an advertising consent trigger.',
      'If hardcoded: wrap the twq("init") call in a consent callback from your CMP.',
    ],
  },
  'hubspot': {
    what: 'HubSpot sets analytics and tracking cookies for CRM contact tracking, lead attribution, and marketing automation.',
    tool: 'HubSpot Settings / Google Tag Manager',
    steps: [
      'In HubSpot Settings → Privacy & Consent, enable "Cookie Consent" mode to defer tracking until consent is granted.',
      'If deploying HubSpot tracking via GTM: add a trigger requiring analytics consent.',
      'Note: __hssrc (browser session identifier) is strictly necessary — no consent needed. Tracking cookies (__hstc, hubspotutk) require analytics consent.',
    ],
  },
  'hotjar': {
    what: 'Hotjar records session replays, heatmaps, and user surveys for UX and conversion rate optimisation.',
    tool: 'Hotjar Settings / Google Tag Manager',
    steps: [
      'In Hotjar Settings → Compliance → Consent Mode, enable "Ask for user consent" to defer recording until analytics consent is granted.',
      'If deploying via GTM: gate the Hotjar Tracking Code tag on an analytics consent trigger.',
      'If hardcoded: wrap hj("init") in a consent callback from your CMP.',
    ],
    fallback: 'Session replay captures sensitive personal data. Hotjar must never initialise before analytics consent is confirmed.',
  },
  'marketo': {
    what: 'Marketo (Adobe) sets cookies to identify known leads, track form submissions, and attribute marketing campaign touches.',
    tool: 'Google Tag Manager / Marketo Settings',
    steps: [
      'In GTM, gate the Munchkin tracking script on an analytics consent trigger.',
      'If hardcoded: wrap the Munchkin.init() call in a consent callback from your CMP.',
      'In Marketo Admin → Privacy, configure the consent-based cookie policy if available on your subscription.',
    ],
  },
  'bizible': {
    what: 'Bizible (Adobe Marketo Measure) uses persistent cookies for multi-touch marketing attribution across all channels.',
    tool: 'Google Tag Manager / Bizible Settings',
    steps: [
      'In GTM, gate the Bizible JavaScript tag on an advertising consent trigger.',
      'If hardcoded: wrap the Bizible initialisation in a consent callback from your CMP.',
      'Contact your Adobe Marketo Measure account team to configure consent-mode tracking.',
    ],
  },
  '6sense': {
    what: '6sense uses cookies and signals for B2B intent data collection, account identification, and ad targeting.',
    tool: 'Google Tag Manager / 6sense Settings',
    steps: [
      'In GTM, gate the 6sense segment tag on an advertising consent trigger.',
      'If hardcoded: wrap the 6sense initialisation in a consent callback from your CMP.',
      'Contact 6sense support to configure consent-aware data collection.',
    ],
  },
  'adobe analytics': {
    what: 'Adobe Analytics (AppMeasurement / Web SDK) tracks page views, events, and user journeys for enterprise-level analytics.',
    tool: 'Adobe Launch (Tags) / Google Tag Manager',
    steps: [
      'In Adobe Launch, open the Adobe Analytics extension and enable "Delay loading library until after user consent".',
      'Connect the analytics consent event from your CMP to the rule that loads the Adobe Analytics library.',
      'Use the Adobe Experience Platform Consent extension to gate all analytics rules on the "analytics" purpose.',
    ],
    fallback: 'If AppMeasurement.js is hardcoded, wrap the s.t() page-view call and all s.tl() event calls in a CMP consent callback.',
  },
  'adobe experience cloud': {
    what: 'Adobe Experience Cloud (ECID) cookies support cross-product identity resolution, audience segmentation, and data collection across Adobe applications.',
    tool: 'Adobe Launch (Tags)',
    steps: [
      'In Adobe Launch, use the Adobe Experience Platform Web SDK with the built-in Consent component.',
      'Set the default consent purpose to "pending" and update to "in" only after the user grants consent.',
      'Gate the Identity extension and all audience or analytics rules on the consent state.',
    ],
  },
  'onetrust': {
    what: 'OneTrust sets cookies to record and persist the user\'s consent choices across browser sessions.',
    tool: 'OneTrust Dashboard',
    steps: [
      'OneTrust consent-management cookies (OptanonConsent, OptanonAlertBoxClosed) are strictly necessary — they store the user\'s own consent decision and are legally exempt from requiring additional consent.',
      'If this cookie is being flagged as non-essential, verify its classification in your OneTrust cookie declaration and reclassify it as "Strictly Necessary".',
      'Ensure OneTrust loads before any other tracking tags on the page.',
    ],
  },
  'intercom': {
    what: 'Intercom sets cookies to identify returning users and personalise the live-chat and support experience.',
    tool: 'Google Tag Manager / Intercom Settings',
    steps: [
      'In GTM, gate the Intercom snippet on a functional consent trigger (Intercom is generally classified as functional).',
      'If hardcoded: wrap the Intercom boot call (window.Intercom("boot", {...})) in a consent callback from your CMP.',
      'In Intercom Settings → Privacy & Security, review the available consent and data-residency options.',
    ],
  },
  'reddit': {
    what: 'The Reddit Pixel tracks website visitors for ad targeting and conversion measurement on Reddit Ads.',
    tool: 'Google Tag Manager',
    steps: [
      'In GTM, gate the Reddit Pixel tag on an advertising consent trigger.',
      'If hardcoded: wrap the rdt() initialisation in a consent callback from your CMP.',
    ],
  },
  'snapchat': {
    what: 'The Snap Pixel tracks website visitors for ad targeting and conversion measurement on Snapchat Ads.',
    tool: 'Google Tag Manager',
    steps: [
      'In GTM, gate the Snap Pixel tag on an advertising consent trigger.',
      'If hardcoded: wrap the snaptr() initialisation in a consent callback from your CMP.',
    ],
  },
  'tiktok': {
    what: 'The TikTok Pixel tracks website visitors for ad targeting and conversion measurement on TikTok Ads.',
    tool: 'Google Tag Manager / TikTok Ads Manager',
    steps: [
      'In GTM, gate the TikTok Pixel tag on an advertising consent trigger.',
      'If hardcoded: wrap the ttq.load() call in a consent callback from your CMP.',
    ],
  },
  'pinterest': {
    what: 'The Pinterest Tag tracks website visitors for ad targeting and conversion measurement on Pinterest Ads.',
    tool: 'Google Tag Manager',
    steps: [
      'In GTM, gate the Pinterest Tag on an advertising consent trigger.',
      'If hardcoded: wrap the pintrk() initialisation in a consent callback from your CMP.',
    ],
  },
  'criteo': {
    what: 'Criteo sets advertising cookies for retargeting and dynamic product ad campaigns.',
    tool: 'Google Tag Manager',
    steps: [
      'In GTM, gate the Criteo OneTag on an advertising consent trigger.',
      'If hardcoded: wrap the Criteo tag initialisation in a consent callback from your CMP.',
      'Contact your Criteo account team for consent-mode configuration options.',
    ],
  },
  'heap': {
    what: 'Heap Analytics auto-captures all user interactions (clicks, form submissions, page views) via a persistent session cookie.',
    tool: 'Heap Settings / Google Tag Manager',
    steps: [
      'In GTM, gate the Heap snippet on an analytics consent trigger.',
      'If hardcoded: wrap heap.load() in a consent callback from your CMP.',
      'In Heap Settings, review the available GDPR privacy configuration options.',
    ],
  },
  'segment': {
    what: 'Segment sets a persistent anonymous user ID cookie to track users across sessions and route data to downstream analytics and advertising tools.',
    tool: 'Segment Consent Manager',
    steps: [
      'Use Segment\'s Consent Manager or a custom middleware function to gate analytics.track() and analytics.identify() calls on consent.',
      'Configure Segment to only initialise integrations for categories (analytics, advertising) where consent has been granted.',
      'If loading Segment via GTM, gate the tag on analytics consent.',
    ],
  },
  'amplitude': {
    what: 'Amplitude sets a persistent device ID cookie to track user behaviour, retention, and feature engagement.',
    tool: 'Amplitude SDK / Google Tag Manager',
    steps: [
      'Call amplitude.setOptOut(true) on page load by default.',
      'Call amplitude.setOptOut(false) only after the user grants analytics consent from your CMP.',
      'If loading via GTM: gate the Amplitude tag on an analytics consent trigger.',
    ],
  },
  'mixpanel': {
    what: 'Mixpanel sets a persistent distinct ID cookie to track user events, funnels, and retention cohorts across sessions.',
    tool: 'Mixpanel SDK / Google Tag Manager',
    steps: [
      'Call mixpanel.opt_out_tracking() on page load by default.',
      'Call mixpanel.opt_in_tracking() only after the user grants analytics consent from your CMP.',
      'If loading via GTM: gate the Mixpanel tag on an analytics consent trigger.',
    ],
  },
  'demandbase': {
    what: 'Demandbase uses cookies and firmographic signals for B2B account-based marketing (ABM), intent data, and ad targeting.',
    tool: 'Google Tag Manager',
    steps: [
      'In GTM, gate the Demandbase tag on an advertising consent trigger.',
      'If hardcoded: wrap the Demandbase initialisation in a consent callback from your CMP.',
      'Contact your Demandbase account manager for consent-mode configuration options.',
    ],
  },
};

const CATEGORY_FIX = {
  analytics: {
    what: 'An analytics cookie used to track visits, sessions, or user behaviour on this site.',
    steps: [
      'Identify which tag manager or deployment method loads this cookie (e.g., Google Tag Manager, hardcoded script).',
      'In your tag manager, add a consent condition so this tag only fires when the analytics consent category is accepted.',
      'If the script is hardcoded: wrap its initialisation in a consent callback from your CMP.',
      'Test: confirm the cookie is absent before any consent interaction and present only after accepting analytics.',
    ],
  },
  advertising: {
    what: 'An advertising or tracking cookie used for ad targeting, retargeting, or conversion attribution.',
    steps: [
      'Identify which tag manager or deployment method loads this cookie.',
      'In your tag manager, add a consent condition so this tag only fires when the advertising consent category is accepted.',
      'If the script is hardcoded: wrap its initialisation in a consent callback from your CMP.',
      'Test: confirm the cookie is absent before consent and present only after accepting advertising.',
    ],
  },
  functional: {
    what: 'A functional cookie that enhances the site experience (e.g., chat widgets, video players, personalisation).',
    steps: [
      'Determine whether this cookie is strictly necessary for core functionality (e.g., session state, CSRF) or optional (e.g., a chat widget).',
      'If optional: gate it behind the functional consent category in your tag manager or CMP.',
      'If strictly necessary: reclassify it as "Strictly Necessary" in your CMP cookie declaration — it does not require consent but must be disclosed.',
    ],
  },
};

/**
 * Look up provider-specific fix data. Falls back to category-level guidance.
 */
function getProviderFix(provider, category) {
  if (provider) {
    const needle = (provider || '').toLowerCase().trim();
    for (const [key, fix] of Object.entries(PROVIDER_FIX)) {
      if (needle === key || needle.startsWith(key) || key.startsWith(needle) ||
        needle.includes(key) || key.includes(needle)) {
        return fix;
      }
    }
  }
  return CATEGORY_FIX[category] || null;
}

/**
 * Render the "How to fix" section for a finding.
 * For cookie-type findings with a known provider, renders rich step-by-step guidance.
 * Otherwise falls back to the finding's generic guidance text.
 */
function renderGuidanceBlock(f) {
  if (f.evidenceType === 'cookie' && f.cookieName) {
    const fix = getProviderFix(f.provider, f.category);
    if (fix && fix.steps && fix.steps.length) {
      const whatHtml = fix.what ? `<p class="fix-what"><strong>About this cookie:</strong> ${esc(fix.what)}</p>` : '';
      const toolHtml = fix.tool ? `<p class="fix-tool"><strong>Fix via:</strong> ${esc(fix.tool)}</p>` : '';
      const stepsHtml = fix.steps.map(s => `<li>${esc(s)}</li>`).join('');
      const fallbackHtml = fix.fallback ? `<p class="fix-fallback">${esc(fix.fallback)}</p>` : '';
      return `
    <div>
      <div class="finding-section-label">How to fix</div>
      <div class="guidance-box">
        ${whatHtml}${toolHtml}<ol class="fix-steps">${stepsHtml}</ol>${fallbackHtml}
      </div>
    </div>`;
    }
  }
  return `
    <div>
      <div class="finding-section-label">How to fix</div>
      <div class="guidance-box">${esc(f.guidance)}</div>
    </div>`;
}

// ── HTML section builders ─────────────────────────────────────────────────────

function renderHeader(data) {
  const statusBadge = {
    ok: `<span class="badge badge-ok">OK</span>`,
    blocked: `<span class="badge badge-blocked">BLOCKED</span>`,
    suspect: `<span class="badge badge-suspect">SUSPECT</span>`,
  }[data.scanStatus] || `<span class="badge">${esc(data.scanStatus)}</span>`;

  const cmpText = data.cmp?.name && data.cmp.name !== 'None'
    ? `${esc(data.cmp.name)}`
    : 'None detected';

  const regionHtml = data.region
    ? `<div class="meta-item">
      <span class="label">Scan region</span>
      <span class="value">${esc(data.region.flag)} ${esc(data.region.label)}<br><span style="font-size:0.78rem;color:var(--muted);font-weight:400">${esc(data.region.framework)}</span></span>
    </div>`
    : `<div class="meta-item">
      <span class="label">Scan region</span>
      <span class="value" style="color:var(--muted)">Default</span>
    </div>`;

  return `
<header class="report-header">
  <h1>Cookie Compliance Scan Report</h1>
  <div class="meta">
    <div class="meta-item">
      <span class="label">Site</span>
      <span class="value"><a href="${esc(data.url)}">${esc(data.url)}</a></span>
    </div>
    <div class="meta-item">
      <span class="label">Scan date</span>
      <span class="value">${fmtDate(data.scannedAt)}</span>
    </div>
    ${regionHtml}
    <div class="meta-item">
      <span class="label">CMP detected</span>
      <span class="value">${cmpText}</span>
    </div>
    <div class="meta-item">
      <span class="label">Scan status</span>
      <span class="value">${statusBadge}</span>
    </div>
    <div class="meta-item">
      <span class="label">Framework</span>
      <span class="value">${esc(frameworkLabel(data.scanConfig?.framework))}</span>
    </div>
    <div class="meta-item">
      <span class="label">Scan profile</span>
      <span class="value">${esc(scanTypeLabel(data.scanConfig?.scanType))}</span>
    </div>
  </div>
</header>`;
}

function renderGpcComparison(data) {
  const gpcScen = (data.scenarios || []).find(s => s.scenario === 'gpc-comparison');
  if (!gpcScen || gpcScen.status !== 'ok' || !gpcScen.gpcDelta) return '';

  const { domainsBlockedByGpc, domainsUnchanged, cookiesBlockedByGpc, gpcEffective } = gpcScen.gpcDelta;
  const withoutGpc = gpcScen.gpcWithoutGpc || {};
  const withGpc    = gpcScen.gpcWithGpc    || {};

  const domainRowsBlocked = domainsBlockedByGpc.slice(0, 30).map(d =>
    `<tr><td>${esc(d)}</td><td style="color:#14532d;font-weight:700">✓ Suppressed</td></tr>`).join('');
  const domainRowsUnchanged = domainsUnchanged.slice(0, 30).map(d =>
    `<tr><td>${esc(d)}</td><td style="color:#7f1d1d;font-weight:700">✗ Still fires</td></tr>`).join('');

  const cookieRowsBlocked = cookiesBlockedByGpc.slice(0, 20).map(k => {
    const [name, domain] = k.split('||');
    return `<tr><td>${esc(name)}</td><td>${esc(domain)}</td><td style="color:#14532d;font-weight:700">✓ Suppressed</td></tr>`;
  }).join('');

  return `
<details class="report-section">
  <summary class="section-summary"><span class="section-toggle">&#9658;</span><h2>GPC signal comparison</h2></summary>
  <p class="signal-note">Two identical no-interaction visits were run — one without the Global Privacy Control (GPC) signal and one with it. The table shows which third-party domains and cookies were suppressed when GPC was active.</p>
  <div class="integrity-grid" style="margin:.75rem 0">
    <div class="integrity-card">
      <strong>${esc(withoutGpc.thirdPartyDomains?.length || 0)}</strong>
      <span>Domains (no GPC)</span>
    </div>
    <div class="integrity-card">
      <strong>${esc(withGpc.thirdPartyDomains?.length || 0)}</strong>
      <span>Domains (with GPC)</span>
    </div>
    <div class="integrity-card">
      <strong style="color:${domainsBlockedByGpc.length > 0 ? '#166534' : 'inherit'}">${esc(domainsBlockedByGpc.length)}</strong>
      <span>Domains suppressed by GPC</span>
    </div>
    <div class="integrity-card">
      <strong style="color:${cookiesBlockedByGpc.length > 0 ? '#166534' : 'inherit'}">${esc(cookiesBlockedByGpc.length)}</strong>
      <span>Cookies suppressed by GPC</span>
    </div>
  </div>
  ${(domainRowsBlocked || domainRowsUnchanged) ? `
  <div style="overflow-x:auto;margin-top:.75rem">
    <table class="cookie-table" style="font-size:.82rem">
      <thead><tr><th>Domain</th><th>GPC effect</th></tr></thead>
      <tbody>${domainRowsBlocked}${domainRowsUnchanged}</tbody>
    </table>
  </div>` : '<p style="color:var(--muted);font-size:.85rem">No third-party domains detected in either run.</p>'}
  ${cookieRowsBlocked ? `
  <h3 style="font-size:.9rem;margin:1rem 0 .5rem">Cookies suppressed by GPC</h3>
  <div style="overflow-x:auto">
    <table class="cookie-table" style="font-size:.82rem">
      <thead><tr><th>Cookie name</th><th>Domain</th><th>GPC effect</th></tr></thead>
      <tbody>${cookieRowsBlocked}</tbody>
    </table>
  </div>` : ''}
  ${gpcEffective
    ? '<p class="integrity-warning" style="margin-top:.75rem">GPC is partially effective: some trackers are suppressed when GPC is active, but they still fire for visitors who do not send the signal. Ensure opt-out applies to all visitors, not only those with GPC-enabled browsers.</p>'
    : domainsUnchanged.length > 0
      ? '<p class="integrity-warning" style="margin-top:.75rem">GPC appears to be ignored: the same third-party tracking domains were contacted in both runs. The site may not be processing the GPC signal.</p>'
      : '<p style="color:#166534;font-size:.85rem;margin-top:.75rem;padding:.5rem .75rem;background:#dcfce7;border-radius:6px">No third-party tracking detected in either run — GPC comparison could not differentiate behaviour.</p>'}
</details>`;
}

function renderPrivacySignals(data) {
  const config = data.scanConfig || {};
  const isCalifornia = config.framework === 'ccpa-cpra' || config.framework === 'both'
    || config.scanType === 'ccpa-signals' || config.scanType === 'full';
  const signals = data.privacySignals;
  if (!isCalifornia || !signals) return '';

  const controls = (signals.optOutControls || []).map(control => `
    <li><strong>${esc(control.text || 'Unnamed control')}</strong>${control.href ? ` — <a href="${esc(control.href)}">${esc(control.href)}</a>` : ''}</li>`).join('');
  return `
<details class="report-section" open>
  <summary class="section-summary"><span class="section-toggle">&#9658;</span><h2>California privacy signals</h2></summary>
  <div class="signal-grid">
    <div class="signal-card"><span class="signal-label">GPC request sent</span><strong>${signals.gpcRequested ? 'Yes' : 'No'}</strong><span class="signal-note">The scan sent the <code>Sec-GPC: 1</code> browser signal.</span></div>
    <div class="signal-card"><span class="signal-label">GPC visible to page</span><strong>${signals.gpcObserved ? 'Yes' : 'No'}</strong><span class="signal-note">The page exposed <code>navigator.globalPrivacyControl</code>.</span></div>
    <div class="signal-card"><span class="signal-label">Opt-out controls found</span><strong>${signals.hasOptOutControl ? 'Yes' : 'No'}</strong><span class="signal-note">This is a text and link discovery check, not proof that the control works.</span></div>
  </div>
  ${controls ? `<div class="finding-section-label" style="margin-top:1rem">Detected privacy controls</div><ul class="signal-controls">${controls}</ul>` : '<p class="signal-note" style="margin-top:1rem">No recognizable “Do Not Sell or Share”, “Your Privacy Choices”, opt-out, or sensitive-data limitation control was found. Verify manually because controls may be loaded after interaction or use different wording.</p>'}
  <p class="signal-disclaimer"><strong>Important:</strong> Sending GPC does not demonstrate that the business honored it. Verify response behavior, tag suppression, cookie changes, and the opt-out workflow manually.</p>
</details>`;
}

function renderAdvancedEvidence(scenarios) {
  if (!scenarios || !scenarios.length) return '';
  const hasData = scenarios.some(s =>
    s.indexedDB?.length ||
    s.webWorkers?.length ||
    s.formSubmissions?.length ||
    s.consentEvents?.length ||
    s.googleConsentMode
  );
  if (!hasData) return '';

  const cards = scenarios.map(sr => {
    const label = scenarioLabel(sr.scenario);
    const rows = [];
    if (sr.indexedDB?.length) {
      rows.push('<div class="finding-section-label">IndexedDB</div><ul>' + sr.indexedDB.map(db => `<li>${esc(db.name)} (v${esc(String(db.version))})</li>`).join('') + '</ul>');
    }
    if (sr.webWorkers?.length) {
      rows.push('<div class="finding-section-label">Web workers</div><ul>' + sr.webWorkers.map(w => `<li>${esc(w.scope)} — ${esc(w.state)}</li>`).join('') + '</ul>');
    }
    if (sr.formSubmissions?.length) {
      rows.push('<div class="finding-section-label">Forms</div><ul>' + sr.formSubmissions.map(f => `<li>${esc(f.method)} ${esc(f.action || location.href)}</li>`).join('') + '</ul>');
    }
    if (sr.consentEvents?.length) {
      rows.push('<div class="finding-section-label">Consent events</div><ul>' + sr.consentEvents.map(e => `<li>${esc(e.type)}</li>`).join('') + '</ul>');
    }
    if (sr.googleConsentMode) {
      rows.push('<div class="finding-section-label">Google Consent Mode</div><p>Detected</p>');
    }
    return `<div class="screenshot-card"><div class="sc-label">${esc(label)}</div>${rows.join('')}</div>`;
  }).join('');

  return `
<details class="report-section">
  <summary class="section-summary"><span class="section-toggle">&#9658;</span><h2>Advanced browser evidence</h2></summary>
  <p class="signal-note">IndexedDB, web workers, form actions, consent events, and Google Consent Mode signals detected during the scan.</p>
  <div class="screenshots">${cards}</div>
</details>`;
}

function renderCookieBreakdown(scenarios, cookieMapArr = []) {
  // Use accept-all as the full cookie picture; fall back to no-interaction
  const src = (scenarios || []).find(s => s.scenario === 'accept-all')
    || (scenarios || []).find(s => s.scenario === 'no-interaction');
  if (!src || !src.cookies || !src.cookies.length) return '';

  // Build classification lookup from cookieMap (authoritative source)
  const classLookup = {};
  for (const entry of (cookieMapArr || [])) {
    classLookup[`${entry.name}||${entry.domain}`] = entry.classification;
  }

  const counts = {};
  for (const c of src.cookies) {
    const cl = classLookup[`${c.name}||${c.domain}`] || c.classification;
    const cat = cl?.category || 'unknown';
    counts[cat] = (counts[cat] || 0) + 1;
  }

  const CAT_ORDER = ['advertising', 'analytics', 'functional', 'strictly-necessary', 'unknown'];
  const CAT_LABEL = {
    'advertising': 'Advertising',
    'analytics': 'Analytics',
    'functional': 'Functional',
    'strictly-necessary': 'Strictly necessary',
    'unknown': 'Unclassified',
  };
  const CAT_STYLE = {
    'advertising': 'background:#fef2f2;border-color:#fca5a5;color:#7f1d1d',
    'analytics': 'background:#eff6ff;border-color:#bfdbfe;color:#1e3a5f',
    'functional': 'background:#f0fdf4;border-color:#86efac;color:#14532d',
    'strictly-necessary': 'background:#f9fafb;border-color:#d1d5db;color:#374151',
    'unknown': 'background:#fffbeb;border-color:#fde68a;color:#78350f',
  };

  // All categories found, sorted by CAT_ORDER then alphabetically
  const cats = Object.keys(counts).sort((a, b) => {
    const ia = CAT_ORDER.indexOf(a), ib = CAT_ORDER.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });

  const label = src.scenario === 'accept-all' ? 'Accept-all cookie breakdown' : 'Cookie breakdown';
  const pills = cats.map(cat => {
    const style = CAT_STYLE[cat] || 'background:#f9fafb;border-color:#d1d5db;color:#374151';
    const lbl = CAT_LABEL[cat] || cat;
    return `<span class="cat-breakdown-pill" style="${style}">${counts[cat]}&thinsp;${esc(lbl)}</span>`;
  }).join('');

  return `<div class="cat-breakdown"><span class="cat-breakdown-label">${esc(label)}:</span>${pills}</div>`;
}

function renderSummary(data) {
  const { findings, scanStatus, scenarios, cookieMap } = data;
  const bySev = countBySev(findings);
  const verdict = buildVerdict(data);

  const summaryClass = scanStatus === 'blocked' ? 'summary-box blocked' : 'summary-box';

  const sevItems = [
    { sev: 'CRITICAL', count: bySev.CRITICAL },
    { sev: 'HIGH', count: bySev.HIGH },
    { sev: 'REVIEW', count: bySev.REVIEW },
    { sev: 'ADVISORY', count: bySev.ADVISORY },
  ];

  const counts = sevItems.map(({ sev, count }) => {
    const style = `color:${severityColour(sev)};background:${severityBg(sev)};border-color:${severityBorder(sev)}`;
    if (count > 0) {
      return `
    <a class="sev-count sev-count-link" style="${style}" onclick="jumpToSeverity('${sev.toLowerCase()}');return false;" href="#findings-group-${sev.toLowerCase()}" title="Jump to ${sev} findings">
      <span class="num">${count}</span>
      <span class="lbl">${sev}</span>
      <span class="sev-hint">view ↓</span>
    </a>`;
    }
    return `
    <div class="sev-count" style="${style}">
      <span class="num">${count}</span>
      <span class="lbl">${sev}</span>
    </div>`;
  }).join('');

  const manualScenarios = (scenarios || []).filter(s => s.status === 'manual-review-needed');
  const coverageNote = manualScenarios.length ? `
    <div class="coverage-note">
      <strong>Incomplete coverage:</strong>
      The following scenario${manualScenarios.length > 1 ? 's' : ''} could not be fully automated and
      ${manualScenarios.length > 1 ? 'are' : 'is'} absent from findings:
      ${manualScenarios.map(s => `<strong>${scenarioLabel(s.scenario)}</strong>${s.statusReason ? ` (${esc(s.statusReason)})` : ''}`).join(', ')}.
      These scenarios must be verified by a human tester before this report can be considered complete.
    </div>` : '';

  const cookieBreakdown = renderCookieBreakdown(scenarios, cookieMap);
  const nextActions = [];
  if (scanStatus === 'blocked') {
    nextActions.push('Repeat the assessment manually in a real browser session because automated coverage was blocked.');
  } else {
    if (bySev.CRITICAL > 0) nextActions.push(`<a href="#findings-group-critical" onclick="jumpToSeverity('critical');return false;">Fix the critical consent and tracking issues first</a>, then rerun the scan.`);
    if (bySev.HIGH > 0) nextActions.push(`<a href="#findings-group-high" onclick="jumpToSeverity('high');return false;">Review the consent banner interaction</a> so rejecting is as easy as accepting.`);
    if (bySev.REVIEW > 0) nextActions.push(`<a href="#findings-group-review" onclick="jumpToSeverity('review');return false;">Classify the items requiring review</a> and document whether each is strictly necessary.`);
    if (bySev.ADVISORY > 0) nextActions.push(`<a href="#findings-group-advisory" onclick="jumpToSeverity('advisory');return false;">Address advisory improvements</a> after the higher-priority findings are resolved.`);
    if (!nextActions.length) nextActions.push('Keep this report as a baseline and rerun the scan after consent, tag, or CMP changes.');
  }
  const nextActionsHtml = `<div class="next-actions"><div class="next-actions-title">Recommended next steps</div><ol>${nextActions.map(action => `<li>${action}</li>`).join('')}</ol></div>`;

  return `
<details class="report-section" open>
  <summary class="section-summary"><span class="section-toggle">&#9658;</span><h2>Executive Summary</h2></summary>
  <div class="severity-counts">${counts}</div>
  <div class="${summaryClass}">
    <p>${verdict}</p>
  </div>
  ${nextActionsHtml}
  ${cookieBreakdown}
  ${coverageNote}
</details>`;
}

function renderScanIntegrity(data) {
  const coverage = data.scanCoverage;
  if (!coverage) return '';
  const config = data.scanConfig || {};
  const warningHtml = coverage.warnings?.length
    ? `<div class="integrity-warning"><strong>Coverage warnings:</strong> ${coverage.warnings.map(esc).join(' · ')}</div>`
    : '<div class="integrity-warning" style="border-left-color:#22c55e;background:#f0fdf4;color:#166534"><strong>Coverage looks complete for the configured plan.</strong></div>';
  return `
<details class="report-section" open>
  <summary class="section-summary"><span class="section-toggle">&#9658;</span><h2>Scan integrity</h2></summary>
  <div class="integrity-grid">
    <div class="integrity-card"><strong>${esc(coverage.completenessPercent)}%</strong><span>Journey completeness</span></div>
    <div class="integrity-card"><strong>${esc(coverage.pagesCompleted)} / ${esc(coverage.pagesAttempted)}</strong><span>Pages completed</span></div>
    <div class="integrity-card"><strong>${esc(coverage.journeysCompleted)} / ${esc(coverage.journeysAttempted)}</strong><span>Journeys completed</span></div>
    <div class="integrity-card"><strong>${esc(config.scanProfile || 'standard')}</strong><span>Scan profile</span></div>
  </div>
  <div class="detail-grid"><span class="dk">Crawl mode</span><span class="dv">${esc(config.crawlMode || 'homepage')}</span><span class="dk">Region</span><span class="dv">${esc(data.region?.label || 'Not recorded')}</span><span class="dk">Framework</span><span class="dv">${esc(frameworkLabel(config.framework))}</span></div>
  ${warningHtml}
</details>`;
}

function renderJourneyMatrix(data) {
  const scenarios = data.scenarios || [];
  if (!scenarios.length) return '';
  const label = scenario => ({ 'no-interaction': 'Before consent', 'accept-all': 'Accept all', 'reject-all': 'Reject all', 'open-preferences': 'Open preferences', 'accept-analytics': 'Analytics only', 'accept-advertising': 'Advertising only' }[scenario] || scenario);
  const value = (scenario, getter) => {
    const result = scenarios.find(item => item.scenario === scenario);
    if (!result) return '<span class="journey-review">Not run</span>';
    if (result.status !== 'ok') return `<span class="journey-review">${esc(result.status)}</span>`;
    return String(getter(result));
  };
  const columns = scenarios.map(result => `<th>${esc(label(result.scenario))}</th>`).join('');
  const analyticsVendors = (scenario) => {
    const result = scenarios.find(item => item.scenario === scenario);
    if (!result || result.status !== 'ok') return '—';
    const domains = result.thirdPartyDomains || [];
    return domains.filter(d => /google-analytics|analytics|hotjar|clarity|chartbeat|heap|segment|amplitude|mixpanel/i.test(d)).length;
  };
  const advertisingVendors = (scenario) => {
    const result = scenarios.find(item => item.scenario === scenario);
    if (!result || result.status !== 'ok') return '—';
    const domains = result.thirdPartyDomains || [];
    return domains.filter(d => /doubleclick|googleadservices|googlesyndication|facebook|bing|criteo|taboola|outbrain|adnxs|pixel|quantserve|snapchat|tiktok|linkedin|yandex/i.test(d)).length;
  };
  return `
<details class="report-section" open>
  <summary class="section-summary"><span class="section-toggle">&#9658;</span><h2>Journey comparison</h2></summary>
  <p class="signal-note">Homepage evidence across the configured journeys. A count is not a compliance verdict; compare the differences and inspect the linked findings.</p>
  <div style="overflow-x:auto"><table class="journey-matrix"><thead><tr><th>Evidence</th>${columns}</tr></thead><tbody>
    <tr><td>Cookies observed</td>${scenarios.map(result => `<td>${value(result.scenario, item => item.cookies?.length || 0)}</td>`).join('')}</tr>
    <tr><td>Tracking domains</td>${scenarios.map(result => `<td>${value(result.scenario, item => item.thirdPartyDomains?.length || 0)}</td>`).join('')}</tr>
    <tr><td>Storage keys</td>${scenarios.map(result => `<td>${value(result.scenario, item => (item.storage?.localStorage?.length || 0) + (item.storage?.sessionStorage?.length || 0))}</td>`).join('')}</tr>
    <tr><td>Network requests</td>${scenarios.map(result => `<td>${value(result.scenario, item => item.requests?.length || 0)}</td>`).join('')}</tr>
    <tr><td>Analytics vendors</td>${scenarios.map(s => `<td>${analyticsVendors(s.scenario)}</td>`).join('')}</tr>
    <tr><td>Advertising vendors</td>${scenarios.map(s => `<td>${advertisingVendors(s.scenario)}</td>`).join('')}</tr>
  </tbody></table></div>
</details>`;
}

function renderAssuranceOverview(data) {
  const { findings = [], scanStatus, scanCoverage, privacySignals, scenarios = [] } = data;
  if (!findings.length && !scanCoverage) return '';

  const bySev = { CRITICAL: 0, HIGH: 0, REVIEW: 0, ADVISORY: 0 };
  for (const f of findings) bySev[f.severity] = (bySev[f.severity] || 0) + 1;

  const noInteraction  = scenarios.find(s => s.scenario === 'no-interaction');
  const rejectAll      = scenarios.find(s => s.scenario === 'reject-all');
  const withdrawScen   = scenarios.find(s => s.scenario === 'withdraw-consent');
  const revisitScen    = scenarios.find(s => s.scenario === 'revisit-after-consent');
  const gpcScen        = scenarios.find(s => s.scenario === 'gpc-comparison');

  const preConsentCookies   = noInteraction?.cookies?.length || 0;
  const preConsentRequests  = noInteraction?.requests?.length || 0;
  const thirdPartyDomains   = noInteraction?.thirdPartyDomains?.length || 0;
  const rejectPersistCookies = rejectAll?.cookies?.length || 0;
  const rejectNewCookies    = rejectAll?.newCookiesAfterReject?.length || 0;

  // Withdraw-consent panel
  let consentWithdrawal;
  let withdrawDetail = '';
  if (!withdrawScen) {
    consentWithdrawal = 'Not tested';
  } else if (withdrawScen.status === 'manual-review-needed') {
    consentWithdrawal = 'Review';
    withdrawDetail = withdrawScen.statusReason || 'Manual verification required';
  } else {
    const retained = withdrawScen.cookiesRetainedAfterWithdrawal || [];
    const nonEssential = retained.filter(c => {
      const cat = (c.classification?.category || '').toLowerCase();
      return cat && cat !== 'strictly necessary' && cat !== 'functional';
    });
    consentWithdrawal = nonEssential.length > 0 ? 'Fail' : retained.length > 0 ? 'Review' : 'Pass';
    if (nonEssential.length > 0) withdrawDetail = `${nonEssential.length} non-essential cookie${nonEssential.length !== 1 ? 's' : ''} retained after withdrawal`;
    else if (retained.length > 0) withdrawDetail = `${retained.length} cookie${retained.length !== 1 ? 's' : ''} retained — verify classification`;
    else withdrawDetail = 'No cookies retained after withdrawal';
  }

  // Revisit-after-consent panel
  let consentPersistence;
  let persistDetail = '';
  if (!revisitScen) {
    consentPersistence = 'Not tested';
  } else if (revisitScen.status === 'manual-review-needed') {
    consentPersistence = 'Review';
    persistDetail = revisitScen.statusReason || 'Manual verification required';
  } else {
    const bannerBack = revisitScen.revisitBannerReappeared;
    const persisted  = revisitScen.cookiesPersistedOnRevisit || [];
    if (bannerBack === true) {
      consentPersistence = 'Fail';
      persistDetail = 'Consent banner reappeared on revisit — choice not persisted';
    } else if (persisted.length > 0) {
      consentPersistence = 'Pass';
      persistDetail = `${persisted.length} consent cookie${persisted.length !== 1 ? 's' : ''} persisted across navigation`;
    } else {
      consentPersistence = 'Review';
      persistDetail = 'No consent cookies detected on revisit — persistence uncertain';
    }
  }

  const consentGating      = scanStatus === 'blocked' ? 'Not tested' : preConsentCookies > 0 ? 'Fail' : 'Pass';
  const rejectBehavior     = scanStatus === 'blocked' ? 'Not tested' : rejectNewCookies > 0 ? 'Fail' : rejectPersistCookies > 0 ? 'Review' : 'Pass';
  const trackingExposure   = scanStatus === 'blocked' ? 'Not tested' : thirdPartyDomains > 0 ? 'Review' : 'Pass';
  // Privacy signals / GPC — prefer GPC comparison data if available
  let privacySignalsStatus, gpcDetail;
  if (gpcScen && gpcScen.status === 'ok' && gpcScen.gpcDelta) {
    const { domainsBlockedByGpc, domainsUnchanged, gpcEffective } = gpcScen.gpcDelta;
    if (gpcEffective) {
      privacySignalsStatus = 'Review';
      gpcDetail = `GPC suppressed ${domainsBlockedByGpc.length} domain${domainsBlockedByGpc.length !== 1 ? 's' : ''} — signal honoured but trackers fire without it`;
    } else if (domainsUnchanged.length > 0) {
      privacySignalsStatus = 'Fail';
      gpcDetail = `GPC sent but ${domainsUnchanged.length} tracking domain${domainsUnchanged.length !== 1 ? 's' : ''} contacted in both GPC and non-GPC runs — signal not respected`;
    } else {
      privacySignalsStatus = 'Pass';
      gpcDetail = 'No tracking domains detected in either GPC run';
    }
  } else {
    privacySignalsStatus = privacySignals?.hasOptOutControl ? 'Pass' : privacySignals?.gpcObserved ? 'Review' : 'Not tested';
    gpcDetail = privacySignals?.gpcObserved ? 'GPC signal observed' : privacySignals?.hasOptOutControl ? 'Opt-out control found' : 'GPC / opt-out not tested';
  }
  const scanCompleteness   = scanCoverage?.completenessPercent >= 100 ? 'Pass' : scanCoverage?.completenessPercent >= 50 ? 'Review' : 'Fail';

  const badge = value => {
    const cls = value === 'Pass' ? 'badge-ok' : value === 'Fail' ? 'badge-manual' : value === 'Review' ? 'badge-review' : 'badge';
    return `<span class="badge ${cls}">${esc(value)}</span>`;
  };

  const areaRow = (label, result, detail) => `
    <div class="ao-row">
      <span class="ao-label">${esc(label)}</span>
      <span class="ao-result">${badge(result)}</span>
      ${detail ? `<span class="ao-detail">${esc(detail)}</span>` : '<span class="ao-detail"></span>'}
    </div>`;

  return `
<details class="report-section" open>
  <summary class="section-summary"><span class="section-toggle">&#9658;</span><h2>Assurance overview</h2></summary>
  <p class="signal-note">Automated checks across the configured journeys. Each row shows Pass, Fail, Review, or Not tested based on the evidence collected.</p>
  <div class="ao-table">
    <div class="ao-head">
      <span>Area</span><span>Result</span><span>Detail</span>
    </div>
    ${areaRow('Consent gating',       consentGating,      consentGating === 'Fail' ? `${preConsentCookies} cookie${preConsentCookies !== 1 ? 's' : ''} set before consent` : consentGating === 'Pass' ? 'No cookies set before consent' : '')}
    ${areaRow('Reject behavior',      rejectBehavior,     rejectBehavior === 'Fail' ? `${rejectNewCookies} new cookie${rejectNewCookies !== 1 ? 's' : ''} set after reject-all` : rejectBehavior === 'Review' ? `${rejectPersistCookies} cookies persisted — verify necessity` : rejectBehavior === 'Pass' ? 'No tracking cookies after rejection' : '')}
    ${areaRow('Consent withdrawal',   consentWithdrawal,  withdrawDetail)}
    ${areaRow('Consent persistence',  consentPersistence, persistDetail)}
    ${areaRow('Tracking exposure',    trackingExposure,   thirdPartyDomains > 0 ? `${thirdPartyDomains} third-party domain${thirdPartyDomains !== 1 ? 's' : ''} contacted before consent` : 'No third-party tracking before consent')}
    ${areaRow('Privacy signals (GPC)', privacySignalsStatus, gpcDetail)}
    ${areaRow('Scan completeness',    scanCompleteness,   `${scanCoverage?.completenessPercent ?? 0}% of journeys completed${(scanCoverage?.warnings || []).length ? ' — ' + scanCoverage.warnings.join(' · ') : ''}`)}
  </div>
  <div class="detail-grid" style="margin-top:16px">
    <span class="dk">Pre-consent cookies</span><span class="dv">${esc(preConsentCookies)}</span>
    <span class="dk">Pre-consent requests</span><span class="dv">${esc(preConsentRequests)}</span>
    <span class="dk">Third-party domains</span><span class="dv">${esc(thirdPartyDomains)}</span>
    <span class="dk">Reject-new cookies</span><span class="dv">${esc(rejectNewCookies)}</span>
    <span class="dk">Critical findings</span><span class="dv">${esc(bySev.CRITICAL)}</span>
    <span class="dk">High findings</span><span class="dv">${esc(bySev.HIGH)}</span>
  </div>
</details>`;
}

function renderJourneyDelta(scenarios) {
  if (!scenarios || !scenarios.length) return '';

  const baseline = scenarios.find(s => s.scenario === 'no-interaction');
  if (!baseline || !baseline.requests?.length) return '';

  const baselineUrls = new Set(baseline.requests.map(r => r.url));

  const cards = scenarios
    .filter(s => s.scenario !== 'no-interaction' && s.requests?.length)
    .map(sr => {
      const label = scenarioLabel(sr.scenario);
      const srUrls = new Set(sr.requests.map(r => r.url));
      const newReqs = [...srUrls].filter(u => !baselineUrls.has(u));
      const shared = [...srUrls].filter(u => baselineUrls.has(u)).length;
      const added = newReqs.length;
      const removed = [...baselineUrls].filter(u => !srUrls.has(u)).length;

      const rows = newReqs.slice(0, 20).map(u => {
        const req = sr.requests.find(r => r.url === u);
        const initiator = req?.initiator || '—';
        const ts = req?.timestamp ? new Date(req.timestamp).toLocaleTimeString('en-GB', { hour12: false }) : '—';
        return `<tr><td class="request-url">${esc(u)}</td><td class="request-init">${esc(initiator)}</td><td>${esc(ts)}</td></tr>`;
      }).join('');

      return `
<div style="margin-bottom:1rem">
  <div style="font-weight:700;font-size:0.9rem;margin-bottom:0.35rem">${esc(label)}</div>
  <div style="display:flex;gap:12px;font-size:0.82rem;color:var(--muted);margin-bottom:0.5rem">
    <span>${shared} shared requests</span>
    <span style="color:#14532d">+${added} new</span>
    ${removed ? `<span style="color:#7f1d1d">-${removed} removed</span>` : ''}
  </div>
  ${added ? `<div style="overflow-x:auto"><table class="request-table"><thead><tr><th>URL</th><th>Initiator</th><th>Time</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p style="color:var(--muted);font-size:0.82rem">No new requests.</p>'}
</div>`;
    }).join('');

  return `
<details class="report-section">
  <summary class="section-summary"><span class="section-toggle">&#9658;</span><h2>Journey delta — request differences</h2></summary>
  <p style="color:var(--muted);font-size:0.85rem;margin:0.75rem 0 0">Compares each journey against the no-interaction baseline. Shows requests that appeared after the consent action.</p>
  ${cards}
</details>`;
}

function renderEvidenceTimeline(data) {
  const { scenarios = [], findings = [], url } = data;
  if (!scenarios.length || !findings.length) return '';

  const scenarioMap = Object.fromEntries(scenarios.map(s => [s.scenario, s]));
  const items = [];

  for (const f of findings) {
    if (f.confidence !== 'high' && f.severity !== 'CRITICAL') continue;
    const scenario = scenarioMap[f.scenario];
    if (!scenario) continue;

    const evidence = f.evidenceType === 'cookie'
      ? `Cookie: ${f.cookieName || 'unknown'} @ ${f.domain || 'unknown'}`
      : f.evidenceType === 'network-request'
        ? `Request: ${f.domain || 'unknown'}`
        : f.evidenceType === 'storage'
          ? 'Storage write'
          : f.title || 'Finding';

    const consentState = f.scenario === 'no-interaction' ? 'Before consent' :
      f.scenario === 'accept-all' ? 'After accept-all' :
      f.scenario === 'reject-all' ? 'After reject-all' :
      f.scenario === 'open-preferences' ? 'Preferences opened' :
      f.scenario === 'accept-analytics' ? 'Analytics accepted' :
      f.scenario === 'accept-advertising' ? 'Advertising accepted' :
      f.scenario;

    // Find the most relevant request for this finding's domain
    const domain = f.domain ? f.domain.replace(/^\./, '') : null;
    const relevantReq = domain
      ? (scenario.requests || []).find(r => { try { return new URL(r.url).hostname.endsWith(domain); } catch { return false; } })
      : (scenario.requests?.[0] || null);
    const t0 = scenario.requests?.[0]?.timestamp;
    const relMs = relevantReq && t0 ? relevantReq.timestamp - t0 : 0;

    items.push({
      time: relevantReq?.timestamp || scenario.requests?.[0]?.timestamp || Date.now(),
      relMs,
      page: url,
      scenario: scenarioLabel(f.scenario),
      consentState,
      evidence,
      initiator: relevantReq?.initiator || null,
    });
  }

  items.sort((a, b) => a.time - b.time);

  const rows = items.map(item => {
    const ts = new Date(item.time).toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const rel = item.relMs > 0 ? `+${(item.relMs / 1000).toFixed(2)}s` : '—';
    const initiatorShort = item.initiator ? item.initiator.replace(/^https?:\/\/[^/]+/, '') || item.initiator : '—';
    return `<tr>
      <td>${esc(ts)}</td>
      <td class="ev-ts">${esc(rel)}</td>
      <td>${esc(item.page)}</td>
      <td>${esc(item.scenario)}</td>
      <td>${esc(item.consentState)}</td>
      <td>${esc(item.evidence)}</td>
      <td class="ev-init" title="${esc(item.initiator || '')}">${esc(initiatorShort)}</td>
    </tr>`;
  }).join('');

  return `
<details class="report-section">
  <summary class="section-summary"><span class="section-toggle">&#9658;</span><h2>Evidence timeline</h2></summary>
  <p class="signal-note">Sequence of high-confidence findings across the scan. Timestamps are relative to the start of each scenario.</p>
  <div style="overflow-x:auto">
    <table class="cookie-table">
      <thead><tr><th>Time</th><th>+Offset</th><th>Page</th><th>Scenario</th><th>Consent state</th><th>Evidence</th><th>Initiator</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
</details>`;
}

function renderRemediationWidget(f) {
  const r = f.remediation;
  const statusOpts = ['open', 'investigating', 'fixed', 'accepted risk'];
  const priorityOpts = ['low', 'medium', 'high', 'critical'];

  const statusSel = statusOpts.map(o =>
    `<option value="${esc(o)}" ${r?.status === o ? 'selected' : (!r && o === 'open') ? 'selected' : ''}>${esc(o.charAt(0).toUpperCase() + o.slice(1))}</option>`
  ).join('');
  const prioritySel = priorityOpts.map(o =>
    `<option value="${esc(o)}" ${r?.priority === o ? 'selected' : (!r && o === 'medium') ? 'selected' : ''}>${esc(o.charAt(0).toUpperCase() + o.slice(1))}</option>`
  ).join('');

  const dueVal = r?.due_date ? new Date(r.due_date).toISOString().slice(0, 10) : '';
  const isOverdue = r?.due_date && r.status !== 'fixed' && r.status !== 'accepted risk' && new Date(r.due_date) < new Date();

  const ownerVal = r?.owner_email || '';

  const savedBadge = r
    ? `<span class="remediation-saved-badge rem-status-${esc((r.status || 'open').replace(/\s+/g, '-'))}">
        ${esc(r.status || 'open')} · ${esc(r.priority || 'medium')}${r.owner_email ? ' · ' + esc(r.owner_email) : ''}${isOverdue ? ' <span style="color:#ef4444;font-weight:700">⚠ Overdue</span>' : ''}
       </span>`
    : '';

  return `
<div class="remediation-widget" data-finding-id="${esc(f.id)}">
  <div class="finding-section-label" style="display:flex;align-items:center;gap:8px;cursor:pointer" onclick="toggleRemediation('${esc(f.id)}')">
    <span>Remediation</span>
    ${savedBadge}
    <span class="rem-toggle-btn" id="rem-toggle-${esc(f.id)}">${r ? 'Edit ▾' : '+ Set ▾'}</span>
  </div>
  <div class="remediation-form" id="rem-form-${esc(f.id)}" style="display:none;margin-top:8px">
    <div class="remediation-box">
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px">
        <div>
          <label for="rem-status-${esc(f.id)}">Status</label>
          <select id="rem-status-${esc(f.id)}">${statusSel}</select>
        </div>
        <div>
          <label for="rem-priority-${esc(f.id)}">Priority</label>
          <select id="rem-priority-${esc(f.id)}">${prioritySel}</select>
        </div>
        <div>
          <label for="rem-due-${esc(f.id)}">Due date</label>
          <input type="date" id="rem-due-${esc(f.id)}" value="${esc(dueVal)}">
        </div>
      </div>
      <div style="margin-top:8px">
        <label for="rem-owner-${esc(f.id)}">Owner email</label>
        <input type="email" id="rem-owner-${esc(f.id)}" value="${esc(ownerVal)}" placeholder="owner@example.com" style="width:100%;box-sizing:border-box">
      </div>
      <div>
        <label for="rem-notes-${esc(f.id)}">Notes</label>
        <textarea id="rem-notes-${esc(f.id)}" placeholder="Describe the remediation plan, ticket link, or rationale…">${esc(r?.notes || '')}</textarea>
      </div>
      <div class="remediation-actions">
        <button type="button" class="rem-save-btn" onclick="saveRemediation('${esc(f.id)}')">Save</button>
        <span class="rem-feedback" id="rem-feedback-${esc(f.id)}" style="display:none;font-size:.82rem"></span>
      </div>
    </div>
  </div>
</div>`;
}

function renderFinding(f) {
  const plain = plainEnglish(f);

  const et = f.evidenceType;
  const detailRows = [];
  if (et === 'network-request') {
    if (f.domain) detailRows.push(['Domain', f.domain]);
    if (f.scenario) detailRows.push(['Detected in', scenarioLabel(f.scenario)]);
    detailRows.push(['Evidence type', 'Network request (no cookie set)']);
  } else if (et === 'storage') {
    if (f.scenario) detailRows.push(['Detected in', scenarioLabel(f.scenario)]);
    detailRows.push(['Evidence type', 'Browser storage write']);
  } else if (et === 'banner' || et === 'scan') {
    if (f.scenario) detailRows.push(['Detected in', scenarioLabel(f.scenario)]);
  } else {
    // cookie (default)
    if (f.cookieName) detailRows.push(['Cookie name', f.cookieName]);
    if (f.domain) detailRows.push(['Domain', f.domain]);
    if (f.scenario) detailRows.push(['Detected in', scenarioLabel(f.scenario)]);
    if (f.category) detailRows.push(['Category', f.category]);
    if (f.provider) detailRows.push(['Provider', f.provider]);
  }

  const detailHtml = detailRows.length ? `
    <div>
      <div class="finding-section-label">Technical detail</div>
      <div class="detail-grid">
        ${detailRows.map(([k, v]) => `<span class="dk">${esc(k)}</span><span class="dv">${esc(v)}</span>`).join('')}
      </div>
    </div>` : '';

  // Compact meta line shown in the collapsed header so you know what each finding
  // is about without opening it: cookie name · domain · category · scenario pill
  const metaParts = [];
  if (f.cookieName) metaParts.push(`<span class="finding-meta-cookie">${esc(f.cookieName)}</span>`);
  if (f.domain) metaParts.push(`<span>· ${esc(f.domain)}</span>`);
  if (f.category) metaParts.push(`<span>· ${esc(f.category)}</span>`);
  if (f.scenario) metaParts.push(`<span class="finding-meta-scenario">${esc(scenarioLabel(f.scenario))}</span>`);
  const metaHtml = metaParts.length
    ? `<div class="finding-meta">${metaParts.join(' ')}</div>` : '';

  // Inline request evidence timeline (attached by buildReport)
  let evidenceTimelineHtml = '';
  if (Array.isArray(f._requestEvidence) && f._requestEvidence.length) {
    const eRows = f._requestEvidence.map(r => {
      const relSec = (r.relativeMs / 1000).toFixed(2);
      let shortUrl = r.url;
      try { const u = new URL(r.url); shortUrl = u.hostname + u.pathname.slice(0, 60) + (u.pathname.length > 60 ? '…' : '') + (u.search ? '?' + u.search.slice(1, 40) + (u.search.length > 41 ? '…' : '') : ''); } catch { /* keep as-is */ }
      const initiatorShort = r.initiator ? r.initiator.replace(/^https?:\/\/[^/]+/, '') || r.initiator : '—';
      return `<tr>
        <td class="ev-ts">+${relSec}s</td>
        <td class="ev-method">${esc(r.method || 'GET')}</td>
        <td class="ev-type">${esc(r.resourceType || '—')}</td>
        <td class="ev-url" title="${esc(r.url)}">${esc(shortUrl)}</td>
        <td class="ev-init" title="${esc(r.initiator || '')}">${esc(initiatorShort)}</td>
      </tr>`;
    }).join('');
    evidenceTimelineHtml = `
    <details class="ev-timeline-block">
      <summary class="ev-tl-toggle">Request evidence (${f._requestEvidence.length} request${f._requestEvidence.length !== 1 ? 's' : ''} to ${esc(f.domain || 'domain')})</summary>
      <div style="overflow-x:auto;margin-top:0.5rem">
        <table class="ev-tl-table">
          <thead><tr><th>+Time</th><th>Method</th><th>Type</th><th>URL</th><th>Initiator</th></tr></thead>
          <tbody>${eRows}</tbody>
        </table>
      </div>
    </details>`;
  }

  return `
<details class="finding" ${findingDataAttrs([f])}>
  <summary class="finding-header">
    <span class="finding-expand">&#9658;</span>
    <span class="finding-id">${esc(f.id)}</span>
    <div class="finding-header-content">
      <span class="finding-title">${esc(f.title)}</span>
      ${metaHtml}
    </div>
  </summary>
  <div class="finding-body">
    <div>
      <div class="finding-section-label">What this means</div>
      <p class="finding-plain">${plain}</p>
    </div>
    ${detailHtml}
    ${evidenceTimelineHtml}
    <div>
      <div class="finding-section-label">Regulation</div>
      <p class="reg-ref">${esc(f.regulation)}</p>
    </div>
    ${renderGuidanceBlock(f)}
    ${renderRemediationWidget(f)}
  </div>
</details>`;
}

/**
 * Group findings with the same title+scenario into a single card.
 * Singleton groups render as-is; multi-cookie groups get a cookie table.
 */
function renderFindingGroup(group) {
  if (group.length === 1) return renderFinding(group[0]);

  const first = group[0];
  const plain = plainEnglish(first);

  // Meta: count + scenario pill
  const metaHtml = `<div class="finding-meta">
    <span>${group.length} cookies affected</span>
    ${first.scenario ? `<span class="finding-meta-scenario">${esc(scenarioLabel(first.scenario))}</span>` : ''}
  </div>`;

  // Cookie table listing all affected cookies
  const rows = group.filter(f => f.cookieName).map(f => `
<tr>
  <td><span class="cookie-name">${esc(f.cookieName)}</span></td>
  <td>${esc(f.domain || '—')}</td>
  <td>${esc(f.category || '—')}</td>
  <td>${esc(f.provider || '—')}</td>
</tr>`).join('');

  const tableHtml = rows ? `
    <div>
      <div class="finding-section-label">Affected cookies (${group.length})</div>
      <div style="overflow-x:auto">
        <table class="cookie-table">
          <thead><tr><th>Cookie</th><th>Domain</th><th>Category</th><th>Provider</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>` : '';

  return `
<details class="finding" ${findingDataAttrs(group)}>
  <summary class="finding-header">
    <span class="finding-expand">&#9658;</span>
    <span class="finding-id">${esc(first.id)}</span>
    <div class="finding-header-content">
      <span class="finding-title">${esc(first.title)}</span>
      ${metaHtml}
    </div>
  </summary>
  <div class="finding-body">
    <div>
      <div class="finding-section-label">What this means</div>
      <p class="finding-plain">${plain}</p>
    </div>
    ${tableHtml}
    <div>
      <div class="finding-section-label">Regulation</div>
      <p class="reg-ref">${esc(first.regulation)}</p>
    </div>
    <div>
      <div class="finding-section-label">How to fix</div>
      <div class="guidance-box">${esc(first.guidance)}</div>
    </div>
  </div>
</details>`;
}

function findingDataAttrs(group) {
  const values = group.flatMap(f => [
    f.id, f.title, f.description, f.guidance, f.cookieName, f.domain,
    f.category, f.provider, f.scenario, f.evidenceType, f.regulation,
  ]).filter(Boolean);
  return [
    `data-severity="${esc(group[0].severity)}"`,
    `data-evidence="${esc(group[0].evidenceType || 'other')}"`,
    `data-category="${esc([...new Set(group.map(f => f.category).filter(Boolean))].join('|'))}"`,
    `data-search="${esc(values.join(' ').toLowerCase())}"`,
  ].join(' ');
}

function renderFindings(findings) {
  if (!findings.length) {
    return `
<details class="report-section" open>
  <summary class="section-summary"><span class="section-toggle">&#9658;</span><h2>Findings</h2></summary>
  <p>No issues were detected in the tests performed.</p>
</details>`;
  }

  const sevGroups = ['CRITICAL', 'HIGH', 'REVIEW', 'ADVISORY'];
  const bySev = {};
  for (const g of sevGroups) bySev[g] = findings.filter(f => f.severity === g);

  const groupHtml = sevGroups
    .filter(g => bySev[g].length)
    .map(g => {
      const colour = severityColour(g);
      const bg = severityBg(g);
      const border = severityBorder(g);

      // Group findings with the same title+scenario into single cards
      const titleGroups = new Map();
      for (const f of bySev[g]) {
        const key = `${f.title}||${f.scenario || ''}`;
        if (!titleGroups.has(key)) titleGroups.set(key, []);
        titleGroups.get(key).push(f);
      }
      const cardCount = titleGroups.size;

      return `
<div class="findings-group" id="findings-group-${g.toLowerCase()}">
  <div class="findings-group-header" style="background:${bg};color:${colour};border:1px solid ${border}">
    <span>${g}</span>
    <span style="font-weight:400;font-size:0.85rem">${cardCount} finding${cardCount !== 1 ? 's' : ''}</span>
  </div>
  ${[...titleGroups.values()].map(renderFindingGroup).join('')}
</div>`;
    }).join('');

  const controls = `<div class="findings-controls" role="search" aria-label="Filter findings">
  <span class="findings-filter-label">Filter</span>
  <input id="finding-search" type="search" placeholder="Search title, cookie, provider..." aria-label="Search findings" oninput="filterFindings()">
  <select id="finding-severity" aria-label="Filter by severity" onchange="filterFindings()">
    <option value="">All severities</option>
    ${sevGroups.map(g => `<option value="${g}">${g}</option>`).join('')}
  </select>
  <select id="finding-evidence" aria-label="Filter by evidence type" onchange="filterFindings()">
    <option value="">All evidence</option>
    <option value="cookie">Cookie</option>
    <option value="network-request">Network request</option>
    <option value="banner">Banner</option>
    <option value="storage">Browser storage</option>
  </select>
  <select id="finding-category" aria-label="Filter by category" onchange="filterFindings()">
    <option value="">All categories</option>
    <option value="analytics">Analytics</option>
    <option value="advertising">Advertising</option>
    <option value="functional">Functional</option>
    <option value="strictly-necessary">Strictly necessary</option>
  </select>
  <div class="findings-actions">
    <button type="button" onclick="expandVisibleFindings()">Expand visible</button>
    <button type="button" onclick="collapseVisibleFindings()">Collapse visible</button>
    <button type="button" onclick="clearFindingFilters()">Clear</button>
  </div>
  <span class="findings-result-count" id="findings-result-count" aria-live="polite"></span>
</div>`;

  return `
<details class="report-section" open id="section-findings">
  <summary class="section-summary"><span class="section-toggle">&#9658;</span><h2>Findings</h2></summary>
  ${controls}
  ${groupHtml}
  <div class="findings-empty" id="findings-empty">No findings match these filters.</div>
</details>`;
}

function renderPlaybook(data) {
  const cmpName = data.cmp?.name;
  const pb = loadPlaybook(cmpName);
  if (!pb) return '';

  const isGeneric = pb.cmp === 'Generic';
  const cmpLabel = isGeneric ? 'Generic guidance (no named CMP detected)' : `Fix guidance — ${pb.cmp}`;

  // If a named CMP was found, also load generic as supplementary
  let supplementary = '';
  if (!isGeneric && cmpName && cmpName !== 'None') {
    const gen = loadPlaybook('generic');
    if (gen) {
      supplementary = `
  <h3 style="margin-top:1.5rem">Generic guidance (tag manager / direct blocking)</h3>
  <p class="playbook-intro">${esc(gen.intro)}</p>
  ${gen.sections.map(s => `
    <div class="playbook-section">
      <h3>${esc(s.title)}</h3>
      <ol>${s.steps.map(step => `<li>${esc(step)}</li>`).join('')}</ol>
    </div>`).join('')}`;
    }
  }

  return `
<details class="report-section">
  <summary class="section-summary"><span class="section-toggle">&#9658;</span><h2>Fix Guidance</h2></summary>
  <div class="playbook">
    <h3>${esc(cmpLabel)}</h3>
    <p class="playbook-intro">${esc(pb.intro)}</p>
    ${pb.sections.map(s => `
    <div class="playbook-section">
      <h3>${esc(s.title)}</h3>
      <ol>${s.steps.map(step => `<li>${esc(step)}</li>`).join('')}</ol>
    </div>`).join('')}
    ${supplementary}
  </div>
</details>`;
}

function renderInventory(scenarios, cookieMapArr = [], pageResults = null) {
  if (!scenarios || !scenarios.length) return '';

  const CATEGORY_ORDER = ['strictly-necessary', 'functional', 'analytics', 'advertising', 'unknown'];
  const CATEGORY_LABELS = {
    'strictly-necessary': 'Strictly Necessary',
    'functional': 'Functional',
    'analytics': 'Analytics',
    'advertising': 'Advertising',
    'unknown': 'Unclassified',
  };

  // Build authoritative classification lookup from cookieMap
  const classLookup = {};
  for (const entry of (cookieMapArr || [])) {
    classLookup[`${entry.name}||${entry.domain}`] = entry.classification;
  }

  // Build page-found lookup AND collect union of all cookies across all pages
  const isMultiPage = pageResults && pageResults.length > 1;
  const totalPageCount = isMultiPage ? pageResults.length : 1;
  const pageFoundMap = {}; // cookieKey → Set<pagePath>

  const allCookies = new Map();

  function addCookie(c, scenario, pagePath) {
    const key = `${c.name}||${c.domain}`;
    const classification = classLookup[key] || c.classification;
    if (!allCookies.has(key)) {
      allCookies.set(key, { ...c, classification, scenariosFound: new Set() });
    }
    allCookies.get(key).scenariosFound.add(scenario);
    if (isMultiPage && pagePath) {
      if (!pageFoundMap[key]) pageFoundMap[key] = new Set();
      pageFoundMap[key].add(pagePath);
    }
  }

  if (isMultiPage) {
    for (const pr of pageResults) {
      let pagePath;
      try { pagePath = new URL(pr.url).pathname || '/'; } catch (_) { pagePath = pr.url; }
      for (const sr of (pr.scenarios || [])) {
        for (const c of (sr.cookies || [])) {
          addCookie(c, sr.scenario, pagePath);
        }
      }
    }
  } else {
    for (const sr of scenarios) {
      for (const c of (sr.cookies || [])) {
        addCookie(c, sr.scenario, null);
      }
    }
  }

  // Convert Set → sorted Array for scenariosFound
  const SCENARIO_ORDER = ['no-interaction', 'accept-all', 'reject-all'];
  for (const [, cookie] of allCookies) {
    cookie.scenariosFound = [...cookie.scenariosFound]
      .sort((a, b) => SCENARIO_ORDER.indexOf(a) - SCENARIO_ORDER.indexOf(b));
  }

  // Group by category
  const groups = {};
  for (const cat of CATEGORY_ORDER) groups[cat] = [];
  for (const [, cookie] of allCookies) {
    const rawCat = cookie.classification?.category || 'unknown';
    const cat = CATEGORY_ORDER.includes(rawCat) ? rawCat : 'unknown';
    groups[cat].push(cookie);
  }
  for (const cat of CATEGORY_ORDER) {
    groups[cat].sort((a, b) => a.name.localeCompare(b.name));
  }

  const totalCookies = allCookies.size;
  if (totalCookies === 0) return '';

  // Summary pills
  const summaryPills = CATEGORY_ORDER
    .filter(cat => groups[cat].length > 0)
    .map(cat => {
      const slug = cat.replace(/[^a-z-]/g, '');
      return `<a class="cat-pill cat-${slug} inv-pill-link" href="#inv-cat-${slug}">${esc(CATEGORY_LABELS[cat])} <strong>${groups[cat].length}</strong></a>`;
    }).join('');

  // Scenario tag helper (colour-coded)
  function scenarioTag(s) {
    const map = {
      'no-interaction': ['None', 'st-none'],
      'accept-all': ['Accept', 'st-accept'],
      'reject-all': ['Reject', 'st-reject'],
    };
    const [label, cls] = map[s] || [s, ''];
    return `<span class="scenario-tag ${cls}">${label}</span>`;
  }

  // Pages cell helper
  function pagesCell(key) {
    if (!isMultiPage) return '';
    const paths = [...(pageFoundMap[key] || [])].sort();
    if (!paths.length) return '<td class="pages-cell">—</td>';
    if (paths.length === totalPageCount) {
      return `<td class="pages-cell pages-all">${totalPageCount}/${totalPageCount} pages</td>`;
    }
    if (paths.length === 1) {
      return `<td class="pages-cell pages-some">${esc(paths[0])}</td>`;
    }
    const items = paths.map(p => `<li class="pages-list-item">${esc(p)}</li>`).join('');
    return `<td class="pages-cell pages-some"><details class="pages-details"><summary class="pages-summary">${paths.length}/${totalPageCount} pages</summary><ul class="pages-list">${items}</ul></details></td>`;
  }

  const thPages = isMultiPage ? '<th>Found on</th>' : '';

  // Category group blocks
  const groupBlocks = CATEGORY_ORDER.map(cat => {
    const cookies = groups[cat];
    if (!cookies.length) return '';
    const slug = cat.replace(/[^a-z-]/g, '');
    const label = CATEGORY_LABELS[cat];
    const isUnclassified = cat === 'unknown';

    // For multi-page: sort site-wide cookies first, then page-specific
    const sortedCookies = !isMultiPage ? cookies : [
      ...cookies.filter(c => (pageFoundMap[`${c.name}||${c.domain}`]?.size || 0) === totalPageCount),
      ...cookies.filter(c => (pageFoundMap[`${c.name}||${c.domain}`]?.size || 0) < totalPageCount),
    ];

    const siteWideCount = !isMultiPage ? cookies.length : cookies.filter(c => (pageFoundMap[`${c.name}||${c.domain}`]?.size || 0) === totalPageCount).length;
    const pageSpecificCount = cookies.length - siteWideCount;

    // Build rows, inserting a divider between site-wide and page-specific
    const rows = (() => {
      const allRows = sortedCookies.map((c, idx) => {
        const key = `${c.name}||${c.domain}`;
        const expires = typeof c.expiresDays === 'number'
          ? (c.expiresDays === 0 ? 'session' : `${c.expiresDays}d`)
          : (c.expiresDays || '—');
        const seenIn = c.scenariosFound.map(scenarioTag).join(' ');
        const rowCls = isUnclassified ? ' class="row-unclassified"' : '';
        const conf = c.classification?.confidence || 'unknown';
        const confBadge = conf === 'high'
          ? `<span class="conf-badge conf-high" title="Exact name match in cookie database">High</span>`
          : conf === 'medium'
            ? `<span class="conf-badge conf-medium" title="Pattern match: ${esc(c.classification?.matchingRule || '')}">Medium</span>`
            : `<span class="conf-badge conf-unknown" title="Not found in database — manual review required">Unknown</span>`;
        const providerTitle = c.classification?.matchingRule
          ? `title="${esc('Rule: ' + c.classification.matchingRule + (c.classification.evidenceSource ? ' · Source: ' + c.classification.evidenceSource : ''))}"`
          : '';
        const investigationHint = conf !== 'high' && c.classification?.investigationContext
          ? `<div class="inv-hint" title="Investigation hint">${esc(c.classification.investigationContext)}</div>`
          : '';
        const divider = (isMultiPage && pageSpecificCount > 0 && idx === siteWideCount && siteWideCount > 0)
          ? `<tr class="page-specific-divider"><td colspan="9"><span>Page-specific cookies (${pageSpecificCount}) — not present on all scanned pages</span></td></tr>`
          : '';
        return divider + `<tr${rowCls}>
  <td><span class="cookie-name">${esc(c.name)}</span></td>
  <td class="domain-cell">${esc(c.domain)}</td>
  <td ${providerTitle}>${esc(c.classification?.provider || '—')}</td>
  <td class="purpose-cell"><span class="purpose-text" title="${esc(c.classification?.description || '')}">${esc(c.classification?.description || '—')}</span>${investigationHint}</td>
  <td class="life-cell" style="white-space:nowrap">${esc(expires)}</td>
  <td class="party-cell">${c.thirdParty ? '<span class="party-3rd">3rd</span>' : '<span class="party-1st">1st</span>'}</td>
  <td class="seenin-cell">${seenIn}</td>
  <td class="conf-cell">${confBadge}</td>
  ${pagesCell(key)}
</tr>`;
      });
      return allRows.join('');
    })();

    const groupNote = isUnclassified
      ? `<p class="unclassified-note">⚠ These cookies are not in the classification database. Each must be manually reviewed to determine whether it requires consent.</p>`
      : '';

    return `<details id="inv-cat-${slug}" class="cat-group" open>
  <summary class="cat-group-summary">
    <span class="cat-pill cat-${slug}">${esc(label)}</span>
    <span class="cat-count">${cookies.length} cookie${cookies.length !== 1 ? 's' : ''}</span>
  </summary>
  ${groupNote}<div style="overflow-x:auto">
    <table class="cookie-table">
      <thead><tr>
        <th>Name</th><th>Domain</th><th>Provider</th><th>Purpose</th>
        <th>Life</th><th>Party</th><th>Consent</th><th>Confidence</th>${thPages}
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
</details>`;
  }).join('');

  return `<details class="report-section" open>
  <summary class="section-summary"><span class="section-toggle">&#9658;</span><h2>Cookie Inventory <span class="badge-total">${totalCookies}</span></h2></summary>
  <div class="inv-summary">${summaryPills}</div>
  ${groupBlocks}
</details>`;
}

function renderEvidence(scenarios, scanDir) {
  if (!scenarios || !scenarios.length) return '';

  const cards = scenarios.map(sr => {
    const label = scenarioLabel(sr.scenario);
    const uri = sr.screenshotPath ? imgToDataUri(sr.screenshotPath, scanDir) : null;
    const status = sr.status;
    const statusBadge = status !== 'ok'
      ? `<span class="badge badge-manual">${esc(status)}</span>`
      : `<span class="badge badge-ok">ok</span>`;

    const imgHtml = uri
      ? `<img src="${uri}" alt="Screenshot: ${esc(label)}" loading="lazy">`
      : `<p class="screenshot-missing">Screenshot not available.</p>`;

    return `
<div class="screenshot-card">
  <div class="sc-label">${esc(label)} ${statusBadge}</div>
  ${imgHtml}
</div>`;
  }).join('');

  return `
<details class="report-section">
  <summary class="section-summary"><span class="section-toggle">&#9658;</span><h2>Evidence — Screenshots</h2></summary>
  <div class="screenshots">${cards}</div>
</details>`;
}

function renderRequestEvidence(scenarios) {
  if (!scenarios || !scenarios.length) return '';

  const cards = scenarios.map(sr => {
    const label = scenarioLabel(sr.scenario);
    const reqs = sr.requests || [];
    if (!reqs.length) {
      return `<div class="screenshot-card"><div class="sc-label">${esc(label)}</div><p style="color:var(--muted);font-size:0.85rem">No request evidence recorded.</p></div>`;
    }

    const rows = reqs.slice(0, 200).map(r => {
      const statusCls = r.response && r.response.status < 400 ? 'request-status-ok' : 'request-status-err';
      const initiator = r.initiator || '—';
      const ts = r.timestamp ? `<span class="request-meta">${new Date(r.timestamp).toLocaleTimeString('en-GB', { hour12: false })}</span>` : '';
      const resp = r.response ? `<span class="${statusCls}">${r.response.status}</span>` : '—';
      const ctype = r.response && r.response.contentType ? `<span class="request-meta">${esc(r.response.contentType)}</span>` : '';
      return `<tr>
        <td class="request-url">${esc(r.url)}</td>
        <td><span class="request-method">${esc(r.method)}</span></td>
        <td>${esc(r.resourceType)}</td>
        <td>${ts}</td>
        <td class="request-init">${esc(initiator)}</td>
        <td>${resp}</td>
        <td>${ctype}</td>
      </tr>`;
    }).join('');

    return `
<div class="screenshot-card">
  <div class="sc-label">${esc(label)} — ${reqs.length} request${reqs.length !== 1 ? 's' : ''}${reqs.length > 200 ? ' (showing first 200)' : ''}</div>
  <div style="overflow-x:auto">
    <table class="request-table">
      <thead><tr><th>URL</th><th>Method</th><th>Type</th><th>Time</th><th>Initiator</th><th>Status</th><th>Content-Type</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
</div>`;
  }).join('');

  return `
<details class="report-section">
  <summary class="section-summary"><span class="section-toggle">&#9658;</span><h2>Evidence — Network Requests</h2></summary>
  <p style="color:var(--muted);font-size:0.85rem;margin:0.75rem 0 0">Requests captured during each scenario, with timestamps, initiators, and response status.</p>
  <div class="screenshots">${cards}</div>
</details>`;
}

function renderCategoryMap(categoryResults) {
  if (!categoryResults || !categoryResults.length) return '';

  const items = categoryResults.map(cat => {
    if (cat.status !== 'ok') {
      return `
<details>
  <summary>${esc(cat.label)} <span style="font-weight:400;color:var(--muted);font-size:0.85rem">— could not isolate (${esc(cat.status)})</span></summary>
  <p style="padding:0.75rem 1rem;font-size:0.86rem;color:var(--muted);font-style:italic">
    This category could not be tested in isolation. Try a manual test.
  </p>
</details>`;
    }

    if (!cat.cookiesDropped.length) {
      return `
<details>
  <summary>${esc(cat.label)} <span style="font-weight:400;color:var(--muted);font-size:0.85rem">— 0 cookies</span></summary>
  <p style="padding:0.75rem 1rem;font-size:0.86rem;color:var(--muted)">
    No additional cookies were observed when only this category was accepted.
  </p>
</details>`;
    }

    const rows = cat.cookiesDropped.map(c => {
      const catSlug = (c.classification?.category || 'unknown').replace(/[^a-z-]/g, '');
      const catLabel = c.classification?.category || 'unknown';
      const expires = typeof c.expiresDays === 'number' ? `${c.expiresDays} days` : (c.expiresDays || '—');
      return `
<tr>
  <td><span class="cookie-name">${esc(c.name)}</span></td>
  <td>${esc(c.domain)}</td>
  <td><span class="cat-pill cat-${esc(catSlug)}">${esc(catLabel)}</span></td>
  <td>${esc(c.classification?.provider || '—')}</td>
  <td>${esc(String(expires))}</td>
  <td>${c.thirdParty ? 'Third-party' : 'First-party'}</td>
</tr>`;
    }).join('');

    return `
<details>
  <summary>${esc(cat.label)} <span style="font-weight:400;color:var(--muted);font-size:0.85rem">— ${cat.cookiesDropped.length} cookie${cat.cookiesDropped.length !== 1 ? 's' : ''}</span></summary>
  <div style="overflow-x:auto">
    <table class="cookie-table">
      <thead>
        <tr>
          <th>Cookie name</th><th>Domain</th><th>Category</th>
          <th>Provider</th><th>Lifespan</th><th>Party</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
</details>`;
  }).join('');

  return `
<details class="report-section">
  <summary class="section-summary"><span class="section-toggle">&#9658;</span><h2>Per-Category Cookie Analysis</h2></summary>
  <p style="font-size:0.88rem;color:var(--muted);margin-bottom:1rem">
    Each optional consent category was accepted in isolation — one at a time — to map
    which cookies each category actually controls. Cookies already present in the
    no-interaction baseline are excluded.
  </p>
  ${items}
</details>`;
}

function renderPolicyLinks(policyLinks) {
  if (!policyLinks) return '';
  const { bannerLinks = [], pageLinks = [] } = policyLinks;
  if (!bannerLinks.length && !pageLinks.length) return '';

  const LOC_LABEL = {
    footer: 'Footer',
    header: 'Header',
    nav: 'Nav',
    page: 'Page',
  };

  function linkRows(links) {
    if (!links.length) return `<p class="policy-none">None detected</p>`;
    return links.map(l => `
<div class="policy-link-row">
  <span class="policy-link-label">${esc(LOC_LABEL[l.location] || l.location)}</span>
  <span class="policy-link-text">
    <a href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.text)}</a>
    <span class="policy-link-href">${esc(l.href)}</span>
  </span>
</div>`).join('');
  }

  return `
<details class="report-section">
  <summary class="section-summary"><span class="section-toggle">&#9658;</span><h2>Policy Links Detected</h2></summary>
  <div class="policy-links-grid">
    <div class="policy-links-col">
      <h3>In the cookie banner</h3>
      ${bannerLinks.length
      ? linkRows(bannerLinks)
      : `<p class="policy-none">No policy links found inside the cookie banner.</p>`}
    </div>
    <div class="policy-links-col">
      <h3>On the page (footer / nav / header)</h3>
      ${pageLinks.length
      ? linkRows(pageLinks)
      : `<p class="policy-none">No policy links found on the page.</p>`}
    </div>
  </div>
</details>`;
}

function renderPageBreakdown(pageResults, cookieMapArr) {
  if (!pageResults || pageResults.length <= 1) return '';

  // Build classification lookup
  const classLookup = {};
  for (const entry of (cookieMapArr || [])) {
    classLookup[`${entry.name}||${entry.domain}`] = entry.classification;
  }

  // Summarise each page
  const rows = pageResults.map((pr, i) => {
    const noInt = pr.scenarios.find(s => s.scenario === 'no-interaction');
    const accept = pr.scenarios.find(s => s.scenario === 'accept-all');
    const reject = pr.scenarios.find(s => s.scenario === 'reject-all');

    const noIntCount = (noInt?.cookies || []).length;
    const acceptCount = (accept?.cookies || []).length;
    const rejectCount = (reject?.cookies || []).length;

    // Count critical cookies (non-essential pre-consent or post-reject)
    const criticalPreConsent = (noInt?.cookies || []).filter(c => {
      const cl = classLookup[`${c.name}||${c.domain}`] || c.classification;
      const cat = cl?.category;
      return cat === 'analytics' || cat === 'advertising' || cat === 'functional';
    }).length;
    const criticalPostReject = (reject?.cookies || []).filter(c => {
      const cl = classLookup[`${c.name}||${c.domain}`] || c.classification;
      const cat = cl?.category;
      return cat === 'analytics' || cat === 'advertising' || cat === 'functional';
    }).length;

    const riskClass = (criticalPreConsent + criticalPostReject) > 0
      ? 'page-risk-high' : noIntCount > 0 ? 'page-risk-medium' : 'page-risk-low';

    const shortUrl = pr.url.replace(/^https?:\/\/[^/]+/, '') || '/';

    return `<tr class="${riskClass}">
  <td><a href="${esc(pr.url)}" target="_blank" rel="noopener" class="page-link">${esc(shortUrl)}</a>${pr.isHomepage ? ' <span class="badge-homepage">home</span>' : ''}</td>
  <td class="num-cell">${noIntCount}</td>
  <td class="num-cell">${acceptCount}</td>
  <td class="num-cell">${rejectCount}</td>
  <td class="num-cell ${criticalPreConsent > 0 ? 'cell-critical' : ''}">${criticalPreConsent > 0 ? `⚠ ${criticalPreConsent}` : '—'}</td>
  <td class="num-cell ${criticalPostReject > 0 ? 'cell-critical' : ''}">${criticalPostReject > 0 ? `⚠ ${criticalPostReject}` : '—'}</td>
</tr>`;
  }).join('');

  // Site-wide cookies: appear in accept-all on every page
  const pageCookieSets = pageResults.map(pr => {
    const accept = pr.scenarios.find(s => s.scenario === 'accept-all');
    return new Set((accept?.cookies || []).map(c => `${c.name}||${c.domain}`));
  });
  const siteWideCookieKeys = pageCookieSets.length > 1
    ? [...pageCookieSets[0]].filter(k => pageCookieSets.every(s => s.has(k)))
    : [];

  const siteWideHtml = siteWideCookieKeys.length > 0 ? `
  <div class="site-wide-block">
    <h3 class="site-wide-title">Site-wide cookies <span class="badge-total">${siteWideCookieKeys.length}</span></h3>
    <p style="font-size:0.84rem;color:var(--muted);margin:0 0 0.75rem">These cookies appeared in the accept-all scenario on every page scanned.</p>
    <div class="site-wide-pills">
      ${siteWideCookieKeys.slice(0, 20).map(k => {
    const [name] = k.split('||');
    const cl = classLookup[k];
    const cat = cl?.category || 'unknown';
    const slug = cat.replace(/[^a-z-]/g, '');
    return `<span class="cat-pill cat-${slug}">${esc(name)}</span>`;
  }).join('')}${siteWideCookieKeys.length > 20 ? `<span style="font-size:0.8rem;color:var(--muted)">+${siteWideCookieKeys.length - 20} more</span>` : ''}
    </div>
  </div>` : '';

  return `<details class="report-section" open>
  <summary class="section-summary"><span class="section-toggle">&#9658;</span><h2>Multi-page Analysis <span class="badge-total">${pageResults.length} pages</span></h2></summary>
  <div style="overflow-x:auto">
    <table class="cookie-table page-table">
      <thead><tr>
        <th>Page</th>
        <th class="num-cell">No consent</th>
        <th class="num-cell">Accept-all</th>
        <th class="num-cell">Reject-all</th>
        <th class="num-cell">Critical pre-consent</th>
        <th class="num-cell">Critical post-reject</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  ${siteWideHtml}
</details>`;
}

function renderFooter(data = {}) {
  const framework = frameworkLabel(data.scanConfig?.framework);
  const legalText = data.scanConfig?.framework === 'ccpa-cpra'
    ? 'CCPA and CPRA'
    : data.scanConfig?.framework === 'both'
      ? 'PECR, UK GDPR, CCPA and CPRA'
      : 'PECR and UK GDPR';
  return `
<footer class="report-footer">
  <p><strong>Disclaimer.</strong> This report presents the results of automated technical testing for ${esc(framework)} and constitutes neither legal advice nor a certification of compliance. Findings are indicators of potential non-compliance with ${esc(legalText)}; they do not represent the opinion of a regulator or a court. "No issues detected in the tests performed" does not mean the site is compliant — it means the automated tests did not detect issues within the scope and scenarios tested. Manual verification is recommended in all cases. This report should be reviewed by a qualified legal or privacy professional before being used in any formal compliance programme or disclosed to any regulator.</p>
</footer>`;
}

// ── Main builder ──────────────────────────────────────────────────────────────

/**
 * Build a standalone HTML report from a scan data object.
 *
 * @param {object} data         - scan-result.json contents
 * @param {string} [scanDir]    - directory containing screenshots (defaults to cwd)
 * @returns {string}            - full HTML string
 */
function renderNav(data) {
  const rescanParams = new URLSearchParams();
  rescanParams.set('url', data.url || '');
  if (data.name) rescanParams.set('name', data.name);
  const csvBase = data._resultDir ? `/report/${encodeURIComponent(data._resultDir)}/export` : null;
  const exportMenu = csvBase ? `
    <details class="nav-export-menu" style="position:relative">
      <summary class="nav-btn" style="cursor:pointer;list-style:none">Export ▾</summary>
      <div style="position:absolute;right:0;top:calc(100% + 6px);background:#1e293b;border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:6px;min-width:180px;z-index:100;box-shadow:0 8px 24px rgba(0,0,0,0.4)">
        <a href="?download" class="nav-export-item">HTML report ↓</a>
        <a href="${csvBase}/findings.csv" class="nav-export-item">Findings CSV ↓</a>
        <a href="${csvBase}/cookies.csv" class="nav-export-item">Cookie inventory CSV ↓</a>
        ${data._scanId ? `<a href="/api/scans/${data._scanId}/export" class="nav-export-item">Evidence bundle JSON ↓</a>` : ''}
        <button onclick="window.print()" class="nav-export-item" style="width:100%;text-align:left;background:none;border:none;cursor:pointer;font:inherit">Print / PDF ⎙</button>
      </div>
    </details>` : `
    <a href="?download" class="nav-btn">Download ↓</a>
    <button onclick="window.print()" class="nav-btn">Export PDF ⎙</button>`;
  return `
<nav>
  <a href="/app" style="display:flex;align-items:center;gap:9px;color:#fff;font-weight:700;font-size:15px;text-decoration:none;letter-spacing:-0.02em;flex-shrink:0">
    <span style="width:32px;height:32px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:9px;display:grid;place-items:center;font-size:15px;flex-shrink:0;box-shadow:0 2px 12px rgba(99,102,241,0.4)">🛡</span>
     ConsentLens
  </a>
  <span class="nav-title">Compliance report</span>
  <div class="nav-actions">
    ${exportMenu}
    ${data._scanId && !data._shared ? `<button class="nav-btn" id="share-btn" onclick="shareReport()">Share ⬡</button>` : ''}
    ${!data._shared ? `<a href="/app/new-scan?${rescanParams.toString()}" class="nav-btn">Rescan ↻</a>` : ''}
  </div>
</nav>
<div id="share-toast" style="display:none;position:fixed;bottom:24px;right:24px;background:#1e293b;color:#fff;padding:12px 18px;border-radius:10px;font-size:13px;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,0.4);max-width:340px"></div>
<script>
var _SCAN_ID_FOR_SHARE = ${data._scanId ? JSON.stringify(data._scanId) : 'null'};
function shareReport() {
  if (!_SCAN_ID_FOR_SHARE) return;
  fetch('/api/scans/' + _SCAN_ID_FOR_SHARE + '/share', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresInDays: 30 }) })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.url) {
        navigator.clipboard.writeText(d.url).catch(function(){});
        showToast('Share link copied! Expires in ' + d.expiresInDays + ' days.\\n' + d.url);
      } else { showToast('Failed to create share link.'); }
    }).catch(function() { showToast('Failed to create share link.'); });
}
function showToast(msg) {
  var t = document.getElementById('share-toast');
  t.textContent = msg; t.style.display = 'block';
  setTimeout(function() { t.style.display = 'none'; }, 5000);
}
</script>
<style>
.nav-export-item { display:block; padding:7px 12px; color:rgba(255,255,255,0.85); text-decoration:none; font-size:13px; border-radius:5px; white-space:nowrap; }
.nav-export-item:hover { background:rgba(255,255,255,0.08); color:#fff; }
.nav-export-menu summary::-webkit-details-marker { display:none; }
</style>`;
}

function buildReport(data, scanDir) {
  const { findings = [], scenarios = [] } = data;
  const dir = scanDir || process.cwd();

  // Enrich findings with per-finding request evidence for inline timelines
  const scenarioMap = Object.fromEntries(scenarios.map(s => [s.scenario, s]));
  for (const f of findings) {
    const sr = scenarioMap[f.scenario];
    if (!sr || !Array.isArray(sr.requests) || !sr.requests.length) continue;
    const domain = f.domain ? f.domain.replace(/^\./, '') : null;
    if (!domain) continue;
    const relevant = sr.requests.filter(r => {
      try { return new URL(r.url).hostname.endsWith(domain) || new URL(r.url).hostname === domain; } catch { return false; }
    });
    if (!relevant.length) continue;
    const t0 = sr.requests[0].timestamp;
    f._requestEvidence = relevant.slice(0, 8).map(r => ({
      relativeMs: r.timestamp - t0,
      url: r.url,
      method: r.method,
      resourceType: r.resourceType,
      initiator: r.initiator,
    }));
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cookie Compliance Report — ${esc(data.url)}</title>
<style>${CSS}</style>
</head>
<body>
${renderNav(data)}
<div class="container">
${renderHeader(data)}
${renderSummary(data)}
 ${renderScanIntegrity(data)}
 ${renderAssuranceOverview(data)}
 ${renderJourneyMatrix(data)}
 ${renderEvidenceTimeline(data)}
 ${renderJourneyDelta(scenarios)}
  ${renderGpcComparison(data)}
  ${renderPrivacySignals(data)}
  ${renderAdvancedEvidence(scenarios)}
  ${renderFindings(findings)}
  ${renderPageBreakdown(data.pageResults, data.cookieMap)}
  ${renderPolicyLinks(data.policyLinks)}
  ${renderCategoryMap(data.categoryResults)}
  ${renderInventory(scenarios, data.cookieMap, data.pageResults)}
  ${renderEvidence(scenarios, dir)}
  ${renderRequestEvidence(scenarios)}
  ${renderPlaybook(data)}
  ${renderFooter(data)}
</div>
<footer class="global-footer">
  ConsentLens &mdash; Local compliance testing tool &mdash; <em>Not legal advice.</em>
</footer>
<script>
function getFindingFilters() {
  return {
    search: (document.getElementById('finding-search')?.value || '').trim().toLowerCase(),
    severity: document.getElementById('finding-severity')?.value || '',
    evidence: document.getElementById('finding-evidence')?.value || '',
    category: document.getElementById('finding-category')?.value || '',
  };
}

function filterFindings() {
  var filters = getFindingFilters();
  var cards = Array.from(document.querySelectorAll('details.finding'));
  var visible = 0;

  cards.forEach(function(card) {
    var matches = (!filters.search || (card.dataset.search || '').includes(filters.search))
      && (!filters.severity || card.dataset.severity === filters.severity)
      && (!filters.evidence || card.dataset.evidence === filters.evidence)
      && (!filters.category || (card.dataset.category || '').split('|').includes(filters.category));
    card.classList.toggle('is-hidden', !matches);
    if (matches) visible++;
  });

  document.querySelectorAll('.findings-group').forEach(function(group) {
    var hasVisible = group.querySelector('details.finding:not(.is-hidden)');
    group.classList.toggle('is-hidden', !hasVisible);
  });

  var empty = document.getElementById('findings-empty');
  if (empty) empty.classList.toggle('is-visible', visible === 0);
  var count = document.getElementById('findings-result-count');
  if (count) count.textContent = visible + ' finding' + (visible === 1 ? '' : 's') + ' shown';
}

function expandVisibleFindings() {
  document.querySelectorAll('details.finding:not(.is-hidden)').forEach(function(card) { card.open = true; });
}

function collapseVisibleFindings() {
  document.querySelectorAll('details.finding:not(.is-hidden)').forEach(function(card) { card.open = false; });
}

function clearFindingFilters() {
  ['finding-search', 'finding-severity', 'finding-evidence', 'finding-category'].forEach(function(id) {
    var field = document.getElementById(id);
    if (field) field.value = '';
  });
  filterFindings();
}

function jumpToSeverity(sev) {
  var section = document.getElementById('section-findings');
  if (section) section.open = true;
  var group = document.getElementById('findings-group-' + sev);
  if (!group) return;
  group.querySelectorAll('details.finding').forEach(function(d){ d.open = true; });
  setTimeout(function(){ group.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50);
}
filterFindings();

// ── Remediation widget ──────────────────────────────────────────────────────
var SCAN_ID = ${data._scanId ? JSON.stringify(data._scanId) : 'null'};

function toggleRemediation(findingId) {
  var form = document.getElementById('rem-form-' + findingId);
  var btn  = document.getElementById('rem-toggle-' + findingId);
  if (!form) return;
  var open = form.style.display === 'none';
  form.style.display = open ? 'block' : 'none';
  if (btn) btn.textContent = open ? 'Close ▴' : (form.querySelector('select') ? 'Edit ▾' : '+ Set ▾');
}

async function saveRemediation(findingId) {
  if (!SCAN_ID) { alert('Cannot save — this report was not loaded from the server.'); return; }
  var status     = document.getElementById('rem-status-'   + findingId)?.value || 'open';
  var priority   = document.getElementById('rem-priority-' + findingId)?.value || 'medium';
  var dueDate    = document.getElementById('rem-due-'      + findingId)?.value || null;
  var ownerEmail = document.getElementById('rem-owner-'    + findingId)?.value.trim() || null;
  var notes      = document.getElementById('rem-notes-'    + findingId)?.value || '';
  var feedback = document.getElementById('rem-feedback-' + findingId);
  var saveBtn  = document.querySelector('.remediation-widget[data-finding-id="' + findingId + '"] .rem-save-btn');

  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }
  if (feedback) { feedback.style.display = 'none'; feedback.className = 'rem-feedback'; }

  try {
    var r = await fetch('/api/scans/' + SCAN_ID + '/remediations', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ findingId: findingId, status: status, priority: priority, dueDate: dueDate || null, ownerEmail: ownerEmail, notes: notes }),
    });
    var d = await r.json();
    if (d.error) throw new Error(d.error);
    if (feedback) { feedback.textContent = '✓ Saved'; feedback.style.display = 'inline'; feedback.className = 'rem-feedback ok'; }
    // Update the badge
    var widget = document.querySelector('.remediation-widget[data-finding-id="' + findingId + '"]');
    var badge = widget && widget.querySelector('.remediation-saved-badge');
    var cls = 'remediation-saved-badge rem-status-' + status.replace(/\s+/g, '-');
    var badgeText = status + ' · ' + priority + (ownerEmail ? ' · ' + ownerEmail : '');
    if (!badge) {
      badge = document.createElement('span');
      var label = widget && widget.querySelector('.finding-section-label');
      if (label) label.insertBefore(badge, label.querySelector('.rem-toggle-btn'));
    }
    badge.className = cls;
    badge.textContent = badgeText;
    setTimeout(function() { if (feedback) feedback.style.display = 'none'; }, 3000);
  } catch(err) {
    if (feedback) { feedback.textContent = '✗ ' + (err.message || 'Save failed'); feedback.style.display = 'inline'; feedback.className = 'rem-feedback err'; }
  }
  if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save'; }
}
</script>
</body>
</html>`;
}

module.exports = { buildReport, CSS };

// ── CLI (only when run directly) ──────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);
  if (!args.length || args[0] === '--help') {
    console.log('Usage: node report.js <scan-result.json> [--output <file.html>]');
    process.exit(args[0] === '--help' ? 0 : 1);
  }

  const inputPath = path.resolve(args[0]);
  const outIdx = args.indexOf('--output');
  const outputPath = outIdx !== -1 && args[outIdx + 1]
    ? path.resolve(args[outIdx + 1])
    : inputPath.replace(/\.json$/, '.html');

  if (!fs.existsSync(inputPath)) {
    console.error(`File not found: ${inputPath}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const html = buildReport(data, path.dirname(inputPath));
  fs.writeFileSync(outputPath, html, 'utf8');
  console.log(`Report written to: ${outputPath}`);
}
