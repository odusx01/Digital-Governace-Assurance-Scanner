'use strict';

/**
 * scenarios.js
 *
 * Three consent scenarios in isolated browser contexts.
 *
 * Verification is direction-aware:
 *   accept: success if banner gone OR confirmation state OR cookies increased
 *   reject: success if banner gone OR confirmation state ONLY.
 *          Cookies increasing after a reject click is a separate CRITICAL finding,
 *          not a success signal. The scenario is still recorded as completed.
 *
 * Granular-accept:
 *   If only a category-level accept ("Accept analytics cookies") is found and
 *   no accept-all exists, the scenario completes with granularAcceptOnly:true.
 *   This is surfaced in the report — it is NOT treated as accept-all.
 *
 * Bot-blocking:
 *   If the site returns a non-2xx/3xx response (e.g. 403 from Akamai),
 *   the scenario is marked status:'blocked'.
 */

const path = require('path');
const { buildContextOpts } = require('./regions');
const {
  findBannerButtons,
  findButtonByTexts,
  isBannerInConfirmationState,
  shadowClickButton,
} = require('./cmp-detect');

const SCENARIOS = ['no-interaction', 'accept-all', 'reject-all', 'open-preferences', 'accept-analytics', 'accept-advertising', 'withdraw-consent', 'revisit-after-consent', 'gpc-comparison'];

const POST_CONSENT_SETTLE = 3500;
const POST_NAV_SETTLE = 2500;
const NAV_TIMEOUT = 60000;
const BANNER_GONE_TIMEOUT = 3500;

