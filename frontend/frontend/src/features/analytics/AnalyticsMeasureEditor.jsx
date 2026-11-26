import React from 'react';
import { TbChevronDown } from 'react-icons/tb';
import { AGGREGATIONS, POSTS } from './analyticsModel';

export const AGGREGATION_LABELS = {
  sum: 'Sum', avg: 'Average', min: 'Minimum', max: 'Maximum', count: 'Count values',
  count_distinct: 'Distinct count', count_rows: 'Row count', median: 'Median', percentile: 'Percentile',
};
const POST_LABELS = {
  none: 'None', percent_total: 'Percent of total', running_total: 'Running total',
  moving_average: 'Moving average', rank: 'Rank', cumulative_percent: 'Cumulative percent',
};

export default function AnalyticsMeasureEditor({ measure, index, fields, metrics, onChange }) {
  const ordinal = index + 1;
  const fieldUnavailable = measure.field && !fields.some(field => field.name === measure.field);
  const metricUnavailable = measure.metric_id && !metrics.some(metric => metric.id === measure.metric_id);

  return <div className="analytics-author-measure-editor">
    <div className="analytics-author-input-grid">
      {!measure.metric_id && !measure.formula && <>
        <label>Source field<select aria-label={`Measure ${ordinal} field`} value={measure.field || ''} onChange={event => {
          const field = fields.find(option => option.name === event.target.value);
          onChange({
            field: event.target.value,
            ...((!measure.label || measure.label === measure.field || measure.aggregation === 'count_rows') && field ? { label: field.name } : {}),
            ...(field && measure.aggregation === 'count_rows' ? { aggregation: field.type === 'number' ? 'sum' : 'count_distinct' } : {}),
          });
        }}>
          <option value="">{measure.aggregation === 'count_rows' ? 'All records' : 'Choose field'}</option>
          {fieldUnavailable && <option value={measure.field}>{measure.field} (unavailable)</option>}
          {fields.map(field => <option key={field.name}>{field.name}</option>)}
        </select></label>
        <label>Aggregation<select aria-label={`Measure ${ordinal} aggregation`} value={measure.aggregation || 'sum'}
          onChange={event => onChange({ aggregation: event.target.value })}>
          {AGGREGATIONS.map(value => <option key={value} value={value}>{AGGREGATION_LABELS[value]}</option>)}
        </select></label>
        {measure.aggregation === 'percentile' && <label>Percentile (0–1)<input type="number" min="0" max="1" step="0.01"
          value={measure.percentile ?? .5} onChange={event => onChange({ percentile: Number(event.target.value) })} /></label>}
      </>}
      <label>Display name<input value={measure.label || ''} placeholder="Display label" onChange={event => onChange({ label: event.target.value })} /></label>
    </div>
    <details className="analytics-author-measure-advanced" open={measure.metric_id || measure.formula || (measure.post && measure.post !== 'none') ? true : undefined}>
      <summary>Advanced measure settings <TbChevronDown aria-hidden="true" /></summary>
      <div className="analytics-author-input-grid">
        <label>Measure ID<input value={measure.id} onChange={event => onChange({ id: event.target.value })} /></label>
        <label>Governed metric<select value={measure.metric_id || ''} onChange={event => onChange({ metric_id: event.target.value, formula: '' })}>
          <option value="">Use field or formula</option>
          {metricUnavailable && <option value={measure.metric_id}>{measure.metric_id} (unavailable)</option>}
          {metrics.map(metric => <option key={metric.id} value={metric.id}>{metric.label || metric.name || metric.id}</option>)}
        </select></label>
        {!measure.metric_id && <label className="analytics-author-wide">Formula over earlier measure IDs<input placeholder="(revenue - cost) / revenue"
          value={measure.formula || ''} onChange={event => onChange({ formula: event.target.value })} /></label>}
        <label>Calculation<select value={measure.post || 'none'} onChange={event => onChange({ post: event.target.value })}>
          {POSTS.map(value => <option key={value} value={value}>{POST_LABELS[value]}</option>)}
        </select></label>
        {measure.post === 'moving_average' && <label>Window<input type="number" min="1" max="100"
          value={measure.window ?? 3} onChange={event => onChange({ window: Number(event.target.value) })} /></label>}
      </div>
    </details>
  </div>;
}
