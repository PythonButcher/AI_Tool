import React, { useState } from 'react';
import { AGGREGATIONS, POSTS, VIEWS } from './analyticsModel';
import { validateFilters } from './analyticsStorage';
import { remapAnalysis } from './analyticsTransforms';

export default function AnalyticsBuilder({ config, fields, metrics = [], onChange }) {
  const [search, setSearch] = useState('');
  const [filterText, setFilterText] = useState(null);
  const [filterError, setFilterError] = useState('');
  const [segmentText, setSegmentText] = useState(null);
  const [oldField, setOldField] = useState('');
  const [newField, setNewField] = useState('');
  const query = config.query;
  const changeQuery = patch => onChange({ ...config, query: { ...query, ...patch } });
  const updateMeasure = (index, patch) => changeQuery({ measures: query.measures.map((m, i) => i === index ? { ...m, ...patch } : m) });
  const addGroup = name => { if (!(query.group_by || []).some(g => g.field === name)) changeQuery({ group_by: [...(query.group_by || []), { field: name }] }); };
  const nextMeasure = () => { const ids = new Set(query.measures.map(m => m.id)); let i = 1; while (ids.has(`m${i}`)) i++; return `m${i}`; };
  const choices = <><option value="">Choose field</option>{fields.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}</>;
  const rules = Array.isArray(query.filters) ? query.filters : query.filters?.rules || [];
  const setRules = next => changeQuery({ filters: { op: query.filters?.op || 'and', rules: next } });
  return <div className="analytics-builder">
    <section>
      <div className="analytics-tile-meta"><h3>Fields</h3><small>{fields.length} available</small></div>
      <input aria-label="Search fields" placeholder="Search fields" value={search} onChange={e => setSearch(e.target.value)} />
      <details><summary>Remap imported or renamed field</summary><div className="analytics-builder-grid"><label>Original field<input value={oldField} onChange={e => setOldField(e.target.value)} /></label><label>Replacement field<select value={newField} onChange={e => setNewField(e.target.value)}>{choices}</select></label></div><button type="button" disabled={!oldField || !newField} onClick={() => onChange(remapAnalysis(config, { [oldField]: newField }))}>Remap field throughout query</button></details>
      <div className="analytics-field-list">{fields.filter(f => f.name.toLowerCase().includes(search.toLowerCase())).map(f => <div key={f.name} draggable title={`Examples: ${(f.examples || []).join(', ')}`} onDragStart={e => e.dataTransfer.setData('text/plain', f.name)}><span>{f.name} <small>{f.type}</small></span><button type="button" onClick={() => addGroup(f.name)} aria-label={`Group by ${f.name}`}>Group</button><button type="button" disabled={query.measures.length >= 12} onClick={() => changeQuery({ measures: [...query.measures, { id: nextMeasure(), field: f.name, aggregation: f.type === 'number' ? 'sum' : 'count_distinct' }] })} aria-label={`Measure ${f.name}`}>Measure</button></div>)}</div>
    </section>
    <section onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const name = e.dataTransfer.getData('text/plain'); const field = fields.find(f => f.name === name); if (field && query.measures.length < 12) changeQuery({ measures: [...query.measures, { id: nextMeasure(), field: name, aggregation: field.type === 'number' ? 'sum' : 'count_distinct' }] }); }}>
      <div className="analytics-tile-meta"><h3>Measures</h3><small>{query.measures.length} / 12</small></div>
      {query.measures.map((measure, index) => <fieldset key={index}><legend>Measure {index + 1}</legend>
        <div className="analytics-builder-grid">
          <label>ID<input value={measure.id} onChange={e => updateMeasure(index, { id: e.target.value })} /></label>
          <label>Label<input value={measure.label || ''} onChange={e => updateMeasure(index, { label: e.target.value })} /></label>
        </div>
        <label>Governed metric<select value={measure.metric_id || ''} onChange={e => updateMeasure(index, { metric_id: e.target.value, formula: '' })}><option value="">Field or calculation</option>{metrics.map(m => <option key={m.id} value={m.id}>{m.label || m.name || m.id}</option>)}</select></label>
        {!measure.metric_id && <>
          <div className="analytics-builder-grid">
            <label>Field<select value={measure.field || ''} onChange={e => updateMeasure(index, { field: e.target.value })}>{choices}</select></label>
            <label>Aggregation<select value={measure.aggregation || 'sum'} onChange={e => updateMeasure(index, { aggregation: e.target.value })}>{AGGREGATIONS.map(agg => <option key={agg}>{agg}</option>)}</select></label>
          </div>
          {measure.aggregation === 'percentile' && <label>Percentile (0–1)<input type="number" min="0" max="1" step="0.01" value={measure.percentile ?? .5} onChange={e => updateMeasure(index, { percentile: Number(e.target.value) })} /></label>}
          <label>Formula over earlier measure IDs<input placeholder="(revenue - cost) / revenue" value={measure.formula || ''} onChange={e => updateMeasure(index, { formula: e.target.value })} /></label>
        </>}
        <div className="analytics-builder-grid">
          <label>Calculation<select value={measure.post || 'none'} onChange={e => updateMeasure(index, { post: e.target.value })}>{POSTS.map(post => <option key={post}>{post}</option>)}</select></label>
          {measure.post === 'moving_average' && <label>Window<input type="number" min="1" max="100" value={measure.window || 3} onChange={e => updateMeasure(index, { window: Number(e.target.value) })} /></label>}
        </div>
        <button type="button" disabled={query.measures.length === 1} onClick={() => changeQuery({ measures: query.measures.filter((_, i) => i !== index) })}>Remove measure</button>
      </fieldset>)}
      <button type="button" disabled={query.measures.length >= 12} onClick={() => changeQuery({ measures: [...query.measures, { id: nextMeasure(), aggregation: 'count_rows' }] })}>Add measure</button>
    </section>
    <section onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const name = e.dataTransfer.getData('text/plain'); if (fields.some(f => f.name === name)) addGroup(name); }}>
      <div className="analytics-tile-meta"><h3>Group and time</h3><small>{(query.group_by || []).length} groups</small></div>
      {(query.group_by || []).map((group, index) => <div className="analytics-control-row" key={group.field}><span>{group.field}</span><select aria-label={`Date grain for ${group.field}`} value={group.grain || ''} onChange={e => changeQuery({ group_by: query.group_by.map((g, i) => i === index ? { ...g, grain: e.target.value || undefined } : g) })}><option value="">Categories</option>{['day', 'week', 'month', 'quarter', 'year'].map(grain => <option key={grain}>{grain}</option>)}</select><button type="button" aria-label={`Remove grouping ${group.field}`} onClick={() => changeQuery({ group_by: query.group_by.filter((_, i) => i !== index) })}>×</button></div>)}
      <select aria-label="Add grouping field" value="" onChange={e => addGroup(e.target.value)}>{choices}</select>
      <label>Date field<select value={query.period?.field || ''} onChange={e => changeQuery({ period: e.target.value ? { field: e.target.value, last_days: 30 } : undefined, comparison: undefined })}>{choices}</select></label>
      {query.period && <>
        <div className="analytics-builder-grid">
          <label>Period mode<select value={query.period.last_days ? 'relative' : 'absolute'} onChange={e => changeQuery({ period: { field: query.period.field, ...(e.target.value === 'relative' ? { last_days: 30 } : { start: '', end: '' }) } })}><option value="relative">Last N days</option><option value="absolute">Date range</option></select></label>
          {query.period.last_days && <label>Days<input type="number" min="1" max="3660" value={query.period.last_days} onChange={e => changeQuery({ period: { ...query.period, last_days: Number(e.target.value) } })} /></label>}
        </div>
        {!query.period.last_days && <div className="analytics-builder-grid"><label>From<input type="date" value={query.period.start || ''} onChange={e => changeQuery({ period: { ...query.period, start: e.target.value } })} /></label><label>Through<input type="date" value={query.period.end || ''} onChange={e => changeQuery({ period: { ...query.period, end: e.target.value } })} /></label></div>}
        <label>Compare<select value={query.comparison?.kind || ''} onChange={e => changeQuery({ comparison: e.target.value ? { kind: e.target.value } : undefined })}><option value="">No comparison</option><option value="previous_period">Previous period</option><option value="previous_year">Previous year</option><option value="custom">Custom range</option></select></label>
        {query.comparison?.kind === 'custom' && <div className="analytics-builder-grid">{['start', 'end'].map(key => <label key={key}>Comparison {key}<input type="date" value={query.comparison[key] || ''} onChange={e => changeQuery({ comparison: { ...query.comparison, [key]: e.target.value } })} /></label>)}</div>}
      </>}
    </section>
    <section>
      <div className="analytics-tile-meta"><h3>Filters</h3><small>{rules.length} active</small></div>
      <label>Match<select value={query.filters?.op || 'and'} onChange={e => changeQuery({ filters: { op: e.target.value, rules } })}><option value="and">All conditions</option><option value="or">Any condition</option></select></label>
      {rules.map((rule, index) => <fieldset key={index}>{Array.isArray(rule) || rule.rules ? <p>Nested group — edit in advanced filter editor.</p> : <><div className="analytics-builder-grid"><select aria-label={`Filter ${index + 1} field`} value={rule.field || ''} onChange={e => setRules(rules.map((r, i) => i === index ? { ...r, field: e.target.value } : r))}>{choices}</select><select aria-label={`Filter ${index + 1} operator`} value={rule.operator || 'eq'} onChange={e => setRules(rules.map((r, i) => i === index ? { ...r, operator: e.target.value } : r))}>{['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'not_in', 'contains', 'is_null', 'not_null'].map(op => <option key={op}>{op}</option>)}</select></div>
        <input aria-label={`Filter ${index + 1} value`} placeholder="Value (comma-separated for in)" value={rule.values?.join(',') ?? rule.value ?? ''} onChange={e => setRules(rules.map((r, i) => i === index ? { ...r, value: e.target.value, values: ['in', 'not_in'].includes(r.operator) ? e.target.value.split(',').map(v => v.trim()) : undefined } : r))} /></>}
        <button type="button" onClick={() => setRules(rules.filter((_, i) => i !== index))}>Remove filter</button></fieldset>)}
      <button type="button" onClick={() => setRules([...rules, { field: fields[0]?.name || '', operator: 'eq', value: '' }])}>Add filter</button>
      <details><summary>Advanced nested filters</summary><textarea aria-label="Filter group JSON" value={filterText ?? JSON.stringify(query.filters, null, 2)} onChange={e => setFilterText(e.target.value)} /><button type="button" onClick={() => { try { const filters = JSON.parse(filterText ?? JSON.stringify(query.filters)); validateFilters(filters); changeQuery({ filters }); setFilterText(null); setFilterError(''); } catch (failure) { setFilterError(failure.message); } }}>Apply filter group</button>{filterError && <p role="alert">{filterError}</p>}</details>
    </section>
    <section>
      <h3>Segment comparison</h3>
      <label className="analytics-checkbox-row"><input type="checkbox" checked={query.comparison?.kind === 'segment'} onChange={e => changeQuery({ comparison: e.target.checked ? { kind: 'segment', filters: [] } : undefined })} />Compare with a separately filtered population</label>
      {query.comparison?.kind === 'segment' && <><p>The current filters define the main segment. The baseline uses these filters and the same date range.</p><textarea aria-label="Baseline segment filters" value={segmentText ?? JSON.stringify(query.comparison.filters, null, 2)} onChange={e => setSegmentText(e.target.value)} /><button type="button" onClick={() => { try { const filters = JSON.parse(segmentText ?? '[]'); validateFilters(filters); changeQuery({ comparison: { kind: 'segment', filters } }); setSegmentText(null); setFilterError(''); } catch (failure) { setFilterError(failure.message); } }}>Apply baseline filters</button></>}
    </section>
    <section>
      <h3>Result</h3>
      <label>Visualization<select value={config.view} onChange={e => onChange({ ...config, view: e.target.value, query: { ...query, mode: 'aggregate' } })}>{VIEWS.map(view => <option key={view}>{view}</option>)}</select></label>
      <button type="button" onClick={() => onChange({ ...config, view: query.group_by.some(g => g.grain) ? 'line' : query.group_by.length ? 'bar' : 'kpi' })}>Suggest chart from fields</button>
      <div className="analytics-builder-grid">
        <label>Sort field<select value={query.sort?.field || ''} onChange={e => changeQuery({ sort: e.target.value ? { field: e.target.value, direction: query.sort?.direction || 'asc' } : undefined })}><option value="">Default order</option>{[...query.group_by.map(g => g.field), ...query.measures.map(m => m.id)].map(name => <option key={name}>{name}</option>)}</select></label>
        <label>Direction<select value={query.sort?.direction || 'asc'} onChange={e => changeQuery({ sort: { field: query.sort?.field || query.measures[0].id, direction: e.target.value } })}><option value="asc">Ascending</option><option value="desc">Descending</option></select></label>
      </div>
      <div className="analytics-builder-grid">
        <label>Top N / result limit<input type="number" min="1" max="10000" value={query.limit} onChange={e => changeQuery({ limit: Number(e.target.value) })} /></label>
        {config.view === 'histogram' && <label>Bins<input type="number" min="1" max="100" value={query.bins || 10} onChange={e => changeQuery({ bins: Number(e.target.value) })} /></label>}
      </div>
    </section>
  </div>;
}
