// Load .env from backend root (index.js is in src/, so .env is one level up)
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// Security: ensure critical secrets are present in production
const JWT_SECRET = process.env.JWT_SECRET;
if (process.env.NODE_ENV === 'production') {
  if (!JWT_SECRET || JWT_SECRET === 'vapt_scanner_jwt_secret_token_key_2026_xyz') {
    console.error('[Startup] Missing or insecure JWT_SECRET in production environment. Aborting.');
    process.exit(1);
  }
}

// Node 18 compatibility: undici (from workspace hoisting) expects global File
if (typeof globalThis.File === 'undefined') {
  globalThis.File = class File {};
}
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const http = require('http');
const { Server } = require('socket.io');
const scanRoutes = require('./routes/scan');
const screenshotRoutes = require('./routes/screenshot');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');

// Connect to MongoDB
connectDB();

const app = express();
const PORT = process.env.PORT || 4000;

// Wrap Express app with HTTP server
const server = http.createServer(app);

// Setup Socket.io
// Configure allowed origins depending on environment
const allowedOrigins = (process.env.NODE_ENV === 'production')
  ? [process.env.FRONTEND_URL]
  : [process.env.FRONTEND_URL || 'http://localhost:3000', 'http://127.0.0.1:3000'];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Store io instance in Express app setting
app.set('io', io);

// CORS - allow frontend origin
// Security headers
app.use(helmet());

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

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Scan API - apply rate limiting
app.use('/api/scan', scanLimiter, scanRoutes);

// Auth API
app.use('/api/auth', authRoutes);

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

server.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT} (Node version: ${process.version})`);
});
// Trigger watch reload to pick up all active scan capabilities


