// src/components/preview_components/PreviewModeSelector.jsx
import React from 'react';
import '../css/viewing_css/PreviewModeSelector.css';  

function PreviewModeSelector({ previewMode, setPreviewMode }) {
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
    </div>
  );
}

export default PreviewModeSelector;
