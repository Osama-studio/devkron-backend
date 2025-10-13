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
      // Non-browser / server-to-server / Postman
      if (!origin) return cb(null, true);

      let allowed = allowedList.includes(origin);
      if (!allowed) {
        try {
          const hostname = new URL(origin).hostname;
          if (vercelPreviewRegex.test(hostname)) allowed = true; // allow vercel previews
        } catch (_) {}
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
/* These DO NOT require DB and should respond instantly */
app.get('/', (_req, res) =>
  res.status(200).json({ ok: true, service: 'devkron-backend' })
);
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
/* Only /api/* needs the DB */
app.use('/api', ensureDB, contactRoutes);

/* ------------------------------- Error handler ------------------------------- */
app.use((err, req, res, _next) => {
  if (err && err.message === 'Not allowed by CORS') {
    return res
      .status(403)
      .json({ error: 'CORS: origin not allowed', origin: req.headers.origin });
  }
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

/* -------------------------- Export for Vercel (serverless) -------------------------- */
/* IMPORTANT: export the handler directly */
module.exports = serverless(app);

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
