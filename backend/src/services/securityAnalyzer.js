const cheerio = require('cheerio');
const { analyzeSecurityWithAI, auditOutdatedLibraries } = require('./aiEngine');
const { fingerprint, detectTechnologies } = require('./techFingerprint');
const { checkSSL, checkDNS, checkExposedFiles, checkHttpMethods, analyzeRedirects, whoisLookup, fetchRobotsTxt } = require('./crawler');
const { detectWaf } = require('./wafDetector');
const { scanCdnLibraries, matchCVEs } = require('./cveScanner');
const { discoverApiEndpoints } = require('./apiDiscovery');

/**
 * Grader engine for HTTP Security Headers (A+ to F rating)
 */
function gradeSecurityHeaders(headers, isHttps) {
  const normHeaders = {};
  for (const [k, v] of Object.entries(headers || {})) {
    normHeaders[k.toLowerCase()] = String(v).trim();
  }

  const reports = {};
  const findings = [];

  const addHeaderFinding = (id, title, severity, desc, rem) => {
    findings.push({
      id,
      title,
      severity,
      category: 'Headers',
      description: desc,
      remediation: rem,
      owasp: 'A05:2021 Security Misconfiguration'
    });
  };

  // 1. Content-Security-Policy (CSP)
  const csp = normHeaders['content-security-policy'];
  if (!csp) {
    reports['Content-Security-Policy'] = { status: 'missing', score: 0, value: null, desc: 'Content-Security-Policy header is missing. This header restricts which resources the browser is allowed to load.' };
    addHeaderFinding(
      'missing-csp-header',
      'Missing Content-Security-Policy (CSP) Header',
      'high',
      'The response does not send a Content-Security-Policy header, leaving the application highly vulnerable to Cross-Site Scripting (XSS) and data injection attacks.',
      'Define a strong Content-Security-Policy header containing directives like default-src, script-src, and style-src.'
    );
  } else {
    const isUnsafe = /'unsafe-inline'|'unsafe-eval'|\*\s/i.test(csp);
    if (isUnsafe) {
      reports['Content-Security-Policy'] = { status: 'weak', score: 50, value: csp, desc: 'CSP header is configured, but allows unsafe keywords (like unsafe-inline or wildcards) that diminish its protection.' };
      addHeaderFinding(
        'weak-csp-header',
        'Weak Content-Security-Policy (CSP) Header Configured',
        'medium',
        `The Content-Security-Policy header is present but contains unsafe directives (e.g. 'unsafe-inline' or wildcards): "${csp}". This allows bypasses of script blocking.`,
        'Refactor inline scripts to external files or use nonces/hashes, then remove unsafe-inline and wildcard sources from your CSP.'
      );
    } else {
      reports['Content-Security-Policy'] = { status: 'secure', score: 100, value: csp, desc: 'CSP header is set with secure directives.' };
    }
  }

  // 2. X-Frame-Options (Clickjacking protection)
  const xfo = normHeaders['x-frame-options'];
  const hasCspFrameAncestors = csp && /frame-ancestors/i.test(csp);
  if (!xfo && !hasCspFrameAncestors) {
    reports['X-Frame-Options'] = { status: 'missing', score: 0, value: null, desc: 'Missing Clickjacking protection headers (both X-Frame-Options and CSP frame-ancestors are absent).' };
    addHeaderFinding(
      'missing-clickjacking-header',
      'Missing Clickjacking Protection',
      'medium',
      'The response does not set X-Frame-Options or CSP frame-ancestors. Attackers can embed this page inside an iframe to perform clickjacking attacks.',
      'Configure the X-Frame-Options header to SAMEORIGIN or DENY, or use the CSP frame-ancestors directive.'
    );
  } else {
    const val = xfo || 'Configured via CSP frame-ancestors';
    reports['X-Frame-Options'] = { status: 'secure', score: 100, value: val, desc: 'Clickjacking protection is active.' };
  }

  // 3. X-Content-Type-Options
  const xcto = normHeaders['x-content-type-options'];
  if (!xcto || !/nosniff/i.test(xcto)) {
    reports['X-Content-Type-Options'] = { status: 'missing', score: 0, value: xcto || null, desc: 'X-Content-Type-Options header is missing or not set to "nosniff".' };
    addHeaderFinding(
      'missing-xcto-header',
      'Missing X-Content-Type-Options Header',
      'medium',
      'The X-Content-Type-Options header is absent or misconfigured. Browsers might attempt to sniff content types, which can lead to script execution vulnerabilities.',
      'Add the header "X-Content-Type-Options: nosniff" to all HTTP responses.'
    );
  } else {
    reports['X-Content-Type-Options'] = { status: 'secure', score: 100, value: xcto, desc: 'MIME-sniffing protection is active.' };
  }

  // 4. Referrer-Policy
  const refPolicy = normHeaders['referrer-policy'];
  if (!refPolicy) {
    reports['Referrer-Policy'] = { status: 'missing', score: 0, value: null, desc: 'Referrer-Policy header is missing.' };
    addHeaderFinding(
      'missing-referrer-policy',
      'Missing Referrer-Policy Header',
      'low',
      'The Referrer-Policy header is absent. Browsers will use default behaviors, which could leak sensitive URL query parameters to third-party assets/links.',
      'Add a Referrer-Policy header with a secure value like "no-referrer-when-downgrade" or "strict-origin-when-cross-origin".'
    );
  } else if (/unsafe-url/i.test(refPolicy)) {
    reports['Referrer-Policy'] = { status: 'weak', score: 50, value: refPolicy, desc: 'Referrer-Policy is configured but set to "unsafe-url", leaking full referrer paths to anyone.' };
    addHeaderFinding(
      'unsafe-referrer-policy',
      'Unsafe Referrer-Policy Header Configured',
      'low',
      'The Referrer-Policy header is set to "unsafe-url", leaking full path metadata to all third-party requests.',
      'Update the Referrer-Policy header to a safer value.'
    );
  } else {
    reports['Referrer-Policy'] = { status: 'secure', score: 100, value: refPolicy, desc: 'Referrer Policy configuration is safe.' };
  }

  // 5. Permissions-Policy
  const permPolicy = normHeaders['permissions-policy'] || normHeaders['feature-policy'];
  if (!permPolicy) {
    reports['Permissions-Policy'] = { status: 'missing', score: 0, value: null, desc: 'Permissions-Policy header is missing.' };
    addHeaderFinding(
      'missing-permissions-policy',
      'Missing Permissions-Policy Header',
      'low',
      'The Permissions-Policy header is missing. Browsers default to allowing pages access to sensitive device APIs (camera, geolocation, microphone, etc.).',
      'Add a Permissions-Policy header to specify which browser features are restricted or permitted.'
    );
  } else {
    reports['Permissions-Policy'] = { status: 'secure', score: 100, value: permPolicy, desc: 'Permissions Policy is active.' };
  }

  // 6. Strict-Transport-Security (HSTS)
  const hsts = normHeaders['strict-transport-security'];
  if (isHttps) {
    if (!hsts) {
      reports['Strict-Transport-Security'] = { status: 'missing', score: 0, value: null, desc: 'Strict-Transport-Security (HSTS) header is missing.' };
      addHeaderFinding(
        'missing-hsts-header',
        'Missing Strict-Transport-Security (HSTS) Header',
        'medium',
        'The HSTS header is missing on this HTTPS website. Browsers can still make unencrypted connections before redirecting, leaving users open to SSL strip attacks.',
        'Configure the Strict-Transport-Security header (e.g. max-age=63072000; includeSubDomains; preload).'
      );
    } else {
      const hasSubdomains = /includesubdomains/i.test(hsts);
      const hasPreload = /preload/i.test(hsts);
      if (!hasSubdomains || !hasPreload) {
        reports['Strict-Transport-Security'] = { status: 'weak', score: 50, value: hsts, desc: 'HSTS is set, but missing subdomains or preload parameters.' };
      } else {
        reports['Strict-Transport-Security'] = { status: 'secure', score: 100, value: hsts, desc: 'HSTS protection is fully active.' };
      }
    }
  } else {
    reports['Strict-Transport-Security'] = { status: 'missing', score: 0, value: null, desc: 'HSTS requires a secure HTTPS channel to run.' };
  }

  // Calculate score average
  let scoreSum = 0;
  for (const h of Object.keys(reports)) {
    scoreSum += reports[h].score;
  }
  let pct = Math.round((scoreSum / 600) * 100);

  // Grade caps
  if (!isHttps) {
    pct = Math.min(50, pct); // Cap at 50 (D) if insecure HTTP
  }

  let grade = 'F';
  if (pct >= 95) grade = 'A+';
  else if (pct >= 90) grade = 'A';
  else if (pct >= 80) grade = 'B';
  else if (pct >= 70) grade = 'C';
  else if (pct >= 50) grade = 'D';

  return {
    score: pct,
    grade,
    breakdown: reports,
    findings
  };
}

