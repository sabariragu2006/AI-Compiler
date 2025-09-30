// controllers/healthController.js
const { mongob } = require('../db');

const getHealth = (req, res) => {
  res.json({
    status: 'OK',
    mode: 'local-ollama-streaming',
    database: mongob ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
    features: [
      'file-management',
      'streaming',
      'inline-processing',
      'javascript-runtime',
      'html-support'
    ]
  });
};

module.exports = { getHealth };
