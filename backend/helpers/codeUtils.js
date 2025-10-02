// helpers/codeUtils.js

function extractCodeFromAI(aiResponse, codeType = 'javascript') {
  if (!aiResponse) return '';

  let code = aiResponse;

  // Remove any <think> sections or explanations
  code = code.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // Regex to capture ONLY the requested language
  const regexMap = {
    javascript: /```(?:javascript|js|typescript|ts)?\s*([\s\S]*?)\s*```/gi,
    html: /```(?:html|xml)?\s*([\s\S]*?)\s*```/gi,
    css: /```(?:css)?\s*([\s\S]*?)\s*```/gi,
  };

  const matches = [...code.matchAll(regexMap[codeType])];
  if (matches.length > 0) {
    return matches.map(m => m[1]).join('\n').trim();
  }

  // If no fenced block found, fallback to raw (but strip cross-language stuff)
  if (codeType === 'html') {
    return code.replace(/<style[\s\S]*?<\/style>/gi, '')
               .replace(/<script[\s\S]*?<\/script>/gi, '')
               .trim();
  }
  if (codeType === 'css') {
    return code.replace(/<\/?[^>]+(>|$)/g, '') // strip HTML tags
               .replace(/function|const|let|var/g, '') // rough remove JS
               .trim();
  }
  if (codeType === 'javascript') {
    return code.replace(/<\/?[^>]+(>|$)/g, '') // strip HTML
               .replace(/[\w-]+\s*{[^}]*}/g, '') // strip CSS blocks
               .trim();
  }

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

module.exports = { extractCodeFromAI, parseInlinePrompts };
