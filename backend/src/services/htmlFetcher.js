/**
 * HTML Fetcher - Uses Puppeteer to fetch fully rendered HTML
 * Ensures title, meta description, and other SEO tags are extracted correctly
 * for JavaScript-rendered sites (React, Next.js, Vue, etc.)
 */
const { launchBrowser } = require('../utils/browserLaunch');

const NAVIGATION_TIMEOUT = 25000;
const CONTENT_WAIT_TIMEOUT = 12000;
const POST_LOAD_DELAY_MS = 2000;
const POST_SCROLL_DELAY_MS = 500;

const CONTENT_SELECTOR = 'h1, h2, h3, main, [role="main"], meta[name="description"], meta[property="og:description"]';

/**
 * Fetch page HTML after JavaScript has rendered
 * Waits for headings/content, delays for React paint, scrolls for lazy-loaded sections
 * @param {string} url - Full URL to fetch
 * @returns {Promise<string|null>} Rendered HTML or null on failure
 */
async function fetchRenderedHtml(url) {
  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();

    page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT);
    page.setDefaultTimeout(NAVIGATION_TIMEOUT);

    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (compatible; AI-Website-Analyzer/1.0)');

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: NAVIGATION_TIMEOUT,
    });

    try {
      await page.waitForSelector(CONTENT_SELECTOR, { timeout: CONTENT_WAIT_TIMEOUT });
    } catch {
      console.warn('[htmlFetcher] Content selector not found within timeout, proceeding with current HTML');
    }

    await new Promise((r) => setTimeout(r, POST_LOAD_DELAY_MS));

    await page.evaluate(async () => {
      await new Promise((r) => {
        window.scrollTo(0, document.body.scrollHeight);
        setTimeout(r, 400);
      });
      window.scrollTo(0, 0);
    });
    await new Promise((r) => setTimeout(r, POST_SCROLL_DELAY_MS));

    const html = await page.content();
    await page.close();
    return html;
  } catch (err) {
    console.warn('[htmlFetcher] Puppeteer fetch failed, will use raw HTML:', err.message);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { fetchRenderedHtml };