const SAVE_BUTTON_TEXTS = [
  'confirm my choices', 'save my choices', 'save preferences',
  'save and exit', 'save settings', 'save', 'done', 'apply',
  'cadw dewisiadau', 'cadw',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function thirdPartyFilter(targetHost) {
  return domain => !targetHost.endsWith(domain.replace(/^\./, ''));
}

function collectThirdPartyDomains(requests, targetHost) {
  const isThird = thirdPartyFilter(targetHost);
  return [...new Set(
    requests
      .map(u => { try { return new URL(u).hostname; } catch (_) { return null; } })
      .filter(Boolean)
      .filter(isThird)
  )];
}

function normaliseCookie(c, targetHost) {
  const isThird = thirdPartyFilter(targetHost);
  return {
    name: c.name,
    domain: c.domain,
    path: c.path,
    thirdParty: isThird(c.domain),
    secure: c.secure,
    httpOnly: c.httpOnly,
    sameSite: c.sameSite,
    expiresDays: c.expires > 0
      ? Math.round((c.expires * 1000 - Date.now()) / 86400000)
      : 'session',
    expiresRaw: c.expires,
  };
}

function isFrameDetached(err) {
  const msg = (err && err.message) ? err.message.toLowerCase() : '';
  return msg.includes('frame was detached') || msg.includes('frame detached')
    || msg.includes('target closed') || msg.includes('execution context was destroyed');
}

function cookieKey(c) { return `${c.name}||${c.domain}`; }

async function collectPrivacySignals(page) {
  return page.evaluate(() => {
    const controls = [...document.querySelectorAll('a, button, [role="button"]')]
      .map(el => ({
        text: (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 160),
        href: el.href || '',
      }))
      .filter(item => item.text || item.href)
      .filter(item => /do not sell|do not share|opt.?out|privacy choices|limit sensitive/i.test(`${item.text} ${item.href}`))
      .slice(0, 12);

    return {
      gpcObserved: navigator.globalPrivacyControl === true,
      optOutControls: controls,
      hasOptOutControl: controls.length > 0,
    };
  });
}

async function resolveContext(page, cmpInfo) {
  if (!cmpInfo.iframeSelector) return { ctx: page, frameResolved: false };
  try {
    const frameEl = await page.$(cmpInfo.iframeSelector);
    if (!frameEl) return { ctx: page, frameResolved: false };
    const frame = await frameEl.contentFrame();
    if (!frame) return { ctx: page, frameResolved: false };
    return { ctx: frame, frameResolved: true };
  } catch (_) {
    return { ctx: page, frameResolved: false };
  }
}

/**
 * Find the persistent preferences control that CMPs render after consent is given.
 * Used by the withdraw-consent journey to re-open preferences after the main banner is gone.
 */
async function findPersistentPreferencesControl(page, cmpInfo) {
  const cmpName = (cmpInfo && cmpInfo.name) || 'None';
  const cmpSpecific = {
    'OneTrust': ['.ot-floating-button__front', '#ot-sdk-btn', '.optanon-toggle-display', '[class*="ot-sdk-show-settings"]'],
    'Cookiebot': ['a[href*="CookieConsent"]', '#CookieConsentInfo a', '[id*="CybotCookiebot"][id*="Renew"]'],
    'CookieYes': ['.cky-btn-revisit'],
    'Sourcepoint': ['.sp_choice_type_MANAGE_PREFERENCES', '.sp_choice_type_MANAGE'],
    'TrustArc': ['.trustarc-manage-btn', '#truste-show-consent'],
    'Usercentrics': ['[data-testid="uc-privacy-button"]'],
  };

  for (const sel of (cmpSpecific[cmpName] || [])) {
    try {
      const el = page.locator(sel).first();
      if (await el.count() > 0 && await el.isVisible({ timeout: 500 }).catch(() => false)) return el;
    } catch (_) { }
  }

  // Generic: footer or body links/buttons with consent-related text
  const linkTexts = [
    'cookie settings', 'manage cookies', 'cookie preferences',
    'privacy settings', 'manage consent', 'manage preferences',
    'privacy preferences', 'change cookie settings', 'update cookie preferences',
    'your privacy choices', 'privacy choices',
  ];
  for (const text of linkTexts) {
    for (const scope of ['footer', 'body']) {
      try {
        const el = page.locator(`${scope} a:has-text("${text}"), ${scope} button:has-text("${text}")`).first();
        if (await el.count() > 0) return el;
      } catch (_) { }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Direction-aware verification
// ---------------------------------------------------------------------------

/**
 * Verify whether a consent action was effective.
 *
 * @param {import('playwright').Page} page
 * @param {import('playwright').BrowserContext} browserCtx
 * @param {string|null} bannerSelector
 * @param {'accept'|'reject'} direction
 * @param {number} cookieCountBefore  - cookie count captured before the click
 * @returns {Promise<{ verified: boolean|'unchecked', reason: string, confirmationState: boolean, cookiesIncreased?: boolean }>}
 */
async function verifyConsentCompleted(page, browserCtx, bannerSelector, direction, cookieCountBefore) {
  const sel = bannerSelector ? bannerSelector.replace(/\s*\(.*\)$/, '') : null;

  // 1. Banner gone?
  if (sel) {
    try {
      await page.waitForSelector(sel, { state: 'hidden', timeout: BANNER_GONE_TIMEOUT });
      return { verified: true, reason: `banner "${sel}" no longer visible`, confirmationState: false };
    } catch (_) { }
  }

  // 2. Banner in confirmation state?
  const confirmed = await isBannerInConfirmationState(page, sel);
  if (confirmed) {
    return { verified: true, reason: 'banner in confirmation state', confirmationState: true };
  }

  // 3. For accept only: cookies increased signals success
  if (direction === 'accept') {
    try {
      const cookies = await browserCtx.cookies();
      if (cookies.length > cookieCountBefore) {
        return {
          verified: true,
          reason: `cookies increased from ${cookieCountBefore} to ${cookies.length} after accept`,
          confirmationState: false,
          cookiesIncreased: true,
        };
      }
    } catch (_) { }
  }

  return {
    verified: false,
    reason: sel
      ? `banner "${sel}" still visible, no confirmation state, no cookie increase`
      : 'no banner selector — cannot verify',
    confirmationState: false,
  };
}

// ---------------------------------------------------------------------------
// Accept interaction
// ---------------------------------------------------------------------------

async function doAccept(page, ctx, buttons, framePrefix) {
  const acceptBtn = buttons.acceptAll ?? buttons.granularAccept;
  const granularAcceptOnly = buttons.granularAcceptOnly;

  if (!acceptBtn) {
    return {
      success: false, granularAcceptOnly: false,
      method: `${framePrefix}generic`,
      detail: `no accept button found (banner: ${buttons.bannerSelector})`,
      clicks: 0, firstLayer: false,
      bannerSelector: buttons.bannerSelector,
    };
  }

  let label = '';
  try { label = (await acceptBtn.textContent() || '').trim().slice(0, 80); } catch (_) { }

  try {
    await acceptBtn.click({ timeout: 8000 });
  } catch (err) {
    if (isFrameDetached(err)) {
      return {
        success: true, granularAcceptOnly,
        method: `${framePrefix}generic`,
        detail: label ? `clicked "${label}" (iframe closed)` : 'clicked accept (iframe closed)',
        clicks: 1, firstLayer: true,
        bannerSelector: buttons.bannerSelector,
      };
    }
    return {
      success: false, granularAcceptOnly: false,
      method: `${framePrefix}generic`,
      detail: err.message,
      clicks: 1, firstLayer: true,
      bannerSelector: buttons.bannerSelector,
    };
  }

  return {
    success: true, granularAcceptOnly,
    method: `${framePrefix}generic`,
    detail: label ? `clicked "${label}"` : 'clicked accept button',
    clicks: 1, firstLayer: true,
    bannerSelector: buttons.bannerSelector,
  };
}

// ---------------------------------------------------------------------------
// Reject interaction
// ---------------------------------------------------------------------------

async function doReject(page, ctx, buttons, cmpInfo, framePrefix) {
  // Direct reject
  if (buttons.reject) {
    let label = '';
    try { label = (await buttons.reject.textContent() || '').trim().slice(0, 80); } catch (_) { }

    let clickFailed = false;
    try {
      await buttons.reject.click({ timeout: 8000 });
    } catch (err) {
      if (isFrameDetached(err)) {
        return {
          success: true,
          method: `${framePrefix}generic`, detail: label ? `clicked "${label}" (iframe closed)` : 'clicked reject (iframe closed)',
          clicks: 1, firstLayer: true, bannerSelector: buttons.bannerSelector,
        };
      }
      clickFailed = true; // non-fatal error — fall through to settings layer
    }

    if (!clickFailed) {
      // Click did not throw — tentative success, verification runs in runScenario
      return {
        success: true,
        method: `${framePrefix}generic`, detail: label ? `clicked "${label}"` : 'clicked reject button',
        clicks: 1, firstLayer: true, bannerSelector: buttons.bannerSelector,
      };
    }
  }

  // Settings layer
  if (!buttons.settings) {
    return {
      success: false,
      method: `${framePrefix}generic`,
      detail: `no reject or settings button found (banner: ${buttons.bannerSelector})`,
      clicks: 0, firstLayer: false, bannerSelector: buttons.bannerSelector,
    };
  }

  let settingsLabel = '';
  try { settingsLabel = (await buttons.settings.textContent() || '').trim().slice(0, 80); } catch (_) { }

  try {
    await buttons.settings.click({ timeout: 8000 });
  } catch (err) {
    return {
      success: false,
      method: `${framePrefix}generic+settings`,
      detail: `settings button click failed: ${err.message}`,
      clicks: 1, firstLayer: false, bannerSelector: buttons.bannerSelector,
    };
  }

  await page.waitForTimeout(1500);

  // OneTrust: toggle-based rejection
  if (cmpInfo.name === 'OneTrust') {
    return doOneTrustToggleReject(page, ctx, framePrefix, settingsLabel, buttons.bannerSelector);
  }

  // Generic: look for reject in the now-open panel
  const panelButtons = await findBannerButtons(ctx, cmpInfo);
  if (panelButtons.reject) {
    let label = '';
    try { label = (await panelButtons.reject.textContent() || '').trim().slice(0, 80); } catch (_) { }
    try {
      await panelButtons.reject.click({ timeout: 8000 });
    } catch (err) {
      if (isFrameDetached(err)) {
        return {
          success: true, method: `${framePrefix}generic+settings`,
          detail: `opened "${settingsLabel}", clicked "${label}" (iframe closed)`,
          clicks: 2, firstLayer: false, bannerSelector: panelButtons.bannerSelector,
        };
      }
      return { success: false, method: `${framePrefix}generic+settings`, detail: err.message, clicks: 2, firstLayer: false, bannerSelector: panelButtons.bannerSelector };
    }
    return {
      success: true, method: `${framePrefix}generic+settings`,
      detail: `opened "${settingsLabel}", clicked "${label}"`,
      clicks: 2, firstLayer: false, bannerSelector: panelButtons.bannerSelector,
    };
  }

  return {
    success: false, method: `${framePrefix}generic+settings`,
    detail: `preferences panel opened ("${settingsLabel}") but no reject button found — may require per-category toggle interaction`,
    clicks: 2, firstLayer: false, bannerSelector: buttons.bannerSelector,
  };
}

// ---------------------------------------------------------------------------
// OneTrust toggle rejection
// ---------------------------------------------------------------------------

async function findOneTrustPanel(page) {
  for (const sel of ['#onetrust-pc-sdk', '.optanon-pc', '#optanon-popup-more-info-bar', '[id*="onetrust-pc"]']) {
    try {
      if (await page.locator(sel).first().isVisible({ timeout: 1000 })) return sel;
    } catch (_) { }
  }
  return null;
}

async function turnOffAllToggles(page, panelSelector) {
  const toggles = page.locator(`${panelSelector} input[type="checkbox"]`);
  const count = await toggles.count().catch(() => 0);
  if (count === 0) return { allOff: false, detail: 'no checkboxes found in panel', toggleResults: [], failedIds: [] };

  const toggleResults = [];

  for (let i = 0; i < count; i++) {
    const toggle = toggles.nth(i);
    const isDisabled = await toggle.isDisabled().catch(() => false);
    const id = await toggle.getAttribute('id').catch(() => `toggle-${i}`);

    if (isDisabled) { toggleResults.push({ id, result: 'skipped-always-active' }); continue; }

    const isChecked = await toggle.isChecked().catch(() => false);
    if (!isChecked) { toggleResults.push({ id, result: 'already-off' }); continue; }

    let clicked = false;
    if (id) {
      try {
        const label = page.locator(`label[for="${id}"]`).first();
        if (await label.count() > 0) { await label.click({ timeout: 3000 }); clicked = true; }
      } catch (_) { }
    }
    if (!clicked) {
      try { await toggle.click({ timeout: 3000 }); clicked = true; }
      catch (err) { toggleResults.push({ id, result: 'click-failed', reason: err.message }); continue; }
    }

    await page.waitForTimeout(250);
    const nowChecked = await toggle.isChecked().catch(() => true);
    toggleResults.push({ id, result: nowChecked ? 'still-on' : 'turned-off' });
  }

  const failed = toggleResults.filter(r => r.result === 'still-on' || r.result === 'click-failed');
  const allOff = failed.length === 0;
  const summary =
    `${toggleResults.filter(r => r.result === 'turned-off').length} turned off, ` +
    `${toggleResults.filter(r => r.result === 'already-off').length} already off, ` +
    `${toggleResults.filter(r => r.result === 'skipped-always-active').length} always-active, ` +
    `${failed.length} failed`;

  return { allOff, detail: summary, toggleResults, failedIds: failed.map(t => t.id) };
}

async function doOneTrustToggleReject(page, ctx, framePrefix, settingsLabel, bannerSelector) {
  await page.waitForTimeout(500);

  const panelSelector = await findOneTrustPanel(page);
  if (!panelSelector) {
    return {
      success: false, method: `${framePrefix}onetrust-toggles`,
      detail: 'preferences panel opened but panel container not found',
      clicks: 2, firstLayer: false, bannerSelector,
    };
  }

  const { allOff, detail: toggleDetail, toggleResults, failedIds } = await turnOffAllToggles(page, panelSelector);

  if (!allOff) {
    return {
      success: false, method: `${framePrefix}onetrust-toggles`,
      detail: `toggle rejection incomplete: ${toggleDetail}${failedIds.length ? `. Could not turn off: ${failedIds.join(', ')}` : ''}. Not clicking save.`,
      clicks: 2, firstLayer: false, bannerSelector, toggleResults,
    };
  }

  const scope = ctx.locator(panelSelector).first();
  const saveBtn = await findButtonByTexts(scope, SAVE_BUTTON_TEXTS)
    ?? await findButtonByTexts(ctx.locator('body'), SAVE_BUTTON_TEXTS);

  if (!saveBtn) {
    return {
      success: false, method: `${framePrefix}onetrust-toggles`,
      detail: `all toggles off (${toggleDetail}) but no save button found`,
      clicks: 2, firstLayer: false, bannerSelector, toggleResults,
    };
  }

  let saveLabel = '';
  try { saveLabel = (await saveBtn.textContent() || '').trim().slice(0, 80); } catch (_) { }

  try { await saveBtn.click({ timeout: 8000 }); }
  catch (err) {
    return {
      success: false, method: `${framePrefix}onetrust-toggles`,
      detail: `toggles off but save click failed: ${err.message}`,
      clicks: 2, firstLayer: false, bannerSelector, toggleResults,
    };
  }

  return {
    success: true, method: `${framePrefix}onetrust-toggles`,
    detail: `${toggleDetail}; clicked "${saveLabel}"`,
    clicks: 2, firstLayer: false, bannerSelector: panelSelector, toggleResults,
  };
}

// ---------------------------------------------------------------------------
// New journey interactions: open-preferences, accept-analytics, accept-advertising
// ---------------------------------------------------------------------------

async function performOpenPreferences(page, cmpInfo) {
  const { ctx, frameResolved } = await resolveContext(page, cmpInfo);
  const framePrefix = frameResolved ? 'iframe-' : '';
  const buttons = await findBannerButtons(ctx, cmpInfo);

  if (!buttons.settings) {
    return {
      success: false, method: `${framePrefix}generic`,
      detail: 'no settings button found',
      clicks: 0, firstLayer: false, bannerSelector: buttons.bannerSelector,
    };
  }

  let label = '';
  try { label = (await buttons.settings.textContent() || '').trim().slice(0, 80); } catch (_) { }

  try {
    await buttons.settings.click({ timeout: 8000 });
  } catch (err) {
    return {
      success: false, method: `${framePrefix}generic`,
      detail: `settings button click failed: ${err.message}`,
      clicks: 1, firstLayer: false, bannerSelector: buttons.bannerSelector,
    };
  }

  await page.waitForTimeout(2000);

  return {
    success: true, method: `${framePrefix}generic+settings`,
    detail: label ? `opened "${label}"` : 'opened preferences panel',
    clicks: 1, firstLayer: false, bannerSelector: buttons.bannerSelector,
  };
}

async function performAcceptCategory(page, cmpInfo, categoryLabel) {
  const { ctx, frameResolved } = await resolveContext(page, cmpInfo);
  const framePrefix = frameResolved ? 'iframe-' : '';
  const buttons = await findBannerButtons(ctx, cmpInfo);

  if (!buttons.settings) {
    return {
      success: false, method: `${framePrefix}generic`,
      detail: 'no settings button found',
      clicks: 0, firstLayer: false, bannerSelector: buttons.bannerSelector,
    };
  }

  let settingsLabel = '';
  try { settingsLabel = (await buttons.settings.textContent() || '').trim().slice(0, 80); } catch (_) { }

  try {
    await buttons.settings.click({ timeout: 8000 });
  } catch (err) {
    return {
      success: false, method: `${framePrefix}generic`,
      detail: `settings button click failed: ${err.message}`,
      clicks: 1, firstLayer: false, bannerSelector: buttons.bannerSelector,
    };
  }

  await page.waitForTimeout(2000);

  const categories = await discoverCategories(page);
  const target = categories.find(c => c.label.toLowerCase().includes(categoryLabel.toLowerCase()));

  if (!target) {
    return {
      success: false, method: `${framePrefix}generic+settings`,
      detail: `opened "${settingsLabel}" but no "${categoryLabel}" category found`,
      clicks: 1, firstLayer: false, bannerSelector: buttons.bannerSelector,
    };
  }

  const saved = await acceptOnlyCategory(page, target.toggleId);
  if (!saved) {
    return {
      success: false, method: `${framePrefix}generic+settings`,
      detail: `opened "${settingsLabel}", found "${target.label}" but could not save`,
      clicks: 1, firstLayer: false, bannerSelector: buttons.bannerSelector,
    };
  }

  return {
    success: true, method: `${framePrefix}generic+settings`,
    detail: `opened "${settingsLabel}", accepted "${target.label}" only`,
    clicks: 2, firstLayer: false, bannerSelector: buttons.bannerSelector,
  };
}

// ---------------------------------------------------------------------------
// Unified interaction entry point
// ---------------------------------------------------------------------------

async function performInteraction(page, cmpInfo, buttonType) {
  if (cmpInfo.shadowHost) {
    const result = await shadowClickButton(page, buttonType);
    return {
      success: result.success, granularAcceptOnly: false,
      method: 'shadow-dom',
      detail: result.reason || `clicked ${buttonType} in shadow DOM`,
      clicks: 1, firstLayer: true,
      bannerSelector: cmpInfo.shadowHost,
    };
  }

  if (buttonType === 'open-preferences') {
    return performOpenPreferences(page, cmpInfo);
  }

  if (buttonType === 'accept-analytics' || buttonType === 'accept-advertising') {
    const categoryLabel = buttonType === 'accept-analytics' ? 'analytics' : 'advertising';
    return performAcceptCategory(page, cmpInfo, categoryLabel);
  }

  const { ctx, frameResolved } = await resolveContext(page, cmpInfo);
  const framePrefix = frameResolved ? 'iframe-' : '';
  const buttons = await findBannerButtons(ctx, cmpInfo);

  const action = buttonType === 'accept'
    ? await doAccept(page, ctx, buttons, framePrefix)
    : await doReject(page, ctx, buttons, cmpInfo, framePrefix);

  if (frameResolved && cmpInfo.iframeSelector && action.bannerSelector) {
    action.bannerSelector = cmpInfo.iframeSelector;
  }

  return action;
}

async function collectAdvancedEvidence(page) {
  const indexedDB = await page.evaluate(() => {
    const dbs = [];
    try {
      const request = indexedDB.databases();
      if (request && typeof request.then === 'function') {
        request.then(names => {
          for (const db of names || []) {
            dbs.push({ name: db.name, version: db.version });
          }
        }).catch(() => {});
      }
    } catch (_) { }
    return dbs;
  }).catch(() => []);

  const webWorkers = await page.evaluate(() => {
    const workers = [];
    try {
      for (const w of navigator.serviceWorker?.getRegistrations?.() || []) {
        workers.push({ scope: w.scope, state: w.active?.state || 'unknown' });
      }
    } catch (_) { }
    return workers;
  }).catch(() => []);

  const formSubmissions = await page.evaluate(() => {
    const forms = [];
    try {
      for (const el of document.querySelectorAll('form')) {
        forms.push({
          action: el.action || location.href,
          method: (el.method || 'GET').toUpperCase(),
          id: el.id || null,
          name: el.name || null,
        });
      }
    } catch (_) { }
    return forms;
  }).catch(() => []);

  const consentEvents = await page.evaluate(() => {
    const events = [];
    try {
      window.addEventListener('consent', e => events.push({ type: 'consent', detail: e.detail }), true);
      window.addEventListener('onetrust-consent-saved', () => events.push({ type: 'onetrust-consent-saved' }), true);
      window.addEventListener('cookie-consent', e => events.push({ type: 'cookie-consent', detail: e.detail }), true);
    } catch (_) { }
    return events;
  }).catch(() => []);

  const googleConsentMode = await page.evaluate(() => {
    try {
      return typeof window.google_tag_data !== 'undefined' ||
        typeof window.dataLayer !== 'undefined' &&
        Array.isArray(window.dataLayer) &&
        window.dataLayer.some(item => item && item[0] === 'consent' && typeof item[1] === 'object');
    } catch (_) {
      return false;
    }
  }).catch(() => false);

  return {
    indexedDB,
    webWorkers,
    formSubmissions,
    consentEvents,
    googleConsentMode,
  };
}

// ---------------------------------------------------------------------------
// Core: single scenario
// ---------------------------------------------------------------------------

async function runScenario(browser, url, scenario, cmpInfo, opts = {}) {
  const outputDir = opts.outputDir || '.';
  const screenshotPath = path.join(outputDir, `screenshot-${scenario}.png`);
  const targetHost = new URL(url).hostname;

  const context = await browser.newContext({ storageState: undefined, ...buildContextOpts(opts.regionContext) });
  if (opts.regionContext?.globalPrivacyControl) {
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'globalPrivacyControl', {
        configurable: true,
        get: () => true,
      });
    });
  }
  const requests = [];
  const responses = new Map();
  const cookieEvents = [];
  const page = await context.newPage();
  page.on('request', r => {
    const frame = r.frame();
    requests.push({
      url: r.url(),
      method: r.method(),
      resourceType: r.resourceType(),
      initiator: frame ? frame.url() : null,
      timestamp: Date.now(),
    });
  });
  page.on('response', async r => {
    const request = r.request();
    responses.set(request.url(), {
      status: r.status(),
      contentType: r.headers()['content-type'] || null,
    });
  });
  page.on('setcookie', name => {
    cookieEvents.push({ type: 'set', name, timestamp: Date.now() });
  });

  const result = {
    scenario,
    status: 'ok',
    statusReason: null,
    consentAction: null,
    granularAcceptOnly: false,
    cookies: [],
    newCookiesAfterReject: [],
    storage: { localStorage: [], sessionStorage: [] },
    cookieEvents: [],
    requests: [],
    thirdPartyDomains: [],
    privacySignals: { gpcRequested: Boolean(opts.regionContext?.globalPrivacyControl), gpcObserved: false, hasOptOutControl: false, optOutControls: [] },
    screenshotPath,
  };

  try {
    const response = await page.goto(url, { waitUntil: 'load', timeout: NAV_TIMEOUT });

    // Detect bot-blocking
    const status = response ? response.status() : 0;
    if (status === 403 || status === 429 || status === 503) {
      const bodyText = await page.evaluate(() => (document.body && document.body.innerText || '').slice(0, 100));
      if (/access denied|forbidden|blocked|captcha/i.test(bodyText) || status === 403) {
        result.status = 'blocked';
        result.statusReason = `HTTP ${status} — bot/access-control block (${bodyText.slice(0, 60)})`;
        await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => { });
        return result;
      }
    }

    await page.waitForTimeout(POST_NAV_SETTLE);
    result.privacySignals = {
      ...result.privacySignals,
      ...(await collectPrivacySignals(page)),
    };

    const advancedEvidence = await collectAdvancedEvidence(page);
    result.indexedDB = advancedEvidence.indexedDB;
    result.webWorkers = advancedEvidence.webWorkers;
    result.formSubmissions = advancedEvidence.formSubmissions;
    result.consentEvents = advancedEvidence.consentEvents;
    result.googleConsentMode = advancedEvidence.googleConsentMode;

    if (scenario === 'accept-all' || scenario === 'reject-all' || scenario === 'open-preferences' || scenario === 'accept-analytics' || scenario === 'accept-advertising') {
      const interactionType = scenario === 'accept-all' || scenario === 'accept-analytics' || scenario === 'accept-advertising' ? 'accept' : scenario === 'reject-all' ? 'reject' : scenario;
      const buttonType = scenario;

      // Snapshot cookies BEFORE consent action
      const cookiesBeforeAction = await context.cookies();
      const cookieCountBefore = cookiesBeforeAction.length;

      const action = await performInteraction(page, cmpInfo, buttonType);
      result.consentAction = action;
      result.granularAcceptOnly = action.granularAcceptOnly || false;

      if (action.success) {
        if (scenario === 'open-preferences') {
          await page.waitForTimeout(POST_CONSENT_SETTLE);
        } else {
          await page.waitForTimeout(POST_CONSENT_SETTLE);

          const verification = await verifyConsentCompleted(
            page, context, action.bannerSelector, interactionType, cookieCountBefore
          );
          action.verification = verification;

          if (verification.verified === false && interactionType === 'accept') {
            result.status = 'manual-review-needed';
            result.statusReason = `Click registered but verification failed: ${verification.reason}`;
            action.success = false;
          }

          if (action.success && interactionType === 'reject') {
            const cookiesAfterAction = await context.cookies();
            const beforeKeys = new Set(cookiesBeforeAction.map(cookieKey));
            result.newCookiesAfterReject = cookiesAfterAction
              .filter(c => !beforeKeys.has(cookieKey(c)))
              .map(c => normaliseCookie(c, targetHost));
          }
        }
      } else {
        result.status = 'manual-review-needed';
        result.statusReason = action.detail;
      }
    }

    // ── Withdraw-consent journey ─────────────────────────────────────────────
    // Accept consent, reload in same context (banner should stay hidden),
    // then find and use the persistent preferences control to withdraw.
    if (scenario === 'withdraw-consent') {
      const cookiesBeforeAccept = await context.cookies();

      const acceptAction = await performInteraction(page, cmpInfo, 'accept');
      result.consentAction = acceptAction;
      result.granularAcceptOnly = acceptAction.granularAcceptOnly || false;

      if (!acceptAction.success) {
        result.status = 'manual-review-needed';
        result.statusReason = `Could not accept consent for withdrawal test: ${acceptAction.detail}`;
      } else {
        await page.waitForTimeout(POST_CONSENT_SETTLE);
        const cookiesAfterAccept = await context.cookies();

        // Reload in same context so CMP initialises with consent cookies set
        await page.goto(url, { waitUntil: 'load', timeout: NAV_TIMEOUT });
        await page.waitForTimeout(POST_NAV_SETTLE);

        const prefsControl = await findPersistentPreferencesControl(page, cmpInfo);
        if (!prefsControl) {
          result.status = 'manual-review-needed';
          result.statusReason = 'No persistent preferences control found after consent — manual verification required';
        } else {
          try { await prefsControl.click({ timeout: 5000 }); } catch (_) { }
          await page.waitForTimeout(2000);

          const { ctx: wCtx, frameResolved: wFr } = await resolveContext(page, cmpInfo);
          const withdrawButtons = await findBannerButtons(wCtx, cmpInfo);
          const withdrawAction = await doReject(page, wCtx, withdrawButtons, cmpInfo, wFr ? 'iframe-' : '');
          result.withdrawAction = withdrawAction;

          if (withdrawAction.success) {
            await page.waitForTimeout(POST_CONSENT_SETTLE);
            const cookiesAfterWithdrawal = await context.cookies();
            const acceptedKeys = new Set(cookiesAfterAccept.map(cookieKey));
            result.cookiesRetainedAfterWithdrawal = cookiesAfterWithdrawal
              .filter(c => acceptedKeys.has(cookieKey(c)))
              .map(c => normaliseCookie(c, targetHost));
          } else {
            result.status = 'manual-review-needed';
            result.statusReason = `Accepted consent but could not withdraw: ${withdrawAction.detail}`;
          }
        }
      }
    }

    // ── Revisit-after-consent journey ────────────────────────────────────────
    // Accept consent, then navigate to the same URL in the same context.
    // Checks whether the banner reappears and whether consent cookies persist.
    if (scenario === 'revisit-after-consent') {
      const acceptAction = await performInteraction(page, cmpInfo, 'accept');
      result.consentAction = acceptAction;
      result.granularAcceptOnly = acceptAction.granularAcceptOnly || false;

      if (!acceptAction.success) {
        result.status = 'manual-review-needed';
        result.statusReason = `Could not accept consent for revisit test: ${acceptAction.detail}`;
      } else {
        await page.waitForTimeout(POST_CONSENT_SETTLE);
        const cookiesAfterAccept = await context.cookies();

        // Navigate to same URL in same context (simulates user navigating back)
        await page.goto(url, { waitUntil: 'load', timeout: NAV_TIMEOUT });
        await page.waitForTimeout(POST_NAV_SETTLE);

        // Check whether the banner reappeared
        const bannerSel = acceptAction.bannerSelector
          ? acceptAction.bannerSelector.replace(/\s*\(.*\)$/, '')
          : null;
        let bannerReappeared = false;
        if (bannerSel) {
          try {
            bannerReappeared = await page.locator(bannerSel).first().isVisible({ timeout: 1500 });
          } catch (_) { }
        }
        result.revisitBannerReappeared = bannerReappeared;

        // Check whether the consent cookies are still present
        const cookiesOnRevisit = await context.cookies();
        const acceptedKeys = new Set(cookiesAfterAccept.map(cookieKey));
        result.cookiesPersistedOnRevisit = cookiesOnRevisit
          .filter(c => acceptedKeys.has(cookieKey(c)))
          .map(c => normaliseCookie(c, targetHost));

        if (bannerReappeared) {
          result.status = 'manual-review-needed';
          result.statusReason = 'Consent banner reappeared after revisiting — consent may not be persisted across navigation';
        }
      }
    }

    const rawCookies = await context.cookies();
    result.cookies = rawCookies.map(c => normaliseCookie(c, targetHost));

    result.storage = await page.evaluate(() => ({
      localStorage: Object.keys(localStorage),
      sessionStorage: Object.keys(sessionStorage),
    }));

    const enrichedRequests = requests.map(r => ({
      ...r,
      response: responses.get(r.url) || null,
    }));
    result.requests = enrichedRequests;
    result.cookieEvents = cookieEvents;
    result.thirdPartyDomains = collectThirdPartyDomains(requests.map(r => r.url), targetHost);
    await page.screenshot({ path: screenshotPath, fullPage: false });

    if (opts.customJourneySteps && opts.customJourneySteps.length) {
      result.customJourneyStatus = await executeCustomJourney(page, opts.customJourneySteps, cmpInfo);
    }

  } catch (err) {
    result.status = 'error';
    result.statusReason = err.message;
    try { await page.screenshot({ path: screenshotPath, fullPage: false }); } catch (_) { }
  } finally {
    await context.close();
  }

  return result;
}

