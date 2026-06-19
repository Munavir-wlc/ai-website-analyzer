# AI Security VAPT Scanner - Implementation Report

This document reports the completed implementations for the AI Website Analyser VAPT upgrade.

---

## 📂 Implemented Files & Modifications

### 1. Backend Service Integrations

#### 🔌 `backend/src/index.js`
* Mounted **Socket.io** on the Express web app by wrapping the router in a native Node HTTP server.
* Configured proper CORS origins (`http://localhost:3000`) for WebSocket clients.
* Stored the socket controller instance globally via `app.set('io', io)`.

#### 🛣️ `backend/src/routes/scan.js`
* Added support for `socketId` and `mode` ("quick" vs "full") parameters in scan request payloads.
* Generates a unique `scanId` for scanning session synchronization.
* Emits progress steps (`crawling` ➔ `ssl_check` ➔ `dns_check` ➔ `file_check` ➔ `ai_analysis` ➔ `complete`) to the client socket.
* Skips heavy OpenAI queries entirely if `mode === 'quick'` is requested.

#### 🤖 `backend/src/services/aiEngine.js`
* Added an automatic 3-second sleep and retry block when OpenAI hits rate-limits (HTTP 429).
* Implemented `runFallbackStaticChecks` to run static compliance rules (SSL, DNS, secure headers, cookies flags) if OpenAI key is invalid.
* Built the `detectTechnologies` regex catalog to detect web servers (Cloudflare, Nginx), CMS platforms (WordPress, Shopify), and JS/CSS frameworks (Next.js, Laravel).

#### 🛡️ `backend/src/services/securityAnalyzer.js`
* Integrated step emitter callbacks (`onStep`) to update the socket runner sequentially.
* Added security auditors:
  * **CORS checking**: Flags wildcard `*` headers.
  * **Mixed Content checking**: Detects unencrypted `http://` elements on `https://` websites.
  * **Cookie Auditing**: Maps `set-cookie` profiles for `HttpOnly`, `Secure`, and `SameSite` flags.
* Custom scoring system: Dedacts score by severity: Critical (-20), High (-15), Medium (-8), Low (-4).

#### 📊 `backend/src/services/reportGenerator.js`
* Generates GDPR compliance (requires SSL & secure cookies), PCI-DSS compliance (demands score >= 75 and no high/critical issues), and HIPAA compliance flags.
* Extracts the Top 3 highest priority items for recommendations.

---

### 2. Frontend UI redsystem

#### 🏠 `frontend/src/app/page.js`
* Redesigned the index route using a sleek dark slate background, glowing indigo gradients, and VAPT features indicators.

#### 🖥️ `frontend/src/components/ScanForm.js`
* Connected `socket.io-client` on submit and wired state logs to update scan stages.
* Added selectors for Quick Scan vs Full Scan depth.

#### 📁 `frontend/src/app/results/page.js`
* Rethemed load spinner cards and redirects to fit dark slate backgrounds.

#### 📊 `frontend/src/components/AuditReport.js`
* Custom colored SVGs for the circular security score gauge.
* Rendered **Top Priority Shelf** cards, **Severity Filter Tabs** (All, Critical, High, Medium, Low), **Cookie tables**, and **Technology badges**.
* Configured custom `@media print` rules to cleanly invert dark colors to high-contrast white pages for PDF downloads.

---

## 🚀 Phase 2 VAPT Upgrades (Passive Recon & Auditing)

### 1. New Passive Auditors (`backend/src/services/crawler.js`)
* **`fetchRobotsTxt`**: Downloads and parses `robots.txt` paths to isolate disallowed sensitive endpoints (`/admin`, `/api`, `/config`, etc.).
* **`analyzeRedirects`**: Traces HTTP redirect loops and hops up to 10 iterations manually via `axios` (`maxRedirects: 0`). Analyzes HTTPS redirection and open redirect domain drifts.
* **`whoisLookup`**: Resolves domain registration parameters (registrar details, creation dates, expiration schedules) using the `whoiser` TCP port 43 client.
* **`portScan`**: Scans 15 administrative and database ports (including SSH, FTP, Telnet, MySQL, Postgres, MSSQL, RDP, SMB) with a strict 2-second timeout per socket.

### 2. Upgraded Security Scoring (`backend/src/services/securityAnalyzer.js`)
* Executes Phase 2 audits concurrently using `Promise.all` while forwarding individual event status updates sequentially to socket handlers.
* Implemented new severity scoring deductions:
  * Open dangerous port: `-15` (high)
  * Missing HTTPS redirection: `-20` (critical)
  * Domain expiring < 30 days: `-15` (high); < 7 days: `-20` (critical)
  * Sensitive robots.txt paths: `-5` each (max `-20`, medium)
  * Redirect hops > 3: `-8` (medium)
  * Domain changed during redirects: `-15` (high)

### 3. Compliance Flag Enforcements (`backend/src/services/reportGenerator.js`)
* Fails **GDPR** compliance if domain registration is set to expire in less than 30 days.
* Fails **PCI-DSS** compliance if administrative/database ports (SMB, MySQL, RDP, Postgres, MSSQL, FTP, Telnet) are exposed.

### 4. Live Progress Console (`frontend/src/components/ScanForm.js`)
* Expanded the scanning progress list from 5 stages to 9 synced steps (Crawling, SSL, DNS, File Checker, Port Scanner, WHOIS Registry, Redirect Chains, Robots.txt, and AI Analysis).

### 5. Premium Reporting Cards (`frontend/src/components/AuditReport.js`)
* Designed and built 4 responsive, dark-themed dashboard cards:
  * **HTTP Redirect Chain Analysis Card**: Inspects redirect counts, HTTPS enforcement, cross-domain drift warning, and displays a step-by-step trace timeline.
  * **Domain Registry WHOIS Status Card**: Displays registrar name, registration/expiration dates, and a dynamic color indicator showing remaining days.
  * **Active Service Port Scan Card**: Renders active checked ports in a tabular grid with alert warnings for exposed databases.
  * **Robots.txt Path Auditor Card**: Shows total parsed paths list alongside a highlighted card summarizing exposed sensitive targets.
