import React, { useState, useRef, useCallback, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import Navbar from './Navbar';

const defineXxxLanguage = () => {
  // Register the custom language
  monaco.languages.register({ id: 'javascript-xxx' });
  
  // Define the custom theme with xxx highlighting
  monaco.editor.defineTheme('vs-dark-xxx', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'xxx-keyword', foreground: 'FFD700', fontStyle: 'bold' }, // Gold color for xxx
      { token: 'xxx-instruction', foreground: '90EE90', fontStyle: 'italic' } // Light green for instruction
    ],
    colors: {}
  });
  
  // Define tokenizer for xxx highlighting with proper JavaScript syntax
  monaco.languages.setMonarchTokensProvider('javascript-xxx', {
    // Include JavaScript keywords and operators
    keywords: [
      'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger',
      'default', 'delete', 'do', 'else', 'export', 'extends', 'false', 'finally',
      'for', 'function', 'if', 'import', 'in', 'instanceof', 'let', 'new', 'null',
      'return', 'super', 'switch', 'this', 'throw', 'true', 'try', 'typeof', 'var',
      'void', 'while', 'with', 'yield', 'async', 'await', 'of'
    ],
    
    typeKeywords: [
      'any', 'boolean', 'number', 'object', 'string', 'undefined'
    ],
    
    operators: [
      '<=', '>=', '==', '!=', '===', '!==', '=>', '+', '-', '*', '/', '%',
      '++', '--', '<<', '>>', '>>>', '&', '|', '^', '!', '~', '&&', '||',
      '?', ':', '=', '+=', '-=', '*=', '/=', '%=', '<<=', '>>=', '>>>=',
      '&=', '|=', '^='
    ],
    
    // Symbols for brackets, etc.
    symbols: /[=><!~?:&|+\-*\/\^%]+/,
    escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
    
    tokenizer: {
      root: [
        // Special xxx tokens - must come first
        [/^(\s*)(xxx)(\s+)(.*)$/, ['white', 'xxx-keyword', 'white', 'xxx-instruction']],
        
        // Identifiers and keywords
        [/[a-z_$][\w$]*/, { cases: { '@typeKeywords': 'keyword', '@keywords': 'keyword', '@default': 'identifier' } }],
        [/[A-Z][\w\$]*/, 'type.identifier'],
        
        // Whitespace
        { include: '@whitespace' },
        
        // Numbers
        [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
        [/0[xX][0-9a-fA-F]+/, 'number.hex'],
        [/\d+/, 'number'],
        
        // Delimiters and operators
        [/[;,.]/, 'delimiter'],
        [/[{}()\[\]]/, '@brackets'],
        [/@symbols/, { cases: { '@operators': 'operator', '@default': '' } }],
        
        // Strings
        [/"([^"\\]|\\.)*$/, 'string.invalid'],
        [/'([^'\\]|\\.)*$/, 'string.invalid'],
        [/"/, 'string', '@string_double'],
        [/'/, 'string', '@string_single'],
        [/`/, 'string', '@string_backtick']
      ],
      
      whitespace: [
        [/[ \t\r\n]+/, 'white'],
        [/\/\*/, 'comment', '@comment'],
        [/\/\/.*$/, 'comment']
      ],
      
      comment: [
        [/[^\/*]+/, 'comment'],
        [/\/\*/, 'comment', '@push'],
        [/\*\//, 'comment', '@pop'],
        [/[\/*]/, 'comment']
      ],
      
      string_double: [
        [/[^\\"]+/, 'string'],
        [/@escapes/, 'string.escape'],
        [/\\./, 'string.escape.invalid'],
        [/"/, 'string', '@pop']
      ],
      
      string_single: [
        [/[^\\']+/, 'string'],
        [/@escapes/, 'string.escape'],
        [/\\./, 'string.escape.invalid'],
        [/'/, 'string', '@pop']
      ],
      
      string_backtick: [
        [/\$\{/, { token: 'delimiter.bracket', next: '@bracketCounting' }],
        [/[^\\`$]+/, 'string'],
        [/@escapes/, 'string.escape'],
        [/\\./, 'string.escape.invalid'],
        [/`/, 'string', '@pop']
      ],
      
      bracketCounting: [
        [/\{/, 'delimiter.bracket', '@bracketCounting'],
        [/\}/, 'delimiter.bracket', '@pop'],
        { include: 'root' }
      ]
    }
  });
};

// Initialize language definition once
let languageDefined = false;
if (!languageDefined) {
  defineXxxLanguage();
  languageDefined = true;
}

const AICompiler = () => {
  const [code, setCode] = useState(
    '// Write JavaScript code here\n// Use "xxx [instruction]" on any line for AI code generation\n// Examples:\n// xxx create a function to reverse a string\n// xxx make a fibonacci sequence generator\n\nconsole.log("Hello, AI Compiler!");'
  );
  const [selectedCode, setSelectedCode] = useState('');
  const [selectedRange, setSelectedRange] = useState(null);
  const [runOutput, setRunOutput] = useState('');
  const [loadingAI, setLoadingAI] = useState(false);
  const [loadingRun, setLoadingRun] = useState(false);
  const [loadingInline, setLoadingInline] = useState(false);
  const [model, setModel] = useState('qwen');
  const [autoProcessInline, setAutoProcessInline] = useState(false);
  const [userInputs, setUserInputs] = useState([]); // Collected inputs
  const [currentPrompt, setCurrentPrompt] = useState(null); // Current prompt message
  const [awaitingInput, setAwaitingInput] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState('300px');
  const [isResizing, setIsResizing] = useState(false);
  const editorRef = useRef(null);
  const timeoutRef = useRef(null);
  const outputRef = useRef(null);

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [runOutput, awaitingInput]);

  // Handle code changes and detect inline prompts
  const handleCodeChange = useCallback((value) => {
    setCode(value || '');
    
    // Auto-process inline prompts if enabled
    if (autoProcessInline && value) {
      // Clear previous timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // Set new timeout for auto-processing (debounce)
      timeoutRef.current = setTimeout(() => {
        handleProcessInline(value);
      }, 2000);
    }
  }, [autoProcessInline]);

  const handleEditorDidMount = (editor) => {
    editorRef.current = editor;
    
    // Selection change handler
    editor.onDidChangeCursorSelection(() => {
      const selection = editor.getSelection();
      const selectionText = editor.getModel()?.getValueInRange(selection) || '';
      setSelectedCode(selectionText);
      setSelectedRange(selectionText ? selection : null);
    });

    // Handle Enter key to process xxx lines
    editor.onKeyDown((e) => {
      if (e.keyCode === monaco.KeyCode.Enter) {
        const position = editor.getPosition();
        const model = editor.getModel();
        const lineContent = model.getLineContent(position.lineNumber);
        
        // Check if current line starts with xxx
        if (lineContent.trim().startsWith('xxx ')) {
          e.preventDefault();
          
          // Extract the instruction
          const instruction = lineContent.trim().substring(4);
          if (instruction) {
            // Process this single instruction
            processSingleInstruction(instruction, position.lineNumber);
          }
        }
      }
    });

    // Add keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyI, () => {
      handleProcessInline();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyA, () => {
      handleAIClick();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      handleRunClick();
    });
  };

  // Process a single xxx instruction when Enter is pressed
  const processSingleInstruction = async (instruction, lineNumber) => {
    if (loadingInline) return;
    
    setLoadingInline(true);
    
    try {
      const res = await fetch('http://localhost:5000/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: instruction, 
          model,
          isInlinePrompt: true
        }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const data = await res.json();
      const generatedCode = data.code;

      if (generatedCode && editorRef.current) {
        const editor = editorRef.current;
        const model = editor.getModel();
        
        // Replace the xxx line with generated code
        const line = model.getLineContent(lineNumber);
        const range = new monaco.Range(lineNumber, 1, lineNumber, line.length + 1);
        
        editor.executeEdits(null, [{ 
          range: range, 
          text: generatedCode + '\n',
          forceMoveMarkers: true 
        }]);

        setRunOutput(`✅ Generated code for: "${instruction}"`);
      }
    } catch (err) {
      console.error(err);
      setRunOutput(`❌ Error generating code: ${err.message}`);
    } finally {
      setLoadingInline(false);
    }
  };

  // Process inline prompts (xxx instructions)
  const handleProcessInline = async (codeToProcess = null) => {
    const targetCode = codeToProcess || code;
    const hasInlinePrompts = targetCode.includes('xxx ');
    
    if (!hasInlinePrompts) {
      setRunOutput('No inline prompts (xxx) found in code.');
      return;
    }

    setLoadingInline(true);

    try {
      const res = await fetch('http://localhost:5000/api/process-inline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: targetCode, model }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const data = await res.json();
      
      if (data.processedCode && data.processedCode !== targetCode) {
        setCode(data.processedCode);
        
        // Update editor if it exists
        if (editorRef.current) {
          editorRef.current.setValue(data.processedCode);
        }

        // Show processing results in output
        if (data.changes.length > 0) {
          const changesSummary = data.changes.map(change => 
            change.error ? 
              `❌ Line ${change.startLine + 1}: ${change.error}` :
              `✅ Line ${change.startLine + 1}: Generated code for "${change.instruction}"`
          ).join('\n');
          
          setRunOutput(`Inline Processing Results:\n${changesSummary}`);
        } else {
          setRunOutput('No changes made during inline processing.');
        }
      } else {
        setRunOutput('No changes were needed or generated.');
      }
    } catch (err) {
      console.error(err);
      setRunOutput(`Error processing inline prompts: ${err.message}`);
    } finally {
      setLoadingInline(false);
    }
  };

  // Fix selected code or generate new code with AI
  const handleAIClick = async () => {
    if (!selectedCode.trim()) {
      alert('Please select code to fix with AI.');
      return;
    }

    setLoadingAI(true);

    try {
      const res = await fetch('http://localhost:5000/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          code: selectedCode, 
          model 
        }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const data = await res.json();
      const generatedCode = data.code;

      if (!generatedCode) {
        alert('No code generated by AI.');
        return;
      }

      const editor = editorRef.current;
      if (editor && generatedCode && selectedRange) {
        // Replace selected code
        editor.executeEdits(null, [{ 
          range: selectedRange, 
          text: generatedCode, 
          forceMoveMarkers: true 
        }]);
      }

      setRunOutput(`AI Code Fixed Successfully!`);
    } catch (err) {
      console.error(err);
      setRunOutput(`Error interacting with AI: ${err.message}`);
    } finally {
      setLoadingAI(false);
    }
  };

  // Run JavaScript code
  const handleRunClick = async () => {
    setLoadingRun(true);
    setRunOutput('🔄 Running code...');

    try {
      const res = await fetch('http://localhost:5000/api/run-js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          code, 
          userInput: userInputs // Send all collected inputs at once
        }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const data = await res.json();
      
      if (data.requiresInput) {
        // Code needs more input - show prompt
        setCurrentPrompt(data.promptMessage || 'Enter input:');
        setAwaitingInput(true);
        setRunOutput(data.output);
      } else {
        // Execution completed successfully
        setRunOutput(data.output || 'Code executed successfully');
        setUserInputs([]); // Reset inputs after successful run
        setAwaitingInput(false);
        setCurrentPrompt(null);
      }
    } catch (err) {
      console.error(err);
      setRunOutput(`❌ Error executing code: ${err.message}`);
      setUserInputs([]);
      setAwaitingInput(false);
      setCurrentPrompt(null);
    } finally {
      setLoadingRun(false);
    }
  };

  // Handle user input submission
  const handleInputSubmit = (inputValue) => {
    // Add the new input to the array
    const newInputs = [...userInputs, inputValue];
    setUserInputs(newInputs);
    setAwaitingInput(false);
    setCurrentPrompt(null);
    
    // Continue execution with the updated inputs
    setTimeout(() => {
      runCodeWithInputs(newInputs);
    }, 100);
  };

  // Run code with provided inputs
  const runCodeWithInputs = async (inputs) => {
    setLoadingRun(true);
    
    try {
      const res = await fetch('http://localhost:5000/api/run-js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          code, 
          userInput: inputs
        }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const data = await res.json();
      
      if (data.requiresInput) {
        // Still needs more input
        setCurrentPrompt(data.promptMessage || 'Enter input:');
        setAwaitingInput(true);
        setRunOutput(data.output);
      } else {
        // Execution completed
        setRunOutput(data.output || 'Code executed successfully');
        setUserInputs([]); // Reset inputs after successful completion
        setAwaitingInput(false);
        setCurrentPrompt(null);
      }
    } catch (err) {
      console.error(err);
      setRunOutput(`❌ Error executing code: ${err.message}`);
      setUserInputs([]);
      setAwaitingInput(false);
      setCurrentPrompt(null);
    } finally {
      setLoadingRun(false);
    }
  };

  // Clear editor
  const handleClearEditor = () => {
    const defaultCode = '// Write JavaScript code here\n// Use "xxx [instruction]" on any line for AI code generation\n// Press Enter after typing xxx instruction to generate code\n\nconsole.log("Hello, AI Compiler!");';
    setCode(defaultCode);
    setRunOutput('');
    setUserInputs([]);
    setAwaitingInput(false);
    setCurrentPrompt(null);
    if (editorRef.current) {
      editorRef.current.setValue(defaultCode);
    }
  };

  // Handle terminal resize
  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsResizing(true);
    
    const startY = e.clientY;
    const startHeight = parseInt(terminalHeight);
    
    const handleMouseMove = (e) => {
      const deltaY = startY - e.clientY; // Inverted because we're resizing from top
      const newHeight = Math.max(120, Math.min(window.innerHeight * 0.6, startHeight + deltaY));
      setTerminalHeight(`${newHeight}px`);
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const canUseAI = selectedCode.trim();
  const hasInlinePrompts = code.includes('xxx ');

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Add resize cursor style to body when resizing
  useEffect(() => {
    if (isResizing) {
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh',
      width: '100vw',
      margin: 0,
      padding: 0,
      backgroundColor: '#1a1a1a',
      color: '#fff',
      fontFamily: 'Arial, sans-serif',
      overflow: 'hidden'
    }}>
      {/* Navigation Bar */}
      <div style={{ padding: '0.75rem 1rem' }}>
        <Navbar
          onRun={handleRunClick}
          onAIFix={handleAIClick}
          onProcessInline={() => handleProcessInline()}
          onClear={handleClearEditor}
          model={model}
          onModelChange={setModel}
          autoProcessInline={autoProcessInline}
          onAutoProcessChange={setAutoProcessInline}
          loadingRun={loadingRun}
          loadingAI={loadingAI}
          loadingInline={loadingInline}
          canUseAI={canUseAI}
          hasInlinePrompts={hasInlinePrompts}
          awaitingInput={awaitingInput}
        />
      </div>

      <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column',
        minHeight: 0 
      }}>
        {/* Editor Panel - Full Width */}
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column',
          minHeight: 0
        }}>
          <div style={{ 
            flex: 1, 
            border: '1px solid #444',
            overflow: 'hidden',
            margin: '0 1rem'
          }}>
            <Editor
              height="100%"
              language="javascript-xxx"
              theme="vs-dark-xxx"
              value={code}
              onChange={handleCodeChange}
              onMount={handleEditorDidMount}
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                automaticLayout: true,
                wordWrap: 'on',
                lineNumbers: 'on',
                renderWhitespace: 'boundary',
                scrollBeyondLastLine: false,
                suggestOnTriggerCharacters: true,
                acceptSuggestionOnCommitCharacter: true,
                acceptSuggestionOnEnter: 'on',
                tabCompletion: 'on'
              }}
            />
          </div>
        </div>
        
        {/* Resizable Terminal Panel */}
        <div style={{ 
          height: terminalHeight,
          minHeight: '120px',
          maxHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
          borderTop: '1px solid #555',
          margin: '0 1rem'
        }}>
          {/* Terminal Header with Resize Handle */}
          <div 
            style={{ 
              height: '32px',
              backgroundColor: '#2a2a2a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 1rem',
              cursor: 'ns-resize',
              borderBottom: '1px solid #444',
              userSelect: 'none'
            }}
            onMouseDown={handleMouseDown}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '14px', fontWeight: 'bold' }}>📋 Interactive Console</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                onClick={() => setRunOutput('')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#888',
                  cursor: 'pointer',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  fontSize: '12px'
                }}
                onMouseEnter={(e) => e.target.style.color = '#fff'}
                onMouseLeave={(e) => e.target.style.color = '#888'}
              >
                Clear
              </button>
              <div style={{ 
                width: '20px', 
                height: '4px', 
                backgroundColor: '#555',
                borderRadius: '2px',
                cursor: 'ns-resize'
              }} />
            </div>
          </div>

          {/* Terminal Content */}
          <div
            ref={outputRef}
            style={{
              flex: 1,
              backgroundColor: '#1e1e1e',
              padding: '1rem',
              overflowY: 'auto',
              fontSize: '13px',
              lineHeight: '1.4',
              color: '#e0e0e0',
              display: 'flex',
              flexDirection: 'column',
              fontFamily: 'Consolas, "Courier New", monospace'
            }}
          >
            {/* Render output lines */}
            {runOutput.split('\n').map((line, i) => (
              <div key={i} style={{ whiteSpace: 'pre-wrap', marginBottom: '0.25rem' }}>
                {line}
              </div>
            ))}

            {/* Input line when awaiting input */}
            {awaitingInput && (
              <div style={{ display: 'flex', marginTop: '0.5rem', alignItems: 'center' }}>
                <span style={{ marginRight: '0.5rem', color: '#4CAF50', fontWeight: 'bold' }}>❯</span>
                <input
                  type="text"
                  autoFocus
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#e0e0e0',
                    fontSize: '13px',
                    width: '100%',
                    outline: 'none',
                    fontFamily: 'Consolas, "Courier New", monospace'
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const input = e.target.value;
                      handleInputSubmit(input);
                      e.target.value = '';
                    }
                  }}
                  placeholder={currentPrompt || 'Type input...'}
                />
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Status Bar */}
      <div style={{
        padding: '0.5rem 1rem',
        backgroundColor: '#2a2a2a',
        fontSize: '14px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTop: '1px solid #444'
      }}>
        <span>
          {awaitingInput 
            ? '⌨️ Type your input above and press Enter' 
            : selectedCode 
              ? `📝 Selected: ${selectedCode.length} chars` 
              : '💡 Type "xxx [instruction]" and press Enter for instant AI code generation'}
        </span>
        <span>
          {hasInlinePrompts ? '⚡ Inline prompts detected' : loadingInline ? '⚡ Generating...' : '✅ Ready'}
        </span>
      </div>
    </div>
  );
};

export default AICompiler;