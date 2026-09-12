'use strict';

/**
 * cmp-detect.js
 *
 * Phase 1 — named CMP fast path (detectCMP):
 *   Identifies named CMP for context setup (iframe, shadow DOM).
 *
 * Phase 2 — generic button finder (findBannerButtons):
 *   Locates banner containers, finds buttons by visible text.
 *   Returns Playwright Locators. Call fresh in each scenario context.
 *
 * Accept text is split into:
 *   accept_all     — "Accept all", "Allow all cookies", etc. (full consent)
 *   granular_accept — "Accept analytics cookies", "Accept additional cookies"
 *                    (partial/category consent, NOT treat as accept-all)
 *
 * Exports: { detectCMP, findBannerButtons, findButtonByTexts,
 *            isBannerInConfirmationState, shadowClickButton, BUTTON_TEXTS }
 */

// ---------------------------------------------------------------------------
// Named CMP signatures — fast path (context setup only, no button selectors)
// ---------------------------------------------------------------------------
const CMP_SIGNATURES = [
  { name: 'OneTrust',      jsGlobals: ['OneTrust', 'OnetrustActiveGroups'], domSelectors: ['#onetrust-banner-sdk', '#onetrust-consent-sdk'], iframeSelector: null, shadowHost: null },
  { name: 'Cookiebot',     jsGlobals: ['Cookiebot', 'CookieConsent'],       domSelectors: ['#CybotCookiebotDialog'],                        iframeSelector: null, shadowHost: null },
  { name: 'CookieYes',     jsGlobals: ['cookieyes', 'getCkyConsent'],       domSelectors: ['.cky-consent-container', '[data-cky-tag="cookie-bar"]'], iframeSelector: null, shadowHost: null },
  { name: 'Usercentrics',  jsGlobals: ['UC_UI', 'usercentrics'],            domSelectors: ['#usercentrics-root'],                           iframeSelector: null, shadowHost: '#usercentrics-root' },
  { name: 'Didomi',        jsGlobals: ['didomiState', 'Didomi'],            domSelectors: ['#didomi-host', '#didomi-notice'],               iframeSelector: null, shadowHost: null },
  { name: 'TrustArc',      jsGlobals: ['truste', 'TrustArcFramework'],      domSelectors: ['#teconsent', '.truste_overlay'],                iframeSelector: 'iframe[src*="trustarc.com"], iframe[src*="truste.com"]', shadowHost: null },
  { name: 'Quantcast',     jsGlobals: ['__qcCmpApi'],                       domSelectors: ['#qc-cmp2-container'],                          iframeSelector: null, shadowHost: null },
  { name: 'Sourcepoint',   jsGlobals: ['_sp_', '_sp_queue'],                domSelectors: ['[id^="sp_message_container"]'],                 iframeSelector: 'iframe[id^="sp_message_iframe"]', shadowHost: null },
  { name: 'IAB-TCF-Unknown', jsGlobals: ['__tcfapi'],                       domSelectors: [],                                              iframeSelector: null, shadowHost: null },
  // GOV.UK Design System cookie banner (used by UK public sector sites)
  { name: 'GOV.UK Cookie Banner', jsGlobals: [],
    domSelectors: [
      '.govuk-cookie-banner',
      '[data-module="govuk-cookie-banner"]',
      '[data-module="cookie-banner"]',
    ],
    iframeSelector: null, shadowHost: null },
];

// ---------------------------------------------------------------------------
// Banner container selectors — ordered specific → general
// ---------------------------------------------------------------------------
const BANNER_CONTAINER_SELECTORS = [
  // GOV.UK Design System cookie banner
  '.govuk-cookie-banner',
  '[data-module="govuk-cookie-banner"]',
  '[data-module="cookie-banner"]',
  '[data-module*="cookie"]',
  // ARIA region with cookie label (GOV.UK and similar public-sector patterns)
  '[role="region"][aria-label*="cookie" i]',
  '[role="region"][aria-label*="consent" i]',
  // Named CMP containers
  '#onetrust-banner-sdk',
  '#CybotCookiebotDialog',
  '.cky-consent-container',
  '#didomi-notice',
  '#qc-cmp2-container',
  '#usercentrics-root',
  // ARIA dialog with consent label
  '[role="dialog"][aria-label*="cookie" i]',
  '[role="dialog"][aria-label*="consent" i]',
  '[role="dialog"][aria-label*="privacy" i]',
  '[role="alertdialog"]',
  // ID patterns
  '[id*="cookie-banner"]', '[id*="cookiebanner"]', '[id*="cookie_banner"]',
  '[id*="consent-banner"]', '[id*="consent_banner"]',
  '[id*="cookie-notice"]', '[id*="cookie_notice"]',
  '[id*="cookie-popup"]', '[id*="gdpr-banner"]', '[id*="privacy-banner"]',
  // Class patterns
  '[class*="cookie-banner"]', '[class*="cookiebanner"]',
  '[class*="consent-banner"]', '[class*="cookie-notice"]',
  '[class*="cookie-popup"]', '[class*="gdpr-banner"]',
  '[class*="privacy-banner"]', '[class*="privacy-notice"]',
];

