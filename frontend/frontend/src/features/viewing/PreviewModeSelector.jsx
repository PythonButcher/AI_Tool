// src/components/preview_components/PreviewModeSelector.jsx
import React, { useContext, useMemo, useState } from 'react';
import { FaBolt, FaSpinner } from 'react-icons/fa';
import { DataContext, useActiveDataset } from '../../context/DataContext';
import './PreviewModeSelector.css';

function PreviewModeSelector({ previewMode, setPreviewMode }) {
  const { setAnomalies } = useContext(DataContext);
  const activeDataset = useActiveDataset();
  const [isDetecting, setIsDetecting] = useState(false);

  const activeDatasetId = useMemo(() => {
    if (!activeDataset) return null;
    if (activeDataset.dataset_id) return activeDataset.dataset_id;
    if (activeDataset.id) return activeDataset.id;
    if (Array.isArray(activeDataset) && activeDataset.length > 0) {
      const sampleRow = activeDataset[0];
      return sampleRow.dataset_id || sampleRow.id || null;
    }
    return null;
  }, [activeDataset]);

  const handleDetectAnomalies = async () => {
    if (!activeDatasetId) {
      alert('Unable to detect anomalies: missing active dataset.');
      return;
    }

    setIsDetecting(true);
    try {
      const response = await fetch('/api/analyze/outliers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dataset_id: activeDatasetId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to detect anomalies.');
      }

      const indices = result?.outlier_indices ?? [];
      setAnomalies(indices);

      if (!indices.length) {
        alert('No anomalies detected.');
      }
    } catch (error) {
      console.error('Error detecting anomalies:', error);
      alert('Failed to detect anomalies.');
    } finally {
      setIsDetecting(false);
    }
  };

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
        onClick={handleDetectAnomalies}
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
