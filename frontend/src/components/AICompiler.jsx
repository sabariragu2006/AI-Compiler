import React, { useState, useEffect, useRef } from 'react';
import { Editor } from './Editor';
import { X } from 'lucide-react';
import Navbar from './Navbar';
import Terminal from './Terminal';
import FileManager from './FileManager';
import HTMLPreview from './HTMLPreview';
import debounce from 'lodash.debounce';

const AICompiler = () => {
  const [code, setCode] = useState('');
  const [fileType, setFileType] = useState('js');
  const [output, setOutput] = useState('');
  const [model, setModel] = useState('qwen');
  const [autoProcessInline, setAutoProcessInline] = useState(true);
  const [loadingRun, setLoadingRun] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [loadingInline, setLoadingInline] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const [currentFileName, setCurrentFileName] = useState('');
  const [userInputQueue, setUserInputQueue] = useState([]);
  const [awaitingInput, setAwaitingInput] = useState(false);
  const [promptMessage, setPromptMessage] = useState('');
  const [streamingCode, setStreamingCode] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [showHTMLPreview, setShowHTMLPreview] = useState(false);
  const [openFiles, setOpenFiles] = useState([]);

  const editorRef = useRef(null);
  const API_URL = 'http://localhost:5000';
  const abortControllerRef = useRef(null);

  // =============== CONNECTION CHECK ===============
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const res = await fetch(`${API_URL}/health`);
        setConnectionStatus(res.ok ? 'connected' : 'disconnected');
      } catch {
        setConnectionStatus('disconnected');
      }
    };
    checkConnection();
    const interval = setInterval(checkConnection, 10000);
    return () => clearInterval(interval);
  }, []);

  // =============== AUTO-SAVE ===============
 const debouncedAutoSave = useRef(
  debounce(async (content) => {
    if (!currentFileName || content === undefined || isStreaming) {
      console.warn('🚫 Skip auto-save:', { currentFileName, content, isStreaming });
      return;
    }
    try {
      console.log('💾 Auto-saving:', currentFileName, 'Content length:', content.length);
      const res = await fetch(`${API_URL}/api/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: currentFileName, content })
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }
      console.log('✅ Auto-saved:', currentFileName);
    } catch (err) {
      console.error('⚠️ Auto-save failed for', currentFileName, err);
    }
  }, 1000)
);

  // =============== FILE OPERATIONS ===============
  const handleSaveFile = async (fileName) => {
    try {
      const res = await fetch(`${API_URL}/api/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: fileName, content: code })
      });
      const data = await res.json();
      if (data.success) {
        setOutput(prev => prev + `File saved: ${fileName}\n`);
        return true;
      }
      setOutput(prev => prev + `Failed to save file\n`);
      return false;
    } catch (err) {
      setOutput(prev => prev + `Error saving file: ${err.message}\n`);
      return false;
    }
  };

  // Called by FileManager (with content) and loadFileByName
  const handleLoadFile = async (fileName, content) => {
    setCode(content);
    setCurrentFileName(fileName);
    setOutput(prev => prev + `Loaded: ${fileName}\n`);

    if (!openFiles.includes(fileName)) {
      setOpenFiles(prev => [...prev, fileName]);
    }

    const extension = fileName.split('.').pop().toLowerCase();
    if (extension === 'html' || extension === 'htm') {
      setFileType('html');
    } else {
      setFileType('javascript');
    }
  };

  const handleDeleteFile = async (fileName) => {
    try {
      const res = await fetch(`${API_URL}/api/files/${fileName}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setOutput(prev => prev + `Deleted: ${fileName}\n`);
        setOpenFiles(prev => prev.filter(f => f !== fileName));
        if (currentFileName === fileName) {
          const remaining = openFiles.filter(f => f !== fileName);
          if (remaining.length > 0) {
            loadFileByName(remaining[0]);
          } else {
            setCurrentFileName('');
            setCode('');
          }
        }
        return true;
      }
      setOutput(prev => prev + `Failed to delete file\n`);
      return false;
    } catch (err) {
      setOutput(prev => prev + `Error deleting file: ${err.message}\n`);
      return false;
    }
  };

  // =============== LOAD FILE BY NAME (for tabs) ===============
  const loadFileByName = async (fileName) => {
    if (currentFileName === fileName) return;
    try {
      const res = await fetch(`${API_URL}/api/files/${fileName}`);
      if (!res.ok) throw new Error('File not found');
      const data = await res.json();
      handleLoadFile(fileName, data.content);
    } catch (err) {
      setOutput(prev => prev + `Error loading ${fileName}: ${err.message}\n`);
    }
  };

  const handleCloseTab = (fileName, e) => {
    e.stopPropagation();
    setOpenFiles(prev => prev.filter(f => f !== fileName));
    if (currentFileName === fileName) {
      const remaining = openFiles.filter(f => f !== fileName);
      if (remaining.length > 0) {
        loadFileByName(remaining[0]);
      } else {
        setCurrentFileName('');
        setCode('');
      }
    }
  };

  // =============== CODE CHANGE HANDLER ===============
  const handleCodeChange = (newCode) => {
    setCode(newCode);
    if (currentFileName && !isStreaming) {
      debouncedAutoSave.current(newCode);
    }
  };

  // =============== AI & RUN HANDLERS ===============
  const handleInlineExecution = async (lineIndex, instruction) => {
    if (loadingInline) return;
    setLoadingInline(true);
    setOutput(prev => prev + `\n> Processing: ${instruction}\n`);
    if (editorRef.current) {
      editorRef.current.startStreaming(lineIndex);
    }
    try {
      const res = await fetch(`${API_URL}/api/compile-streaming`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: instruction, 
          model,
          isInlinePrompt: true,
          codeType: fileType,
          fileName: currentFileName
        })
      });

      if (!res.body) throw new Error('Streaming not supported');

      const reader = res.body.getReader();
      let generatedCode = '';
      let finalCleanCode = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.token) {
                generatedCode += data.token;
                if (editorRef.current) {
                  editorRef.current.appendStreamingText(data.token);
                }
              }
              if (data.cleanCode !== undefined) {
                finalCleanCode = data.cleanCode;
              }
              if (data.done) break;
            } catch (e) {
              console.error('Parse error:', e);
            }
          }
        }
      }

      const cleanGeneratedCode = finalCleanCode !== null ? finalCleanCode : generatedCode.trim();
      const trulyCleanCode = cleanGeneratedCode
        .replace(/```(?:javascript|js|html|xml)?\s*([\s\S]*?)\s*```/gi, '$1')
        .replace(/^```[\s\S]*?```$/gm, '')
        .replace(/^```.*$/gm, '')
        .replace(/^.*```$/gm, '')
        .trim();

      const lines = code.split('\n');
      lines[lineIndex] = trulyCleanCode || cleanGeneratedCode;
      const newCode = lines.join('\n');

      if (editorRef.current) {
        editorRef.current.finishStreaming(newCode);
      }
      setCode(newCode);
      setOutput(prev => prev + `Generated: ${trulyCleanCode.length} characters\n`);
    } catch (err) {
      setOutput(prev => prev + `Error: ${err.message}\n`);
    }
    setLoadingInline(false);
  };

  const handleRun = async () => {
    if (fileType === 'html') {
      setShowHTMLPreview(true);
      setOutput(prev => prev + '\n--- HTML Preview Opened ---\n');
      return;
    }
    setLoadingRun(true);
    setOutput(prev => prev + '\n--- Running Code ---\n');
    try {
      const res = await fetch(`${API_URL}/api/run-js`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, userInput: userInputQueue })
      });
      const data = await res.json();
      setOutput(prev => prev + data.output + '\n');
      if (data.requiresInput && data.promptMessage) {
        setAwaitingInput(true);
        setPromptMessage(data.promptMessage);
      } else {
        setAwaitingInput(false);
        setUserInputQueue([]);
      }
    } catch (err) {
      setOutput(prev => prev + `Error: ${err.message}\n`);
    }
    setLoadingRun(false);
  };

  const handleAIFix = async () => {
    const selection = editorRef.current?.getModel()?.getValueInRange(editorRef.current.getSelection());
    const targetCode = selection || code;
    if (!targetCode.trim()) {
      setOutput(prev => prev + 'No code selected\n');
      return;
    }

    setLoadingAI(true);
    setIsStreaming(true);
    setStreamingCode('');
    setOutput(prev => prev + '🤖 AI is analyzing and streaming code...\n');
    abortControllerRef.current = new AbortController();

    try {
      const res = await fetch(`${API_URL}/api/compile-streaming`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          code: targetCode, 
          model,
          codeType: fileType,
          fileName: currentFileName
        }),
        signal: abortControllerRef.current.signal
      });

      if (!res.body) throw new Error('Streaming not supported');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedCode = '';
      let tokenCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          setIsStreaming(false);
          break;
        }
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.error) {
                setOutput(prev => prev + `❌ Error: ${data.error}\n`);
                setIsStreaming(false);
                setLoadingAI(false);
                return;
              }
              if (data.token) {
                accumulatedCode += data.token;
                tokenCount++;
                setStreamingCode(accumulatedCode);
                if (tokenCount % 50 === 0) {
                  setOutput(prev => {
                    const lines = prev.split('\n');
                    const lastLine = lines[lines.length - 1];
                    if (lastLine.startsWith('📊')) {
                      lines[lines.length - 1] = `📊 Streaming... ${tokenCount} tokens received`;
                      return lines.join('\n');
                    }
                    return prev + `📊 Streaming... ${tokenCount} tokens received\n`;
                  });
                }
              }
              if (data.done) {
                const finalCode = data.cleanCode || accumulatedCode.trim();
                const cleanedCode = finalCode
                  .replace(/```(?:javascript|js|html|xml)?\s*([\s\S]*?)\s*```/gi, '$1')
                  .replace(/^```[\s\S]*?```$/gm, '')
                  .replace(/^```.*$/gm, '')
                  .replace(/^.*```$/gm, '')
                  .trim();
                setCode(cleanedCode);
                setStreamingCode('');
                setIsStreaming(false);
                setOutput(prev => prev + `✅ AI complete! Generated ${cleanedCode.length} characters (${tokenCount} tokens)\n`);
                break;
              }
            } catch (parseErr) {
              console.error('Parse error:', parseErr);
            }
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setOutput(prev => prev + '⚠️ Streaming cancelled by user\n');
      } else {
        setOutput(prev => prev + `❌ Error: ${err.message}\n`);
      }
      setStreamingCode('');
      setIsStreaming(false);
    }
    setLoadingAI(false);
    abortControllerRef.current = null;
  };

  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
      setLoadingAI(false);
      setStreamingCode('');
      setOutput(prev => prev + '⏹️ Streaming stopped\n');
    }
  };

  const handleProcessInline = async () => {
    setLoadingInline(true);
    setOutput(prev => prev + 'Processing inline prompts...\n');
    try {
      const res = await fetch(`${API_URL}/api/process-inline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, model, fileName: currentFileName })
      });
      const data = await res.json();
      if (data.error) {
        setOutput(prev => prev + `Error: ${data.error}\n`);
      } else {
        setCode(data.processedCode);
        setOutput(prev => prev + `Processed ${data.changes.length} inline prompt(s)\n`);
      }
    } catch (err) {
      setOutput(prev => prev + `Error: ${err.message}\n`);
    }
    setLoadingInline(false);
  };

  const handleUserInput = (input) => {
    setUserInputQueue(prev => [...prev, input]);
    setAwaitingInput(false);
    setOutput(prev => prev + `> ${input}\n`);
    setTimeout(() => handleRun(), 100);
  };

  const handleFileTypeChange = (newType) => {
    setFileType(newType);
    setCode('');
    setOutput('');
    setCurrentFileName('');
    setOpenFiles([]);
  };

  const hasInlinePrompts = code.includes('xxx ');
  const canUseAI = code.trim().length > 0;

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh', 
      backgroundColor: '#1e1e1e',
      color: '#d4d4d4',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{ padding: '16px', borderBottom: '1px solid #333' }}>
        <Navbar
          onRun={handleRun}
          onAIFix={handleAIFix}
          onProcessInline={handleProcessInline}
          onClear={() => { 
            setCode(''); 
            setOutput(''); 
            setCurrentFileName(''); 
            setAwaitingInput(false);
            setUserInputQueue([]);
            setStreamingCode('');
            setIsStreaming(false);
            setOpenFiles([]);
            if (abortControllerRef.current) {
              abortControllerRef.current.abort();
            }
          }}
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
          connectionStatus={connectionStatus}
          fileType={fileType}
          onFileTypeChange={handleFileTypeChange}
          isStreaming={isStreaming}
          onStopStreaming={handleStopStreaming}
        />
      </div>

      {isStreaming && (
        <div style={{
          padding: '8px 16px',
          backgroundColor: '#264f78',
          color: '#fff',
          borderBottom: '1px solid #333',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '14px'
        }}>
          <div style={{
            width: '16px',
            height: '16px',
            border: '2px solid #fff',
            borderTop: '2px solid transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <span>AI is streaming code... Click Stop button to cancel</span>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <FileManager
          onLoad={handleLoadFile}
          onSave={handleSaveFile}
          onDelete={handleDeleteFile}
          currentFileName={currentFileName}
          setCurrentFileName={setCurrentFileName}
          fileType={fileType}
          setFileType={setFileType}
        />
        
        <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
          {openFiles.length > 0 && (
            <div style={{
              display: 'flex',
              backgroundColor: '#2d2d30',
              borderBottom: '1px solid #3e3e42',
              overflowX: 'auto'
            }}>
              {openFiles.map(fileName => (
                <div
                  key={fileName}
                  onClick={() => loadFileByName(fileName)} // ✅ FIXED: loads content
                  style={{
                    padding: '8px 16px',
                    backgroundColor: currentFileName === fileName ? '#1e1e1e' : 'transparent',
                    borderRight: '1px solid #3e3e42',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    color: currentFileName === fileName ? '#cccccc' : '#858585',
                    minWidth: '120px',
                    maxWidth: '200px'
                  }}
                >
                  <span style={{ 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis', 
                    whiteSpace: 'nowrap',
                    flex: 1
                  }}>
                    {fileName}
                  </span>
                  <button
                    onClick={(e) => handleCloseTab(fileName, e)}
                    style={{
                      padding: '2px',
                      backgroundColor: 'transparent',
                      color: '#858585',
                      border: 'none',
                      borderRadius: '2px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {currentFileName ? (
            <Editor
              height="100%"
              language={fileType === 'html' ? 'html' : 'javascript'}
              theme="vs-dark"
              value={isStreaming ? streamingCode : code}
              onChange={isStreaming ? null : handleCodeChange} // ✅ Correct
              onMount={(editor) => { editorRef.current = editor; }}
              onEnterKey={handleInlineExecution}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                readOnly: isStreaming
              }}
            />
          ) : (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: '16px',
              color: '#858585',
              fontSize: '14px'
            }}>
              <div style={{ fontSize: '48px' }}>📁</div>
              <div>No file selected</div>
              <div style={{ fontSize: '12px' }}>
                Click a file from the sidebar to start editing
              </div>
            </div>
          )}
        </div>
      </div>

      <Terminal
        output={output}
        awaitingInput={awaitingInput}
        promptMessage={promptMessage}
        onUserInput={handleUserInput}
        clearOutput={() => setOutput('')}
      />

      {showHTMLPreview && (
        <HTMLPreview 
          html={isStreaming ? streamingCode : code} 
          onClose={() => setShowHTMLPreview(false)}
        />
      )}
    </div>
  );
};

export default AICompiler;