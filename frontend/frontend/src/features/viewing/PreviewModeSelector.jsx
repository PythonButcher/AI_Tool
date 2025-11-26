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

      <button
        onClick={detectAnomalies}
        disabled={isDetecting}
        className="icon-button"
        title="Detect Anomalies"
        aria-label="Detect anomalies"
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
