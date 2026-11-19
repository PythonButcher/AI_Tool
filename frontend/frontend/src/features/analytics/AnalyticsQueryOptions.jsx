import React, { useState } from 'react';
import { TbCalendar, TbChevronDown, TbFilter, TbPlus, TbSortDescending, TbUsers, TbX } from 'react-icons/tb';
import { validateFilters } from './analyticsStorage';

const FILTER_OPERATORS = {
  eq: 'Equals', neq: 'Does not equal', gt: 'Greater than', gte: 'At least',
  lt: 'Less than', lte: 'At most', in: 'In list', not_in: 'Outside list',
  contains: 'Contains', is_null: 'Is empty', not_null: 'Is not empty',
};

export default function AnalyticsQueryOptions({ query, view, fields, onChange: changeQuery }) {
  const [openTray, setOpenTray] = useState(null);
  const [filterText, setFilterText] = useState(null);
  const [filterError, setFilterError] = useState('');
  const [segmentText, setSegmentText] = useState(null);
  const filters = query.filters;
  const rules = Array.isArray(filters) ? filters : filters?.rules || (filters?.field ? [filters] : []);
  const setRules = next => changeQuery({ filters: { op: filters?.op || 'and', rules: next } });
  const editRule = (index, patch) => setRules(rules.map((rule, position) => position === index
    ? { ...rule, ...patch, type: rule.type === 'segment' ? undefined : rule.type }
    : rule));
  const toggleTray = name => {
    setFilterError('');
    setOpenTray(previous => previous === name ? null : name);
  };
  const choices = <><option value="">Choose field</option>{fields.map(field => <option key={field.name}>{field.name}</option>)}</>;
  const supportsSort = !['scatter', 'histogram'].includes(view);
  const sortFields = view === 'table' && query.mode === 'rows'
    ? (query.columns?.length ? query.columns : fields.map(field => field.name))
    : [...query.group_by.map(group => group.field), ...query.measures.map(measure => measure.id)];
  const options = [
    ['conditions', 'Filters', TbFilter, rules.length ? String(rules.length) : ''],
    ['time', 'Time & comparison', TbCalendar, query.period?.field || ''],
    ['sort', supportsSort ? 'Sort & limit' : 'Result limit', TbSortDescending, query.limit < 1000 ? String(query.limit) : ''],
    ['segment', 'Compare segments', TbUsers, query.comparison?.kind === 'segment' ? 'On' : ''],
  ];
  return <section className="analytics-author-options" aria-label="Query options">
    <h3>Query options</h3>
    {options.map(([id, title, Icon, detail]) => <React.Fragment key={id}>
      <button type="button" className="analytics-author-option-toggle" aria-expanded={openTray === id || (id === 'conditions' && openTray === 'filters')} onClick={() => toggleTray(id)}>
        <Icon aria-hidden="true" /><span>{title}</span>{detail && <small>{detail}</small>}<TbChevronDown aria-hidden="true" />
      </button>
      {id === openTray && id === 'conditions' && <div className="analytics-author-option-editor">
        {rules.map((rule, index) => Array.isArray(rule) || rule.rules ? (
          <div className="analytics-author-filter-title" key={index}><strong>Nested filter group</strong>
            <button type="button" className="analytics-author-icon" aria-label={`Remove filter ${index + 1}`} onClick={() => setRules(rules.filter((_, i) => i !== index))}><TbX /></button>
          </div>
        ) : (
          <div className="analytics-author-filter" key={index}>
            <label>Field<select aria-label={`Filter ${index + 1} field`} value={rule.field || ''} onChange={event => editRule(index, { field: event.target.value })}>{choices}</select></label>
            <label>Operator<select aria-label={`Filter ${index + 1} operator`} value={rule.operator || 'eq'} onChange={event => editRule(index, { operator: event.target.value })}>
              {Object.entries(FILTER_OPERATORS).map(([operator, label]) => <option value={operator} key={operator}>{label}</option>)}
            </select></label>
            {!['is_null', 'not_null'].includes(rule.operator) && <label>Value<input aria-label={`Filter ${index + 1} value`} value={rule.values?.join(',') ?? rule.value ?? ''}
              onChange={event => editRule(index, { value: event.target.value, values: ['in', 'not_in'].includes(rule.operator) ? event.target.value.split(',').map(value => value.trim()) : undefined })} /></label>}
            <button type="button" className="analytics-author-icon" aria-label={`Remove filter ${index + 1}`} onClick={() => setRules(rules.filter((_, i) => i !== index))}><TbX /></button>
          </div>
        ))}
        {rules.length > 1 && <label>Match<select aria-label="Filter match logic" value={filters?.op || 'and'} onChange={event => changeQuery({ filters: { op: event.target.value, rules } })}>
          <option value="and">All conditions</option><option value="or">Any condition</option>
        </select></label>}
        <div className="analytics-actions">
          <button type="button" onClick={() => setRules([...rules, { field: fields[0]?.name || '', operator: 'eq', value: '' }])}><TbPlus /> Add filter</button>
          <button type="button" onClick={() => toggleTray('filters')}>Advanced JSON</button>
        </div>
      </div>}
      {id === 'conditions' && openTray === 'filters' && <div className="analytics-author-option-editor">
        <label>Filter group JSON<textarea value={filterText ?? JSON.stringify(query.filters || [], null, 2)} onChange={event => setFilterText(event.target.value)} /></label>
        <div className="analytics-actions">
          <button type="button" className="is-primary" onClick={() => {
            try {
              const group = JSON.parse(filterText ?? JSON.stringify(query.filters || []));
              validateFilters(group); changeQuery({ filters: group }); setFilterText(null); toggleTray('conditions');
            } catch (error) { setFilterError(error.message); }
          }}>Apply filter group</button>
          <button type="button" onClick={() => { setFilterText(null); toggleTray('conditions'); }}>Back to filters</button>
        </div>
        {filterError && <p role="alert">{filterError}</p>}
      </div>}
      {id === 'time' && openTray === 'time' && (
        <div className="analytics-author-option-editor">
          <div className="analytics-builder-grid4">
            <label>Date field<select value={query.period?.field || ''} onChange={e => changeQuery({ period: e.target.value ? { field: e.target.value, last_days: 30 } : undefined, comparison: undefined })}>{choices}</select></label>
            {query.period && <>
              <label>Period mode<select value={query.period.last_days ? 'relative' : 'absolute'} onChange={e => changeQuery({ period: { field: query.period.field, ...(e.target.value === 'relative' ? { last_days: 30 } : { start: '', end: '' }) } })}><option value="relative">Last N days</option><option value="absolute">Date range</option></select></label>
              {query.period.last_days ? (
                <label>Days<input type="number" min="1" max="3660" value={query.period.last_days} onChange={e => changeQuery({ period: { ...query.period, last_days: Number(e.target.value) } })} /></label>
              ) : (
                <>
                  <label>From<input type="date" value={query.period.start || ''} onChange={e => changeQuery({ period: { ...query.period, start: e.target.value } })} /></label>
                  <label>Through<input type="date" value={query.period.end || ''} onChange={e => changeQuery({ period: { ...query.period, end: e.target.value } })} /></label>
                </>
              )}
              <label>Compare<select value={query.comparison?.kind || ''} onChange={e => changeQuery({ comparison: e.target.value ? { kind: e.target.value } : undefined })}><option value="">No comparison</option><option value="previous_period">Previous period</option><option value="previous_year">Previous year</option><option value="custom">Custom range</option></select></label>
              {query.comparison?.kind === 'custom' && ['start', 'end'].map(key => <label key={key}>Comparison {key}<input type="date" value={query.comparison[key] || ''} onChange={e => changeQuery({ comparison: { ...query.comparison, [key]: e.target.value } })} /></label>)}
            </>}
          </div>
        </div>
      )}

      {id === 'sort' && openTray === 'sort' && (
        <div className="analytics-author-option-editor">
          <div className="analytics-builder-grid4">
            {supportsSort && <>
              <label>Sort field<select value={query.sort?.field || ''} onChange={e => changeQuery({ sort: e.target.value ? { field: e.target.value, direction: query.sort?.direction || 'asc' } : undefined })}><option value="">Default order</option>{[...new Set(sortFields)].map(name => <option key={name}>{name}</option>)}</select></label>
              <label>Direction<select disabled={!sortFields.length} value={query.sort?.direction || 'asc'} onChange={e => changeQuery({ sort: { field: query.sort?.field || sortFields[0], direction: e.target.value } })}><option value="asc">Ascending</option><option value="desc">Descending</option></select></label>
            </>}
            <label>Maximum results<input type="number" min="1" max="10000" value={query.limit ?? 1000} onChange={e => changeQuery({ limit: Number(e.target.value) })} /></label>
          </div>
        </div>
      )}


      {id === 'segment' && openTray === 'segment' && (
        <div className="analytics-author-option-editor">
          <label className="analytics-checkbox-row"><input type="checkbox" checked={query.comparison?.kind === 'segment'} onChange={e => changeQuery({ comparison: e.target.checked ? { kind: 'segment', filters: [] } : undefined })} />Compare with a separately filtered population</label>
          {query.comparison?.kind === 'segment' && <>
            <p className="analytics-scope">The current filters define the main segment. The baseline uses its own filters within the same date range.</p>
            <textarea aria-label="Baseline segment filters" value={segmentText ?? JSON.stringify(query.comparison.filters, null, 2)} onChange={e => setSegmentText(e.target.value)} />
            <button type="button" className="is-primary" onClick={() => { try { const filters = JSON.parse(segmentText ?? JSON.stringify(query.comparison.filters || [])); validateFilters(filters); changeQuery({ comparison: { kind: 'segment', filters } }); setSegmentText(null); setFilterError(''); } catch (failure) { setFilterError(failure.message); } }}>Apply baseline filters</button>
            {filterError && <p role="alert">{filterError}</p>}
          </>}
        </div>
      )}
    </React.Fragment>)}
  </section>;
}
