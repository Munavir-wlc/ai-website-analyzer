const securityAnalyzer = require('../src/services/securityAnalyzer');
const crawler = require('../src/services/crawler');

jest.setTimeout(20000);

// Mock external network calls during securityAnalyzer unit tests
jest.mock('../src/services/crawler', () => {
  const original = jest.requireActual('../src/services/crawler');
  return {
    ...original,
    checkSSL: jest.fn().mockResolvedValue({ valid: true, daysRemaining: 120 }),
    checkDNS: jest.fn().mockResolvedValue({ spf: true, dmarc: true }),
    portScan: jest.fn().mockResolvedValue({ scanned: true, openPorts: [], totalScanned: 15 }),
    whoisLookup: jest.fn().mockResolvedValue({ exists: true, registrar: 'Test Registrar', expiryDate: '2030-01-01', daysRemaining: 365 }),
    analyzeRedirects: jest.fn().mockResolvedValue({ chain: [], redirectCount: 0, enforcesHttps: true, isCrossDomain: false }),
    fetchRobotsTxt: jest.fn().mockResolvedValue({ exists: false, paths: [], sensitiveFound: [] }),
    checkExposedFiles: jest.fn().mockResolvedValue([]),
    checkHttpMethods: jest.fn().mockResolvedValue({ allowed: ['GET', 'POST'], risky: [] })
  };
});

describe('Security Analyzer Scoring Unit Tests', () => {
  it('should return a high score for a securely configured website', async () => {
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
  });

  it('should deduct points for missing security headers', async () => {
    const mockCrawler = {
      url: 'http://insecure-example.com',
      html: '<html><head></head><body><h1>Insecure</h1></body></html>',
      headers: {},
      ssl: { valid: false, daysRemaining: 0 },
      dns: { spf: false, dmarc: false }
    };

    const result = await securityAnalyzer.analyzeSecurity(mockCrawler, false);
    expect(result.score).toBeLessThan(80);
    expect(result.findings.some(f => f.category === 'Headers' || f.category === 'SSL/TLS')).toBe(true);
  });

  it('should flag wildcard CORS headers', async () => {
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
