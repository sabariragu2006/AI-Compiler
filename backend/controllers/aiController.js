// controllers/aiController.js
const axios = require('axios');
const { extractCodeFromAI, parseInlinePrompts } = require('../helpers/codeUtils');

const HF_API_TOKEN = process.env.HF_API_TOKEN || process.env.api_key;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.api_key2;

const validateModel = (model) => {
  const validModels = ['qwen', 'deepseek', 'gemini'];
  if (!validModels.includes(model)) {
    throw new Error('Only "qwen", "deepseek", or "gemini" models are supported.');
  }
};

const buildPrompt = (codeType, code, prompt, isInlinePrompt) => {
  const languageMap = {
    html: 'HTML',
    css: 'CSS',
    javascript: 'JavaScript',
    js: 'JavaScript',
    python: 'Python',
    java: 'Java',
    cpp: 'C++',
    c: 'C'
  };

  const language = languageMap[codeType] || 'JavaScript';

  if (isInlinePrompt && prompt) {
    return `You are a code generator. Generate ONLY ${language} code for the following request without explanations, comments, or markdown.

Request: ${prompt}

Rules:
- Output ONLY executable ${language} code
- No markdown, comments, or extra text
- Make the code complete and functional`;
  }

  if (code && prompt) {
    return `You are a code improvement assistant. Improve the following ${language} code according to the instructions below.

EXISTING CODE:
${code}

INSTRUCTION: ${prompt}

Rules:
- Output ONLY the improved ${language} code
- Preserve original functionality unless changes are required
- No markdown, comments, or extra text
- Ensure the code is complete and functional`;
  }

  if (code) {
    return `You are a code debugging assistant. Fix any bugs, errors, or issues in the following ${language} code.

CODE TO FIX:
${code}

Rules:
- Output ONLY the fixed ${language} code
- Correct syntax, logic, and runtime issues
- Improve readability and structure
- Add proper error handling
- No markdown, comments, or extra text
- Ensure the code is complete and functional`;
  }

  if (prompt) {
    return `You are a code generator. Generate clean, production-ready ${language} code.

Request: ${prompt}

Rules:
- Generate complete, functional ${language} code
- Include proper error handling
- Follow best practices for ${language}
- No markdown, comments, or extra text`;
  }

  return `Generate ${language} code.`;
};

const callGemini = async (prompt) => {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured. Set GEMINI_API_KEY in .env');
  }
  if (!GEMINI_API_KEY.startsWith('AI')) {
    throw new Error('Invalid Gemini API key format. Must start with "AI".');
  }

const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  try {
    const response = await axios.post(
      url,
      {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 4096,
          temperature: 0.2,
          topP: 0.95
        }
      },
      {
        timeout: 60000,
        headers: { 'Content-Type': 'application/json' }
      }
    );

    const candidates = response.data.candidates;
    if (!candidates?.length) throw new Error('No candidates from Gemini');

    const content = candidates[0].content;
    if (!content?.parts?.[0]?.text) {
      const blockReason = candidates[0].finishReason;
      if (blockReason === 'SAFETY') {
        throw new Error('Gemini blocked response due to safety filters. Try a simpler prompt like "React todo list demo with mock data".');
      }
      throw new Error('No text content in response');
    }

    return content.parts[0].text;
  } catch (err) {
    if (err.response) {
      const status = err.response.status;
      const data = err.response.data;
      throw new Error(`Gemini API Error ${status}: ${JSON.stringify(data)}`);
    }
    throw err;
  }
};

const callOllama = async (prompt, model, stream = false) => {
  const ollamaModel = model === 'deepseek' ? 'deepseek-coder:6.7b' : 'qwen2.5-coder:7b';
  const response = await axios.post(
    'http://127.0.0.1:11434/api/generate',
    {
      model: ollamaModel,
      prompt,
      stream,
      options: { temperature: 0.7, top_p: 0.9, num_predict: 2048 }
    },
    { responseType: stream ? 'stream' : 'json', timeout: stream ? 120000 : 90000 }
  );
  return response;
};

// ✅ NEW: Robust JSON extraction function
const extractProjectJson = (text) => {
  if (!text || typeof text !== 'string') {
    throw new Error('Input text is invalid');
  }

  // Method 1: Try to find JSON inside markdown code block
  const codeBlockMatch = text.match(/```(?:json)?\s*({[\s\S]*})\s*```/i);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch (e) {
      console.warn('Code block JSON parse failed, trying fallback');
    }
  }

  // Method 2: Extract first valid JSON object containing "files"
  const jsonLikeMatch = text.match(/\{[^{}]*"files"\s*:\s*\[[\s\S]*?\][^{}]*\}/);
  if (jsonLikeMatch) {
    try {
      return JSON.parse(jsonLikeMatch[0]);
    } catch (e) {
      console.warn('JSON-like match parse failed');
    }
  }

  // Method 3: Find ANY top-level JSON object
  const generalJsonMatch = text.match(/\{[\s\S]*\}/);
  if (generalJsonMatch) {
    try {
      return JSON.parse(generalJsonMatch[0]);
    } catch (e) {
      console.warn('General JSON parse failed');
    }
  }

  // If all methods fail, throw error
  throw new Error('No valid JSON found in response');
};

