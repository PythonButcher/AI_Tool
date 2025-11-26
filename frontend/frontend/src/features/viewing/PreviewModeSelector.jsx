// src/components/preview_components/PreviewModeSelector.jsx
import React, { useContext } from 'react';
import { FaBolt, FaSpinner } from 'react-icons/fa';
import { DataContext } from '../../context/DataContext';
import './PreviewModeSelector.css';

function PreviewModeSelector({ previewMode, setPreviewMode }) {
  const { detectAnomalies, isDetecting } = useContext(DataContext);
  return (
    <div className="preview-mode-selector">
      <button
        className={previewMode === 'table' ? 'active' : ''}
        onClick={() => setPreviewMode('table')}
      >
        Table View
      </button>
      <button
        className={previewMode === 'json' ? 'active' : ''}
        onClick={() => setPreviewMode('json')}
      >
        JSON View
      </button>

      {/* Anomaly Detection Button */}
      <button
        onClick={detectAnomalies}
        disabled={isDetecting}
        className={`header-button ${isDetecting ? 'running' : ''}`}
        title="Detect Anomalies"
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-primary)',
          fontSize: '1.2em',
          marginLeft: '10px',
          transition: 'transform 0.2s ease, color 0.2s ease'
        }}
        onMouseOver={(e) => {
          if (!isDetecting) e.currentTarget.style.transform = 'scale(1.1)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        {isDetecting ? (
          <FaSpinner className="autopilot-spinner" aria-hidden="true" />
        ) : (
          <FaBolt aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

export default PreviewModeSelector;
