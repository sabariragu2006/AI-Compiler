require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const ivm = require('isolated-vm');

const app = express();
const PORT = process.env.PORT || 5000;

// Enhanced CORS configuration
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' })); // Increased payload limit

// Store execution contexts for input handling
const executionContexts = new Map();

// -------------------- Helper Functions --------------------
function extractCodeFromAI(message) {
  if (!message) return '';

  // Remove markdown code blocks
  const codeBlockRegex = /```(?:javascript|js)?\s*([\s\S]*?)\s*```/gi;
  let code = message;
  
  const matches = [...message.matchAll(codeBlockRegex)];
  if (matches.length > 0) {
    code = matches.map(match => match[1]).join('\n\n');
  }

  // Clean up common AI prefixes and explanations
  code = code
    .split('\n')
    .filter(line => {
      const trimmed = line.trim().toLowerCase();
      return !(/^(here's|sure|note|explanation|comment|output|\/\/ ai|```|here is|this is|the following|updated|fixed|generated|created)/i.test(trimmed));
    })
    .join('\n');

  return code.trim();
}

function parseInlinePrompts(code) {
  const lines = code.split('\n');
  const prompts = [];
  let currentPrompt = null;
  
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    
    // Check for inline prompt starting with "xxx"
    if (trimmed.startsWith('xxx ')) {
      if (currentPrompt) {
        prompts.push(currentPrompt);
      }
      
      currentPrompt = {
        startLine: index,
        endLine: index,
        instruction: trimmed.substring(4).trim(),
        originalLines: [line]
      };
    } else if (currentPrompt && trimmed.startsWith('xxx')) {
      // Handle continuation lines (including indented)
      currentPrompt.endLine = index;
      currentPrompt.instruction += ' ' + trimmed.substring(3).trim();
      currentPrompt.originalLines.push(line);
    } else if (currentPrompt) {
      prompts.push(currentPrompt);
      currentPrompt = null;
    }
  });
  
  if (currentPrompt) {
    prompts.push(currentPrompt);
  }
  
  return prompts;
}

// -------------------- VALIDATION MIDDLEWARE --------------------
const validateModel = (req, res, next) => {
  const { model } = req.body;
  const validModels = ['qwen', 'deepseek'];
  
  if (!validModels.includes(model)) {
    return res.status(400).json({ error: 'Invalid model. Use "qwen" or "deepseek"' });
  }
  
  // Check API keys
  if (model === 'qwen' && !process.env.QWEN_API_KEY) {
    return res.status(500).json({ error: 'Qwen API key not configured' });
  }
  if (model === 'deepseek' && !process.env.DEEPSEEK_API_KEY) {
    return res.status(500).json({ error: 'DeepSeek API key not configured' });
  }
  
  next();
};

// -------------------- AI INTERACTION --------------------
app.post('/api/compile', validateModel, async (req, res) => {
  const { code, prompt, model, isInlinePrompt = false } = req.body;

  if (!code && !prompt) {
    return res.status(400).json({ error: 'No code or prompt provided' });
  }

  try {
    let selectedModel, apiKey;
    if (model === 'qwen') {
      selectedModel = 'qwen/qwen-2.5-72b-instruct:free';
      apiKey = process.env.QWEN_API_KEY;
    } else {
      selectedModel = 'deepseek/deepseek-chat';
      apiKey = process.env.DEEPSEEK_API_KEY;
    }

    let userContent = '';
    let systemContent = 'You are a JavaScript code assistant. Return ONLY executable JavaScript code without any explanations, comments, or markdown formatting. No text before or after the code.';

    if (isInlinePrompt) {
      userContent = `Generate JavaScript code for: ${prompt}`;
    } else if (code && prompt) {
      systemContent += ' Fix or improve the provided code according to the instruction.';
      userContent = `Improve this JavaScript code: ${code}\n\nInstruction: ${prompt}`;
    } else if (code) {
      systemContent += ' Fix any errors or improve the provided code.';
      userContent = `Fix this JavaScript code: ${code}`;
    } else {
      userContent = `Generate JavaScript code for: ${prompt}`;
    }

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: selectedModel,
        messages: [
          { role: 'system', content: systemContent },
          { role: 'user', content: userContent }
        ],
        max_tokens: 1500,
        temperature: 0.3,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:5173', // Required by OpenRouter
          'X-Title': 'AI Compiler'
        },
      }
    );

    const message = response.data.choices?.[0]?.message?.content || '';
    const codeOnly = extractCodeFromAI(message);

    res.json({ code: codeOnly });
  } catch (err) {
    console.error('AI Compile Error:', err.response?.data || err.message);
    const errorMsg = err.response?.data?.error?.message || 
                    err.message || 
                    'AI request failed. Check API keys and model availability.';
    res.status(500).json({ error: errorMsg });
  }
});

