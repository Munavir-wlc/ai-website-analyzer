const axios = require('axios');
const { isSafeUrl } = require('../utils/ssrfGuard');

/**
 * Perform a controlled, safe concurrency and rate-limiting audit on the target URL.
 * Sends 20 requests with a concurrency cap of 5.
 * 
 * @param {string} targetUrl - URL of the site to scan
 * @param {Object} authOptions - Optional headers/cookies auth
 * @returns {Promise<Object>} Object containing load testing stats and resilience assessment
 */
async function auditLoadResilience(targetUrl, authOptions = {}) {
  const result = {
    scanned: false,
    targetUrl,
    totalRequests: 20,
    successfulRequests: 0,
    failedRequests: 0,
    avgResponseTimeMs: 0,
    minResponseTimeMs: 0,
    maxResponseTimeMs: 0,
    requestsPerSecond: 0,
    statusCodes: {},
    rateLimitDetected: false,
    rateLimitHeadersFound: [],
    verdict: ''
  };

  try {
    const origin = new URL(targetUrl).origin;
    if (!await isSafeUrl(origin)) {
      result.verdict = 'SSRF Block: Load test was skipped as the target resolves to a private or restricted network address.';
      return result;
    }

    const { authCookie, authHeader } = authOptions;
    const requestHeaders = {
      'User-Agent': 'Mozilla/5.0 (compatible; AI-Website-Analyzer-LoadTester/1.0)'
    };
    if (authHeader) requestHeaders['Authorization'] = authHeader;
    if (authCookie) requestHeaders['Cookie'] = authCookie;

    const totalRequests = 20;
    const concurrency = 5;
    let requestIndex = 0;
    const requestResults = [];

    const startTime = Date.now();

    // Worker function for concurrent execution loop
    async function worker() {
      while (requestIndex < totalRequests) {
        const currentIdx = requestIndex++;
        const reqStart = Date.now();
        try {
          const response = await axios({
            url: targetUrl,
            method: 'GET',
            headers: requestHeaders,
            timeout: 6000,
            validateStatus: () => true, // resolve promise for any status code
            maxRedirects: 0 // Do not follow redirects to measure raw target landing performance
          });
          const reqDuration = Date.now() - reqStart;
          requestResults[currentIdx] = {
            success: true,
            status: response.status,
            headers: response.headers,
            duration: reqDuration
          };
        } catch (err) {
          const reqDuration = Date.now() - reqStart;
          requestResults[currentIdx] = {
            success: false,
            error: err.message,
            duration: reqDuration
          };
        }
      }
    }

    // Spawn concurrent workers
    const workers = Array.from({ length: concurrency }, () => worker());
    await Promise.all(workers);

    const totalDurationMs = Date.now() - startTime;
    result.scanned = true;

    // Process results
    let validResponseTimes = [];
    const statusCodesMap = {};
    let rateLimitDetected = false;
    const rateLimitHeadersSet = new Set();

    const rateLimitHeaderNames = [
      'x-ratelimit-limit',
      'x-ratelimit-remaining',
      'x-ratelimit-reset',
      'retry-after',
      'x-rate-limit-limit',
      'x-rate-limit-remaining',
      'x-rate-limit-reset'
    ];

    for (const reqRes of requestResults) {
      if (!reqRes) continue;

      if (reqRes.success) {
        result.successfulRequests++;
        validResponseTimes.push(reqRes.duration);

        // Status code counting
        const status = reqRes.status.toString();
        statusCodesMap[status] = (statusCodesMap[status] || 0) + 1;

        if (reqRes.status === 429) {
          rateLimitDetected = true;
        }

        // Check for rate-limiting headers
        if (reqRes.headers) {
          for (const headerName of rateLimitHeaderNames) {
            if (reqRes.headers[headerName] !== undefined) {
              rateLimitHeadersSet.add(headerName);
              rateLimitDetected = true;
            }
          }
        }
      } else {
        result.failedRequests++;
        validResponseTimes.push(reqRes.duration);
        
        const errKey = reqRes.error?.includes('timeout') ? 'Timeout' : 'Network Error';
        statusCodesMap[errKey] = (statusCodesMap[errKey] || 0) + 1;
      }
    }

    // Calculations
    result.statusCodes = statusCodesMap;
    result.rateLimitDetected = rateLimitDetected;
    result.rateLimitHeadersFound = Array.from(rateLimitHeadersSet);
    
    if (validResponseTimes.length > 0) {
      const sum = validResponseTimes.reduce((a, b) => a + b, 0);
      result.avgResponseTimeMs = Math.round(sum / validResponseTimes.length);
      result.minResponseTimeMs = Math.min(...validResponseTimes);
      result.maxResponseTimeMs = Math.max(...validResponseTimes);
    }

    result.requestsPerSecond = parseFloat(((result.totalRequests / totalDurationMs) * 1000).toFixed(1));

    // Formulate VAPT Load Resilience Verdict
    if (result.failedRequests === result.totalRequests) {
      result.verdict = 'CRITICAL: The target URL failed to respond to all test requests. The server might have blocked the scanning client, or is susceptible to immediate connection exhaustion.';
    } else if (rateLimitDetected) {
      const headerList = result.rateLimitHeadersFound.length > 0 
        ? ` (${result.rateLimitHeadersFound.join(', ')})` 
        : '';
      result.verdict = `SECURE: Rate limiting controls are active on the target! The server successfully triggered protection or sent rate-limit headers${headerList} when receiving multiple concurrent requests. This prevents brute-force and scraping abuse.`;
    } else if (result.avgResponseTimeMs > 3000) {
      result.verdict = 'WARNING: The target server responds slowly under light concurrent request load. Response times averaged above 3 seconds, which indicates vulnerability to Denial of Service (DoS) or slowloris resource exhaustion.';
    } else if (result.failedRequests > 0) {
      result.verdict = `WARNING: The target server dropped ${result.failedRequests} requests out of 20. It did not enforce a clean 429 rate limit but returned connection errors, indicating moderate fragility under concurrent load.`;
    } else {
      result.verdict = 'INFORMATIONAL: The server responded successfully to all concurrent requests with low latency, but no rate limiting was active. Consider implementing request rate-limiting (e.g., Nginx limit_req, Cloudflare WAF, or express-rate-limit) to shield against automated scrapers and brute-force attacks.';
    }

  } catch (err) {
    console.error('[loadTester] Error executing load resilience check:', err.message);
    result.verdict = `Scan Failure: An unexpected error occurred while executing the load resilience audit: ${err.message}`;
  }

  return result;
}

module.exports = {
  auditLoadResilience
};
