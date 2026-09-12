# SPIDAC - Digital Tech Assurance Product Workplan

## Product Direction

Build SPIDAC - Digital Tech Assurance into an evidence-led privacy assurance platform for websites. The product should let a team define a visitor context and test plan, simulate realistic consent journeys, capture cookies and data flows, explain confidence and limitations, assign remediation, and prove improvement in later scans.

The product must distinguish:

- **Technical observation:** what the browser, page, storage, cookies, and network actually did.
- **Risk interpretation:** why the observation may matter under a selected framework.
- **Legal conclusion:** never presented as an automated certification or legal opinion.

## Research Inputs

Public product patterns reviewed:

- [ObservePoint platform](https://www.observepoint.com/platform/): separate privacy, consent, analytics, accessibility, and full-site audit products; page and region-aware scanning; grades, comparisons, and monitoring.
- [ObservePoint Consent Management Validation](https://www.observepoint.com/solutions/consent-management/): validates whether CMPs prevent trackers before consent and after denial.
- [Privado AI platform](https://www.privado.ai/platform/): web and app auditing, simulated user journeys, location-specific privacy laws, continuous monitoring, and risk-oriented workflows.
- [Privado Web Auditor](https://www.privado.ai/products/web-auditor): detects pixels, scripts, cookies, third-party activity, and CMP misconfiguration.
- [Cookiebot scanner methodology](https://www.cookiebot.com/en/cookie-scanner/): simulated scrolling, clicking, menus, media, dynamic content, tracker classification, and large intelligence repositories.
- [OneTrust Cookie Consent](https://www.onetrust.com/products/cookie-consent/): auditing, categorization, auto-blocking validation, consent records, and regional consent experiences.

## Current Baseline

Everything listed here is implemented and in production use.

- Explicit visitor-region selection (10 regions).
- Framework selection for UK GDPR/PECR and California CCPA/CPRA.
- Five-step scan wizard: profile → scope → visitor context → journeys → review.
- `scanConfig` persisted with every result: profile, crawl mode, journeys, include/exclude patterns, region, framework.
- API validates region, profile, crawl mode, and selected journeys before queueing.
- **Built-in journeys:** no-interaction, accept-all, reject-all, open-preferences, accept-analytics, accept-advertising, withdraw-consent, revisit-after-consent.
- **Custom journey builder:** multi-step sequences (click, navigate, scroll, wait, open-preferences, toggle-category, save) run in a single browser context.
- Crawl modes: homepage, linked-pages, sitemap, deep (interactive — auto-enabled for deep mode).
- URL include/exclude patterns with wildcard support.
- Scan integrity: pages attempted/completed/blocked/failed, journeys attempted/completed, completeness percentage, coverage warnings.
- Reports: Scan integrity section, Journey comparison matrix, findings by severity.
- Evidence captured per scenario: cookies, localStorage, sessionStorage, IndexedDB, network requests with timestamps, web workers, form submissions, consent events, Google Consent Mode signals, GPC behavior.
- Consent persistence check (same-context revisit).
- Per-category cookie analysis (best-effort, discovers optional categories and isolates their cookies).
- Cookie classification database with first/third-party status, severity, and provider.
- Network-domain tracking detection.
- Findings grouped by severity with search and filters.
- Framework-aware reports with remediation playbooks.
- Database schema for finding remediations (owner, status, priority, due date, notes, verification scan).
- Database schema for scan comparisons and scheduled monitor runs.
- Database-backed blog administration.

## Remaining Roadmap

### P1.1 — GPC comparison journey

Add a `gpc-comparison` built-in journey that runs no-interaction twice — once with GPC enabled and once without — and diffs the network requests and cookie counts. Surface the delta as a finding if trackers fire without GPC but are suppressed with it.

### P1.2 — Report panels for new journeys

Surface the data already captured by `withdraw-consent` and `revisit-after-consent` as explicit Pass / Fail / Review panels in the report:

- **Withdraw consent:** did `cookiesRetainedAfterWithdrawal` contain non-essential cookies? Was a persistent preferences control found?
- **Revisit after consent:** did `revisitBannerReappeared`? Were consent cookies present on revisit?

These should appear in the assurance overview alongside consent gating and reject behavior.

### P1.3 — Assurance overview panels

Add a summary panel at the top of every report with a row for each test area:

| Area | Result |
|---|---|
| Consent gating | Pass / Fail / Review / Not tested |
| Reject behavior | Pass / Fail / Review / Not tested |
| Consent withdrawal | Pass / Fail / Review / Not tested |
| Consent persistence | Pass / Fail / Review / Not tested |
| Tracking exposure | Pass / Fail / Review / Not tested |
| Privacy signals (GPC) | Pass / Fail / Review / Not tested |
| Scan completeness | % with warnings |

### P1.4 — Classification provenance

For every cookie, tracker, and vendor record, record and display:

- Confidence level (high / medium / low / unknown).
- Matching rule (exact name, pattern, domain).
- Evidence source (cookie DB, domain list, heuristic).
- Last classification update date.
- Manual override history.

Unknown items should include suggested investigation context, not only an "unknown" label.

### P1.5 — Evidence timelines

For each high-confidence finding, show a request timeline with:

- Relative timestamp.
- Page URL.
- Scenario and consent state.
- Cookie or request destination.
- Initiator script URL (requires CDP-level initiator capture, not just frame URL).
- Screenshot or trace reference.

### P1.6 — Remediation workflow UI

The database schema for finding remediations already exists. Build the UI:

- Set owner, status (open / investigating / fixed / accepted risk), priority, due date, and notes on any finding.
- Link a verification scan to a fixed finding.
- Show remediation state in the findings table and report.

## P2: Regression and Operations

### P2.1 — Scan comparison UI

The database schema for comparisons exists. Build the comparison view:

- Select two scans for the same site.
- Show new, fixed, and changed findings.
- Show changed cookies, vendors, consent behavior, and page coverage.

### P2.2 — Scheduled monitoring improvements

The monitor infrastructure exists. Remaining work:

- Historical trend charts per monitor.
- Per-finding threshold alerts (not only critical count).
- Email digest with comparison delta.

### P2.3 — Team and enterprise controls

- Team workspaces with shared scan history.
- Role-based access control.
- SSO.
- Audit log.
- Jira/Linear integrations.
- API and webhooks.
- Data retention settings.
- Exportable evidence packages.

## Definition of Done

The product is ready for the next assurance milestone when:

- A user can configure a repeatable scan plan without hidden defaults.
- Every scan result records exactly what was tested.
- Every report shows coverage and limitations before findings.
- Findings are linked to scenario and page evidence.
- A failed or incomplete journey cannot be mistaken for a pass.
- A second scan can later be compared using the same stored plan and result structure.
