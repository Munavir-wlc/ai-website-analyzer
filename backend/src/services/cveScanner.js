const cheerio = require('cheerio');
const axios = require('axios');

const OSV_API_URL = 'https://api.osv.dev/v1/query';

// Common CDN parsing patterns
// Extracts: package name and version
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
 * Queries the OSV API for a single package vulnerability.
 * @param {string} name - Package name
 * @param {string} version - Package version
 * @returns {Promise<Array>} List of found vulnerability records
 */
async function checkOsvVulnerabilities(name, version) {
  try {
    const payload = {
      package: {
        name: name,
        ecosystem: 'npm' // Most CDN assets are npm modules
      },
      version: version
    };

    const res = await axios.post(OSV_API_URL, payload, { timeout: 6000 });
    if (res.status === 200 && res.data && res.data.vulns) {
      return res.data.vulns.map(v => {
        // Look for CVE identifier in aliases
        const cve = (v.aliases || []).find(alias => alias.startsWith('CVE-')) || v.id;
        
        // Severity mapping (OSV uses CVSS metrics, otherwise falls back to medium)
        let severity = 'medium';
        const cvss = v.database_specific?.cvss || {};
        if (cvss.score) {
          if (cvss.score >= 9.0) severity = 'critical';
          else if (cvss.score >= 7.0) severity = 'high';
          else if (cvss.score >= 4.0) severity = 'medium';
          else severity = 'low';
        } else if (v.severity) {
          const s = v.severity.toLowerCase();
          if (s.includes('critical')) severity = 'critical';
          else if (s.includes('high')) severity = 'high';
          else if (s.includes('medium')) severity = 'medium';
          else if (s.includes('low')) severity = 'low';
        }

        return {
          id: `${cve}-${name}`,
          cveId: cve,
          title: v.summary || `Vulnerability in ${name}`,
          description: v.details || 'No description provided.',
          severity: severity,
          category: 'Scripts',
          remediation: `Upgrade ${name} version to a secure release.`,
          owasp: 'A06:2021-Vulnerable and Outdated Components',
          packageName: name,
          version: version,
          fixedIn: (v.affected?.[0]?.ranges?.[0]?.events || [])
            .filter(e => e.introduced === '0' || e.fixed)
            .map(e => e.fixed)
            .filter(Boolean)
            .join(', ') || 'N/A'
        };
      });
    }
  } catch (err) {
    // Silently log and ignore OSV failures to allow scan flow fallback
    console.warn(`[cveScanner] OSV query failed for ${name}@${version}:`, err.message);
  }
  return [];
}

/**
 * Scan all CDN libraries found in HTML for CVE vulnerabilities.
 * @param {string} html - Page HTML content
 * @returns {Promise<Array>} List of vulnerability findings
 */
async function scanCdnLibraries(html) {
  const libraries = extractCdnLibraries(html);
  if (libraries.length === 0) return [];

  console.log(`[cveScanner] Found ${libraries.length} CDN libraries:`, libraries.map(l => `${l.name}@${l.version}`).join(', '));

  const vulnerabilityPromises = libraries.map(lib => checkOsvVulnerabilities(lib.name, lib.version));
  const results = await Promise.all(vulnerabilityPromises);

  // Flatten the array of arrays
  return results.flat();
}

module.exports = { scanCdnLibraries, extractCdnLibraries };
