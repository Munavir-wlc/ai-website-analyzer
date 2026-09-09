const axios = require('axios');
const securityAnalyzer = require('../src/services/securityAnalyzer');
const { fingerprint, detectTechnologies } = require('../src/services/techFingerprint');
const { matchCVEs, checkOsvVulnerabilities, clearCache, resolveEcosystem } = require('../src/services/cveScanner');

jest.setTimeout(20000);
jest.mock('axios');

// Mock external network calls during securityAnalyzer unit tests
jest.mock('../src/services/crawler', () => {
  const original = jest.requireActual('../src/services/crawler');
  return {
    ...original,
    checkSSL: jest.fn().mockResolvedValue({ valid: true, daysRemaining: 120 }),
    checkDNS: jest.fn().mockResolvedValue({ spf: true, dmarc: true }),
    whoisLookup: jest.fn().mockResolvedValue({ exists: true, registrar: 'Test Registrar', expiryDate: '2030-01-01', daysRemaining: 365 }),
    analyzeRedirects: jest.fn().mockResolvedValue({ chain: [], redirectCount: 0, enforcesHttps: true, isCrossDomain: false }),
    fetchRobotsTxt: jest.fn().mockResolvedValue({ exists: false, paths: [], sensitiveFound: [] }),
    checkExposedFiles: jest.fn().mockResolvedValue([]),
    checkHttpMethods: jest.fn().mockResolvedValue({ allowed: ['GET', 'POST'], risky: [] })
  };
});

describe('Passive Technology Fingerprinting (techFingerprint.js)', () => {
  it('should extract WordPress version from meta generator tag', () => {
    const html = '<html><head><meta name="generator" content="WordPress 6.4.2" /></head><body></body></html>';
    const results = fingerprint(html, {});
    
    const wp = results.find(r => r.name === 'WordPress');
    expect(wp).toBeDefined();
    expect(wp.version).toBe('6.4.2');
    expect(wp.confidence).toBe('high');
    expect(wp.evidence).toContain('WordPress 6.4.2');
  });

  it('should extract jQuery version from script src filename and query params', () => {
    const html = '<html><head><script src="/static/js/jquery-3.5.0.min.js"></script></head><body></body></html>';
    const results = fingerprint(html, {});
    
    const jq = results.find(r => r.name === 'jQuery');
    expect(jq).toBeDefined();
    expect(jq.version).toBe('3.5.0');
    expect(jq.confidence).toBe('high');
    expect(jq.ecosystem).toBe('npm');
  });

  it('should extract server and framework details from response headers', () => {
    const headers = {
      'server': 'nginx/1.18.0',
      'x-powered-by': 'Next.js 14.1.0'
    };
    const results = fingerprint('', headers);

    const nginx = results.find(r => r.name === 'nginx');
    expect(nginx).toBeDefined();
    expect(nginx.version).toBe('1.18.0');

    const next = results.find(r => r.name === 'Next.js');
    expect(next).toBeDefined();
    expect(next.version).toBe('14.1.0');
  });

  it('should return categorized dictionary from detectTechnologies', () => {
    const html = '<meta name="generator" content="WordPress 6.4.2"><div data-reactroot=""></div>';
    const headers = { server: 'nginx' };
    const detected = detectTechnologies(html, headers);

    expect(detected.cms).toContain('WordPress');
    expect(detected.framework).toContain('React');
    expect(detected.server).toContain('nginx');
  });
});

