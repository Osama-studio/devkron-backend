// server.js
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const serverless = require('serverless-http');

const connectDB = require('./config/db');
const contactRoutes = require('./routes/contact.route');

dotenv.config();

const app = express();

// CORS: allow your frontend origin(s)
const allowed = (process.env.FRONTEND_URL || 'https://devkron-frontend.vercel.app')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => (!origin || allowed.includes(origin)) ? cb(null, true) : cb(new Error('Not allowed by CORS')),
  credentials: true
}));

app.use(express.json());

// Health + root
app.get('/', (req, res) => res.status(200).json({ ok: true, service: 'devkron-backend' }));
app.get('/api/ping', (req, res) => res.status(200).json({ ok: true }));

// Routes
app.use('/api', contactRoutes);

// --- Connect DB once per cold start ---
let dbReady = false;
async function ensureDB() {
  if (dbReady) return;
  await connectDB();
  dbReady = true;
}

// Wrap express for serverless (Vercel)
const handler = serverless(app);

// Vercel handler (no app.listen on Vercel)
module.exports = async (req, res) => {
  try {
    await ensureDB();
    return handler(req, res);
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
};

// Local dev (node server.js)
if (!process.env.VERCEL && require.main === module) {
  (async () => {
    try {
      await ensureDB();
      const PORT = process.env.PORT || 5000;
      app.listen(PORT, () => console.log(`Local server running on ${PORT}`));
    } catch (e) {
      console.error('Failed to start locally:', e);
      process.exit(1);
    }
  })();
}
