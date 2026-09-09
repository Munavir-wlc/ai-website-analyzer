const cheerio = require('cheerio');

/**
 * Audit AI Search (LLM / GEO) optimization metrics.
 * @param {Object} crawlerResult - Main landing page crawler results containing html
 * @param {Object} siteCrawl - Site crawler output
 * @returns {Promise<Object>} AI Search GEO results
 */
async function analyzeAiSearch(crawlerResult, siteCrawl = null) {
  const html = crawlerResult.html || '';
  const $ = crawlerResult.$ || cheerio.load(html);
  
  const findings = [];
  let score = 100;
  
  const details = {
    organizationFound: false,
    productServiceFound: false,
    faqFound: false,
    faqOpportunities: [],
    citationsCount: 0,
    entityConsistency: 'low',
    readabilityScore: 100
  };

  // 1. Check for Organization/Entity Structured Data
  const ldJsonScripts = $('script[type="application/ld+json"]');
  let hasOrg = false;
  let hasProduct = false;
  let hasFaq = false;

  ldJsonScripts.each((_, scriptEl) => {
    try {
      const parsed = JSON.parse($(scriptEl).html() || '');
      const list = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of list) {
        const type = item['@type'];
        if (type === 'Organization' || type === 'Corporation' || type === 'LocalBusiness' || type === 'Brand') {
          hasOrg = true;
        }
        if (type === 'Product' || type === 'Service' || type === 'Offer') {
          hasProduct = true;
        }
        if (type === 'FAQPage') {
          hasFaq = true;
        }
      }
    } catch (_) {}
  });

  details.organizationFound = hasOrg;
  details.productServiceFound = hasProduct;
  details.faqFound = hasFaq;

  if (!hasOrg) {
    score -= 20;
    findings.push({
      id: 'geo-missing-org-schema',
      title: 'Missing Organization / Brand Schema',
      severity: 'medium',
      category: 'AI Search/GEO',
      description: 'Search engines using Generative AI (Perplexity, Gemini) rely on Organization or Brand schemas to resolve brand identities and corporate attributes.',
      remediation: 'Declare an Organization type schema in JSON-LD including brand name, logo, contact points, and official social URLs.'
    });
  }

  if (!hasProduct) {
    score -= 15;
    findings.push({
      id: 'geo-missing-product-schema',
      title: 'Missing Product / Service Schema',
      severity: 'medium',
      category: 'AI Search/GEO',
      description: 'The page lacks Product, Service, or Offer schemas. AI search engines cannot reliably compile pricing, specifications, or vendor parameters for comparisons.',
      remediation: 'Implement Product or Service JSON-LD schema describing item specs, offers, and user review scores.'
    });
  }

  // 2. Identify FAQ opportunities
  const headings = $('h1, h2, h3, h4, h5, h6');
  const questionHeadings = [];
  headings.each((_, el) => {
    const text = $(el).text().trim();
    if (text.endsWith('?') || /^(what|how|why|who|where|can|is|should|are|do|does)\s/i.test(text)) {
      questionHeadings.push(text);
    }
  });
  details.faqOpportunities = questionHeadings;

  if (questionHeadings.length > 0 && !hasFaq) {
    score -= 15;
    findings.push({
      id: 'geo-faq-markup-opportunity',
      title: 'FAQ Schema Opportunity Identified',
      severity: 'low',
      category: 'AI Search/GEO',
      description: `We detected ${questionHeadings.length} question-formatted headings (e.g. "${questionHeadings[0]}") but no FAQPage schema markup. AI engines prioritize structured QA blocks for answers.`,
      remediation: 'Wrap your question-and-answer headings in a structured FAQPage JSON-LD schema.'
    });
  }

  // 3. Audit Citation-worthy information
  // Count numbers, currency symbols, percentages, and outward outbound references in body text
  const bodyText = $('body').text() || '';
  
  const percentageMatches = bodyText.match(/\d+%/g) || [];
  const currencyMatches = bodyText.match(/[\$\€\£\¥]\d+/g) || [];
  const numbersMatches = bodyText.match(/\b\d{4}\b|\b\d{1,3}(,\d{3})+(\.\d+)?\b/g) || []; // years or large numbers
  
  const totalFactualSignals = percentageMatches.length + currencyMatches.length + numbersMatches.length;
  details.citationsCount = totalFactualSignals;

  if (totalFactualSignals < 5) {
    score -= 15;
    findings.push({
      id: 'geo-low-citation-signals',
      title: 'Low Factual Citation Density',
      severity: 'medium',
      category: 'AI Search/GEO',
      description: 'The content has a low density of quantitative data (percentages, statistics, currencies) or external references. AI search crawlers favor pages with dense factual summaries for direct citations.',
      remediation: 'Incorporate clear statistics, metrics, dates, and link to authoritative external sources or studies to validate claims.'
    });
  }

  // 4. Entity consistency
  // Compare if title, description, and h1 align on key topics
  const titleText = $('title').text().toLowerCase();
  const descText = $('meta[name="description"]').attr('content')?.toLowerCase() || '';
  const h1Text = $('h1').first().text().toLowerCase();
  
  if (titleText && h1Text) {
    const titleWords = titleText.split(/\s+/).filter(w => w.length > 4);
    const hasOverlap = titleWords.some(w => h1Text.includes(w) || descText.includes(w));
    details.entityConsistency = hasOverlap ? 'high' : 'medium';
  } else {
    details.entityConsistency = 'low';
  }

  if (details.entityConsistency === 'low') {
    score -= 10;
    findings.push({
      id: 'geo-low-entity-consistency',
      title: 'Low Entity Consistency',
      severity: 'low',
      category: 'AI Search/GEO',
      description: 'The primary topics in the page Title, Meta Description, and main H1 heading do not share core keywords. This confuses LLM classifiers trying to index website relevance.',
      remediation: 'Align primary brand keywords and entity definitions across Title, Meta Description, and H1 tags.'
    });
  }

  return {
    aiSearchScore: Math.max(0, score),
    findings,
    details
  };
}

module.exports = { analyzeAiSearch };
