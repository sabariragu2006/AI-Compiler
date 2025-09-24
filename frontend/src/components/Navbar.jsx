import React from 'react';
import { Play, Zap, Bot, Trash2, Settings } from 'lucide-react';

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
  awaitingInput
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
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
    }}>
      {/* Left side - Website Name */}
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

      {/* Center - Main action buttons */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <button 
          onClick={onRun} 
          disabled={loadingRun || awaitingInput}
          style={{
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
          }}
          onMouseEnter={(e) => {
            if (!loadingRun && !awaitingInput) {
              e.target.style.backgroundColor = '#45a049';
              e.target.style.transform = 'translateY(-1px)';
            }
          }}
          onMouseLeave={(e) => {
            if (!loadingRun && !awaitingInput) {
              e.target.style.backgroundColor = '#4CAF50';
              e.target.style.transform = 'translateY(0)';
            }
          }}
        >
          {loadingRun ? (
            <>⏳ Running...</>
          ) : (
            <>
              <Play size={16} />
              Run
            </>
          )}
        </button>
        
        <button
          onClick={onAIFix}
          disabled={loadingAI || !canUseAI}
          style={{
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
          }}
          onMouseEnter={(e) => {
            if (!loadingAI && canUseAI) {
              e.target.style.backgroundColor = '#1976D2';
              e.target.style.transform = 'translateY(-1px)';
            }
          }}
          onMouseLeave={(e) => {
            if (!loadingAI && canUseAI) {
              e.target.style.backgroundColor = '#2196F3';
              e.target.style.transform = 'translateY(0)';
            }
          }}
        >
          {loadingAI ? (
            <>🔄 Fixing...</>
          ) : (
            <>
              <Bot size={16} />
              AI Fix
            </>
          )}
        </button>
        
        <button
          onClick={onProcessInline}
          disabled={loadingInline || !hasInlinePrompts}
          style={{
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
          }}
          onMouseEnter={(e) => {
            if (!loadingInline && hasInlinePrompts) {
              e.target.style.backgroundColor = '#F57C00';
              e.target.style.transform = 'translateY(-1px)';
            }
          }}
          onMouseLeave={(e) => {
            if (!loadingInline && hasInlinePrompts) {
              e.target.style.backgroundColor = '#FF9800';
              e.target.style.transform = 'translateY(0)';
            }
          }}
        >
          {loadingInline ? (
            <>⚡ Processing...</>
          ) : (
            <>
              <Zap size={16} />
              Inline
            </>
          )}
        </button>
      </div>

      {/* Right side - Settings and Clear */}
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Settings size={16} style={{ color: '#888' }} />
          <select 
            value={model} 
            onChange={(e) => onModelChange(e.target.value)}
            style={{
              padding: '0.4rem 0.8rem',
              borderRadius: '4px',
              border: '1px solid #555',
              backgroundColor: '#3a3a3a',
              color: '#fff',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            <option value="qwen">Qwen (Free)</option>
            <option value="deepseek">DeepSeek (Free)</option>
          </select>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem',
            fontSize: '14px',
            cursor: 'pointer',
            userSelect: 'none'
          }}>
            <input
              type="checkbox"
              checked={autoProcessInline}
              onChange={(e) => onAutoProcessChange(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span>Auto-process</span>
          </label>
        </div>

        <button
          onClick={onClear}
          style={{
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
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#ff5252';
            e.target.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = '#ff6b6b';
            e.target.style.transform = 'translateY(0)';
          }}
        >
          <Trash2 size={16} />
          Clear
        </button>
      </div>
    </nav>
  );
};

export default Navbar;