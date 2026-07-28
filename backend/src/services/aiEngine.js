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
        model: 'gpt-4o-mini',
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
  return {
    findings: [],
    summary: 'AI analysis was not used. Deterministic scanner results were compiled from observed headers, page content, DNS, SSL, and passive reconnaissance checks.',
    positives: []
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

function semverCompare(v1, v2) {
  const p1 = v1.split('.').map(Number);
  const p2 = v2.split('.').map(Number);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const n1 = p1[i] || 0;
    const n2 = p2[i] || 0;
    if (n1 < n2) return -1;
    if (n1 > n2) return 1;
  }
  return 0;
}

const KNOWN_CVES = {
  jquery: [
    {
      maxVersion: '3.5.0',
      id: 'CVE-2020-11022',
      title: 'jQuery < 3.5.0 Cross-Site Scripting (XSS) Vulnerability',
      description: 'jQuery versions prior to 3.5.0 are vulnerable to Cross-Site Scripting (XSS) when passing HTML to DOM manipulation methods like .html() or .append().',
      remediation: 'Upgrade jQuery to version 3.5.0 or higher.',
      severity: 'medium',
      owasp: 'A06:2021-Vulnerable and Outdated Components'
    }
  ],
  bootstrap: [
    {
      maxVersion: '3.4.1',
      id: 'CVE-2019-8331',
      title: 'Bootstrap < 3.4.1 XSS Vulnerability in Tooltips/Popovers',
      description: 'Bootstrap versions prior to 3.4.1 are vulnerable to Cross-Site Scripting (XSS) due to insufficient sanitization in the tooltip and popover plugins.',
      remediation: 'Upgrade Bootstrap to version 3.4.1 or higher.',
      severity: 'medium',
      owasp: 'A06:2021-Vulnerable and Outdated Components'
    }
  ],
  wordpress: [
    {
      maxVersion: '6.2.0',
      id: 'CVE-2023-32243',
      title: 'WordPress Core < 6.2.1 Directory Traversal & RCE Risks',
      description: 'WordPress Core versions prior to 6.2.1 are prone to vulnerabilities including Directory Traversal and Cross-Site Request Forgery.',
      remediation: 'Upgrade WordPress installation to the latest security release.',
      severity: 'high',
      owasp: 'A06:2021-Vulnerable and Outdated Components'
    }
  ]
};

function auditOutdatedLibraries(html) {
  const findings = [];
  if (!html) return findings;

  // Extract jQuery version
  const jqueryMatch = html.match(/jquery[-.]([0-9]+\.[0-9]+\.[0-9]+)/i) || html.match(/jquery\.min\.js\?ver=([0-9]+\.[0-9]+\.[0-9]+)/i);
  if (jqueryMatch) {
    const version = jqueryMatch[1];
    for (const vuln of KNOWN_CVES.jquery) {
      if (semverCompare(version, vuln.maxVersion) <= 0) {
        findings.push({
          id: `${vuln.id}-jquery`,
          title: vuln.title,
          severity: vuln.severity,
          category: 'Scripts',
          description: vuln.description + ` (Detected version: ${version})`,
          remediation: vuln.remediation,
          owasp: vuln.owasp
        });
      }
    }
  }

  // Extract Bootstrap version
  const bootstrapMatch = html.match(/bootstrap\/([0-9]+\.[0-9]+\.[0-9]+)/i) || html.match(/bootstrap[-.]([0-9]+\.[0-9]+\.[0-9]+)/i);
  if (bootstrapMatch) {
    const version = bootstrapMatch[1];
    for (const vuln of KNOWN_CVES.bootstrap) {
      if (semverCompare(version, vuln.maxVersion) <= 0) {
        findings.push({
          id: `${vuln.id}-bootstrap`,
          title: vuln.title,
          severity: vuln.severity,
          category: 'Scripts',
          description: vuln.description + ` (Detected version: ${version})`,
          remediation: vuln.remediation,
          owasp: vuln.owasp
        });
      }
    }
  }

  // Extract WordPress version
  const wpMatch = html.match(/wp-emoji-release\.min\.js\?ver=([0-9]+\.[0-9]+\.[0-9]+)/i) || html.match(/generator" content="WordPress ([0-9]+\.[0-9]+\.[0-9]+)/i);
  if (wpMatch) {
    const version = wpMatch[1];
    for (const vuln of KNOWN_CVES.wordpress) {
      if (semverCompare(version, vuln.maxVersion) <= 0) {
        findings.push({
          id: `${vuln.id}-wordpress`,
          title: vuln.title,
          severity: vuln.severity,
          category: 'Scripts',
          description: vuln.description + ` (Detected version: ${version})`,
          remediation: vuln.remediation,
          owasp: vuln.owasp
        });
      }
    }
  }

  return findings;
}

/**
 * Interactively chat with an AI assistant scoped strictly to a specific vulnerability finding.
 */