// ---------------------------------------------------------------------------
// Button text patterns
// ---------------------------------------------------------------------------
const BUTTON_TEXTS = {
  // Full consent — should be treated as accept-all.
  // "accept cookies" / "allow cookies" / "ok" are accept-all; bare single-word
  // 'accept' / 'agree' are intentionally excluded because the word-boundary regex
  // (`(?:^|\s)accept(?:\s|$)`) still matches "Accept analytics cookies" (the word
  // is followed by a space), producing false positives on granular buttons.
  accept_all: [
    'accept all cookies',
    'allow all cookies',
    'agree to all cookies',
    'accept all',
    'allow all',
    'agree to all',
    'agree and proceed',
    'agree and close',
    'i accept all',
    'accept cookies',
    'allow cookies',
    'ok',
    // Welsh
    'derbyn pob cwci',
    'derbyn y cyfan',
    'derbyn cwcis',
  ],

  // Partial / category consent — requires an explicit category qualifier in the button text
  // (analytics, additional, optional, performance, functional, statistics, marketing, advertising,
  //  targeting, preferences).  A bare "Accept cookies" / "Accept" is accept_all, not granular.
  granular_accept: [
    'accept additional cookies',
    'accept analytics cookies',
    'accept optional cookies',
    'accept performance cookies',
    'accept functional cookies',
    'accept targeting cookies',
    'accept marketing cookies',
    'accept statistics cookies',
    'accept preferences cookies',
    'accept advertising cookies',
    // Welsh — category-qualified only
    'derbyn cwcis ychwanegol',
    'derbyn cwcis dadansoddol',
  ],

  reject: [
    // Specific phrases first
    'reject all cookies',
    'decline all cookies',
    'reject additional cookies',
    'reject analytics cookies',
    'reject optional cookies',
    'reject all',
    'decline all',
    'use necessary cookies only',
    'use essential cookies only',
    'necessary cookies only',
    'essential cookies only',
    'necessary only',
    'essential only',
    'accept only necessary cookies',
    'accept only necessary',
    'accept only essential cookies',
    'accept only essential',
    'accept necessary cookies only',
    'accept essential cookies only',
    'reject cookies',
    'decline cookies',
    'reject',
    'decline',
    // Welsh
    'gwrthod pob cwci',
    'gwrthod cwcis ychwanegol',
    'gwrthod y cyfan',
    'cwcis hanfodol yn unig',
    'gwrthod cwcis',
    'gwrthod',
  ],

  settings: [
    'manage cookie preferences',
    'manage cookies',
    'cookie preferences',
    'cookie settings',
    'manage preferences',
    'manage settings',
    'customise cookies',
    'customize cookies',
    'customise settings',
    'customize settings',
    'preferences',
    'settings',
    // Welsh
    'rheoli dewisiadau cwcis',
    'gosodiadau cwcis',
    'rheoli cwcis',
    'gosodiadau',
  ],
};

// ---------------------------------------------------------------------------
// Banner confirmation state patterns
// After clicking, some banners show a "thank you" message instead of removing.
// Checked against the banner container's text content.
// ---------------------------------------------------------------------------
const CONFIRMATION_PATTERNS = [
  /you have accepted/i,
  /you have rejected/i,
  /you.{0,5}ve\s+accepted/i,
  /you.{0,5}ve\s+rejected/i,
  /you.{0,5}ve\s+saved/i,
  /preferences\s+(have\s+been\s+|)saved/i,
  /settings\s+(have\s+been\s+|)saved/i,
  /your\s+consent\s+(has\s+been\s+|)saved/i,
  /consent\s+(has\s+been\s+|)recorded/i,
  /thank\s+you\s+for\s+your\s+(cookie\s+|)choice/i,
  /cookie\s+(preferences\s+|)updated/i,
  // Welsh
  /rydych\s+wedi\s+derbyn/i,
  /rydych\s+wedi\s+gwrthod/i,
  /dewisiadau\s+wedi.{0,10}cadw/i,
];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function checkJsGlobals(page, globals) {
  return page.evaluate(
    names => names.filter(n => { try { return window[n] != null; } catch (_) { return false; } }),
    globals
  );
}

