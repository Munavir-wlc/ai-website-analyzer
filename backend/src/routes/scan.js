const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const crawler = require('../services/crawler');
const securityAnalyzer = require('../services/securityAnalyzer');
const reportGenerator = require('../services/reportGenerator');
const { crawlSite } = require('../services/siteCrawler');
const { auditActiveVulnerabilities } = require('../services/activeScanner');
const { auditLoadResilience } = require('../services/loadTester');
const { isSafeUrl } = require('../utils/ssrfGuard');
const { executeZapScan } = require('../services/zapScanner');
const { saveReport, getReport } = require('../services/reportStore');
const { capabilities } = require('../config/scanCapabilities');
const { optionalAuth, protect } = require('../middleware/auth');
const { checkScanQuota } = require('../middleware/quotaGuard');
const { scanCdnLibraries } = require('../services/cveScanner');
const { scanSubdomains } = require('../services/subdomainScanner');
const { addScanJob } = require('../services/scanQueue');
const { generateReportPDF } = require('../services/pdfGenerator');

function buildFinalReport(scanId, report, scanStatus = {}) {
  return {
    scanId,
    score: report.score,
    grade: report.grade,
    findings: report.findings,
    summary: report.summary,
    positives: report.positives,
    sslDetails: report.sslDetails,
    dnsDetails: report.dnsDetails,
    exposedFiles: report.exposedFiles,
    scannedUrl: report.url,
    scanDate: report.generatedAt,
    scanDuration: report.scanDuration,
    techStack: report.techStack,
    cookieAudit: report.cookieAudit,
    corsIssues: report.corsIssues,
    mixedContent: report.mixedContent,
    riskBreakdown: report.riskBreakdown,
    topPriority: report.topPriority,
    complianceFlags: report.complianceFlags,
    portScanData: report.portScanData,
    whoisData: report.whoisData,
    redirectData: report.redirectData,
    robotsData: report.robotsData,
    scanMode: report.scanMode,
    aiEnabled: report.aiEnabled,
    wafData: report.wafData,
    apiDiscoveryData: report.apiDiscoveryData,
    headersGrade: report.headersGrade,
    loadTestData: report.loadTestData,
    zapScanData: report.zapScanData,
    authCookie: report.authCookie || '',
    authHeader: report.authHeader || '',
    crawledPages: report.crawledPages || [],
    subdomainData: report.subdomainData || { scanned: false, discovered: [], sensitiveFound: [], totalDiscovered: 0 },
    scanStatus
  };
}

function maskReportForGuests(report) {
  if (!report) return null;
  return {
    scanId: report.scanId,
    score: report.score,
    grade: report.grade,
    scannedUrl: report.scannedUrl || report.url,
    scanDate: report.scanDate || report.generatedAt,
    scanDuration: report.scanDuration || 0,
    scanMode: report.scanMode || 'quick',
    summary: report.summary || '',
    riskBreakdown: report.riskBreakdown || { critical: 0, high: 0, medium: 0, low: 0 },
    findings: [],
    topPriority: [],
    sslDetails: { valid: report.sslDetails?.valid || false },
    dnsDetails: { spf: !!report.dnsDetails?.spf, dmarc: !!report.dnsDetails?.dmarc },
    exposedFiles: [],
    techStack: { cms: [], framework: [], server: [], analytics: [], libraries: [] },
    cookieAudit: [],
    corsIssues: [],
    mixedContent: [],
    portScanData: { scanned: false, openPorts: [], totalScanned: 0 },
    whoisData: { exists: false },
    redirectData: { chain: [], redirectCount: 0 },
    robotsData: { exists: false },
    wafData: { detected: false },
    apiDiscoveryData: { scanned: false },
    headersGrade: { score: 0, grade: 'F', breakdown: {} },
    complianceFlags: { gdpr: false, pci: false, hipaa: false },
    loadTestData: { scanned: false },
    zapScanData: { scanned: false },
    isLocked: true
  };
}

