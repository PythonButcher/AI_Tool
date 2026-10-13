import React, { useState } from 'react';

const groupNames = { missing_values: 'Missing values', duplicate_rows: 'Repeated rows', whitespace: 'Text formatting', non_finite_values: 'Invalid numeric values', other: 'Other findings' };
const checkNames = { ...groupNames, duplicate_rows: 'duplicate rows', whitespace: 'surrounding spaces', non_finite_values: 'infinite values' };
const defaultTreatment = issue => issue.code === 'whitespace' ? 'suggested' : 'leave';

function treatmentOptions(issue) {
  if (issue.code === 'missing_values') return <>
    <option value="leave">Decide in Configure</option>
    {issue.training_imputation_available !== false && <option value="training">Handle input nulls during training</option>}
    <option value="constant">Replace with a specified value</option><option value="remove">Remove affected rows</option>
  </>;
  return <><option value="leave">Leave for review</option>{['whitespace', 'duplicate_rows'].includes(issue.code) && <option value="suggested">{issue.code === 'whitespace' ? 'Trim surrounding spaces' : 'Keep first occurrence'}</option>}</>;
}

export function buildPreparationPlan(issues, fixes, selected, treatments, replacements) {
  const steps = [], missingColumns = [];
  for (const issue of issues) {
    if (!selected.has(issue.issue_id)) continue;
    const treatment = treatments[issue.issue_id] || defaultTreatment(issue);
    if (treatment === 'remove') missingColumns.push(issue.field);
    if (treatment === 'constant') {
      const raw = replacements[issue.issue_id] ?? '';
      if (!String(raw).trim()) throw new Error(`Enter a replacement value for ${issue.field}.`);
      const value = issue.logical_type === 'numeric' ? Number(raw) : raw;
      if (typeof value === 'number' && !Number.isFinite(value)) throw new Error(`Enter a finite numeric value for ${issue.field}.`);
      steps.push({ type: 'replace_nulls', params: { columns: [issue.field], strategy: 'value', value } });
    }
    if (treatment === 'suggested') {
      const fix = fixes.find(item => item.issue_id === issue.issue_id && item.support_status === 'supported');
      if (fix) steps.push({ type: fix.action_type, params: fix.parameters || {} });
    }
  }
  // One filter computes the union of missing rows across columns, not a sum of
  // per-column counts. The server preview is the authority on combined impact.
  if (missingColumns.length) steps.push({ type: 'remove_nulls', params: { columns: missingColumns } });
  return steps;
}

