const dns = require('dns').promises;
const net = require('net');

/**
 * Checks if an IPv4 address is private or local.
 */
function isPrivateIPv4(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return true;

  // 127.0.0.0/8 (Loopback)
  if (parts[0] === 127) return true;

  // 10.0.0.0/8 (Private)
  if (parts[0] === 10) return true;

  // 172.16.0.0/12 (Private)
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;

  // 192.168.0.0/16 (Private)
  if (parts[0] === 192 && parts[1] === 168) return true;

  // 169.254.0.0/16 (Link-local, AWS/GCP metadata)
  if (parts[0] === 169 && parts[1] === 254) return true;

  // 0.0.0.0 (Unspecified)
  if (parts[0] === 0) return true;

  return false;
}

/**
 * Checks if an IPv6 address is private or local.
 */
function isPrivateIPv6(ip) {
  const normalized = ip.toLowerCase().trim();
  
  if (normalized === '::1' || normalized === '::') return true;
  if (normalized.startsWith('fe80:')) return true;
  if (normalized.startsWith('fc00:') || normalized.startsWith('fd00:')) return true;
  
  // Handle IPv4-mapped IPv6 (e.g., ::ffff:127.0.0.1 or ::ffff:7f00:1)
  if (normalized.includes('::ffff:')) {
    const parts = normalized.split(':');
    const lastPart = parts[parts.length - 1];
    
    // Case 1: Dot-decimal suffix (e.g. ::ffff:127.0.0.1)
    if (net.isIPv4(lastPart)) {
      return isPrivateIPv4(lastPart);
    }
    
    // Case 2: Hex suffix (e.g. ::ffff:7f00:0001)
    const seg1 = parts[parts.length - 2];
    const seg2 = parts[parts.length - 1];
    if (seg1 && seg2 && seg1.length <= 4 && seg2.length <= 4) {
      const s1 = seg1.padStart(4, '0');
      const s2 = seg2.padStart(4, '0');
      const h1 = parseInt(s1.substring(0, 2), 16);
      const h2 = parseInt(s1.substring(2, 4), 16);
      const h3 = parseInt(s2.substring(0, 2), 16);
      const h4 = parseInt(s2.substring(2, 4), 16);
      if (!isNaN(h1) && !isNaN(h2) && !isNaN(h3) && !isNaN(h4)) {
        const ipv4 = `${h1}.${h2}.${h3}.${h4}`;
        return isPrivateIPv4(ipv4);
      }
    }
  }
  
  return false;
}

/**
 * Validates if a hostname or URL resolves to a public, non-private IP address.
 * @param {string} targetUrlOrHost - URL or raw domain name
 * @returns {Promise<boolean>} True if target resolves only to public, safe IPs, otherwise False
 */
async function isSafeUrl(targetUrlOrHost) {
  if (process.env.ALLOW_LOCAL_SCANS === 'true') {
    return true;
  }
  try {
    let host = targetUrlOrHost.trim();
    
    // Parse host if target is a URL
    if (/^https?:\/\//i.test(host)) {
      try {
        host = new URL(host).hostname;
      } catch (_) {
        return false;
      }
    }

    // Check if it's already a direct IP address
    if (net.isIP(host)) {
      if (net.isIPv4(host)) {
        return !isPrivateIPv4(host);
      }
      if (net.isIPv6(host)) {
        return !isPrivateIPv6(host);
      }
      return false;
    }

    // Resolve DNS records
    let addresses = [];
    try {
      addresses = await dns.resolve(host);
    } catch (_) {
      try {
        const lookupRes = await dns.lookup(host, { all: true });
        addresses = lookupRes.map(item => item.address);
      } catch (_) {
        return false;
      }
    }

    if (!addresses || addresses.length === 0) {
      return false;
    }

    for (const ip of addresses) {
      if (net.isIPv4(ip)) {
        if (isPrivateIPv4(ip)) return false;
      } else if (net.isIPv6(ip)) {
        if (isPrivateIPv6(ip)) return false;
      } else {
        return false;
      }
    }

    return true;
  } catch (err) {
    console.error(`[ssrfGuard] Error checking target safety: ${err.message}`);
    return false;
  }
}

module.exports = { isSafeUrl, isPrivateIPv4, isPrivateIPv6 };
