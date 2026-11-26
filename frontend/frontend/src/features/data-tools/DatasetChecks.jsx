import React, { useState } from 'react';
import { FieldSelect, RowsGrid } from './WorkbenchControls';
import { findDuplicateRows, findInvalidRows, summarizeWorkingRows } from './workingRows';

export function ValidateValues({ rows, fields }) {
  const [field, setField] = useState(fields[0].name);
  const [requirement, setRequirement] = useState('required');
  const [minimum, setMinimum] = useState('');
  const [maximum, setMaximum] = useState('');
  const [allowedText, setAllowedText] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const invalid = result?.source === rows ? result.indices : null;

  function run(event) {
    event.preventDefault();
    const lower = Number(minimum);
    const upper = Number(maximum);
    const allowed = allowedText.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
    if (requirement === 'range' && (!minimum || !maximum || !Number.isFinite(lower) || !Number.isFinite(upper) || lower > upper)) {
      setError('Enter a valid minimum and maximum. The minimum must be at or below the maximum.');
      return;
    }
    if (requirement === 'allowed' && allowed.length === 0) {
      setError('Enter at least one allowed value.');
      return;
    }
    setError('');
    setResult({ source: rows, indices: findInvalidRows(rows, { field, requirement, minimum: lower, maximum: upper, allowed }) });
  }

  return (
    <>
      <header className="dt-panel__intro">
        <h2>Validate values</h2>
        <p>Check a field across all loaded rows and review the rows that fail your rule.</p>
      </header>
      <form className="dt-controls" onSubmit={run} onChange={() => { setResult(null); setError(''); }}>
        <FieldSelect fields={fields} label="Field to validate" value={field} onChange={setField} />
        <label className="dt-field">Requirement
          <select value={requirement} onChange={event => setRequirement(event.target.value)}>
            <option value="required">Has a value</option>
            <option value="number">Is a number</option>
            <option value="range">Is within a numeric range</option>
            <option value="allowed">Matches an allowed value</option>
          </select>
        </label>
        {requirement === 'range' && (
          <>
            <label className="dt-field">Minimum<input type="number" step="any" required value={minimum} onChange={event => setMinimum(event.target.value)} /></label>
            <label className="dt-field">Maximum<input type="number" step="any" required value={maximum} onChange={event => setMaximum(event.target.value)} /></label>
          </>
        )}
        {requirement === 'allowed' && (
          <label className="dt-field">Allowed values, one per line
            <textarea rows={3} value={allowedText} onChange={event => setAllowedText(event.target.value)} />
          </label>
        )}
        <button className="dt-button dt-button--primary" type="submit">Run validation</button>
      </form>
      {requirement === 'range' && <p className="dt-check-note">The range includes both bounds and requires numeric values.</p>}
      {requirement === 'allowed' && <p className="dt-check-note">Matching is case-sensitive.</p>}
      {error && <p className="dt-result dt-result--error" role="alert">{error}</p>}
      {invalid && (
        <>
          <p className="dt-result" role="status">{invalid.length ? `${invalid.length.toLocaleString()} of ${rows.length.toLocaleString()} rows failed.` : `All ${rows.length.toLocaleString()} rows passed.`}</p>
          {invalid.length > 0 && <RowsGrid rows={rows} fields={fields} indices={invalid} caption="Rows that failed validation" />}
        </>
      )}
    </>
  );
}

