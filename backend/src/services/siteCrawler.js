const axios = require('axios');
const cheerio = require('cheerio');

const MAX_PAGES = 75;
const PAGE_TIMEOUT = 8000;
const TOTAL_TIMEOUT = 120000; // 2 min
const USER_AGENT = 'Mozilla/5.0 (compatible; AI-Website-Analyzer/1.0)';

function normalizeUrl(url, baseOrigin) {
  try {
    const u = new URL(url, baseOrigin);
    u.hash = '';
    let path = u.pathname.replace(/\/+$/, '') || '/';
    u.pathname = path;
    return u.href;
  } catch {
    return null;
  }
}

function sameOrigin(href, baseOrigin) {
  try {
    const u = new URL(href, baseOrigin);
    return u.origin === baseOrigin;
  } catch {
    return false;
  }
}

function extractUrlsFromSitemap(xml) {
  const urls = [];
  const locRegex = /<loc>([^<]+)<\/loc>/gi;
  let m;
  while ((m = locRegex.exec(xml)) !== null) {
    urls.push(m[1].trim());
  }
  return urls;
}

async function fetchPage(url, authOptions = {}) {
  const { authCookie, authHeader } = authOptions;
  const requestHeaders = { 'User-Agent': USER_AGENT };
  if (authHeader) requestHeaders['Authorization'] = authHeader;
  if (authCookie) requestHeaders['Cookie'] = authCookie;

  const res = await axios({
    url,
    method: 'GET',
    timeout: PAGE_TIMEOUT,
    maxRedirects: 5,
    validateStatus: () => true,
    responseType: 'text',
    headers: requestHeaders,
  });
  return {
    url: res.request?.res?.responseUrl || res.config?.url || url,
    statusCode: res.status,
    html: typeof res.data === 'string' ? res.data : '',
    headers: res.headers,
  };
}

async function crawlSite(startUrl, authOptions = {}) {
  const start = Date.now();
  const baseOrigin = new URL(startUrl).origin;
  const visited = new Set();
  const toVisit = new Set([startUrl]);
  const pages = [];
  let robotsTxt = null;
  let sitemapXml = null;

  try {
    const [rt, sm] = await Promise.all([
      axios.get(new URL('/robots.txt', baseOrigin).href, { timeout: 5000, validateStatus: () => true }).then(r => (r.status === 200 ? r.data : null)).catch(() => null),
      axios.get(new URL('/sitemap.xml', baseOrigin).href, { timeout: 5000, validateStatus: () => true }).then(r => (r.status === 200 ? r.data : null)).catch(() => null),
    ]);
    robotsTxt = rt;
    sitemapXml = sm;

    if (sitemapXml) {
      const sitemapUrls = extractUrlsFromSitemap(sitemapXml)
        .map(u => normalizeUrl(u, baseOrigin))
        .filter(Boolean)
        .filter(u => sameOrigin(u, baseOrigin));
      sitemapUrls.slice(0, MAX_PAGES).forEach(u => toVisit.add(u));
    }

    while (toVisit.size > 0 && pages.length < MAX_PAGES && Date.now() - start < TOTAL_TIMEOUT) {
      const batch = Array.from(toVisit).slice(0, 10);
      batch.forEach(u => toVisit.delete(u));

      const results = await Promise.allSettled(
        batch.filter(u => !visited.has(u)).map(async (url) => {
          visited.add(url);
          const data = await fetchPage(url, authOptions);
          const $ = cheerio.load(data.html || '');
          const links = [];
          $('a[href]').each((_, el) => {
            const href = $(el).attr('href');
            const normalized = normalizeUrl(href, data.url);
            if (normalized && sameOrigin(normalized, baseOrigin) && !visited.has(normalized)) {
              links.push(normalized);
            }
          });
          return { ...data, $, links };
        })
      );

      for (const p of results) {
        if (p.status === 'fulfilled' && p.value) {
          pages.push(p.value);
          p.value.links.forEach(l => toVisit.add(l));
        }
      }
    }
  } catch (err) {
    console.error('Site crawl error:', err.message);
  }

  return {
    pages,
    robotsTxt,
    sitemapXml,
    baseOrigin,
    crawledCount: pages.length,
  };
}

module.exports = { crawlSite, extractUrlsFromSitemap, normalizeUrl };
