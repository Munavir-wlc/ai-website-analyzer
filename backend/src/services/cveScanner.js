const cheerio = require('cheerio');
const axios = require('axios');

const OSV_API_URL = 'https://api.osv.dev/v1/query';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// In-memory cache for OSV query responses: key -> { timestamp, data }
const memoryCache = new Map();

// Known mapping of technology names to OSV ecosystem and package name
const KNOWN_ECOSYSTEMS = {
  jquery: { ecosystem: 'npm', name: 'jquery' },
  bootstrap: { ecosystem: 'npm', name: 'bootstrap' },
  react: { ecosystem: 'npm', name: 'react' },
  'next.js': { ecosystem: 'npm', name: 'next' },
  next: { ecosystem: 'npm', name: 'next' },
  vue: { ecosystem: 'npm', name: 'vue' },
  angular: { ecosystem: 'npm', name: '@angular/core' },
  '@angular/core': { ecosystem: 'npm', name: '@angular/core' },
  lodash: { ecosystem: 'npm', name: 'lodash' },
  express: { ecosystem: 'npm', name: 'express' },
  laravel: { ecosystem: 'Packagist', name: 'laravel/framework' },
  'laravel/framework': { ecosystem: 'Packagist', name: 'laravel/framework' },
  django: { ecosystem: 'PyPI', name: 'django' },
  wordpress: { ecosystem: 'Packagist', name: 'johnpbloch/wordpress-core' },
  drupal: { ecosystem: 'Packagist', name: 'drupal/core' },
  joomla: { ecosystem: 'Packagist', name: 'joomla/cms' }
};

// Common CDN parsing patterns
const CDN_PATTERNS = [
  // JSDelivr: cdn.jsdelivr.net/npm/package@version/...
  // JSDelivr shorthand: cdn.jsdelivr.net/gh/user/repo@version/...
  /cdn\.jsdelivr\.net\/(?:npm|gh)\/([^@/]+)@([^@/]+)/i,
  
  // Cloudflare CDNJS: cdnjs.cloudflare.com/ajax/libs/package/version/...
  /cdnjs\.cloudflare\.com\/ajax\/libs\/([^/]+)\/([^/]+)/i,
  
  // Unpkg: unpkg.com/package@version/...
  /unpkg\.com\/([^@/]+)@([^@/]+)/i,

  // Bootcdn: cdn.bootcdn.net/ajax/libs/package/version/...
  /cdn\.bootcdn\.net\/ajax\/libs\/([^/]+)\/([^/]+)/i
];

/**
 * Resolves ecosystem and canonical package name for a technology
 */
function resolveEcosystem(tech) {
  if (!tech) return null;
  const rawName = (tech.packageName || tech.name || '').toLowerCase().trim();

  if (tech.ecosystem && tech.packageName) {
    return {
      ecosystem: tech.ecosystem,
      name: tech.packageName
    };
  }

  if (KNOWN_ECOSYSTEMS[rawName]) {
    return KNOWN_ECOSYSTEMS[rawName];
  }

  // Fall back to npm if explicitly indicated by ecosystem
  if (tech.ecosystem) {
    return {
      ecosystem: tech.ecosystem,
      name: tech.packageName || tech.name.toLowerCase()
    };
  }

  return null;
}

/**
 * Normalizes OSV vulnerability record into standard finding shape
 */
function normalizeOsvFinding(v, techName, version) {
  const cve = (v.aliases || []).find(alias => alias.startsWith('CVE-')) || v.id;
  
  // Severity mapping (OSV uses CVSS metrics, otherwise falls back to medium)
  let severity = 'medium';
  const cvss = v.database_specific?.cvss || {};
  if (typeof cvss.score === 'number') {
    if (cvss.score >= 9.0) severity = 'critical';
    else if (cvss.score >= 7.0) severity = 'high';
    else if (cvss.score >= 4.0) severity = 'medium';
    else severity = 'low';
  } else if (v.severity) {
    const s = Array.isArray(v.severity) ? JSON.stringify(v.severity).toLowerCase() : String(v.severity).toLowerCase();
    if (s.includes('critical')) severity = 'critical';
    else if (s.includes('high')) severity = 'high';
    else if (s.includes('medium')) severity = 'medium';
    else if (s.includes('low')) severity = 'low';
  }

  const fixVersion = (v.affected?.[0]?.ranges?.[0]?.events || [])
    .filter(e => e.introduced === '0' || e.fixed)
    .map(e => e.fixed)
    .filter(Boolean)
    .join(', ') || 'N/A';

  const references = (v.references || []).map(r => r.url).filter(Boolean);

  const cleanTechId = String(techName).toLowerCase().replace(/[^a-z0-9]/g, '-');

  return {
    id: `${cve}-${cleanTechId}`,
    technology: techName,
    version: version,
    cveId: cve,
    title: v.summary || `Vulnerability in ${techName} (${cve})`,
    description: v.details || v.summary || 'No description provided.',
    severity: severity,
    category: 'Scripts',
    remediation: `Upgrade ${techName} version to a secure release${fixVersion !== 'N/A' ? ` (fixed in: ${fixVersion})` : ''}.`,
    owasp: 'A06:2021-Vulnerable and Outdated Components',
    references: references,
    fixVersion: fixVersion
  };
}

