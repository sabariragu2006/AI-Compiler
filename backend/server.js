const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

const { MongoClient } = require('mongodb');



// MongoDB setup
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = 'ai_compiler_db';
const COLLECTION_NAME = 'files';

let db;

// Connect to MongoDB
async function connectDB() {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db(DB_NAME);
    console.log('✅ Connected to MongoDB');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  }
}

// Initialize DB connection
connectDB();



// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// -------------------- FILE OPERATIONS --------------------
// Save file
app.post('/api/files', async (req, res) => {
  try {
    const { name, content } = req.body;
    
    if (!name || !content) {
      return res.status(400).json({ error: 'Name and content are required' });
    }

    const collection = db.collection(COLLECTION_NAME);
    const result = await collection.updateOne(
      { name },
      { $set: { content, updatedAt: new Date() } },
      { upsert: true }
    );

    res.json({ 
      success: true, 
      message: result.upsertedCount ? 'File created' : 'File updated' 
    });
  } catch (err) {
    console.error('Save file error:', err);
    res.status(500).json({ error: 'Failed to save file' });
  }
});

// Get all files
app.get('/api/files', async (req, res) => {
  try {
    const collection = db.collection(COLLECTION_NAME);
    const files = await collection.find({}, { projection: { _id: 0, name: 1 } }).toArray();
    res.json(files);
  } catch (err) {
    console.error('Get files error:', err);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// Get file by name
app.get('/api/files/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const collection = db.collection(COLLECTION_NAME);
    const file = await collection.findOne({ name }, { projection: { _id: 0 } });
    
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    res.json(file);
  } catch (err) {
    console.error('Get file error:', err);
    res.status(500).json({ error: 'Failed to fetch file' });
  }
});

// Delete file
app.delete('/api/files/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const collection = db.collection(COLLECTION_NAME);
    const result = await collection.deleteOne({ name });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    res.json({ success: true, message: 'File deleted' });
  } catch (err) {
    console.error('Delete file error:', err);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});



// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// -------------------- Helper Functions --------------------
function extractCodeFromAI(message) {
  if (!message) return '';

  const codeBlockRegex = /```(?:javascript|js)?\s*([\s\S]*?)\s*```/gi;
  let code = message;
  const matches = [...message.matchAll(codeBlockRegex)];
  if (matches.length > 0) {
    code = matches.map(match => match[1]).join('\n\n');
  }

  code = code
    .split('\n')
    .filter(line => {
      const t = line.trim().toLowerCase();
      return !(/^(here's|sure|note|explanation|comment|output|\/\/ ai|```|here is|this is|the following|updated|fixed|generated|created)/i.test(t));
    })
    .join('\n');

  return code.trim();
}

function parseInlinePrompts(code) {
  const lines = code.split('\n');
  const prompts = [];
  let current = null;

  lines.forEach((line, i) => {
    const t = line.trim();
    if (t.startsWith('xxx ')) {
      if (current) prompts.push(current);
      current = { startLine: i, endLine: i, instruction: t.substring(4).trim(), originalLines: [line] };
    } else if (current && t.startsWith('xxx')) {
      current.endLine = i;
      current.instruction += ' ' + t.substring(3).trim();
      current.originalLines.push(line);
    } else if (current) {
      prompts.push(current);
      current = null;
    }
  });
  if (current) prompts.push(current);
  return prompts;
}

// -------------------- Validation --------------------
const validateModel = (req, res, next) => {
  const { model } = req.body;
  if (model !== 'qwen' && model !== 'deepseek') {
    return res.status(400).json({ error: 'Only "qwen" or "deepseek" models are supported.' });
  }
  next();
};

// -------------------- AI (Ollama) --------------------
app.post('/api/compile', validateModel, async (req, res) => {
  const { code, prompt, model, isInlinePrompt = false } = req.body;
  if (!code && !prompt) {
    return res.status(400).json({ error: 'No code or prompt provided' });
  }

  // Map frontend model name to Ollama model
  let ollamaModel = model === 'deepseek' 
    ? 'deepseek-coder:6.7b' 
    : 'qwen:4b';

  try {
    let userPrompt = isInlinePrompt
      ? `Generate JavaScript code for: ${prompt}`
      : code && prompt
        ? `Improve this JavaScript code:\n\n${code}\n\nInstruction: ${prompt}`
        : code
          ? `Fix this JavaScript code:\n\n${code}`
          : `Generate JavaScript code for: ${prompt}`;

    const fullPrompt = `${userPrompt}\n\nRespond with ONLY valid JavaScript code. No explanations, markdown, or comments.`;

    console.log(`📤 Sending request to Ollama (${ollamaModel})...`);

    const response = await axios.post(
      'http://127.0.0.1:11434/api/generate',
      {
        model: ollamaModel,
        prompt: fullPrompt,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 500,   // Reduced for speed
          num_ctx: 2048
        }
      },
      { timeout: 60000 } // 60 seconds timeout
    );

    const codeOnly = extractCodeFromAI(response.data.response || '');
    console.log('✅ Ollama response received');
    res.json({ code: codeOnly });

  } catch (err) {
    console.error('❌ Ollama Error:', err.message);
    let errorMsg = 'AI generation failed';
    if (err.code === 'ECONNREFUSED') {
      errorMsg = 'Ollama not running. Launch the Ollama app.';
    } else if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      errorMsg = 'Ollama request timed out (60s). Try a simpler prompt or use a smaller model.';
    } else if (err.response?.status === 500) {
      errorMsg = 'Ollama internal error – model may be corrupted.';
    }
    res.status(500).json({ error: errorMsg });
  }
});

