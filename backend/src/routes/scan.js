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
const { optionalAuth } = require('../middleware/auth');

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
    scanStatus
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

    // Access control: if the scan belongs to a user, verify authentication
    if (scan.userId) {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required to view this report.' });
      }
      if (scan.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ error: 'You are not authorized to view this report.' });
      }
    }

    console.log(`[scanRoutes] Scan report found successfully for ID: ${scanId}`);
    res.json(scan.report);
  } catch (err) {
    console.error(`[scanRoutes] Failed to read scan report ${scanId}:`, err);
    res.status(500).json({ error: 'Failed to read scan report.' });
  }
});

router.get('/capabilities', (req, res) => {
  res.json(capabilities);
});

// Async Scan Execution Queue
const scanQueue = [];
let queueProcessing = false;

function enqueueScan(scanTask) {
  if (scanQueue.length >= capabilities.maxQueueSize) {
    return false;
  }
  scanQueue.push(scanTask);
  triggerQueueProcessor();
  return true;
}

async function triggerQueueProcessor() {
  if (queueProcessing) return;
  if (scanQueue.length === 0) return;

  queueProcessing = true;
  const currentTask = scanQueue.shift();
  try {
    await currentTask();
  } catch (err) {
    console.error('[scanQueue] Error processing queued scan task:', err);
  } finally {
    queueProcessing = false;
    triggerQueueProcessor();
  }
}

// POST /api/scan
router.post('/', optionalAuth, async (req, res) => {
  const startTime = Date.now();
  const userId = req.user ? req.user._id : null;
  const scanId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
  
  try {
    let { url, consent, mode, socketId, authCookie, authHeader, delay, useZap } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'url is required' });
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
    const shouldRunZap = scanMode === 'full' && !!useZap && capabilities.zapScans;
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
      // 1. Immediately return 202 processing status to prevent HTTP connection timeout
      const queued = enqueueScan(async () => {
        try {
          console.log(`[scan] [${scanId}] [Async Queue] Starting crawl for: ${normalizedUrl}`);
          emitStep('crawling', 'in_progress');
          const crawlerResult = await crawler.crawl(normalizedUrl, authOptions);
          if (crawlerResult) {
            crawlerResult.authCookie = authCookie;
            crawlerResult.authHeader = authHeader;
          }
          if (!crawlerResult) {
            emitStep('crawling', 'failed', { error: 'Failed to crawl website' });
            return;
          }
          emitStep('crawling', 'completed');

          // Run security audits
          console.log(`[scan] [${scanId}] [Async Queue] Running deterministic checks`);
          const securityResult = await securityAnalyzer.analyzeSecurity(crawlerResult, runAi, (stepName, status) => {
            emitStep(stepName, status);
          });

          // Run multi-page crawl checks
          try {
            console.log(`[scan] [${scanId}] [Async Queue] Initiating multi-page audit via siteCrawler`);
            const siteCrawl = await crawlSite(normalizedUrl, authOptions);
            if (siteCrawl && siteCrawl.pages && siteCrawl.pages.length > 1) {
              const cheerio = require('cheerio');
              for (const page of siteCrawl.pages) {
                if (page.url === crawlerResult.url) continue;

                // Audit cookies
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

                // Audit mixed content
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
          } catch (err) {
            console.error('Multi-page crawl security audit failed:', err);
          }

          // Active forms probing
          const activeScanData = { scanned: false, status: capabilities.activeScans ? 'not_requested' : 'disabled', findingsCount: 0 };
          if (shouldRunActive) {
            emitStep('file_check', 'in_progress', { message: 'Probing input forms for SQLi and XSS...' });
            try {
              console.log(`[scan] [${scanId}] [Async Queue] Initiating active forms probing`);
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

          // Load resilience testing
          let loadTestResult = { scanned: false, verdict: capabilities.loadTesting ? 'Skipped: Load resilience test was not requested.' : 'Skipped: Load resilience testing is disabled.' };
          if (shouldRunLoadTest) {
            emitStep('load_test', 'in_progress', { message: 'Auditing load resilience & rate limiting...' });
            try {
              console.log(`[scan] [${scanId}] [Async Queue] Initiating load resilience test`);
              loadTestResult = await auditLoadResilience(crawlerResult.url, authOptions);
            } catch (err) {
              console.error('Load resilience audit failed:', err);
              loadTestResult = { scanned: false, verdict: `Scan Failure: Load resilience check failed: ${err.message}` };
            }
            emitStep('load_test', 'completed');
          }

          // Run OWASP ZAP Scanner
          console.log(`[scan] [${scanId}] [Async Queue] Triggering OWASP ZAP scan`);
          const zapScanData = await executeZapScan(normalizedUrl, (step, status, details) => {
            emitStep(step, status, details);
          });
          const zapFindings = Array.isArray(zapScanData?.findings) ? zapScanData.findings : [];

          // Merge ZAP findings
          if (zapFindings.length > 0) {
            for (const zf of zapFindings) {
              if (!securityResult.findings.some(f => f.id === zf.id)) {
                securityResult.findings.push(zf);
              }
            }
          }

          const scanDuration = parseFloat(((Date.now() - startTime) / 1000).toFixed(2));

          // Generate final report
          const report = reportGenerator.generateReport({
            securityResult,
            url: crawlerResult.url,
            scanDuration,
            scanMode: 'full',
            aiEnabled: runAi,
            loadTestResult,
            zapFindings,
            zapScanData
          });

          const finalReport = buildFinalReport(scanId, report, {
            capabilities,
            activeScanData,
            authenticatedScan: useAuthenticatedScan,
            requestedZap: !!useZap
          });
          console.log(`[scanRoutes] Persisting async scan report. ID: ${scanId}`);
          await saveReport(scanId, finalReport, userId);

          emitStep('complete', 'completed', { score: report.score, grade: report.grade });
          
          if (clientSocket) {
            clientSocket.emit('scan_complete', {
              scanId,
              report: finalReport
            });
          }
        } catch (err) {
          console.error(`[scan] Async scan ID ${scanId} failed:`, err);
          emitStep('complete', 'failed', { error: err.message });
        }
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
      authenticatedScan: useAuthenticatedScan,
      requestedZap: !!useZap,
      zapRequestStatus: useZap && !capabilities.zapScans ? 'disabled' : 'not_requested'
    });
    console.log(`[scanRoutes] Persisting sync scan report. ID: ${scanId}`);
    await saveReport(scanId, finalReport, userId);

    res.json(finalReport);
  } catch (err) {
    console.error('Scan error:', err);
    res.status(500).json({ error: err.message || 'Scan failed' });
  }
});

module.exports = router;