// ---------------------------------------------------------------------------
// Run all three scenarios
// ---------------------------------------------------------------------------

async function runAllScenarios(browser, url, cmpInfo, opts = {}) {
  const results = [];
  for (const scenario of SCENARIOS) {
    console.log(`  Running scenario: ${scenario} ...`);
    const result = await runScenario(browser, url, scenario, cmpInfo, opts);

    const flag = result.status !== 'ok' ? ` [${result.status}]` : '';
    const detail = result.consentAction?.detail ? ` — ${result.consentAction.detail}` : '';
    const gran = result.granularAcceptOnly ? ' [granular-only]' : '';
    console.log(`    → ${result.status}${flag} | ${result.cookies.length} cookies${gran}${detail}`);
    results.push(result);
  }
  return results;
}

// ---------------------------------------------------------------------------
// GPC comparison journey
// ---------------------------------------------------------------------------

/**
 * Runs two no-interaction visits — one without GPC and one with GPC — and
 * diffs the cookies and network domains to detect GPC-responsive suppression.
 *
 * Returns a result object that fits the same shape as runScenario results so
 * run-scan.js can push it into scenarioResults without special-casing.
 */
async function runGpcComparison(browser, url, cmpInfo, opts = {}) {
  const targetHost = new URL(url).hostname;
  const baseOpts = buildContextOpts(opts.regionContext || {});

  async function runArm(withGpc) {
    const ctxOpts = { ...baseOpts };
    if (withGpc) {
      ctxOpts.extraHTTPHeaders = { ...(ctxOpts.extraHTTPHeaders || {}), 'Sec-GPC': '1' };
    }
    const ctx = await browser.newContext({ storageState: undefined, ...ctxOpts });
    if (withGpc) {
      await ctx.addInitScript(() => {
        Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, get: () => true });
      });
    }
    const reqs = [];
    const page = await ctx.newPage();
    page.on('request', r => reqs.push({ url: r.url(), resourceType: r.resourceType(), timestamp: Date.now() }));
    try {
      await page.goto(url, { waitUntil: 'load', timeout: NAV_TIMEOUT });
      await page.waitForTimeout(POST_NAV_SETTLE);
      const cookies = (await ctx.cookies()).map(c => normaliseCookie(c, targetHost));
      const domains = collectThirdPartyDomains(reqs.map(r => r.url), targetHost);
      return { cookies, requests: reqs, thirdPartyDomains: domains, error: null };
    } catch (err) {
      return { cookies: [], requests: [], thirdPartyDomains: [], error: err.message };
    } finally {
      await ctx.close();
    }
  }

  const withoutGpc = await runArm(false);
  const withGpc    = await runArm(true);

  const withoutGpcDomains = new Set(withoutGpc.thirdPartyDomains);
  const withGpcDomains    = new Set(withGpc.thirdPartyDomains);
  const domainsBlockedByGpc = [...withoutGpcDomains].filter(d => !withGpcDomains.has(d));
  const domainsUnchanged    = [...withoutGpcDomains].filter(d => withGpcDomains.has(d));

  const withoutGpcCookieKeys = new Set(withoutGpc.cookies.map(c => `${c.name}||${c.domain}`));
  const withGpcCookieKeys    = new Set(withGpc.cookies.map(c => `${c.name}||${c.domain}`));
  const cookiesBlockedByGpc  = [...withoutGpcCookieKeys].filter(k => !withGpcCookieKeys.has(k));

  const gpcEffective = domainsBlockedByGpc.length > 0 || cookiesBlockedByGpc.length > 0;

  return {
    scenario: 'gpc-comparison',
    status: withoutGpc.error || withGpc.error ? 'error' : 'ok',
    statusReason: withoutGpc.error || withGpc.error || null,
    consentAction: null,
    granularAcceptOnly: false,
    cookies: withoutGpc.cookies,
    newCookiesAfterReject: [],
    storage: { localStorage: [], sessionStorage: [] },
    cookieEvents: [],
    requests: withoutGpc.requests,
    thirdPartyDomains: withoutGpc.thirdPartyDomains,
    privacySignals: {
      gpcRequested: true,
      gpcObserved: gpcEffective,
      hasOptOutControl: false,
      optOutControls: [],
    },
    // GPC-specific fields
    gpcWithoutGpc: withoutGpc,
    gpcWithGpc: withGpc,
    gpcDelta: {
      domainsBlockedByGpc,
      domainsUnchanged,
      cookiesBlockedByGpc,
      gpcEffective,
    },
  };
}

