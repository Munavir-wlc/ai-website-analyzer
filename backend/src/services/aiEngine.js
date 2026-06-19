const cheerio = require('cheerio');

async function generateRecommendations(report) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  try {
    const { default: axios } = await import('axios');
    const issues = [
      ...(report.issues?.seo || []).map(i => `[SEO] ${i.message}`),
      ...(report.issues?.security || []).map(i => `[Security] ${i.message}`)
    ];
    if (issues.length === 0) return null;

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an expert web developer. Give brief, actionable recommendations to fix the issues. Respond in 2-4 short bullet points.'
          },
          {
            role: 'user',
            content: `Website audit issues:\n${issues.join('\n')}\n\nSummarize key fixes in bullet points.`
          }
        ],
        max_tokens: 200
      },
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 10000
      }
    );

    const text = response.data?.choices?.[0]?.message?.content;
    return text ? text.trim() : null;
  } catch (_) {
    return null;
  }
}

/**
 * Detects website technologies based on HTML content and response headers.
 */
function detectTechnologies(html, headers) {
  const cmsList = {
    WordPress: /wp-content|wp-includes|wp-json/i,
    Shopify: /shopify|cdn\.shopify\.com/i,
    Wix: /wix\.com|wixpress/i,
    Squarespace: /squarespace|static\.squarespace\.com/i,
    Webflow: /webflow/i,
    Joomla: /joomla/i,
    Drupal: /drupal/i
  };

  const frameworkList = {
    React: /_next|react/i,
    'Next.js': /_next/i,
    Vue: /vue|nuxt/i,
    Angular: /angular/i,
    Laravel: /laravel|csrf-token/i,
    Django: /django|csrfmiddlewaretoken/i
  };

  const serverList = {
    nginx: /nginx/i,
    Apache: /apache/i,
    Cloudflare: /cloudflare|__cf_bm/i
  };

  const analyticsList = {
    'Google Analytics': /google-analytics|googletagmanager/i,
    'Facebook Pixel': /connect\.facebook\.net/i,
    Hotjar: /hotjar/i,
    Mixpanel: /mixpanel/i
  };

  const libraryList = {
    jQuery: /jquery/i,
    Bootstrap: /bootstrap/i,
    Tailwind: /tailwind/i
  };

  const detect = (list, source) => {
    const found = [];
    for (const [name, regex] of Object.entries(list)) {
      if (regex.test(source)) {
        found.push(name);
      }
    }
    return found;
  };

  const headerString = JSON.stringify(headers || {});
  const source = (html || '') + '\n' + headerString;

  const cms = detect(cmsList, source);
  const framework = detect(frameworkList, source);
  const server = detect(serverList, source);
  if (headers && headers['server']) {
    const s = headers['server'].toLowerCase();
    if (s.includes('nginx') && !server.includes('nginx')) server.push('nginx');
    if (s.includes('apache') && !server.includes('Apache')) server.push('Apache');
    if (s.includes('cloudflare') && !server.includes('Cloudflare')) server.push('Cloudflare');
  }
  const analytics = detect(analyticsList, source);
  const libraries = detect(libraryList, source);

  return { cms, framework, server, analytics, libraries };
}

/**
 * Fallback static audits if OpenAI is unavailable (quota, timeout, API failures)
 */
