import React from 'react';
import AICharts from '../ai/AICharts';
import './DashboardResultSnapshot.css';

export default function DashboardResultSnapshot({ item }) {
  const snapshot = item.resultSnapshot;
  const artifact = snapshot.artifact;
  const grounding = artifact.bi_grounding || {};
  const content = artifact.content || {};
  const metric = grounding.metric_definition?.label || grounding.metric_definition?.name;
  return (
    <section className="dashboard-result-snapshot" aria-label={item.title}>
      <header><strong>{item.title}</strong><span>Saved result</span></header>
      {artifact.type === 'chart' ? <AICharts aiChartType={content.chartType} aiChartData={content.chartData} /> : (
        <div className="dashboard-result-snapshot__kpi">
          <strong>{content.summary?.value_formatted ?? content.summary?.value}</strong><span>{metric}</span>
        </div>
      )}
      <details>
        <summary>Source and filters</summary>
        <p>{item.sourceMetadata?.datasetName || 'Source dataset'} · {grounding.aggregation} · {grounding.row_count} rows</p>
        {grounding.time_granularity && <p>Grouped by {grounding.time_granularity}</p>}
        {(grounding.filters || []).map((filter, index) => (
          <p key={index}>{filter.field} {filter.operator} {String(filter.value ?? filter.values?.join(', ') ?? '')}</p>
        ))}
        {artifact.analysis_lineage?.sources?.map(source => <p key={source.source_id}>{source.name || source.alias} ({source.source_id})</p>)}
        <p>Saved locally {new Date(snapshot.savedAt).toLocaleString()}. Values and filters stay fixed. Dashboard slicers do not apply; ask AI Chat to recompute.</p>
      </details>
    </section>
  );
}
