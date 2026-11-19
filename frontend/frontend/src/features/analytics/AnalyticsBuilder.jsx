import React, { useState } from 'react';
import {
  FaCalendarAlt, FaChartArea, FaChartBar, FaChartLine, FaChartPie,
  FaCog, FaExchangeAlt, FaFilter, FaHashtag, FaLayerGroup, FaMagic,
  FaPlus, FaSearch, FaSortAmountDown, FaTable, FaTimes, FaUsers,
} from 'react-icons/fa';
import { AGGREGATIONS, POSTS, VIEWS } from './analyticsModel';
import { validateFilters } from './analyticsStorage';
import { remapAnalysis } from './analyticsTransforms';

const VIEW_ICONS = {
  bar: { label: 'Bar', icon: FaChartBar },
  horizontal: { label: 'Horizontal bar', icon: FaChartBar },
  grouped: { label: 'Grouped bar', icon: FaChartBar },
  stacked: { label: 'Stacked bar', icon: FaLayerGroup },
  percent_stacked: { label: '100% stacked bar', icon: FaLayerGroup },
  line: { label: 'Line', icon: FaChartLine },
  area: { label: 'Area', icon: FaChartArea },
  stacked_area: { label: 'Stacked area', icon: FaChartArea },
  scatter: { label: 'Scatter', icon: FaChartLine },
  pie: { label: 'Pie', icon: FaChartPie },
  doughnut: { label: 'Donut', icon: FaChartPie },
  histogram: { label: 'Histogram', icon: FaChartBar },
  kpi: { label: 'KPI', icon: FaHashtag },
  pivot: { label: 'Pivot', icon: FaTable },
  table: { label: 'Table', icon: FaTable },
};
const COMMON_VIEWS = ['bar', 'line', 'area', 'table', 'kpi'];

