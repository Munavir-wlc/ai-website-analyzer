const express = require('express');
const router = express.Router();
const screenshotService = require('../services/screenshotService');
const { isSafeUrl } = require('../utils/ssrfGuard');
const { optionalAuth } = require('../middleware/auth');
const { checkScanQuota } = require('../middleware/quotaGuard');

/**
 * Screenshot API Route
 * POST /api/screenshot
 */

router.post('/', optionalAuth, checkScanQuota, async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Validate URL parameter
    const { url, authCookie, authHeader } = req.body;
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'url query parameter is required',
        desktop: null,
        mobile: null,
      });
    }

    // Normalize URL
    let normalizedUrl = url.trim();
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    // Validate hostname resolving target to block private IPs
    if (!await isSafeUrl(normalizedUrl)) {
      return res.status(400).json({
        success: false,
        error: 'URL blocked: Private, local, or loopback network addresses are not permitted.',
        url: normalizedUrl,
        desktop: null,
        mobile: null,
      });
    }

    // Validate URL format
    try {
      new URL(normalizedUrl);
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL format',
        url: normalizedUrl,
        desktop: null,
        mobile: null,
      });
    }

    console.log(`[Screenshot] Requesting: ${normalizedUrl}`);

    // Capture screenshots
    const { desktop, mobile } = await screenshotService.captureScreenshots(normalizedUrl, { authCookie, authHeader });

    const captureTime = Date.now() - startTime;

    // Return response
    const response = {
      success: true,
      url: normalizedUrl,
      desktop: desktop ? `data:image/jpeg;base64,${desktop}` : null,
      mobile: mobile ? `data:image/jpeg;base64,${mobile}` : null,
      timestamp: new Date().toISOString(),
      captureTime: captureTime,
    };

    console.log(`[Screenshot] Success: ${normalizedUrl} (${captureTime}ms)`);
    res.json(response);

  } catch (err) {
    const captureTime = Date.now() - startTime;

    console.error('[Screenshot] Error:', {
      message: err.message,
      stack: err.stack,
      captureTime: captureTime,
    });

    res.status(500).json({
      success: false,
      error: err.message || 'Screenshot capture failed',
      url: req.body.url || null,
      desktop: null,
      mobile: null,
      timestamp: new Date().toISOString(),
      captureTime: captureTime,
    });
  }
});

module.exports = router;