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
  const [activeProject, setActiveProject] = useState(null);
  const [output, setOutput] = useState([]);
  const [model, setModel] = useState('qwen');
  const [autoProcessInline, setAutoProcessInline] = useState(true);
  const [loadingRun, setLoadingRun] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const [currentFileName, setCurrentFileName] = useState('');
  const [currentFilePath, setCurrentFilePath] = useState('');
  const [currentTerminalPath, setCurrentTerminalPath] = useState('/');
  const [userInputQueue, setUserInputQueue] = useState([]);
  const [awaitingInput, setAwaitingInput] = useState(false);
  const [promptMessage, setPromptMessage] = useState('');
  const [showHTMLPreview, setShowHTMLPreview] = useState(false);
  const [openFiles, setOpenFiles] = useState([]);
  const [htmlContent, setHtmlContent] = useState('');
  const [fileStructure, setFileStructure] = useState([]);
  const [refreshFileManager, setRefreshFileManager] = useState(0);
  const [aiMode, setAiMode] = useState('local');
  const [loadingInitial, setLoadingInitial] = useState(true);

  // ✅ AI Progress State
  const [aiProgress, setAiProgress] = useState({
    active: false,
    current: 0,
    total: 0,
    message: ''
  });

  const editorRef = useRef(null);
  const API_URL = 'http://localhost:5000';
  const userId = 'defaultUser';
  const aiModeRef = useRef(aiMode);
  const modelRef = useRef(model);
  const activeProjectRef = useRef(activeProject);

  useEffect(() => {
    aiModeRef.current = aiMode;
  }, [aiMode]);

  useEffect(() => {
    modelRef.current = model;
  }, [model]);

  useEffect(() => {
    activeProjectRef.current = activeProject;
  }, [activeProject]);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        let project = null;
        try {
          const res = await fetch(`${API_URL}/api/user/${userId}/state`);
          if (res.ok) {
            const state = await res.json();
            if (state.lastActiveProject) {
              setActiveProject(state.lastActiveProject);
              localStorage.setItem('activeProject', state.lastActiveProject);
              project = state.lastActiveProject;
            }
          }
        } catch (err) {
          console.warn('Could not load user state');
        }

        if (!project) {
          const saved = localStorage.getItem('activeProject');
          if (saved) {
            setActiveProject(saved);
            project = saved;
          }
        }

        activeProjectRef.current = project;

        if (project) {
          try {
            const res = await fetch(`${API_URL}/api/projects/${project}/files`);
            if (res.ok) {
              const data = await res.json();
              setFileStructure(data);
            }
          } catch (err) {
            console.error('Error loading file structure:', err);
          }

          try {
            const res = await fetch(`${API_URL}/api/terminal/session?sessionId=user-session-1&projectId=${project}`);
            if (res.ok) {
              const data = await res.json();
              if (data.success && data.currentPath) {
                setCurrentTerminalPath(data.currentPath);
              }
            }
          } catch (err) {
            console.error('Could not load terminal session:', err);
          }
        }
      } finally {
        setLoadingInitial(false);
      }
    };

    initializeApp();
  }, []);

  useEffect(() => {
    if (!activeProject) return;
    const saveState = async () => {
      try {
        await fetch(`${API_URL}/api/user/${userId}/state`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lastActiveProject: activeProject })
        });
        localStorage.setItem('activeProject', activeProject);
      } catch (err) {
        console.error('Failed to save user state:', err);
        localStorage.setItem('activeProject', activeProject);
      }
    };
    const timeout = setTimeout(saveState, 300);
    return () => clearTimeout(timeout);
  }, [activeProject]);

  useEffect(() => {
    if (aiMode === 'cloud') {
      setModel(prevModel => {
        if (prevModel === 'qwen' || prevModel === 'deepseek') {
          return 'gemini';
        }
        return prevModel;
      });
    } else if (aiMode === 'local') {
      setModel(prevModel => {
        if (prevModel === 'huggingface' || prevModel === 'gemini') {
          return 'qwen';
        }
        return prevModel;
      });
    }
  }, [aiMode]);

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

  const normalizePath = (p) => {
    if (!p) return '';
    return p.replace(/^\/+|\/+$/g, '');
  };

  const getLanguageFromExtension = (filename) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const map = {
      'html': 'html',
      'htm': 'html',
      'css': 'css',
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'javascript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c'
    };
    return map[ext] || 'javascript';
  };

