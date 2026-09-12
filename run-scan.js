'use strict';

/**
 * run-scan.js
 *
 * Core scan logic, decoupled from the CLI.
 * Imported by scan.js (CLI) and server/queue.js (web UI).
 *
 * @example
 *   const { runScan } = require('./run-scan');
 *   const result = await runScan({
 *     url:       'https://example.com',
 *     outputDir: 'results/my-scan',
 *     onProgress(step, message, extra) {
 *       // step    — machine key  e.g. 'detecting-cmp'
 *       // message — human label  e.g. 'Detecting consent management platform'
 *       // extra   — optional object with structured data (CLI uses; server ignores)
 *     },
 *   });
 *   // result: { output, reportPath, cmpInfo, scenarioResults, scanSummary }
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { detectCMP, detectPolicyLinks } = require('./cmp-detect');
const { runScenario, runGpcComparison, runCategoryScenarios, checkConsentPersistence } = require('./scenarios');
const { generateFindings, summariseFindings, classifyCookie } = require('./findings');
const { buildReport } = require('./report');
const { crawlPages } = require('./crawl');
const { REGIONS, buildContextOpts } = require('./regions');

const SCENARIOS = ['no-interaction', 'accept-all', 'reject-all', 'open-preferences', 'accept-analytics', 'accept-advertising', 'withdraw-consent', 'revisit-after-consent'];
const COOKIE_DB = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'data', 'cookie-db.json'), 'utf8')
);

/**
 * @param {{ url: string, outputDir: string, onProgress?: Function, name?: string }} opts
 * @returns {Promise<{ output: object, reportPath: string, cmpInfo: object, scenarioResults: object[], scanSummary: string }>}
 */
