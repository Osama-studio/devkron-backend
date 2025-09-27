// backend/server.js

const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const serverless = require('serverless-http');

const connectDB = require('./config/db');
const contactRoutes = require('./routes/contact.route');

dotenv.config();

const app = express();

// CORS: allow your frontend(s)
const allowed = (process.env.FRONTEND_URL || 'https://devkron-frontend.vercel.app')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowed.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use(express.json());

// Root + health (so hitting the project root won't 404)
app.get('/', (req, res) => res.status(200).json({ ok: true, service: 'devkron-backend' }));
app.get('/api/ping', (req, res) => res.status(200).json({ ok: true }));

// API routes (your existing router)
app.use('/api', contactRoutes);

// --- DB connect once per cold start (serverless-safe) ---
let dbReady = false;
async function ensureDB() {
  if (dbReady) return;
  await connectDB();       // make sure this reads process.env.MONGO_URI
  dbReady = true;
}

// Wrap for serverless
const expressHandler = serverless(app);

// Dual-mode: local vs Vercel
const isVercel = !!process.env.VERCEL;

// On Vercel: export handler (NO app.listen)
if (isVercel) {
  module.exports = async (req, res) => {
    try {
      await ensureDB();
      return await expressHandler(req, res);
    } catch (err) {
      console.error('Server error:', err);
      res.status(500).json({ error: 'Internal server error', details: err.message });
    }
  };
} else {
  // Local dev: normal listen
  const PORT = process.env.PORT || 5000;
  (async () => {
    try {
      await ensureDB();
      app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    } catch (err) {
      console.error('Failed to start server:', err);
      process.exit(1);
    }
  })();
}
