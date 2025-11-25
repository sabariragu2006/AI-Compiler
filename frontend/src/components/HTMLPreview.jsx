import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, RefreshCw, ExternalLink, Monitor } from 'lucide-react';

const HTMLPreview = ({ 
  fileName, 
  onClose, 
  apiUrl = 'http://localhost:5000', 
  initialPath = '/',
  activeProject = 'default' // 👈 ADD THIS PROP
}) => {
  const iframeRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentFilePath, setCurrentFilePath] = useState(fileName || 'index.html');
  const [fileMap, setFileMap] = useState({});
  const [compiledJS, setCompiledJS] = useState('');
  const [processedHTML, setProcessedHTML] = useState('');

  useEffect(() => {
    const loadRuntime = async () => {
      try {
        setLoading(true);
        
        // 👇 USE PROJECT-SCOPED ENDPOINT FOR FILE LISTING
        const filesRes = await fetch(`${apiUrl}/api/projects/${activeProject}/files`);
        const filesData = await filesRes.json();
        
        // Build fileMap from all files
        const buildFileMap = {};
        if (Array.isArray(filesData)) {
          for (const file of filesData) {
            if (file.type === 'file') {
              // 👇 INCLUDE projectId IN FILE CONTENT REQUEST
              try {
                const fileContentRes = await fetch(
                  `${apiUrl}/api/files/${encodeURIComponent(file.path)}?projectId=${activeProject}`
                );
                if (fileContentRes.ok) {
                  const fileContent = await fileContentRes.json();
                  const normalized = file.path.replace(/^\.\//, '').replace(/^\//, '');
                  
                  // Store in multiple formats
                  buildFileMap[normalized] = fileContent.content;
                  buildFileMap[`./${normalized}`] = fileContent.content;
                  buildFileMap[`/${normalized}`] = fileContent.content;
                  buildFileMap[file.path] = fileContent.content;
                }
              } catch (err) {
                console.warn(`Failed to load ${file.path}:`, err);
              }
            }
          }
        }
        
        console.log('📦 Built fileMap with', Object.keys(buildFileMap).length, 'entries');
        console.log('📂 FileMap keys:', Object.keys(buildFileMap));
        
        setFileMap(buildFileMap);
        
        // 👇 INCLUDE projectId IN RUN-JS REQUEST
        const res = await fetch(`${apiUrl}/api/run-js`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            currentPath: initialPath, 
            currentFile: fileName || 'index.html',
            projectId: activeProject // ✅ CRITICAL
          })
        });

        const data = await res.json();
        if (!data.success) throw new Error(data.terminalOutput?.join('\n') || 'Failed to load');

        setCompiledJS(data.javascript || '');
        setCurrentFilePath(data.currentFile);

        if (data.terminalOutput?.length) {
          console.log('=== Backend Compilation Output ===');
          data.terminalOutput.forEach(line => console.log(line));
          console.log('==================================');
        }

        const processed = processHTMLWithMap(data.html, data.javascript || '', buildFileMap);
        setProcessedHTML(processed);
        setLoading(false);
        console.log('✓ Preview HTML processed and ready');
      } catch (err) {
        setError(`Load error: ${err.message}`);
        setLoading(false);
      }
    };

    loadRuntime();
  }, [apiUrl, initialPath, fileName, activeProject]); // 👈 ADD activeProject TO DEPS

  // Helper function that accepts fileMap as parameter
  const processHTMLWithMap = (html, javascript = '', currentFileMap) => {
    let processed = html;

    // Inject React/ReactDOM CDN if missing
    if (!/<script[^>]*react/i.test(processed)) {
      processed = processed.replace(
        /<\/head>/i,
        `<script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
</head>`
      );
    }

    // Inject compiled JS
    if (javascript?.trim()) {
      const scriptTag = `<script type="module">\n${javascript}\n</script>`;
      processed = processed.includes('</body>')
        ? processed.replace(/<\/body>/i, `${scriptTag}\n</body>`)
        : processed + scriptTag;
    }

    // Enhanced URL rewriting with projectId
    const rewriteUrl = (url) => {
      if (!url || /^(https?:)?\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) {
        return url;
      }
      
      let normalized = url.replace(/^\.\//, '').replace(/^\//, '');
      
      // Check multiple possible path formats in currentFileMap
      const possiblePaths = [
        normalized,
        `./${normalized}`,
        `/${normalized}`,
        normalized.replace(/^\.\//, '')
      ];
      
      const existsInFileMap = possiblePaths.some(p => currentFileMap[p]);
      
      if (existsInFileMap) {
        // 👇 INCLUDE projectId IN ASSET URL
        return `${apiUrl}/api/assets/${encodeURIComponent(normalized)}?projectId=${activeProject}`;
      }
      
      // Return empty data URL based on file type to prevent 404
      if (normalized.endsWith('.css')) {
        return 'data:text/css;base64,';
      } else if (normalized.endsWith('.js')) {
        return 'data:text/javascript;base64,';
      } else if (normalized.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
        return 'data:image/png;base64,';
      }
      
      return url;
    };

    // Rewrite script tags
    processed = processed.replace(/<script(\s[^>]*)?\ssrc=["']([^"']+)["']/gi, (match, attrs = '', src) => {
      if (src.includes('unpkg.com') || src.includes('cdn') || src.includes('http')) return match;
      const newSrc = rewriteUrl(src);
      return `<script${attrs} src="${newSrc}"`;
    });

    // Rewrite link tags
    processed = processed.replace(/<link(\s[^>]*)?\shref=["']([^"']+)["']/gi, (match, attrs = '', href) => {
      if (href.includes('unpkg.com') || href.includes('cdn') || href.includes('http')) return match;
      const newHref = rewriteUrl(href);
      return `<link${attrs} href="${newHref}"`;
    });

    // Rewrite img tags
    processed = processed.replace(/<img(\s[^>]*)?\ssrc=["']([^"']+)["']/gi, (match, attrs = '', src) => {
      const newSrc = rewriteUrl(src);
      return `<img${attrs} src="${newSrc}"`;
    });

    // Add <base> if missing (but only if we have assets)
    if (!/<base\s/i.test(processed) && Object.keys(currentFileMap).length > 1) {
      // 👇 INCLUDE projectId IN BASE HREF
      processed = processed.replace(
        /<head(\s[^>]*)?>/i, 
        `<head$1>\n<base href="${apiUrl}/api/assets/?projectId=${activeProject}">`
      );
    }

    return processed;
  };

  // ... rest of your existing functions (processHTML, injectHTML, etc.) remain the same
  // but make sure they use the updated rewriteUrl logic above

  const processHTML = useCallback((html, javascript = '') => {
    // ... same as before but using the updated rewriteUrl with projectId
    // (Implementation identical to processHTMLWithMap but using component state)
    let processed = html;

    if (!/<script[^>]*react/i.test(processed)) {
      processed = processed.replace(
        /<\/head>/i,
        `<script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
</head>`
      );
    }

    if (javascript?.trim()) {
      const scriptTag = `<script type="module">\n${javascript}\n</script>`;
      processed = processed.includes('</body>')
        ? processed.replace(/<\/body>/i, `${scriptTag}\n</body>`)
        : processed + scriptTag;
    }

    const rewriteUrl = (url) => {
      if (!url || /^(https?:)?\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) {
        return url;
      }
      
      let normalized = url.replace(/^\.\//, '').replace(/^\//, '');
      const possiblePaths = [
        normalized,
        `./${normalized}`,
        `/${normalized}`,
        normalized.replace(/^\.\//, '')
      ];
      
      const existsInFileMap = possiblePaths.some(p => fileMap[p]);
      
      if (existsInFileMap) {
        // 👇 INCLUDE projectId IN ASSET URL
        return `${apiUrl}/api/assets/${encodeURIComponent(normalized)}?projectId=${activeProject}`;
      }
      
      if (normalized.endsWith('.css')) {
        return 'data:text/css;base64,';
      } else if (normalized.endsWith('.js')) {
        return 'data:text/javascript;base64,';
      } else if (normalized.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
        return 'data:image/png;base64,';
      }
      
      return url;
    };

    processed = processed.replace(/<script(\s[^>]*)?\ssrc=["']([^"']+)["']/gi, (match, attrs = '', src) => {
      if (src.includes('unpkg.com') || src.includes('cdn') || src.includes('http')) return match;
      const newSrc = rewriteUrl(src);
      return `<script${attrs} src="${newSrc}"`;
    });

    processed = processed.replace(/<link(\s[^>]*)?\shref=["']([^"']+)["']/gi, (match, attrs = '', href) => {
      if (href.includes('unpkg.com') || href.includes('cdn') || href.includes('http')) return match;
      const newHref = rewriteUrl(href);
      return `<link${attrs} href="${newHref}"`;
    });

    processed = processed.replace(/<img(\s[^>]*)?\ssrc=["']([^"']+)["']/gi, (match, attrs = '', src) => {
      const newSrc = rewriteUrl(src);
      return `<img${attrs} src="${newSrc}"`;
    });

    if (!/<base\s/i.test(processed) && Object.keys(fileMap).length > 1) {
      processed = processed.replace(
        /<head(\s[^>]*)?>/i, 
        `<head$1>\n<base href="${apiUrl}/api/assets/?projectId=${activeProject}">`
      );
    }

    return processed;
  }, [apiUrl, fileMap, activeProject]);

  const injectHTML = useCallback((htmlContent, javascript = '') => {
    try {
      const processed = processHTML(htmlContent, javascript);
      setProcessedHTML(processed);
      setLoading(false);
      console.log('✓ Preview HTML processed and ready');
    } catch (err) {
      console.error('Render error:', err);
      setError(`Render error: ${err.message}`);
      setLoading(false);
    }
  }, [processHTML]);

  const navigateToFile = useCallback((filePath) => {
    const normalized = filePath.replace(/^\/+|\/+$/g, '');
    const content = fileMap[normalized];
    if (!content) {
      setError(`File not found: ${filePath}`);
      return;
    }
    setCurrentFilePath(filePath);
    injectHTML(content, compiledJS);
  }, [fileMap, compiledJS, injectHTML]);

  const handleRefresh = () => {
    const normalized = currentFilePath.replace(/^\/+|\/+$/g, '');
    const content = fileMap[normalized];
    if (content) injectHTML(content, compiledJS);
  };

  const handleOpenInNewTab = () => {
    const normalized = currentFilePath.replace(/^\/+|\/+$/g, '');
    const content = fileMap[normalized];
    if (content) {
      const processedHTML = processHTML(content, compiledJS);
      const blob = new Blob([processedHTML], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
  };

  const handleOpenInBrowser = async () => {
    try {
      setError(null);
      console.log('🚀 Requesting browser launch for:', currentFilePath);
      
      // 👇 INCLUDE projectId IN BROWSER LAUNCH REQUEST
      const res = await fetch(`${apiUrl}/api/launch-browser`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          currentFile: currentFilePath, 
          browser: 'chrome',
          projectId: activeProject // ✅ CRITICAL
        })
      });

      const contentType = res.headers.get('content-type') || '';
      
      if (!contentType.includes('application/json')) {
        const text = await res.text();
        throw new Error(`Server returned non-JSON response: ${text.slice(0, 200)}`);
      }

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to launch browser');
      }
      
      console.log(`✅ ${data.message}`);
    } catch (err) {
      console.error('Browser launch error:', err);
      setError(`Failed to open in browser: ${err.message}`);
    }
  };

  return (
    <div style={{ 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      right: 0, 
      bottom: 0, 
      backgroundColor: 'rgba(0,0,0,0.85)', 
      zIndex: 9999, 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: '20px', 
      backdropFilter: 'blur(4px)' 
    }}>
      <div style={{ 
        width: '90%', 
        height: '90%', 
        backgroundColor: '#1e1e1e', 
        borderRadius: '8px', 
        overflow: 'hidden', 
        display: 'flex', 
        flexDirection: 'column', 
        boxShadow: '0 20px 60px rgba(0,0,0,0.7)', 
        border: '1px solid #3e3e42' 
      }}>
        {/* Header */}
        <div style={{ 
          padding: '12px 16px', 
          backgroundColor: '#2d2d30', 
          borderBottom: '1px solid #3e3e42', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ 
              color: '#cccccc', 
              fontSize: '14px', 
              fontWeight: '500', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px' 
            }}>
              <span style={{ 
                width: '8px', 
                height: '8px', 
                borderRadius: '50%', 
                backgroundColor: loading ? '#ffa500' : '#4ec9b0' 
              }} />
              HTML Preview
              {currentFilePath && (
                <span style={{ color: '#858585', fontSize: '13px' }}>
                  {' — '}{currentFilePath}
                </span>
              )}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button 
              onClick={handleRefresh} 
              disabled={loading} 
              style={{ 
                padding: '6px 10px', 
                backgroundColor: loading ? '#3e3e42' : '#0e639c', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px', 
                cursor: loading ? 'not-allowed' : 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px', 
                fontSize: '12px', 
                fontWeight: '500', 
                opacity: loading ? 0.5 : 1 
              }}
            >
              <RefreshCw size={14} /> Refresh
            </button>
            <button 
              onClick={handleOpenInNewTab} 
              disabled={loading} 
              style={{ 
                padding: '6px 10px', 
                backgroundColor: '#3e3e42', 
                color: '#cccccc', 
                border: 'none', 
                borderRadius: '4px', 
                cursor: loading ? 'not-allowed' : 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px', 
                fontSize: '12px', 
                opacity: loading ? 0.5 : 1 
              }}
              title="Open in new tab"
            >
              <ExternalLink size={14} />
            </button>
            <button 
              onClick={handleOpenInBrowser} 
              disabled={loading} 
              style={{ 
                padding: '6px 10px', 
                backgroundColor: '#3e3e42', 
                color: '#cccccc', 
                border: 'none', 
                borderRadius: '4px', 
                cursor: loading ? 'not-allowed' : 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px', 
                fontSize: '12px', 
                opacity: loading ? 0.5 : 1 
              }}
              title="Open in system browser"
            >
              <Monitor size={14} /> Browser
            </button>
            <button 
              onClick={onClose} 
              style={{ 
                padding: '6px', 
                backgroundColor: 'transparent', 
                color: '#cccccc', 
                border: 'none', 
                borderRadius: '4px', 
                cursor: 'pointer' 
              }}
              title="Close preview"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Loading/Error */}
        {loading && (
          <div style={{ 
            padding: '12px 16px', 
            backgroundColor: '#264f78', 
            color: '#fff', 
            fontSize: '13px', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px' 
          }}>
            <div style={{ 
              width: '14px', 
              height: '14px', 
              border: '2px solid #fff', 
              borderTopColor: 'transparent', 
              borderRadius: '50%', 
              animation: 'spin 0.8s linear infinite' 
            }} />
            Loading preview...
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {error && (
          <div style={{ 
            padding: '12px 16px', 
            backgroundColor: '#5a1d1d', 
            color: '#f48771', 
            fontSize: '13px', 
            borderBottom: '1px solid #3e3e42' 
          }}>
            ⚠️ {error}
          </div>
        )}

        <iframe
          ref={iframeRef}
          title="HTML Preview"
          sandbox="allow-scripts allow-forms allow-modals allow-popups"
          srcDoc={processedHTML}
          onLoad={() => {
            setLoading(false);
            console.log('✓ Preview loaded and JavaScript executed');
          }}
          onError={(e) => {
            console.error('Preview error:', e);
            setError('Preview failed to load');
            setLoading(false);
          }}
          style={{ 
            flex: 1, 
            width: '100%', 
            border: 'none', 
            backgroundColor: 'white' 
          }}
        />
      </div>
    </div>
  );
};

export default HTMLPreview;