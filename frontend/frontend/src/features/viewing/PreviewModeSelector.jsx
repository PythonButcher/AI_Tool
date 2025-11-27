// src/components/preview_components/PreviewModeSelector.jsx
import React, { useContext } from 'react';
import './PreviewModeSelector.css';
import { DataContext } from '../../context/DataContext';

function PreviewModeSelector({ previewMode, setPreviewMode }) {
  const { detectAnomalies, isDetecting } = useContext(DataContext);
  return (
    <div className="preview-mode-selector">
      <button
        className="anomaly-detect-btn"
        onClick={detectAnomalies}
        disabled={isDetecting}
        title="Detect outliers"
      >
        {isDetecting ? '⏳' : '⚡'}
      </button>
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
    </div>
  );
}

export default PreviewModeSelector;
