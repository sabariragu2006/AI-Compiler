import React, { useState , useEffect, useRef } from 'react';
import { Play, Bot, Zap, Settings, Trash2, Save, Plus, FolderPlus } from 'lucide-react';

const Navbar = ({
  // Run/AI/Inline functionality
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
  
  // File management functionality
  onNewFile,
  onNewFolder, // New prop for folder creation
  onSave,
  autoSave,
  setAutoSave,
  currentFileName,
  fileType,
  setFileType,
  fileManager,
  onHTMLFileClick,
}) => {
  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);

    const fileMenuRef = useRef(null);
  const viewMenuRef = useRef(null);

    // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (fileMenuRef.current && !fileMenuRef.current.contains(event.target)) {
        setIsFileMenuOpen(false);
      }
      if (viewMenuRef.current && !viewMenuRef.current.contains(event.target)) {
        setIsViewMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

const handleMenuClick = (action) => {
  switch(action) {
    case 'newFile':
      onNewFile(); // ← comes from props
      break;
    case 'newFolder':
      onNewFolder(); // ← comes from props
      break;
    case 'saveFile':
      onSave(currentFileName);
      break;
    default:
      console.warn('Unknown menu action:', action);
  }
};



  const handleFileTypeChange = (type) => {
    setFileType && setFileType(type);
    setIsViewMenuOpen(false);
  };

  return (
    <div style={{ marginBottom: '1rem' }}>
      {/* Top Navigation Bar (File/View Menu) */}
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
        {/* Left Section - Menus */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          {/* File Menu */}
          {/* File Menu */}
          <div ref={fileMenuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => {
                setIsFileMenuOpen(!isFileMenuOpen);
                setIsViewMenuOpen(false);
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
                      readOnly
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
              </div>
            )}
          </div>
            </div>

        {/* Center Section - Current File */}
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

        {/* Right Section - File Type Badge */}
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
            {fileType === 'html' ? 'HTML' : 'JS'}
          </div>
        </div>
      </div>

      {/* Main Action Bar */}
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

          {/* File Manager */}
          <div onClick={onHTMLFileClick}>
            {fileManager}
          </div>
        </div>

        {/* Run / AI / Inline Buttons */}
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

        {/* Settings / Model / Auto / Clear */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Settings size={16} style={{ color: '#888' }} />
            <select value={model} onChange={(e) => onModelChange(e.target.value)} style={{
              padding: '0.4rem 0.8rem',
              borderRadius: '4px',
              border: '1px solid #555',
              backgroundColor: '#3a3a3a',
              color: '#fff',
              fontSize: '14px',
              cursor: 'pointer'
            }}>
              <option value="qwen">Qwen</option>
              <option value="deepseek">DeepSeek</option>
            </select>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '14px', cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={autoProcessInline} onChange={(e) => onAutoProcessChange(e.target.checked)} style={{ cursor: 'pointer' }} />
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
    </div>
  );
};

// Helper component for menu items
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
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '10px',
        flex: 1 
      }}>
        {icon && <span style={{ display: 'flex', color: '#858585' }}>{icon}</span>}
        <span>{label}</span>
      </div>
      {shortcut && (
        <span style={{ 
          fontSize: '11px', 
          color: '#858585',
          fontFamily: 'monospace'
        }}>
          {shortcut}
        </span>
      )}
      {rightElement && rightElement}
    </div>
  );
};

// Helper component for menu divider
const MenuDivider = () => (
  <div style={{
    height: '1px',
    backgroundColor: '#3e3e42',
    margin: '4px 0',
  }} />
);

export default Navbar;