async function runScan({ url, outputDir, onProgress = () => { }, name = null, maxPages = 1, region = null, framework = 'uk-pecr', scanType = 'consent', scanProfile = 'standard', crawlMode = 'homepage', journeys = null, includePatterns = [], excludePatterns = [], subdomainPolicy = 'same-domain', interactive = false, customJourneys = [] }) {
  let parsed;
  try { parsed = new URL(url); } catch (_) { throw new Error(`Invalid URL: ${url}`); }
  if (!/^https?:/.test(parsed.protocol)) {
    throw new Error(`URL must start with http:// or https:// — got: ${url}`);
  }
  if (!region || !REGIONS[region]) {
    throw new Error('A supported scan region must be selected before scanning.');
  }

  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  // Resolve region data and Playwright context options
  const regionData = REGIONS[region];
  const californiaScan = framework === 'ccpa-cpra' || framework === 'both'
    || scanType === 'ccpa-signals' || scanType === 'full';
  const regionContext = { ...regionData, globalPrivacyControl: californiaScan };
  const ctxOpts = buildContextOpts(regionContext);
  const builtInJourneys = (Array.isArray(journeys) && journeys.length ? journeys : SCENARIOS)
    .filter(scenario => SCENARIOS.includes(scenario));
  const customJourneySteps = Array.isArray(customJourneys) ? customJourneys.filter(j => j && j.type && j.value) : [];
  // Treat all custom steps as a single 'custom' scenario rather than one per step
  const selectedJourneys = [...builtInJourneys, ...(customJourneySteps.length ? ['custom'] : [])];
  // Auto-enable interactive crawling for deep crawl mode
  const effectiveInteractive = interactive || crawlMode === 'deep';

  const browser = await chromium.launch();
  try {
    const scanStartedAt = new Date();

    // ── Step 1: CMP detection ───────────────────────────────────────────────
    onProgress('detecting-cmp', 'Detecting consent management platform');

    const detectCtx = await browser.newContext(ctxOpts);
    const detectPage = await detectCtx.newPage();
    await detectPage.goto(url, { waitUntil: 'load', timeout: 60000 });
    await detectPage.waitForTimeout(2000);
    const cmpInfo = await detectCMP(detectPage);
    const policyLinks = await detectPolicyLinks(detectPage, cmpInfo);
    await detectCtx.close();

    onProgress('cmp-detected', `CMP: ${cmpInfo.name}`, { cmpInfo });

    // ── Step 1b: Page discovery (multi-page mode) ───────────────────────────
    let pagesToScan = [url];
    if (maxPages > 1) {
      onProgress('crawling', `Discovering pages to scan (max ${maxPages})`);
      pagesToScan = await crawlPages(url, {
        maxPages,
        browser,
        crawlMode,
        includePatterns,
        excludePatterns,
        subdomainPolicy,
        interactive: effectiveInteractive,
      });
      onProgress('crawling-done', `Found ${pagesToScan.length} page(s) to scan`, { pages: pagesToScan });
    }

    // ── Step 2: Scenarios — run per page ────────────────────────────────────
    const scenarioResults = [];  // homepage scenarios (used for findings/report header)
    const pageResults = [];  // all pages including homepage

    for (let pi = 0; pi < pagesToScan.length; pi++) {
      const pageUrl = pagesToScan[pi];
      const isHomepage = pi === 0;
      const pageLabel = isHomepage ? 'homepage' : `page ${pi + 1}`;
      const pageOutputDir = isHomepage ? outputDir : path.join(outputDir, `page-${pi + 1}`);
      if (!fs.existsSync(pageOutputDir)) fs.mkdirSync(pageOutputDir, { recursive: true });

      const pageScenarios = [];

      for (const scenario of selectedJourneys) {
        const label = {
          'no-interaction': `Testing no-interaction (${pageLabel})`,
          'accept-all': `Testing accept-all (${pageLabel})`,
          'reject-all': `Testing reject-all (${pageLabel})`,
          'open-preferences': `Testing open-preferences (${pageLabel})`,
          'accept-analytics': `Testing accept-analytics (${pageLabel})`,
          'accept-advertising': `Testing accept-advertising (${pageLabel})`,
          'withdraw-consent': `Testing withdraw-consent (${pageLabel})`,
          'revisit-after-consent': `Testing revisit-after-consent (${pageLabel})`,
          'gpc-comparison': `Testing GPC signal comparison (${pageLabel})`,
          'custom': `Testing custom journey (${pageLabel})`,
        }[scenario] || `Testing ${scenario} (${pageLabel})`;

        onProgress(`scenario-${scenario}`, label);

        const result = scenario === 'gpc-comparison'
          ? await runGpcComparison(browser, pageUrl, cmpInfo, { outputDir: pageOutputDir, regionContext })
          : await runScenario(browser, pageUrl, scenario, cmpInfo, {
              outputDir: pageOutputDir,
              regionContext,
              customJourneySteps: scenario === 'custom' ? customJourneySteps : null,
            });
        pageScenarios.push(result);

        if (isHomepage) scenarioResults.push(result);

        onProgress(`scenario-${scenario}-done`, `${label} — ${result.status}`, { result });
      }

      pageResults.push({
        url: pageUrl,
        isHomepage,
        scenarios: pageScenarios,
      });
    }

    const completedJourneys = pageResults.flatMap(page => page.scenarios)
      .filter(result => result.status === 'ok').length;
    const attemptedJourneys = pageResults.reduce((count, page) => count + page.scenarios.length, 0);
    const completedPages = pageResults.filter(page => page.scenarios.some(result => result.status === 'ok')).length;
    const blockedPages = pageResults.filter(page => page.scenarios.every(result => result.status === 'blocked')).length;
    const manualJourneys = pageResults.flatMap(page => page.scenarios)
      .filter(result => result.status === 'manual-review-needed').length;
    const scanCoverage = {
      scanStartedAt: scanStartedAt.toISOString(),
      scanEndedAt: null,
      scanDurationMs: null,
      pagesAttempted: pagesToScan.length,
      pagesCompleted: completedPages,
      pagesBlocked: blockedPages,
      pagesFailed: pageResults.filter(page => page.scenarios.every(result => result.status === 'error')).length,
      pagesManualReview: pageResults.filter(page => page.scenarios.some(result => result.status === 'manual-review-needed')).length,
      journeysRequested: selectedJourneys,
      journeysAttempted: attemptedJourneys,
      journeysCompleted: completedJourneys,
      journeysManualReview: manualJourneys,
      completenessPercent: attemptedJourneys ? Math.round((completedJourneys / attemptedJourneys) * 100) : 0,
      cmpDetected: cmpInfo.name || null,
      cmpDetectionMethod: cmpInfo.source || null,
      geolocationSimulated: Boolean(regionData?.simulateGeolocation),
      geolocationRegion: regionData?.label || null,
      browserEngine: 'chromium',
      warnings: [
        blockedPages ? `${blockedPages} page(s) were blocked` : null,
        manualJourneys ? `${manualJourneys} journey result(s) require manual review` : null,
        includePatterns.length || excludePatterns.length ? 'URL scope rules were applied to page discovery; interactive actions may still reveal additional routes' : null,
      ].filter(Boolean),
      pageStatuses: pageResults.map(pr => ({
        url: pr.url,
        isHomepage: pr.isHomepage,
        journeys: pr.scenarios.map(s => ({
          scenario: s.scenario,
          status: s.status,
          statusReason: s.statusReason || null,
          consentAction: s.consentAction ? {
            method: s.consentAction.method,
            detail: s.consentAction.detail,
            success: s.consentAction.success,
          } : null,
        })),
      })),
    };

    // ── Step 2.5: Per-category cookie analysis (best-effort) ───────────────
    let categoryResults = [];
    try {
      onProgress('category-analysis', 'Discovering consent categories');
      const baselineCookies = scenarioResults.find(r => r.scenario === 'no-interaction')?.cookies || [];
      const catResult = await runCategoryScenarios(
        browser, url, cmpInfo, baselineCookies, { outputDir, regionContext },
        (msg) => onProgress('category-analysis', msg)
      );
      // Enrich each dropped cookie with classification from the cookie DB
      categoryResults = catResult.categoryResults.map(cat => ({
        ...cat,
        cookiesDropped: cat.cookiesDropped.map(c => ({
          ...c,
          classification: classifyCookie(c.name, COOKIE_DB),
        })),
      }));
    } catch (_) {
      // Category analysis is best-effort — never fail the main scan
    }

    // ── Step 2.6: Consent persistence check ────────────────────────────────
    let consentPersisted;
    if (cmpInfo.name !== 'None') {
      try {
        onProgress('persistence-check', 'Checking consent persistence on revisit');
        consentPersisted = await checkConsentPersistence(browser, url, cmpInfo, { regionContext });
        onProgress('persistence-check-done', `Consent persistence: ${consentPersisted ? 'ok' : 'FAILED'}`);
      } catch (_) {
        consentPersisted = undefined; // untested
      }
    }

    // ── Step 3: Findings + report ───────────────────────────────────────────
    onProgress('generating', 'Generating findings and report');

    const isHttps = url.startsWith('https');
    const { findings, cookieMap, scanStatus, scanStatusReason } =
      generateFindings(scenarioResults, COOKIE_DB, {
        policyLinks,
        isHttps,
        consentPersisted,
        pageResults,
        scanCoverage,
        framework,
        scanType,
        privacySignals: scenarioResults.find(r => r.scenario === 'no-interaction')?.privacySignals || null,
      });

    // Enrich each scenario's cookie list with classification from cookieMap.
    // cookieMap is an array from generateFindings, so build a keyed lookup first.
    const cookieLookup = {};
    for (const entry of cookieMap) {
      cookieLookup[`${entry.name}||${entry.domain}`] = entry;
    }
    for (const sr of scenarioResults) {
      sr.cookies = (sr.cookies || []).map(c => {
        const key = `${c.name}||${c.domain}`;
        const mapped = cookieLookup[key];
        return mapped ? { ...c, classification: mapped.classification } : c;
      });
    }

    const output = {
      url,
      name: name || null,
      scanConfig: { framework, scanType, scanProfile, crawlMode, journeys: selectedJourneys, includePatterns, excludePatterns, subdomainPolicy, interactive: effectiveInteractive },
      scanCoverage: {
        ...scanCoverage,
        scanEndedAt: new Date().toISOString(),
        scanDurationMs: Date.now() - new Date(scanStartedAt).getTime(),
      },
      privacySignals: scenarioResults.find(r => r.scenario === 'no-interaction')?.privacySignals || null,
      scannedAt: new Date().toISOString(),
      region: regionData ? { key: region, ...regionData } : null,
      scanStatus,
      scanStatusReason,
      cmp: cmpInfo,
      scenarios: scenarioResults,
      cookieMap,
      findings,
      categoryResults,
      policyLinks,
      pageResults: pageResults.length > 1 ? pageResults : null,
    };

    const jsonPath = path.join(outputDir, 'scan-result.json');
    const reportPath = path.join(outputDir, 'report.html');

    fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2));

    const html = buildReport(output, path.resolve(outputDir));
    fs.writeFileSync(reportPath, html, 'utf8');

    const scanSummary = summariseFindings(findings, scanStatus, scanStatusReason);

    onProgress('done', 'Scan complete');

    return { output, reportPath, cmpInfo, scenarioResults, scanSummary };

  } finally {
    await browser.close();
  }
}

module.exports = { runScan };
