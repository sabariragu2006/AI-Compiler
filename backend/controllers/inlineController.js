// controllers/inlineController.js
const axios = require('axios');

// Utility to parse inline prompts
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

// Controller
const processInline = async (req, res) => {
  try {
    const { code, model } = req.body;
    if (!code) return res.status(400).json({ error: 'No code provided' });

    const prompts = parseInlinePrompts(code);
    console.log('📝 Found inline prompts:', prompts.length);

    if (prompts.length === 0) {
      return res.json({ processedCode: code, changes: [] });
    }

    const lines = code.split('\n');
    let processed = [...lines];
    const changes = [];

    for (let i = prompts.length - 1; i >= 0; i--) {
      const p = prompts[i];
      console.log(`🔄 Processing prompt ${i + 1}/${prompts.length}:`, p.instruction);

      try {
        const aiRes = await axios.post('http://localhost:5000/api/compile', {
          prompt: p.instruction,
          model: model,
          isInlinePrompt: true
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
          console.log(`✅ Generated code for prompt ${i + 1} (${gen.length} chars)`);
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
        console.error(`❌ Failed to process prompt ${i + 1}:`, e.message);

        let errorMessage = 'AI generation failed';
        if (e.code === 'ECONNABORTED') {
          errorMessage = 'AI request timed out (45s) - try simpler prompt';
        }

        changes.push({
          startLine: p.startLine,
          endLine: p.endLine,
          instruction: p.instruction,
          error: errorMessage,
          success: false
        });
      }

      if (i > 0) await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const successCount = changes.filter(c => c.success).length;
    console.log(`🏁 Inline processing complete: ${successCount}/${changes.length} successful`);

    res.json({
      processedCode: processed.join('\n'),
      changes: changes.reverse(),
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