async function analyzeSecurity(crawlerResult, consent = false, onStep = null) {
  const issues = [];
  let score = 100;
  
  // Basic HTTPS check - URL scheme
  let isHttps = false;
  try {
    const url = new URL(crawlerResult.url);
    if (url.protocol === 'https:') {
      isHttps = true;
    }
  } catch (_) {}

  const domain = (() => {
    try {
      return new URL(crawlerResult.url).hostname;
    } catch {
      return crawlerResult.url;
    }
  })();

  // Technology Stack & Fingerprint Detection
  const techFingerprints = fingerprint(crawlerResult.html || '', crawlerResult.headers || {}, crawlerResult.url || '');
  const techStack = detectTechnologies(crawlerResult.html || '', crawlerResult.headers || {});
  const techList = [
    ...(techStack.cms || []),
    ...(techStack.framework || []),
    ...(techStack.server || []),
    ...(techStack.analytics || []),
    ...(techStack.libraries || [])
  ];

  // Run checkers step-by-step with real-time feedback
  if (onStep) onStep('ssl_check', 'in_progress');
  const sslData = await checkSSL(crawlerResult.url);
  if (onStep) onStep('ssl_check', 'completed');

  if (onStep) onStep('dns_check', 'in_progress');
  const dnsData = await checkDNS(domain);
  if (onStep) onStep('dns_check', 'completed');

  if (onStep) onStep('file_check', 'in_progress');
  const authOptions = {
    authCookie: crawlerResult.authCookie,
    authHeader: crawlerResult.authHeader
  };

  const [exposedFiles, httpMethods] = await Promise.all([
    checkExposedFiles(crawlerResult.url, techList, authOptions),
    checkHttpMethods(crawlerResult.url, authOptions)
  ]);
  if (onStep) onStep('file_check', 'completed');

  // Running Phase 2 passive checks in parallel
  if (onStep) onStep('whois_check', 'in_progress');
  if (onStep) onStep('redirect_check', 'in_progress');
  if (onStep) onStep('robots_check', 'in_progress');

  const [whoisData, redirectData, robotsData] = await Promise.all([
    whoisLookup(domain).then(res => { if (onStep) onStep('whois_check', 'completed'); return res; }),
    analyzeRedirects(crawlerResult.url, authOptions).then(res => { if (onStep) onStep('redirect_check', 'completed'); return res; }),
    fetchRobotsTxt(crawlerResult.url, authOptions).then(res => { if (onStep) onStep('robots_check', 'completed'); return res; })
  ]);

  const portScanData = { scanned: false, openPorts: [], totalScanned: 0 };

  // 1. WAF Signature Detection
  const wafData = detectWaf(crawlerResult.headers || {}, crawlerResult.html || '');

  // 2. Real-Time CVE Dependency Scanning (OSV Database check via passive fingerprinting + CDN scripts)
  const [liveCveFindings, techCveFindings] = await Promise.all([
    scanCdnLibraries(crawlerResult.html || ''),
    matchCVEs(techFingerprints)
  ]);

  // 3. API & Swagger Spec Discovery
  const apiDiscoveryData = await discoverApiEndpoints(crawlerResult.html || '', crawlerResult.url, authOptions);

  // 3b. Security Headers Grader (A+ to F Rating)
  const headersGrade = gradeSecurityHeaders(crawlerResult.headers || {}, isHttps);

  // Auditing technology versions for known static CVEs
  const staticCveFindings = auditOutdatedLibraries(crawlerResult.html || '');

  // Deduplicate and merge findings
  const initialFindings = [...staticCveFindings, ...techCveFindings, ...liveCveFindings, ...(headersGrade.findings || [])];
  const findings = [];
  const seenFindingIds = new Set();
  for (const f of initialFindings) {
    if (!seenFindingIds.has(f.id)) {
      seenFindingIds.add(f.id);
      findings.push(f);
    }
  }

  // Append findings for exposed API doc endpoints
  if (apiDiscoveryData.swaggerDocs && apiDiscoveryData.swaggerDocs.length > 0) {
    for (const doc of apiDiscoveryData.swaggerDocs) {
      findings.push({
        id: `exposed-api-docs-${doc.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        title: `Exposed API Documentation (${doc.name})`,
        severity: 'medium',
        category: 'DNS',
        description: `Publicly accessible API documentation or specification file found at: ${doc.url}. Exposing API specs helps attackers map your application's input structure.`,
        remediation: `Restict access to API documentation endpoints to authenticated admin sessions or internal IP ranges.`,
        owasp: 'A05:2021 Security Misconfiguration'
      });
    }
  }
  let summary = '';
  let positives = [];

  const rawHeaders = crawlerResult.headers || {};
  const normHeaders = {};
  for (const [k, v] of Object.entries(rawHeaders)) {
    normHeaders[k.toLowerCase()] = v;
  }

  // 1. CORS check
  const corsIssues = [];
  if (normHeaders['access-control-allow-origin'] === '*') {
    corsIssues.push('Access-Control-Allow-Origin: *');
    findings.push({
      id: 'wildcard-cors',
      title: 'Wildcard CORS Allowed',
      severity: 'medium',
      category: 'Headers',
      description: 'Access-Control-Allow-Origin header is set to wildcard (*), allowing any website to read response headers and data.',
      remediation: 'Set Access-Control-Allow-Origin to specific trusted domains or remove it.',
      owasp: 'A05:2021 Security Misconfiguration'
    });
  }

  // 2. Mixed content check
  const mixedContent = [];
  if (isHttps && crawlerResult.html) {
    const $ = cheerio.load(crawlerResult.html);
    $('img, script, link, iframe').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('href');
      if (src && src.startsWith('http://')) {
        mixedContent.push(src);
      }
    });
  }
  if (mixedContent.length > 0) {
    findings.push({
      id: 'mixed-content',
      title: 'Mixed Content Detected',
      severity: 'medium',
      category: 'Scripts',
      description: `HTTPS page loads insecure HTTP resources: ${mixedContent.slice(0, 3).join(', ')}`,
      remediation: 'Serve all referenced assets (images, stylesheets, scripts) over secure HTTPS connections.',
      owasp: 'A05:2021 Security Misconfiguration'
    });
  }

  // 2b. Subresource Integrity (SRI) Check
  const sriIssues = [];
  if (crawlerResult.html) {
    const $ = cheerio.load(crawlerResult.html);
    $('script[src], link[rel="stylesheet"]').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('href');
      const integrity = $(el).attr('integrity');
      if (src && (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('//')) && !integrity) {
        sriIssues.push(src);
      }
    });
  }
  if (sriIssues.length > 0) {
    findings.push({
      id: 'missing-sri-attributes',
      title: 'Missing Subresource Integrity (SRI) on External Assets',
      severity: 'low',
      category: 'Scripts',
      description: `External stylesheets or scripts are loaded without an integrity hash: ${sriIssues.slice(0, 2).join(', ')}. If the CDN hosting these files is compromised, malicious code could run on your domain.`,
      remediation: 'Generate cryptographic integrity hashes (SHA-256/384/512) for all external assets and add the `integrity` attribute to your HTML tags.',
      owasp: 'A06:2021-Vulnerable and Outdated Components'
    });
  }

  // 2c. Insecure Form Action Targets
  const insecureFormActions = [];
  if (crawlerResult.html && isHttps) {
    const $ = cheerio.load(crawlerResult.html);
    $('form').each((_, el) => {
      const action = $(el).attr('action');
      if (action && action.startsWith('http://')) {
        insecureFormActions.push(action);
      }
    });
  }
  if (insecureFormActions.length > 0) {
    findings.push({
      id: 'insecure-form-action',
      title: 'Insecure Form Action Target (HTTP)',
      severity: 'high',
      category: 'Forms',
      description: `Form data is submitted to an insecure HTTP URL: ${insecureFormActions.slice(0, 2).join(', ')}. This transmits input details and passwords in cleartext over the network.`,
      remediation: 'Update all form action targets to secure HTTPS endpoints.',
      owasp: 'A05:2021 Security Misconfiguration'
    });
  }

  // 2d. Server Information Disclosure Headers
  const disclosureHeaders = ['x-powered-by', 'x-aspnet-version', 'x-redirect-by', 'x-generator'];
  for (const h of disclosureHeaders) {
    if (normHeaders[h]) {
      findings.push({
        id: `header-leak-${h}`,
        title: `Information Disclosure via '${h}' Header`,
        severity: 'low',
        category: 'Headers',
        description: `The response header leaks server technology information: '${h}: ${normHeaders[h]}'. Attackers can use version information to identify matching CVE vulnerabilities.`,
        remediation: 'Disable version header outputs in your web server configurations (e.g. expose_php = Off in php.ini, or app.disable("x-powered-by") in Express).',
        owasp: 'A05:2021 Security Misconfiguration'
      });
    }
  }

  // 2e. Weak HSTS Configuration
  if (normHeaders['strict-transport-security']) {
    const hstsVal = normHeaders['strict-transport-security'];
    const hasSubdomains = /includesubdomains/i.test(hstsVal);
    const hasPreload = /preload/i.test(hstsVal);
    
    if (!hasSubdomains || !hasPreload) {
      findings.push({
        id: 'hsts-incomplete-config',
        title: 'Weak HSTS Configuration',
        severity: 'low',
        category: 'SSL',
        description: `Strict-Transport-Security configuration is missing safety directives: ${!hasSubdomains ? 'includeSubDomains' : ''} ${!hasPreload ? 'preload' : ''}.`,
        remediation: 'Update the HSTS header to include the includeSubDomains and preload parameters: Strict-Transport-Security: max-age=63072000; includeSubDomains; preload.',
        owasp: 'A05:2021 Security Misconfiguration'
      });
    }
  }

  // 3. Cookie audit
  const cookieAudit = [];
  const setCookieHeader = normHeaders['set-cookie'];
  if (setCookieHeader) {
    const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
    for (const cookieStr of cookies) {
      const nameMatch = cookieStr.match(/^\s*([^=;]+)/);
      const name = nameMatch ? nameMatch[1].trim() : 'Unknown';
      const httpOnly = /;\s*HttpOnly/i.test(cookieStr);
      const secure = /;\s*Secure/i.test(cookieStr);
      const sameSiteMatch = cookieStr.match(/;\s*SameSite\s*=\s*([^;]+)/i);
      const sameSite = sameSiteMatch ? sameSiteMatch[1].trim() : 'None';
      
      cookieAudit.push({ name, httpOnly, secure, sameSite });
      
      if (!httpOnly) {
        findings.push({
          id: `cookie-httponly-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          title: `Cookie '${name}' missing HttpOnly flag`,
          severity: 'medium',
          category: 'Cookies',
          description: `The cookie '${name}' can be accessed by scripts, increasing session-hijacking vulnerability via XSS.`,
          remediation: `Configure the cookie '${name}' with the HttpOnly flag.`,
          owasp: 'A05:2021 Security Misconfiguration'
        });
      }
      if (!secure && isHttps) {
        findings.push({
          id: `cookie-secure-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          title: `Cookie '${name}' missing Secure flag`,
          severity: 'medium',
          category: 'Cookies',
          description: `The cookie '${name}' is transmitted in cleartext on insecure HTTP requests.`,
          remediation: `Configure the cookie '${name}' with the Secure flag.`,
          owasp: 'A05:2021 Security Misconfiguration'
        });
      }
    }
  }

  // --- Phase 2 Deterministic Security Audits ---

  // 1. Passive Technology & CVE Verification
  if (techCveFindings.length === 0 && liveCveFindings.length === 0) {
    positives.push('No known critical CVE vulnerabilities matched in detected software components.');
  }

  // 2. Missing HTTPS redirection
  if (redirectData) {
    if (!redirectData.enforcesHttps) {
      findings.push({
        id: 'missing-https-redirect',
        title: 'Insecure HTTP access permitted (No HTTPS redirect)',
        severity: 'critical',
        category: 'SSL',
        description: 'The server does not redirect HTTP traffic to HTTPS, allowing cleartext communication.',
        remediation: 'Configure the web server to return a 301 redirect to HTTPS for all HTTP requests.',
        owasp: 'A05:2021 Security Misconfiguration'
      });
    } else {
      positives.push('HTTP requests are successfully redirected to secure HTTPS.');
    }
  }

  // 3. Domain expiring (WHOIS)
  if (whoisData && whoisData.exists) {
    positives.push('Domain registration is active and verified via WHOIS.');
    if (whoisData.daysRemaining !== null) {
      if (whoisData.daysRemaining < 7) {
        findings.push({
          id: 'domain-expiry-critical',
          title: `Domain Registration Expiring In ${whoisData.daysRemaining} Days`,
          severity: 'critical',
          category: 'DNS',
          description: `The domain registration is set to expire on ${new Date(whoisData.expiryDate).toLocaleDateString()}. Expiration causes service downtime and hijacking risk.`,
          remediation: 'Renew the domain registration immediately with your registrar.',
          owasp: 'A09:2021 Security Logging and Monitoring Failures'
        });
      } else if (whoisData.daysRemaining < 30) {
        findings.push({
          id: 'domain-expiry-high',
          title: `Domain Registration Expiring In ${whoisData.daysRemaining} Days`,
          severity: 'high',
          category: 'DNS',
          description: `The domain registration is set to expire on ${new Date(whoisData.expiryDate).toLocaleDateString()}.`,
          remediation: 'Renew the domain registration with your registrar.',
          owasp: 'A09:2021 Security Logging and Monitoring Failures'
        });
      }
    }
  }

  // 4. Redirect hops count warning
  if (redirectData) {
    if (redirectData.redirectCount > 3) {
      findings.push({
        id: 'excessive-redirects',
        title: `Excessive Redirect Hops Detected (${redirectData.redirectCount} hops)`,
        severity: 'medium',
        category: 'Redirects',
        description: `The URL triggered a chain of ${redirectData.redirectCount} redirects. Too many hops increase latency and risk hijack/MITM interception.`,
        remediation: 'Reduce the number of intermediate hops to direct visitors straight to the destination URL.',
        owasp: 'A05:2021 Security Misconfiguration'
      });
    }
  }

  // 5. Cross-domain redirects
  if (redirectData) {
    if (redirectData.isCrossDomain) {
      findings.push({
        id: 'cross-domain-redirect',
        title: 'Cross-Domain Redirect Risk',
        severity: 'high',
        category: 'Redirects',
        description: `The redirection chain routes the user to a different domain: ${redirectData.finalUrl}. This can be abused for phishing or open redirect attacks.`,
        remediation: 'Ensure redirections only land on trusted, owned domains and implement strict validation for open redirects.',
        owasp: 'A01:2021 Broken Access Control'
      });
    }
  }

  // 6. Sensitive robots.txt paths
  if (robotsData && robotsData.exists) {
    if (robotsData.sensitiveFound && robotsData.sensitiveFound.length > 0) {
      findings.push({
        id: 'sensitive-robots-paths',
        title: 'Sensitive Paths Exposed in robots.txt',
        severity: 'low',
        category: 'Robots',
        description: `Paths like: ${robotsData.sensitiveFound.join(', ')} are exposed in robots.txt. Crawlers are instructed not to index them, but malicious actors can use them to find login/admin pages.`,
        remediation: 'Remove administrative or sensitive directory listings from robots.txt. Use proper authorization/access controls to protect these folders instead.',
        owasp: 'A05:2021 Security Misconfiguration'
      });
    } else {
      positives.push('Robots.txt is present and does not expose sensitive endpoints.');
    }
  }

  // Base VAPT protocol checks
  if (onStep) onStep('ai_analysis', 'in_progress');
  if (consent) {
    const aiResult = await analyzeSecurityWithAI(
      crawlerResult.url,
      crawlerResult.headers || {},
      crawlerResult.html || '',
      sslData,
      dnsData,
      exposedFiles,
      httpMethods,
      portScanData,
      whoisData,
      redirectData,
      robotsData
    );

    // Merge AI findings, avoiding duplicates for CORS, Mixed Content, Cookie audits, or Phase 2 checks above
    const aiFindings = aiResult.findings || [];
    for (const finding of aiFindings) {
      const isDuplicate = findings.some(
        (existing) => 
          existing.id === finding.id ||
          existing.title.toLowerCase() === finding.title.toLowerCase()
      );

      if (!isDuplicate) {
        findings.push(finding);
      }
    }

    summary = aiResult.summary || '';
    positives = Array.from(new Set([...positives, ...(aiResult.positives || [])]));
  } else {
    summary = 'Consent not granted. Running passive metadata scans only.';
    
    if (isHttps && sslData.valid) {
      positives.push('Website uses secure HTTPS transport layer.');
    }
    if (dnsData.spfPresent || dnsData.spf) {
      positives.push('SPF record is set in DNS settings.');
    }
    if (dnsData.dmarcPresent || dnsData.dmarc) {
      positives.push('DMARC policy is set in DNS settings.');
    }

    if (!isHttps) {
      findings.push({
        id: 'insecure-http',
        title: 'Website is not served over HTTPS',
        severity: 'high',
        category: 'SSL',
        description: 'Web traffic is transmitted in clear text, exposing sensitive data to eavesdropping.',
        remediation: 'Configure an SSL/TLS certificate and redirect HTTP traffic to HTTPS.',
        owasp: 'A05:2021 Security Misconfiguration'
      });
    }

    if (sslData.error) {
      findings.push({
        id: 'ssl-handshake-failure',
        title: 'SSL handshake check failed',
        severity: 'medium',
        category: 'SSL',
        description: `Failed to check SSL details: ${sslData.error}`,
        remediation: 'Verify server certificate chain configuration.',
        owasp: 'A05:2021 Security Misconfiguration'
      });
    } else if (!sslData.valid && isHttps) {
      findings.push({
        id: 'invalid-ssl-certificate',
        title: 'Invalid SSL Certificate',
        severity: 'critical',
        category: 'SSL',
        description: 'The certificate is either self-signed, untrusted, or has expired.',
        remediation: 'Obtain a valid, trusted SSL certificate from a Certificate Authority.',
        owasp: 'A05:2021 Security Misconfiguration'
      });
    }

    if (!dnsData.spfPresent && !dnsData.spf) {
      findings.push({
        id: 'missing-dns-spf',
        title: 'Missing SPF record',
        severity: 'low',
        category: 'DNS',
        description: 'An SPF record helps prevent email spoofing.',
        remediation: 'Add an SPF TXT record to your DNS configuration.',
        owasp: 'A05:2021 Security Misconfiguration'
      });
    }

    if (!dnsData.dmarcPresent && !dnsData.dmarc) {
      findings.push({
        id: 'missing-dns-dmarc',
        title: 'Missing DMARC record',
        severity: 'low',
        category: 'DNS',
        description: 'DMARC prevents spoofing and phishing campaigns.',
        remediation: 'Add a DMARC TXT record to your DNS configuration.',
        owasp: 'A05:2021 Security Misconfiguration'
      });
    }

    if (exposedFiles.length > 0) {
      findings.push({
        id: 'exposed-sensitive-files',
        title: 'Exposed sensitive files detected',
        severity: 'critical',
        category: 'Scripts',
        description: `Accessible files: ${exposedFiles.join(', ')}`,
        remediation: 'Restrict access to files via server configurations.',
        owasp: 'A05:2021 Security Misconfiguration'
      });
    }

    if (httpMethods.put || httpMethods.delete || httpMethods.trace) {
      const active = Object.keys(httpMethods).filter(m => httpMethods[m]);
      findings.push({
        id: 'dangerous-http-methods',
        title: 'Dangerous HTTP methods enabled',
        severity: 'medium',
        category: 'Headers',
        description: `Methods enabled: ${active.join(', ').toUpperCase()}`,
        remediation: 'Disable PUT, DELETE, and TRACE methods in server settings.',
        owasp: 'A05:2021 Security Misconfiguration'
      });
    }
  }
  if (onStep) onStep('ai_analysis', 'completed');

  // Calculate dynamic security score
  for (const finding of findings) {
    if (finding.id === 'sensitive-robots-paths') continue;
    
    const severity = finding.severity?.toLowerCase();
    const deductions = {
      critical: 20,
      high: 15,
      medium: 8,
      low: 4
    };
    const points = deductions[severity] || 5;
    score -= points;
  }

  // Apply custom robots.txt sensitive paths deduction: -5 each (max -20)
  if (robotsData && robotsData.exists && robotsData.sensitiveFound && robotsData.sensitiveFound.length > 0) {
    const robotsDeduction = Math.min(20, robotsData.sensitiveFound.length * 5);
    score -= robotsDeduction;
  }

  score = Math.max(0, score);

  return {
    score,
    findings,
    summary,
    positives,
    sslData,
    dnsData,
    exposedFiles,
    techStack,
    techFingerprints,
    cookieAudit,
    corsIssues,
    mixedContent,
    portScanData,
    whoisData,
    redirectData,
    robotsData,
    wafData,
    apiDiscoveryData,
    headersGrade,
    authCookie: crawlerResult.authCookie || '',
    authHeader: crawlerResult.authHeader || ''
  };
}

module.exports = { analyzeSecurity };
