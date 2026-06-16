/**
 * Keyword Analyzer - Extracts on-page keyword metrics for Rankings section
 * Primary keyword from title/H1, density, related keywords from content.
 * Optional: DataForSEO API for enriched related keywords when credentials set.
 */

const cheerio = require("cheerio");
const axios = require("axios");

const STOP_WORDS = new Set([
  "the","a","an","is","are","was","were","be","been","being",
  "have","has","had","do","does","did","will","would","could",
  "should","may","might","must","shall","can","need","dare",
  "to","of","in","for","on","with","at","by","from","as",
  "into","through","during","before","after","above","below",
  "between","under","again","further","then","once","here",
  "there","when","where","why","how","all","each","few",
  "more","most","other","some","such","no","nor","not",
  "only","own","same","so","than","too","very","just",
  "and","but","if","or","because","until","while","this",
  "that","these","those","it","its","you","your","we","our"
]);

/**
 * Extract primary keyword from H1 or title
 */
function derivePrimaryKeyword(h1Text, title, bodyText) {

  const clean = (text) =>
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const h1 = clean(h1Text || "");
  const pageTitle = clean(title || "");

  // Extract candidate phrases from content
  const phrases = extractPhrases(bodyText, 2, 10);

  // If H1 contains useful words, try to match them with content phrases
  if (h1) {
    const h1Words = h1.split(" ").filter(w => w.length > 3);

    const match = phrases.find(p =>
      h1Words.some(w => p.includes(w))
    );

    if (match) return match;
  }

  // fallback: title phrase
  if (pageTitle) {
    const titleWords = pageTitle.split(" ").filter(w => w.length > 3);

    const match = phrases.find(p =>
      titleWords.some(w => p.includes(w))
    );

    if (match) return match;
  }

  // fallback: most frequent phrase
  return phrases[0] || "";
}


/**
 * Extract phrases ranked by frequency
 */
function extractPhrases(text, phraseLength = 2, limit = 10) {

  if (!text || text.length < 10) return [];

  const normalized = text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = normalized
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));

  const counts = new Map();

  for (let i = 0; i <= words.length - phraseLength; i++) {

    const phrase = words.slice(i, i + phraseLength).join(" ");

    if (phrase.length > 4) {
      counts.set(phrase, (counts.get(phrase) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .filter(([_, count]) => count >= 2)   // ignore rare phrases
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([phrase]) => phrase);
}


/**
 * Count keyword occurrences
 */
function countKeywordOccurrences(text, keyword) {

  if (!text || !keyword) return 0;

  const k = keyword.toLowerCase();

  const regex = new RegExp(
    `\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
    "gi"
  );

  const matches = text.match(regex);

  return matches ? matches.length : 0;
}


/**
 * Check if keyword appears in text
 */
function keywordInText(keyword, targetText) {

  if (!keyword || !targetText) return false;

  const target = targetText.toLowerCase();

  const words = keyword.toLowerCase().split(/\s+/).filter(Boolean);

  return words.some(w => target.includes(w)) || target.includes(keyword);
}


/**
 * Fetch related keywords from DataForSEO API (optional)
 */
async function fetchDataForSeoRelated(keyword) {

  const login = process.env.DATA_FOR_SEO_LOGIN;
  const password = process.env.DATA_FOR_SEO_PASSWORD;

  if (!login || !password) return null;

  try {

    const auth = Buffer.from(`${login}:${password}`).toString("base64");

    const res = await axios({
      method: "post",
      url: "https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json"
      },
      data: [{
        keywords: [keyword],
        location_code: 2840,
        language_code: "en"
      }],
      timeout: 10000
    });

    const items =
      res.data?.tasks?.[0]?.result?.[0]?.keyword_ideas || [];

    return items
      .slice(0, 8)
      .map(k => k.keyword)
      .filter(Boolean);

  } catch (err) {

    console.warn(
      "[keywordAnalyzer] DataForSEO API failed:",
      err.message
    );

    return null;
  }
}


/**
 * Analyze keywords from page HTML
 */
function analyzeKeywords(crawlerData, seoDetails = {}) {

  const { html } = crawlerData;

  const $ = cheerio.load(html || "");

  // Remove scripts and styles
  $("script, style, noscript").remove();

  const bodyText = (
    $("main, article, section, .content, #content").text() ||
    $("body").text()
  )
    .replace(/\s+/g, " ")
    .trim();

  const wordCount =
    bodyText.split(/\s+/).filter(Boolean).length || 0;

  let title = seoDetails.title;

  if (!title) {

    title =
      $("title").text().trim() ||
      $("meta[property='og:title']").attr("content")?.trim() ||
      $("meta[name='twitter:title']").attr("content")?.trim();
  }

  const h1Text = $("h1").first().text().trim() || "";

  const primaryKeyword = derivePrimaryKeyword(
    h1Text,
    title,
    bodyText
  );

  const kwCount = countKeywordOccurrences(
    bodyText,
    primaryKeyword
  );

  const keywordDensity =
    wordCount > 0 && primaryKeyword
      ? ((kwCount / wordCount) * 100).toFixed(1) + "%"
      : null;

  const keywordInTitle = primaryKeyword
    ? keywordInText(primaryKeyword, title || "")
    : false;

  const keywordInH1 = primaryKeyword
    ? keywordInText(primaryKeyword, h1Text || "")
    : false;


  // Extract 2-word and 3-word phrases
  const phrases2 = extractPhrases(bodyText, 2, 5);
  const phrases3 = extractPhrases(bodyText, 3, 5);

  const topRelatedKeywords = [...phrases2, ...phrases3].slice(0, 10);


  return {
    primaryKeyword: primaryKeyword || null,
    wordCount: wordCount || seoDetails.wordCount || null,
    keywordDensity,
    keywordInTitle,
    keywordInH1,
    topRelatedKeywords:
      topRelatedKeywords.length > 0
        ? topRelatedKeywords
        : null
  };
}


/**
 * Async analyzer with optional DataForSEO enrichment
 */
async function analyzeKeywordsAsync(crawlerData, seoDetails = {}) {

  const base = analyzeKeywords(crawlerData, seoDetails);

  if (!base.primaryKeyword) return base;

  const apiKeywords = await fetchDataForSeoRelated(
    base.primaryKeyword
  );

  if (apiKeywords && apiKeywords.length > 0) {

    const onPage = new Set(base.topRelatedKeywords || []);

    const merged = [
      ...apiKeywords.filter(k => !onPage.has(k)),
      ...(base.topRelatedKeywords || [])
    ];

    base.topRelatedKeywords = merged.slice(0, 10);
  }

  return base;
}


module.exports = {
  analyzeKeywords,
  analyzeKeywordsAsync,
  derivePrimaryKeyword,
  extractPhrases
};