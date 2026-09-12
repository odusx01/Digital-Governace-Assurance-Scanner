'use strict';

require('dotenv').config();

/**
 * server/index.js
 *
 * Express app with authentication.
 *
 * Routes:
 *   GET  /                   public marketing page
 *   GET  /app                dashboard (protected)
 *   GET  /login              login page
 *   GET  /register           register page
 *   POST /login              login form submit
 *   POST /register           register form submit
 *   POST /logout             logout
 *   POST /scan               enqueue a scan (protected)
 *   GET  /scan/:id           standalone progress page (protected)
 *   GET  /scan/:id/status    job status JSON (protected)
 *   GET  /report/:name       serve report.html from results/<name>/ (protected)
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const { enqueue, getJob, jobStatus, listActiveJobs } = require('./queue');
const { start: startMonitor } = require('./monitor');
const { homePage, marketingPage, trainingsPage, blogPage, progressPage, comparisonPage, comparisonListPage, reportsPage, settingsPage, auditLogPage, monitorsPage, monitorFormPage, monitorDetailPage, newScanPage, remediationsPage, layout, esc } = require('./views');
const { adminBlogPage, adminUsersPage } = require('./views-admin');
const { loginPage, registerPage, verificationPendingPage, verificationResultPage } = require('./views-auth');
const { sendVerificationEmail } = require('./mailer');
const { privacyPage, termsPage, securityPage, legalIndexPage } = require('./views-static');
const { buildReport } = require('../report');
const { REGIONS } = require('../regions');
const { requireAuth, authMiddleware, sessionMiddleware, comparePassword, hashPassword } = require('./auth');
const { initDb, saveScan, getScansForUser, getScanForUser, getScanById, deleteScan, renameScan, createSharedReport, getSharedReport, createApiKey, listApiKeys, deleteApiKey, getApiKeyByPrefix, createUser, getUserByEmail, getUserByIdWithRole, getUserByVerificationTokenHash, verifyUserEmail, deleteUser, listAllUsers, setUserRole, listBlogPosts, getBlogPostBySlug, createBlogPost, updateBlogPost, deleteBlogPost, setFindingRemediation, getFindingRemediations, getFindingRemediation, getAllRemediationsForUser, createScanComparison, getScanComparisonsForUser, getScanComparison, createMonitor, getMonitorsForUser, getMonitor, updateMonitor, deleteMonitor, createMonitorRun, getMonitorRuns, updateUserProfile, updateUserPassword, logAudit, getAuditLogForUser } = require('./db');

const RESULTS_DIR = path.join(__dirname, '..', 'results');
const PORT = process.env.PORT || 3000;

const app = express();
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(sessionMiddleware);
app.use(authMiddleware);
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

function normaliseEmail(value) {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254 ? email : null;
}

const PERSONAL_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'ymail.com', 'hotmail.com',
  'outlook.com', 'live.com', 'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com',
  'gmx.com', 'mail.com', 'zoho.com', 'yandex.com', 'mail.ru',
]);

function isBusinessEmail(email) {
  const domain = email.split('@')[1];
  return Boolean(domain && !PERSONAL_EMAIL_DOMAINS.has(domain));
}

function normaliseRegistrationField(value, maxLength) {
  if (typeof value !== 'string') return null;
  const clean = value.trim();
  return clean && clean.length <= maxLength ? clean : null;
}

function establishSession(req, user) {
  req.session.userId = user.id;
  req.session.userEmail = user.email;
  return Promise.resolve();
}

// ── Auth pages (no auth required) ─────────────────────────────────────────────

app.get('/login', (req, res) => {
  if (req.session && req.session.userId) return res.redirect('/app');
  res.send(loginPage());
});

app.get('/register', (req, res) => {
  if (req.session && req.session.userId) return res.redirect('/app');
  res.send(registerPage());
});

app.get('/verification-pending', (req, res) => {
  res.send(verificationPendingPage());
});

app.post('/login', async (req, res) => {
  const { password } = req.body || {};
  const email = normaliseEmail(req.body?.email);
  if (!email || typeof password !== 'string' || !password) return res.status(400).json({ error: 'Enter a valid email address and password.' });

  const user = await getUserByEmail(email);
  if (!user || !comparePassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  if (!user.email_verified) {
    return res.status(403).json({ error: 'Verify your email address before signing in.' });
  }

  await establishSession(req, user);
  res.json({ ok: true });
});

app.post('/register', async (req, res) => {
  const { password } = req.body || {};
  const email = normaliseEmail(req.body?.email);
  if (!email || typeof password !== 'string' || !password) return res.status(400).json({ error: 'Enter a valid email address and password.' });
  if (!isBusinessEmail(email)) return res.status(400).json({ error: 'Use your business email address. Personal Gmail, Yahoo, and similar addresses are not accepted.' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

  const fullName = normaliseRegistrationField(req.body?.fullName, 255);
  const organizationName = normaliseRegistrationField(req.body?.organizationName, 255);
  const organizationRole = normaliseRegistrationField(req.body?.organizationRole, 120);
  if (!fullName || !organizationName || !organizationRole) {
    return res.status(400).json({ error: 'Enter your full name, organization name, and role.' });
  }

  const existing = await getUserByEmail(email);
  if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });

  const passwordHash = hashPassword(password);
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const userId = await createUser({ email, passwordHash, fullName, organizationName, organizationRole, verificationTokenHash: tokenHash, verificationExpires });
  try {
    await sendVerificationEmail({ to: email, name: fullName, token });
  } catch (err) {
    await deleteUser(userId);
    console.error('Verification email delivery failed:', err.message);
    return res.status(503).json({ error: 'We could not send the verification email. Please try again later.' });
  }
  res.json({ ok: true, verificationRequired: true });
});

app.get('/verify-email/:token', async (req, res) => {
  const token = String(req.params.token || '');
  if (!/^[a-f0-9]{64}$/.test(token)) return res.status(400).send(verificationResultPage(false, 'This verification link is invalid.'));
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const user = await getUserByVerificationTokenHash(tokenHash);
  if (!user) return res.status(400).send(verificationResultPage(false, 'This verification link is invalid or has expired.'));
  await verifyUserEmail(user.id);
  res.send(verificationResultPage(true, 'Your email address is verified. You can now sign in to your workspace.'));
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// ── Static pages ───────────────────────────────────────────────────────────────

app.get('/legal', (req, res) => {
  res.send(legalIndexPage());
});

app.get('/privacy', (req, res) => {
  res.send(privacyPage());
});

app.get('/terms', (req, res) => {
  res.send(termsPage());
});

app.get('/security', (req, res) => {
  res.send(securityPage());
});

app.get('/trainings', (req, res) => {
  res.send(trainingsPage());
});

app.get('/blog', async (req, res) => {
  const posts = await listBlogPosts({ publishedOnly: true });
  res.send(blogPage(posts));
});

app.get('/blog/:slug', async (req, res) => {
  const post = await getBlogPostBySlug(req.params.slug);
  if (!post) return res.status(404).send('Blog post not found');
  res.send(blogPage([post], post));
});

async function requireAdmin(req, res, next) {
  if (!req.session?.userId) return res.redirect('/login');
  const user = await getUserByIdWithRole(req.session.userId);
  if (!user || user.role !== 'admin') return res.status(403).send('Admin access required');
  req.adminUser = user;
  next();
}

function slugify(value) {
  return String(value || '').trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);
}

function blogFormValues(body) {
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const slug = slugify(body.slug || title);
  const excerpt = typeof body.excerpt === 'string' ? body.excerpt.trim() : '';
  const content = typeof body.body === 'string' ? body.body.trim() : '';
  const category = typeof body.category === 'string' ? body.category.trim() : 'Privacy technology';
  const status = body.status === 'published' ? 'published' : 'draft';
  if (!title || !slug || !excerpt || !content || !category) throw new Error('Title, slug, excerpt, body, and category are required.');
  if (title.length > 255 || slug.length > 180 || excerpt.length > 500 || category.length > 80) throw new Error('One or more blog fields are too long.');
  return { title, slug, excerpt, body: content, category, status };
}

app.get('/admin/blog', requireAdmin, async (req, res) => {
  const posts = await listBlogPosts();
  res.send(adminBlogPage(posts, req.adminUser, req.query.edit || null));
});

app.post('/admin/blog', requireAdmin, async (req, res) => {
  try {
    await createBlogPost({ ...blogFormValues(req.body || {}), authorId: req.adminUser.id });
    res.redirect('/admin/blog');
  } catch (err) {
    res.status(400).send(`Could not create blog post: ${esc(err.message)}`);
  }
});

app.post('/admin/blog/:id', requireAdmin, async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).send('Invalid post ID');
  try {
    await updateBlogPost(Number(req.params.id), blogFormValues(req.body || {}));
    res.redirect('/admin/blog');
  } catch (err) {
    res.status(400).send(`Could not update blog post: ${esc(err.message)}`);
  }
});

app.post('/admin/blog/:id/delete', requireAdmin, async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).send('Invalid post ID');
  await deleteBlogPost(Number(req.params.id));
  res.redirect('/admin/blog');
});

// ── Admin: user management ─────────────────────────────────────────────────────

app.get('/admin/users', requireAdmin, async (req, res) => {
  const users = await listAllUsers();
  const account = await getUserByIdWithRole(req.session.userId);
  res.send(adminUsersPage(users, account));
});

app.post('/admin/users/:id/role', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id === req.session.userId) return res.status(400).send('Invalid');
  const role = req.body?.role === 'admin' ? 'admin' : 'user';
  await setUserRole(id, role);
  res.redirect('/admin/users');
});

app.post('/admin/users/:id/delete', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id === req.session.userId) return res.status(400).send('Cannot delete yourself');
  await deleteUser(id);
  res.redirect('/admin/users');
});

// ── Protected routes ───────────────────────────────────────────────────────────

async function readUserScans(userId) {
  let raw;
  try {
    raw = await getScansForUser(userId);
  } catch (err) {
    console.error('readUserScans DB error:', err.message);
    raw = [];
  }
  if (!Array.isArray(raw)) raw = [];
  return raw.map(s => {
    const output = s.output || {};
    const scenarios = output.scenarios || [];
    const byScenario = {};
    for (const sc of scenarios) byScenario[sc.scenario] = sc;

    const cookieCounts = {
      noInteraction: byScenario['no-interaction']?.cookies?.length ?? null,
      acceptAll: byScenario['accept-all']?.cookies?.length ?? null,
      rejectAll: byScenario['reject-all']?.cookies?.length ?? null,
    };
    const scenarioStatuses = {
      noInteraction: byScenario['no-interaction']?.status ?? null,
      acceptAll: byScenario['accept-all']?.status ?? null,
      rejectAll: byScenario['reject-all']?.status ?? null,
    };

    return {
      id: s.id,
      dirName: s.result_dir,
      url: s.url,
      name: s.name,
      scannedAt: s.scannedAt,
      scanStatus: s.scan_status,
      findings: s.findings,
      cmpName: (output.cmp?.name && output.cmp.name !== 'None') ? output.cmp.name : null,
      region: output.region ? { key: output.region.key, flag: output.region.flag, label: output.region.label, framework: output.region.framework } : null,
      cookieCounts,
      scenarioStatuses,
    };
  });
}

app.get('/', (req, res) => {
  res.send(marketingPage());
});

app.get('/app', (req, res, next) => {
  if (!req.session?.userId) return res.redirect('/login');
  next();
}, async (req, res) => {
  let pastScans = [];
  let activeJobs = [];
  pastScans = await readUserScans(req.session.userId);
  activeJobs = listActiveJobs().filter(j => j.userId === req.session.userId);
  const comparisons = await getScanComparisonsForUser(req.session.userId);
  const monitors = await getMonitorsForUser(req.session.userId);
  const account = await getUserByIdWithRole(req.session.userId);
  const allRemediations = await getAllRemediationsForUser(req.session.userId);
  const openRemediations = allRemediations.filter(r => r.status === 'open' || r.status === 'investigating').length;
  res.send(homePage(pastScans, activeJobs, account || { id: req.session.userId, email: req.session.userEmail }, comparisons, monitors, openRemediations));
});

app.get('/app/reports', requireAuth, async (req, res) => {
  const scans = await readUserScans(req.session.userId);
  const account = await getUserByIdWithRole(req.session.userId);
  res.send(reportsPage(scans, account || { id: req.session.userId, email: req.session.userEmail }));
});

app.get('/app/new-scan', requireAuth, (req, res) => {
  const user = { id: req.session.userId, email: req.session.userEmail };
  const seed = {};
  if (req.query.url)    seed.url    = req.query.url;
  if (req.query.region) seed.region = req.query.region;
  if (req.query.name)   seed.name   = req.query.name;
  res.send(newScanPage(user, seed));
});

app.get('/app/settings', requireAuth, async (req, res) => {
  const account = await getUserByIdWithRole(req.session.userId);
  res.send(settingsPage(account || { id: req.session.userId, email: req.session.userEmail }));
});

app.get('/app/audit-log', requireAuth, async (req, res) => {
  const account = await getUserByIdWithRole(req.session.userId);
  const entries = await getAuditLogForUser(req.session.userId, 200);
  res.send(auditLogPage(entries, account || { id: req.session.userId, email: req.session.userEmail }));
});

app.put('/api/profile', requireAuth, async (req, res) => {
  const { fullName, organizationName, organizationRole } = req.body || {};
  await updateUserProfile(req.session.userId, { fullName, organizationName, organizationRole });
  res.json({ ok: true });
});

app.post('/api/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both current and new password are required.' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  const user = await getUserByEmail(req.session.userEmail);
  if (!user || !comparePassword(currentPassword, user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }
  await updateUserPassword(req.session.userId, hashPassword(newPassword));
  res.json({ ok: true });
});

app.get('/app/monitors', requireAuth, async (req, res) => {
  const monitors = await getMonitorsForUser(req.session.userId);
  const monitorsWithRuns = await Promise.all(monitors.map(async m => ({
    ...m,
    runs: await getMonitorRuns(m.id, 20),
  })));
  const account = await getUserByIdWithRole(req.session.userId);
  res.send(monitorsPage(monitorsWithRuns, account || { id: req.session.userId, email: req.session.userEmail }));
});

app.get('/app/monitors/new', requireAuth, async (req, res) => {
  const account = await getUserByIdWithRole(req.session.userId);
  res.send(monitorFormPage(null, account || { id: req.session.userId, email: req.session.userEmail }));
});

app.get('/app/monitors/:id/history', requireAuth, async (req, res) => {
  const monitor = await getMonitor(Number(req.params.id));
  if (!monitor || monitor.user_id !== req.session.userId) return res.status(404).send('Monitor not found');
  const [account, runs] = await Promise.all([
    getUserByIdWithRole(req.session.userId),
    getMonitorRuns(monitor.id, 100),
  ]);
  res.send(monitorDetailPage(monitor, runs, account || { id: req.session.userId, email: req.session.userEmail }));
});

app.get('/app/monitors/:id', requireAuth, async (req, res) => {
  const monitor = await getMonitor(Number(req.params.id));
  if (!monitor || monitor.user_id !== req.session.userId) return res.status(404).send('Monitor not found');
  const account = await getUserByIdWithRole(req.session.userId);
  res.send(monitorFormPage(monitor, account || { id: req.session.userId, email: req.session.userEmail }));
});

app.post('/scan', requireAuth, (req, res) => {
  const { url, name, maxPages, region, framework, scanType, scanProfile: requestedProfile, crawlMode, journeys, includePatterns, excludePatterns, subdomainPolicy, interactive, customJourneys } = req.body || {};

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url is required' });
  }

  const scanUrl = url.trim();
  let parsed;
  try { parsed = new URL(scanUrl); }
  catch (_) { return res.status(400).json({ error: `Invalid URL: ${url}` }); }
  if (!/^https?:/.test(parsed.protocol)) {
    return res.status(400).json({ error: `URL must start with http:// or https:// — got: ${url}` });
  }

  const pageCount = Number(maxPages ?? 1);
  if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > 50) {
    return res.status(400).json({ error: 'Pages to scan must be a whole number between 1 and 50.' });
  }

  if (!region) {
    return res.status(400).json({ error: 'Select a scan region before starting the scan.' });
  }
  if (!Object.hasOwn(REGIONS, region)) {
    return res.status(400).json({ error: 'Choose a supported scan region.' });
  }

  const scanFramework = framework || 'uk-pecr';
  const scanProfile = scanType || 'consent';
  if (!['uk-pecr', 'ccpa-cpra', 'both'].includes(scanFramework)) {
    return res.status(400).json({ error: 'Choose a supported compliance framework.' });
  }
  if (!['consent', 'ccpa-signals', 'full'].includes(scanProfile)) {
    return res.status(400).json({ error: 'Choose a supported scan profile.' });
  }
  const selectedJourneys = Array.isArray(journeys) && journeys.length
    ? journeys.filter(j => ['no-interaction', 'accept-all', 'reject-all', 'open-preferences', 'accept-analytics', 'accept-advertising', 'withdraw-consent', 'revisit-after-consent', 'gpc-comparison'].includes(j))
    : ['no-interaction', 'accept-all', 'reject-all'];
  const customJourneySteps = Array.isArray(customJourneys) ? customJourneys.filter(j => j && j.type && j.value) : [];
  const allJourneys = [...selectedJourneys, ...customJourneySteps.map(j => `custom:${j.type}:${j.value}`)];
  if (!allJourneys.length) return res.status(400).json({ error: 'Select at least one scan journey.' });
  const profile = ['quick', 'standard', 'deep'].includes(requestedProfile) ? requestedProfile : 'standard';
  const mode = ['homepage', 'linked-pages', 'sitemap', 'deep'].includes(crawlMode) ? crawlMode : (pageCount > 1 ? 'linked-pages' : 'homepage');
  const subdomain = ['same-domain', 'subdomains'].includes(subdomainPolicy) ? subdomainPolicy : 'same-domain';
  const interactiveEnabled = Boolean(interactive);
  const splitPatterns = value => typeof value === 'string' ? value.split(/[\n,]+/).map(item => item.trim()).filter(Boolean).slice(0, 50) : [];
  const scanName = typeof name === 'string' ? name.trim() : '';
  if (scanName.length > 255) {
    return res.status(400).json({ error: 'Scan name must be 255 characters or fewer.' });
  }

  const activeScans = listActiveJobs().filter(job => job.userId === req.session.userId);
  if (activeScans.length >= 3) {
    return res.status(429).json({ error: 'You already have 3 scans in progress. Wait for one to finish before starting another.' });
  }

  const job = enqueue({
    url: scanUrl,
    name: scanName || null,
    maxPages: pageCount,
    region,
    framework: scanFramework,
    scanType: scanProfile,
    scanProfile: profile,
    crawlMode: mode,
    journeys: allJourneys,
    includePatterns: splitPatterns(includePatterns),
    excludePatterns: splitPatterns(excludePatterns),
    subdomainPolicy: subdomain,
    interactive: interactiveEnabled,
    customJourneys: customJourneySteps,
    userId: req.session.userId,
  });
  res.json({ id: job.id, status: job.status, queuePosition: job.queuePosition });
});

app.get('/scan/:id', requireAuth, async (req, res) => {
  if (!/^[\w\-]+$/.test(req.params.id)) return res.status(400).send('Invalid job ID');
  const job = getJob(req.params.id);
  if (!job) return res.status(404).send('Job not found or server was restarted.');
  if (job.userId !== req.session.userId) return res.status(403).send('Forbidden');
  res.send(progressPage(job, req.session.userEmail ? { id: req.session.userId, email: req.session.userEmail } : null));
});

app.get('/scan/:id/status', requireAuth, (req, res) => {
  const status = jobStatus(req.params.id);
  if (!status) return res.status(404).json({ error: 'Job not found' });
  const job = getJob(req.params.id);
  if (job && job.userId !== req.session.userId) return res.status(403).json({ error: 'Forbidden' });
  res.json(status);
});

app.get('/report/:name', requireAuth, async (req, res) => {
  const name = req.params.name;

  if (!/^[\w\-]+$/.test(name)) {
    return res.status(400).send('Invalid report name');
  }

  const scanDir = path.join(RESULTS_DIR, name);
  const jsonPath = path.join(scanDir, 'scan-result.json');

  if (!fs.existsSync(jsonPath)) {
    return res.status(404).send('Report not found. The scan may still be running.');
  }

  const scan = await getScanForUser(req.session.userId, name);
  if (!scan) return res.status(403).send('Forbidden');

  try {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    if (scan && data.findings?.length) {
      const remediations = await getFindingRemediations(scan.id);
      const remMap = new Map(remediations.map(r => [r.finding_id, r]));
      data.findings = data.findings.map(f => ({
        ...f,
        remediation: remMap.get(f.id) || null,
      }));
    }
    if (scan) data._scanId = scan.id;
    data._resultDir = name;
    const html = buildReport(data, scanDir);
    if ('download' in req.query) {
      const slug = (data.name || data.url || name).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60);
      res.setHeader('Content-Disposition', `attachment; filename="cookie-scan-${slug}.html"`);
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    res.status(500).send('Failed to generate report: ' + err.message);
  }
});

// ── API key auth middleware ────────────────────────────────────────────────────

async function requireApiKey(req, res, next) {
  const auth = req.headers['authorization'] || '';
  const match = auth.match(/^Bearer (sk_[a-f0-9]+)$/);
  if (!match) return res.status(401).json({ error: 'Missing or invalid Authorization header. Use: Bearer sk_...' });
  const rawKey = match[1];
  const prefix = rawKey.slice(0, 12);
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const record = await getApiKeyByPrefix(prefix);
  if (!record || record.key_hash !== keyHash) return res.status(401).json({ error: 'Invalid API key' });
  // Update last_used_at (best-effort, non-blocking)
  const { pool } = require('./db');
  pool.query('UPDATE api_keys SET last_used_at = NOW() WHERE id = ?', [record.id]).catch(() => {});
  req.apiUserId = record.user_id;
  next();
}

// ── API key management routes ──────────────────────────────────────────────────

app.get('/api/keys', requireAuth, async (req, res) => {
  res.json(await listApiKeys(req.session.userId));
});

app.post('/api/keys', requireAuth, async (req, res) => {
  const name = (req.body?.name || '').trim().slice(0, 120);
  if (!name) return res.status(400).json({ error: 'name is required' });
  const key = await createApiKey(req.session.userId, name);
  res.status(201).json(key); // rawKey only returned once
});

app.delete('/api/keys/:id', requireAuth, async (req, res) => {
  const deleted = await deleteApiKey(Number(req.params.id), req.session.userId);
  if (!deleted) return res.status(404).json({ error: 'Key not found' });
  res.status(204).end();
});

// ── Public API (Bearer token) ──────────────────────────────────────────────────

app.get('/api/v1/scans', requireApiKey, async (req, res) => {
  const limit  = Math.min(Number(req.query.limit)  || 50, 200);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const scans = await getScansForUser(req.apiUserId);
  const page = scans.slice(offset, offset + limit);
  res.json({
    total: scans.length,
    limit,
    offset,
    items: page.map(s => ({
      id: s.id, name: s.name, url: s.url,
      scanStatus: s.scan_status, scannedAt: s.scannedAt,
      findings: s.findings, resultDir: s.result_dir,
    })),
  });
});

app.get('/api/v1/scans/:scanId', requireApiKey, async (req, res) => {
  const scan = await getScanById(Number(req.params.scanId));
  if (!scan || scan.user_id !== req.apiUserId) return res.status(404).json({ error: 'Scan not found' });
  res.json({ id: scan.id, name: scan.name, url: scan.url, scanStatus: scan.scan_status, scannedAt: scan.scannedAt, findings: scan.findings, output: scan.output });
});

app.get('/api/v1/scans/:scanId/findings', requireApiKey, async (req, res) => {
  const scan = await getScanById(Number(req.params.scanId));
  if (!scan || scan.user_id !== req.apiUserId) return res.status(404).json({ error: 'Scan not found' });
  res.json(scan.findings || []);
});

// ── Shared report links ────────────────────────────────────────────────────────

app.post('/api/scans/:scanId/share', requireAuth, async (req, res) => {
  const scanId = Number(req.params.scanId);
  if (!Number.isInteger(scanId)) return res.status(400).json({ error: 'Invalid scan ID' });
  const scan = await getScanById(scanId);
  if (!scan || scan.user_id !== req.session.userId) return res.status(404).json({ error: 'Scan not found' });
  const days = Math.min(Number(req.body?.expiresInDays) || 30, 365);
  const token = await createSharedReport(scanId, days);
  const baseUrl = (process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
  res.json({ url: `${baseUrl}/shared/${token}`, expiresInDays: days });
});

app.get('/shared/:token', async (req, res) => {
  const token = req.params.token;
  if (!/^[a-f0-9]{64}$/.test(token)) return res.status(404).send('Link not found');
  const shared = await getSharedReport(token);
  if (!shared) return res.status(404).send('This link has expired or does not exist.');
  const scanDir = path.join(RESULTS_DIR, shared.result_dir);
  const jsonPath = path.join(scanDir, 'scan-result.json');
  if (!fs.existsSync(jsonPath)) return res.status(404).send('Report not found');
  try {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    data._shared = true; // flag: no nav back-link or share button
    const html = buildReport(data, scanDir);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    res.status(500).send('Failed to render report: ' + err.message);
  }
});

// ── Scan management API ────────────────────────────────────────────────────────

app.delete('/api/scans/:scanId', requireAuth, async (req, res) => {
  const scanId = Number(req.params.scanId);
  if (!Number.isInteger(scanId)) return res.status(400).json({ error: 'Invalid scan ID' });
  const scanBefore = await getScanById(scanId);
  const deleted = await deleteScan(scanId, req.session.userId);
  if (!deleted) return res.status(404).json({ error: 'Scan not found' });
  logAudit(req.session.userId, 'scan.delete', 'scan', scanId, { url: scanBefore?.url, name: scanBefore?.name });
  res.status(204).end();
});

app.patch('/api/scans/:scanId', requireAuth, async (req, res) => {
  const scanId = Number(req.params.scanId);
  if (!Number.isInteger(scanId)) return res.status(400).json({ error: 'Invalid scan ID' });
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
  const updated = await renameScan(scanId, req.session.userId, name.trim().slice(0, 255));
  if (!updated) return res.status(404).json({ error: 'Scan not found' });
  res.json({ ok: true });
});

// ── CSV export ─────────────────────────────────────────────────────────────────

function csvRow(values) {
  return values.map(v => {
    const s = String(v == null ? '' : v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',');
}

app.get('/report/:name/export/findings.csv', requireAuth, async (req, res) => {
  const name = req.params.name;
  if (!/^[\w\-]+$/.test(name)) return res.status(400).send('Invalid');
  const scan = await getScanForUser(req.session.userId, name);
  if (!scan) return res.status(403).send('Forbidden');
  const jsonPath = path.join(RESULTS_DIR, name, 'scan-result.json');
  if (!fs.existsSync(jsonPath)) return res.status(404).send('Not found');
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const findings = data.findings || [];
  const remediations = scan.id ? await getFindingRemediations(scan.id) : [];
  const remMap = new Map(remediations.map(r => [r.finding_id, r]));
  const lines = [
    csvRow(['ID', 'Severity', 'Title', 'Regulation', 'Evidence type', 'Cookie name', 'Domain', 'Category', 'Provider', 'Scenario', 'Remediation status', 'Remediation priority', 'Remediation owner', 'Remediation due date', 'Remediation notes']),
    ...findings.map(f => {
      const rem = remMap.get(String(f.id));
      return csvRow([f.id, f.severity, f.title, f.regulation, f.evidenceType, f.cookieName, f.domain, f.category, f.provider, f.scenario,
        rem?.status || '', rem?.priority || '', rem?.owner_email || '',
        rem?.due_date ? new Date(rem.due_date).toISOString().slice(0, 10) : '',
        rem?.notes || '']);
    }),
  ];
  const slug = (data.url || name).replace(/[^a-z0-9]+/gi, '-').slice(0, 50);
  res.setHeader('Content-Disposition', `attachment; filename="findings-${slug}.csv"`);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.send('\uFEFF' + lines.join('\r\n')); // BOM for Excel
});

app.get('/report/:name/export/cookies.csv', requireAuth, async (req, res) => {
  const name = req.params.name;
  if (!/^[\w\-]+$/.test(name)) return res.status(400).send('Invalid');
  const scan = await getScanForUser(req.session.userId, name);
  if (!scan) return res.status(403).send('Forbidden');
  const jsonPath = path.join(RESULTS_DIR, name, 'scan-result.json');
  if (!fs.existsSync(jsonPath)) return res.status(404).send('Not found');
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const cookies = data.cookieMap || [];
  const lines = [
    csvRow(['Name', 'Domain', 'Category', 'Provider', 'Description', 'Expires (days)', 'Third party', 'Confidence', 'Matching rule', 'Seen in scenarios']),
    ...cookies.map(c => csvRow([
      c.name, c.domain,
      c.classification?.category, c.classification?.provider, c.classification?.description,
      c.expiresDays, c.thirdParty ? 'Yes' : 'No',
      c.classification?.confidence, c.classification?.matchingRule,
      (c.scenariosFound || []).join('; '),
    ])),
  ];
  const slug = (data.url || name).replace(/[^a-z0-9]+/gi, '-').slice(0, 50);
  res.setHeader('Content-Disposition', `attachment; filename="cookies-${slug}.csv"`);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.send('\uFEFF' + lines.join('\r\n'));
});

// ── Evidence export ──────────────────────────────────────────────────────────────

app.get('/api/scans/:scanId/export', requireAuth, async (req, res) => {
  const scanId = Number(req.params.scanId);
  if (!Number.isInteger(scanId)) return res.status(400).json({ error: 'Invalid scan ID' });
  const scan = await getScanById(scanId);
  if (!scan || scan.user_id !== req.session.userId) return res.status(404).json({ error: 'Scan not found' });
  const account = await getUserByIdWithRole(req.session.userId);
  const remediations = await getFindingRemediations(scanId);
  const domain = (() => { try { return new URL(scan.url).hostname.replace(/^www\./, ''); } catch (_) { return scan.url; } })();
  const datePart = new Date(scan.scanned_at).toISOString().slice(0, 10);
  const filename = `spidac-evidence-${domain}-${datePart}.json`;
  const bundle = {
    exportedAt: new Date().toISOString(),
    exportedBy: account?.email || '',
    product: 'SPIDAC - Digital Tech Assurance',
    scan: {
      id: scan.id,
      url: scan.url,
      name: scan.name || null,
      scannedAt: scan.scanned_at,
      scanStatus: scan.scan_status,
      scanConfig: scan.scan_config ? (typeof scan.scan_config === 'string' ? JSON.parse(scan.scan_config) : scan.scan_config) : null,
    },
    findings: scan.findings || [],
    output: scan.output || null,
    remediations,
  };
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  logAudit(req.session.userId, 'scan.export', 'scan', scanId, { url: scan.url });
  res.send(JSON.stringify(bundle, null, 2));
});

// ── Remediation API ─────────────────────────────────────────────────────────────

app.get('/api/scans/:scanId/remediations', requireAuth, async (req, res) => {
  const scanId = Number(req.params.scanId);
  if (!Number.isInteger(scanId)) return res.status(400).json({ error: 'Invalid scan ID' });
  const scan = await getScanById(scanId);
  if (!scan || scan.user_id !== req.session.userId) return res.status(404).json({ error: 'Scan not found' });
  const remediations = await getFindingRemediations(scanId);
  res.json(remediations);
});

app.get('/api/scans/:scanId/remediations/:findingId', requireAuth, async (req, res) => {
  const scanId = Number(req.params.scanId);
  const findingId = String(req.params.findingId || '');
  if (!Number.isInteger(scanId) || !findingId) return res.status(400).json({ error: 'Invalid scan ID or finding ID' });
  const scan = await getScanById(scanId);
  if (!scan || scan.user_id !== req.session.userId) return res.status(404).json({ error: 'Scan not found' });
  const remediation = await getFindingRemediation(scanId, findingId);
  if (!remediation) return res.status(404).json({ error: 'Remediation not found' });
  res.json(remediation);
});

app.post('/api/scans/:scanId/remediations', requireAuth, async (req, res) => {
  const scanId = Number(req.params.scanId);
  const { findingId, ownerId, ownerEmail, status, priority, dueDate, notes, verificationScanId } = req.body || {};
  if (!Number.isInteger(scanId) || !findingId) return res.status(400).json({ error: 'scanId and findingId are required' });
  const scan = await getScanById(scanId);
  if (!scan || scan.user_id !== req.session.userId) return res.status(404).json({ error: 'Scan not found' });
  const validStatus = ['open', 'investigating', 'fixed', 'accepted risk'];
  const validPriority = ['low', 'medium', 'high', 'critical'];
  if (status && !validStatus.includes(status)) return res.status(400).json({ error: `status must be one of: ${validStatus.join(', ')}` });
  if (priority && !validPriority.includes(priority)) return res.status(400).json({ error: `priority must be one of: ${validPriority.join(', ')}` });
  // Resolve ownerEmail → ownerId if provided
  let resolvedOwnerId = ownerId ? Number(ownerId) : null;
  if (!resolvedOwnerId && ownerEmail) {
    const ownerUser = await getUserByEmail(ownerEmail.trim()).catch(() => null);
    if (ownerUser) resolvedOwnerId = ownerUser.id;
  }
  const id = await setFindingRemediation({
    scanId,
    findingId: String(findingId),
    ownerId: resolvedOwnerId,
    status: status || 'open',
    priority: priority || 'medium',
    dueDate: dueDate || null,
    notes: notes || null,
    verificationScanId: verificationScanId ? Number(verificationScanId) : null,
  });
  res.json({ id });
});

// ── Scan comparison API ────────────────────────────────────────────────────────

app.post('/api/scan-comparisons', requireAuth, async (req, res) => {
  const { baselineScanId, currentScanId } = req.body || {};
  const baselineId = Number(baselineScanId);
  const currentId = Number(currentScanId);
  if (!Number.isInteger(baselineId) || !Number.isInteger(currentId)) return res.status(400).json({ error: 'baselineScanId and currentScanId are required' });

  const baseline = await getScanById(baselineId);
  const current = await getScanById(currentId);
  if (!baseline || baseline.user_id !== req.session.userId) return res.status(404).json({ error: 'Baseline scan not found' });
  if (!current || current.user_id !== req.session.userId) return res.status(404).json({ error: 'Current scan not found' });

  const baselineFindings = baseline.findings || [];
  const currentFindings = current.findings || [];
  const baselineIds = new Set(baselineFindings.map(f => f.id));
  const currentIds = new Set(currentFindings.map(f => f.id));

  const newFindings = currentFindings.filter(f => !baselineIds.has(f.id));
  const fixedFindings = baselineFindings.filter(f => !currentIds.has(f.id));
  const changedFindings = currentFindings.filter(f => {
    const prev = baselineFindings.find(bf => bf.id === f.id);
    return prev && (prev.severity !== f.severity || prev.title !== f.title || prev.status !== f.status);
  });

  // Cookie diff (by name||domain key)
  const baselineCookies = baseline.output?.cookieMap || [];
  const currentCookies = current.output?.cookieMap || [];
  const bCookieKeys = new Set(baselineCookies.map(c => `${c.name}||${c.domain}`));
  const cCookieKeys = new Set(currentCookies.map(c => `${c.name}||${c.domain}`));
  const newCookies = currentCookies.filter(c => !bCookieKeys.has(`${c.name}||${c.domain}`))
    .map(c => ({ name: c.name, domain: c.domain, category: c.classification?.category || '—', provider: c.classification?.provider || '—' }));
  const removedCookies = baselineCookies.filter(c => !cCookieKeys.has(`${c.name}||${c.domain}`))
    .map(c => ({ name: c.name, domain: c.domain, category: c.classification?.category || '—', provider: c.classification?.provider || '—' }));

  // Vendor (third-party domain) diff across all scenarios
  const collectVendors = (output) => {
    const domains = new Set();
    for (const sc of (output?.scenarios || [])) {
      for (const d of (sc.thirdPartyDomains || [])) domains.add(d);
    }
    return domains;
  };
  const baselineVendors = collectVendors(baseline.output);
  const currentVendors = collectVendors(current.output);
  const newVendors = [...currentVendors].filter(d => !baselineVendors.has(d));
  const removedVendors = [...baselineVendors].filter(d => !currentVendors.has(d));

  const summary = {
    newCount: newFindings.length,
    fixedCount: fixedFindings.length,
    changedCount: changedFindings.length,
    baselineFindingsCount: baselineFindings.length,
    currentFindingsCount: currentFindings.length,
    newCookiesCount: newCookies.length,
    removedCookiesCount: removedCookies.length,
    newVendorsCount: newVendors.length,
    removedVendorsCount: removedVendors.length,
  };

  const id = await createScanComparison({
    userId: req.session.userId,
    baselineScanId: baselineId,
    currentScanId: currentId,
    // audit logged below
    summary,
    newFindings,
    fixedFindings,
    changedFindings,
    newCookies,
    removedCookies,
    newVendors,
    removedVendors,
  });
  logAudit(req.session.userId, 'comparison.create', 'scan_comparison', id, { baselineId, currentId, newCount: summary.newCount, fixedCount: summary.fixedCount });
  res.json({ id, summary });
});

app.get('/api/scan-comparisons', requireAuth, async (req, res) => {
  const comparisons = await getScanComparisonsForUser(req.session.userId);
  res.json(comparisons);
});

app.get('/api/scan-comparisons/:id', requireAuth, async (req, res) => {
  const comparison = await getScanComparison(Number(req.params.id));
  if (!comparison || comparison.user_id !== req.session.userId) return res.status(404).json({ error: 'Comparison not found' });
  res.json(comparison);
});

app.get('/app/remediations', requireAuth, async (req, res) => {
  const remediations = await getAllRemediationsForUser(req.session.userId);
  const account = await getUserByIdWithRole(req.session.userId);
  res.send(remediationsPage(remediations, account || { id: req.session.userId, email: req.session.userEmail }));
});

app.get('/comparisons', requireAuth, async (req, res) => {
  const comparisons = await getScanComparisonsForUser(req.session.userId);
  res.send(comparisonListPage(comparisons, req.session.userEmail ? { id: req.session.userId, email: req.session.userEmail } : null));
});

app.get('/comparisons/:id', requireAuth, async (req, res) => {
  const comparison = await getScanComparison(Number(req.params.id));
  if (!comparison || comparison.user_id !== req.session.userId) return res.status(404).send('Comparison not found');
  res.send(comparisonPage(comparison, req.session.userEmail ? { id: req.session.userId, email: req.session.userEmail } : null));
});

// ── Monitoring API ─────────────────────────────────────────────────────────────

app.get('/api/monitors', requireAuth, async (req, res) => {
  const monitors = await getMonitorsForUser(req.session.userId);
  res.json(monitors);
});

app.post('/api/monitors', requireAuth, async (req, res) => {
  const { name, url, scanConfig, schedule, timezone, recipients, webhookUrl, thresholdCritical, thresholdHigh } = req.body || {};
  if (!name || !url || !scanConfig) return res.status(400).json({ error: 'name, url, and scanConfig are required' });
  if (webhookUrl && !/^https?:\/\//.test(webhookUrl)) return res.status(400).json({ error: 'webhookUrl must be a valid http/https URL' });
  const monId = await createMonitor({
    userId: req.session.userId,
    name,
    url,
    scanConfig,
    schedule: schedule || '0 0 * * *',
    timezone: timezone || 'UTC',
    recipients: Array.isArray(recipients) ? recipients : [],
    webhookUrl: webhookUrl || null,
    thresholdCritical: Number(thresholdCritical) || 1,
    thresholdHigh: thresholdHigh != null ? Number(thresholdHigh) : null,
  });
  const monitor = await getMonitor(monId);
  logAudit(req.session.userId, 'monitor.create', 'monitor', monId, { name, url });
  res.status(201).json(monitor);
});

app.put('/api/monitors/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const monitor = await getMonitor(id);
  if (!monitor || monitor.user_id !== req.session.userId) return res.status(404).json({ error: 'Monitor not found' });
  const { name, url, scanConfig, schedule, timezone, recipients, webhookUrl, thresholdCritical, thresholdHigh, enabled, nextRunAt } = req.body || {};
  if (webhookUrl !== undefined && webhookUrl && !/^https?:\/\//.test(webhookUrl)) return res.status(400).json({ error: 'webhookUrl must be a valid http/https URL' });
  await updateMonitor(id, {
    name,
    url,
    scanConfig,
    schedule,
    timezone,
    recipients,
    webhookUrl,
    thresholdCritical,
    thresholdHigh: thresholdHigh !== undefined ? (thresholdHigh != null ? Number(thresholdHigh) : null) : undefined,
    enabled,
    nextRunAt,
  });
  const updated = await getMonitor(id);
  res.json(updated);
});

app.delete('/api/monitors/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const monitor = await getMonitor(id);
  if (!monitor || monitor.user_id !== req.session.userId) return res.status(404).json({ error: 'Monitor not found' });
  await deleteMonitor(id);
  logAudit(req.session.userId, 'monitor.delete', 'monitor', id, { name: monitor.name });
  res.status(204).end();
});

app.get('/api/monitors/:id/runs', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const monitor = await getMonitor(id);
  if (!monitor || monitor.user_id !== req.session.userId) return res.status(404).json({ error: 'Monitor not found' });
  const runs = await getMonitorRuns(id, Number(req.query.limit) || 20);
  res.json(runs);
});

app.post('/api/monitors/test-webhook', requireAuth, async (req, res) => {
  const { webhookUrl } = req.body || {};
  if (!webhookUrl || !/^https?:\/\//.test(webhookUrl)) return res.status(400).json({ error: 'Invalid webhook URL' });
  const { fireWebhook } = require('./scheduler');
  // Send a test payload
  const testMonitor = { id: 0, name: 'Test', url: webhookUrl, webhook_url: webhookUrl };
  try {
    await fireWebhook({ monitor: testMonitor, runStatus: 'test', criticalCount: 0, findings: {}, scanId: null });
    res.json({ ok: true });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

app.post('/api/monitors/:id/run-now', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const monitor = await getMonitor(id);
  if (!monitor || monitor.user_id !== req.session.userId) return res.status(404).json({ error: 'Monitor not found' });
  const { enqueue } = require('./queue');
  const cfg = monitor.scanConfig || {};
  const job = enqueue({
    url: monitor.url,
    name: `[Monitor] ${monitor.name}`,
    userId: monitor.user_id,
    region: cfg.region || 'gb',
    framework: cfg.framework || 'uk-pecr',
    scanType: cfg.scanType || 'consent',
    scanProfile: cfg.scanProfile || 'standard',
    crawlMode: cfg.crawlMode || 'homepage',
    journeys: cfg.journeys || ['no-interaction', 'accept-all', 'reject-all'],
    maxPages: cfg.maxPages || 1,
  });
  res.json({ jobId: job.id, message: 'Scan queued' });
});

app.patch('/api/monitors/:id/enabled', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const monitor = await getMonitor(id);
  if (!monitor || monitor.user_id !== req.session.userId) return res.status(404).json({ error: 'Monitor not found' });
  const { enabled } = req.body || {};
  if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'enabled must be a boolean' });
  await updateMonitor(id, { enabled });
  res.json({ ok: true, enabled });
});

// ── Start ──────────────────────────────────────────────────────────────────────

(async () => {
  try {
    await initDb();
  } catch (err) {
    console.error('\nFatal: could not connect to MySQL.');
    console.error('Set DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME env vars, or start your MySQL/MariaDB server.');
    console.error('Error:', err.message);
    process.exit(1);
  }

  const { start: startScheduler } = require('./scheduler');

  app.listen(PORT, '127.0.0.1', () => {
    console.log(`\nSPIDAC - Digital Tech Assurance`);
    console.log(`Local UI:  http://localhost:${PORT}`);
    console.log(`Results:   ${RESULTS_DIR}`);
    console.log(`\nPress Ctrl+C to stop.\n`);
    startMonitor();
    startScheduler();
  });
})();
