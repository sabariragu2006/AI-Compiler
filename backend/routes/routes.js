// routes.js
const express = require('express');
const router = express.Router();

// Controllers
const fileController = require('../controllers/fileController');
const aiController = require('../controllers/aiController');
const inlineController = require('../controllers/inlineController');
const runtimeController = require('../controllers/runtimeController');
const healthController = require('../controllers/healthController');
const terminalController = require('../controllers/terminalController');
const terminalAiController = require('../controllers/terminalAiController');

// Middleware
const { validateModel } = require('../middleware/validateModel');

// -------- USER STATE ROUTES --------
router.get('/api/user/:userId/state', fileController.getUserState);
router.post('/api/user/:userId/state', fileController.updateUserState);

// -------- PROJECT ROUTES --------
router.get('/api/projects', fileController.getProjects);
router.post('/api/projects', fileController.createProject);
router.get('/api/projects/:projectId/files', fileController.getFilesInProject);
router.delete('/api/projects/:projectId', fileController.deleteProject);

// -------- FILE MANAGEMENT ROUTES --------
router.post('/api/files', fileController.saveFile);
router.patch('/api/files/:filePath(*)/rename', fileController.renameFile);
router.get('/api/files/:filePath(*)', fileController.getFile);
router.delete('/api/files/:filePath(*)', fileController.deleteFile);

// -------- PREVIEW & ASSETS --------
router.get('/api/preview/:filePath(*)', fileController.previewFile);
router.get('/api/assets/:filePath(*)', fileController.serveAsset);

// -------- TERMINAL ROUTES --------
router.post('/api/terminal', terminalController.handleCommand);
router.get('/api/terminal/session', terminalController.getSessionState);
router.post('/api/terminal/ai', terminalAiController.handleTerminalAI);

// -------- AI ROUTES --------
router.post('/api/compile-streaming', aiController.compileStreaming);
router.post('/api/compile', aiController.compile);
router.post('/api/generate-project', aiController.generateProject);


// -------- INLINE PROCESSING --------
router.post('/api/process-inline', inlineController.processInline);

// -------- JAVASCRIPT RUNTIME --------
router.post('/api/run-js', runtimeController.runJS);
router.post('/api/launch-browser', runtimeController.launchInBrowser);
router.get('/api/file/:filename', runtimeController.serveFile);

// -------- FILE EXTENSION (debug) --------
router.post('/api/file-extension', (req, res) => {
  const { name, extension } = req.body;
  console.log(`File loaded: ${name}, extension: ${extension}`);
  res.json({ success: true });
});


// -------- HEALTH CHECK --------
router.get('/health', healthController.getHealth);
// router.get('/', healthController.getHealth); // Optional: remove if serving frontend separately

module.exports = router;