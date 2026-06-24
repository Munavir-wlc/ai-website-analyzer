const cheerio = require('cheerio');
const axios = require('axios');
const { isSafeUrl } = require('../utils/ssrfGuard');

const SQL_ERROR_PATTERNS = [
  /you have an error in your sql syntax/i,
  /warning: mysql_/i,
  /unclosed quotation mark/i,
  /postgresql query failed/i,
  /pg_query\(\)/i,
  /sqlite3::exception/i,
  /sql error/i,
  /database error/i,
  /syntax error near/i
];

const XSS_PAYLOAD = 'xss_tst_val_1<svg/onload=confirm(1)>';

/**
 * Audit Host Header Injection vulnerability on the target URL
 * @param {string} targetUrl - URL of the site to scan
 * @param {Object} authOptions - Optional headers/cookies auth
 * @returns {Promise<Array>} List of security findings
 */
async function checkHostHeaderInjection(targetUrl, authOptions = {}) {
  const findings = [];
  try {
    const origin = new URL(targetUrl).origin;
    if (!await isSafeUrl(origin)) {
      return findings;
    }

    const { authCookie, authHeader } = authOptions;
    const requestHeaders = {
      'User-Agent': 'Mozilla/5.0 (compatible; AI-Website-Analyzer-Active/1.0)',
      'Host': 'evil-domain-test.com',
      'X-Forwarded-Host': 'evil-domain-test.com'
    };
    if (authHeader) requestHeaders['Authorization'] = authHeader;
    if (authCookie) requestHeaders['Cookie'] = authCookie;

    console.log(`[activeScanner] Testing Host Header Injection for: ${targetUrl}`);
    const response = await axios.get(targetUrl, {
      headers: requestHeaders,
      timeout: 6000,
      validateStatus: () => true,
      maxRedirects: 0 // Do not follow redirects so we can inspect Location header
    });

    // 1. Check for Host injection redirect redirect
    const location = response.headers['location'];
    if (location && location.includes('evil-domain-test.com')) {
      findings.push({
        id: 'host-header-injection-redirect',
        title: 'Host Header Injection (Redirect Hijack)',
        severity: 'high',
        category: 'Headers',
        description: 'The server redirected the request to an external domain ("evil-domain-test.com") specified in the HTTP Host header. Attackers can leverage this to redirect users to malicious phishing pages.',
        remediation: 'Configure the web server to validate the Host header against a trusted whitelist of domains, or enforce absolute redirects using internal hostnames.',
        owasp: 'A01:2021-Broken Access Control'
      });
    }

    // 2. Check HTML body response for script/link injection
    const body = typeof response.data === 'string' ? response.data : '';
    if (body.includes('evil-domain-test.com') || body.includes('//evil-domain-test.com')) {
      findings.push({
        id: 'host-header-injection-reflection',
        title: 'Host Header Injection (Asset/Link Poisoning)',
        severity: 'high',
        category: 'Headers',
        description: 'The server reflected the malicious Host header value ("evil-domain-test.com") inside the HTML document. This can allow attackers to poison dynamically generated links, stylesheet URLs, script elements, or password reset links.',
        remediation: 'Do not dynamically generate absolute asset URLs or links using the user-supplied Host header. Use a fixed server name configuration or relative URLs.',
        owasp: 'A03:2021-Injection'
      });
    }
  } catch (err) {
    console.log(`[activeScanner] Host Header Injection check failed: ${err.message}`);
  }
  return findings;
}

/**
 * Audit forms and parameters on a crawled page for XSS, SQLi, Command Injection and Path Traversal
 * @param {string} html - Raw page HTML
 * @param {string} pageUrl - URL of the crawled page
 * @param {Object} authOptions - Optional headers/cookies auth
 * @param {number} delay - Throttle delay in milliseconds
 * @returns {Promise<Array>} List of security findings
 */
