// src/components/preview_components/DataTablePreview.jsx
import React from 'react';


function DataTablePreview({ data }) {
  if (!Array.isArray(data) || data.length === 0) {
    return <div>No data to display.</div>;
  }

  const columns = Object.keys(data[0]);

  return (
    <div className="data-table-preview">
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
            <tr key={idx}>
              {columns.map((col) => (
                <td key={col}>
                  {typeof row[col] === 'object' ? JSON.stringify(row[col]) : row[col]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default DataTablePreview;
