// helpers/codeUtils.js

function extractCodeFromAI(aiResponse, codeType = 'javascript') {
  if (!aiResponse) return '';

  let code = aiResponse;

  const codeBlockRegex = codeType === 'html'
    ? /```(?:html|xml)?\s*([\s\S]*?)\s*```/gi
    : /```(?:javascript|js|typescript|ts)?\s*([\s\S]*?)\s*```/gi;

  const matches = [...aiResponse.matchAll(codeBlockRegex)];
  if (matches.length > 0) {
    code = matches.map(match => match[1]).join('\n\n');
  }

  code = code.replace(/^```[\s\S]*?```$/gm, '');
  code = code.replace(/^```/gm, '').replace(/```$/gm, '');

  const lines = code.split('\n').filter(line => {
    const trimmed = line.trim();
    if (!trimmed) return true;

    const nonCodePatterns = [
      /^(here's|sure|note|explanation|comment|output|result|answer|response|generated|created|updated|fixed|improved|the following|below is|this is|i have|here is)/i,
      /^(\/\/|\/\*|<!--)\s*(here's|sure|note|explanation|comment|output|result|answer|response|generated|created|updated|fixed|improved|the following|below is|this is|i have|here is)/i,
      /^ai:/i,
      /^user:/i
    ];

    return !nonCodePatterns.some(pattern => pattern.test(trimmed));
  });

  code = lines.join('\n').trim();

  code = code
    .replace(/^```[\s\S]*$/gm, '')
    .replace(/^\s*```.*$/gm, '')
    .replace(/^.*```\s*$/gm, '')
    .trim();

  return code;
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