function runFallbackStaticChecks(url, headers, html, sslData, dnsData, exposedFiles, httpMethods) {
  const findings = [];
  const positives = [];
  const normHeaders = {};
  for (const [k, v] of Object.entries(headers || {})) {
    normHeaders[k.toLowerCase()] = v;
  }

  // 1. HTTPS Check
  const isHttps = url.startsWith('https://');
  if (!isHttps) {
    findings.push({
      id: 'insecure-http-fallback',
      title: 'Insecure HTTP Transport',
      severity: 'high',
      category: 'SSL',
      description: 'The site is loaded over unencrypted HTTP, exposing user traffic to eavesdropping.',
      remediation: 'Configure an SSL/TLS certificate and redirect HTTP traffic to HTTPS.',
      owasp: 'A05:2021 Security Misconfiguration'
    });
  } else {
    positives.push('Site is served over secure HTTPS.');
  }

  // 2. Security Headers Check
  const headerChecks = {
    'content-security-policy': { name: 'Content-Security-Policy', severity: 'high', desc: 'Prevents XSS attacks.', rem: 'Add the Content-Security-Policy header.' },
    'strict-transport-security': { name: 'Strict-Transport-Security', severity: 'medium', desc: 'Enforces HTTPS.', rem: 'Add the Strict-Transport-Security header.' },
    'x-frame-options': { name: 'X-Frame-Options', severity: 'medium', desc: 'Prevents clickjacking.', rem: 'Add X-Frame-Options: SAMEORIGIN.' },
    'x-content-type-options': { name: 'X-Content-Type-Options', severity: 'medium', desc: 'Prevents MIME-sniffing.', rem: 'Add X-Content-Type-Options: nosniff.' },
    'referrer-policy': { name: 'Referrer-Policy', severity: 'low', desc: 'Controls referrer data.', rem: 'Add Referrer-Policy header.' },
    'permissions-policy': { name: 'Permissions-Policy', severity: 'low', desc: 'Controls browser features.', rem: 'Add Permissions-Policy header.' }
  };

  for (const [hKey, meta] of Object.entries(headerChecks)) {
    if (!normHeaders[hKey]) {
      findings.push({
        id: `missing-${hKey}-fallback`,
        title: `Missing ${meta.name} Header`,
        severity: meta.severity,
        category: 'Headers',
        description: `The response does not send the ${meta.name} security header, which ${meta.desc.toLowerCase()}`,
        remediation: meta.rem,
        owasp: 'A05:2021 Security Misconfiguration'
      });
    } else {
      positives.push(`Defensive header ${meta.name} is present.`);
    }
  }

  // 3. Cookie Flags Check
  const setCookie = normHeaders['set-cookie'];
  if (setCookie) {
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
    let httpOnlyMissing = false;
    let secureMissing = false;
    
    for (const cookie of cookies) {
      if (!/;\s*HttpOnly/i.test(cookie)) httpOnlyMissing = true;
      if (!/;\s*Secure/i.test(cookie)) secureMissing = true;
    }

    if (httpOnlyMissing) {
      findings.push({
        id: 'cookie-httponly-missing-fallback',
        title: 'Cookie Missing HttpOnly Flag',
        severity: 'medium',
        category: 'Cookies',
        description: 'One or more set cookies do not enforce HttpOnly, allowing script access (prone to token theft via XSS).',
        remediation: 'Configure the HttpOnly flag on all cookies set by the application.',
        owasp: 'A05:2021 Security Misconfiguration'
      });
    }
    if (secureMissing) {
      findings.push({
        id: 'cookie-secure-missing-fallback',
        title: 'Cookie Missing Secure Flag',
        severity: 'medium',
        category: 'Cookies',
        description: 'One or more set cookies do not enforce the Secure flag, allowing cookies to be sent over clear HTTP.',
        remediation: 'Configure the Secure flag on all set cookies (requires HTTPS).',
        owasp: 'A05:2021 Security Misconfiguration'
      });
    }
    if (!httpOnlyMissing && !secureMissing) {
      positives.push('Application cookies enforce HttpOnly and Secure properties.');
    }
  }

  // 4. Exposed Files
  if (exposedFiles && exposedFiles.length > 0) {
    findings.push({
      id: 'exposed-files-fallback',
      title: 'Exposed Sensitive Files',
      severity: 'critical',
      category: 'Scripts',
      description: `Publicly accessible sensitive paths: ${exposedFiles.join(', ')}`,
      remediation: 'Restrict access using web server controls or move these files out of the web root.',
      owasp: 'A05:2021 Security Misconfiguration'
    });
  }

  // 5. SSL / DNS checks
  if (sslData && !sslData.valid && isHttps) {
    findings.push({
      id: 'ssl-invalid-fallback',
      title: 'Insecure SSL Certificate',
      severity: 'critical',
      category: 'SSL',
      description: `The certificate is invalid or has expired: ${sslData.error || 'untrusted'}`,
      remediation: 'Verify certificate renewal and chain installation.',
      owasp: 'A05:2021 Security Misconfiguration'
    });
  }

  if (dnsData && !dnsData.spfPresent && !dnsData.spf) {
    findings.push({
      id: 'dns-spf-missing-fallback',
      title: 'Missing SPF Record',
      severity: 'low',
      category: 'DNS',
      description: 'The DNS does not advertise an SPF rule, increasing email spoofing vulnerability.',
      remediation: 'Publish an SPF TXT record for this domain.',
      owasp: 'A05:2021 Security Misconfiguration'
    });
  }

  return {
    findings,
    summary: 'AI analysis temporarily unavailable. Showing static security checks only.',
    positives
  };
}

