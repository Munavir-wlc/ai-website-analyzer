# AI Website Security VAPT Scanner

An AI-assisted vulnerability and passive reconnaissance scanning suite for web applications.

## Prerequisites

- **Node.js**: `>=18.0.0`
- **MongoDB**: Running locally on port `27017`
- **Docker / Colima**: For running OWASP ZAP

---

## Quick Start

### 1. Install Dependencies
```bash
pnpm install
# or
npm install
```

### 2. Start OWASP ZAP (Port 8090)

Choose the setup steps below depending on whether you are using **Docker Desktop** or **Colima**:

#### **Option A: Using Docker Desktop**
Just make sure Docker Desktop is running, then run:
```bash
docker rm -f zap-local 2>/dev/null || true && \
docker run -d --name zap-local -p 8090:8090 -e ZAP_JVM_OPTIONS="-Xmx1536m -Xms256m" --add-host host.docker.internal:host-gateway ghcr.io/zaproxy/zaproxy:stable zap.sh -daemon -host 0.0.0.0 -port 8090 -config api.key=vapt_scanner_zap_api_key_2026_xyz -config 'api.addrs.addr.name=.*' -config api.addrs.addr.regex=true
```

#### **Option B: Using Colima**
If you are using **Colima** on macOS:
1. **Start Colima** with at least 4GB of RAM (ZAP is resource-intensive and will crash on default VM settings):
   ```bash
   colima start --cpu 2 --memory 4
   ```
2. **Point to Colima Docker context**:
   ```bash
   docker context use colima
   ```
3. **Start the ZAP container**:
   ```bash
   docker rm -f zap-local 2>/dev/null || true && \
   docker run -d --name zap-local -p 8090:8090 -e ZAP_JVM_OPTIONS="-Xmx1536m -Xms256m" --add-host host.docker.internal:host-gateway ghcr.io/zaproxy/zaproxy:stable zap.sh -daemon -host 0.0.0.0 -port 8090 -config api.key=vapt_scanner_zap_api_key_2026_xyz -config 'api.addrs.addr.name=.*' -config api.addrs.addr.regex=true
   ```
   *(Note: The `--add-host host.docker.internal:host-gateway` flag is critical here, enabling ZAP inside the Colima VM to scan local targets running on your host Mac).*

---
*(After running the ZAP container, wait ~45 seconds for it to start up, then verify it is running with: `curl -s -H "X-ZAP-API-Key: vapt_scanner_zap_api_key_2026_xyz" http://localhost:8090/JSON/core/view/version/`)*



### 3. Configure Environment
Create a `.env` file in the `backend/` directory:
```env
PORT=4000
MONGODB_URI=mongodb://localhost:27017/ai-website-analyzer
OPENAI_API_KEY=your_openai_api_key_here
ENABLE_ZAP_SCANS=true
ZAP_API_KEY=vapt_scanner_zap_api_key_2026_xyz
ALLOW_LOCAL_SCANS=true
```

### 4. Run Development Server
```bash
pnpm dev
# or
npm run dev
```
Starts the Express API on port `4000` and the Next.js Frontend on port `3000` (or `3001`).

---

## API Documentation

### **POST** `/api/scan`
Launches a security scan for a target URL.

**Payload:**
```json
{
  "url": "https://example.com",
  "consent": true,
  "mode": "full"
}
```
*(Note: `consent` is mandatory for active security probing.)*
