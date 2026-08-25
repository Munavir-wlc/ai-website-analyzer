/**
 * Report Generator - Merges analyzer results into normalized report format
 */
const scoringEngine = require('./scoringEngine');

/** 0-100 to letter grade */
function scoreToGrade(score) {
  return scoringEngine.scoreToLetterGrade(score);
}

function normalizeFinding(finding) {
  const id = String(finding.id || '');
  const category = String(finding.category || '');
  const source = finding.source
    || (id.startsWith('zap-') || category === 'VAPT Scan' ? 'owasp-zap'
      : id.startsWith('reflected-xss-') || id.startsWith('sql-injection-') || id.startsWith('cmd-injection-') || id.startsWith('path-traversal-') ? 'active-probe'
      : 'deterministic');

  const confidence = finding.confidence
    || (source === 'owasp-zap' || source === 'active-probe' ? 'medium' : 'high');

  return {
    ...finding,
    source,
    confidence
  };
}

function generateReport({ 
  securityResult, 
  performanceResult,
  accessibilityResult,
  seoResult,
  aiSearchResult,
  crawlerResult,
  url, 
  scanDuration, 
  scanMode, 
  aiEnabled, 
  loadTestResult, 
  zapFindings, 
  zapScanData 
}) {
  const report = {
    url,
    domain: null,
    score: 0,
    grade: 'F',
    overallScore: 0,
    overallGrade: 'F',
    generatedAt: new Date().toISOString(),
    scanDuration: scanDuration || 0,
    scanMode: scanMode || 'full',
    aiEnabled: !!aiEnabled,
    summary: '',
    positives: [],
    findings: [],
    findingsByCategory: {},
    sslDetails: {
      valid: false,
      expireDate: null,
      daysRemaining: 0,
      issuer: 'Unknown',
      error: null
    },
    dnsDetails: {
      spf: null,
      dmarc: null,
      mx: false,
      ns: false,
      error: null
    },
    exposedFiles: [],
    techStack: { cms: [], framework: [], server: [], analytics: [], libraries: [] },
    cookieAudit: [],
    corsIssues: [],
    mixedContent: [],
    portScanData: { scanned: false, openPorts: [], totalScanned: 0 },
    whoisData: { exists: false, registrar: 'Unknown', createdDate: null, expiryDate: null, daysRemaining: null },
    redirectData: { chain: [], redirectCount: 0, enforcesHttps: false, finalUrl: '', isCrossDomain: false },
    robotsData: { exists: false, paths: [], sensitiveFound: [], raw: '' },
    wafData: { detected: false, name: null, confidence: 'low', source: null },
    apiDiscoveryData: { scanned: false, swaggerDocs: [], apiRoutes: [], totalDiscovered: 0 },
    headersGrade: { score: 0, grade: 'F', breakdown: {} },
    riskBreakdown: { critical: 0, high: 0, medium: 0, low: 0 },
    topPriority: [],
    complianceFlags: { gdpr: false, pci: false, hipaa: false },
    loadTestData: {
      scanned: false,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      avgResponseTimeMs: 0,
      minResponseTimeMs: 0,
      maxResponseTimeMs: 0,
      requestsPerSecond: 0,
      statusCodes: {},
      rateLimitDetected: false,
      rateLimitHeadersFound: [],
      verdict: 'No load resilience test was executed.'
    },
    zapScanData: {
      scanned: false,
      available: false,
      status: 'not_requested',
      error: null,
      findingsCount: 0
    },
    // New expanded audit properties
    performanceData: performanceResult || { opportunities: [], diagnostics: [], performanceScore: 100 },
    accessibilityData: accessibilityResult || { findings: [], accessibilityScore: 100 },
    seoData: seoResult || { findings: [], seoScore: 100, details: {} },
    aiSearchData: aiSearchResult || { findings: [], aiSearchScore: 100, details: {} },
    categoryScores: {}
  };

  if (zapScanData) {
    report.zapScanData = {
      scanned: !!zapScanData.scanned,
      available: !!zapScanData.available,
      status: zapScanData.status || (zapScanData.scanned ? 'completed' : 'skipped'),
      error: zapScanData.error || null,
      findingsCount: Array.isArray(zapScanData.findings) ? zapScanData.findings.length : 0
    };
  } else if (Array.isArray(zapFindings)) {
    report.zapScanData = {
      scanned: zapFindings.length > 0,
      available: zapFindings.length > 0,
      status: zapFindings.length > 0 ? 'completed' : 'not_requested',
      error: null,
      findingsCount: zapFindings.length
    };
  }

  if (loadTestResult) {
    report.loadTestData = {
      scanned: loadTestResult.scanned || false,
      totalRequests: loadTestResult.totalRequests || 0,
      successfulRequests: loadTestResult.successfulRequests || 0,
      failedRequests: loadTestResult.failedRequests || 0,
      avgResponseTimeMs: loadTestResult.avgResponseTimeMs || 0,
      minResponseTimeMs: loadTestResult.minResponseTimeMs || 0,
      maxResponseTimeMs: loadTestResult.maxResponseTimeMs || 0,
      requestsPerSecond: loadTestResult.requestsPerSecond || 0,
      statusCodes: loadTestResult.statusCodes || {},
      rateLimitDetected: !!loadTestResult.rateLimitDetected,
      rateLimitHeadersFound: loadTestResult.rateLimitHeadersFound || [],
      verdict: loadTestResult.verdict || ''
    };
  }

  try {
    report.domain = new URL(url).hostname;
  } catch {
    report.domain = url;
  }

  if (securityResult) {
    report.summary = securityResult.summary || '';
    report.positives = securityResult.positives || [];
    report.exposedFiles = securityResult.exposedFiles || [];

    // Map security fields
    report.techStack = securityResult.techStack || report.techStack;
    report.cookieAudit = securityResult.cookieAudit || [];
    report.corsIssues = securityResult.corsIssues || [];
    report.mixedContent = securityResult.mixedContent || [];
    report.portScanData = securityResult.portScanData || report.portScanData;
    report.whoisData = securityResult.whoisData || report.whoisData;
    report.redirectData = securityResult.redirectData || report.redirectData;
    report.robotsData = securityResult.robotsData || report.robotsData;
    report.wafData = securityResult.wafData || report.wafData;
    report.apiDiscoveryData = securityResult.apiDiscoveryData || report.apiDiscoveryData;
    report.headersGrade = securityResult.headersGrade || report.headersGrade;
    report.authCookie = securityResult.authCookie || '';
    report.authHeader = securityResult.authHeader || '';
    report.crawledPages = securityResult.crawledPages || [];

    // Calculate VAPT Security Score
    let criticalCount = 0;
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;

    for (const finding of (securityResult.findings || [])) {
      const severity = finding.severity?.toLowerCase();
      if (severity === 'critical') criticalCount++;
      else if (severity === 'high') highCount++;
      else if (severity === 'medium') mediumCount++;
      else if (severity === 'low') lowCount++;
    }
    const secScore = Math.max(0, 100 - (30 * criticalCount) - (15 * highCount) - (5 * mediumCount) - (2 * lowCount));
    report.securityScore = secScore;

    // Run scoring engine
    const categoryScores = scoringEngine.calculateScores({
      securityResult: { score: secScore },
      performanceResult,
      seoResult,
      accessibilityResult,
      aiSearchResult,
      crawlerResult: crawlerResult || { html: '' }
    });

    report.categoryScores = categoryScores;
    report.score = categoryScores.overall;
    report.grade = categoryScores.overallGrade;
    report.overallScore = categoryScores.overall;
    report.overallGrade = categoryScores.overallGrade;

    // Map Performance opportunities as findings
    const perfFindings = (performanceResult?.opportunities || []).map(o => ({
      id: o.id,
      title: o.title,
      severity: o.severity,
      category: 'Performance',
      description: o.description,
      remediation: o.remediation
    }));

    // Merge all findings
    const allFindings = [
      ...(securityResult.findings || []),
      ...perfFindings,
      ...(accessibilityResult?.findings || []),
      ...(seoResult?.findings || []),
      ...(aiSearchResult?.findings || []),
      ...(categoryScores.contentFindings || [])
    ].map(normalizeFinding);

    report.findings = allFindings;
    report.vulnerabilities = allFindings;

    // Parse SSL details
    if (securityResult.sslData) {
      report.sslDetails = {
        valid: securityResult.sslData.valid || false,
        expireDate: securityResult.sslData.expireDate || null,
        daysRemaining: securityResult.sslData.daysRemaining || 0,
        issuer: securityResult.sslData.issuer || 'Unknown',
        error: securityResult.sslData.error || null
      };
    }

    // Parse DNS details
    if (securityResult.dnsData) {
      report.dnsDetails = {
        spf: securityResult.dnsData.spf || null,
        dmarc: securityResult.dnsData.dmarc || null,
        mx: securityResult.dnsData.mx || false,
        ns: securityResult.dnsData.ns || false,
        error: securityResult.dnsData.error || null
      };
    }

    // Group findings and calculate severity counts
    const grouped = {};
    const breakdown = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const finding of report.findings) {
      const cat = finding.category || 'General';
      if (!grouped[cat]) {
        grouped[cat] = [];
      }
      grouped[cat].push(finding);

      const sev = finding.severity?.toLowerCase();
      if (breakdown[sev] !== undefined) {
        breakdown[sev]++;
      }
    }
    report.findingsByCategory = grouped;
    report.riskBreakdown = breakdown;

    // Calculate top 3 priority findings (ordered critical -> high -> medium -> low)
    const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    const sortedFindings = [...report.findings].sort((a, b) => {
      const aVal = severityOrder[a.severity?.toLowerCase()] || 0;
      const bVal = severityOrder[b.severity?.toLowerCase()] || 0;
      return bVal - aVal;
    });
    report.topPriority = sortedFindings.slice(0, 3);

    // Compute compliance risks
    const hasCookieRisk = report.findings.some(f => f.category === 'Cookies');
    const hasSslRisk = report.findings.some(f => f.category === 'SSL' || f.id?.includes('ssl') || f.id?.includes('https'));
    const hasExposedRisk = report.findings.some(f => f.id?.includes('exposed') || f.id?.includes('file'));
    const hasHstsRisk = report.findings.some(f => f.id?.includes('hsts') || f.id?.includes('strict-transport'));

    // Fail GDPR if domain registration expires in less than 30 days
    const domainExpiresSoon = report.whoisData && report.whoisData.exists && report.whoisData.daysRemaining !== null && report.whoisData.daysRemaining < 30;
    const gdpr = hasCookieRisk || hasSslRisk || hasExposedRisk || domainExpiresSoon;

    // Fail PCI if open dangerous ports exist
    const hasOpenDangerousPorts = report.portScanData && report.portScanData.openPorts && report.portScanData.openPorts.some(p => p.dangerous);
    const pci = report.score < 75 || report.findings.some(f => f.severity === 'critical' || f.severity === 'high') || hasOpenDangerousPorts;

    const hipaa = hasHstsRisk || hasSslRisk || report.findings.some(f => f.severity === 'critical');

    report.complianceFlags = { gdpr, pci, hipaa };

    report.critical = breakdown.critical;
    report.high = breakdown.high;
    report.medium = breakdown.medium;
    report.low = breakdown.low;

    // Compile recommendations
    report.recommendations = report.findings.map((f) => ({
      id: f.id,
      title: f.title,
      severity: f.severity,
      description: f.description,
      remediation: f.remediation,
      owasp: f.owasp,
      cwe: f.cwe
    }));
  }

  return report;
}

module.exports = { generateReport, normalizeFinding };