async function checkDomSelectors(page, selectors) {
  const results = [];
  for (const sel of selectors) {
    try { if (await page.$(sel)) results.push(sel); } catch (_) {}
  }
  return results;
}

async function findFixedBanner(page) {
  return page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    let node;
    const candidates = [];
    while ((node = walker.nextNode())) {
      const el = /** @type {HTMLElement} */ (node);
      if (el.offsetHeight < 40) continue;
      const style = window.getComputedStyle(el);
      if (style.position !== 'fixed' && style.position !== 'sticky') continue;
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < window.innerWidth * 0.5) continue;
      // Keep elements anchored near the top OR near the bottom of the viewport.
      // Use AND so a short top banner (small rect.bottom) isn't incorrectly excluded.
      const nearTop    = rect.top    <= 120;
      const nearBottom = rect.bottom >= window.innerHeight - 120;
      if (!nearTop && !nearBottom) continue;
      const text = (el.textContent || '').toLowerCase();
      const score =
        (text.includes('cookie') ? 2 : 0) +
        (text.includes('consent') ? 2 : 0) +
        (text.includes('privacy') ? 1 : 0) +
        (text.includes('accept') ? 1 : 0) +
        (text.includes('reject') ? 1 : 0);
      if (score > 0) candidates.push({ el, score });
    }
    if (!candidates.length) return null;
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0].el;
    if (best.id) return `#${CSS.escape(best.id)}`;
    if (best.className && typeof best.className === 'string') {
      const cls = best.className.trim().split(/\s+/)[0];
      if (cls) return `.${CSS.escape(cls)}`;
    }
    return null;
  });
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------------------------------------------------------------------------
// findButtonByTexts — exported for use in scenarios.js
// ---------------------------------------------------------------------------

/**
 * Find the first visible button/link within `scope` whose accessible name or
 * text content contains one of the phrases in `textList`.
 *
 * @param {import('playwright').Locator} scope
 * @param {string[]} textList
 * @returns {Promise<import('playwright').Locator|null>}
 */
async function findButtonByTexts(scope, textList) {
  for (const text of textList) {
    const re = new RegExp(`(?:^|\\s)${escapeRegex(text)}(?:\\s|$)`, 'i');

    // 1. ARIA roles: button then link
    for (const role of ['button', 'link']) {
      const loc = scope.getByRole(role, { name: re });
      try {
        if (await loc.first().isVisible({ timeout: 400 })) return loc.first();
      } catch (_) {}
    }

    // 2. Broad element selector filtered by text content
    const loc = scope
      .locator('button, a, [role="button"], input[type="button"], input[type="submit"]')
      .filter({ hasText: re });
    try {
      if (await loc.first().isVisible({ timeout: 400 })) return loc.first();
    } catch (_) {}
  }
  return null;
}

// ---------------------------------------------------------------------------
// isBannerInConfirmationState — exported
// ---------------------------------------------------------------------------

/**
 * Check whether the banner has transitioned to a confirmation/thank-you state
 * (e.g. GOV.UK shows "You have accepted additional cookies" rather than hiding).
 *
 * @param {import('playwright').Page|import('playwright').Frame} page
 * @param {string|null} bannerSelector
 * @returns {Promise<boolean>}
 */
