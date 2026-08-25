const cheerio = require('cheerio');

/**
 * Audit WCAG compliance checks on parsed HTML pages.
 * @param {Object} crawlerResult - Main landing page crawler results containing html
 * @param {Object} siteCrawl - Optional site crawler pages details to aggregate findings
 * @returns {Promise<Object>} Accessibility audit results
 */
async function analyzeAccessibility(crawlerResult, siteCrawl = null) {
  const html = crawlerResult.html || '';
  const $ = crawlerResult.$ || cheerio.load(html);
  
  const findings = [];
  let score = 100;
  
  // 1. Missing Image Alt Text Check
  const images = $('img');
  let missingAltCount = 0;
  images.each((_, el) => {
    const alt = $(el).attr('alt');
    if (alt === undefined || alt === null || alt.trim() === '') {
      missingAltCount++;
    }
  });
  
  if (missingAltCount > 0) {
    const deduct = Math.min(25, missingAltCount * 5);
    score -= deduct;
    findings.push({
      id: 'accessibility-missing-alt',
      title: 'Images Missing Alt Text',
      severity: 'medium',
      category: 'Accessibility',
      description: `${missingAltCount} image elements do not have an "alt" attribute or it is empty. Screen readers cannot describe these images to visually impaired users.`,
      remediation: 'Add meaningful alt attributes to all <img> elements, or set alt="" for decorative images.',
      owasp: 'A05:2021 Security Misconfiguration'
    });
  }

  // 2. Input Elements Missing Labels Check
  const inputs = $('input, select, textarea');
  let missingLabels = 0;
  inputs.each((_, el) => {
    const type = $(el).attr('type');
    if (type === 'hidden' || type === 'submit' || type === 'button') return;
    
    const id = $(el).attr('id');
    const ariaLabel = $(el).attr('aria-label');
    const ariaLabelledby = $(el).attr('aria-labelledby');
    const title = $(el).attr('title');
    
    // Check if label with 'for' matching 'id' exists
    let hasLabel = false;
    if (id) {
      const label = $(`label[for="${id}"]`);
      if (label.length > 0 && label.text().trim().length > 0) {
        hasLabel = true;
      }
    }
    
    // Check if input is nested inside a label element
    if (!hasLabel) {
      const parentLabel = $(el).closest('label');
      if (parentLabel.length > 0 && parentLabel.text().trim().length > 0) {
        hasLabel = true;
      }
    }
    
    if (!hasLabel && !ariaLabel && !ariaLabelledby && !title) {
      missingLabels++;
    }
  });

  if (missingLabels > 0) {
    const deduct = Math.min(25, missingLabels * 5);
    score -= deduct;
    findings.push({
      id: 'accessibility-missing-labels',
      title: 'Form Inputs Missing Accessible Labels',
      severity: 'medium',
      category: 'Accessibility',
      description: `${missingLabels} form inputs lack associated <label> tags, aria-label attributes, or title metadata. Screen readers cannot tell users what these input fields are.`,
      remediation: 'Provide a <label> element with a "for" attribute matching the input ID, or add an "aria-label" attribute.',
      owasp: 'A05:2021 Security Misconfiguration'
    });
  }

  // 3. Heading Hierarchy Skip Check
  const headings = $('h1, h2, h3, h4, h5, h6');
  let skipCount = 0;
  let lastLevel = 0;
  headings.each((_, el) => {
    const level = parseInt(el.name.substring(1), 10);
    if (lastLevel > 0 && level > lastLevel + 1) {
      skipCount++;
    }
    lastLevel = level;
  });

  if (skipCount > 0) {
    score -= 10;
    findings.push({
      id: 'accessibility-heading-skip',
      title: 'Heading Hierarchy Skipped Levels',
      severity: 'low',
      category: 'Accessibility',
      description: 'The heading levels do not progress sequentially (e.g. skipping from an H1 to an H3). This breaks layout understanding for screen reader users.',
      remediation: 'Structure headings sequentially. Ensure an H2 follows an H1, and an H3 follows an H2.',
      owasp: 'A05:2021 Security Misconfiguration'
    });
  }

  // 4. Keyboard Accessibility Check
  // Elements with inline clicks or interactive roles should be focusable via tabindex
  let keyboardFailures = 0;
  $('[onclick], [role="button"], [role="link"]').each((_, el) => {
    const tagName = el.name || el.tagName || '';
    if (['a', 'button', 'input', 'select', 'textarea'].includes(tagName.toLowerCase())) return;
    
    const tabindex = $(el).attr('tabindex');
    if (tabindex === undefined || tabindex === null) {
      keyboardFailures++;
    }
  });

  if (keyboardFailures > 0) {
    const deduct = Math.min(20, keyboardFailures * 5);
    score -= deduct;
    findings.push({
      id: 'accessibility-keyboard-focus',
      title: 'Interactive Elements Not Focusable',
      severity: 'high',
      category: 'Accessibility',
      description: `${keyboardFailures} custom interactive elements (like divs/spans with click handlers or roles) lack a "tabindex" attribute, making them unreachable by keyboard navigation.`,
      remediation: 'Add tabindex="0" to custom interactive controls, and configure keydown event handlers for Space/Enter keys.',
      owasp: 'A05:2021 Security Misconfiguration'
    });
  }

  // 5. Missing Language attribute check
  const htmlLang = $('html').attr('lang');
  if (!htmlLang || htmlLang.trim().length === 0) {
    score -= 10;
    findings.push({
      id: 'accessibility-missing-lang',
      title: 'HTML Tag Missing Language Attribute',
      severity: 'low',
      category: 'Accessibility',
      description: 'The <html> element does not specify a language attribute (lang="en"). Screen readers cannot determine the correct voice synthesis mapping without this attribute.',
      remediation: 'Add the "lang" attribute to the <html> tag, e.g. <html lang="en">.',
      owasp: 'A05:2021 Security Misconfiguration'
    });
  }

  return {
    accessibilityScore: Math.max(0, score),
    findings
  };
}

module.exports = { analyzeAccessibility };