// GET /api/scan/results/:scanId
router.get('/results/:scanId', optionalAuth, async (req, res) => {
  const { scanId } = req.params;
  console.log(`[scanRoutes] GET results requested for scanId: ${scanId}`);

  try {
    const Scan = require('../models/Scan');
    const scan = await Scan.findOne({ scanId });
    
    if (!scan) {
      console.warn(`[scanRoutes] Scan report NOT found for ID: ${scanId}`);
      return res.status(404).json({ error: 'Scan report not found or expired.' });
    }

    // A. Allow read-only access for publicly shared reports
    if (scan.isPublic) {
      console.log(`[scanRoutes] Returning public shared report for ID: ${scanId}`);
      const belongsToCurrentUser = !!(req.user && scan.userId && scan.userId.toString() === req.user._id.toString());
      return res.json({
        ...scan.report,
        isPublic: true,
        belongsToCurrentUser
      });
    }

    // If request is authenticated
    if (req.user) {
      // If scan currently has no owner (guest scan), claim it!
      if (!scan.userId) {
        scan.userId = req.user._id;
        scan.expiresAt = null; // Claimed scans should never expire
        await scan.save();
        console.log(`[scanRoutes] Guest scan ${scanId} claimed by user ${req.user._id}`);
      } else if (scan.userId.toString() !== req.user._id.toString()) {
        // If scan belongs to someone else
        return res.status(403).json({ error: 'You are not authorized to view this report.' });
      }
      
      console.log(`[scanRoutes] Scan report found successfully for ID: ${scanId}`);
      return res.json({
        ...scan.report,
        isPublic: !!scan.isPublic,
        belongsToCurrentUser: true,
        findingStatuses: scan.findingStatuses ? Object.fromEntries(scan.findingStatuses) : {}
      });
    }

    // If request is NOT authenticated (Guest)
    if (scan.userId) {
      // If scan belongs to a user, guests cannot view it at all
      return res.status(401).json({ error: 'Authentication required to view this report.' });
    }

    // Return masked report for guests (no local scans bypass)
    console.log(`[scanRoutes] Returning masked guest scan report for ID: ${scanId}`);
    res.json({
      ...maskReportForGuests(scan.report),
      isPublic: false,
      belongsToCurrentUser: false
    });
  } catch (err) {
    console.error(`[scanRoutes] Failed to read scan report ${scanId}:`, err);
    res.status(500).json({ error: 'Failed to read scan report.' });
  }
});

router.get('/capabilities', (req, res) => {
  res.json(capabilities);
});

// PATCH /api/scan/results/:scanId/findings/:findingId/status
router.patch('/results/:scanId/findings/:findingId/status', protect, async (req, res) => {
  const { scanId, findingId } = req.params;
  const { status } = req.body;
  const validStatuses = ['open', 'accepted', 'in_progress'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }
  try {
    const Scan = require('../models/Scan');
    const scan = await Scan.findOne({ scanId });
    if (!scan) return res.status(404).json({ error: 'Scan not found' });
    if (!scan.userId || scan.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to update this scan.' });
    }
    if (!scan.findingStatuses) scan.findingStatuses = new Map();
    scan.findingStatuses.set(findingId, { status, updatedAt: new Date() });
    scan.markModified('findingStatuses');
    await scan.save();
    console.log(`[scanRoutes] Finding ${findingId} status updated to '${status}' for scan ${scanId}`);
    res.json({ findingId, status });
  } catch (err) {
    console.error('[scanRoutes] Failed to update finding status:', err);
    res.status(500).json({ error: 'Failed to update finding status.' });
  }
});

function extractDomainFromScan(scan) {
  if (scan.domain && scan.domain !== 'undefined' && scan.domain !== 'N/A') return scan.domain;
  if (scan.report && scan.report.domain) return scan.report.domain;
  if (scan.url) {
    try {
      const raw = scan.url.startsWith('http') ? scan.url : `https://${scan.url}`;
      return new URL(raw).hostname.replace(/^www\./, '');
    } catch (e) {}
  }
  return 'Unknown Website';
}

