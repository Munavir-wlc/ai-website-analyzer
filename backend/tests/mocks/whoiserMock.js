async function whoisDomain(domain) {
  return {
    'whois.verisign-grs.com': {
      'Domain Name': domain,
      'Registrar': 'Example Registrar Inc.',
      'Creation Date': '2020-01-01T00:00:00Z',
      'Registry Expiry Date': '2030-01-01T00:00:00Z'
    }
  };
}

async function whoiser(domain) {
  return whoisDomain(domain);
}

whoiser.whoisDomain = whoisDomain;
whoiser.firstResult = function(data) {
  if (!data) return null;
  const keys = Object.keys(data);
  return keys.length > 0 ? data[keys[0]] : null;
};

module.exports = whoiser;
