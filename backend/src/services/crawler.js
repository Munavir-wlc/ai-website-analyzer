const axios = require('axios');
const cheerio = require('cheerio');
const sslChecker = require('ssl-checker').default;
const dns = require('dns').promises;
const net = require('net');
const http = require('http');
const https = require('https');
const whoiser = require('whoiser');
const ssrfGuard = require('../utils/ssrfGuard');
const isSafeUrl = (urlOrHost) => ssrfGuard.isSafeUrl(urlOrHost);

const CRAWL_TIMEOUT = 15000; // 15 seconds

/**
 * Resolves a hostname to a safe IP and returns custom agents that pin the connection.
 * Bypasses DNS resolution for subsequent socket connections, preventing TOCTOU.
 */
async function resolveSafeIpAndGetAgents(hostname) {
  // If it's already an IP, validate it directly
  if (net.isIP(hostname)) {
    const { isPrivateIPv4, isPrivateIPv6 } = require('../utils/ssrfGuard');
    if (net.isIPv4(hostname) && isPrivateIPv4(hostname)) {
      throw new Error(`SSRF Guard: Unsafe IP ${hostname}`);
    }
    if (net.isIPv6(hostname) && isPrivateIPv6(hostname)) {
      throw new Error(`SSRF Guard: Unsafe IP ${hostname}`);
    }
    return { httpAgent: undefined, httpsAgent: undefined, resolvedIp: hostname };
  }

  // Resolve hostname
  let addresses = [];
  try {
    addresses = await dns.resolve(hostname);
  } catch (_) {
    try {
      const lookupRes = await dns.lookup(hostname, { all: true });
      addresses = lookupRes.map(item => item.address);
    } catch (err) {
      throw new Error(`SSRF Guard: DNS resolution failed for hostname ${hostname}`);
    }
  }

  if (!addresses || addresses.length === 0) {
    throw new Error(`SSRF Guard: DNS resolution returned no addresses for ${hostname}`);
  }

  const { isPrivateIPv4, isPrivateIPv6 } = require('../utils/ssrfGuard');

  // Verify all resolved addresses are safe
  for (const ip of addresses) {
    if (net.isIPv4(ip)) {
      if (isPrivateIPv4(ip)) throw new Error(`SSRF Guard: Unsafe IP ${ip} resolved for ${hostname}`);
    } else if (net.isIPv6(ip)) {
      if (isPrivateIPv6(ip)) throw new Error(`SSRF Guard: Unsafe IP ${ip} resolved for ${hostname}`);
    } else {
      throw new Error(`SSRF Guard: Invalid IP protocol type for ${hostname}`);
    }
  }

  // Pin to the first resolved address
  const pinnedIp = addresses[0];

  // Create a custom lookup function for this request
  const lookupFn = (hostToResolve, options, callback) => {
    if (hostToResolve === hostname) {
      return callback(null, pinnedIp, net.isIPv4(pinnedIp) ? 4 : 6);
    }
    dns.lookup(hostToResolve, options, callback);
  };

  const httpAgent = new http.Agent({ lookup: lookupFn, keepAlive: false });
  const httpsAgent = new https.Agent({ lookup: lookupFn, keepAlive: false });

  return { httpAgent, httpsAgent, resolvedIp: pinnedIp };
}

/**
 * Executes an HTTP request safely by resolving/pinning the target host and re-validating redirect hops.
 * @param {string} initialUrl - The starting URL
 * @param {Object} axiosConfig - Axios options (headers, timeout, method, data, etc.)
 * @param {number} maxHops - Maximum redirect hops allowed
 */
