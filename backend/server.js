// server.js
require('@dotenvx/dotenvx').config();
// ✅ Initialize esbuild-wasm properly for Node.js
const { initialize } = require('esbuild-wasm');

// Initialize WITHOUT wasmURL — it uses the local binary
initialize().catch((err) => {
  console.error('Failed to initialize esbuild-wasm:', err);
});

const express = require('express');
const cors = require('cors');
const { connectDB } = require('./db');
const routes = require('./routes/routes');

const app = express();
const PORT = process.env.PORT || 5000;

connectDB();

app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.path}`);
  next();
});

app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

app.use('/', routes);

app.use((err, req, res, next) => {
  console.error('🚨 Global Error Handler:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});