// -------------------- PROCESS INLINE PROMPTS --------------------
app.post('/api/process-inline', validateModel, async (req, res) => {
  const { code, model } = req.body;
  
  if (!code) {
    return res.status(400).json({ error: 'No code provided' });
  }

  try {
    const prompts = parseInlinePrompts(code);
    
    if (prompts.length === 0) {
      return res.json({ processedCode: code, changes: [] });
    }

    const lines = code.split('\n');
    let processedLines = [...lines];
    const changes = [];

    // Process prompts in reverse order to maintain line numbers
    for (let i = prompts.length - 1; i >= 0; i--) {
      const promptData = prompts[i];
      
      try {
        const aiResponse = await axios.post('http://localhost:5000/api/compile', {
          prompt: promptData.instruction,
          model,
          isInlinePrompt: true
        }, { timeout: 10000 }); // 10s timeout per prompt

        const generatedCode = aiResponse.data.code;
        
        if (generatedCode) {
          const beforeLines = processedLines.slice(0, promptData.startLine);
          const afterLines = processedLines.slice(promptData.endLine + 1);
          const newCodeLines = generatedCode.split('\n');
          
          processedLines = [...beforeLines, ...newCodeLines, ...afterLines];
          
          changes.push({
            startLine: promptData.startLine,
            endLine: promptData.endLine,
            instruction: promptData.instruction,
            generatedCode
          });
        }
      } catch (error) {
        console.error(`Prompt processing failed: ${promptData.instruction}`, error.message);
        changes.push({
          startLine: promptData.startLine,
          endLine: promptData.endLine,
          instruction: promptData.instruction,
          error: 'AI generation failed'
        });
      }
    }

    res.json({ 
      processedCode: processedLines.join('\n'), 
      changes: changes.reverse()
    });

  } catch (err) {
    console.error('Inline Processing Error:', err);
    res.status(500).json({ error: 'Failed to process inline prompts' });
  }
});

// -------------------- RUN JS CODE --------------------
app.post('/api/run-js', async (req, res) => {
  const { code, userInput = [], sessionId } = req.body;
  if (!code) return res.status(400).json({ output: '// No code provided' });

  // Validate userInput: must be array of primitives
  if (!Array.isArray(userInput) || userInput.some(x => 
    typeof x !== 'string' && typeof x !== 'number' && typeof x !== 'boolean'
  )) {
    return res.status(400).json({ output: '❌ Invalid userInput: must be strings/numbers/booleans' });
  }

  let isolate = null;

  try {
    isolate = new ivm.Isolate({ memoryLimit: 128 });
    const context = await isolate.createContext();

    // Inject userInput and define all globals in one eval
    await context.eval(`
      // Output buffer
      const __output = [];
      let __inputIndex = 0;
      const __log = (...args) => {
        __output.push(args.map(a => {
          if (a === null) return 'null';
          if (a === undefined) return 'undefined';
          if (typeof a === 'object') {
            try { return JSON.stringify(a); } catch (e) { return String(a); }
          }
          return String(a);
        }).join(' '));
      };

      // Input array (cloned from host)
      const __inputArray = ${JSON.stringify(userInput)};

      // Globals
      globalThis.console = {
        log: (...args) => __log(...args),
        error: (...args) => __log('ERROR:', ...args),
        warn: (...args) => __log('WARN:', ...args),
        info: (...args) => __log('INFO:', ...args)
      };

      globalThis.prompt = (msg) => {
        if (__inputIndex < __inputArray.length) {
          const val = String(__inputArray[__inputIndex]);
          __inputIndex++;
          __log('[INPUT]', msg, '→', '"' + val + '"');
          return val;
        } else {
          __log('[PROMPT]', msg);
          return null; // Will be handled as requiring input
        }
      };

      globalThis.alert = (msg) => __log('[ALERT]', String(msg));
      globalThis.confirm = (msg) => { __log('[CONFIRM]', String(msg)); return true; };
      globalThis.window = { location: { href: 'http://localhost:5173' } };
      globalThis.document = { title: 'AI Compiler' };

      // Expose getters
      globalThis.__getOutput = () => __output.join('\\n');
      globalThis.__needsMoreInput = () => __inputIndex >= __inputArray.length;
    `);

    // Run user code
    await context.evalClosure(`
      (async () => {
        try {
          ${code}
        } catch (e) {
          console.error('Uncaught error:', e.message);
        }
      })();
    `, [], { timeout: 5000 });

    // Retrieve output and check if more input is needed
    const outputStr = await context.eval('globalThis.__getOutput();');
    const needsMoreInput = await context.eval('globalThis.__needsMoreInput();');
    
    const outputLines = (outputStr || '').split('\\n').filter(line => line.trim() !== '');

    // Check if there's a pending prompt request
    const lastPromptLine = outputLines.find(line => line.startsWith('[PROMPT]'));
    const requiresInput = needsMoreInput && lastPromptLine;

    res.json({
      output: outputLines.join('\n'),
      requiresInput: !!requiresInput,
      promptMessage: requiresInput ? lastPromptLine.replace('[PROMPT] ', '') : null
    });

  } catch (err) {
    console.error('Run JS Error:', err);
    let msg = err.message || 'Unknown runtime error';
    if (msg.includes('Script execution timed out')) {
      msg = 'Code execution timeout (5s)';
    } else if (msg.includes('SyntaxError')) {
      msg = 'SyntaxError: ' + msg.split('\n')[0];
    }
    res.status(500).json({ output: `❌ ${msg}` });
  } finally {
    if (isolate) isolate.dispose();
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  const uptime = process.uptime();
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`
  });
});

app.get('/', (req, res) => {
  res.json({ 
    message: 'AI Compiler Backend is running!',
    endpoints: {
      compile: 'POST /api/compile',
      'process-inline': 'POST /api/process-inline',
      'run-js': 'POST /api/run-js',
      health: 'GET /health'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 AI Compiler Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});