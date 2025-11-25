// Terminal.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Terminal as TerminalIcon, ChevronUp, ChevronDown } from 'lucide-react';

const Terminal = ({ 
  output = [],           // Array of output lines from backend
  terminalOutput = [],   // NEW: terminalOutput from runtimeController (for logs)
  awaitingInput, 
  promptMessage, 
  onCommand,
  clearOutput, 
  currentFilePath,
  fileStructure = []
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);
  const [terminalHeight, setTerminalHeight] = useState(250);
  const [isResizing, setIsResizing] = useState(false);
  const [commandHistory, setCommandHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const outputRef = useRef(null);
  const inputRef = useRef(null);

  // ✅ LOG terminalOutput to browser console on change
  useEffect(() => {
    if (Array.isArray(terminalOutput) && terminalOutput.length > 0) {
      console.groupCollapsed(
        `%c[Runtime Logs] for ${currentFilePath || 'unknown file'}`,
        'color: #61dafb; font-weight: bold;'
      );
      terminalOutput.forEach(line => {
        if (line.startsWith('[ERROR]') || line.includes('failed') || line.startsWith('ERROR:')) {
          console.error(line);
        } else if (line.startsWith('WARN:') || line.startsWith('⚠️')) {
          console.warn(line);
        } else {
          console.log(line);
        }
      });
      console.groupEnd();
    }
  }, [terminalOutput, currentFilePath]);

  // Scroll to bottom on output change
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output, terminalOutput]);

  const handleTerminalClick = () => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const highlightPaths = useCallback((text) => {
    const pathRegex = /(\/?[\w-]+(?:\/[\w.-]+)*\/?)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = pathRegex.exec(text)) !== null) {
      const path = match[1];
      
      if (match.index > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`}>
            {text.substring(lastIndex, match.index)}
          </span>
        );
      }

      const beforeMatch = text.substring(Math.max(0, match.index - 20), match.index);
      const isPath = path.includes('/') || 
                     beforeMatch.includes('→') || 
                     beforeMatch.includes('directory') ||
                     beforeMatch.includes('cd') ||
                     beforeMatch.includes('mkdir') ||
                     beforeMatch.includes('path:') ||
                     text.startsWith(path + ' $');

      if (isPath) {
        parts.push(
          <span 
            key={`path-${match.index}`} 
            style={{ 
              color: '#4EC9B0', 
              fontWeight: '600' 
            }}
          >
            {path}
          </span>
        );
      } else {
        parts.push(
          <span key={`text-${match.index}`}>{path}</span>
        );
      }

      lastIndex = match.index + path.length;
    }

    if (lastIndex < text.length) {
      parts.push(
        <span key={`text-${lastIndex}`}>
          {text.substring(lastIndex)}
        </span>
      );
    }

    return parts.length > 0 ? parts : text;
  }, []);

  const handleInputSubmit = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      
      if (!inputValue.trim()) return;
      
      const value = inputValue;
      
      setCommandHistory(prev => [...prev, value]);
      setHistoryIndex(-1);
      setInputValue('');
      
      setTimeout(() => onCommand(value), 0);
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length === 0) return;
      const newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(newIndex);
      setInputValue(commandHistory[newIndex]);
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (commandHistory.length === 0) return;
      const newIndex = historyIndex === -1 ? -1 : Math.min(commandHistory.length - 1, historyIndex + 1);
      setHistoryIndex(newIndex);
      setInputValue(newIndex === -1 ? '' : commandHistory[newIndex]);
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

  const renderLine = useCallback((line, idx) => {
    // Error messages
    if (line.startsWith('ERROR:') || line.startsWith('Runtime Error:') || line.includes('not found') || line.startsWith('❌')) {
      return <div key={idx} style={{ color: '#f48771' }}>{highlightPaths(line)}</div>;
    }
    
    // Success messages
    if (line.startsWith('✓') || line.startsWith('✅') || line.includes('Success') || line.startsWith('Changed directory')) {
      return <div key={idx} style={{ color: '#89d185' }}>{highlightPaths(line)}</div>;
    }
    
    // Warning messages
    if (line.startsWith('WARN:') || line.startsWith('⚠️')) {
      return <div key={idx} style={{ color: '#cca700' }}>{highlightPaths(line)}</div>;
    }
    
    // Info messages
    if (line.startsWith('INFO:') || line.startsWith('📄') || line.startsWith('📂')) {
      return <div key={idx} style={{ color: '#75beff' }}>{highlightPaths(line)}</div>;
    }

    // AI streaming progress messages
    if (line.startsWith('🤖') || line.startsWith('📊') || line.startsWith('📝')) {
      return <div key={idx} style={{ color: '#4EC9B0', fontWeight: '600' }}>{line}</div>;
    }
    
    // Comments
    if (line.trim().startsWith('#') || line.trim().startsWith('//')) {
      return <div key={idx} style={{ color: '#6A9955' }}>{line}</div>;
    }

    // File/folder listings
    if (line.startsWith('  📁') || line.startsWith('  📄')) {
      return <div key={idx} style={{ color: '#75beff' }}>{line}</div>;
    }

    // Command prompt lines (contains $)
    if (line.includes(' $ ')) {
      return <div key={idx}>{highlightPaths(line)}</div>;
    }
    
    // Regular output lines
    return <div key={idx}>{highlightPaths(line)}</div>;
  }, [highlightPaths]);

  // Combine output and terminalOutput for display
  const allOutputLines = [...(Array.isArray(output) ? output : []), ...(Array.isArray(terminalOutput) ? terminalOutput : [])];

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
        backgroundColor: '#1e1e1e',
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
          cursor: isResizing ? 'ns-resize' : 'default'
        }}
        onMouseDown={handleMouseDown}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TerminalIcon size={16} />
          <span>Terminal</span>
          {currentFilePath && (
            <span style={{ color: '#4EC9B0', fontSize: '12px', fontWeight: '600' }}>
              [{currentFilePath}]
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              clearOutput && clearOutput();
            }}
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
          padding: '12px', 
          margin: 0,
          overflow: 'auto',
          fontFamily: 'Consolas, Monaco, "Courier New", monospace',
          fontSize: '14px',
          lineHeight: '1.5',
          minHeight: '0',
          display: 'flex',
          flexDirection: 'column',
          color: '#cccccc',
          cursor: 'text'
        }}
        onClick={handleTerminalClick}
      >
        <div 
          ref={outputRef}
          style={{ 
            margin: 0,
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            flex: '0 1 auto'
          }}
        >
          {allOutputLines.length > 0 ? (
            allOutputLines.map((line, idx) => renderLine(String(line), idx))
          ) : (
            <div style={{ color: '#6A9955' }}>
              # AI Code Generator Terminal<br/>
              # Commands: cd, pwd, ls, clear, open [filename]<br/>
              # AI Generate: xxx create code for [filename]<br/>
              <br/>
              # Example: xxx create code for login html file
            </div>
          )}
        </div>

        <div style={{ 
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          marginTop: allOutputLines.length > 0 ? '8px' : '0'
        }}>
          <span style={{ color: '#4EC9B0', fontWeight: '600' }}>
            {currentFilePath || '/'}
          </span>
          <span style={{ color: '#808080', fontWeight: '600' }}>{'>'}</span>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleInputSubmit}
            placeholder={promptMessage || (awaitingInput ? 'Enter input...' : 'Type command...')}
            autoFocus
            style={{
              flex: 1,
              padding: '2px 4px',
              backgroundColor: 'transparent',
              color: '#cccccc',
              border: 'none',
              outline: 'none',
              fontFamily: 'Consolas, Monaco, "Courier New", monospace',
              fontSize: '14px'
            }}
          />
        </div>
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