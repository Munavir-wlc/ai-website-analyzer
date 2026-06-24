const axios = require('axios');
const cheerio = require('cheerio');
const { isSafeUrl } = require('../utils/ssrfGuard');

const SWAGGER_PATHS = [
  '/swagger.json',
  '/openapi.json',
  '/v2/api-docs',
  '/api-docs',
  '/swagger-ui/index.html',
  '/swagger/index.html',
  '/api/v1/swagger.json',
  '/api/swagger.json',
  '/api/v2/swagger.json'
];

// Regex to extract API endpoints from JS source files (e.g. "/api/v1/users")
const API_PATH_REGEX = /["'](\/api\/[a-zA-Z0-9_\-\/]+)/gi;

/**
 * Probes common paths for public Swagger/OpenAPI documentation.
 * @param {string} baseUrl - Target base URL
 * @param {Object} auth - Custom cookies/headers authentication
 * @returns {Promise<Array<Object>>} List of found documentation endpoints
 */
async function probeSwaggerDocs(baseUrl, auth = {}) {
  const foundDocs = [];
  try {
    const origin = new URL(baseUrl).origin;
    if (!await isSafeUrl(origin)) return foundDocs;

    const headers = {
      'User-Agent': 'Mozilla/5.0 (compatible; AI-Website-Analyzer-Discovery/1.0)'
    };
    if (auth.authHeader) headers['Authorization'] = auth.authHeader;
    if (auth.authCookie) headers['Cookie'] = auth.authCookie;

    await Promise.all(SWAGGER_PATHS.map(async (path) => {
      try {
        const docUrl = `${origin}${path}`;
        const res = await axios.get(docUrl, {
          timeout: 4000,
          validateStatus: (status) => status === 200,
          maxRedirects: 2,
          headers
        });

        // Verify if it is JSON spec or an HTML view
        const contentType = res.headers['content-type'] || '';
        const isJson = contentType.includes('application/json') || (typeof res.data === 'object' && res.data !== null);
        const isHtml = contentType.includes('text/html') && typeof res.data === 'string' && res.data.includes('swagger');

        if (isJson || isHtml) {
          foundDocs.push({
            url: docUrl,
            type: isJson ? 'JSON Spec' : 'HTML Documentation UI',
            name: path.substring(1)
          });
        }
      } catch (_) {}
    }));
  } catch (_) {}

  return foundDocs;
}

/**
 * Fetches javascript scripts from script tags and extracts API paths.
 * @param {string} html - Crawled page HTML
 * @param {string} pageUrl - Crawled page URL
 * @param {Object} auth - Auth options
 * @returns {Promise<Array<string>>} Discovered API routes
 */
async function discoverApiRoutesFromScripts(html, pageUrl, auth = {}) {
  const discoveredRoutes = new Set();
  if (!html) return [];

  const $ = cheerio.load(html);
  const scriptUrls = [];
  const baseOrigin = new URL(pageUrl).origin;

  // Extract external script sources sharing the same origin
  $('script[src]').each((_, el) => {
    const src = $(el).attr('src');
    if (!src) return;
    try {
      const absoluteUrl = new URL(src, pageUrl).href;
      if (absoluteUrl.startsWith(baseOrigin)) {
        scriptUrls.push(absoluteUrl);
      }
    } catch (_) {}
  });

  // Limit script inspection count to prevent scanning bloat
  const limitedScripts = scriptUrls.slice(0, 5);

  const headers = { 'User-Agent': 'Mozilla/5.0 (compatible; AI-Website-Analyzer-Discovery/1.0)' };
  if (auth.authHeader) headers['Authorization'] = auth.authHeader;
  if (auth.authCookie) headers['Cookie'] = auth.authCookie;

  await Promise.all(limitedScripts.map(async (url) => {
    try {
      if (!await isSafeUrl(url)) return;
      const res = await axios.get(url, { timeout: 5000, headers });
      const jsContent = typeof res.data === 'string' ? res.data : '';

      let match;
      // Re-initialize regex since it has global flag
      const regex = new RegExp(API_PATH_REGEX);
      while ((match = regex.exec(jsContent)) !== null) {
        const route = match[1].trim().replace(/\/+$/, '');
        if (route && route !== '/api' && route.length < 100) {
          discoveredRoutes.add(route);
        }
      }
    } catch (_) {}
  }));

  return Array.from(discoveredRoutes).sort();
}

/**
 * Main discovery orchestrator.
 * @param {string} html - Main page HTML
 * @param {string} url - Target URL
 * @param {Object} auth - Session headers/cookies
 * @returns {Promise<Object>} API discovery results
 */
async function discoverApiEndpoints(html, url, auth = {}) {
  console.log(`[apiDiscovery] Starting API discovery for: ${url}`);
  const [swaggerDocs, apiRoutes] = await Promise.all([
    probeSwaggerDocs(url, auth),
    discoverApiRoutesFromScripts(html, url, auth)
  ]);

  return {
    scanned: true,
    swaggerDocs,
    apiRoutes,
    totalDiscovered: swaggerDocs.length + apiRoutes.length
  };
}

module.exports = { discoverApiEndpoints };
