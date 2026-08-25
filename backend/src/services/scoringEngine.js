const cheerio = require('cheerio');

/**
 * 0-100 score to letter grade converter
 */
function scoreToLetterGrade(score) {
  if (score == null || score < 0) return 'F';
  const s = Math.min(100, Math.round(score));
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

/**
 * Compute Content score based on body text density and trust signals.
 */
function calculateContentScore(crawlerResult) {
  const html = crawlerResult.html || '';
  const $ = crawlerResult.$ || cheerio.load(html);
  
  let score = 100;
  const findings = [];
  
  const bodyText = $('body').text() || '';
  const words = bodyText.trim().split(/\s+/).filter(w => w.length > 0).length;
  
  if (words < 300) {
    score -= 25;
    findings.push({
      id: 'content-thin-text',
      title: 'Thin Body Text Content',
      severity: 'medium',
      category: 'Content',
      description: `We detected only ${words} words on the target page. Search engines and AI algorithms penalize thin content blocks.`,
      remediation: 'Expand the page content to provide at least 300-600 words of rich, descriptive text.'
    });
  } else if (words < 600) {
    score -= 10;
    findings.push({
      id: 'content-low-text',
      title: 'Low Text Word Count',
      severity: 'low',
      category: 'Content',
      description: `The page contains ${words} words. The ideal content range for search ranking is above 600 words.`,
      remediation: 'Expand service descriptions or outline user features in detail.'
    });
  }

  // Check for contact signals (email or phone formats in text)
  const hasEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(bodyText);
  const hasPhone = /(\+?\d{1,4}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(bodyText);
  if (!hasEmail && !hasPhone) {
    score -= 15;
    findings.push({
      id: 'content-missing-contact',
      title: 'Missing Brand Trust/Contact Details',
      severity: 'medium',
      category: 'Content',
      description: 'We could not detect any email addresses or phone formats in the page copy. This reduces credibility scores for both users and crawlers.',
      remediation: 'Add a contact email, phone number, or link to a contact page.'
    });
  }

  // Check for terms/privacy page links
  let hasLegalLinks = false;
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (/privacy|terms|legal|disclaimer/i.test(href)) {
      hasLegalLinks = true;
    }
  });

  if (!hasLegalLinks) {
    score -= 15;
    findings.push({
      id: 'content-missing-legal',
      title: 'Missing Terms of Use or Privacy Links',
      severity: 'medium',
      category: 'Content',
      description: 'No links to Privacy Policy or Terms of Service documents were found. Compliance frameworks expect these resources.',
      remediation: 'Add footer links referencing your Privacy Policy and Terms of Use.'
    });
  }

  return {
    contentScore: Math.max(0, score),
    findings
  };
}

/**
 * Aggregates sub-scores to calculate a weighted overall grade.
 */
function calculateScores({ securityResult, performanceResult, seoResult, accessibilityResult, aiSearchResult, crawlerResult }) {
  // 1. Resolve security score
  let securityScore = securityResult.score ?? 100;
  
  // 2. Resolve performance score
  let performanceScore = performanceResult.performanceScore ?? 100;
  
  // 3. Resolve accessibility score
  let accessibilityScore = accessibilityResult.accessibilityScore ?? 100;
  
  // 4. Resolve SEO score
  let seoScore = seoResult.seoScore ?? 100;
  
  // 5. Resolve AI search score
  let aiSearchScore = aiSearchResult.aiSearchScore ?? 100;
  
  // 6. Compute Content score
  const content = calculateContentScore(crawlerResult);
  let contentScore = content.contentScore;

  // 7. Calculate overall weighted score
  // Overall = (Security * 0.25) + (Performance * 0.20) + (SEO * 0.20) + (Accessibility * 0.15) + (Content * 0.10) + (GEO * 0.10)
  const overallScore = Math.max(0, Math.round(
    (securityScore * 0.25) +
    (performanceScore * 0.20) +
    (seoScore * 0.20) +
    (accessibilityScore * 0.15) +
    (contentScore * 0.10) +
    (aiSearchScore * 0.10)
  ));

  return {
    overall: overallScore,
    overallGrade: scoreToLetterGrade(overallScore),
    
    security: securityScore,
    securityGrade: scoreToLetterGrade(securityScore),
    
    performance: performanceScore,
    performanceGrade: scoreToLetterGrade(performanceScore),
    
    seo: seoScore,
    seoGrade: scoreToLetterGrade(seoScore),
    
    accessibility: accessibilityScore,
    accessibilityGrade: scoreToLetterGrade(accessibilityScore),
    
    content: contentScore,
    contentGrade: scoreToLetterGrade(contentScore),
    contentFindings: content.findings,
    
    aiSearch: aiSearchScore,
    aiSearchGrade: scoreToLetterGrade(aiSearchScore)
  };
}

module.exports = { calculateScores, scoreToLetterGrade };
