# AI Website Security & GEO Auditor

An advanced AI-assisted vulnerability scanning, passive reconnaissance, WCAG accessibility, performance diagnostics, and Generative Engine Optimization (GEO) auditing suite for modern web applications.

---

## Key Features

1. **Security Configuration Audit**: Probes SSL/TLS settings, CORS configurations, security headers, cookie properties, mixed HTTP/HTTPS assets, and open ports.
2. **Performance Diagnostics**: Measures First Contentful Paint (FCP), Time to First Byte (TTFB), and load duration heuristics via Puppeteer and static asset counting.
3. **Accessibility Audit (WCAG)**: Scans HTML structures for missing image alt tags, missing form labels, invalid heading hierarchies, and keyboard focus access.
4. **Technical SEO Diagnostics**: Evaluates titles, descriptions, canonical URLs, viewport settings, robots meta, sitemap XML declarations, and reports broken links.
5. **AI Search & GEO Optimization**: Grades LLM search engine discoverability by auditing Brand Entity Schemas, FAQ opportunities, citation density, and entity consistency.
6. **Unified Deterministic Scoring**: Computes letter grades (A+ through F) and weighted numeric sub-scores for all categories.
7. **CSV & JSON Exports**: Provides downloadable spreadsheets of all security and audit findings.

---

## Prerequisites

- **Node.js**: `>=18.0.0`
- **MongoDB**: Running locally on port `27017` (tests run decoupled using `mongodb-memory-server`)
- **Docker / Colima**: Required for running OWASP ZAP

---

## Quick Start

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Configure Environment
Create a `.env` file in the `backend/` directory:
```env
PORT=4000
MONGODB_URI=mongodb://localhost:27017/ai-website-analyzer
JWT_SECRET=your_jwt_secret_token_here
OPENAI_API_KEY=your_openai_api_key_here
ENABLE_ZAP_SCANS=true
ZAP_API_KEY=vapt_scanner_zap_api_key_2026_xyz
ALLOW_LOCAL_SCANS=true
```

### 3. Run Development Servers
```bash
pnpm dev
```
Starts the Express backend on port `4000` and the Next.js frontend on port `3000`.

---

## Running Tests

We utilize Jest for backend testing. Database integrations are run decoupled from your local MongoDB instance using an in-memory database server helper.

To run all unit and integration tests:
```bash
cd backend
pnpm test
```

---

## API Documentation

### **POST** `/api/scan`
Launches a security and diagnostics audit scan for a target website.

**Parameters:**
- `url` (string, required): Domain or page URL.
- `consent` (boolean, required): User consent acknowledgement.
- `mode` (string, optional): `"quick"` or `"full"`.
- `force` (boolean, optional): Set to `true` to bypass the 6-hour report caching.

**Sample Request Payload:**
```json
{
  "url": "https://example.com",
  "consent": true,
  "mode": "full",
  "force": true
}
```