describe('CVE Matching & OSV Integration (cveScanner.js)', () => {
  beforeEach(() => {
    clearCache();
    jest.clearAllMocks();
  });

  it('should correctly resolve ecosystem for known technologies', () => {
    expect(resolveEcosystem({ name: 'jQuery', packageName: 'jquery' })).toEqual({ ecosystem: 'npm', name: 'jquery' });
    expect(resolveEcosystem({ name: 'WordPress' })).toEqual({ ecosystem: 'Packagist', name: 'johnpbloch/wordpress-core' });
    expect(resolveEcosystem({ name: 'Django' })).toEqual({ ecosystem: 'PyPI', name: 'django' });
    expect(resolveEcosystem({ name: 'UnknownTech' })).toBeNull();
  });

  it('should match CVEs from OSV API and normalize findings', async () => {
    const mockOsvResponse = {
      status: 200,
      data: {
        vulns: [
          {
            id: 'GHSA-j8xg-fqg3-53r8',
            aliases: ['CVE-2020-11022'],
            summary: 'Cross-site Scripting in jQuery',
            details: 'jQuery versions prior to 3.5.0 are vulnerable to XSS.',
            database_specific: {
              cvss: { score: 7.5 }
            },
            references: [
              { url: 'https://nvd.nist.gov/vuln/detail/CVE-2020-11022' }
            ],
            affected: [
              {
                ranges: [
                  {
                    events: [{ introduced: '0' }, { fixed: '3.5.0' }]
                  }
                ]
              }
            ]
          }
        ]
      }
    };

    axios.post.mockResolvedValueOnce(mockOsvResponse);

    const fingerprints = [
      { name: 'jQuery', version: '3.4.1', confidence: 'high', ecosystem: 'npm', packageName: 'jquery' }
    ];

    const findings = await matchCVEs(fingerprints);
    expect(findings.length).toBe(1);
    expect(findings[0].cveId).toBe('CVE-2020-11022');
    expect(findings[0].severity).toBe('high');
    expect(findings[0].technology).toBe('jQuery');
    expect(findings[0].version).toBe('3.4.1');
    expect(findings[0].fixVersion).toBe('3.5.0');
    expect(findings[0].references).toContain('https://nvd.nist.gov/vuln/detail/CVE-2020-11022');
  });

  it('should cache OSV query responses to avoid repeat network requests', async () => {
    const mockOsvResponse = {
      status: 200,
      data: {
        vulns: [
          {
            id: 'CVE-2020-11022',
            summary: 'XSS in jQuery',
            severity: 'HIGH'
          }
        ]
      }
    };

    axios.post.mockResolvedValue(mockOsvResponse);

    const fingerprints = [
      { name: 'jQuery', version: '3.4.1', confidence: 'high', ecosystem: 'npm', packageName: 'jquery' }
    ];

    // First call: calls axios.post
    const firstCall = await matchCVEs(fingerprints);
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(firstCall.length).toBe(1);

    // Second call: served from memoryCache without calling axios.post again
    const secondCall = await matchCVEs(fingerprints);
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(secondCall.length).toBe(1);
  });

  it('should handle OSV API failures gracefully without throwing', async () => {
    axios.post.mockRejectedValueOnce(new Error('Connection timeout'));

    const fingerprints = [
      { name: 'jQuery', version: '3.4.1', confidence: 'high', ecosystem: 'npm', packageName: 'jquery' }
    ];

    const findings = await matchCVEs(fingerprints);
    expect(findings).toEqual([]);
  });
});

describe('Security Analyzer Scoring Unit Tests', () => {
  beforeEach(() => {
    clearCache();
    jest.clearAllMocks();
  });

  it('should return a high score for a securely configured website without open port deductions', async () => {
    axios.post.mockResolvedValue({ status: 200, data: { vulns: [] } });

    const mockCrawler = {
      url: 'https://secure-example.com',
      html: '<html><head></head><body><h1>Secure</h1></body></html>',
      headers: {
        'strict-transport-security': 'max-age=63072000; includeSubDomains; preload',
        'content-security-policy': "default-src 'self'",
        'x-frame-options': 'DENY',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'strict-origin-when-cross-origin'
      },
      ssl: { valid: true, daysRemaining: 120 },
      dns: { spf: true, dmarc: true },
      authCookie: '',
      authHeader: ''
    };

    const result = await securityAnalyzer.analyzeSecurity(mockCrawler, false);
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.score).toBeDefined();
    expect(result.portScanData).toEqual({ scanned: false, openPorts: [], totalScanned: 0 });
  });

  it('should deduct points for detected CVE matches based on severity', async () => {
    const mockOsvResponse = {
      status: 200,
      data: {
        vulns: [
          {
            id: 'CVE-2023-9999',
            summary: 'Critical vulnerability in WordPress',
            database_specific: {
              cvss: { score: 9.8 } // Critical: -20
            }
          }
        ]
      }
    };

    axios.post.mockResolvedValue(mockOsvResponse);

    const mockCrawler = {
      url: 'https://vulnerable-wp-example.com',
      html: '<html><head><meta name="generator" content="WordPress 6.0.0" /></head><body><h1>WP</h1></body></html>',
      headers: {
        'strict-transport-security': 'max-age=63072000; includeSubDomains; preload',
        'content-security-policy': "default-src 'self'",
        'x-frame-options': 'DENY',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'strict-origin-when-cross-origin'
      },
      ssl: { valid: true, daysRemaining: 120 },
      dns: { spf: true, dmarc: true }
    };

    const result = await securityAnalyzer.analyzeSecurity(mockCrawler, false);
    const cveFinding = result.findings.find(f => f.cveId === 'CVE-2023-9999');
    expect(cveFinding).toBeDefined();
    expect(cveFinding.severity).toBe('critical');
    // Score should have deducted 20 points for critical
    expect(result.score).toBeLessThanOrEqual(80);
  });

  it('should flag wildcard CORS headers', async () => {
    axios.post.mockResolvedValue({ status: 200, data: { vulns: [] } });

    const mockCrawler = {
      url: 'https://cors-example.com',
      html: '<html></html>',
      headers: {
        'access-control-allow-origin': '*'
      },
      ssl: { valid: true, daysRemaining: 90 },
      dns: { spf: true, dmarc: true }
    };

    const result = await securityAnalyzer.analyzeSecurity(mockCrawler, false);
    expect(result.corsIssues.length).toBeGreaterThan(0);
    expect(result.findings.some(f => f.id === 'wildcard-cors')).toBe(true);
  });
});
