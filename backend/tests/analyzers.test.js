const cheerio = require('cheerio');
const { analyzePerformance } = require('../src/services/performanceAnalyzer');
const { analyzeAccessibility } = require('../src/services/accessibilityAnalyzer');
const { analyzeSeo } = require('../src/services/seoAnalyzer');
const { analyzeAiSearch } = require('../src/services/aiSearchAnalyzer');
const { calculateScores } = require('../src/services/scoringEngine');

describe('Website Auditing Services Unit Tests', () => {
  
  describe('Performance Analyzer Heuristics', () => {
    it('should calculate fallback performance scores correctly', async () => {
      // In tests, Puppeteer may fall back to default timings due to sandbox restrictions
      const res = await analyzePerformance('http://localhost:3000');
      expect(res).toHaveProperty('performanceScore');
      expect(res.opportunities.length).toBe(0);
      expect(res.diagnostics.length).toBeGreaterThan(0);
    });
  });

  describe('Accessibility WCAG Auditing', () => {
    it('should detect missing image alt-text and unlabelled inputs', async () => {
      const mockHtml = `
        <html>
          <body>
            <img src="/logo.png" />
            <input type="text" id="username" />
            <h1>Main Title</h1>
            <h3>Hierarchy Skip</h3>
          </body>
        </html>
      `;
      const $ = cheerio.load(mockHtml);
      const crawlerResult = { html: mockHtml, $ };
      
      const res = await analyzeAccessibility(crawlerResult);
      expect(res.accessibilityScore).toBeLessThan(100);
      
      const ids = res.findings.map(f => f.id);
      expect(ids).toContain('accessibility-missing-alt');
      expect(ids).toContain('accessibility-missing-labels');
      expect(ids).toContain('accessibility-heading-skip');
    });

    it('should pass on fully compliant WCAG html structures', async () => {
      const cleanHtml = `
        <html lang="en">
          <body>
            <img src="/logo.png" alt="Company Logo" />
            <label for="username">Username</label>
            <input type="text" id="username" />
            <h1>First Level Heading</h1>
            <h2>Second Level Heading</h2>
          </body>
        </html>
      `;
      const $ = cheerio.load(cleanHtml);
      const crawlerResult = { html: cleanHtml, $ };
      
      const res = await analyzeAccessibility(crawlerResult);
      expect(res.accessibilityScore).toBe(100);
      expect(res.findings.length).toBe(0);
    });
  });

  describe('Technical SEO Auditing', () => {
    it('should validate title, meta descriptions, and Schema.org syntax', async () => {
      const badSeoHtml = `
        <html>
          <head>
            <title>Short</title>
          </head>
          <body>
            <h1>Multiple H1</h1>
            <h1>Another H1</h1>
            <script type="application/ld+json">
              { invalid json syntax here }
            </script>
          </body>
        </html>
      `;
      const $ = cheerio.load(badSeoHtml);
      const crawlerResult = { html: badSeoHtml, $ };
      
      const res = await analyzeSeo(crawlerResult);
      expect(res.seoScore).toBeLessThan(100);
      
      const ids = res.findings.map(f => f.id);
      expect(ids).toContain('seo-title-suboptimal');
      expect(ids).toContain('seo-desc-missing');
      expect(ids).toContain('seo-h1-multiple');
      expect(ids).toContain('seo-structured-data-error');
    });

    it('should identify sitemap XML gaps and broken links', async () => {
      const mockHtml = `
        <html lang="en">
          <head>
            <title>Perfect Page Title Containing More Than Thirty Characters</title>
            <meta name="description" content="This is a perfectly long meta description that should satisfy the standard validation constraints of length check." />
            <link rel="canonical" href="https://example.com" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <meta property="og:title" content="Example" />
            <script type="application/ld+json">
              {
                "@context": "https://schema.org",
                "@type": "WebSite",
                "name": "Example"
              }
            </script>
          </head>
          <body>
            <h1>Main Title</h1>
          </body>
        </html>
      `;
      const $ = cheerio.load(mockHtml);
      const crawlerResult = { html: mockHtml, $ };
      const siteCrawl = {
        robotsTxt: 'Sitemap: https://example.com/sitemap.xml\nDisallow: /admin',
        sitemapXml: '<?xml version="1.0" encoding="UTF-8"?><urlset><url><loc>https://example.com/home</loc></url></urlset>',
        pages: [
          { url: 'https://example.com/home', statusCode: 200 },
          { url: 'https://example.com/about-us', statusCode: 404 } // broken link
        ]
      };

      const res = await analyzeSeo(crawlerResult, siteCrawl);
      expect(res.details.sitemap.missingUrls).toContain('https://example.com/about-us');
      expect(res.details.links.brokenCount).toBe(1);
      
      const ids = res.findings.map(f => f.id);
      expect(ids).toContain('seo-sitemap-missing-urls');
      expect(ids).toContain('seo-broken-links');
    });
  });

  describe('AI Search (GEO) Optimization Auditing', () => {
    it('should audit entity details, citation density, and FAQ opportunities', async () => {
      const mockHtml = `
        <html>
          <body>
            <h2>How does it work?</h2>
            <h3>What is the price?</h3>
            <p>Our solution has a 99.9% uptime rating, costs $49, and was established in 2026.</p>
          </body>
        </html>
      `;
      const $ = cheerio.load(mockHtml);
      const crawlerResult = { html: mockHtml, $ };
      
      const res = await analyzeAiSearch(crawlerResult);
      expect(res.details.citationsCount).toBeGreaterThanOrEqual(3); // 99.9%, $49, 2026
      expect(res.details.faqOpportunities).toContain('How does it work?');
      expect(res.details.faqOpportunities).toContain('What is the price?');
      
      const ids = res.findings.map(f => f.id);
      expect(ids).toContain('geo-missing-org-schema');
      expect(ids).toContain('geo-faq-markup-opportunity');
    });
  });

  describe('Deterministic Scoring Engine', () => {
    it('should combine category scores into a single weighted average', () => {
      const mockCrawler = {
        html: '<html><body><p>This is a short body text containing under 30 words.</p></body></html>'
      };
      
      const scores = calculateScores({
        securityResult: { score: 90 },
        performanceResult: { performanceScore: 80 },
        seoResult: { seoScore: 90 },
        accessibilityResult: { accessibilityScore: 70 },
        aiSearchResult: { aiSearchScore: 60 },
        crawlerResult: mockCrawler
      });

      expect(scores.overall).toBeGreaterThan(0);
      expect(scores.overall).toBeLessThan(100);
      expect(scores.content).toBeLessThan(100); // penalized for thin content and contact info
      expect(scores.overallGrade).toMatch(/^[A-F][+-]?$/);
    });
  });
});
