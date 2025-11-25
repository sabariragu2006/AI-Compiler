import React, { useState, useEffect, useRef } from 'react';
import { Play, Bot, Zap, Settings, Trash2, Save, Plus, FolderPlus, Cloud, Lock } from 'lucide-react';

const Navbar = ({
  onRun,
  onAIFix,
  onProcessInline,
  onClear,
  model,
  onModelChange,
  autoProcessInline,
  onAutoProcessChange,
  loadingRun,
  loadingAI,
  loadingInline,
  canUseAI,
  hasInlinePrompts,
  awaitingInput,
  connectionStatus,
  onNewFile,
  onNewFolder,
  onSave,
  autoSave,
  setAutoSave,
  currentFileName,
  fileType,
  setFileType,
  fileManager,
  onHTMLFileClick,
  onProjectChange,
  aiMode,          // ✅ NEW: 'local' or 'cloud'
  onAiModeChange,  // ✅ NEW
}) => {
  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
  const [isAiMenuOpen, setIsAiMenuOpen] = useState(false); // ✅ NEW
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [isOpenProjectModalOpen, setIsOpenProjectModalOpen] = useState(false);
  const [projectNameInput, setProjectNameInput] = useState('');
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const fileMenuRef = useRef(null);
  const viewMenuRef = useRef(null);
  const aiMenuRef = useRef(null); // ✅ NEW

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (fileMenuRef.current && !fileMenuRef.current.contains(event.target)) {
        setIsFileMenuOpen(false);
      }
      if (viewMenuRef.current && !viewMenuRef.current.contains(event.target)) {
        setIsViewMenuOpen(false);
      }
      if (aiMenuRef.current && !aiMenuRef.current.contains(event.target)) {
        setIsAiMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadProjects = async () => {
    setLoadingProjects(true);
    try {
      const res = await fetch('http://localhost:5000/api/projects');
      const data = await res.json();
      setProjects(data);
    } catch (err) {
      console.error('Failed to load projects:', err);
      setProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleMenuClick = (action) => {
    switch(action) {
      case 'newFile': onNewFile(); break;
      case 'newFolder': onNewFolder(); break;
      case 'saveFile': onSave(currentFileName); break;
      default: console.warn('Unknown menu action:', action);
    }
  };

  const handleFileTypeChange = (type) => {
    setFileType && setFileType(type);
    setIsViewMenuOpen(false);
  };

  // ✅ Get available models based on AI mode
  const getModelOptions = () => {
    if (aiMode === 'cloud') {
      return [
        { value: 'gemini', label: 'Gemini Pro (Cloud)' } // Changed value and label
      ];
    }
    return [
      { value: 'qwen', label: 'Qwen2.5-Coder (Local)' },
      { value: 'deepseek', label: 'DeepSeek-Coder (Local)' }
    ];
  };

  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{
        width: '100%',
        height: '35px',
        backgroundColor: '#2d2d30',
        borderBottom: '1px solid #3e3e42',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        position: 'relative',
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          {/* File Menu */}
          <div ref={fileMenuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => {
                setIsFileMenuOpen(!isFileMenuOpen);
                setIsViewMenuOpen(false);
                setIsAiMenuOpen(false);
              }}
              style={{
                background: isFileMenuOpen ? '#3e3e42' : 'transparent',
                border: 'none',
                color: '#cccccc',
                fontSize: '13px',
                fontWeight: '400',
                padding: '6px 10px',
                cursor: 'pointer',
                borderRadius: '3px',
                transition: 'background-color 0.2s',
              }}
            >
              File
            </button>
            {isFileMenuOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '2px',
                backgroundColor: '#252526',
                border: '1px solid #454545',
                borderRadius: '4px',
                overflow: 'hidden',
                zIndex: 1000,
                minWidth: '200px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
              }}>
                <MenuItem
                  label="New Project..."
                  onClick={() => {
                    setIsFileMenuOpen(false);
                    setIsNewProjectModalOpen(true);
                  }}
                />
                <MenuItem
                  label="Open Project..."
                  onClick={() => {
                    setIsFileMenuOpen(false);
                    loadProjects();
                    setIsOpenProjectModalOpen(true);
                  }}
                />
                <MenuDivider />
                <MenuItem
                  icon={<Plus size={14} />}
                  label="New File"
                  shortcut="Ctrl+N"
                  onClick={() => handleMenuClick('newFile')}
                />
                <MenuItem
                  icon={<FolderPlus size={14} />}
                  label="New Folder"
                  shortcut="Ctrl+Shift+N"
                  onClick={() => handleMenuClick('newFolder')}
                />
                <MenuDivider />
                <MenuItem
                  icon={<Save size={14} />}
                  label="Save"
                  shortcut="Ctrl+S"
                  onClick={() => handleMenuClick('saveFile')}
                />
                <MenuDivider />
                <MenuItem
                  label="Auto Save"
                  onClick={() => setAutoSave(!autoSave)}
                  rightElement={
                    <input
                      type="checkbox"
                      checked={autoSave}
                      onChange={(e) => setAutoSave(e.target.checked)} // ✅ fixed
                      style={{ cursor: 'pointer', accentColor: '#0e639c' }}
                    />
                  }
                />
              </div>
            )}
          </div>

          {/* View Menu */}
          <div ref={viewMenuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => {
                setIsViewMenuOpen(!isViewMenuOpen);
                setIsFileMenuOpen(false);
                setIsAiMenuOpen(false);
              }}
              style={{
                background: isViewMenuOpen ? '#3e3e42' : 'transparent',
                border: 'none',
                color: '#cccccc',
                fontSize: '13px',
                fontWeight: '400',
                padding: '6px 10px',
                cursor: 'pointer',
                borderRadius: '3px',
                transition: 'background-color 0.2s',
              }}
            >
              View
            </button>
            {isViewMenuOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '2px',
                backgroundColor: '#252526',
                border: '1px solid #454545',
                borderRadius: '4px',
                overflow: 'hidden',
                zIndex: 1000,
                minWidth: '180px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
              }}>
                <MenuItem
                  label="JavaScript"
                  onClick={() => handleFileTypeChange('javascript')}
                  rightElement={fileType === 'javascript' && <span style={{ color: '#0e639c' }}>✓</span>}
                />
                <MenuItem
                  label="HTML"
                  onClick={() => handleFileTypeChange('html')}
                  rightElement={fileType === 'html' && <span style={{ color: '#0e639c' }}>✓</span>}
                />
                <MenuItem
                  label="CSS"
                  onClick={() => handleFileTypeChange('css')}
                  rightElement={fileType === 'css' && <span style={{ color: '#0e639c' }}>✓</span>}
                />
              </div>
            )}
          </div>

          {/* ✅ NEW: AI Mode Menu */}
          <div ref={aiMenuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => {
                setIsAiMenuOpen(!isAiMenuOpen);
                setIsFileMenuOpen(false);
                setIsViewMenuOpen(false);
              }}
              style={{
                background: isAiMenuOpen ? '#3e3e42' : 'transparent',
                border: 'none',
                color: '#cccccc',
                fontSize: '13px',
                fontWeight: '400',
                padding: '6px 10px',
                cursor: 'pointer',
                borderRadius: '3px',
                transition: 'background-color 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {aiMode === 'local' ? <Lock size={14} /> : <Cloud size={14} />}
              AI: {aiMode === 'local' ? 'Local' : 'Cloud'}
            </button>
            {isAiMenuOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '2px',
                backgroundColor: '#252526',
                border: '1px solid #454545',
                borderRadius: '4px',
                overflow: 'hidden',
                zIndex: 1000,
                minWidth: '200px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
              }}>
                <MenuItem
                  icon={<Lock size={14} />}
                  label="Local AI (Private)"
                  onClick={() => {
                    onAiModeChange('local');
                    setIsAiMenuOpen(false);
                  }}
                  rightElement={aiMode === 'local' && <span style={{ color: '#0e639c' }}>✓</span>}
                />
                <MenuItem
                  icon={<Cloud size={14} />}
                  label="Cloud AI (Gemini)" // Label updated
                  onClick={() => {
                    onAiModeChange('cloud');
                    setIsAiMenuOpen(false);
                  }}
                  rightElement={aiMode === 'cloud' && <span style={{ color: '#0e639c' }}>✓</span>}
                />
              </div>
            )}
          </div>
        </div>

        {/* Center: File Info */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: '#858585',
          fontSize: '12px',
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
        }}>
          {currentFileName ? (
            <>
              <span style={{ color: '#cccccc', fontWeight: '500' }}>
                {currentFileName}
              </span>
              {autoSave && (
                <span style={{ 
                  color: '#0e7c3a', 
                  fontSize: '11px',
                  padding: '2px 6px',
                  backgroundColor: '#0e7c3a20',
                  borderRadius: '3px'
                }}>
                  Auto Save
                </span>
              )}
            </>
          ) : (
            <span style={{ fontStyle: 'italic' }}>No file open</span>
          )}
        </div>

        {/* Right: File Type Badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <div style={{
            padding: '3px 8px',
            backgroundColor: '#3e3e42',
            borderRadius: '3px',
            fontSize: '11px',
            color: '#cccccc',
            fontWeight: '500',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            {fileType === 'html' ? 'HTML' : fileType === 'css' ? 'CSS' : 'JS'}
          </div>
        </div>
      </div>

      <nav style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.75rem 1.5rem',
        backgroundColor: '#2a2a2a',
        borderRadius: '0 0 8px 8px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <h1 style={{
            margin: 0,
            fontSize: '20px',
            fontWeight: 'bold',
            color: '#fff',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            🚀 BabyCompiler
          </h1>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 10px',
            backgroundColor: connectionStatus === 'connected' ? '#28a745' : '#dc3545',
            borderRadius: '4px',
            fontSize: '12px',
            color: 'white'
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: 'white'
            }} />
            {connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
          </div>

          <div onClick={onHTMLFileClick}>
            {fileManager}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={onRun} disabled={loadingRun || awaitingInput} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 1.2rem',
            backgroundColor: (loadingRun || awaitingInput) ? '#555' : '#4CAF50',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: (loadingRun || awaitingInput) ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            transition: 'all 0.2s ease'
          }}>
            {loadingRun ? <>⏳ Running...</> : <><Play size={16} />Run</>}
          </button>
          
          <button onClick={onAIFix} disabled={loadingAI || !canUseAI} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 1.2rem',
            backgroundColor: loadingAI ? '#666' : (canUseAI ? '#2196F3' : '#555'),
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: (loadingAI || !canUseAI) ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            transition: 'all 0.2s ease'
          }}>
            {loadingAI ? <>🔄 Fixing...</> : <><Bot size={16} />AI Fix</>}
          </button>

          <button onClick={onProcessInline} disabled={loadingInline || !hasInlinePrompts} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 1.2rem',
            backgroundColor: loadingInline ? '#666' : (hasInlinePrompts ? '#FF9800' : '#555'),
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: (loadingInline || !hasInlinePrompts) ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            transition: 'all 0.2s ease'
          }}>
            {loadingInline ? <>⚡ Processing...</> : <><Zap size={16} />Inline</>}
          </button>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Settings size={16} style={{ color: '#888' }} />
            <select 
              value={model} 
              onChange={(e) => onModelChange(e.target.value)} 
              style={{
                padding: '0.4rem 0.8rem',
                borderRadius: '4px',
                border: '1px solid #555',
                backgroundColor: '#3a3a3a',
                color: '#fff',
                fontSize: '14px',
                cursor: 'pointer'
              }}
              disabled={aiMode === 'cloud'} // ✅ Cloud uses fixed model (now 'gemini')
            >
              {getModelOptions().map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '14px', cursor: 'pointer', userSelect: 'none' }}>
            <input 
              type="checkbox" 
              checked={autoProcessInline} 
              onChange={(e) => onAutoProcessChange(e.target.checked)} 
              style={{ cursor: 'pointer' }} 
            />
            <span>Auto-process</span>
          </label>

          <button onClick={onClear} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 1.2rem',
            backgroundColor: '#ff6b6b',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            transition: 'all 0.2s ease'
          }}>
            <Trash2 size={16} /> Clear
          </button>
        </div>
      </nav>

      {/* Modals (unchanged) */}
      {isNewProjectModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div style={{
            backgroundColor: '#1e1e1e',
            padding: '24px',
            borderRadius: '8px',
            width: '400px',
            border: '1px solid #333'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#fff' }}>Create New Project</h3>
            <input
              type="text"
              value={projectNameInput}
              onChange={(e) => setProjectNameInput(e.target.value)}
              placeholder="Project name (e.g., my-website)"
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#2d2d30',
                border: '1px solid #3e3e42',
                color: '#cccccc',
                borderRadius: '4px',
                marginBottom: '16px'
              }}
            />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={async () => {
                  const name = projectNameInput.trim();
                  if (!name) return;
                  try {
                    const res = await fetch('http://localhost:5000/api/projects', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ name })
                    });
                    if (!res.ok) {
                      const errorData = await res.json().catch(() => ({}));
                      throw new Error(errorData.error || `HTTP ${res.status}`);
                    }
                    const newProject = await res.json();
                    onProjectChange(newProject.id);
                    setIsNewProjectModalOpen(false);
                    setProjectNameInput('');
                  } catch (err) {
                    alert('Failed to create project: ' + (err.message || 'Unknown error'));
                  }
                }}
                disabled={!projectNameInput.trim()}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: projectNameInput.trim() ? '#0e639c' : '#555',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: projectNameInput.trim() ? 'pointer' : 'not-allowed'
                }}
              >
                Create
              </button>
              <button
                onClick={() => {
                  setIsNewProjectModalOpen(false);
                  setProjectNameInput('');
                }}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: '#3e3e42',
                  color: '#cccccc',
                  border: 'none',
                  borderRadius: '4px'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {isOpenProjectModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div style={{
            backgroundColor: '#1e1e1e',
            padding: '24px',
            borderRadius: '8px',
            width: '400px',
            border: '1px solid #333',
            maxHeight: '80vh',
            overflow: 'hidden'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#fff' }}>Open Project</h3>
            {loadingProjects ? (
              <div style={{ color: '#cccccc', textAlign: 'center' }}>Loading projects...</div>
            ) : projects.length === 0 ? (
              <div style={{ color: '#888', fontStyle: 'italic' }}>No projects found</div>
            ) : (
              <div style={{ maxHeight: '500px', overflowY: 'auto', paddingRight: '8px' }}>
                {projects.map(project => (
                  <div
                    key={project.id}
                    onClick={() => {
                      onProjectChange(project.id);
                      setIsOpenProjectModalOpen(false);
                    }}
                    style={{
                      padding: '12px',
                      marginBottom: '8px',
                      backgroundColor: '#2d2d30',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      color: '#cccccc',
                      transition: 'background 0.2s',
                      border: '1px solid #3e3e42'
                    }}
                  >
                    {project.name}
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => setIsOpenProjectModalOpen(false)}
              style={{
                marginTop: '16px',
                padding: '10px',
                backgroundColor: '#3e3e42',
                color: '#cccccc',
                border: 'none',
                borderRadius: '4px',
                width: '100%'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const MenuItem = ({ icon, label, shortcut, onClick, rightElement }) => {
  const [isHovered, setIsHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        padding: '7px 12px',
        color: '#cccccc',
        fontSize: '13px',
        cursor: 'pointer',
        backgroundColor: isHovered ? '#2a2d2e' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        transition: 'background-color 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
        {icon && <span style={{ display: 'flex', color: '#858585' }}>{icon}</span>}
        <span>{label}</span>
      </div>
      {shortcut && (
        <span style={{ fontSize: '11px', color: '#858585', fontFamily: 'monospace' }}>
          {shortcut}
        </span>
      )}
      {rightElement && rightElement}
    </div>
  );
};

const MenuDivider = () => (
  <div style={{
    height: '1px',
    backgroundColor: '#3e3e42',
    margin: '4px 0',
  }} />
);

export default Navbar;