// server.js
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const serverless = require('serverless-http');

const connectDB = require('./config/db');
const contactRoutes = require('./routes/contact.route');

dotenv.config();

const app = express();

// --- CORS allowlist ---
const allowedList = (process.env.FRONTEND_URLS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const vercelPreviewRegex = /\.vercel\.app$/;

// CORS middleware
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // Postman/server-to-server
    let allowed = allowedList.includes(origin);
    if (!allowed) {
      try {
        const hostname = new URL(origin).hostname;
        if (vercelPreviewRegex.test(hostname)) allowed = true; // optional preview allow
      } catch (_) {}
    }
    return allowed ? cb(null, true) : cb(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

// QUICK preflight response (so it doesn't wait for DB)
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    // echo back CORS headers for the origin making the request
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    return res.status(204).end();
  }
  next();
});

app.use(express.json());

// Health
app.get('/', (req, res) => res.status(200).json({ ok: true, service: 'devkron-backend' }));
app.get('/api/ping', (req, res) => res.status(200).json({ ok: true }));

// Connect DB only for non-OPTIONS requests (after CORS)
let dbReady = false;
async function ensureDB(req, res, next) {
  if (dbReady) return next();
  try {
    await connectDB();
    dbReady = true;
    next();
  } catch (e) {
    next(e);
  }
}
app.use(ensureDB);

// Routes
app.use('/api', contactRoutes);

// Basic error handler (prevents hanging on CORS rejection)
app.use((err, req, res, _next) => {
  if (err && err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS: origin not allowed', origin: req.headers.origin });
  }
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Wrap for Vercel
const handler = serverless(app);
module.exports = (req, res) => handler(req, res);

// Local dev
if (!process.env.VERCEL && require.main === module) {
  (async () => {
    const PORT = process.env.PORT || 5000;
    await connectDB();
    app.listen(PORT, () => console.log(`Local server running on ${PORT}`));
  })().catch(e => {
    console.error('Failed to start locally:', e);
    process.exit(1);
  });
}
