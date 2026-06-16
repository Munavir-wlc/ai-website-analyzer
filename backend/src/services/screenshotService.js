/**
 * Enhanced Screenshot Service using Puppeteer
 * 
 * Improvements:
 * - Waits for networkidle2 (better than domcontentloaded)
 * - Injects page load detection script
 * - Waits for CSS/images to fully load
 * - Handles dynamic content and lazy-loaded images
 * - Configurable timeouts per stage
 * - Better error handling and logging
 */

const { launchBrowser } = require('../utils/browserLaunch');

// Timeout configurations (in milliseconds)
const TIMEOUTS = {
  NAVIGATION: 20000,    // Initial page load
  NETWORK_IDLE: 5000,   // Wait for network to settle
  RESOURCES: 3000,      // Wait for images/fonts
  RENDER: 1000,         // Final render buffer
};

const DESKTOP_VIEWPORT = { width: 1024, height: 640 };
const MOBILE_VIEWPORT = { width: 375, height: 667 };

/**
 * Script injected into page to detect full load completion
 * Monitors: images, fonts, stylesheets, animations, and custom load events
 */
const PAGE_LOAD_SCRIPT = `
  (async () => {
    // Flag to track if page is fully loaded
    window.__pageFullyLoaded = false;
    
    // Wait for document ready
    if (document.readyState === 'loading') {
      await new Promise(r => document.addEventListener('DOMContentLoaded', r, { once: true }));
    }
    
    // Wait for all images to load
    const imagePromises = Array.from(document.querySelectorAll('img')).map(img => {
      return new Promise(resolve => {
        if (img.complete) {
          resolve();
        } else {
          img.addEventListener('load', resolve, { once: true });
          img.addEventListener('error', resolve, { once: true });
        }
      });
    });
    
    // Wait for stylesheets to load
    const stylePromises = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(link => {
      return new Promise(resolve => {
        if (link.sheet) {
          resolve();
        } else {
          link.addEventListener('load', resolve, { once: true });
          link.addEventListener('error', resolve, { once: true });
        }
      });
    });
    
    // Wait for fonts (if using @font-face)
    let fontPromise = Promise.resolve();
    if (document.fonts) {
      fontPromise = document.fonts.ready.catch(() => {});
    }
    
    // Wait for all promises with timeout
    await Promise.race([
      Promise.all([...imagePromises, ...stylePromises, fontPromise]),
      new Promise(r => setTimeout(r, 5000)), // 5s fallback timeout
    ]);
    
    // Additional buffer for animations and rendering
    await new Promise(r => setTimeout(r, 500));
    
    window.__pageFullyLoaded = true;
  })();
`;

/**
 * Wait for page to be fully loaded
 * Polls the injected flag with timeout
 */
async function waitForPageFullyLoaded(page, timeoutMs = 8000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      const isLoaded = await page.evaluate(() => window.__pageFullyLoaded);
      if (isLoaded) {
        console.log('✓ Page fully loaded');
        return true;
      }
    } catch (err) {
      // Script might not be ready yet, continue polling
    }
    
    await new Promise(r => setTimeout(r, 100));
  }
  
  console.warn('⚠ Page load timeout - proceeding with screenshot');
  return false;
}

/**
 * Remove loading indicators and spinners before screenshot
 * Helps with cleaner, more professional screenshots
 */
async function hideLoadingIndicators(page) {
  try {
    await page.evaluate(() => {
      // Common loading spinner/skeleton selectors
      const selectors = [
        '[class*="loading"]',
        '[class*="spinner"]',
        '[class*="skeleton"]',
        '[data-testid*="loading"]',
        '.loader',
        '.shimmer',
        '.pulse',
      ];
      
      selectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
          if (el && el.style) {
            el.style.display = 'none';
          }
        });
      });
    });
  } catch (err) {
    // Silently fail if selectors don't exist
  }
}

/**
 * Scroll page to ensure all lazy-loaded content is loaded
 */
async function scrollToLoadLazyContent(page) {
  try {
    await page.evaluate(() => {
      return new Promise(resolve => {
        let scrolls = 0;
        const maxScrolls = 5;
        
        const scroll = () => {
          window.scrollBy(0, window.innerHeight);
          scrolls++;
          
          if (scrolls >= maxScrolls) {
            window.scrollTo(0, 0); // Scroll back to top
            resolve();
          } else {
            setTimeout(scroll, 200);
          }
        };
        
        setTimeout(scroll, 100);
      });
    });
  } catch (err) {
    console.warn('Lazy load scroll failed:', err.message);
  }
}

/**
 * Main screenshot capture function
 */
async function captureScreenshots(url) {
  let browser;
  
  try {
    console.log(`📸 Capturing screenshots for: ${url}`);
    browser = await launchBrowser();

    const results = { desktop: null, mobile: null };
    const screenshotOpts = { 
      type: 'jpeg', 
      encoding: 'base64', 
      quality: 90,
    };

    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(TIMEOUTS.NAVIGATION);
    page.setDefaultTimeout(TIMEOUTS.NAVIGATION);

    try {
      // === DESKTOP CAPTURE ===
      console.log('📱 Capturing desktop view...');
      await page.setViewport(DESKTOP_VIEWPORT);
      
      // Inject load detection script before navigation
      await page.evaluateOnNewDocument(PAGE_LOAD_SCRIPT);
      
      // Navigate with networkidle2
      try {
        await page.goto(url, { 
          waitUntil: 'networkidle2', 
          timeout: TIMEOUTS.NAVIGATION 
        });
      } catch (err) {
        if (!err.message.includes('ERR_INTERNET_DISCONNECTED')) {
          console.warn('Navigation warning:', err.message);
        }
      }
      
      // Wait for our custom load detection
      await waitForPageFullyLoaded(page, TIMEOUTS.RESOURCES);
      
      // Scroll to trigger lazy loading
      await scrollToLoadLazyContent(page);
      
      // Scroll back to top
      await page.evaluate(() => window.scrollTo(0, 0));
      
      // Hide any loading spinners
      await hideLoadingIndicators(page);
      
      // Final render buffer
      await new Promise(r => setTimeout(r, TIMEOUTS.RENDER));
      
      results.desktop = await page.screenshot(screenshotOpts);
      console.log('✓ Desktop screenshot captured');

      // === MOBILE CAPTURE ===
      console.log('📱 Capturing mobile view...');
      await page.setViewport(MOBILE_VIEWPORT);
      
      // Re-inject script and wait for mobile view to render
      await page.evaluateOnNewDocument(PAGE_LOAD_SCRIPT);
      
      // Small delay for mobile viewport reflow
      await new Promise(r => setTimeout(r, 800));
      
      // Scroll to load lazy content on mobile
      await scrollToLoadLazyContent(page);
      
      // Scroll back to top
      await page.evaluate(() => window.scrollTo(0, 0));
      
      // Hide loading indicators
      await hideLoadingIndicators(page);
      
      // Final render buffer
      await new Promise(r => setTimeout(r, TIMEOUTS.RENDER));
      
      results.mobile = await page.screenshot(screenshotOpts);
      console.log('✓ Mobile screenshot captured');

    } finally {
      await page.close();
    }

    console.log('✓ Screenshots completed successfully');
    return results;

  } catch (err) {
    console.error('❌ Screenshot error:', err.message);
    throw new Error(`Screenshot capture failed: ${err.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { captureScreenshots };