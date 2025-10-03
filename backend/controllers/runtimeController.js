// controllers/runtimeController.js
const path = require('path');
const { getDB } = require('../db');

const runJS = async (req, res) => {
  let responseSent = false;

  try {
    const { code, userInput = [], currentPath: initPath = '/' } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ 
        success: false,
        output: ['// No valid code provided'],
        currentPath: initPath
      });
    }

    const db = getDB();
    const collection = db.collection('files');

    let output = [];
    let inputIndex = 0;
    let currentPath = initPath;

    const sendResponse = () => {
      if (responseSent) return;
      responseSent = true;

      const hasPrompt = output.some(l => l.startsWith('[PROMPT]'));
      const needsInput = inputIndex >= userInput.length && hasPrompt;
      const lastPrompt = output.filter(l => l.startsWith('[PROMPT] ')).pop();

      res.json({
        success: true,
        output,
        currentPath,
        requiresInput: needsInput,
        promptMessage: needsInput ? lastPrompt?.replace('[PROMPT] ', '') : null
      });
    };

    // ---------------- Mocked console, prompt, alert, confirm ----------------
    const mockConsole = {
      log: (...args) => output.push(args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ')),
      error: (...args) => output.push('ERROR: ' + args.map(String).join(' ')),
      warn: (...args) => output.push('WARN: ' + args.map(String).join(' ')),
      info: (...args) => output.push('INFO: ' + args.map(String).join(' ')),
      clear: () => output.push('[CLEAR]')
    };

    const mockPrompt = async (msg = '') => {
      if (inputIndex < userInput.length) {
        let val = userInput[inputIndex++];
        const numVal = parseFloat(val);
        return isNaN(numVal) ? val : numVal;
      } else {
        output.push(`[PROMPT] ${msg}`);
        return new Promise(resolve => {
          const interval = setInterval(() => {
            if (inputIndex < userInput.length) {
              clearInterval(interval);
              let val = userInput[inputIndex++];
              output.push(`[INPUT] ${msg} → "${val}"`);
              const numVal = parseFloat(val);
              resolve(isNaN(numVal) ? val : numVal);
            }
          }, 50);
        });
      }
    };

    const mockAlert = msg => output.push(`[ALERT] ${msg}`);
    const mockConfirm = msg => {
      output.push(`[CONFIRM] ${msg} → true`);
      return true;
    };

    // ---------------- Helper: async cd that checks MongoDB ----------------
    const cd = async (folder) => {
      let targetPath;

      if (folder === '..') {
        targetPath = path.dirname(currentPath);
      } else if (folder.startsWith('/')) {
        targetPath = folder;
      } else {
        targetPath = path.join(currentPath, folder);
      }

      const normalized = targetPath.replace(/^\/+|\/+$/g, '');
      const folderExists = await collection.findOne({ path: normalized, type: 'folder' });

      if (!folderExists) {
        output.push(`ERROR: Folder '${folder}' not found`);
        return currentPath; // keep current path
      }

      const newPath = normalized ? '/' + normalized : '/';
      output.push(`Changed directory → ${newPath}`);
      return newPath;
    };

    // ---------------- Global context for user code ----------------
    const globalContext = {
      console: mockConsole,
      prompt: mockPrompt,
      alert: mockAlert,
      confirm: mockConfirm,
      setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms, 5000)),
      setInterval: (fn, ms) => setInterval(fn, Math.max(ms, 100)),
      Math, Date, JSON, Array, Object, String, Number, Boolean,
      RegExp, Error, parseInt, parseFloat, isNaN, isFinite,
      encodeURIComponent, decodeURIComponent,
      __currentPath: currentPath,
      cd: async (folder) => {
        currentPath = await cd(folder);
        globalContext.__currentPath = currentPath;
      },
      pwd: () => currentPath
    };

    // ---------------- Prepare and execute user code ----------------
    const cleanCode = code.replace(/^\uFEFF/, '').trim();
    if (!cleanCode) return res.json({ success: true, output: ['// Empty code'], currentPath });

    const wrappedCode = `
      (async function() {
        try {
          ${cleanCode}
        } catch (err) {
          console.error('Runtime Error:', err.message);
        }
      })();
    `;

    const script = new Function(...Object.keys(globalContext), wrappedCode);
    const result = script(...Object.values(globalContext));

    if (result && typeof result.then === 'function') {
      result
        .catch(err => output.push(`UNCAUGHT PROMISE REJECTION: ${err.message || err}`))
        .finally(() => sendResponse());
    } else {
      sendResponse();
    }

  } catch (err) {
    console.error('❌ JS Execution Error:', err);
    if (!responseSent) {
      res.json({ success: false, output: [`Runtime Error: ${err.message || 'Unknown error'}`], currentPath: '/' });
    }
  }
};

module.exports = { runJS };
