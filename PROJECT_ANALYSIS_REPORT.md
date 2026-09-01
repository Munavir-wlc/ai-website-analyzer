# AI Website Analyser - Core Feature Analysis Report

Generated on: 2026-06-18

## Core Product Goal

The product promise is: a user enters a website URL, the system uses automated analysis plus AI to find website vulnerabilities and quality issues, then generates a useful report.

The current codebase already supports this direction, with comprehensive security analysis including passive technology fingerprinting, real-time OSV.dev CVE matching, security headers grading, SSL, DNS, exposed files, robots.txt, redirect chain analysis, and optional AI observations.

## What We Have Now

### Frontend

- Next.js dashboard UI.
- URL scan form with three visible scan modes:
  - SEO Scan
  - VAPT Security Scan
  - Full Scan
- Results page stores the scan result in `sessionStorage`.
- Report dashboard shows:
  - overall grade and score
  - category scores
  - radar chart
  - desktop/mobile screenshots
  - SEO details
  - keyword insights
  - backlink/link section
  - grouped recommendations/issues

Important files:

- `frontend/src/components/ScanForm.js`
- `frontend/src/app/results/page.js`
- `frontend/src/components/AuditReport.js`
- `frontend/src/components/LinksSection.js`
- `frontend/src/components/SeoDetailCards.js`

### Backend

- Express API with rate limiting.
- Main endpoint: `POST /api/scan`.
- Screenshot endpoint: `GET /api/screenshot?url=...`.
- URL normalization adds `https://` when missing.
- Single-page crawler with Axios and Puppeteer fallback.
- Rendered HTML fetcher for JavaScript-heavy websites.
- Lighthouse integration for SEO, performance, and accessibility.
- SEO analyzer and keyword analyzer.
- Backlink analyzer.
- Multi-page site crawler and site audit service.
- Report generator that normalizes scores and issues.
- Optional OpenAI integration when `OPENAI_API_KEY` exists.

Important files:

- `backend/src/routes/scan.js`
- `backend/src/services/crawler.js`
- `backend/src/services/htmlFetcher.js`
- `backend/src/services/securityAnalyzer.js`
- `backend/src/services/aiEngine.js`
- `backend/src/services/reportGenerator.js`
- `backend/src/services/siteCrawler.js`
- `backend/src/services/siteAudit.js`
- `backend/src/services/lighthouseService.js`

## Current Scan Flow

1. User submits URL and scan type from the frontend.
2. Backend validates `url` and `scanType`.
3. Backend crawls the target URL.
4. For SEO/full/site scans:
   - fetches rendered HTML
   - runs Lighthouse
   - analyzes social tags
   - analyzes SEO details
   - analyzes keyword data
5. For VAPT/full scans:
   - runs security analyzer
   - optionally asks AI for additional security findings
6. Backlink analysis runs in parallel.
7. Report generator combines everything into one JSON report.
8. Frontend renders the report and separately requests screenshots.

## Current VAPT/Security Features

Implemented checks:

- HTTPS usage.
- Missing security headers:
  - Content-Security-Policy
  - Strict-Transport-Security
  - X-Frame-Options
  - X-XSS-Protection
  - X-Content-Type-Options
- Exposed `Server` header.
- Cookie `Secure` flag.
- Sensitive-looking cookie missing `HttpOnly`.
- Redirect-like query parameter detection.
- Basic suspicious HTML pattern detection:
  - inline scripts
  - `javascript:` URLs
  - event handlers
  - iframes
- Optional AI review of:
  - forms
  - script sources
  - target blank links
  - inline scripts
  - suspicious developer comments
  - selected headers

## Current Report Features

The generated report includes:

- URL and domain.
- Generated timestamp.
- SEO score.
- Security score.
- Performance score.
- Links score.
- Usability score.
- Social score.
- Site audit score and summary when available.
- Overall weighted score.
- Letter grade.
- Category scores.
- Radar chart values.
- Normalized issues grouped by SEO, security, performance, and site audit.
- AI recommendations text when configured.
- SEO details, rankings, backlinks, and screenshots in the UI.

## Important Gaps

### 1. VAPT Is Passive, Not Deep Vulnerability Testing

The app currently observes public HTML and headers. It does not safely test inputs with payloads, verify exploitability, crawl application workflows, check authenticated pages, or map APIs. For product messaging, call this a "passive security audit" unless deeper testing is added.

### 2. SSRF Protection Is Missing

The backend fetches user-provided URLs using Axios and Puppeteer. This creates server-side request forgery risk if someone scans internal/private targets such as:

- `localhost`
- `127.0.0.1`
- private IP ranges
- cloud metadata endpoints
- internal hostnames

This should be fixed before public deployment.

### 3. Backend Supports `site`, But Frontend Does Not Expose It

`backend/src/routes/scan.js` accepts `site` scan type, and `siteCrawler`/`siteAudit` exist. The frontend form only shows `seo`, `vapt`, and `full`.

### 4. README Is Out Of Date

README lists only three scan modes and does not mention the backend-supported `site` scan.

### 5. AI Output Is Optional And Mostly Advisory

AI findings only run if `OPENAI_API_KEY` is set. The system does not expose whether AI was used in the report. Users may believe AI always analyzed the URL.

### 6. AI Uses Older Chat Completions Style

`generateRecommendations` uses `gpt-3.5-turbo`; `analyzeSecurityWithAI` uses `gpt-4o-mini`. The model setup should be modernized and centralized through config.

### 7. Findings Need Evidence

Security issues currently include message and fix, but not enough structured evidence. A stronger report should show:

