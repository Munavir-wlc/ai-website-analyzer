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

function generateReport({ securityResult, url, scanDuration }) {
  const report = {
    url,
    domain: null,
    score: 0,
    grade: 'F',
    overallScore: 0,
    overallGrade: 'F',
    generatedAt: new Date().toISOString(),
    scanDuration: scanDuration || 0,
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
    riskBreakdown: { critical: 0, high: 0, medium: 0, low: 0 },
    topPriority: [],
    complianceFlags: { gdpr: false, pci: false, hipaa: false }
  };

  try {
    report.domain = new URL(url).hostname;
  } catch {
    report.domain = url;
  }

  if (securityResult) {
    report.findings = securityResult.findings || [];
    
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
  }

  return report;
}

module.exports = { generateReport };