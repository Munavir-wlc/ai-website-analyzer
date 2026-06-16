/**
 * Social Meta Helper - Parses OG and Twitter meta tags from HTML
 * Extended for accurate social sharing readiness
 */
const cheerio = require('cheerio');

// Penalties for missing/imperfect tags (total 100)
const PENALTIES = {
  ogTitle: 18,
  ogDesc: 15,
  ogImage: 15,
  ogUrl: 5,
  ogType: 4,
  twitterCard: 15,
  twitterTitle: 10,
  twitterDesc: 8,
  twitterImage: 10,
};

// Recommended lengths
const OG_TITLE_MAX = 60;
const OG_DESC_MAX = 160;
const OG_DESC_MIN = 120;

/**
 * Check if URL is absolute (http/https)
 */
function isAbsoluteUrl(val) {
  if (!val || typeof val !== 'string') return false;
  const t = val.trim();
  return t.startsWith('http://') || t.startsWith('https://');
}

/**
 * Analyze social meta tags and return score 0-100 + details
 * @param {string} html - Raw HTML of the page
 * @returns {Object} { socialScore: number, details?: Object }
 */
function analyzeSocialMeta(html) {
  if (!html || typeof html !== 'string') {
    return { socialScore: null };
  }

  const $ = cheerio.load(html);

  const ogTitle = $('meta[property="og:title"]').attr('content')?.trim();
  const ogDesc = $('meta[property="og:description"]').attr('content')?.trim();
  const ogImage = $('meta[property="og:image"]').attr('content')?.trim();
  const ogUrl = $('meta[property="og:url"]').attr('content')?.trim();
  const ogType = $('meta[property="og:type"]').attr('content')?.trim();
  const twitterCard = $('meta[name="twitter:card"]').attr('content')?.trim();
  const twitterTitle = $('meta[name="twitter:title"]').attr('content')?.trim();
  const twitterDesc = $('meta[name="twitter:description"]').attr('content')?.trim();
  const twitterImage = $('meta[name="twitter:image"]').attr('content')?.trim();

  let socialScore = 100;

  if (!ogTitle) socialScore -= PENALTIES.ogTitle;
  else if (ogTitle.length > OG_TITLE_MAX) socialScore -= 4;

  if (!ogDesc) socialScore -= PENALTIES.ogDesc;
  else if (ogDesc.length < OG_DESC_MIN || ogDesc.length > OG_DESC_MAX) socialScore -= 5;

  if (!ogImage) socialScore -= PENALTIES.ogImage;
  else if (!isAbsoluteUrl(ogImage)) socialScore -= 8;

  if (!ogUrl) socialScore -= PENALTIES.ogUrl;
  if (!ogType) socialScore -= PENALTIES.ogType;

  if (!twitterCard) socialScore -= PENALTIES.twitterCard;
  if (!twitterTitle) socialScore -= PENALTIES.twitterTitle;
  if (!twitterDesc) socialScore -= PENALTIES.twitterDesc;
  if (!twitterImage) socialScore -= PENALTIES.twitterImage;
  else if (!isAbsoluteUrl(twitterImage)) socialScore -= 5;

  socialScore = Math.max(0, Math.min(100, socialScore));

  const details = {
    hasOgTitle: !!ogTitle,
    hasOgDesc: !!ogDesc,
    hasOgImage: !!ogImage,
    hasOgUrl: !!ogUrl,
    hasOgType: !!ogType,
    hasTwitterCard: !!twitterCard,
    hasTwitterTitle: !!twitterTitle,
    hasTwitterDesc: !!twitterDesc,
    hasTwitterImage: !!twitterImage,
    ogTitleLength: ogTitle?.length ?? 0,
    ogDescLength: ogDesc?.length ?? 0,
  };

  return { socialScore, details };
}

module.exports = { analyzeSocialMeta };
