const { Worker } = require('bullmq');
const Redis = require('ioredis');
const crawler = require('./crawler');
const securityAnalyzer = require('./securityAnalyzer');
const reportGenerator = require('./reportGenerator');
const { crawlSite } = require('./siteCrawler');
const performanceAnalyzer = require('./performanceAnalyzer');
const accessibilityAnalyzer = require('./accessibilityAnalyzer');
const seoAnalyzer = require('./seoAnalyzer');
const aiSearchAnalyzer = require('./aiSearchAnalyzer');
const { auditActiveVulnerabilities } = require('./activeScanner');
const { auditLoadResilience } = require('./loadTester');
const { executeZapScan } = require('./zapScanner');
const { saveReport } = require('./reportStore');
const { capabilities } = require('../config/scanCapabilities');
const { scanCdnLibraries } = require('./cveScanner');
const { scanSubdomains } = require('./subdomainScanner');
const { getIo } = require('../utils/socket');

const redisHost = process.env.REDIS_HOST || '127.0.0.1';
const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
const redisPassword = process.env.REDIS_PASSWORD || null;

let connection = null;
try {
  connection = new Redis({
    host: redisHost,
    port: redisPort,
    password: redisPassword,
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    retryStrategy(times) {
      if (times > 3) return null;
      return Math.min(times * 100, 2000);
    }
  });
  connection.on('error', () => {
    // Silent error handler when Redis daemon is off
  });
} catch (e) {
  connection = null;
}

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