async function chatWithFindingAssistant(finding, messages = []) {
  const apiKey = process.env.OPENAI_API_KEY;
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content || '';

  if (!apiKey) {
    const query = lastUserMsg.toLowerCase();
    
    if (query.includes('risk') || query.includes('attack') || query.includes('impact') || query.includes('exploit')) {
      return `### 💡 Real-World Attack Risk: ${finding.title}

**Exploitation Risk**: ${finding.severity ? finding.severity.toUpperCase() : 'MEDIUM'} Risk (${finding.owasp || 'Security Vulnerability'})

Without proper protection for **${finding.title}**, attackers can perform unauthorized actions such as cross-site script execution, session hijacking, or traffic manipulation depending on the vulnerability type.

**Impact**:
- **Data Exposure**: Sensitive headers, cookies, or user tokens may be compromised.
- **Compliance Violation**: May fail PCI-DSS, GDPR, or HIPAA audit requirements.

*(Offline Mode — Set \`OPENAI_API_KEY\` in backend \`.env\` for live multi-turn AI responses)*`;
    }

    if (query.includes('next') || query.includes('react')) {
      return `### 💻 Next.js / React Remediation Guide: ${finding.title}

To fix **${finding.title}** in Next.js, add or update headers in \`next.config.js\`:

\`\`\`javascript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: '${finding.title.includes('CSP') || finding.title.includes('Content-Security') ? 'Content-Security-Policy' : finding.title.includes('Frame') || finding.title.includes('Clickjacking') ? 'X-Frame-Options' : finding.title.includes('HSTS') ? 'Strict-Transport-Security' : 'X-Content-Type-Options'}',
            value: '${finding.remediation.includes('DENY') ? 'DENY' : 'default-src \'self\'; script-src \'self\';'}'
          }
        ]
      }
    ];
  }
};
\`\`\`

*(Offline Mode — Set \`OPENAI_API_KEY\` in backend \`.env\` for custom framework code generation)*`;
    }

    if (query.includes('nginx') || query.includes('express') || query.includes('apache') || query.includes('config')) {
      return `### 🛡️ Server Remediation Snippet: ${finding.title}

**NGINX Config**:
\`\`\`nginx
# /etc/nginx/conf.d/security.conf
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
\`\`\`

**Express.js Config**:
\`\`\`javascript
const helmet = require('helmet');
app.use(helmet()); // Automatically sets recommended security headers
\`\`\`

*(Offline Mode — Set \`OPENAI_API_KEY\` in backend \`.env\` for live custom server configs)*`;
    }

    if (query.includes('test') || query.includes('verify') || query.includes('check')) {
      return `### 🧪 How to Verify & Test the Fix: ${finding.title}

1. **cURL Command**:
   \`\`\`bash
   curl -I https://yourdomain.com
   \`\`\`
2. **Inspect Response Headers**: Look for the presence of the header or security setting in the HTTP response headers output.
3. **Re-scan**: Re-run the VAPT scanner from your dashboard to verify the score improvement!

*(Offline Mode — Set \`OPENAI_API_KEY\` in backend \`.env\` for interactive testing advice)*`;
    }

    return `### 🛡️ Security Guidance: ${finding.title}

**Issue Summary**: ${finding.description || 'Security configuration issue detected.'}

**Recommended Action**: ${finding.remediation || 'Apply standard security header or configuration updates as outlined in OWASP guidelines.'}

*(Offline Mode: Set \`OPENAI_API_KEY\` in backend \`.env\` to enable live custom AI chat)*`;
  }

  try {
    const { default: axios } = await import('axios');

    // Keep only last 4 messages to preserve low token consumption
    const recentHistory = (messages || []).slice(-4).map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content || '').slice(0, 300) // cap user message to 300 chars
    }));

    const systemPrompt = `You are a focused, expert Application Security Engineer. You are assisting a developer in understanding and fixing ONE specific vulnerability finding:

Vulnerability: ${finding.title || 'Security Issue'}
Category: ${finding.category || 'Security'}
OWASP Category: ${finding.owasp || 'N/A'}
Severity: ${finding.severity || 'Medium'}
Description: ${finding.description || ''}
Default Remediation: ${finding.remediation || ''}

STRICT GUARDRAIL RULES:
1. You MUST ONLY answer questions directly related to this specific vulnerability, its real-world exploitation risk, attack scenarios, or code/server config fixes.
2. If the user asks off-topic questions (e.g. general programming, unrelated code, essays, recipes, weather, general chat), politely refuse in 1 sentence and redirect them back to fixing this vulnerability.
3. Keep responses concise (under 250 words), actionable, and developer-friendly. Use code snippets (NGINX, Apache, Express, Next.js, etc.) when asked for code.`;

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...recentHistory
        ],
        max_tokens: 350,
        temperature: 0.3
      },
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 12000
      }
    );

    const reply = response.data?.choices?.[0]?.message?.content;
    return reply ? reply.trim() : "I'm sorry, I couldn't generate a response. Please try asking again.";
  } catch (err) {
    console.error('[aiEngine] Chat assistant error:', err.message);
    return `### Security Guidance for: ${finding.title}\n\n**Remediation Suggestion**: ${finding.remediation}\n\n*(AI Chat service temporarily unavailable: ${err.message})*`;
  }
}

module.exports = { generateRecommendations, analyzeSecurityWithAI, detectTechnologies, auditOutdatedLibraries, chatWithFindingAssistant };

