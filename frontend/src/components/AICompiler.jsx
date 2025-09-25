import React, { useState, useRef, useCallback, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { debounce } from 'lodash';
import Navbar from './Navbar';

const defineXxxLanguage = () => {
  // Register the custom language
  monaco.languages.register({ id: 'javascript-xxx' });
  
  // Define the custom theme with xxx highlighting
  monaco.editor.defineTheme('vs-dark-xxx', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'xxx-keyword', foreground: 'FFD700', fontStyle: 'bold' },
      { token: 'xxx-instruction', foreground: '90EE90', fontStyle: 'italic' }
    ],
    colors: {}
  });
  
  // Define tokenizer for xxx highlighting with proper JavaScript syntax
  monaco.languages.setMonarchTokensProvider('javascript-xxx', {
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
    
    symbols: /[=><!~?:&|+\-*\/\^%]+/,
    escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
    
    tokenizer: {
      root: [
        [/^(\s*)(xxx)(\s+)(.*)$/, ['white', 'xxx-keyword', 'white', 'xxx-instruction']],
        [/[a-z_$][\w$]*/, { cases: { '@typeKeywords': 'keyword', '@keywords': 'keyword', '@default': 'identifier' } }],
        [/[A-Z][\w\$]*/, 'type.identifier'],
        { include: '@whitespace' },
        [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
        [/0[xX][0-9a-fA-F]+/, 'number.hex'],
        [/\d+/, 'number'],
        [/[;,.]/, 'delimiter'],
        [/[{}()\[\]]/, '@brackets'],
        [/@symbols/, { cases: { '@operators': 'operator', '@default': '' } }],
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

const AICompiler = ({ code: externalCode, setCode: setExternalCode, currentFile, setCurrentFile }) => {
  const [code, setCode] = useState(
    externalCode || '// Write JavaScript code here\n// Use "xxx [instruction]" on any line for AI code generation\n// Examples:\n// xxx create a function to reverse a string\n// xxx make a fibonacci sequence generator\n\nconsole.log("Hello, AI Compiler!");'
  );
  const [selectedCode, setSelectedCode] = useState('');
  const [selectedRange, setSelectedRange] = useState(null);
  const [runOutput, setRunOutput] = useState('');
  const [loadingAI, setLoadingAI] = useState(false);
  const [loadingRun, setLoadingRun] = useState(false);
  const [loadingInline, setLoadingInline] = useState(false);
  const [model, setModel] = useState('deepseek');
  const [autoProcessInline, setAutoProcessInline] = useState(false);
  const [userInputs, setUserInputs] = useState([]);
  const [currentPrompt, setCurrentPrompt] = useState(null);
  const [awaitingInput, setAwaitingInput] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState('300px');
  const [isResizing, setIsResizing] = useState(false);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved', 'saving', 'unsaved'
  
  const editorRef = useRef(null);
  const timeoutRef = useRef(null);
  const outputRef = useRef(null);
  const saveTimeoutRef = useRef(null);

  // Update code when external code changes (file selection)
  useEffect(() => {
    if (externalCode !== undefined && externalCode !== code) {
      setCode(externalCode);
      setSaveStatus('saved');
      if (editorRef.current) {
        editorRef.current.setValue(externalCode);
      }
    }
  }, [externalCode]);

  // Auto-save functionality with debouncing
  const debouncedSave = useCallback(
    debounce(async (codeContent, fileToSave) => {
      if (!fileToSave || !codeContent) return;
      
      try {
        setSaveStatus('saving');
        const response = await fetch('http://localhost:5000/api/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: fileToSave, content: codeContent })
        });
        
        if (response.ok) {
          setSaveStatus('saved');
        } else {
          setSaveStatus('unsaved');
          console.error('Failed to save file');
        }
      } catch (error) {
        setSaveStatus('unsaved');
        console.error('Auto-save error:', error);
      }
    }, 1000),
    []
  );

  // Auto-save when code changes
  useEffect(() => {
    const fileName = currentFile?.name || 'untitled.js';
    
    if (fileName && code && fileName !== 'untitled.js') {
      setSaveStatus('unsaved');
      debouncedSave(code, fileName);
    }

    return () => {
      debouncedSave.cancel();
    };
  }, [code, currentFile, debouncedSave]);

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [runOutput, awaitingInput]);

  // Handle code changes and detect inline prompts
  const handleCodeChange = useCallback((value) => {
    const newCode = value || '';
    setCode(newCode);
    
    // Notify parent component
    if (setExternalCode) {
      setExternalCode(newCode);
    }
    
    // Auto-process inline prompts if enabled
    if (autoProcessInline && newCode) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        handleProcessInline(newCode);
      }, 2000);
    }
  }, [autoProcessInline, setExternalCode]);

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
        
        if (lineContent.trim().startsWith('xxx ')) {
          e.preventDefault();
          
          const instruction = lineContent.trim().substring(4);
          if (instruction) {
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

    // Manual save shortcut
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      if (currentFile) {
        debouncedSave.flush(); // Force immediate save
      }
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
        
        const line = model.getLineContent(lineNumber);
        const range = new monaco.Range(lineNumber, 1, lineNumber, line.length + 1);
        
        editor.executeEdits(null, [{ 
          range: range, 
          text: generatedCode + '\n',
          forceMoveMarkers: true 
        }]);

        setRunOutput(`Generated code for: "${instruction}"`);
      }
    } catch (err) {
      console.error(err);
      setRunOutput(`Error generating code: ${err.message}`);
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
        
        if (editorRef.current) {
          editorRef.current.setValue(data.processedCode);
        }

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
      setRunOutput('Please select code to fix with AI.');
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
        setRunOutput('No code generated by AI.');
        return;
      }

      const editor = editorRef.current;
      if (editor && generatedCode && selectedRange) {
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
    setRunOutput('Running code...');

    try {
      const res = await fetch('http://localhost:5000/api/run-js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          code, 
          userInput: userInputs
        }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const data = await res.json();
      
      if (data.requiresInput) {
        setCurrentPrompt(data.promptMessage || 'Enter input:');
        setAwaitingInput(true);
        setRunOutput(data.output);
      } else {
        setRunOutput(data.output || 'Code executed successfully');
        setUserInputs([]);
        setAwaitingInput(false);
        setCurrentPrompt(null);
      }
    } catch (err) {
      console.error(err);
      setRunOutput(`Error executing code: ${err.message}`);
      setUserInputs([]);
      setAwaitingInput(false);
      setCurrentPrompt(null);
    } finally {
      setLoadingRun(false);
    }
  };

  // Handle user input submission
  const handleInputSubmit = (inputValue) => {
    const newInputs = [...userInputs, inputValue];
    setUserInputs(newInputs);
    setAwaitingInput(false);
    setCurrentPrompt(null);
    
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
        setCurrentPrompt(data.promptMessage || 'Enter input:');
        setAwaitingInput(true);
        setRunOutput(data.output);
      } else {
        setRunOutput(data.output || 'Code executed successfully');
        setUserInputs([]);
        setAwaitingInput(false);
        setCurrentPrompt(null);
      }
    } catch (err) {
      console.error(err);
      setRunOutput(`Error executing code: ${err.message}`);
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
      const deltaY = startY - e.clientY;
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

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      debouncedSave.cancel();
    };
  }, [debouncedSave]);

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

  // Get save status indicator
  const getSaveStatusIcon = () => {
    switch (saveStatus) {
      case 'saving':
        return '💾';
      case 'unsaved':
        return '●';
      case 'saved':
      default:
        return '';
    }
  };

  const getSaveStatusText = () => {
    switch (saveStatus) {
      case 'saving':
        return 'Saving...';
      case 'unsaved':
        return 'Unsaved changes';
      case 'saved':
      default:
        return currentFile ? `${currentFile.name}` : 'untitled.js';
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh',
      width: '100%',
      margin: 0,
      padding: 0,
      backgroundColor: '#1e1e1e',
      color: '#d4d4d4',
      fontFamily: 'Segoe UI, sans-serif',
      overflow: 'hidden'
    }}>
      {/* Navigation Bar */}
      <div style={{ padding: '0.5rem 1rem' }}>
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

      {/* File Tab Bar */}
      {currentFile && (
        <div style={{
          padding: '0 1rem',
          borderBottom: '1px solid #3e3e42',
          backgroundColor: '#2d2d30'
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '8px 12px',
            backgroundColor: '#1e1e1e',
            border: '1px solid #3e3e42',
            borderBottom: 'none',
            borderTopLeftRadius: '4px',
            borderTopRightRadius: '4px',
            fontSize: '13px',
            gap: '6px',
            color: '#d4d4d4'
          }}>
            <span>📄</span>
            <span>{getSaveStatusText()}</span>
            <span style={{ color: saveStatus === 'unsaved' ? '#f1fa8c' : 'transparent' }}>
              {getSaveStatusIcon()}
            </span>
          </div>
        </div>
      )}

      <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column',
        minHeight: 0 
      }}>
        {/* Editor Panel */}
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column',
          minHeight: 0
        }}>
          <div style={{ 
            flex: 1, 
            border: '1px solid #3e3e42',
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
                tabCompletion: 'on',
                fontFamily: 'Consolas, "Courier New", monospace'
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
          borderTop: '1px solid #3e3e42',
          margin: '0 1rem'
        }}>
          {/* Terminal Header with Resize Handle */}
          <div 
            style={{ 
              height: '32px',
              backgroundColor: '#252526',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 1rem',
              cursor: 'ns-resize',
              borderBottom: '1px solid #3e3e42',
              userSelect: 'none'
            }}
            onMouseDown={handleMouseDown}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#cccccc', textTransform: 'uppercase' }}>Terminal</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                onClick={() => setRunOutput('')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#cccccc',
                  cursor: 'pointer',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  fontSize: '12px'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#3e3e42'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
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
              color: '#d4d4d4',
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
                <span style={{ marginRight: '0.5rem', color: '#50fa7b', fontWeight: 'bold' }}>❯</span>
                <input
                  type="text"
                  autoFocus
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#d4d4d4',
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
        backgroundColor: '#007acc',
        fontSize: '12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        color: '#ffffff'
      }}>
        <span>
          {awaitingInput 
            ? 'Type your input above and press Enter' 
            : selectedCode 
              ? `Selected: ${selectedCode.length} chars` 
              : 'Type "xxx [instruction]" and press Enter for instant AI code generation'}
        </span>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span>
            {hasInlinePrompts ? 'Inline prompts detected' : loadingInline ? 'Generating...' : 'Ready'}
          </span>
          <span>{getSaveStatusText()}</span>
        </div>
      </div>
    </div>
  );
};

export default AICompiler;