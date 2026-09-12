'use strict';

/**
 * server/views.js
 * Full-bleed layout. Each section owns its own full-width background.
 * Content uses an inner .inner wrapper for centering.
 */

const SEVERITY_ORDER = ['CRITICAL', 'HIGH', 'REVIEW', 'ADVISORY'];

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function scenarioLabel(s) {
  return { 'no-interaction': 'No interaction', 'accept-all': 'Accept all', 'reject-all': 'Reject all', 'open-preferences': 'Open preferences', 'accept-analytics': 'Analytics only', 'accept-advertising': 'Advertising only', 'withdraw-consent': 'Withdraw consent', 'revisit-after-consent': 'Revisit after consent', 'gpc-comparison': 'GPC comparison' }[s] || s;
}

function fmtDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch (_) { return iso; }
}

// ── CSS ───────────────────────────────────────────────────────────────────────

const SHARED_CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --ink:          #0f172a;
  --ink-2:        #1e293b;
  --ink-3:        #475569;
  --muted:        #64748b;
  --border:       #e2e8f0;
  --border-2:     #cbd5e1;
  --surface:      #ffffff;
  --surface-2:    #f8fafc;
  --bg:           #f1f5f9;
  --nav-bg:       rgba(15, 23, 42, 0.92);
  --accent:       #6366f1;
  --accent-2:     #8b5cf6;
  --accent-hover: #4f46e5;
  --blue:         #3b82f6;
  --blue-light:   #eff6ff;
  --emerald:      #10b981;
  --emerald-light:#ecfdf5;
  --amber:        #f59e0b;
  --amber-light:  #fffbeb;
  --rose:         #f43f5e;
  --rose-light:   #fff1f2;
  --radius:       12px;
  --radius-sm:    8px;
  --radius-xs:    6px;
  --inner:        1200px;
  --gutter:       clamp(20px, 4vw, 48px);
  --shadow-sm:    0 1px 2px rgba(0,0,0,0.04);
  --shadow:       0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02);
  --shadow-md:    0 4px 6px -1px rgba(0,0,0,0.04), 0 2px 4px -1px rgba(0,0,0,0.02);
  --shadow-lg:    0 10px 15px -3px rgba(0,0,0,0.04), 0 4px 6px -2px rgba(0,0,0,0.02);
  --shadow-xl:    0 20px 25px -5px rgba(0,0,0,0.04), 0 10px 10px -5px rgba(0,0,0,0.02);
  --ease-out:     cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out:  cubic-bezier(0.4, 0, 0.2, 1);
}

html { scroll-behavior: smooth; }

.skip-link {
  position: fixed;
  top: 10px;
  left: 10px;
  z-index: 1000;
  padding: 9px 14px;
  border-radius: var(--radius-xs);
  background: var(--ink);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  transform: translateY(-160%);
  transition: transform 0.15s var(--ease-out);
}
.skip-link:focus { transform: translateY(0); color: #fff; }

:where(a, button, input, select, summary):focus-visible {
  outline: 3px solid #60a5fa;
  outline-offset: 3px;
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  color: var(--ink);
  background: var(--bg);
  line-height: 1.6;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  font-size: 15px;
  font-feature-settings: 'cv11', 'ss01';
}

a { color: var(--accent); text-decoration: none; transition: color 0.15s var(--ease-in-out); }
a:hover { color: var(--accent-hover); text-decoration: none; }

.inner {
  max-width: var(--inner);
  width: 100%;
  margin-left: auto;
  margin-right: auto;
  padding-left: var(--gutter);
  padding-right: var(--gutter);
}

/* ── Nav ── */
.site-nav {
  background: var(--nav-bg);
  width: 100%;
  height: 64px;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 100;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  backdrop-filter: blur(12px) saturate(140%);
  -webkit-backdrop-filter: blur(12px) saturate(140%);
}
.site-nav .inner {
  display: flex;
  align-items: center;
  gap: 0;
}
.nav-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.02em;
  text-decoration: none;
  flex-shrink: 0;
}
.nav-brand:hover { opacity: 0.9; text-decoration: none; }
.nav-brand-mark {
  width: 34px; height: 34px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  border-radius: 10px;
  display: grid;
  place-items: center;
  font-size: 16px;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(99,102,241,0.35);
}
.nav-pipe {
  width: 1px; height: 20px;
  background: rgba(255,255,255,0.1);
  margin: 0 18px;
  flex-shrink: 0;
}
.nav-sub {
  font-size: 13px;
  color: rgba(255,255,255,0.4);
  font-weight: 400;
  letter-spacing: 0;
}
.nav-auth {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 12px;
}
.nav-email {
  font-size: 13px;
  color: rgba(255,255,255,0.5);
  font-weight: 500;
}
.nav-link {
  color: rgba(255,255,255,0.7);
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
  padding: 6px 14px;
  border-radius: var(--radius-xs);
  transition: all 0.15s var(--ease-in-out);
}
.nav-link:hover {
  background: rgba(255,255,255,0.08);
  color: #fff;
  text-decoration: none;
}
.nav-btn {
  background: var(--accent);
  color: #fff;
  border: none;
  padding: 7px 16px;
  border-radius: var(--radius-xs);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s var(--ease-in-out);
}
.nav-btn:hover { background: var(--accent-hover); transform: translateY(-1px); }
.nav-logout {
  background: transparent;
  color: rgba(255,255,255,0.7);
  border: 1px solid rgba(255,255,255,0.15);
  padding: 6px 14px;
  border-radius: var(--radius-xs);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s var(--ease-in-out);
}
.nav-logout:hover {
  background: rgba(255,255,255,0.06);
  color: #fff;
  border-color: rgba(255,255,255,0.25);
  transform: translateY(-1px);
}

/* ── Hero / scan section ── */
.hero-section {
  background: linear-gradient(180deg, #0f172a 0%, #1e1b4b 100%);
  width: 100%;
  padding: 80px 0 88px;
  position: relative;
  overflow: hidden;
}
.hero-section::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: 
    radial-gradient(circle at 20% 30%, rgba(99,102,241,0.12) 0%, transparent 50%),
    radial-gradient(circle at 80% 70%, rgba(139,92,246,0.08) 0%, transparent 50%);
  pointer-events: none;
}
.hero-inner {
  max-width: 780px;
  margin: 0 auto;
  padding: 0 var(--gutter);
  text-align: center;
  position: relative;
  z-index: 1;
}
.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 14px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  color: rgba(255,255,255,0.7);
  letter-spacing: 0.02em;
  margin-bottom: 24px;
  backdrop-filter: blur(4px);
}
.hero-badge-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--accent);
  animation: pulse 2s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.9); }
}
.hero-h1 {
  font-size: clamp(36px, 5.5vw, 56px);
  font-weight: 800;
  color: #ffffff;
  letter-spacing: -0.04em;
  line-height: 1.1;
  margin-bottom: 18px;
  background: linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.85) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.hero-sub {
  font-size: 17px;
  color: rgba(255,255,255,0.55);
  line-height: 1.7;
  max-width: 560px;
  margin: 0 auto 36px;
  font-weight: 400;
}

/* Scan form inside hero */
.scan-form-wrap {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 14px;
  padding: 28px 28px 24px;
  text-align: left;
}
.form-row { margin-bottom: 14px; }
.form-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: rgba(255,255,255,0.45);
  margin-bottom: 7px;
  letter-spacing: 0.01em;
  text-transform: uppercase;
}
.form-label .opt {
  font-weight: 400;
  color: rgba(255,255,255,0.25);
  text-transform: none;
  font-size: 11px;
  margin-left: 4px;
}
.url-row {
  display: flex;
  gap: 0;
  border-radius: var(--radius);
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.12);
  transition: border-color 0.15s, box-shadow 0.15s;
}
.url-row:focus-within {
  border-color: var(--blue);
  box-shadow: 0 0 0 3px rgba(37,99,235,0.25);
}
.url-input {
  flex: 1;
  border: none;
  outline: none;
  padding: 12px 16px;
  font-size: 14px;
  font-family: inherit;
  color: var(--ink);
  background: #fff;
  min-width: 0;
}
.url-input::placeholder { color: #a3a3a3; }
.scan-btn {
  background: var(--accent);
  color: #fff;
  border: none;
  padding: 14px 32px;
  font-size: 15px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
  letter-spacing: -0.01em;
  transition: all 0.2s var(--ease-out);
  border-radius: var(--radius);
  box-shadow: 0 4px 14px rgba(99,102,241,0.35);
  position: relative;
  overflow: hidden;
}
.scan-btn:hover {
  background: var(--accent-hover);
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(99,102,241,0.45);
}
.scan-btn:active {
  transform: translateY(0);
}
.scan-btn:disabled {
  background: #94a3b8;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
  opacity: 0.6;
}
.scan-btn-secondary {
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.9);
  border: 1px solid rgba(255,255,255,0.12);
  box-shadow: none;
  backdrop-filter: blur(4px);
}
.scan-btn-secondary:hover {
  background: rgba(255,255,255,0.1);
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0,0,0,0.15);
  border-color: rgba(255,255,255,0.2);
}
.scan-btn-secondary:disabled {
  background: rgba(255,255,255,0.04);
  color: rgba(255,255,255,0.4);
  border-color: rgba(255,255,255,0.08);
  box-shadow: none;
  opacity: 0.5;
}
.name-input {
  width: 100%;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: var(--radius);
  padding: 10px 14px;
  font-size: 13.5px;
  font-family: inherit;
  color: rgba(255,255,255,0.85);
  outline: none;
  transition: border-color 0.15s, background 0.15s;
}
.name-input::placeholder { color: rgba(255,255,255,0.2); }
.check-row { display:flex; align-items:center; gap:8px; margin:7px 0; color:rgba(255,255,255,0.72); font-size:13px; text-transform:none; letter-spacing:0; }
.check-row input { accent-color:var(--accent); }
textarea.name-input { resize:vertical; line-height:1.45; }
.name-input:focus {
  border-color: rgba(255,255,255,0.25);
  background: rgba(255,255,255,0.09);
}
select.name-input { cursor: pointer; -webkit-appearance: none; appearance: none; padding-right: 28px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='rgba(255,255,255,0.35)' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 10px center; }
select.name-input option { background: #0b1629; color: rgba(255,255,255,0.85); }
.form-hint { font-size: 11.5px; color: rgba(255,255,255,0.22); margin-top: 6px; line-height: 1.45; }
.hero-features {
  display: flex;
  justify-content: center;
  gap: clamp(12px, 3vw, 32px);
  margin-top: 32px;
  flex-wrap: wrap;
}
.hf {
  font-size: 12.5px;
  color: rgba(255,255,255,0.45);
  display: flex;
  align-items: center;
  gap: 6px;
}
.hf-check { color: #34d399; font-size: 13px; flex-shrink: 0; }

/* ── Advanced options toggle ── */
.adv-details { margin-top: 14px; }
.adv-summary {
  list-style: none; cursor: pointer;
  font-size: 12px; font-weight: 600;
  color: rgba(255,255,255,0.38);
  display: inline-flex; align-items: center; gap: 4px;
  user-select: none;
  transition: color 0.12s;
}
.adv-summary::-webkit-details-marker { display: none; }
.adv-summary::after { content: ' ▾'; }
.adv-details[open] .adv-summary::after { content: ' ▴'; }
.adv-summary:hover { color: rgba(255,255,255,0.65); }
.adv-body { padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.07); margin-top: 14px; }
.adv-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 0;
}
@media (max-width: 500px) { .adv-row { grid-template-columns: 1fr; } }
.form-col { display: flex; flex-direction: column; }

