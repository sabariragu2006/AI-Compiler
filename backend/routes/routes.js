const express = require('express');
const router = express.Router();

// Controllers
const fileController = require('../controllers/fileController');
const aiController = require('../controllers/aiController');
const inlineController = require('../controllers/inlineController');
const runtimeController = require('../controllers/runtimeController');
const healthController = require('../controllers/healthController');

// Middleware
const { validateModel } = require('../middleware/validateModel');

// -------- FILE ROUTES --------
router.post('/api/files', fileController.saveFile);
router.get('/api/files', fileController.getFiles);

// Use wildcard (*) for nested paths
router.get('/api/files/*', fileController.getFile);
router.delete('/api/files/*', fileController.deleteFile);

// New: HTML preview + asset serving
router.get('/api/preview/*', fileController.previewFile);
router.get('/api/assets/*', fileController.serveAsset);

// -------- AI ROUTES --------
router.post('/api/compile-streaming', aiController.compileStreaming);
router.post('/api/compile', aiController.compile);

// -------- INLINE PROCESSING --------
router.post('/api/process-inline', validateModel, inlineController.processInline);

// -------- JAVASCRIPT RUNTIME --------
router.post('/api/run-js', runtimeController.runJS);

// -------- HEALTH CHECK --------
router.get('/health', healthController.getHealth);
router.get('/', healthController.getHealth);

module.exports = router;
