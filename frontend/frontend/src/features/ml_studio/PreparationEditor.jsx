import React, { useEffect, useRef, useState } from 'react';
import TransformationPlanEditor, { normalizeCleaningStep } from '../../components/data_management/cleaning_components/TransformationPlanEditor';
import './PreparationEditor.css';

const ROOT = `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/ml-studio/v1`;

// This editor only consumes server-issued preparation operations. It never uses
// the shared editor's global dataset or its compatibility cleaning endpoint.
export default function PreparationEditor({ context, initialSteps, closeForm, onFinished }) {
  const [operation, setOperation] = useState(context.preparation || null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [plan, setPlan] = useState(() => (context.preparation?.recipe?.steps || initialSteps).map((step, index) => ({
    id: step.step_id || step.id || `initial-${index}`, type: step.type || step.action_type, params: step.params || step.parameters || {},
  })));
  const [stepEditing, setStepEditing] = useState(false);
  const [locked, setLocked] = useState(Boolean(context.preparation));
  const [recoveryMode, setRecoveryMode] = useState(Boolean(context.preparation));
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
    if (!response.ok) {
      const failure = new Error(data.error?.message || 'Preparation request failed.');
      Object.assign(failure, data.error || {}, { status: response.status });
      throw failure;
    }
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
        setLocked(true);
        const data = await request(`${base}${scope}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'If-Match': context.base_etag, 'Idempotency-Key': key.current },
          body: JSON.stringify({ snapshot_id: context.snapshot_id,
            steps: plan.map(normalizeCleaningStep),
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
        body: JSON.stringify({ action: action === 'edit' ? 'cancel' : action }),
      });
      if (!live.current) return;
      operationRef.current = result.preparation;
      setOperation(result.preparation);
      if (action === 'edit') {
        if (result.preparation?.status !== 'cancelled') throw new Error('The server has not released this recipe. Retry Edit steps.');
        // Reconcile the parent's open-operation lock even when the editor stays
        // open. Closing an unsaved revision must not resurrect the cancelled one.
        await onFinished?.(result);
        if (!live.current) return;
        // Operations are immutable. Release this one before changing the plan,
        // then issue a new key so a lost response cannot replay different steps.
        operationRef.current = null; setOperation(null); setPreview(null);
        attempted.current = false; setLocked(false); setRecoveryMode(false);
        key.current = `prep-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      } else if (action === 'preview') setPreview(result.preview);
      else {
        if (!['applied', 'cancelled'].includes(result.preparation?.status)) throw new Error('The server has not confirmed completion. Retry this operation.');
        await onFinished?.(result);
        if (live.current) closeForm();
      }
    } catch (err) {
      if (live.current && !operationRef.current && [400, 404, 409, 422].includes(err.status)) {
        // A definitive rejected start created no operation to cancel. Network
        // and server failures remain locked because their outcome is unknown.
        attempted.current = false; setLocked(false);
        key.current = `prep-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      }
      if (live.current) setError({ message: err.message || 'The response was lost.',
        remediation: err.remediation || 'Retry the same action. The saved operation prevents applying the recipe twice.' });
    } finally {
      pending.current = false;
      if (live.current) setBusy(null);
    }
  };
  const autoPreview = useRef(context.auto_preview === true);
  useEffect(() => {
    if (autoPreview.current) { autoPreview.current = false; run('preview'); }
  });
  const rows = (preview?.preview || context.data_preview || []).slice(0, 100);
  const columns = rows.length ? Object.keys(rows[0]) : [];
  const sourceColumns = (context.columns || []).map(column => typeof column === 'string' ? column : column.name);
  // Include generated columns so subsequent steps can target a rename/split.
  const editableColumns = Array.from(new Set([...sourceColumns, ...columns, ...plan.flatMap(step => {
    const params = step.params;
    return [...(params.columns && Array.isArray(params.columns) ? params.columns : []),
      ...Object.values(params.mappings || {}), ...(Array.isArray(params.new_columns) ? params.new_columns : []),
      ...(params.new_column ? [params.new_column] : [])];
  })])).filter(column => typeof column === 'string');
  const canApply = !stepEditing && plan.length > 0 && (recoveryMode || preview?.row_count > 0);
  return (
    <div className="ml-preparation-overlay">
      <section ref={dialog} className="ml-preparation-editor" role="dialog" aria-modal="true" aria-labelledby="ml-preparation-title" aria-busy={Boolean(busy)} onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); run('cancel'); }
        if (event.key === 'Tab') {
          const controls = Array.from(dialog.current.querySelectorAll('button, input, select, textarea, summary, [tabindex="0"]')).filter(control => !control.matches(':disabled'));
          const first = controls[0], last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}>
        <header>
          <div><span className="ml-eyebrow">ML Studio · Prepare your data</span><h2 id="ml-preparation-title">Power Query Editor</h2><p>{context.title || 'Experiment'} · {plan.length} transformation{plan.length === 1 ? '' : 's'}</p></div>
          <button type="button" disabled={Boolean(busy)} onClick={() => run('cancel')}>Cancel and return</button>
        </header>
        <div className="ml-preparation-content">
          <div className="ml-preparation-tools">
            {locked && <div className="ml-recipe-locked"><p>This recipe is saved for preview and recovery. Choose Edit steps to revise it.</p><button type="button" disabled={Boolean(busy)} onClick={() => run('edit')}>Edit steps</button></div>}
            <TransformationPlanEditor steps={plan} onChange={next => { setPlan(next); setPreview(null); }} columns={editableColumns}
              disabled={Boolean(busy) || locked} onEditingChange={setStepEditing} />
          </div>
          <div className="ml-preparation-preview">
            <h3>{preview ? 'Result preview' : 'Source preview'}</h3>
            {preview ? <><p role="status">{preview.row_count.toLocaleString()} resulting rows · showing {rows.length}</p>
              {Number.isFinite(preview.input_row_count) && <div className="ml-preparation-impact"><span><strong>{preview.input_row_count.toLocaleString()}</strong> original rows</span><span><strong>{preview.row_count.toLocaleString()}</strong> resulting rows</span><span><strong>{preview.removed_row_count.toLocaleString()}</strong> fewer rows</span>{preview.added_row_count > 0 && <span><strong>{preview.added_row_count.toLocaleString()}</strong> additional rows</span>}</div>}
              <p>Review the combined effect before applying. The source is unchanged until Apply.</p></> : <p>Add or adjust transformations, then run one preview for the whole recipe.</p>}
            {rows.length > 0 && <div className="ml-table-scroll"><table><thead><tr>{columns.map(column => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{columns.map(column => <td key={column}>{row[column] == null ? '—' : String(row[column])}</td>)}</tr>)}</tbody></table></div>}
            {stepEditing && <p role="status">Add or update the step, or discard its edit, before previewing.</p>}
            <details><summary>Operation details</summary><dl><dt>Workspace</dt><dd>{context.workspace_id}</dd><dt>Snapshot</dt><dd>{context.snapshot_id}</dd><dt>Operation</dt><dd>{operation?.operation_id || 'Created on preview'}</dd></dl></details>
          </div>
        </div>
        {error && <div className="ml-preparation-error" role="alert"><strong>{error.message}</strong><p>{error.remediation}</p></div>}
        <footer><span role="status">{busy ? `Processing ${busy}…` : operation ? `Operation ${operation.status}` : 'No changes applied'}</span><button type="button" disabled={Boolean(busy) || stepEditing || plan.length === 0} onClick={() => run('preview')}>Run Preview</button><button type="button" className="ml-primary" disabled={Boolean(busy) || !canApply} onClick={() => run('apply')}>Apply and return</button></footer>
      </section>
    </div>
  );
}