async function isBannerInConfirmationState(page, bannerSelector) {
  if (!bannerSelector) return false;
  const sel = bannerSelector.replace(/\s*\(.*\)$/, '');
  try {
    const text = await page.locator(sel).first().textContent({ timeout: 1500 });
    return CONFIRMATION_PATTERNS.some(re => re.test(text || ''));
  } catch (_) {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Phase 1: named CMP detection
// ---------------------------------------------------------------------------

async function detectCMP(page) {
  // First pass: check DOM selectors INCLUDING elements that may be hidden in the DOM
  // (e.g. GOV.UK cookie banner starts with hidden="" and is shown by JS after load)
  for (const sig of CMP_SIGNATURES) {
    const matchedGlobals = sig.jsGlobals.length ? await checkJsGlobals(page, sig.jsGlobals) : [];

    let matchedSelectors = [];
    if (sig.domSelectors.length) {
      // Try normal check first
      matchedSelectors = await checkDomSelectors(page, sig.domSelectors);
      // If nothing found, try including hidden elements (present in DOM but display:none / hidden attr)
      if (!matchedSelectors.length) {
        matchedSelectors = await page.evaluate((selectors) => {
          return selectors.filter(sel => {
            try { return !!document.querySelector(sel); } catch (_) { return false; }
          });
        }, sig.domSelectors).catch(() => []);
      }
    }

    if (!matchedGlobals.length && !matchedSelectors.length) continue;
    return { name: sig.name, iframeSelector: sig.iframeSelector ?? null, shadowHost: sig.shadowHost ?? null, matchedGlobals, matchedSelectors };
  }
  return { name: 'None', iframeSelector: null, shadowHost: null, matchedGlobals: [], matchedSelectors: [] };
}

// ---------------------------------------------------------------------------
// Phase 2: generic button finder
// ---------------------------------------------------------------------------

/**
 * Locate accept-all, granular-accept, reject, and settings buttons on the page.
 * Call this fresh inside each scenario context; locators do not survive context changes.
 *
 * @param {import('playwright').Page|import('playwright').Frame} ctx
 * @param {object} [cmpInfo]
 * @returns {Promise<BannerButtons>}
 *
 * @typedef {Object} BannerButtons
 * @property {import('playwright').Locator|null} acceptAll       - full consent button
 * @property {import('playwright').Locator|null} granularAccept  - category-level accept
 * @property {boolean}                           granularAcceptOnly
 * @property {import('playwright').Locator|null} reject
 * @property {import('playwright').Locator|null} settings
 * @property {string|null}                       bannerSelector
 */
async function findBannerButtons(ctx, cmpInfo = {}) {
  if (cmpInfo.shadowHost) {
    return { acceptAll: null, granularAccept: null, granularAcceptOnly: false, reject: null, settings: null, bannerSelector: cmpInfo.shadowHost };
  }

  // Find banner container
  let bannerLoc = null;
  let bannerSelector = null;

  for (const sel of BANNER_CONTAINER_SELECTORS) {
    try {
      const loc = ctx.locator(sel).first();
      if (await loc.isVisible({ timeout: 500 })) {
        bannerLoc = loc;
        bannerSelector = sel;
        break;
      }
    } catch (_) {}
  }

  // Fallback: computed-style fixed banner
  if (!bannerLoc && typeof ctx.evaluate === 'function') {
    const fixedSel = await findFixedBanner(ctx);
    if (fixedSel) {
      try {
        const loc = ctx.locator(fixedSel).first();
        if (await loc.isVisible({ timeout: 500 })) {
          bannerLoc = loc;
          bannerSelector = `${fixedSel} (computed-fixed)`;
        }
      } catch (_) {}
    }
  }

  const scope = bannerLoc ?? ctx.locator('body');

  // Find buttons in parallel
  const [acceptAll, granularAccept, reject, settings] = await Promise.all([
    findButtonByTexts(scope, BUTTON_TEXTS.accept_all),
    findButtonByTexts(scope, BUTTON_TEXTS.granular_accept),
    findButtonByTexts(scope, BUTTON_TEXTS.reject),
    findButtonByTexts(scope, BUTTON_TEXTS.settings),
  ]);

  // If reject not in banner, search whole page
  const rejectFinal = reject
    ?? (bannerLoc ? await findButtonByTexts(ctx.locator('body'), BUTTON_TEXTS.reject) : null);

  return {
    acceptAll,
    granularAccept,
    granularAcceptOnly: !acceptAll && !!granularAccept,
    reject:   rejectFinal,
    settings,
    bannerSelector,
  };
}

// ---------------------------------------------------------------------------
// Usercentrics shadow DOM helper
// ---------------------------------------------------------------------------

async function shadowClickButton(page, buttonType) {
  const texts = buttonType === 'accept'
    ? [...BUTTON_TEXTS.accept_all, ...BUTTON_TEXTS.granular_accept]
    : BUTTON_TEXTS[buttonType] || [];

  const clicked = await page.evaluate((textList) => {
    const host = document.querySelector('#usercentrics-root');
    if (!host || !host.shadowRoot) return false;
    const buttons = Array.from(host.shadowRoot.querySelectorAll('button, [role="button"], a'));
    for (const text of textList) {
      const re = new RegExp(text, 'i');
      const btn = buttons.find(b => re.test((b.textContent || '').trim()));
      if (btn) { btn.click(); return true; }
    }
    return false;
  }, texts);

  return clicked ? { success: true } : { success: false, reason: `No ${buttonType} button found in Usercentrics shadow DOM` };
}

// ---------------------------------------------------------------------------
// Policy link detection — finds cookie/privacy policy links in the banner
// and across the page (footer, header, nav).
// ---------------------------------------------------------------------------

/**
 * @param {import('playwright').Page} page
 * @param {object} cmpInfo   - result of detectCMP (used for matchedSelectors)
 * @returns {Promise<{ bannerLinks: object[], pageLinks: object[] }>}
 */
async function detectPolicyLinks(page, cmpInfo) {
  // Ordered list of selectors to try when locating the banner element
  const BANNER_HINTS = [
    ...(cmpInfo.matchedSelectors || []),
    '.govuk-cookie-banner',
    '[data-module="govuk-cookie-banner"]',
    '[data-module="cookie-banner"]',
    '[data-module*="cookie"]',
    '[role="region"][aria-label*="cookie" i]',
    '[role="dialog"][aria-label*="cookie" i]',
    '#onetrust-banner-sdk',
    '#CybotCookiebotDialog',
    '.cky-consent-container',
    '#didomi-notice',
    '#qc-cmp2-container',
    '[id*="cookie-banner"]',
    '[class*="cookie-banner"]',
    '[id*="consent-banner"]',
    '[class*="consent-banner"]',
  ];

  return page.evaluate((bannerHints) => {
    // ── patterns ──────────────────────────────────────────────────────────────
    const TEXT_RE = [
      /cookie\s*(policy|policies|notice|statement|information|use)/i,
      /privacy\s*(policy|notice|statement|information)/i,
      /data\s*protection/i,
      /privacy\s*(and|&)\s*cookies/i,
      /cookies?\s*(and|&)\s*privacy/i,
    ];
    const URL_RE = [
      /\/(cookies?[-_]?policy|cookies?[-_]?notice|cookie[-_]?statement)/i,
      /\/cookies$/i,
      /\/cookie$/i,
      /\/privacy/i,
      /\/data[-_]protection/i,
    ];

    function isPolicy(text, href) {
      return TEXT_RE.some(r => r.test(text)) || URL_RE.some(r => r.test(href));
    }

    function makeInfo(a, location) {
      const text = (a.textContent || '').trim().replace(/\s+/g, ' ');
      const href = a.href;
      if (!href || /^javascript:|^mailto:|^#/.test(href)) return null;
      if (!text && !isPolicy('', href)) return null;
      if (!isPolicy(text, href)) return null;
      return { text: text || href, href, location };
    }

    const seen     = new Set();
    const bannerLinks = [];
    const pageLinks   = [];

    function add(linkInfo) {
      if (!linkInfo || seen.has(linkInfo.href)) return;
      seen.add(linkInfo.href);
      (linkInfo.location === 'banner' ? bannerLinks : pageLinks).push(linkInfo);
    }

    // ── Banner ────────────────────────────────────────────────────────────────
    let bannerEl = null;
    for (const sel of bannerHints) {
      try {
        const el = document.querySelector(sel);
        if (el && el.getBoundingClientRect().height > 0) { bannerEl = el; break; }
      } catch (_) {}
    }
    if (bannerEl) {
      for (const a of bannerEl.querySelectorAll('a[href]')) add(makeInfo(a, 'banner'));
    }

    // ── Page zones (priority order) ───────────────────────────────────────────
    const ZONES = [
      ['footer', 'footer'],
      ['[id*="footer" i]', 'footer'],
      ['[class*="footer" i]', 'footer'],
      ['header', 'header'],
      ['[id*="header" i]', 'header'],
      ['nav, [role="navigation"]', 'nav'],
    ];
    for (const [sel, loc] of ZONES) {
      try {
        for (const container of document.querySelectorAll(sel)) {
          for (const a of container.querySelectorAll('a[href]')) add(makeInfo(a, loc));
        }
      } catch (_) {}
    }

    // ── Fallback: any remaining link on the page ───────────────────────────────
    for (const a of document.querySelectorAll('a[href]')) add(makeInfo(a, 'page'));

    return { bannerLinks, pageLinks };
  }, BANNER_HINTS);
}

module.exports = {
  detectCMP,
  detectPolicyLinks,
  findBannerButtons,
  findButtonByTexts,
  isBannerInConfirmationState,
  shadowClickButton,
  BUTTON_TEXTS,
};