// ---------------------------------------------------------------------------
// Category analysis
// ---------------------------------------------------------------------------

/**
 * Extract optional consent categories from an already-open preferences panel.
 * Returns [{ label, toggleId }] — strictly-necessary / always-active excluded.
 */
async function discoverCategories(page) {
  return page.evaluate(() => {
    const results = [];

    // ── OneTrust ──────────────────────────────────────────────────────────
    const otSdk = document.querySelector('#onetrust-pc-sdk');
    if (otSdk) {
      for (const grp of otSdk.querySelectorAll('.ot-acc-grp')) {
        const toggle = grp.querySelector('input[type="checkbox"]');
        if (!toggle || toggle.disabled) continue;
        if (grp.querySelector('.ot-always-active, [class*="always-active"]')) continue;
        const titleEl = grp.querySelector('.ot-acc-hdr h4, h4, h3, h2');
        const label = (titleEl?.textContent || toggle.getAttribute('aria-label') || 'Category')
          .replace(/\s+/g, ' ').trim().slice(0, 60);
        results.push({ label, toggleId: toggle.id || null });
      }
      if (results.length) return results;
    }

    // ── Cookiebot ─────────────────────────────────────────────────────────
    const cb = document.querySelector('#CybotCookiebotDialog');
    if (cb) {
      for (const chk of cb.querySelectorAll('input[type="checkbox"]:not(:disabled)')) {
        const labelEl = chk.id ? document.querySelector(`label[for="${chk.id}"]`) : null;
        const label = (labelEl?.textContent || chk.getAttribute('aria-label') || chk.id || 'Category')
          .replace(/\s+/g, ' ').trim().slice(0, 60);
        results.push({ label, toggleId: chk.id || null });
      }
      if (results.length) return results;
    }

    // ── Generic ───────────────────────────────────────────────────────────
    for (const sel of ['[id*="consent"]', '[id*="cookie"]', '[class*="consent"]', '[role="dialog"]']) {
      const c = document.querySelector(sel);
      if (!c) continue;
      for (const chk of c.querySelectorAll('input[type="checkbox"]:not(:disabled)')) {
        const labelEl = chk.id ? document.querySelector(`label[for="${chk.id}"]`) : null;
        const label = (labelEl?.textContent || chk.getAttribute('aria-label') || chk.name || 'Category')
          .replace(/\s+/g, ' ').trim().slice(0, 60);
        if (label) results.push({ label, toggleId: chk.id || null });
      }
      if (results.length) return results;
    }

    return results;
  });
}

