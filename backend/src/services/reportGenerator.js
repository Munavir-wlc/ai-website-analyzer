/**
 * Report Generator - Merges analyzer results into normalized report format
 */

function normalizeIssue(issue) {
  const base = {
    type: issue.type || 'unknown',
    severity: issue.severity || 'medium',
    message: issue.message || String(issue),
    fix: issue.fix ?? null
  };
  if (issue.pages) base.pages = issue.pages;
  if (issue.examples) base.examples = issue.examples;
  return base;
}

/** 0-100 to letter grade */
function scoreToGrade(score) {
  if (score == null || score < 0) return null;
  const s = Math.min(100, score);
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

function generateReport({ seoResult, securityResult, performanceResult, siteAuditResult, lighthouseResult, socialResult, rankingsData, backlinks, url, usedRenderedHtml }) {

  const report = {
    url,
    domain: null,
    usedRenderedHtml: usedRenderedHtml ?? true,

    seoScore: null,
    securityScore: null,
    performanceScore: null,
    siteAuditScore: null,
    siteAuditSummary: null,
    linksScore: null,
    usabilityScore: null,
    socialScore: null,

    overallScore: null,
    overallGrade: null,

    recommendations: 0,

    categories: null,
    radarData: [],

    generatedAt: new Date().toISOString(),

    issues: {
      seo: [],
      security: [],
      performance: [],
      siteAudit: []
    },

    performance: null
  };

  /* ---------------- DOMAIN ---------------- */

  try {
    report.domain = new URL(url).hostname;
  } catch {
    report.domain = url;
  }

  /* ---------------- LIGHTHOUSE (SEO, Performance, Usability, Links) ---------------- */

  if (lighthouseResult) {
    report.seoScore = lighthouseResult.seoScore ?? null;
    report.performanceScore = lighthouseResult.performanceScore ?? null;
    report.usabilityScore = lighthouseResult.usabilityScore ?? null;
    report.linksScore = lighthouseResult.linksScore ?? null;
    report.performance = lighthouseResult.metrics ?? null;
    report.issues.seo = [...(lighthouseResult.issues?.seo || []), ...(lighthouseResult.issues?.accessibility || [])].map(normalizeIssue);
    report.issues.performance = (lighthouseResult.issues?.performance || []).map(normalizeIssue);
  }

  /* ---------------- SEO (fallback when no Lighthouse) ---------------- */

  if (seoResult && !lighthouseResult) {
    report.seoScore = seoResult.score;
    report.issues.seo = (seoResult.issues || []).map(normalizeIssue);
    report.usabilityScore = seoResult.details?.usabilityScore ?? null;
    report.socialScore = seoResult.details?.socialScore ?? null;
  }

  /* ---------------- SEO DETAILS (granular data for detail cards) ---------------- */

  if (seoResult?.details) {
    report.seoDetails = seoResult.details;
  }

  /* ---------------- RANKINGS (keyword insights) ---------------- */

  if (rankingsData) {
    report.rankings = rankingsData;
  }

  /* ---------------- LINKS (backlink data) ---------------- */

  if (backlinks) {
    report.links = {
      summary: backlinks.summary ?? {},
      topBacklinks: backlinks.topBacklinks ?? [],
      anchors: backlinks.anchors ?? [],
      tlds: backlinks.tlds ?? {},
      countries: backlinks.countries ?? {},
      apiError: backlinks.apiError ?? null,
    };
    const referringDomains = backlinks.summary?.referringDomains ?? 0;
    report.linksScore = Math.min(100, referringDomains * 1.2);
  }

  /* ---------------- SOCIAL (from socialMetaHelper) ---------------- */

  if (socialResult) {
    report.socialScore = socialResult.socialScore ?? null;
    report.socialDetails = socialResult.details ?? null;
  }

  /* ---------------- SITE AUDIT ---------------- */

  if (siteAuditResult) {
    report.siteAuditScore = siteAuditResult.score;
    report.siteAuditSummary = siteAuditResult.summary;
    report.issues.siteAudit = (siteAuditResult.issues || []).map(normalizeIssue);

    report.linksScore = siteAuditResult.score;
  }
  else if (seoResult?.details && !lighthouseResult) {

    const d = seoResult.details;

    let linksScore = 100;

    if (!d.hasCanonical) linksScore -= 15;

    if ((d.internalLinks ?? 0) === 0 && (d.externalLinks ?? 0) === 0)
      linksScore -= 10;

    report.linksScore = Math.max(0, linksScore);
  }

  /* ---------------- SECURITY ---------------- */

  if (securityResult) {
    report.securityScore = securityResult.score;
    report.issues.security = (securityResult.issues || []).map(normalizeIssue);
  }

  /* ---------------- PERFORMANCE (fallback when no Lighthouse) ---------------- */

  if (performanceResult && !lighthouseResult) {

    report.performanceScore =
      performanceResult.performanceScore ??
      performanceResult.score ??
      null;

    report.performance = performanceResult.metrics ?? null;

    report.issues.performance =
      (performanceResult.issues || []).map(normalizeIssue);
  }

  /* ---------------- OVERALL SCORE ---------------- */

  const scores = [];

  if (report.seoScore != null)
    scores.push({ w: 1, s: report.seoScore });

  if (report.securityScore != null)
    scores.push({ w: 1.1, s: report.securityScore });

  if (report.linksScore != null)
    scores.push({ w: 0.8, s: report.linksScore });

  if (report.usabilityScore != null)
    scores.push({ w: 0.9, s: report.usabilityScore });

  if (report.performanceScore != null)
    scores.push({ w: 1, s: report.performanceScore });

  if (report.socialScore != null)
    scores.push({ w: 0.6, s: report.socialScore });

  if (scores.length > 0) {

    const totalW = scores.reduce((a, x) => a + x.w, 0);

    const weighted =
      scores.reduce((a, x) => a + x.w * x.s, 0) / totalW;

    report.overallScore = Math.round(weighted);

    report.overallGrade = scoreToGrade(report.overallScore);
  }

  /* ---------------- CATEGORY SCORES (UI circles) ---------------- */

  report.categories = {
    seo: {
      score: report.seoScore,
      grade: scoreToGrade(report.seoScore)
    },

    security: {
      score: report.securityScore,
      grade: scoreToGrade(report.securityScore)
    },

    links: {
      score: report.linksScore,
      grade: scoreToGrade(report.linksScore)
    },

    usability: {
      score: report.usabilityScore,
      grade: scoreToGrade(report.usabilityScore)
    },

    performance: {
      score: report.performanceScore,
      grade: scoreToGrade(report.performanceScore)
    },

    social: {
      score: report.socialScore,
      grade: scoreToGrade(report.socialScore)
    }
  };

  /* ---------------- RADAR CHART DATA ---------------- */

  report.radarData = [
    report.seoScore || 0,
    report.securityScore || 0,
    report.linksScore || 0,
    report.usabilityScore || 0,
    report.performanceScore || 0,
    report.socialScore || 0
  ];

  /* ---------------- RECOMMENDATIONS COUNT ---------------- */

  report.recommendations =
    report.issues.seo.length +
    report.issues.security.length +
    report.issues.performance.length +
    report.issues.siteAudit.length;

  return report;
}

module.exports = { generateReport };