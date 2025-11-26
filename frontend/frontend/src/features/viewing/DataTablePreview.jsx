// src/components/preview_components/DataTablePreview.jsx
import React, { useState, useContext } from 'react';
import { useHelpOverlay } from '../../context/HelpOverlayContext';
import { DataContext } from '../../context/DataContext';


function DataTablePreview({ label = "Preview Table:", data }) {

  const { isHelpVisible, toggleHelp, closeHelp } = useHelpOverlay();
  const { activeDatasetId } = useContext(DataContext);
  const [anomalies, setAnomalies] = useState([]);
  const [isDetecting, setIsDetecting] = useState(false);

  const helpId = 'dataPreview';

  const detectAnomalies = async () => {
    if (!activeDatasetId) {
      alert("No active dataset found.");
      return;
    }

    setIsDetecting(true);
    try {
      const response = await fetch('http://localhost:5000/api/analyze/outliers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dataset_id: activeDatasetId }),
      });

      const result = await response.json();
      if (response.ok) {
        setAnomalies(result.outlier_indices || []);
        if (result.count === 0) {
          alert("No anomalies detected.");
        }
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error("Error detecting anomalies:", error);
      alert("Failed to detect anomalies.");
    } finally {
      setIsDetecting(false);
    }
  };

  if (!Array.isArray(data) || data.length === 0) {
    return <div>No data to display.</div>;
  }


  const columns = Object.keys(data[0]);


  return (
    <div className="data-table-preview">
      <table className="data-table">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <button
            type="button"
            className="help-overlay-trigger"
            onClick={() => toggleHelp('dataPreview')}
          >
            ❓
          </button>
          <button
            onClick={detectAnomalies}
            disabled={isDetecting}
            style={{
              backgroundColor: 'var(--border-color)',
              fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
              color: 'var(--text-primary)',
              border: '1px solid var(--text-secondary)',
              padding: '6px 12px',
              cursor: 'pointer',
              borderRadius: '4px',
              transition: 'background-color 0.3s ease, transform 0.2s ease',
              opacity: isDetecting ? 0.7 : 1
            }}
            onMouseOver={(e) => {
              if (!isDetecting) {
                e.currentTarget.style.backgroundColor = 'var(--text-secondary)';
                e.currentTarget.style.transform = 'scale(1.05)';
              }
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--border-color)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            {isDetecting ? 'Detecting...' : 'Detect Anomalies'}
          </button>
        </div>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={idx} style={{ backgroundColor: anomalies.includes(idx) ? 'rgba(255, 0, 0, 0.1)' : 'inherit' }}>
              {columns.map((col) => (
                <td key={col}>
                  {typeof row[col] === 'object' ? JSON.stringify(row[col]) : row[col]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {/* ✅ Help Overlay */}
      {isHelpVisible('dataPreview') && (
        <div className="help-overlay visible">
          <div className="help-overlay-content">
            <span
              className="help-overlay-close"
              onClick={() => closeHelp('dataPreview')}
            >
              ×
            </span>
            <h3>Understanding the Data Preview</h3>
            <ol>
              <li>The preview shows a limited sample of your dataset — a few rows to help you confirm that your upload loaded correctly.</li>
              <li>Below the table, you’ll see a summary similar to <code>pandas.DataFrame.info()</code>, listing each column’s data type, number of non-null entries, and any missing values.</li>
              <li>Use this information to quickly identify data quality issues before cleaning or visualization.</li>
              <li>Switch between preview modes (table or JSON) to inspect your data from different perspectives.</li>
            </ol>
            <p>
              Tip: The Data Preview is read-only — make adjustments using the cleaning tools or AI commands instead of editing directly here.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataTablePreview;