/**
 * Queries the OSV API for a single package vulnerability with caching and error handling.
 * @param {string} name - Package name
 * @param {string} version - Package version
 * @param {string} [ecosystem='npm'] - OSV ecosystem
 * @returns {Promise<Array>} List of found vulnerability records
 */
async function checkOsvVulnerabilities(name, version, ecosystem = 'npm') {
  if (!name || !version) return [];

  const cacheKey = `${ecosystem}:${name.toLowerCase()}@${version}`;
  const now = Date.now();

  // Check in-memory cache
  if (memoryCache.has(cacheKey)) {
    const cached = memoryCache.get(cacheKey);
    if (now - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }
    memoryCache.delete(cacheKey);
  }

  try {
    const payload = {
      package: {
        name: name,
        ecosystem: ecosystem
      },
      version: version
    };

    const res = await axios.post(OSV_API_URL, payload, { timeout: 6000 });
    let findings = [];

    if (res.status === 200 && res.data && res.data.vulns) {
      findings = res.data.vulns.map(v => normalizeOsvFinding(v, name, version));
    }

    // Store in cache
    memoryCache.set(cacheKey, {
      timestamp: now,
      data: findings
    });

    return findings;
  } catch (err) {
    // Graceful failure - log warning and do not break scan flow
    console.warn(`[cveScanner] OSV query failed for ${ecosystem}:${name}@${version}:`, err.message);
    return [];
  }
}

/**
 * Matches fingerprinted technologies against the OSV vulnerability database.
 * @param {Array<Object>} fingerprints - Output array from techFingerprint.fingerprint()
 * @returns {Promise<Array<Object>>} Normalized vulnerability findings
 */
async function matchCVEs(fingerprints = []) {
  if (!Array.isArray(fingerprints) || fingerprints.length === 0) {
    return [];
  }

  const queries = [];
  const seenQueries = new Set();

  for (const fp of fingerprints) {
    if (!fp || !fp.version) continue;

    const mapped = resolveEcosystem(fp);
    if (!mapped) continue; // Skip technologies without clear ecosystem mapping

    const queryKey = `${mapped.ecosystem}:${mapped.name}@${fp.version}`;
    if (seenQueries.has(queryKey)) continue;
    seenQueries.add(queryKey);

    queries.push(
      checkOsvVulnerabilities(mapped.name, fp.version, mapped.ecosystem)
        .then(vulns => {
          // If original tech name differs from package name, preserve the friendly name
          return vulns.map(v => ({
            ...v,
            technology: fp.name || v.technology
          }));
        })
    );
  }

  if (queries.length === 0) return [];

  const results = await Promise.all(queries);
  return results.flat();
}

/**
 * Parses script tags in HTML to find external libraries and their versions.
 * @param {string} html - Page HTML content
 * @returns {Array<Object>} List of found libraries with name and version
 */
function extractCdnLibraries(html) {
  if (!html) return [];
  const $ = cheerio.load(html);
  const libraries = [];
  const seen = new Set();

  $('script[src]').each((_, el) => {
    const src = $(el).attr('src');
    if (!src) return;

    for (const pattern of CDN_PATTERNS) {
      const match = src.match(pattern);
      if (match) {
        let name = match[1].toLowerCase().trim();
        let version = match[2].trim();

        // Clean up common suffix variations (e.g. jquery.min.js)
        if (name.endsWith('.js')) name = name.substring(0, name.length - 3);

        const key = `${name}@${version}`;
        if (!seen.has(key)) {
          seen.add(key);
          libraries.push({ name, version });
        }
        break; // Stop checking other patterns once a match is found
      }
    }
  });

  return libraries;
}

/**
 * Scan all CDN libraries found in HTML for CVE vulnerabilities.
 * @param {string} html - Page HTML content
 * @returns {Promise<Array>} List of vulnerability findings
 */
async function scanCdnLibraries(html) {
  const libraries = extractCdnLibraries(html);
  if (libraries.length === 0) return [];

  const vulnerabilityPromises = libraries.map(lib => checkOsvVulnerabilities(lib.name, lib.version, 'npm'));
  const results = await Promise.all(vulnerabilityPromises);

  return results.flat();
}

/**
 * Helper to clear the in-memory cache (useful for testing)
 */
function clearCache() {
  memoryCache.clear();
}

module.exports = {
  matchCVEs,
  checkOsvVulnerabilities,
  scanCdnLibraries,
  extractCdnLibraries,
  resolveEcosystem,
  clearCache
};
