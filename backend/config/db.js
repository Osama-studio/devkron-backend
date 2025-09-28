// config/db.js
const mongoose = require('mongoose');

let cached = global._mongoose;
if (!cached) cached = (global._mongoose = { conn: null, promise: null });

module.exports = async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not set');
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(process.env.MONGO_URI, {
        // dbName optional if provided in URI; you can enforce:
        // dbName: 'devkron_portfolio'
      })
      .then((m) => {
        console.log('MongoDB connected');
        return m;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
};
