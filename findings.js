'use strict';

/**
 * findings.js
 *
 * Cookie severity rules:
 *   strictly-necessary               → no finding
 *   analytics | advertising | functional (known non-essential) → CRITICAL
 *   unknown (not in cookie-db)       → REVIEW  (low confidence, never CRITICAL)
 *
 * Scenario findings:
 *   CRITICAL  — known non-essential cookie in no-interaction or after reject-all
 *   REVIEW    — unclassified cookie present; manual review needed
 *   ADVISORY  — cookie lifespan > 13 months; scenario could not be automated
 */

const STRICTLY_NECESSARY = new Set(['strictly-necessary']);
const KNOWN_NON_ESSENTIAL = new Set(['analytics', 'advertising', 'functional']);

// ICO: 13 months = 397 days
const MAX_COOKIE_DAYS = 397;

// Known advertising/analytics request domains (not CDNs).
// Used to detect pre-consent third-party tracking requests.
const TRACKER_DOMAINS = [
  'google-analytics.com', 'analytics.google.com', 'stats.g.doubleclick.net',
  'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
  'connect.facebook.net', 'facebook.com',
  'bat.bing.com', 'c.clarity.ms', 'clarity.ms',
  'px.ads.linkedin.com', 'snap.licdn.com',
  'analytics.twitter.com', 'ads.twitter.com',
  'analytics.tiktok.com',
  'tr.snapchat.com', 'sc-static.net',
  'ct.pinterest.com',
  'criteo.com', 'criteo.net',
  'static.hotjar.com', 'script.hotjar.com',
  '6sc.co',
  'tag.demandbase.com',
  'cdn.heapanalytics.com',
  'cdn.segment.com',
  'api.amplitude.com', 'api2.amplitude.com',
  'api.mixpanel.com',
  'assets.adobedtm.com', 'dpm.demdex.net',
  'pixel.quantserve.com',
  'adnxs.com',
  'amplify.outbrain.com',
  'cdn.taboola.com',
  'bizible.com',
  'js.intercomcdn.com',
  'mc.yandex.com',
];

function isKnownTracker(hostname) {
  const h = (hostname || '').toLowerCase();
  return TRACKER_DOMAINS.some(t => h === t || h.endsWith('.' + t));
}

// ---------------------------------------------------------------------------
// Cookie classification
// ---------------------------------------------------------------------------

// Suggested investigation hints for unknown cookies
function unknownInvestigationHint(name) {
  const n = name.toLowerCase();
  if (n.startsWith('_ga') || n.startsWith('__utm')) return 'Likely Google Analytics — check gtag/GA4 configuration';
  if (n.startsWith('_fb') || n === 'fr' || n === 'tr') return 'Likely Meta Pixel — check Facebook/Instagram ad integration';
  if (n.includes('sess') || n.includes('session')) return 'Likely a session cookie — verify if strictly necessary';
  if (n.includes('csrf') || n.includes('xsrf') || n.includes('token')) return 'Likely a CSRF/security token — usually strictly necessary';
  if (n.startsWith('_cl') || n.includes('clarity')) return 'Likely Microsoft Clarity — check analytics/heatmap integration';
  if (n.includes('consent') || n.includes('cookie') || n.includes('gdpr') || n.includes('ccpa')) return 'Likely a CMP consent record — usually strictly necessary';
  if (n.startsWith('_hj')) return 'Likely Hotjar — check UX analytics integration';
  if (n.startsWith('_tt') || n.includes('tiktok')) return 'Likely TikTok Pixel — check advertising integration';
  if (n.startsWith('li_') || n.includes('linkedin')) return 'Likely LinkedIn — check advertising/insights integration';
  if (n.includes('stripe') || n.includes('payment') || n.includes('checkout')) return 'Likely a payment provider cookie — check necessity';
  if (n.startsWith('__') && n.endsWith('__')) return 'Internal/framework cookie — inspect source, possibly strictly necessary';
  if (n.length <= 3) return 'Short name — may be legacy or minified tracker; inspect network requests for this cookie\'s origin';
  return 'No pattern match — inspect the Set-Cookie response header origin URL to identify the vendor';
}

function classifyCookie(name, db) {
  if (db[name]) {
    return {
      ...db[name],
      confidence: db[name].confidence || 'high',
      matchingRule: 'exact-name',
      evidenceSource: 'cookie-db',
      lastUpdated: db[name].lastUpdated || null,
    };
  }
  for (const [pattern, entry] of Object.entries(db)) {
    if (!pattern.includes('*')) continue;
    const prefix = pattern.replace(/\*/g, '');
    if (name.startsWith(prefix)) {
      return {
        ...entry,
        confidence: entry.confidence || 'medium',
        matchingRule: `prefix-pattern:${pattern}`,
        evidenceSource: 'cookie-db',
        lastUpdated: entry.lastUpdated || null,
      };
    }
  }
  return {
    category: 'unknown',
    provider: 'Unknown',
    description: 'Unclassified cookie — no matching entry in the classification database',
    confidence: 'unknown',
    matchingRule: 'none',
    evidenceSource: 'fallback',
    lastUpdated: null,
    investigationContext: unknownInvestigationHint(name),
  };
}

