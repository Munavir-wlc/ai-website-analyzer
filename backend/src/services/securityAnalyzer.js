const { analyzeSecurityWithAI } = require('./aiEngine');

const VALID_SCORE = 100;

const HEADER_CHECKS = [
  {
    header: 'content-security-policy',
    name: 'Content-Security-Policy',
    severity: 'high',
    message: 'Missing Content Security Policy header',
    fix: 'Add Content-Security-Policy header to prevent XSS and injection attacks'
  },
  {
    header: 'strict-transport-security',
    name: 'Strict-Transport-Security',
    severity: 'medium',
    message: 'Missing Strict-Transport-Security (HSTS) header',
    fix: 'Add Strict-Transport-Security: max-age=31536000; includeSubDomains'
  },
  {
    header: 'x-frame-options',
    name: 'X-Frame-Options',
    severity: 'medium',
    message: 'Missing X-Frame-Options header',
    fix: 'Add X-Frame-Options: DENY or SAMEORIGIN to prevent clickjacking'
  },
  {
    header: 'x-xss-protection',
    name: 'X-XSS-Protection',
    severity: 'low',
    message: 'Missing X-XSS-Protection header',
    fix: 'Add X-XSS-Protection: 1; mode=block (note: deprecated but still used)'
  },
  {
    header: 'x-content-type-options',
    name: 'X-Content-Type-Options',
    severity: 'medium',
    message: 'Missing X-Content-Type-Options header',
    fix: 'Add X-Content-Type-Options: nosniff to prevent MIME sniffing'
  }
];

function normalizeHeaders(headers) {
  const normalized = {};
  if (typeof headers === 'object' && headers !== null) {
    for (const [key, value] of Object.entries(headers)) {
      normalized[key.toLowerCase()] = value;
    }
  }
  return normalized;
}

async function analyzeSecurity(crawlerResult) {
  const issues = [];
  let score = VALID_SCORE;
  const headers = normalizeHeaders(crawlerResult.headers || {});

  // HTTPS check - URL scheme
  try {
    const url = new URL(crawlerResult.url);
    if (url.protocol !== 'https:') {
      issues.push({
        type: 'https',
        severity: 'high',
        message: 'Site is not served over HTTPS',
        fix: 'Enable HTTPS and redirect HTTP to HTTPS'
      });
      score -= 15;
    }
  } catch (_) {
    issues.push({ type: 'https', severity: 'high', message: 'Invalid URL', fix: null });
    score -= 15;
  }

  // Security header checks
  for (const check of HEADER_CHECKS) {
    if (!headers[check.header]) {
      const points = { high: 10, medium: 6, low: 3 }[check.severity];
      score -= points;
      issues.push({
        type: 'header',
        severity: check.severity,
        message: check.message,
        fix: check.fix
      });
    }
  }

  // Server information exposure
  if (headers['server']) {
    issues.push({
      type: 'server',
      severity: 'medium',
      message: `Server version exposed: ${headers['server']}`,
      fix: 'Remove or obfuscate Server header to avoid information disclosure'
    });
    score -= 6;
  }

  // Cookie security flags
  const setCookie = headers['set-cookie'];
  if (setCookie) {
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
    for (const cookie of cookies) {
      const hasSecure = /;\s*Secure/i.test(cookie);
      const hasHttpOnly = /;\s*HttpOnly/i.test(cookie);
      if (!hasSecure) {
        issues.push({
          type: 'cookie',
          severity: 'medium',
          message: 'Cookie missing Secure flag',
          fix: 'Add Secure flag to cookies when using HTTPS'
        });
        score -= 4;
      }
      if (!hasHttpOnly && /session|auth|token/i.test(cookie)) {
        issues.push({
          type: 'cookie',
          severity: 'medium',
          message: 'Sensitive-looking cookie missing HttpOnly flag',
          fix: 'Add HttpOnly flag to prevent JavaScript access'
        });
        score -= 4;
      }
    }
  }

  // Open redirect - check if URL has redirect-like params (basic pattern check)
  try {
    const url = new URL(crawlerResult.url);
    const redirectParams = ['url', 'redirect', 'next', 'return', 'dest', 'target'];
    for (const param of redirectParams) {
      if (url.searchParams.has(param)) {
        issues.push({
          type: 'open-redirect',
          severity: 'low',
          message: `URL contains redirect parameter: ${param}`,
          fix: 'Validate and whitelist redirect targets to prevent open redirects'
        });
        score -= 2;
        break;
      }
    }
  } catch (_) {}

  // Reflected XSS - basic check: look for common XSS payload patterns in HTML
  if (crawlerResult.html) {
    const xssPatterns = [
      /<script[^>]*>/i,
      /javascript:/i,
      /on\w+=["'][^"']*["']/i,
      /<iframe[^>]*>/i
    ];
    const hasSuspiciousContent = xssPatterns.some(p => p.test(crawlerResult.html));
    if (hasSuspiciousContent) {
      issues.push({
        type: 'xss',
        severity: 'low',
        message: 'Page may contain inline script or event handlers (potential XSS surface)',
        fix: 'Use Content-Security-Policy and avoid inline scripts'
      });
      score -= 3;
    }
  }

  // Integrate AI security checks if key is configured
  if (process.env.OPENAI_API_KEY) {
    console.log('[securityAnalyzer] Initiating AI vulnerability scan...');
    const aiIssues = await analyzeSecurityWithAI(crawlerResult.url, crawlerResult.headers, crawlerResult.html);
    
    // Deduplicate and append AI findings
    for (const aiIssue of aiIssues) {
      // Avoid duplicate reports for missing headers or general issues we checked statically
      const isDuplicate = issues.some(
        (existing) => 
          existing.type === aiIssue.type ||
          existing.message.toLowerCase() === aiIssue.message.toLowerCase() ||
          (aiIssue.type === 'header' && existing.type === 'header' && existing.message.toLowerCase().includes(aiIssue.message.toLowerCase()))
      );

      if (!isDuplicate) {
        issues.push({
          type: aiIssue.type || 'vulnerability',
          severity: aiIssue.severity || 'medium',
          message: aiIssue.message,
          fix: aiIssue.fix || null
        });

        // Deduct points for AI-detected issues
        const points = { high: 10, medium: 6, low: 3 }[aiIssue.severity] || 5;
        score -= points;
      }
    }
  }

  score = Math.max(0, score);

  return {
    score,
    issues
  };
}

module.exports = { analyzeSecurity };