- affected URL
- header/cookie/form/script evidence
- confidence
- verification method
- OWASP category
- remediation priority

### 8. No Persistent Scan History

Results are stored in browser `sessionStorage`. Refresh/session changes can lose context, and there is no history, user dashboard, or downloadable saved report.

### 9. No Export Feature

There is no PDF/HTML/CSV/JSON export button. For a reporting product, export is a core workflow.

### 10. Multi-Page Security Coverage Is Missing

The site crawler exists for technical site audits, but security analysis only runs on the main `crawlerResult` for `vapt` and `full`.

## Recommended Feature Roadmap

### Phase 1 - Make The Core Feature Trustworthy

Highest priority:

- Add SSRF protection and URL allow/deny validation.
- Add scan scope controls:
  - single page
  - same-origin crawl
  - max pages
  - timeout
- Show whether AI analysis was enabled.
- Add report export:
  - PDF
  - JSON
  - shareable HTML
- Expose the existing `site` scan mode in the UI or remove it from the backend until ready.
- Add evidence fields to every finding.
- Add clear labels: "passive scan", "AI-assisted", "not a penetration test".

### Phase 2 - Improve VAPT Quality

Add passive checks:

- TLS certificate and protocol details.
- HSTS preload readiness.
- CSP strength analysis instead of only missing/present.
- CORS misconfiguration detection.
- Permissions-Policy, Referrer-Policy, Cross-Origin-Opener-Policy, Cross-Origin-Resource-Policy, Cross-Origin-Embedder-Policy.
- SRI checks for third-party scripts.
- Known vulnerable JavaScript library detection from script URLs and versions.
- Exposed sensitive files:
  - `.env`
  - `.git/config`
  - `/.well-known/security.txt`
  - `/admin`
  - `/wp-login.php`
  - `/server-status`
- Directory listing detection.
- Public backup/config file detection.
- Mixed content security reporting.
- Form security checks:
  - password fields over HTTP
  - missing autocomplete controls where relevant
  - missing CSRF indicators
  - insecure form action targets

### Phase 3 - Better AI Vulnerability Reporting

- Use AI to explain risk and remediation, not to invent unverified vulnerabilities.
- Add confidence levels:
  - confirmed
  - likely
  - informational
- Ask AI to classify findings by:
  - OWASP Top 10
  - CWE
  - severity
  - affected component
  - business impact
- Feed AI structured analyzer output instead of raw-ish page metadata only.
- Add a final executive summary:
  - risk overview
  - top 5 fixes
  - estimated effort
  - quick wins

### Phase 4 - Product Features

- User accounts and scan history.
- Project/workspace support.
- Scheduled recurring scans.
- Diff between previous and current scan.
- Email alerts for new high-risk findings.
- Team comments/status per finding:
  - open
  - accepted risk
  - fixed
  - false positive
- Public share link with expiry.
- Branded report PDF.
- Webhook integration.
- Jira/GitHub issue creation.

### Phase 5 - Advanced Security Scanning

Only add this with strong safety controls and user authorization:

- Authenticated scans.
- OpenAPI/Swagger endpoint discovery.
- Safe payload-based checks for reflected XSS indicators.
- SQL injection heuristics with non-destructive probes.
- Rate-limited form testing.
- API security checks.
- Technology fingerprinting.
- CVE matching.
- Integration with established scanners like OWASP ZAP for authorized targets.

## Suggested Data Model For Findings

Use this shape internally for every issue:

```json
{
  "id": "security-header-csp-missing",
  "category": "security",
  "severity": "high",
  "confidence": "confirmed",
  "title": "Missing Content-Security-Policy header",
  "description": "The page does not send a CSP header.",
  "evidence": {
    "url": "https://example.com",
    "method": "HEAD",
    "expected": "content-security-policy",
    "actual": null
  },
  "impact": "Increases risk from XSS and content injection.",
  "fix": "Add a restrictive Content-Security-Policy header and test it in report-only mode first.",
  "references": [
    "OWASP Secure Headers Project"
  ],
  "owasp": ["A05:2021-Security Misconfiguration"]
}
```

## Quick Wins In This Codebase

1. Add SSRF-safe URL validation before every backend fetch.
2. Add `site` scan option to `ScanForm.js`.
3. Add `aiEnabled` and `scanMode` metadata to `reportGenerator.js`.
4. Extend `securityAnalyzer.js` to check more modern headers.
5. Add evidence/confidence to normalized issues.
6. Add a `Download PDF` or `Print Report` button to `AuditReport.js`.
7. Update README with accurate scan modes and limitations.
8. Run security analysis across crawled pages for `site` or a new `full-site` scan.
9. Add tests for URL validation, report generation, and security checks.
10. Replace scattered OpenAI calls with one AI service config.

## Business Positioning Recommendation

Until deeper active testing is added, describe the core feature as:

"AI-assisted website audit for SEO, performance, accessibility, and passive security misconfiguration detection."

Avoid claiming:

- complete VAPT
- penetration testing
- guaranteed vulnerability detection
- exploit verification

After adding OWASP ZAP or equivalent authorized active scanning, the product can more credibly offer a "VAPT-lite" or "automated web security scan" mode.

## Overall Assessment

The foundation is good. The app already has a useful scan pipeline, report generator, UI dashboard, screenshots, Lighthouse integration, and AI-assisted security observations. The biggest gap is not UI polish; it is trust, depth, and evidence in the security feature.

The next best move is to harden URL fetching, make the report more transparent, add export/history, and expand VAPT from header checks into structured passive security analysis across multiple pages.
