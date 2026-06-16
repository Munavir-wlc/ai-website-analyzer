# AI Website Analyzer

Analyze websites for SEO, security (VAPT), and performance. Choose from three scan modes:

- **SEO Scan** – Title, meta, headings, images, canonical, robots.txt, sitemap, page speed
- **VAPT Security Scan** – HTTPS, security headers, cookies, XSS, open redirects
- **Full Scan** – SEO + Security + Performance

## Quick Start

```bash
# Install dependencies
npm install

# Run backend (port 4000) and frontend (port 3000) together
npm run dev
```

## Project Structure

```
├── frontend/     # Next.js dashboard
├── backend/      # Node.js API
```

## API

**POST** `/api/scan`

```json
{
  "url": "https://example.com",
  "scanType": "seo" | "vapt" | "full"
}
```

## Environment

- `PORT` – Backend port (default: 4000)
- `OPENAI_API_KEY` – Optional, for AI recommendations
# ai-website-analyzer