/**
 * With the preferences panel open: turn off all optional toggles, enable only the
 * one matching targetToggleId, then click Save.  Returns true if save was clicked.
 */
async function acceptOnlyCategory(page, targetToggleId) {
  const toggles = page.locator('input[type="checkbox"]:not(:disabled)');
  const count = await toggles.count().catch(() => 0);
  if (!count) return false;

  for (let i = 0; i < count; i++) {
    const toggle = toggles.nth(i);
    const id = await toggle.getAttribute('id').catch(() => null);
    const shouldOn = id !== null && id === targetToggleId;
    const isChecked = await toggle.isChecked().catch(() => false);
    if (shouldOn === isChecked) continue;

    let clicked = false;
    if (id) {
      try {
        const lbl = page.locator(`label[for="${id}"]`).first();
        if (await lbl.count() > 0) { await lbl.click({ timeout: 2000 }); clicked = true; }
      } catch (_) { }
    }
    if (!clicked) { try { await toggle.click({ timeout: 2000 }); } catch (_) { } }
    await page.waitForTimeout(200);
  }

  const saveBtn = await findButtonByTexts(page.locator('body'), SAVE_BUTTON_TEXTS);
  if (!saveBtn) return false;
  try { await saveBtn.click({ timeout: 8000 }); return true; }
  catch (_) { return false; }
}