export function CheckKeys({ rows, fields }) {
  const [selected, setSelected] = useState([fields[0].name]);
  const [result, setResult] = useState(null);
  const [view, setView] = useState('all');
  const report = result?.source === rows ? result : null;
  const issues = report?.views[view];

  function toggle(field) {
    setSelected(current => current.includes(field) ? current.filter(name => name !== field) : [...current, field]);
    setResult(null);
  }

  function run(event) {
    event.preventDefault();
    if (!selected.length) return;
    const { indices, missingIndices } = findDuplicateRows(rows, selected, { skipMissing: true });
    setResult({ source: rows, views: {
      all: [...missingIndices, ...indices].sort((a, b) => a - b),
      missing: missingIndices,
      repeated: indices,
    } });
    setView('all');
  }

  return (
    <>
      <header className="dt-panel__intro">
        <h2>Check keys</h2>
        <p>Check whether one field or a combination of fields identifies each loaded row. Use this before choosing join fields in Data Model.</p>
      </header>
      <form className="dt-controls" onSubmit={run}>
        <fieldset className="dt-key-fields">
          <legend>Key fields</legend>
          {fields.map(({ name }) => (
            <label key={name}><input type="checkbox" checked={selected.includes(name)} onChange={() => toggle(name)} />{name}</label>
          ))}
        </fieldset>
        <button className="dt-button dt-button--primary" type="submit" disabled={!selected.length}>Run key check</button>
      </form>
      {report && (
        <>
          <p className="dt-result" role="status">{report.views.all.length
            ? `${report.views.missing.length.toLocaleString()} rows with missing key values · ${report.views.repeated.length.toLocaleString()} rows with repeated keys.`
            : `The selected key is complete and unique across ${rows.length.toLocaleString()} loaded rows.`}</p>
          {report.views.all.length > 0 && (
            <>
              <div className="dt-controls">
                <label className="dt-field">Show issue
                  <select value={view} onChange={event => setView(event.target.value)}>
                    <option value="all">All issues</option>
                    <option value="missing">Missing key values</option>
                    <option value="repeated">Repeated keys</option>
                  </select>
                </label>
              </div>
              <RowsGrid key={view} rows={rows} fields={fields} indices={issues} caption="Key issues" />
            </>
          )}
        </>
      )}
    </>
  );
}

export function SummarizeRows({ rows, fields }) {
  const [groupBy, setGroupBy] = useState(fields[0].name);
  const [thenBy, setThenBy] = useState('');
  const [measure, setMeasure] = useState('');
  const [result, setResult] = useState(null);
  const report = result?.source === rows ? result : null;

  function run(event) {
    event.preventDefault();
    const dimensions = thenBy ? [groupBy, thenBy] : [groupBy];
    const columns = dimensions.map((label, index) => ({ name: `group${index}`, label }));
    columns.push({ name: 'rowCount', label: 'Row count' });
    if (measure) columns.push(
      { name: 'numericCount', label: 'Numeric values' },
      { name: 'total', label: `Total of ${measure}` },
      { name: 'average', label: `Average of ${measure}` },
    );
    const groups = summarizeWorkingRows(rows, dimensions, measure);
    const summary = groups.map(group => ({
      ...Object.fromEntries(group.values.map((value, index) => [`group${index}`, value])),
      rowCount: group.rowCount,
      numericCount: group.numericCount,
      total: group.numericCount && Number.isFinite(group.total) ? group.total : null,
      average: group.numericCount && Number.isFinite(group.total) ? group.total / group.numericCount : null,
    }));
    setResult({ source: rows, columns, summary });
  }

  return (
    <>
      <header className="dt-panel__intro">
        <h2>Summarize rows</h2>
        <p>Group all loaded rows to check counts, totals, and averages. Use Power Query to apply a grouped transformation.</p>
      </header>
      <form className="dt-controls" onSubmit={run} onChange={() => setResult(null)}>
        <FieldSelect fields={fields} label="Group by" value={groupBy} onChange={value => {
          setGroupBy(value);
          if (value === thenBy) setThenBy('');
        }} />
        {fields.length > 1 && <FieldSelect fields={fields.filter(({ name }) => name !== groupBy)} label="Then by" value={thenBy} onChange={setThenBy} emptyLabel="No second field" />}
        <FieldSelect fields={fields} label="Measure" value={measure} onChange={setMeasure} emptyLabel="Count rows only" />
        <button className="dt-button dt-button--primary" type="submit">Run summary</button>
      </form>
      {measure && <p className="dt-check-note">Totals and averages use numeric values. Empty and non-numeric values still count toward the row count.</p>}
      {report && (
        <>
          <p className="dt-result" role="status">{`${report.summary.length.toLocaleString()} ${report.summary.length === 1 ? 'group' : 'groups'} across ${rows.length.toLocaleString()} loaded rows.`}</p>
          <RowsGrid rows={report.summary} fields={report.columns} caption="Grouped results" showJson={false} />
        </>
      )}
    </>
  );
}
