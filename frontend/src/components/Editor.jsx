import React, { useState, useRef, useEffect } from 'react';

// ==================== EDITOR COMPONENT ====================
export const Editor = ({ height, language, theme, value, onChange, onMount, options, onEnterKey }) => {
  const textareaRef = useRef(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingLineNumber, setStreamingLineNumber] = useState(-1);
  const [streamingContent, setStreamingContent] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [suggestionPosition, setSuggestionPosition] = useState({ top: 0, left: 0 });
  const [htmlSnippets, setHtmlSnippets] = useState(null); // null = loading, {} = loaded

  // Load autocomplete snippets from public/autocomplete.txt
  useEffect(() => {
    const loadSnippets = async () => {
      try {
        const response = await fetch('/autocomplete.txt');
        if (!response.ok) throw new Error('File not found');
        const text = await response.text();
        const snippetMap = {};
        text.split('\n').forEach(line => {
          line = line.trim();
          if (line && !line.startsWith('#')) {
            const equalsIndex = line.indexOf(' = ');
            if (equalsIndex !== -1) {
              const trigger = line.substring(0, equalsIndex).trim();
              const expansion = line.substring(equalsIndex + 3).replace(/\\n/g, '\n');
              snippetMap[trigger] = expansion;
            }
          }
        });
        setHtmlSnippets(snippetMap);
      } catch (err) {
        console.warn('Using fallback HTML snippets');
        // Fallback to built-in snippets
        setHtmlSnippets({
          '!': '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Document</title>\n</head>\n<body>\n  \n</body>\n</html>',
          'div': '<div></div>',
          'span': '<span></span>',
          'p': '<p></p>',
          'a': '<a href=""></a>',
          'img': '<img src="" alt="">',
          'ul': '<ul>\n  <li></li>\n</ul>',
          'ol': '<ol>\n  <li></li>\n</ol>',
          'li': '<li></li>',
          'h1': '<h1></h1>',
          'h2': '<h2></h2>',
          'h3': '<h3></h3>',
          'button': '<button></button>',
          'input': '<input type="text">',
          'label': '<label></label>',
          'select': '<select>\n  <option value=""></option>\n</select>',
          'table': '<table>\n  <tr>\n    <td></td>\n  </tr>\n</table>',
          'header': '<header></header>',
          'footer': '<footer></footer>',
          'nav': '<nav></nav>',
          'section': '<section></section>',
          'article': '<article></article>',
          'main': '<main></main>',
          'aside': '<aside></aside>',
          'script': '<script></script>',
          'style': '<style></style>',
          'link': '<link rel="stylesheet" href="">',
          'meta': '<meta name="" content="">',
          'br': '<br>',
          'hr': '<hr>',
          'iframe': '<iframe src=""></iframe>',
          'video': '<video src="" controls></video>',
          'audio': '<audio src="" controls></audio>',
          'canvas': '<canvas></canvas>',
          'svg': '<svg width="" height=""></svg>'
        });
      }
    };
    loadSnippets();
  }, []);

  useEffect(() => {
    if (onMount && textareaRef.current) {
      const mockEditor = {
        getValue: () => textareaRef.current.value,
        setValue: (val) => { 
          textareaRef.current.value = val;
          onChange(val);
        },
        getSelection: () => ({ startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 }),
        getModel: () => ({
          getValueInRange: () => textareaRef.current.selectionStart !== textareaRef.current.selectionEnd 
            ? textareaRef.current.value.substring(textareaRef.current.selectionStart, textareaRef.current.selectionEnd) 
            : ''
        }),
        executeEdits: (source, edits) => {
          if (edits && edits[0] && edits[0].text) {
            textareaRef.current.value = edits[0].text;
            onChange(edits[0].text);
          }
        },
        onDidChangeCursorSelection: (callback) => {
          textareaRef.current.addEventListener('select', callback);
        },
        onKeyDown: (callback) => {
          textareaRef.current.addEventListener('keydown', callback);
        },
        addCommand: () => {},
        focus: () => textareaRef.current.focus(),
        startStreaming: (lineNumber) => {
          setIsStreaming(true);
          setStreamingLineNumber(lineNumber);
          setStreamingContent('');
        },
        appendStreamingText: (text) => {
          setStreamingContent(prev => prev + text);
        },
        finishStreaming: (finalCode) => {
          setIsStreaming(false);
          setStreamingLineNumber(-1);
          setStreamingContent('');
          textareaRef.current.value = finalCode;
          onChange(finalCode);
        }
      };
      onMount(mockEditor);
    }
  }, [onMount, onChange]);

  const getSuggestions = (text) => {
    if (language !== 'html' || !text || !htmlSnippets) return [];
    
    const matches = Object.keys(htmlSnippets).filter(key => 
      key.toLowerCase().startsWith(text.toLowerCase())
    );
    
    return matches.map(key => ({
      label: key,
      value: htmlSnippets[key],
      description: key === '!' ? 'HTML5 boilerplate' : `<${key}>`
    }));
  };

  const insertSuggestion = (suggestion) => {
  const textarea = textareaRef.current;
  const cursorPos = textarea.selectionStart;
  const textBefore = textarea.value.substring(0, cursorPos);
  const textAfter = textarea.value.substring(cursorPos);
  
  // Find the current word start (alphanumeric + hyphens)
  const match = textBefore.match(/[\w-]*$/);
  const wordStart = match ? cursorPos - match[0].length : cursorPos;
  
  const newValue = 
    textarea.value.substring(0, wordStart) + 
    suggestion.value + 
    textAfter;
  
  onChange(newValue);
  setShowSuggestions(false);
  
  // Place cursor at end of inserted text
  setTimeout(() => {
    const newCursorPos = wordStart + suggestion.value.length;
    textarea.setSelectionRange(newCursorPos, newCursorPos);
    textarea.focus();
  }, 0);
};

  const handleInput = (e) => {
  if (isStreaming) return;
  
  const textarea = e.target;
  const cursorPos = textarea.selectionStart;
  const textBefore = textarea.value.substring(0, cursorPos);
  
  // Only check for suggestions in HTML mode and when snippets are loaded
  if (language === 'html' && htmlSnippets) {
    // Get the current word being typed (alphanumeric + hyphens/underscores)
    const match = textBefore.match(/[\w-]*$/);
    const currentWord = match ? match[0] : '';
    
    if (currentWord.length > 0) {
      const matches = getSuggestions(currentWord);
      if (matches.length > 0) {
        setSuggestions(matches);
        setShowSuggestions(true);
        setSelectedSuggestion(0);
        
        // Calculate position (same as before)
        const rect = textarea.getBoundingClientRect();
        const lineHeight = 21;
        const lines = textBefore.split('\n');
        const currentLineIndex = lines.length - 1;
        setSuggestionPosition({
          top: rect.top + (currentLineIndex * lineHeight) + lineHeight,
          left: rect.left + 16
        });
      } else {
        setShowSuggestions(false);
      }
    } else {
      setShowSuggestions(false);
    }
  } else {
    setShowSuggestions(false);
  }
  
  onChange(e.target.value);
};

const handleKeyDown = (e) => {
  if (showSuggestions) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggestion(prev => 
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggestion(prev => prev > 0 ? prev - 1 : 0);
      return;
    }
    if (e.key === 'Tab' || e.key === 'Enter') {
      if (suggestions[selectedSuggestion]) {
        e.preventDefault();
        insertSuggestion(suggestions[selectedSuggestion]);
        return;
      }
    }
    if (e.key === 'Escape') {
      setShowSuggestions(false);
      return;
    }
  }

  if (e.key === 'Enter' && onEnterKey) {
    const textarea = e.target;
    const lines = textarea.value.split('\n');
    const cursorPosition = textarea.selectionStart;
    const currentLineIndex = textarea.value.substr(0, cursorPosition).split('\n').length - 1;
    const currentLine = lines[currentLineIndex];
    
    if (currentLine.trim().startsWith('xxx ')) {
      e.preventDefault();
      onEnterKey(currentLineIndex, currentLine.trim().substring(4));
    }
  }
};
  
  const getDisplayValue = () => {
    if (!isStreaming || streamingLineNumber === -1) {
      return value;
    }
    
    const lines = value.split('\n');
    lines[streamingLineNumber] = streamingContent;
    return lines.join('\n');
  };
  
  const placeholder = language === 'html' 
    ? "<!-- Write HTML code here -->\n<!-- Type '!' for HTML5 boilerplate -->\n<!-- Start typing HTML tags for suggestions -->\n<!-- Use 'xxx [instruction]' for AI code generation -->\n\n<!DOCTYPE html>\n<html>\n<head>\n  <title>Hello AI</title>\n</head>\n<body>\n  <h1>Hello, AI Compiler!</h1>\n</body>\n</html>"
    : "// Write JavaScript code here\n// Use 'xxx [instruction]' on any line for AI code generation\n// Press Enter after typing xxx instruction to generate code\n\nconsole.log('Hello, AI Compiler!');";
  
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <textarea
        ref={textareaRef}
        style={{
          width: '100%',
          height: height,
          backgroundColor: '#1e1e1e',
          color: '#d4d4d4',
          fontFamily: 'monospace',
          fontSize: '14px',
          border: 'none',
          outline: 'none',
          resize: 'none',
          padding: '8px',
        }}
        value={getDisplayValue()}
        onChange={(e) => {
          if (!isStreaming && onChange) {
            onChange(e.target.value);
          }
        }}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        readOnly={isStreaming}
      />
      
      {showSuggestions && suggestions.length > 0 && (
        <div style={{
          position: 'fixed',
          top: `${suggestionPosition.top}px`,
          left: `${suggestionPosition.left}px`,
          backgroundColor: '#252526',
          border: '1px solid #454545',
          borderRadius: '4px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          minWidth: '250px',
          maxHeight: '300px',
          overflowY: 'auto',
          zIndex: 1000
        }}>
          {suggestions.map((suggestion, index) => (
            <div
              key={suggestion.label}
              onClick={() => insertSuggestion(suggestion)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                backgroundColor: index === selectedSuggestion ? '#094771' : 'transparent',
                color: '#d4d4d4',
                fontSize: '13px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: index < suggestions.length - 1 ? '1px solid #333' : 'none'
              }}
              onMouseEnter={() => setSelectedSuggestion(index)}
            >
              <div>
                <div style={{ fontWeight: '500' }}>{suggestion.label}</div>
                <div style={{ fontSize: '11px', color: '#858585', marginTop: '2px' }}>
                  {suggestion.description}
                </div>
              </div>
              <div style={{ 
                fontSize: '10px', 
                color: '#858585',
                marginLeft: '12px',
                padding: '2px 6px',
                backgroundColor: '#3c3c3c',
                borderRadius: '3px'
              }}>
                Tab
              </div>
            </div>
          ))}
        </div>
      )}
      
      {isStreaming && (
        <div style={{
          position: 'absolute',
          bottom: '16px',
          right: '16px',
          background: 'rgba(0, 123, 204, 0.9)',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '4px',
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <div className="spinner" style={{
            width: '12px',
            height: '12px',
            border: '2px solid #ffffff40',
            borderTop: '2px solid white',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          Generating code...
        </div>
      )}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Editor;