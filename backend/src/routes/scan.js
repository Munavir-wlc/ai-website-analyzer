const express = require('express');
const router = express.Router();
const crawler = require('../services/crawler');
const siteCrawler = require('../services/siteCrawler');
const siteAudit = require('../services/siteAudit');
const lighthouseService = require('../services/lighthouseService');
const socialMetaHelper = require('../services/socialMetaHelper');
const securityAnalyzer = require('../services/securityAnalyzer');
const seoAnalyzer = require('../services/seoAnalyzer');
const htmlFetcher = require('../services/htmlFetcher');
const keywordAnalyzer = require('../services/keywordAnalyzer');
const backlinkAnalyzer = require('../services/backlinkAnalyzer');
const reportGenerator = require('../services/reportGenerator');
const aiEngine = require('../services/aiEngine');

// POST /api/scan
router.post('/', async (req, res) => {
  try {
    let { url, scanType } = req.body;
    if (!url || !scanType) {
      return res.status(400).json({ error: 'url and scanType are required' });
    }
    const validTypes = ['seo', 'vapt', 'full', 'site'];
    if (!validTypes.includes(scanType)) {
      return res.status(400).json({ error: 'scanType must be seo, vapt, full, or site' });
    }

    // Normalize URL - add https:// if no scheme
    let normalizedUrl = url.trim();
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    let crawlerResult = null;
    let siteAuditResult = null;

    if (scanType === 'site') {
      // Site audit: multi-page crawl + technical checks
      const siteData = await siteCrawler.crawlSite(normalizedUrl);
      if (siteData.pages.length === 0) {
        return res.status(400).json({ error: 'Failed to crawl site. No pages could be fetched.' });
      }
      siteAuditResult = await siteAudit.runSiteAudit({
        pages: siteData.pages,
        baseOrigin: siteData.baseOrigin,
      });
      // Use first page as homepage for single-page SEO
      const homepage = siteData.pages[0];
      crawlerResult = {
        html: homepage.html,
        url: homepage.url,
        robotsTxt: siteData.robotsTxt,
        sitemapXml: siteData.sitemapXml,
      };
    } else {
      crawlerResult = await crawler.crawl(normalizedUrl);
    }

    if (!crawlerResult) {
      return res.status(400).json({ error: 'Failed to crawl URL. Check that it is valid and accessible.' });
    }

    // Start backlinks fetch in parallel (don't block on Lighthouse)
    const domain = (() => {
      try { return new URL(crawlerResult.url).hostname; } catch { return crawlerResult.url; }
    })();
    const backlinksPromise = backlinkAnalyzer.analyzeBacklinks(domain);

    let lighthouseResult = null;
    let socialResult = null;
    let securityResult = null;
    let seoResult = null;
    let rankingsData = null;

    let usedRenderedHtml = true;
    if (scanType === 'seo' || scanType === 'full' || scanType === 'site') {
      // Use Puppeteer-rendered HTML for accurate meta/title extraction (JS-rendered sites)
      const renderedHtml = await htmlFetcher.fetchRenderedHtml(crawlerResult.url);
      usedRenderedHtml = !!renderedHtml;
      if (!renderedHtml) {
        console.warn('[scan] Using raw HTML; Puppeteer fetch failed');
      }
      const htmlForSeo = renderedHtml || crawlerResult.html;
      const crawlerForSeo = { ...crawlerResult, html: htmlForSeo };

      lighthouseResult = await lighthouseService.runLighthouse(crawlerResult.url);
      console.log('Lighthouse result:', lighthouseResult);
      socialResult = socialMetaHelper.analyzeSocialMeta(htmlForSeo);
      console.log('Social result:', socialResult);
      seoResult = seoAnalyzer.runSEOAnalyzer(crawlerForSeo);
      rankingsData = await keywordAnalyzer.analyzeKeywordsAsync(crawlerForSeo, seoResult?.details);
    }

    if (scanType === 'vapt' || scanType === 'full') {
      securityResult = await securityAnalyzer.analyzeSecurity(crawlerResult);
    }

    const backlinks = await backlinksPromise;

    const report = reportGenerator.generateReport({
      lighthouseResult,
      socialResult,
      securityResult,
      siteAuditResult,
      seoResult,
      rankingsData,
      backlinks,
      url: crawlerResult.url,
      usedRenderedHtml,
    });

    // Optional: AI recommendations (if OPENAI_API_KEY is set)
    const recommendations = await aiEngine.generateRecommendations(report);
    if (recommendations) {
      report.recommendations = recommendations;
    }

    res.json(report);
  } catch (err) {
    console.error('Scan error:', err);
    res.status(500).json({ error: err.message || 'Scan failed' });
  }
});

module.exports = router;
