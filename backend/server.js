// server.js
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const serverless = require('serverless-http');

const connectDB = require('./config/db');
const contactRoutes = require('./routes/contact.route');

dotenv.config();

const app = express();

/* ---------------------------- CORS allow-list ---------------------------- */
const allowedList = (process.env.FRONTEND_URLS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const vercelPreviewRegex = /\.vercel\.app$/;

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // server-to-server / Postman
      let allowed = allowedList.includes(origin);
      if (!allowed) {
        try {
          const hostname = new URL(origin).hostname;
          if (vercelPreviewRegex.test(hostname)) allowed = true;
        } catch {}
      }
      return allowed ? cb(null, true) : cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

/* ---------------------- Fast response for preflight (OPTIONS) ---------------------- */
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
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

/* ------------------------------ Health endpoints ------------------------------ */
app.get('/', (_req, res) => res.status(200).json({ ok: true, service: 'devkron-backend' }));
app.get('/api/ping', (_req, res) => res.status(200).json({ ok: true }));

/* -------------------------- Lazy DB connect middleware -------------------------- */
let dbReady = false;
async function ensureDB(_req, _res, next) {
  try {
    if (!dbReady) {
      await connectDB();
      dbReady = true;
    }
    next();
  } catch (err) {
    next(err);
  }
}

/* ---------------------------------- Routes ---------------------------------- */
app.use('/api', ensureDB, contactRoutes);

/* ------------------------------- Error handler ------------------------------- */
app.use((err, req, res, _next) => {
  if (err && err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS: origin not allowed', origin: req.headers.origin });
  }
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

/* -------------------------- Export for Vercel (serverless) -------------------------- */
// IMPORTANT: wrap serverless(app) so Vercel receives a (req, res) handler.
const handler = serverless(app);
module.exports = (req, res) => handler(req, res);

/* ------------------------------ Local development ------------------------------ */
if (!process.env.VERCEL && require.main === module) {
  (async () => {
    try {
      const PORT = process.env.PORT || 5000;
      await connectDB();
      app.listen(PORT, () => console.log(`Local server running on ${PORT}`));
    } catch (e) {
      console.error('Failed to start locally:', e);
      process.exit(1);
    }
  })();
}
