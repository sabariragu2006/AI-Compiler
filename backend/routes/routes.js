// routes.js
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
router.get('/api/files/:name', fileController.getFile);
router.delete('/api/files/:name', fileController.deleteFile);

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
