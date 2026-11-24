import React, { useState } from 'react';
import { displayCell } from './workingRows';

const PAGE_SIZE = 25;

export function RowsGrid({ rows, fields, indices, caption, showJson = true }) {
  const [page, setPage] = useState(0);
  const [format, setFormat] = useState('table');
  const count = indices?.length ?? rows.length;
  const lastPage = Math.max(0, Math.ceil(count / PAGE_SIZE) - 1);
  const currentPage = Math.min(page, lastPage);
  const start = currentPage * PAGE_SIZE;
  const pageRows = indices ? indices.slice(start, start + PAGE_SIZE).map(index => rows[index]) : rows.slice(start, start + PAGE_SIZE);

  return (
    <div className="dt-grid">
      <div className="dt-grid__bar">
        <h3>{caption}</h3>
        {showJson && (
          <div className="dt-grid__formats" role="group" aria-label="Row display">
            <button type="button" aria-pressed={format === 'table'} onClick={() => setFormat('table')}>Table</button>
            <button type="button" aria-pressed={format === 'json'} onClick={() => setFormat('json')}>JSON</button>
          </div>
        )}
      </div>
      {count === 0 ? <p className="dt-empty-inline">There are no rows to display.</p> : format === 'json' ? (
        <pre className="dt-grid__scroll">{JSON.stringify(pageRows, null, 2)}</pre>
      ) : (
        <div className="dt-grid__scroll" role="region" aria-label={`${caption} scroll area`} tabIndex={0}>
          <table aria-label={caption}>
            <thead><tr>
              {indices && <th scope="col">Source row</th>}
              {fields.map(({ name, label }) => <th scope="col" key={name}>{label ?? name}</th>)}
            </tr></thead>
            <tbody>{pageRows.map((row, offset) => (
              <tr key={start + offset}>
                {indices && <th scope="row">{indices[start + offset] + 1}</th>}
                {fields.map(({ name }) => {
                  const value = displayCell(row?.[name]);
                  return <td key={name} title={value || undefined}>{value || <span className="dt-null" aria-label="Empty">—</span>}</td>;
                })}
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <div className="dt-grid__footer">
        <span aria-live="polite">{count ? `${(start + 1).toLocaleString()}–${Math.min(start + PAGE_SIZE, count).toLocaleString()} of ${count.toLocaleString()} rows` : '0 rows'}</span>
        <div>
          <button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button>
          <button type="button" disabled={currentPage === lastPage} onClick={() => setPage(currentPage + 1)}>Next</button>
        </div>
      </div>
    </div>
  );
}

export function FieldSelect({ fields, label, value, onChange, emptyLabel }) {
  return (
    <label className="dt-field">
      {label}
      <select value={value} onChange={event => onChange(event.target.value)}>
        {emptyLabel && <option value="">{emptyLabel}</option>}
        {fields.map(({ name }) => <option key={name} value={name}>{name}</option>)}
      </select>
    </label>
  );
}
