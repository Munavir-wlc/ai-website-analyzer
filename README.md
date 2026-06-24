# AI Website Security VAPT Scanner

An AI-assisted next-generation security vulnerability and passive reconnaissance scanning suite for web applications. The tool performs automated active and passive VAPT audits, generating high-fidelity reports detailing security grades, compliance metrics, and remediation guides.

## Core Features

- **SSRF Guard protection**: DNS-based checks to prevent server-side request forgery by blocking private, local, and cloud loopback IP addresses.
- **Vulnerability Scanner**: Active form probes targeting reflected XSS, SQL injection, and blind time-based SQL injection.
- **Passive Reconnaissance**:
  - **Port Scanner**: Scans database/administrative ports for public exposure.
  - **WHOIS Domain Registry**: Inspects domain registration health and remaining days to expiration.
  - **Redirect Chains**: Traces multi-hop redirects and warns on unencrypted hops or cross-domain drift.
  - **Robots.txt Auditor**: Identifies exposure of sensitive paths (e.g. `/admin`, `/api`, `/config`).
- **SSL/TLS & DNS Health**: Audits CA details, expiration timelines, SPF, and DMARC configurations.
- **Compliance Flag Enforcement**: Evaluates GDPR, PCI-DSS, and HIPAA posture based on configuration details.
- **Advanced Scanning (Bypassing Paywalls)**: Injects custom Authorization headers and session Cookie states.

---

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Create a `.env` file in the `backend/` directory:
```env
PORT=4000
OPENAI_API_KEY=your_openai_api_key
```

### 3. Run Dev Mode (Turbo Repo)
Starts the Express API on port `4000` and the Next.js Frontend on port `3000`:
```bash
npm run dev
```

---

## API Documentation

### **POST** `/api/scan`
Launches a security and VAPT scan for a target URL.

**Payload Specification:**
```json
{
  "url": "https://example.com",
  "consent": true,
  "mode": "quick" | "full",
  "socketId": "socket_connection_id_for_live_progress",
  "authCookie": "PHPSESSID=abc123xyz...",
  "authHeader": "Bearer eyJhbGci..."
}
```

*Note: `consent` is mandatory for **Full Scan** depth to authorize active form vulnerability checking.*

### **GET** `/api/screenshot`
Generates base64-encoded screenshots of the target page on desktop and mobile viewports.

**Query Parameters:**
- `url` (Required): Target URL to capture.
- `authCookie` (Optional)
- `authHeader` (Optional)
