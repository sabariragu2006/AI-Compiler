// controllers/aiController.js
const axios = require('axios');
const { extractCodeFromAI, parseInlinePrompts } = require('../helpers/codeUtils');

const validateModel = (model) => {
  if (model !== 'qwen' && model !== 'deepseek') {
    throw new Error('Only "qwen" or "deepseek" models are supported.');
  }
};

// -------------------- AI Non-streaming --------------------
const compile = async (req, res, next) => {
  try {
    const { code, prompt, model, isInlinePrompt = false, codeType = 'javascript' } = req.body;

    validateModel(model);

    if (!code && !prompt) return res.status(400).json({ error: 'No code or prompt provided' });

    const ollamaModel = model === 'deepseek' ? 'deepseek-coder:6.7b' : 'qwen2.5-coder:7b';

    let userPrompt;
    if (codeType === 'html') {
      userPrompt = isInlinePrompt
        ? `Generate clean HTML code for: ${prompt}`
        : code && prompt
        ? `Improve this HTML code:\n\n${code}\n\nInstruction: ${prompt}`
        : code
        ? `Fix this HTML code:\n\n${code}`
        : `Generate HTML code for: ${prompt}`;
      userPrompt += '\n\nRespond with ONLY valid HTML code. No explanations or comments.';
    } else {
      userPrompt = isInlinePrompt
        ? `Generate JavaScript code for: ${prompt}`
        : code && prompt
        ? `Improve this JavaScript code:\n\n${code}\n\nInstruction: ${prompt}`
        : code
        ? `Fix this JavaScript code:\n\n${code}`
        : `Generate JavaScript code for: ${prompt}`;
      userPrompt += '\n\nRespond with ONLY valid JavaScript code.';
    }

    // Check Ollama availability
    try {
      await axios.get('http://127.0.0.1:11434/api/tags', { timeout: 5000 });
    } catch (healthErr) {
      return res.status(503).json({ error: 'Ollama not available', details: healthErr.message });
    }

    const response = await axios.post(
      'http://127.0.0.1:11434/api/generate',
      { model: ollamaModel, prompt: userPrompt, stream: false },
      { timeout: isInlinePrompt ? 45000 : 60000 }
    );

    const codeOnly = extractCodeFromAI(response.data.response, codeType);
    res.json({ code: codeOnly });
  } catch (err) {
    next(err);
  }
};

// -------------------- AI Streaming --------------------
const compileStreaming = async (req, res, next) => {
  try {
    const { code, prompt, model, isInlinePrompt = false, codeType = 'javascript' } = req.body;
    validateModel(model);

    const ollamaModel = model === 'deepseek' ? 'deepseek-coder:6.7b' : 'qwen2.5-coder:7b';

    let userPrompt = codeType === 'html'
      ? `Generate HTML for: ${prompt || code}`
      : `Generate JS for: ${prompt || code}`;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const response = await axios.post(
      'http://127.0.0.1:11434/api/generate',
      { model: ollamaModel, prompt: userPrompt, stream: true },
      { responseType: 'stream', timeout: 120000 }
    );

    let fullResponse = '';
    response.data.on('data', (chunk) => {
      const lines = chunk.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.response) {
            fullResponse += data.response;
            res.write(`data: ${JSON.stringify({ token: data.response, done: false })}\n\n`);
          }
          if (data.done) {
            const cleanCode = extractCodeFromAI(fullResponse, codeType);
            res.write(`data: ${JSON.stringify({ done: true, fullResponse, cleanCode })}\n\n`);
            res.end();
          }
        } catch (e) {}
      }
    });

    response.data.on('error', (err) => {
      res.write(`data: ${JSON.stringify({ error: 'Stream error', details: err.message })}\n\n`);
      res.end();
    });

  } catch (err) {
    next(err);
  }
};

// -------------------- Inline Processing --------------------
const processInline = async (req, res, next) => {
  try {
    const { code, model } = req.body;
    validateModel(model);
    if (!code) return res.status(400).json({ error: 'No code provided' });

    const prompts = parseInlinePrompts(code);
    const lines = code.split('\n');
    let processed = [...lines];
    const changes = [];

    for (let i = prompts.length - 1; i >= 0; i--) {
      const p = prompts[i];
      const aiRes = await axios.post('http://localhost:5000/api/compile', {
        prompt: p.instruction,
        model,
        isInlinePrompt: true
      }, { timeout: 45000 });

      const gen = aiRes.data.code;
      if (gen && gen.trim()) {
        const before = processed.slice(0, p.startLine);
        const after = processed.slice(p.endLine + 1);
        processed = [...before, ...gen.split('\n'), ...after];
        changes.push({ startLine: p.startLine, endLine: p.endLine, instruction: p.instruction, generatedCode: gen, success: true });
      } else {
        changes.push({ ...p, error: 'AI returned empty response', success: false });
      }
    }

    res.json({ processedCode: processed.join('\n'), changes });
  } catch (err) {
    next(err);
  }
};

module.exports = { compile, compileStreaming, processInline };
