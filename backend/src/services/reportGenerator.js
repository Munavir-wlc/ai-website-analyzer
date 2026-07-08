/**
 * Report Generator - Merges analyzer results into normalized report format
 */

/** 0-100 to letter grade - KEEP UNCHANGED */
function scoreToGrade(score) {
  if (score == null || score < 0) return 'F';
  const s = Math.min(100, Math.round(score));
  if (s >= 97) return 'A+';
  if (s >= 93) return 'A';
  if (s >= 90) return 'A-';
  if (s >= 87) return 'B+';
  if (s >= 83) return 'B';
  if (s >= 80) return 'B-';
  if (s >= 77) return 'C+';
  if (s >= 73) return 'C';
  if (s >= 70) return 'C-';
  if (s >= 67) return 'D+';
  if (s >= 63) return 'D';
  if (s >= 60) return 'D-';
  return 'F';
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

function generateReport({ securityResult, url, scanDuration, scanMode, aiEnabled, loadTestResult, zapFindings, zapScanData }) {
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
    // New audit fields
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
    }
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
    report.findings = (securityResult.findings || []).map(normalizeFinding);
    
    // Recalculate score dynamically to handle additional findings (like XSS/SQLi or multi-page issues)
    let calculatedScore = 100;
    for (const finding of report.findings) {
      if (finding.id === 'sensitive-robots-paths') continue;
      
      const severity = finding.severity?.toLowerCase();
      const deductions = {
        critical: 20,
        high: 15,
        medium: 8,
        low: 4
      };
      const points = deductions[severity] || 5;
      calculatedScore -= points;
    }

    const robots = securityResult.robotsData || report.robotsData;
    if (robots && robots.exists && robots.sensitiveFound && robots.sensitiveFound.length > 0) {
      const robotsDeduction = Math.min(20, robots.sensitiveFound.length * 5);
      calculatedScore -= robotsDeduction;
    }

    report.score = Math.max(0, calculatedScore);
    report.grade = scoreToGrade(report.score);
    report.overallScore = report.score;
    report.overallGrade = report.grade;
    report.summary = securityResult.summary || '';
    report.positives = securityResult.positives || [];
    report.exposedFiles = securityResult.exposedFiles || [];

    // Map new fields
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

    // Calculate critical, high, medium, low counts across findings
    let criticalCount = 0;
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;

    for (const finding of report.findings) {
      const severity = finding.severity?.toLowerCase();
      if (severity === 'critical') criticalCount++;
      else if (severity === 'high') highCount++;
      else if (severity === 'medium') mediumCount++;
      else if (severity === 'low') lowCount++;
    }

    // Compute the VAPT Security Score formula: 100 - (30 * critical) - (15 * high) - (5 * medium) - (2 * low)
    const zapScore = 100 - (30 * criticalCount) - (15 * highCount) - (5 * mediumCount) - (2 * lowCount);
    report.securityScore = Math.max(0, zapScore);
    report.critical = criticalCount;
    report.high = highCount;
    report.medium = mediumCount;
    report.low = lowCount;

    // Override main score and grade to align the dashboard charts
    if (Array.isArray(zapFindings) && zapFindings.length > 0) {
      report.score = report.securityScore;
      report.grade = scoreToGrade(report.score);
      report.overallScore = report.score;
      report.overallGrade = report.grade;
    }

    // Populate vulnerabilities list
    report.vulnerabilities = report.findings;

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

module.exports = { generateReport };
