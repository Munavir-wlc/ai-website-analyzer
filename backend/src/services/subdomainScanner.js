const dns = require('dns').promises;

// Common subdomain wordlist
const SUBDOMAIN_WORDLIST = [
  'www', 'api', 'admin', 'staging', 'dev', 'development', 'test', 'beta',
  'mail', 'email', 'smtp', 'ftp', 'sftp', 'ssh', 'vpn', 'remote',
  'shop', 'store', 'blog', 'forum', 'help', 'support', 'docs', 'cdn',
  'static', 'assets', 'media', 'img', 'images', 'status', 'monitor',
  'dashboard', 'portal', 'app', 'apps', 'mobile', 'auth', 'login', 'account'
];

const SENSITIVE_SUBDOMAINS = new Set([
  'admin', 'staging', 'dev', 'development', 'test', 'beta',
  'ftp', 'sftp', 'ssh', 'vpn', 'remote', 'dashboard', 'portal', 'auth', 'login'
]);

/**
 * Scans for discovered subdomains by DNS resolution.
 * @param {string} url - Target URL string
 * @returns {Promise<Object>} Subdomain scan results
 */
async function scanSubdomains(url) {
  let hostname;
  try {
    hostname = new URL(url).hostname;
  } catch {
    hostname = url;
  }

  // Strip leading www
  const baseDomain = hostname.replace(/^www\./, '');

  const results = [];
  const checks = SUBDOMAIN_WORDLIST.map(async (sub) => {
    const fqdn = `${sub}.${baseDomain}`;
    try {
      const address = await dns.lookup(fqdn);
      results.push({
        subdomain: fqdn,
        prefix: sub,
        ip: address.address,
        isSensitive: SENSITIVE_SUBDOMAINS.has(sub)
      });
    } catch {
      // DNS resolution failed = subdomain doesn't exist, ignore silently
    }
  });

  await Promise.allSettled(checks);

  const sensitiveFound = results.filter(r => r.isSensitive);

  console.log(`[subdomainScanner] Found ${results.length} subdomains for ${baseDomain} (${sensitiveFound.length} sensitive)`);

  return {
    scanned: true,
    baseDomain,
    discovered: results,
    sensitiveFound,
    totalDiscovered: results.length
  };
}

module.exports = { scanSubdomains };
