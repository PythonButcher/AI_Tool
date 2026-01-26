import React from 'react';
import { FaTable } from 'react-icons/fa';

const DataCleaningPreview = ({ previewRows }) => {
  return (
    <div className="preview-container">
      {previewRows && previewRows.length > 0 ? (
        <div className="table-scroll">
          <table className="preview-table">
            <thead>
              <tr>
                {Object.keys(previewRows[0]).map((key) => (
                  <th key={key}>{key}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, idx) => (
                <tr key={idx}>
                  {Object.keys(previewRows[0]).map((key) => (
                    <td key={`${idx}-${key}`}>{row[key]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <FaTable className="empty-icon" />
          <p>Add steps from the ribbon above and click "Run Preview" to see results.</p>
        </div>
      )}
    </div>
  );
};

export default DataCleaningPreview;
