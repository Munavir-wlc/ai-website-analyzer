const cheerio = require('cheerio');

/**
 * Audit technical SEO standards on crawled website assets.
 * @param {Object} crawlerResult - Main landing page crawler results containing html
 * @param {Object} siteCrawl - Site crawler output containing pages, robotsTxt, sitemapXml
 * @returns {Promise<Object>} SEO audit results
 */
async function analyzeSeo(crawlerResult, siteCrawl = null) {
  const html = crawlerResult.html || '';
  const $ = crawlerResult.$ || cheerio.load(html);
  
  const findings = [];
  let score = 100;
  
  const details = {
    title: { exists: false, value: '', length: 0, status: 'missing' },
    description: { exists: false, value: '', length: 0, status: 'missing' },
    headings: { h1: 0, h2: 0, h3: 0 },
    canonical: { exists: false, value: '' },
    robotsMeta: { exists: false, value: '', allowsIndex: true },
    viewport: { exists: false, value: '', isMobileFriendly: false },
    openGraph: { exists: false, tags: {} },
    twitter: { exists: false, tags: {} },
    structuredData: { exists: false, types: [], schemas: [], error: null },
    robotsTxt: { exists: false, hasSitemap: false, sitemaps: [], disallowsCount: 0 },
    sitemap: { exists: false, urlsCount: 0, missingUrls: [] },
    links: { internalCount: 0, externalCount: 0, brokenCount: 0, brokenUrls: [] }
  };

  // 1. Title Validation
  const titleEl = $('title');
  if (titleEl.length > 0) {
    const titleVal = titleEl.text().trim();
    details.title.exists = true;
    details.title.value = titleVal;
    details.title.length = titleVal.length;
    
    if (titleVal.length < 30 || titleVal.length > 60) {
      details.title.status = 'suboptimal';
      score -= 5;
      findings.push({
        id: 'seo-title-suboptimal',
        title: 'Title Tag Suboptimal Length',
        severity: 'low',
        category: 'SEO',
        description: `Page title length is ${titleVal.length} characters (recommended range: 30-60 characters for best display on search result pages).`,
        remediation: 'Update the page title to be descriptive and keep its length between 30 and 60 characters.'
      });
    } else {
      details.title.status = 'optimal';
    }
  } else {
    score -= 20;
    findings.push({
      id: 'seo-title-missing',
      title: 'Missing Page Title Tag',
      severity: 'high',
      category: 'SEO',
      description: 'The page lacks a <title> tag. Search engines cannot index the target page header cleanly.',
      remediation: 'Add a <title> tag inside the <head> block describing the site purpose.'
    });
  }

  // 2. Meta Description Validation
  const descEl = $('meta[name="description"]');
  if (descEl.length > 0) {
    const descVal = descEl.attr('content')?.trim() || '';
    details.description.exists = true;
    details.description.value = descVal;
    details.description.length = descVal.length;
    
    if (descVal.length < 120 || descVal.length > 160) {
      details.description.status = 'suboptimal';
      score -= 5;
      findings.push({
        id: 'seo-desc-suboptimal',
        title: 'Meta Description Suboptimal Length',
        severity: 'low',
        category: 'SEO',
        description: `Meta description length is ${descVal.length} characters (recommended range: 120-160 characters to fit search results snippets).`,
        remediation: 'Refactor the meta description content to keep its length between 120 and 160 characters.'
      });
    } else {
      details.description.status = 'optimal';
    }
  } else {
    score -= 20;
    findings.push({
      id: 'seo-desc-missing',
      title: 'Missing Meta Description Tag',
      severity: 'high',
      category: 'SEO',
      description: 'The webpage lacks a meta description header, causing search engines to auto-generate snippets which may not be click-friendly.',
      remediation: 'Add a <meta name="description" content="..."> tag containing a summary of the site.'
    });
  }

  // 3. Headings Analysis (H1, H2, H3)
  const h1s = $('h1').length;
  const h2s = $('h2').length;
  const h3s = $('h3').length;
  details.headings.h1 = h1s;
  details.headings.h2 = h2s;
  details.headings.h3 = h3s;

  if (h1s === 0) {
    score -= 15;
    findings.push({
      id: 'seo-h1-missing',
      title: 'Missing H1 Heading Tag',
      severity: 'high',
      category: 'SEO',
      description: 'The page does not contain any H1 tags. An H1 is critical for search engines to identify the main topic of the page.',
      remediation: 'Place exactly one H1 header representing the primary page topic.'
    });
  } else if (h1s > 1) {
    score -= 8;
    findings.push({
      id: 'seo-h1-multiple',
      title: 'Multiple H1 Heading Tags',
      severity: 'medium',
      category: 'SEO',
      description: `The page contains ${h1s} H1 headings. Multiple H1 tags can dilute content focus for search crawlers.`,
      remediation: 'Consolidate headings so there is exactly one H1, using H2/H3 for other subheadings.'
    });
  }

  // 4. Canonical URL
  const canonicalEl = $('link[rel="canonical"]');
  if (canonicalEl.length > 0) {
    details.canonical.exists = true;
    details.canonical.value = canonicalEl.attr('href') || '';
  } else {
    score -= 10;
    findings.push({
      id: 'seo-canonical-missing',
      title: 'Missing Canonical Link Tag',
      severity: 'medium',
      category: 'SEO',
      description: 'The page lacks a canonical link tag (<link rel="canonical">). This increases duplicate content risks across different URL mappings.',
      remediation: 'Add a rel="canonical" link in the header pointing to the canonical URL of the page.'
    });
  }

  // 5. Robots Meta Tag Check
  const robotsMetaEl = $('meta[name="robots"]');
  if (robotsMetaEl.length > 0) {
    const val = robotsMetaEl.attr('content') || '';
    details.robotsMeta.exists = true;
    details.robotsMeta.value = val;
    if (/noindex/i.test(val)) {
      details.robotsMeta.allowsIndex = false;
      score -= 15;
      findings.push({
        id: 'seo-robots-noindex',
        title: 'Robots meta tag disables search indexing',
        severity: 'high',
        category: 'SEO',
        description: `Robots meta is set to: "${val}". The "noindex" directive instructs search engines not to list this site in search results.`,
        remediation: 'If this page is meant for public search results, replace "noindex" with "index" in the robots meta tag.'
      });
    }
  }

  // 6. Mobile Viewport Check
  const viewportEl = $('meta[name="viewport"]');
  if (viewportEl.length > 0) {
    const val = viewportEl.attr('content') || '';
    details.viewport.exists = true;
    details.viewport.value = val;
    if (val.includes('width=device-width') || val.includes('initial-scale=')) {
      details.viewport.isMobileFriendly = true;
    }
  }
  if (!details.viewport.isMobileFriendly) {
    score -= 15;
    findings.push({
      id: 'seo-viewport-bad',
      title: 'Missing or Invalid Mobile Viewport Tag',
      severity: 'high',
      category: 'SEO',
      description: 'The page is missing a mobile-responsive viewport meta tag. This negatively impacts indexability under mobile-first search layouts.',
      remediation: 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to the head block.'
    });
  }

  // 7. Open Graph and Twitter Card Check
  const ogTitle = $('meta[property="og:title"]').attr('content');
  const ogDesc = $('meta[property="og:description"]').attr('content');
  const ogImage = $('meta[property="og:image"]').attr('content');
  if (ogTitle) details.openGraph.tags['og:title'] = ogTitle;
  if (ogDesc) details.openGraph.tags['og:description'] = ogDesc;
  if (ogImage) details.openGraph.tags['og:image'] = ogImage;
  details.openGraph.exists = Object.keys(details.openGraph.tags).length > 0;

  const twCard = $('meta[name="twitter:card"]').attr('content');
  const twTitle = $('meta[name="twitter:title"]').attr('content');
  const twDesc = $('meta[name="twitter:description"]').attr('content');
  if (twCard) details.twitter.tags['twitter:card'] = twCard;
  if (twTitle) details.twitter.tags['twitter:title'] = twTitle;
  if (twDesc) details.twitter.tags['twitter:description'] = twDesc;
  details.twitter.exists = Object.keys(details.twitter.tags).length > 0;

  if (!details.openGraph.exists && !details.twitter.exists) {
    score -= 5;
    findings.push({
      id: 'seo-social-missing',
      title: 'Social Metadata Tags Missing',
      severity: 'low',
      category: 'SEO',
      description: 'Open Graph and Twitter Card headers are absent. Social media platforms cannot generate previews when links are shared.',
      remediation: 'Add og:title, og:description, og:image and twitter:card meta properties to support social previews.'
    });
  }

  // 8. Schema.org / JSON-LD Detection
  const ldJsonScripts = $('script[type="application/ld+json"]');
  if (ldJsonScripts.length > 0) {
    details.structuredData.exists = true;
    ldJsonScripts.each((_, scriptEl) => {
      try {
        const text = $(scriptEl).html() || '';
        const parsed = JSON.parse(text);
        details.structuredData.schemas.push(parsed);
        
        // Parse schema context/type
        const types = Array.isArray(parsed) ? parsed.map(p => p['@type']) : [parsed['@type']];
        for (const t of types) {
          if (t && !details.structuredData.types.includes(t)) {
            details.structuredData.types.push(t);
          }
        }
      } catch (err) {
        details.structuredData.error = err.message;
      }
    });
  }
  if (!details.structuredData.exists) {
    score -= 10;
    findings.push({
      id: 'seo-structured-data-missing',
      title: 'Missing Structured Schema.org Data',
      severity: 'medium',
      category: 'SEO',
      description: 'No JSON-LD or microdata structured schemas were found. Search crawlers cannot display rich search results without structured markup.',
      remediation: 'Implement structured data using JSON-LD, declaring types like Organization, WebSite, or Product.'
    });
  } else if (details.structuredData.error) {
    score -= 5;
    findings.push({
      id: 'seo-structured-data-error',
      title: 'Structured Schema.org Data Syntax Error',
      severity: 'medium',
      category: 'SEO',
      description: `JSON-LD scripts contain invalid JSON formatting syntax: ${details.structuredData.error}. Search crawlers will ignore it.`,
      remediation: 'Correct the syntax errors inside your JSON-LD scripts.'
    });
  }

  // 9. Sitemap & Robots.txt Checks
  if (siteCrawl) {
    if (siteCrawl.robotsTxt) {
      details.robotsTxt.exists = true;
      const lines = siteCrawl.robotsTxt.split('\n');
      for (const line of lines) {
        if (/^sitemap\s*:/i.test(line)) {
          details.robotsTxt.hasSitemap = true;
          details.robotsTxt.sitemaps.push(line.split(':')[1].trim());
        }
        if (/^disallow\s*:/i.test(line)) {
          details.robotsTxt.disallowsCount++;
        }
      }
    }
    if (!details.robotsTxt.exists) {
      score -= 10;
      findings.push({
        id: 'seo-robotstxt-missing',
        title: 'Missing robots.txt File',
        severity: 'medium',
        category: 'SEO',
        description: 'No robots.txt file was detected. Crawlers may hit administrative or duplicate content without limits.',
        remediation: 'Publish a robots.txt file under the domain root folder.'
      });
    }

    if (siteCrawl.sitemapXml) {
      details.sitemap.exists = true;
      const { extractUrlsFromSitemap } = require('./siteCrawler');
      const sitemapUrls = extractUrlsFromSitemap(siteCrawl.sitemapXml);
      details.sitemap.urlsCount = sitemapUrls.length;

      // Check if crawled internal URLs are missing from sitemap
      const crawled = siteCrawl.pages.map(p => p.url);
      const missing = crawled.filter(c => !sitemapUrls.includes(c));
      details.sitemap.missingUrls = missing;
      
      if (missing.length > 0) {
        findings.push({
          id: 'seo-sitemap-missing-urls',
          title: 'Crawled URLs Missing in sitemap.xml',
          severity: 'low',
          category: 'SEO',
          description: `${missing.length} crawled same-origin URLs are not listed in sitemap.xml.`,
          remediation: 'Update sitemap.xml to include all active, indexable URLs.'
        });
      }
    } else {
      score -= 10;
      findings.push({
        id: 'seo-sitemap-missing',
        title: 'Missing sitemap.xml file',
        severity: 'medium',
        category: 'SEO',
        description: 'No sitemap.xml file was detected. Search engines cannot easily locate all indexable pages.',
        remediation: 'Generate a sitemap.xml containing indexable URLs and reference it in robots.txt.'
      });
    }

    // 10. Links and Broken Links Check
    const pages = siteCrawl.pages || [];
    details.links.internalCount = pages.length;
    
    // Check for broken links (HTTP status non-2xx)
    const broken = pages.filter(p => p.statusCode >= 400);
    details.links.brokenCount = broken.length;
    details.links.brokenUrls = broken.map(p => ({ url: p.url, status: p.statusCode }));

    if (broken.length > 0) {
      score -= Math.min(25, broken.length * 8);
      findings.push({
        id: 'seo-broken-links',
        title: 'Broken Internal Links Detected',
        severity: 'high',
        category: 'SEO',
        description: `We detected ${broken.length} broken internal links (returning non-2xx status codes during crawling). This breaks crawler navigation and user journeys.`,
        remediation: `Inspect and fix or delete the broken URLs: ${broken.slice(0, 3).map(b => `${b.url} (${b.statusCode})`).join(', ')}.`,
        owasp: 'A05:2021 Security Misconfiguration'
      });
    }
  }

  return {
    seoScore: Math.max(0, score),
    findings,
    details
  };
}

module.exports = { analyzeSeo };