async function safeRequest(initialUrl, axiosConfig = {}, maxHops = 5) {
  let currentUrl = initialUrl;
  let currentMethod = axiosConfig.method || 'GET';
  let hops = 0;
  const redirectChain = [initialUrl];
  
  while (hops <= maxHops) {
    const urlObj = new URL(currentUrl);
    const hostname = urlObj.hostname;
    
    // Resolve DNS once to pin the IP and get safe lookup agents
    const { httpAgent, httpsAgent } = await resolveSafeIpAndGetAgents(hostname);
    
    const requestConfig = {
      ...axiosConfig,
      url: currentUrl,
      method: currentMethod,
      maxRedirects: 0, // Block Axios from following redirects internally
      validateStatus: () => true, // Don't throw on status codes
      httpAgent,
      httpsAgent
    };

    // Execute request
    const response = await axios(requestConfig);
    
    // Check if it's a redirect (only follow if it's a redirect status and has Location header)
    const isRedirect = response.status >= 300 && response.status < 400 && response.headers['location'];
    if (isRedirect) {
      const location = response.headers['location'];
      currentUrl = new URL(location, currentUrl).toString();
      redirectChain.push(currentUrl);
      // On redirect, follow standard HTTP client behavior: change method to GET
      currentMethod = 'GET';
      hops++;
      continue;
    }
    
    // If not a redirect, validate the status against caller's expected status rules
    const validateStatus = axiosConfig.validateStatus || ((status) => status >= 200 && status < 300);
    if (!validateStatus(response.status)) {
      const err = new Error(`Request failed with status code ${response.status}`);
      err.response = response;
      throw err;
    }
    
    // Return final response, setting response url and redirect chain
    response.config = response.config || {};
    response.config.url = currentUrl;
    response.redirectChain = redirectChain;
    return response;
  }
  
  throw new Error(`SSRF Guard: Max redirect hops (${maxHops}) exceeded`);
}

/**
 * Fetch a URL and return HTML, headers, and cheerio object
 */
async function crawl(url, auth = {}) {
  const normalizedUrl = normalizeUrl(url);
  if (!await isSafeUrl(normalizedUrl)) {
    console.error(`[crawler] Crawl blocked by SSRF guard for ${normalizedUrl}`);
    return null;
  }

  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };

    if (auth.authHeader) {
      headers['Authorization'] = auth.authHeader;
    }
    if (auth.authCookie) {
      headers['Cookie'] = auth.authCookie;
    }

    // Mask headers for secure logging
    const masked = { ...headers };
    if (masked['Authorization']) masked['Authorization'] = masked['Authorization'].substring(0, 15) + '...[REDACTED]';
    if (masked['Cookie']) masked['Cookie'] = masked['Cookie'].substring(0, 15) + '...[REDACTED]';
    console.log(`[crawler] Crawling URL: ${normalizedUrl} with headers:`, masked);

    const response = await safeRequest(normalizedUrl, {
      timeout: CRAWL_TIMEOUT,
      responseType: 'text',
      headers
    });

    console.log(`[crawler] Crawl success. URL: ${normalizedUrl}, Status: ${response.status}`);
    const html = typeof response.data === 'string' ? response.data : '';
    const finalUrl = response.config?.url || normalizedUrl;
    const $ = cheerio.load(html);

    return {
      html,
      url: finalUrl,
      finalUrl,
      statusCode: response.status,
      headers: response.headers,
      redirectChain: response.redirectChain || [normalizedUrl],
      $
    };
  } catch (err) {
    console.error(`[crawler] Crawl failed for ${normalizedUrl}: ${err.message}`);
    if (err.response) {
      console.error(`[crawler] Error Response Status: ${err.response.status}`);
      console.error(`[crawler] Error Response Headers:`, JSON.stringify(err.response.headers, null, 2));
      console.error(`[crawler] Error Response Body Preview:`, String(err.response.data || '').substring(0, 300));
    }
    return null;
  }
}

/**
 * Fetch and parse robots.txt to detect sensitive exposed endpoints
 */
