import React from 'react';
import { FaTable } from 'react-icons/fa';

const renderCell = value => {
  if (value == null) return '—';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
};

const DataCleaningPreview = ({ rows, columns, totalRows, isResult, hasDataset }) => {
  const heading = isResult ? 'Preview of applied steps' : 'Current data';
  return (
    <div className="preview-container">
      <div className="cleaning-preview-heading">
        <h3>{heading}</h3>
        {hasDataset && <span>{rows.length.toLocaleString()} of {totalRows.toLocaleString()} rows · {columns.length} fields</span>}
      </div>
      {rows.length > 0 ? (
        <div className="table-scroll">
          <table className="preview-table" aria-label={heading}>
            <thead>
              <tr>
                {columns.map((key) => (
                  <th key={key} scope="col">{key}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx}>
                  {columns.map((key) => (
                    <td key={key}>{renderCell(row?.[key])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <FaTable className="empty-icon" aria-hidden="true" />
          <p>{isResult ? 'These steps returned no rows.' : hasDataset ? 'This dataset has no rows.' : 'Upload data or open a saved dataset to begin.'}</p>
        </div>
      )}
    </div>
  );
};

export default DataCleaningPreview;
