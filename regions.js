'use strict';

/**
 * regions.js
 *
 * Supported scan regions.
 * Each entry sets the Playwright browser context's locale, timezone, geolocation,
 * and Accept-Language header so the site receives region-appropriate signals.
 *
 * NOTE: This does NOT change the machine's IP address.
 * Sites that geo-fence by IP (e.g. CCPA banners that only show for California IPs)
 * will not be triggered. For IP-accurate testing, use a VPN or proxy.
 */

const REGIONS = {
  'uk': {
    label: 'United Kingdom',
    flag: '🇬🇧',
    framework: 'UK GDPR / PECR',
    locale: 'en-GB',
    timezoneId: 'Europe/London',
    geolocation: { latitude: 51.5074, longitude: -0.1278 },
    acceptLanguage: 'en-GB,en;q=0.9',
  },
  'eu-de': {
    label: 'European Union — Germany',
    flag: '🇩🇪',
    framework: 'GDPR (EU)',
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    geolocation: { latitude: 52.52, longitude: 13.405 },
    acceptLanguage: 'de-DE,de;q=0.9,en;q=0.8',
  },
  'eu-fr': {
    label: 'European Union — France',
    flag: '🇫🇷',
    framework: 'GDPR (EU)',
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    geolocation: { latitude: 48.8566, longitude: 2.3522 },
    acceptLanguage: 'fr-FR,fr;q=0.9,en;q=0.8',
  },
  'eu-es': {
    label: 'European Union — Spain',
    flag: '🇪🇸',
    framework: 'GDPR (EU)',
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    geolocation: { latitude: 40.4168, longitude: -3.7038 },
    acceptLanguage: 'es-ES,es;q=0.9,en;q=0.8',
  },
  'us': {
    label: 'United States',
    flag: '🇺🇸',
    framework: 'FTC Act / State laws',
    locale: 'en-US',
    timezoneId: 'America/New_York',
    geolocation: { latitude: 40.7128, longitude: -74.006 },
    acceptLanguage: 'en-US,en;q=0.9',
  },
  'us-ca': {
    label: 'California (CCPA / CPRA)',
    flag: '🇺🇸',
    framework: 'CCPA / CPRA',
    locale: 'en-US',
    timezoneId: 'America/Los_Angeles',
    geolocation: { latitude: 34.0522, longitude: -118.2437 },
    acceptLanguage: 'en-US,en;q=0.9',
  },
  'ca': {
    label: 'Canada',
    flag: '🇨🇦',
    framework: 'PIPEDA / Quebec Law 25',
    locale: 'en-CA',
    timezoneId: 'America/Toronto',
    geolocation: { latitude: 43.6532, longitude: -79.3832 },
    acceptLanguage: 'en-CA,en;q=0.9,fr-CA;q=0.8',
  },
  'au': {
    label: 'Australia',
    flag: '🇦🇺',
    framework: 'Privacy Act 1988 / APP',
    locale: 'en-AU',
    timezoneId: 'Australia/Sydney',
    geolocation: { latitude: -33.8688, longitude: 151.2093 },
    acceptLanguage: 'en-AU,en;q=0.9',
  },
  'br': {
    label: 'Brazil',
    flag: '🇧🇷',
    framework: 'LGPD',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    geolocation: { latitude: -23.5505, longitude: -46.6333 },
    acceptLanguage: 'pt-BR,pt;q=0.9,en;q=0.8',
  },
  'in': {
    label: 'India',
    flag: '🇮🇳',
    framework: 'DPDP Act 2023',
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    geolocation: { latitude: 28.6139, longitude: 77.209 },
    acceptLanguage: 'en-IN,en;q=0.9,hi;q=0.8',
  },
  'za': {
    label: 'South Africa',
    flag: '🇿🇦',
    framework: 'POPIA',
    locale: 'en-ZA',
    timezoneId: 'Africa/Johannesburg',
    geolocation: { latitude: -26.2041, longitude: 28.0473 },
    acceptLanguage: 'en-ZA,en;q=0.9',
  },
  'jp': {
    label: 'Japan',
    flag: '🇯🇵',
    framework: 'APPI',
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    geolocation: { latitude: 35.6762, longitude: 139.6503 },
    acceptLanguage: 'ja-JP,ja;q=0.9,en;q=0.8',
  },
};

/**
 * Build Playwright newContext() options from a region object (or null).
 * Pass the result as spread/merge into newContext({ ...buildContextOpts(region) }).
 *
 * @param {object|null} regionData  — a REGIONS entry or null
 * @returns {object}                — Playwright BrowserContextOptions fragment
 */
function buildContextOpts(regionData) {
  if (!regionData) return {};
  const opts = {};
  if (regionData.locale) opts.locale = regionData.locale;
  if (regionData.timezoneId) opts.timezoneId = regionData.timezoneId;
  if (regionData.geolocation) {
    opts.geolocation = regionData.geolocation;
    opts.permissions = ['geolocation'];
  }
  if (regionData.acceptLanguage || regionData.globalPrivacyControl) {
    opts.extraHTTPHeaders = {};
    if (regionData.acceptLanguage) opts.extraHTTPHeaders['Accept-Language'] = regionData.acceptLanguage;
    if (regionData.globalPrivacyControl) opts.extraHTTPHeaders['Sec-GPC'] = '1';
  }
  return opts;
}

module.exports = { REGIONS, buildContextOpts };