async function fetchRobotsTxt(baseUrl, auth = {}) {
  try {
    const origin = new URL(baseUrl).origin;
    if (!await isSafeUrl(origin)) {
      return { exists: false, paths: [], sensitiveFound: [], raw: '' };
    }
    const robotsUrl = `${origin}/robots.txt`;
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };
    if (auth.authHeader) headers['Authorization'] = auth.authHeader;
    if (auth.authCookie) headers['Cookie'] = auth.authCookie;

    const res = await safeRequest(robotsUrl, {
      timeout: 5000,
      headers
    });
    
    if (res.status !== 200) {
      return { exists: false, paths: [], sensitiveFound: [], raw: '' };
    }
    
    const raw = typeof res.data === 'string' ? res.data : '';
    const lines = raw.split(/\r?\n/);
    const paths = [];
    const sensitiveKeywords = [
      '/admin', '/api', '/config', '/backup', '/database',
      '/phpmyadmin', '/wp-admin', '/dashboard', '/.env',
      '/private', '/secret', '/internal', '/dev'
    ];
    
    for (const line of lines) {
      const match = line.match(/^\s*(Allow|Disallow)\s*:\s*(.+)$/i);
      if (match) {
        const path = match[2].trim();
        if (path && !paths.includes(path)) {
          paths.push(path);
        }
      }
    }
    
    const sensitiveFound = paths.filter(path => 
      sensitiveKeywords.some(keyword => path.toLowerCase().includes(keyword.toLowerCase()))
    );
    
    return {
      exists: true,
      paths,
      sensitiveFound,
      raw
    };
  } catch (err) {
    return { exists: false, paths: [], sensitiveFound: [], raw: '' };
  }
}

/**
 * Fetch sitemap.xml - disabled for simplification
 */
async function fetchSitemap(baseUrl) {
  return null;
}

/**
 * Normalize URL - ensure protocol
 */
function normalizeUrl(url) {
  let u = url.trim();
  if (!/^https?:\/\//i.test(u)) {
    u = 'https://' + u;
  }
  return u;
}

/**
 * Check SSL validity and expiry (8 second timeout)
 */
async function checkSSL(url) {
  try {
    const hostname = new URL(url).hostname;
    if (!await isSafeUrl(hostname)) {
      return {
        valid: false,
        expireDate: null,
        daysRemaining: 0,
        issuer: 'Unknown',
        error: 'Blocked by SSRF guard'
      };
    }
    const res = await Promise.race([
      sslChecker(hostname),
      new Promise((_, reject) => setTimeout(() => reject(new Error('SSL check timeout')), 8000))
    ]);

    console.log('[crawler] checkSSL raw response:', res);

    let rawIssuer = res.issuer || res.ca || res.certIssuer || res.validFor;
    if (Array.isArray(rawIssuer)) {
      rawIssuer = rawIssuer[0];
    }
    const issuer = typeof rawIssuer === 'object' && rawIssuer !== null
      ? (rawIssuer.O || rawIssuer.CN || JSON.stringify(rawIssuer))
      : (rawIssuer || 'Unknown');

    return {
      valid: res.valid,
      expireDate: res.validTo,
      daysRemaining: res.daysRemaining,
      issuer,
      error: null
    };
  } catch (err) {
    return {
      valid: false,
      expireDate: null,
      daysRemaining: 0,
      issuer: 'Unknown',
      error: err.message
    };
  }
}

/**
 * Check DNS records using dns.promises
 */
