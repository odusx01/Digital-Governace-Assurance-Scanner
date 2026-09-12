'use strict';

const mysql = require('mysql2/promise');

const DB_NAME = process.env.DB_NAME || 'consentlens';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASS = process.env.DB_PASS || '';
const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);

const pool = mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASS,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
});

async function initDb() {
  const conn = await mysql.createPool({ host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASS });
  try {
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  } finally {
    await conn.end();
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      full_name VARCHAR(255) NOT NULL DEFAULT '',
      organization_name VARCHAR(255) NOT NULL DEFAULT '',
      organization_role VARCHAR(120) NOT NULL DEFAULT '',
      email_verified TINYINT(1) NOT NULL DEFAULT 0,
      verification_token_hash CHAR(64) NULL,
      verification_expires DATETIME NULL,
      role VARCHAR(32) NOT NULL DEFAULT 'user',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Keep existing installations compatible with the admin role addition.
  await pool.query(`ALTER TABLE monitors ADD COLUMN IF NOT EXISTS webhook_url TEXT NULL`);
  await pool.query(`ALTER TABLE monitors ADD COLUMN IF NOT EXISTS threshold_high INT NULL DEFAULT NULL`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_digest_at DATETIME NULL`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      action VARCHAR(80) NOT NULL,
      resource_type VARCHAR(40) NULL,
      resource_id INT NULL,
      details JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_audit_user (user_id),
      INDEX idx_audit_time (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      name VARCHAR(120) NOT NULL,
      key_prefix CHAR(12) NOT NULL,
      key_hash CHAR(64) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_used_at DATETIME NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_api_key_user (user_id),
      INDEX idx_api_key_prefix (key_prefix)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shared_reports (
      id INT AUTO_INCREMENT PRIMARY KEY,
      scan_id INT NOT NULL,
      token CHAR(64) NOT NULL,
      expires_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE,
      UNIQUE KEY idx_shared_token (token),
      INDEX idx_shared_scan (scan_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.query(`ALTER TABLE scan_comparisons ADD COLUMN IF NOT EXISTS cookie_diff_json JSON`);
  await pool.query(`ALTER TABLE scan_comparisons ADD COLUMN IF NOT EXISTS vendor_diff_json JSON`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(32) NOT NULL DEFAULT 'user'`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255) NOT NULL DEFAULT ''`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_name VARCHAR(255) NOT NULL DEFAULT ''`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_role VARCHAR(120) NOT NULL DEFAULT ''`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified TINYINT(1) NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token_hash CHAR(64) NULL`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_expires DATETIME NULL`);
  // Existing accounts predate verification and have no pending token.
  await pool.query('UPDATE users SET email_verified = 1 WHERE email_verified = 0 AND verification_token_hash IS NULL');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS scans (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      name VARCHAR(255),
      url TEXT NOT NULL,
      result_dir VARCHAR(255) NOT NULL,
      scan_status VARCHAR(50) DEFAULT 'ok',
      findings_json JSON,
      output_json JSON,
      scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS blog_posts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      slug VARCHAR(180) UNIQUE NOT NULL,
      title VARCHAR(255) NOT NULL,
      excerpt TEXT NOT NULL,
      body MEDIUMTEXT NOT NULL,
      category VARCHAR(80) NOT NULL DEFAULT 'Privacy technology',
      author_id INT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'draft',
      published_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_blog_status_date (status, published_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS finding_remediations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      scan_id INT NOT NULL,
      finding_id VARCHAR(64) NOT NULL,
      owner_id INT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'open',
      priority VARCHAR(32) NOT NULL DEFAULT 'medium',
      due_date DATETIME NULL,
      notes TEXT,
      verification_scan_id INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (verification_scan_id) REFERENCES scans(id) ON DELETE SET NULL,
      INDEX idx_finding_remediation_scan (scan_id),
      INDEX idx_finding_remediation_finding (finding_id),
      INDEX idx_finding_remediation_owner (owner_id),
      INDEX idx_finding_remediation_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS scan_comparisons (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      baseline_scan_id INT NOT NULL,
      current_scan_id INT NOT NULL,
      summary JSON,
      new_findings_json JSON,
      fixed_findings_json JSON,
      changed_findings_json JSON,
      cookie_diff_json JSON,
      vendor_diff_json JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (baseline_scan_id) REFERENCES scans(id) ON DELETE CASCADE,
      FOREIGN KEY (current_scan_id) REFERENCES scans(id) ON DELETE CASCADE,
      INDEX idx_scan_comparison_user (user_id),
      INDEX idx_scan_comparison_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS monitors (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      url TEXT NOT NULL,
      scan_config JSON NOT NULL,
      schedule VARCHAR(64) NOT NULL DEFAULT '0 0 * * *',
      timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
      recipients JSON,
      webhook_url TEXT NULL,
      threshold_critical INT NOT NULL DEFAULT 1,
      last_run_at DATETIME NULL,
      last_run_status VARCHAR(32) NULL,
      next_run_at DATETIME NULL,
      enabled TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_monitors_user (user_id),
      INDEX idx_monitors_next_run (next_run_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS monitor_runs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      monitor_id INT NOT NULL,
      scan_id INT NULL,
      status VARCHAR(32) NOT NULL,
      new_critical_count INT NOT NULL DEFAULT 0,
      details JSON,
      run_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE,
      FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE SET NULL,
      INDEX idx_monitor_runs_monitor (monitor_id),
      INDEX idx_monitor_runs_run_at (run_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  if (process.env.ADMIN_EMAIL) {
    await pool.query('UPDATE users SET role = \'admin\' WHERE email = ?', [process.env.ADMIN_EMAIL.trim().toLowerCase()]);
  }
}

async function listAllUsers() {
  const [rows] = await pool.query(
    `SELECT u.id, u.email, u.full_name, u.organization_name, u.organization_role, u.role, u.email_verified, u.created_at,
            COUNT(DISTINCT s.id) AS scan_count
     FROM users u
     LEFT JOIN scans s ON s.user_id = u.id
     GROUP BY u.id
     ORDER BY u.created_at DESC`
  );
  return rows;
}

async function setUserRole(userId, role) {
  await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, userId]);
}

async function getUserByEmail(email) {
  const [rows] = await pool.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
  return rows[0] || null;
}

async function getUserByIdWithRole(id) {
  const [rows] = await pool.query('SELECT id, email, full_name, organization_name, organization_role, role, created_at FROM users WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function listBlogPosts({ publishedOnly = false } = {}) {
  const where = publishedOnly ? 'WHERE p.status = \'published\'' : '';
  const [rows] = await pool.query(
    `SELECT p.*, u.email AS author_email FROM blog_posts p JOIN users u ON u.id = p.author_id ${where} ORDER BY COALESCE(p.published_at, p.created_at) DESC`
  );
  return rows;
}

async function getBlogPostBySlug(slug) {
  const [rows] = await pool.query(
    'SELECT p.*, u.email AS author_email FROM blog_posts p JOIN users u ON u.id = p.author_id WHERE p.slug = ? AND p.status = \'published\' LIMIT 1',
    [slug]
  );
  return rows[0] || null;
}

async function createBlogPost({ slug, title, excerpt, body, category, authorId, status }) {
  const publishedAt = status === 'published' ? new Date() : null;
  const [result] = await pool.query(
    'INSERT INTO blog_posts (slug, title, excerpt, body, category, author_id, status, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [slug, title, excerpt, body, category, authorId, status, publishedAt]
  );
  return result.insertId;
}

async function updateBlogPost(id, { slug, title, excerpt, body, category, status }) {
  const publishedAt = status === 'published' ? new Date() : null;
  await pool.query(
    'UPDATE blog_posts SET slug = ?, title = ?, excerpt = ?, body = ?, category = ?, status = ?, published_at = CASE WHEN ? = \'published\' AND published_at IS NULL THEN ? WHEN ? = \'draft\' THEN NULL ELSE published_at END WHERE id = ?',
    [slug, title, excerpt, body, category, status, status, publishedAt, status, id]
  );
}

async function deleteBlogPost(id) {
  await pool.query('DELETE FROM blog_posts WHERE id = ?', [id]);
}

async function createUser({ email, passwordHash, fullName, organizationName, organizationRole, verificationTokenHash, verificationExpires }) {
  const [result] = await pool.query(
    'INSERT INTO users (email, password_hash, full_name, organization_name, organization_role, verification_token_hash, verification_expires) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [email, passwordHash, fullName, organizationName, organizationRole, verificationTokenHash, verificationExpires]
  );
  return result.insertId;
}

async function getUserByVerificationTokenHash(tokenHash) {
  const [rows] = await pool.query(
    'SELECT * FROM users WHERE verification_token_hash = ? AND email_verified = 0 AND verification_expires > NOW() LIMIT 1',
    [tokenHash]
  );
  return rows[0] || null;
}

async function verifyUserEmail(userId) {
  await pool.query(
    'UPDATE users SET email_verified = 1, verification_token_hash = NULL, verification_expires = NULL WHERE id = ?',
    [userId]
  );
}

async function deleteUser(userId) {
  await pool.query('DELETE FROM users WHERE id = ?', [userId]);
}

async function updateUserProfile(userId, { fullName, organizationName, organizationRole }) {
  await pool.query(
    'UPDATE users SET full_name = ?, organization_name = ?, organization_role = ? WHERE id = ?',
    [fullName || null, organizationName || null, organizationRole || null, userId]
  );
}

async function updateUserPassword(userId, passwordHash) {
  await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);
}

async function getUserById(id) {
  const [rows] = await pool.query('SELECT id, email, created_at FROM users WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function saveScan(userId, { name, url, resultDir, scanStatus, output }) {
  const findings = output?.findings || null;
  const [result] = await pool.query(
    'INSERT INTO scans (user_id, name, url, result_dir, scan_status, findings_json, output_json) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [userId, name || null, url, resultDir, scanStatus || 'ok', findings ? JSON.stringify(findings) : null, output ? JSON.stringify(output) : null]
  );
  return result.insertId;
}

async function getScansForUser(userId) {
  const [rows] = await pool.query(
    'SELECT * FROM scans WHERE user_id = ? ORDER BY scanned_at DESC',
    [userId]
  );
  return rows.map(r => ({
    ...r,
    findings: r.findings_json ? JSON.parse(r.findings_json) : null,
    output: r.output_json ? JSON.parse(r.output_json) : null,
  }));
}

async function getScanForUser(userId, resultDir) {
  const [rows] = await pool.query('SELECT * FROM scans WHERE result_dir = ? AND user_id = ? LIMIT 1', [resultDir, userId]);
  const row = rows[0];
  if (!row) return null;
  return {
    ...row,
    findings: row.findings_json ? JSON.parse(row.findings_json) : null,
    output: row.output_json ? JSON.parse(row.output_json) : null,
  };
}

async function getScanById(scanId) {
  const [rows] = await pool.query('SELECT * FROM scans WHERE id = ? LIMIT 1', [scanId]);
  const row = rows[0];
  if (!row) return null;
  return {
    ...row,
    findings: row.findings_json ? JSON.parse(row.findings_json) : null,
    output: row.output_json ? JSON.parse(row.output_json) : null,
  };
}

async function setFindingRemediation({ scanId, findingId, ownerId, status, priority, dueDate, notes, verificationScanId }) {
  const [existing] = await pool.query(
    'SELECT id FROM finding_remediations WHERE scan_id = ? AND finding_id = ? LIMIT 1',
    [scanId, findingId]
  );
  if (existing.length) {
    await pool.query(
      'UPDATE finding_remediations SET owner_id = ?, status = ?, priority = ?, due_date = ?, notes = ?, verification_scan_id = ? WHERE id = ?',
      [ownerId, status, priority, dueDate, notes, verificationScanId, existing[0].id]
    );
    return existing[0].id;
  }
  const [result] = await pool.query(
    'INSERT INTO finding_remediations (scan_id, finding_id, owner_id, status, priority, due_date, notes, verification_scan_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [scanId, findingId, ownerId, status, priority, dueDate, notes, verificationScanId]
  );
  return result.insertId;
}

async function createApiKey(userId, name) {
  const crypto = require('crypto');
  const rawKey = 'sk_' + crypto.randomBytes(24).toString('hex'); // sk_ + 48 hex chars
  const prefix = rawKey.slice(0, 12); // "sk_" + first 9 chars
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const [result] = await pool.query(
    'INSERT INTO api_keys (user_id, name, key_prefix, key_hash) VALUES (?, ?, ?, ?)',
    [userId, name, prefix, keyHash]
  );
  return { id: result.insertId, rawKey, prefix, name };
}

async function listApiKeys(userId) {
  const [rows] = await pool.query(
    'SELECT id, name, key_prefix, created_at, last_used_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC',
    [userId]
  );
  return rows;
}

async function deleteApiKey(id, userId) {
  const [result] = await pool.query('DELETE FROM api_keys WHERE id = ? AND user_id = ?', [id, userId]);
  return result.affectedRows > 0;
}

async function getApiKeyByPrefix(prefix) {
  const [rows] = await pool.query(
    'SELECT * FROM api_keys WHERE key_prefix = ? LIMIT 1', [prefix]
  );
  return rows[0] || null;
}

async function createSharedReport(scanId, expiresInDays = 30) {
  const crypto = require('crypto');
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + expiresInDays * 86400 * 1000);
  await pool.query(
    'INSERT INTO shared_reports (scan_id, token, expires_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE token = VALUES(token), expires_at = VALUES(expires_at)',
    [scanId, token, expiresAt]
  );
  return token;
}

async function getSharedReport(token) {
  const [rows] = await pool.query(
    'SELECT sr.*, s.result_dir, s.user_id FROM shared_reports sr JOIN scans s ON s.id = sr.scan_id WHERE sr.token = ? AND (sr.expires_at IS NULL OR sr.expires_at > NOW()) LIMIT 1',
    [token]
  );
  return rows[0] || null;
}

async function deleteScan(scanId, userId) {
  // ON DELETE CASCADE handles findings_remediations, scan_comparisons FK
  const [result] = await pool.query('DELETE FROM scans WHERE id = ? AND user_id = ?', [scanId, userId]);
  return result.affectedRows > 0;
}

async function renameScan(scanId, userId, name) {
  const [result] = await pool.query('UPDATE scans SET name = ? WHERE id = ? AND user_id = ?', [name, scanId, userId]);
  return result.affectedRows > 0;
}

async function getAllRemediationsForUser(userId) {
  const [rows] = await pool.query(
    `SELECT r.*, s.url AS scan_url, s.name AS scan_name, s.result_dir AS scan_result_dir, s.scanned_at,
            u.email AS owner_email
     FROM finding_remediations r
     JOIN scans s ON s.id = r.scan_id
     LEFT JOIN users u ON u.id = r.owner_id
     WHERE s.user_id = ?
     ORDER BY FIELD(r.status,'open','investigating','fixed','accepted risk'), r.priority DESC, r.updated_at DESC`,
    [userId]
  );
  return rows;
}

async function getFindingRemediations(scanId) {
  const [rows] = await pool.query(
    'SELECT r.*, u.email AS owner_email FROM finding_remediations r LEFT JOIN users u ON u.id = r.owner_id WHERE r.scan_id = ? ORDER BY r.updated_at DESC',
    [scanId]
  );
  return rows;
}

async function getFindingRemediation(scanId, findingId) {
  const [rows] = await pool.query(
    'SELECT r.*, u.email AS owner_email FROM finding_remediations r LEFT JOIN users u ON u.id = r.owner_id WHERE r.scan_id = ? AND r.finding_id = ? LIMIT 1',
    [scanId, findingId]
  );
  return rows[0] || null;
}

async function createScanComparison({ userId, baselineScanId, currentScanId, summary, newFindings, fixedFindings, changedFindings, newCookies, removedCookies, newVendors, removedVendors }) {
  const cookieDiff = { newCookies: newCookies || [], removedCookies: removedCookies || [] };
  const vendorDiff = { newVendors: newVendors || [], removedVendors: removedVendors || [] };
  const [result] = await pool.query(
    'INSERT INTO scan_comparisons (user_id, baseline_scan_id, current_scan_id, summary, new_findings_json, fixed_findings_json, changed_findings_json, cookie_diff_json, vendor_diff_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [userId, baselineScanId, currentScanId, summary ? JSON.stringify(summary) : null, newFindings ? JSON.stringify(newFindings) : null, fixedFindings ? JSON.stringify(fixedFindings) : null, changedFindings ? JSON.stringify(changedFindings) : null, JSON.stringify(cookieDiff), JSON.stringify(vendorDiff)]
  );
  return result.insertId;
}

async function getScanComparisonsForUser(userId) {
  const [rows] = await pool.query(
    'SELECT c.*, s1.url AS baseline_url, s2.url AS current_url FROM scan_comparisons c JOIN scans s1 ON s1.id = c.baseline_scan_id JOIN scans s2 ON s2.id = c.current_scan_id WHERE c.user_id = ? ORDER BY c.created_at DESC',
    [userId]
  );
  return rows.map(r => {
    const cookieDiff = r.cookie_diff_json ? JSON.parse(r.cookie_diff_json) : {};
    const vendorDiff = r.vendor_diff_json ? JSON.parse(r.vendor_diff_json) : {};
    return {
      ...r,
      summary: r.summary ? JSON.parse(r.summary) : null,
      newFindings: r.new_findings_json ? JSON.parse(r.new_findings_json) : [],
      fixedFindings: r.fixed_findings_json ? JSON.parse(r.fixed_findings_json) : [],
      changedFindings: r.changed_findings_json ? JSON.parse(r.changed_findings_json) : [],
      newCookies: cookieDiff.newCookies || [],
      removedCookies: cookieDiff.removedCookies || [],
      newVendors: vendorDiff.newVendors || [],
      removedVendors: vendorDiff.removedVendors || [],
    };
  });
}

async function getScanComparison(id) {
  const [rows] = await pool.query('SELECT * FROM scan_comparisons WHERE id = ? LIMIT 1', [id]);
  const row = rows[0];
  if (!row) return null;
  const cookieDiff = row.cookie_diff_json ? JSON.parse(row.cookie_diff_json) : {};
  const vendorDiff = row.vendor_diff_json ? JSON.parse(row.vendor_diff_json) : {};
  return {
    ...row,
    summary: row.summary ? JSON.parse(row.summary) : null,
    newFindings: row.new_findings_json ? JSON.parse(row.new_findings_json) : [],
    fixedFindings: row.fixed_findings_json ? JSON.parse(row.fixed_findings_json) : [],
    changedFindings: row.changed_findings_json ? JSON.parse(row.changed_findings_json) : [],
    newCookies: cookieDiff.newCookies || [],
    removedCookies: cookieDiff.removedCookies || [],
    newVendors: vendorDiff.newVendors || [],
    removedVendors: vendorDiff.removedVendors || [],
  };
}

async function logAudit(userId, action, resourceType, resourceId, details) {
  try {
    await pool.query(
      'INSERT INTO audit_log (user_id, action, resource_type, resource_id, details) VALUES (?, ?, ?, ?, ?)',
      [userId, action, resourceType || null, resourceId || null, details ? JSON.stringify(details) : null]
    );
  } catch (_) {}
}

async function getAuditLogForUser(userId, limit = 100) {
  const [rows] = await pool.query(
    'SELECT * FROM audit_log WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
    [userId, limit]
  );
  return rows.map(r => ({ ...r, details: r.details ? JSON.parse(r.details) : null }));
}

async function getUsersNeedingDigest() {
  const [rows] = await pool.query(`
    SELECT DISTINCT u.id, u.email, u.full_name, u.last_digest_at
    FROM users u
    INNER JOIN monitors m ON m.user_id = u.id AND m.enabled = 1
    WHERE JSON_LENGTH(m.recipients) > 0
      AND (u.last_digest_at IS NULL OR u.last_digest_at < DATE_SUB(NOW(), INTERVAL 7 DAY))
  `);
  return rows;
}

async function updateUserDigestAt(userId) {
  await pool.query('UPDATE users SET last_digest_at = NOW() WHERE id = ?', [userId]);
}

async function createMonitor({ userId, name, url, scanConfig, schedule, timezone, recipients, webhookUrl, thresholdCritical, thresholdHigh }) {
  const [result] = await pool.query(
    'INSERT INTO monitors (user_id, name, url, scan_config, schedule, timezone, recipients, webhook_url, threshold_critical, threshold_high) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [userId, name, url, JSON.stringify(scanConfig), schedule, timezone, JSON.stringify(recipients || []), webhookUrl || null, thresholdCritical, thresholdHigh ?? null]
  );
  return result.insertId;
}

async function getMonitorsForUser(userId) {
  const [rows] = await pool.query('SELECT * FROM monitors WHERE user_id = ? ORDER BY created_at DESC', [userId]);
  return rows.map(r => ({
    ...r,
    scanConfig: r.scan_config ? JSON.parse(r.scan_config) : {},
    recipients: r.recipients ? JSON.parse(r.recipients) : [],
  }));
}

async function getMonitor(id) {
  const [rows] = await pool.query('SELECT * FROM monitors WHERE id = ? LIMIT 1', [id]);
  const row = rows[0];
  if (!row) return null;
  return {
    ...row,
    scanConfig: row.scan_config ? JSON.parse(row.scan_config) : {},
    recipients: row.recipients ? JSON.parse(row.recipients) : [],
  };
}

async function updateMonitor(id, { name, url, scanConfig, schedule, timezone, recipients, webhookUrl, thresholdCritical, thresholdHigh, enabled, nextRunAt, lastRunAt, lastRunStatus }) {
  const fields = [];
  const values = [];
  if (name !== undefined) { fields.push('name = ?'); values.push(name); }
  if (url !== undefined) { fields.push('url = ?'); values.push(url); }
  if (scanConfig !== undefined) { fields.push('scan_config = ?'); values.push(JSON.stringify(scanConfig)); }
  if (schedule !== undefined) { fields.push('schedule = ?'); values.push(schedule); }
  if (timezone !== undefined) { fields.push('timezone = ?'); values.push(timezone); }
  if (recipients !== undefined) { fields.push('recipients = ?'); values.push(JSON.stringify(recipients)); }
  if (webhookUrl !== undefined) { fields.push('webhook_url = ?'); values.push(webhookUrl || null); }
  if (thresholdCritical !== undefined) { fields.push('threshold_critical = ?'); values.push(thresholdCritical); }
  if (thresholdHigh !== undefined) { fields.push('threshold_high = ?'); values.push(thresholdHigh ?? null); }
  if (enabled !== undefined) { fields.push('enabled = ?'); values.push(enabled); }
  if (nextRunAt !== undefined) { fields.push('next_run_at = ?'); values.push(nextRunAt); }
  if (lastRunAt !== undefined) { fields.push('last_run_at = ?'); values.push(lastRunAt); }
  if (lastRunStatus !== undefined) { fields.push('last_run_status = ?'); values.push(lastRunStatus); }
  if (!fields.length) return;
  values.push(id);
  await pool.query(`UPDATE monitors SET ${fields.join(', ')} WHERE id = ?`, values);
}

async function deleteMonitor(id) {
  await pool.query('DELETE FROM monitors WHERE id = ?', [id]);
}

async function getAllDueMonitors() {
  const [rows] = await pool.query(
    `SELECT * FROM monitors WHERE enabled = 1 AND (next_run_at IS NULL OR next_run_at <= NOW()) ORDER BY next_run_at ASC`
  );
  return rows.map(r => ({
    ...r,
    scanConfig: r.scan_config ? JSON.parse(r.scan_config) : {},
    recipients: r.recipients ? JSON.parse(r.recipients) : [],
  }));
}

async function updateMonitorAfterRun(id, { status, nextRunAt }) {
  await pool.query(
    'UPDATE monitors SET last_run_at = NOW(), last_run_status = ?, next_run_at = ? WHERE id = ?',
    [status, nextRunAt, id]
  );
}

async function createMonitorRun({ monitorId, scanId, status, newCriticalCount, details }) {
  const [result] = await pool.query(
    'INSERT INTO monitor_runs (monitor_id, scan_id, status, new_critical_count, details) VALUES (?, ?, ?, ?, ?)',
    [monitorId, scanId, status, newCriticalCount, details ? JSON.stringify(details) : null]
  );
  return result.insertId;
}

async function getMonitorRuns(monitorId, limit = 20) {
  const [rows] = await pool.query(
    'SELECT r.*, s.url AS scan_url, s.result_dir AS scan_result_dir FROM monitor_runs r LEFT JOIN scans s ON s.id = r.scan_id WHERE r.monitor_id = ? ORDER BY r.run_at DESC LIMIT ?',
    [monitorId, limit]
  );
  return rows.map(r => ({
    ...r,
    details: r.details ? JSON.parse(r.details) : null,
  }));
}

module.exports = {
  pool,
  initDb,
  getUserByEmail,
  getUserByVerificationTokenHash,
  verifyUserEmail,
  deleteUser,
  getUserByIdWithRole,
  createUser,
  getUserById,
  getScanById,
  saveScan,
  getScansForUser,
  getScanForUser,
  listBlogPosts,
  getBlogPostBySlug,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
  setFindingRemediation,
  deleteScan,
  renameScan,
  createSharedReport,
  getSharedReport,
  createApiKey,
  listApiKeys,
  deleteApiKey,
  getApiKeyByPrefix,
  listAllUsers,
  setUserRole,
  getAllDueMonitors,
  updateMonitorAfterRun,
  getAllRemediationsForUser,
  getFindingRemediations,
  getFindingRemediation,
  createScanComparison,
  getScanComparisonsForUser,
  getScanComparison,
  createMonitor,
  getMonitorsForUser,
  getMonitor,
  updateMonitor,
  deleteMonitor,
  createMonitorRun,
  getMonitorRuns,
  updateUserProfile,
  updateUserPassword,
  logAudit,
  getAuditLogForUser,
  getUsersNeedingDigest,
  updateUserDigestAt,
};
