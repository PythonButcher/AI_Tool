// src/components/preview_components/DataTablePreview.jsx
import React, { useContext } from 'react';
import { useHelpOverlay } from '../../context/HelpOverlayContext';
import { DataContext } from '../../context/DataContext';


function DataTablePreview({ label = "Preview Table:", data }) {

  const { isHelpVisible, toggleHelp, closeHelp } = useHelpOverlay();
  const helpId = 'dataPreview';
  const { anomalies } = useContext(DataContext);
  if (!Array.isArray(data) || data.length === 0) {
    return <div>No data to display.</div>;
  }


  const columns = Object.keys(data[0]);


  return (
    <div className="data-table-preview">
      <div
        className="data-preview-toolbar"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px',
        }}
      >
        <span style={{ fontWeight: 'bold' }}>{label}</span>
        <button
          type="button"
          className="help-overlay-trigger"
          onClick={() => toggleHelp(helpId)}
        >
          ❓
        </button>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr
              key={idx}
              style={anomalies.includes(idx) ? { backgroundColor: 'var(--accent-yellow-soft)' } : undefined}
            >
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
      {isHelpVisible(helpId) && (
        <div className="help-overlay visible">
          <div className="help-overlay-content">
            <span
              className="help-overlay-close"
              onClick={() => closeHelp(helpId)}
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