/**
 * AI-driven Security Vulnerability Analyzer (VAPT)
 * Incorporates crawler content and passive reconnaissance scans to detect issues via GPT-4o-mini
 */
async function analyzeSecurityWithAI(url, headers, html, sslData, dnsData, exposedFiles, httpMethods, portScanData, whoisData, redirectData, robotsData) {
  const apiKey = process.env.OPENAI_API_KEY;
  
  // Prepare backup static fallback
  const getFallback = () => runFallbackStaticChecks(url, headers, html, sslData, dnsData, exposedFiles, httpMethods);

  if (!apiKey) {
    console.warn('[aiEngine] No OPENAI_API_KEY found, returning static security checks fallback.');
    return getFallback();
  }

  const runRequest = async () => {
    const { default: axios } = await import('axios');
    const truncatedHtml = typeof html === 'string' ? html.substring(0, 15000) : '';
    const $ = cheerio.load(truncatedHtml);

    // 1. Extract forms structure
    const forms = [];
    $('form').each((_, el) => {
      const form = $(el);
      const inputs = [];
      form.find('input, textarea, select').each((_, inp) => {
        inputs.push({
          tag: inp.name || '',
          type: $(inp).attr('type') || 'text',
          name: $(inp).attr('name') || '',
        });
      });
      forms.push({
        action: form.attr('action') || '',
        method: form.attr('method') || 'get',
        inputs: inputs.slice(0, 5)
      });
    });

    // 2. Extract script sources
    const scripts = [];
    $('script[src]').each((_, el) => {
      const src = $(el).attr('src');
      if (src) scripts.push(src);
    });

    // 3. Extract target="_blank" links
    const targetBlankLinks = [];
    $('a[target="_blank"]').each((_, el) => {
      const link = $(el);
      targetBlankLinks.push({
        href: link.attr('href') || '',
        rel: link.attr('rel') || '',
        text: link.text().trim().substring(0, 20)
      });
    });

    // 4. Extract inline scripts
    const inlineScripts = [];
    $('script:not([src])').each((_, el) => {
      const content = $(el).html() || '';
      if (content.trim()) {
        inlineScripts.push(content.trim().substring(0, 150));
      }
    });

    // 5. Extract comments
    const comments = [];
    $('*').contents().each((_, el) => {
      if (el.type === 'comment') {
        const comment = el.data?.trim() || '';
        if (comment && comment.length > 5 && /password|config|debug|api|port|version|admin|db|dev/i.test(comment)) {
          comments.push(comment.substring(0, 100));
        }
      }
    });

    // 6. Sanitize headers
    const headerSummary = {};
    if (headers && typeof headers === 'object') {
      for (const [key, value] of Object.entries(headers)) {
        if (!/cookie|auth|token|jwt|session/i.test(key)) {
          headerSummary[key] = value;
        }
      }
    }

    const payload = {
      url,
      headers: headerSummary,
      htmlSummary: {
        forms: forms.slice(0, 5),
        scripts: scripts.slice(0, 10),
        targetBlankLinks: targetBlankLinks.slice(0, 5),
        inlineScripts: inlineScripts.slice(0, 3),
        developerComments: comments.slice(0, 3)
      },
      passiveAuditData: {
        sslData,
        dnsData,
        exposedFiles,
        httpMethods,
        portScanData,
        whoisData,
        redirectData,
        robotsData
      }
    };

    const prompt = `You are a web application security audit engine.
Analyze the following metadata payload representing a webpage, its headers, its structure, and passive recon audits (SSL, DNS, HTTP methods, exposed files, open ports, WHOIS registry, redirect chains, and robots.txt).
Identify potential vulnerabilities, misconfigurations, and standard security compliance gaps.

URL: ${url}
Metadata Payload:
${JSON.stringify(payload, null, 2)}

Audit Checklist requirements:
1. HTTPS vs HTTP: Check if the connection uses secure HTTPS.
2. Missing or misconfigured security headers: Content-Security-Policy (CSP), Strict-Transport-Security (HSTS), X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.
3. Insecure Cookie Flags: check for missing HttpOnly, Secure, or SameSite flags in response headers set-cookie fields.
4. Form security: identify sensitive forms transmitting data over HTTP or forms lacking CSRF inputs.
5. Third-party Script references: flag potentially outdated CDN libraries.
6. Target blank link redirects: flag target="_blank" links lacking rel="noopener noreferrer".
7. SSL Certificate Audits: review any issues or validity expiration flags in sslData.
8. DNS Configuration issues: verify SPF and DMARC text records from dnsData.
9. Exposed Files: review exposed files listed in exposedFiles.
10. HTTP Methods: check if PUT, DELETE, or TRACE are enabled from httpMethods.
11. Inline script vulnerabilities: flag inline script tags prone to execution or content leakage.
12. Critical comments: identify comments revealing passwords, versions, internal paths.
13. Exposed ports: review open ports in portScanData.
14. Domain expiry information: check if domain expires soon from whoisData.
15. Redirect hop count and HTTPS enforcement: check redirect count and HTTPS redirects from redirectData.
16. Robots.txt sensitive paths: check disallowed or allowed paths in robotsData.

Return a JSON object matching this schema. Do not wrap in markdown quotes.
Format:
{
  "findings": [
    {
      "id": "kebab-case-unique-id",
      "title": "Short issue title",
      "severity": "critical" | "high" | "medium" | "low",
      "category": "Headers" | "SSL" | "DNS" | "Cookies" | "Forms" | "Scripts",
      "description": "Clear explanation",
      "remediation": "Actionable fix steps",
      "owasp": "e.g. A05:2021 Security Misconfiguration"
    }
  ],
  "summary": "2-3 sentence overall assessment of the website security posture",
  "positives": [
    "List of things the site is doing well, including secure practices found"
  ]
}`;

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a strict security analyzer. You only respond with a valid JSON object matching the requested schema. No conversational text or markdown code block markers.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 1500,
        temperature: 0.1
      },
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 20000
      }
    );

    const text = response.data?.choices?.[0]?.message?.content;
    if (!text) return getFallback();

    console.log('[aiEngine] Raw AI response:', text);

    const result = JSON.parse(text);
    return {
      findings: Array.isArray(result.findings) ? result.findings : [],
      summary: result.summary || '',
      positives: Array.isArray(result.positives) ? result.positives : []
    };
  };

  try {
    return await runRequest();
  } catch (err) {
    // If rate limited, wait 3 seconds and retry once
    if (err.response?.status === 429) {
      console.warn('[aiEngine] OpenAI rate limit hit (429). Retrying in 3 seconds...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      try {
        return await runRequest();
      } catch (retryErr) {
        console.error('[aiEngine] OpenAI retry failed:', retryErr.message);
        return getFallback();
      }
    }
    console.error('[aiEngine] Security analysis with AI failed:', err.message);
    return getFallback();
  }
}

module.exports = { generateRecommendations, analyzeSecurityWithAI, detectTechnologies };