export default function AnalyticsBuilder({ config, fields, metrics = [], sourceLoading, onChange }) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [activeMeasureIdx, setActiveMeasureIdx] = useState(null);
  const [openTray, setOpenTray] = useState(null); // 'time' | 'filters' | 'segment' | 'sort' | 'remap'
  const [filterText, setFilterText] = useState(null);
  const [filterError, setFilterError] = useState('');
  const [segmentText, setSegmentText] = useState(null);
  const [oldField, setOldField] = useState('');
  const [newField, setNewField] = useState('');

  const query = config.query;
  const changeQuery = patch => onChange({ ...config, query: { ...query, ...patch } });
  const changeView = view => onChange({ ...config, view, query: { ...query, mode: 'aggregate' } });
  const updateMeasure = (index, patch) => changeQuery({ measures: query.measures.map((m, i) => i === index ? { ...m, ...patch } : m) });
  const addGroup = name => { if (name && !(query.group_by || []).some(g => g.field === name)) changeQuery({ group_by: [...(query.group_by || []), { field: name }] }); };
  const nextMeasure = () => { const ids = new Set(query.measures.map(m => m.id)); let i = 1; while (ids.has(`m${i}`)) i++; return `m${i}`; };
  const choices = <><option value="">Choose field</option>{fields.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}</>;
  const rules = Array.isArray(query.filters) ? query.filters : query.filters?.rules || [];
  const setRules = next => changeQuery({ filters: { op: query.filters?.op || 'and', rules: next } });
  const editRule = (index, patch) => setRules(rules.map((rule, position) => position === index
    ? { ...rule, ...patch, type: rule.type === 'segment' ? undefined : rule.type }
    : rule));
  const toggleTray = name => setOpenTray(prev => prev === name ? null : name);

  const visibleFields = fields.filter(f =>
    (typeFilter === 'all' || f.type === typeFilter) &&
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  return <div className="analytics-builder-studio">
    {/* Schema & Fields Dock */}
    <section className="analytics-schema-panel">
      <div className="analytics-schema-header">
        <div className="analytics-card-title"><FaLayerGroup /><span>Fields</span><small>{fields.length}</small></div>
        <button type="button" className={`analytics-icon-pill ${openTray === 'remap' ? 'is-selected' : ''}`} onClick={() => toggleTray('remap')} title="Remap imported or renamed field">
          <FaExchangeAlt /><span>Remap</span>
        </button>
      </div>

      {openTray === 'remap' && <div className="analytics-popover-tray">
        <div className="analytics-builder-grid">
          <label>Original field<input placeholder="Old name" value={oldField} onChange={e => setOldField(e.target.value)} /></label>
          <label>Replacement field<select value={newField} onChange={e => setNewField(e.target.value)}>{choices}</select></label>
        </div>
        <button type="button" className="is-primary" disabled={!oldField || !newField} onClick={() => { onChange(remapAnalysis(config, { [oldField]: newField })); setOpenTray(null); }}>Remap field throughout query</button>
      </div>}

      <div className="analytics-search-box">
        <FaSearch className="analytics-search-icon" />
        <input aria-label="Search fields" placeholder="Search fields…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="analytics-type-pills" role="group" aria-label="Filter fields by type">
        {[['all', 'All'], ['number', '# Num'], ['string', 'Abc'], ['date', 'Date']].map(([key, label]) => (
          <button type="button" key={key} className={typeFilter === key ? 'is-selected' : ''} onClick={() => setTypeFilter(key)}>{label}</button>
        ))}
      </div>

      <div className="analytics-field-list">
        {visibleFields.map(f => (
          <div
            key={f.name}
            className={`analytics-field-item is-type-${f.type}`}
            draggable
            title={`Examples: ${(f.examples || []).join(', ')}`}
            onDragStart={e => e.dataTransfer.setData('text/plain', f.name)}
          >
            <span className="analytics-field-badge" aria-label={f.type}>{f.type === 'number' ? '#' : f.type === 'date' ? <FaCalendarAlt /> : 'Aa'}</span>
            <span className="analytics-field-name">{f.name}</span>
            <div className="analytics-field-quick">
              <button type="button" onClick={() => addGroup(f.name)} aria-label={`Group by ${f.name}`} title={`Group by ${f.name}`}>+G</button>
              <button type="button" disabled={query.measures.length >= 12} onClick={() => changeQuery({ measures: [...query.measures, { id: nextMeasure(), field: f.name, aggregation: f.type === 'number' ? 'sum' : 'count_distinct' }] })} aria-label={`Measure ${f.name}`} title={`Add ${f.name} as measure`}>+M</button>
            </div>
          </div>
        ))}
        {!visibleFields.length && <p className="analytics-empty-hint">{sourceLoading ? 'Loading fields…' : config.source ? 'No matching fields.' : 'Choose a dataset to browse fields.'}</p>}
      </div>
    </section>

    {/* Visual Query Shelves (Chart Type Strip + Measure/Dimension/Filter Pill Shelves) */}
    <div className="analytics-shelves-stack">
      {/* Visualization Type Strip */}
      <section className="analytics-viz-ribbon">
        <div className="analytics-viz-strip" role="group" aria-label="Chart type selector">
          {COMMON_VIEWS.map(view => {
            const meta = VIEW_ICONS[view];
            const Icon = meta.icon;
            return (
              <button
                type="button"
                key={view}
                className={`analytics-viz-tile ${config.view === view ? 'is-selected' : ''}`}
                onClick={() => changeView(view)}
                aria-pressed={config.view === view}
              >
                <Icon /><span>{meta.label}</span>
              </button>
            );
          })}
        </div>
        <div className="analytics-viz-controls">
          <label className="analytics-inline-select">Visualization<select value={config.view} onChange={e => changeView(e.target.value)}>{VIEWS.map(view => <option key={view} value={view}>{VIEW_ICONS[view].label}</option>)}</select></label>
          <button type="button" className="analytics-icon-btn" aria-label="Suggest chart from fields" title="Suggest chart from fields" onClick={() => changeView(query.group_by.some(g => g.grain) ? 'line' : query.group_by.length ? 'bar' : 'kpi')}><FaMagic /></button>
          <button type="button" className={`analytics-icon-pill ${openTray === 'sort' ? 'is-selected' : ''}`} aria-expanded={openTray === 'sort'} onClick={() => toggleTray('sort')}><FaSortAmountDown /><span>Sort & limit</span></button>
        </div>
      </section>

      {/* Measures Shelf */}
      <section
        className="analytics-shelf-row"
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const name = e.dataTransfer.getData('text/plain'); const field = fields.find(f => f.name === name); if (field && query.measures.length < 12) changeQuery({ measures: [...query.measures, { id: nextMeasure(), field: name, aggregation: field.type === 'number' ? 'sum' : 'count_distinct' }] }); }}
      >
        <span className="analytics-shelf-label"><FaHashtag /> Measures</span>
        <div className="analytics-shelf-pills">
          {query.measures.map((measure, index) => {
            const isEditing = activeMeasureIdx === index;
            return (
              <div key={index} className={`analytics-measure-pill ${isEditing ? 'is-open' : ''}`}>
                <span className="analytics-pill-agg">{(measure.metric_id ? 'METRIC' : measure.formula ? 'FX' : measure.aggregation || 'sum').toUpperCase()}</span>
                {!measure.metric_id ? (
                  <select aria-label={`Measure ${index + 1} field`} value={measure.field || ''} onChange={e => updateMeasure(index, { field: e.target.value })}>
                    <option value="">{measure.aggregation === 'count_rows' ? 'All rows' : 'Choose field'}</option>
                    {fields.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
                  </select>
                ) : (
                  <span className="analytics-pill-name">{measure.metric_id}</span>
                )}
                <select aria-label={`Measure ${index + 1} aggregation`} value={measure.aggregation || 'sum'} onChange={e => updateMeasure(index, { aggregation: e.target.value })}>
                  {AGGREGATIONS.map(agg => <option key={agg} value={agg}>{agg}</option>)}
                </select>
                <button type="button" className="analytics-pill-gear" onClick={() => setActiveMeasureIdx(isEditing ? null : index)} title="Configure formula, post-calculation or label"><FaCog /></button>
                <button type="button" className="analytics-pill-remove" disabled={query.measures.length === 1} onClick={() => { changeQuery({ measures: query.measures.filter((_, i) => i !== index) }); if (isEditing) setActiveMeasureIdx(null); }} title="Remove measure"><FaTimes /></button>
              </div>
            );
          })}
          <button type="button" className="analytics-add-pill" disabled={query.measures.length >= 12} onClick={() => { const nextIdx = query.measures.length; changeQuery({ measures: [...query.measures, { id: nextMeasure(), aggregation: 'count_rows' }] }); setActiveMeasureIdx(nextIdx); }}><FaPlus /><span>Add measure</span></button>
        </div>
      </section>

      {/* Active Measure Popover Drawer */}
      {activeMeasureIdx !== null && query.measures[activeMeasureIdx] && (() => {
        const index = activeMeasureIdx;
        const measure = query.measures[index];
        return (
          <div className="analytics-popover-tray analytics-measure-editor">
            <div className="analytics-tile-meta">
              <strong>Configure Measure #{index + 1} ({measure.id})</strong>
              <button type="button" onClick={() => setActiveMeasureIdx(null)}>Done</button>
            </div>
            <div className="analytics-builder-grid4">
              <label>ID<input value={measure.id} onChange={e => updateMeasure(index, { id: e.target.value })} /></label>
              <label>Label<input placeholder="Display label" value={measure.label || ''} onChange={e => updateMeasure(index, { label: e.target.value })} /></label>
              <label>Governed metric<select value={measure.metric_id || ''} onChange={e => updateMeasure(index, { metric_id: e.target.value, formula: '' })}><option value="">Field or calculation</option>{metrics.map(m => <option key={m.id} value={m.id}>{m.label || m.name || m.id}</option>)}</select></label>
              <label>Calculation<select value={measure.post || 'none'} onChange={e => updateMeasure(index, { post: e.target.value })}>{POSTS.map(post => <option key={post}>{post}</option>)}</select></label>
            </div>
            {!measure.metric_id && <div className="analytics-builder-grid">
              <label>Formula over earlier measure IDs<input placeholder="(revenue - cost) / revenue" value={measure.formula || ''} onChange={e => updateMeasure(index, { formula: e.target.value })} /></label>
              {measure.aggregation === 'percentile' && <label>Percentile (0–1)<input type="number" min="0" max="1" step="0.01" value={measure.percentile ?? .5} onChange={e => updateMeasure(index, { percentile: Number(e.target.value) })} /></label>}
              {measure.post === 'moving_average' && <label>Window<input type="number" min="1" max="100" value={measure.window || 3} onChange={e => updateMeasure(index, { window: Number(e.target.value) })} /></label>}
            </div>}
          </div>
        );
      })()}

      {/* Group By & Time Intelligence Shelf */}
      <section
        className="analytics-shelf-row"
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const name = e.dataTransfer.getData('text/plain'); if (fields.some(f => f.name === name)) addGroup(name); }}
      >
        <span className="analytics-shelf-label"><FaLayerGroup /> Group & Time</span>
        <div className="analytics-shelf-pills">
          {(query.group_by || []).map((group, index) => (
            <div className="analytics-group-pill" key={group.field}>
              <span className="analytics-pill-name">{group.field}</span>
              <select aria-label={`Date grain for ${group.field}`} value={group.grain || ''} onChange={e => changeQuery({ group_by: query.group_by.map((g, i) => i === index ? { ...g, grain: e.target.value || undefined } : g) })}>
                <option value="">Categories</option>
                {['day', 'week', 'month', 'quarter', 'year'].map(grain => <option key={grain}>{grain}</option>)}
              </select>
              <button type="button" className="analytics-pill-remove" aria-label={`Remove grouping ${group.field}`} onClick={() => changeQuery({ group_by: query.group_by.filter((_, i) => i !== index) })}>×</button>
            </div>
          ))}
          <select className="analytics-add-select" aria-label="Add grouping field" value="" onChange={e => addGroup(e.target.value)}>
            <option value="">+ Add dimension…</option>
            {fields.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
          </select>
          <button type="button" className={`analytics-icon-pill ${openTray === 'time' || query.period ? 'is-selected' : ''}`} onClick={() => toggleTray('time')}>
            <FaCalendarAlt /><span>{query.period ? `${query.period.field} (${query.period.last_days ? `${query.period.last_days}d` : 'range'})` : 'Time range & compare'}</span>
          </button>
        </div>
      </section>

      {/* Filters & Segment Shelf */}
      <section className="analytics-shelf-row">
        <span className="analytics-shelf-label"><FaFilter /> Filters</span>
        <div className="analytics-shelf-pills">
          {rules.map((rule, index) => (
            Array.isArray(rule) || rule.rules ? (
              <span key={index} className="analytics-filter-pill">Nested group <button type="button" onClick={() => setRules(rules.filter((_, i) => i !== index))}>×</button></span>
            ) : (
              <div key={index} className="analytics-filter-pill">
                <select aria-label={`Filter ${index + 1} field`} value={rule.field || ''} onChange={e => editRule(index, { field: e.target.value })}>{choices}</select>
                <select aria-label={`Filter ${index + 1} operator`} value={rule.operator || 'eq'} onChange={e => editRule(index, { operator: e.target.value })}>{['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'not_in', 'contains', 'is_null', 'not_null'].map(op => <option key={op}>{op}</option>)}</select>
                <input aria-label={`Filter ${index + 1} value`} placeholder="Value…" value={rule.values?.join(',') ?? rule.value ?? ''} onChange={e => editRule(index, { value: e.target.value, values: ['in', 'not_in'].includes(rule.operator) ? e.target.value.split(',').map(v => v.trim()) : undefined })} />
                <button type="button" className="analytics-pill-remove" onClick={() => setRules(rules.filter((_, i) => i !== index))} title="Remove filter">×</button>
              </div>
            )
          ))}
          <button type="button" className="analytics-add-pill" onClick={() => setRules([...rules, { field: fields[0]?.name || '', operator: 'eq', value: '' }])}><FaPlus /><span>Add filter</span></button>
          {rules.length > 1 && (
            <select className="analytics-add-select" aria-label="Filter match logic" value={query.filters?.op || 'and'} onChange={e => changeQuery({ filters: { op: e.target.value, rules } })}>
              <option value="and">Match ALL (AND)</option>
              <option value="or">Match ANY (OR)</option>
            </select>
          )}
          <button type="button" className={`analytics-icon-pill ${openTray === 'filters' ? 'is-selected' : ''}`} onClick={() => toggleTray('filters')}>Advanced JSON</button>
          <button type="button" className={`analytics-icon-pill ${openTray === 'segment' || query.comparison?.kind === 'segment' ? 'is-selected' : ''}`} onClick={() => toggleTray('segment')}><FaUsers /><span>Segment compare</span></button>
        </div>
      </section>

      {/* Expandable Studio Trays (Time, Sort, Advanced Filters, Segment Comparison) */}
      {openTray === 'time' && (
        <div className="analytics-popover-tray">
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

      {openTray === 'sort' && (
        <div className="analytics-popover-tray">
          <div className="analytics-builder-grid4">
            <label>Sort field<select value={query.sort?.field || ''} onChange={e => changeQuery({ sort: e.target.value ? { field: e.target.value, direction: query.sort?.direction || 'asc' } : undefined })}><option value="">Default order</option>{[...query.group_by.map(g => g.field), ...query.measures.map(m => m.id)].map(name => <option key={name}>{name}</option>)}</select></label>
            <label>Direction<select value={query.sort?.direction || 'asc'} onChange={e => changeQuery({ sort: { field: query.sort?.field || query.measures[0].id, direction: e.target.value } })}><option value="asc">Ascending</option><option value="desc">Descending</option></select></label>
            <label>Top N / result limit<input type="number" min="1" max="10000" value={query.limit} onChange={e => changeQuery({ limit: Number(e.target.value) })} /></label>
            {config.view === 'histogram' && <label>Bins<input type="number" min="1" max="100" value={query.bins || 10} onChange={e => changeQuery({ bins: Number(e.target.value) })} /></label>}
          </div>
        </div>
      )}

      {openTray === 'filters' && (
        <div className="analytics-popover-tray">
          <label>Nested filter group JSON<textarea aria-label="Filter group JSON" value={filterText ?? JSON.stringify(query.filters, null, 2)} onChange={e => setFilterText(e.target.value)} /></label>
          <div className="analytics-actions">
            <button type="button" className="is-primary" onClick={() => { try { const filters = JSON.parse(filterText ?? JSON.stringify(query.filters)); validateFilters(filters); changeQuery({ filters }); setFilterText(null); setFilterError(''); setOpenTray(null); } catch (failure) { setFilterError(failure.message); } }}>Apply filter group</button>
            {filterError && <p role="alert">{filterError}</p>}
          </div>
        </div>
      )}

      {openTray === 'segment' && (
        <div className="analytics-popover-tray">
          <label className="analytics-checkbox-row"><input type="checkbox" checked={query.comparison?.kind === 'segment'} onChange={e => changeQuery({ comparison: e.target.checked ? { kind: 'segment', filters: [] } : undefined })} />Compare with a separately filtered population</label>
          {query.comparison?.kind === 'segment' && <>
            <p className="analytics-scope">The current filters define the main segment. The baseline uses these filters and the same date range.</p>
            <textarea aria-label="Baseline segment filters" value={segmentText ?? JSON.stringify(query.comparison.filters, null, 2)} onChange={e => setSegmentText(e.target.value)} />
            <button type="button" className="is-primary" onClick={() => { try { const filters = JSON.parse(segmentText ?? '[]'); validateFilters(filters); changeQuery({ comparison: { kind: 'segment', filters } }); setSegmentText(null); setFilterError(''); } catch (failure) { setFilterError(failure.message); } }}>Apply baseline filters</button>
          </>}
        </div>
      )}
    </div>
  </div>;
}