export default function PreparationFindings({ data, disabled, onOpenPlan, onOpenIssue }) {
  const issues = data.issues || [], fixes = data.fixes || [];
  const [selected, setSelected] = useState(() => new Set(issues.map(issue => issue.issue_id)));
  const [treatments, setTreatments] = useState({});
  const [replacements, setReplacements] = useState({});
  const [error, setError] = useState('');
  const groups = Object.entries(groupNames).map(([code, label]) => ({ code, label,
    issues: issues.filter(issue => (groupNames[issue.code] ? issue.code : 'other') === code) })).filter(group => group.issues.length);
  const allSelected = issues.length > 0 && issues.every(issue => selected.has(issue.issue_id));
  const updateTreatment = (id, value) => { setTreatments(previous => ({ ...previous, [id]: value })); setError(''); };
  const preview = () => {
    try {
      const steps = buildPreparationPlan(issues, fixes, selected, treatments, replacements);
      if (!steps.length) { setError('Choose a data-changing treatment to preview, or continue to Configure with the findings retained.'); return; }
      setError(''); onOpenPlan({ steps, autoPreview: true });
    } catch (problem) { setError(problem.message); }
  };
  return <section className="ml-quality-review" aria-label="Data quality review">
    <div className="ml-quality-summary"><div><span className="ml-preparation-eyebrow">Review & prepare</span><h3>{issues.length} finding{issues.length === 1 ? '' : 's'} to review</h3><p>{Number.isFinite(data.row_count) ? `${data.row_count.toLocaleString()} rows · ` : ''}{groups.length} issue group{groups.length === 1 ? '' : 's'}. Choose changes together, then inspect one combined preview.</p></div>
      <button type="button" className="semantic-btn secondary" disabled={disabled} onClick={() => onOpenPlan({ steps: [] })}>Open full editor</button></div>
    <p className="ml-quality-guidance">For supported tasks, missing input values can be handled inside training partitions. Forecasting, missing targets, empty columns and time or series keys need separate attention in Configure. Removing rows is optional.</p>
    <div className="ml-quality-toolbar">
      <label className="ml-quality-select-all"><input type="checkbox" checked={allSelected} disabled={disabled} onChange={event => setSelected(event.target.checked ? new Set(issues.map(issue => issue.issue_id)) : new Set())} />Select all findings</label>
      {issues.some(issue => issue.code === 'missing_values') && <label>For selected missing-value columns<select aria-label="Bulk missing-value treatment" disabled={disabled} value="" onChange={event => {
        const treatment = event.target.value;
        setTreatments(previous => ({ ...previous, ...Object.fromEntries(issues.filter(issue => issue.code === 'missing_values' && selected.has(issue.issue_id)
          && (treatment !== 'training' || issue.training_imputation_available !== false)).map(issue => [issue.issue_id, treatment])) })); setError('');
      }}><option value="" disabled>Choose a treatment for all…</option><option value="training">Handle eligible inputs during training</option><option value="constant">Specify replacement values</option><option value="remove">Remove rows missing any selected column</option><option value="leave">Decide in Configure</option></select></label>}
      <span>{selected.size} selected</span>
    </div>
    {groups.map(group => <section className="ml-quality-group" key={group.code} aria-label={group.label}>
      <h4>{group.label}<span>{group.issues.length}</span></h4>
      <div className="ml-quality-table-scroll"><table><thead><tr><th scope="col">Select</th><th scope="col">Column / finding</th><th scope="col">Affected</th><th scope="col">Treatment</th><th scope="col">Details</th></tr></thead>
        <tbody>{group.issues.map(issue => <tr key={issue.issue_id}>
          <td><input type="checkbox" aria-label={`Select ${issue.field || group.label}`} disabled={disabled} checked={selected.has(issue.issue_id)} onChange={event => setSelected(previous => { const next = new Set(previous); event.target.checked ? next.add(issue.issue_id) : next.delete(issue.issue_id); return next; })} /></td>
          <th scope="row"><span>{issue.field || 'Whole dataset'}</span><small>{issue.message}</small></th>
          <td>{Number.isFinite(issue.count) ? <>{issue.count.toLocaleString()}<small>{data.row_count > 0 ? `${(issue.count / data.row_count * 100).toFixed(1)}% of rows` : ''}</small></> : '—'}</td>
          <td><select aria-label={`Treatment for ${issue.field || group.label}`} disabled={disabled} value={treatments[issue.issue_id] || defaultTreatment(issue)} onChange={event => updateTreatment(issue.issue_id, event.target.value)}>{treatmentOptions(issue)}</select>
            {treatments[issue.issue_id] === 'constant' && <input aria-label={`Replacement for ${issue.field}`} placeholder="Replacement value" disabled={disabled} value={replacements[issue.issue_id] ?? ''} onChange={event => setReplacements(previous => ({ ...previous, [issue.issue_id]: event.target.value }))} />}</td>
          <td>{fixes.filter(fix => fix.issue_id === issue.issue_id && fix.support_status === 'supported').map(fix => <button key={fix.fix_id} type="button" disabled={disabled} onClick={() => onOpenIssue(issue, fix)}>Open in Power Query</button>)}
            <details><summary>Details</summary><p>{issue.remediation}</p>{fixes.filter(fix => fix.issue_id === issue.issue_id).map(fix => <p key={fix.fix_id}>{fix.explanation}</p>)}<small>Issue: {issue.issue_id}</small></details></td>
        </tr>)}</tbody></table></div>
    </section>)}
    {error && <p className="ml-quality-error" role="alert">{error}</p>}
    <div className="ml-quality-actions"><p>Unchanged findings stay visible. Preview does not modify your dataset.</p><button type="button" className="semantic-btn primary" disabled={disabled || selected.size === 0} onClick={preview}>Preview selected fixes</button></div>
    <details className="ml-quality-coverage"><summary>What was checked?</summary><p>{data.checks?.length ? data.checks.map(code => checkNames[code] || code).join(', ') : 'Missing values'}. Counts describe the current saved dataset.</p><p>{(data.not_checked || ['Domain rules, outliers and intended data types require review.']).join(' ')}</p></details>
  </section>;
}
