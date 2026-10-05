import React, { useEffect, useRef, useState } from 'react';
import { readable } from './TrainingStage';
import { metricText } from './EvidencePlot';
import './UseShareStage.css';

const ROOT = `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/ml-studio/v1`;
async function request(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error?.message || 'The output service could not respond.'), data.error, { validation_issues: data.validation_issues });
  return data;
}

export default function UseShareStage({ draft, selectionId, showGuidance, onBeforePredict }) {
  const [details, setDetails] = useState(null);
  const [tab, setTab] = useState('Predict');
  const [mode, setMode] = useState('single');
  const [values, setValues] = useState({});
  const [csv, setCsv] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState(null);
  const [pending, setPending] = useState('');
  const [revision, setRevision] = useState(0);
  const live = useRef(false), busy = useRef(false), submission = useRef(null), fileVersion = useRef(0);
  const base = `${ROOT}/drafts/${encodeURIComponent(draft.experiment_id)}`;
  const scope = `workspace_id=${encodeURIComponent(draft.workspace_id)}`;
  useEffect(() => {
    let current = true;
    live.current = true;
    ++fileVersion.current;
    const load = async () => {
      try {
        let id = selectionId;
        if (!id) {
          const state = await request(`${base}/review?${scope}`);
          id = state.selections[0]?.selection_id;
        }
        if (!id) throw new Error('Select a candidate in Review Results before using outputs.');
        const data = await request(`${base}/selections/${encodeURIComponent(id)}?${scope}`);
        if (!current) return;
        setDetails(data); setReceipt(previous => previous?.selection_id === data.selection.selection_id ? previous : data.predictions[0] || null); setError(null);
      } catch (err) { if (current) setError(err); }
    };
    load();
    return () => { current = false; live.current = false; };
  }, [base, scope, selectionId, revision]);
  const outputBase = details ? `${base}/selections/${encodeURIComponent(details.selection.selection_id)}` : '';
  const edit = (name, value) => { setValues(previous => ({ ...previous, [name]: value })); submission.current = null; };
  const chooseFile = async event => {
    const file = event.target.files?.[0];
    const version = ++fileVersion.current;
    setCsv(null); setError(null); submission.current = null;
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError({ message: 'Choose a CSV file smaller than 2 MB.' }); return; }
    try {
      const text = await file.text();
      if (live.current && version === fileVersion.current) setCsv({ name: file.name, text });
    } catch { if (live.current && version === fileVersion.current) setError({ message: 'The CSV file could not be read. Choose it again.' }); }
  };
  const runAction = async (label, action) => {
    if (busy.current) return;
    busy.current = true; setPending(label); setError(null);
    try { await action(); }
    catch (err) { if (live.current) setError(err || { message: 'This action could not finish. Retry or refresh saved outputs.' }); }
    finally { busy.current = false; if (live.current) setPending(''); }
  };
  const predict = () => runAction('predict', async () => {
    const saved = await onBeforePredict({});
    if (!live.current) return;
    if (!saved.success) throw saved.error;
    const payload = { input_schema_version: details.inference_schema.schema_id };
    if (mode === 'csv') payload.csv_text = csv.text;
    else payload.rows = [Object.fromEntries(details.inference_schema.fields.map(field => {
      const value = values[field.name] ?? '';
      return [field.name, value === '' ? null : field.logical_type === 'number' ? Number(value) : value];
    }))];
    if (!submission.current) submission.current = `prediction-${window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
    const data = await request(`${outputBase}/batch-predictions?${scope}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': submission.current }, body: JSON.stringify(payload) });
    if (live.current) { setReceipt(data.prediction); setRevision(value => value + 1); }
  });
  const prepareExports = () => runAction('exports', async () => {
    const data = await request(`${outputBase}/exports?${scope}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    if (live.current) setDetails(previous => ({ ...previous, exports: data.exports }));
  });
  const download = (url, filename) => runAction(`download:${filename}`, async () => {
    const response = await fetch(url);
    if (!response.ok) { const data = await response.json(); throw data.error; }
    const blob = await response.blob();
    if (!live.current) return;
    const address = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = address; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(address), 1000);
  });
  const summary = details?.summary;
  const selectedDevelopment = summary?.development_evidence.candidates.find(item => item.family === details.selection.family);
  return <main className="ml-studio-canvas ml-use-share" aria-label="Use and Share Canvas">
    <div className="ml-stage-heading"><div><span className="ml-eyebrow">A complete local experiment</span><h2>Use & share</h2><p>Make validated predictions, take your model with you, or revisit the evidence.</p></div><span className="ml-task-badge">{draft.task_type}</span></div>
    {error && <div className="prep-alert error" role="alert"><div><strong>{error.message}</strong><p>{error.remediation}</p>{error.validation_issues && <ul>{error.validation_issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul>}</div><button disabled={!!pending} onClick={() => setRevision(value => value + 1)}>Refresh saved outputs</button></div>}
    {!details ? <p role="status">Loading the selected model…</p> : <>
      <section className="ml-selection-banner"><div><span className="ml-eyebrow">{details.current ? 'Selected candidate' : 'Historical selection'}</span><h3>{readable(details.selection.family)}</h3><p>{details.selection.intended_use}</p></div><div className="ml-selection-metric"><span>Final {readable(summary.development_evidence.primary_metric)}</span><strong>{metricText(summary.final_evidence.metrics[summary.development_evidence.primary_metric])}</strong><small>{summary.final_evidence.holdout_rows} reserved rows</small></div></section>
      {!details.current && <p className="ml-guidance" role="status">This selection belongs to earlier settings. Its exports and evidence remain available; new predictions require a current selection.</p>}
      <div className="ml-output-tabs" role="tablist" aria-label="Selected model outputs">{['Predict', 'Exports', 'Local summary'].map(name => <button key={name} id={`ml-output-${name.replace(/ /g, '-')}`} role="tab" aria-selected={tab === name} aria-controls="ml-output-panel" onClick={() => setTab(name)}>{name}</button>)}</div>
      <section id="ml-output-panel" role="tabpanel" aria-labelledby={`ml-output-${tab.replace(/ /g, '-')}`}>
        {tab === 'Predict' && <div className="ml-use-grid"><section className="ml-output-section"><h3>Try the selected model</h3>{showGuidance && <p>Use the same feature meaning and units as training. Blank values follow the saved imputation rules. Predictions describe this model's estimate, not certainty.</p>}<fieldset className="ml-prediction-mode"><legend>Input method</legend><label><input type="radio" checked={mode === 'single'} onChange={() => { setMode('single'); submission.current = null; }} disabled={!!pending} />One row</label><label><input type="radio" checked={mode === 'csv'} onChange={() => { setMode('csv'); submission.current = null; }} disabled={!!pending} />CSV batch</label></fieldset>
          {mode === 'single' ? <div className="ml-prediction-fields">{details.inference_schema.fields.map(field => <label key={field.name}>{field.name}<input type={field.logical_type === 'number' ? 'number' : 'text'} step="any" value={values[field.name] || ''} onChange={event => edit(field.name, event.target.value)} disabled={!!pending} placeholder={field.nullable ? 'Blank uses training imputation' : 'Required'} /></label>)}</div> : <div className="ml-csv-picker"><label>Prediction CSV<input type="file" accept=".csv,text/csv" onChange={chooseFile} disabled={!!pending} /></label><p>{csv ? `${csv.name} ready to validate` : 'UTF-8 CSV with a header row. Up to 10,000 rows and 2 MB.'}</p></div>}
          <button className="semantic-btn primary" disabled={!!pending || !details.current || (mode === 'csv' && !csv)} onClick={predict}>{pending === 'predict' ? 'Validating & predicting…' : 'Run prediction'}</button>
          {receipt && <section className="ml-prediction-result" aria-label="Prediction results"><div className="ml-section-heading"><div><h4>{receipt.row_count} predictions saved</h4><p>{new Date(receipt.created_at).toLocaleString()}</p></div><button className="semantic-btn" disabled={!!pending} onClick={() => download(`${outputBase}/batch-predictions/${encodeURIComponent(receipt.prediction_id)}/download?${scope}`, 'predictions.csv')}>Download predictions</button></div><div className="ml-table-scroll"><table><thead><tr><th>Input row</th><th>Prediction</th></tr></thead><tbody>{receipt.preview.map(row => <tr key={row.input_row}><td>{row.input_row}</td><td>{typeof row.prediction === 'number' ? metricText(row.prediction) : row.prediction}</td></tr>)}</tbody></table></div>{receipt.warnings.map((warning, index) => <p key={index} className="ml-output-note">{warning}</p>)}</section>}
        </section><aside className="ml-output-section ml-schema-panel"><span className="ml-eyebrow">Input contract</span><h3>{details.inference_schema.fields.length} required columns</h3><p>Supply every column; values may be blank when the field allows imputation. Extra columns are rejected.</p><dl>{details.inference_schema.fields.map(field => <React.Fragment key={field.name}><dt>{field.name}</dt><dd>{field.logical_type} · {readable(field.missing_policy)}</dd></React.Fragment>)}</dl><p className="ml-output-note">Categorical values use text. Unknown categories follow the fitted encoder's ignore policy. Classification probabilities are unavailable.</p><details><summary>Schema identity</summary><code>{details.inference_schema.schema_id}</code></details></aside></div>}
        {tab === 'Exports' && <section className="ml-output-section"><div className="ml-section-heading"><div><h3>Take the experiment with you</h3><p>Every download is checked against its registered hash. Load model files only from a trusted source.</p></div><button className="semantic-btn primary" onClick={prepareExports} disabled={!!pending}>{pending === 'exports' ? 'Preparing…' : details.exports.every(item => item.artifact) ? 'Verify exports' : 'Prepare exports'}</button></div><div className="ml-export-list">{details.exports.map(item => <div className="ml-export-row" key={item.kind}><div><strong>{item.description}</strong><span>{item.filename}{item.artifact ? ` · ${Math.max(1, Math.round(item.artifact.size_bytes / 1024))} KB` : ' · prepare to download'}</span>{item.artifact && <details><summary>Integrity receipt</summary><code>{item.artifact.sha256}</code></details>}</div><button className="semantic-btn" disabled={!!pending || !item.artifact} onClick={() => download(`${outputBase}/exports/${item.kind}?${scope}`, item.filename)}>Download {item.filename}</button></div>)}</div><p className="ml-output-note">The fitted pipeline includes preprocessing. The separate preprocessor is available for inspection. Use the recorded Python library versions and the included inference example.</p></section>}
        {tab === 'Local summary' && <section className="ml-output-section ml-cycle-summary"><span className="ml-eyebrow">Local experiment record</span><h3>{details.selection.intended_use}</h3><div className="ml-summary-pair"><div><h4>Decision</h4><p>{readable(details.selection.family)} selected by {details.selection.reviewed_by}.</p><h4>Prohibited use</h4><p>{details.selection.prohibited_use}</p></div><div><h4>Data & method</h4><p>{summary.dataset_snapshot.row_count} rows · {details.configuration.roles.numeric.length + details.configuration.roles.categorical.length} features</p><p>{readable(details.configuration.validation.strategy)} validation · {details.configuration.validation.folds} development folds</p></div></div><h4>Evidence for the selected candidate</h4><div className="ml-table-scroll"><table><thead><tr><th>Metric</th><th>Development mean</th><th>Final holdout</th><th>Final baseline</th></tr></thead><tbody>{Object.entries(summary.final_evidence.metrics).map(([name, value]) => <tr key={name}><th>{readable(name)}</th><td>{metricText(selectedDevelopment?.metrics[name])}</td><td>{metricText(value)}</td><td>{metricText(summary.final_evidence.baseline[name])}</td></tr>)}</tbody></table></div><h4>Limitations</h4><ul>{summary.limitations.map((item, index) => <li key={index}>{item}</li>)}</ul><details><summary>Lineage and reproducibility</summary><dl><dt>Selection</dt><dd>{details.selection.selection_id}</dd><dt>Configuration</dt><dd>{details.selection.configuration_id}</dd><dt>Snapshot</dt><dd>{summary.dataset_snapshot.snapshot_id}</dd><dt>Recipe hash</dt><dd>{summary.dataset_snapshot.transformation_recipe_hash}</dd><dt>Fitted artifact hash</dt><dd>{details.selection.artifact.sha256}</dd></dl></details><p className="ml-output-note">This summary stays local. Download cycle-summary.json from Exports to keep the complete record.</p></section>}
      </section>
    </>}
  </main>;
}
