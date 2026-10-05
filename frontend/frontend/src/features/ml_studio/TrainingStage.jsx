import React, { useEffect, useRef, useState } from 'react';
import './TrainingStage.css';

const ROOT = `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/ml-studio/v1`;
const ACTIVE = ['queued', 'running', 'cancel_requested'];
export const readable = value => String(value || '').replace(/_/g, ' ');
async function request(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw data.error || new Error('The local training service could not respond.');
  return data;
}

export default function TrainingStage({ draft, showGuidance, onBeforeSubmit, onRunChanged, onReview }) {
  const config = draft.assessment?.configuration;
  const [runs, setRuns] = useState([]);
  const [run, setRun] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const live = useRef(false);
  const busy = useRef(false);
  const requestVersion = useRef(0);
  const changed = useRef(onRunChanged);
  changed.current = onRunChanged;
  const base = `${ROOT}/drafts/${encodeURIComponent(draft.experiment_id)}/runs`;
  const scope = `workspace_id=${encodeURIComponent(draft.workspace_id)}`;
  const storageKey = `ml-submission:${draft.workspace_id}:${draft.experiment_id}:${config?.configuration_id}`;
  const submissionKey = useRef(null);
  useEffect(() => {
    try { submissionKey.current = sessionStorage.getItem(storageKey); } catch { /* Retry still works within this mount. */ }
  }, [storageKey]);

  useEffect(() => {
    let current = true;
    let timer;
    live.current = true;
    const version = ++requestVersion.current;
    const load = async () => {
      try {
        const data = await request(`${base}?${scope}`);
        if (!current || version !== requestVersion.current) return;
        setRuns(data.runs);
        if (data.runs.length) {
          const detail = await request(`${base}/${encodeURIComponent(data.runs[0].run_id)}?${scope}`);
          if (!current || version !== requestVersion.current) return;
          setRun(detail.run); setEvents(detail.events);
          if (!ACTIVE.includes(detail.run.status)) changed.current?.();
          else timer = setTimeout(load, 1500);
        } else { setRun(null); setEvents([]); }
        setError(null);
      } catch (err) { if (current && version === requestVersion.current) setError(err); }
      finally { if (current && version === requestVersion.current) setLoading(false); }
    };
    load();
    return () => { current = false; live.current = false; clearTimeout(timer); };
  }, [base, scope, refresh]);

  const submit = async () => {
    if (busy.current || !config) return;
    busy.current = true; setPending(true); setError(null);
    ++requestVersion.current;
    try {
      const saved = await onBeforeSubmit({});
      if (!live.current) return;
      if (!saved.success) throw saved.error;
      if (!submissionKey.current) {
        submissionKey.current = `studio-${window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
        try { sessionStorage.setItem(storageKey, submissionKey.current); } catch { /* Storage can be disabled by the browser. */ }
      }
      const data = await request(`${base}?${scope}`, { method: 'POST', headers: {
        'Content-Type': 'application/json', 'If-Match': saved.draft.etag, 'Idempotency-Key': submissionKey.current,
      }, body: JSON.stringify({ configuration_id: config.configuration_id }) });
      if (!live.current) return;
      submissionKey.current = null;
      try { sessionStorage.removeItem(storageKey); } catch { /* The in-memory key has already been cleared. */ }
      setRun(data.run); setEvents([]); setRefresh(value => value + 1); changed.current?.();
    } catch (err) { if (live.current) setError(err || { message: 'Submission did not finish. Retry to recover this same request.' }); }
    finally { busy.current = false; if (live.current) setPending(false); }
  };
  const cancel = async () => {
    if (busy.current || !run) return;
    busy.current = true; setPending(true); setError(null); ++requestVersion.current;
    try {
      const data = await request(`${base}/${encodeURIComponent(run.run_id)}?${scope}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cancel' }) });
      if (live.current) { setRun(data.run); setEvents(data.events); setRefresh(value => value + 1); changed.current?.(); }
    } catch (err) { if (live.current) { setError(err); setRefresh(value => value + 1); } }
    finally { busy.current = false; if (live.current) setPending(false); }
  };
  const active = run && ACTIVE.includes(run.status);
  const currentEvidence = run?.run_specification?.parameters?.configuration_id === config?.configuration_id;
  return <main className="ml-studio-canvas ml-training" aria-label="Training Canvas">
    <div className="ml-stage-heading"><div><span className="ml-eyebrow">Run a local experiment</span><h2>Train</h2><p>Compare candidates on development data. Keep the final holdout reserved.</p></div><span className="ml-task-badge">{draft.task_type}</span></div>
    {error && <div className="prep-alert error" role="alert"><div><strong>{error.message}</strong><p>{error.remediation || 'Retry the same submission to recover a lost response.'}</p></div><button onClick={() => setRefresh(value => value + 1)} disabled={pending}>Refresh runs</button></div>}
    <div className="ml-training-layout">
      <section className="ml-training-main" aria-label="Run progress">
        {loading ? <p role="status">Loading saved runs…</p> : !run ? <div className="ml-training-empty"><span className="ml-eyebrow">Ready when you are</span><h3>Your first run starts here</h3><p>Every run keeps its configuration, events and fitted models so you can return to the evidence.</p></div> : <>
          <div className="ml-run-heading"><h3>{readable(run.status)}</h3><span className={`ml-run-status ${run.status}`} role="status">{active ? 'Local worker' : 'Saved run'}</span></div>
          <p className="ml-current-event">{readable(run.progress_stage) || 'Waiting for the local worker'}</p>
          {run.status === 'completed' && <p className="ml-training-outcome">Development comparison is ready. Review the evidence before nominating a candidate.</p>}
          {['interrupted', 'cancelled'].includes(run.status) && <p>This run has stopped. Its events are preserved; start a new run to continue.</p>}
          {run.failure && <div className="prep-alert error" role="alert"><strong>{run.failure.message}</strong><p>{run.failure.remediation}</p></div>}
          {!currentEvidence && <p className="ml-guidance">This run belongs to an earlier configuration. Its results remain available as historical evidence.</p>}
          <ol className="ml-event-timeline" aria-label="Saved run events">{events.map((event, index) => <li key={`${event.occurred_at}-${index}`}><span>{readable(event.progress_stage || event.status)}</span><time dateTime={event.occurred_at}>{new Date(event.occurred_at).toLocaleTimeString()}</time></li>)}</ol>
          <details className="ml-run-details"><summary>Run identity and history</summary><dl><dt>Run</dt><dd>{run.run_id}</dd><dt>Configuration</dt><dd>{run.run_specification?.parameters?.configuration_id}</dd></dl><ul>{runs.map(item => <li key={item.run_id}>{readable(item.status)} · {new Date(item.submitted_at).toLocaleString()}</li>)}</ul></details>
        </>}
      </section>
      <aside className="ml-training-plan" aria-label="Saved training plan"><span className="ml-eyebrow">Saved configuration</span><h3>{config?.candidate?.families?.length || 0} candidate models</h3><ul>{config?.candidate?.families?.map(family => <li key={family}>{readable(family)}</li>)}</ul><dl><dt>Validation</dt><dd>{readable(config?.validation?.strategy)} · {config?.validation?.folds} folds</dd><dt>Final holdout</dt><dd>{Math.round((config?.validation?.holdout_fraction || 0) * 100)}% reserved</dd><dt>Time limit</dt><dd>{config?.resource?.timeout_seconds} seconds</dd><dt>Primary metric</dt><dd>{readable(config?.metric?.primary)}</dd></dl>{showGuidance && <p className="ml-guidance">Preprocessing learns from each training fold. Comparison does not score the final holdout or automatically select a winner.</p>}</aside>
    </div>
    <footer className="ml-stage-actions"><p>{active ? 'You can leave this stage and resume the saved run.' : 'Start only when the saved plan matches your intent.'}</p><div>{active ? <button className="semantic-btn" onClick={cancel} disabled={pending || run.status === 'cancel_requested'}>{run.status === 'cancel_requested' ? 'Cancellation requested' : 'Cancel run'}</button> : <button className="semantic-btn primary" disabled={pending || loading || !draft.assessment_current || !config} onClick={submit}>{pending ? 'Submitting…' : submissionKey.current ? 'Retry submission' : run ? 'Start new run' : 'Start training'}</button>}{run?.status === 'completed' && <button className="semantic-btn primary" onClick={onReview} disabled={pending}>Review results</button>}</div></footer>
  </main>;
}