async function checkDNS(domain) {
  if (!await isSafeUrl(domain)) {
    return { spf: null, spfPresent: false, dmarc: null, dmarcPresent: false, mx: false, ns: false, error: 'Blocked by SSRF guard' };
  }

  let spf = null;
  let spfPresent = false;
  let dmarc = null;
  let dmarcPresent = false;
  let mx = false;
  let ns = false;

  // Determine potential domains to query (subdomain first, then fallback to base root domain)
  const domainsToTry = [domain];
  if (domain.toLowerCase().startsWith('www.')) {
    domainsToTry.push(domain.substring(4));
  } else {
    const parts = domain.split('.');
    if (parts.length > 2) {
      const secondToLast = parts[parts.length - 2].toLowerCase();
      const rootParts = ['co', 'com', 'org', 'net', 'edu', 'gov'].includes(secondToLast) && parts.length > 3
        ? parts.slice(-3)
        : parts.slice(-2);
      const rootDomain = rootParts.join('.');
      if (rootDomain !== domain) {
        domainsToTry.push(rootDomain);
      }
    }
  }

  // 1. NS check
  for (const d of domainsToTry) {
    try {
      console.log(`[crawler] checkDNS: Resolving NS for ${d}`);
      let nsRecords = [];
      try {
        nsRecords = await dns.resolveNs(d);
      } catch (e) {
        console.log(`[crawler] checkDNS NS resolveNs failed for ${d}: ${e.message}, trying resolve('NS')`);
        try {
          nsRecords = await dns.resolve(d, 'NS');
        } catch (_) {}
      }
      console.log(`[crawler] checkDNS NS raw records for ${d}:`, nsRecords);
      if (nsRecords && nsRecords.length > 0) {
        ns = true;
        break;
      }
    } catch (err) {
      console.log(`[crawler] checkDNS NS lookup error for ${d}: ${err.message}`);
    }
  }

  // 2. MX check
  for (const d of domainsToTry) {
    try {
      console.log(`[crawler] checkDNS: Resolving MX for ${d}`);
      let mxRecords = [];
      try {
        mxRecords = await dns.resolveMx(d);
      } catch (e) {
        console.log(`[crawler] checkDNS MX resolveMx failed for ${d}: ${e.message}, trying resolve('MX')`);
        try {
          mxRecords = await dns.resolve(d, 'MX');
        } catch (_) {}
      }
      console.log(`[crawler] checkDNS MX raw records for ${d}:`, mxRecords);
      if (mxRecords && mxRecords.length > 0) {
        mx = true;
        break;
      }
    } catch (err) {
      console.log(`[crawler] checkDNS MX lookup error for ${d}: ${err.message}`);
    }
  }

  // 3. SPF check (all TXT records and look for v=spf1)
  for (const d of domainsToTry) {
    try {
      console.log(`[crawler] checkDNS: Resolving TXT for SPF on ${d}`);
      const txtRecords = await dns.resolveTxt(d);
      console.log(`[crawler] checkDNS SPF raw TXT records for ${d}:`, txtRecords);
      const spfRecord = txtRecords.flat().find(r => r.startsWith('v=spf1'));
      if (spfRecord) {
        spf = spfRecord;
        spfPresent = true;
        break;
      }
    } catch (err) {
      console.log(`[crawler] checkDNS SPF lookup error for ${d}: ${err.message}`);
    }
  }

  // 4. DMARC check (_dmarc.domain TXT records)
  for (const d of domainsToTry) {
    try {
      const dmarcDomain = `_dmarc.${d}`;
      console.log(`[crawler] checkDNS: Resolving TXT for DMARC on ${dmarcDomain}`);
      try {
        const txtRecords = await dns.resolveTxt(dmarcDomain);
        console.log(`[crawler] checkDNS DMARC raw TXT records for ${dmarcDomain}:`, txtRecords);
        const dmarcRecord = txtRecords.flat().find(r => r.startsWith('v=DMARC1'));
        if (dmarcRecord) {
          dmarc = dmarcRecord;
          dmarcPresent = true;
          break;
        }
      } catch (_) {}
    } catch (err) {
      console.log(`[crawler] checkDNS DMARC lookup error for ${d}: ${err.message}`);
    }
  }

  return { spf, spfPresent, dmarc, dmarcPresent, mx, ns, error: null };
}

/**
 * Check for exposed sensitive files (5 second timeout per request)
 */
async function checkExposedFiles(baseUrl, techStack = [], auth = {}) {
  const paths = [
    '/.env',
    '/.git/config',
    '/wp-config.php',
    '/phpinfo.php',
    '/backup.zip',
    '/.htaccess',
    '/phpmyadmin',
    '/admin.php',
    '/config.php',
    '/database.sql',
    '/dump.sql',
    '/.DS_Store'
  ];
  
  // Dynamic scoping based on techStack
  const filteredPaths = paths.filter(p => {
    // WordPress specific files
    if (['/wp-config.php', '/wp-login.php'].includes(p)) {
      return techStack.includes('WordPress');
    }
    // PHP specific files
    if (['/phpinfo.php', '/phpmyadmin', '/admin.php', '/config.php'].includes(p)) {
      return techStack.includes('Laravel') || techStack.includes('WordPress') || techStack.includes('PHP');
    }
    return true; // Return general config files
  });

  const exposed = [];
  
  try {
    const origin = new URL(baseUrl).origin;
    if (!await isSafeUrl(origin)) {
      return [];
    }

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };
    if (auth.authHeader) headers['Authorization'] = auth.authHeader;
    if (auth.authCookie) headers['Cookie'] = auth.authCookie;

    await Promise.all(filteredPaths.map(async (p) => {
      try {
        const res = await safeRequest(`${origin}${p}`, {
          timeout: 5000,
          validateStatus: (status) => status === 200,
          headers
        }, 2);
        if (res.status === 200) {
          exposed.push(p);
        }
      } catch (_) {}
    }));
  } catch (_) {}

  return exposed;
}

