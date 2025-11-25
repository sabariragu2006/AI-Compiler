// controllers/terminalAiController.js - MULTI-FILE STREAMING VERSION (Updated for Cloud Multi-File Support)
const axios = require('axios');
const { getDB } = require('../db');
const { extractCodeFromAI } = require('../helpers/codeUtils');

// Import environment variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.api_key2;

const languageMap = {
  html: 'HTML',
  css: 'CSS',
  js: 'JavaScript',
  javascript: 'JavaScript',
  python: 'Python',
  java: 'Java',
  cpp: 'C++',
  c: 'C'
};

const normalizePath = (p = '') => p.replace(/^\/+|\/+$/g, '');

const buildPrompt = (language, prompt, isMultiFile = false, fileType = null, htmlContent = null) => {
  const lowerPrompt = prompt.toLowerCase();

  const isWebApp = /website|web app|ui|interface|landing page|dashboard|frontend/i.test(lowerPrompt);
  const isInteractive = /interactive|button|click|form|input|user input|event|handler/i.test(lowerPrompt);
  const isStylized = /style|design|layout|color|theme|responsive|modern|beautiful|css|look/i.test(lowerPrompt);
  const isCalculatorLike = /calculator|compute|add|subtract|multiply|divide|math/i.test(lowerPrompt);

  if (isMultiFile && fileType) {
    if (fileType === 'html') {
      let instructions = `
You are a senior frontend developer. Generate a complete, semantic, and valid HTML file based on the request.

Request: ${prompt}

Requirements:
- Use meaningful class names and IDs
- Structure content logically with semantic HTML5 tags (<header>, <main>, <section>, etc.)
- If the request implies interactivity or styling, include:
    <link rel="stylesheet" href="styles.css">
    <script src="script.js"></script>
- Include proper meta tags, viewport, and title
- Ensure the HTML is standalone and valid
`;

      if (isWebApp || isInteractive || isStylized) {
        instructions += `- Assume this is part of a multi-file project with styles.css and script.js\n`;
      }

      if (isCalculatorLike) {
        instructions += `- Build a button-based calculator UI (no input fields), with a display div and operator/digit buttons.\n`;
      }

      instructions += `
Rules:
- Output ONLY raw HTML code
- No markdown, no backticks, no explanations
- No placeholders like "{{content}}"
- Must work when saved as .html and opened in a browser
`;
      return instructions;
    }

    else if (fileType === 'css') {
      let instructions = `
You are a CSS expert. Generate clean, modern, and responsive CSS for the following project.

Request: ${prompt}

Guidelines:
- Use a mobile-first, responsive approach
- Prefer Flexbox or CSS Grid for layout
- Use variables if helpful
- Style all interactive elements (buttons, inputs) with hover/focus states
- Ensure visual hierarchy and readability
`;

      if (htmlContent) {
        instructions += `\nHTML Reference (first 500 chars):\n${htmlContent.substring(0, 500)}\n`;
        instructions += `- Base your selectors on actual classes/IDs used in the HTML above\n`;
      } else {
        instructions += `- Assume common class names like .container, .button, .display, etc.\n`;
      }

      if (isCalculatorLike) {
        instructions += `- Style a calculator layout: 4-column button grid, large display, distinct colors for operators (=, +, -, etc.)\n`;
      }

      instructions += `
Rules:
- Output ONLY CSS code
- No comments (or minimal if critical)
- No HTML or JavaScript
`;
      return instructions;
    }

    else if (fileType === 'js' || fileType === 'javascript') {
      let instructions = `
You are a JavaScript engineer. Write clean, safe, and efficient client-side JavaScript for the following request.

Request: ${prompt}

Guidelines:
- Use DOM selectors that match the expected HTML structure
- Prefer addEventListener over inline handlers
- Handle edge cases (empty inputs, errors, invalid operations)
- Avoid eval() or dangerous functions
- Use modern ES6+ syntax (const, arrow functions, etc.)
`;

      if (htmlContent) {
        instructions += `\nHTML Reference:\n${htmlContent.substring(0, 500)}\n`;
        instructions += `- Use the exact IDs and classes from the HTML above\n`;
      } else {
        instructions += `- Assume standard structure (e.g., #display, .button, etc.)\n`;
      }

      if (isCalculatorLike) {
        instructions += `- Implement calculator logic: store operands, handle operators (+, −, ×, ÷), compute on '='\n`;
      }

      instructions += `
Rules:
- Output ONLY JavaScript code
- No HTML, no CSS, no markdown
- No explanations or console logs unless critical
`;
      return instructions;
    }
  }

  return `
You are an expert code generator. Generate ONLY ${language} code for this request:

"${prompt}"

Rules:
- Output ONLY raw, executable ${language} code
- No markdown, no comments, no explanations
- Make it complete, correct, and idiomatic
`;
};