const handleInlineCommand = async (lineNumber, instruction) => {
  try {
    setOutput(prev => [...prev, `🤖 Processing inline command: ${instruction}`]);

    // ✅ Ensure model is one of: 'qwen', 'deepseek', 'gemini'
    let effectiveModel = 'qwen';
    if (aiModeRef.current === 'cloud') {
      effectiveModel = 'gemini';
    } else {
      const current = modelRef.current;
      if (current === 'qwen' || current === 'deepseek') {
        effectiveModel = current;
      }
    }

    const response = await fetch(`${API_URL}/api/process-inline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        model: effectiveModel, // ✅ GUARANTEED VALID
        projectId: activeProject,
        filePath: currentFilePath,
        codeType: fileType,
        aiMode: aiModeRef.current,
        instruction,
        lineNumber
      })
    });

    const data = await response.json();
    if (data.processedCode) {
      setCode(data.processedCode);
      setOutput(prev => [...prev, `✅ Inline edit applied and saved`]);
    } else {
      setOutput(prev => [...prev, `❌ Inline edit failed: ${data.error || 'Unknown error'}`]);
    }
  } catch (err) {
    setOutput(prev => [...prev, `❌ Error: ${err.message}`]);
  }
};

  const debouncedAutoSave = useRef(
    debounce(async (content, filePath, shouldAutoSave) => {
      const currentProject = activeProjectRef.current;
      if (!shouldAutoSave || !filePath || content === undefined || !currentProject) return;
      try {
        const normalizedPath = normalizePath(filePath);
        const pathParts = normalizedPath.split('/');
        const fileName = pathParts.pop();
        const parentPath = pathParts.join('/');
        await fetch(`${API_URL}/api/files`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            name: fileName, 
            content, 
            path: parentPath, 
            type: 'file',
            projectId: currentProject
          })
        });
        setRefreshFileManager(prev => prev + 1);
      } catch (err) {
        console.error('Auto-save failed:', err);
      }
    }, 1000)
  ).current;

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

const handleTerminalCommand = async (input) => {
  const trimmedInput = input.trim();
  if (!trimmedInput) return;

  setOutput(prev => [...prev, `${currentTerminalPath} $ ${input}`]);

  // --- Built-in Commands ---
  if (trimmedInput === 'clear' || trimmedInput === 'cls') {
    setOutput([]);
    return;
  }

  if (trimmedInput.startsWith('open ')) {
    const fileName = trimmedInput.substring(5).trim();
    if (!fileName) {
      setOutput(prev => [...prev, "ERROR: Please specify a file name"]);
      return;
    }
    const { files } = getItemsAtPath(currentTerminalPath);
    const file = files.find(f => f.name === fileName);
    if (file) {
      loadFileByPath(file.path);
      setOutput(prev => [...prev, `✓ Opened ${fileName} in editor`]);
    } else {
      setOutput(prev => [...prev, `ERROR: File '${fileName}' not found`]);
    }
    return;
  }

  // --- AI Commands (xxx ...) ---
  if (trimmedInput.toLowerCase().startsWith('xxx ')) {
    if (!activeProject) {
      setOutput(prev => [...prev, "⚠️ Please select or create a project first"]);
      return;
    }

    const promptText = trimmedInput.substring(4).trim();

    // ✅ CRITICAL: Determine context
    const hasOpenFileWithCode = currentFilePath && code && code.trim().length > 0;
    const isProjectLevelPrompt = !hasOpenFileWithCode && /^(create|generate|build|make|scaffold)/i.test(promptText);

    // ➡️ PROJECT GENERATION (no file open + creation intent)
    if (isProjectLevelPrompt) {
      setAiProgress({ active: true, current: 0, total: 0, message: 'Generating project...' });

      try {
        const response = await fetch(`${API_URL}/api/generate-project`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: promptText })
        });

        const data = await response.json();

        if (data.success && data.project?.files) {
          const { files } = data.project;

          // Save all files
          for (const file of files) {
            const normalizedPath = normalizePath(file.path);
            const pathParts = normalizedPath.split('/');
            const name = pathParts.pop();
            const parentPath = pathParts.join('/');

            await fetch(`${API_URL}/api/files`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name,
                content: file.content || '',
                path: parentPath,
                type: 'file',
                projectId: activeProjectRef.current
              })
            });
          }

          // Refresh file structure
          const res = await fetch(`${API_URL}/api/projects/${activeProjectRef.current}/files`);
          if (res.ok) {
            const updatedFiles = await res.json();
            setFileStructure(updatedFiles);
            setRefreshFileManager(prev => prev + 1);
          }

          // Auto-open main file
          const mainFile = files.find(f =>
            f.path === 'index.html' ||
            f.path === 'src/main.jsx' ||
            f.path === 'src/App.jsx'
          );

          if (mainFile) {
            loadFileByPath(mainFile.path);
          } else if (files[0]) {
            loadFileByPath(files[0].path);
          }

          setOutput(prev => [...prev, `✅ Generated ${files.length} files for your project!`]);
        } else {
          setOutput(prev => [...prev, `❌ Failed to generate project: ${data.error || 'Unknown error'}`]);
        }
      } catch (err) {
        setOutput(prev => [...prev, `❌ Project generation error: ${err.message}`]);
      } finally {
        setAiProgress({ active: false, current: 0, total: 0, message: '' });
      }

      return; // ✅ Exit early
    }

    // ➡️ INLINE EDIT (only if a real file is open)
    if (!hasOpenFileWithCode) {
      setOutput(prev => [...prev, "⚠️ Open a file with code first to use inline AI commands."]);
      return;
    }

    // Proceed with inline edit
    setOutput(prev => [...prev, `🤖 Processing inline command: ${promptText}`]);

    let effectiveModel = 'qwen';
    if (aiModeRef.current === 'cloud') {
      effectiveModel = 'gemini';
    } else {
      const current = modelRef.current;
      if (current === 'qwen' || current === 'deepseek') {
        effectiveModel = current;
      }
    }

    try {
      const response = await fetch(`${API_URL}/api/process-inline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          model: effectiveModel,
          projectId: activeProject,
          filePath: currentFilePath,
          codeType: fileType,
          aiMode: aiModeRef.current,
          instruction: promptText
        })
      });

      const data = await response.json();
      if (data.processedCode) {
        setCode(data.processedCode);
        setOutput(prev => [...prev, `✅ Inline edit applied and saved`]);
      } else {
        setOutput(prev => [...prev, `❌ Inline edit failed: ${data.error || 'Unknown error'}`]);
      }
    } catch (err) {
      setOutput(prev => [...prev, `❌ Error: ${err.message}`]);
    }

    return;
  }

  // --- Regular Terminal Commands (run, etc.) ---
  try {
    setLoadingRun(true);
    const res = await fetch(`${API_URL}/api/terminal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        command: trimmedInput,
        userInput: userInputQueue,
        currentPath: currentTerminalPath,
        sessionId: 'user-session-1',
        projectId: activeProject
      }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      setOutput(prev => [...prev, "ERROR: Unexpected response from server"]);
      return;
    }

    const data = await res.json();
    if (data.success) {
      if (data.output && data.output.includes('[CLEAR]')) {
        setOutput([]);
        return;
      }
      if (data.output && Array.isArray(data.output)) {
        setOutput(prev => [...prev, ...data.output]);
      }
      if (data.currentPath) setCurrentTerminalPath(data.currentPath);
      if (data.requiresInput && data.promptMessage) {
        setAwaitingInput(true);
        setPromptMessage(data.promptMessage);
      } else {
        setAwaitingInput(false);
        setPromptMessage('');
      }
    } else {
      const errorMsg = data.output && Array.isArray(data.output)
        ? data.output
        : ['Command failed'];
      setOutput(prev => [...prev, ...errorMsg]);
    }
  } catch (err) {
    setOutput(prev => [...prev, `ERROR: ${err.message}`]);
  } finally {
    setLoadingRun(false);
  }
};

  const handleSaveFile = async (fileName) => {
    if (!activeProject) {
      setOutput(prev => [...prev, "⚠️ Please select a project first"]);
      return false;
    }
    const finalPath = currentFilePath || fileName;
    if (!finalPath) {
      setOutput(prev => [...prev, "⚠️ Cannot save: No file path provided"]);
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
        body: JSON.stringify({ 
          name, 
          content: code, 
          path: parentPath, 
          type: 'file',
          projectId: activeProject
        })
      });
      const data = await res.json();
      if (data.success) {
        setOutput(prev => [...prev, `✅ File saved: ${finalPath}`]);
        return true;
      } else {
        setOutput(prev => [...prev, "❌ Failed to save file"]);
        return false;
      }
    } catch (err) {
      setOutput(prev => [...prev, `⚠️ Error saving file: ${err.message}`]);
      return false;
    }
  };

  

  const handleNewFolder = async () => {
    if (!activeProject) {
      alert('Please select or create a project first!');
      return;
    }
    const folderName = prompt('Enter folder name:');
    if (!folderName) return;
    try {
      const res = await fetch(`${API_URL}/api/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: folderName, 
          type: 'folder', 
          path: '',
          projectId: activeProject
        })
      });
      const data = await res.json();
      if (data.success) {
        setOutput(prev => [...prev, `📁 Folder created: ${folderName}`]);
        setRefreshFileManager(prev => prev + 1);
      }
    } catch (err) {
      setOutput(prev => [...prev, `⚠️ Error creating folder: ${err.message}`]);
    }
  };

  const handleNewFile = async () => {
    if (!activeProject) {
      alert('Please select or create a project first!');
      return;
    }
    const fileName = prompt('Enter new file name (with extension, e.g., test.js):');
    if (!fileName || fileName.trim() === '') return;
    try {
      const res = await fetch(`${API_URL}/api/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: fileName, 
          content: '', 
          type: 'file', 
          path: '',
          projectId: activeProject
        })
      });
      const data = await res.json();
      if (data.success) {
        setOutput(prev => [...prev, `✅ File created: ${fileName}`]);
        setRefreshFileManager(prev => prev + 1);
        const lang = getLanguageFromExtension(fileName);
        setCurrentFileName(fileName);
        setCurrentFilePath(fileName);
        setFileType(lang);
        setCode('');
        setOpenFiles(prev => {
          const exists = prev.find(f => normalizePath(f.path) === normalizePath(fileName));
          if (!exists) {
            return [...prev, { name: fileName, path: fileName }];
          }
          return prev;
        });
      } else {
        setOutput(prev => [...prev, `❌ Failed to create file: ${data.error || 'Unknown'}`]);
      }
    } catch (err) {
      setOutput(prev => [...prev, `⚠️ Error creating file: ${err.message}`]);
    }
  };

  const handleDeleteFile = async (filePath) => {
    try {
      const normalizedPath = normalizePath(filePath);
      const res = await fetch(`${API_URL}/api/files/${normalizedPath}?projectId=${activeProject}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setOutput(prev => [...prev, `Deleted: ${filePath}`]);
        setOpenFiles(prev => prev.filter(f => normalizePath(f.path) !== normalizedPath));
        setRefreshFileManager(prev => prev + 1);
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
      setOutput(prev => [...prev, "Failed to delete file"]);
      return false;
    } catch (err) {
      setOutput(prev => [...prev, `Error deleting file: ${err.message}`]);
      return false;
    }
  };

  const loadFileByPath = async (filePath) => {
    if (!activeProject) return;
    const normalizedPath = normalizePath(filePath);
    if (normalizePath(currentFilePath) === normalizedPath) return;
    try {
      const res = await fetch(`${API_URL}/api/files/${encodeURIComponent(normalizedPath)}?projectId=${activeProject}`);
      if (!res.ok) throw new Error('File not found');
      const data = await res.json();
      const fileName = normalizedPath.split('/').pop();
      const lang = getLanguageFromExtension(fileName);
      handleLoadFile(fileName, data.content, normalizedPath, lang);
    } catch (err) {
      setOutput(prev => [...prev, `Error loading ${filePath}: ${err.message}`]);
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
    const normalizedPath = currentFilePath ? normalizePath(currentFilePath) : '';
    if (autoSave && normalizedPath && activeProject) {
      debouncedAutoSave(newCode, normalizedPath, autoSave);
    }
  };

  const handleLoadFile = (fileName, content, fullPath, language) => {
    const normalizedPath = normalizePath(fullPath);
    setCurrentFileName(fileName);
    setCurrentFilePath(normalizedPath);
    setFileType(language || getLanguageFromExtension(fileName));
    setCode(content || '');
    if (!openFiles.find(f => normalizePath(f.path) === normalizedPath)) {
      setOpenFiles(prev => [...prev, { name: fileName, path: normalizedPath }]);
    }
  };

  const handleRun = async () => {
    if (!activeProject) {
      setOutput(prev => [...prev, "⚠️ Please select a project first"]);
      return;
    }
    if (fileType === 'html') {
      setHtmlContent(code);
      setShowHTMLPreview(true);
      setOutput(prev => [...prev, '', '--- HTML Preview Opened ---', '']);
      return;
    }
    if (fileType === 'javascript' || fileType === 'js') {
      try {
        setLoadingRun(true);
        const res = await fetch(`${API_URL}/api/run-js`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            code, 
            userInput: userInputQueue,
            currentPath: currentTerminalPath,
            currentFile: currentFileName,
            projectId: activeProject
          }),
        });
        const data = await res.json();
        if (data.output && Array.isArray(data.output)) {
          setOutput(prev => [...prev, ...data.output]);
        } else if (data.output) {
          setOutput(prev => [...prev, data.output]);
        }
        if (data.navigationTarget) {
          const targetFile = data.navigationTarget;
          if (targetFile === currentFileName && fileType === 'html') {
            setHtmlContent(code);
            setShowHTMLPreview(true);
            setOutput(prev => [...prev, `🔄 Reloaded: ${targetFile}`]);
            return;
          }
          const { files } = getItemsAtPath(currentTerminalPath);
          let foundFile = files.find(f => f.name === targetFile);
          if (!foundFile) {
            foundFile = fileStructure.find(f => 
              f.type !== 'folder' && 
              f.name === targetFile
            );
          }
          if (foundFile) {
            setOutput(prev => [...prev, `🔗 Navigating to: ${targetFile}`]);
            await loadFileByPath(foundFile.path);
            if (targetFile.endsWith('.html')) {
              try {
                const fileRes = await fetch(`${API_URL}/api/files/${normalizePath(foundFile.path)}?projectId=${activeProject}`);
                if (fileRes.ok) {
                  const fileData = await fileRes.json();
                  setHtmlContent(fileData.content);
                  setShowHTMLPreview(true);
                  setOutput(prev => [...prev, `📄 Opened HTML preview for: ${targetFile}`]);
                }
              } catch (err) {
                setOutput(prev => [...prev, `⚠️ Could not preview: ${err.message}`]);
              }
            }
          } else {
            setOutput(prev => [...prev, 
              `⚠️ Navigation failed: "${targetFile}" not found`,
              `💡 Tip: Make sure the file exists in your project`
            ]);
          }
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
        setOutput(prev => [...prev, `[ERROR] ${err.message}`]);
      } finally {
        setLoadingRun(false);
      }
      return;
    }
    setOutput(prev => [...prev, `[INFO] Run not supported for ${fileType}`]);
  };

  const handleAIFix = async () => {
    const currentAiMode = aiModeRef.current;
    const currentModel = modelRef.current;
    console.log("handleAIFix executing with aiMode:", currentAiMode, "model:", currentModel);
    if (!activeProject || !currentFilePath) {
      setOutput(prev => [...prev, "⚠️ Open a file before using AI Fix"]);
      return;
    }
    const selection = editorRef.current?.getModel()?.getValueInRange(editorRef.current.getSelection());
    const targetCode = selection || code;
    if (!targetCode.trim()) {
      setOutput(prev => [...prev, 'No code selected']);
      return;
    }
    setOutput(prev => [...prev, `🤖 AI Fix started (Mode: ${currentAiMode}, Model: ${currentModel})`]);
    try {
      let effectiveModel = currentModel;
      if (currentAiMode === 'cloud') {
        if (currentModel !== 'huggingface' && currentModel !== 'gemini') {
          effectiveModel = 'gemini';
          setOutput(prev => [...prev, `🤖 Using cloud default model: ${effectiveModel}`]);
        }
      } else if (currentAiMode === 'local') {
        if (currentModel !== 'qwen' && currentModel !== 'deepseek') {
          effectiveModel = 'qwen';
          setOutput(prev => [...prev, `🤖 Using local default model: ${effectiveModel}`]);
        }
      }
      setOutput(prev => [...prev, `🤖 Using non-streaming endpoint for ${effectiveModel}...`]);
      const res = await fetch(`${API_URL}/api/compile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          code: targetCode, 
          model: effectiveModel,
          codeType: fileType,
          fileName: currentFileName,
          projectId: activeProject,
          aiMode: currentAiMode
        })
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const cleanedCode = data.code
        .replace(/```(?:javascript|js|html|xml)?\s*([\s\S]*?)\s*```/gi, '$1')
        .replace(/^```[\s\S]*?```$/gm, '')
        .replace(/^```.*$/gm, '')
        .replace(/^.*```$/gm, '')
        .trim();
      setCode(cleanedCode);
      const normalizedPath = normalizePath(currentFilePath);
      const pathParts = normalizedPath.split('/');
      const fileName = pathParts.pop();
      const parentPath = pathParts.join('/');
      try {
        const saveRes = await fetch(`${API_URL}/api/files`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            name: fileName, 
            content: cleanedCode, 
            path: parentPath, 
            type: 'file',
            projectId: activeProject
          })
        });
        const saveData = await saveRes.json();
        if (saveData.success) {
          setOutput(prev => [...prev, `✅ AI fix applied and saved`]);
        } else {
          setOutput(prev => [...prev, `⚠️ AI fix applied but failed to save`]);
        }
      } catch (saveErr) {
        console.error('Save failed:', saveErr);
        setOutput(prev => [...prev, `⚠️ Failed to save AI result: ${saveErr.message}`]);
      }
      setOutput(prev => [...prev, `✅ Non-streaming AI complete! Generated ${cleanedCode.length} characters`]);
    } catch (err) {
      setOutput(prev => [...prev, `❌ Error: ${err.message}`]);
    }
  };

  const handleFileTypeChange = (newType) => {
    setFileType(newType);
    setCode('');
    setOutput([]);
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
  }, [code, fileType, currentFileName, activeProject]);

  const hasInlinePrompts = code.includes('xxx ');
  const canUseAI = code.trim().length > 0;

  const processInlinePrompts = async () => {
    if (!hasInlinePrompts) return;
    const lines = code.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith('xxx ')) {
        const instruction = line.substring(4).trim();
        if (instruction) {
          await handleInlineCommand(i + 1, instruction);
          return;
        }
      }
    }
  };

  if (loadingInitial) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#1e1e1e',
        color: '#d4d4d4',
        fontSize: '18px',
        fontFamily: 'system-ui, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚙️</div>
          <div>Loading AI Compiler...</div>
        </div>
      </div>
    );
  }

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
          onProcessInline={processInlinePrompts}
          onClear={() => { 
            setCode(''); 
            setOutput([]); 
            setCurrentFileName(''); 
            setCurrentFilePath('');
            setAwaitingInput(false);
            setUserInputQueue([]);
            setOpenFiles([]);
          }}
          model={model}
          onModelChange={setModel}
          autoProcessInline={autoProcessInline}
          onAutoProcessChange={setAutoProcessInline}
          loadingRun={loadingRun}
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
          onProjectChange={setActiveProject}
          activeProject={activeProject}
          aiMode={aiMode}
          onAiModeChange={setAiMode}
        />
      </div>
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
          activeProject={activeProject}
          refreshTrigger={refreshFileManager}
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
            <div style={{ position: 'relative', height: '100%' }}>
              <Editor
                height="100%"
                language={fileType === 'html' ? 'html' : 'javascript'}
                theme="vs-dark"
                value={code}
                onChange={handleCodeChange}
                onMount={(editor) => { editorRef.current = editor; }}
                onEnterKey={handleInlineCommand}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  readOnly: false
                }}
              />
            </div>
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
              <div>{activeProject ? 'No file selected' : 'No project selected'}</div>
              <div style={{ fontSize: '12px' }}>
                {activeProject 
                  ? 'Click a file from the sidebar or use: xxx create code for filename'
                  : 'Create or select a project to get started'
                }
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ✅ PROGRESS BAR */}
      {aiProgress.active && (
        <div style={{
          padding: '6px 16px',
          backgroundColor: '#2d2d30',
          borderBottom: '1px solid #3e3e42',
          fontSize: '13px',
          color: '#cccccc'
        }}>
          <div style={{ marginBottom: '4px' }}>{aiProgress.message}</div>
          <div style={{
            height: '6px',
            backgroundColor: '#3e3e42',
            borderRadius: '3px',
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              width: `${(aiProgress.current / aiProgress.total) * 100}%`,
              backgroundColor: '#007acc',
              transition: 'width 0.2s ease'
            }} />
          </div>
        </div>
      )}

      <Terminal
        output={output}
        awaitingInput={awaitingInput}
        promptMessage={promptMessage}
        onCommand={handleTerminalCommand}
        clearOutput={() => setOutput([])}
        currentFilePath={currentTerminalPath}
        fileStructure={fileStructure}
      />
      {showHTMLPreview && (
        <HTMLPreview 
          fileName={currentFileName} 
          html={htmlContent}
          path={currentFilePath}
          apiUrl={API_URL}
          initialPath={currentTerminalPath}
          activeProject={activeProject}
          onClose={() => setShowHTMLPreview(false)} 
        />
      )}
    </div>
  );
};

export default AICompiler;