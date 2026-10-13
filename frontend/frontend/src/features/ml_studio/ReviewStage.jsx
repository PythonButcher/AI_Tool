import React, { useEffect, useRef, useState } from 'react';
import EvidencePlot, { metricText } from './EvidencePlot';
import { readable } from './TrainingStage';
import './ReviewStage.css';

const ROOT = `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/ml-studio/v1`;
const ACTIVE = ['queued', 'running', 'cancel_requested'];
async function request(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw data.error || new Error('The saved review is unavailable.');
  return data;
}

export default function ReviewStage({ draft, showGuidance, onBeforeDecision, onWorkflowChanged, onContinue }) {
  const [state, setState] = useState(null);
  const [runId, setRunId] = useState('');
  const [family, setFamily] = useState('');
  const [reviewer, setReviewer] = useState('Local reviewer');
  const [intendedUse, setIntendedUse] = useState('');
  const [prohibitedUse, setProhibitedUse] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [revision, setRevision] = useState(0);
  const live = useRef(false), busy = useRef(false), generation = useRef(0);
  const onChanged = useRef(onWorkflowChanged); onChanged.current = onWorkflowChanged;
  const base = `${ROOT}/drafts/${encodeURIComponent(draft.experiment_id)}`;
  const scope = `workspace_id=${encodeURIComponent(draft.workspace_id)}`;
  useEffect(() => {
    let current = true, timer;
    live.current = true;
    const version = ++generation.current;
    const load = async () => {
      try {
        const data = await request(`${base}/review?${scope}`);
        if (!current || version !== generation.current) return;
        setState(data); setError(null); onChanged.current?.(data.workflow_state);
        setRunId(previous => data.runs.some(run => run.run_id === previous) ? previous : data.runs.find(run => run.status === 'completed')?.run_id || '');
        if (data.nominations.some(item => ACTIVE.includes(item.final_run?.status))) timer = setTimeout(load, 1500);
      } catch (err) { if (current && version === generation.current) setError(err); }
    };
    load();
    return () => { current = false; live.current = false; clearTimeout(timer); };
  }, [base, scope, revision]);

  const runs = state?.runs.filter(run => run.status === 'completed') || [];
  const run = runs.find(item => item.run_id === runId);
  const evidence = run?.evaluation_result;
  const nomination = state?.nominations.find(item => item.development_run_id === runId);
  const final = nomination?.final_run;
  const selection = state?.selections.find(item => item.nomination_id === nomination?.nomination_id);
  const stale = Boolean(run && run.run_specification.parameters.input_fingerprint !== state.input_fingerprint);
  const candidate = evidence?.candidates.find(item => item.family === (nomination?.family || family));
  const nominationFamily = nomination?.family, nominationUse = nomination?.intended_use, nominator = nomination?.nominator;
  const lockedNomination = state?.nominations.find(item => item.snapshot_id === evidence?.dataset_snapshot.snapshot_id && item.development_run_id !== runId);
  useEffect(() => {
    if (nominationFamily) { setFamily(nominationFamily); setIntendedUse(nominationUse); setReviewer(nominator); }
    setAcknowledged(false);
  }, [nominationFamily, nominationUse, nominator]); // Keep unsaved notes while polling unchanged evidence.
  const chooseRun = id => {
    setRunId(id); setFamily(''); setIntendedUse(''); setProhibitedUse(''); setAcknowledged(false);
  };

  const decide = async (path, payload) => {
    if (busy.current) return;
    busy.current = true; setPending(true); setError(null); ++generation.current;
    try {
      const saved = await onBeforeDecision({});
      if (!live.current) return;
      if (!saved.success) throw saved.error;
      const data = await request(`${base}/${path}?${scope}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'If-Match': saved.draft.etag }, body: JSON.stringify(payload) });
      if (!live.current) return;
      if (data.workflow_state) onChanged.current?.(data.workflow_state);
      setRevision(value => value + 1);
    } catch (err) { if (live.current) setError(err || { message: 'The decision could not be saved. Retry the same decision.' }); }
    finally { busy.current = false; if (live.current) setPending(false); }
  };
  const metric = evidence?.primary_metric;
  const direction = evidence?.metric_direction === 'maximize' ? 'higher is better' : 'lower is better';
  return <main className="ml-studio-canvas ml-review" aria-label="Review Results Canvas">
    <div className="ml-stage-heading"><div><span className="ml-eyebrow">Evidence before a decision</span><h2>Review results</h2><p>Compare development results, nominate one candidate, then review its final evaluation.</p></div><span className="ml-task-badge">{readable(evidence?.task_type || draft.task_type)}</span></div>
    {error && <div className="prep-alert error" role="alert"><div><strong>{error.message}</strong><p>{error.remediation}</p></div><button disabled={pending} onClick={() => setRevision(value => value + 1)}>Refresh saved review</button></div>}
    {!state ? <p role="status">Loading saved evidence…</p> : !run ? <p>No completed development run is available. Train a candidate to begin review.</p> : <>
      <div className="ml-review-toolbar"><label>Development run<select value={runId} disabled={pending} onChange={event => chooseRun(event.target.value)}>{runs.map(item => <option key={item.run_id} value={item.run_id}>{new Date(item.submitted_at).toLocaleString()} · configuration {item.specification_version}</option>)}</select></label><span>{evidence.candidates.length} candidates · {readable(metric)} · {direction}</span></div>
      {stale && <div className="ml-guidance" role="status">Historical evidence: saved settings have changed. Review is available; nomination and selection require results for the current configuration.</div>}
      {lockedNomination && <div className="ml-guidance">A candidate from another run already holds the final evaluation for this dataset. <button onClick={() => chooseRun(lockedNomination.development_run_id)} disabled={pending}>View nominated run</button></div>}
      <section className="ml-review-section" aria-label="Development comparison"><div className="ml-section-heading"><div><span className="ml-eyebrow">01 / Compare</span><h3>Development evidence</h3></div><span>Final holdout reserved</span></div>
        {showGuidance && <p>Fold means show typical validation performance. The spread shows variability between folds, not a confidence interval. Baselines set a minimum useful comparison.</p>}
        <div className="ml-table-scroll"><table className="ml-candidate-table"><thead><tr><th>Candidate</th>{Object.keys(evidence.baseline.metrics).map(name => <th key={name}>{readable(name)}</th>)}<th>Inspect</th></tr></thead><tbody>
          <tr className="ml-baseline-row"><th scope="row">{evidence.baseline.name} baseline</th>{Object.values(evidence.baseline.metrics).map((value, index) => <td key={index}>{metricText(value)}</td>)}<td>Reference</td></tr>
          {evidence.baseline.alternatives?.map(item => <tr className="ml-baseline-row" key={item.name}><th scope="row">{item.name}</th>{Object.keys(evidence.baseline.metrics).map(name => <td key={name}>{metricText(item.metrics[name])}</td>)}<td>Reference</td></tr>)}
          {evidence.candidates.map(item => <tr key={item.family} className={(nomination?.family || family) === item.family ? 'ml-candidate-active' : ''}><th scope="row">{readable(item.family)}</th>{Object.keys(evidence.baseline.metrics).map(name => <td key={name}><strong>{metricText(item.metrics[name])}</strong><small>± {metricText(item.fold_std[name])} across folds</small></td>)}<td><label><input type="radio" name="candidate" checked={(nomination?.family || family) === item.family} disabled={pending || !!nomination} onChange={() => setFamily(item.family)} />Inspect {readable(item.family)}</label></td></tr>)}
        </tbody></table></div>
        {candidate && <EvidencePlot evidence={candidate.evidence} title="Development" />}
        <details className="ml-evidence-notes"><summary>Limits, warnings and reproducibility</summary><ul>{[...evidence.warnings, ...evidence.limitations].map((item, index) => <li key={index}>{item}</li>)}</ul><dl><dt>Configuration</dt><dd>{evidence.configuration_id}</dd><dt>Dataset</dt><dd>{evidence.dataset_snapshot.snapshot_id}</dd><dt>Runtime versions</dt><dd>{Object.entries(evidence.runtime_versions).map(([key, value]) => `${key} ${value}`).join(' · ')}</dd></dl></details>
      </section>
      <section className="ml-review-section ml-decision-panel" aria-label="Candidate decision"><div><span className="ml-eyebrow">02 / Nominate</span><h3>{nomination ? `${readable(nomination.family)} nominated` : 'Choose one candidate deliberately'}</h3><p>Nominating reserves final evaluation for this candidate on this dataset. Another candidate cannot use this holdout in this experiment.</p></div>
        {!nomination ? <div className="ml-decision-form"><label>Reviewer<input value={reviewer} maxLength={2000} onChange={event => setReviewer(event.target.value)} disabled={pending} /></label><label>Intended use<textarea value={intendedUse} maxLength={2000} onChange={event => setIntendedUse(event.target.value)} disabled={pending} placeholder="What decision will these predictions support?" /></label><button className="semantic-btn primary" disabled={pending || stale || !!lockedNomination || !family || !reviewer.trim() || !intendedUse.trim()} onClick={() => decide('nominations', { run_id: runId, family, nominator: reviewer, intended_use: intendedUse })}>Nominate candidate</button></div> : <div><p>{nomination.intended_use}</p><p className="ml-review-receipt">Saved by {nomination.nominator} · {new Date(nomination.nominated_at).toLocaleString()}</p></div>}
      </section>
      {nomination && <section className="ml-review-section" aria-label="Final evaluation"><span className="ml-eyebrow">03 / Evaluate once</span><h3>Final evidence for {readable(nomination.family)}</h3>
        {final?.status === 'completed' ? <><div className="ml-final-metrics">{Object.entries(final.evaluation_result.metrics).map(([name, value]) => <div key={name}><span>{readable(name)}</span><strong>{metricText(value)}</strong><small>Baseline {metricText(final.evaluation_result.baseline[name])}</small></div>)}</div><p>{final.evaluation_result.holdout_rows} reserved rows · one saved final evaluation</p><EvidencePlot evidence={final.evaluation_result.evidence} title="Final holdout" /><ul className="ml-limitations">{final.evaluation_result.limitations.map((item, index) => <li key={index}>{item}</li>)}</ul></> : <><p>{final ? `${readable(final.status)} · ${readable(final.progress_stage)}` : 'Evaluate the reserved rows only after accepting the development evidence.'}</p>{final?.failure && <p role="alert">{final.failure.message} {final.failure.remediation}</p>}<button className="semantic-btn primary" disabled={pending || stale || ACTIVE.includes(final?.status)} onClick={() => decide(`nominations/${nomination.nomination_id}/final-evaluation`, {})}>{ACTIVE.includes(final?.status) ? 'Evaluation in progress…' : final ? 'Retry final evaluation' : 'Evaluate nominated candidate'}</button></>}
      </section>}
      {final?.status === 'completed' && <section className="ml-review-section ml-selection-panel" aria-label="Final selection"><span className="ml-eyebrow">04 / Select</span><h3>{selection ? 'Candidate selected' : 'Record your selection'}</h3>{selection ? <><p>{selection.intended_use}</p><p className="ml-review-receipt">Selected by {selection.reviewed_by} · {new Date(selection.selected_at).toLocaleString()}</p></> : <div className="ml-decision-form"><label>Reviewer<input value={reviewer} maxLength={2000} onChange={event => setReviewer(event.target.value)} disabled={pending} /></label><label>Intended use<textarea value={intendedUse} maxLength={2000} onChange={event => setIntendedUse(event.target.value)} disabled={pending} /></label><label>Prohibited use<textarea value={prohibitedUse} maxLength={2000} onChange={event => setProhibitedUse(event.target.value)} disabled={pending} placeholder="Where should this model not be used?" /></label><label className="ml-acknowledgement"><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} disabled={pending} />I reviewed the final evidence and limitations.</label><button className="semantic-btn primary" disabled={pending || stale || !acknowledged || !reviewer.trim() || !intendedUse.trim() || !prohibitedUse.trim()} onClick={() => decide('selections', { nomination_id: nomination.nomination_id, reviewed_by: reviewer, intended_use: intendedUse, prohibited_use: prohibitedUse })}>Select this candidate</button></div>}</section>}
      {selection && <footer className="ml-stage-actions"><span>Selection completes this experiment cycle. Exports and predictions are optional.</span><button onClick={onContinue} disabled={pending || stale}>Use & share</button></footer>}
    </>}
  </main>;
}