const generateProject = async (req, res) => {
  try {
    const { prompt } = req.body || {};
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ success: false, error: "Prompt is required" });
    }

    const isReactProject = /react|jsx|component|useState|useEffect|router|createroot|createRoot/i.test(
      prompt
    );

    // 🔹 If the user wants a React app, request JSON multi-file project
    const systemPrompt = isReactProject
      ? `You are an expert React developer. 
Generate a fully runnable React project (no build needed) and output ONLY a valid JSON object in this exact format:

{
  "files": [
    { "path": "index.html", "content": "<!DOCTYPE html>..." },
    { "path": "src/App.jsx", "content": "..." },
    { "path": "src/main.jsx", "content": "..." }
  ]
}

Rules:
- DO NOT include markdown, backticks, explanations, or comments.
- Must be valid JSON only.
- Project must run directly in the browser.
- Use CDN imports or inline JSX with Babel.
- Use createRoot from react-dom/client.`
      : `Generate a single valid HTML file only. No markdown, no comments.`;

    let aiResponse = "";

    try {
      // 🔹 Ask Gemini
      aiResponse = await callGemini(`${systemPrompt}\n\nUser request: ${prompt}`);
    } catch (err) {
      console.error("Gemini failed, falling back:", err.message);
      aiResponse = "";
    }

    let project = null;

    // Try to parse JSON only if React project
    if (isReactProject && aiResponse) {
      try {
        project = extractProjectJson(aiResponse);
      } catch (err) {
        console.warn("⚠ JSON parse failed, falling back:", err.message);
      }
    }

    // ✔ If AI returned usable project
    if (project && project.files && Array.isArray(project.files)) {
      return res.json({ success: true, project });
    }

    // ❌ Fallback – return guaranteed working React single-file project
    const fallbackHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>React App</title>
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
</head>
<body>
  <div id="root"></div>
  
  <script>
    const { useState } = React;

    function App() {
      const [todos, setTodos] = useState([
        { id: 1, text: 'Learn React', completed: false },
        { id: 2, text: 'Build a web app', completed: true }
      ]);

      const [input, setInput] = useState('');

      const addTodo = () => {
        if (input.trim()) {
          setTodos([...todos, { id: Date.now(), text: input, completed: false }]);
          setInput('');
        }
      };

      const toggleTodo = (id) => {
        setTodos(
          todos.map(todo =>
            todo.id === id ? { ...todo, completed: !todo.completed } : todo
          )
        );
      };

      return React.createElement(
        'div',
        { style: { fontFamily: 'sans-serif', padding: 20 } },
        React.createElement('h1', null, 'Todo List'),
        React.createElement(
          'div',
          { style: { display: 'flex', gap: 10, marginBottom: 20 } },
          React.createElement('input', {
            value: input,
            onChange: (e) => setInput(e.target.value),
            placeholder: 'Type a todo...',
            onKeyPress: (e) => e.key === 'Enter' && addTodo()
          }),
          React.createElement('button', { onClick: addTodo }, 'Add')
        ),
        React.createElement(
          'ul',
          { style: { listStyle: 'none', paddingLeft: 0 } },
          todos.map(todo =>
            React.createElement(
              'li',
              {
                key: todo.id,
                onClick: () => toggleTodo(todo.id),
                style: {
                  padding: 10,
                  marginBottom: 5,
                  cursor: 'pointer',
                  backgroundColor: todo.completed ? '#e2e2e2' : '#fff',
                  textDecoration: todo.completed ? 'line-through' : 'none',
                  border: '1px solid #ccc',
                  borderRadius: 4
                }
              },
              todo.text
            )
          )
        )
      );
    }

    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(React.createElement(App));
  </script>