/**
 * Test PUT, DELETE, TRACE HTTP methods (5 second timeout)
 */
async function checkHttpMethods(url, auth = {}) {
  const methods = ['PUT', 'DELETE', 'TRACE'];
  const results = { put: false, delete: false, trace: false };

  try {
    if (!await isSafeUrl(url)) {
      return results;
    }
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };
    if (auth.authHeader) headers['Authorization'] = auth.authHeader;
    if (auth.authCookie) headers['Cookie'] = auth.authCookie;

    await Promise.all(methods.map(async (method) => {
      try {
        const res = await safeRequest(url, {
          method,
          timeout: 5000,
          validateStatus: () => true,
          headers
        });
        const status = res.status;
        if (status !== 405 && status !== 501) {
          results[method.toLowerCase()] = true;
        }
      } catch (_) {}
    }));
  } catch (_) {
    return { put: false, delete: false, trace: false };
  }

  return results;
}

/**
 * Helper to check TCP port connection using a socket with a 2-second timeout
 */
function checkPort(domain, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(2000);
    
    socket.on('connect', () => {
      socket.destroy();
      resolve({ port, open: true });
    });
    
    socket.on('timeout', () => {
      socket.destroy();
      resolve({ port, open: false });
    });
    
    socket.on('error', () => {
      socket.destroy();
      resolve({ port, open: false });
    });
    
    socket.connect(port, domain);
  });
}

/**
 * Scan standard administrative and database ports to check public exposure
 */
async function portScan(domain) {
  const ports = [21, 22, 23, 25, 53, 80, 110, 143, 443, 445, 1433, 3306, 3389, 5432, 6379, 27017, 8080];
  const services = {
    21: { name: 'FTP', dangerous: true },
    22: { name: 'SSH', dangerous: true },
    23: { name: 'Telnet', dangerous: true },
    25: { name: 'SMTP', dangerous: false },
    53: { name: 'DNS', dangerous: false },
    80: { name: 'HTTP', dangerous: false },
    110: { name: 'POP3', dangerous: false },
    143: { name: 'IMAP', dangerous: false },
    443: { name: 'HTTPS', dangerous: false },
    445: { name: 'SMB', dangerous: true },
    1433: { name: 'MSSQL', dangerous: true },
    3306: { name: 'MySQL', dangerous: true },
    3389: { name: 'RDP', dangerous: true },
    5432: { name: 'Postgres', dangerous: true },
    6379: { name: 'Redis', dangerous: true },
    27017: { name: 'MongoDB', dangerous: true },
    8080: { name: 'HTTP-Alt', dangerous: true }
  };

  const cleanDomain = (() => {
    try {
      if (/^https?:\/\//i.test(domain)) {
        return new URL(domain).hostname;
      }
      return domain;
    } catch (_) {
      return domain;
    }
  })();

  if (!await isSafeUrl(cleanDomain)) {
    return {
      scanned: false,
      openPorts: [],
      totalScanned: 0,
      error: 'Blocked by SSRF guard'
    };
  }

  try {
    const results = await Promise.all(ports.map(port => checkPort(cleanDomain, port)));
    const openPorts = results.filter(r => r.open).map(r => {
      const svc = services[r.port];
      return {
        port: r.port,
        service: svc.name,
        dangerous: svc.dangerous
      };
    });
    
    return {
      scanned: true,
      openPorts,
      totalScanned: ports.length
    };
  } catch (err) {
    return {
      scanned: false,
      openPorts: [],
      totalScanned: 0,
      error: err.message
    };
  }
}

/**
 * Manually trace HTTP redirect chain up to 10 hops
 */
