// Load .env configuration from backend root (index.js is in src/)
// Triggering server watch reload to apply ZAP replacer rules check and Puppeteer screenshot auth.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// Security: ensure critical secrets are present in production
if (process.env.NODE_ENV === 'production') {
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET || JWT_SECRET === 'vapt_scanner_jwt_secret_token_key_2026_xyz') {
    console.error('[Startup] Missing or insecure JWT_SECRET in production environment. Aborting.');
    process.exit(1);
  }

  const { capabilities } = require('./config/scanCapabilities');
  if (capabilities.zapScans) {
    const ZAP_API_KEY = process.env.ZAP_API_KEY;
    if (!ZAP_API_KEY || ZAP_API_KEY.trim() === '') {
      console.error('[Startup] Missing ZAP_API_KEY in production when ENABLE_ZAP_SCANS is enabled. Aborting.');
      process.exit(1);
    }
  }
}

const { validateEnv } = require('./utils/envValidator');
validateEnv();

// Node 18 compatibility: undici (from workspace hoisting) expects global File
if (typeof globalThis.File === 'undefined') {
  globalThis.File = class File {};
}
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const http = require('http');
const { Server } = require('socket.io');
const scanRoutes = require('./routes/scan');
const screenshotRoutes = require('./routes/screenshot');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const teamRoutes = require('./routes/team');
const paymentRoutes = require('./routes/payment');
const domainRoutes = require('./routes/domain');
const monitoringRoutes = require('./routes/monitoring');
const { setIo } = require('./utils/socket');
const { initScanWorker } = require('./services/scanWorker');
const { startMonitorScheduler } = require('./services/monitorScheduler');

// Connect to MongoDB
connectDB();

// Initialize scheduled continuous monitoring dispatcher
startMonitorScheduler();

const app = express();
const PORT = process.env.PORT || 4000;

// Wrap Express app with HTTP server
const server = http.createServer(app);

// Setup Socket.io
// Configure allowed origins depending on environment
const allowedOrigins = (process.env.NODE_ENV === 'production')
  ? [process.env.FRONTEND_URL]
  : [
      process.env.FRONTEND_URL || 'http://localhost:3000', 
      'http://127.0.0.1:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3001',
      'http://localhost:3002',
      'http://127.0.0.1:3002'
    ];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Store io instance in Express app setting
app.set('io', io);
setIo(io);

// Initialize background scan queue worker
initScanWorker();

// In production, trust proxy headers from the load balancer/reverse proxy
if (process.env.NODE_ENV === 'production') {
  app.enable('trust proxy');
  app.use((req, res, next) => {
    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    if (proto && proto.toLowerCase() !== 'https') {
      const host = req.headers.host;
      return res.redirect(301, `https://${host}${req.originalUrl}`);
    }
    return next();
  });
}

// CORS - allow frontend origin
// Security headers: configure helmet with a strong default CSP and other headers
// Build connect-src for CSP from allowed origins
const cspConnect = ["'self'"];
allowedOrigins.forEach((o) => {
  if (o && !cspConnect.includes(o)) cspConnect.push(o);
});

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: cspConnect,
      frameAncestors: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
    }
  },
  frameguard: { action: 'sameorigin' },
  hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  // keep other helmet defaults
}));

// Additional headers which some helmet versions don't set via options
app.use((req, res, next) => {
  // Permissions-Policy (formerly Feature-Policy) - restrict powerful features
  res.setHeader('Permissions-Policy', "geolocation=(), microphone=(), camera=(), payment=()");
  // Ensure Referrer-Policy is present for older environments
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

// Rate limiting for scan endpoint
const SCAN_RATE_MAX = parseInt(process.env.SCAN_RATE_MAX || (process.env.NODE_ENV === 'production' ? '5' : '15'), 10);
const scanLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: SCAN_RATE_MAX,
  message: { error: 'Too many scan requests. Please try again later.' }
});

app.use(cookieParser());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Scan API - apply rate limiting
app.use('/api/scan', scanLimiter, scanRoutes);

// Auth API
app.use('/api/auth', authRoutes);

// Team Workspaces API
app.use('/api/team', teamRoutes);

// Payments & Subscriptions API
app.use('/api/payment', paymentRoutes);

// Domain Ownership Verification API
app.use('/api/domains', domainRoutes);

// Continuous Scheduled Monitoring API
app.use('/api/monitoring', monitoringRoutes);

// Screenshot API - 5 per minute (Puppeteer is heavy)
const screenshotLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many screenshot requests. Try again later.' }
});
app.use('/api/screenshot', screenshotLimiter, screenshotRoutes);

// Socket.io connection logging
io.on('connection', (socket) => {
  console.log(`[socket] Client connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`[socket] Client disconnected: ${socket.id}`);
  });
});

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`Backend running at http://localhost:${PORT} (Node version: ${process.version})`);
  });
}

module.exports = app;


