// src/App.jsx
import React, { useState, useEffect } from 'react';
import AICompiler from './components/AICompiler';

const App = () => {
  const [currentFile, setCurrentFile] = useState(null);
  const [code, setCode] = useState('// Write JavaScript code here\n// Use "xxx [instruction]" on any line for AI code generation\n// Examples:\n// xxx create a function to reverse a string\n// xxx make a fibonacci sequence generator\n\nconsole.log("Hello, AI Compiler!");');

  // Handle file selection from sidebar
  const handleFileSelect = (file) => {
    setCurrentFile(file);
    setCode(file.content || '');
  };

  // Handle code changes from editor
  const handleCodeChange = (newCode) => {
    setCode(newCode);
    // Auto-save functionality will be handled in AICompiler component
  };

  return (
    <div style={{ 
      display: 'flex', 
      height: '100vh',
      width: '100vw',
      margin: 0,
      padding: 0,
      backgroundColor: '#1a1a1a',
      overflow: 'hidden'
    }}>
    
      
      {/* Main Editor Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <AICompiler 
          code={code}
          setCode={handleCodeChange}
          currentFile={currentFile}
          setCurrentFile={setCurrentFile}
        />
      </div>
    </div>
  );
};

export default App;