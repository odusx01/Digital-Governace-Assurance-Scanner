'use strict';

/**
 * scan.js — CLI entry point
 *
 * Usage:
 *   node scan.js <url> --region <key> [--output-dir <dir>] [--name <name>]
 */

const path = require('path');
const { runScan } = require('./run-scan');
const { REGIONS } = require('./regions');

// ── Args ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
if (!args.length || args[0] === '--help') {
  console.log('Usage: node scan.js <url> [--output-dir <dir>] [--name <label>]');
  process.exit(args[0] === '--help' ? 0 : 1);
}

const url = args[0];
const odIdx = args.indexOf('--output-dir');
const nmIdx = args.indexOf('--name');
const rgIdx = args.indexOf('--region');
const outputDir = odIdx !== -1 && args[odIdx + 1] ? args[odIdx + 1] : '.';
const name = nmIdx !== -1 && args[nmIdx + 1] ? args[nmIdx + 1] : null;
const region = rgIdx !== -1 && args[rgIdx + 1] ? args[rgIdx + 1] : null;

if (!region || !REGIONS[region]) {
  console.error(`A supported --region is required. Options: ${Object.keys(REGIONS).join(', ')}`);
  process.exit(1);
}

// ── Progress handler ─────────────────────────────────────────────────────────

let scenarioCount = 0;

function onProgress(step, message, extra) {
  switch (step) {
    case 'detecting-cmp':
      console.log('Step 1/3  Detecting CMP ...');
      break;

    case 'cmp-detected': {
      const cmp = extra?.cmpInfo;
      if (!cmp) break;
      console.log(`          Named CMP: ${cmp.name}`);
      if (cmp.matchedGlobals?.length) console.log(`          Globals:   ${cmp.matchedGlobals.join(', ')}`);
      if (cmp.matchedSelectors?.length) console.log(`          Selectors: ${cmp.matchedSelectors.join(', ')}`);
      break;
    }

    case 'scenario-no-interaction':
      console.log('\nStep 2/3  Running consent scenarios ...');
      console.log(`  Running scenario: no-interaction ...`);
      break;

    case 'scenario-accept-all':
      console.log(`  Running scenario: accept-all ...`);
      break;

    case 'scenario-reject-all':
      console.log(`  Running scenario: reject-all ...`);
      break;

    case 'scenario-no-interaction-done':
    case 'scenario-accept-all-done':
    case 'scenario-reject-all-done': {
      const r = extra?.result;
      if (!r) break;
      const flag = r.status !== 'ok' ? ` [${r.status}]` : '';
      const gran = r.granularAcceptOnly ? ' [granular-only]' : '';
      const detail = r.consentAction?.detail ? ` — ${r.consentAction.detail}` : '';
      console.log(`    → ${r.status}${flag} | ${r.cookies.length} cookies${gran}${detail}`);
      scenarioCount++;
      break;
    }

    case 'generating':
      console.log('\nStep 3/3  Generating findings ...');
      break;

    default:
      break;
  }
}

// ── Run ───────────────────────────────────────────────────────────────────────

(async () => {
  console.log(`\nScanning: ${url}`);
  console.log(`Output:   ${path.resolve(outputDir)}`);
  if (name) console.log(`Name:     ${name}`);
  console.log(`Region:   ${REGIONS[region].label}`);

  try {
    const { output, reportPath, scenarioResults, scanSummary } =
      await runScan({ url, outputDir, onProgress, name, region });

    console.log(scanSummary);

    console.log('\nScenario cookie counts:');
    for (const sr of scenarioResults) {
      const flag = sr.status !== 'ok' ? ` [${sr.status}]` : '';
      console.log(`  ${sr.scenario.padEnd(18)} ${sr.cookies.length} cookies${flag}`);
    }

    const jsonPath = require('path').join(outputDir, 'scan-result.json');
    console.log(`\nSaved: ${jsonPath}`);
    console.log(`       ${reportPath}`);
    scenarioResults.forEach(sr => console.log(`       ${sr.screenshotPath}`));

  } catch (err) {
    console.error(`\nScan failed: ${err.message}`);
    process.exit(1);
  }
})();
