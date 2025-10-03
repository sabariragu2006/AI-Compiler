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
  const [autoSave, setAutoSave] = useState(true);
  const [fileType, setFileType] = useState('js');
  const [output, setOutput] = useState('');
  const [model, setModel] = useState('qwen');
  const [autoProcessInline, setAutoProcessInline] = useState(true);
  const [loadingRun, setLoadingRun] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [loadingInline, setLoadingInline] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const [currentFileName, setCurrentFileName] = useState('');
  const [currentFilePath, setCurrentFilePath] = useState('');
  const [currentTerminalPath, setCurrentTerminalPath] = useState('/');
  const [userInputQueue, setUserInputQueue] = useState([]);
  const [awaitingInput, setAwaitingInput] = useState(false);
  const [promptMessage, setPromptMessage] = useState('');
  const [streamingCode, setStreamingCode] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [showHTMLPreview, setShowHTMLPreview] = useState(false);
  const [openFiles, setOpenFiles] = useState([]);
  const [htmlContent, setHtmlContent] = useState('');
  const [fileStructure, setFileStructure] = useState([]);

  const editorRef = useRef(null);
  const API_URL = 'http://localhost:5000';
  const abortControllerRef = useRef(null);

  // Helper to normalize paths (remove leading/trailing slashes)
  const normalizePath = (p) => {
    if (!p) return '';
    return p.replace(/^\/+|\/+$/g, '');
  };

  // CONNECTION CHECK
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

  // LOAD FILE STRUCTURE
  useEffect(() => {
    const loadFileStructure = async () => {
      try {
        const res = await fetch(`${API_URL}/api/files`);
        const data = await res.json();
        if (data.files) {
          setFileStructure(data.files);
        }
      } catch (err) {
        console.error('Error loading file structure:', err);
      }
    };
    loadFileStructure();
    const interval = setInterval(loadFileStructure, 5000);
    return () => clearInterval(interval);
  }, []);

  // AUTO-SAVE
  const debouncedAutoSave = useRef(
    debounce(async (content, filePath, shouldAutoSave) => {
      if (!shouldAutoSave || !filePath || content === undefined) {
        return;
      }
      try {
        const normalizedPath = normalizePath(filePath);
        const pathParts = normalizedPath.split('/');
        const fileName = pathParts.pop();
        const parentPath = pathParts.join('/');

        const res = await fetch(`${API_URL}/api/files`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: fileName, content, path: parentPath, type: 'file' })
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        console.log('✅ Auto-saved:', filePath);
      } catch (err) {
        console.error('⚠️ Auto-save failed for', filePath, err);
      }
    }, 1000)
  ).current;

  // Get items at terminal path
  const getItemsAtPath = (path) => {
    const normalizedPath = normalizePath(path);
    const items = [];
    const folders = new Set();

    fileStructure.forEach(item => {
      const itemPath = normalizePath(item.path || '');
      const itemDir = itemPath.includes('/') 
        ? itemPath.substring(0, itemPath.lastIndexOf('/')) 
        : '';

      if (item.type === 'folder' && itemDir === normalizedPath) {
        folders.add(item.name);
      } else if (item.type !== 'folder' && itemDir === normalizedPath) {
        items.push(item);
      }

      if (itemPath.startsWith(normalizedPath) && normalizedPath !== '') {
        const relativePath = itemPath.substring(normalizedPath.length + 1);
        const nextSlash = relativePath.indexOf('/');
        if (nextSlash > 0) {
          folders.add(relativePath.substring(0, nextSlash));
        }
      }
    });

    return { files: items, folders: Array.from(folders) };
  };

  // TERMINAL COMMAND HANDLER
  const handleTerminalCommand = async (input) => {
    const trimmedInput = input.trim();
    if (!trimmedInput) return;

    setOutput(prev => `${prev}${currentTerminalPath} $ ${input}\n`);

    if (trimmedInput === 'clear' || trimmedInput === 'cls') {
      setOutput('');
      return;
    }

    if (trimmedInput.startsWith('open ')) {
      const fileName = trimmedInput.substring(5).trim();
      if (!fileName) {
        setOutput(prev => `${prev}ERROR: Please specify a file name\n`);
        return;
      }

      const { files } = getItemsAtPath(currentTerminalPath);
      const file = files.find(f => f.name === fileName);
      
      if (file) {
        loadFileByPath(file.path);
        setOutput(prev => `${prev}✓ Opened ${fileName} in editor\n`);
      } else {
        setOutput(prev => `${prev}ERROR: File '${fileName}' not found\n`);
      }
      return;
    }

    try {
      setLoadingRun(true);

      const res = await fetch(`${API_URL}/api/terminal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: trimmedInput,
          userInput: userInputQueue,
          currentPath: currentTerminalPath,
          sessionId: 'user-session-1'
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        setOutput(prev => `${prev}ERROR: Unexpected response from server\n`);
        return;
      }

      const data = await res.json();

      if (data.success) {
        if (data.output && data.output.includes('[CLEAR]')) {
          setOutput('');
          return;
        }

        if (data.output && Array.isArray(data.output)) {
          const outputText = data.output.join('\n');
          if (outputText) {
            setOutput(prev => `${prev}${outputText}\n`);
          }
        }

        if (data.currentPath) {
          setCurrentTerminalPath(data.currentPath);
        }

        if (data.requiresInput && data.promptMessage) {
          setAwaitingInput(true);
          setPromptMessage(data.promptMessage);
        } else {
          setAwaitingInput(false);
          setPromptMessage('');
        }
      } else {
        const errorMsg = data.output ? data.output.join('\n') : 'Command failed';
        setOutput(prev => `${prev}${errorMsg}\n`);
      }
    } catch (err) {
      setOutput(prev => `${prev}ERROR: ${err.message}\n`);
    } finally {
      setLoadingRun(false);
    }
  };

  // FILE OPERATIONS
  const handleSaveFile = async (fileName) => {
    const finalPath = currentFilePath || fileName;
    if (!finalPath) {
      setOutput(prev => prev + "⚠️ Cannot save: No file path provided\n");
      return false;
    }

    try {
      const normalizedPath = normalizePath(finalPath);
      const pathParts = normalizedPath.split('/');
      const name = pathParts.pop();
      const parentPath = pathParts.join('/');

      const res = await fetch(`${API_URL}/api/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, content: code, path: parentPath, type: 'file' })
      });
      const data = await res.json();
      if (data.success) {
        setOutput(prev => prev + `✅ File saved: ${finalPath}\n`);
        return true;
      } else {
        setOutput(prev => prev + `❌ Failed to save file\n`);
        return false;
      }
    } catch (err) {
      setOutput(prev => prev + `⚠️ Error saving file: ${err.message}\n`);
      return false;
    }
  };

  const handleNewFolder = async () => {
    const folderName = prompt('Enter folder name:');
    if (!folderName) return;

    try {
      const res = await fetch(`${API_URL}/api/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: folderName, type: 'folder', path: '' })
      });
      const data = await res.json();
      if (data.success) {
        setOutput(prev => prev + `📁 Folder created: ${folderName}\n`);
      }
    } catch (err) {
      setOutput(prev => prev + `⚠️ Error creating folder: ${err.message}\n`);
    }
  };

  const handleNewFile = async () => {
    const fileName = prompt('Enter new file name (with extension, e.g., test.js):');
    if (!fileName || fileName.trim() === '') return;

    try {
      const res = await fetch(`${API_URL}/api/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: fileName, content: '', type: 'file', path: '' })
      });

      const data = await res.json();
      if (data.success) {
        setOutput(prev => prev + `✅ File created: ${fileName}\n`);
      } else {
        setOutput(prev => prev + `❌ Failed to create file: ${data.error || 'Unknown'}\n`);
      }
    } catch (err) {
      setOutput(prev => prev + `⚠️ Error creating file: ${err.message}\n`);
    }
  };

  const handleDeleteFile = async (filePath) => {
    try {
      const normalizedPath = normalizePath(filePath);
      const res = await fetch(`${API_URL}/api/files/${normalizedPath}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setOutput(prev => prev + `Deleted: ${filePath}\n`);
        setOpenFiles(prev => prev.filter(f => normalizePath(f.path) !== normalizedPath));
        if (normalizePath(currentFilePath) === normalizedPath) {
          const remaining = openFiles.filter(f => normalizePath(f.path) !== normalizedPath);
          if (remaining.length > 0) {
            loadFileByPath(remaining[0].path);
          } else {
            setCurrentFileName('');
            setCurrentFilePath('');
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

  // LOAD TERMINAL SESSION ON MOUNT
  useEffect(() => {
    const loadTerminalSession = async () => {
      try {
        const res = await fetch(`${API_URL}/api/terminal/session?sessionId=user-session-1`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.currentPath) {
            setCurrentTerminalPath(data.currentPath);
            console.log('✅ Restored terminal session:', data.currentPath);
          }
        }
      } catch (err) {
        console.error('⚠️ Could not load terminal session:', err);
        setCurrentTerminalPath('/');
      }
    };
    
    loadTerminalSession();
  }, []);

  // LOAD FILE BY PATH
  const loadFileByPath = async (filePath) => {
    const normalizedPath = normalizePath(filePath);
    if (normalizePath(currentFilePath) === normalizedPath) return;
    
    try {
      const res = await fetch(`${API_URL}/api/files/${normalizedPath}`);
      if (!res.ok) throw new Error('File not found');
      const data = await res.json();
      
      const fileName = normalizedPath.split('/').pop();
      handleLoadFile(fileName, data.content, normalizedPath);
    } catch (err) {
      setOutput(prev => prev + `Error loading ${filePath}: ${err.message}\n`);
    }
  };

  const handleCloseTab = (filePath, e) => {
    e.stopPropagation();
    const normalizedPath = normalizePath(filePath);
    setOpenFiles(prev => prev.filter(f => normalizePath(f.path) !== normalizedPath));
    if (normalizePath(currentFilePath) === normalizedPath) {
      const remaining = openFiles.filter(f => normalizePath(f.path) !== normalizedPath);
      if (remaining.length > 0) {
        loadFileByPath(remaining[0].path);
      } else {
        setCurrentFileName('');
        setCurrentFilePath('');
        setCode('');
      }
    }
  };

  const handleCodeChange = (newCode) => {
    setCode(newCode);
    if (autoSave && currentFilePath && !isStreaming) {
      debouncedAutoSave(newCode, currentFilePath, autoSave);
    }
  };

  const handleLoadFile = (fileName, content, fullPath) => {
    const normalizedPath = normalizePath(fullPath);
    setCurrentFileName(fileName);
    setCurrentFilePath(normalizedPath);
    setCode(content || '');
    
    if (!openFiles.find(f => normalizePath(f.path) === normalizedPath)) {
      setOpenFiles(prev => [...prev, { name: fileName, path: normalizedPath }]);
    }
  };

  useEffect(() => {
    return () => {
      if (debouncedAutoSave.cancel) {
        debouncedAutoSave.cancel();
      }
    };
  }, []);

  // AI & RUN HANDLERS (keeping your existing implementation)
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
      setHtmlContent(code);
      setShowHTMLPreview(true);
      setOutput(prev => prev + '\n--- HTML Preview Opened ---\n');
      return;
    }

    if (fileType === 'javascript' || fileType === 'js') {
      try {
        setLoadingRun(true);
        const res = await fetch(`${API_URL}/api/run-js`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, userInput: userInputQueue }),
        });
        const data = await res.json();
        
        if (data.output && Array.isArray(data.output)) {
          setOutput(prev => prev + data.output.join('\n') + '\n');
        } else if (data.output) {
          setOutput(prev => prev + (data.output || '') + '\n');
        }

        if (data.requiresInput && data.promptMessage) {
          setAwaitingInput(true);
          setPromptMessage(data.promptMessage);
        } else {
          setAwaitingInput(false);
          setPromptMessage('');
        }

        if (data.currentPath) {
          setCurrentTerminalPath(data.currentPath);
        }
      } catch (err) {
        setOutput(prev => prev + `\n[ERROR] ${err.message}\n`);
      } finally {
        setLoadingRun(false);
      }
      return;
    }

    setOutput(prev => prev + `\n[INFO] Run not supported for ${fileType}\n`);
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

  const handleFileTypeChange = (newType) => {
    setFileType(newType);
    setCode('');
    setOutput('');
    setCurrentFileName('');
    setCurrentFilePath('');
    setOpenFiles([]);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F5') {
        e.preventDefault();
        handleRun();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleAIFix();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [code, fileType, currentFileName]);

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
          onHTMLFileClick={handleRun}
          onAIFix={handleAIFix}
          onProcessInline={handleProcessInline}
          onClear={() => { 
            setCode(''); 
            setOutput(''); 
            setCurrentFileName(''); 
            setCurrentFilePath('');
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
          onNewFile={handleNewFile}
          onNewFolder={handleNewFolder}
          onSaveFile={handleSaveFile}
          onDeleteFile={handleDeleteFile}
          onFileTypeChange={handleFileTypeChange}
          autoSave={autoSave}
          setAutoSave={setAutoSave}
          currentFileName={currentFileName}
          fileType={fileType}
          setFileType={setFileType}
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
          onNewFolder={handleNewFolder}
          currentFileName={currentFileName}
          setCurrentFileName={setCurrentFileName}
          fileType={fileType}
          setFileType={setFileType}
          onSaveFile={handleSaveFile}
          onLoadFile={handleLoadFile}
        />

        <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
          {openFiles.length > 0 && (
            <div style={{
              display: 'flex',
              backgroundColor: '#2d2d30',
              borderBottom: '1px solid #3e3e42',
              overflowX: 'auto'
            }}>
              {openFiles.map(file => {
                const normalizedFilePath = normalizePath(file.path);
                const normalizedCurrentPath = normalizePath(currentFilePath);
                const isActive = normalizedFilePath === normalizedCurrentPath;
                
                return (
                  <div
                    key={normalizedFilePath}
                    onClick={() => loadFileByPath(file.path)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: isActive ? '#1e1e1e' : 'transparent',
                      borderRight: '1px solid #3e3e42',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '13px',
                      color: isActive ? '#cccccc' : '#858585',
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
                      {file.name}
                    </span>
                    <button
                      onClick={(e) => handleCloseTab(file.path, e)}
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
                );
              })}
            </div>
          )}

          {currentFileName ? (
            <Editor
              height="100%"
              language={fileType === 'html' ? 'html' : 'javascript'}
              theme="vs-dark"
              value={isStreaming ? streamingCode : code}
              onChange={isStreaming ? null : handleCodeChange}
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
        onCommand={handleTerminalCommand}
        clearOutput={() => setOutput('')}
        currentFilePath={currentTerminalPath}
        fileStructure={fileStructure}
      />

      {showHTMLPreview && (
        <HTMLPreview 
          fileName={currentFileName} 
          html={htmlContent}
          path={currentFilePath}
          onClose={() => setShowHTMLPreview(false)} 
        />
      )}
    </div>
  );
};

export default AICompiler;