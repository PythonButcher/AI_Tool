import React, { useEffect, useState } from 'react';
import GridLayout, { WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import {
  FaArrowRight, FaChartBar, FaChartLine, FaChevronDown, FaCopy, FaEdit, FaExternalLinkAlt, FaEye, FaFilter,
  FaGripVertical, FaHashtag, FaHeading, FaLock, FaMagic, FaPlus, FaStickyNote, FaSyncAlt, FaTimes,
} from 'react-icons/fa';
import AnalyticsResult from './AnalyticsResult';
import AnalyticsNote from './AnalyticsNote';
import { filtersForTile, overviewTiles, queryAnalytics, querySignature, sourceKey, withDashboardFilters } from './analyticsModel';
import { clone, newId } from './analyticsStorage';
import SmartChartWindow from '../charts/SmartChartWindow';
import KpiCardWindow from '../dashboard/KpiCardWindow';

const Grid = WidthProvider(GridLayout);

function Tile({ item, filters, attachments, refresh, onInvestigate, onCrossFilter }) {
  const [live, setLive] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [groundingOpen, setGroundingOpen] = useState(false);
  const config = item.analysis && withDashboardFilters(item.analysis, filters);
  const signature = querySignature(config);
  const savedSignature = JSON.stringify(item.result);
  const liveResult = live && live.savedSignature === savedSignature ? live.result : null;
  const validLive = !!liveResult && live.signature === signature && live.attachments === attachments && !error;
  const result = liveResult || item.result || null;
  useEffect(() => {
    if (!config || item.requiresSourceReview) return undefined;
    const controller = new AbortController();
    setLoading(true); setError('');
    queryAnalytics(config, attachments, { signal: controller.signal }).then(value => {
      if (!controller.signal.aborted) setLive({ result: value, signature, attachments, savedSignature });
    })
      .catch(failure => { if (!controller.signal.aborted) setError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
    // Requery when execution inputs change, independently of title or formatting edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, savedSignature, item.requiresSourceReview, attachments, refresh]);

  if (item.itemType === 'text' || item.itemType === 'section') {
    return item.itemType === 'section'
      ? <div className="analytics-section-banner"><h2>{item.text || item.title}</h2></div>
      : <AnalyticsNote text={item.text || 'Add Markdown notes in the tile inspector.'} />;
  }
  if (item.analysis) return <>
    {loading && <p className="analytics-notice" role="status">Refreshing…</p>}
    {error && <p className="analytics-error" role="alert">{error} {result ? 'Showing the last saved result.' : ''}</p>}
    {item.requiresSourceReview && <p className="analytics-error" role="alert">Imported source needs review. Open this tile in Analysis and select its dataset.</p>}
    <div className="analytics-tile-meta">
      <span className={`analytics-tile-badge ${validLive ? 'is-live' : ''}`}>
        {validLive ? 'Live result' : result ? 'Cached result' : 'Live query'}{filters.length ? ` · ${filters.length} filters` : ''}
      </span>
      <button type="button" className="analytics-icon-pill" onClick={() => onInvestigate(item, filters, validLive ? result : null)}><FaExternalLinkAlt /><span>Investigate</span></button>
    </div>
    {result && <AnalyticsResult config={item.analysis} result={result} compact onSelect={validLive ? rule => onCrossFilter({
      sourceId: item.analysis.source.id, sourceKind: item.analysis.source.kind, sourceName: item.analysis.source.name, rule,
    }) : undefined} />}
  </>;
  if (item.resultSnapshot) {
    const artifact = item.resultSnapshot.artifact;
    const chart = artifact?.content?.chartData;
    const rows = chart ? chart.labels.map((label, i) => ({ label, ...Object.fromEntries(chart.datasets.map((d, j) => [`m${j}`, d.data[i]])) })) : [{ value: artifact?.content?.summary?.value }];
    const measures = chart ? chart.datasets.map((d, i) => ({ id: `m${i}`, label: d.label })) : [{ id: 'value' }];
    const config = { view: chart ? 'bar' : 'kpi', title: item.title, query: { group_by: chart ? [{ field: 'label' }] : [], measures } };
    return <>
      <div className="analytics-tile-meta">
        <span className="analytics-tile-badge is-snapshot">AI snapshot · saved {item.resultSnapshot.savedAt} · dashboard filters do not apply</span>
        <button type="button" className="analytics-icon-pill" onClick={() => setGroundingOpen(v => !v)}>Snapshot grounding</button>
      </div>
      <AnalyticsResult compact config={config} result={{ rows, summary: rows[0], columns: Object.keys(rows[0] || {}), row_count: artifact?.bi_grounding?.row_count ?? rows.length, dataset: { scope: 'snapshot' } }} />
      {groundingOpen && <pre>{JSON.stringify(artifact?.bi_grounding, null, 2)}</pre>}
    </>;
  }
  return <>
    <div className="analytics-tile-meta">
      <span className="analytics-tile-badge">Legacy tile · current attached dataset</span>
      <button type="button" className="analytics-icon-pill" onClick={() => onInvestigate(item, filters)}><FaExternalLinkAlt /><span>Configure in Analysis</span></button>
    </div>
    {item.itemType === 'kpi'
      ? <KpiCardWindow id={item.id} item={item} dashboardFilters={null} isLocked={item.locked} />
      : <SmartChartWindow id={item.id} type={item.chartType} mapping={item.mapping} dataSourceMode={item.dataSourceMode} semanticConfig={item.semanticConfig} chartSpec={item.chartSpec} display={item.display} isLocked={item.locked} />}
  </>;
}

function DashboardBlueprint({ source, fields, sourceLoading, canGenerateOverview, onGenerateOverview, onNewAnalysis, addText }) {
  const starters = canGenerateOverview ? overviewTiles(source, fields) : [];
  const metrics = starters.filter(tile => tile.itemType === 'kpi');
  const charts = starters.filter(tile => tile.itemType === 'chart');
  const startSlot = (starter, view, title) => onNewAnalysis(view, title, starter?.analysis);
  const metricLabels = ['Records', 'Primary measure', 'Supporting measure'];

  return <div className="analytics-blueprint">
    <div className="analytics-board-intro">
      <div>
        <h1>Build your dashboard</h1>
        <p>{source ? 'Generate an overview or choose a slot to build a tile.' : 'Choose a dataset to generate an overview, or start with a blank tile.'}</p>
      </div>
      <div className="analytics-actions">
        <button type="button" onClick={() => addText('text')}><FaStickyNote /> Add notes</button>
        <button type="button" onClick={() => addText('section')}><FaHeading /> Add section</button>
      </div>
    </div>
    <div className="analytics-blueprint-grid">
      {metricLabels.map((label, index) => (
        <button type="button" className="analytics-blueprint-slot is-metric" key={label} onClick={() => startSlot(metrics[index], 'kpi', label)}>
          <span className="analytics-slot-heading"><FaHashtag /><strong>{metrics[index]?.title || label}</strong><FaPlus className="analytics-slot-add" /></span>
          <span className="analytics-slot-value" aria-hidden="true">—</span>
          <small>Configure KPI</small>
        </button>
      ))}
      <button type="button" className="analytics-blueprint-generate" onClick={onGenerateOverview} disabled={!canGenerateOverview}>
        <FaMagic />
        <strong>Generate overview</strong>
        <small>{sourceLoading ? 'Reading dataset fields…' : canGenerateOverview ? 'Create live KPIs and charts' : source ? 'Dataset fields unavailable' : 'Choose a dataset first'}</small>
        <FaArrowRight className="analytics-slot-add" />
      </button>
      {['Trend', 'Breakdown'].map((label, index) => {
        const tile = charts[index];
        const trend = (tile?.analysis.view || (index === 0 ? 'line' : 'bar')) === 'line';
        const Icon = trend ? FaChartLine : FaChartBar;
        return <button type="button" className="analytics-blueprint-slot is-chart" key={label} onClick={() => startSlot(tile, index === 0 ? 'line' : 'bar', label)}>
          <span className="analytics-slot-heading"><Icon /><strong>{tile?.title || label}</strong><FaPlus className="analytics-slot-add" /></span>
          <span className={`analytics-slot-chart ${trend ? 'is-trend' : ''}`} aria-hidden="true">
            <i /><i /><i /><i /><i /><i /><i /><i />
          </span>
          <small>Configure chart</small>
        </button>;
      })}
    </div>
  </div>;
}

const FILTER_OPERATORS = [
  ['eq', 'Equals'], ['neq', 'Does not equal'], ['gt', 'Greater than'], ['gte', 'At least'],
  ['lt', 'Less than'], ['lte', 'At most'], ['contains', 'Contains'],
];

export default function AnalyticsDashboard({ board, attachments, onChange, onInvestigate, onNewAnalysis, selectedTile, onSelectTile,
  source, fields, sourceLoading, canGenerateOverview, onGenerateOverview }) {
  const [refresh, setRefresh] = useState(0);
  const [filterDrawer, setFilterDrawer] = useState(false);
  const [field, setField] = useState('');
  const [value, setValue] = useState('');
  const [operator, setOperator] = useState('eq');
  const [filterType, setFilterType] = useState('auto');
  const [tileScope, setTileScope] = useState('all');
  const filters = board.state.analyticsFilters || [];
  const setFilters = next => onChange({ ...board, state: { ...board.state, analyticsFilters: next } });
  const nextRow = Math.max(0, ...board.items.map(item => (item.layout?.y || 0) + (item.layout?.h || 6)));
  const addText = type => {
    const id = newId('dashboard-tile');
    if (onChange({ ...board, state: { ...board.state, mode: 'edit' }, items: [...board.items, {
      id, itemType: type, title: type === 'section' ? 'Section' : 'Notes', text: '',
      layout: { x: 0, y: nextRow, w: type === 'section' ? 12 : 6, h: type === 'section' ? 2 : 4 },
    }] })) onSelectTile(id);
  };
  const selectMode = mode => {
    if (board.state.mode !== mode) onChange({ ...board, state: { ...board.state, mode } });
  };
  const isView = board.state.mode === 'view';
  const liveTiles = board.items.filter(item => item.analysis && !item.requiresSourceReview);
  const compatibleTiles = liveTiles.filter(item => sourceKey(item.analysis.source) === sourceKey(source));
  const selectedField = fields.find(option => option.name === field);
  const selectedScope = compatibleTiles.some(item => item.id === tileScope) ? tileScope : 'all';

  if (!board.items.length) return <DashboardBlueprint source={source} fields={fields} sourceLoading={sourceLoading} canGenerateOverview={canGenerateOverview}
    onGenerateOverview={onGenerateOverview} onNewAnalysis={onNewAnalysis} addText={addText} />;

  return <div className={`analytics-dashboard ${isView ? 'is-view' : ''}`}>
    <div className="analytics-dashboard-toolbar" aria-label="Dashboard canvas actions">
      <div className="analytics-actions">
        {!isView && <details className="analytics-add-tile">
          <summary><FaPlus /><span>Add tile</span><FaChevronDown /></summary>
          <div className="analytics-switcher-menu">
            {[
              ['Chart', FaChartBar, () => onNewAnalysis()],
              ['KPI', FaHashtag, () => onNewAnalysis('kpi')],
              ['Note', FaStickyNote, () => addText('text')],
              ['Section', FaHeading, () => addText('section')],
            ].map(([label, Icon, action]) => <button key={label} type="button" onClick={event => {
              event.currentTarget.closest('details').open = false;
              action();
            }}><Icon /> {label}</button>)}
          </div>
        </details>}
        <button type="button" className={`analytics-icon-pill ${filterDrawer ? 'is-selected' : ''}`} onClick={() => setFilterDrawer(open => !open)}
          aria-expanded={filterDrawer} disabled={!liveTiles.length && !filters.length}><FaFilter /> Filters {filters.length || ''}</button>
      </div>
      <div className="analytics-actions">
        <button type="button" className="analytics-icon-btn" aria-label="Refresh live tiles" title="Refresh live tiles" disabled={!liveTiles.length}
          onClick={() => setRefresh(value => value + 1)}><FaSyncAlt /></button>
        <div className="analytics-mode-switch" role="group" aria-label="Board editing mode">
          <button type="button" aria-pressed={!isView} onClick={() => selectMode('edit')}><FaEdit /> Edit layout</button>
          <button type="button" aria-pressed={isView} onClick={() => selectMode('view')}><FaEye /> View</button>
        </div>
      </div>
    </div>

    {!!filters.length && <div className="analytics-filter-chips" aria-label="Active dashboard filters">
      {filters.map((filter, index) => {
        const label = filter.rule.field ? `${filter.rule.field} ${FILTER_OPERATORS.find(([id]) => id === filter.rule.operator)?.[1]?.toLowerCase() || filter.rule.operator} ${String(filter.rule.value ?? '')}` : 'Selected category or period';
        const scope = [filter.sourceName || filter.sourceId, filter.tileIds?.length ? 'Selected tiles' : 'Matching tiles'].filter(Boolean).join(' · ');
        return <button type="button" className="analytics-chip" key={index} title={scope} aria-label={`Remove filter ${label} (${scope})`}
          onClick={() => setFilters(filters.filter((_, i) => i !== index))}>
          {label}{filter.sourceName && <small>{filter.sourceName}</small>} <FaTimes />
        </button>;
      })}
      <button type="button" className="analytics-icon-btn" onClick={() => setFilters([])}>Reset filters</button>
    </div>}

    {filterDrawer && <form className="analytics-popover-tray analytics-board-filters" onSubmit={event => {
      event.preventDefault();
      if (!selectedField || !compatibleTiles.length || (filterType === 'date' && !value)) return;
      setFilters([...filters, { sourceId: source.id, sourceKind: source.kind, sourceName: source.name,
        tileIds: selectedScope === 'all' ? undefined : [selectedScope],
        rule: { field, operator, value, type: filterType === 'date' ? 'date' : undefined } }]);
    }}>
      <label>Filter field<select value={selectedField?.name || ''} onChange={event => {
        const next = fields.find(option => option.name === event.target.value);
        setField(event.target.value); setFilterType(next?.type === 'date' ? 'date' : 'auto'); setValue('');
      }}><option value="" disabled>Choose a field</option>{fields.map(option => <option key={option.name}>{option.name}</option>)}</select></label>
      <label>Operator<select aria-label="Dashboard filter operator" value={operator} onChange={event => setOperator(event.target.value)}>
        {FILTER_OPERATORS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select></label>
      <label>Value<input aria-label="Dashboard filter value" type={filterType === 'date' ? 'date' : 'text'}
        inputMode={selectedField?.type === 'number' ? 'decimal' : undefined} value={value} onChange={event => setValue(event.target.value)} /></label>
      <label>Type<select aria-label="Dashboard filter type" value={filterType} onChange={event => { setFilterType(event.target.value); setValue(''); }}>
        <option value="auto">Category / number</option><option value="date">Date</option>
      </select></label>
      <label>Scope<select aria-label="Dashboard filter tile scope" value={selectedScope} onChange={event => setTileScope(event.target.value)}>
        <option value="all">Matching tiles</option>{compatibleTiles.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
      </select></label>
      <button type="submit" className="is-primary" disabled={!selectedField || !compatibleTiles.length || (filterType === 'date' && !value)}>Apply filter</button>
      {!compatibleTiles.length && <p className="analytics-scope">Select a dataset used by a live tile to add filters.</p>}
    </form>}

    <Grid
      className="analytics-grid"
      cols={12}
      rowHeight={42}
      margin={[12, 12]}
      containerPadding={[0, 0]}
      draggableHandle=".analytics-tile-handle"
      draggableCancel=".analytics-tile-actions"
      isDraggable={!isView}
      isResizable={!isView}
      layout={board.items.map((item, index) => ({ i: item.id, x: item.layout?.x || 0, y: item.layout?.y ?? index * 6, w: item.layout?.w || 6, h: item.layout?.h || 6, minW: 2, minH: 2, static: !!item.locked }))}
      onDragStop={layout => onChange({ ...board, items: board.items.map(item => ({ ...item, layout: { ...item.layout, ...layout.find(l => l.i === item.id) } })) })}
      onResizeStop={layout => onChange({ ...board, items: board.items.map(item => ({ ...item, layout: { ...item.layout, ...layout.find(l => l.i === item.id) } })) })}
    >
      {board.items.map(item => (
        <article key={item.id} className={`analytics-tile analytics-tile--${item.itemType} ${selectedTile === item.id ? 'is-selected' : ''}`}>
          <header className="analytics-tile-handle">
            {!isView && <FaGripVertical className="analytics-grip-icon" />}
            <strong>{item.title}</strong>
            {item.locked && <FaLock className="analytics-grip-icon" title="Tile position locked" />}
            {!isView && <div className="analytics-tile-actions">
              <button type="button" aria-label={`Inspect ${item.title}`} onClick={() => onSelectTile(item.id)} title="Format & inspect tile"><FaEdit /></button>
              <button type="button" aria-label={`Duplicate ${item.title}`} onClick={() => onChange({ ...board, items: [...board.items, { ...clone(item), id: newId('dashboard-tile'), layout: { ...item.layout, y: nextRow } }] })} title="Duplicate tile"><FaCopy /></button>
              <button type="button" aria-label={`Remove ${item.title}`} onClick={() => { if (window.confirm(`Remove ${item.title}?`)) onChange({ ...board, items: board.items.filter(i => i.id !== item.id) }); }} title="Remove tile"><FaTimes /></button>
            </div>}
          </header>
          <div className="analytics-tile-body">
            <Tile item={item} filters={filtersForTile(item, filters)} attachments={attachments} refresh={refresh} onInvestigate={onInvestigate} onCrossFilter={filter => {
              if (!filters.some(existing => JSON.stringify(existing) === JSON.stringify(filter))) setFilters([...filters, filter]);
            }} />
          </div>
        </article>
      ))}
    </Grid>
  </div>;
}
