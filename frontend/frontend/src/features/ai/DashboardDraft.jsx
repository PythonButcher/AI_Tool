import React, { useState } from 'react';
import { canSaveResult } from '../../utils/aiDashboardResults';

export default function DashboardDraft({ draft, onAdd, onInspect, onOpenDashboard }) {
  const [selected, setSelected] = useState(() => Object.fromEntries(draft.items.map(item => [item.item_id, item.status === 'ready' && canSaveResult(item.artifact)])));
  const [titles, setTitles] = useState({});
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const choices = draft.items.filter(item => selected[item.item_id] && canSaveResult(item.artifact));
  const add = () => {
    setFeedback('');
    try {
      const result = onAdd(choices.map(item => ({ artifact: item.artifact, title: titles[item.item_id] || item.artifact.title })));
      setError('');
      setFeedback(`${result.added.length} added to your dashboard${result.skipped ? `; ${result.skipped} already present` : ''}.`);
    } catch (failure) {
      setError(failure.message);
    }
  };
  return (
    <section className="ai-shell__dashboard-draft" aria-label="Dashboard draft">
      <h3>Review your dashboard</h3>
      <p>{draft.note}</p>
      {draft.items.map(item => (
        <div className="ai-shell__draft-item" key={item.item_id}>
          <label>
            <input type="checkbox" checked={Boolean(selected[item.item_id])}
              disabled={item.status !== 'ready' || !canSaveResult(item.artifact)}
              onChange={event => setSelected(previous => ({ ...previous, [item.item_id]: event.target.checked }))} />
            {item.label}
          </label>
          {item.status === 'ready' ? <>
            <input aria-label={`Title for ${item.label}`} maxLength={120}
              value={titles[item.item_id] ?? item.artifact.title}
              onChange={event => setTitles(previous => ({ ...previous, [item.item_id]: event.target.value }))} />
            <span>{item.artifact.bi_grounding?.aggregation} · {item.artifact.bi_grounding?.row_count} rows</span>
            <button type="button" onClick={() => onInspect(item.artifact)}>Inspect {item.label.toLowerCase()}</button>
          </> : <p role="status">Unavailable: {item.message}</p>}
        </div>
      ))}
      <button type="button" className="ai-shell__primary-action" disabled={!choices.length} onClick={add}>
        Add {choices.length} selected to dashboard
      </button>
      {feedback && <p role="status">{feedback}</p>}
      {feedback && <button type="button" onClick={onOpenDashboard}>View dashboard</button>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