</body>
</html>`;

    return res.json({
      success: true,
      project: {
        files: [{ path: "index.html", content: fallbackHtml }]
      }
    });

  } catch (err) {
    console.error("FATAL generateProject error:", err);

    // If even fallback fails (practically impossible), return absolute last-line HTML
    return res.json({
      success: true,
      project: {
        files: [
          {
            path: "index.html",
            content: "<h1>Something went wrong, but server is still alive.</h1>"
          }
        ]
      }
    });
  }
};


const sanitizeFilePath = (input) => {
  if (typeof input !== 'string') throw new Error('File path must be a string');
  if (!/^[\w\-./]+$/i.test(input)) throw new Error('Invalid characters in file path');
  if (input.startsWith('/') || input.includes('..')) throw new Error('Path traversal not allowed');
  const allowedExts = ['.html', '.js', '.jsx', '.ts', '.tsx', '.css', '.json'];
  if (!allowedExts.some(ext => input.endsWith(ext))) throw new Error('Unsupported file type');
  return input;
};

const compile = async (req, res, next) => {
  try {
    const { code, prompt, model, isInlinePrompt = false, codeType = 'javascript', fileName } = req.body;
    validateModel(model);
    if (!code && !prompt) return res.status(400).json({ error: 'No code or prompt provided' });

    const userPrompt = buildPrompt(codeType, code, prompt, isInlinePrompt);
    let generatedText;

    if (model === 'gemini') {
      if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini API key not configured' });
      generatedText = await callGemini(userPrompt);
    } else {
      try {
        await axios.get('http://127.0.0.1:11434/api/tags', { timeout: 5000 });
      } catch {
        return res.status(503).json({ error: 'Ollama not available' });
      }
      const ollamaRes = await callOllama(userPrompt, model, false);
      generatedText = ollamaRes.data.response;
    }

    const codeOnly = extractCodeFromAI(generatedText, codeType);
    if (!codeOnly?.trim()) {
      return res.status(500).json({ error: 'AI returned empty or invalid code', raw: generatedText });
    }

    const modelName = model === 'gemini' ? 'gemini-2.5-flash' : 
                     model === 'deepseek' ? 'deepseek-coder:6.7b' : 'qwen2.5-coder:7b';

    res.json({ code: codeOnly, model: modelName, tokens: 'completed' });
  } catch (err) {
    console.error('compile Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

const compileStreaming = async (req, res, next) => {
  try {
    const { code, prompt, model, isInlinePrompt = false, codeType = 'javascript' } = req.body;
    if (model === 'gemini') {
      return res.status(400).json({ error: 'Streaming only available for local models' });
    }
    validateModel(model);
    if (!code && !prompt) return res.status(400).json({ error: 'No code or prompt provided' });

    try {
      await axios.get('http://127.0.0.1:11434/api/tags', { timeout: 5000 });
    } catch {
      return res.status(503).json({ error: 'Ollama not available' });
    }

    const ollamaModel = model === 'deepseek' ? 'deepseek-coder:6.7b' : 'qwen2.5-coder:7b';
    const userPrompt = buildPrompt(codeType, code, prompt, isInlinePrompt);

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });

    const response = await callOllama(userPrompt, model, true);
    let fullResponse = '';
    let tokenCount = 0;

    response.data.on('data', (chunk) => {
      const lines = chunk.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.response) {
            fullResponse += data.response;
            tokenCount++;
            res.write(` ${JSON.stringify({ token: data.response, done: false, tokenCount })}\n\n`);
          }
          if (data.done) {
            const cleanCode = extractCodeFromAI(fullResponse, codeType);
            res.write(` ${JSON.stringify({ done: true, cleanCode, totalTokens: tokenCount, model: ollamaModel })}\n\n`);
            res.end();
          }
        } catch {}
      }
    });

    response.data.on('error', (err) => {
      res.write(` ${JSON.stringify({ error: 'Stream error', details: err.message })}\n\n`);
      res.end();
    });

    req.on('close', () => response.data.destroy());
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: err.message });
    else {
      res.write(` ${JSON.stringify({ error: 'Compilation failed', details: err.message })}\n\n`);
      res.end();
    }
  }
};

const processInline = async (req, res, next) => {
  try {
    const { code, model, codeType = 'javascript' } = req.body;
    validateModel(model);
    if (!code) return res.status(400).json({ error: 'No code provided' });

    const prompts = parseInlinePrompts(code);
    if (prompts.length === 0) {
      return res.json({ processedCode: code, changes: [], message: 'No inline prompts found' });
    }

    const lines = code.split('\n');
    let processed = [...lines];
    const changes = [];

    for (let i = prompts.length - 1; i >= 0; i--) {
      const p = prompts[i];
      try {
        const aiRes = await axios.post('http://localhost:5000/api/compile', {
          prompt: p.instruction,
          model,
          isInlinePrompt: true,
          codeType
        }, { timeout: 45000 });

        const gen = aiRes.data.code;
        if (gen?.trim()) {
          const before = processed.slice(0, p.startLine);
          const after = processed.slice(p.endLine + 1);
          processed = [...before, ...gen.split('\n'), ...after];
          changes.push({ ...p, generatedCode: gen, success: true });
        } else {
          changes.push({ ...p, error: 'Empty response', success: false });
        }
      } catch (err) {
        changes.push({ ...p, error: err.message, success: false });
      }
    }

    res.json({
      processedCode: processed.join('\n'),
      changes,
      totalPrompts: prompts.length,
      successCount: changes.filter(c => c.success).length
    });
  } catch (err) {
    console.error('processInline Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

module.exports = { 
  compile, 
  compileStreaming, 
  processInline,
  generateProject
};