async function auditActiveVulnerabilities(html, pageUrl, authOptions = {}, delay = 0) {
  const findings = [];
  
  // First, audit Host Header Injection on the target URL
  const hostHeaderFindings = await checkHostHeaderInjection(pageUrl, authOptions);
  findings.push(...hostHeaderFindings);

  if (!html) return findings;

  const { authCookie, authHeader } = authOptions;
  const requestHeaders = {
    'User-Agent': 'Mozilla/5.0 (compatible; AI-Website-Analyzer-Active/1.0)'
  };
  if (authHeader) requestHeaders['Authorization'] = authHeader;
  if (authCookie) requestHeaders['Cookie'] = authCookie;

  const $ = cheerio.load(html);
  const forms = [];

  // Extract all forms on the page
  $('form').each((_, element) => {
    const form = $(element);
    const action = form.attr('action') || '';
    const method = (form.attr('method') || 'GET').toUpperCase();
    
    // Resolve absolute URL
    let absoluteAction = pageUrl;
    try {
      absoluteAction = new URL(action, pageUrl).href;
    } catch (_) {}

    const inputs = [];
    form.find('input, textarea, select').each((_, inputElement) => {
      const input = $(inputElement);
      const name = input.attr('name');
      const type = input.attr('type') || 'text';
      // Ignore submit, button, image, checkbox, radio types for raw string payloads
      if (name && !['submit', 'button', 'image', 'checkbox', 'radio'].includes(type.toLowerCase())) {
        inputs.push({ name, type });
      }
    });

    if (inputs.length > 0) {
      forms.push({ action: absoluteAction, method, inputs });
    }
  });

  // Limit forms checked per page to prevent scanning bloat
  const limitedForms = forms.slice(0, 3);

  for (const form of limitedForms) {
    // Check SSRF safety of the form action target
    if (!await isSafeUrl(form.action)) {
      console.warn(`[activeScanner] Form target ${form.action} blocked by SSRF guard`);
      continue;
    }

    // Probing inputs
    // Limit inputs probed to 3 per form
    const limitedInputs = form.inputs.slice(0, 3);

    for (const inputToProbe of limitedInputs) {
      // Apply delay/throttling to prevent firewall blocking
      if (delay > 0) {
        console.log(`[activeScanner] Throttling: sleeping for ${delay}ms before probing input ${inputToProbe.name}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // 1. Reflected XSS check
      try {
        const payloadData = {};
        // Populate default dummy data for all inputs
        form.inputs.forEach(inp => {
          payloadData[inp.name] = inp.name === inputToProbe.name ? XSS_PAYLOAD : 'test';
        });

        let response;
        if (form.method === 'POST') {
          response = await axios({
            url: form.action,
            method: 'POST',
            data: new URLSearchParams(payloadData).toString(),
            headers: {
              ...requestHeaders,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 6000,
            validateStatus: () => true
          });
        } else {
          response = await axios({
            url: form.action,
            method: 'GET',
            params: payloadData,
            headers: requestHeaders,
            timeout: 6000,
            validateStatus: () => true
          });
        }

        const body = typeof response.data === 'string' ? response.data : '';
        if (body.includes(XSS_PAYLOAD)) {
          findings.push({
            id: `reflected-xss-${inputToProbe.name}`,
            title: `Reflected XSS Vulnerability in input '${inputToProbe.name}'`,
            severity: 'high',
            category: 'Forms',
            description: `The input field '${inputToProbe.name}' reflects user-supplied content directly into the HTML response without adequate entity encoding or sanitization, allowing arbitrary script execution.`,
            remediation: `Sanitize all user inputs on the server and use context-aware HTML entity encoding before rendering them in the browser.`,
            owasp: 'A03:2021-Injection'
          });
        }
      } catch (err) {
        console.log(`[activeScanner] XSS probe failed for input ${inputToProbe.name}: ${err.message}`);
      }

      // 2. SQL Injection check
      try {
        const payloadData = {};
        // SQL syntax breaking character
        const SQLi_PAYLOAD = "test'";
        form.inputs.forEach(inp => {
          payloadData[inp.name] = inp.name === inputToProbe.name ? SQLi_PAYLOAD : 'test';
        });

        let response;
        if (form.method === 'POST') {
          response = await axios({
            url: form.action,
            method: 'POST',
            data: new URLSearchParams(payloadData).toString(),
            headers: {
              ...requestHeaders,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 6000,
            validateStatus: () => true
          });
        } else {
          response = await axios({
            url: form.action,
            method: 'GET',
            params: payloadData,
            headers: requestHeaders,
            timeout: 6000,
            validateStatus: () => true
          });
        }

        const body = typeof response.data === 'string' ? response.data : '';
        const hasSqlError = SQL_ERROR_PATTERNS.some(regex => regex.test(body));
        
        if (hasSqlError) {
          findings.push({
            id: `sql-injection-${inputToProbe.name}`,
            title: `Potential SQL Injection in input '${inputToProbe.name}'`,
            severity: 'critical',
            category: 'Forms',
            description: `The parameter '${inputToProbe.name}' triggered a database syntax error when injected with special characters. This indicates SQL queries are being directly concatenated with user inputs.`,
            remediation: `Use parameterized queries or prepared statements for all database transactions. Never concatenate inputs into raw SQL commands.`,
            owasp: 'A03:2021-Injection'
          });
        }
      } catch (err) {
        console.log(`[activeScanner] SQLi probe failed for input ${inputToProbe.name}: ${err.message}`);
      }

      // 3. Blind SQL Injection check (Time-based check)
      try {
        const payloadData = {};
        const BLIND_PAYLOAD = "test' OR SLEEP(5) --";
        form.inputs.forEach(inp => {
          payloadData[inp.name] = inp.name === inputToProbe.name ? BLIND_PAYLOAD : 'test';
        });

        const startTime = Date.now();
        let response;
        if (form.method === 'POST') {
          response = await axios({
            url: form.action,
            method: 'POST',
            data: new URLSearchParams(payloadData).toString(),
            headers: {
              ...requestHeaders,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 8000, // Timeout high enough to allow sleep to finish
            validateStatus: () => true
          });
        } else {
          response = await axios({
            url: form.action,
            method: 'GET',
            params: payloadData,
            headers: requestHeaders,
            timeout: 8000,
            validateStatus: () => true
          });
        }

        const duration = Date.now() - startTime;
        if (duration >= 4500) {
          findings.push({
            id: `sql-injection-blind-${inputToProbe.name}`,
            title: `Potential Blind SQL Injection (Time-Based) in input '${inputToProbe.name}'`,
            severity: 'critical',
            category: 'Forms',
            description: `The parameter '${inputToProbe.name}' triggered a response delay of ${duration}ms when injected with a sleep payload (expected 5000ms). This indicates the database engine executed the injected sleep command.`,
            remediation: `Use parameterized queries or prepared statements for all database transactions. Never concatenate inputs into raw SQL commands.`,
            owasp: 'A03:2021-Injection'
          });
        }
      } catch (err) {
        // Blind checks can timeout if successful, which is also an indicator!
        if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
          findings.push({
            id: `sql-injection-blind-${inputToProbe.name}`,
            title: `Potential Blind SQL Injection (Time-Based) in input '${inputToProbe.name}'`,
            severity: 'critical',
            category: 'Forms',
            description: `The parameter '${inputToProbe.name}' caused the request to timeout (exceeding 8000ms) when injected with a sleep payload. This strongly indicates the database is executing the sleep command.`,
            remediation: `Use parameterized queries or prepared statements for all database transactions. Never concatenate inputs into raw SQL commands.`,
            owasp: 'A03:2021-Injection'
          });
        } else {
          console.log(`[activeScanner] Blind SQLi check error for input ${inputToProbe.name}: ${err.message}`);
        }
      }

      // 4. Time-Based OS Command Injection check
      try {
        const payloadData = {};
        const CMD_PAYLOAD = "test; sleep 5; #";
        form.inputs.forEach(inp => {
          payloadData[inp.name] = inp.name === inputToProbe.name ? CMD_PAYLOAD : 'test';
        });

        const startTime = Date.now();
        if (form.method === 'POST') {
          await axios({
            url: form.action,
            method: 'POST',
            data: new URLSearchParams(payloadData).toString(),
            headers: {
              ...requestHeaders,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 8000,
            validateStatus: () => true
          });
        } else {
          await axios({
            url: form.action,
            method: 'GET',
            params: payloadData,
            headers: requestHeaders,
            timeout: 8000,
            validateStatus: () => true
          });
        }

        const duration = Date.now() - startTime;
        if (duration >= 4500) {
          findings.push({
            id: `cmd-injection-time-${inputToProbe.name}`,
            title: `Potential OS Command Injection (Time-Based) in input '${inputToProbe.name}'`,
            severity: 'critical',
            category: 'Forms',
            description: `The parameter '${inputToProbe.name}' triggered a response delay of ${duration}ms when injected with a command payload (expected 5000ms delay). This indicates the server passes input directly to an OS shell execution context.`,
            remediation: `Avoid passing raw user inputs to system execution wrappers (e.g. exec, spawn, system). Perform strict validation against an allowlist, or use parameterized APIs.`,
            owasp: 'A03:2021-Injection'
          });
        }
      } catch (err) {
        if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
          findings.push({
            id: `cmd-injection-time-${inputToProbe.name}`,
            title: `Potential OS Command Injection (Time-Based) in input '${inputToProbe.name}'`,
            severity: 'critical',
            category: 'Forms',
            description: `The parameter '${inputToProbe.name}' caused the request to timeout (exceeding 8000ms) when injected with a shell execution command. This indicates the server executed the command and hung/timed out.`,
            remediation: `Avoid passing raw user inputs to system execution wrappers (e.g. exec, spawn, system). Perform strict validation against an allowlist, or use parameterized APIs.`,
            owasp: 'A03:2021-Injection'
          });
        } else {
          console.log(`[activeScanner] Command Injection check error for input ${inputToProbe.name}: ${err.message}`);
        }
      }

      // 5. Path Traversal check
      const traversalPayloads = [
        '../../../../etc/passwd',
        '..\\..\\..\\..\\windows\\win.ini'
      ];
      
      for (const payload of traversalPayloads) {
        try {
          const payloadData = {};
          form.inputs.forEach(inp => {
            payloadData[inp.name] = inp.name === inputToProbe.name ? payload : 'test';
          });

          let response;
          if (form.method === 'POST') {
            response = await axios({
              url: form.action,
              method: 'POST',
              data: new URLSearchParams(payloadData).toString(),
              headers: {
                ...requestHeaders,
                'Content-Type': 'application/x-www-form-urlencoded'
              },
              timeout: 6000,
              validateStatus: () => true
            });
          } else {
            response = await axios({
              url: form.action,
              method: 'GET',
              params: payloadData,
              headers: requestHeaders,
              timeout: 6000,
              validateStatus: () => true
            });
          }

          const body = typeof response.data === 'string' ? response.data : '';
          const hasPasswd = /root:x:\d+:\d+:/i.test(body) || /\[extensions\]|\[fonts\]/i.test(body);
          
          if (hasPasswd) {
            findings.push({
              id: `path-traversal-${inputToProbe.name}`,
              title: `Path Traversal File Disclosure in input '${inputToProbe.name}'`,
              severity: 'critical',
              category: 'Forms',
              description: `The input field '${inputToProbe.name}' allows directory traversal. Submitting traversal payloads like '${payload}' leaked system files directly in the response.`,
              remediation: `Implement strict input validation (allowlist only), sanitize file paths, and resolve paths to their absolute canonical paths (e.g. using path.resolve) before checking permissions.`,
              owasp: 'A01:2021-Broken Access Control'
            });
            break; // Stop testing other traversal payloads if one succeeded
          }
        } catch (err) {
          console.log(`[activeScanner] Path traversal check error for input ${inputToProbe.name}: ${err.message}`);
        }
      }
    }
  }

  return findings;
}

module.exports = { 
  auditActiveVulnerabilities,
  checkHostHeaderInjection
};