// GET /api/scan/analytics - User Analytics & Portfolio Health Metrics
router.get('/analytics', protect, async (req, res) => {
  try {
    const Scan = require('../models/Scan');
    const { teamId } = req.query;

    let query = {};
    if (teamId && teamId !== 'personal' && teamId !== 'null' && teamId !== 'undefined') {
      query = { teamId };
    } else {
      query = {
        userId: req.user._id,
        $or: [{ teamId: null }, { teamId: { $exists: false } }]
      };
    }

    const userScans = await Scan.find(query).sort({ createdAt: -1 });

    if (userScans.length === 0) {
      return res.json({
        totalScans: 0,
        avgScore: 0,
        scoreHistory: [],
        riskBreakdown: { critical: 0, high: 0, medium: 0, low: 0 },
        statusBreakdown: { open: 0, in_progress: 0, accepted: 0, resolved: 0 },
        assets: []
      });
    }

    const totalScans = userScans.length;
    const scores = userScans.map(s => s.score || 0);
    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / totalScans);

    // Score history chronologically
    const scoreHistory = userScans.slice(0, 20).reverse().map(s => {
      const zapScanned = !!(s.report?.zapScanData?.scanned);
      const scanDepth = s.scanMode === 'quick' 
        ? 'Quick' 
        : (zapScanned 
          ? `Full + ZAP (${(s.report?.scanStatus?.zapScanMode || 'low').toUpperCase()})` 
          : 'Full');
      return {
        scanId: s.scanId,
        date: new Date(s.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        score: s.score || 0,
        domain: extractDomainFromScan(s),
        scanMode: s.scanMode || 'quick',
        zapScanned,
        scanDepth
      };
    });

    // Aggregate Risk Breakdown & Finding Statuses
    const riskBreakdown = { critical: 0, high: 0, medium: 0, low: 0 };
    const statusBreakdown = { open: 0, in_progress: 0, accepted: 0, resolved: 0 };

    // Unique assets / domains
    const assetMap = new Map();

    userScans.forEach(scan => {
      const dom = extractDomainFromScan(scan);
      const breakdown = scan.riskBreakdown || {};
      riskBreakdown.critical += (breakdown.critical || 0);
      riskBreakdown.high += (breakdown.high || 0);
      riskBreakdown.medium += (breakdown.medium || 0);
      riskBreakdown.low += (breakdown.low || 0);

      // Track asset details
      if (dom && !assetMap.has(dom)) {
        assetMap.set(dom, {
          domain: dom,
          scannedUrl: scan.url,
          lastScanId: scan.scanId,
          lastScanDate: scan.createdAt,
          latestScore: scan.score || 0,
          totalFindings: scan.report?.findings ? scan.report.findings.length : 0
        });
      }

      // Count finding statuses
      const findingStatuses = scan.findingStatuses ? Object.fromEntries(scan.findingStatuses) : {};
      const findings = scan.report?.findings || [];
      findings.forEach(f => {
        const status = findingStatuses[f.id]?.status || 'open';
        if (statusBreakdown[status] !== undefined) {
          statusBreakdown[status]++;
        } else {
          statusBreakdown.open++;
        }
      });
    });

    const assets = Array.from(assetMap.values());

    res.json({
      totalScans,
      avgScore,
      scoreHistory,
      riskBreakdown,
      statusBreakdown,
      assets
    });
  } catch (err) {
    console.error('[scanRoutes] Analytics error:', err);
    res.status(500).json({ error: 'Failed to compute analytics.' });
  }
});

