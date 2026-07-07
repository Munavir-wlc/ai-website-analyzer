/**
 * Shared browser launch config for Puppeteer
 * Reuses Apple Silicon executablePath logic across screenshot and Lighthouse
 */
const fs = require('fs');

const MAC_BROWSER_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
];

function getExecutablePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    const p = process.env.PUPPETEER_EXECUTABLE_PATH;
    try {
      if (fs.existsSync(p)) return p;
    } catch (_) {}
  }
  if (process.platform === 'darwin') {
    for (const p of MAC_BROWSER_PATHS) {
      try {
        if (fs.existsSync(p)) return p;
      } catch (_) {}
    }
  }
  return undefined;
}

const DEFAULT_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--disable-extensions',
];

/**
 * Launch Puppeteer browser with shared config.
 * @returns {Promise<import('puppeteer').Browser>}
 */
async function launchBrowser(options = {}) {
  let puppeteer;
  try {
    const puppeteerModule = await import('puppeteer');
    puppeteer = puppeteerModule.default || puppeteerModule;
  } catch (e) {
    throw new Error(`Puppeteer import failed: ${e.message}. Try reinstalling or running under Node v22.`);
  }

  const executablePath = getExecutablePath();
  const launchOpts = {
    headless: options.headless ?? 'new',
    ignoreHTTPSErrors: options.ignoreHTTPSErrors ?? true,
    args: options.args ?? [...DEFAULT_ARGS],
  };
  if (executablePath) launchOpts.executablePath = executablePath;

  return puppeteer.launch(launchOpts);
}

module.exports = { launchBrowser, getExecutablePath };
