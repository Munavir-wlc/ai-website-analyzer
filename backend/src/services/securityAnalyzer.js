const cheerio = require('cheerio');
const { analyzeSecurityWithAI, detectTechnologies, auditOutdatedLibraries } = require('./aiEngine');
const { checkSSL, checkDNS, checkExposedFiles, checkHttpMethods, portScan, analyzeRedirects, whoisLookup, fetchRobotsTxt } = require('./crawler');

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

  // Technology Stack Detection (run first for smart tech-scoped audits)
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
  if (onStep) onStep('port_scan', 'in_progress');
  if (onStep) onStep('whois_check', 'in_progress');
  if (onStep) onStep('redirect_check', 'in_progress');
  if (onStep) onStep('robots_check', 'in_progress');

  const [portScanData, whoisData, redirectData, robotsData] = await Promise.all([
    portScan(domain).then(res => { if (onStep) onStep('port_scan', 'completed'); return res; }),
    whoisLookup(domain).then(res => { if (onStep) onStep('whois_check', 'completed'); return res; }),
    analyzeRedirects(crawlerResult.url, authOptions).then(res => { if (onStep) onStep('redirect_check', 'completed'); return res; }),
    fetchRobotsTxt(crawlerResult.url, authOptions).then(res => { if (onStep) onStep('robots_check', 'completed'); return res; })
  ]);

  // Auditing technology versions for known CVEs
  const cveFindings = auditOutdatedLibraries(crawlerResult.html || '');

  let findings = [...cveFindings];
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

  // 1. Open dangerous ports
  if (portScanData && portScanData.openPorts) {
    let hasDangerous = false;
    for (const p of portScanData.openPorts) {
      if (p.dangerous) {
        hasDangerous = true;
        const isHighRisk = [21, 22, 23, 3306, 5432, 6379, 27017].includes(p.port);
        const severity = isHighRisk ? 'high' : 'medium';
        findings.push({
          id: `open-port-${p.port}`,
          title: `Exposed Service Port: ${p.port} (${p.service})`,
          severity,
          category: 'Ports',
          description: `Port ${p.port} hosting service ${p.service} is open and publicly accessible. Administrative or database interfaces should not be public.`,
          remediation: `Configure firewall rules (e.g. iptables, security groups) to restrict access to port ${p.port} to trusted IP addresses only or close the service.`,
          owasp: 'A05:2021 Security Misconfiguration'
        });
      }
    }
    if (!hasDangerous) {
      positives.push('No dangerous administrative or database ports are exposed publicly.');
    }
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
    cookieAudit,
    corsIssues,
    mixedContent,
    portScanData,
    whoisData,
    redirectData,
    robotsData
  };
}

module.exports = { analyzeSecurity };