/**
 * Discover optional consent categories then run one isolated browser session per
 * category, accepting only that category and diffing cookies against baseline.
 *
 * @param {import('playwright').Browser} browser
 * @param {string}   url
 * @param {object}   cmpInfo
 * @param {object[]} baselineCookies   cookies from the no-interaction scenario
 * @param {object}   opts
 * @param {Function} onProgress        (message: string) => void
 * @returns {Promise<{ categoryResults: object[], status: string }>}
 */
async function runCategoryScenarios(browser, url, cmpInfo, baselineCookies, opts, onProgress) {
  const targetHost = new URL(url).hostname;
  const onProg = onProgress || (() => { });
  const baselineKeys = new Set((baselineCookies || []).map(c => `${c.name}||${c.domain}`));
  const ctxOpts = buildContextOpts((opts || {}).regionContext);

  // ── Discover categories ───────────────────────────────────────────────────
  onProg('Discovering consent categories');
  let categories = [];
  {
    const ctx = await browser.newContext(ctxOpts);
    const page = await ctx.newPage();
    try {
      await page.goto(url, { waitUntil: 'load', timeout: 60000 });
      await page.waitForTimeout(2000);
      const { settings: settingsBtn } = await findBannerButtons(page, cmpInfo);
      if (!settingsBtn) return { categoryResults: [], status: 'no-settings-button' };
      await settingsBtn.click({ timeout: 5000 });
      await page.waitForTimeout(1500);
      categories = await discoverCategories(page);
    } catch (_) {
      return { categoryResults: [], status: 'discovery-error' };
    } finally {
      await ctx.close();
    }
  }

  if (!categories.length) return { categoryResults: [], status: 'no-categories-found' };

  // ── Per-category runs ─────────────────────────────────────────────────────
  const categoryResults = [];

  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i];
    onProg(`Testing category ${i + 1}/${categories.length}: ${cat.label}`);

    const ctx = await browser.newContext(ctxOpts);
    const page = await ctx.newPage();
    let cookiesDropped = [];
    let status = 'ok';

    try {
      await page.goto(url, { waitUntil: 'load', timeout: 60000 });
      await page.waitForTimeout(2000);

      const { settings: settingsBtn } = await findBannerButtons(page, cmpInfo);
      if (!settingsBtn) {
        status = 'no-settings-button';
      } else {
        await settingsBtn.click({ timeout: 5000 });
        await page.waitForTimeout(1500);

        const saved = cat.toggleId
          ? await acceptOnlyCategory(page, cat.toggleId)
          : false;

        if (!saved) {
          status = 'could-not-isolate';
        } else {
          await page.waitForTimeout(POST_CONSENT_SETTLE);
          cookiesDropped = (await ctx.cookies())
            .filter(c => !baselineKeys.has(`${c.name}||${c.domain}`))
            .map(c => normaliseCookie(c, targetHost));
        }
      }
    } catch (_) {
      status = 'error';
    } finally {
      await ctx.close();
    }

    categoryResults.push({ label: cat.label, toggleId: cat.toggleId, cookiesDropped, status });
  }

  return { categoryResults, status: 'ok' };
}