// GET /api/scan/compare - Side-by-Side Scan Diff Comparison
router.get('/compare', protect, async (req, res) => {
  const { baseScanId, targetScanId } = req.query;
  if (!baseScanId || !targetScanId) {
    return res.status(400).json({ error: 'baseScanId and targetScanId query parameters are required.' });
  }
  try {
    const Scan = require('../models/Scan');
    const baseScan = await Scan.findOne({ scanId: baseScanId });
    const targetScan = await Scan.findOne({ scanId: targetScanId });

    if (!baseScan || !targetScan) {
      return res.status(404).json({ error: 'One or both scans were not found.' });
    }

    const baseFindings = baseScan.report?.findings || [];
    const targetFindings = targetScan.report?.findings || [];

    const baseMap = new Map(baseFindings.map(f => [f.title, f]));
    const targetMap = new Map(targetFindings.map(f => [f.title, f]));

    const resolved = [];
    const newFindings = [];
    const persistent = [];
    const unverified = [];

    // Determine target scan capabilities
    const targetHasZap = !!(targetScan.report?.zapScanData?.scanned);
    const targetHasActive = targetScan.scanMode === 'full';

    // Find resolved, persistent, and unverified
    baseFindings.forEach(f => {
      if (targetMap.has(f.title)) {
        persistent.push({
          title: f.title,
          severity: f.severity,
          category: f.category,
          baseDescription: f.description,
          targetDescription: targetMap.get(f.title).description
        });
      } else {
        const normalized = reportGenerator.normalizeFinding(f);
        const isZapFinding = normalized.source === 'owasp-zap';
        const isActiveFinding = normalized.source === 'active-probe';

        let tested = true;
        if (isZapFinding && !targetHasZap) tested = false;
        if (isActiveFinding && !targetHasActive) tested = false;

        if (tested) {
          resolved.push({
            title: f.title,
            severity: f.severity,
            category: f.category,
            description: f.description
          });
        } else {
          unverified.push({
            title: f.title,
            severity: f.severity,
            category: f.category,
            description: f.description,
            reason: isZapFinding ? 'Not tested (Requires ZAP Scan)' : 'Not tested (Requires Full Scan)'
          });
        }
      }
    });

    // Find new findings
    targetFindings.forEach(f => {
      if (!baseMap.has(f.title)) {
        newFindings.push({
          title: f.title,
          severity: f.severity,
          category: f.category,
          description: f.description
        });
      }
    });

    const scoreDelta = (targetScan.score || 0) - (baseScan.score || 0);

    res.json({
      baseScan: {
        scanId: baseScan.scanId,
        domain: baseScan.domain,
        url: baseScan.url,
        createdAt: baseScan.createdAt,
        score: baseScan.score || 0,
        grade: baseScan.grade || 'F',
        findingCount: baseFindings.length
      },
      targetScan: {
        scanId: targetScan.scanId,
        domain: targetScan.domain,
        url: targetScan.url,
        createdAt: targetScan.createdAt,
        score: targetScan.score || 0,
        grade: targetScan.grade || 'F',
        findingCount: targetFindings.length
      },
      scoreDelta,
      diff: {
        resolved,
        new: newFindings,
        persistent,
        unverified
      }
    });
  } catch (err) {
    console.error('[scanRoutes] Compare error:', err);
    res.status(500).json({ error: 'Failed to generate scan comparison diff.' });
  }
});

// POST /api/scan/chat - AI Vulnerability Assistant Chat
router.post('/chat', async (req, res) => {
  const { finding, messages } = req.body;
  if (!finding || !finding.title) {
    return res.status(400).json({ error: 'Finding context is required.' });
  }
  try {
    const { chatWithFindingAssistant } = require('../services/aiEngine');
    const reply = await chatWithFindingAssistant(finding, messages || []);
    res.json({ reply });
  } catch (err) {
    console.error('[scanRoutes] Chat assistant error:', err);
    res.status(500).json({ error: 'Failed to process AI chat query.' });
  }
});


