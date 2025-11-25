// runtimeController.js
const path = require('path');
const { getDB } = require('../db');
const fs = require('fs').promises;
const os = require('os');
const { build } = require('esbuild-wasm');

// Dynamic import for open (ESM module)
let openBrowser;
(async () => {
  const openModule = await import('open');
  openBrowser = openModule.default;
})();

// -----------------------------
// Helper Functions
// -----------------------------
const normalizePath = (p = '') =>
  p.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+|\/+$/g, '');

const isJSX = (filePath) => filePath.endsWith('.jsx');
const isJS = (filePath) => filePath.endsWith('.js') || isJSX(filePath);
const isHTML = (filePath) => filePath.endsWith('.html');

// -----------------------------
// Bundle virtual React app using esbuild-wasm
// -----------------------------
async function bundleJSX(entryPoint, fileMap, terminalOutput = []) {
  const entryContent = fileMap[entryPoint];
  if (!entryContent) {
    const msg = `Entry file not found in fileMap: ${entryPoint}`;
    terminalOutput.push(`✗ ${msg}`);
    return `console.error("${msg}");`;
  }

  try {
  const result = await build({
  stdin: {
    contents: entryContent,
    loader: isJSX(entryPoint) ? 'jsx' : 'js',
    sourcefile: entryPoint,
  },
  bundle: true,
  format: 'iife',               // ← IIFE instead of ESM
  globalName: 'ReactApp',       // optional, not strictly needed
  platform: 'browser',
  write: false,
  logLevel: 'silent',
  define: {
    'process.env.NODE_ENV': '"development"',
  },
  plugins: [
    {
      name: 'virtual-fs',
      setup(build) {
        build.onResolve({ filter: /^\.+\// }, (args) => {
          const dir = path.posix.dirname(args.importer);
          const resolved = normalizePath(path.posix.join(dir, args.path));
          return { path: resolved, namespace: 'virtual' };
        });

        // Replace 'react' and 'react-dom/client' with global vars
        build.onResolve({ filter: /^react(-dom)?(\/.*)?$/ }, (args) => {
          return { path: args.path, namespace: 'external-global' };
        });

        build.onLoad({ filter: /.*/, namespace: 'external-global' }, (args) => {
          if (args.path === 'react') {
            return { contents: 'module.exports = window.React;' };
          } else if (args.path === 'react-dom') {
            return { contents: 'module.exports = window.ReactDOM;' };
          } else if (args.path === 'react-dom/client') {
            return { contents: 'module.exports = { createRoot: window.ReactDOM.createRoot };' };
          }
          return { errors: [{ text: `Unsupported external: ${args.path}` }] };
        });

        build.onLoad({ filter: /.*/, namespace: 'virtual' }, (args) => {
          const content = fileMap[args.path] || '';
          if (!content) {
            return { errors: [{ text: `File not found: ${args.path}` }] };
          }
          return {
            contents: content,
            loader: isJSX(args.path) ? 'jsx' : 'js',
          };
        });
      },
    },
  ],
});

    const code = result.outputFiles[0].text;
    terminalOutput.push(`✓ Bundled: ${entryPoint}`);
    return code;
  } catch (err) {
    const msg = err.errors?.[0]?.text || err.message || 'Unknown bundling error';
    terminalOutput.push(`✗ Bundle failed: ${msg}`);
    return `console.error("Bundle error: ${msg.replace(/"/g, "'")}");`;
  }
}

// -----------------------------
// Detect entry point for React app
// -----------------------------
function detectEntryPoint(currentFile, fileMap, initPath = '/') {
  const normCurrent = normalizePath(currentFile);

  if (isJSX(normCurrent) && fileMap[normCurrent]) {
    return normCurrent;
  }

  if (isHTML(normCurrent)) {
    const candidates = [
      'src/main.jsx',
      'src/Main.jsx',    // ← ADD THIS (capital M)
      'main.jsx',
      'Main.jsx',        // ← optional
      'src/index.jsx',
      'index.jsx',
      'src/App.jsx',
      'App.jsx',
    ];
    for (const cand of candidates) {
      const key = normalizePath(cand);
      if (fileMap[key]) {
        return key;
      }
    }
  }

  return null;
}

