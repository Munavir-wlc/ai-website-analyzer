const cheerio = require('cheerio');

/** Flesch reading ease: 206.835 - 1.015*(words/sentences) - 84.6*(syllables/words) */
function fleschScore(text) {
  if (!text || text.length < 10) return null;
  const words = text.split(/\s+/).filter(Boolean);
  const sentences = text.split(/[.!?]+/).filter(Boolean);
  if (words.length < 5 || sentences.length < 1) return null;
  let syllables = 0;
  for (const w of words) {
    const v = w.toLowerCase().replace(/[^a-z]/g, '');
    if (v.length <= 3) syllables += 1;
    else syllables += Math.max(1, v.match(/[aeiouy]+/g)?.length || 1);
  }
  const score = 206.835 - 1.015 * (words.length / sentences.length) - 84.6 * (syllables / words.length);
  return Math.round(score * 10) / 10;
}

function hasSchemaOrg($) {
  const jsonLd = $('script[type="application/ld+json"]');
  if (jsonLd.length > 0) return true;
  const microdata = $('[itemscope], [itemtype]');
  if (microdata.length > 0) return true;
  const rdfa = $('[typeof]');
  if (rdfa.length > 0) return true;
  return false;
}

/**
 * SEO Analyzer - analyzes HTML and crawler data for SEO issues
 * Score: 0-100, deduct points per issue
 * @param {Object} crawlerData - { html, url, robotsTxt, sitemapXml }
 * @returns {Object} { score, issues, details }
 */
