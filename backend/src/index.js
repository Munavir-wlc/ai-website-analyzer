// Load .env from backend root (index.js is in src/, so .env is one level up)
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// Node 18 compatibility: undici (from workspace hoisting) expects global File
if (typeof globalThis.File === 'undefined') {
  globalThis.File = class File {};
}
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const scanRoutes = require('./routes/scan');
const screenshotRoutes = require('./routes/screenshot');

const app = express();
const PORT = process.env.PORT || 4000;

// CORS - allow frontend origin
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));

// Rate limiting for scan endpoint
const scanLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { error: 'Too many scan requests. Please try again later.' }
});

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Scan API - apply rate limiting
app.use('/api/scan', scanLimiter, scanRoutes);

// Screenshot API - 5 per minute (Puppeteer is heavy)
const screenshotLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many screenshot requests. Try again later.' }
});
app.use('/api/screenshot', screenshotLimiter, screenshotRoutes);

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