const findByPath = async (collection, targetPath, projectId) => {
  const normalized = normalizePath(targetPath);
  return await collection.findOne({ path: normalized, projectId });
};

const generateFallbackContent = (language, fileName, fileType = null, baseName = '') => {
  const fallbacks = {
    html: fileType === 'html' ? `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${baseName || fileName}</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="container">
        <h1>${baseName || 'Welcome'}</h1>
        <p>This is your ${baseName || 'page'}.</p>
    </div>
    <script src="script.js"></script>
</body>
</html>` : `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${fileName}</title>
</head>
<body>
    <h1>Hello World</h1>
    <!-- AI generation timed out. Add your content here. -->
</body>
</html>`,
    css: `/* ${baseName || fileName} Styles */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    line-height: 1.6;
    padding: 20px;
    background: #f4f4f4;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    background: white;
    padding: 30px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}`,
    javascript: `// ${baseName || fileName} JavaScript
document.addEventListener('DOMContentLoaded', function() {
    console.log('${baseName || fileName} loaded successfully');
    
    // Add your JavaScript functionality here
});`,
    python: `# ${fileName}
def main():
    print("Hello World")

if __name__ == "__main__":
    main()`,
    java: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello World");
    }
}`,
    cpp: `#include <iostream>
using namespace std;

int main() {
    cout << "Hello World" << endl;
    return 0;
}`
  };
  
  return fallbacks[language] || `// ${fileName}\n// Generated file`;
};

