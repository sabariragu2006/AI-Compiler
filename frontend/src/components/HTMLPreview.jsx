import React, { useState, useRef, useEffect } from 'react';
import Editor from './Editor';
import FileManager from './FileManager';
import Terminal from './Terminal';
import Navbar from './Navbar';
import { X } from 'lucide-react';

const HTMLPreview = ({ html, onClose }) => {
  const iframeRef = useRef(null);
  
  useEffect(() => {
    if (iframeRef.current) {
      const iframe = iframeRef.current;
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      doc.open();
      doc.write(html);
      doc.close();
    }
  }, [html]);
  
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        width: '90%',
        height: '90%',
        backgroundColor: '#1e1e1e',
        borderRadius: '8px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
      }}>
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#2d2d30',
          borderBottom: '1px solid #3e3e42',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span style={{ color: '#cccccc', fontSize: '14px', fontWeight: '500' }}>
            HTML Preview
          </span>
          <button
            onClick={onClose}
            style={{
              padding: '4px',
              backgroundColor: 'transparent',
              color: '#cccccc',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>
        <iframe
          ref={iframeRef}
          style={{
            flex: 1,
            width: '100%',
            border: 'none',
            backgroundColor: 'white'
          }}
          title="HTML Preview"
        />
      </div>
    </div>
  );
};

export default HTMLPreview;