# AI Website Analyser - Project Structure & Features Showcase

## 📂 Project Structure

```text
├── package.json                   # Root package.json managing workspaces
├── turbo.json                     # Turborepo configuration
├── backend/                       # Express Node.js API server
│   ├── package.json
│   ├── preload.js
│   └── src/
│       ├── index.js               # Express server entry point & WebSocket setup
│       ├── routes/
│       │   ├── scan.js            # Scan coordinator and WebSocket step emitters
│       │   └── screenshot.js      # Puppeteer screenshot endpoints
│       ├── services/
│       │   ├── activeScanner.js   # Audits target inputs for XSS, SQLi, and Host Hijacking
│       │   ├── apiDiscovery.js    # Discovers APIs, Swagger endpoints, and routes
│       │   ├── crawler.js         # Axios page crawler, SSL check, DNS lookup, and Robots.txt parser
│       │   ├── cveScanner.js      # Passive CVE matching scanner
│       │   ├── htmlFetcher.js     # Puppeteer dynamic page renderer
│       │   ├── lighthouseService.js# Google Lighthouse performance and audit runner
│       │   ├── loadTester.js      # Controlled load test burst & rate-limit auditor
│       │   ├── reportGenerator.js # Compiles and formats VAPT metrics
│       │   ├── securityAnalyzer.js# Passive security audits (Headers, WAF, and cookies)
│       │   ├── siteCrawler.js     # Crawls sub-pages on the same-origin domain
│       │   └── wafDetector.js     # Inspects headers & responses for Firewall configurations
│       └── utils/
│           └── ssrfGuard.js       # Blocks SSRF targeting local/private IP spaces
│
└── frontend/                      # Next.js React Dashboard
    ├── package.json
    └── src/
        ├── app/
        │   ├── page.js            # Main landing page for starting scans
        │   ├── results/
        │   │   └── page.js        # Dynamic results route loader
        │   └── globals.css
        └── components/
            ├── ScanForm.js        # URL submission & Live Socket.io progress steps console
            ├── AuditReport.js     # VAPT dashboard, reports, & new Load Resilience Card
            ├── SeoDetailCards.js  # Displays search engine indexing parameters
            └── LinksSection.js    # Details backlink details and redirect traces
```

---

## 🚀 Core Features

### 🛡️ 1. Passive Security Audits (Reconnaissance)
* **SSL/TLS Certificate Audit**: Validates certificate chains, checks expiration timelines, remaining days, protocol validation (e.g., TLS v1.3), and HSTS configurations.
* **DNS Configuration Review**: Checks domain records for security policies like **SPF** and **DMARC** to prevent email spoofing.
* **Domain WHOIS Status Card**: Resolves expiration dates, creation dates, and registrar details, alerting developers if the domain is nearing deletion.
* **HTTP Redirect Chain Auditing**: Traces up to 10 redirect loops and hops, alerting on cross-domain drifts (open redirect risks) and validating HTTPS enforcement.
* **Robots.txt Directory Audit**: Downloads and parses `robots.txt` rules, matching disallowed rules against a list of sensitive endpoint keywords (e.g., `/admin`, `/api`, `/.env`).
* **WAF (Web Application Firewall) Detector**: Examines headers and response signatures to identify active firewalls like Cloudflare, AWS WAF, ModSecurity, etc.

### 🕵️ 2. Active Vulnerability Probing
* **Exposed Service Port Scanner**: Checks 17 common administrative, database, and control ports (such as SSH, FTP, Telnet, MySQL, Postgres, Redis, MongoDB, RDP) with strict timeouts to catch exposed assets.
* **Host Header Injection Probing**: Audits redirection targets and reflects header inputs into HTML body assets to catch asset hijacking vulnerabilities.
* **Reflected XSS Probing**: Scans form inputs on target pages, sending safe query strings and validating if raw scripts are returned unfiltered in the HTTP body.
* **API Route & Swagger Discovery**: Scans target folders for exposed OpenAPI definitions (`/swagger.json`, `/api-docs`) and discovers public API endpoints.

### ⚡ 3. Load Resilience & Abuse Protection Scan
* **Concurrent Burst Benchmarking**: Executes a safe batch of 20 HTTP requests under a concurrency cap of 5 to profile latency profiles (minimum, maximum, and average response times).
* **Rate-Limit Control Verification**: Automatically identifies active rate-limiting configuration by checking for `429 Too Many Requests` responses and headers like `Retry-After`, `x-ratelimit-limit`, or `x-ratelimit-remaining`.
* **Abuse Resilience Verdict**: Outputs warnings for slow servers (average latency > 3s) that are vulnerable to Denial of Service (DoS) or Slowloris resource exhaustion.

### 🤖 4. AI-Assisted Threat Modeling
* **LLM Risk Analysis**: Inspects HTML structures, inline scripts, developer comments, and form fields using OpenAI models (`gpt-4o-mini` / `gpt-3.5-turbo`) to identify logical weaknesses.
* **Intelligent Recommendations**: Groups identified flaws, rates severity impact, and provides context-aware fix/remediation suggestions.

### 📊 5. Dashboard & Reporting Panel
* **Live Progress Console**: Feeds updates from the backend process to the frontend via WebSockets (`socket.io-client`), guiding users step-by-step.
* **Compliance Checks Panel**: Assesses standard compliance checklist flags automatically based on security results:
  * **GDPR**: Requires active SSL encryption and secure cookie flags.
  * **PCI-DSS**: Demands zero exposed databases/admin ports and a score >= 75.
  * **HIPAA**: Validates transmission standards.
* **Print-Ready PDF Reports**: Custom `@media print` CSS overrides styles automatically on clicking "Print Report" to output high-contrast, clean documents for presentation.