/**
 * Test whether a consent choice is persisted across a fresh page load.
 * Accepts consent, then opens a new page in the SAME context and checks if the banner reappears.
 *
 * @param {import('playwright').Browser} browser
 * @param {string} url
 * @param {object} cmpInfo
 * @returns {Promise<boolean>}  true = persisted (good), false = banner reappeared (bad)
 */
async function checkConsentPersistence(browser, url, cmpInfo, opts = {}) {
  const context = await browser.newContext(buildContextOpts(opts.regionContext));
  try {
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'load', timeout: NAV_TIMEOUT });
    await page.waitForTimeout(POST_NAV_SETTLE);

    // Accept consent
    const action = await performInteraction(page, cmpInfo, 'accept');
    if (!action.success) return true; // can't test, assume ok

    await page.waitForTimeout(POST_CONSENT_SETTLE);

    // Navigate to the same URL in the same context (simulates same-session revisit)
    await page.goto(url, { waitUntil: 'load', timeout: NAV_TIMEOUT });
    await page.waitForTimeout(POST_NAV_SETTLE);

    // Check if banner is visible again
    const bannerVisible = await page.evaluate((selectors) => {
      for (const sel of selectors) {
        try {
          const el = document.querySelector(sel);
          if (el) {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) return true;
          }
        } catch (_) { }
      }
      return false;
    }, [
      cmpInfo.bannerSelector,
      '#onetrust-consent-sdk', '#onetrust-banner-sdk',
      '[id*="consent"]', '[id*="cookie-banner"]',
      '.govuk-cookie-banner', '[data-module="govuk-cookie-banner"]',
      '#CybotCookiebotDialog',
    ].filter(Boolean)).catch(() => false);

    return !bannerVisible; // persisted = banner is gone
  } catch (_) {
    return true; // error = assume ok (can't test)
  } finally {
    await context.close();
  }
}