async function analyzeRedirects(url, auth = {}) {
  const chain = [];
  let currentUrl = normalizeUrl(url);
  let isCrossDomain = false;
  let enforcesHttps = false;
  
  let initialUrlObj;
  try {
    initialUrlObj = new URL(currentUrl);
  } catch (err) {
    return {
      chain: [],
      redirectCount: 0,
      enforcesHttps: false,
      finalUrl: currentUrl,
      isCrossDomain: false
    };
  }
  
  const initialHostname = initialUrlObj.hostname.replace(/^www\./i, '');
  const initialProtocol = initialUrlObj.protocol;
  const seenUrls = new Set();
  
  try {
    for (let hop = 0; hop < 10; hop++) {
      if (seenUrls.has(currentUrl)) {
        break;
      }
      seenUrls.add(currentUrl);

      if (!await isSafeUrl(currentUrl)) {
        break;
      }

      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      };
      if (auth.authHeader) headers['Authorization'] = auth.authHeader;
      if (auth.authCookie) headers['Cookie'] = auth.authCookie;

      const res = await axios.get(currentUrl, {
        maxRedirects: 0,
        validateStatus: () => true,
        timeout: 5000,
        headers
      });

      chain.push({
        url: currentUrl,
        status: res.status,
        headers: res.headers || {}
      });

      const location = res.headers['location'];
      const isRedirect = res.status >= 300 && res.status < 400 && location;
      
      if (!isRedirect) {
        break;
      }

      currentUrl = new URL(location, currentUrl).toString();
    }
  } catch (err) {
    if (chain.length === 0) {
      chain.push({
        url: currentUrl,
        status: 500,
        headers: {}
      });
    }
  }

  const finalUrl = chain[chain.length - 1].url;
  let finalHostname = '';
  try {
    finalHostname = new URL(finalUrl).hostname.replace(/^www\./i, '');
  } catch (_) {
    finalHostname = finalUrl;
  }
  
  if (initialHostname !== finalHostname) {
    isCrossDomain = true;
  }

  if (initialProtocol === 'http:') {
    const hasHttpsHop = chain.some(hop => hop.url.startsWith('https://'));
    if (hasHttpsHop) {
      enforcesHttps = true;
    }
  } else if (initialProtocol === 'https:') {
    enforcesHttps = true;
  }

  return {
    chain,
    redirectCount: Math.max(0, chain.length - 1),
    enforcesHttps,
    finalUrl,
    isCrossDomain
  };
}

/**
 * WHOIS domain lookup using whoiser to check expiry details
 */
async function whoisLookup(domain) {
  try {
    const cleanDomain = domain.replace(/^www\./i, '');
    const rawResult = await whoiser.whoisDomain(cleanDomain, { follow: 2, timeout: 5000 });
    const first = whoiser.firstResult(rawResult);
    if (!first) {
      return { exists: false, registrar: 'Unknown', createdDate: null, expiryDate: null, daysRemaining: null };
    }

    const registrar = first['Registrar'] || first['registrar'] || 'Unknown';
    const expiryDateStr = first['Expiry Date'] || first['Registry Expiry Date'] || first['expires'] || first['Expiration Date'] || null;
    const createdDateStr = first['Created Date'] || first['Creation Date'] || first['registered'] || first['Registration Date'] || null;

    let daysRemaining = null;
    if (expiryDateStr) {
      const expiry = new Date(expiryDateStr);
      if (!isNaN(expiry.getTime())) {
        const diffTime = expiry.getTime() - Date.now();
        daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      }
    }

    return {
      exists: true,
      registrar,
      createdDate: createdDateStr,
      expiryDate: expiryDateStr,
      daysRemaining
    };
  } catch (err) {
    console.error(`[crawler] WHOIS lookup failed for ${domain}: ${err.message}`);
    return {
      exists: false,
      registrar: 'Unknown',
      createdDate: null,
      expiryDate: null,
      daysRemaining: null
    };
  }
}

module.exports = {
  crawl,
  fetchRobotsTxt,
  fetchSitemap,
  normalizeUrl,
  checkSSL,
  checkDNS,
  checkExposedFiles,
  checkHttpMethods,
  portScan,
  analyzeRedirects,
  whoisLookup
};
