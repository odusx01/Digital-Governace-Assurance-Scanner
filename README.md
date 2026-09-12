# ConsentLens — Cookie & Consent Scanner

**ConsentLens** is a privacy-engineering tool that simulates real visitor consent journeys, captures cookies and network activity, and generates evidence-backed reports aligned with UK GDPR/PECR and California CCPA/CPRA.

---

## Features

- **Region-aware scanning** — emulates browser locale, timezone, and geolocation for 12 regions (UK, EU-DE, EU-FR, EU-ES, US, California, Canada, Australia, Brazil, India, South Africa, Japan)
- **CMP detection** — identifies Consent Management Platforms by DOM selectors and JavaScript globals
- **Built-in consent journeys** — no-interaction, accept-all, reject-all, open-preferences, accept-analytics, accept-advertising, withdraw-consent, revisit-after-consent
- **Custom journey builder** — author multi-step click/navigate/scroll/wait sequences
- **Crawl modes** — homepage, linked-pages, sitemap, deep
- **Evidence capture per scenario** — cookies, localStorage, sessionStorage, IndexedDB, network requests, web workers, consent events, Google Consent Mode signals, GPC behaviour
- **Cookie classification database** — first/third-party status, severity, and provider for known cookies
- **Framework-aware reports** — findings grouped by severity with remediation playbooks
- **Web UI** — full scan wizard, dashboard, scheduled monitors, scan comparisons, finding remediations
- **CLI** — single-command scans without the web server

---

## Requirements

| Dependency | Minimum version |
|---|---|
| Node.js | 18 |
| MySQL | 8 (web UI only) |
| Playwright browsers | installed via `npx playwright install` |

---

## Quick Start — CLI

```bash
# 1. Install dependencies
npm install
npx playwright install chromium

# 2. Run a scan
node scan.js https://example.com --region uk

# Optional flags
node scan.js https://example.com \
  --region eu-de \
  --output-dir results/my-scan \
  --name "Example audit"
```

### Supported `--region` values

| Key | Region |
|---|---|
| `uk` | United Kingdom (UK GDPR / PECR) |
| `eu-de` | European Union — Germany (GDPR) |
| `eu-fr` | European Union — France (GDPR) |
| `eu-es` | European Union — Spain (GDPR) |
| `us` | United States |
| `us-ca` | California (CCPA / CPRA) |
| `ca` | Canada |
| `au` | Australia |
| `br` | Brazil |
| `in` | India |
| `za` | South Africa |
| `jp` | Japan |

The scan produces a `report.html` and a `findings.json` in the output directory.

---

## Quick Start — Web UI

### 1. Configure environment

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

`.env` variables:

```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=consentlens

# Session secret (generate a random string)
SESSION_SECRET=change_me_to_something_random

# Mailer (for email verification — optional)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=you@example.com
SMTP_PASS=yourpassword
MAIL_FROM=noreply@example.com

# App base URL (used in verification emails)
APP_URL=http://localhost:3000
```

### 2. Initialise the database

The app creates tables automatically on first run. Just ensure the database named in `DB_NAME` exists:

```sql
CREATE DATABASE consentlens;
```

### 3. Start the server

```bash
npm start
```

Open `http://localhost:3000` in your browser, register an account, and use the five-step scan wizard.

---

## How a Scan Works

```
┌─────────────────────────────────────────────────────────┐
│  1. CMP Detection                                       │
│     Playwright loads the page and checks DOM selectors  │
│     and JS globals to identify the consent platform.    │
├─────────────────────────────────────────────────────────┤
│  2. Consent Scenarios                                   │
│     Each selected journey runs in an isolated browser   │
│     context. Evidence (cookies, network, storage) is    │
│     captured before and after the consent action.       │
├─────────────────────────────────────────────────────────┤
│  3. Findings Generation                                 │
│     Cookies are classified using the built-in database. │
│     Findings are grouped by severity and mapped to the  │
│     selected legal framework (UK PECR, CCPA, etc.).     │
├─────────────────────────────────────────────────────────┤
│  4. Report                                              │
│     A standalone HTML report is written to the output   │
│     directory alongside a machine-readable JSON file.   │
└─────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
cookie-scanner/
├── scan.js            # CLI entry point
├── run-scan.js        # Core scan logic (used by CLI and server)
├── cmp-detect.js      # CMP and policy-link detection
├── scenarios.js       # Consent journey runners
├── findings.js        # Finding generation and cookie classification
├── report.js          # HTML report builder
├── crawl.js           # Multi-page crawler
├── regions.js         # Region definitions (locale, geolocation, GPC)
├── generate_paper.py  # Optional: generate a PDF evidence paper
├── data/
│   └── cookie-db.json # Cookie classification database
├── playbooks/         # Framework-specific remediation playbooks
├── server/            # Express web application
│   ├── index.js       # Routes and app bootstrap
│   ├── auth.js        # Session auth middleware
│   ├── db.js          # MySQL queries
│   ├── queue.js       # Scan job queue
│   ├── monitor.js     # Scheduled monitor runner
│   ├── scheduler.js   # Cron scheduler
│   ├── mailer.js      # Email verification
│   ├── views.js       # HTML views (dashboard, report, wizard)
│   └── components/    # Shared UI components (header, footer)
└── results/           # Scan output directory (git-ignored)
```

---

## Consent Journeys Reference

| Journey | What it tests |
|---|---|
| `no-interaction` | Cookies set before any consent action |
| `accept-all` | Cookies after accepting all |
| `reject-all` | Cookies that fire despite rejection |
| `open-preferences` | Granular preference centre behaviour |
| `accept-analytics` | Analytics cookies when only analytics accepted |
| `accept-advertising` | Ad cookies when only advertising accepted |
| `withdraw-consent` | Cookies retained after consent withdrawal |
| `revisit-after-consent` | Whether consent persists across page loads |

---

## Programmatic API

`run-scan.js` exports `runScan` for use in your own scripts:

```js
const { runScan } = require('./run-scan');

const result = await runScan({
  url: 'https://example.com',
  outputDir: 'results/my-scan',
  region: 'uk',
  framework: 'uk-pecr',          // 'uk-pecr' | 'ccpa-cpra' | 'both'
  scanType: 'consent',            // 'consent' | 'ccpa-signals' | 'full'
  crawlMode: 'homepage',          // 'homepage' | 'linked-pages' | 'sitemap' | 'deep'
  maxPages: 1,
  journeys: ['no-interaction', 'accept-all', 'reject-all'],
  onProgress(step, message, extra) {
    console.log(step, message);
  },
});

// result.reportPath  — path to report.html
// result.output      — raw findings object
// result.cmpInfo     — detected CMP details
```

---

## Legal Disclaimer

ConsentLens produces **technical observations**, not legal opinions. Findings indicate potential privacy risks and should be reviewed by a qualified privacy professional before drawing compliance conclusions. Geolocation emulation does not change the machine's IP address; sites that geo-fence by IP may not serve region-specific consent banners.

---

## License

ISC
