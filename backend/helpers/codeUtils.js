// helpers/codeUtils.js

/**
 * Extract clean code from AI response
 * Removes markdown code blocks, explanations, and extra formatting
 */
const extractCodeFromAI = (response, codeType = 'javascript') => {
  if (!response || typeof response !== 'string') {
    return '';
  }

  let cleaned = response;

  // Remove markdown code blocks with language identifiers
  const codeBlockPatterns = [
    /```(?:javascript|js|html|css|python|java|cpp|c)\s*([\s\S]*?)```/gi,
    /```\s*([\s\S]*?)```/gi,
    /`([^`]+)`/g  // Remove inline code markers
  ];

  for (const pattern of codeBlockPatterns) {
    cleaned = cleaned.replace(pattern, (match, code) => code || match);
  }

  // Remove common AI response patterns
  const removePatterns = [
    /^Here(?:'s| is) (?:the|your) (?:fixed|improved|updated|corrected|generated)? ?code:?\s*/i,
    /^Here(?:'s| is) (?:a|an|the) (?:solution|implementation):?\s*/i,
    /^I've (?:fixed|improved|updated|corrected|generated) (?:the|your) code:?\s*/i,
    /^This (?:code|implementation|solution) (?:will|should|does):?\s*/i,
    /^The (?:above|following) code (?:will|should|does):?\s*/i,
    /^Note:?\s*.*$/gmi,
    /^Explanation:?\s*.*$/gmi,
    /^Summary:?\s*.*$/gmi,
    /^Usage:?\s*.*$/gmi
  ];

  for (const pattern of removePatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  // Remove lines that are pure explanations (start with common explanation words)
  const lines = cleaned.split('\n');
  const codeLines = lines.filter(line => {
    const trimmed = line.trim();
    
    // Keep empty lines for formatting
    if (trimmed === '') return true;
    
    // Remove explanation lines
    const explanationStarters = [
      /^This code/i,
      /^The above/i,
      /^Here we/i,
      /^I've added/i,
      /^Now you can/i,
      /^You can now/i,
      /^Feel free/i,
      /^Let me know/i,
      /^If you/i,
      /^The function/i,
      /^This function/i,
      /^In this/i,
      /^Note that/i,
      /^Make sure/i,
      /^Remember to/i,
      /^Don't forget/i
    ];

    return !explanationStarters.some(pattern => pattern.test(trimmed));
  });

  cleaned = codeLines.join('\n');

  // Remove leading/trailing whitespace but preserve code indentation
  cleaned = cleaned.trim();

  // Remove excessive blank lines (more than 2 consecutive)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  // Language-specific cleanup
  if (codeType === 'html') {
    // Ensure HTML has proper structure if it's a fragment
    if (cleaned && !cleaned.includes('<!DOCTYPE') && !cleaned.includes('<html')) {
      // Keep as fragment if it's just elements
      cleaned = cleaned.trim();
    }
  }

  if (codeType === 'css') {
    // Remove any HTML or JS that might have snuck in
    const cssStart = cleaned.indexOf('{');
    const cssEnd = cleaned.lastIndexOf('}');
    if (cssStart !== -1 && cssEnd !== -1) {
      // Extract only CSS rules
      const lines = cleaned.split('\n');
      const cssLines = lines.filter(line => {
        const trimmed = line.trim();
        return trimmed === '' || 
               trimmed.includes('{') || 
               trimmed.includes('}') || 
               trimmed.includes(':') ||
               trimmed.match(/^[a-zA-Z-]+\s*{/);  // CSS selectors
      });
      cleaned = cssLines.join('\n');
    }
  }

  return cleaned;
};

/**
 * Parse inline prompts from code (xxx command syntax)
 */
const parseInlinePrompts = (code) => {
  if (!code || typeof code !== 'string') {
    return [];
  }

  const lines = code.split('\n');
  const prompts = [];
  let currentPrompt = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Start of inline prompt
    if (line.startsWith('xxx ')) {
      const instruction = line.substring(4).trim();
      
      if (!instruction) continue;

      currentPrompt = {
        startLine: i,
        endLine: i,
        instruction: instruction,
        type: 'single-line'
      };
    } 
    // Multi-line prompt continuation
    else if (currentPrompt && line.startsWith('xxx')) {
      currentPrompt.endLine = i;
      const additionalText = line.substring(3).trim();
      if (additionalText) {
        currentPrompt.instruction += ' ' + additionalText;
      }
      currentPrompt.type = 'multi-line';
    } 
    // End of multi-line prompt
    else if (currentPrompt) {
      prompts.push(currentPrompt);
      currentPrompt = null;
    }
  }

  // Add last prompt if exists
  if (currentPrompt) {
    prompts.push(currentPrompt);
  }

  return prompts;
};

/**
 * Validate generated code for basic syntax issues
 */
const validateCode = (code, codeType) => {
  if (!code || typeof code !== 'string') {
    return { valid: false, error: 'Empty code' };
  }

  const validations = {
    javascript: () => {
      // Check for balanced braces
      const openBraces = (code.match(/{/g) || []).length;
      const closeBraces = (code.match(/}/g) || []).length;
      if (openBraces !== closeBraces) {
        return { valid: false, error: 'Unbalanced braces' };
      }
      
      // Check for balanced parentheses
      const openParens = (code.match(/\(/g) || []).length;
      const closeParens = (code.match(/\)/g) || []).length;
      if (openParens !== closeParens) {
        return { valid: false, error: 'Unbalanced parentheses' };
      }

      return { valid: true };
    },
    
    html: () => {
      // Basic HTML tag balance check
      const openTags = code.match(/<([a-z][a-z0-9]*)\b[^>]*>/gi) || [];
      const closeTags = code.match(/<\/([a-z][a-z0-9]*)>/gi) || [];
      const selfClosing = code.match(/<[a-z][a-z0-9]*\b[^>]*\/>/gi) || [];
      
      // Rough check (not perfect but catches obvious issues)
      const expectedClose = openTags.length - selfClosing.length;
      if (Math.abs(expectedClose - closeTags.length) > 3) {
        return { valid: false, error: 'Possibly unbalanced HTML tags' };
      }

      return { valid: true };
    },
    
    css: () => {
      // Check for balanced braces in CSS
      const openBraces = (code.match(/{/g) || []).length;
      const closeBraces = (code.match(/}/g) || []).length;
      if (openBraces !== closeBraces) {
        return { valid: false, error: 'Unbalanced CSS braces' };
      }

      return { valid: true };
    }
  };

  const validator = validations[codeType] || validations.javascript;
  return validator();
};

module.exports = {
  extractCodeFromAI,
  parseInlinePrompts,
  validateCode
};