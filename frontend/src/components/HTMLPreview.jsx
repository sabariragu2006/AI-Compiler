import React, { useState, useEffect, useRef } from 'react';
import { X, RefreshCw, ExternalLink } from 'lucide-react';

const HTMLPreview = ({ fileName, html, onClose, apiUrl = 'http://localhost:5000' }) => {
  const iframeRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [processedHtml, setProcessedHtml] = useState('');

  // Process HTML to rewrite asset paths
  useEffect(() => {
    if (!html) {
      setProcessedHtml('');
      return;
    }

    try {
      let modified = html;

      // Rewrite <script src="...">
      modified = modified.replace(
        /<script\s+([^>]*\s+)?src=["']([^"']+)["']/gi,
        (match, attrs, src) => {
          if (/^(https?:)?\/\//i.test(src)) return match;
          const assetPath = `${apiUrl}/api/assets/${encodeURIComponent(src)}`;
          return `<script ${attrs || ''}src="${assetPath}"`;
        }
      );

      // Rewrite <link href="...">
      modified = modified.replace(
        /<link\s+([^>]*\s+)?href=["']([^"']+)["']/gi,
        (match, attrs, href) => {
          if (/^(https?:)?\/\//i.test(href)) return match;
          const assetPath = `${apiUrl}/api/assets/${encodeURIComponent(href)}`;
          return `<link ${attrs || ''}href="${assetPath}"`;
        }
      );

      // Rewrite <img src="...">
      modified = modified.replace(
        /<img\s+([^>]*\s+)?src=["']([^"']+)["']/gi,
        (match, attrs, src) => {
          if (/^(https?:)?\/\//i.test(src)) return match;
          const assetPath = `${apiUrl}/api/assets/${encodeURIComponent(src)}`;
          return `<img ${attrs || ''}src="${assetPath}"`;
        }
      );

      // Add <base> if missing
      if (!/<base\s+href/i.test(modified)) {
        modified = modified.replace(
          /<head(\s[^>]*)?\s*>/i,
          `<head$1>\n  <base href="${apiUrl}/api/assets/">`
        );
      }

      setProcessedHtml(modified);
      setError(null);
    } catch (err) {
      setError(`Failed to process HTML: ${err.message}`);
      setProcessedHtml(html);
    }
  }, [html, apiUrl]);

  // Inject HTML into iframe
  useEffect(() => {
    if (!iframeRef.current || !processedHtml) return;

    setLoading(true);
    setError(null);

    const iframe = iframeRef.current;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;

    if (!doc) {
      setError('Unable to access iframe document');
      setLoading(false);
      return;
    }

    try {
      doc.open();
      doc.write(processedHtml);
      doc.close();

      const handleLoad = () => setLoading(false);
      const handleError = () => {
        setError('Failed to load preview');
        setLoading(false);
      };

      iframe.addEventListener('load', handleLoad);
      iframe.addEventListener('error', handleError);

      return () => {
        iframe.removeEventListener('load', handleLoad);
        iframe.removeEventListener('error', handleError);
      };
    } catch (err) {
      setError(`Error rendering HTML: ${err.message}`);
      setLoading(false);
    }
  }, [processedHtml]);

  const handleRefresh = () => {
    if (!iframeRef.current) return;
    const iframe = iframeRef.current;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (doc) {
      setLoading(true);
      doc.open();
      doc.write(processedHtml);
      doc.close();
    }
  };

  const handleOpenInNewTab = () => {
    const blob = new Blob([processedHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
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
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.7)',
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
                backgroundColor: '#4ec9b0'
              }} />
              HTML Preview
              {fileName && <span style={{ color: '#858585', fontSize: '13px' }}>— {fileName}</span>}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={handleRefresh}
              title="Refresh Preview"
              style={{
                padding: '6px 10px',
                backgroundColor: '#0e639c',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: '500',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1177bb'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0e639c'}
            >
              <RefreshCw size={14} />
              Refresh
            </button>

            <button
              onClick={handleOpenInNewTab}
              title="Open in New Tab"
              style={{
                padding: '6px 10px',
                backgroundColor: '#3e3e42',
                color: '#cccccc',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: '500',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4e4e52'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3e3e42'}
            >
              <ExternalLink size={14} />
            </button>

            <button
              onClick={onClose}
              title="Close Preview"
              style={{
                padding: '6px',
                backgroundColor: 'transparent',
                color: '#cccccc',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#3e3e42';
                e.currentTarget.style.color = '#f48771';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#cccccc';
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Loading Indicator */}
        {loading && (
          <div style={{
            padding: '12px 16px',
            backgroundColor: '#264f78',
            color: '#ffffff',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <div style={{
              width: '14px',
              height: '14px',
              border: '2px solid #ffffff',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite'
            }} />
            Loading preview...
            <style>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        )}

        {/* Error Display */}
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

        {/* Preview Iframe */}
        <iframe
          ref={iframeRef}
          title="HTML Preview"
          sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
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