// -------------------- Inline Prompts --------------------
app.post('/api/process-inline', validateModel, async (req, res) => {
  const { code, model } = req.body;
  if (!code) return res.status(400).json({ error: 'No code provided' });

  try {
    const prompts = parseInlinePrompts(code);
    if (prompts.length === 0) {
      return res.json({ processedCode: code, changes: [] });
    }

    const lines = code.split('\n');
    let processed = [...lines];
    const changes = [];

    for (let i = prompts.length - 1; i >= 0; i--) {
      const p = prompts[i];
      try {
        const aiRes = await axios.post('http://localhost:5000/api/compile', {
          prompt: p.instruction,
          model: model, // ✅ Now uses 'deepseek' if selected
          isInlinePrompt: true
        }, { timeout: 20000 });

        const gen = aiRes.data.code;
        if (gen) {
          const before = processed.slice(0, p.startLine);
          const after = processed.slice(p.endLine + 1);
          processed = [...before, ...gen.split('\n'), ...after];
          changes.push({ startLine: p.startLine, endLine: p.endLine, instruction: p.instruction, generatedCode: gen });
        }
      } catch (e) {
        changes.push({ startLine: p.startLine, endLine: p.endLine, instruction: p.instruction, error: 'AI generation failed' });
      }
    }

    res.json({ processedCode: processed.join('\n'), changes: changes.reverse() });
  } catch (err) {
    console.error('Inline Processing Error:', err);
    res.status(500).json({ error: 'Failed to process inline prompts' });
  }
});

// -------------------- Run JS (Fixed) --------------------
app.post('/api/run-js', (req, res) => {
  const { code, userInput = [] } = req.body;

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ output: '// No valid code provided' });
  }
  if (!Array.isArray(userInput) || userInput.some(x => typeof x !== 'string' && typeof x !== 'number' && typeof x !== 'boolean')) {
    return res.status(400).json({ output: 'Invalid userInput: must be strings/numbers/booleans' });
  }

  let output = [];
  let idx = 0;
  let responseSent = false;

  const sendResponse = () => {
    if (responseSent) return;
    responseSent = true;

    const final = output.join('\n');
    const hasPrompt = output.some(l => l.startsWith('[PROMPT]'));
    const needsInput = idx >= userInput.length && hasPrompt;
    const lastPrompt = output.find(l => l.startsWith('[PROMPT] '));

    res.json({
      output: final,
      requiresInput: needsInput,
      promptMessage: needsInput ? lastPrompt?.replace('[PROMPT] ', '') : null
    });
  };

  const mockConsole = {
    log: (...args) => output.push(args.map(String).join(' ')),
    error: (...args) => output.push('ERROR: ' + args.map(String).join(' ')),
    warn: (...args) => output.push('WARN: ' + args.map(String).join(' ')),
    info: (...args) => output.push('INFO: ' + args.map(String).join(' '))
  };

  const mockPrompt = (msg) => {
    if (idx < userInput.length) {
      const val = String(userInput[idx++]);
      output.push(`[INPUT] ${msg} → "${val}"`);
      return val;
    } else {
      output.push(`[PROMPT] ${msg}`);
      return null;
    }
  };

  const mockAlert = (msg) => output.push(`[ALERT] ${String(msg)}`);
  const mockConfirm = (msg) => { output.push(`[CONFIRM] ${String(msg)}`); return true; };

  try {
    const clean = code.replace(/^\uFEFF/, '').trim();
    if (!clean) return res.json({ output: '// Empty code' });

    const wrapped = `(async () => {\n${clean}\n})();`;
    const script = new Function('console', 'prompt', 'alert', 'confirm', wrapped);
    const result = script(mockConsole, mockPrompt, mockAlert, mockConfirm);

    if (result && typeof result.then === 'function') {
      result.catch(err => {
        output.push(`UNCAUGHT PROMISE REJECTION: ${err.message || err}`);
      }).finally(sendResponse);
    } else {
      sendResponse();
    }

  } catch (err) {
    if (!responseSent) {
      output.push(`Runtime Error: ${err.message || 'Unknown error'}`);
      res.json({ output: output.join('\n') });
    }
  }
});

// -------------------- Health & Root --------------------
app.get('/health', (req, res) => {
  res.json({ status: 'OK', mode: 'local-ollama' });
});

app.get('/', (req, res) => {
  res.json({ message: 'AI Compiler (Local Ollama Mode)' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`🧠 Models: qwen:4b, deepseek-coder:6.7b`);
  console.log(`💡 Ensure Ollama app is running`);
});