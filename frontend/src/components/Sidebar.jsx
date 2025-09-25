// src/components/Sidebar.jsx
import React, { useState, useEffect } from 'react';

const Sidebar = ({ onFileSelect, currentCode, currentFile }) => {
  const [showNewFileInput, setShowNewFileInput] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [hoveredFile, setHoveredFile] = useState(null);

  // Fetch existing files on mount
  useEffect(() => {
    loadFiles();
  }, []);

  // Update selected file when currentFile changes
  useEffect(() => {
    if (currentFile) {
      setSelectedFile(currentFile.name);
    }
  }, [currentFile]);

  const loadFiles = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/files');
      if (res.ok) {
        const data = await res.json();
        setFiles(data);
      }
    } catch (err) {
      console.error('Failed to load files:', err);
    }
  };

  const handleAddFile = () => {
    setShowNewFileInput(true);
    setNewFileName('');
    // Auto-focus will be handled by the input element
  };

  const handleCancelNewFile = () => {
    setShowNewFileInput(false);
    setNewFileName('');
  };

  const handleCreateFile = async (e) => {
    if (e.key === 'Enter' || e.type === 'click') {
      e.preventDefault();
      const name = newFileName.trim();
      
      if (!name) return;
      
      // Ensure file has extension
      const hasExtension = /\.\w+$/.test(name);
      const finalName = hasExtension ? name : `${name}.js`;

      // Check if file already exists
      const fileExists = files.some(file => file.name === finalName);
      if (fileExists) {
        alert(`File "${finalName}" already exists!`);
        return;
      }

      try {
        setLoading(true);
        
        // Create new file with default content or current editor content
        const defaultContent = '// Write JavaScript code here\n// Use "xxx [instruction]" on any line for AI code generation\n\nconsole.log("Hello, World!");';
        const fileContent = currentCode && currentCode.trim() !== '' ? currentCode : defaultContent;
        
        const res = await fetch('http://localhost:5000/api/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            name: finalName,
            content: fileContent 
          })
        });

        if (res.ok) {
          setNewFileName('');
          setShowNewFileInput(false);
          await loadFiles(); // Refresh file list
          
          // Automatically select the newly created file
          setSelectedFile(finalName);
          onFileSelect({ name: finalName, content: fileContent });
        } else {
          const error = await res.json();
          alert(`Failed to create file: ${error.error || 'Unknown error'}`);
        }
      } catch (err) {
        console.error('Create file failed:', err);
        alert('Failed to create file. Check console for details.');
      } finally {
        setLoading(false);
      }
    } else if (e.key === 'Escape') {
      handleCancelNewFile();
    }
  };

  const handleFileClick = async (fileName) => {
    try {
      const res = await fetch(`http://localhost:5000/api/files/${fileName}`);
      if (res.ok) {
        const file = await res.json();
        
        // Update parent (editor)
        onFileSelect(file);
        
        // Update local selection state
        setSelectedFile(fileName);
      } else {
        console.error('Failed to load file:', fileName);
        alert('Failed to load file');
      }
    } catch (err) {
      console.error('Load file failed:', err);
      alert('Failed to load file. Check console for details.');
    }
  };

  const handleDeleteFile = async (fileName, e) => {
    e.stopPropagation(); // Prevent file selection
    
    if (!confirm(`Are you sure you want to delete "${fileName}"?`)) {
      return;
    }

    try {
      const res = await fetch(`http://localhost:5000/api/files/${fileName}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        await loadFiles(); // Refresh file list
        
        // If deleted file was selected, clear selection
        if (selectedFile === fileName) {
          setSelectedFile(null);
          onFileSelect({ name: 'untitled.js', content: '// Write JavaScript code here\nconsole.log("Hello, World!");' });
        }
      } else {
        const error = await res.json();
        alert(`Failed to delete file: ${error.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Delete file failed:', err);
      alert('Failed to delete file. Check console for details.');
    }
  };

  const getFileIcon = (fileName) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'js':
        return '📄';
      case 'json':
        return '🔧';
      case 'md':
        return '📝';
      case 'html':
        return '🌐';
      case 'css':
        return '🎨';
      default:
        return '📄';
    }
  };

  return (
    <div style={{
      width: '280px',
      backgroundColor: '#252526',
      color: '#cccccc',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      borderRight: '1px solid #3e3e42',
      overflow: 'hidden',
      fontFamily: 'Segoe UI, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        padding: '8px 16px',
        fontSize: '11px',
        fontWeight: 'bold',
        color: '#cccccc',
        backgroundColor: '#2d2d30',
        borderBottom: '1px solid #3e3e42',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span>Explorer</span>
        <button
          onClick={handleAddFile}
          title="New File"
          style={{
            background: 'none',
            border: 'none',
            color: '#cccccc',
            cursor: 'pointer',
            padding: '2px',
            borderRadius: '3px',
            display: 'flex',
            alignItems: 'center',
            fontSize: '14px'
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#3e3e42'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M14 7v1H8v6H7V8H1V7h6V1h1v6h6z"/>
          </svg>
        </button>
      </div>

      {/* File List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '4px 0'
      }}>
        {/* New File Input */}
        {showNewFileInput && (
          <div style={{ 
            padding: '0 8px',
            marginBottom: '4px'
          }}>
            <input
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyDown={handleCreateFile}
              onBlur={handleCancelNewFile}
              placeholder="filename.js"
              autoFocus
              style={{
                width: '100%',
                padding: '4px 8px',
                backgroundColor: '#3c3c3c',
                border: '1px solid #007acc',
                borderRadius: '2px',
                color: '#cccccc',
                fontSize: '13px',
                fontFamily: 'Consolas, monospace',
                outline: 'none'
              }}
            />
          </div>
        )}

        {/* Files */}
        {files.length === 0 ? (
          <div style={{
            color: '#858585',
            fontSize: '13px',
            padding: '20px 16px',
            fontStyle: 'italic'
          }}>
            No files yet. Click the + icon to create one.
          </div>
        ) : (
          files.map((file) => (
            <div
              key={file.name}
              onClick={() => handleFileClick(file.name)}
              onMouseEnter={() => setHoveredFile(file.name)}
              onMouseLeave={() => setHoveredFile(null)}
              style={{
                padding: '4px 16px',
                backgroundColor:
                  selectedFile === file.name
                    ? '#37373d'
                    : hoveredFile === file.name
                    ? '#2a2d2e'
                    : 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '13px',
                color: selectedFile === file.name ? '#ffffff' : '#cccccc',
                transition: 'background-color 0.1s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>{getFileIcon(file.name)}</span>
                <span>{file.name}</span>
              </div>
              
              {/* Delete button - shows on hover */}
              {hoveredFile === file.name && (
                <button
                  onClick={(e) => handleDeleteFile(file.name, e)}
                  title="Delete file"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#cccccc',
                    cursor: 'pointer',
                    padding: '2px',
                    borderRadius: '2px',
                    fontSize: '12px',
                    opacity: 0.7
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = '#f14c4c';
                    e.target.style.opacity = '1';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = 'transparent';
                    e.target.style.opacity = '0.7';
                  }}
                >
                  ×
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '8px 16px',
        fontSize: '11px',
        color: '#858585',
        backgroundColor: '#2d2d30',
        borderTop: '1px solid #3e3e42'
      }}>
        {files.length} {files.length === 1 ? 'file' : 'files'}
      </div>
    </div>
  );
};

export default Sidebar;