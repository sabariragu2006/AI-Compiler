import React from 'react';
import { Play, Bot, Zap, Settings, Trash2 } from 'lucide-react';

const Navbar = ({
  onRun,
  onAIFix,
  onProcessInline,
  onClear,
  model,
  onModelChange,
  autoProcessInline,
  onAutoProcessChange,
  loadingRun,
  loadingAI,
  loadingInline,
  canUseAI,
  hasInlinePrompts,
  awaitingInput,
  connectionStatus,
  fileManager,
  // Removed fileType props
  onHTMLFileClick, // new prop
}) => {
  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0.75rem 1.5rem',
      backgroundColor: '#2a2a2a',
      borderRadius: '8px',
      marginBottom: '1rem',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
      flexWrap: 'wrap',
      gap: '1rem'
    }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <h1 style={{
          margin: 0,
          fontSize: '20px',
          fontWeight: 'bold',
          color: '#fff',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          🚀 BabyCompiler
        </h1>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 10px',
          backgroundColor: connectionStatus === 'connected' ? '#28a745' : '#dc3545',
          borderRadius: '4px',
          fontSize: '12px',
          color: 'white'
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: 'white'
          }} />
          {connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
        </div>

        {/* File Manager */}
        <div onClick={onHTMLFileClick}>
          {fileManager}
        </div>
      </div>

      {/* Run / AI / Inline Buttons */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={onRun} disabled={loadingRun || awaitingInput} style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.6rem 1.2rem',
          backgroundColor: (loadingRun || awaitingInput) ? '#555' : '#4CAF50',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: (loadingRun || awaitingInput) ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          fontWeight: '600',
          transition: 'all 0.2s ease'
        }}>
          {loadingRun ? <>⏳ Running...</> : <><Play size={16} />Run</>}
        </button>
        
        <button onClick={onAIFix} disabled={loadingAI || !canUseAI} style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.6rem 1.2rem',
          backgroundColor: loadingAI ? '#666' : (canUseAI ? '#2196F3' : '#555'),
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: (loadingAI || !canUseAI) ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          fontWeight: '600',
          transition: 'all 0.2s ease'
        }}>
          {loadingAI ? <>🔄 Fixing...</> : <><Bot size={16} />AI Fix</>}
        </button>

        <button onClick={onProcessInline} disabled={loadingInline || !hasInlinePrompts} style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.6rem 1.2rem',
          backgroundColor: loadingInline ? '#666' : (hasInlinePrompts ? '#FF9800' : '#555'),
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: (loadingInline || !hasInlinePrompts) ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          fontWeight: '600',
          transition: 'all 0.2s ease'
        }}>
          {loadingInline ? <>⚡ Processing...</> : <><Zap size={16} />Inline</>}
        </button>
      </div>

      {/* Settings / Model / Auto / Clear */}
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Settings size={16} style={{ color: '#888' }} />
          <select value={model} onChange={(e) => onModelChange(e.target.value)} style={{
            padding: '0.4rem 0.8rem',
            borderRadius: '4px',
            border: '1px solid #555',
            backgroundColor: '#3a3a3a',
            color: '#fff',
            fontSize: '14px',
            cursor: 'pointer'
          }}>
            <option value="qwen">Qwen</option>
            <option value="deepseek">DeepSeek</option>
          </select>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '14px', cursor: 'pointer', userSelect: 'none' }}>
          <input type="checkbox" checked={autoProcessInline} onChange={(e) => onAutoProcessChange(e.target.checked)} style={{ cursor: 'pointer' }} />
          <span>Auto-process</span>
        </label>

        <button onClick={onClear} style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.6rem 1.2rem',
          backgroundColor: '#ff6b6b',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: '600',
          transition: 'all 0.2s ease'
        }}>
          <Trash2 size={16} /> Clear
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