function runSEOAnalyzer(crawlerData) {
  const { html, url, robotsTxt, sitemapXml } = crawlerData;
  const $ = cheerio.load(html);
  const issues = [];
  let score = 100;

  // Deduction amounts per issue
  const DEDUCTIONS = {
    title: 10,
    metaDescription: 8,
    multipleH1: 10,
    noH1: 8,
    headingOrder: 5,
    missingAlt: 3,
    canonical: 5,
    robotsTxt: 5,
    sitemap: 5,
  };

  // Title tag (with OG/twitter fallbacks for JS-rendered or hybrid sites)
  let title = $('title').text().trim();
  const ogTitle = $('meta[property="og:title"]').attr('content')?.trim();
  const twitterTitle = $('meta[name="twitter:title"]').attr('content')?.trim();
  if (!title && (ogTitle || twitterTitle)) {
    title = ogTitle || twitterTitle;
  }

  if (!title) {
    issues.push({ type: 'title', severity: 'high', message: 'Missing title tag', fix: 'Add a unique <title> tag (50-60 chars)' });
    score -= DEDUCTIONS.title;
  } else if (title.length < 30 || title.length > 60) {
    issues.push({ type: 'title', severity: 'medium', message: `Title length suboptimal (${title.length} chars)`, fix: 'Aim for 50-60 characters' });
    score -= 5;
  }

  // Meta description (with OG/twitter fallbacks)
  let metaDesc = $('meta[name="description"]').attr('content')?.trim();
  const ogDesc = $('meta[property="og:description"]').attr('content')?.trim();
  const twitterDesc = $('meta[name="twitter:description"]').attr('content')?.trim();
  if (!metaDesc && (ogDesc || twitterDesc)) {
    metaDesc = ogDesc || twitterDesc;
  }

  if (!metaDesc) {
    issues.push({ type: 'metaDescription', severity: 'high', message: 'Missing meta description', fix: 'Add <meta name="description" content="..."> (150-160 chars)' });
    score -= DEDUCTIONS.metaDescription;
  } else if (metaDesc.length < 120 || metaDesc.length > 160) {
    issues.push({ type: 'metaDescription', severity: 'medium', message: `Meta description length suboptimal (${metaDesc.length} chars)`, fix: 'Aim for 150-160 characters' });
    score -= 4;
  }

  // Heading structure
  const h1s = $('h1');
  const h1Count = h1s.length;
  if (h1Count === 0) {
    issues.push({ type: 'heading', severity: 'high', message: 'No H1 tag found', fix: 'Add exactly one H1 tag describing the page topic' });
    score -= DEDUCTIONS.noH1;
  } else if (h1Count > 1) {
    issues.push({ type: 'heading', severity: 'high', message: `Multiple H1 tags (${h1Count})`, fix: 'Use only one H1 per page for better SEO' });
    score -= DEDUCTIONS.multipleH1;
  }

  const h2Count = $('h2').length;
  const h3Count = $('h3').length;
  const h4Count = $('h4').length;
  const h5Count = $('h5').length;
  const h6Count = $('h6').length;

  // Language attribute
  const lang = $('html').attr('lang') || null;

  // Hreflang
  const hasHreflang = $('link[rel="alternate"][hreflang]').length > 0;

  // Noindex meta
  const robotsMeta = $('meta[name="robots"]').attr('content') || '';
  const hasNoindex = /noindex/i.test(robotsMeta);

  // HTTPS (from final URL)
  const isHttps = url ? new URL(url).protocol === 'https:' : false;

  // Image ALT attributes
  const imgsWithoutAlt = $('img:not([alt])');
  const missingAltCount = imgsWithoutAlt.length;
  if (missingAltCount > 0) {
    issues.push({ type: 'images', severity: 'medium', message: `Images without ALT text (${missingAltCount})`, fix: 'Add alt attribute to all images for accessibility and SEO' });
    score -= Math.min(DEDUCTIONS.missingAlt * missingAltCount, 15);
  }

  // Canonical tag
  const canonical = $('link[rel="canonical"]').attr('href');
  if (!canonical) {
    issues.push({ type: 'canonical', severity: 'medium', message: 'Missing canonical tag', fix: 'Add <link rel="canonical" href="..."> to prevent duplicate content' });
    score -= DEDUCTIONS.canonical;
  }

  // robots.txt
  if (!robotsTxt) {
    issues.push({ type: 'robotsTxt', severity: 'low', message: 'robots.txt not found', fix: 'Add robots.txt at your domain root' });
    score -= DEDUCTIONS.robotsTxt;
  }

  // sitemap.xml
  if (!sitemapXml) {
    issues.push({ type: 'sitemap', severity: 'low', message: 'sitemap.xml not found', fix: 'Add sitemap.xml and submit to Google Search Console' });
    score -= DEDUCTIONS.sitemap;
  }

  // On-page: internal / external link counts
  const pageOrigin = url ? new URL(url).origin : null;
  let internalLinks = 0;
  let externalLinks = 0;
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
    try {
      const full = new URL(href, url || 'https://example.com');
      if (pageOrigin && full.origin === pageOrigin) internalLinks++;
      else externalLinks++;
    } catch (_) {}
  });

  // Readability: Flesch score from main content
  const bodyText = $('main, article, .content, #content, body')
    .first()
    .text()
    .replace(/\s+/g, ' ')
    .trim();
  const fullBodyText = bodyText || $('body').text();
  const wordCount = fullBodyText ? fullBodyText.split(/\s+/).filter(Boolean).length : 0;
  const flesch = fleschScore(fullBodyText);
  if (flesch != null && flesch < 30) {
    issues.push({ type: 'readability', severity: 'low', message: `Low readability (Flesch: ${flesch})`, fix: 'Use shorter sentences and simpler words' });
  }

  // Schema.org validation
  const hasSchema = hasSchemaOrg($);
  if (!hasSchema) {
    issues.push({ type: 'schema', severity: 'low', message: 'No Schema.org markup found', fix: 'Add JSON-LD or microdata for rich snippets' });
  }

  // Social meta: Open Graph and Twitter (ogTitle, ogDesc, twitterTitle already extracted above)
  const ogImage = $('meta[property="og:image"]').attr('content');
  const twitterCard = $('meta[name="twitter:card"]').attr('content');
  let socialScore = 100;
  if (!ogTitle) socialScore -= 20;
  if (!ogDesc) socialScore -= 15;
  if (!ogImage) socialScore -= 15;
  if (!twitterCard) socialScore -= 15;
  if (!twitterTitle) socialScore -= 10;
  socialScore = Math.max(0, socialScore);

  // Usability: derived from headings, alt text, readability
  let usabilityScore = 100;
  if (h1Count === 0) usabilityScore -= 25;
  else if (h1Count > 1) usabilityScore -= 15;
  if (missingAltCount > 0) usabilityScore -= Math.min(20, missingAltCount * 5);
  if (flesch != null && flesch < 30) usabilityScore -= 15;
  else if (flesch != null && flesch < 50) usabilityScore -= 5;
  usabilityScore = Math.max(0, usabilityScore);

  score = Math.max(0, Math.min(100, score));

  return {
    score: Math.round(score),
    issues,
    details: {
      title: title || null,
      metaDescription: metaDesc || null,
      h1Count,
      h2Count,
      h3Count,
      h4Count,
      h5Count,
      h6Count,
      wordCount,
      imagesWithAlt: $('img[alt]').length,
      imagesWithoutAlt: missingAltCount,
      hasCanonical: !!canonical,
      canonicalUrl: canonical || null,
      hasRobotsTxt: !!robotsTxt,
      hasSitemap: !!sitemapXml,
      internalLinks,
      externalLinks,
      fleschScore: flesch,
      hasSchema: hasSchema,
      socialScore,
      usabilityScore,
      lang,
      hasHreflang,
      hasNoindex,
      isHttps,
    },
  };
}

module.exports = { runSEOAnalyzer, analyzeSEO: runSEOAnalyzer };
