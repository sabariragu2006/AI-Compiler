// controllers/inlineController.js
const axios = require('axios');
const { getDB } = require('../db');

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

const processInline = async (req, res) => {
  try {
    // ✅ Accept aiMode (even if unused)
    const { code, model, projectId, filePath, codeType = 'javascript', aiMode } = req.body;

    if (!code) return res.status(400).json({ error: 'No code provided' });
    if (!projectId || typeof projectId !== 'string') {
      return res.status(400).json({ error: 'Valid projectId is required' });
    }
    if (!filePath || typeof filePath !== 'string') {
      return res.status(400).json({ error: 'Valid filePath is required' });
    }

    // ✅ Validate model (must be one of allowed values)
    const validModels = ['qwen', 'deepseek', 'gemini'];
    if (!validModels.includes(model)) {
      return res.status(400).json({ 
        error: 'Invalid model. Only "qwen", "deepseek", or "gemini" are supported.',
        receivedModel: model
      });
    }

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
          model,
          isInlinePrompt: true,
          codeType,
          aiMode // 🔹 Forward aiMode to /api/compile if needed
        }, { timeout: 45000 });

        const gen = aiRes.data.code;
        if (gen && gen.trim()) {
          const before = processed.slice(0, p.startLine);
          const after = processed.slice(p.endLine + 1);
          processed = [...before, ...gen.split('\n'), ...after];
          changes.push({
            startLine: p.startLine,
            endLine: p.endLine,
            instruction: p.instruction,
            generatedCode: gen,
            success: true
          });
        } else {
          changes.push({
            startLine: p.startLine,
            endLine: p.endLine,
            instruction: p.instruction,
            error: 'AI returned empty response',
            success: false
          });
        }
      } catch (e) {
        changes.push({
          startLine: p.startLine,
          endLine: p.endLine,
          instruction: p.instruction,
          error: e.message,
          success: false
        });
      }
    }

    // ✅ Save to MongoDB
    const processedCode = processed.join('\n');
    const db = getDB();
    const filesCollection = db.collection('files');
    const normalizePath = (p = '') => p.replace(/^\/+|\/+$/g, '');
    const normalizedPath = normalizePath(filePath);

    const updateResult = await filesCollection.updateOne(
      { projectId, path: normalizedPath },
      { $set: { content: processedCode, updatedAt: new Date() } }
    );

    if (updateResult.matchedCount === 0) {
      console.warn(`⚠️ File not found for update: ${normalizedPath} in project ${projectId}`);
    }

    const successCount = changes.filter(c => c.success).length;
    res.json({
      processedCode,
      changes: changes.reverse(),
      saved: updateResult.matchedCount > 0,
      summary: {
        total: changes.length,
        successful: successCount,
        failed: changes.length - successCount
      }
    });

  } catch (err) {
    console.error('❌ Inline Processing Error:', err);
    res.status(500).json({ error: 'Failed to process inline prompts', details: err.message });
  }
};

module.exports = { processInline };