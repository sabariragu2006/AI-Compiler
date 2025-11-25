import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Trash2, File, Folder, FolderOpen, FolderPlus, FileText, ChevronLeft, ChevronRight, ChevronDown, Edit2 } from 'lucide-react';

const FileManager = ({ 
  onLoad, 
  onDelete, 
  currentFileName, 
  setFileType, 
  setCurrentFileName, 
  onLoadFile,
  activeProject = 'default',
  refreshTrigger = 0
}) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return JSON.parse(localStorage.getItem('fileManagerCollapsed') || 'false');
  });
  const expandedFoldersRef = useRef(new Set(JSON.parse(localStorage.getItem('expandedFolders') || '[]')));
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState(''); // ✅ Track selected folder path

  const API_URL = 'http://localhost:5000';

  // Save states to localStorage
  useEffect(() => {
    localStorage.setItem('fileManagerCollapsed', JSON.stringify(isCollapsed));
    localStorage.setItem('expandedFolders', JSON.stringify([...expandedFoldersRef.current]));
  }, [isCollapsed]);

  const normalizePath = useCallback((p) => {
    if (!p) return '';
    return p.replace(/^\/+|\/+$/g, '');
  }, []);

  const buildTree = useCallback((flatItems) => {
    const tree = [];
    const itemMap = {};

    flatItems.forEach(item => {
      const normalizedPath = normalizePath(item.path);
      itemMap[normalizedPath] = { ...item, path: normalizedPath, children: [] };
    });

    flatItems.forEach(item => {
      const normalizedPath = normalizePath(item.path);
      const pathParts = normalizedPath.split('/').filter(p => p);
      
      if (pathParts.length === 0) {
        // Root item (path: "")
        tree.push(itemMap[normalizedPath]);
      } else if (pathParts.length === 1) {
        tree.push(itemMap[normalizedPath]);
      } else {
        const parentPath = pathParts.slice(0, -1).join('/');
        
        if (!itemMap[parentPath]) {
          const parentName = pathParts[pathParts.length - 2];
          itemMap[parentPath] = {
            name: parentName,
            path: parentPath,
            type: 'folder',
            children: []
          };
          
          const grandParentPath = pathParts.slice(0, -2).join('/');
          if (grandParentPath && itemMap[grandParentPath]) {
            itemMap[grandParentPath].children.push(itemMap[parentPath]);
          } else {
            tree.push(itemMap[parentPath]);
          }
        }
        
        itemMap[parentPath].children.push(itemMap[normalizedPath]);
      }
    });

    const sortItems = (items) => {
      items.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      items.forEach(item => {
        if (item.children && item.children.length > 0) {
          sortItems(item.children);
        }
      });
    };
    sortItems(tree);

    return tree;
  }, [normalizePath]);

  const fetchItems = useCallback(async () => {
    // ✅ Skip if no valid project selected
    if (!activeProject || activeProject === 'default') {
      setItems([]);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/projects/${activeProject}/files`);
      if (!res.ok) {
        // If 404, project has no files → treat as empty
        if (res.status === 404) {
          setItems([]);
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      const treeData = buildTree(data);
      setItems(treeData);
    } catch (err) {
      console.error('Failed to fetch items:', err);
      setItems([]);
    }
  }, [activeProject, buildTree, API_URL]);

  useEffect(() => {
    fetchItems();
  }, [activeProject, refreshTrigger, fetchItems]);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    const interval = setInterval(fetchItems, 5000);
    return () => clearInterval(interval);
  }, [fetchItems]);

  const toggleFolder = (path) => {
    const newExpanded = new Set(expandedFoldersRef.current);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    expandedFoldersRef.current = newExpanded;
    localStorage.setItem('expandedFolders', JSON.stringify([...newExpanded]));
    setItems(prev => [...prev]);
  };

  const handleLoad = async (item) => {
    if (item.type === 'folder') {
      toggleFolder(item.path);
      setSelectedFolder(item.path); // ✅ Set as parent for new items
      return;
    }

    setLoading(true);
    try {
      const normalizedPath = normalizePath(item.path);
      const res = await fetch(`${API_URL}/api/files/${encodeURIComponent(normalizedPath)}?projectId=${activeProject}`);
      if (!res.ok) throw new Error('Failed to load file');

      const fileData = await res.json();

      const extension = item.name.split('.').pop().toLowerCase();
      const types = { 
        js: 'javascript', 
        ts: 'typescript', 
        css: 'css', 
        html: 'html', 
        htm: 'html',
        json: 'json',
        md: 'markdown',
        py: 'python',
        java: 'java',
        cpp: 'cpp',
        c: 'c'
      };
      setFileType(types[extension] || 'text');

      await onLoad(item.name, fileData.content, normalizedPath);
      setCurrentFileName(item.name);
      setSelectedItem(item.path);
    } catch (err) {
      console.error('Failed to load file:', err);
      alert('Failed to load file: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (item, e) => {
    e.stopPropagation();
    if (!confirm(`Delete ${item.type} "${item.name}"?`)) return;
    
    setLoading(true);
    try {
      const normalizedPath = normalizePath(item.path);
      const res = await fetch(`${API_URL}/api/files/${encodeURIComponent(normalizedPath)}?projectId=${activeProject}`, {
        method: 'DELETE'
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to delete');
      }
      
      await fetchItems();
      if (currentFileName === item.name) {
        setCurrentFileName('');
        onLoad('', '', '');
        setSelectedItem(null);
      }
      // Clear selected folder if it was deleted
      if (selectedFolder === item.path) {
        setSelectedFolder('');
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRename = async (item, e) => {
    e.stopPropagation();
    const newName = prompt(`Rename ${item.type}:`, item.name);
    if (!newName || !newName.trim() || newName === item.name) return;
    
    setLoading(true);
    try {
      const normalizedPath = normalizePath(item.path);
      const res = await fetch(`${API_URL}/api/files/${encodeURIComponent(normalizedPath)}/rename?projectId=${activeProject}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newName: newName.trim() })
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to rename' }));
        throw new Error(errorData.error || 'Failed to rename');
      }
      
      await fetchItems();
      
      if (currentFileName === item.name) {
        setCurrentFileName(newName.trim());
        setSelectedItem(normalizePath(item.path).replace(item.name, newName.trim()));
      }
      // Update selected folder if renamed
      if (selectedFolder === item.path) {
        setSelectedFolder(normalizePath(item.path).replace(item.name, newName.trim()));
      }
    } catch (err) {
      console.error('Rename error:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleNewFolder = async () => {
    if (!activeProject || activeProject === 'default') {
      alert('Please select a project first!');
      return;
    }
    
    const folderName = prompt('Enter folder name:');
    if (!folderName || !folderName.trim()) return;
    
    setLoading(true);
    try {
      const parentPath = selectedFolder || ''; // ✅ Use selected folder as parent
      const res = await fetch(`${API_URL}/api/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: folderName.trim(), 
          path: parentPath,
          type: 'folder',
          projectId: activeProject
        })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to create folder' }));
        throw new Error(errorData.error || 'Failed to create folder');
      }
      await fetchItems();
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNewFile = async () => {
    if (!activeProject || activeProject === 'default') {
      alert('Please select a project first!');
      return;
    }
    
    const fileName = prompt('Enter file name (with extension):');
    if (!fileName || !fileName.trim()) return;
    
    setLoading(true);
    try {
      const parentPath = selectedFolder || ''; // ✅ Use selected folder as parent
      const res = await fetch(`${API_URL}/api/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: fileName.trim(), 
          path: parentPath,
          content: '', 
          type: 'file',
          projectId: activeProject
        })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to create file' }));
        throw new Error(errorData.error || 'Failed to create file');
      }
      await fetchItems();
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderTree = useCallback((nodes, depth = 0) => {
    return nodes.map((item) => {
      const isFolder = item.type === 'folder';
      const isExpanded = expandedFoldersRef.current.has(item.path);
      const hasChildren = isFolder && item.children && item.children.length > 0;
      const baseIndent = 8;
      const indentSize = 20;
      const normalizedItemPath = normalizePath(item.path);
      const isSelected = selectedItem === normalizedItemPath;

      return (
        <div key={normalizedItemPath}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingLeft: `${baseIndent + (depth * indentSize)}px`,
              paddingRight: '8px',
              paddingTop: '4px',
              paddingBottom: '4px',
              cursor: 'pointer',
              backgroundColor: isSelected ? '#37373d' : 'transparent',
              borderLeft: isSelected ? '2px solid #0e639c' : '2px solid transparent',
              fontSize: '13px',
              color: '#cccccc',
              transition: 'background-color 0.1s ease',
            }}
            onMouseEnter={(e) => {
              if (!isSelected) e.currentTarget.style.backgroundColor = '#2a2d2e';
            }}
            onMouseLeave={(e) => {
              if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <div 
              onClick={() => handleLoad(item)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', flex: 1 }}
            >
              {isFolder ? (
                hasChildren ? (
                  <ChevronDown 
                    size={14} 
                    style={{ 
                      transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                      transition: 'transform 0.2s',
                      flexShrink: 0,
                      marginLeft: '-2px'
                    }} 
                  />
                ) : (
                  <div style={{ width: '12px', flexShrink: 0 }} />
                )
              ) : (
                <div style={{ width: '12px', flexShrink: 0 }} />
              )}
              {isFolder ? (
                isExpanded ? <FolderOpen size={16} color="#dcb67a" style={{ flexShrink: 0 }} /> : <Folder size={16} color="#dcb67a" style={{ flexShrink: 0 }} />
              ) : (
                <File size={14} color={getFileColor(item.name)} style={{ flexShrink: 0 }} />
              )}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.name}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
              <button
                onClick={(e) => handleRename(item, e)}
                disabled={loading}
                className="action-btn"
                title="Rename"
                style={{
                  padding: '4px',
                  backgroundColor: 'transparent',
                  color: '#858585',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  opacity: 0,
                  transition: 'opacity 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#4ec9b0';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#858585';
                }}
              >
                <Edit2 size={13} />
              </button>
              <button
                onClick={(e) => handleDelete(item, e)}
                disabled={loading}
                className="action-btn"
                title="Delete"
                style={{
                  padding: '4px',
                  backgroundColor: 'transparent',
                  color: '#858585',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  opacity: 0,
                  transition: 'opacity 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#f48771';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#858585';
                }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
          
          {isFolder && isExpanded && hasChildren && (
            <div>{renderTree(item.children, depth + 1)}</div>
          )}
        </div>
      );
    });
  }, [expandedFoldersRef, selectedItem, selectedFolder, loading, handleLoad, normalizePath]);

  const getFileColor = (fileName) => {
    const ext = fileName.split('.').pop().toLowerCase();
    const colors = {
      js: '#f7df1e',
      jsx: '#61dafb',
      ts: '#3178c6',
      tsx: '#3178c6',
      html: '#e34c26',
      css: '#264de4',
      json: '#5a5a5a',
      md: '#083fa1',
      py: '#3776ab',
      java: '#f89820',
      cpp: '#00599c',
      c: '#a8b9cc',
      txt: '#cccccc',
    };
    return colors[ext] || '#cccccc';
  };

  const canCreate = activeProject && activeProject !== 'default';

  return (
    <div
      style={{
        width: isCollapsed ? '50px' : '280px',
        height: '100%',
        backgroundColor: '#252526',
        borderRight: '1px solid #3e3e42',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.3s ease',
        position: 'relative',
        zIndex: 10,
      }}
    >
      <style>{`
        .action-btn {
          opacity: 0 !important;
        }
        div:hover > div > .action-btn {
          opacity: 1 !important;
        }
      `}</style>
      
      <div
        style={{
          padding: '12px',
          borderBottom: '1px solid #3e3e42',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#2d2d30',
        }}
      >
        {!isCollapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '600', color: '#cccccc' }}>
            <FileText size={16} /> 
            {activeProject === 'default' ? 'EXPLORER' : activeProject}
          </div>
        )}
        <div style={{ display: 'flex', gap: '6px' }}>
          {!isCollapsed && (
            <>
              <button
                onClick={handleNewFile}
                title="New File"
                disabled={!canCreate || loading}
                style={{ 
                  padding: '4px', 
                  backgroundColor: 'transparent', 
                  border: 'none', 
                  cursor: (!canCreate || loading) ? 'not-allowed' : 'pointer', 
                  color: '#cccccc',
                  opacity: (!canCreate || loading) ? 0.5 : 1,
                }}
              >
                <File size={16} />
              </button>
              <button
                onClick={handleNewFolder}
                title="New Folder"
                disabled={!canCreate || loading}
                style={{ 
                  padding: '4px', 
                  backgroundColor: 'transparent', 
                  border: 'none', 
                  cursor: (!canCreate || loading) ? 'not-allowed' : 'pointer', 
                  color: '#cccccc',
                  opacity: (!canCreate || loading) ? 0.5 : 1,
                }}
              >
                <FolderPlus size={16} />
              </button>
            </>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{ padding: '4px', backgroundColor: 'transparent', color: '#cccccc', border: 'none', cursor: 'pointer' }}
          >
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {(!activeProject || activeProject === 'default') ? (
            <div style={{ padding: '20px 12px', color: '#858585', fontSize: '12px', textAlign: 'center' }}>
              <span style={{ fontWeight: 'bold', color: '#ffcc00' }}>
                📁 No Project Selected
              </span>
              <br/>
              <span style={{ fontSize: '11px', marginTop: '8px', display: 'block' }}>
                Create or select a project to view files
              </span>
            </div>
          ) : items.length === 0 ? (
            <div style={{ padding: '20px 12px', color: '#858585', fontSize: '12px', textAlign: 'center' }}>
              <span style={{ fontWeight: 'bold', color: '#858585' }}>
                Empty project
              </span>
              <br/>
              <span style={{ fontSize: '11px', marginTop: '8px', display: 'block' }}>
                Create files or folders to get started
              </span>
            </div>
          ) : (
            renderTree(items)
          )}
        </div>
      )}
    </div>
  );
};

export default FileManager;