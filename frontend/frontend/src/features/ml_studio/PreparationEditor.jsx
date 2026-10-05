import React, { useEffect, useRef, useState } from 'react';
import './PreparationEditor.css';

const ROOT = `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/ml-studio/v1`;

// This editor only consumes server-issued preparation operations. It never uses
// the shared editor's global dataset or its compatibility cleaning endpoint.
export default function PreparationEditor({ context, initialSteps, closeForm, onFinished }) {
  const [operation, setOperation] = useState(context.preparation || null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const live = useRef(true);
  const pending = useRef(false);
  const operationRef = useRef(context.preparation || null);
  const attempted = useRef(false);
  const dialog = useRef(null);
  const key = useRef(null);
  if (!key.current) key.current = context.idempotency_key || `prep-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const base = `${ROOT}/drafts/${encodeURIComponent(context.experiment_id)}/preparation`;
  const scope = `?workspace_id=${encodeURIComponent(context.workspace_id)}`;
  useEffect(() => {
    live.current = true;
    const opener = document.activeElement;
    dialog.current?.querySelector('button')?.focus();
    return () => { live.current = false; if (opener?.isConnected) opener.focus(); };
  }, []);

  const request = async (url, options) => {
    const response = await fetch(url, options);
    const data = await response.json();
    if (!response.ok) throw data.error || new Error('Preparation request failed.');
    return data;
  };
  const run = async action => {
    if (pending.current) return;
    if (action === 'cancel' && !operationRef.current && !attempted.current) {
      closeForm();
      return;
    }
    pending.current = true;
    setBusy(action);
    setError(null);
    try {
      let current = operationRef.current;
      if (!current) {
        attempted.current = true;
        const data = await request(`${base}${scope}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'If-Match': context.base_etag, 'Idempotency-Key': key.current },
          body: JSON.stringify({ snapshot_id: context.snapshot_id,
            steps: initialSteps.map(({ type, params }) => ({ type, params: params || {} })),
            issue_id: context.issue_id ?? null, fix_id: context.fix_id ?? null,
            return_stage: context.return_stage || 'Prepare Data' }),
        });
        current = data.preparation;
        operationRef.current = current;
      }
      if (!live.current) return;
      setOperation(current);
      const result = await request(`${base}/${encodeURIComponent(current.operation_id)}${scope}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(action === 'preview' ? {} : { 'If-Match': current.base_etag }) },
        body: JSON.stringify({ action }),
      });
      if (!live.current) return;
      operationRef.current = result.preparation;
      setOperation(result.preparation);
      if (action === 'preview') setPreview(result.preview);
      else {
        if (!['applied', 'cancelled'].includes(result.preparation?.status)) throw new Error('The server has not confirmed completion. Retry this operation.');
        await onFinished?.(result);
        if (live.current) closeForm();
      }
    } catch (err) {
      if (live.current) setError({ message: err.message || 'The response was lost.',
        remediation: err.remediation || 'Retry the same action. The saved operation prevents applying the recipe twice.' });
    } finally {
      pending.current = false;
      if (live.current) setBusy(null);
    }
  };
  const rows = (preview?.preview || []).slice(0, 100);
  const columns = rows.length ? Object.keys(rows[0]) : [];
  const steps = operation?.recipe?.steps || initialSteps;
  return (
    <div className="ml-preparation-overlay">
      <section ref={dialog} className="ml-preparation-editor" role="dialog" aria-modal="true" aria-labelledby="ml-preparation-title" aria-busy={Boolean(busy)} onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); run('cancel'); }
        if (event.key === 'Tab') {
          const controls = Array.from(dialog.current.querySelectorAll('button:not(:disabled), summary'));
          const first = controls[0], last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}>
        <header>
          <div><span className="ml-eyebrow">ML Studio · Governed preparation</span><h2 id="ml-preparation-title">Power Query Editor</h2><p>{context.title || 'Experiment'} · {context.field || 'Saved recipe'}</p></div>
          <button type="button" disabled={Boolean(busy)} onClick={() => run('cancel')}>Cancel and return</button>
        </header>
        <div className="ml-preparation-content">
          <aside><h3>Preparation recipe</h3><p>{context.explanation || 'Review the stored transformations before applying them.'}</p>
            <ol>{steps.map((step, index) => <li key={step.step_id || index}><strong>{step.type || step.action_type}</strong><pre>{JSON.stringify(step.params || step.parameters, null, 2)}</pre></li>)}</ol>
            <p>Preview leaves the dataset unchanged. Apply creates a new governed data version and reconciles your experiment.</p>
            <details><summary>Operation details</summary><dl><dt>Workspace</dt><dd>{context.workspace_id}</dd><dt>Snapshot</dt><dd>{context.snapshot_id}</dd><dt>Operation</dt><dd>{operation?.operation_id || 'Created on preview or apply'}</dd></dl></details>
          </aside>
          <div className="ml-preparation-preview">
            <h3>Result preview</h3>
            {preview ? <><p role="status">{preview.row_count.toLocaleString()} resulting rows · showing {rows.length}</p><div className="ml-table-scroll"><table><thead><tr>{columns.map(column => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{columns.map(column => <td key={column}>{row[column] == null ? '—' : String(row[column])}</td>)}</tr>)}</tbody></table></div></> : <p>Preview the stored recipe to inspect its effect before committing.</p>}
          </div>
        </div>
        {error && <div className="ml-preparation-error" role="alert"><strong>{error.message}</strong><p>{error.remediation}</p></div>}
        <footer><span role="status">{busy ? `Processing ${busy}…` : operation ? `Operation ${operation.status}` : 'No changes applied'}</span><button type="button" disabled={Boolean(busy)} onClick={() => run('preview')}>Run Preview</button><button type="button" className="ml-primary" disabled={Boolean(busy)} onClick={() => run('apply')}>Apply and return</button></footer>
      </section>
    </div>
  );
}
