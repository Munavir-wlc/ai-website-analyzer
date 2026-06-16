/**
 * Lighthouse Service - Runs local Lighthouse for Performance, SEO, and Accessibility
 * Replaces PageSpeed Insights API for exact, reproducible results
 * - Multi-run averaging for stable scores
 * - Mobile + desktop for balanced accuracy
 * - Timeout and retry for reliability
 */
const { launchBrowser } = require('../utils/browserLaunch');

const LIGHTHOUSE_TIMEOUT = 90000; // 90 seconds per run
const MAX_RETRIES = 2;
const RUNS_PER_FORM_FACTOR = 1; // 1 mobile + 1 desktop, averaged

/**
 * Map Lighthouse audit to our issue format
 */
function auditToIssue(audit, category) {
  if (!audit || audit.score === null || audit.score >= 0.9) return null;
  const severity = audit.score >= 0.5 ? 'medium' : 'high';
  return {
    type: category,
    severity,
    message: audit.title || audit.id,
    fix: audit.description || null,
  };
}

/**
 * Extract issues from Lighthouse categories
 */
function extractIssues(lhr, categoryKey) {
  const category = lhr.categories?.[categoryKey];
  if (!category?.auditRefs) return [];
  const issues = [];
  for (const ref of category.auditRefs) {
    const audit = lhr.audits?.[ref.id];
    if (!audit || ref.group === 'hidden') continue;
    const issue = auditToIssue(audit, categoryKey);
    if (issue) issues.push(issue);
  }
  return issues;
}

/**
 * Derive linksScore from Lighthouse SEO audits
 */
function deriveLinksScore(lhr) {
  const audits = lhr.audits || {};
  const canonical = audits['canonical'];
  const crawlableLinks = audits['crawlable-anchors'];
  const linkText = audits['link-text'];
  let score = 100;
  if (canonical && !canonical.score) score -= 15;
  if (crawlableLinks && !crawlableLinks.score) score -= 10;
  if (linkText && !linkText.score) score -= 10;
  return Math.max(0, score);
}

/**
 * Extract Core Web Vitals and other metrics from Lighthouse audits
 */
function extractMetrics(lhr) {
  const audits = lhr.audits || {};
  const metrics = {};
  const lcp = audits['largest-contentful-paint']?.numericValue;
  const fcp = audits['first-contentful-paint']?.numericValue;
  const cls = audits['cumulative-layout-shift']?.numericValue;
  const tbt = audits['total-blocking-time']?.numericValue;
  const fid = audits['max-potential-fid']?.numericValue;
  if (lcp) metrics.LCP = `${(lcp / 1000).toFixed(1)}s`;
  if (fcp) metrics.FCP = `${(fcp / 1000).toFixed(1)}s`;
  if (cls !== undefined) metrics.CLS = cls.toFixed(2);
  if (tbt) metrics.TBT = `${tbt.toFixed(0)}ms`;
  if (fid) metrics.FID = `${fid.toFixed(0)}ms`;
  return Object.keys(metrics).length ? metrics : null;
}

/**
 * Parse a single Lighthouse result into our normalized format
 */
function parseLhr(lhr) {
  return {
    performanceScore: Math.round((lhr.categories?.performance?.score ?? 0) * 100),
    seoScore: Math.round((lhr.categories?.seo?.score ?? 0) * 100),
    usabilityScore: Math.round((lhr.categories?.accessibility?.score ?? 0) * 100),
    linksScore: deriveLinksScore(lhr),
    metrics: extractMetrics(lhr),
    issues: {
      seo: extractIssues(lhr, 'seo'),
      performance: extractIssues(lhr, 'performance'),
      accessibility: extractIssues(lhr, 'accessibility'),
    },
  };
}

/**
 * Run a single Lighthouse audit with timeout
 */
async function runOneWithBrowser(lighthouse, browser, url, formFactor) {
  const wsUrl = browser.wsEndpoint();
  const port = parseInt(new URL(wsUrl).port, 10);

  const flags = {
    port,
    output: 'json',
    logLevel: 'silent',
    onlyCategories: ['performance', 'seo', 'accessibility'],
    formFactor,
  };

  const config = {
    extends: 'lighthouse:default',
    settings: {
      onlyCategories: ['performance', 'seo', 'accessibility'],
      formFactor,
    },
  };

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Lighthouse timeout')), LIGHTHOUSE_TIMEOUT)
  );
  const runPromise = lighthouse(url, flags, config);

  const runnerResult = await Promise.race([runPromise, timeoutPromise]);
  if (!runnerResult?.lhr) throw new Error('Lighthouse returned no result');
  return parseLhr(runnerResult.lhr);
}

/**
 * Average numeric scores from multiple results (ignores nulls)
 */
function averageScores(results, key) {
  const vals = results.map((r) => r[key]).filter((v) => v != null);
  if (vals.length === 0) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

/**
 * Merge issues from multiple runs (dedupe by message)
 */
function mergeIssues(issueArrays) {
  const seen = new Set();
  const merged = [];
  for (const arr of issueArrays) {
    for (const i of arr || []) {
      const key = `${i.type}:${i.message}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(i);
      }
    }
  }
  return merged;
}

/**
 * Run Lighthouse: 2 runs mobile + 2 runs desktop, average scores, with retry on failure
 * @param {string} url - URL to audit
 * @returns {Promise<Object>} Normalized Lighthouse result
 */
async function runLighthouse(url) {
  let browser;
  try {
    const { default: lighthouse } = await import('lighthouse');
    browser = await launchBrowser();

    const results = [];

    for (const formFactor of ['mobile', 'desktop']) {
      for (let i = 0; i < RUNS_PER_FORM_FACTOR; i++) {
        let lastErr;
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          try {
            const r = await runOneWithBrowser(lighthouse, browser, url, formFactor);
            results.push(r);
            break;
          } catch (err) {
            lastErr = err;
            if (attempt < MAX_RETRIES - 1) {
              await new Promise((r) => setTimeout(r, 2000));
            }
          }
        }
      }
    }

    if (results.length === 0) {
      throw new Error('All Lighthouse runs failed');
    }

    return {
      performanceScore: averageScores(results, 'performanceScore'),
      seoScore: averageScores(results, 'seoScore'),
      usabilityScore: averageScores(results, 'usabilityScore'),
      linksScore: averageScores(results, 'linksScore'),
      metrics: results[0]?.metrics ?? null,
      issues: {
        seo: mergeIssues(results.map((r) => r.issues.seo)),
        performance: mergeIssues(results.map((r) => r.issues.performance)),
        accessibility: mergeIssues(results.map((r) => r.issues.accessibility)),
      },
    };
  } catch (err) {
    console.error('Lighthouse error:', err.message);
    return {
      performanceScore: null,
      seoScore: null,
      usabilityScore: null,
      linksScore: null,
      metrics: null,
      issues: {
        seo: [],
        performance: [{
          type: 'performance',
          severity: 'low',
          message: `Lighthouse failed: ${err.message || 'Unknown error'}`,
          fix: null,
        }],
        accessibility: [],
      },
    };
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { runLighthouse };
