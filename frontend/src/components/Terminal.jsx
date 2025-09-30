import { Terminal as TerminalIcon, ChevronUp, ChevronDown } from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react'; 

// ==================== TERMINAL COMPONENT ====================
const Terminal = ({ output, awaitingInput, promptMessage, onUserInput, clearOutput }) => {
  const [inputValue, setInputValue] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);
  const [terminalHeight, setTerminalHeight] = useState(250);
  const [isResizing, setIsResizing] = useState(false);
  const outputRef = useRef(null);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  const handleInputSubmit = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && inputValue.trim()) {
      e.preventDefault();
      e.stopPropagation();
      const value = inputValue;
      setInputValue('');
      // Use setTimeout to ensure state is cleared before callback
      setTimeout(() => onUserInput(value), 0);
    }
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsResizing(true);
    
    const startY = e.clientY;
    const startHeight = terminalHeight;
    
    const handleMouseMove = (e) => {
      const deltaY = startY - e.clientY;
      const newHeight = Math.max(120, Math.min(window.innerHeight * 0.6, startHeight + deltaY));
      setTerminalHeight(newHeight);
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  if (!isExpanded && !awaitingInput) {
    return (
      <div 
        style={{
          height: '40px',
          backgroundColor: '#252526',
          borderTop: '1px solid #3e3e42',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          cursor: 'pointer'
        }}
        onClick={() => setIsExpanded(true)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TerminalIcon size={16} />
          <span>Terminal</span>
        </div>
        <ChevronUp size={16} />
      </div>
    );
  }

  return (
    <div 
      style={{ 
        height: isExpanded ? `${terminalHeight}px` : 'auto',
        display: 'flex', 
        flexDirection: 'column',
        backgroundColor: '#0d0d0d',
        borderTop: '1px solid #3e3e42',
        transition: 'height 0.3s ease'
      }}
    >
      <div 
        style={{ 
          padding: '8px 16px', 
          borderBottom: '1px solid #333',
          fontWeight: '500',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#1a1a1a',
          cursor: 'ns-resize'
        }}
        onMouseDown={handleMouseDown}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TerminalIcon size={16} />
          <span>Output / Terminal</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={clearOutput}
            style={{
              padding: '4px 8px',
              backgroundColor: '#555',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Clear
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(false);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#cccccc',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '3px'
            }}
          >
            <ChevronDown size={16} />
          </button>
        </div>
      </div>
      
      <div 
        style={{ 
          flex: 1, 
          padding: '16px', 
          margin: 0,
          overflow: 'auto',
          fontFamily: 'Consolas, Monaco, monospace',
          fontSize: '13px',
          lineHeight: '1.6',
          minHeight: '0',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <pre 
          ref={outputRef}
          style={{ 
            margin: 0,
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            flex: awaitingInput ? '0 1 auto' : '1'
          }}
        >
          {output || '// Output will appear here\n// Press Enter on any "xxx [instruction]" line to generate code\n// Use Ctrl+Enter to run your JavaScript code'}
        </pre>

        {awaitingInput && (
          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            marginTop: '8px'
          }}>
            <span style={{ color: '#ffa500' }}>{'> '}</span>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleInputSubmit}
              placeholder=""
              autoFocus
              style={{
                flex: 1,
                padding: '2px 4px',
                backgroundColor: 'transparent',
                color: '#d4d4d4',
                border: 'none',
                outline: 'none',
                fontFamily: 'Consolas, Monaco, monospace',
                fontSize: '13px'
              }}
            />
          </div>
        )}
      </div>
      
      <div
        style={{
          height: '4px',
          backgroundColor: '#333',
          cursor: 'ns-resize',
          width: '100%',
          marginBottom: '-2px'
        }}
        onMouseDown={handleMouseDown}
      />
    </div>
  );
};

export default Terminal;