function cookieRisk(classification) {
  if (STRICTLY_NECESSARY.has(classification.category)) return 'necessary';
  if (KNOWN_NON_ESSENTIAL.has(classification.category)) return 'non-essential';
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Finding builders
// ---------------------------------------------------------------------------

let _seq = 0;
const nextId = () => `F${String(++_seq).padStart(3, '0')}`;

function findingCriticalPreConsent(cookie, cl) {
  return {
    id: nextId(),
    severity: 'CRITICAL',
    evidenceType: 'cookie',
    confidence: 'high',
    title: 'Non-essential cookie set before consent',
    cookieName: cookie.name,
    domain: cookie.domain,
    scenario: 'no-interaction',
    category: cl.category,
    provider: cl.provider,
    description: `"${cookie.name}" (${cl.provider} — ${cl.category}) was set on "${cookie.domain}" ` +
      `before the user gave any consent.`,
    regulation: 'PECR reg 6(1); UK GDPR Art 7',
    guidance: `Gate the ${cl.provider} integration behind a consent callback. ` +
      `Do not set or trigger this cookie until the relevant category is accepted.`,
  };
}

function findingCriticalPostReject(cookie, cl) {
  return {
    id: nextId(),
    severity: 'CRITICAL',
    evidenceType: 'cookie',
    confidence: 'high',
    title: 'Non-essential cookie persists after reject-all',
    cookieName: cookie.name,
    domain: cookie.domain,
    scenario: 'reject-all',
    category: cl.category,
    provider: cl.provider,
    description: `"${cookie.name}" (${cl.provider} — ${cl.category}) was present on "${cookie.domain}" ` +
      `after the user clicked reject-all. Rejection must be honoured immediately.`,
    regulation: 'PECR reg 6(1); UK GDPR Art 7(3)',
    guidance: `Ensure the ${cl.provider} tag fires conditionally on consent state ` +
      `and that existing cookies in this category are deleted on rejection.`,
  };
}

function findingReviewUnclassified(cookie, scenario) {
  return {
    id: nextId(),
    severity: 'REVIEW',
    evidenceType: 'cookie',
    confidence: 'low',
    title: `Unclassified cookie present after ${scenario}`,
    cookieName: cookie.name,
    domain: cookie.domain,
    scenario,
    category: 'unknown',
    provider: 'Unknown',
    description: `"${cookie.name}" on "${cookie.domain}" is not in the cookie database and could not be ` +
      `automatically classified. Manual review is needed to determine whether it requires consent.`,
    regulation: 'PECR reg 6; UK GDPR Art 7',
    guidance: `Identify the purpose of "${cookie.name}". If it is non-essential (analytics, ` +
      `advertising, or functional), gate it behind consent. ` +
      `Consider adding it to data/cookie-db.json once classified.`,
  };
}

function findingAdvisoryLongLife(cookie, cl, scenario) {
  return {
    id: nextId(),
    severity: 'ADVISORY',
    evidenceType: 'cookie',
    confidence: 'high',
    title: 'Cookie lifespan exceeds 13 months',
    cookieName: cookie.name,
    domain: cookie.domain,
    scenario,
    category: cl.category,
    provider: cl.provider,
    description: `"${cookie.name}" has a lifespan of ${cookie.expiresDays} days ` +
      `(~${Math.round(cookie.expiresDays / 30)} months). ` +
      `The ICO recommends a maximum of 13 months (397 days).`,
    regulation: 'UK GDPR Art 5(1)(e); ICO Cookie Guidance (2023)',
    guidance: `Reduce the cookie max-age/expiry to ≤397 days. ` +
      `If set by a third-party vendor, check for a configuration option or raise with the vendor.`,
  };
}

function findingManualReview(scenario, reason) {
  return {
    id: nextId(),
    severity: 'ADVISORY',
    evidenceType: 'banner',
    confidence: 'n/a',
    title: `Scenario "${scenario}" requires manual review`,
    cookieName: null,
    domain: null,
    scenario,
    category: null,
    provider: null,
    description: `Automated scenario could not be completed: ${reason}`,
    regulation: 'PECR reg 6; UK GDPR Art 7',
    guidance: `Manually complete the "${scenario}" user journey and compare cookie state ` +
      `against the no-interaction baseline.`,
  };
}

function findingCcpaOptOutMissing() {
  return {
    id: nextId(),
    severity: 'REVIEW',
    evidenceType: 'banner',
    confidence: 'medium',
    title: 'No California opt-out control detected',
    cookieName: null,
    domain: null,
    scenario: 'no-interaction',
    category: 'advertising',
    provider: null,
    description: 'The page did not expose a visible link or control matching common California privacy choices, opt-out, or Do Not Sell or Share wording during the no-interaction scan.',
    regulation: 'CCPA/CPRA §§1798.121, 1798.135',
    guidance: 'Manually verify whether the site offers a clear “Your Privacy Choices” or “Do Not Sell or Share My Personal Information” control. The control should be easy to find and should provide a functional opt-out path where applicable.',
  };
}

function findingSuspectScan(reason) {
  return {
    id: nextId(),
    severity: 'ADVISORY',
    evidenceType: 'scan',
    confidence: 'n/a',
    title: 'Scan result may be incomplete',
    cookieName: null,
    domain: null,
    scenario: 'no-interaction',
    category: null,
    provider: null,
    description: `Scan integrity check failed: ${reason}`,
    regulation: 'N/A',
    guidance: `Investigate why the scan returned unexpected results before relying on its findings.`,
  };
}

/**
 * ADVISORY (scan-level): site's WAF or CDN refused automated access.
 * The scan is INCONCLUSIVE — it must never be reported as compliant or non-compliant.
 */
function findingBlockedScan(statusReason) {
  return {
    id: nextId(),
    severity: 'ADVISORY',
    evidenceType: 'scan',
    confidence: 'n/a',
    title: 'Scan blocked — result is inconclusive',
    cookieName: null,
    domain: null,
    scenario: null,
    category: null,
    provider: null,
    description: `The site's WAF or access-control layer refused the automated scan request. ` +
      `${statusReason ? statusReason + '. ' : ''}` +
      `No cookie data was captured. This scan is INCONCLUSIVE and must never be ` +
      `reported as compliant or non-compliant — it is simply incomplete.`,
    regulation: 'N/A',
    guidance: `Re-run the scan from a different IP or user-agent, or perform a manual audit ` +
      `using a real browser session. Consider whether the site's bot-detection ` +
      `could also be blocking legitimate users from submitting consent choices.`,
  };
}

/**
 * HIGH: reject requires more interactions than accept (ICO equal prominence).
 */
/**
 * ADVISORY: accept-all scenario completed using only a granular/category accept button.
 */
function findingGranularAcceptOnly(label) {
  return {
    id: nextId(),
    severity: 'ADVISORY',
    evidenceType: 'banner',
    confidence: 'high',
    title: 'No accept-all control — only category-level accept found',
    cookieName: null,
    domain: null,
    scenario: 'accept-all',
    category: null,
    provider: null,
    description: `The accept-all scenario was completed using "${label || 'a category-level accept button'}" ` +
      `rather than an accept-all control. This banner may not offer full-consent in a single click, ` +
      `which could indicate missing or incomplete consent controls. ` +
      `The accept-all cookie footprint recorded in this run may be understated.`,
    regulation: 'UK GDPR Art 7; ICO Cookie Guidance (2023)',
    guidance: 'Verify that the site provides a clear accept-all mechanism. ' +
      'If only category-level controls exist, check that all categories are present ' +
      'and that the consent footprint is accurately captured.',
  };
}

/**
 * CRITICAL: new non-essential cookie SET BY the reject click itself.
 * Distinct from "persists after reject" (Rule 2): this cookie did not exist before the click —
 * the rejection event actively fired tracking, not merely failed to clear it.
 */
function findingCookieSetByRejection(cookie, cl) {
  return {
    id: nextId(),
    severity: 'CRITICAL',
    evidenceType: 'cookie',
    confidence: 'high',
    title: 'Cookie set by rejection action',
    cookieName: cookie.name,
    domain: cookie.domain,
    scenario: 'reject-all',
    category: cl.category,
    provider: cl.provider,
    description: `"${cookie.name}" (${cl.provider} — ${cl.category}) was SET on "${cookie.domain}" ` +
      `in direct response to the user clicking reject — it was absent immediately before the click. ` +
      `This is categorically more serious than a cookie merely surviving rejection: ` +
      `the rejection event itself is actively triggering tracking, which is a direct breach of PECR reg 6.`,
    regulation: 'PECR reg 6(1); UK GDPR Art 7(3)',
    guidance: `The ${cl.provider} integration must not fire any tracking code on rejection. ` +
      `Audit the consent event handler and ensure the ${cl.provider} tag is never called ` +
      `when the user withholds or withdraws consent. Remove any logic that treats a rejection ` +
      `signal as a trigger for data collection.`,
  };
}

function findingRejectEffortAsymmetry(acceptAction, rejectAction, rejectStatus) {
  const acceptClicks = acceptAction?.clicks ?? 1;
  const rejectClicks = rejectAction?.clicks ?? 0;
  const rejectFailed = rejectStatus === 'manual-review-needed';

  let description;
  if (rejectFailed) {
    description =
      `Accepting consent was possible in ${acceptClicks} click(s) from the banner's first layer, `
      + `but rejecting could not be automated at all (manual review needed). `
      + `The ICO requires that withdrawing or withholding consent must be as easy as giving it.`;
  } else {
    description =
      `Accepting consent required ${acceptClicks} click(s) but rejecting required ${rejectClicks} click(s). `
      + `The reject path goes through an additional preferences/settings layer not required for accept. `
      + `The ICO requires equal prominence: accept and reject must be equally easy to action.`;
  }

  return {
    id: nextId(),
    severity: 'HIGH',
    evidenceType: 'banner',
    confidence: 'high',
    title: 'Reject is harder than accept — first-layer parity not met',
    cookieName: null,
    domain: null,
    scenario: 'reject-all',
    category: null,
    provider: null,
    description,
    regulation: 'UK GDPR Art 4(11) (freely given consent); ICO Cookie Guidance (2023) §4.3 — equal prominence',
    guidance: 'Add a "Reject all" button to the banner\'s first layer with equal visual weight to "Accept all". '
      + 'Do not hide rejection behind a "Manage preferences" step if acceptance is one click.',
  };
}

// ── Rule 5: Pre-consent third-party tracking requests ─────────────────────
function findingPreConsentTrackingRequest(domains) {
  const list = domains.slice(0, 8).join(', ') + (domains.length > 8 ? `, +${domains.length - 8} more` : '');
  return {
    id: nextId(),
    severity: 'CRITICAL',
    evidenceType: 'network-request',
    confidence: 'high',
    title: 'Third-party tracking requests made before consent',
    cookieName: null,
    domain: domains[0] || null,
    scenario: 'no-interaction',
    category: null,
    provider: null,
    description: `${domains.length} known tracking domain(s) received network requests before the user ` +
      `gave any consent — even though no tracking cookie was set. Pixels, beacon requests, ` +
      `and fingerprinting scripts can collect device and behavioural data without cookies. ` +
      `Tracking domains contacted: ${list}.`,
    regulation: 'PECR reg 6(1); UK GDPR Art 5(1)(a),(c); ICO Cookie Guidance (2023) §2.2',
    guidance: `Block all requests to advertising and analytics domains until the relevant consent ` +
      `category is accepted. Use a tag manager (GTM, Tealium, etc.) with a consent mode ` +
      `integration to gate script loading. Do not fire pixel or beacon requests on page load.`,
  };
}

// ── Rule 6: Pre-consent localStorage/sessionStorage ───────────────────────
function findingPreConsentStorage(localKeys, sessionKeys) {
  const combined = [...localKeys, ...sessionKeys].slice(0, 12);
  const types = [
    localKeys.length ? `localStorage (${localKeys.length} key${localKeys.length !== 1 ? 's' : ''})` : null,
    sessionKeys.length ? `sessionStorage (${sessionKeys.length} key${sessionKeys.length !== 1 ? 's' : ''})` : null,
  ].filter(Boolean).join(' and ');
  return {
    id: nextId(),
    severity: 'REVIEW',
    evidenceType: 'storage',
    confidence: 'medium',
    title: 'Browser storage written before consent',
    cookieName: null,
    domain: null,
    scenario: 'no-interaction',
    category: null,
    provider: null,
    description: `Data was written to ${types} before the user gave any consent. ` +
      `Web storage is subject to the same PECR rules as cookies when used for tracking. ` +
      `Keys found: ${combined.join(', ')}${(localKeys.length + sessionKeys.length) > 12 ? `, …` : ''}.`,
    regulation: 'PECR reg 6; ICO Cookie Guidance (2023) §2.2 — "similar technologies"',
    guidance: `Audit each storage key written on page load. Any key used for analytics, ` +
      `advertising, A/B testing, or cross-session identification requires consent. ` +
      `Strictly-necessary storage (CSRF tokens, shopping-cart state, login sessions) is exempt.`,
  };
}

// ── Rule 7: Missing cookie security attributes ────────────────────────────
function findingInsecureCookieAttribute(cookie, issues, isHttps) {
  return {
    id: nextId(),
    severity: 'ADVISORY',
    evidenceType: 'cookie',
    confidence: 'high',
    title: 'Cookie security attributes missing',
    cookieName: cookie.name,
    domain: cookie.domain,
    scenario: 'accept-all',
    category: null,
    provider: null,
    description: `"${cookie.name}" on "${cookie.domain}" has security issues: ${issues.join('; ')}.`,
    regulation: 'UK GDPR Art 25 (data protection by design); NCSC cookie security guidance',
    guidance: `Set the Secure flag on all cookies served over HTTPS. ` +
      `Set SameSite=Lax on first-party cookies (or Strict where cross-site access is not needed). ` +
      `SameSite=None requires Secure and should only be used for intentional cross-site cookies.`,
  };
}

// ── Rule 8: Cookie/privacy policy link missing ────────────────────────────
function findingPolicyLinkMissing() {
  return {
    id: nextId(),
    severity: 'ADVISORY',
    evidenceType: 'banner',
    confidence: 'medium',
    title: 'No cookie or privacy policy link detected',
    cookieName: null,
    domain: null,
    scenario: null,
    category: null,
    provider: null,
    description: `No cookie policy or privacy policy link was detected on the cookie banner ` +
      `or in the page header, footer, or navigation. ` +
      `Visitors must be able to access clear information about cookies in use ` +
      `before making a consent decision.`,
    regulation: 'PECR reg 8; UK GDPR Art 13(1)(c),(e); ICO Cookie Guidance (2023) §4.4',
    guidance: `Add a clearly labelled "Cookie Policy" or "Privacy Policy" link ` +
      `directly on the consent banner, and ensure it is also accessible ` +
      `from the site footer on every page.`,
  };
}

// ── Rule 9a: Trackers fire without GPC but suppressed with it ─────────────
function findingGpcResponsiveTrackers(domainsBlockedByGpc, cookiesBlocked) {
  const domainList = domainsBlockedByGpc.slice(0, 10).join(', ');
  return {
    id: nextId(),
    severity: 'HIGH',
    evidenceType: 'network-request',
    confidence: 'high',
    title: 'Trackers fire without GPC signal but are suppressed when GPC is enabled',
    cookieName: null,
    domain: domainsBlockedByGpc[0] || null,
    scenario: 'gpc-comparison',
    category: null,
    provider: null,
    description: `The GPC comparison journey found ${domainsBlockedByGpc.length} third-party domain${domainsBlockedByGpc.length !== 1 ? 's' : ''} ` +
      `contacted without the Global Privacy Control signal but absent when GPC was sent: ${domainList}. ` +
      `${cookiesBlocked.length > 0 ? `${cookiesBlocked.length} cookie${cookiesBlocked.length !== 1 ? 's' : ''} were also suppressed by GPC. ` : ''}` +
      `This indicates the site responds to GPC, but visitors who do not send the signal ` +
      `are tracked by these domains without being informed.`,
    regulation: 'CCPA / CPRA § 1798.120 (opt-out of sale/sharing); UK GDPR Art 6(1) (lawful basis)',
    guidance: `Ensure the opt-out of sale/sharing mechanism applies to all visitors, ` +
      `not only those sending the GPC signal. Consider treating GPC as an opt-out signal ` +
      `by default under CCPA/CPRA requirements. Document GPC behaviour in the privacy policy.`,
  };
}

function findingGpcIneffective(domainsUnchanged) {
  return {
    id: nextId(),
    severity: 'REVIEW',
    evidenceType: 'network-request',
    confidence: 'medium',
    title: 'GPC signal sent but tracking domains unchanged — signal may be ignored',
    cookieName: null,
    domain: domainsUnchanged[0] || null,
    scenario: 'gpc-comparison',
    category: null,
    provider: null,
    description: `The GPC comparison journey found no difference in third-party tracking domains ` +
      `between the non-GPC and GPC visits. ${domainsUnchanged.length} third-party domain${domainsUnchanged.length !== 1 ? 's' : ''} ` +
      `were contacted in both runs. The site may not be honouring the Global Privacy Control signal.`,
    regulation: 'CCPA / CPRA § 1798.120 — opt-out of sale/sharing of personal information',
    guidance: `Review CMP configuration for GPC signal handling. Under CCPA/CPRA, ` +
      `businesses subject to the law must treat a GPC signal as an opt-out of sale/sharing. ` +
      `Verify whether the CMP vendor supports GPC and that the signal is processed server-side.`,
  };
}

// ── Rule 9: Consent not persisted on revisit ─────────────────────────────
function findingConsentNotPersisted() {
  return {
    id: nextId(),
    severity: 'HIGH',
    evidenceType: 'banner',
    confidence: 'high',
    title: 'Consent choice not persisted — banner reappears on revisit',
    cookieName: null,
    domain: null,
    scenario: 'accept-all',
    category: null,
    provider: null,
    description: `After accepting consent and revisiting the site in the same browser session, ` +
      `the consent banner reappeared. The site is not storing the user's consent decision ` +
      `persistently. Users are being asked for consent repeatedly, which is disruptive ` +
      `and suggests the consent record is not being saved correctly.`,
    regulation: 'UK GDPR Art 7(1) — demonstrable consent; ICO Cookie Guidance (2023) §4.1',
    guidance: `Ensure the consent management platform (CMP) sets a persistent consent cookie ` +
      `or uses localStorage to record the user's choice. The consent record should ` +
      `survive page reloads and new tabs. Verify the consent cookie has an appropriate ` +
      `lifespan (typically 6–12 months) and is not being cleared between visits.`,
  };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * @param {object[]} scenarioResults
 * @param {object}   cookieDb
 * @param {object}   [opts]
 * @returns {{ findings: object[], cookieMap: object[], scanStatus: string, scanStatusReason: string|null }}
 */
function generateFindings(scenarioResults, cookieDb, opts = {}) {
  _seq = 0;
  const findings = [];
  const db = cookieDb.cookies || cookieDb;

  const policyLinks = opts.policyLinks || null;
  const isHttps = opts.isHttps !== false; // default true
  const consentPersisted = opts.consentPersisted !== false; // null means untested
  const consentPersistedTested = opts.consentPersisted !== undefined;
  const pageResults = opts.pageResults || null;
  const framework = opts.framework || 'uk-pecr';
  const scanType = opts.scanType || 'consent';
  const privacySignals = opts.privacySignals || null;

  const byScenario = Object.fromEntries(scenarioResults.map(r => [r.scenario, r]));
  const noInteraction = byScenario['no-interaction'];
  const acceptAll = byScenario['accept-all'];
  const rejectAll = byScenario['reject-all'];

  // ── Sanity / integrity check ───────────────────────────────────────────────
  let scanStatus = 'ok';
  let scanStatusReason = null;

  // Bot-blocking: if any scenario was blocked, the whole scan is inconclusive
  const blockedScenario = scenarioResults.find(r => r.status === 'blocked');
  if (blockedScenario) {
    scanStatus = 'blocked';
    scanStatusReason = blockedScenario.statusReason || 'Site blocked the scanner (bot detection)';
    findings.push(findingBlockedScan(scanStatusReason));
    // Return early — no meaningful findings possible from a blocked scan
    return { findings, cookieMap: [], scanStatus, scanStatusReason };
  }

  if (noInteraction) {
    const cookieCount = noInteraction.cookies.length;
    const thirdPartyCount = (noInteraction.thirdPartyDomains || []).length;
    const acceptCount = (acceptAll?.cookies || []).length;

    if (cookieCount === 0 && thirdPartyCount === 0 && acceptCount === 0) {
      // Truly nothing captured at all — page likely didn't load correctly
      scanStatus = 'suspect';
      scanStatusReason = 'No cookies and no third-party requests in any scenario — page may not have loaded correctly';
      findings.push(findingSuspectScan(scanStatusReason));
    } else if (cookieCount === 0 && thirdPartyCount > 0 && acceptCount === 0) {
      // Nothing even after accepting — likely a capture failure
      scanStatus = 'suspect';
      scanStatusReason = `Zero cookies in all scenarios but ${thirdPartyCount} third-party domain(s) contacted — scanner may not have captured cookies correctly. Verify manually.`;
      findings.push(findingSuspectScan(scanStatusReason));
    }
    // cookieCount === 0 + thirdPartyCount > 0 + acceptCount > 0 means the site correctly
    // blocks cookies behind consent (good practice) — not suspect, no finding needed.
  }

  // ── Build unified cookie map ───────────────────────────────────────────────
  const cookieMap = [];
  const cookieMapIndex = {};
  for (const sr of scenarioResults) {
    for (const c of sr.cookies) {
      const key = `${c.name}||${c.domain}`;
      if (!cookieMapIndex[key]) {
        const classification = classifyCookie(c.name, db);
        cookieMapIndex[key] = {
          name: c.name,
          domain: c.domain,
          classification,
          provenance: {
            confidence: classification.confidence || 'medium',
            matchingRule: classification.matchingRule || (db[c.name] ? 'exact' : db.__provenance__?.matchingRule || 'prefix'),
            evidenceSource: classification.evidenceSource || (db[c.name] ? 'cookie-db' : 'fallback'),
            lastUpdated: classification.lastUpdated || new Date().toISOString(),
            manualOverrideHistory: classification.manualOverrideHistory || [],
          },
          seenIn: [],
          maxExpiresDays: 0,
        };
        cookieMap.push(cookieMapIndex[key]);
      }
      if (!cookieMapIndex[key].seenIn.includes(sr.scenario)) {
        cookieMapIndex[key].seenIn.push(sr.scenario);
      }
      if (typeof c.expiresDays === 'number') {
        cookieMapIndex[key].maxExpiresDays = Math.max(cookieMapIndex[key].maxExpiresDays, c.expiresDays);
      }
    }
  }

  // ── Rule 1: pre-consent cookies ────────────────────────────────────────────
  if (noInteraction && noInteraction.status !== 'error') {
    for (const cookie of noInteraction.cookies) {
      const cl = classifyCookie(cookie.name, db);
      const risk = cookieRisk(cl);
      if (risk === 'non-essential') {
        findings.push(findingCriticalPreConsent(cookie, cl));
      } else if (risk === 'unknown') {
        findings.push(findingReviewUnclassified(cookie, 'no-interaction'));
      }
      // strictly-necessary: no finding
    }
  }

  // ── Rule 2: post-reject cookies ────────────────────────────────────────────
  if (rejectAll) {
    if (rejectAll.status === 'manual-review-needed') {
      findings.push(findingManualReview('reject-all', rejectAll.statusReason));
    } else if (rejectAll.status !== 'error') {
      // Only flag cookies that PERSISTED (present before AND after reject).
      // Cookies NEW after the reject click are handled exclusively by rule 3c.
      const newAfterRejectKeys = new Set(
        (rejectAll.newCookiesAfterReject || []).map(c => `${c.name}||${c.domain}`)
      );
      for (const cookie of rejectAll.cookies) {
        if (newAfterRejectKeys.has(`${cookie.name}||${cookie.domain}`)) continue;
        const cl = classifyCookie(cookie.name, db);
        const risk = cookieRisk(cl);
        if (risk === 'non-essential') {
          findings.push(findingCriticalPostReject(cookie, cl));
        } else if (risk === 'unknown') {
          findings.push(findingReviewUnclassified(cookie, 'reject-all'));
        }
      }
    }
  }

  // ── Rule 3: accept-all manual review ──────────────────────────────────────
  if (acceptAll && acceptAll.status === 'manual-review-needed') {
    findings.push(findingManualReview('accept-all', acceptAll.statusReason));
  }

  // ── Rule 3a: granular-accept-only ─────────────────────────────────────────
  if (acceptAll && acceptAll.granularAcceptOnly) {
    const label = acceptAll.consentAction?.detail?.match(/"([^"]+)"/)?.[1] || '';
    findings.push(findingGranularAcceptOnly(label));
  }

  // ── Rule 3b: reject effort asymmetry ──────────────────────────────────────
  // Only emit when accept succeeded (so we have a valid accept baseline).
  const acceptAction = acceptAll?.consentAction;
  const rejectAction = rejectAll?.consentAction;
  const acceptSucceeded = acceptAll?.status === 'ok' && acceptAction?.success;

  if (acceptSucceeded) {
    const acceptClicks = acceptAction.clicks ?? 1;
    const rejectClicks = rejectAction?.clicks ?? 0;
    const rejectSucceeded = rejectAll?.status === 'ok' && rejectAction?.success;
    const rejectFailed = rejectAll?.status === 'manual-review-needed';

    const asymmetric =
      // Reject couldn't be automated at all
      rejectFailed
      // Reject required more steps than accept
      || (rejectSucceeded && rejectClicks > acceptClicks)
      // Accept was first-layer, reject was not
      || (rejectSucceeded && acceptAction.firstLayer && !rejectAction?.firstLayer);

    if (asymmetric) {
      findings.push(findingRejectEffortAsymmetry(acceptAction, rejectAction, rejectAll?.status));
    }
  }

  // ── Rule 3c: cookies set BY the reject click itself ──────────────────────
  // Distinct from Rule 2 (cookies persisting after reject): these cookies did not
  // exist before the reject click — the rejection event actively created them.
  if (rejectAll && rejectAll.newCookiesAfterReject && rejectAll.newCookiesAfterReject.length > 0) {
    for (const cookie of rejectAll.newCookiesAfterReject) {
      const cl = classifyCookie(cookie.name, db);
      const risk = cookieRisk(cl);
      if (risk === 'non-essential') {
        findings.push(findingCookieSetByRejection(cookie, cl));
      }
    }
  }

  // ── Rule 4: long-life cookies ──────────────────────────────────────────────
  const seenLongLife = new Set();
  for (const sr of scenarioResults) {
    if (sr.status === 'error') continue;
    for (const cookie of sr.cookies) {
      const key = `${cookie.name}||${cookie.domain}`;
      if (seenLongLife.has(key)) continue;
      if (typeof cookie.expiresDays === 'number' && cookie.expiresDays > MAX_COOKIE_DAYS) {
        seenLongLife.add(key);
        const cl = classifyCookie(cookie.name, db);
        findings.push(findingAdvisoryLongLife(cookie, cl, sr.scenario));
      }
    }
  }

  // ── Rule 5: pre-consent third-party tracking requests ─────────────────────
  if (noInteraction && noInteraction.status !== 'error') {
    const trackerDomains = (noInteraction.thirdPartyDomains || []).filter(isKnownTracker);
    if (trackerDomains.length > 0) {
      findings.push(findingPreConsentTrackingRequest(trackerDomains));
    }
  }

  // ── Rule 6: pre-consent localStorage/sessionStorage ────────────────────────
  if (noInteraction && noInteraction.status !== 'error') {
    const ls = (noInteraction.storage?.localStorage || []);
    const ss = (noInteraction.storage?.sessionStorage || []);
    // Only flag if there are more than 2 keys (avoid false positives on purely necessary storage)
    if (ls.length + ss.length > 2) {
      findings.push(findingPreConsentStorage(ls, ss));
    }
  }

  // ── Rule 7: missing cookie security attributes ─────────────────────────────
  if (acceptAll && acceptAll.status !== 'error') {
    const seenInsecure = new Set();
    for (const c of (acceptAll.cookies || [])) {
      const cl = classifyCookie(c.name, db);
      if (STRICTLY_NECESSARY.has(cl.category)) continue;
      const issues = [];
      if (isHttps && !c.secure) issues.push('missing Secure flag');
      if (!c.sameSite || c.sameSite === 'None') issues.push(`SameSite=${c.sameSite || 'unset'}`);
      if (!issues.length) continue;
      const key = `${c.name}||${c.domain}`;
      if (seenInsecure.has(key)) continue;
      seenInsecure.add(key);
      findings.push(findingInsecureCookieAttribute(c, issues, isHttps));
    }
  }

  // California-specific surface check. GPC is reported as evidence separately;
  // a browser signal alone cannot prove that a site honoured the request.
  if ((framework === 'ccpa-cpra' || framework === 'both' || scanType === 'ccpa-signals' || scanType === 'full')
    && privacySignals && !privacySignals.hasOptOutControl) {
    findings.push(findingCcpaOptOutMissing());
  }

  // ── Rule 8: cookie/privacy policy link missing ─────────────────────────────
  if (policyLinks) {
    const allLinks = [
      ...(policyLinks.bannerLinks || []),
      ...(policyLinks.pageLinks || []),
    ];
    if (allLinks.length === 0) {
      findings.push(findingPolicyLinkMissing());
    }
  }

  // ── Rule 9: consent not persisted on revisit ───────────────────────────────
  if (consentPersistedTested && !consentPersisted) {
    findings.push(findingConsentNotPersisted());
  }

  // ── Rule 10: GPC comparison ────────────────────────────────────────────────
  const gpcScenario = scenarioResults.find(s => s.scenario === 'gpc-comparison');
  if (gpcScenario && gpcScenario.status === 'ok' && gpcScenario.gpcDelta) {
    const { domainsBlockedByGpc, domainsUnchanged, cookiesBlockedByGpc, gpcEffective } = gpcScenario.gpcDelta;
    if (gpcEffective) {
      findings.push(findingGpcResponsiveTrackers(domainsBlockedByGpc, cookiesBlockedByGpc));
    } else if (domainsUnchanged.length > 0) {
      findings.push(findingGpcIneffective(domainsUnchanged));
    }
  }

  // ── Deduplicate ────────────────────────────────────────────────────────────
  const seen = new Set();
  const deduped = findings.filter(f => {
    const key = `${f.title}||${f.cookieName}||${f.domain}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  deduped.forEach((f, i) => { f.id = `F${String(i + 1).padStart(3, '0')}`; });

  return {
    findings: deduped,
    cookieMap: Object.values(cookieMap),
    scanStatus,
    scanStatusReason,
  };
}

function summariseFindings(findings, scanStatus, scanStatusReason) {
  const bySev = { CRITICAL: 0, HIGH: 0, REVIEW: 0, ADVISORY: 0 };
  for (const f of findings) bySev[f.severity] = (bySev[f.severity] || 0) + 1;

  const lines = [];
  if (scanStatus === 'blocked') {
    lines.push(`\n[BLOCKED] ${scanStatusReason}`);
  } else if (scanStatus === 'suspect') {
    lines.push(`\n[SUSPECT SCAN] ${scanStatusReason}`);
  }
  lines.push(
    `\nFindings: ${findings.length} total — ` +
    `${bySev.CRITICAL} CRITICAL, ${bySev.HIGH} HIGH, ${bySev.REVIEW} REVIEW, ${bySev.ADVISORY} ADVISORY`
  );
  for (const f of findings) {
    lines.push(`  [${f.severity}] ${f.id} ${f.title}`);
    if (f.cookieName) lines.push(`          Cookie: ${f.cookieName} on ${f.domain} (${f.scenario})`);
    lines.push(`          Reg:    ${f.regulation}`);
  }
  return lines.join('\n');
}

module.exports = { generateFindings, classifyCookie, summariseFindings };