// ✅ FIXED: Use gemini-2.5-flash (confirmed available in your API response)
const callGemini = async (prompt) => {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured for terminal AI. Set GEMINI_API_KEY (or api_key2) in .env');
  }

  if (!GEMINI_API_KEY.startsWith('AI')) {
    throw new Error('Invalid Gemini API key format. Must start with "AI".');
  }

  // ✅ CORRECT MODEL NAME: gemini-2.5-flash (NOT gemini-2.5-pro)
  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  try {
    const response = await axios.post(
      url,
      {
        contents: [{
          role: "user",
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          maxOutputTokens: 4096,
          temperature: 0.2,
          topP: 0.95
        }
      },
      {
        timeout: 60000,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const candidates = response.data.candidates;
    if (!candidates?.length) {
      throw new Error('No candidates returned from Gemini');
    }

    const content = candidates[0].content;
    if (!content?.parts?.[0]?.text) {
      const blockReason = candidates[0].finishReason;
      if (blockReason === 'SAFETY') {
        throw new Error('Gemini blocked response due to safety filters. Try a simpler prompt like "sports score demo".');
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

// Analyze prompt for file types — SMART DEFAULT TO MULTI-FILE
const analyzePromptForFilesHeuristic = (prompt) => {
  const lowerPrompt = prompt.toLowerCase().trim();

  // 🔹 Explicit single-file request
  const isSingleFileExplicit = /(?:html\s+only|single\s+file|just\s+html|only\s+html|no\s+css|no\s+js|without\s+css|without\s+js)/i.test(lowerPrompt);

  // 🔹 Non-web/backend tasks
  const isNonWeb = /(?:python|java|c\+\+|c#|c\b|bash|shell|sql|json|yaml|xml|config|api route|server|backend|algorithm)/i.test(lowerPrompt);

  // 🔹 General UI/interactivity detection
  const isWebUI = /(?:create|build|make|develop|generate)\s+(?:a\s+)?(?:web|website|ui|interface|dashboard|app|editor|tool|software|page|form|login|todo|photo|cricket|calculator|blog)/i.test(lowerPrompt);
  const isInteractive = /(?:button|click|drag|drop|toggle|menu|layer|canvas|tool|brush|crop|select|input|form|event|dynamic)/i.test(lowerPrompt);
  const isStylized = /(?:style|design|layout|theme|responsive|modern|beautiful|css|ui|ux|sidebar|toolbar|panel)/i.test(lowerPrompt);

  // ✅ FORCE SINGLE FILE IF EXPLICITLY REQUESTED
  if (isSingleFileExplicit) {
    return {
      files: [{ type: 'html', ext: '.html', name: null }],
      analysis: { needsHTML: true, needsCSS: false, needsJS: false, isSingleFileOnly: true, reasoning: 'Explicit single-file request detected.' }
    };
  }

  // ✅ NON-WEB → SINGLE FILE (e.g., .py, .java)
  if (isNonWeb && !isWebUI) {
    let primaryType = 'html';
    if (/python|\.py\b/.test(lowerPrompt)) primaryType = 'python';
    else if (/java\b|\.java/.test(lowerPrompt)) primaryType = 'java';
    else if (/c\+\+|cpp|\.cpp/.test(lowerPrompt)) primaryType = 'cpp';
    return {
      files: [{ type: primaryType, ext: getFileExtension(primaryType), name: null }],
      analysis: { needsHTML: primaryType === 'html', needsCSS: false, needsJS: false, isSingleFileOnly: true, reasoning: 'Non-web task.' }
    };
  }

  // ✅ DEFAULT: MULTI-FILE FOR ANY UI/INTERACTIVE/STYLIZED REQUEST
  const files = [{ type: 'html', ext: '.html', name: null }];
  const needsCSS = isWebUI || isStylized;
  const needsJS = isWebUI && isInteractive;

  if (needsCSS) files.push({ type: 'css', ext: '.css', name: 'styles.css' });
  if (needsJS) files.push({ type: 'js', ext: '.js', name: 'script.js' });

  const reasoning = needsCSS && needsJS
    ? 'Web UI with interactivity → HTML, CSS, JS.'
    : needsCSS
    ? 'Styling detected → HTML + CSS.'
    : needsJS
    ? 'Interactivity detected → HTML + JS.'
    : 'Basic HTML only.';

  return {
    files,
    analysis: { needsHTML: true, needsCSS, needsJS, isSingleFileOnly: false, reasoning }
  };
};

const getFileExtension = (type) => {
  const map = { html: '.html', css: '.css', js: '.js', javascript: '.js', python: '.py', java: '.java', cpp: '.cpp' };
  return map[type] || '.txt';
};

const extractBaseName = (prompt) => {
  const patterns = [
    /(?:create|make|generate|build)\s+(?:a\s+)?(?:file\s+for\s+)?([a-zA-Z0-9_-]+)/i,
    /([a-zA-Z0-9_-]+)\s+(?:page|form|app|website)/i,
    /for\s+([a-zA-Z0-9_-]+)/i
  ];
  
  for (const pattern of patterns) {
    const match = prompt.match(pattern);
    if (match && match[1]) {
      return match[1].toLowerCase();
    }
  }
  
  return 'index';
};

const ensureHTMLLinks = (htmlContent, hasCSS = true, hasJS = true) => {
  let content = htmlContent;
  
  if (!content.includes('<html') || !content.includes('<head>')) {
    return content;
  }
  
  if (hasCSS && !content.includes('styles.css')) {
    if (content.includes('</head>')) {
      content = content.replace(
        '</head>',
        '    <link rel="stylesheet" href="styles.css">\n</head>'
      );
    }
  }
  
  if (hasJS && !content.includes('script.js')) {
    if (content.includes('</body>')) {
      content = content.replace(
        '</body>',
        '    <script src="script.js"></script>\n</body>'
      );
    }
  }
  
  return content;
};

const generateSingleFileCloud = async (filesCollection, fileConfig, sendSSE, htmlContent = null, projectId) => {
  const { fileName, filePath, codeType, language, prompt, baseName } = fileConfig;
  
  console.log(`[AI Cloud] Generating file: ${fileName} (${codeType}) at path: ${filePath} for project: ${projectId}`);
  
  const emptyFileDoc = {
    name: fileName,
    path: filePath,
    type: 'file',
    content: '',
    projectId,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  await filesCollection.insertOne(emptyFileDoc);
  console.log(`[AI Cloud] Empty file created: ${fileName} in project ${projectId}`);
  
  const aiPrompt = buildPrompt(language, prompt, true, codeType, htmlContent);
  
  let generatedCode = '';
  let usedFallback = false;
  
  try {
    console.log(`[AI Cloud] Starting Gemini API generation for ${fileName}...`);
    generatedCode = await callGemini(aiPrompt);
    console.log(`[AI Cloud] Raw code received from Gemini for ${fileName}, length: ${generatedCode.length}`);
    
    const cleanedCode = extractCodeFromAI(generatedCode, codeType) || generatedCode.trim();
    generatedCode = cleanedCode;
    
    if (codeType === 'html') {
      if (!generatedCode.includes('<!DOCTYPE html>')) {
         generatedCode = `<!DOCTYPE html>\n<html>\n<head><title>${baseName || fileName}</title></head>\n<body>\n${generatedCode}\n</body>\n</html>`;
      }
      generatedCode = ensureHTMLLinks(generatedCode, true, true);
    } else if (codeType === 'css') {
       const lines = generatedCode.split('\n');
       const cssLines = [];
       for (const line of lines) {
         if (line.includes('<!DOCTYPE') || line.includes('<html') || line.includes('document.')) {
           continue;
         }
         cssLines.push(line);
       }
       generatedCode = cssLines.join('\n').trim();
    } else if (codeType === 'javascript' || codeType === 'js') {
       const lines = generatedCode.split('\n');
       const jsLines = [];
       for (const line of lines) {
         if (line.includes('<!DOCTYPE') || line.includes('<html') || (line.includes('{') && line.includes(':') && !line.includes('function') && !line.includes('=>'))) {
           continue;
         }
         jsLines.push(line);
       }
       generatedCode = jsLines.join('\n').trim();
    }
    
    console.log(`[AI Cloud] Code cleaned for ${fileName}, final length: ${generatedCode.length}`);
    
    const chunkSize = 50;
    let tokenCount = 0;
    for (let i = 0; i < generatedCode.length; i += chunkSize) {
      const chunk = generatedCode.substring(i, i + chunkSize);
      tokenCount += chunk.length;
      sendSSE({ 
        type: 'token', 
        token: chunk,
        fileName,
        fileType: codeType,
        tokenCount
      });
      
      if (tokenCount % 200 === 0) {
        await filesCollection.updateOne(
          { path: filePath, projectId },
          { $set: { content: generatedCode.substring(0, i + chunkSize), updatedAt: new Date(), projectId } }
        );
      }
    }
    
  } catch (aiErr) {
    console.error(`[AI Cloud] Gemini API Generation failed for ${fileName}:`, aiErr.message);
    generatedCode = generateFallbackContent(codeType, fileName, codeType, baseName);
    usedFallback = true;
    sendSSE({ type: 'fallback', fileName, message: `Using template for ${fileName} (Gemini error: ${aiErr.message})` });
  }
  
  if (!generatedCode || !generatedCode.trim()) {
    console.log(`[AI Cloud] Empty code detected for ${fileName} after Gemini, using fallback`);
    generatedCode = generateFallbackContent(codeType, fileName, codeType, baseName);
    usedFallback = true;
  }
  
  console.log(`[AI Cloud] Saving final content for ${fileName}: ${generatedCode.length} characters`);
  await filesCollection.updateOne(
    { path: filePath, projectId },
    { $set: { content: generatedCode, updatedAt: new Date(), projectId } }
  );
  
  const savedFile = await filesCollection.findOne({ path: filePath, projectId });
  console.log(`[AI Cloud] Verification - ${fileName} saved with ${savedFile?.content?.length || 0} characters`);
  
  return { generatedCode, usedFallback };
};

const generateMultiFilesCloud = async (filesCollection, baseName, filesToCreate, prompt, sendSSE, projectId, currentPath) => {
  console.log(`[AI Cloud Multi] Generating ${filesToCreate.length} files for base name: ${baseName} in project: ${projectId}`);
  console.log(`[AI Cloud Multi] Files to create:`, filesToCreate.map(f => f.name));
  sendSSE({ type: 'multifile_start', baseName, files: filesToCreate.map(f => f.name) });

  const results = [];
  let htmlContent = null;

  for (const fileInfo of filesToCreate) {
    let fileName;
    if (fileInfo.type === 'js') {
      fileName = 'script.js';
    } else if (fileInfo.type === 'css') {
      fileName = 'styles.css';
    } else {
      fileName = fileInfo.name || `${baseName}.html`;
    }
    
    const filePath = normalizePath(
      currentPath === '/' ? fileName : `${normalizePath(currentPath)}/${fileName}`
    );

    console.log(`\n[AI Cloud Multi] ===== Processing ${fileName} =====`);

    const existing = await findByPath(filesCollection, filePath, projectId);
    if (existing) {
      console.log(`[AI Cloud Multi] ${fileName} already exists in project ${projectId}, skipping`);
      sendSSE({
        type: 'file_exists',
        fileName,
        message: `Skipping ${fileName} (already exists)`
      });
      continue;
    }

    sendSSE({ 
      type: 'file_start', 
      fileName,
      fileType: fileInfo.type 
    });

    const fileConfig = {
      fileName,
      filePath,
      codeType: fileInfo.type,
      language: languageMap[fileInfo.type],
      prompt,
      baseName
    };

    try {
      const result = await generateSingleFileCloud(filesCollection, fileConfig, sendSSE, htmlContent, projectId);
      results.push({ fileName, ...result });
      
      if (fileInfo.type === 'html') {
        htmlContent = result.generatedCode;
        console.log(`[AI Cloud Multi] Saved HTML content (${htmlContent.length} chars) for CSS/JS reference`);
      }
      
      console.log(`[AI Cloud Multi] ${fileName} generation completed successfully`);
    } catch (err) {
      console.error(`[AI Cloud Multi] Error generating ${fileName}:`, err);
      const fallbackContent = generateFallbackContent(fileInfo.type, fileName, fileInfo.type, baseName);
      const fallbackFileDoc = {
        name: fileName,
        path: filePath,
        type: 'file',
        content: fallbackContent,
        projectId,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await filesCollection.insertOne(fallbackFileDoc);
      results.push({ fileName, generatedCode: fallbackContent, usedFallback: true });
      sendSSE({ type: 'fallback', fileName, message: `Using template for ${fileName} (Error: ${err.message})` });
    }

    sendSSE({ 
      type: 'file_complete', 
      fileName,
      fileType: fileInfo.type,
      size: results[results.length - 1]?.generatedCode?.length || 0
    });
    
    console.log(`[AI Cloud Multi] ===== ${fileName} completed =====\n`);
  }
  
  const htmlFileResult = results.find(r => r.fileName.endsWith('.html'));
  if (htmlFileResult) {
    const hasCSS = filesToCreate.some(f => f.type === 'css');
    const hasJS = filesToCreate.some(f => f.type === 'js');
    
    if (hasCSS || hasJS) {
      const htmlPath = normalizePath(
        currentPath === '/' ? htmlFileResult.fileName : `${normalizePath(currentPath)}/${htmlFileResult.fileName}`
      );
      const updatedHTML = ensureHTMLLinks(htmlFileResult.generatedCode, hasCSS, hasJS);
      await filesCollection.updateOne(
        { path: htmlPath, projectId },
        { $set: { content: updatedHTML, updatedAt: new Date(), projectId } }
      );
      console.log(`[AI Cloud Multi] Updated HTML with links - CSS: ${hasCSS}, JS: ${hasJS}`);
    }
  }
  
  sendSSE({
    type: 'complete',
    multiFile: true,
    baseName,
    filesCreated: results.map(r => r.fileName),
    currentPath
  });
  
  return results;
};

const handleTerminalAI = async (req, res) => {
  try {
    const { prompt, sessionId = 'default', projectId = 'default', aiMode = 'local' } = req.body;
    if (!prompt || !prompt.trim()) {
      return res.json({ success: false, output: ['No AI prompt provided.'] });
    }

    const db = getDB();
    const filesCollection = db.collection('files');
    const sessions = db.collection('terminal_sessions');
    const session = await sessions.findOne({ sessionId });
    let currentPath = session?.currentPath || '/';
    const baseName = extractBaseName(prompt);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendSSE = (data) => {
      res.write(` ${JSON.stringify(data)}\n\n`);
    };

    let ollamaAvailable = false;
    if (aiMode === 'local') {
      try {
        await axios.get('http://127.0.0.1:11434/api/tags', { timeout: 5000 });
        ollamaAvailable = true;
        console.log('[AI] Ollama is running (Local Mode)');
        sendSSE({ type: 'status', message: 'Connected to Local AI engine (Ollama)' });
      } catch (err) {
        console.log('[AI] Ollama not available (Local Mode), using fallback or cloud mode');
        sendSSE({ type: 'status', message: 'Local AI (Ollama) unavailable. Check if Ollama is running and the model is pulled, or switch to Cloud AI mode.' });
      }
    } else {
      if (!GEMINI_API_KEY) {
        console.error('[AI Cloud] GEMINI_API_KEY is not configured');
        sendSSE({ type: 'error', message: 'Cloud AI: Gemini API key not configured. Set GEMINI_API_KEY in backend .env file.' });
        res.end();
        return;
      }
      console.log('[AI Cloud] Using Gemini API (Cloud Mode)');
      sendSSE({ type: 'status', message: 'Using Cloud AI engine (Gemini)' });
    }

    if (aiMode === 'local') {
      // Local mode - use Ollama (you can implement this later)
      console.log('[AI Local] Local mode not fully implemented — using single HTML fallback');
      const codeType = 'html';
      const language = 'HTML';
      const extension = '.html';
      const newFileName = `${baseName}${extension}`;
      const newFilePath = normalizePath(
        currentPath === '/' ? newFileName : `${normalizePath(currentPath)}/${newFileName}`
      );
      const existing = await findByPath(filesCollection, newFilePath, projectId);
      if (existing) {
        return res.json({ success: false, output: [`AI: File already exists: ${newFileName}`], currentPath });
      }
      sendSSE({ type: 'start', fileName: newFileName, filePath: newFilePath, fileType: codeType });
      const fallbackContent = generateFallbackContent(codeType, newFileName);
      const emptyFileDoc = {
        name: newFileName,
        path: newFilePath,
        type: 'file',
        content: fallbackContent,
        projectId,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await filesCollection.insertOne(emptyFileDoc);
      sendSSE({ type: 'complete', fileName: newFileName, filePath: newFilePath, usedFallback: true, codeLength: fallbackContent.length, currentPath });
      res.end();
    } else {
      console.log('[AI Cloud] Cloud mode - Analyzing for multi-file creation...');
      sendSSE({ type: 'status', message: 'Analyzing requirements (Cloud)...' });
      
      let filesToCreate, analysis;
      try {
        // Use heuristic analysis (more reliable than AI analysis for this use case)
        const result = analyzePromptForFilesHeuristic(prompt);
        filesToCreate = result.files;
        analysis = result.analysis;

        if (!filesToCreate || filesToCreate.length === 0) {
          throw new Error('No files determined from analysis');
        }

        // Set default name for HTML file if missing
        if (filesToCreate[0] && !filesToCreate[0].name) {
          filesToCreate[0].name = `${baseName}.html`;
        }
      } catch (analysisErr) {
        console.error('[AI Cloud] Analysis error:', analysisErr);
        filesToCreate = [{ type: 'html', ext: '.html', name: `${baseName}.html` }];
        analysis = { needsHTML: true, needsCSS: false, needsJS: false, reasoning: 'Fallback due to analysis error' };
      } 
      
      const isMultiFile = filesToCreate.length > 1;
      console.log('[AI Cloud] Analysis:', { baseName, isMultiFile, filesCount: filesToCreate.length, files: filesToCreate.map(f => f.name) });
      sendSSE({ type: 'analysis_complete', reasoning: analysis.reasoning, filesPlanned: filesToCreate.map(f => f.name) });
      
      if (isMultiFile) {
        console.log('[AI Cloud] Multi-file mode - Creating:', filesToCreate.map(f => f.name).join(', '));
        const results = await generateMultiFilesCloud(filesCollection, baseName, filesToCreate, prompt, sendSSE, projectId, currentPath);
        res.end();
      } else {
        console.log('[AI Cloud] Single file mode - Creating HTML only');
        const codeType = 'html';
        const language = 'HTML';
        const extension = '.html';
        const newFileName = `${baseName}${extension}`;
        const newFilePath = normalizePath(
          currentPath === '/' ? newFileName : `${normalizePath(currentPath)}/${newFileName}`
        );
        const existing = await findByPath(filesCollection, newFilePath, projectId);
        if (existing) {
          return res.json({ success: false, output: [`AI: File already exists: ${newFileName}`], currentPath });
        }
        sendSSE({ type: 'start', fileName: newFileName, filePath: newFilePath, fileType: codeType });
        const fileConfig = { fileName: newFileName, filePath: newFilePath, codeType, language, prompt, baseName };
        const result = await generateSingleFileCloud(filesCollection, fileConfig, sendSSE, null, projectId);
        sendSSE({ type: 'complete', fileName: newFileName, filePath: newFilePath, usedFallback: result.usedFallback, codeLength: result.generatedCode.length, currentPath });
        res.end();
      }
    }
  } catch (err) {
    console.error('Terminal AI Error:', err);
    try {
      res.write(` ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
      res.end();
    } catch {
      // Response already ended
    }
  }
};

module.exports = { handleTerminalAI };