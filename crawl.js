'use strict';

/**
 * crawl.js
 * Discovers pages to scan for a given origin.
 * Priority: sitemap.xml → sitemap_index.xml → homepage link extraction → interactive discovery.
 */

const https = require('https');
const http = require('http');

async function fetchText(url, timeoutMs = 8000) {
  return new Promise(resolve => {
    const mod = url.startsWith('https') ? https : http;
    try {
      const req = mod.get(url, {
        timeout: timeoutMs,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SPIDAC-DTA/1.0)' },
      }, res => {
        if (!res.statusCode || res.statusCode >= 400) { res.resume(); resolve(null); return; }
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        res.on('error', () => resolve(null));
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
    } catch (_) { resolve(null); }
  });
}

function parseSitemapUrls(xml, origin) {
  const urls = [];
  for (const m of xml.matchAll(/<loc>\s*(https?:\/\/[^\s<]+)\s*<\/loc>/gi)) {
    try {
      const u = new URL(m[1].trim());
      if (/\.(pdf|jpg|jpeg|png|gif|svg|ico|css|js|woff2?|zip|xml)(\?|$)/i.test(u.pathname)) continue;
      if (u.origin === origin) urls.push(u.href);
    } catch (_) { }
  }
  return urls;
}

function patternToRegExp(pattern) {
  const escaped = String(pattern || '').trim().replace(/[.+^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped.replace(/\*/g, '.*')}$`, 'i');
}

function createUrlScope(baseUrl, includePatterns = [], excludePatterns = [], subdomainPolicy = 'same-domain') {
  const base = new URL(baseUrl);
  const origin = base.origin;
  const baseDomain = base.hostname.replace(/^www\./, '');
  const includes = includePatterns.map(patternToRegExp);
  const excludes = excludePatterns.map(patternToRegExp);
  return url => {
    let parsed;
    try { parsed = new URL(url); } catch (_) { return false; }
    if (/\.(pdf|jpg|jpeg|png|gif|svg|ico|css|js|woff2?|zip|xml)(\?|$)/i.test(parsed.pathname)) return false;
    if (subdomainPolicy === 'subdomains') {
      const targetDomain = parsed.hostname.replace(/^www\./, '');
      if (!targetDomain.endsWith(baseDomain) || targetDomain === baseDomain) return false;
    } else {
      if (parsed.origin !== origin) return false;
    }
    const target = `${parsed.pathname}${parsed.search}`;
    if (excludes.some(pattern => pattern.test(target) || pattern.test(parsed.href))) return false;
    return !includes.length || includes.some(pattern => pattern.test(target) || pattern.test(parsed.href));
  };
}

function extractLinks(page, origin) {
  return page.evaluate(origin => {
    return [...document.querySelectorAll('a[href]')]
      .map(a => { try { return new URL(a.href, location.href).href; } catch (_) { return null; } })
      .filter(href => href && href.startsWith(origin))
      .filter(href => !/[?#]/.test(href.replace(origin, '')) || href === origin + '/')
      .filter(href => !/\.(pdf|jpg|jpeg|png|gif|svg|ico|css|js|woff2?|zip)(\?|$)/i.test(href));
  }, origin).catch(() => []);
}

async function interactiveCrawl(page, origin, inScope, found, maxPages) {
  const interactionLimit = Math.min(maxPages * 2, 20);
  let interactions = 0;

  async function scrollPage() {
    if (interactions >= interactionLimit) return;
    interactions++;
    await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight);
    });
    await page.waitForTimeout(800);
    await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight);
    });
    await page.waitForTimeout(800);
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(400);
  }

  async function clickNavElements() {
    if (interactions >= interactionLimit) return;
    const selectors = [
      'nav [aria-expanded="false"]',
      '.menu-toggle',
      '.nav-toggle',
      '[data-toggle="menu"]',
      '.accordion-toggle',
      '.expand-button',
      '[aria-controls]',
    ];
    const clicked = await page.evaluate(selectors => {
      const clicked = [];
      for (const sel of selectors) {
        const els = document.querySelectorAll(sel);
        for (const el of els) {
          if (clicked.length >= 3) break;
          try {
            el.click();
            clicked.push(sel);
          } catch (_) { }
        }
        if (clicked.length >= 3) break;
      }
      return clicked;
    }, selectors).catch(() => []);
    if (clicked.length) {
      interactions += clicked.length;
      await page.waitForTimeout(600);
    }
  }

  async function clickEmbeds() {
    if (interactions >= interactionLimit) return;
    const selectors = [
      'iframe[src*="youtube"]',
      'iframe[src*="vimeo"]',
      'iframe[src*="google"]',
      '[data-embed]',
      '.video-play',
      '.chat-widget',
      '[aria-label*="chat"]',
      '[aria-label*="support"]',
    ];
    const clicked = await page.evaluate(selectors => {
      const clicked = [];
      for (const sel of selectors) {
        const els = document.querySelectorAll(sel);
        for (const el of els) {
          if (clicked.length >= 2) break;
          try {
            el.click();
            clicked.push(sel);
          } catch (_) { }
        }
        if (clicked.length >= 2) break;
      }
      return clicked;
    }, selectors).catch(() => []);
    if (clicked.length) {
      interactions += clicked.length;
      await page.waitForTimeout(600);
    }
  }

  await scrollPage();
  const scrolledLinks = await extractLinks(page, origin);
  for (const link of scrolledLinks.filter(inScope)) found.add(link);

  await clickNavElements();
  const navLinks = await extractLinks(page, origin);
  for (const link of navLinks.filter(inScope)) found.add(link);

  await clickEmbeds();
  const embedLinks = await extractLinks(page, origin);
  for (const link of embedLinks.filter(inScope)) found.add(link);
}

/**
 * Discover pages to scan.
 *
 * @param {string} baseUrl   - Homepage URL
 * @param {{ maxPages?: number, browser?: import('playwright').Browser, crawlMode?: string, includePatterns?: string[], excludePatterns?: string[], subdomainPolicy?: string, interactive?: boolean }} opts
 * @returns {Promise<string[]>}  - Ordered list of URLs (homepage first), deduped
 */
async function crawlPages(baseUrl, { maxPages = 5, browser, crawlMode = 'linked-pages', includePatterns = [], excludePatterns = [], subdomainPolicy = 'same-domain', interactive = false } = {}) {
  const origin = new URL(baseUrl).origin;
  const inScope = createUrlScope(baseUrl, includePatterns, excludePatterns, subdomainPolicy);
  const found = new Set();
  if (crawlMode === 'homepage') return [baseUrl];
  if (inScope(baseUrl) || (!includePatterns.length && !excludePatterns.length)) found.add(baseUrl);

  // ── 1. sitemap.xml ──────────────────────────────────────────────────────────
  const sitemapXml = await fetchText(`${origin}/sitemap.xml`);
  if (sitemapXml) {
    const indexLocs = [...sitemapXml.matchAll(/<sitemap>[\s\S]*?<loc>\s*(https?:\/\/[^\s<]+)\s*<\/loc>/gi)]
      .map(m => m[1].trim())
      .slice(0, 4);

    if (indexLocs.length > 0) {
      for (const loc of indexLocs) {
        if (found.size >= maxPages * 3) break;
        const childXml = await fetchText(loc);
        if (childXml) parseSitemapUrls(childXml, origin).filter(inScope).forEach(u => found.add(u));
      }
    } else {
      parseSitemapUrls(sitemapXml, origin).filter(inScope).forEach(u => found.add(u));
    }
  }

  // ── 2. Homepage link extraction (Playwright) ────────────────────────────────
  if (crawlMode !== 'sitemap' && found.size < maxPages && browser) {
    try {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.goto(baseUrl, { waitUntil: 'load', timeout: 30000 }).catch(() => { });
      const links = await extractLinks(page, origin);
      for (const link of links.filter(inScope)) found.add(link);

      if (interactive && crawlMode === 'deep') {
        await interactiveCrawl(page, origin, inScope, found, maxPages);
      }

      await ctx.close();
    } catch (_) { }
  }

  // Return unique same-origin URLs, homepage first, up to maxPages
  const all = [baseUrl, ...[...found].filter(u => u !== baseUrl && inScope(u))];

  // Prefer diversity: pick pages that look like different sections
  const scored = all.slice(1).map(u => {
    const depth = (new URL(u).pathname.match(/\//g) || []).length;
    const score = depth <= 2 ? 1 : 0;
    return { u, score };
  }).sort((a, b) => b.score - a.score).map(x => x.u);

  return [baseUrl, ...scored].slice(0, maxPages);
}

module.exports = { crawlPages, createUrlScope, patternToRegExp, interactiveCrawl };
