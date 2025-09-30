import React, { useState, useEffect } from 'react';
import { Save, Trash2, File, Plus, ChevronLeft, ChevronRight, FileText } from 'lucide-react';

const FileManager = ({ onLoad, onSave, onDelete, currentFileName, setFileType ,setCurrentFileName, fileType }) => {
  const [files, setFiles] = useState([]);
  const [newFileName, setNewFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isAddingFile, setIsAddingFile] = useState(false);
  

  const fetchFiles = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/files');
      const data = await res.json();
      setFiles(data);
    } catch (err) {
      console.error('Failed to fetch files:', err);
    }
  };

  useEffect(() => {
    fetchFiles();
    const interval = setInterval(fetchFiles, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSave = async () => {
    const extension = fileType === 'html' ? '.html' : '.js';
    let fileName = currentFileName;
    
    if (isAddingFile) {
      fileName = newFileName;
      if (!fileName) {
        alert('Please enter a file name');
        return;
      }
      if (!fileName.endsWith(extension)) {
        fileName += extension;
      }
    } else if (!fileName) {
      fileName = `untitled${extension}`;
    }

    setLoading(true);
    const success = await onSave(fileName);
    if (success) {
      setCurrentFileName(fileName);
      setNewFileName('');
      setIsAddingFile(false);
      fetchFiles();
    }
    setLoading(false);
  };

const handleLoad = async (fileName) => {
  setLoading(true);
  try {
    const response = await fetch(`http://localhost:5000/api/files/${fileName}`);
    if (!response.ok) throw new Error('Failed to load file');
    const fileData = await response.json();

    const extension = fileName.split('.').pop().toLowerCase();
    const newFileType = extension === 'html' || extension === 'htm' ? 'html' : 'javascript';
    setFileType(newFileType); // Update file type before loading

    // Pass both name and content to parent
    await onLoad(fileName, fileData.content); // ✅ Now matches parent signature
    setCurrentFileName(fileName);
  } catch (err) {
    console.error('Failed to load file:', err);
    alert('Failed to load file: ' + err.message);
  } finally {
    setLoading(false);
  }
};

  const handleDelete = async (fileName, e) => {
    e.stopPropagation();
    if (!confirm(`Delete ${fileName}?`)) return;
    setLoading(true);
    const success = await onDelete(fileName);
    if (success) {
      fetchFiles();
      if (currentFileName === fileName) {
        setCurrentFileName('');
      }
    }
    setLoading(false);
  };

  const handleAddFile = () => {
    setIsAddingFile(true);
    setNewFileName('');
  };

  const handleCancelAdd = () => {
    setIsAddingFile(false);
    setNewFileName('');
  };

  return (
    <>
      {/* Sidebar */}
      <div style={{
        width: isCollapsed ? '50px' : '280px',
        height: '100%',
        backgroundColor: '#252526',
        borderRight: '1px solid #3e3e42',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.3s ease',
        position: 'relative',
        zIndex: 10
      }}>
        {/* Header */}
        <div style={{
          padding: '12px',
          borderBottom: '1px solid #3e3e42',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#2d2d30'
        }}>
          {!isCollapsed && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              fontWeight: '600',
              color: '#cccccc',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              <FileText size={16} />
              Explorer
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{
              padding: '4px',
              backgroundColor: 'transparent',
              color: '#cccccc',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3e3e42'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {!isCollapsed && (
          <>
            {/* Action Buttons */}
            <div style={{
              padding: '12px',
              display: 'flex',
              gap: '8px',
              borderBottom: '1px solid #3e3e42'
            }}>
              <button
                onClick={handleAddFile}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '8px',
                  backgroundColor: '#0e639c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  fontWeight: '500',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = '#1177bb')}
                onMouseLeave={(e) => !loading && (e.currentTarget.style.backgroundColor = '#0e639c')}
              >
                <Plus size={14} />
                New
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '8px',
                  backgroundColor: '#0e7c3a',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  fontWeight: '500',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = '#11964a')}
                onMouseLeave={(e) => !loading && (e.currentTarget.style.backgroundColor = '#0e7c3a')}
              >
                <Save size={14} />
                Save
              </button>
            </div>

            

            {/* New File Input */}
            {isAddingFile && (
              <div style={{
                padding: '12px',
                backgroundColor: '#1e1e1e',
                borderBottom: '1px solid #3e3e42'
              }}>
                <input
                  type="text"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  placeholder={fileType === 'html' ? 'filename.html' : 'filename.js'}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave();
                    if (e.key === 'Escape') handleCancelAdd();
                  }}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    backgroundColor: '#3c3c3c',
                    color: '#cccccc',
                    border: '1px solid #0e639c',
                    borderRadius: '3px',
                    fontSize: '13px',
                    outline: 'none',
                    marginBottom: '8px'
                  }}
                />
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={handleSave}
                    disabled={loading}
                    style={{
                      flex: 1,
                      padding: '6px',
                      backgroundColor: '#0e7c3a',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      fontSize: '11px',
                      fontWeight: '500'
                    }}
                  >
                    Create
                  </button>
                  <button
                    onClick={handleCancelAdd}
                    style={{
                      flex: 1,
                      padding: '6px',
                      backgroundColor: '#3e3e42',
                      color: '#cccccc',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: '500'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Files List */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '8px 0'
            }}>
              {files.length === 0 ? (
                <div style={{
                  padding: '20px 12px',
                  color: '#858585',
                  fontSize: '12px',
                  textAlign: 'center'
                }}>
                  No files yet
                </div>
              ) : (
                files.map(file => (
                  <div
                    key={file.name}
                    onClick={() => handleLoad(file.name)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 12px',
                      cursor: 'pointer',
                      backgroundColor: currentFileName === file.name ? '#37373d' : 'transparent',
                      borderLeft: currentFileName === file.name ? '2px solid #0e639c' : '2px solid transparent',
                      transition: 'background-color 0.1s',
                      fontSize: '13px',
                      color: '#cccccc'
                    }}
                    onMouseEnter={(e) => {
                      if (currentFileName !== file.name) {
                        e.currentTarget.style.backgroundColor = '#2a2d2e';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (currentFileName !== file.name) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      overflow: 'hidden',
                      flex: 1
                    }}>
                      <File size={14} style={{ 
                        flexShrink: 0,
                        color: file.name.endsWith('.html') ? '#e34c26' : '#f7df1e'
                      }} />
                      <span style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {file.name}
                      </span>
                    </div>
                    <button
                      onClick={(e) => handleDelete(file.name, e)}
                      disabled={loading}
                      style={{
                        padding: '4px',
                        backgroundColor: 'transparent',
                        color: '#858585',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        opacity: 0.7,
                        transition: 'opacity 0.2s, background-color 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = '1';
                        e.currentTarget.style.backgroundColor = '#3e3e42';
                        e.currentTarget.style.color = '#f48771';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = '0.7';
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = '#858585';
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* Collapsed State - Tooltip */}
        {isCollapsed && (
          <div style={{
            padding: '12px 0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px'
          }}>
            <button
              onClick={handleAddFile}
              title="New File"
              style={{
                padding: '8px',
                backgroundColor: 'transparent',
                color: '#cccccc',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3e3e42'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <Plus size={18} />
            </button>
            <button
              onClick={handleSave}
              title="Save File"
              style={{
                padding: '8px',
                backgroundColor: 'transparent',
                color: '#cccccc',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3e3e42'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <Save size={18} />
            </button>
            <div style={{
              width: '20px',
              height: '2px',
              backgroundColor: '#3e3e42',
              margin: '8px 0'
            }} />
            {files.slice(0, 5).map(file => (
              <button
                key={file.name}
                onClick={() => handleLoad(file.name)}
                title={file.name}
                style={{
                  padding: '8px',
                  backgroundColor: currentFileName === file.name ? '#37373d' : 'transparent',
                  color: '#cccccc',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (currentFileName !== file.name) {
                    e.currentTarget.style.backgroundColor = '#3e3e42';
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentFileName !== file.name) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <File size={18} />
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default FileManager;
