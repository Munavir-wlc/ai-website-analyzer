const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const crawler = require('../services/crawler');
const securityAnalyzer = require('../services/securityAnalyzer');
const reportGenerator = require('../services/reportGenerator');

// POST /api/scan
router.post('/', async (req, res) => {
  const startTime = Date.now();
  const scanId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
  
  try {
    let { url, consent, mode, socketId } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'url is required' });
    }

    const hasConsent = !!consent;
    const scanMode = mode || 'full'; // 'quick' or 'full'

    // Normalize URL
    const normalizedUrl = crawler.normalizeUrl(url);

    // Get io instance and client socket
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

    // 1. Crawling Step
    emitStep('crawling', 'in_progress');
    console.log(`[scan] [${scanId}] Starting crawl for: ${normalizedUrl} (consent: ${hasConsent}, mode: ${scanMode})`);
    const crawlerResult = await crawler.crawl(normalizedUrl);
    
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
    
    // We pass (hasConsent && scanMode !== 'quick') to security analyzer.
    // If it's a quick scan, it skips OpenAI and uses fallback static check.
    const runAi = hasConsent && scanMode === 'full';
    
    const securityResult = await securityAnalyzer.analyzeSecurity(crawlerResult, runAi, onStep);

    const scanDuration = parseFloat(((Date.now() - startTime) / 1000).toFixed(2));

    // Generate the report
    const report = reportGenerator.generateReport({
      securityResult,
      url: crawlerResult.url,
      scanDuration
    });

    // Send completed event to WebSocket if exists
    emitStep('complete', 'completed', { score: report.score, grade: report.grade });

    res.json({
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
      robotsData: report.robotsData
    });
  } catch (err) {
    console.error('Scan error:', err);
    res.status(500).json({ error: err.message || 'Scan failed' });
  }
});

module.exports = router;