async function processScanJob(data) {
  const {
    scanId,
    userId,
    normalizedUrl,
    authOptions,
    authCookie,
    authHeader,
    shouldRunActive,
    shouldRunLoadTest,
    shouldRunZap,
    zapScanMode,
    runAi,
    socketId,
    delay,
    startTime
  } = data;

  console.log(`[scanWorker] [${scanId}] Starting job processing for ${normalizedUrl}`);

  const io = getIo();
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

  try {
    // 1. Crawling Step
    console.log(`[scanWorker] [${scanId}] Starting crawl...`);
    emitStep('crawling', 'in_progress');
    const crawlerResult = await crawler.crawl(normalizedUrl, authOptions);
    if (crawlerResult) {
      crawlerResult.authCookie = authCookie;
      crawlerResult.authHeader = authHeader;
    }
    if (!crawlerResult) {
      emitStep('crawling', 'failed', { error: 'Failed to crawl website' });
      throw new Error('Failed to crawl website');
    }
    emitStep('crawling', 'completed');

    // 2. Deterministic checks via securityAnalyzer
    console.log(`[scanWorker] [${scanId}] Running deterministic audits`);
    const securityResult = await securityAnalyzer.analyzeSecurity(crawlerResult, runAi, (stepName, status) => {
      emitStep(stepName, status);
    });

    // 3. Run multi-page crawl checks (mixed-content and cookies flags)
    let siteCrawl = null;
    try {
      console.log(`[scanWorker] [${scanId}] Initiating multi-page audit via siteCrawler`);
      siteCrawl = await crawlSite(normalizedUrl, authOptions);
      if (siteCrawl && siteCrawl.pages && siteCrawl.pages.length > 1) {
        const cheerio = require('cheerio');
        for (const page of siteCrawl.pages) {
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

    // Run new audits (performance, accessibility, SEO, AI search)
    let performanceResult = { opportunities: [], diagnostics: [], performanceScore: 100 };
    let accessibilityResult = { findings: [], accessibilityScore: 100 };
    let seoResult = { findings: [], seoScore: 100, details: {} };
    let aiSearchResult = { findings: [], aiSearchScore: 100, details: {} };

    try {
      emitStep('crawling', 'in_progress', { message: 'Running Performance and Speed Index checks...' });
      performanceResult = await performanceAnalyzer.analyzePerformance(normalizedUrl, authOptions);
    } catch (err) {
      console.error('Performance analysis failed:', err);
    }

    try {
      emitStep('dns_check', 'in_progress', { message: 'Auditing WCAG accessibility standards...' });
      accessibilityResult = await accessibilityAnalyzer.analyzeAccessibility(crawlerResult, siteCrawl);
    } catch (err) {
      console.error('Accessibility analysis failed:', err);
    }

    try {
      emitStep('robots_check', 'in_progress', { message: 'Evaluating sitemap and technical SEO standards...' });
      seoResult = await seoAnalyzer.analyzeSeo(crawlerResult, siteCrawl);
    } catch (err) {
      console.error('SEO analysis failed:', err);
    }

    try {
      emitStep('ai_analysis', 'in_progress', { message: 'Analyzing AI Search and GEO visibility...' });
      aiSearchResult = await aiSearchAnalyzer.analyzeAiSearch(crawlerResult, siteCrawl);
    } catch (err) {
      console.error('AI Search/GEO analysis failed:', err);
    }

    // 4. Active forms probing
    const activeScanData = { scanned: false, status: capabilities.activeScans ? 'not_requested' : 'disabled', findingsCount: 0 };
    if (shouldRunActive) {
      emitStep('file_check', 'in_progress', { message: 'Probing input forms for SQLi and XSS...' });
      try {
        console.log(`[scanWorker] [${scanId}] Initiating active forms probing`);
        const activeFindings = await auditActiveVulnerabilities(crawlerResult.html, crawlerResult.url, authOptions, delay);
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

    // 5. Load resilience testing
    let loadTestResult = { scanned: false, verdict: capabilities.loadTesting ? 'Skipped: Load resilience test was not requested.' : 'Skipped: Load resilience testing is disabled.' };
    if (shouldRunLoadTest) {
      emitStep('load_test', 'in_progress', { message: 'Auditing load resilience & rate limiting...' });
      try {
        console.log(`[scanWorker] [${scanId}] Initiating load resilience test`);
        loadTestResult = await auditLoadResilience(crawlerResult.url, authOptions);
      } catch (err) {
        console.error('Load resilience audit failed:', err);
        loadTestResult = { scanned: false, verdict: `Scan Failure: Load resilience check failed: ${err.message}` };
      }
      emitStep('load_test', 'completed');
    }

    // 6. Run CVE scan on HTML for known vulnerable CDN libraries
    try {
      emitStep('cve_scan', 'in_progress');
      const cveFindings = await scanCdnLibraries(crawlerResult.html);
      if (cveFindings.length > 0) {
        for (const cf of cveFindings) {
          if (!securityResult.findings.some(f => f.id === cf.id)) {
            securityResult.findings.push(cf);
          }
        }
        console.log(`[scanWorker] CVE scan found ${cveFindings.length} library vulnerabilities`);
      }
      emitStep('cve_scan', 'completed');
    } catch (err) {
      console.warn('[scanWorker] CVE library scan failed silently:', err.message);
      emitStep('cve_scan', 'failed');
    }

    // 7. Run OWASP ZAP Scanner
    const zapScanData = await executeZapScan(normalizedUrl, authOptions, (step, status, details) => {
      emitStep(step, status, details);
    }, zapScanMode || 'low');
    const zapFindings = Array.isArray(zapScanData?.findings) ? zapScanData.findings : [];

    // Merge ZAP findings
    if (zapFindings.length > 0) {
      for (const zf of zapFindings) {
        if (!securityResult.findings.some(f => f.id === zf.id)) {
          securityResult.findings.push(zf);
        }
      }
    }

    // 8. Run Subdomain Enumeration
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
      console.warn('[scanWorker] Subdomain scan failed silently:', err.message);
      emitStep('subdomain_scan', 'failed');
    }

    // 9. Generate final report and persist
    const scanDuration = parseFloat(((Date.now() - (startTime || Date.now())) / 1000).toFixed(2));
    const report = reportGenerator.generateReport({
      securityResult,
      performanceResult,
      accessibilityResult,
      seoResult,
      aiSearchResult,
      crawlerResult,
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
      authenticatedScan: !!(authCookie || authHeader),
      requestedZap: shouldRunZap,
      zapScanMode: zapScanMode || 'low'
    });
    console.log(`[scanWorker] Persisting async scan report. ID: ${scanId}`);
    await saveReport(scanId, finalReport, userId);

    emitStep('complete', 'completed', { score: report.score, grade: report.grade });

    if (clientSocket) {
      const reportToSend = !userId ? maskReportForGuests(finalReport) : finalReport;
      clientSocket.emit('scan_complete', {
        scanId,
        report: reportToSend
      });
    }
  } catch (err) {
    console.error(`[scanWorker] Async scan ID ${scanId} failed:`, err);
    emitStep('complete', 'failed', { error: err.message });
    throw err;
  }
}

let workerInstance = null;

function startWorkerInstance() {
  if (workerInstance) return workerInstance;

  console.log('[scanWorker] Initializing background BullMQ scan worker...');
  workerInstance = new Worker('scan-queue', async (job) => {
    await processScanJob(job.data);
  }, { connection });

  workerInstance.on('failed', (job, err) => {
    console.error(`[scanWorker] Job ${job?.id} failed with error:`, err.message);
  });

  workerInstance.on('completed', (job) => {
    console.log(`[scanWorker] Job ${job?.id} completed successfully`);
  });

  return workerInstance;
}

function initScanWorker() {
  if (!connection) {
    console.log('[scanWorker] Redis connection failed to initialize. In-memory queue handler will process jobs.');
    return null;
  }

  // If already connected, start the worker immediately
  if (connection.status === 'ready' || connection.status === 'connect') {
    return startWorkerInstance();
  }

  // Otherwise, listen for the connect event to start it safely
  connection.on('connect', () => {
    startWorkerInstance();
  });

  console.log('[scanWorker] Waiting for Redis connection to initialize worker...');
  return null;
}

module.exports = { initScanWorker, processScanJob };
