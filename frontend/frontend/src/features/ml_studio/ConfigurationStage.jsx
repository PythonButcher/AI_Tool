import React, { useEffect, useRef, useState } from 'react';
import './ConfigurationStage.css';

const ROOT = `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/ml-studio/v1`;
const MODELS = { regression: ['regularized_linear', 'random_forest'], classification: ['logistic', 'random_forest'], forecasting: ['lagged_ridge', 'lagged_forest'], clustering: ['kmeans', 'mini_batch_kmeans'], anomaly_detection: ['isolation_forest', 'local_outlier_factor'] };
const LABELS = { regularized_linear: 'Regularized linear model', random_forest: 'Random forest', logistic: 'Logistic classifier', lagged_ridge: 'Regularized lag model', lagged_forest: 'Random forest with lags', kmeans: 'K-means', mini_batch_kmeans: 'Mini-batch K-means', isolation_forest: 'Isolation forest', local_outlier_factor: 'Local outlier factor (new-row scoring)' };
const METRICS = { regression: [['rmse', 'RMSE'], ['mae', 'MAE']], classification: [['balanced_accuracy', 'Balanced accuracy'], ['weighted_f1', 'Weighted F1']], forecasting: [['rmse', 'RMSE'], ['mae', 'MAE']], clustering: [['silhouette', 'Silhouette separation'], ['stability_ari', 'Resampling stability (ARI)']], anomaly_detection: [['score_stability', 'Score rank stability'], ['roc_auc', 'ROC AUC (requires labels)']] };
const emptyRoles = { target: null, numeric: [], categorical: [], ignored: [], time: [], group: [] };