async function executeCustomJourney(page, steps, cmpInfo) {
  // Accepts a single step object (legacy) or an array of step objects.
  const stepList = Array.isArray(steps) ? steps : [steps];
  const results = [];

  for (const step of stepList) {
    const { type, value } = step || {};
    let stepResult;
    try {
      switch (type) {
        case 'click': {
          await page.waitForSelector(value, { timeout: 5000 });
          await page.click(value);
          await page.waitForTimeout(1000);
          stepResult = { success: true, detail: `Clicked ${value}` };
          break;
        }
        case 'open-preferences': {
          const action = await performInteraction(page, cmpInfo || {}, 'open-preferences');
          stepResult = { success: action.success, detail: action.detail };
          break;
        }
        case 'toggle-category': {
          const action = await performAcceptCategory(page, cmpInfo || {}, value);
          stepResult = { success: action.success, detail: action.detail };
          break;
        }
        case 'save': {
          const saveBtn = await findButtonByTexts(page.locator('body'), SAVE_BUTTON_TEXTS);
          if (saveBtn) {
            await saveBtn.click({ timeout: 5000 });
            stepResult = { success: true, detail: 'Clicked save button' };
          } else {
            stepResult = { success: false, detail: 'No save button found' };
          }
          break;
        }
        case 'navigate': {
          await page.goto(value, { waitUntil: 'load', timeout: 30000 });
          stepResult = { success: true, detail: `Navigated to ${value}` };
          break;
        }
        case 'scroll': {
          const pixels = parseInt(value, 10) || 500;
          await page.evaluate(p => window.scrollBy(0, p), pixels);
          await page.waitForTimeout(800);
          stepResult = { success: true, detail: `Scrolled ${pixels}px` };
          break;
        }
        case 'wait': {
          const ms = parseInt(value, 10) || 1000;
          await page.waitForTimeout(ms);
          stepResult = { success: true, detail: `Waited ${ms}ms` };
          break;
        }
        default:
          stepResult = { success: false, detail: `Unknown journey step type: ${type}` };
      }
    } catch (err) {
      stepResult = { success: false, detail: err.message };
    }
    results.push({ type, value, ...stepResult });
    if (!stepResult.success) break;  // stop on first failure
  }

  return {
    steps: results,
    success: results.length > 0 && results.every(r => r.success),
    detail: results.map(r => r.detail).join(' → '),
  };
}

module.exports = { runAllScenarios, runScenario, runGpcComparison, SCENARIOS, runCategoryScenarios, checkConsentPersistence };
