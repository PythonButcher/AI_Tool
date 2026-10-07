import React from 'react';
import EvidencePlot, { metricText } from './EvidencePlot';
import { readable } from './TrainingStage';

export default function LocalSummary({ details, onExports }) {
  const { selection, configuration, summary } = details;
  const development = summary.development_evidence.candidates.find(item => item.family === selection.family);
  const roles = configuration.roles;
  const limits = [...new Set(summary.limitations)];
  return <section className="ml-output-section ml-cycle-summary" aria-label="Local experiment summary">
    <div className="ml-section-heading"><div><span className="ml-eyebrow">Local experiment record</span><h3>{selection.experiment_name || 'Selected experiment'}</h3><p>{summary.problem_statement || selection.intended_use}</p></div><button className="semantic-btn" onClick={onExports}>Export this record</button></div>
    <div className="ml-summary-pair">
      <div><h4>Decision & use boundaries</h4><p><strong>{readable(selection.family)}</strong> selected by {selection.reviewed_by}.</p><p>{selection.intended_use}</p><h4>Prohibited use</h4><p>{selection.prohibited_use}</p></div>
      <div><h4>Data & method</h4><p>{summary.dataset_snapshot.row_count.toLocaleString()} rows · {roles.numeric.length + roles.categorical.length} features</p><p>{readable(configuration.validation.strategy)} validation · {configuration.validation.folds} development folds</p>{roles.target && <p>{configuration.task_type === 'anomaly_detection' ? 'Evaluation label' : 'Target'}: <strong>{roles.target}</strong></p>}{configuration.task_type === 'forecasting' && <p>{configuration.validation.horizon} periods per horizon · {configuration.validation.lags} target lags · frequency {configuration.validation.frequency}</p>}{configuration.task_type === 'clustering' && <p>{configuration.candidate.cluster_count} requested clusters · scaled Euclidean distance</p>}{configuration.task_type === 'anomaly_detection' && <p>{metricText(configuration.candidate.contamination * 100)}% expected unusual fraction · training-derived threshold</p>}</div>
    </div>
    <h4>Evidence for the selected candidate</h4><p>Development results supported nomination. The final evaluation applies only to this candidate and did not rank alternatives.</p>
    <div className="ml-table-scroll"><table><thead><tr><th>Metric</th><th>Development mean</th><th>Final holdout</th><th>Final baseline</th></tr></thead><tbody>{Object.entries(summary.final_evidence.metrics).map(([name, value]) => <tr key={name}><th scope="row">{readable(name)}</th><td>{metricText(development?.metrics[name])}</td><td>{metricText(value)}</td><td>{metricText(summary.final_evidence.baseline[name])}</td></tr>)}</tbody></table></div>
    <EvidencePlot evidence={summary.final_evidence.evidence} title="Selected candidate" />
    <h4>Limitations</h4><ul>{limits.map(item => <li key={item}>{item}</li>)}</ul>
    <details><summary>Lineage and reproducibility</summary><dl><dt>Selection</dt><dd>{selection.selection_id}</dd><dt>Configuration</dt><dd>{selection.configuration_id}</dd><dt>Snapshot</dt><dd>{summary.dataset_snapshot.snapshot_id}</dd><dt>Recipe hash</dt><dd>{summary.dataset_snapshot.transformation_recipe_hash}</dd><dt>Fitted artifact hash</dt><dd>{selection.artifact.sha256}</dd><dt>Runtime versions</dt><dd>{Object.entries(summary.development_evidence.runtime_versions || {}).map(([name, value]) => `${name} ${value}`).join(' · ') || 'See the reproducibility manifest'}</dd></dl></details>
    <p className="ml-output-note">This summary stays local. Download cycle-summary.json from Exports to keep the complete record. Selection does not imply deployment approval.</p>
  </section>;
}
