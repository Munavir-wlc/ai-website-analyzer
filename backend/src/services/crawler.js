const axios = require('axios');
const cheerio = require('cheerio');
const { launchBrowser } = require('../utils/browserLaunch');

const CRAWL_TIMEOUT = 30000; // 30 seconds

/**
 * Fetch a URL using headless Puppeteer browser as a fallback
 */
async function crawlWithBrowser(url) {
  let browser;
  try {
    console.log(`[crawler] Launching browser fallback for: ${url}`);
    browser = await launchBrowser({ headless: 'new' });
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(20000);
    page.setDefaultTimeout(20000);

    // Capture headers and status code of the main request
    let responseHeaders = {};
    let statusCode = 200;
    
    page.on('response', (res) => {
      const resUrl = res.url();
      // Compare URLs ignoring trailing slash
      if (resUrl.replace(/\/$/, '') === url.replace(/\/$/, '')) {
        responseHeaders = res.headers();
        statusCode = res.status();
      }
    });

    await page.goto(url, { waitUntil: 'networkidle2' });
    
    const html = await page.content();
    const finalUrl = page.url();
    
    return {
      html,
      url: finalUrl,
      finalUrl,
      statusCode,
      headers: responseHeaders,
    };
  } catch (err) {
    console.error(`[crawler] Browser fallback crawl failed: ${err.message}`);
    throw err;
  } finally {
    if (browser) await browser.close();
  }
}

/**
 * Fetch a URL and return HTML, headers, and redirect info
 */
async function crawl(url) {
  const normalizedUrl = normalizeUrl(url);
  let response;
  let useBrowserFallback = false;

  try {
    response = await axios({
      url: normalizedUrl,
      method: 'GET',
      timeout: CRAWL_TIMEOUT,
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 400, // Reject 4xx/5xx to trigger browser fallback
      responseType: 'text',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AI-Website-Analyzer/1.0)'
      }
    });
  } catch (err) {
    console.warn(`[crawler] Axios fetch failed: ${err.message}. Attempting browser fallback...`);
    useBrowserFallback = true;
  }

  let crawlResult;

  if (useBrowserFallback) {
    try {
      const browserResult = await crawlWithBrowser(normalizedUrl);
      crawlResult = {
        html: browserResult.html,
        url: browserResult.url,
        finalUrl: browserResult.finalUrl,
        statusCode: browserResult.statusCode,
        headers: browserResult.headers,
        redirectChain: [normalizedUrl]
      };
    } catch (fallbackErr) {
      console.error(`[crawler] All crawl attempts failed for: ${normalizedUrl}`);
      return null;
    }
  } else {
    const finalUrl = response.request?.res?.responseUrl || response.config?.url || normalizedUrl;
    crawlResult = {
      html: typeof response.data === 'string' ? response.data : '',
      url: finalUrl,
      finalUrl,
      statusCode: response.status,
      headers: response.headers,
      redirectChain: response.request?.path ? [normalizedUrl] : [normalizedUrl]
    };
  }

  const baseUrl = new URL(crawlResult.finalUrl).origin;
  const [robotsTxt, sitemapXml] = await Promise.all([
    fetchRobotsTxt(baseUrl),
    fetchSitemap(baseUrl)
  ]);

  const $ = cheerio.load(crawlResult.html);

  return {
    ...crawlResult,
    $,
    robotsTxt,
    sitemapXml
  };
}

/**
 * Fetch robots.txt from base URL
 */
async function fetchRobotsTxt(baseUrl) {
  try {
    const url = new URL('/robots.txt', baseUrl).href;
    const response = await axios({
      url,
      method: 'GET',
      timeout: 5000,
      validateStatus: (s) => s < 500,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AI-Website-Analyzer/1.0)' }
    });
    return response.status === 200 ? response.data : null;
  } catch {
    return null;
  }
}

/**
 * Fetch sitemap.xml from base URL
 */
async function fetchSitemap(baseUrl) {
  try {
    const url = new URL('/sitemap.xml', baseUrl).href;
    const response = await axios({
      url,
      method: 'GET',
      timeout: 5000,
      validateStatus: (s) => s < 500,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AI-Website-Analyzer/1.0)' }
    });
    return response.status === 200 ? response.data : null;
  } catch {
    return null;
  }
}

/**
 * Normalize URL - ensure protocol
 */
function normalizeUrl(url) {
  let u = url.trim();
  if (!/^https?:\/\//i.test(u)) {
    u = 'https://' + u;
  }
  return u;
}

module.exports = {
  crawl,
  fetchRobotsTxt,
  fetchSitemap,
  normalizeUrl
};