// POST /api/scan
router.post('/', optionalAuth, checkScanQuota, async (req, res) => {
  const startTime = Date.now();
  const userId = req.user ? req.user._id : null;
  const scanId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
  
  try {
    let { url, consent, mode, socketId, authCookie, authHeader, delay, useZap, zapScanMode, teamId } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'url is required' });
    }
    if (!consent) {
      return res.status(400).json({ error: 'User consent is required before performing security scans.' });
    }

    const hasConsent = !!consent;
    const scanMode = mode || 'full'; // 'quick' or 'full'
    const throttleDelay = Math.min(5000, Math.max(0, parseInt(delay, 10) || 0));
    const useAuthenticatedScan = capabilities.authenticatedScans;
    const authOptions = useAuthenticatedScan ? { authCookie, authHeader } : {};
    authCookie = authOptions.authCookie || '';
    authHeader = authOptions.authHeader || '';
    const shouldRunActive = scanMode === 'full' && capabilities.activeScans;
    const shouldRunLoadTest = scanMode === 'full' && capabilities.loadTesting;
    const shouldRunZap = scanMode === 'full' && capabilities.zapScans; // Automatically enable ZAP for every deep scan if enabled
    const runAi = capabilities.aiFindings && hasConsent && scanMode === 'full';
    let activeScanData = { scanned: false, status: scanMode === 'full' && !capabilities.activeScans ? 'disabled' : 'not_applicable', findingsCount: 0 };

    // Normalize URL
    const normalizedUrl = crawler.normalizeUrl(url);

    // Validate hostname resolving target to block private IPs
    if (!await isSafeUrl(normalizedUrl)) {
      return res.status(400).json({ error: 'URL blocked: Private, local, or loopback network addresses are not permitted.' });
    }

    // Get io instance
    const io = req.app.get('io');
    const clientSocket = io && socketId ? io.to(socketId) : null;

    const emitStep = (step, status, details = {}) => {
      if (clientSocket) {
        clientSocket.emit('scan_progress', {
          scanId,
          step,
          status,
          ...details
        });
      }
    };

    if (shouldRunZap) {
      const queued = await addScanJob({
        scanId,
        userId,
        normalizedUrl,
        authOptions,
        authCookie,
        authHeader,
        shouldRunActive,
        shouldRunLoadTest,
        shouldRunZap,
        zapScanMode: zapScanMode || 'low',
        runAi,
        socketId,
        delay: throttleDelay,
        startTime
      });

      if (!queued) {
        return res.status(429).json({ error: 'Scan queue is full. Please try again later.' });
      }

      res.status(202).json({
        scanId,
        status: 'processing',
        message: 'Deep Security Scan (OWASP ZAP) queued successfully. The report will be delivered over WebSockets.'
      });
      return;
    }

    // Sync scanning flow (when useZap is false)
    // 1. Crawling Step
    emitStep('crawling', 'in_progress');
    console.log(`[scan] [${scanId}] Starting crawl for: ${normalizedUrl} (consent: ${hasConsent}, mode: ${scanMode})`);
    const crawlerResult = await crawler.crawl(normalizedUrl, authOptions);
    if (crawlerResult) {
      crawlerResult.authCookie = authCookie;
      crawlerResult.authHeader = authHeader;
    }
    
    if (!crawlerResult) {
      emitStep('crawling', 'failed', { error: 'Failed to crawl website' });
      return res.status(400).json({ error: 'Failed to crawl URL. Check that it is valid and accessible.' });
    }
    emitStep('crawling', 'completed');

    // 2. Define step progress callback for security analyzer
    const onStep = (stepName, status) => {
      emitStep(stepName, status);
    };

    // Run security analyzer passing consent, mode and callback
    console.log(`[scan] [${scanId}] Running security and VAPT checks (consent: ${hasConsent})`);
    
    const securityResult = await securityAnalyzer.analyzeSecurity(crawlerResult, runAi, onStep);

    // If full scan mode is enabled, run multi-page crawling and active form probing
    if (scanMode === 'full') {
      // 1. Multi-page passive audit (mixed-content and cookies flags)
      emitStep('crawling', 'in_progress', { message: 'Mapping site pages...' });
      try {
        console.log(`[scan] [${scanId}] Initiating multi-page audit via siteCrawler`);
        const siteCrawl = await crawlSite(normalizedUrl, authOptions);
        if (siteCrawl && siteCrawl.pages && siteCrawl.pages.length > 1) {
          const cheerio = require('cheerio');
          for (const page of siteCrawl.pages) {
            // Skip the landing page as it was already analyzed by securityAnalyzer
            if (page.url === crawlerResult.url) continue;

            // Audit cookies set on other sub-pages
            const rawHeaders = page.headers || {};
            const setCookieHeader = rawHeaders['set-cookie'] || rawHeaders['Set-Cookie'];
            if (setCookieHeader) {
              const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
              for (const cookieStr of cookies) {
                const nameMatch = cookieStr.match(/^\s*([^=;]+)/);
                const name = nameMatch ? nameMatch[1].trim() : 'Unknown';
                const httpOnly = /;\s*HttpOnly/i.test(cookieStr);
                const secure = /;\s*Secure/i.test(cookieStr);
                const sameSiteMatch = cookieStr.match(/;\s*SameSite\s*=\s*([^;]+)/i);
                const sameSite = sameSiteMatch ? sameSiteMatch[1].trim() : 'None';
                
                if (!securityResult.cookieAudit.some(c => c.name === name)) {
                  securityResult.cookieAudit.push({ name, httpOnly, secure, sameSite });
                  if (!httpOnly) {
                    securityResult.findings.push({
                      id: `cookie-httponly-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
                      title: `Cookie '${name}' missing HttpOnly flag`,
                      severity: 'medium',
                      category: 'Cookies',
                      description: `The cookie '${name}' can be accessed by scripts, increasing session-hijacking vulnerability via XSS.`,
                      remediation: `Configure the cookie '${name}' with the HttpOnly flag.`,
                      owasp: 'A05:2021 Security Misconfiguration'
                    });
                  }
                  if (!secure) {
                    securityResult.findings.push({
                      id: `cookie-secure-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
                      title: `Cookie '${name}' missing Secure flag`,
                      severity: 'medium',
                      category: 'Cookies',
                      description: `The cookie '${name}' is transmitted in cleartext on insecure HTTP requests.`,
                      remediation: `Configure the cookie '${name}' with the Secure flag.`,
                      owasp: 'A05:2021 Security Misconfiguration'
                    });
                  }
                }
              }
            }

            // Audit mixed content on other sub-pages
            if (page.url.startsWith('https://') && page.html) {
              const $ = cheerio.load(page.html);
              $('img, script, link, iframe').each((_, el) => {
                const src = $(el).attr('src') || $(el).attr('href');
                if (src && src.startsWith('http://')) {
                  if (!securityResult.mixedContent.includes(src)) {
                    securityResult.mixedContent.push(src);
                  }
                }
              });
            }
          }

          if (securityResult.mixedContent.length > 0 && !securityResult.findings.some(f => f.id === 'mixed-content')) {
            securityResult.findings.push({
              id: 'mixed-content',
              title: 'Mixed Content Detected',
              severity: 'medium',
              category: 'Scripts',
              description: `HTTPS page loads insecure HTTP resources.`,
              remediation: 'Serve all referenced assets (images, stylesheets, scripts) over secure HTTPS connections.',
              owasp: 'A05:2021 Security Misconfiguration'
            });
          }
        }
        // Store the list of crawled pages URLs in the security result
        if (siteCrawl && siteCrawl.pages) {
          securityResult.crawledPages = siteCrawl.pages.map(p => ({
            url: p.url,
            statusCode: p.statusCode || 200
          }));
        }
      } catch (err) {
        console.error('Multi-page crawl security audit failed:', err);
      }
      emitStep('crawling', 'completed');

      // 2. Active forms probing (reflected XSS & SQLi)
      activeScanData = { scanned: false, status: capabilities.activeScans ? 'not_requested' : 'disabled', findingsCount: 0 };
      if (shouldRunActive) {
        emitStep('file_check', 'in_progress', { message: 'Probing input forms for SQLi and XSS...' });
      try {
        console.log(`[scan] [${scanId}] Initiating active forms probing`);
        const activeFindings = await auditActiveVulnerabilities(crawlerResult.html, crawlerResult.url, authOptions, throttleDelay);
        activeScanData.scanned = true;
        activeScanData.status = 'completed';
        activeScanData.findingsCount = activeFindings.length;
        if (activeFindings && activeFindings.length > 0) {
          for (const af of activeFindings) {
            if (!securityResult.findings.some(f => f.id === af.id)) {
              securityResult.findings.push(af);
            }
          }
        }
      } catch (err) {
        console.error('Active forms scanning failed:', err);
        activeScanData.status = 'failed';
        activeScanData.error = err.message;
      }
      emitStep('file_check', 'completed');
      }
    }

    let loadTestResult = { scanned: false, verdict: scanMode === 'full' && !capabilities.loadTesting ? 'Skipped: Load resilience testing is disabled.' : 'Skipped: Load resilience test is only executed in Full scan mode.' };
    if (shouldRunLoadTest) {
      // 3. Load Resilience & Rate Limiting Test
      emitStep('load_test', 'in_progress', { message: 'Auditing load resilience & rate limiting...' });
      try {
        console.log(`[scan] [${scanId}] Initiating load resilience test`);
        loadTestResult = await auditLoadResilience(crawlerResult.url, authOptions);
      } catch (err) {
        console.error('Load resilience audit failed:', err);
        loadTestResult = { scanned: false, verdict: `Scan Failure: Load resilience check failed: ${err.message}` };
      }
      emitStep('load_test', 'completed');
    }

    // CVE Library scan on HTML
    emitStep('cve_scan', 'in_progress');
    try {
      const cveFindings = await scanCdnLibraries(crawlerResult.html);
      if (cveFindings.length > 0) {
        for (const cf of cveFindings) {
          if (!securityResult.findings.some(f => f.id === cf.id)) {
            securityResult.findings.push(cf);
          }
        }
        console.log(`[scan] CVE scan found ${cveFindings.length} library vulnerabilities`);
      }
      emitStep('cve_scan', 'completed');
    } catch (err) {
      console.warn('[scan] CVE library scan failed silently:', err.message);
      emitStep('cve_scan', 'failed');
    }

    // Subdomain Enumeration
    emitStep('subdomain_scan', 'in_progress');
    try {
      const subdomainData = await scanSubdomains(normalizedUrl);
      securityResult.subdomainData = subdomainData;
      if (subdomainData.sensitiveFound && subdomainData.sensitiveFound.length > 0) {
        securityResult.findings.push({
          id: 'exposed-sensitive-subdomains',
          title: `${subdomainData.sensitiveFound.length} Sensitive Subdomain(s) Exposed`,
          severity: 'high',
          category: 'Reconnaissance',
          description: `Discovered sensitive subdomains: ${subdomainData.sensitiveFound.map(s => s.subdomain).join(', ')}. These may expose internal admin panels, dev environments, or staging servers.`,
          remediation: 'Restrict access to internal subdomains using firewall rules or authentication. Remove unused development subdomains from public DNS.',
          owasp: 'A01:2021 Broken Access Control'
        });
      }
      emitStep('subdomain_scan', 'completed');
    } catch (err) {
      console.warn('[scan] Subdomain scan failed silently:', err.message);
      emitStep('subdomain_scan', 'failed');
    }

    const scanDuration = parseFloat(((Date.now() - startTime) / 1000).toFixed(2));

    // Generate the report
    const report = reportGenerator.generateReport({
      securityResult,
      url: crawlerResult.url,
      scanDuration,
      scanMode,
      aiEnabled: runAi,
      loadTestResult
    });

    // Send completed event to WebSocket if exists
    emitStep('complete', 'completed', { score: report.score, grade: report.grade });

    const finalReport = buildFinalReport(scanId, report, {
      capabilities,
      activeScanData: activeScanData || { scanned: false, status: 'not_applicable', findingsCount: 0 },
      authenticatedScan: !!(authCookie || authHeader),
      requestedZap: shouldRunZap,
      zapRequestStatus: shouldRunZap ? 'completed' : (capabilities.zapScans ? 'not_applicable_for_quick_scan' : 'disabled')
    });
    console.log(`[scanRoutes] Persisting sync scan report. ID: ${scanId}`);
    await saveReport(scanId, finalReport, userId, teamId);

    if (!userId) {
      res.json(maskReportForGuests(finalReport));
    } else {
      res.json(finalReport);
    }
  } catch (err) {
    console.error('Scan error:', err);
    res.status(500).json({ error: err.message || 'Scan failed' });
  }
});

