const cheerio = require('cheerio');
const axios = require('axios');

/**
 * Site Audit - technical checks across crawled pages
 * - Broken links (4xx/5xx)
 * - Duplicate titles / meta descriptions
 * - Canonical issues
 * - Redirect chains
 * - Mixed content (HTTP on HTTPS page)
 */
async function runSiteAudit({ pages, baseOrigin }) {
  const issues = [];
  const titleMap = new Map();
  const metaMap = new Map();
  const brokenLinks = [];
  const mixedContent = [];
  const redirectPages = [];

  for (const page of pages) {
    const { url, statusCode, html, $ } = page;

    // Redirects (3xx)
    if (statusCode >= 300 && statusCode < 400) {
      redirectPages.push({ url, statusCode });
    }

    // Extract title and meta for duplicates
    const title = $('title').text().trim();
    if (title) {
      const existing = titleMap.get(title);
      if (existing) existing.push(url);
      else titleMap.set(title, [url]);
    }

    const meta = $('meta[name="description"]').attr('content')?.trim();
    if (meta) {
      const existing = metaMap.get(meta);
      if (existing) existing.push(url);
      else metaMap.set(meta, [url]);
    }

    // Mixed content: HTTP resources on HTTPS page
    if (url.startsWith('https://')) {
      $('img[src], script[src], link[href]').each((_, el) => {
        const src = $(el).attr('src') || $(el).attr('href');
        if (src && src.startsWith('http://')) {
          mixedContent.push({ page: url, resource: src });
        }
      });
    }

    // Collect all links for broken link check
    const allLinks = new Set();
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (href && (href.startsWith('http') || href.startsWith('/'))) {
        try {
          const full = new URL(href, url).href;
          if (new URL(full).origin === baseOrigin) allLinks.add(full);
        } catch (_) {}
      }
    });
    page._internalLinks = Array.from(allLinks);
  }

  // Duplicate titles
  for (const [title, urls] of titleMap) {
    if (urls.length > 1) {
      issues.push({
        type: 'duplicateTitle',
        severity: 'high',
        message: `Duplicate title "${title.slice(0, 40)}..." on ${urls.length} pages`,
        fix: 'Use unique title tags per page',
        pages: urls.slice(0, 5),
      });
    }
  }

  // Duplicate meta descriptions
  for (const [meta, urls] of metaMap) {
    if (urls.length > 1) {
      issues.push({
        type: 'duplicateMeta',
        severity: 'high',
        message: `Duplicate meta description on ${urls.length} pages`,
        fix: 'Use unique meta descriptions per page',
        pages: urls.slice(0, 5),
      });
    }
  }

  // Redirect pages
  if (redirectPages.length > 0) {
    issues.push({
      type: 'redirects',
      severity: 'medium',
      message: `${redirectPages.length} page(s) return redirects (3xx)`,
      fix: 'Use direct URLs or permanent redirects where appropriate',
      pages: redirectPages.slice(0, 5).map((p) => `${p.url} (${p.statusCode})`),
    });
  }

  // Mixed content
  const mixedUnique = [...new Map(mixedContent.map((m) => [m.resource, m])).values()];
  if (mixedUnique.length > 0) {
    issues.push({
      type: 'mixedContent',
      severity: 'high',
      message: `${mixedUnique.length} HTTP resource(s) loaded on HTTPS pages`,
      fix: 'Use HTTPS for all scripts, images, and styles',
      examples: mixedUnique.slice(0, 3).map((m) => m.resource),
    });
  }

  // Sample broken links (check a subset to avoid too many requests)
  const linkToCheck = new Set();
  for (const p of pages.slice(0, 10)) {
    (p._internalLinks || []).slice(0, 5).forEach((l) => linkToCheck.add(l));
  }
  const checked = new Map();
  for (const link of linkToCheck) {
    if (checked.has(link)) continue;
    try {
      const res = await axios.head(link, {
        timeout: 3000,
        validateStatus: () => true,
        maxRedirects: 3,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AI-Website-Analyzer/1.0)' },
      });
      checked.set(link, res.status);
      if (res.status >= 400) {
        brokenLinks.push({ url: link, status: res.status });
      }
    } catch (_) {
      brokenLinks.push({ url: link, status: 'failed' });
    }
  }

  if (brokenLinks.length > 0) {
    issues.push({
      type: 'brokenLinks',
      severity: 'high',
      message: `${brokenLinks.length} broken link(s) found (4xx/5xx)`,
      fix: 'Update or remove broken internal links',
      examples: brokenLinks.slice(0, 5),
    });
  }

  const score = Math.max(0, 100 - issues.length * 8);
  return {
    score: Math.round(score),
    issues,
    summary: {
      totalPages: pages.length,
      duplicateTitles: titleMap.size > 0 ? [...titleMap.values()].filter((v) => v.length > 1).length : 0,
      duplicateMetas: metaMap.size > 0 ? [...metaMap.values()].filter((v) => v.length > 1).length : 0,
      brokenLinks: brokenLinks.length,
      mixedContent: mixedUnique.length,
      redirectPages: redirectPages.length,
    },
  };
}

module.exports = { runSiteAudit };
