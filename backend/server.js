// server.js
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./db'); // MongoDB connection
const routes = require('./routes/routes');   // All routes with controllers

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ Connect MongoDB
connectDB();

// ✅ Middleware
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.path}`);
  next();
});

app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// ✅ Routes (centralized in routes.js)
app.use('/', routes);

app.post('/api/file-extension', async (req, res) => {
  const { name, extension } = req.body;
  console.log(`File loaded: ${name}, extension: ${extension}`);
  // You can save extension info in DB if needed
  res.json({ success: true });
});



// ✅ Global Error Handler
app.use((err, req, res, next) => {
  console.error('🚨 Global Error Handler:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
  });
});

// ✅ Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