// POST /api/scan/results/:scanId/share
router.post('/results/:scanId/share', protect, async (req, res) => {
  const { scanId } = req.params;
  try {
    const Scan = require('../models/Scan');
    const scan = await Scan.findOne({ scanId });
    if (!scan) {
      return res.status(404).json({ error: 'Scan not found' });
    }
    if (!scan.userId || scan.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'You are not authorized to share this scan.' });
    }
    
    // Toggle public sharing status
    scan.isPublic = !scan.isPublic;
    await scan.save();
    
    console.log(`[scanRoutes] Public sharing status toggled to ${scan.isPublic} for scan: ${scanId}`);
    res.json({ isPublic: scan.isPublic });
  } catch (err) {
    console.error('[scanRoutes] Failed to toggle scan sharing:', err);
    res.status(500).json({ error: 'Failed to share scan.' });
  }
});

// GET /api/scan/results/:scanId/pdf or /api/scan/:scanId/pdf
router.get(['/results/:scanId/pdf', '/:scanId/pdf'], optionalAuth, async (req, res) => {
  const { scanId } = req.params;
  try {
    const reportData = await getReport(scanId);
    if (!reportData) {
      return res.status(404).json({ error: 'Scan report not found' });
    }

    const pdfBuffer = await generateReportPDF(reportData);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=security-report-${scanId}.pdf`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('[scanRoutes] Failed to generate PDF report:', err);
    res.status(500).json({ error: 'Failed to generate PDF report.' });
  }
});

module.exports = router;