export default function ConfigurationStage({ draft, showGuidance, onEdit, onAssess, onContinue, canTrain }) {
  const forecasting = draft.task_type === 'forecasting';
  const clustering = draft.task_type === 'clustering';
  const anomaly = draft.task_type === 'anomaly_detection';
  const [roles, setRoles] = useState({ ...emptyRoles, ...draft.roles });
  const [validation, setValidation] = useState({ ...(forecasting ? { strategy: 'rolling_origin', folds: 3, seed: 42, horizon: 7, frequency: 'D', lags: 7, season_length: 7, future_features_known: false } : { strategy: draft.task_type === 'classification' ? 'stratified' : 'random', holdout_fraction: .2, folds: 3, seed: 42 }), ...draft.validation });
  const [metric, setMetric] = useState({ primary: METRICS[draft.task_type]?.[0][0], ...draft.metric });
  const [candidate, setCandidate] = useState({ families: MODELS[draft.task_type] || [], ...(clustering ? { cluster_count: 3 } : anomaly ? { contamination: .05, neighbors: 20 } : {}), ...draft.candidate });
  const [resource, setResource] = useState({ max_rows: 50000, max_features: 100, timeout_seconds: 120, ...draft.resource });
  const [schema, setSchema] = useState(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);
  const [edited, setEdited] = useState(false);
  const live = useRef(true);
  const busy = useRef(false);
  useEffect(() => {
    let current = true;
    live.current = true;
    if (!draft.snapshot_id) {
      setError({ message: 'Select and save a dataset in Data & Goal before configuring.' });
      return () => { live.current = false; };
    }
    fetch(`${ROOT}/snapshots/${encodeURIComponent(draft.snapshot_id)}`).then(async response => {
      const data = await response.json();
      if (!response.ok) throw data.error || new Error('Unable to load the saved schema.');
      if (current) setSchema(data.snapshot.column_profile);
    }).catch(err => { if (current) setError(err); });
    return () => { current = false; live.current = false; };
  }, [draft.snapshot_id]);

  const edit = (key, value, setter) => {
    setter(value); setEdited(true); setError(null); onEdit({ [key]: value });
  };
  const roleFor = column => roles.target === column ? 'target' : ['numeric', 'categorical', 'time', 'group'].find(role => roles[role].includes(column)) || 'ignored';
  const assign = (column, role) => {
    const next = Object.fromEntries(Object.entries(roles).map(([key, value]) => [key, key === 'target' ? (value === column ? null : value) : value.filter(item => item !== column)]));
    if (role === 'target') next.target = column;
    else next[role].push(column);
    edit('roles', next, setRoles);
  };
  const assess = async () => {
    if (busy.current) return;
    busy.current = true; setPending(true); setError(null);
    try {
      const result = await onAssess({ roles, validation, metric, candidate, resource });
      if (!live.current) return;
      if (!result.success) setError(result.error);
      else setEdited(false);
    } catch (err) {
      if (live.current) setError({ message: err.message || 'Assessment could not finish. Retry with these settings.' });
    } finally { busy.current = false; if (live.current) setPending(false); }
  };
  const assessment = draft.assessment;
  const issues = assessment?.issues || [];
  const stale = edited || Boolean(assessment && !draft.assessment_current);
  const visible = (schema || []).filter(column => column.name.toLowerCase().includes(query.toLowerCase()));
  return <main className="ml-studio-canvas ml-configuration" aria-label="Configuration Canvas">
    <div className="ml-stage-heading"><div><span className="ml-eyebrow">Design your experiment</span><h2>Configure</h2><p>Choose what the model learns and how you will judge it.</p></div><span className="ml-task-badge">{draft.task_type}</span></div>
    {error && <div className="prep-alert error" role="alert"><div><strong>{error.message}</strong><p>{error.remediation}</p></div></div>}
    <div className="ml-configuration-grid">
      <section className="ml-role-panel" aria-label="Column roles">
        <div className="ml-section-heading"><div><h3>Column roles</h3><p>{roles.numeric.length + roles.categorical.length} features · {clustering ? 'no target needed' : anomaly ? roles.target ? 'evaluation labels assigned' : 'evaluation labels optional' : roles.target ? 'target assigned' : 'choose a target'}</p></div><label>Find a column<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search columns" /></label></div>
        {showGuidance && <p className="ml-guidance">Each column has one role. Keep IDs and information unavailable at prediction time out of the features. Preprocessing is fitted inside training partitions.</p>}
        {!schema ? <p role="status">Loading saved schema…</p> : <div className="ml-table-scroll"><table><thead><tr><th>Column</th><th>Data type</th><th>Missing</th><th>Role</th></tr></thead><tbody>{visible.map(column => <tr key={column.name}><th scope="row">{column.name}</th><td>{column.logical_type}</td><td>{column.null_count}</td><td><select aria-label={`Role for ${column.name}`} value={roleFor(column.name)} disabled={pending} onChange={event => assign(column.name, event.target.value)}><option value="ignored">Ignore</option><option value="target" disabled={clustering}>{anomaly ? 'Evaluation label (0 / 1)' : 'Target'}</option><option value="numeric">Numeric feature</option><option value="categorical">Categorical feature</option><option value="time">Time</option><option value="group">{forecasting ? 'Series key' : 'Group'}</option></select></td></tr>)}</tbody></table>{visible.length === 0 && <p>No columns match this search.</p>}</div>}
      </section>
      <section className="ml-settings-panel" aria-label="Evaluation settings"><h3>Trustworthy comparison</h3>
        <label>Validation strategy<select value={validation.strategy} disabled={pending || forecasting} onChange={event => edit('validation', { ...validation, strategy: event.target.value }, setValidation)}>{forecasting ? <option value="rolling_origin">Rolling forecast origins</option> : <><option value="random">Random folds</option>{draft.task_type === 'classification' && <option value="stratified">Stratified folds</option>}<option value="time_ordered">Time ordered</option><option value="grouped">Separate groups</option></>}</select></label>
        <div className="ml-field-pair">{forecasting ? <label>Forecast horizon<input type="number" min="1" max="48" value={validation.horizon} disabled={pending} onChange={event => edit('validation', { ...validation, horizon: Number(event.target.value) }, setValidation)} /></label> : <label>Final holdout (%)<input type="number" min="10" max="40" value={validation.holdout_fraction * 100} disabled={pending} onChange={event => edit('validation', { ...validation, holdout_fraction: Number(event.target.value) / 100 }, setValidation)} /></label>}<label>Development folds<input type="number" min="2" max="5" value={validation.folds} disabled={pending} onChange={event => edit('validation', { ...validation, folds: Number(event.target.value) }, setValidation)} /></label></div>
        {forecasting && <fieldset disabled={pending}><legend>Time & forecast assumptions</legend><label>Frequency<select value={validation.frequency} onChange={event => edit('validation', { ...validation, frequency: event.target.value }, setValidation)}><option value="h">Hourly</option><option value="D">Daily</option><option value="W-MON">Weekly, Monday</option><option value="MS">Monthly, first day</option></select></label><div className="ml-field-pair"><label>Target lags<input type="number" min="1" max="48" value={validation.lags} onChange={event => edit('validation', { ...validation, lags: Number(event.target.value) }, setValidation)} /></label><label>Season length<input type="number" min="1" max="366" value={validation.season_length} onChange={event => edit('validation', { ...validation, season_length: Number(event.target.value) }, setValidation)} /></label></div><p className="ml-guidance">Assign one time column and an optional series key using the Group role. Each series needs regular, unique timestamps. The last horizon is reserved for final evaluation. Target lags are created inside each rolling training partition.</p>{roles.numeric.length + roles.categorical.length > 0 && <label className="ml-check-label"><input type="checkbox" checked={validation.future_features_known} onChange={event => edit('validation', { ...validation, future_features_known: event.target.checked }, setValidation)} />Every selected feature is known for the entire future horizon.</label>}</fieldset>}
        <label>Selection metric<select value={metric.primary} disabled={pending} onChange={event => edit('metric', { primary: event.target.value }, setMetric)}>{(METRICS[draft.task_type] || []).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {showGuidance && <p className="ml-guidance">Compare models using development folds. Reserve the final holdout for one deliberately nominated candidate.</p>}
        {anomaly && <fieldset disabled={pending}><legend>Detector threshold</legend><label>Expected unusual fraction (%)<input type="number" min="0.5" max="30" step="0.5" value={candidate.contamination * 100} onChange={event => edit('candidate', { ...candidate, contamination: Number(event.target.value) / 100 }, setCandidate)} /></label><label>Local neighbors<input type="number" min="5" max="100" value={candidate.neighbors} onChange={event => edit('candidate', { ...candidate, neighbors: Number(event.target.value) }, setCandidate)} /></label><p className="ml-guidance">The fraction sets a training-score threshold; future flag rates may differ. Labels are optional numeric 0 (ordinary) or 1 (known anomaly) and never train or tune the detector. Stability is not accuracy. Local neighbor detection supports up to 20,000 training rows.</p></fieldset>}
        <fieldset disabled={pending}><legend>Candidate models</legend>{(MODELS[draft.task_type] || []).map(family => <label className="ml-check-label" key={family}><input type="checkbox" checked={candidate.families.includes(family)} onChange={event => edit('candidate', { ...candidate, families: event.target.checked ? [...candidate.families, family] : candidate.families.filter(item => item !== family) }, setCandidate)} />{LABELS[family]}</label>)}{clustering && <><label>Number of clusters<input type="number" min="2" max="12" value={candidate.cluster_count} onChange={event => edit('candidate', { ...candidate, cluster_count: Number(event.target.value) }, setCandidate)} /></label><p className="ml-guidance">Numeric inputs are standardized and categories are one-hot encoded. Both models use Euclidean distance and can assign new rows. Compact clusters may not represent meaningful real-world groups. Stability compares a seeded 80% training subsample; it is not accuracy.</p></>}</fieldset>
        <details className="ml-local-limits"><summary>Reproducibility & local limits</summary><label>Random seed<input type="number" min="0" value={validation.seed} disabled={pending} onChange={event => edit('validation', { ...validation, seed: Number(event.target.value) }, setValidation)} /></label>{[['max_rows', 'Maximum rows'], ['max_features', 'Maximum features'], ['timeout_seconds', 'Time limit (seconds)']].map(([key, label]) => <label key={key}>{label}<input type="number" min="1" disabled={pending} value={resource[key]} onChange={event => edit('resource', { ...resource, [key]: Number(event.target.value) }, setResource)} /></label>)}</details>
      </section>
    </div>
    <section className="ml-readiness" aria-label="Readiness assessment"><div><h3>{stale ? 'Settings changed — assess again' : assessment ? (assessment.state === 'ready' ? 'Configuration ready' : 'Resolve these findings') : 'Check readiness before training'}</h3><p>Assessment uses the saved snapshot, roles, settings, and preparation lineage.</p></div>{issues.length > 0 && <ul>{issues.map((issue, index) => <li key={index}><strong>{issue.severity === 'blocking' ? 'Required' : 'Note'}{issue.field ? ` · ${issue.field}` : ''}:</strong> {issue.message}</li>)}</ul>}{assessment && <details><summary>Assessment details</summary><p>Saved revision {assessment.bound_draft_revision}</p><code>{assessment.assessment_id}</code><p>{assessment.input_fingerprint}</p></details>}</section>
    <footer className="ml-stage-actions"><span role="status">{pending ? 'Saving and assessing…' : stale ? 'Current evidence needs refresh' : 'Local execution · governed data'}</span><button type="button" onClick={assess} disabled={pending || !schema}>Save & assess</button>{canTrain && assessment?.state === 'ready' && !stale && <button type="button" onClick={onContinue} disabled={pending}>Continue to Train</button>}</footer>
  </main>;
}
