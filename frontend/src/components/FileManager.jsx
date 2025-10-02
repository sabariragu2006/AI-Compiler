import React, { useState, useEffect, useCallback } from 'react';
import { Trash2, File, Folder, FolderOpen, FolderPlus, FileText, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';

const FileManager = ({ onLoad, onDelete, currentFileName, setFileType, setCurrentFileName, onLoadFile}) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [selectedFolder, setSelectedFolder] = useState('');

  const API_URL = 'http://localhost:5000';

  // Build hierarchical tree from flat list
  const buildTree = useCallback((flatItems) => {
    const tree = [];
    const itemMap = {};

    // Debug log
    console.log('Building tree from items:', flatItems);

    // Create map of all items
    flatItems.forEach(item => {
      itemMap[item.path] = { ...item, children: [] };
    });

    console.log('Item map:', itemMap);

    // Build tree structure
    flatItems.forEach(item => {
      const pathParts = item.path.split('/').filter(p => p); // Filter empty parts
      
      console.log(`Processing: ${item.path}, parts:`, pathParts);
      
      if (pathParts.length === 1) {
        // Root level item
        tree.push(itemMap[item.path]);
        console.log(`Added to root: ${item.path}`);
      } else {
        // Nested item - find parent
        const parentPath = pathParts.slice(0, -1).join('/');
        console.log(`Looking for parent: ${parentPath} for ${item.path}`);
        
        if (!itemMap[parentPath]) {
          // Auto-create folder if missing
          const parentName = pathParts[pathParts.length - 2];
          itemMap[parentPath] = {
            name: parentName,
            path: parentPath,
            type: 'folder',
            children: []
          };
          console.log(`Created missing parent folder: ${parentPath}`);
          
          // Add to appropriate parent or root
          const grandParentPath = pathParts.slice(0, -2).join('/');
          if (grandParentPath && itemMap[grandParentPath]) {
            itemMap[grandParentPath].children.push(itemMap[parentPath]);
            console.log(`Added ${parentPath} to grandparent ${grandParentPath}`);
          } else {
            tree.push(itemMap[parentPath]);
            console.log(`Added ${parentPath} to root`);
          }
        }
        
        itemMap[parentPath].children.push(itemMap[item.path]);
        console.log(`Added ${item.path} to parent ${parentPath}`);
      }
    });

    // Sort: folders first, then alphabetically
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

    console.log('Final tree:', tree);
    return tree;
  }, []);

  // Fetch all files and build tree
  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/files?path=`);
      const data = await res.json();
      
      // Debug: Log raw data from API
      console.log('Raw API data:', data);
      
      const treeData = buildTree(data);
      
      // Debug: Log built tree
      console.log('Built tree:', treeData);
      
      setItems(treeData);
      
      // Auto-expand all folders after fetching
      const newExpanded = new Set();
      const expandAllFolders = (nodes) => {
        nodes.forEach(item => {
          if (item.type === 'folder' && item.children && item.children.length > 0) {
            newExpanded.add(item.path);
            expandAllFolders(item.children);
          }
        });
      };
      expandAllFolders(treeData);
      
      // Debug: Log expanded folders
      console.log('Expanded folders:', Array.from(newExpanded));
      
      setExpandedFolders(newExpanded);
    } catch (err) {
      console.error('Failed to fetch items:', err);
    }
  }, [API_URL, buildTree]);

  // Single useEffect for fetching - runs once on mount and sets up interval
  useEffect(() => {
    fetchItems();
    const interval = setInterval(fetchItems, 5000);
    return () => clearInterval(interval);
  }, [fetchItems]);

  // Toggle folder expansion
  const toggleFolder = (path) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  // Load file
  const handleLoad = async (item) => {
    if (item.type === 'folder') {
      toggleFolder(item.path);
      setSelectedFolder(item.path); // Track selected folder for new file/folder creation
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/files/${item.path}`);
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
        md: 'markdown'
      };
      setFileType(types[extension] || 'text');
      
      await onLoad(item.name, fileData.content, item.path);
      setCurrentFileName(item.name);
    } catch (err) {
      console.error('Failed to load file:', err);
      alert('Failed to load file: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete file/folder
  const handleDelete = async (item, e) => {
    e.stopPropagation();
    if (!confirm(`Delete ${item.type} "${item.name}"?`)) return;
    
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/files/${item.path}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete');
      
      await fetchItems();
      if (currentFileName === item.name) {
        setCurrentFileName('');
        onLoad('', '', '');
      }
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Create new folder in selected folder (or root if none)
  const handleNewFolder = async () => {
    const folderName = prompt('Enter folder name:');
    if (!folderName || !folderName.trim()) return;
    
    try {
      const res = await fetch(`${API_URL}/api/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: folderName.trim(), 
          path: selectedFolder || '',
          type: 'folder' 
        })
      });
      if (!res.ok) throw new Error('Failed to create folder');
      await fetchItems();
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  // Create new file in selected folder (or root if none)
  const handleNewFile = async () => {
    const fileName = prompt('Enter file name (with extension):');
    if (!fileName || !fileName.trim()) return;
    
    try {
      const res = await fetch(`${API_URL}/api/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: fileName.trim(), 
          path: selectedFolder || '',
          content: '', 
          type: 'file' 
        })
      });
      if (!res.ok) throw new Error('Failed to create file');
      await fetchItems();
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  // Render tree recursively with memoization
  const renderTree = useCallback((nodes, depth = 0) => {
    return nodes.map((item) => {
      const isFolder = item.type === 'folder';
      const isExpanded = expandedFolders.has(item.path);
      const hasChildren = isFolder && item.children && item.children.length > 0;
      const baseIndent = 8;
      const indentSize = 20;
      const isSelected = currentFileName === item.name;

      return (
        <div key={item.path}>
          <div
            onClick={() => handleLoad(item)}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', flex: 1 }}>
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
            <button
              onClick={(e) => handleDelete(item, e)}
              disabled={loading}
              className="delete-btn"
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
                flexShrink: 0,
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
          
          {isFolder && isExpanded && hasChildren && (
            <div>{renderTree(item.children, depth + 1)}</div>
          )}
        </div>
      );
    });
  }, [expandedFolders, currentFileName, loading, handleLoad]);

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
      txt: '#cccccc',
    };
    return colors[ext] || '#cccccc';
  };

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
        .delete-btn {
          opacity: 0 !important;
        }
        div:hover > div > .delete-btn {
          opacity: 1 !important;
        }
      `}</style>
      
      {/* Header */}
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
            <FileText size={16} /> EXPLORER
          </div>
        )}
        <div style={{ display: 'flex', gap: '6px' }}>
          {!isCollapsed && (
            <>
              <button
                onClick={handleNewFile}
                title="New File"
                disabled={loading}
                style={{ 
                  padding: '4px', 
                  backgroundColor: 'transparent', 
                  border: 'none', 
                  cursor: loading ? 'not-allowed' : 'pointer', 
                  color: '#cccccc',
                  opacity: loading ? 0.5 : 1,
                }}
              >
                <File size={16} />
              </button>
              <button
                onClick={handleNewFolder}
                title="New Folder"
                disabled={loading}
                style={{ 
                  padding: '4px', 
                  backgroundColor: 'transparent', 
                  border: 'none', 
                  cursor: loading ? 'not-allowed' : 'pointer', 
                  color: '#cccccc',
                  opacity: loading ? 0.5 : 1,
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
          {items.length === 0 ? (
            <div style={{ padding: '20px 12px', color: '#858585', fontSize: '12px', textAlign: 'center' }}>
              No files or folders
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