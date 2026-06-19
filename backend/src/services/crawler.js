const axios = require('axios');
const cheerio = require('cheerio');
const sslChecker = require('ssl-checker').default;
const dns = require('dns').promises;
const net = require('net');
const whoiser = require('whoiser');

const CRAWL_TIMEOUT = 15000; // 15 seconds

/**
 * Fetch a URL and return HTML, headers, and cheerio object
 */
async function crawl(url) {
  const normalizedUrl = normalizeUrl(url);

  try {
    const response = await axios({
      url: normalizedUrl,
      method: 'GET',
      timeout: CRAWL_TIMEOUT,
      maxRedirects: 5,
      responseType: 'text',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const html = typeof response.data === 'string' ? response.data : '';
    const finalUrl = response.request?.res?.responseUrl || response.config?.url || normalizedUrl;
    const $ = cheerio.load(html);

    return {
      html,
      url: finalUrl,
      finalUrl,
      statusCode: response.status,
      headers: response.headers,
      redirectChain: [normalizedUrl],
      $
    };
  } catch (err) {
    console.error(`[crawler] Crawl failed for ${normalizedUrl}: ${err.message}`);
    return null;
  }
}

/**
 * Fetch and parse robots.txt to detect sensitive exposed endpoints
 */
async function fetchRobotsTxt(baseUrl) {
  try {
    const origin = new URL(baseUrl).origin;
    const robotsUrl = `${origin}/robots.txt`;
    const res = await axios.get(robotsUrl, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
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
    const res = await Promise.race([
      sslChecker(hostname),
      new Promise((_, reject) => setTimeout(() => reject(new Error('SSL check timeout')), 8000))
    ]);

    return {
      valid: res.valid,
      expireDate: res.validTo,
      daysRemaining: res.daysRemaining,
      issuer: res.validFor?.[0] || 'Unknown',
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
  let spf = null;
  let dmarc = null;
  let mx = false;
  let ns = false;
  let error = null;

  try {
    const txt = await dns.resolveTxt(domain);
    const record = txt.flat().find(r => r.startsWith('v=spf1'));
    if (record) spf = record;
  } catch (_) {}

  try {
    const txt = await dns.resolveTxt(`_dmarc.${domain}`);
    const record = txt.flat().find(r => r.startsWith('v=DMARC1'));
    if (record) dmarc = record;
  } catch (_) {}

  try {
    const mxRecords = await dns.resolveMx(domain);
    mx = mxRecords.length > 0;
  } catch (_) {}

  try {
    const nsRecords = await dns.resolveNs(domain);
    ns = nsRecords.length > 0;
  } catch (_) {}

  return { spf, dmarc, mx, ns, error };
}

/**
 * Check for exposed sensitive files (5 second timeout per request)
 */
async function checkExposedFiles(baseUrl) {
  const paths = [
    '/.env',
    '/.git/config',
    '/wp-config.php',
    '/phpinfo.php',
    '/backup.zip',
    '/.htaccess',
    '/admin',
    '/robots.txt',
    '/.well-known/security.txt'
  ];
  const exposed = [];
  
  try {
    const origin = new URL(baseUrl).origin;
    await Promise.all(paths.map(async (p) => {
      try {
        const res = await axios.get(`${origin}${p}`, {
          timeout: 5000,
          validateStatus: (status) => status === 200,
          maxRedirects: 2,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });
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
async function checkHttpMethods(url) {
  const methods = ['PUT', 'DELETE', 'TRACE'];
  const results = { put: false, delete: false, trace: false };

  try {
    await Promise.all(methods.map(async (method) => {
      try {
        const res = await axios({
          url,
          method,
          timeout: 5000,
          validateStatus: () => true,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
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
  const ports = [21, 22, 23, 25, 53, 80, 110, 143, 443, 445, 1433, 3306, 3389, 5432, 8080];
  const services = {
    21: { name: 'FTP', dangerous: true },
    22: { name: 'SSH', dangerous: false },
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
    8080: { name: 'HTTP-Alt', dangerous: false }
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
async function analyzeRedirects(url) {
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

      const res = await axios.get(currentUrl, {
        maxRedirects: 0,
        validateStatus: () => true,
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
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