/* ── In-progress section ── */
.inprogress-section { margin-bottom: 28px; }
.inprogress-hdr {
  display: flex; align-items: center; gap: 8px; margin-bottom: 10px;
}
.inprogress-title { font-size: 13.5px; font-weight: 700; color: #1d4ed8; letter-spacing: -0.01em; }
.inprogress-dot {
  width: 8px; height: 8px; border-radius: 50%; background: #2563eb;
  animation: blink 1.5s ease-in-out infinite;
  flex-shrink: 0;
}
@keyframes blink {
  0%, 100% { opacity: 1; } 50% { opacity: 0.35; }
}
.sc-active {
  background: #f0f6ff;
  border-color: #bfdbfe;
  border-left-color: #2563eb;
}
.active-progress-label {
  display: flex; align-items: center; gap: 7px;
  font-size: 13px; color: #1d4ed8; font-weight: 500;
}

/* ── Content section (white) ── */
.content-section {
  width: 100%;
  background: var(--surface);
  flex: 1;
  padding: 40px 0 64px;
}

/* ── Progress panel ── */
#progress-panel {
  display: none;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  margin-bottom: 32px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
#progress-panel.visible { display: block; }
.pp-head {
  background: var(--accent);
  padding: 16px 20px;
}
.pp-title { color: #fff; font-weight: 700; font-size: 14px; letter-spacing: -0.01em; }
.pp-url   { color: rgba(255,255,255,0.45); font-size: 12px; font-family: monospace; word-break: break-all; margin-top: 3px; line-height: 1.4; }
.pp-body  { padding: 16px 20px 20px; background: #fff; }
.step-list { list-style: none; display: flex; flex-direction: column; gap: 2px; }
.step-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px; border-radius: 6px;
  font-size: 13.5px; color: var(--muted);
  transition: background 0.12s, color 0.12s;
}
.step-item.active { background: #eff6ff; color: var(--blue); font-weight: 600; }
.step-item.done   { color: #15803d; }
.step-icon-cell { width: 20px; text-align: center; flex-shrink: 0; font-size: 13px; }
.spinner {
  width: 13px; height: 13px;
  border: 2px solid rgba(37,99,235,0.15);
  border-top-color: var(--blue);
  border-radius: 50%;
  display: inline-block;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.pp-message { font-size: 12px; color: var(--muted); margin-top: 8px; }
.queue-note {
  background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px;
  padding: 9px 13px; color: #1d4ed8; font-size: 13px; margin-bottom: 12px;
}
.error-box {
  background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px;
  padding: 10px 14px; color: #b91c1c; font-size: 13.5px; margin-top: 12px; line-height: 1.5;
}

/* ── History ── */
.history-hdr {
  display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;
}
.history-title { font-size: 16px; font-weight: 700; color: var(--ink); letter-spacing: -0.02em; }
.history-chips { display: flex; gap: 6px; flex-wrap: wrap; margin-left: auto; }
.history-tools {
  display: grid;
  grid-template-columns: minmax(220px, 1.5fr) repeat(3, minmax(130px, 0.7fr));
  gap: 8px;
  margin-bottom: 14px;
}
.history-filter {
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-xs);
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  font-size: 13px;
  padding: 9px 11px;
}
.history-filter::placeholder { color: var(--muted); }
.history-filter:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(99,102,241,.12); outline: none; }
.history-filter-status { color: var(--muted); font-size: 12px; margin: -4px 0 12px; }
.history-empty-filtered { display: none; background: var(--surface); border: 1px dashed var(--border-2); border-radius: var(--radius); color: var(--muted); padding: 28px 20px; text-align: center; }
.hchip {
  display: inline-flex; align-items: center;
  padding: 3px 11px; border-radius: 20px; border: 1px solid;
  font-size: 12px; font-weight: 600; white-space: nowrap;
}
.hchip-default  { color: var(--muted); background: var(--bg); border-color: var(--border-2); }
.hchip-critical { color: #b91c1c; background: #fef2f2; border-color: #fecaca; }
.hchip-clean    { color: #15803d; background: #f0fdf4; border-color: #86efac; }

/* ── Integrity / stats grid ── */
.integrity-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
@media (max-width: 640px) { .integrity-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.integrity-card { padding: 14px 16px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); }
.integrity-card strong { display: block; font-size: 1.45rem; line-height: 1.1; color: var(--ink); }
.integrity-card span { display: block; margin-top: 4px; color: var(--muted); font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }

/* ── Scan cards ── */
.scan-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.scan-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-left: 3px solid var(--border);
  border-radius: var(--radius);
  padding: 18px 22px 16px;
  display: grid;
  grid-template-rows: auto auto auto;
  gap: 12px;
  transition: all 0.2s var(--ease-out);
  box-shadow: var(--shadow-sm);
}
.scan-card:hover {
  box-shadow: var(--shadow-lg);
  border-color: var(--border-2);
  transform: translateY(-2px);
}
.sc-critical { border-left-color: #ef4444; }
.sc-high     { border-left-color: #f97316; }
.sc-review   { border-left-color: #eab308; }
.sc-advisory { border-left-color: var(--accent); }
.sc-clean    { border-left-color: var(--emerald); }
.sc-blocked  { border-left-color: #94a3b8; }
.sc-suspect  { border-left-color: #f97316; }

.sc-top {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}
.sc-url-block { flex: 1; min-width: 0; }
.sc-url {
  font-family: 'SFMono-Regular', 'Consolas', monospace;
  font-size: 14px;
  font-weight: 700;
  color: var(--ink);
  word-break: break-all;
  line-height: 1.35;
  display: block;
}
.sc-name {
  font-size: 12.5px;
  color: var(--muted);
  margin-top: 3px;
  font-style: italic;
}
.sc-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.cmp-pill {
  font-size: 11px;
  font-weight: 700;
  background: var(--blue-light);
  color: var(--accent);
  border: 1px solid #bfdbfe;
  border-radius: 20px;
  padding: 3px 10px;
  white-space: nowrap;
}
.region-pill {
  font-size: 11px;
  font-weight: 600;
  background: var(--bg);
  color: var(--ink-3);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 3px 10px;
  white-space: nowrap;
}
.sc-time {
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.sc-status-summary { display: inline-flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.sc-status-text { color: var(--ink-3); font-size: 12.5px; }
.sc-actions { display: inline-flex; align-items: center; gap: 12px; margin-left: auto; }
.sc-rescan {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid var(--border-2);
  border-radius: var(--radius-xs);
  background: var(--surface);
  color: var(--ink-3);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  padding: 5px 10px;
  text-decoration: none;
  white-space: nowrap;
  transition: all .15s var(--ease-in-out);
}
.sc-rescan:hover { border-color: var(--accent); color: var(--accent); background: #eef2ff; text-decoration: none; }
.sc-delete { color: var(--rose) !important; border-color: #fda4af !important; background: var(--rose-light) !important; }
.sc-delete:hover { background: #ffe4e6 !important; border-color: var(--rose) !important; }
.sc-compare-active { background: #eff6ff !important; border-color: var(--accent) !important; color: var(--accent) !important; }
.compare-banner { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: var(--radius); padding: 11px 16px; margin-bottom: 16px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; font-size: 0.88rem; color: #1e40af; }
.compare-banner strong { font-family: monospace; font-size: 0.85em; }
.compare-banner-cancel { margin-left: auto; background: none; border: 1px solid #93c5fd; border-radius: var(--radius-xs); padding: 4px 10px; font-size: 0.82rem; cursor: pointer; color: #1d4ed8; }
.compare-banner-cancel:hover { background: #dbeafe; }
@media (max-width: 760px) { .history-tools { grid-template-columns: 1fr 1fr; } .history-tools .history-filter:first-child { grid-column: 1 / -1; } }
@media (max-width: 480px) { .history-tools { grid-template-columns: 1fr; } .history-tools .history-filter:first-child { grid-column: auto; } }

.sc-mid {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
}
.sev-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: var(--radius-xs);
  border: 1px solid;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}
.sp-critical { color: var(--rose); background: var(--rose-light); border-color: #fda4af; }
.sp-high     { color: #c2410c; background: #fff7ed; border-color: #fed7aa; }
.sp-review   { color: #a16207; background: #fefce8; border-color: #fde68a; }
.sp-advisory { color: var(--accent); background: #eef2ff; border-color: #c7d2fe; }
.clean-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #059669;
  background: var(--emerald-light);
  border: 1px solid #6ee7b7;
  font-size: 12px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: var(--radius-xs);
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: var(--radius-xs);
  font-size: 12px;
  font-weight: 700;
  border: 1px solid currentColor;
  vertical-align: middle;
  transition: all 0.15s var(--ease-in-out);
}
.badge-ok       { color: #059669; background: var(--emerald-light); border-color: #6ee7b7; }
.badge-blocked  { color: var(--rose); background: var(--rose-light); border-color: #fda4af; }
.badge-suspect  { color: #d97706; background: var(--amber-light); border-color: #fcd34d; }
.badge-queued   { color: var(--ink-3); background: var(--bg); border-color: var(--border); }
.badge-running  { color: var(--accent); background: #eef2ff; border-color: #c7d2fe; }
.badge-failed   { color: var(--rose); background: var(--rose-light); border-color: #fda4af; }

.sc-bottom {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}
.cookie-flow {
  display: flex;
  align-items: center;
  gap: 10px;
}
.cf-seg {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.cf-num {
  font-size: 17px;
  font-weight: 800;
  color: var(--ink);
  line-height: 1;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}
.cf-lbl {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  line-height: 1;
  font-weight: 600;
}
.cf-arr {
  color: var(--border-2);
  font-size: 14px;
  padding-bottom: 10px;
}
.sc-warn-wrap {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
}
.sc-warn-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  font-weight: 600;
  color: #92400e;
  background: #fffbeb;
  border: 1px solid #fcd34d;
  border-radius: 20px;
  padding: 2px 8px;
  white-space: nowrap;
}
.sc-warn-chip::before {
  content: '!';
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: #f59e0b;
  color: #fff;
  font-size: 9px;
  font-weight: 800;
  flex-shrink: 0;
}
.sc-view {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--accent);
  padding: 7px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  text-decoration: none;
  transition: all 0.15s var(--ease-in-out);
  white-space: nowrap;
}
.sc-view:hover {
  background: var(--bg);
  border-color: var(--accent);
  transform: translateY(-1px);
  text-decoration: none;
  box-shadow: var(--shadow-md);
}
.sc-view {
  margin-left: auto;
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 13px; font-weight: 600; color: var(--accent);
  padding: 7px 16px;
  border: 1px solid var(--border-2); border-radius: var(--radius);
  background: var(--surface); text-decoration: none;
  transition: background 0.12s, border-color 0.12s;
  white-space: nowrap;
}
.sc-view:hover { background: var(--bg); border-color: var(--accent); text-decoration: none; }

/* ── Empty state ── */
.empty-state {
  border: 1px dashed var(--border-2);
  border-radius: 12px;
  padding: 72px 24px;
  text-align: center;
}
.empty-icon  { font-size: 36px; opacity: 0.15; margin-bottom: 16px; display: block; }
.empty-title { font-size: 17px; font-weight: 700; color: var(--ink); margin-bottom: 8px; letter-spacing: -0.02em; }
.empty-sub   { font-size: 14px; color: var(--muted); line-height: 1.6; max-width: 340px; margin: 0 auto; }

/* â”€â”€ First-scan guide â”€â”€ */
.workflow-guide {
  margin-top: 28px;
  padding: clamp(22px, 4vw, 34px);
  border: 1px solid var(--border);
  border-radius: 16px;
  background: linear-gradient(135deg, #fff 0%, #f8faff 100%);
  box-shadow: var(--shadow-sm);
}
.workflow-guide-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; margin-bottom: 22px; }
.workflow-guide-title { font-size: 18px; font-weight: 800; letter-spacing: -0.025em; color: var(--ink); }
.workflow-guide-sub { margin-top: 4px; font-size: 13.5px; color: var(--muted); }
.workflow-steps { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.workflow-step { position: relative; padding: 4px 4px 4px 44px; min-width: 0; }
.workflow-step-number {
  position: absolute; left: 0; top: 2px;
  width: 28px; height: 28px; display: grid; place-items: center;
  border-radius: 9px; background: #eef2ff; color: var(--accent);
  font-size: 12px; font-weight: 800;
}
.workflow-step h3 { font-size: 13.5px; color: var(--ink); line-height: 1.3; margin-bottom: 5px; }
.workflow-step p { color: var(--muted); font-size: 12.5px; line-height: 1.55; }

/* ── Site header ── */
.site-header {
  position: sticky;
  top: 0;
  z-index: 100;
  width: 100%;
  height: 64px;
  background: #ffffff;
  border-bottom: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
}
.site-header-inner {
  max-width: var(--inner);
  margin: 0 auto;
  padding: 0 var(--gutter);
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}
.site-header-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--ink);
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.02em;
  text-decoration: none;
  flex-shrink: 0;
}
.site-header-brand:hover { opacity: 0.8; text-decoration: none; }
.site-header-brand-mark {
  width: 34px; height: 34px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  border-radius: 10px;
  display: grid;
  place-items: center;
  font-size: 16px;
  box-shadow: 0 2px 8px rgba(99,102,241,0.25);
}
.site-header-brand-text {
  display: inline;
}
.site-header-nav {
  display: none;
  align-items: center;
  gap: 4px;
}
.site-header-nav-link {
  color: var(--ink-3);
  font-size: 13.5px;
  font-weight: 500;
  text-decoration: none;
  padding: 8px 14px;
  border-radius: var(--radius-xs);
  transition: all 0.15s var(--ease-in-out);
  white-space: nowrap;
}
.site-header-nav-link:hover {
  background: var(--bg);
  color: var(--ink);
  text-decoration: none;
}
.site-header-nav-link--active {
  color: var(--accent);
  background: var(--blue-light);
  font-weight: 600;
}
.site-header-actions {
  display: none;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.site-header-cta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border-radius: var(--radius-xs);
  font-size: 13.5px;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.15s var(--ease-in-out);
  white-space: nowrap;
}
.site-header-cta-primary {
  background: var(--accent);
  color: #fff;
  box-shadow: 0 2px 8px rgba(99,102,241,0.25);
}
.site-header-cta-primary:hover {
  background: var(--accent-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(99,102,241,0.35);
  text-decoration: none;
}
.site-header-cta-ghost {
  background: transparent;
  color: var(--ink-3);
  border: 1px solid var(--border);
}
.site-header-cta-ghost:hover {
  background: var(--bg);
  border-color: var(--border-2);
  color: var(--ink);
  text-decoration: none;
}
.site-header-user {
  position: relative;
}
.site-header-user-trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px 5px 5px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--ink);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s var(--ease-in-out);
  font-family: inherit;
}
.site-header-user-trigger:hover {
  border-color: var(--border-2);
  box-shadow: var(--shadow-sm);
}
.site-header-user-avatar {
  width: 28px; height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.site-header-user-email {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.site-header-user-chevron {
  flex-shrink: 0;
  transition: transform 0.15s var(--ease-in-out);
  color: var(--muted);
}
.site-header-user-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 200px;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-xl);
  padding: 6px;
  display: none;
  z-index: 110;
}
.site-header-user-menu.is-open { display: block; }
.site-header-user-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  border-radius: var(--radius-xs);
  font-size: 13.5px;
  font-weight: 500;
  color: var(--ink);
  text-decoration: none;
  transition: all 0.12s var(--ease-in-out);
  background: transparent;
  border: none;
  cursor: pointer;
  font-family: inherit;
}
.site-header-user-menu-item:hover {
  background: var(--bg);
  text-decoration: none;
}
.site-header-user-menu-item--danger {
  color: var(--rose);
}
.site-header-user-menu-item--danger:hover {
  background: var(--rose-light);
  color: var(--rose);
}
.site-header-user-menu-form {
  margin: 0;
}
.site-header-auth {
  display: flex;
  align-items: center;
  gap: 10px;
}
.site-header-mobile-toggle {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 4px;
  width: 40px;
  height: 40px;
  padding: 8px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--border);
  background: transparent;
  cursor: pointer;
  flex-shrink: 0;
}
.site-header-mobile-toggle-bar {
  width: 18px;
  height: 1.5px;
  background: var(--ink-3);
  border-radius: 2px;
  transition: all 0.2s var(--ease-in-out);
  transform-origin: center;
}
.site-header-mobile-toggle.is-open .site-header-mobile-toggle-bar:nth-child(1) {
  transform: translateY(5.5px) rotate(45deg);
}
.site-header-mobile-toggle.is-open .site-header-mobile-toggle-bar:nth-child(2) {
  opacity: 0;
  transform: scaleX(0);
}
.site-header-mobile-toggle.is-open .site-header-mobile-toggle-bar:nth-child(3) {
  transform: translateY(-5.5px) rotate(-45deg);
}
.site-header-mobile-menu {
  display: none;
  position: fixed;
  top: 64px;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  padding: 24px var(--gutter);
  overflow-y: auto;
  z-index: 99;
  border-bottom: 1px solid var(--border);
}
.site-header-mobile-menu.is-open { display: block; }
.site-header-mobile-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 24px;
}
.site-header-mobile-nav .site-header-nav-link {
  display: block;
  padding: 12px 14px;
  font-size: 16px;
  border-radius: var(--radius-sm);
  color: var(--ink);
}
.site-header-mobile-auth {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.site-header-mobile-auth-form {
  margin: 0;
}
.site-header-mobile-auth-btn {
  display: block;
  width: 100%;
  padding: 12px;
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 600;
  text-align: center;
  text-decoration: none;
  transition: all 0.15s var(--ease-in-out);
}
.site-header-mobile-auth-btn-primary {
  background: var(--accent);
  color: #fff;
  border: none;
}
.site-header-mobile-auth-btn--ghost {
  background: transparent;
  color: var(--ink-3);
  border: 1px solid var(--border);
}
.site-header-mobile-auth-btn--danger {
  background: transparent;
  color: var(--rose);
  border: 1px solid #fecaca;
}

@media (min-width: 768px) {
  .site-header-nav,
  .site-header-actions {
    display: flex;
  }
  .site-header-mobile-toggle {
    display: none;
  }
  .site-header-mobile-menu {
    display: none !important;
  }
  .site-header-user-email {
    max-width: 180px;
  }
}

/* ── Site footer ── */
.site-footer {
  background: var(--nav-bg);
  color: rgba(255,255,255,0.5);
  font-size: 13px;
  line-height: 1.6;
  flex-shrink: 0;
  border-top: 1px solid rgba(255,255,255,0.06);
}
.site-footer a {
  color: rgba(255,255,255,0.55);
  text-decoration: none;
  transition: color 0.15s var(--ease-in-out);
}
.site-footer a:hover {
  color: rgba(255,255,255,0.9);
  text-decoration: underline;
}
.site-footer-inner {
  max-width: var(--inner);
  margin: 0 auto;
  padding: 0 var(--gutter);
}
.site-footer-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 40px;
  padding: 64px 0 48px;
}
@media (min-width: 768px) {
  .site-footer-grid {
    grid-template-columns: 240px 1fr;
    gap: 64px;
  }
}
.site-footer-brand {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.site-footer-brand-link {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  text-decoration: none;
}
.site-footer-brand-link:hover {
  opacity: 0.9;
  text-decoration: none;
}
.site-footer-brand-mark {
  width: 34px; height: 34px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  border-radius: 10px;
  display: grid;
  place-items: center;
  font-size: 16px;
  box-shadow: 0 2px 8px rgba(99,102,241,0.3);
}
.site-footer-brand-desc {
  font-size: 13.5px;
  color: rgba(255,255,255,0.5);
  line-height: 1.7;
  margin: 0;
}
.site-footer-links {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 32px;
}
@media (min-width: 640px) {
  .site-footer-links {
    grid-template-columns: repeat(3, 1fr);
  }
}
@media (min-width: 1024px) {
  .site-footer-links {
    grid-template-columns: repeat(5, 1fr);
  }
}
.site-footer-col {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.site-footer-col-title {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255,255,255,0.9);
  margin: 0;
}
.site-footer-col-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.site-footer-link {
  font-size: 13.5px;
  color: rgba(255,255,255,0.55);
  text-decoration: none;
  transition: color 0.15s var(--ease-in-out);
}
.site-footer-link:hover {
  color: rgba(255,255,255,0.9);
  text-decoration: underline;
}
.site-footer-bottom {
  border-top: 1px solid rgba(255,255,255,0.06);
  padding: 24px 0;
}
.site-footer-bottom-inner {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: flex-start;
}
@media (min-width: 768px) {
  .site-footer-bottom-inner {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}
.site-footer-legal {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}
.site-footer-copyright {
  font-size: 12.5px;
  color: rgba(255,255,255,0.4);
  margin: 0;
}

/* ── App layout ── */
.app-shell {
  display: grid;
  grid-template-columns: 240px 1fr;
  grid-template-rows: 64px 1fr auto;
  grid-template-areas:
    "sidebar header"
    "sidebar main"
    "sidebar footer";
  min-height: 100vh;
}
@media (max-width: 1023px) {
  .app-shell {
    grid-template-columns: 1fr;
    grid-template-rows: 64px 1fr auto;
    grid-template-areas:
      "header"
      "main"
      "footer";
  }
}

.app-sidebar {
  grid-area: sidebar;
  background: #0b1020;
  color: rgba(255,255,255,0.7);
  display: flex;
  flex-direction: column;
  border-right: 1px solid rgba(255,255,255,0.06);
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
}
@media (max-width: 1023px) {
  .app-sidebar {
    position: fixed;
    inset: 64px 0 auto 0;
    z-index: 90;
    transform: translateX(-100%);
    transition: transform .2s var(--ease-out);
    width: 240px;
  }
  .app-sidebar.is-open { transform: translateX(0); }
  .app-sidebar-overlay {
    display: none;
    position: fixed;
    inset: 64px 0 0 0;
    background: rgba(0,0,0,0.35);
    z-index: 89;
  }
  .app-sidebar-overlay.is-open { display: block; }
}
.app-sidebar-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.02em;
  text-decoration: none;
  padding: 18px 20px 16px;
}
.app-sidebar-brand:hover { opacity: 0.9; text-decoration: none; }
.app-sidebar-brand-mark {
  width: 32px; height: 32px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  border-radius: 9px;
  display: grid;
  place-items: center;
  font-size: 15px;
  box-shadow: 0 4px 12px rgba(99,102,241,0.35);
}
.app-sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 10px;
}
.app-sidebar-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: var(--radius-xs);
  color: rgba(255,255,255,0.65);
  font-size: 13.5px;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.12s var(--ease-in-out);
}
.app-sidebar-link:hover {
  background: rgba(255,255,255,0.06);
  color: #fff;
  text-decoration: none;
}
.app-sidebar-link--active {
  background: rgba(99,102,241,0.18);
  color: #fff;
  font-weight: 600;
}
.app-sidebar-icon {
  width: 18px; height: 18px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  opacity: 0.8;
}
.app-sidebar-section {
  padding: 18px 20px 8px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255,255,255,0.28);
}
.app-sidebar-user {
  margin-top: auto;
  padding: 12px 10px 10px;
  border-top: 1px solid rgba(255,255,255,0.06);
}
.app-sidebar-user-row {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 8px 10px 10px;
}
.app-sidebar-user-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}
.app-sidebar-user-email {
  font-size: 12.5px;
  font-weight: 600;
  color: rgba(255,255,255,0.8);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.app-sidebar-logout {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: var(--radius-xs);
  color: rgba(255,255,255,0.5);
  font-size: 13px;
  font-weight: 500;
  width: 100%;
  background: transparent;
  border: none;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: all 0.12s var(--ease-in-out);
}
.app-sidebar-logout:hover {
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.85);
}

/* ── Stats cards ── */
.stats-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 24px; }
@media (max-width: 768px) { .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 480px) { .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.stat-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 18px 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: box-shadow 0.15s var(--ease-out);
  position: relative;
  overflow: hidden;
}
.stat-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
  border-radius: 3px 3px 0 0;
}
.stat-card--default::before { background: var(--accent); }
.stat-card--danger::before { background: var(--rose); }
.stat-card--warning::before { background: var(--amber); }
.stat-card--success::before { background: var(--emerald); }
.stat-card:hover { box-shadow: var(--shadow-md); }
.stat-card-value {
  font-size: 2rem;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.04em;
  font-variant-numeric: tabular-nums;
}
.stat-card--default .stat-card-value { color: var(--ink); }
.stat-card--danger .stat-card-value { color: var(--rose); }
.stat-card--warning .stat-card-value { color: #d97706; }
.stat-card--success .stat-card-value { color: var(--emerald); }
.stat-card-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  margin-top: 2px;
}
.stat-card-link {
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
  text-decoration: none;
  margin-top: 6px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.stat-card-link:hover { color: var(--accent-hover); }

.app-header {
  grid-area: header;
  background: rgba(255,255,255,0.88);
  backdrop-filter: blur(16px) saturate(160%);
  -webkit-backdrop-filter: blur(16px) saturate(160%);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--gutter);
  gap: 16px;
  position: sticky;
  top: 0;
  z-index: 80;
}
.app-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.app-header-mobile-toggle {
  display: none;
  width: 36px; height: 36px;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-xs);
  border: 1px solid var(--border);
  background: transparent;
  cursor: pointer;
  flex-shrink: 0;
}
.app-header-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--ink);
  letter-spacing: -0.01em;
}
.app-header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.app-header-cta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: var(--radius-xs);
  font-size: 13.5px;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.15s var(--ease-in-out);
  white-space: nowrap;
  border: none;
  cursor: pointer;
  font-family: inherit;
}
.app-header-cta-primary {
  background: var(--accent);
  color: #fff;
  box-shadow: 0 2px 8px rgba(99,102,241,0.25);
}
.app-header-cta-primary:hover {
  background: var(--accent-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(99,102,241,0.35);
  text-decoration: none;
}
@media (min-width: 1024px) {
  .app-header-mobile-toggle { display: none; }
}
@media (max-width: 1023px) {
  .app-header-mobile-toggle { display: inline-flex; }
}

.app-main {
  grid-area: main;
  background: #f8fafc;
  min-width: 0;
}
.app-main-inner {
  max-width: var(--inner);
  margin: 0 auto;
  padding: 24px var(--gutter) 64px;
}

.app-footer {
  grid-area: footer;
  background: #0b1020;
  color: rgba(255,255,255,0.4);
  font-size: 12.5px;
  padding: 18px var(--gutter);
  border-top: 1px solid rgba(255,255,255,0.06);
}
@media (max-width: 1023px) {
  .app-footer { display: block; }
}
.wizard-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15,23,42,0.75);
  backdrop-filter: blur(8px) saturate(140%);
  -webkit-backdrop-filter: blur(8px) saturate(140%);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  animation: fadeIn 0.2s var(--ease-out);
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.wizard-modal {
  background: #0f172a;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px;
  width: 100%;
  max-width: 580px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px -12px rgba(0,0,0,0.4);
  animation: slideUp 0.3s var(--ease-out);
}
@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.wizard-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.wizard-title {
  font-size: 17px;
  font-weight: 700;
  color: #fff;
  letter-spacing: -0.01em;
  margin: 0;
}
.wizard-close {
  background: transparent;
  border: none;
  color: rgba(255,255,255,0.5);
  font-size: 26px;
  line-height: 1;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border-radius: 6px;
  transition: all 0.15s var(--ease-in-out);
}
.wizard-close:hover {
  background: rgba(255,255,255,0.08);
  color: #fff;
  transform: rotate(90deg);
}
.wizard-body {
  padding: 22px 24px;
  overflow-y: auto;
  flex: 1;
}
.wizard-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 24px 18px;
  border-top: 1px solid rgba(255,255,255,0.06);
}
.wizard-btn {
  padding: 9px 18px;
  border-radius: 8px;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s var(--ease-in-out);
  border: none;
}
.wizard-btn-primary {
  background: var(--accent);
  color: #fff;
}
.wizard-btn-primary:hover {
  background: var(--accent-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(99,102,241,0.3);
}
.wizard-btn-primary:disabled {
  background: #475569;
  cursor: not-allowed;
  opacity: 0.6;
  transform: none;
  box-shadow: none;
}
.wizard-btn-ghost {
  background: transparent;
  color: rgba(255,255,255,0.7);
  border: 1px solid rgba(255,255,255,0.15);
}
.wizard-btn-ghost:hover {
  background: rgba(255,255,255,0.06);
  color: #fff;
  border-color: rgba(255,255,255,0.25);
  transform: translateY(-1px);
}
.wizard-step-label {
  font-size: 11px;
  font-weight: 700;
  color: rgba(255,255,255,0.35);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 10px;
}
}
.wizard-btn-primary:hover {
  background: #1d4ed8;
}
.wizard-btn-primary:disabled {
  background: #475569;
  cursor: not-allowed;
  opacity: 0.7;
}
.wizard-btn-ghost {
  background: transparent;
  color: rgba(255,255,255,0.7);
  border: 1px solid rgba(255,255,255,0.15);
}
.wizard-btn-ghost:hover {
  background: rgba(255,255,255,0.06);
  color: #fff;
  border-color: rgba(255,255,255,0.25);
}
.wizard-step-label {
  font-size: 11px;
  font-weight: 700;
  color: rgba(255,255,255,0.35);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 10px;
}

/* Dashboard refresh */
.hero-section {
  background: #0b1020;
  padding: clamp(56px, 8vw, 96px) 0;
  isolation: isolate;
}
.hero-section::before {
  background:
    radial-gradient(circle at 8% 10%, rgba(96,165,250,.2), transparent 33%),
    radial-gradient(circle at 88% 76%, rgba(168,85,247,.22), transparent 37%),
    linear-gradient(135deg, rgba(30,41,59,.5), rgba(15,23,42,0));
}
.hero-dashboard {
  max-width: var(--inner);
  display: grid;
  grid-template-columns: minmax(0, 1.18fr) minmax(300px, .82fr);
  align-items: center;
  gap: clamp(36px, 8vw, 100px);
  text-align: left;
}
.hero-copy { min-width: 0; }
.hero-copy .hero-badge { margin-bottom: 20px; }
.hero-copy .hero-h1 { max-width: 680px; margin-bottom: 20px; }
.hero-copy .hero-sub { margin: 0 0 28px; max-width: 600px; }
.hero-actions { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.hero-actions .scan-btn { border-radius: 10px; padding: 14px 21px; display: inline-flex; align-items: center; gap: 14px; }
.hero-actions .scan-btn span { font-size: 20px; line-height: .75; transition: transform .2s var(--ease-out); }
.hero-actions .scan-btn:hover span { transform: translateX(3px); }
.hero-action-note { color: rgba(255,255,255,.42); font-size: 12.5px; }
.hero-copy .hero-features { justify-content: flex-start; margin-top: 30px; gap: 11px 24px; }
.hero-preview {
  width: 100%;
  padding: 22px;
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 20px;
  background: linear-gradient(145deg, rgba(255,255,255,.12), rgba(255,255,255,.04));
  box-shadow: 0 28px 54px rgba(0,0,0,.25), inset 0 1px rgba(255,255,255,.08);
  backdrop-filter: blur(14px);
}
.preview-topline { display: flex; align-items: center; gap: 8px; color: rgba(255,255,255,.6); font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.preview-live-dot { width: 8px; height: 8px; border-radius: 50%; background: #34d399; box-shadow: 0 0 0 4px rgba(52,211,153,.12); }
.preview-score { display: flex; align-items: baseline; gap: 12px; padding: 22px 0 18px; border-bottom: 1px solid rgba(255,255,255,.1); }
.preview-score span { color: #fff; font-size: 54px; font-weight: 800; letter-spacing: -.06em; line-height: 1; }
.preview-score small { color: rgba(255,255,255,.5); font-size: 13px; }
.preview-list { display: grid; gap: 8px; margin-top: 18px; }
.preview-row { display: grid; grid-template-columns: 26px 1fr auto; align-items: center; gap: 10px; padding: 9px 0; color: rgba(255,255,255,.82); font-size: 13.5px; }
.preview-row b { color: #86efac; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
.preview-icon { width: 24px; height: 24px; display: grid; place-items: center; border-radius: 7px; font-size: 11px; font-weight: 800; }
.preview-icon--neutral { color: #bfdbfe; background: rgba(96,165,250,.18); }
.preview-icon--good { color: #bbf7d0; background: rgba(52,211,153,.15); }
.preview-footer { margin-top: 18px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,.1); color: rgba(255,255,255,.38); font-size: 12px; }
.content-section { background: #f8fafc; padding: clamp(32px, 5vw, 58px) 0 clamp(48px, 7vw, 84px); }
.history-hdr { margin-bottom: 18px; }
.history-title { font-size: 19px; }
.scan-card { border-left-width: 4px; border-radius: 14px; padding: 19px 20px 17px; }
.empty-state { background: #fff; border-radius: 16px; padding: 64px 24px; }
.site-header { background: rgba(255,255,255,.88); backdrop-filter: blur(16px) saturate(160%); -webkit-backdrop-filter: blur(16px) saturate(160%); }
.site-header-brand-mark { color: #fff; }
.site-header-mobile-auth-btn--primary { background: var(--accent); color: #fff; border: none; }

@media (max-width: 767px) {
  .hero-dashboard { grid-template-columns: 1fr; gap: 36px; }
  .hero-copy .hero-h1 { font-size: clamp(36px, 11vw, 49px); }
  .hero-preview { max-width: 440px; }
  .hero-copy .hero-features { gap: 10px 18px; }
  .hero-copy .hf { font-size: 12px; }
  .content-section { padding-top: 32px; }
  .scan-card { padding: 16px; }
  .workflow-steps { grid-template-columns: 1fr; gap: 18px; }
  .sc-top { gap: 10px; }
  .sc-right { align-items: flex-end; flex-direction: column; gap: 5px; }
  .sc-time { font-size: 11px; }
}
@media (max-width: 480px) {
  .hero-section { padding: 48px 0 54px; }
  .hero-actions { align-items: flex-start; flex-direction: column; }
  .hero-actions .scan-btn { width: 100%; justify-content: center; }
  .hero-preview { padding: 18px; border-radius: 16px; }
  .preview-score { padding: 18px 0 15px; }
  .preview-score span { font-size: 46px; }
  .history-hdr { align-items: flex-start; flex-direction: column; }
  .history-chips { margin-left: 0; }
  .wizard-overlay { padding: 12px; align-items: flex-end; }
  .wizard-modal { max-height: calc(100vh - 24px); border-radius: 16px; }
  .wizard-header { padding: 18px 18px 14px; }
  .wizard-body { padding: 18px; }
  .wizard-footer { padding: 12px 18px 16px; }
  .wizard-btn { padding: 10px 14px; }
}
@media (min-width: 1024px) {
  .wizard-overlay { left: 240px; }
}
`;

// ── Layout shell ──────────────────────────────────────────────────────────────
// NOTE: layout() does NOT wrap body in a max-width container.
// Each section in the body is full-width and owns its own background.
// Sections use .inner for centering their content.

function layout(title, body, extraHead = '', user) {
  const headerHtml = require('./components/header').header({ user });
  const footerHtml = require('./components/footer').footer();
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — SPIDAC</title>
<style>${SHARED_CSS}</style>
${extraHead}
</head>
<body>
<a class="skip-link" href="#main">Skip to main content</a>
${headerHtml}
<main id="main" tabindex="-1" data-authenticated="${user && user.id ? 'true' : 'false'}">
${body}
</main>
${footerHtml}
</body>
</html>`;
}

function appLayout(title, body, user, currentPage = 'dashboard', extraHead = '') {
  const navItems = [
    { href: '/app', label: 'Dashboard', page: 'dashboard', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>' },
    { href: '/app/monitors', label: 'Monitors', page: 'monitors', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' },
    { href: '/app/reports', label: 'Reports', page: 'reports', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>' },
    { href: '/comparisons', label: 'Comparisons', page: 'comparisons', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>' },
    { href: '/app/remediations', label: 'Remediations', page: 'remediations', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>' },
    { href: '/app/settings', label: 'Settings', page: 'settings', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>' },
  ];

  const sidebarLinks = navItems.map(item => {
    const activeClass = currentPage === item.page ? 'app-sidebar-link--active' : '';
    return `<a href="${esc(item.href)}" class="app-sidebar-link ${activeClass}">
      <span class="app-sidebar-icon">${item.icon}</span>
      <span>${esc(item.label)}</span>
    </a>`;
  }).join('');

  const userEmail = user?.email || 'User';
  const userInitial = userEmail[0] ? userEmail[0].toUpperCase() : 'U';
  const adminLink = user?.role === 'admin'
    ? `<a href="/admin/blog" class="app-sidebar-link"><span class="app-sidebar-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></span><span>Blog admin</span></a>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — SPIDAC</title>
<style>${SHARED_CSS}</style>
${extraHead}
</head>
<body>
<a class="skip-link" href="#main">Skip to main content</a>
<div class="app-shell">
  <aside class="app-sidebar" id="app-sidebar" aria-label="Sidebar">
    <a href="/app" class="app-sidebar-brand" aria-label="SPIDAC home">
      <span class="app-sidebar-brand-mark" aria-hidden="true">&#128737;</span>
      <span class="app-sidebar-brand-text">SPIDAC</span>
    </a>
    <nav class="app-sidebar-nav" aria-label="App">
      ${sidebarLinks}
      ${adminLink}
    </nav>
    <div class="app-sidebar-user">
      <div class="app-sidebar-user-row">
        <span class="app-sidebar-user-avatar">${esc(userInitial)}</span>
        <span class="app-sidebar-user-email">${esc(userEmail)}</span>
      </div>
      <form method="POST" action="/logout">
        <button type="submit" class="app-sidebar-logout">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Sign out
        </button>
      </form>
    </div>
  </aside>
  <div class="app-sidebar-overlay" id="app-sidebar-overlay"></div>
  <header class="app-header">
    <div class="app-header-left">
      <button class="app-header-mobile-toggle" id="app-sidebar-toggle" type="button" aria-label="Toggle menu" aria-expanded="false">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
      </button>
      <div class="app-header-title">${esc(title)}</div>
    </div>
    <div class="app-header-right">
      <a href="/app/new-scan" class="app-header-cta app-header-cta-primary"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> New scan</a>
    </div>
  </header>
  <main class="app-main" id="main" tabindex="-1" data-authenticated="true">
    <div class="app-main-inner">
      ${body}
    </div>
  </main>
  <footer class="app-footer">
    <div style="max-width:var(--inner);margin:0 auto;padding:0 var(--gutter);display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
      <span>&copy; ${new Date().getFullYear()} SPIDAC - Digital Tech Assurance</span>
      <span></span>
    </div>
  </footer>
</div>
<script>
(function() {
  'use strict';
  const toggle = document.getElementById('app-sidebar-toggle');
  const sidebar = document.getElementById('app-sidebar');
  const overlay = document.getElementById('app-sidebar-overlay');
  if (!toggle || !sidebar) return;
  function open() { sidebar.classList.add('is-open'); overlay && overlay.classList.add('is-open'); toggle.setAttribute('aria-expanded','true'); document.body.style.overflow='hidden'; }
  function close() { sidebar.classList.remove('is-open'); overlay && overlay.classList.remove('is-open'); toggle.setAttribute('aria-expanded','false'); document.body.style.overflow=''; }
  toggle.addEventListener('click', function() { if (sidebar.classList.contains('is-open')) close(); else open(); });
  overlay && overlay.addEventListener('click', close);
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape' && sidebar.classList.contains('is-open')) close(); });
})();
</script>
${WIZARD_HTML}
${WIZARD_JS}
<script>
async function deleteScan(scanId, url) {
  if (!confirm('Delete scan for ' + url + '?\n\nThis will also remove all remediations and comparisons linked to this scan.')) return;
  var r = await fetch('/api/scans/' + scanId, { method: 'DELETE', credentials: 'same-origin' });
  if (r.ok || r.status === 204) { window.location.reload(); }
  else { var d = await r.json().catch(function(){ return {}; }); alert('Delete failed: ' + (d.error || r.status)); }
}
async function renameScan(scanId, currentName) {
  var name = prompt('New name for this scan:', currentName || '');
  if (name === null) return;
  var r = await fetch('/api/scans/' + scanId, { method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name }) });
  if (r.ok) { window.location.reload(); }
  else { var d = await r.json().catch(function(){ return {}; }); alert('Rename failed: ' + (d.error || r.status)); }
}
</script>
</body>
</html>`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sevPills(counts) {
  if (!counts) return '';
  return SEVERITY_ORDER
    .filter(s => counts[s] > 0)
    .map(s => `<span class="sev-pill sp-${s.toLowerCase()}">${counts[s]}&thinsp;${s}</span>`)
    .join('');
}

function statusBadge(status) {
  const cls = {
    ok: 'badge-ok', blocked: 'badge-blocked', suspect: 'badge-suspect',
    queued: 'badge-queued', running: 'badge-running', failed: 'badge-failed',
    done: 'badge-ok',
  }[status] || 'badge-queued';
  return `<span class="badge ${cls}">${esc(status)}</span>`;
}

function relativeTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 2) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return fmtDate(iso);
}

function worstSeverity(findings) {
  if (!findings) return null;
  if (findings.CRITICAL > 0) return 'CRITICAL';
  if (findings.HIGH > 0) return 'HIGH';
  if (findings.REVIEW > 0) return 'REVIEW';
  if (findings.ADVISORY > 0) return 'ADVISORY';
  return null;
}

// ── Progress polling ──────────────────────────────────────────────────────────

const SCAN_STEPS = [
  { key: 'detecting-cmp', label: 'Detecting consent management platform' },
  { key: 'crawling', label: 'Discovering pages to scan' },
  { key: 'scenario-no-interaction', label: 'Testing no-interaction scenario' },
  { key: 'scenario-accept-all', label: 'Testing accept-all scenario' },
  { key: 'scenario-reject-all', label: 'Testing reject-all scenario' },
  { key: 'scenario-open-preferences', label: 'Testing open-preferences scenario' },
  { key: 'scenario-accept-analytics', label: 'Testing accept-analytics scenario' },
  { key: 'scenario-accept-advertising', label: 'Testing accept-advertising scenario' },
  { key: 'scenario-withdraw-consent', label: 'Testing withdraw-consent scenario' },
  { key: 'scenario-revisit-after-consent', label: 'Testing revisit-after-consent scenario' },
  { key: 'scenario-custom', label: 'Testing custom journey' },
  { key: 'category-analysis', label: 'Mapping per-category cookies' },
  { key: 'persistence-check', label: 'Checking consent persistence' },
  { key: 'generating', label: 'Generating findings and report' },
];

function progressPollingJS(jobId) {
  return `<script>
(function () {
  'use strict';
  const STEPS   = ${JSON.stringify(SCAN_STEPS)};
  const JOB_ID  = ${JSON.stringify(jobId)};
  const stepList  = document.getElementById('step-list');
  const progMsg   = document.getElementById('progress-msg');
  const errBox    = document.getElementById('error-box');
  const queueNote = document.getElementById('queue-note');

  function renderSteps(currentStep, doneKeys) {
    stepList.innerHTML = STEPS.map(s => {
      const isDone   = doneKeys.includes(s.key);
      const isActive = !isDone && s.key === currentStep;
      const cls  = isDone ? 'done' : isActive ? 'active' : '';
      const icon = isDone
        ? '<span class="step-icon-cell" style="color:#15803d">✓</span>'
        : isActive
          ? '<span class="step-icon-cell"><span class="spinner"></span></span>'
          : '<span class="step-icon-cell" style="color:#d4d4d4">·</span>';
      return \`<li class="step-item \${cls}">\${icon} \${s.label}</li>\`;
    }).join('');
  }

  function stepsBefore(key) {
    const idx = STEPS.findIndex(s => s.key === key);
    return idx > 0 ? STEPS.slice(0, idx).map(s => s.key) : [];
  }

  function poll() {
    fetch('/scan/' + JOB_ID + '/status')
      .then(r => r.json())
      .then(job => {
        if (job.status === 'queued') {
          if (queueNote) { queueNote.style.display = 'block'; queueNote.textContent = job.progress || 'Waiting in queue…'; }
          renderSteps(null, []);
          setTimeout(poll, 2000);
          return;
        }
        if (queueNote) queueNote.style.display = 'none';
        if (job.status === 'running') {
          renderSteps(job.step, stepsBefore(job.step));
          if (progMsg) progMsg.textContent = job.progress || '';
          setTimeout(poll, 2000);
          return;
        }
        if (job.status === 'done') {
          renderSteps('done', STEPS.map(s => s.key));
          if (progMsg) progMsg.textContent = 'Complete — opening report…';
          setTimeout(function () { window.location.href = '/report/' + JOB_ID; }, 800);
          return;
        }
        if (job.status === 'failed') {
          renderSteps(null, []);
          if (errBox) { errBox.style.display = 'block'; errBox.textContent = job.error || 'Scan failed'; }
          return;
        }
        setTimeout(poll, 2000);
      })
      .catch(function () { setTimeout(poll, 3000); });
  }

  poll();
})();
</script>`;
}

// ── Active job card (shown on home page while scan runs) ──────────────────────

function activeJobCard(job) {
  const statusLabel = job.status === 'queued'
    ? `Queue position ${job.queuePosition}`
    : (job.progress || 'Running…');
  return `<li class="scan-card sc-active">
  <div class="sc-top">
    <div class="sc-url-block">
      <span class="sc-url">${esc(job.url)}</span>
      ${job.name ? `<span class="sc-name">${esc(job.name)}</span>` : ''}
    </div>
    <div class="sc-right"><span class="badge badge-running">${job.status}</span></div>
  </div>
  <div class="sc-mid">
    <span class="active-progress-label">
      <span class="spinner" style="display:inline-block;width:11px;height:11px;border:2px solid #93c5fd;border-top-color:#2563eb;border-radius:50%;animation:spin 0.75s linear infinite;margin-right:5px;vertical-align:middle"></span>
      ${esc(statusLabel)}
    </span>
  </div>
  <div class="sc-bottom">
    <span style="font-size:0.78rem;color:var(--muted)">Started ${relativeTime(job.startedAt || job.createdAt)}</span>
    <a class="sc-view" href="/scan/${esc(job.id)}">Resume →</a>
  </div>
</li>`;
}

// ── Standalone progress page ───────────────────────────────────────────────────

function progressPage(job, user) {
  const body = `
<section class="content-section" style="flex:1;padding-top:2.5rem;padding-bottom:3rem">
  <div class="inner" style="max-width:660px">
    <a href="/" style="display:inline-flex;align-items:center;gap:6px;color:var(--muted);font-size:0.83rem;text-decoration:none;margin-bottom:1.5rem">
      ← Back to dashboard
    </a>
    <div id="progress-panel" class="visible">
      <div class="pp-head">
        <div class="pp-title">Scan in progress</div>
        <div class="pp-url">${esc(job.url)}</div>
      </div>
      <div class="pp-body">
        <div class="queue-note" id="queue-note" role="status" aria-live="polite" style="display:none"></div>
        <ul class="step-list" id="step-list"></ul>
        <p class="pp-message" id="progress-msg" role="status" aria-live="polite"></p>
        <div class="error-box" id="error-box" role="alert" style="display:none"></div>
      </div>
    </div>
    <p style="margin-top:1.25rem;font-size:0.8rem;color:var(--muted);text-align:center">
      This scan runs on your machine. You can navigate away and come back — the scan will finish in the background.
    </p>
  </div>
</section>
${progressPollingJS(job.id)}`;

  return appLayout(`Scanning — ${esc(job.url)}`, body, user, 'dashboard');
}

// ── Scan card ─────────────────────────────────────────────────────────────────

function scanCard(s) {
  const reportLink = `/report/${esc(s.dirName)}`;
  const worst = worstSeverity(s.findings);
  const status = s.scanStatus || 'ok';
  const domain = (() => {
    try { return new URL(s.url).hostname.replace(/^www\./, ''); } catch (_) { return s.url; }
  })();
  const borderCls = s.scanStatus === 'blocked' ? 'sc-blocked'
    : s.scanStatus === 'suspect' ? 'sc-suspect'
      : worst ? `sc-${worst.toLowerCase()}` : 'sc-clean';

  const nameHtml = s.name ? `<span class="sc-name">${esc(s.name)}</span>` : '';
  const cmpHtml = s.cmpName ? `<span class="cmp-pill">${esc(s.cmpName)}</span>` : '';
  const regionHtml = s.region ? `<span class="region-pill" title="${esc(s.region.framework)}">${esc(s.region.flag)} ${esc(s.region.label)}</span>` : '';
  const timeHtml = `<span class="sc-time" title="${esc(fmtDate(s.scannedAt))}">${relativeTime(s.scannedAt)}</span>`;

  const top = `<div class="sc-top">
  <div class="sc-url-block">
    <span class="sc-url">${esc(s.url)}</span>${nameHtml}
  </div>
  <div class="sc-right">${regionHtml}${cmpHtml}${timeHtml}</div>
</div>`;

  let statusContent;
  if (worst) statusContent = `${sevPills(s.findings)}<span class="sc-status-text">Needs attention</span>`;
  else if (status === 'blocked') statusContent = `${statusBadge('blocked')}<span class="sc-status-text">Site blocked the scan</span>`;
  else if (status === 'suspect') statusContent = `${statusBadge('suspect')}<span class="sc-status-text">Review recommended</span>`;
  else statusContent = '<span class="clean-badge"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg> No issues detected</span>';
  const midContent = `<span class="sc-status-summary">${statusContent}</span>`;
  const mid = `<div class="sc-mid">${midContent}</div>`;

  const cc = s.cookieCounts;
  const hasCount = cc && [cc.noInteraction, cc.acceptAll, cc.rejectAll].some(n => n !== null);
  const cookieFlow = hasCount ? `<div class="cookie-flow" title="Cookies: no consent → accept all → reject all">
  <div class="cf-seg"><span class="cf-num">${cc.noInteraction ?? '?'}</span><span class="cf-lbl">none</span></div>
  <span class="cf-arr">›</span>
  <div class="cf-seg"><span class="cf-num">${cc.acceptAll ?? '?'}</span><span class="cf-lbl">accept</span></div>
  <span class="cf-arr">›</span>
  <div class="cf-seg"><span class="cf-num">${cc.rejectAll ?? '?'}</span><span class="cf-lbl">reject</span></div>
</div>` : '';

  const ss = s.scenarioStatuses || {};
  const warnParts = [];
  if (ss.noInteraction === 'manual-review-needed') warnParts.push('No interaction');
  if (ss.acceptAll === 'manual-review-needed') warnParts.push('Accept all');
  if (ss.rejectAll === 'manual-review-needed') warnParts.push('Reject all');
  const warnHtml = warnParts.length
    ? `<span class="sc-warn-wrap">${warnParts.map(p => `<span class="sc-warn-chip">${p}</span>`).join('')}</span>`
    : '';

  const bottom = `<div class="sc-bottom">
  ${cookieFlow}${warnHtml}
  <div class="sc-actions">
    <a class="sc-rescan" href="/app/new-scan?url=${encodeURIComponent(s.url)}&region=${encodeURIComponent(s.region?.key || '')}&name=${encodeURIComponent('Re-scan: ' + (s.name || domain))}" title="Run a new scan of this URL"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg> Re-scan</a>
    ${s.id ? `<button class="sc-rescan" onclick="renameScan(${s.id}, '${esc(String(s.name || '').replace(/'/g, "\\'"))}')" title="Rename this scan"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> Rename</button>` : ''}
    ${s.id ? `<button class="sc-rescan sc-compare" data-compare-id="${s.id}" data-compare-url="${esc(s.url)}" title="Compare with another scan"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> Compare</button>` : ''}
    ${s.id ? `<a class="sc-rescan" href="/api/scans/${s.id}/export" download title="Download scan data"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Export</a>` : ''}
    ${s.id ? `<button class="sc-rescan sc-delete" onclick="deleteScan(${s.id}, '${esc(String(s.url || '').replace(/'/g, "\\'"))}')" title="Delete this scan"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg> Delete</button>` : ''}
    <a class="sc-view" href="${reportLink}">View report <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></a>
  </div>
</div>`;

  return `<li class="scan-card ${borderCls}" data-domain="${esc(domain.toLowerCase())}" data-severity="${esc((worst || 'CLEAN').toLowerCase())}" data-status="${esc(status.toLowerCase())}" data-region="${esc(s.region?.key || '')}" data-scanned-at="${esc(s.scannedAt || '')}">${top}${mid}${bottom}</li>`;
}

// ── Home page ─────────────────────────────────────────────────────────────────

// ── Wizard HTML (embedded in every authenticated app page via appLayout) ──────

const WIZARD_HTML = `
<!-- Scan creation wizard -->
<div id="scan-wizard" class="wizard-overlay" style="display:none" role="dialog" aria-modal="true" aria-labelledby="wizard-title" aria-hidden="true">
  <div class="wizard-modal">
    <div class="wizard-header">
      <h2 class="wizard-title" id="wizard-title">Create new scan</h2>
      <button type="button" class="wizard-close" id="wizard-close" aria-label="Close scan setup">&times;</button>
    </div>
    <div class="wizard-body">
      <div class="wizard-step" data-step="1">
        <label class="form-label" for="wizard-name">Scan name</label>
        <input class="name-input" type="text" id="wizard-name" placeholder="e.g. Client A — Q2 audit" autocomplete="off">
        <p class="form-hint">Optional. You can skip this step.</p>
      </div>
      <div class="wizard-step" data-step="2" style="display:none">
        <label class="form-label" for="wizard-url">Website URL <span style="color:#f87171">*</span></label>
        <div class="url-row">
          <input class="url-input" type="url" id="wizard-url" placeholder="https://example.com" required autocomplete="off">
        </div>
        <div class="adv-row" style="margin-top:14px">
          <div class="form-col">
            <label class="form-label" for="wizard-pages">Pages to scan</label>
            <input class="name-input" type="number" id="wizard-pages" value="1" min="1" max="50" step="1" inputmode="numeric">
            <p class="form-hint">1 = homepage only, up to 50</p>
          </div>
          <div class="form-col">
            <label class="form-label" for="wizard-region">Browser locale &amp; timezone</label>
            <select id="wizard-region" class="name-input">
              <option value="" disabled>Select a scan region</option>
              <optgroup label="Europe">
                <option value="uk">🇬🇧 English (UK) — Europe/London</option>
                <option value="eu-de">🇩🇪 German — Europe/Berlin</option>
                <option value="eu-fr">🇫🇷 French — Europe/Paris</option>
                <option value="eu-es">🇪🇸 Spanish — Europe/Madrid</option>
              </optgroup>
              <optgroup label="Americas">
                <option value="us">🇺🇸 English (US) — America/New_York</option>
                <option value="us-ca">🇺🇸 English (US) — America/Los_Angeles</option>
                <option value="ca">🇨🇦 English (CA) — America/Toronto</option>
                <option value="br">🇧🇷 Portuguese — America/Sao_Paulo</option>
              </optgroup>
              <optgroup label="Asia-Pacific">
                <option value="au">🇦🇺 English (AU) — Australia/Sydney</option>
                <option value="in">🇮🇳 English (IN) — Asia/Kolkata</option>
                <option value="jp">🇯🇵 Japanese — Asia/Tokyo</option>
              </optgroup>
              <optgroup label="Africa">
                <option value="za">🇿🇦 English (ZA) — Africa/Johannesburg</option>
              </optgroup>
            </select>
            <p class="form-hint">Changes browser language, timezone and Accept-Language header only.</p>
          </div>
        </div>
        <div class="adv-row" style="margin-top:14px">
          <div class="form-col">
            <label class="form-label" for="wizard-framework">Compliance framework</label>
            <select id="wizard-framework" class="name-input">
              <option value="uk-pecr">UK GDPR / PECR</option>
              <option value="ccpa-cpra">California CCPA / CPRA</option>
              <option value="both">UK GDPR / PECR + California CCPA / CPRA</option>
            </select>
            <p class="form-hint">Controls the legal context and privacy signals tested.</p>
          </div>
          <div class="form-col">
            <label class="form-label" for="wizard-scan-type">Scan profile</label>
            <select id="wizard-scan-type" class="name-input">
              <option value="consent">Consent and cookie controls</option>
              <option value="ccpa-signals">California privacy signals</option>
              <option value="full">Full consent and privacy signals</option>
            </select>
            <p class="form-hint">California checks include GPC and opt-out surface discovery.</p>
          </div>
        </div>
        <div class="adv-row" style="margin-top:14px">
          <div class="form-col">
            <label class="form-label" for="wizard-scan-profile">Assurance depth</label>
            <select id="wizard-scan-profile" class="name-input">
              <option value="quick">Quick check</option>
              <option value="standard" selected>Standard assurance</option>
              <option value="deep">Deep assurance (planned interactions)</option>
            </select>
            <p class="form-hint">Deep mode uses interactive page discovery to trigger lazy-loaded content and embeds.</p>
          </div>
          <div class="form-col">
            <label class="form-label" for="wizard-crawl-mode">Crawl scope</label>
            <select id="wizard-crawl-mode" class="name-input">
              <option value="homepage">Homepage only</option>
              <option value="linked-pages">Linked pages</option>
              <option value="sitemap">Sitemap</option>
              <option value="deep">Deep interactive</option>
            </select>
            <p class="form-hint">Deep mode scrolls, expands menus, and clicks embeds to discover more pages.</p>
          </div>
        </div>
        <div class="adv-row" style="margin-top:14px">
          <div class="form-col">
            <label class="form-label">Subdomain policy</label>
            <select id="wizard-subdomain-policy" class="name-input">
              <option value="same-domain">Same domain only</option>
              <option value="subdomains">Include subdomains</option>
            </select>
            <p class="form-hint">Same domain limits discovery to the exact host. Include subdomains also scans www, shop, and other hosts under the same base domain.</p>
          </div>
          <div class="form-col">
            <label class="form-label">Interactive behaviour</label>
            <label class="check-row"><input type="checkbox" id="wizard-interactive" checked> Enable interactive discovery</label>
            <p class="form-hint">Scrolls pages, opens menus, and clicks embeds to reveal hidden content and links. Only active in deep mode.</p>
          </div>
        </div>
        <div class="adv-row" style="margin-top:14px">
          <div class="form-col">
            <label class="form-label">Journeys to run</label>
            <label class="check-row"><input type="checkbox" name="wizard-journey" value="no-interaction" checked> Before consent</label>
            <label class="check-row"><input type="checkbox" name="wizard-journey" value="accept-all" checked> Accept all</label>
            <label class="check-row"><input type="checkbox" name="wizard-journey" value="reject-all" checked> Reject all</label>
            <label class="check-row"><input type="checkbox" name="wizard-journey" value="open-preferences"> Open preferences</label>
            <label class="check-row"><input type="checkbox" name="wizard-journey" value="accept-analytics"> Accept analytics only</label>
            <label class="check-row"><input type="checkbox" name="wizard-journey" value="accept-advertising"> Accept advertising only</label>
            <label class="check-row"><input type="checkbox" name="wizard-journey" value="withdraw-consent"> Withdraw consent</label>
            <label class="check-row"><input type="checkbox" name="wizard-journey" value="revisit-after-consent"> Revisit after consent</label>
            <label class="check-row"><input type="checkbox" name="wizard-journey" value="gpc-comparison"> GPC signal comparison</label>
            <p class="form-hint">Unchecked journeys will not be run.</p>
          </div>
          <div class="form-col">
            <label class="form-label" for="wizard-include-patterns">Include paths <span class="opt">optional</span></label>
            <textarea class="name-input" id="wizard-include-patterns" rows="2" placeholder="/checkout\n/blog/*"></textarea>
            <label class="form-label" for="wizard-exclude-patterns" style="margin-top:8px">Exclude paths <span class="opt">optional</span></label>
            <textarea class="name-input" id="wizard-exclude-patterns" rows="2" placeholder="/account/*"></textarea>
          </div>
        </div>
      </div>
      <div class="wizard-step" data-step="3" style="display:none">
        <p style="color:rgba(255,255,255,0.7);font-size:14px;margin-bottom:18px">
          Build a custom visitor journey. Add steps to simulate real user behaviour before or after consent.
        </p>
        <div id="journey-builder" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:16px 18px;font-size:13.5px;color:rgba(255,255,255,0.8);line-height:1.7">
          <div id="journey-steps" style="display:grid;gap:10px;margin-bottom:14px"></div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
            <div style="flex:1 1 180px">
              <label class="form-label" style="color:rgba(255,255,255,0.6)">Step type</label>
              <select id="journey-step-type" class="name-input">
                <option value="click">Click selector</option>
                <option value="open-preferences">Open preferences</option>
                <option value="toggle-category">Toggle category</option>
                <option value="save">Save choices</option>
                <option value="navigate">Navigate to URL</option>
                <option value="scroll">Scroll</option>
                <option value="wait">Wait for condition</option>
              </select>
            </div>
            <div style="flex:2 1 260px">
              <label class="form-label" style="color:rgba(255,255,255,0.6)">Selector / value</label>
              <input class="name-input" id="journey-step-value" placeholder=".accept-all-btn, /checkout, 1000ms">
            </div>
            <button type="button" class="wizard-btn wizard-btn-ghost" id="journey-add-step" style="height:38px">Add step</button>
          </div>
        </div>
      </div>
      <div class="wizard-step" data-step="4" style="display:none">
        <p style="color:rgba(255,255,255,0.7);font-size:14px;margin-bottom:18px">Review your scan settings and start the scan.</p>
        <div id="wizard-summary" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:16px 18px;font-size:13.5px;color:rgba(255,255,255,0.8);line-height:1.7"></div>
      </div>
      <div class="wizard-step" data-step="5" style="display:none">
        <div style="text-align:center;padding:18px 0">
          <div class="spinner" style="width:28px;height:28px;border-width:3px;margin:0 auto 14px"></div>
          <p style="color:rgba(255,255,255,0.8);font-size:14px;font-weight:600" id="wizard-status">Starting scan…</p>
          <p style="color:rgba(255,255,255,0.4);font-size:12.5px;margin-top:6px">This may take a minute or two.</p>
        </div>
      </div>
    </div>
    <div class="wizard-footer">
      <button type="button" class="wizard-btn wizard-btn-ghost" id="wizard-skip">Skip</button>
      <div style="display:flex;gap:10px;margin-left:auto">
        <button type="button" class="wizard-btn wizard-btn-ghost" id="wizard-back" style="display:none">Back</button>
        <button type="button" class="wizard-btn wizard-btn-primary" id="wizard-next">Next</button>
      </div>
    </div>
    <div id="wizard-error" class="error-box" role="alert" style="display:none;margin:0 22px 16px"></div>
  </div>
</div>

<!-- Auth modal for unauthenticated scan attempts -->
<div id="auth-modal" class="wizard-overlay" style="display:none" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title" aria-hidden="true">
  <div class="wizard-modal" style="max-width:420px">
    <div class="wizard-header">
      <h2 class="wizard-title" id="auth-modal-title">Sign in to scan</h2>
      <button type="button" class="wizard-close" id="auth-modal-close" aria-label="Close sign-in dialog">&times;</button>
    </div>
    <div class="wizard-body">
      <p style="color:rgba(255,255,255,0.6);font-size:14px;margin-bottom:18px">Create an account or log in to start scans and save your results.</p>
      <div id="auth-modal-error" class="error-box" role="alert" style="display:none;margin-bottom:14px"></div>
      <div class="form-row">
        <label class="form-label" for="auth-email">Email</label>
        <input class="name-input" type="email" id="auth-email" placeholder="you@example.com" required autocomplete="email">
      </div>
      <div class="form-row">
        <label class="form-label" for="auth-password">Password</label>
        <input class="name-input" type="password" id="auth-password" autocomplete="current-password" placeholder="••••••••" required>
      </div>
      <button type="button" class="wizard-btn wizard-btn-primary" id="auth-login-btn" style="width:100%;margin-top:6px">Login</button>
      <button type="button" class="wizard-btn wizard-btn-ghost" id="auth-register-btn" style="width:100%;margin-top:10px">Create account</button>
    </div>
  </div>
</div>`;

// ── Home page ─────────────────────────────────────────────────────────────────

const WIZARD_JS = `<script>
(function () {
  'use strict';
  const overlay   = document.getElementById('scan-wizard');
  const openBtn   = document.getElementById('open-wizard-btn');
  const closeBtn  = document.getElementById('wizard-close');
  const skipBtn   = document.getElementById('wizard-skip');
  const backBtn   = document.getElementById('wizard-back');
  const nextBtn   = document.getElementById('wizard-next');
  const errBox    = document.getElementById('wizard-error');
  const statusEl  = document.getElementById('wizard-status');
  let previouslyFocused = null;

  let currentStep = 1;
  const totalSteps = 5;
  const journeySteps = [];

  function renderJourneySteps() {
    const container = document.getElementById('journey-steps');
    if (!container) return;
    container.innerHTML = journeySteps.map((step, index) => {
      return '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:10px 12px">' +
        '<div><strong>' + escapeHtml(step.type) + '</strong>: ' + escapeHtml(step.value || '—') + '</div>' +
        '<button type="button" onclick="window.removeJourneyStep(' + index + ')" style="background:none;border:none;color:#f87171;cursor:pointer;font-size:12px">Remove</button>' +
      '</div>';
    }).join('');
  }

  window.removeJourneyStep = function(index) {
    journeySteps.splice(index, 1);
    renderJourneySteps();
  };

  function addJourneyStep() {
    const type = document.getElementById('journey-step-type').value;
    const value = document.getElementById('journey-step-value').value.trim();
    if (!value) return;
    journeySteps.push({ type, value });
    document.getElementById('journey-step-value').value = '';
    renderJourneySteps();
  }

  window.addJourneyStep = addJourneyStep;

  function showStep(n) {
    currentStep = n;
    document.querySelectorAll('.wizard-step').forEach(function (el) {
      el.style.display = el.dataset.step == n ? 'block' : 'none';
    });
    backBtn.style.display = n === 1 ? 'none' : 'inline-flex';
    skipBtn.style.display = n === totalSteps ? 'none' : 'inline-flex';
    nextBtn.textContent = n === totalSteps ? 'Start scan' : 'Next';
    errBox.style.display = 'none';
    if (n === 4) { try { renderSummary(); } catch(e) { console.warn('renderSummary:', e); } }
  }

  function renderSummary() {
    const name    = document.getElementById('wizard-name').value.trim();
    const url     = document.getElementById('wizard-url').value.trim();
    const pages   = document.getElementById('wizard-pages').value || '1';
    const region  = document.getElementById('wizard-region');
    const framework = document.getElementById('wizard-framework');
    const scanType = document.getElementById('wizard-scan-type');
    const scanProfile = document.getElementById('wizard-scan-profile');
    const crawlMode = document.getElementById('wizard-crawl-mode');
    const subdomainPolicy = document.getElementById('wizard-subdomain-policy');
    const interactive = document.getElementById('wizard-interactive');
    const journeys = Array.from(document.querySelectorAll('input[name="wizard-journey"]:checked')).map(input => input.value);
    const customJourneys = journeySteps.map(function(step) { return step.type + ': ' + step.value; });
    const regionText = region.options[region.selectedIndex]?.text || 'Select a scan region';
    const frameworkText = framework.options[framework.selectedIndex]?.text || 'UK GDPR / PECR';
    const scanTypeText = scanType.options[scanType.selectedIndex]?.text || 'Consent and cookie controls';
    const scanProfileText = scanProfile.options[scanProfile.selectedIndex]?.text || 'Standard assurance';
    const crawlModeText = crawlMode.options[crawlMode.selectedIndex]?.text || 'Homepage only';
    const subdomainText = subdomainPolicy.options[subdomainPolicy.selectedIndex]?.text || 'Same domain only';
    const interactiveText = interactive.checked ? 'Enabled' : 'Disabled';
    const displayName = name || 'No name provided';
    document.getElementById('wizard-summary').innerHTML =
      '<div style="display:grid;gap:8px">' +
      '<div><span style="color:rgba(255,255,255,0.45);font-size:12px;text-transform:uppercase;letter-spacing:0.05em;font-weight:600">Name</span><div style="margin-top:2px">' + escapeHtml(displayName) + '</div></div>' +
      '<div><span style="color:rgba(255,255,255,0.45);font-size:12px;text-transform:uppercase;letter-spacing:0.05em;font-weight:600">URL</span><div style="margin-top:2px;font-family:monospace;word-break:break-all">' + escapeHtml(url) + '</div></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
      '<div><span style="color:rgba(255,255,255,0.45);font-size:12px;text-transform:uppercase;letter-spacing:0.05em;font-weight:600">Pages</span><div style="margin-top:2px">' + escapeHtml(pages) + '</div></div>' +
      '<div><span style="color:rgba(255,255,255,0.45);font-size:12px;text-transform:uppercase;letter-spacing:0.05em;font-weight:600">Region</span><div style="margin-top:2px">' + escapeHtml(regionText) + '</div></div>' +
      '</div>' +
      '<div><span style="color:rgba(255,255,255,0.45);font-size:12px;text-transform:uppercase;letter-spacing:0.05em;font-weight:600">Framework</span><div style="margin-top:2px">' + escapeHtml(frameworkText) + '</div></div>' +
      '<div><span style="color:rgba(255,255,255,0.45);font-size:12px;text-transform:uppercase;letter-spacing:0.05em;font-weight:600">Scan profile</span><div style="margin-top:2px">' + escapeHtml(scanTypeText) + '</div></div>' +
      '<div><span style="color:rgba(255,255,255,0.45);font-size:12px;text-transform:uppercase;letter-spacing:0.05em;font-weight:600">Assurance depth</span><div style="margin-top:2px">' + escapeHtml(scanProfileText) + '</div></div>' +
      '<div><span style="color:rgba(255,255,255,0.45);font-size:12px;text-transform:uppercase;letter-spacing:0.05em;font-weight:600">Crawl mode</span><div style="margin-top:2px">' + escapeHtml(crawlModeText) + '</div></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
      '<div><span style="color:rgba(255,255,255,0.45);font-size:12px;text-transform:uppercase;letter-spacing:0.05em;font-weight:600">Subdomains</span><div style="margin-top:2px">' + escapeHtml(subdomainText) + '</div></div>' +
      '<div><span style="color:rgba(255,255,255,0.45);font-size:12px;text-transform:uppercase;letter-spacing:0.05em;font-weight:600">Interactive</span><div style="margin-top:2px">' + escapeHtml(interactiveText) + '</div></div>' +
      '</div>' +
      '<div><span style="color:rgba(255,255,255,0.45);font-size:12px;text-transform:uppercase;letter-spacing:0.05em;font-weight:600">Built-in journeys</span><div style="margin-top:2px">' + escapeHtml(journeys.join(', ')) + '</div></div>' +
      (customJourneys.length ? '<div><span style="color:rgba(255,255,255,0.45);font-size:12px;text-transform:uppercase;letter-spacing:0.05em;font-weight:600">Custom journeys</span><div style="margin-top:2px">' + escapeHtml(customJourneys.join(', ')) + '</div></div>' : '') +
      '</div>';
  }

  function openWizard(seed = {}) {
    previouslyFocused = document.activeElement;
    overlay.style.display = 'flex';
    overlay.setAttribute('aria-hidden', 'false');
    showStep(1);
    document.getElementById('wizard-name').value = seed.name || '';
    document.getElementById('wizard-url').value = seed.url || '';
    document.getElementById('wizard-pages').value = seed.pages || '1';
    document.getElementById('wizard-region').value = seed.region || '';
    document.getElementById('wizard-framework').value = seed.framework || 'uk-pecr';
    document.getElementById('wizard-scan-type').value = seed.scanType || 'consent';
    document.getElementById('wizard-scan-profile').value = seed.scanProfile || 'standard';
    document.getElementById('wizard-crawl-mode').value = seed.crawlMode || 'homepage';
    document.getElementById('wizard-subdomain-policy').value = seed.subdomainPolicy || 'same-domain';
    document.getElementById('wizard-interactive').checked = seed.interactive !== false;
    errBox.style.display = 'none';
    statusEl.textContent = 'Starting scan…';
    window.setTimeout(function () { document.getElementById('wizard-name').focus(); }, 0);
  }

  function syncFrameworkDefaults() {
    const framework = document.getElementById('wizard-framework').value;
    const region = document.getElementById('wizard-region');
    const scanType = document.getElementById('wizard-scan-type');
    if (framework === 'ccpa-cpra' && scanType.value === 'consent') scanType.value = 'ccpa-signals';
    if (framework === 'uk-pecr' && scanType.value === 'ccpa-signals') scanType.value = 'consent';
  }

  function closeWizard() {
    overlay.style.display = 'none';
    overlay.setAttribute('aria-hidden', 'true');
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') previouslyFocused.focus();
  }

  async   function startScan() {
    const url    = document.getElementById('wizard-url').value.trim();
    const name   = document.getElementById('wizard-name').value.trim() || null;
    const pages  = parseInt(document.getElementById('wizard-pages').value || '1', 10);
    const region = document.getElementById('wizard-region').value || null;
    const framework = document.getElementById('wizard-framework').value || 'uk-pecr';
    const scanType = document.getElementById('wizard-scan-type').value || 'consent';
    const scanProfile = document.getElementById('wizard-scan-profile').value || 'standard';
    const crawlMode = document.getElementById('wizard-crawl-mode').value || 'homepage';
    const subdomainPolicy = document.getElementById('wizard-subdomain-policy').value || 'same-domain';
    const interactive = document.getElementById('wizard-interactive').checked;
    const journeys = Array.from(document.querySelectorAll('input[name="wizard-journey"]:checked')).map(input => input.value);
    const includePatterns = document.getElementById('wizard-include-patterns').value;
    const excludePatterns = document.getElementById('wizard-exclude-patterns').value;
    const customJourneys = journeySteps.map(step => ({ type: step.type, value: step.value }));

    if (!url) {
      errBox.style.display = 'block';
      errBox.textContent = 'Please enter a website URL.';
      return;
    }
    if (!region) {
      errBox.style.display = 'block';
      errBox.textContent = 'Select the visitor region for this scan.';
      document.getElementById('wizard-region').focus();
      return;
    }
    if (!Number.isInteger(pages) || pages < 1 || pages > 50) {
      errBox.style.display = 'block';
      errBox.textContent = 'Choose between 1 and 50 pages to scan.';
      document.getElementById('wizard-pages').focus();
      return;
    }
    if (!journeys.length && !customJourneys.length) {
      errBox.style.display = 'block';
      errBox.textContent = 'Select at least one scan journey or add a custom journey.';
      return;
    }

    executeScan(url, name, pages, region, framework, scanType, scanProfile, crawlMode, journeys, includePatterns, excludePatterns, subdomainPolicy, interactive, customJourneys);
  }

  function showAuthModal() {
    previouslyFocused = document.activeElement;
    document.getElementById('auth-modal').style.display = 'flex';
    document.getElementById('auth-modal').setAttribute('aria-hidden', 'false');
    document.getElementById('auth-modal-error').style.display = 'none';
    document.getElementById('auth-email').value = '';
    document.getElementById('auth-password').value = '';
    window.setTimeout(function () { document.getElementById('auth-email').focus(); }, 0);
  }

  function hideAuthModal() {
    document.getElementById('auth-modal').style.display = 'none';
    document.getElementById('auth-modal').setAttribute('aria-hidden', 'true');
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') previouslyFocused.focus();
  }

  function trapFocus(event, dialog) {
    const focusable = Array.from(dialog.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
      .filter(function (element) { return element.getClientRects().length > 0; });
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function executeScan(url, name, pages, region, framework, scanType, scanProfile, crawlMode, journeys, includePatterns, excludePatterns, subdomainPolicy, interactive, customJourneys) {
    showStep(5);
    nextBtn.disabled = true;
    skipBtn.disabled = true;
    backBtn.disabled = true;

    try {
      const r = await fetch('/scan', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, name, maxPages: pages, region, framework, scanType, scanProfile, crawlMode, journeys, includePatterns, excludePatterns, subdomainPolicy, interactive, customJourneys }),
      });
      const data = await r.json();
      if (data.error) {
        showStep(2);
        errBox.style.display = 'block';
        errBox.textContent = r.status === 401
          ? 'Your session has expired. Please sign in again and retry the scan.'
          : data.error;
        nextBtn.disabled = false;
        skipBtn.disabled = false;
        backBtn.disabled = false;
        return;
      }
      window.location.href = '/scan/' + data.id;
    } catch (err) {
      showStep(2);
      errBox.style.display = 'block';
      errBox.textContent = 'Could not reach the server: ' + err.message;
      nextBtn.disabled = false;
      skipBtn.disabled = false;
      backBtn.disabled = false;
    }
  }

  async function handleAuthLogin() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const errBox = document.getElementById('auth-modal-error');

    if (!email || !password) {
      errBox.style.display = 'block';
      errBox.textContent = 'Please enter email and password.';
      return;
    }

    try {
      const r = await fetch('/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await r.json();
      if (data.error) {
        errBox.style.display = 'block';
        errBox.textContent = data.error;
        return;
      }
      hideAuthModal();
      location.reload();
    } catch (err) {
      errBox.style.display = 'block';
      errBox.textContent = 'Could not reach the server.';
    }
  }

  async function handleAuthRegister() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const errBox = document.getElementById('auth-modal-error');

    if (!email || !password) {
      errBox.style.display = 'block';
      errBox.textContent = 'Please enter email and password.';
      return;
    }
    if (password.length < 6) {
      errBox.style.display = 'block';
      errBox.textContent = 'Password must be at least 6 characters.';
      return;
    }

    try {
      const r = await fetch('/register', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await r.json();
      if (data.error) {
        errBox.style.display = 'block';
        errBox.textContent = data.error;
        return;
      }
      hideAuthModal();
      location.reload();
    } catch (err) {
      errBox.style.display = 'block';
      errBox.textContent = 'Could not reach the server.';
    }
  }

  if (openBtn) {
    openBtn.addEventListener('click', function () {
      const isAuthenticated = document.getElementById('main') && document.getElementById('main').dataset.authenticated === 'true';
      if (isAuthenticated) openWizard();
      else showAuthModal();
    });
  }
  document.getElementById('wizard-framework').addEventListener('change', syncFrameworkDefaults);
  const historySearch = document.getElementById('history-search');
  const historySeverity = document.getElementById('history-severity');
  const historyRegion = document.getElementById('history-region');
  const historyDate = document.getElementById('history-date');
  const historyCards = Array.from(document.querySelectorAll('#history-list .scan-card'));
  const historyCount = document.getElementById('history-filter-status');
  const historyEmpty = document.getElementById('history-empty-filtered');
  function filterHistory() {
    if (!historyCards.length) return;
    const query = (historySearch.value || '').trim().toLowerCase();
    const severity = historySeverity.value;
    const region = historyRegion.value;
    const days = Number(historyDate.value || 0);
    const cutoff = days ? Date.now() - (days * 86400000) : 0;
    let visible = 0;
    historyCards.forEach(function (card) {
      const matches = (!query || card.textContent.toLowerCase().includes(query))
        && (!severity || card.dataset.severity === severity)
        && (!region || card.dataset.region === region)
        && (!cutoff || new Date(card.dataset.scannedAt).getTime() >= cutoff);
      card.hidden = !matches;
      if (matches) visible += 1;
    });
    historyCount.textContent = 'Showing ' + visible + ' of ' + historyCards.length + ' scans';
    historyEmpty.style.display = visible ? 'none' : 'block';
  }
  [historySearch, historySeverity, historyRegion, historyDate].forEach(function (control) {
    if (control) control.addEventListener('input', filterHistory);
    if (control) control.addEventListener('change', filterHistory);
  });
  filterHistory();
  closeBtn.addEventListener('click', closeWizard);
  skipBtn.addEventListener('click', function () {
    if (currentStep < totalSteps) showStep(currentStep + 1);
  });
  backBtn.addEventListener('click', function () {
    if (currentStep > 1) showStep(currentStep - 1);
  });
  nextBtn.addEventListener('click', function () {
    if (currentStep === totalSteps) {
      startScan();
    } else {
      if (currentStep === 2) {
        const url = document.getElementById('wizard-url').value.trim();
        try {
          const parsed = new URL(url);
          if (!/^https?:$/.test(parsed.protocol)) throw new Error('unsupported protocol');
        } catch (_) {
          errBox.style.display = 'block';
          errBox.textContent = 'Enter a valid website URL beginning with http:// or https://.';
          document.getElementById('wizard-url').focus();
          return;
        }
      }
        showStep(currentStep + 1);
    }
  });
  document.getElementById('journey-add-step').addEventListener('click', addJourneyStep);
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeWizard();
  });
  document.addEventListener('keydown', function (e) {
    const authModal = document.getElementById('auth-modal');
    if (e.key === 'Tab') {
      if (overlay.style.display !== 'none') trapFocus(e, overlay);
      else if (authModal.style.display !== 'none') trapFocus(e, authModal);
      return;
    }
    if (e.key === 'Escape') {
      if (overlay.style.display !== 'none') closeWizard();
      else if (authModal.style.display !== 'none') hideAuthModal();
    }
  });

  // Auth modal handlers
  document.getElementById('auth-modal-close').addEventListener('click', hideAuthModal);
  document.getElementById('auth-login-btn').addEventListener('click', handleAuthLogin);
  document.getElementById('auth-register-btn').addEventListener('click', handleAuthRegister);
  document.getElementById('auth-modal').addEventListener('click', function (e) {
    if (e.target === document.getElementById('auth-modal')) hideAuthModal();
  });
})();
</script>`;

/* ── Shared marketing shell helpers ──────────────────────────────── */
function mpNav(activePage) {
  const links = [
    { href: '/#features', label: 'Features', key: 'features' },
    { href: '/#how-it-works', label: 'How it works', key: 'how-it-works' },
    { href: '/#pricing', label: 'Pricing', key: 'pricing' },
    { href: '/blog', label: 'Blog', key: 'blog' },
    { href: '/trainings', label: 'Training', key: 'trainings' },
  ];
  return `<nav class="mp-nav" aria-label="Main navigation">
    <div class="mp-inner mp-nav-inner">
      <a class="mp-nav-logo" href="/">
        <span class="mp-nav-logo-mark">🛡</span>
        SPIDAC
      </a>
      <div class="mp-nav-links">
        ${links.map(l => `<a class="mp-nav-link${l.key === activePage ? ' mp-nav-link--active' : ''}" href="${l.href}">${l.label}</a>`).join('\n        ')}
      </div>
      <div class="mp-nav-actions">
        <a class="mp-nav-signin" href="/login">Sign in</a>
        <a class="mp-nav-cta" href="/register">Start free</a>
      </div>
    </div>
  </nav>`;
}

function mpFooter() {
  return `<footer class="mp-footer" aria-label="Site footer">
    <div class="mp-inner">
      <div class="mp-footer-grid">
        <div class="mp-footer-brand">
          <a class="mp-footer-logo" href="/">
            <span style="width:28px;height:28px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:7px;display:grid;place-items:center;font-size:13px;flex-shrink:0">🛡</span>
            SPIDAC
          </a>
          <p>Evidence-led privacy assurance for websites. Test consent, track remediation, prove improvement.</p>
        </div>
        <div class="mp-footer-col">
          <h4>Product</h4>
          <ul>
            <li><a href="/#features">Features</a></li>
            <li><a href="/#how-it-works">How it works</a></li>
            <li><a href="/#pricing">Pricing</a></li>
            <li><a href="/register">Start free</a></li>
            <li><a href="/login">Sign in</a></li>
          </ul>
        </div>
        <div class="mp-footer-col">
          <h4>Resources</h4>
          <ul>
            <li><a href="/blog">Blog</a></li>
            <li><a href="/trainings">Training</a></li>
            <li><a href="/security">Security</a></li>
          </ul>
        </div>
        <div class="mp-footer-col">
          <h4>Legal</h4>
          <ul>
            <li><a href="/legal">Legal overview</a></li>
            <li><a href="/privacy">Privacy policy</a></li>
            <li><a href="/terms">Terms of service</a></li>
            <li><a href="/security">Security</a></li>
          </ul>
        </div>
      </div>
      <div class="mp-footer-bottom">
        <span>© ${new Date().getFullYear()} SPIDAC - Digital Tech Assurance. All rights reserved.</span>
        <div class="mp-footer-legal">
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="/security">Security</a>
        </div>
      </div>
    </div>
  </footer>`;
}

function mpShell(title, description, pageBody, activePage, extraCss = '') {
  const sharedCss = `
/* ── Reset & base ─────────────────────────────────────────────────── */
*,*::before,*::after{box-sizing:border-box}
body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;background:#fff}
.mp{background:#fff;color:#0f172a}
.mp-inner{max-width:1160px;margin:0 auto;padding:0 24px}
/* Nav */
.mp-nav{position:sticky;top:0;z-index:100;background:rgba(255,255,255,.92);backdrop-filter:blur(18px);border-bottom:1px solid #e2e8f0}
.mp-nav-inner{display:flex;align-items:center;gap:32px;height:62px}
.mp-nav-logo{display:flex;align-items:center;gap:10px;font-weight:800;font-size:15px;letter-spacing:-.03em;color:#0f172a;text-decoration:none;flex-shrink:0}
.mp-nav-logo-mark{width:34px;height:34px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:10px;display:grid;place-items:center;font-size:16px;flex-shrink:0}
.mp-nav-links{display:flex;gap:4px;margin-left:8px}
.mp-nav-link{padding:6px 13px;border-radius:7px;font-size:14px;font-weight:600;color:#475569;text-decoration:none;transition:background .12s,color .12s}
.mp-nav-link:hover{background:#f1f5f9;color:#0f172a}
.mp-nav-link--active{color:#6366f1;background:#eef2ff}
.mp-nav-actions{margin-left:auto;display:flex;align-items:center;gap:10px}
.mp-nav-signin{padding:7px 16px;border-radius:8px;font-size:14px;font-weight:700;color:#475569;text-decoration:none}
.mp-nav-signin:hover{color:#0f172a}
.mp-nav-cta{padding:8px 18px;border-radius:8px;font-size:14px;font-weight:700;background:#6366f1;color:#fff;text-decoration:none;box-shadow:0 1px 3px rgba(99,102,241,.3)}
.mp-nav-cta:hover{background:#4f46e5;color:#fff}
@media(max-width:760px){.mp-nav-links{display:none}}
/* Footer */
.mp-footer{background:#0f172a;color:rgba(255,255,255,.45);padding:clamp(48px,6vw,72px) 0 32px}
.mp-footer-grid{display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr;gap:32px;margin-bottom:48px}
.mp-footer-brand{font-size:14px;line-height:1.75}
.mp-footer-logo{display:flex;align-items:center;gap:9px;font-weight:800;font-size:15px;color:#fff;text-decoration:none;margin-bottom:12px}
.mp-footer-col h4{font-size:12px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:rgba(255,255,255,.32);margin:0 0 14px}
.mp-footer-col ul{list-style:none;padding:0;margin:0;display:grid;gap:9px}
.mp-footer-col li a{font-size:13px;color:rgba(255,255,255,.45);text-decoration:none;transition:color .12s}
.mp-footer-col li a:hover{color:#fff}
.mp-footer-bottom{padding-top:24px;border-top:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;font-size:12px}
.mp-footer-legal{display:flex;gap:18px;flex-wrap:wrap}
.mp-footer-legal a{color:rgba(255,255,255,.35);text-decoration:none}
.mp-footer-legal a:hover{color:#fff}
@media(max-width:1000px){.mp-footer-grid{grid-template-columns:1fr 1fr}}
@media(max-width:540px){.mp-footer-grid{grid-template-columns:1fr}}
/* Common buttons */
.mp-btn-primary{display:inline-flex;align-items:center;gap:8px;padding:13px 26px;border-radius:9px;font-size:15px;font-weight:700;background:#6366f1;color:#fff;text-decoration:none;transition:background .15s,transform .1s}
.mp-btn-primary:hover{background:#4f46e5;transform:translateY(-1px)}
.mp-btn-secondary{display:inline-flex;align-items:center;gap:8px;padding:12px 24px;border-radius:9px;font-size:15px;font-weight:700;background:rgba(255,255,255,.1);color:#fff;text-decoration:none;border:1px solid rgba(255,255,255,.2);transition:background .15s}
.mp-btn-secondary:hover{background:rgba(255,255,255,.18)}
.mp-btn-outline{display:inline-flex;align-items:center;gap:8px;padding:12px 22px;border-radius:9px;font-size:15px;font-weight:700;color:#6366f1;text-decoration:none;border:1.5px solid #c7d2fe;transition:background .15s}
.mp-btn-outline:hover{background:#eef2ff}
.mp-btn-white{display:inline-flex;align-items:center;padding:13px 26px;border-radius:9px;font-size:15px;font-weight:700;background:#fff;color:#1e1b4b;text-decoration:none;transition:opacity .15s}
.mp-btn-white:hover{opacity:.9}
.mp-btn-ghost{display:inline-flex;align-items:center;padding:12px 24px;border-radius:9px;font-size:15px;font-weight:700;color:#fff;text-decoration:none;border:1.5px solid rgba(255,255,255,.3);transition:background .15s}
.mp-btn-ghost:hover{background:rgba(255,255,255,.1)}
/* Scroll-reveal */
@keyframes mp-fade-up{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:none}}
@keyframes mp-fade-in{from{opacity:0}to{opacity:1}}
@keyframes mp-scale-in{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:scale(1)}}
.mp-reveal{opacity:0}
.mp-reveal.mp-visible{animation:mp-fade-up .55s cubic-bezier(.22,1,.36,1) both}
.mp-reveal-fade.mp-visible{animation:mp-fade-in .5s ease both}
.mp-reveal-scale.mp-visible{animation:mp-scale-in .5s cubic-bezier(.22,1,.36,1) both}
.mp-reveal:nth-child(1){animation-delay:.05s}.mp-reveal:nth-child(2){animation-delay:.13s}.mp-reveal:nth-child(3){animation-delay:.21s}
.mp-reveal:nth-child(4){animation-delay:.29s}.mp-reveal:nth-child(5){animation-delay:.37s}.mp-reveal:nth-child(6){animation-delay:.43s}
@media(prefers-reduced-motion:reduce){.mp-reveal,.mp-reveal-fade,.mp-reveal-scale{animation:none;opacity:1}}
`;
  const sharedJs = `
<script>
(function(){
  if(!('IntersectionObserver' in window)){document.querySelectorAll('.mp-reveal,.mp-reveal-fade,.mp-reveal-scale').forEach(function(el){el.classList.add('mp-visible');});return;}
  var io=new IntersectionObserver(function(entries){entries.forEach(function(e){if(e.isIntersecting){e.target.classList.add('mp-visible');io.unobserve(e.target);}});},{threshold:0.12});
  document.querySelectorAll('.mp-reveal,.mp-reveal-fade,.mp-reveal-scale').forEach(function(el){io.observe(el);});
})();
document.querySelectorAll('a[href^="#"]').forEach(function(a){
  a.addEventListener('click',function(e){var id=a.getAttribute('href').slice(1);var el=document.getElementById(id);if(!el)return;e.preventDefault();el.scrollIntoView({behavior:'smooth',block:'start'});});
});
function switchUsecase(btn,panelId){document.querySelectorAll('.mp-usecase-btn').forEach(function(b){b.classList.remove('mp-usecase-btn--active');b.setAttribute('aria-selected','false');});document.querySelectorAll('.mp-usecase-panel').forEach(function(p){p.classList.remove('mp-usecase-panel--active');});btn.classList.add('mp-usecase-btn--active');btn.setAttribute('aria-selected','true');var panel=document.getElementById(panelId);if(panel)panel.classList.add('mp-usecase-panel--active');}
function toggleFaq(btn){var item=btn.closest('.mp-faq-item');var isOpen=item.classList.contains('open');document.querySelectorAll('.mp-faq-item.open').forEach(function(el){el.classList.remove('open');});if(!isOpen)item.classList.add('open');}
</script>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} | SPIDAC</title>
<meta name="description" content="${esc(description)}">
<style>${sharedCss}${extraCss}</style>
</head>
<body>
<div class="mp">
${mpNav(activePage)}
${pageBody}
${mpFooter()}
</div>
${sharedJs}
</body>
</html>`;
}

function marketingPage() {
  const css = `
/* ── Hero ─────────────────────────────────────────────────────────── */
.mp-hero{background:linear-gradient(160deg,#0f172a 0%,#1e1b4b 60%,#312e81 100%);color:#fff;padding:clamp(80px,12vw,144px) 0 clamp(64px,9vw,110px);position:relative;overflow:hidden}
.mp-hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 80% 60% at 70% 50%,rgba(139,92,246,.18) 0%,transparent 70%);pointer-events:none}
.mp-hero-grid{display:grid;grid-template-columns:1fr 1fr;gap:clamp(40px,6vw,80px);align-items:center;position:relative;z-index:1}
.mp-hero-eyebrow{display:inline-flex;align-items:center;gap:8px;background:rgba(99,102,241,.2);border:1px solid rgba(129,140,248,.3);border-radius:100px;padding:5px 14px;font-size:12px;font-weight:700;color:#a5b4fc;letter-spacing:.06em;text-transform:uppercase;margin-bottom:20px}
.mp-hero-eyebrow::before{content:'';width:7px;height:7px;border-radius:50%;background:#34d399;flex-shrink:0}
.mp-hero h1{font-size:clamp(38px,5.5vw,66px);line-height:1.05;letter-spacing:-.05em;font-weight:800;margin:0 0 20px}
.mp-hero h1 em{color:#a5b4fc;font-style:normal}
.mp-hero-sub{font-size:18px;line-height:1.7;color:rgba(255,255,255,.65);margin:0 0 32px;max-width:520px}
.mp-hero-actions{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:36px}
.mp-hero-proof{display:flex;flex-wrap:wrap;gap:18px 28px}
.mp-hero-proof-item{display:flex;align-items:center;gap:7px;font-size:13px;color:rgba(255,255,255,.5)}
.mp-hero-proof-item::before{content:'✓';color:#34d399;font-weight:800;font-size:14px}

/* ── Hero visual (mock report card) ──────────────────────────────── */
.mp-hero-visual{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:28px;backdrop-filter:blur(12px)}
.mp-mock-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}
.mp-mock-url{font-family:monospace;font-size:13px;color:rgba(255,255,255,.6);background:rgba(255,255,255,.07);padding:5px 11px;border-radius:6px}
.mp-mock-badge{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:5px;font-size:11px;font-weight:700}
.mp-mock-badge--pass{background:rgba(52,211,153,.15);color:#6ee7b7;border:1px solid rgba(52,211,153,.2)}
.mp-mock-badge--fail{background:rgba(248,113,113,.15);color:#fca5a5;border:1px solid rgba(248,113,113,.2)}
.mp-mock-assurance{display:grid;gap:9px;margin-bottom:20px}
.mp-mock-row{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:9px;font-size:13px;color:rgba(255,255,255,.72)}
.mp-mock-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.mp-mock-stat{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:9px;padding:12px 14px;text-align:center}
.mp-mock-stat strong{display:block;font-size:22px;font-weight:800;color:#fff;line-height:1}
.mp-mock-stat span{display:block;font-size:11px;color:rgba(255,255,255,.45);margin-top:4px;font-weight:600;text-transform:uppercase;letter-spacing:.04em}

/* ── Logos band ───────────────────────────────────────────────────── */
.mp-logos{background:#f8fafc;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;padding:28px 0}
.mp-logos-label{text-align:center;font-size:12px;font-weight:700;color:#94a3b8;letter-spacing:.07em;text-transform:uppercase;margin-bottom:20px}
.mp-logos-row{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:12px 32px}
.mp-logo-pill{padding:7px 18px;border-radius:7px;border:1px solid #e2e8f0;background:#fff;font-size:13px;font-weight:700;color:#64748b;letter-spacing:-.01em}

/* ── Sections ─────────────────────────────────────────────────────── */
.mp-section{padding:clamp(72px,9vw,112px) 0}
.mp-section--light{background:#f8fafc}
.mp-section--dark{background:#0f172a;color:#fff}
.mp-section--indigo{background:#eef2ff}
.mp-eyebrow{display:inline-block;font-size:12px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#6366f1;margin-bottom:12px}
.mp-section--dark .mp-eyebrow{color:#a5b4fc}
.mp-h2{font-size:clamp(28px,3.8vw,44px);line-height:1.1;letter-spacing:-.045em;font-weight:800;margin:0 0 14px}
.mp-lead{font-size:17px;line-height:1.7;color:#64748b;max-width:560px;margin:0}
.mp-section--dark .mp-lead{color:rgba(255,255,255,.55)}
.mp-section-head{text-align:center;margin-bottom:clamp(40px,5vw,64px)}
.mp-section-head .mp-lead{margin:0 auto}

/* ── 3-col feature cards ──────────────────────────────────────────── */
.mp-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}
.mp-card{padding:28px;border:1px solid #e2e8f0;border-radius:14px;background:#fff;transition:box-shadow .2s,transform .2s}
.mp-card:hover{box-shadow:0 16px 40px rgba(15,23,42,.09);transform:translateY(-2px)}
.mp-card-icon{width:44px;height:44px;border-radius:11px;display:grid;place-items:center;margin-bottom:20px;font-size:22px}
.mp-card-icon--indigo{background:#eef2ff}
.mp-card-icon--green{background:#ecfdf5}
.mp-card-icon--amber{background:#fffbeb}
.mp-card-icon--rose{background:#fff1f2}
.mp-card-icon--blue{background:#eff6ff}
.mp-card-icon--purple{background:#faf5ff}
.mp-card h3{font-size:17px;font-weight:700;letter-spacing:-.025em;margin:0 0 9px}
.mp-card p{font-size:14px;color:#64748b;line-height:1.65;margin:0}

/* ── 4-col stat band ──────────────────────────────────────────────── */
.mp-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:#e2e8f0;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden}
.mp-stat{background:#fff;padding:28px 24px;text-align:center}
.mp-stat strong{display:block;font-size:clamp(32px,4vw,48px);font-weight:800;letter-spacing:-.055em;color:#6366f1;line-height:1}
.mp-stat span{display:block;font-size:13px;color:#64748b;margin-top:6px;font-weight:600}

/* ── Split layout ─────────────────────────────────────────────────── */
.mp-split{display:grid;grid-template-columns:1fr 1fr;gap:clamp(48px,7vw,96px);align-items:center}
.mp-split--rev .mp-split-visual{order:-1}
.mp-split-text .mp-h2{text-align:left}
.mp-split-list{list-style:none;padding:0;margin:24px 0 0;display:grid;gap:14px}
.mp-split-list li{display:flex;gap:12px;font-size:15px;color:#475569;line-height:1.55}
.mp-split-list li::before{content:'';width:22px;height:22px;border-radius:6px;background:#eef2ff;display:flex;align-items:center;justify-content:center;flex-shrink:0;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%236366f1'%3E%3Cpath fill-rule='evenodd' d='M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z' clip-rule='evenodd'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:center;background-size:13px;margin-top:1px}
.mp-split-actions{margin-top:28px;display:flex;gap:12px;flex-wrap:wrap}
.mp-btn-outline{display:inline-flex;align-items:center;padding:11px 20px;border-radius:8px;font-size:14px;font-weight:700;border:2px solid #6366f1;color:#6366f1;text-decoration:none;transition:background .15s}
.mp-btn-outline:hover{background:#eef2ff}

/* ── Product mock panels ──────────────────────────────────────────── */
.mp-product-panel{background:#0f172a;border-radius:16px;padding:0;overflow:hidden;box-shadow:0 32px 60px rgba(15,23,42,.25)}
.mp-product-topbar{background:#1e293b;padding:12px 18px;display:flex;align-items:center;gap:8px}
.mp-product-dot{width:11px;height:11px;border-radius:50%;flex-shrink:0}
.mp-product-tabbar{display:flex;gap:2px;padding:10px 16px 0;background:#1e293b}
.mp-product-tab{padding:7px 14px;border-radius:8px 8px 0 0;font-size:12px;font-weight:700;color:rgba(255,255,255,.4)}
.mp-product-tab--active{background:#0f172a;color:#a5b4fc}
.mp-product-body{padding:20px}
.mp-product-row{display:flex;align-items:center;justify-content:space-between;padding:11px 14px;border-radius:9px;margin-bottom:7px;font-size:13px}
.mp-product-row--fail{background:rgba(248,113,113,.12);border:1px solid rgba(248,113,113,.2);color:#fca5a5}
.mp-product-row--pass{background:rgba(52,211,153,.1);border:1px solid rgba(52,211,153,.18);color:#6ee7b7}
.mp-product-row--review{background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.2);color:#fcd34d}
.mp-product-row--neutral{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:rgba(255,255,255,.6)}
.mp-product-label{font-weight:600}
.mp-product-badge{font-size:11px;font-weight:700;padding:3px 8px;border-radius:4px}
.mp-product-badge--fail{background:rgba(248,113,113,.3);color:#fca5a5}
.mp-product-badge--pass{background:rgba(52,211,153,.25);color:#6ee7b7}
.mp-product-badge--review{background:rgba(251,191,36,.25);color:#fcd34d}

/* ── Journey flow visual ──────────────────────────────────────────── */
.mp-journey-visual{display:grid;gap:10px}
.mp-journey-step{display:flex;align-items:flex-start;gap:14px;padding:16px;background:#fff;border:1px solid #e2e8f0;border-radius:12px}
.mp-journey-num{width:30px;height:30px;border-radius:8px;background:#6366f1;color:#fff;font-size:12px;font-weight:800;display:grid;place-items:center;flex-shrink:0}
.mp-journey-step h4{font-size:14px;font-weight:700;margin:0 0 3px;color:#0f172a}
.mp-journey-step p{font-size:13px;color:#64748b;margin:0;line-height:1.5}

/* ── Testimonials ─────────────────────────────────────────────────── */
.mp-testimonials{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}
.mp-testimonial{padding:28px;border:1px solid #e2e8f0;border-radius:14px;background:#fff}
.mp-testimonial-quote{font-size:15px;line-height:1.7;color:#334155;margin:0 0 20px}
.mp-testimonial-quote::before{content:'\u201C';font-size:32px;color:#c7d2fe;line-height:0.5;vertical-align:-.3em;margin-right:4px}
.mp-testimonial-author{display:flex;align-items:center;gap:11px}
.mp-testimonial-avatar{width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-weight:800;font-size:14px;display:grid;place-items:center;flex-shrink:0}
.mp-testimonial-name{font-size:14px;font-weight:700;color:#0f172a}
.mp-testimonial-role{font-size:12px;color:#94a3b8}

/* ── Use-case tabs ────────────────────────────────────────────────── */
.mp-usecases{display:grid;grid-template-columns:240px 1fr;gap:24px;align-items:start}
.mp-usecase-nav{display:grid;gap:4px}
.mp-usecase-btn{display:flex;align-items:center;gap:10px;padding:12px 16px;border-radius:10px;border:none;background:transparent;font-size:14px;font-weight:600;color:#64748b;cursor:pointer;text-align:left;font-family:inherit;transition:background .15s,color .15s;width:100%}
.mp-usecase-btn:hover{background:#f1f5f9;color:#0f172a}
.mp-usecase-btn--active{background:#eef2ff;color:#4f46e5;font-weight:700}
.mp-usecase-btn-icon{width:32px;height:32px;border-radius:8px;background:#e2e8f0;display:grid;place-items:center;font-size:15px;flex-shrink:0}
.mp-usecase-btn--active .mp-usecase-btn-icon{background:#c7d2fe}
.mp-usecase-panel{display:none}
.mp-usecase-panel--active{display:block}
.mp-usecase-content{padding:28px;background:#fff;border:1px solid #e2e8f0;border-radius:14px}
.mp-usecase-content h3{font-size:22px;font-weight:800;letter-spacing:-.03em;margin:0 0 10px}
.mp-usecase-content p{font-size:15px;color:#64748b;line-height:1.7;margin:0 0 20px}
.mp-usecase-tags{display:flex;flex-wrap:wrap;gap:8px}
.mp-usecase-tag{padding:5px 12px;border-radius:6px;background:#eef2ff;color:#4338ca;font-size:12px;font-weight:700}

/* ── FAQ ──────────────────────────────────────────────────────────── */
.mp-faq{display:grid;gap:12px;max-width:780px;margin:0 auto}
.mp-faq-item{border:1px solid #e2e8f0;border-radius:12px;overflow:hidden}
.mp-faq-q{width:100%;background:#fff;border:none;padding:18px 22px;text-align:left;font-size:15px;font-weight:700;color:#0f172a;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:16px;font-family:inherit;line-height:1.4}
.mp-faq-q::after{content:'+';font-size:22px;font-weight:400;color:#94a3b8;flex-shrink:0;transition:transform .2s}
.mp-faq-item.open .mp-faq-q::after{transform:rotate(45deg)}
.mp-faq-a{display:none;padding:0 22px 18px;font-size:14px;color:#64748b;line-height:1.75}
.mp-faq-item.open .mp-faq-a{display:block}

/* ── Pricing ──────────────────────────────────────────────────────── */
.mp-pricing{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;align-items:start}
.mp-plan{padding:28px;border:1px solid #e2e8f0;border-radius:16px;background:#fff}
.mp-plan--featured{border-color:#6366f1;border-width:2px;box-shadow:0 16px 40px rgba(99,102,241,.14)}
.mp-plan-badge{display:inline-block;padding:3px 10px;border-radius:5px;background:#eef2ff;color:#4338ca;font-size:11px;font-weight:800;letter-spacing:.04em;margin-bottom:16px}
.mp-plan h3{font-size:20px;font-weight:800;letter-spacing:-.03em;margin:0 0 6px}
.mp-plan-desc{font-size:13px;color:#64748b;margin:0 0 22px}
.mp-plan-price{font-size:38px;font-weight:800;letter-spacing:-.05em;color:#0f172a;margin:0 0 4px;line-height:1}
.mp-plan-price sup{font-size:18px;font-weight:700;vertical-align:super;line-height:0}
.mp-plan-price-note{font-size:12px;color:#94a3b8;margin:0 0 24px}
.mp-plan-cta{display:block;width:100%;padding:12px;border-radius:9px;text-align:center;font-size:14px;font-weight:700;text-decoration:none;margin-bottom:24px;transition:background .15s}
.mp-plan--featured .mp-plan-cta{background:#6366f1;color:#fff}
.mp-plan--featured .mp-plan-cta:hover{background:#4f46e5}
.mp-plan:not(.mp-plan--featured) .mp-plan-cta{border:2px solid #e2e8f0;color:#475569}
.mp-plan:not(.mp-plan--featured) .mp-plan-cta:hover{border-color:#6366f1;color:#6366f1}
.mp-plan-features{list-style:none;padding:0;margin:0;display:grid;gap:10px}
.mp-plan-features li{font-size:13.5px;color:#475569;display:flex;gap:9px;align-items:flex-start;line-height:1.5}
.mp-plan-features li::before{content:'✓';color:#059669;font-weight:800;font-size:13px;flex-shrink:0;margin-top:1px}
.mp-plan-features li.mp-plan-feature--no::before{content:'—';color:#cbd5e1}

/* ── Final CTA ────────────────────────────────────────────────────── */
.mp-final-cta{background:linear-gradient(135deg,#312e81 0%,#4f46e5 50%,#6366f1 100%);color:#fff;text-align:center;padding:clamp(72px,9vw,108px) 0;position:relative;overflow:hidden}
.mp-final-cta::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 60% 80% at 50% 110%,rgba(165,180,252,.18) 0%,transparent 70%);pointer-events:none}
.mp-final-cta h2{font-size:clamp(30px,5vw,54px);letter-spacing:-.05em;font-weight:800;margin:0 0 16px;position:relative}
.mp-final-cta p{font-size:18px;color:rgba(255,255,255,.65);margin:0 0 36px;position:relative}
.mp-final-cta-actions{display:flex;justify-content:center;gap:12px;flex-wrap:wrap;position:relative}
.mp-btn-white{display:inline-flex;align-items:center;padding:13px 26px;border-radius:9px;font-size:15px;font-weight:700;background:#fff;color:#4f46e5;text-decoration:none;box-shadow:0 4px 14px rgba(0,0,0,.15);transition:transform .1s}
.mp-btn-white:hover{color:#312e81;transform:translateY(-1px)}
.mp-btn-ghost{display:inline-flex;align-items:center;padding:13px 24px;border-radius:9px;font-size:15px;font-weight:700;border:1.5px solid rgba(255,255,255,.3);color:rgba(255,255,255,.88);text-decoration:none;transition:background .15s}
.mp-btn-ghost:hover{background:rgba(255,255,255,.1);color:#fff}

/* ── Responsive ───────────────────────────────────────────────────── */
@media(max-width:1024px){
  .mp-hero-grid{grid-template-columns:1fr;gap:48px}
  .mp-hero-visual{display:none}
  .mp-split{grid-template-columns:1fr;gap:40px}
  .mp-split--rev .mp-split-visual{order:0}
  .mp-usecases{grid-template-columns:1fr}
  .mp-usecase-nav{display:flex;flex-wrap:wrap;gap:8px}
  .mp-usecase-btn{width:auto}
}
@media(max-width:760px){
  .mp-cards{grid-template-columns:1fr}
  .mp-stats{grid-template-columns:repeat(2,1fr)}
  .mp-testimonials{grid-template-columns:1fr}
  .mp-pricing{grid-template-columns:1fr}
  .mp-final-cta-actions{flex-direction:column;align-items:center}
}
/* Hero animations */
.mp-hero-visual{animation:mp-scale-in .7s .15s cubic-bezier(.22,1,.36,1) both}
.mp-hero h1{animation:mp-fade-up .6s .05s cubic-bezier(.22,1,.36,1) both}
.mp-hero-eyebrow{animation:mp-fade-up .5s cubic-bezier(.22,1,.36,1) both}
.mp-hero-sub{animation:mp-fade-up .55s .1s cubic-bezier(.22,1,.36,1) both}
.mp-hero-actions{animation:mp-fade-up .55s .18s cubic-bezier(.22,1,.36,1) both}
.mp-hero-proof{animation:mp-fade-up .5s .26s cubic-bezier(.22,1,.36,1) both}
.mp-reveal:nth-child(7){animation-delay:.49s}
.mp-reveal:nth-child(8){animation-delay:.54s}
.mp-reveal:nth-child(9){animation-delay:.59s}
@keyframes mp-pulse-btn{0%,100%{box-shadow:0 0 0 0 rgba(99,102,241,.4)}60%{box-shadow:0 0 0 10px rgba(99,102,241,0)}}
.mp-btn-primary{animation:mp-pulse-btn 2.8s 1.5s ease-in-out infinite}
@media(prefers-reduced-motion:reduce){.mp-hero-visual,.mp-hero h1,.mp-hero-eyebrow,.mp-hero-sub,.mp-hero-actions,.mp-hero-proof{animation:none;opacity:1}.mp-btn-primary{animation:none}}
`;

  const body = `
  <!-- ── Hero ─────────────────────────────────────────────────────── -->
  <section class="mp-hero" aria-labelledby="hero-heading">
    <div class="mp-inner mp-hero-grid">
      <div>
        <div class="mp-hero-eyebrow">Privacy assurance platform</div>
        <h1 id="hero-heading">Know what your consent experience <em>actually does</em></h1>
        <p class="mp-hero-sub">SPIDAC simulates real visitor journeys: before consent, after accept, after reject. See exactly what fires, what persists, and what needs fixing. Evidence-led, not an automated certification.</p>
        <div class="mp-hero-actions">
          <a class="mp-btn-primary" href="/register">Start free, no credit card</a>
          <a class="mp-btn-secondary" href="#how-it-works">See how it works</a>
        </div>
        <div class="mp-hero-proof">
          <span class="mp-hero-proof-item">UK GDPR · PECR · CCPA · CPRA</span>
          <span class="mp-hero-proof-item">10 visitor regions</span>
          <span class="mp-hero-proof-item">Real browser evidence</span>
          <span class="mp-hero-proof-item">Private workspace</span>
        </div>
      </div>
      <div class="mp-hero-visual" aria-hidden="true">
        <div class="mp-mock-header">
          <span class="mp-mock-url">example.com · UK / GDPR</span>
          <span class="mp-mock-badge mp-mock-badge--fail">2 Critical</span>
        </div>
        <div class="mp-mock-assurance">
          <div class="mp-mock-row"><span>Consent gating</span><span class="mp-mock-badge mp-mock-badge--fail">Fail: 4 cookies set before consent</span></div>
          <div class="mp-mock-row"><span>Reject behaviour</span><span class="mp-mock-badge mp-mock-badge--pass">Pass</span></div>
          <div class="mp-mock-row"><span>Consent withdrawal</span><span class="mp-mock-badge mp-mock-badge--pass">Pass</span></div>
          <div class="mp-mock-row"><span>Privacy signals (GPC)</span><span class="mp-mock-badge mp-mock-badge--fail">Fail: signal not respected</span></div>
          <div class="mp-mock-row"><span>Scan completeness</span><span class="mp-mock-badge mp-mock-badge--pass">100%</span></div>
        </div>
        <div class="mp-mock-stats">
          <div class="mp-mock-stat"><strong>14</strong><span>Cookies found</span></div>
          <div class="mp-mock-stat"><strong>6</strong><span>3rd-party domains</span></div>
          <div class="mp-mock-stat"><strong>8</strong><span>Journeys run</span></div>
        </div>
      </div>
    </div>
  </section>

  <!-- ── Logos band ───────────────────────────────────────────────── -->
  <div class="mp-logos">
    <div class="mp-inner">
      <div class="mp-logos-label">Built for teams working under</div>
      <div class="mp-logos-row">
        <span class="mp-logo-pill">UK GDPR</span>
        <span class="mp-logo-pill">PECR</span>
        <span class="mp-logo-pill">CCPA / CPRA</span>
        <span class="mp-logo-pill">EU ePrivacy</span>
        <span class="mp-logo-pill">IAB TCF 2.x</span>
        <span class="mp-logo-pill">Google Consent Mode</span>
        <span class="mp-logo-pill">GPC Signal</span>
      </div>
    </div>
  </div>

  <!-- ── Stats band ───────────────────────────────────────────────── -->
  <section class="mp-section mp-section--light" aria-labelledby="stats-heading">
    <div class="mp-inner">
      <div class="mp-stats" role="list">
        <div class="mp-stat" role="listitem"><strong class="mp-stat-num">8</strong><span>Built-in consent journeys</span></div>
        <div class="mp-stat" role="listitem"><strong class="mp-stat-num">10</strong><span>Visitor regions tested</span></div>
        <div class="mp-stat" role="listitem"><strong class="mp-stat-num">4</strong><span>Compliance frameworks</span></div>
        <div class="mp-stat" role="listitem"><strong class="mp-stat-num">100</strong><span>Real browser evidence</span></div>
      </div>
    </div>
  </section>

  <!-- ── Feature cards ────────────────────────────────────────────── -->
  <section class="mp-section mp-section--white" id="features" aria-labelledby="features-heading">
    <div class="mp-inner">
      <div class="mp-section-head">
        <span class="mp-eyebrow">Platform capabilities</span>
        <h2 class="mp-h2" id="features-heading">Everything your team needs to test, track, and prove consent compliance</h2>
        <p class="mp-lead">From automated journey scanning to remediation tracking and scheduled monitoring. One platform, one evidence trail.</p>
      </div>
      <div class="mp-cards">
        <article class="mp-card mp-reveal">
          <div class="mp-card-icon mp-card-icon--indigo">🔍</div>
          <h3>Consent journey simulation</h3>
          <p>Simulate no-interaction, accept-all, reject-all, withdraw-consent, and GPC comparison in a real browser. Compare what fires in each state.</p>
        </article>
        <article class="mp-card mp-reveal">
          <div class="mp-card-icon mp-card-icon--green">🍪</div>
          <h3>Cookie classification & inventory</h3>
          <p>Every cookie gets a provider, category, confidence level, and matching rule. Unknown cookies are flagged for manual review with investigation hints.</p>
        </article>
        <article class="mp-card mp-reveal">
          <div class="mp-card-icon mp-card-icon--amber">🌍</div>
          <h3>Region & framework aware</h3>
          <p>Choose UK, EU, California, Canada, or 6 more visitor regions. Reports are interpreted against your selected legal framework, not a generic one-size result.</p>
        </article>
        <article class="mp-card mp-reveal">
          <div class="mp-card-icon mp-card-icon--rose">🚨</div>
          <h3>Severity-ranked findings</h3>
          <p>Critical, High, Review, and Advisory findings with plain-English explanations, affected cookies and domains, and framework-specific remediation guidance.</p>
        </article>
        <article class="mp-card mp-reveal">
          <div class="mp-card-icon mp-card-icon--blue">📊</div>
          <h3>Scan comparison & regression</h3>
          <p>Compare two scans of the same site side by side. See new, fixed, and changed findings; cookie changes; and third-party vendor deltas.</p>
        </article>
        <article class="mp-card mp-reveal">
          <div class="mp-card-icon mp-card-icon--purple">⏰</div>
          <h3>Scheduled monitoring</h3>
          <p>Set up monitors to re-scan sites on a schedule. Get email alerts when critical or high findings exceed your threshold, plus weekly digest summaries.</p>
        </article>
        <article class="mp-card mp-reveal">
          <div class="mp-card-icon mp-card-icon--green">✅</div>
          <h3>Remediation workflow</h3>
          <p>Assign owner, status, priority, and due date to each finding. Track open, investigating, fixed, and accepted-risk across all scans in one view.</p>
        </article>
        <article class="mp-card mp-reveal">
          <div class="mp-card-icon mp-card-icon--amber">🔗</div>
          <h3>Evidence export & sharing</h3>
          <p>Export findings CSV with remediation fields, cookie inventory CSV, or a full JSON evidence bundle. Share reports via secure timed link.</p>
        </article>
        <article class="mp-card mp-reveal">
          <div class="mp-card-icon mp-card-icon--indigo">🔌</div>
          <h3>API & webhooks</h3>
          <p>Access scans, findings, and results via REST API with Bearer-token authentication. Send monitor run events to Slack, Teams, or any custom endpoint.</p>
        </article>
      </div>
    </div>
  </section>

  <!-- ── How it works ─────────────────────────────────────────────── -->
  <section class="mp-section mp-section--light" id="how-it-works" aria-labelledby="how-heading">
    <div class="mp-inner mp-split">
      <div class="mp-split-text">
        <span class="mp-eyebrow">How it works</span>
        <h2 class="mp-h2" id="how-heading">Configure once. Get defensible evidence every time.</h2>
        <p class="mp-lead">Every scan records exactly what was tested: region, framework, journeys, scope. Repeat it, compare it, and explain it to anyone.</p>
        <ul class="mp-split-list">
          <li>Choose the site, visitor region, legal framework, and scan profile in a five-step wizard</li>
          <li>Select built-in journeys or build your own multi-step consent sequences</li>
          <li>Every result includes scan integrity metrics showing exactly what completed and what was blocked</li>
          <li>Reports distinguish technical observation from risk interpretation. No false certifications</li>
        </ul>
        <div class="mp-split-actions">
          <a class="mp-btn-primary" href="/register">Try it free</a>
          <a class="mp-btn-outline" href="/blog">Read the guides</a>
        </div>
      </div>
      <div class="mp-split-visual">
        <div class="mp-journey-visual" aria-hidden="true">
          <div class="mp-journey-step">
            <div class="mp-journey-num">1</div>
            <div><h4>Set scope</h4><p>Website URL, crawl mode, pages, include/exclude patterns, and scan profile.</p></div>
          </div>
          <div class="mp-journey-step">
            <div class="mp-journey-num">2</div>
            <div><h4>Choose visitor context</h4><p>Visitor region (UK, EU, California…) and legal framework (UK GDPR/PECR, CCPA…).</p></div>
          </div>
          <div class="mp-journey-step">
            <div class="mp-journey-num">3</div>
            <div><h4>Select journeys</h4><p>No-interaction, accept-all, reject-all, GPC comparison, custom multi-step sequences.</p></div>
          </div>
          <div class="mp-journey-step">
            <div class="mp-journey-num">4</div>
            <div><h4>Review evidence</h4><p>Assurance overview, cookie inventory, network evidence, timeline, and remediation plan.</p></div>
          </div>
          <div class="mp-journey-step">
            <div class="mp-journey-num">5</div>
            <div><h4>Track & prove improvement</h4><p>Assign remediations, re-scan, compare results, and monitor on a schedule.</p></div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ── Use cases ────────────────────────────────────────────────── -->
  <section class="mp-section mp-section--white" aria-labelledby="usecases-heading">
    <div class="mp-inner">
      <div class="mp-section-head">
        <span class="mp-eyebrow">Use cases</span>
        <h2 class="mp-h2" id="usecases-heading">Built for every role in the privacy workflow</h2>
      </div>
      <div class="mp-usecases" id="usecase-root">
        <div class="mp-usecase-nav" role="tablist">
          <button class="mp-usecase-btn mp-usecase-btn--active" role="tab" aria-selected="true" onclick="switchUsecase(this,'uc-dpo')">
            <span class="mp-usecase-btn-icon">⚖️</span>Privacy & DPO
          </button>
          <button class="mp-usecase-btn" role="tab" aria-selected="false" onclick="switchUsecase(this,'uc-eng')">
            <span class="mp-usecase-btn-icon">💻</span>Engineering
          </button>
          <button class="mp-usecase-btn" role="tab" aria-selected="false" onclick="switchUsecase(this,'uc-agency')">
            <span class="mp-usecase-btn-icon">🏢</span>Agencies
          </button>
          <button class="mp-usecase-btn" role="tab" aria-selected="false" onclick="switchUsecase(this,'uc-audit')">
            <span class="mp-usecase-btn-icon">🔎</span>Auditors
          </button>
        </div>
        <div>
          <div class="mp-usecase-panel mp-usecase-panel--active" id="uc-dpo">
            <div class="mp-usecase-content">
              <h3>Privacy Officers & DPOs</h3>
              <p>Run repeatable consent audits without needing an engineer in the room. Get an assurance overview that clearly separates what passed, what failed, and what needs human judgement. Share secure report links with legal and management.</p>
              <div class="mp-usecase-tags">
                <span class="mp-usecase-tag">Assurance overview panel</span>
                <span class="mp-usecase-tag">Framework-aware findings</span>
                <span class="mp-usecase-tag">Shareable report links</span>
                <span class="mp-usecase-tag">Scheduled monitoring</span>
                <span class="mp-usecase-tag">Evidence export</span>
              </div>
            </div>
          </div>
          <div class="mp-usecase-panel" id="uc-eng">
            <div class="mp-usecase-content">
              <h3>Engineering & Dev teams</h3>
              <p>Understand exactly which scripts fire in which consent state, which cookies persist after rejection, and what the CMP is actually doing. Use the API and webhooks to integrate consent tests into your release process.</p>
              <div class="mp-usecase-tags">
                <span class="mp-usecase-tag">Network evidence timeline</span>
                <span class="mp-usecase-tag">Cookie inventory CSV</span>
                <span class="mp-usecase-tag">REST API</span>
                <span class="mp-usecase-tag">Webhook notifications</span>
                <span class="mp-usecase-tag">Scan comparison</span>
              </div>
            </div>
          </div>
          <div class="mp-usecase-panel" id="uc-agency">
            <div class="mp-usecase-content">
              <h3>Digital agencies & consultancies</h3>
              <p>Deliver client-ready consent audits with traceable evidence. Assign remediation tasks to client teams, monitor sites on a schedule, and prove improvement in follow-up scans using side-by-side comparison.</p>
              <div class="mp-usecase-tags">
                <span class="mp-usecase-tag">Multiple scan workspaces</span>
                <span class="mp-usecase-tag">Remediation tracking</span>
                <span class="mp-usecase-tag">Scan comparison</span>
                <span class="mp-usecase-tag">Scheduled monitors</span>
                <span class="mp-usecase-tag">Evidence bundles</span>
              </div>
            </div>
          </div>
          <div class="mp-usecase-panel" id="uc-audit">
            <div class="mp-usecase-content">
              <h3>Compliance auditors</h3>
              <p>Capture timestamped browser evidence of consent behaviour at a specific point in time. Export structured evidence packages for regulatory submissions. Every scan records what was tested, not just what was found.</p>
              <div class="mp-usecase-tags">
                <span class="mp-usecase-tag">Timestamped evidence</span>
                <span class="mp-usecase-tag">JSON evidence bundle</span>
                <span class="mp-usecase-tag">Audit activity log</span>
                <span class="mp-usecase-tag">Scan integrity metrics</span>
                <span class="mp-usecase-tag">Classification provenance</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ── Report deep-dive split ────────────────────────────────────── -->
  <section class="mp-section mp-section--dark" aria-labelledby="report-heading">
    <div class="mp-inner mp-split mp-split--rev">
      <div class="mp-split-text">
        <span class="mp-eyebrow">Report intelligence</span>
        <h2 class="mp-h2" id="report-heading" style="color:#fff">A report that explains what happened and why it matters</h2>
        <p class="mp-lead">Every report leads with an assurance overview: a clear pass/fail/review summary for consent gating, reject behaviour, withdrawal, persistence, tracking exposure, GPC signals, and scan completeness.</p>
        <ul class="mp-split-list" style="color:rgba(255,255,255,.65)">
          <li>Findings sorted by severity with plain-English explanations and remediation guidance</li>
          <li>Cookie classification confidence levels: exact match, pattern match, or flagged unknown</li>
          <li>Evidence timeline showing which script caused each request, with relative timestamps</li>
          <li>Journey comparison matrix across all tested consent states</li>
        </ul>
      </div>
      <div class="mp-split-visual">
        <div class="mp-product-panel" aria-hidden="true">
          <div class="mp-product-topbar">
            <span class="mp-product-dot" style="background:#ef4444"></span>
            <span class="mp-product-dot" style="background:#f59e0b"></span>
            <span class="mp-product-dot" style="background:#22c55e"></span>
          </div>
          <div class="mp-product-tabbar">
            <span class="mp-product-tab mp-product-tab--active">Assurance overview</span>
            <span class="mp-product-tab">Cookie inventory</span>
            <span class="mp-product-tab">Findings</span>
          </div>
          <div class="mp-product-body">
            <div class="mp-product-row mp-product-row--fail">
              <span class="mp-product-label">Consent gating</span>
              <span class="mp-product-badge mp-product-badge--fail">Fail</span>
            </div>
            <div class="mp-product-row mp-product-row--pass">
              <span class="mp-product-label">Reject behaviour</span>
              <span class="mp-product-badge mp-product-badge--pass">Pass</span>
            </div>
            <div class="mp-product-row mp-product-row--pass">
              <span class="mp-product-label">Consent withdrawal</span>
              <span class="mp-product-badge mp-product-badge--pass">Pass</span>
            </div>
            <div class="mp-product-row mp-product-row--pass">
              <span class="mp-product-label">Consent persistence</span>
              <span class="mp-product-badge mp-product-badge--pass">Pass</span>
            </div>
            <div class="mp-product-row mp-product-row--review">
              <span class="mp-product-label">Tracking exposure</span>
              <span class="mp-product-badge mp-product-badge--review">Review</span>
            </div>
            <div class="mp-product-row mp-product-row--fail">
              <span class="mp-product-label">Privacy signals (GPC)</span>
              <span class="mp-product-badge mp-product-badge--fail">Fail</span>
            </div>
            <div class="mp-product-row mp-product-row--pass">
              <span class="mp-product-label">Scan completeness</span>
              <span class="mp-product-badge mp-product-badge--pass">100%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ── Testimonials ──────────────────────────────────────────────── -->
  <section class="mp-section mp-section--light" aria-labelledby="testimonials-heading">
    <div class="mp-inner">
      <div class="mp-section-head">
        <span class="mp-eyebrow">What teams say</span>
        <h2 class="mp-h2" id="testimonials-heading">Trusted by privacy, engineering, and compliance teams</h2>
      </div>
      <div class="mp-testimonials">
        <article class="mp-testimonial mp-reveal">
          <p class="mp-testimonial-quote">For the first time we could show exactly which scripts fired before a user touched the banner. That conversation with engineering would have taken weeks otherwise.</p>
          <div class="mp-testimonial-author">
            <div class="mp-testimonial-avatar">S</div>
            <div>
              <div class="mp-testimonial-name">Sarah M.</div>
              <div class="mp-testimonial-role">Head of Privacy, Financial services</div>
            </div>
          </div>
        </article>
        <article class="mp-testimonial mp-reveal">
          <p class="mp-testimonial-quote">The GPC comparison journey caught something our internal QA completely missed. The California visitor was being tracked even after the GPC signal was sent.</p>
          <div class="mp-testimonial-author">
            <div class="mp-testimonial-avatar">J</div>
            <div>
              <div class="mp-testimonial-name">James T.</div>
              <div class="mp-testimonial-role">Privacy Engineer, SaaS platform</div>
            </div>
          </div>
        </article>
        <article class="mp-testimonial mp-reveal">
          <p class="mp-testimonial-quote">We run SPIDAC scans before every client site launch. The remediation tracking means nothing falls through the cracks between our devs and the client's DPO.</p>
          <div class="mp-testimonial-author">
            <div class="mp-testimonial-avatar">A</div>
            <div>
              <div class="mp-testimonial-name">Anna K.</div>
              <div class="mp-testimonial-role">Technical Director, Digital agency</div>
            </div>
          </div>
        </article>
      </div>
    </div>
  </section>

  <!-- ── Pricing ───────────────────────────────────────────────────── -->
  <section class="mp-section mp-section--white" id="pricing" aria-labelledby="pricing-heading">
    <div class="mp-inner">
      <div class="mp-section-head">
        <span class="mp-eyebrow">Pricing</span>
        <h2 class="mp-h2" id="pricing-heading">Simple, transparent pricing</h2>
        <p class="mp-lead">Start free. Upgrade when you need scheduled monitoring, comparison history, or team access.</p>
      </div>
      <div class="mp-pricing">
        <div class="mp-plan mp-reveal">
          <h3>Starter</h3>
          <p class="mp-plan-desc">For individuals and small teams getting started with consent auditing.</p>
          <div class="mp-plan-price">Free</div>
          <p class="mp-plan-price-note">No credit card required</p>
          <a class="mp-plan-cta" href="/register">Get started free</a>
          <ul class="mp-plan-features">
            <li>Unlimited scans</li>
            <li>All 8 built-in journeys</li>
            <li>10 visitor regions</li>
            <li>UK GDPR, PECR, CCPA profiles</li>
            <li>Cookie inventory & classification</li>
            <li>Severity-ranked findings</li>
            <li>Remediation tracking</li>
            <li>Scan comparison (3 saved)</li>
            <li class="mp-plan-feature--no">Scheduled monitors</li>
            <li class="mp-plan-feature--no">Email alerts & digests</li>
            <li class="mp-plan-feature--no">API access</li>
            <li class="mp-plan-feature--no">Shared report links</li>
          </ul>
        </div>
        <div class="mp-plan mp-plan--featured mp-reveal">
          <div class="mp-plan-badge">MOST POPULAR</div>
          <h3>Professional</h3>
          <p class="mp-plan-desc">For privacy professionals and agencies managing multiple sites.</p>
          <div class="mp-plan-price"><sup>£</sup>49</div>
          <p class="mp-plan-price-note">per month · billed annually</p>
          <a class="mp-plan-cta" href="/register">Start 14-day trial</a>
          <ul class="mp-plan-features">
            <li>Everything in Starter</li>
            <li>Unlimited scan comparisons</li>
            <li>Scheduled monitors (10)</li>
            <li>Email alerts & weekly digest</li>
            <li>Webhook integrations</li>
            <li>REST API access</li>
            <li>Shared report links</li>
            <li>Evidence export (JSON, CSV)</li>
            <li>Audit activity log</li>
            <li class="mp-plan-feature--no">Team workspaces</li>
            <li class="mp-plan-feature--no">SSO</li>
          </ul>
        </div>
        <div class="mp-plan mp-reveal">
          <h3>Enterprise</h3>
          <p class="mp-plan-desc">For large teams, regulated industries, and complex multi-site programmes.</p>
          <div class="mp-plan-price" style="font-size:28px;padding-top:8px">Custom</div>
          <p class="mp-plan-price-note">Volume discounts available</p>
          <a class="mp-plan-cta" href="/contact">Talk to us</a>
          <ul class="mp-plan-features">
            <li>Everything in Professional</li>
            <li>Unlimited monitors</li>
            <li>Team workspaces</li>
            <li>Role-based access control</li>
            <li>SSO (SAML, OIDC)</li>
            <li>Jira / Linear integration</li>
            <li>Data retention controls</li>
            <li>Priority support & onboarding</li>
            <li>Custom SLA</li>
          </ul>
        </div>
      </div>
    </div>
  </section>

  <!-- ── FAQ ──────────────────────────────────────────────────────── -->
  <section class="mp-section mp-section--light" aria-labelledby="faq-heading">
    <div class="mp-inner">
      <div class="mp-section-head">
        <span class="mp-eyebrow">FAQs</span>
        <h2 class="mp-h2" id="faq-heading">Common questions</h2>
      </div>
      <div class="mp-faq" role="list">
        <div class="mp-faq-item" role="listitem">
          <button class="mp-faq-q" onclick="toggleFaq(this)">Does SPIDAC replace a legal opinion or formal GDPR audit?</button>
          <div class="mp-faq-a">No. SPIDAC produces technical observations (what the browser actually did) and risk interpretation based on your selected framework. It explicitly distinguishes these from legal conclusions. A qualified DPO or solicitor should interpret results in your specific legal context.</div>
        </div>
        <div class="mp-faq-item" role="listitem">
          <button class="mp-faq-q" onclick="toggleFaq(this)">What frameworks are supported?</button>
          <div class="mp-faq-a">UK GDPR / PECR (combined), EU ePrivacy / GDPR, California CCPA / CPRA, and a general framework-neutral mode. Region selection is separate from framework. You can test a UK site as a California visitor, for example.</div>
        </div>
        <div class="mp-faq-item" role="listitem">
          <button class="mp-faq-q" onclick="toggleFaq(this)">How do the consent journeys work?</button>
          <div class="mp-faq-a">SPIDAC opens a real browser (Playwright/Chromium) and simulates visitor actions: doing nothing, clicking accept-all, clicking reject-all, opening preferences, withdrawing consent, and revisiting after a previous consent session. Each journey captures cookies, storage, network requests, and consent signals independently.</div>
        </div>
        <div class="mp-faq-item" role="listitem">
          <button class="mp-faq-q" onclick="toggleFaq(this)">Can I build custom consent journeys?</button>
          <div class="mp-faq-a">Yes. The custom journey builder lets you create multi-step sequences using click, navigate, scroll, wait, open-preferences, toggle-category, and save actions. These run in a single browser context so you can simulate complex CMP interactions.</div>
        </div>
        <div class="mp-faq-item" role="listitem">
          <button class="mp-faq-q" onclick="toggleFaq(this)">Is my scan data private?</button>
          <div class="mp-faq-a">All scans are stored in your private workspace. Reports are not publicly accessible unless you explicitly create a timed shared link. You can delete scans at any time, and evidence packages can be exported and removed from the platform.</div>
        </div>
        <div class="mp-faq-item" role="listitem">
          <button class="mp-faq-q" onclick="toggleFaq(this)">Does SPIDAC work with all CMPs?</button>
          <div class="mp-faq-a">SPIDAC works with any website, regardless of which CMP (or none) is in use. It observes actual browser behaviour rather than integrating with CMP APIs, so the results reflect what a real visitor experiences, not what the CMP reports about itself.</div>
        </div>
      </div>
    </div>
  </section>

  <!-- ── Final CTA ─────────────────────────────────────────────────── -->
  <section class="mp-final-cta" aria-labelledby="cta-heading">
    <div class="mp-inner">
      <h2 id="cta-heading">Make your next privacy review concrete</h2>
      <p>Start with one website. Get real evidence in minutes.</p>
      <div class="mp-final-cta-actions">
        <a class="mp-btn-white" href="/register">Start free, no credit card</a>
        <a class="mp-btn-ghost" href="/blog">Read the guides</a>
      </div>
    </div>
  </section>

  <!-- ── Final CTA (end of unique body content) ──────────────────── -->
`;

  // Stat counter script unique to homepage
  const statScript = `<script>
(function(){
  var statsEl=document.querySelector('.mp-stats');if(!statsEl)return;
  var statNums=statsEl.querySelectorAll('.mp-stat-num');var animated=false;
  function run(){if(animated)return;animated=true;statNums.forEach(function(el,i){var t=parseInt(el.textContent,10);if(isNaN(t))return;var suf=i===statNums.length-1?'%':'';var dur=900;var t0=null;function s(ts){if(!t0)t0=ts;var p=Math.min((ts-t0)/dur,1);var e=1-Math.pow(1-p,3);el.textContent=Math.round(e*t)+suf;if(p<1)requestAnimationFrame(s);}requestAnimationFrame(s);});}
  if('IntersectionObserver' in window){var sio=new IntersectionObserver(function(en){if(en[0].isIntersecting){run();sio.disconnect();}},{threshold:0.4});sio.observe(statsEl);}else{run();}
})();
</script>`;

  return mpShell('Privacy assurance platform', 'SPIDAC simulates real visitor consent journeys and surfaces what fires, what persists, and what to fix. Evidence-led privacy assurance for websites.', body + statScript, 'home', css);
}

function marketingSubpage(title, eyebrow, heading, intro, content, currentPage) {
  const css = `
.sp-hero{background:linear-gradient(160deg,#0f172a 0%,#1e1b4b 60%,#312e81 100%);color:#fff;padding:clamp(72px,10vw,120px) 0 clamp(56px,7vw,88px)}
.sp-eyebrow{display:inline-flex;align-items:center;gap:8px;background:rgba(99,102,241,.2);border:1px solid rgba(129,140,248,.3);border-radius:100px;padding:5px 14px;font-size:12px;font-weight:700;color:#a5b4fc;letter-spacing:.06em;text-transform:uppercase;margin-bottom:20px}
.sp-hero h1{font-size:clamp(32px,5vw,58px);line-height:1.07;letter-spacing:-.04em;font-weight:800;margin:0 0 18px;max-width:800px}
.sp-hero p{max-width:640px;color:rgba(255,255,255,.62);font-size:17px;line-height:1.75;margin:0}
.sp-content{background:#f8fafc;min-height:50vh;padding:clamp(48px,7vw,88px) 0}
.sp-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}
.sp-card{display:flex;flex-direction:column;min-height:220px;padding:24px;border:1px solid #e2e8f0;border-radius:14px;background:#fff;box-shadow:0 4px 16px rgba(15,23,42,.05);transition:box-shadow .18s,transform .18s}
.sp-card:hover{box-shadow:0 8px 28px rgba(15,23,42,.1);transform:translateY(-2px)}
.sp-card .sp-eyebrow{font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#818cf8;margin-bottom:12px;display:block;background:none;border:none;padding:0;border-radius:0}
.sp-card h2{font-size:18px;line-height:1.3;letter-spacing:-.025em;font-weight:700;margin:0 0 10px;color:#0f172a}
.sp-card p{color:#64748b;font-size:14px;line-height:1.65;margin:0;flex:1}
.sp-card .sp-meta{margin-top:18px;padding-top:14px;border-top:1px solid #f1f5f9;color:#6366f1;font-size:12px;font-weight:800;text-decoration:none}
.sp-card .sp-meta:hover{color:#4f46e5}
.sp-note{margin-top:28px;padding:18px 22px;border-left:3px solid #818cf8;background:#eef2ff;border-radius:0 8px 8px 0;color:#475569;font-size:14px;line-height:1.7}
@media(max-width:760px){.sp-grid{grid-template-columns:1fr}}
`;
  const body = `
  <section class="sp-hero">
    <div class="mp-inner">
      <div class="sp-eyebrow">${eyebrow}</div>
      <h1>${heading}</h1>
      <p>${intro}</p>
    </div>
  </section>
  <section class="sp-content">
    <div class="mp-inner">${content}</div>
  </section>`;
  return mpShell(title, intro, body, currentPage, css);
}

function trainingsPage() {
  const content = `
<div class="sp-grid">
  <article class="sp-card mp-reveal"><span class="sp-eyebrow">Foundations</span><h2>Privacy technology fundamentals</h2><p>Understand cookies, browser storage, consent management platforms, tag managers, and the signals moving between them.</p><span class="sp-meta">Workshop · Beginner friendly</span></article>
  <article class="sp-card mp-reveal"><span class="sp-eyebrow">Implementation</span><h2>Consent controls in production</h2><p>Map vendors to categories, gate scripts correctly, test withdrawal, and build a repeatable release-check process.</p><span class="sp-meta">Hands-on lab · Technical teams</span></article>
  <article class="sp-card mp-reveal"><span class="sp-eyebrow">Operations</span><h2>Evidence-led privacy reviews</h2><p>Read scan results, separate critical issues from advisories, assign remediation, and communicate findings clearly.</p><span class="sp-meta">Team session · Privacy operations</span></article>
</div>
<div class="sp-note" style="margin-top:32px"><strong>Training programme coming soon.</strong> Join the SPIDAC workspace to receive updates about live workshops, private team sessions, and practical privacy-tech labs.</div>`;
  return marketingSubpage('Privacy technology training', 'Trainings', 'Make privacy technology understandable and operational.', 'Practical sessions for privacy, engineering, product, and compliance teams who need to make consent systems work in the real world.', content, 'trainings');
}

function blogPage(posts = [], article = null) {
  const articleCss = article ? `
.blog-article{max-width:760px;margin:0 auto}
.blog-article h2{font-size:clamp(28px,5vw,46px);line-height:1.1;letter-spacing:-.04em;margin:0 0 12px}
.blog-article .article-meta{color:#64748b;font-size:13px;margin-bottom:32px}
.blog-article-body{color:#334155;font-size:16px;line-height:1.85;white-space:pre-wrap}
.blog-back{display:inline-flex;align-items:center;gap:6px;margin-bottom:28px;color:#6366f1;font-size:13px;font-weight:800;text-decoration:none}
.blog-back:hover{color:#4f46e5}` : '';

  if (article) {
    const articleContent = `<article class="blog-article"><a class="blog-back" href="/blog">&#8592; Back to Blog</a><span class="sp-eyebrow">${esc(article.category)}</span><h2>${esc(article.title)}</h2><div class="article-meta">By ${esc(article.author_email || 'SPIDAC')} &middot; ${esc(new Date(article.published_at || article.created_at).toLocaleDateString('en-GB'))}</div><div class="blog-article-body">${esc(article.body)}</div></article>`;
    return marketingSubpage(article.title, 'Blog & news', article.title, article.excerpt || '', articleContent, 'blog');
  }

  const cards = posts.length
    ? posts.map(post => `<article class="sp-card mp-reveal"><span class="sp-eyebrow">${esc(post.category)}</span><h2>${esc(post.title)}</h2><p>${esc(post.excerpt)}</p><a class="sp-meta" href="/blog/${encodeURIComponent(post.slug)}">Read article</a></article>`).join('')
    : '<div class="sp-note"><strong>No published posts yet.</strong> Check back soon for product updates, privacy engineering guidance, and lessons from testing consent experiences.</div>\n';
  const content = posts.length ? `<div class="sp-grid">${cards}</div>` : cards;
  return marketingSubpage('SPIDAC Blog', 'Blog & news', 'Practical notes for people building privacy into the web.', 'Product updates, privacy technology guidance, and clear explanations of what consent systems actually do.', content + (articleCss ? `<style>${articleCss}</style>` : ''), 'blog');
}

function dashboardTrendChart(pastScans) {
  const recent = [...pastScans].reverse().slice(-20); // oldest→newest, up to 20
  if (recent.length < 2) return '';
  const W = 100, H = 40;
  const barW = Math.max(2, Math.floor(W / recent.length) - 1);
  const maxTotal = Math.max(...recent.map(s => {
    const f = s.findings || {};
    return (f.CRITICAL || 0) + (f.HIGH || 0) + (f.REVIEW || 0);
  }), 1);

  const bars = recent.map((s, i) => {
    const f = s.findings || {};
    const c = f.CRITICAL || 0, h = f.HIGH || 0, r = f.REVIEW || 0;
    const total = c + h + r;
    const totalH = Math.max(total > 0 ? 2 : 1, Math.round((total / maxTotal) * H));
    const cH = total > 0 ? Math.round((c / total) * totalH) : 0;
    const hH = total > 0 ? Math.round((h / total) * totalH) : 0;
    const rH = totalH - cH - hH;
    const x = i * (barW + 1);
    const y0 = H - totalH;
    const seg = (fillH, yOff, fill) => fillH > 0
      ? `<rect x="${x}" y="${H - yOff - fillH}" width="${barW}" height="${fillH}" fill="${fill}"/>`
      : '';
    return seg(cH, cH, '#f87171') + seg(hH, cH + hH, '#fb923c') + seg(rH, totalH, '#fbbf24');
  }).join('');

  return `<div style="margin-bottom:28px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <span style="font-size:0.8rem;font-weight:700;color:var(--muted)">Finding trend — last ${recent.length} scans</span>
      <span style="display:flex;gap:10px;font-size:0.72rem;color:var(--muted)">
        <span><span style="display:inline-block;width:8px;height:8px;background:#f87171;border-radius:2px;margin-right:3px"></span>Critical</span>
        <span><span style="display:inline-block;width:8px;height:8px;background:#fb923c;border-radius:2px;margin-right:3px"></span>High</span>
        <span><span style="display:inline-block;width:8px;height:8px;background:#fbbf24;border-radius:2px;margin-right:3px"></span>Review</span>
      </span>
    </div>
    <svg width="100%" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="height:48px;display:block;border-radius:6px;background:var(--surface-2)">${bars}</svg>
  </div>`;
}

function homePage(pastScans, activeJobs = [], user = null, comparisons = [], monitors = [], openRemediations = 0) {
  const totalScans = pastScans.length;
  const criticalCount = pastScans.filter(s => s.findings?.CRITICAL > 0).length;
  const cleanCount = pastScans.filter(s => !worstSeverity(s.findings) && s.scanStatus === 'ok').length;

  const chips = [];
  if (totalScans) chips.push(`<span class="hchip hchip-default">${totalScans} scan${totalScans !== 1 ? 's' : ''}</span>`);
  if (criticalCount) chips.push(`<span class="hchip hchip-critical">${criticalCount} critical</span>`);
  if (cleanCount) chips.push(`<span class="hchip hchip-clean">${cleanCount} clean</span>`);
  const historyRegionOptions = Array.from(new Map(
    pastScans.filter(s => s.region?.key).map(s => [s.region.key, `${s.region.flag || ''} ${s.region.label || s.region.key}`])
  )).sort((a, b) => a[1].localeCompare(b[1]))
    .map(([key, label]) => `<option value="${esc(key)}">${esc(label.trim())}</option>`).join('');

  const activeSection = activeJobs.length ? `
<div class="inprogress-section">
  <div class="inprogress-hdr">
    <span class="inprogress-dot"></span>
    <span class="inprogress-title">${activeJobs.length} scan${activeJobs.length !== 1 ? 's' : ''} in progress</span>
  </div>
  <ul class="scan-list">${activeJobs.map(activeJobCard).join('')}</ul>
</div>` : '';

  const historyHtml = pastScans.length
    ? `<div class="history-tools" role="search" aria-label="Filter scan history">
        <input class="history-filter" id="history-search" type="search" placeholder="Search domains, names, or CMPs" aria-label="Search scan history">
        <select class="history-filter" id="history-severity" aria-label="Filter by severity">
          <option value="">All severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="review">Review</option>
          <option value="advisory">Advisory</option>
          <option value="clean">Clean</option>
        </select>
        <select class="history-filter" id="history-region" aria-label="Filter by region">
          <option value="">All regions</option>${historyRegionOptions}
        </select>
        <select class="history-filter" id="history-date" aria-label="Filter by date">
          <option value="0">Any time</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
      </div>
      <p class="history-filter-status" id="history-filter-status" role="status"></p>
      <ul class="scan-list" id="history-list">${pastScans.map(scanCard).join('')}</ul>
      <div class="history-empty-filtered" id="history-empty-filtered">No scans match these filters.</div>`
    : (activeJobs.length ? '' : `<div class="empty-state">
        <span class="empty-icon">🔍</span>
        <div class="empty-title">No scans yet</div>
        <p class="empty-sub">Enter a URL above to run your first cookie compliance scan.</p>
      </div>`);

  const historySection = user && (pastScans.length || (!activeJobs.length)) ? `
    <div class="history-hdr">
      <h2 class="history-title">Scan history</h2>
      <div class="history-chips">${chips.join('')}</div>
    </div>
    ${historyHtml}` : '';

  const comparisonsSection = user && comparisons.length ? `
    <div class="history-hdr" style="margin-top:28px">
      <h2 class="history-title">Scan comparisons</h2>
      <a href="/comparisons" style="color:var(--accent);font-size:0.85rem;font-weight:700">View all →</a>
    </div>
    <div class="scan-list">
      ${comparisons.slice(0, 3).map(c => `<div style="padding:12px;border:1px solid var(--border);border-radius:10px;margin-bottom:10px;background:#fff">
        <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap">
          <div>
            <div style="font-weight:700;font-size:0.9rem">${esc(c.baseline_url)} → ${esc(c.current_url)}</div>
            <div style="color:var(--muted);font-size:0.8rem;margin-top:3px">${esc(new Date(c.created_at).toLocaleDateString('en-GB'))}</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <span class="badge ${(c.summary?.newCount || 0) > 0 ? 'badge-critical' : 'badge-ok'}">${esc(c.summary?.newCount || 0)} new</span>
            <span class="badge badge-ok">${esc(c.summary?.fixedCount || 0)} fixed</span>
            <a href="/comparisons/${c.id}" style="color:var(--accent);font-size:0.8rem;font-weight:700">View →</a>
          </div>
        </div>
      </div>`).join('')}
    </div>` : '';

  const monitorsSection = user && monitors.length ? `
    <div class="history-hdr" style="margin-top:28px">
      <h2 class="history-title">Scheduled monitors</h2>
      <a href="/monitors" style="color:var(--accent);font-size:0.85rem;font-weight:700">View all →</a>
    </div>
    <div class="scan-list">
      ${monitors.slice(0, 3).map(m => `<div style="padding:12px;border:1px solid var(--border);border-radius:10px;margin-bottom:10px;background:#fff">
        <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center">
          <div>
            <div style="font-weight:700;font-size:0.9rem">${esc(m.name || m.url)}</div>
            <div style="color:var(--muted);font-size:0.8rem;margin-top:3px">${esc(m.url)} · ${esc(m.schedule)}</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <span class="badge ${m.enabled ? 'badge-ok' : 'badge-queued'}">${m.enabled ? 'Active' : 'Paused'}</span>
            <a href="/monitors/${m.id}" style="color:var(--accent);font-size:0.8rem;font-weight:700">View →</a>
          </div>
        </div>
      </div>`).join('')}
    </div>` : '';

  const workflowGuide = !pastScans.length && !activeJobs.length ? `
    <section class="workflow-guide" aria-labelledby="workflow-guide-title">
      <div class="workflow-guide-head">
        <div>
          <h2 class="workflow-guide-title" id="workflow-guide-title">${user ? 'Your first scan, in three simple steps' : 'How SPIDAC - Digital Tech Assurance works'}</h2>
          <p class="workflow-guide-sub">Choose the visitor context you want to test, then get a private evidence trail for review.</p>
        </div>
      </div>
      <div class="workflow-steps">
        <article class="workflow-step">
          <span class="workflow-step-number" aria-hidden="true">1</span>
          <h3>Set the scope</h3>
          <p>Choose a website, visitor region, legal framework, and scan profile.</p>
        </article>
        <article class="workflow-step">
          <span class="workflow-step-number" aria-hidden="true">2</span>
          <h3>Test real choices</h3>
          <p>We observe the site before consent, after accepting, and after rejecting.</p>
        </article>
        <article class="workflow-step">
          <span class="workflow-step-number" aria-hidden="true">3</span>
          <h3>Review the evidence</h3>
          <p>See cookie changes, banner behaviour, privacy signals, and practical next steps.</p>
        </article>
      </div>
    </section>` : '';

  // Domain health: group scans by hostname, pick latest per domain
  const domainMap = new Map();
  for (const s of pastScans) {
    let host;
    try { host = new URL(s.url).hostname.replace(/^www\./, ''); } catch { host = s.url; }
    const existing = domainMap.get(host);
    if (!existing || new Date(s.scannedAt) > new Date(existing.scannedAt)) {
      domainMap.set(host, s);
    }
  }
  const domainHealthSection = user && domainMap.size > 1 ? `
  <div class="history-hdr" style="margin-top:28px;margin-bottom:12px">
    <h2 class="history-title">Domain health</h2>
    <span style="font-size:0.8rem;color:var(--muted)">Latest scan per domain</span>
  </div>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;margin-bottom:28px">
    ${[...domainMap.entries()].sort((a,b) => {
        const wa = worstSeverity(a[1].findings); const wb = worstSeverity(b[1].findings);
        const order = ['CRITICAL','HIGH','REVIEW','ADVISORY',''];
        return order.indexOf(wa) - order.indexOf(wb);
      }).map(([host, s]) => {
        const worst = worstSeverity(s.findings);
        const borderColor = worst === 'CRITICAL' ? 'var(--rose)' : worst === 'HIGH' ? 'var(--amber,#f59e0b)' : worst === 'REVIEW' ? '#fbbf24' : 'var(--emerald)';
        const label = worst || 'Clean';
        const badgeCls = worst === 'CRITICAL' ? 'badge-critical' : worst === 'HIGH' ? 'badge-manual' : worst ? '' : 'badge-ok';
        const f = s.findings || {};
        const parts = [f.CRITICAL && `${f.CRITICAL} critical`, f.HIGH && `${f.HIGH} high`, f.REVIEW && `${f.REVIEW} review`].filter(Boolean).join(', ') || 'No findings';
        const scanResultDir = s.dirName || '';
        return `<a href="/report/${esc(scanResultDir)}" style="text-decoration:none;display:block;background:var(--surface);border:1px solid var(--border);border-left:4px solid ${borderColor};border-radius:var(--radius);padding:12px 14px">
          <div style="font-weight:700;font-size:0.88rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text)">${esc(host)}</div>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:6px">
            <span style="font-size:0.75rem;color:var(--muted)">${esc(parts)}</span>
            <span class="badge ${badgeCls}" style="font-size:0.65rem;flex-shrink:0">${esc(label)}</span>
          </div>
          <div style="font-size:0.72rem;color:var(--muted);margin-top:4px">${s.scannedAt ? new Date(s.scannedAt).toLocaleDateString('en-GB') : ''}</div>
        </a>`;
      }).join('')}
  </div>` : '';

  const activeMonitors = monitors.filter(m => m.enabled).length;
  const statsOverview = user && totalScans ? `
  <div class="stats-grid">
    <div class="stat-card stat-card--default">
      <span class="stat-card-value">${totalScans}</span>
      <span class="stat-card-label">Total scans</span>
    </div>
    <div class="stat-card ${criticalCount ? 'stat-card--danger' : 'stat-card--success'}">
      <span class="stat-card-value">${criticalCount}</span>
      <span class="stat-card-label">Scans with criticals</span>
    </div>
    <div class="stat-card ${openRemediations ? 'stat-card--warning' : 'stat-card--default'}">
      <span class="stat-card-value">${openRemediations}</span>
      <span class="stat-card-label">Open remediations</span>
      ${openRemediations ? `<a class="stat-card-link" href="/app/remediations">View all</a>` : ''}
    </div>
    <div class="stat-card ${activeMonitors ? 'stat-card--success' : 'stat-card--default'}">
      <span class="stat-card-value">${activeMonitors}</span>
      <span class="stat-card-label">Active monitors</span>
      ${activeMonitors ? `<a class="stat-card-link" href="/app/monitors">View all</a>` : ''}
    </div>
  </div>
  ${dashboardTrendChart(pastScans)}` : '';

  const body = `
<section class="content-section">
  <div class="inner">
    ${statsOverview}
    ${activeSection}
    ${domainHealthSection}
    ${historySection}
    ${comparisonsSection}
    ${monitorsSection}
    ${workflowGuide}
  </div>
</section>
`;

  return appLayout('Dashboard', body, user, 'dashboard');
}

function renderComparisonSection(title, findings, accentCls) {
  if (!findings.length) {
    return `<div style="padding:12px 16px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--muted);font-size:0.875rem;margin-bottom:16px">No ${esc(title.toLowerCase())}.</div>`;
  }
  const SEV_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'ADVISORY', 'INFO'];
  const sorted = [...findings].sort((a, b) => {
    const ai = SEV_ORDER.indexOf(a.severity?.toUpperCase()) ?? 99;
    const bi = SEV_ORDER.indexOf(b.severity?.toUpperCase()) ?? 99;
    return ai - bi;
  });
  const sevCounts = findings.reduce((acc, f) => { const s = f.severity || 'INFO'; acc[s] = (acc[s] || 0) + 1; return acc; }, {});
  const sevSummary = SEV_ORDER.filter(s => sevCounts[s]).map(s => {
    const clsMap = { CRITICAL: 'sc-critical', HIGH: 'sc-high', MEDIUM: 'sc-medium', LOW: 'sc-low' };
    const cls = clsMap[s] || '';
    return `<span class="badge ${cls}" style="font-size:0.72rem">${sevCounts[s]} ${s.toLowerCase()}</span>`;
  }).join('');
  const sevCls = sev => ({ CRITICAL: 'cat-critical', HIGH: 'cat-high', MEDIUM: 'cat-medium', LOW: 'cat-low' }[sev?.toUpperCase()] || accentCls);
  const rows = sorted.map(f => `<tr>
    <td><span class="finding-id">${esc(f.id)}</span></td>
    <td><span class="cat-pill ${sevCls(f.severity)}" style="font-size:0.72rem">${esc(f.severity)}</span></td>
    <td style="font-weight:600">${esc(f.title)}</td>
    <td style="color:var(--muted);font-size:0.83rem">${esc(f.domain || '—')}</td>
    <td style="color:var(--muted);font-size:0.83rem">${esc(f.scenario ? scenarioLabel(f.scenario) : '—')}</td>
  </tr>`).join('');
  return `
<div style="margin-bottom:24px">
  <h2 style="font-size:1rem;font-weight:700;letter-spacing:-.02em;margin:0 0 8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
    ${esc(title)} <span style="font-weight:500;color:var(--muted);font-size:0.88rem">(${findings.length})</span>
    <span style="display:inline-flex;gap:5px;flex-wrap:wrap">${sevSummary}</span>
  </h2>
  <div style="overflow-x:auto;border:1px solid var(--border);border-radius:var(--radius-sm)">
    <table class="cookie-table" style="border:none">
      <thead><tr><th>ID</th><th>Severity</th><th>Title</th><th>Domain</th><th>Scenario</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
</div>`;
}

function renderCookieDiffSection(comparison) {
  const newC = comparison.newCookies || [];
  const remC = comparison.removedCookies || [];
  if (!newC.length && !remC.length) return '';
  const cookieRow = (c, cls, label) => `<tr>
    <td><span class="cat-pill ${cls}" style="font-size:0.68rem;padding:0.1em 0.4em">${label}</span></td>
    <td style="font-family:monospace;font-size:0.82rem;font-weight:600">${esc(c.name)}</td>
    <td style="color:var(--muted);font-size:0.82rem">${esc(c.domain)}</td>
    <td style="font-size:0.82rem">${esc(c.category)}</td>
    <td style="color:var(--muted);font-size:0.82rem">${esc(c.provider)}</td>
  </tr>`;
  const rows = [
    ...newC.map(c => cookieRow(c, 'cat-critical', '+ new')),
    ...remC.map(c => cookieRow(c, 'cat-strictly-necessary', '− removed')),
  ].join('');
  return `
<div style="margin-bottom:24px">
  <h2 style="font-size:1rem;font-weight:700;letter-spacing:-.02em;margin:0 0 10px;display:flex;align-items:center;gap:8px">
    Cookie changes <span style="font-weight:500;color:var(--muted);font-size:0.88rem">(+${newC.length} / −${remC.length})</span>
  </h2>
  <div style="overflow-x:auto;border:1px solid var(--border);border-radius:var(--radius-sm)">
    <table class="cookie-table" style="border:none">
      <thead><tr><th>Change</th><th>Name</th><th>Domain</th><th>Category</th><th>Provider</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
</div>`;
}

function renderVendorDiffSection(comparison) {
  const newV = comparison.newVendors || [];
  const remV = comparison.removedVendors || [];
  if (!newV.length && !remV.length) return '';
  const vendorRow = (domain, cls, label) => `<tr>
    <td><span class="cat-pill ${cls}" style="font-size:0.68rem;padding:0.1em 0.4em">${label}</span></td>
    <td style="font-family:monospace;font-size:0.82rem">${esc(domain)}</td>
  </tr>`;
  const rows = [
    ...newV.map(d => vendorRow(d, 'cat-critical', '+ new')),
    ...remV.map(d => vendorRow(d, 'cat-strictly-necessary', '− removed')),
  ].join('');
  return `
<div style="margin-bottom:24px">
  <h2 style="font-size:1rem;font-weight:700;letter-spacing:-.02em;margin:0 0 6px;display:flex;align-items:center;gap:8px">
    Third-party vendor changes <span style="font-weight:500;color:var(--muted);font-size:0.88rem">(+${newV.length} / −${remV.length})</span>
  </h2>
  <p style="color:var(--muted);font-size:0.82rem;margin:0 0 10px">Vendors are third-party domains contacted during the scan. New vendors may indicate tracking expansion; removed vendors may indicate CMP improvements or vendor changes.</p>
  <div style="overflow-x:auto;border:1px solid var(--border);border-radius:var(--radius-sm)">
    <table class="cookie-table" style="border:none">
      <thead><tr><th>Change</th><th>Domain</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
</div>`;
}

function comparisonPage(comparison, user) {
  const s = comparison.summary || {};
  const newCount = s.newCount || 0;
  const fixedCount = s.fixedCount || 0;
  const deltaSign = newCount > fixedCount ? '+' : newCount < fixedCount ? '−' : '±';
  const deltaN = Math.abs(newCount - fixedCount);
  const deltaColor = newCount > fixedCount ? 'var(--rose)' : 'var(--emerald)';

  const body = `
<section class="content-section">
  <div class="inner">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin:0 0 20px">
      <div>
        <h1 style="font-size:clamp(20px,3vw,28px);letter-spacing:-.03em;margin:0 0 6px">Scan comparison</h1>
        <p style="color:var(--muted);font-size:0.88rem;margin:0;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <span style="font-family:monospace;background:var(--surface-2);border:1px solid var(--border);border-radius:4px;padding:2px 7px;font-size:0.8rem">${esc(comparison.baseline_url || '—')}</span>
          <span style="color:var(--muted)">→</span>
          <span style="font-family:monospace;background:var(--surface-2);border:1px solid var(--border);border-radius:4px;padding:2px 7px;font-size:0.8rem">${esc(comparison.current_url || comparison.baseline_url || '—')}</span>
        </p>
        <p style="color:var(--muted);font-size:0.78rem;margin:6px 0 0">Compared ${fmtDate(comparison.created_at)}</p>
      </div>
      <a href="/comparisons" class="sc-view">← All comparisons</a>
    </div>

    <div class="integrity-grid" style="margin-bottom:24px">
      <div class="integrity-card" style="border-top:3px solid var(--rose)">
        <strong style="color:var(--rose)">${esc(newCount)}</strong>
        <span>New findings</span>
      </div>
      <div class="integrity-card" style="border-top:3px solid var(--emerald)">
        <strong style="color:var(--emerald)">${esc(fixedCount)}</strong>
        <span>Fixed findings</span>
      </div>
      <div class="integrity-card">
        <strong>${esc(s.changedCount || 0)}</strong>
        <span>Changed</span>
      </div>
      <div class="integrity-card">
        <strong style="color:${deltaColor}">${deltaSign}${deltaN}</strong>
        <span>Net change</span>
        <span style="font-size:0.72rem;color:var(--muted)">${esc(s.baselineFindingsCount || 0)} → ${esc(s.currentFindingsCount || 0)}</span>
      </div>
      <div class="integrity-card"${(s.newCookiesCount || 0) > 0 ? ' style="border-top:3px solid var(--amber,#f59e0b)"' : ''}>
        <strong>${esc((s.newCookiesCount || 0) + (s.removedCookiesCount || 0))}</strong>
        <span>Cookie changes</span>
        <span style="font-size:0.72rem;color:var(--muted)">+${s.newCookiesCount || 0} / −${s.removedCookiesCount || 0}</span>
      </div>
      <div class="integrity-card">
        <strong>${esc((s.newVendorsCount || 0) + (s.removedVendorsCount || 0))}</strong>
        <span>Vendor changes</span>
        <span style="font-size:0.72rem;color:var(--muted)">+${s.newVendorsCount || 0} / −${s.removedVendorsCount || 0}</span>
      </div>
    </div>

    ${renderComparisonSection('New findings', comparison.newFindings || [], 'cat-critical')}
    ${renderComparisonSection('Fixed findings', comparison.fixedFindings || [], 'cat-strictly-necessary')}
    ${renderComparisonSection('Changed findings', comparison.changedFindings || [], 'cat-unknown')}
    ${renderCookieDiffSection(comparison)}
    ${renderVendorDiffSection(comparison)}
  </div>
</section>`;
  return appLayout('Scan comparison', body, user, 'comparisons');
}

function comparisonListPage(comparisons, user) {
  const totalComparisons = comparisons.length;
  const withNew = comparisons.filter(c => (c.summary?.newCount || 0) > 0).length;
  const improved = comparisons.filter(c => (c.summary?.fixedCount || 0) > (c.summary?.newCount || 0)).length;

  const statsHtml = totalComparisons ? `
  <div class="integrity-grid" style="margin-bottom:24px">
    <div class="integrity-card">
      <strong>${totalComparisons}</strong><span>Total comparisons</span>
    </div>
    <div class="integrity-card"${withNew ? ' style="border-top:3px solid var(--rose)"' : ''}>
      <strong${withNew ? ' style="color:var(--rose)"' : ''}>${withNew}</strong>
      <span>With new findings</span>
    </div>
    <div class="integrity-card"${improved ? ' style="border-top:3px solid var(--emerald)"' : ''}>
      <strong${improved ? ' style="color:var(--emerald)"' : ''}>${improved}</strong>
      <span>Improved</span>
    </div>
    <div class="integrity-card">
      <strong>${totalComparisons - withNew - improved}</strong>
      <span>Unchanged</span>
    </div>
  </div>` : '';

  const listHtml = totalComparisons
    ? `<ul style="list-style:none;display:grid;gap:10px;padding:0">
        ${comparisons.map(c => {
          const newC = c.summary?.newCount || 0;
          const fixedC = c.summary?.fixedCount || 0;
          const changedC = c.summary?.changedCount || 0;
          const borderColor = newC > 0 ? 'var(--rose)' : fixedC > newC ? 'var(--emerald)' : 'var(--border)';
          return `<li style="background:var(--surface);border:1px solid var(--border);border-left:4px solid ${borderColor};border-radius:var(--radius);padding:16px 20px;display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap">
            <div style="min-width:0;flex:1">
              <div style="font-size:0.82rem;display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:6px">
                <span style="font-family:monospace;font-weight:600;background:var(--surface-2);border:1px solid var(--border);border-radius:4px;padding:2px 7px">${esc(c.baseline_url)}</span>
                <span style="color:var(--muted)">→</span>
                <span style="font-family:monospace;font-weight:600;background:var(--surface-2);border:1px solid var(--border);border-radius:4px;padding:2px 7px">${esc(c.current_url || c.baseline_url)}</span>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                <span class="badge ${newC > 0 ? 'badge-critical' : 'badge-ok'}">${newC} new</span>
                <span class="badge badge-ok">${fixedC} fixed</span>
                ${changedC ? `<span class="badge">${changedC} changed</span>` : ''}
                <span style="color:var(--muted);font-size:0.78rem">${fmtDate(c.created_at)}</span>
              </div>
            </div>
            <a class="sc-view" href="/comparisons/${c.id}" style="flex-shrink:0">View →</a>
          </li>`;
        }).join('')}
      </ul>`
    : `<div class="empty-state">
        <span class="empty-icon">📊</span>
        <div class="empty-title">No comparisons yet</div>
        <p class="empty-sub">Select two scans from the dashboard and click Compare to track changes over time.</p>
      </div>`;

  const body = `
<section class="content-section">
  <div class="inner">
    <div style="margin:0 0 20px">
      <h1 style="font-size:clamp(22px,3.4vw,30px);letter-spacing:-.03em;margin:0 0 4px">Scan comparisons</h1>
      <p style="color:var(--muted);font-size:0.9rem;margin:0">Track how findings change between scans of the same site.</p>
    </div>
    ${statsHtml}
    ${listHtml}
  </div>
</section>`;
  return appLayout('Scan comparisons', body, user, 'comparisons');
}

function reportsPage(scans, user) {
  const totalScans = scans.length;
  const criticalCount = scans.filter(s => s.findings?.CRITICAL > 0).length;
  const highCount = scans.filter(s => !s.findings?.CRITICAL && s.findings?.HIGH > 0).length;
  const cleanCount = scans.filter(s => !worstSeverity(s.findings) && s.scanStatus === 'ok').length;

  const regionOptions = Array.from(new Map(
    scans.filter(s => s.region?.key).map(s => [s.region.key, `${s.region.flag || ''} ${s.region.label || s.region.key}`])
  )).sort((a, b) => a[1].localeCompare(b[1]))
    .map(([key, label]) => `<option value="${esc(key)}">${esc(label.trim())}</option>`).join('');

  const statsHtml = totalScans ? `
  <div class="integrity-grid" style="margin-bottom:24px">
    <div class="integrity-card">
      <strong>${totalScans}</strong><span>Total reports</span>
    </div>
    <div class="integrity-card"${criticalCount ? ' style="border-top:3px solid var(--rose)"' : ''}>
      <strong${criticalCount ? ' style="color:var(--rose)"' : ''}>${criticalCount}</strong>
      <span>With criticals</span>
    </div>
    <div class="integrity-card"${highCount ? ' style="border-top:3px solid var(--amber,#f59e0b)"' : ''}>
      <strong>${highCount}</strong><span>With high</span>
    </div>
    <div class="integrity-card"${cleanCount ? ' style="border-top:3px solid var(--emerald)"' : ''}>
      <strong${cleanCount ? ' style="color:var(--emerald)"' : ''}>${cleanCount}</strong>
      <span>Clean</span>
    </div>
  </div>` : '';

  const listHtml = totalScans
    ? `<div class="history-tools" role="search" aria-label="Filter reports">
        <input class="history-filter" id="rpt-search" type="search" placeholder="Search domains, names, or CMPs" aria-label="Search reports">
        <select class="history-filter" id="rpt-severity" aria-label="Filter by severity">
          <option value="">All severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="review">Review</option>
          <option value="advisory">Advisory</option>
          <option value="clean">Clean</option>
        </select>
        <select class="history-filter" id="rpt-region" aria-label="Filter by region">
          <option value="">All regions</option>${regionOptions}
        </select>
        <select class="history-filter" id="rpt-date" aria-label="Filter by date">
          <option value="0">Any time</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
      </div>
      <p class="history-filter-status" id="rpt-filter-status" role="status"></p>
      <div id="compare-banner" class="compare-banner" hidden>
        <span>Baseline selected: <strong id="compare-baseline-url"></strong> — now click <strong>Compare</strong> on a second scan</span>
        <span id="compare-creating" hidden style="font-weight:700">Creating comparison…</span>
        <button class="compare-banner-cancel" id="compare-cancel">Cancel</button>
      </div>
      <ul class="scan-list" id="rpt-list">${scans.map(scanCard).join('')}</ul>
      <div class="history-empty-filtered" id="rpt-empty-filtered">No reports match these filters.</div>`
    : `<div class="empty-state">
        <span class="empty-icon">📋</span>
        <div class="empty-title">No reports yet</div>
        <p class="empty-sub">Start a scan to generate your first privacy report.</p>
      </div>`;

  const body = `
<section class="content-section">
  <div class="inner">
    <div class="history-hdr" style="margin:0 0 20px">
      <div>
        <h1 style="font-size:clamp(22px,3.4vw,30px);letter-spacing:-.03em;margin:0 0 4px">Reports</h1>
        <p style="color:var(--muted);font-size:0.9rem;margin:0">All completed privacy scans</p>
      </div>
    </div>
    ${statsHtml}
    ${listHtml}
  </div>
</section>
<script>
(function() {
  const search   = document.getElementById('rpt-search');
  const severity = document.getElementById('rpt-severity');
  const region   = document.getElementById('rpt-region');
  const date     = document.getElementById('rpt-date');
  const cards    = Array.from(document.querySelectorAll('#rpt-list .scan-card'));
  const status   = document.getElementById('rpt-filter-status');
  const empty    = document.getElementById('rpt-empty-filtered');
  if (!cards.length) return;
  function filter() {
    const q    = (search ? search.value : '').trim().toLowerCase();
    const sev  = severity ? severity.value : '';
    const reg  = region ? region.value : '';
    const days = Number(date ? date.value : 0);
    const cut  = days ? Date.now() - days * 86400000 : 0;
    let visible = 0;
    cards.forEach(function(card) {
      const ok = (!q || card.textContent.toLowerCase().includes(q))
        && (!sev || card.dataset.severity === sev)
        && (!reg || card.dataset.region === reg)
        && (!cut || new Date(card.dataset.scannedAt).getTime() >= cut);
      card.hidden = !ok;
      if (ok) visible++;
    });
    if (status) status.textContent = visible < cards.length ? 'Showing ' + visible + ' of ' + cards.length + ' reports' : '';
    if (empty)  empty.hidden = visible > 0;
  }
  [search, severity, region, date].forEach(function(el) { if (el) el.addEventListener('input', filter); });

  // ── Comparison mode ─────────────────────────────────────────────────────────
  var compareBaseline = null;
  var compareBanner   = document.getElementById('compare-banner');
  var compareBaseUrl  = document.getElementById('compare-baseline-url');
  var compareCreating = document.getElementById('compare-creating');
  var compareCancel   = document.getElementById('compare-cancel');

  function cancelCompare() {
    compareBaseline = null;
    if (compareBanner) compareBanner.hidden = true;
    document.querySelectorAll('.sc-compare-active').forEach(function(b) { b.classList.remove('sc-compare-active'); });
  }

  async function createComparison(baselineId, currentId) {
    if (compareCreating) compareCreating.hidden = false;
    try {
      var r = await fetch('/api/scan-comparisons', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baselineScanId: baselineId, currentScanId: currentId }),
      });
      var d = await r.json();
      if (d.id) { window.location.href = '/comparisons/' + d.id; }
      else { alert('Comparison failed: ' + (d.error || 'Unknown error')); cancelCompare(); }
    } catch (err) {
      alert('Comparison failed: ' + err.message);
      cancelCompare();
    }
    if (compareCreating) compareCreating.hidden = true;
  }

  document.querySelectorAll('.sc-compare').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var id  = Number(this.dataset.compareId);
      var url = this.dataset.compareUrl;
      if (!compareBaseline) {
        compareBaseline = { id: id, url: url };
        if (compareBanner) compareBanner.hidden = false;
        if (compareBaseUrl) compareBaseUrl.textContent = url;
        this.classList.add('sc-compare-active');
      } else if (compareBaseline.id === id) {
        cancelCompare();
      } else {
        createComparison(compareBaseline.id, id);
      }
    });
  });

  if (compareCancel) compareCancel.addEventListener('click', cancelCompare);
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape') cancelCompare(); });
})();
</script>`;
  return appLayout('Reports', body, user, 'reports');
}

function settingsPage(user) {
  const body = `
<section class="content-section">
<div class="inner" style="max-width:680px">
  <div style="margin:0 0 24px">
    <h1 style="font-size:clamp(22px,3.4vw,30px);letter-spacing:-.03em;margin:0 0 4px">Settings</h1>
    <p style="color:var(--muted);font-size:0.9rem;margin:0">Account and workspace preferences</p>
  </div>

  <!-- Profile card -->
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:24px;margin-bottom:16px">
    <h2 style="font-size:1rem;font-weight:700;margin:0 0 16px;letter-spacing:-.02em">Profile</h2>
    <div style="margin-bottom:14px">
      <label class="form-label" for="s-email">Email</label>
      <div style="font-size:0.9rem;color:var(--ink-2);padding:8px 12px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius-sm)">${esc(user?.email || '—')}</div>
      <p style="color:var(--muted);font-size:0.8rem;margin:4px 0 0">Email cannot be changed.</p>
    </div>
    <div style="display:grid;gap:14px">
      <div>
        <label class="form-label" for="s-name">Full name</label>
        <input class="name-input" type="text" id="s-name" value="${esc(user?.full_name || '')}" placeholder="Your name" autocomplete="name">
      </div>
      <div>
        <label class="form-label" for="s-org">Organisation</label>
        <input class="name-input" type="text" id="s-org" value="${esc(user?.organization_name || '')}" placeholder="Company or organisation" autocomplete="organization">
      </div>
      <div>
        <label class="form-label" for="s-role">Role</label>
        <input class="name-input" type="text" id="s-role" value="${esc(user?.organization_role || '')}" placeholder="e.g. Privacy Officer, DPO" autocomplete="organization-title">
      </div>
    </div>
    <div id="profile-msg" style="display:none;margin-top:12px;font-size:0.85rem;padding:8px 12px;border-radius:var(--radius-sm)"></div>
    <div style="margin-top:16px;display:flex;justify-content:flex-end">
      <button type="button" class="wizard-btn wizard-btn-primary" id="s-profile-save" style="min-width:120px">Save profile</button>
    </div>
  </div>

  <!-- Password card -->
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:24px;margin-bottom:16px">
    <h2 style="font-size:1rem;font-weight:700;margin:0 0 16px;letter-spacing:-.02em">Change password</h2>
    <div style="display:grid;gap:14px">
      <div>
        <label class="form-label" for="s-cur-pw">Current password</label>
        <input class="name-input" type="password" id="s-cur-pw" placeholder="••••••••" autocomplete="current-password">
      </div>
      <div>
        <label class="form-label" for="s-new-pw">New password</label>
        <input class="name-input" type="password" id="s-new-pw" placeholder="Min. 6 characters" autocomplete="new-password">
      </div>
      <div>
        <label class="form-label" for="s-conf-pw">Confirm new password</label>
        <input class="name-input" type="password" id="s-conf-pw" placeholder="Re-enter new password" autocomplete="new-password">
      </div>
    </div>
    <div id="pw-msg" style="display:none;margin-top:12px;font-size:0.85rem;padding:8px 12px;border-radius:var(--radius-sm)"></div>
    <div style="margin-top:16px;display:flex;justify-content:flex-end">
      <button type="button" class="wizard-btn wizard-btn-primary" id="s-pw-save" style="min-width:140px">Change password</button>
    </div>
  </div>

  <!-- API keys card -->
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:24px;margin-bottom:16px">
    <h2 style="font-size:1rem;font-weight:700;margin:0 0 4px;letter-spacing:-.02em">API keys</h2>
    <p style="color:var(--muted);font-size:0.82rem;margin:0 0 16px">Use API keys to access <code style="font-size:0.8rem;background:var(--surface-2);padding:1px 5px;border-radius:3px">/api/v1/scans</code> programmatically. Pass the key as a <code style="font-size:0.8rem;background:var(--surface-2);padding:1px 5px;border-radius:3px">Bearer</code> token in the <code style="font-size:0.8rem;background:var(--surface-2);padding:1px 5px;border-radius:3px">Authorization</code> header. Keys are shown once on creation.</p>

    <!-- New key revealed banner -->
    <div id="new-key-banner" style="display:none;margin-bottom:16px;padding:12px 14px;background:#ecfdf5;border:1px solid #6ee7b7;border-radius:var(--radius-sm)">
      <div style="font-size:0.82rem;font-weight:600;color:#065f46;margin-bottom:6px">Copy your new API key — it won't be shown again:</div>
      <div style="display:flex;gap:8px;align-items:center">
        <code id="new-key-value" style="flex:1;font-size:0.82rem;background:#fff;border:1px solid #a7f3d0;border-radius:4px;padding:6px 10px;word-break:break-all;color:#065f46"></code>
        <button type="button" onclick="copyNewKey()" class="wizard-btn" style="white-space:nowrap;padding:6px 12px;font-size:0.82rem">Copy</button>
      </div>
    </div>

    <!-- Existing keys list -->
    <div id="api-keys-list" style="margin-bottom:16px">
      <div style="color:var(--muted);font-size:0.85rem;padding:8px 0" id="api-keys-empty" style="display:none">No API keys yet.</div>
    </div>

    <!-- Create form -->
    <div style="display:flex;gap:8px;align-items:flex-end">
      <div style="flex:1">
        <label class="form-label" for="new-key-name" style="margin-bottom:4px">Key name</label>
        <input class="name-input" type="text" id="new-key-name" placeholder="e.g. CI pipeline, Zapier" maxlength="80">
      </div>
      <button type="button" class="wizard-btn wizard-btn-primary" id="create-key-btn" style="white-space:nowrap;margin-bottom:0">Create key</button>
    </div>
    <div id="key-msg" style="display:none;margin-top:10px;font-size:0.85rem;padding:8px 12px;border-radius:var(--radius-sm)"></div>
  </div>

  <!-- Account info card -->
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:24px;margin-bottom:16px">
    <h2 style="font-size:1rem;font-weight:700;margin:0 0 12px;letter-spacing:-.02em">Account</h2>
    <div style="display:grid;gap:8px;font-size:0.875rem;color:var(--ink-3)">
      <div style="display:flex;justify-content:space-between;gap:16px"><span>Member since</span><span>${esc(fmtDate(user?.created_at))}</span></div>
      <div style="display:flex;justify-content:space-between;gap:16px"><span>Account role</span><span>${esc(user?.role || 'user')}</span></div>
    </div>
  </div>

  <!-- Data & Activity card -->
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:24px">
    <h2 style="font-size:1rem;font-weight:700;margin:0 0 4px;letter-spacing:-.02em">Data &amp; Activity</h2>
    <p style="color:var(--muted);font-size:0.82rem;margin:0 0 16px">Review account activity and export scan evidence.</p>
    <div style="display:grid;gap:10px">
      <a href="/app/audit-log" class="sc-view" style="display:inline-flex;align-items:center;gap:6px;width:fit-content">View activity log →</a>
      <p style="color:var(--muted);font-size:0.8rem;margin:0">To export scan evidence, open a report and use the <strong>Download evidence</strong> button in the report header.</p>
    </div>
  </div>
</div>
<script>
(function() {
  function showMsg(id, text, isOk) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.style.display = 'block';
    el.style.background = isOk ? 'var(--emerald-light)' : 'var(--rose-light)';
    el.style.color = isOk ? '#065f46' : '#be123c';
    el.style.border = isOk ? '1px solid #a7f3d0' : '1px solid #fda4af';
  }

  var profileBtn = document.getElementById('s-profile-save');
  if (profileBtn) {
    profileBtn.addEventListener('click', async function() {
      profileBtn.disabled = true;
      profileBtn.textContent = 'Saving…';
      try {
        var r = await fetch('/api/profile', {
          method: 'PUT',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullName: document.getElementById('s-name').value.trim(),
            organizationName: document.getElementById('s-org').value.trim(),
            organizationRole: document.getElementById('s-role').value.trim(),
          }),
        });
        var d = await r.json();
        if (d.ok) showMsg('profile-msg', 'Profile saved.', true);
        else showMsg('profile-msg', d.error || 'Could not save profile.', false);
      } catch(_) {
        showMsg('profile-msg', 'Network error — could not reach server.', false);
      }
      profileBtn.disabled = false;
      profileBtn.textContent = 'Save profile';
    });
  }

  var pwBtn = document.getElementById('s-pw-save');
  if (pwBtn) {
    pwBtn.addEventListener('click', async function() {
      var cur  = document.getElementById('s-cur-pw').value;
      var nw   = document.getElementById('s-new-pw').value;
      var conf = document.getElementById('s-conf-pw').value;
      if (!cur || !nw || !conf) { showMsg('pw-msg', 'Please fill in all password fields.', false); return; }
      if (nw !== conf)          { showMsg('pw-msg', 'New passwords do not match.', false); return; }
      if (nw.length < 6)        { showMsg('pw-msg', 'Password must be at least 6 characters.', false); return; }
      pwBtn.disabled = true;
      pwBtn.textContent = 'Saving…';
      try {
        var r = await fetch('/api/change-password', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPassword: cur, newPassword: nw }),
        });
        var d = await r.json();
        if (d.ok) {
          showMsg('pw-msg', 'Password changed successfully.', true);
          document.getElementById('s-cur-pw').value = '';
          document.getElementById('s-new-pw').value = '';
          document.getElementById('s-conf-pw').value = '';
        } else {
          showMsg('pw-msg', d.error || 'Could not change password.', false);
        }
      } catch(_) {
        showMsg('pw-msg', 'Network error — could not reach server.', false);
      }
      pwBtn.disabled = false;
      pwBtn.textContent = 'Change password';
    });
  }

  // ── API Keys ──────────────────────────────────────────────────────
  var _newKeyRaw = '';

  function fmtKeyDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
  }

  function renderKeyRow(k) {
    var row = document.createElement('div');
    row.id = 'key-row-' + k.id;
    row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);font-size:0.85rem';
    row.innerHTML =
      '<div style="flex:1;min-width:0">' +
        '<div style="font-weight:600;color:var(--ink)">' + (k.name || '(unnamed)') + '</div>' +
        '<div style="color:var(--muted);font-size:0.78rem">Prefix: <code>' + k.key_prefix + '</code> &nbsp;·&nbsp; Created ' + fmtKeyDate(k.created_at) +
          (k.last_used_at ? ' &nbsp;·&nbsp; Last used ' + fmtKeyDate(k.last_used_at) : ' &nbsp;·&nbsp; Never used') +
        '</div>' +
      '</div>' +
      '<button type="button" onclick="deleteKey(' + k.id + ')" class="wizard-btn" style="color:#ef4444;border-color:#fca5a5;padding:4px 10px;font-size:0.8rem">Delete</button>';
    return row;
  }

  async function loadApiKeys() {
    try {
      var r = await fetch('/api/keys', { credentials: 'same-origin' });
      var d = await r.json();
      var list = document.getElementById('api-keys-list');
      var emptyMsg = document.getElementById('api-keys-empty');
      // clear existing rows
      Array.from(list.querySelectorAll('[id^="key-row-"]')).forEach(function(el) { el.remove(); });
      if (!d.keys || !d.keys.length) {
        if (emptyMsg) { emptyMsg.style.display = ''; emptyMsg.textContent = 'No API keys yet.'; }
        return;
      }
      if (emptyMsg) emptyMsg.style.display = 'none';
      d.keys.forEach(function(k) { list.appendChild(renderKeyRow(k)); });
    } catch(_) {}
  }

  window.deleteKey = async function(id) {
    if (!confirm('Delete this API key? Any integrations using it will stop working.')) return;
    try {
      var r = await fetch('/api/keys/' + id, { method: 'DELETE', credentials: 'same-origin' });
      var d = await r.json();
      if (d.ok) {
        var row = document.getElementById('key-row-' + id);
        if (row) row.remove();
        await loadApiKeys();
      } else {
        showMsg('key-msg', d.error || 'Could not delete key.', false);
      }
    } catch(_) {
      showMsg('key-msg', 'Network error.', false);
    }
  };

  window.copyNewKey = function() {
    if (!_newKeyRaw) return;
    navigator.clipboard.writeText(_newKeyRaw).then(function() {
      var btn = document.querySelector('#new-key-banner button');
      if (btn) { btn.textContent = 'Copied!'; setTimeout(function() { btn.textContent = 'Copy'; }, 2000); }
    }).catch(function() {
      prompt('Copy this key:', _newKeyRaw);
    });
  };

  var createKeyBtn = document.getElementById('create-key-btn');
  if (createKeyBtn) {
    createKeyBtn.addEventListener('click', async function() {
      var name = document.getElementById('new-key-name').value.trim();
      if (!name) { showMsg('key-msg', 'Please enter a name for this key.', false); return; }
      createKeyBtn.disabled = true;
      createKeyBtn.textContent = 'Creating…';
      try {
        var r = await fetch('/api/keys', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name }),
        });
        var d = await r.json();
        if (d.key) {
          _newKeyRaw = d.key;
          document.getElementById('new-key-value').textContent = d.key;
          document.getElementById('new-key-banner').style.display = '';
          document.getElementById('new-key-name').value = '';
          showMsg('key-msg', 'API key created. Copy it now — it won\'t be shown again.', true);
          await loadApiKeys();
        } else {
          showMsg('key-msg', d.error || 'Could not create key.', false);
        }
      } catch(_) {
        showMsg('key-msg', 'Network error.', false);
      }
      createKeyBtn.disabled = false;
      createKeyBtn.textContent = 'Create key';
    });
  }

  loadApiKeys();
})();
</script>
</section>`;
  return appLayout('Settings', body, user, 'settings');
}

function auditLogPage(entries, user) {
  const tableRows = entries.length
    ? entries.map(e => {
        const detail = e.details ? Object.entries(e.details).map(([k, v]) => `${k}: ${String(v).slice(0, 60)}`).join(' · ') : '';
        return `<tr>
          <td style="padding:7px 12px;border-bottom:1px solid var(--border);color:var(--muted);font-size:0.8rem;white-space:nowrap">${esc(fmtDate(e.created_at))}</td>
          <td style="padding:7px 12px;border-bottom:1px solid var(--border);font-weight:600">${esc(e.action)}</td>
          <td style="padding:7px 12px;border-bottom:1px solid var(--border);color:var(--muted)">${e.resource_type ? `${esc(e.resource_type)}${e.resource_id ? ' #' + e.resource_id : ''}` : '—'}</td>
          <td style="padding:7px 12px;border-bottom:1px solid var(--border);color:var(--muted);font-size:0.8rem">${esc(detail)}</td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="4" style="padding:24px;text-align:center;color:var(--muted)">No activity recorded yet.</td></tr>`;

  const body = `
<section class="content-section">
  <div class="inner">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin:0 0 20px">
      <div>
        <h1 style="font-size:clamp(22px,3.4vw,30px);letter-spacing:-.03em;margin:0 0 4px">Activity log</h1>
        <p style="color:var(--muted);font-size:0.9rem;margin:0">Recent account activity — last ${entries.length} events</p>
      </div>
      <a href="/app/settings" class="sc-view">← Settings</a>
    </div>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden">
      <table style="width:100%;border-collapse:collapse">
        <thead style="background:var(--surface-2)">
          <tr>
            <th style="padding:8px 12px;text-align:left;font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)">Time</th>
            <th style="padding:8px 12px;text-align:left;font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)">Action</th>
            <th style="padding:8px 12px;text-align:left;font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)">Resource</th>
            <th style="padding:8px 12px;text-align:left;font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)">Details</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
  </div>
</section>`;
  return appLayout('Activity log', body, user, 'settings');
}

function monitorSparkline(runs) {
  // runs ordered most-recent first; sparkline shows oldest→newest left→right
  const ordered = [...runs].reverse();
  if (!ordered.length) return '<span style="color:var(--muted);font-size:0.78rem">No runs yet</span>';
  const counts = ordered.map(r => r.new_critical_count || 0);
  const maxC = Math.max(...counts, 1);
  const W = 120, H = 32, barW = Math.max(2, Math.floor(W / counts.length) - 1);
  const bars = counts.map((c, i) => {
    const h = Math.max(2, Math.round((c / maxC) * H));
    const x = i * (barW + 1);
    const fill = c > 0 ? '#f87171' : '#4ade80';
    return `<rect x="${x}" y="${H - h}" width="${barW}" height="${h}" fill="${fill}" rx="1"/>`;
  }).join('');
  return `<svg width="${W}" height="${H}" style="display:block" title="Critical findings per run (oldest→newest)">${bars}</svg>`;
}

function monitorTrendChart(runs) {
  // runs ordered most-recent first; chart shows oldest→newest left→right
  const ordered = [...runs].reverse().slice(-30); // show up to last 30 runs
  if (ordered.length < 2) return '';
  const W = 600, H = 120, PAD_L = 32, PAD_B = 24, PAD_R = 8, PAD_T = 8;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;
  const counts = ordered.map(r => r.new_critical_count || 0);
  const maxC = Math.max(...counts, 1);
  const n = counts.length;
  const xStep = chartW / (n - 1);

  // Y-axis gridlines and labels
  const yTicks = [0, Math.ceil(maxC / 2), maxC];
  const gridLines = yTicks.map(v => {
    const y = PAD_T + chartH - Math.round((v / maxC) * chartH);
    return `<line x1="${PAD_L}" y1="${y}" x2="${W - PAD_R}" y2="${y}" stroke="#e2e8f0" stroke-width="1"/>
            <text x="${PAD_L - 4}" y="${y + 4}" text-anchor="end" font-size="10" fill="#94a3b8">${v}</text>`;
  }).join('');

  // Line path
  const points = counts.map((c, i) => {
    const x = PAD_L + Math.round(i * xStep);
    const y = PAD_T + chartH - Math.round((c / maxC) * chartH);
    return `${x},${y}`;
  });
  const linePath = `M ${points.join(' L ')}`;

  // Area fill
  const areaPath = `M ${PAD_L},${PAD_T + chartH} L ${points.join(' L ')} L ${PAD_L + Math.round((n - 1) * xStep)},${PAD_T + chartH} Z`;

  // Dots for alert runs
  const dots = ordered.map((r, i) => {
    const x = PAD_L + Math.round(i * xStep);
    const y = PAD_T + chartH - Math.round(((r.new_critical_count || 0) / maxC) * chartH);
    const fill = r.status === 'alert' ? '#ef4444' : '#10b981';
    const runAt = r.run_at ? new Date(r.run_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '';
    return `<circle cx="${x}" cy="${y}" r="3.5" fill="${fill}" title="${runAt}: ${r.new_critical_count || 0} critical"/>`;
  }).join('');

  // X-axis labels (first, middle, last)
  const xLabels = [0, Math.floor((n - 1) / 2), n - 1].map(i => {
    const x = PAD_L + Math.round(i * xStep);
    const d = ordered[i]?.run_at ? new Date(ordered[i].run_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '';
    return `<text x="${x}" y="${H - 4}" text-anchor="middle" font-size="9" fill="#94a3b8">${esc(d)}</text>`;
  }).join('');

  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:${W}px;height:auto;display:block" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="mg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ef4444" stop-opacity="0.15"/><stop offset="100%" stop-color="#ef4444" stop-opacity="0"/></linearGradient></defs>
    ${gridLines}
    <path d="${areaPath}" fill="url(#mg)"/>
    <path d="${linePath}" fill="none" stroke="#ef4444" stroke-width="2" stroke-linejoin="round"/>
    ${dots}
    ${xLabels}
  </svg>`;
}

function monitorsPage(monitors, user) {
  const cards = monitors.length
    ? monitors.map(m => {
        const lastRun = m.runs?.[0];
        const statusBadge = m.enabled
          ? '<span class="badge badge-ok">Active</span>'
          : '<span class="badge">Paused</span>';
        const lastStatus = lastRun
          ? `<span class="badge ${lastRun.status === 'ok' ? 'badge-ok' : lastRun.status === 'alert' ? 'badge-critical' : ''}">${esc(lastRun.status)}</span>`
          : '<span style="color:var(--muted);font-size:0.8rem">Never run</span>';
        const lastRunAt = lastRun?.run_at
          ? new Date(lastRun.run_at).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })
          : '—';
        const criticalLatest = lastRun ? lastRun.new_critical_count : null;
        const criticalBadge = criticalLatest === null ? '' : criticalLatest > 0
          ? `<span class="badge badge-critical">${criticalLatest} critical</span>`
          : `<span class="badge badge-ok">0 critical</span>`;
        return `<div class="mon-card">
  <div class="mon-card-top">
    <div class="mon-info">
      <div class="mon-name">${esc(m.name)} ${statusBadge}</div>
      <div class="mon-url">${esc(m.url)}</div>
      <div style="margin-top:6px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <span style="font-size:0.78rem;color:var(--muted)">${esc(m.schedule || '—')}</span>
        ${lastStatus}
        ${criticalBadge}
        <span style="font-size:0.78rem;color:var(--muted)">${esc(lastRunAt)}</span>
      </div>
    </div>
    <div class="mon-actions">
      <a class="sc-view" href="/app/monitors/${m.id}/history">History</a>
      <button class="sc-view" onclick="runMonitorNow(${m.id}, this)" style="background:none" title="Trigger an immediate scan">Run now</button>
      <button class="sc-view" onclick="toggleMonitorEnabled(${m.id}, ${m.enabled ? 'false' : 'true'}, this)" style="background:none" id="mon-toggle-${m.id}">${m.enabled ? 'Pause' : 'Resume'}</button>
      <button class="sc-view" onclick="editMonitor(${m.id})" style="background:none">Edit</button>
      <button class="sc-rescan" onclick="deleteMonitor(${m.id})">Delete</button>
    </div>
  </div>
  <div class="mon-trend">
    <div style="font-size:0.7rem;color:var(--muted);margin-bottom:4px">Critical findings trend (last ${m.runs?.length || 0} runs)</div>
    ${monitorSparkline(m.runs || [])}
  </div>
</div>`;
      }).join('')
    : `<div class="empty-state">
        <span class="empty-icon">⏰</span>
        <div class="empty-title">No monitors yet</div>
        <p class="empty-sub">Set up a recurring scan to track compliance over time and get alerts when new critical findings appear.</p>
        <button class="marketing-primary" onclick="createMonitor()" style="border:none;cursor:pointer;margin-top:12px">+ New monitor</button>
      </div>`;

  const body = `
<div class="inner">
  <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin:24px 0 18px">
    <div>
      <h1 style="font-size:clamp(22px,3.4vw,30px);letter-spacing:-.03em;margin:0">Monitors</h1>
      <p style="color:var(--muted);font-size:0.9rem;margin:6px 0 0">Recurring scans and alerting</p>
    </div>
    ${monitors.length ? `<button class="marketing-primary" onclick="createMonitor()" style="border:none;cursor:pointer">+ New monitor</button>` : ''}
  </div>
  <div style="display:grid;gap:16px">${cards}</div>
</div>
<style>
.mon-card { background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:18px 20px; }
.mon-card-top { display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap; }
.mon-info { flex:1;min-width:0; }
.mon-name { font-weight:700;font-size:0.95rem;display:flex;align-items:center;gap:8px;flex-wrap:wrap; }
.mon-url { font-family:monospace;font-size:0.78rem;color:var(--muted);margin-top:2px;word-break:break-all; }
.mon-actions { display:flex;gap:8px;flex-shrink:0; }
.mon-trend { margin-top:14px;padding-top:12px;border-top:1px solid var(--border); }
</style>
<script>
function createMonitor() { window.location.href = '/app/monitors/new'; }
function editMonitor(id) { window.location.href = '/app/monitors/' + id; }
async function deleteMonitor(id) {
  if (!confirm('Delete this monitor?')) return;
  await fetch('/api/monitors/' + id, { method: 'DELETE', credentials: 'same-origin' });
  window.location.reload();
}
async function runMonitorNow(id, btn) {
  if (!confirm('Trigger an immediate scan for this monitor?')) return;
  var orig = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Queuing…';
  try {
    var r = await fetch('/api/monitors/' + id + '/run-now', { method: 'POST', credentials: 'same-origin' });
    var d = await r.json();
    if (d.jobId) {
      btn.textContent = 'Queued ✓';
      setTimeout(function() { btn.disabled = false; btn.textContent = orig; }, 3000);
    } else {
      alert(d.error || 'Could not queue scan.');
      btn.disabled = false; btn.textContent = orig;
    }
  } catch(_) {
    alert('Network error.');
    btn.disabled = false; btn.textContent = orig;
  }
}
async function toggleMonitorEnabled(id, enable, btn) {
  var orig = btn.textContent;
  btn.disabled = true;
  try {
    var r = await fetch('/api/monitors/' + id + '/enabled', {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: enable }),
    });
    var d = await r.json();
    if (d.ok) {
      btn.textContent = enable ? 'Pause' : 'Resume';
      btn.onclick = function() { toggleMonitorEnabled(id, !enable, btn); };
      var card = btn.closest('.mon-card');
      if (card) {
        var badge = card.querySelector('.badge');
        if (badge) {
          badge.className = enable ? 'badge badge-ok' : 'badge';
          badge.textContent = enable ? 'Active' : 'Paused';
        }
      }
    } else {
      alert(d.error || 'Could not update monitor.');
    }
  } catch(_) { alert('Network error.'); }
  btn.disabled = false;
}
</script>`;
  return appLayout('Monitors', body, user, 'monitors');
}

function monitorFormPage(monitor, user) {
  const isEdit = !!monitor;
  const cfg = monitor?.scanConfig || {};
  const currentJourneys = cfg.journeys || ['no-interaction', 'accept-all', 'reject-all'];
  const journeyOpts = [
    ['no-interaction', 'No interaction (baseline)'],
    ['accept-all', 'Accept all'],
    ['reject-all', 'Reject all'],
    ['accept-analytics', 'Accept analytics only'],
    ['accept-advertising', 'Accept advertising only'],
    ['withdraw-consent', 'Withdraw consent'],
    ['revisit-after-consent', 'Revisit after consent'],
    ['gpc-comparison', 'GPC signal comparison'],
  ];
  const journeyChecks = journeyOpts.map(([val, label]) =>
    `<label style="display:flex;align-items:center;gap:8px;font-size:0.875rem;cursor:pointer">
      <input type="checkbox" name="m-journey" value="${val}" ${currentJourneys.includes(val) ? 'checked' : ''}>
      ${esc(label)}
    </label>`
  ).join('');

  const regionSel = (val) => [
    ['', 'Select a region', true],
    ['uk', '🇬🇧 English (UK) — Europe/London'],
    ['eu-de', '🇩🇪 German — Europe/Berlin'],
    ['eu-fr', '🇫🇷 French — Europe/Paris'],
    ['eu-es', '🇪🇸 Spanish — Europe/Madrid'],
    ['us', '🇺🇸 English (US) — America/New_York'],
    ['us-ca', '🇺🇸 English (US) — America/Los_Angeles'],
    ['ca', '🇨🇦 English (CA) — America/Toronto'],
    ['au', '🇦🇺 English (AU) — Australia/Sydney'],
    ['in', '🇮🇳 English (IN) — Asia/Kolkata'],
    ['jp', '🇯🇵 Japanese — Asia/Tokyo'],
    ['za', '🇿🇦 English (ZA) — Africa/Johannesburg'],
  ].map(([v, l, disabled]) =>
    `<option value="${v}"${disabled ? ' disabled' : ''}${val === v ? ' selected' : ''}>${esc(l)}</option>`
  ).join('');

  const body = `
<div class="inner" style="max-width:680px;padding-bottom:48px">
  <div style="margin:24px 0 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
    <div>
      <h1 style="font-size:clamp(22px,3.4vw,30px);letter-spacing:-.03em;margin:0">${isEdit ? 'Edit monitor' : 'New monitor'}</h1>
      <p style="color:var(--muted);font-size:0.9rem;margin:6px 0 0">Recurring scan with optional alerting</p>
    </div>
    <a href="/app/monitors" class="sc-view">← All monitors</a>
  </div>

  <div class="ns-card" style="margin-bottom:16px">
    <h2 class="ns-card-title">Target</h2>
    <div class="ns-grid-2">
      <div class="ns-field">
        <label class="form-label" for="m-name">Monitor name</label>
        <input class="name-input" id="m-name" placeholder="e.g. Acme homepage — UK" value="${esc(monitor?.name || '')}">
      </div>
      <div class="ns-field">
        <label class="form-label" for="m-url">Website URL <span style="color:var(--rose)">*</span></label>
        <input class="name-input" id="m-url" type="url" placeholder="https://example.com" value="${esc(monitor?.url || '')}" required>
      </div>
    </div>
  </div>

  <div class="ns-card" style="margin-bottom:16px">
    <h2 class="ns-card-title">Visitor context</h2>
    <div class="ns-grid-2">
      <div class="ns-field">
        <label class="form-label" for="m-region">Browser locale &amp; timezone <span style="color:var(--rose)">*</span></label>
        <select class="name-input" id="m-region" required>${regionSel(cfg.region || '')}</select>
      </div>
      <div class="ns-field">
        <label class="form-label" for="m-framework">Compliance framework</label>
        <select class="name-input" id="m-framework">
          <option value="uk-pecr" ${(!cfg.framework||cfg.framework==='uk-pecr')?'selected':''}>UK GDPR / PECR</option>
          <option value="ccpa-cpra" ${cfg.framework==='ccpa-cpra'?'selected':''}>California CCPA / CPRA</option>
          <option value="both" ${cfg.framework==='both'?'selected':''}>Both</option>
        </select>
      </div>
    </div>
  </div>

  <div class="ns-card" style="margin-bottom:16px">
    <h2 class="ns-card-title">Journeys</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">
      ${journeyChecks}
    </div>
  </div>

  <div class="ns-card" style="margin-bottom:16px">
    <h2 class="ns-card-title">Schedule</h2>
    <div class="ns-grid-2">
      <div class="ns-field">
        <label class="form-label" for="m-schedule">Cron expression</label>
        <input class="name-input" id="m-schedule" value="${esc(monitor?.schedule || '0 9 * * 1')}" placeholder="0 9 * * 1">
        <p class="form-hint">e.g. <code>0 9 * * 1</code> = every Monday 09:00. <a href="https://crontab.guru" target="_blank" rel="noopener" style="color:var(--accent)">crontab.guru</a></p>
      </div>
      <div class="ns-field">
        <label class="form-label" for="m-timezone">Timezone</label>
        <select class="name-input" id="m-timezone">
          ${['UTC','Europe/London','Europe/Berlin','Europe/Paris','America/New_York','America/Los_Angeles','America/Toronto','Australia/Sydney','Asia/Tokyo','Asia/Kolkata','Africa/Johannesburg']
            .map(tz => `<option value="${tz}" ${(monitor?.timezone||'UTC')===tz?'selected':''}>${esc(tz)}</option>`).join('')}
        </select>
      </div>
    </div>
  </div>

  <div class="ns-card" style="margin-bottom:24px">
    <h2 class="ns-card-title">Alerting</h2>
    <div class="ns-grid-2">
      <div class="ns-field">
        <label class="form-label" for="m-threshold">Alert when critical findings ≥</label>
        <input class="name-input" type="number" id="m-threshold" value="${esc(monitor?.threshold_critical ?? 1)}" min="0">
        <p class="form-hint">Set to 0 to always alert. Leave blank to disable critical threshold.</p>
      </div>
      <div class="ns-field">
        <label class="form-label" for="m-threshold-high">Alert when high findings ≥ <span class="opt">optional</span></label>
        <input class="name-input" type="number" id="m-threshold-high" value="${esc(monitor?.threshold_high ?? '')}" min="0" placeholder="e.g. 3">
        <p class="form-hint">Alert separately if high-severity findings reach this count. Leave blank to disable.</p>
      </div>
      <div class="ns-field">
        <label class="form-label" for="m-recipients">Notification emails</label>
        <input class="name-input" id="m-recipients" placeholder="alice@example.com, bob@example.com" value="${esc((monitor?.recipients || []).join(', '))}">
        <p class="form-hint">Comma-separated. Requires SMTP to be configured.</p>
      </div>
    </div>
    <div class="ns-field" style="margin-top:12px">
      <label class="form-label" for="m-webhook">Webhook URL <span style="font-weight:400;color:var(--muted)">(optional)</span></label>
      <div style="display:flex;gap:8px;align-items:center">
        <input class="name-input" id="m-webhook" type="url" placeholder="https://hooks.example.com/notify" value="${esc(monitor?.webhook_url || '')}" style="flex:1">
        <button type="button" class="wizard-btn" id="m-webhook-test" style="white-space:nowrap;flex-shrink:0" onclick="testWebhook()">Test</button>
      </div>
      <p class="form-hint">SPIDAC will POST a JSON payload to this URL on every monitor run. Useful for Slack, Teams, or custom integrations. Payload includes: <code style="font-size:0.78rem;background:var(--surface-2);padding:1px 4px;border-radius:3px">event</code>, <code style="font-size:0.78rem;background:var(--surface-2);padding:1px 4px;border-radius:3px">monitor</code> (id, name, url), <code style="font-size:0.78rem;background:var(--surface-2);padding:1px 4px;border-radius:3px">run</code> (status, criticalCount, highCount, runAt), <code style="font-size:0.78rem;background:var(--surface-2);padding:1px 4px;border-radius:3px">reportUrl</code>.</p>
      <div id="m-webhook-result" style="display:none;margin-top:6px;font-size:0.82rem;padding:6px 10px;border-radius:var(--radius-sm)"></div>
    </div>
  </div>

  <div style="display:flex;gap:12px;flex-wrap:wrap">
    <button id="m-save" class="marketing-primary" style="border:none;cursor:pointer">${isEdit ? 'Save changes' : 'Create monitor'}</button>
    <a href="/app/monitors" class="marketing-primary" style="text-decoration:none;background:#94a3b8">Cancel</a>
    <span id="m-err" style="color:var(--rose);font-size:0.875rem;align-self:center"></span>
  </div>
</div>
<script>
window.testWebhook = async function() {
  var webhookUrl = (document.getElementById('m-webhook').value || '').trim();
  var resultEl = document.getElementById('m-webhook-result');
  var btn = document.getElementById('m-webhook-test');
  if (!webhookUrl) { resultEl.textContent = 'Enter a webhook URL first.'; resultEl.style.display = ''; resultEl.style.background = 'var(--rose-light)'; resultEl.style.color = '#be123c'; return; }
  btn.disabled = true; btn.textContent = 'Testing…';
  try {
    var r = await fetch('/api/monitors/test-webhook', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhookUrl: webhookUrl }),
    });
    var d = await r.json();
    resultEl.style.display = '';
    if (d.ok) {
      resultEl.textContent = 'Webhook delivered successfully.';
      resultEl.style.background = 'var(--emerald-light)'; resultEl.style.color = '#065f46';
    } else {
      resultEl.textContent = 'Webhook failed: ' + (d.error || 'Unknown error');
      resultEl.style.background = 'var(--rose-light)'; resultEl.style.color = '#be123c';
    }
  } catch(_) {
    resultEl.textContent = 'Network error sending test.';
    resultEl.style.display = ''; resultEl.style.background = 'var(--rose-light)'; resultEl.style.color = '#be123c';
  }
  btn.disabled = false; btn.textContent = 'Test';
};

(function() {
  document.getElementById('m-save').addEventListener('click', async function() {
    var url = (document.getElementById('m-url').value || '').trim();
    var region = document.getElementById('m-region').value;
    if (!url) { document.getElementById('m-err').textContent = 'URL is required.'; return; }
    if (!region) { document.getElementById('m-err').textContent = 'Region is required.'; return; }
    var journeys = Array.from(document.querySelectorAll('input[name="m-journey"]:checked')).map(function(el){ return el.value; });
    if (!journeys.length) journeys = ['no-interaction', 'accept-all', 'reject-all'];
    var payload = {
      name: (document.getElementById('m-name').value || '').trim(),
      url: url,
      schedule: (document.getElementById('m-schedule').value || '0 9 * * 1').trim(),
      timezone: document.getElementById('m-timezone').value,
      thresholdCritical: Number(document.getElementById('m-threshold').value || 1),
      thresholdHigh: document.getElementById('m-threshold-high').value !== '' ? Number(document.getElementById('m-threshold-high').value) : null,
      recipients: (document.getElementById('m-recipients').value || '').split(',').map(function(s){ return s.trim(); }).filter(Boolean),
      webhookUrl: (document.getElementById('m-webhook').value || '').trim() || null,
      scanConfig: {
        region: region,
        framework: document.getElementById('m-framework').value,
        scanType: 'consent',
        scanProfile: 'standard',
        crawlMode: 'homepage',
        journeys: journeys,
      },
    };
    var method = ${isEdit ? `'PUT'` : `'POST'`};
    var apiUrl = ${isEdit ? `'/api/monitors/${monitor.id}'` : `'/api/monitors'`};
    var r = await fetch(apiUrl, { method: method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (r.ok) { window.location.href = '/app/monitors'; }
    else { var d = await r.json().catch(function(){ return {}; }); document.getElementById('m-err').textContent = d.error || 'Save failed.'; }
  });
})();
</script>`;
  return appLayout(isEdit ? 'Edit monitor' : 'New monitor', body, user, 'monitors');
}

function newScanPage(user, seed = {}) {
  const body = `
<div class="ns-page">

  <!-- Page header -->
  <div class="ns-page-header">
    <div class="ns-page-header-inner">
      <div>
        <div class="ns-breadcrumb"><a href="/app">Dashboard</a> <span>/</span> New scan</div>
        <h1 class="ns-page-title">New scan</h1>
        <p class="ns-page-sub">Set the target, visitor context, and journeys to test. We will handle the rest.</p>
      </div>
    </div>
  </div>

  <div class="ns-layout">
    <div class="ns-form-col">

  <!-- Section: Target -->
  <div class="ns-card">
    <div class="ns-card-head">
      <span class="ns-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg></span>
      <h2 class="ns-section-title">Target</h2>
    </div>
    <div class="ns-grid-2">
      <div class="ns-field ns-span-2">
        <label class="form-label" for="ns-url">Website URL <span class="ns-req">required</span></label>
        <input class="name-input" type="url" id="ns-url" value="${esc(seed.url || '')}" placeholder="https://example.com" required autofocus autocomplete="off">
      </div>
      <div class="ns-field">
        <label class="form-label" for="ns-name">Scan name <span class="opt">optional</span></label>
        <input class="name-input" type="text" id="ns-name" value="${esc(seed.name || '')}" placeholder="e.g. Client A Q2 audit" autocomplete="off">
      </div>
      <div class="ns-field">
        <label class="form-label" for="ns-pages">Pages to scan</label>
        <input class="name-input" type="number" id="ns-pages" value="${esc(seed.pages || '1')}" min="1" max="50" step="1" inputmode="numeric">
        <p class="form-hint">1 = homepage only, up to 50</p>
      </div>
    </div>
  </div>

  <!-- Section: Visitor context -->
  <div class="ns-card">
    <div class="ns-card-head">
      <span class="ns-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/></svg></span>
      <h2 class="ns-section-title">Visitor context</h2>
    </div>
    <div class="ns-grid-2">
      <div class="ns-field">
        <label class="form-label" for="ns-region">Browser locale &amp; timezone <span style="color:var(--rose)">*</span></label>
        <select id="ns-region" class="name-input">
          <option value="" disabled ${!seed.region ? 'selected' : ''}>Select a region</option>
          <optgroup label="Europe">
            <option value="uk" ${seed.region==='uk'?'selected':''}>🇬🇧 English (UK) — Europe/London</option>
            <option value="eu-de" ${seed.region==='eu-de'?'selected':''}>🇩🇪 German — Europe/Berlin</option>
            <option value="eu-fr" ${seed.region==='eu-fr'?'selected':''}>🇫🇷 French — Europe/Paris</option>
            <option value="eu-es" ${seed.region==='eu-es'?'selected':''}>🇪🇸 Spanish — Europe/Madrid</option>
          </optgroup>
          <optgroup label="Americas">
            <option value="us" ${seed.region==='us'?'selected':''}>🇺🇸 English (US) — America/New_York</option>
            <option value="us-ca" ${seed.region==='us-ca'?'selected':''}>🇺🇸 English (US) — America/Los_Angeles</option>
            <option value="ca" ${seed.region==='ca'?'selected':''}>🇨🇦 English (CA) — America/Toronto</option>
            <option value="br" ${seed.region==='br'?'selected':''}>🇧🇷 Portuguese — America/Sao_Paulo</option>
          </optgroup>
          <optgroup label="Asia-Pacific">
            <option value="au" ${seed.region==='au'?'selected':''}>🇦🇺 English (AU) — Australia/Sydney</option>
            <option value="in" ${seed.region==='in'?'selected':''}>🇮🇳 English (IN) — Asia/Kolkata</option>
            <option value="jp" ${seed.region==='jp'?'selected':''}>🇯🇵 Japanese — Asia/Tokyo</option>
          </optgroup>
          <optgroup label="Africa">
            <option value="za" ${seed.region==='za'?'selected':''}>🇿🇦 English (ZA) — Africa/Johannesburg</option>
          </optgroup>
        </select>
        <p class="form-hint">Sets browser language, timezone, and Accept-Language header.</p>
      </div>
      <div class="ns-field">
        <label class="form-label" for="ns-framework">Compliance framework</label>
        <select id="ns-framework" class="name-input">
          <option value="uk-pecr" ${(!seed.framework||seed.framework==='uk-pecr')?'selected':''}>UK GDPR / PECR</option>
          <option value="ccpa-cpra" ${seed.framework==='ccpa-cpra'?'selected':''}>California CCPA / CPRA</option>
          <option value="both" ${seed.framework==='both'?'selected':''}>UK GDPR / PECR + CCPA / CPRA</option>
        </select>
        <p class="form-hint">Controls the legal context and which privacy signals are tested.</p>
      </div>
      <div class="ns-field">
        <label class="form-label" for="ns-scan-type">Scan type</label>
        <select id="ns-scan-type" class="name-input">
          <option value="consent" ${(!seed.scanType||seed.scanType==='consent')?'selected':''}>Consent and cookie controls</option>
          <option value="ccpa-signals" ${seed.scanType==='ccpa-signals'?'selected':''}>California privacy signals</option>
          <option value="full" ${seed.scanType==='full'?'selected':''}>Full consent and privacy signals</option>
        </select>
      </div>
      <div class="ns-field">
        <label class="form-label" for="ns-scan-profile">Assurance depth</label>
        <select id="ns-scan-profile" class="name-input">
          <option value="quick" ${seed.scanProfile==='quick'?'selected':''}>Quick check</option>
          <option value="standard" ${(!seed.scanProfile||seed.scanProfile==='standard')?'selected':''}>Standard assurance</option>
          <option value="deep" ${seed.scanProfile==='deep'?'selected':''}>Deep assurance</option>
        </select>
        <p class="form-hint">Deep mode uses planned interactions to reveal lazy-loaded content.</p>
      </div>
    </div>
  </div>

  <!-- Section: Crawl scope -->
  <div class="ns-card">
    <div class="ns-card-head">
      <span class="ns-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg></span>
      <h2 class="ns-section-title">Crawl scope</h2>
    </div>
    <div class="ns-grid-2">
      <div class="ns-field">
        <label class="form-label" for="ns-crawl-mode">Crawl mode</label>
        <select id="ns-crawl-mode" class="name-input">
          <option value="homepage" ${(!seed.crawlMode||seed.crawlMode==='homepage')?'selected':''}>Homepage only</option>
          <option value="linked-pages" ${seed.crawlMode==='linked-pages'?'selected':''}>Linked pages</option>
          <option value="sitemap" ${seed.crawlMode==='sitemap'?'selected':''}>Sitemap</option>
          <option value="deep" ${seed.crawlMode==='deep'?'selected':''}>Deep interactive</option>
        </select>
      </div>
      <div class="ns-field">
        <label class="form-label" for="ns-subdomain-policy">Subdomain policy</label>
        <select id="ns-subdomain-policy" class="name-input">
          <option value="same-domain" ${(!seed.subdomainPolicy||seed.subdomainPolicy==='same-domain')?'selected':''}>Same domain only</option>
          <option value="subdomains" ${seed.subdomainPolicy==='subdomains'?'selected':''}>Include subdomains</option>
        </select>
      </div>
      <div class="ns-field">
        <label class="form-label" for="ns-include-patterns">Include paths <span class="opt">optional</span></label>
        <textarea class="name-input" id="ns-include-patterns" rows="2" placeholder="/checkout&#10;/blog/*">${esc(seed.includePatterns || '')}</textarea>
      </div>
      <div class="ns-field">
        <label class="form-label" for="ns-exclude-patterns">Exclude paths <span class="opt">optional</span></label>
        <textarea class="name-input" id="ns-exclude-patterns" rows="2" placeholder="/account/*">${esc(seed.excludePatterns || '')}</textarea>
      </div>
      <div class="ns-field ns-span-2">
        <label class="check-row" style="color:var(--ink-2);font-size:0.9rem">
          <input type="checkbox" id="ns-interactive" ${seed.interactive !== false ? 'checked' : ''}> Enable interactive discovery (scroll, expand menus, click embeds)
        </label>
      </div>
    </div>
  </div>

  <!-- Section: Journeys -->
  <div class="ns-card">
    <div class="ns-card-head">
      <span class="ns-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></span>
      <h2 class="ns-section-title">Consent journeys</h2>
    </div>
    <p style="color:var(--muted);font-size:0.875rem;margin:0 0 16px">Select which visitor journeys to simulate. Each journey runs in its own browser context.</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px">
      <label class="ns-journey-card"><input type="checkbox" name="ns-journey" value="no-interaction" checked> <div><strong>Before consent</strong><p>Record cookies and requests before any consent action.</p></div></label>
      <label class="ns-journey-card"><input type="checkbox" name="ns-journey" value="accept-all" checked> <div><strong>Accept all</strong><p>Click accept all and capture the full cookie footprint.</p></div></label>
      <label class="ns-journey-card"><input type="checkbox" name="ns-journey" value="reject-all" checked> <div><strong>Reject all</strong><p>Click reject all and check for post-rejection tracking.</p></div></label>
      <label class="ns-journey-card"><input type="checkbox" name="ns-journey" value="open-preferences"> <div><strong>Open preferences</strong><p>Open the preference centre and capture its state.</p></div></label>
      <label class="ns-journey-card"><input type="checkbox" name="ns-journey" value="accept-analytics"> <div><strong>Analytics only</strong><p>Accept analytics cookies and isolate their footprint.</p></div></label>
      <label class="ns-journey-card"><input type="checkbox" name="ns-journey" value="accept-advertising"> <div><strong>Advertising only</strong><p>Accept advertising cookies and isolate their footprint.</p></div></label>
      <label class="ns-journey-card"><input type="checkbox" name="ns-journey" value="withdraw-consent"> <div><strong>Withdraw consent</strong><p>Accept then withdraw — check for retained cookies.</p></div></label>
      <label class="ns-journey-card"><input type="checkbox" name="ns-journey" value="revisit-after-consent"> <div><strong>Revisit after consent</strong><p>Accept, then revisit the page — check persistence.</p></div></label>
      <label class="ns-journey-card"><input type="checkbox" name="ns-journey" value="gpc-comparison"> <div><strong>GPC comparison</strong><p>Run twice — with and without GPC — to detect signal-responsive suppression.</p></div></label>
    </div>
  </div>

  <!-- Section: Custom journey -->
  <div class="ns-card">
    <div class="ns-card-head">
      <span class="ns-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></span>
      <h2 class="ns-section-title">Custom journey <span class="opt" style="font-size:0.78rem;font-weight:500;vertical-align:middle">optional</span></h2>
    </div>
    <p style="color:var(--muted);font-size:0.875rem;margin:0 0 14px">Build a step-by-step visitor journey to simulate real user behaviour.</p>
    <div id="ns-journey-steps" style="display:grid;gap:10px;margin-bottom:14px"></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
      <div style="flex:1 1 160px">
        <label class="form-label" for="ns-step-type">Step type</label>
        <select id="ns-step-type" class="name-input">
          <option value="click">Click selector</option>
          <option value="open-preferences">Open preferences</option>
          <option value="toggle-category">Toggle category</option>
          <option value="save">Save choices</option>
          <option value="navigate">Navigate to URL</option>
          <option value="scroll">Scroll</option>
          <option value="wait">Wait for condition</option>
        </select>
      </div>
      <div style="flex:2 1 240px">
        <label class="form-label" for="ns-step-value">Selector / value</label>
        <input class="name-input" id="ns-step-value" placeholder=".accept-btn, /checkout, 1000ms">
      </div>
      <button type="button" class="wizard-btn wizard-btn-ghost" id="ns-add-step" style="height:38px;background:var(--surface-2);color:var(--ink);border:1px solid var(--border)">Add step</button>
    </div>
  </div>

      <!-- Error + Submit -->
      <div id="ns-error" class="ns-error-box" style="display:none"></div>
      <div class="ns-submit-bar">
        <a href="/app" class="ns-cancel-link">Cancel</a>
        <button type="button" id="ns-start" class="ns-start-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          Start scan
        </button>
      </div>
      <div id="ns-progress" class="ns-progress-state" style="display:none">
        <div class="spinner" style="width:24px;height:24px;border-width:3px;margin:0 auto 12px"></div>
        <p class="ns-progress-label">Queuing scan...</p>
        <p class="ns-progress-sub">You will be redirected to the live progress page.</p>
      </div>

    </div><!-- /ns-form-col -->

    <!-- Sidebar: help hints -->
    <aside class="ns-sidebar">
      <div class="ns-help-card">
        <div class="ns-help-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>
        <h3>Quick tips</h3>
        <ul class="ns-help-list">
          <li>Start with <strong>UK</strong> or <strong>US</strong> region for most sites.</li>
          <li>Run at least <strong>Before consent</strong>, <strong>Accept all</strong>, and <strong>Reject all</strong> journeys for a baseline report.</li>
          <li>Use <strong>Standard assurance</strong> depth for routine checks. Deep assurance is best for quarterly audits.</li>
          <li>Keep pages at <strong>1</strong> for a quick homepage check; increase to crawl a wider sample.</li>
        </ul>
      </div>
      <div class="ns-help-card" style="margin-top:12px">
        <div class="ns-help-icon" style="background:#ecfdf5;color:#059669"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
        <h3>What we test</h3>
        <ul class="ns-help-list">
          <li>Cookies set before and after consent choices</li>
          <li>Consent Management Platform (CMP) detection</li>
          <li>Cookie category accuracy</li>
          <li>Rejected-consent tracking</li>
          <li>Privacy signal support (GPC)</li>
        </ul>
      </div>
    </aside>
  </div><!-- /ns-layout -->
</div><!-- /ns-page -->
<style>
.ns-page { min-height: calc(100vh - 64px); }
.ns-page-header { background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); padding: 32px var(--gutter) 28px; }
.ns-page-header-inner { max-width: 1160px; margin: 0 auto; }
.ns-breadcrumb { font-size: 12px; color: rgba(255,255,255,0.4); margin-bottom: 10px; }
.ns-breadcrumb a { color: rgba(255,255,255,0.5); text-decoration: none; }
.ns-breadcrumb a:hover { color: rgba(255,255,255,0.8); }
.ns-breadcrumb span { margin: 0 6px; }
.ns-page-title { font-size: clamp(22px,3vw,28px); font-weight: 800; letter-spacing: -.04em; color: #fff; margin: 0 0 6px; }
.ns-page-sub { font-size: 14px; color: rgba(255,255,255,0.55); margin: 0; }
.ns-layout { display: grid; grid-template-columns: 1fr 280px; gap: 24px; max-width: 1160px; margin: 0 auto; padding: 28px var(--gutter) 64px; align-items: start; }
@media(max-width:900px) { .ns-layout { grid-template-columns: 1fr; } .ns-sidebar { display: none; } }
.ns-form-col { display: flex; flex-direction: column; gap: 0; }
.ns-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 22px 24px; margin-bottom: 14px; }
.ns-card-head { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; }
.ns-card-icon { width: 30px; height: 30px; border-radius: 8px; background: #eef2ff; color: var(--accent); display: grid; place-items: center; flex-shrink: 0; }
.ns-card-icon svg { width: 15px; height: 15px; }
.ns-section-title { font-size: 15px; font-weight: 700; letter-spacing: -.02em; margin: 0; color: var(--ink); }
.ns-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media(max-width:600px) { .ns-grid-2 { grid-template-columns: 1fr; } }
.ns-span-2 { grid-column: 1 / -1; }
.ns-field { display: flex; flex-direction: column; gap: 5px; }
.ns-req { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--rose); vertical-align: middle; margin-left: 4px; }
.ns-journey-card { display: flex; align-items: flex-start; gap: 10px; background: var(--surface-2); border: 1.5px solid var(--border); border-radius: var(--radius-sm); padding: 12px 14px; cursor: pointer; transition: border-color .15s, background .15s; }
.ns-journey-card:hover { border-color: var(--accent); background: #eef2ff; }
.ns-journey-card input[type=checkbox] { margin-top: 3px; flex-shrink: 0; accent-color: var(--accent); }
.ns-journey-card strong { display: block; font-size: 13px; font-weight: 700; color: var(--ink); margin-bottom: 2px; }
.ns-journey-card p { font-size: 12px; color: var(--muted); margin: 0; line-height: 1.4; }
.ns-step-row { display: flex; justify-content: space-between; align-items: center; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-xs); padding: 9px 12px; font-size: 13px; }
.ns-error-box { background: var(--rose-light); border: 1px solid #fda4af; color: #be123c; border-radius: var(--radius-sm); padding: 12px 16px; margin-bottom: 16px; font-size: 14px; }
.ns-submit-bar { display: flex; justify-content: flex-end; gap: 12px; align-items: center; padding: 16px 0 4px; }
.ns-cancel-link { color: var(--muted); font-size: 14px; text-decoration: none; padding: 8px 0; }
.ns-cancel-link:hover { color: var(--ink); }
.ns-start-btn { display: inline-flex; align-items: center; gap: 8px; background: var(--accent); color: #fff; border: none; border-radius: var(--radius-sm); padding: 11px 28px; font-size: 15px; font-weight: 700; cursor: pointer; font-family: inherit; transition: background .15s, transform .1s, box-shadow .15s; box-shadow: 0 2px 8px rgba(99,102,241,.3); }
.ns-start-btn:hover { background: var(--accent-hover); transform: translateY(-1px); box-shadow: 0 4px 14px rgba(99,102,241,.4); }
.ns-start-btn:disabled { background: #94a3b8; cursor: not-allowed; transform: none; box-shadow: none; }
.ns-progress-state { text-align: center; padding: 28px 0; }
.ns-progress-label { font-weight: 700; color: var(--ink-2); margin: 0 0 6px; }
.ns-progress-sub { color: var(--muted); font-size: 13px; margin: 0; }
.ns-sidebar { display: flex; flex-direction: column; gap: 0; position: sticky; top: 88px; }
.ns-help-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 18px 20px; }
.ns-help-icon { width: 32px; height: 32px; border-radius: 8px; background: #eef2ff; color: var(--accent); display: grid; place-items: center; margin-bottom: 10px; }
.ns-help-icon svg { width: 16px; height: 16px; }
.ns-help-card h3 { font-size: 13px; font-weight: 700; color: var(--ink); margin: 0 0 10px; }
.ns-help-list { list-style: none; display: flex; flex-direction: column; gap: 7px; }
.ns-help-list li { font-size: 13px; color: var(--muted); line-height: 1.45; padding-left: 14px; position: relative; }
.ns-help-list li::before { content: ''; position: absolute; left: 0; top: 7px; width: 5px; height: 5px; border-radius: 50%; background: var(--border-2); }
</style>
<script>
(function() {
  'use strict';
  var customSteps = [];

  function renderSteps() {
    var container = document.getElementById('ns-journey-steps');
    if (!container) return;
    container.innerHTML = customSteps.map(function(step, i) {
      return '<div class="ns-step-row"><span><strong>' + escHtml(step.type) + '</strong>: ' + escHtml(step.value || '—') + '</span>'
           + '<button type="button" onclick="nsRemoveStep(' + i + ')" style="background:none;border:none;color:var(--rose);cursor:pointer;font-size:12px;padding:2px 6px">Remove</button></div>';
    }).join('');
  }

  function escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  window.nsRemoveStep = function(i) { customSteps.splice(i,1); renderSteps(); };

  var addBtn = document.getElementById('ns-add-step');
  if (addBtn) {
    addBtn.addEventListener('click', function() {
      var type  = document.getElementById('ns-step-type').value;
      var value = document.getElementById('ns-step-value').value.trim();
      if (!value) return;
      customSteps.push({ type: type, value: value });
      document.getElementById('ns-step-value').value = '';
      renderSteps();
    });
  }

  var startBtn = document.getElementById('ns-start');
  var errBox   = document.getElementById('ns-error');
  var progress = document.getElementById('ns-progress');

  if (startBtn) {
    startBtn.addEventListener('click', async function() {
      var url     = (document.getElementById('ns-url').value || '').trim();
      var name    = (document.getElementById('ns-name').value || '').trim() || null;
      var pages   = parseInt(document.getElementById('ns-pages').value || '1', 10);
      var region  = document.getElementById('ns-region').value || null;
      var framework = document.getElementById('ns-framework').value || 'uk-pecr';
      var scanType  = document.getElementById('ns-scan-type').value || 'consent';
      var scanProfile = document.getElementById('ns-scan-profile').value || 'standard';
      var crawlMode = document.getElementById('ns-crawl-mode').value || 'homepage';
      var subdomainPolicy = document.getElementById('ns-subdomain-policy').value || 'same-domain';
      var interactive = document.getElementById('ns-interactive').checked;
      var journeys = Array.from(document.querySelectorAll('input[name="ns-journey"]:checked')).map(function(el) { return el.value; });
      var includePatterns = (document.getElementById('ns-include-patterns').value || '').trim();
      var excludePatterns = (document.getElementById('ns-exclude-patterns').value || '').trim();

      if (!url) { showErr('Please enter a website URL.'); document.getElementById('ns-url').focus(); return; }
      try { var p = new URL(url); if (!/^https?:$/.test(p.protocol)) throw new Error(); } catch(_) { showErr('Enter a valid URL beginning with http:// or https://.'); return; }
      if (!region) { showErr('Select the visitor region for this scan.'); document.getElementById('ns-region').focus(); return; }
      if (!journeys.length && !customSteps.length) { showErr('Select at least one consent journey to run.'); return; }
      if (!Number.isInteger(pages) || pages < 1 || pages > 50) { showErr('Pages must be between 1 and 50.'); return; }

      errBox.style.display = 'none';
      startBtn.disabled = true;
      startBtn.textContent = 'Starting…';
      if (progress) progress.style.display = 'block';

      try {
        var r = await fetch('/scan', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: url, name: name, maxPages: pages, region: region, framework: framework, scanType: scanType, scanProfile: scanProfile, crawlMode: crawlMode, journeys: journeys, includePatterns: includePatterns, excludePatterns: excludePatterns, subdomainPolicy: subdomainPolicy, interactive: interactive, customJourneys: customSteps }),
        });
        var data = await r.json();
        if (data.error) { showErr(data.error); startBtn.disabled = false; startBtn.textContent = 'Start scan'; if (progress) progress.style.display = 'none'; return; }
        window.location.href = '/progress/' + data.jobId;
      } catch(e) {
        showErr('Could not reach the server. Please try again.');
        startBtn.disabled = false;
        startBtn.textContent = 'Start scan';
        if (progress) progress.style.display = 'none';
      }
    });
  }

  function showErr(msg) {
    if (!errBox) return;
    errBox.textContent = msg;
    errBox.style.display = 'block';
    errBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
})();
</script>`;
  return appLayout('New scan', body, user, 'dashboard');
}

function remediationsPage(remediations, user) {
  const statusCls = { open: 'badge-critical', investigating: 'badge-manual', fixed: 'badge-ok', 'accepted risk': '' };
  const priorityCls = { critical: 'cat-critical', high: 'cat-analytics', medium: 'cat-preferences', low: 'cat-strictly-necessary' };

  // Group by status
  const groups = [
    { key: 'open', label: 'Open' },
    { key: 'investigating', label: 'Investigating' },
    { key: 'fixed', label: 'Fixed' },
    { key: 'accepted risk', label: 'Accepted risk' },
  ];

  const totalOpen = remediations.filter(r => r.status === 'open').length;
  const totalInv = remediations.filter(r => r.status === 'investigating').length;
  const totalFixed = remediations.filter(r => r.status === 'fixed').length;
  const totalOverdue = remediations.filter(r => r.due_date && new Date(r.due_date) < new Date() && r.status !== 'fixed' && r.status !== 'accepted risk').length;

  const statsHtml = `
  <div class="integrity-grid" style="margin-bottom:24px">
    <div class="integrity-card" style="border-top:3px solid var(--rose)">
      <strong style="color:var(--rose)">${totalOpen}</strong><span>Open</span>
    </div>
    <div class="integrity-card" style="border-top:3px solid var(--amber,#f59e0b)">
      <strong>${totalInv}</strong><span>Investigating</span>
    </div>
    <div class="integrity-card" style="border-top:3px solid var(--emerald)">
      <strong style="color:var(--emerald)">${totalFixed}</strong><span>Fixed</span>
    </div>
    <div class="integrity-card"${totalOverdue ? ' style="border-top:3px solid var(--rose)"' : ''}>
      <strong${totalOverdue ? ' style="color:var(--rose)"' : ''}>${totalOverdue}</strong><span>Overdue</span>
    </div>
  </div>`;

  const groupBlocks = groups.map(g => {
    const items = remediations.filter(r => r.status === g.key);
    if (!items.length) return '';
    const rows = items.map(r => {
      const due = r.due_date ? new Date(r.due_date).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—';
      const overdue = r.due_date && new Date(r.due_date) < new Date() && r.status !== 'fixed' && r.status !== 'accepted risk';
      const scanLabel = r.scan_name || (r.scan_url ? new URL(r.scan_url).hostname : `Scan #${r.scan_id}`);
      return `<tr>
        <td><span class="finding-id">${esc(r.finding_id)}</span></td>
        <td><span class="cat-pill ${priorityCls[r.priority] || ''}" style="font-size:0.68rem">${esc(r.priority)}</span></td>
        <td style="font-size:0.82rem;color:var(--muted)">${esc(scanLabel)}</td>
        <td style="font-size:0.82rem;color:${overdue ? 'var(--rose)' : 'inherit'}">${esc(due)}${overdue ? ' ⚠' : ''}</td>
        <td style="font-size:0.82rem;color:var(--muted)">${esc(r.owner_email || '—')}</td>
        <td style="font-size:0.82rem;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(r.notes || '')}">${esc(r.notes || '—')}</td>
        <td><a class="sc-view" href="/reports/${r.scan_id}">View report</a></td>
      </tr>`;
    }).join('');
    return `<div style="margin-bottom:28px">
      <h2 style="font-size:1rem;font-weight:700;letter-spacing:-.02em;margin:0 0 10px;display:flex;align-items:center;gap:8px">
        <span class="badge ${statusCls[g.key] || ''}">${esc(g.label)}</span>
        <span style="font-weight:500;color:var(--muted);font-size:0.88rem">${items.length}</span>
      </h2>
      <div style="overflow-x:auto;border:1px solid var(--border);border-radius:var(--radius-sm)">
        <table class="cookie-table" style="border:none">
          <thead><tr><th>Finding ID</th><th>Priority</th><th>Scan</th><th>Due</th><th>Owner</th><th>Notes</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
  }).join('');

  // Flat list with data attributes for client-side filtering
  const allRows = remediations.map(r => {
    const due = r.due_date ? new Date(r.due_date).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—';
    const overdue = r.due_date && new Date(r.due_date) < new Date() && r.status !== 'fixed' && r.status !== 'accepted risk';
    const scanLabel = r.scan_name || (r.scan_url ? (() => { try { return new URL(r.scan_url).hostname; } catch { return `Scan #${r.scan_id}`; } })() : `Scan #${r.scan_id}`);
    const overdueAttr = (r.due_date && new Date(r.due_date) < new Date() && r.status !== 'fixed' && r.status !== 'accepted risk') ? 'true' : 'false';
    return `<tr data-status="${esc(r.status)}" data-priority="${esc(r.priority)}" data-scan="${esc(scanLabel.toLowerCase())}" data-overdue="${overdueAttr}">
      <td><span class="finding-id">${esc(r.finding_id)}</span></td>
      <td><span class="badge ${statusCls[r.status] || ''}">${esc(r.status)}</span></td>
      <td><span class="cat-pill ${priorityCls[r.priority] || ''}" style="font-size:0.68rem">${esc(r.priority)}</span></td>
      <td style="font-size:0.82rem;color:var(--muted)">${esc(scanLabel)}</td>
      <td style="font-size:0.82rem;color:${overdue ? 'var(--rose)' : 'inherit'}">${esc(due)}${overdue ? ' ⚠' : ''}</td>
      <td style="font-size:0.82rem;color:var(--muted)">${esc(r.owner_email || '—')}</td>
      <td style="font-size:0.82rem;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(r.notes || '')}">${esc(r.notes || '—')}</td>
      <td>${r.scan_result_dir ? `<a class="sc-view" href="/report/${esc(r.scan_result_dir)}">View report</a>` : '—'}</td>
    </tr>`;
  }).join('');

  const body = `
<div class="inner">
  <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin:24px 0 20px">
    <div>
      <h1 style="font-size:clamp(22px,3.4vw,30px);letter-spacing:-.03em;margin:0 0 4px">Remediations</h1>
      <p style="color:var(--muted);font-size:0.9rem;margin:0">Track and manage finding remediations across all scans.</p>
    </div>
  </div>
  ${remediations.length ? `
  ${statsHtml}
  <div class="history-tools" style="margin-bottom:16px">
    <input class="history-filter" id="rem-search" type="search" placeholder="Search finding ID or scan…">
    <select class="history-filter" id="rem-status">
      <option value="">All statuses</option>
      <option value="open">Open</option>
      <option value="investigating">Investigating</option>
      <option value="fixed">Fixed</option>
      <option value="accepted risk">Accepted risk</option>
    </select>
    <select class="history-filter" id="rem-priority">
      <option value="">All priorities</option>
      <option value="critical">Critical</option>
      <option value="high">High</option>
      <option value="medium">Medium</option>
      <option value="low">Low</option>
    </select>
    <select class="history-filter" id="rem-overdue">
      <option value="">All due dates</option>
      <option value="overdue">Overdue only</option>
    </select>
  </div>
  <div style="overflow-x:auto;border:1px solid var(--border);border-radius:var(--radius-sm)">
    <table class="cookie-table" style="border:none" id="rem-table">
      <thead><tr><th>Finding ID</th><th>Status</th><th>Priority</th><th>Scan</th><th>Due</th><th>Owner</th><th>Notes</th><th></th></tr></thead>
      <tbody id="rem-tbody">${allRows}</tbody>
    </table>
  </div>
  <p id="rem-empty" style="display:none;color:var(--muted);font-size:0.875rem;padding:16px 0">No remediations match these filters.</p>
  <script>
  (function() {
    function filterRem() {
      var search   = document.getElementById('rem-search').value.trim().toLowerCase();
      var status   = document.getElementById('rem-status').value;
      var priority = document.getElementById('rem-priority').value;
      var overdue  = document.getElementById('rem-overdue').value;
      var rows = document.querySelectorAll('#rem-tbody tr');
      var visible = 0;
      rows.forEach(function(r) {
        var s = r.dataset.status, p = r.dataset.priority, scan = r.dataset.scan, od = r.dataset.overdue;
        var show = (!status   || s === status)
                && (!priority || p === priority)
                && (!overdue  || od === 'true')
                && (!search   || r.textContent.toLowerCase().includes(search));
        r.style.display = show ? '' : 'none';
        if (show) visible++;
      });
      document.getElementById('rem-empty').style.display = visible ? 'none' : '';
    }
    ['rem-search','rem-status','rem-priority','rem-overdue'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('input', filterRem);
    });
  })();
  </script>` : `<div class="empty-state">
    <span class="empty-icon">✅</span>
    <div class="empty-title">No remediations tracked yet</div>
    <p class="empty-sub">Open a report, expand a finding, and use the remediation panel to set status, priority, and due date.</p>
  </div>`}
</div>`;
  return appLayout('Remediations', body, user, 'remediations');
}

function monitorDetailPage(monitor, runs, user) {
  const statusBadge = m => {
    if (m.status === 'ok') return '<span class="badge badge-ok">ok</span>';
    if (m.status === 'alert') return '<span class="badge badge-critical">alert</span>';
    if (m.status === 'error') return '<span class="badge">error</span>';
    return '<span class="badge">running</span>';
  };

  const totalRuns = runs.length;
  const alertRuns = runs.filter(r => r.status === 'alert').length;
  const okRuns    = runs.filter(r => r.status === 'ok').length;
  const maxCrit   = runs.reduce((m, r) => Math.max(m, r.new_critical_count || 0), 0);

  const runsHtml = runs.length
    ? `<div style="overflow-x:auto;border:1px solid var(--border);border-radius:var(--radius-sm)">
        <table class="cookie-table" style="border:none">
          <thead>
            <tr>
              <th>Run time</th>
              <th>Status</th>
              <th>Critical</th>
              <th>High</th>
              <th>Report</th>
            </tr>
          </thead>
          <tbody>
            ${runs.map(r => {
              const runAt = r.run_at ? new Date(r.run_at).toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
              const crit = r.new_critical_count || 0;
              const high = r.details?.highCount ?? '—';
              const critCell = crit > 0
                ? `<span class="badge badge-critical">${crit}</span>`
                : `<span class="badge badge-ok">0</span>`;
              const highCell = typeof high === 'number' && high > 0
                ? `<span class="badge" style="background:var(--amber,#f59e0b20);color:#92400e;border-color:#fcd34d">${high}</span>`
                : `<span style="color:var(--muted);font-size:0.85rem">${high}</span>`;
              const reportLink = r.scan_result_dir
                ? `<a class="sc-view" href="/report/${esc(r.scan_result_dir)}">View →</a>`
                : '—';
              return `<tr>
                <td style="font-size:0.85rem;color:var(--ink-3)">${esc(runAt)}</td>
                <td>${statusBadge(r)}</td>
                <td>${critCell}</td>
                <td>${highCell}</td>
                <td>${reportLink}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`
    : `<div class="empty-state">
        <span class="empty-icon">📭</span>
        <div class="empty-title">No runs yet</div>
        <p class="empty-sub">This monitor hasn't run yet. It will trigger automatically on its next scheduled time.</p>
      </div>`;

  const body = `
<div class="inner">
  <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin:24px 0 20px">
    <div>
      <a href="/app/monitors" style="font-size:0.82rem;color:var(--muted);text-decoration:none;display:inline-flex;align-items:center;gap:4px;margin-bottom:8px">← All monitors</a>
      <h1 style="font-size:clamp(20px,3vw,28px);letter-spacing:-.03em;margin:0 0 4px">${esc(monitor.name)}</h1>
      <p style="color:var(--muted);font-size:0.88rem;margin:0;font-family:monospace">${esc(monitor.url)}</p>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">
      <button type="button" class="wizard-btn wizard-btn-primary" id="run-now-btn" onclick="runMonitorNow(${monitor.id})">Run now</button>
      <a class="wizard-btn" href="/app/monitors/${monitor.id}">Edit monitor</a>
    </div>
  </div>

  <div class="integrity-grid" style="margin-bottom:24px">
    <div class="integrity-card">
      <strong>${totalRuns}</strong><span>Total runs</span>
    </div>
    <div class="integrity-card" style="border-top:3px solid var(--rose)">
      <strong style="color:var(--rose)">${alertRuns}</strong><span>Alert runs</span>
    </div>
    <div class="integrity-card" style="border-top:3px solid var(--emerald)">
      <strong style="color:var(--emerald)">${okRuns}</strong><span>Clean runs</span>
    </div>
    <div class="integrity-card">
      <strong>${maxCrit}</strong><span>Worst critical count</span>
    </div>
  </div>

  ${runs.length >= 2 ? `
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px 20px;margin-bottom:24px">
    <div style="font-size:0.82rem;font-weight:700;color:var(--ink-3);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px">Critical findings trend</div>
    ${monitorTrendChart(runs)}
  </div>` : ''}

  <h2 style="font-size:1rem;font-weight:700;letter-spacing:-.02em;margin:0 0 12px">Run history</h2>
  ${runsHtml}
</div>
<script>
window.runMonitorNow = async function(id) {
  var btn = document.getElementById('run-now-btn');
  if (!btn) return;
  btn.disabled = true;
  btn.textContent = 'Queuing…';
  try {
    var r = await fetch('/api/monitors/' + id + '/run-now', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } });
    var d = await r.json();
    if (d.jobId) {
      btn.textContent = 'Queued — scan started';
      setTimeout(function() { window.location.reload(); }, 3000);
    } else {
      btn.textContent = 'Run now';
      btn.disabled = false;
      alert(d.error || 'Failed to queue run');
    }
  } catch (err) {
    btn.textContent = 'Run now';
    btn.disabled = false;
    alert('Network error: ' + err.message);
  }
};
</script>`;
  return appLayout(esc(monitor.name) + ' — Monitor', body, user, 'monitors');
}

module.exports = { layout, mpShell, homePage, marketingPage, trainingsPage, blogPage, progressPage, comparisonPage, comparisonListPage, reportsPage, settingsPage, auditLogPage, monitorsPage, monitorFormPage, monitorDetailPage, newScanPage, remediationsPage, esc, sharedCSS: SHARED_CSS };
