// controllers/runtimeController.js
const path = require('path');

const runJS = async (req, res) => {
  let responseSent = false;

  try {
    const { code, userInput = [] } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ output: ['// No valid code provided'] });
    }

    let output = [];
    let inputIndex = 0;
    let currentPath = '/'; // start at root

    const sendResponse = () => {
      if (responseSent) return;
      responseSent = true;

      const hasPrompt = output.some(l => l.startsWith('[PROMPT]'));
      const needsInput = inputIndex >= userInput.length && hasPrompt;
      const lastPrompt = output.filter(l => l.startsWith('[PROMPT] ')).pop();

      res.json({
        output, // array of lines
        requiresInput: needsInput,
        promptMessage: needsInput ? lastPrompt?.replace('[PROMPT] ', '') : null,
        currentPath
      });
    };

    // Mocked console and prompt
    const mockConsole = {
      log: (...args) => {
        const message = args.map(arg =>
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        output.push(message);
      },
      error: (...args) => output.push('ERROR: ' + args.map(String).join(' ')),
      warn: (...args) => output.push('WARN: ' + args.map(String).join(' ')),
      info: (...args) => output.push('INFO: ' + args.map(String).join(' ')),
      clear: () => output.push('[CONSOLE CLEARED]')
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

    const mockAlert = (msg) => output.push(`[ALERT] ${String(msg)}`);
    const mockConfirm = (msg) => {
      output.push(`[CONFIRM] ${String(msg)} → true`);
      return true;
    };

    // Global context
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
      __currentPath: currentPath, // internal path for cd
      cd: (folder) => {
        if (folder === '..') {
          __currentPath = path.dirname(__currentPath);
        } else if (folder.startsWith('/')) {
          __currentPath = folder; // absolute
        } else {
          __currentPath = path.join(__currentPath, folder);
        }
        currentPath = __currentPath;
        output.push(`Changed directory → ${currentPath}`);
      },
      pwd: () => currentPath
    };

    const cleanCode = code.replace(/^\uFEFF/, '').trim();
    if (!cleanCode) return res.json({ output: ['// Empty code'] });

    const wrappedCode = `
      (async function() {
        try {
          ${cleanCode}
        } catch (err) {
          console.error('Runtime Error:', err.message);
        }
      })();
    `;

    const contextKeys = Object.keys(globalContext);
    const contextValues = Object.values(globalContext);

    const script = new Function(...contextKeys, wrappedCode);
    const result = script(...contextValues);

    if (result && typeof result.then === 'function') {
      result.catch(err => output.push(`UNCAUGHT PROMISE REJECTION: ${err.message || err}`))
            .finally(() => sendResponse());
    } else {
      sendResponse();
    }

  } catch (err) {
    console.error('❌ JS Execution Error:', err);
    if (!responseSent) {
      res.json({ output: [`Runtime Error: ${err.message || 'Unknown error'}`] });
    }
  }
};

module.exports = { runJS };