// -----------------------------
// MAIN ROUTE: runJS (for iframe preview)
// -----------------------------
const runJS = async (req, res) => {
  const { currentPath: initPath = '/', currentFile = 'interactive.html' } = req.body;

  try {
    const db = getDB();
    const collection = db.collection('files');
    const allFiles = await collection.find({ type: 'file' }).toArray();

    // Build clean fileMap with ONLY normalized paths
    const fileMap = {};
    for (const file of allFiles) {
      const normPath = normalizePath(file.path);
      fileMap[normPath] = file.content;
    }

    const normalizedFile = normalizePath(
      currentFile === 'index.html' ? 'index.html' : path.posix.join(initPath, currentFile)
    );

    let html = fileMap[normalizedFile] ||
               '<!DOCTYPE html><html><body><h1>File not found</h1><p>Looking for: ' + normalizedFile + '</p></body></html>';

    const terminalOutput = [];
    let bundledJS = '';

    const entryPoint = detectEntryPoint(currentFile, fileMap, initPath);
    if (entryPoint) {
      bundledJS = await bundleJSX(entryPoint, fileMap, terminalOutput);
    }

    // Inject React CDN if we have bundled JS and HTML doesn't already include it
    if (bundledJS && !/<script[^>]*react/i.test(html)) {
      html = html.replace(
        /<\/head>/i,
        `<script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>\n` +
        `<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>\n</head>`
      );
    }

    // Inject bundled JS
    if (bundledJS) {
      html += `\n<script type="module">\n${bundledJS}\n</script>`;
    }

    console.log('📦 Serving files:', Object.keys(fileMap).length, 'total files');
    console.log('📄 Current file:', normalizedFile);
    if (entryPoint) console.log('⚙️ Entry point:', entryPoint);

    res.json({
      success: true,
      html,
      javascript: bundledJS,
      currentFile: normalizedFile,
      terminalOutput,
    });
  } catch (err) {
    console.error('❌ Runtime Controller Error:', err);
    res.status(500).json({
      success: false,
      html: '<!DOCTYPE html><html><body><h1>Server Error</h1><pre>' + err.message + '</pre></body></html>',
      javascript: '',
      terminalOutput: [`[ERROR] ${err.message}`],
    });
  }
};

// -----------------------------
// Launch in Real Browser
// -----------------------------
const launchInBrowser = async (req, res) => {
  const { currentFile = 'interactive.html', browser = 'default' } = req.body;

  try {
    const db = getDB();
    const collection = db.collection('files');
    const allFiles = await collection.find({ type: 'file' }).toArray();

    const fileMap = {};
    for (const file of allFiles) {
      const normPath = normalizePath(file.path);
      fileMap[normPath] = file.content;
    }

    const normalizedFile = normalizePath(currentFile);
    let htmlContent = fileMap[normalizedFile];
    if (!htmlContent) {
      return res.status(404).json({ success: false, message: `File not found: ${currentFile}` });
    }

    const entryPoint = detectEntryPoint(currentFile, fileMap);
    let bundledJS = '';

    if (entryPoint) {
      bundledJS = await bundleJSX(entryPoint, fileMap);
      if (!/<script[^>]*react/i.test(htmlContent)) {
        htmlContent = htmlContent.replace(
          /<\/head>/i,
          `<script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>\n` +
          `<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>\n</head>`
        );
      }
    }

    if (bundledJS) {
      htmlContent += `\n<script type="module">\n${bundledJS}\n</script>`;
    }

    const tempDir = path.join(os.tmpdir(), `web-preview-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    const mainFilePath = path.join(tempDir, normalizedFile);
    await fs.mkdir(path.dirname(mainFilePath), { recursive: true });
    await fs.writeFile(mainFilePath, htmlContent, 'utf8');

    // Browser mapping
    let appName;
    switch (browser.toLowerCase()) {
      case 'chrome':
        appName = process.platform === 'win32' ? 'chrome' : 'google chrome';
        break;
      case 'brave':
        appName = process.platform === 'win32'
          ? 'brave'
          : process.platform === 'darwin'
            ? 'Brave Browser'
            : 'brave-browser';
        break;
      case 'firefox':
        appName = 'firefox';
        break;
      case 'edge':
        appName = process.platform === 'win32' ? 'msedge' : 'microsoft-edge';
        break;
      default:
        appName = undefined;
    }

    if (!openBrowser) {
      return res.status(500).json({
        success: false,
        message: 'Browser opener not ready. Try again in 1 second.',
      });
    }

    await openBrowser(`file://${mainFilePath}`, {
      app: appName ? { name: appName } : undefined,
      wait: false,
    });

    res.json({
      success: true,
      message: `Opened ${currentFile} in ${browser}`,
      path: mainFilePath,
    });

    // Auto cleanup after 10 minutes
    setTimeout(async () => {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
        console.log(`🧹 Cleaned up: ${tempDir}`);
      } catch (err) {
        console.error('Cleanup failed:', err);
      }
    }, 10 * 60 * 1000);
  } catch (err) {
    console.error('❌ Launch Browser Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// -----------------------------
// Serve File (unchanged)
// -----------------------------
const serveFile = async (req, res) => {
  try {
    const db = getDB();
    const collection = db.collection('files');
    const filename = req.params.filename;

    const file = await collection.findOne({ name: filename });
    if (!file) return res.status(404).send(`File not found: ${filename}`);

    if (filename.endsWith('.js')) res.type('application/javascript');
    else if (filename.endsWith('.css')) res.type('text/css');
    else if (filename.endsWith('.html')) res.type('text/html');
    else res.type('text/plain');

    res.send(file.content);
  } catch (err) {
    console.error('❌ serveFile error:', err);
    res.status(500).send('Server error');
  }
};

module.exports = { runJS, serveFile, launchInBrowser };