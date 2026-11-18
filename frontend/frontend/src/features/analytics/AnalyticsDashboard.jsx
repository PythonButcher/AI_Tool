import React, { useEffect, useRef, useState } from 'react';
import GridLayout, { WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import AnalyticsResult from './AnalyticsResult';
import AnalyticsNote from './AnalyticsNote';
import { queryAnalytics } from './analyticsModel';
import { clone, newId } from './analyticsStorage';
import SmartChartWindow from '../charts/SmartChartWindow';
import KpiCardWindow from '../dashboard/KpiCardWindow';

const Grid = WidthProvider(GridLayout);

function Tile({ item, filters, attachments, refresh, onInvestigate, onCrossFilter }) {
  const [result, setResult] = useState(item.result || null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [queried, setQueried] = useState(false);
  const first = useRef(true);
  const analysisKey = JSON.stringify(item.analysis);
  const filtersKey = JSON.stringify(filters);
  const savedResultKey = JSON.stringify(item.result);
  // Keep a refreshed result when unrelated collection edits clone the saved tile.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setResult(item.result || null); setQueried(false); }, [savedResultKey]);
  useEffect(() => {
    if (!item.analysis || item.requiresSourceReview) return undefined;
    if (first.current && !filters.length && !refresh) { first.current = false; return undefined; }
    first.current = false;
    const controller = new AbortController();
    const incompatible = filters.some(f => f.sourceId && f.sourceId !== item.analysis.source?.id);
    if (incompatible) { setError('A dashboard filter belongs to another dataset. This tile has not been filtered.'); return undefined; }
    const config = { ...item.analysis, query: { ...item.analysis.query, filters: { op: 'and', rules: [item.analysis.query.filters || [], ...filters.map(f => f.rule)] } } };
    setLoading(true); setError('');
    queryAnalytics(config, attachments, { signal: controller.signal }).then(value => { if (!controller.signal.aborted) { setResult(value); setQueried(true); } })
      .catch(failure => { if (!controller.signal.aborted) setError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
    // Collection commits clone records; only semantic query/source changes refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisKey, item.requiresSourceReview, filtersKey, attachments.inlineId, attachments.model, refresh]);
  if (item.itemType === 'text' || item.itemType === 'section') return item.itemType === 'section' ? <h2>{item.text || item.title}</h2> : <AnalyticsNote text={item.text || 'Add Markdown notes in the tile inspector.'} />;
  if (item.analysis) return <>
    {loading && <p role="status">Refreshing…</p>}{error && <p role="alert">{error} {result ? 'Showing the last saved result.' : ''}</p>}
    {item.requiresSourceReview && <p role="alert">Imported source needs review. Open this tile in Analysis and select its dataset.</p>}
    <div className="analytics-tile-meta">
      <small>{queried ? 'Live query result' : 'Saved result — refresh to query source'}{filters.length ? ` · ${filters.length} dashboard filters` : ''}</small>
      <button type="button" onClick={() => onInvestigate(item, filters)}>Investigate</button>
    </div>
    <AnalyticsResult config={item.analysis} result={result} compact onSelect={rule => onCrossFilter({ sourceId: item.analysis.source.id, rule })} />
  </>;
  if (item.resultSnapshot) {
    const artifact = item.resultSnapshot.artifact;
    const chart = artifact?.content?.chartData;
    const rows = chart ? chart.labels.map((label, i) => ({ label, ...Object.fromEntries(chart.datasets.map((d, j) => [`m${j}`, d.data[i]])) })) : [{ value: artifact?.content?.summary?.value }];
    const measures = chart ? chart.datasets.map((d, i) => ({ id: `m${i}`, label: d.label })) : [{ id: 'value' }];
    const config = { view: chart ? 'bar' : 'kpi', title: item.title, query: { group_by: chart ? [{ field: 'label' }] : [], measures } };
    return <><small>AI snapshot · saved {item.resultSnapshot.savedAt} · dashboard filters do not apply</small><AnalyticsResult compact config={config} result={{ rows, summary: rows[0], columns: Object.keys(rows[0] || {}), row_count: artifact?.bi_grounding?.row_count ?? rows.length, dataset: { scope: 'snapshot' } }} /><details><summary>Snapshot grounding</summary><pre>{JSON.stringify(artifact?.bi_grounding, null, 2)}</pre></details></>;
  }
  return <><div className="analytics-tile-meta"><small>Legacy tile · current attached dataset</small><button type="button" onClick={() => onInvestigate(item, filters)}>Configure in Analysis</button></div>{item.itemType === 'kpi' ? <KpiCardWindow id={item.id} item={item} dashboardFilters={null} isLocked={item.locked} /> : <SmartChartWindow id={item.id} type={item.chartType} mapping={item.mapping} dataSourceMode={item.dataSourceMode} semanticConfig={item.semanticConfig} chartSpec={item.chartSpec} display={item.display} isLocked={item.locked} />}</>;
}

export default function AnalyticsDashboard({ board, attachments, onChange, onInvestigate, onNewAnalysis, selectedTile, onSelectTile }) {
  const [refresh, setRefresh] = useState(0);
  const [field, setField] = useState('');
  const [value, setValue] = useState('');
  const [operator, setOperator] = useState('eq');
  const [filterType, setFilterType] = useState('auto');
  const [tileScope, setTileScope] = useState('all');
  const filters = board.state.analyticsFilters || [];
  const filterRef = useRef(filters);
  if (JSON.stringify(filterRef.current) !== JSON.stringify(filters)) filterRef.current = filters;
  const setFilters = next => onChange({ ...board, state: { ...board.state, analyticsFilters: next } });
  const addText = type => onChange({ ...board, items: [...board.items, { id: newId('dashboard-tile'), itemType: type, title: type === 'section' ? 'Section' : 'Notes', text: '', layout: { x: 0, y: Math.max(0, ...board.items.map(i => (i.layout?.y || 0) + (i.layout?.h || 5))), w: type === 'section' ? 12 : 6, h: type === 'section' ? 2 : 4 } }] });
  return <div className="analytics-dashboard">
    <div className="analytics-dashboard-toolbar">
      <div className="analytics-actions"><button type="button" className="is-primary" onClick={onNewAnalysis}>Add chart or KPI</button><button type="button" onClick={() => addText('text')}>Add notes</button><button type="button" onClick={() => addText('section')}>Add section</button><button type="button" onClick={() => setRefresh(n => n + 1)}>Refresh live tiles</button></div>
      <label className="analytics-checkbox-row">Mode<select value={board.state.mode || 'edit'} onChange={e => onChange({ ...board, state: { ...board.state, mode: e.target.value } })}><option value="edit">Edit layout</option><option value="view">View</option></select></label>
    </div>
    <div className="analytics-board-filters"><label>Filter field<input value={field} placeholder="Exact source field" onChange={e => setField(e.target.value)} /></label><select aria-label="Dashboard filter operator" value={operator} onChange={e => setOperator(e.target.value)}>{['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains'].map(op => <option key={op}>{op}</option>)}</select><input aria-label="Dashboard filter value" placeholder="Filter value" value={value} onChange={e => setValue(e.target.value)} />
      <select aria-label="Dashboard filter type" value={filterType} onChange={e => setFilterType(e.target.value)}><option value="auto">Category / number</option><option value="date">Date</option></select>
      <select aria-label="Dashboard filter tile scope" value={tileScope} onChange={e => setTileScope(e.target.value)}><option value="all">All live tiles</option>{board.items.filter(item => item.analysis).map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select>
      <button type="button" className="is-primary" disabled={!field} onClick={() => setFilters([...filters, { sourceId: attachments.selectedSource?.id, tileIds: tileScope === 'all' ? undefined : [tileScope], rule: { field, operator, value, type: filterType === 'date' ? 'date' : undefined } }])}>Apply filter</button><button type="button" onClick={() => setFilters([])}>Reset filters</button>
      {filters.map((filter, index) => <button type="button" className="analytics-chip" key={index} onClick={() => setFilters(filters.filter((_, i) => i !== index))}>{filter.rule.field ? `${filter.rule.field} ${filter.rule.operator} ${String(filter.rule.value ?? '')}` : 'Selected category / period'} · {filter.tileIds?.length ? `${filter.tileIds.length} selected tile(s)` : 'all live tiles'} · {filter.sourceId || 'all compatible sources'} ×</button>)}</div>
    {!board.items.length && <div className="analytics-empty"><h2>Build your dashboard</h2><p>Add a real analysis, KPI or notes. Your existing datasets remain in Data Hub.</p><button type="button" className="is-primary" onClick={onNewAnalysis}>Start an analysis</button></div>}
    <Grid className="analytics-grid" cols={12} rowHeight={42} margin={[12, 12]} draggableHandle=".analytics-tile-handle" isDraggable={board.state.mode !== 'view'} isResizable={board.state.mode !== 'view'}
      layout={board.items.map((item, index) => ({ i: item.id, x: item.layout?.x || 0, y: item.layout?.y ?? index * 6, w: item.layout?.w || 6, h: item.layout?.h || 6, minW: 2, minH: 2, static: !!item.locked }))}
      onDragStop={layout => onChange({ ...board, items: board.items.map(item => ({ ...item, layout: { ...item.layout, ...layout.find(l => l.i === item.id) } })) })}
      onResizeStop={layout => onChange({ ...board, items: board.items.map(item => ({ ...item, layout: { ...item.layout, ...layout.find(l => l.i === item.id) } })) })}>
      {board.items.map(item => <article key={item.id} className={`analytics-tile ${selectedTile === item.id ? 'is-selected' : ''}`} onFocus={() => onSelectTile(item.id)}>
        <header className="analytics-tile-handle"><strong>{item.title}</strong><button type="button" aria-label={`Inspect ${item.title}`} onClick={() => onSelectTile(item.id)}>Edit</button><button type="button" aria-label={`Duplicate ${item.title}`} onClick={() => onChange({ ...board, items: [...board.items, { ...clone(item), id: newId('dashboard-tile'), layout: { ...item.layout, y: Math.max(0, ...board.items.map(i => (i.layout?.y || 0) + (i.layout?.h || 6))) } }] })}>Copy</button>
          <button type="button" aria-label={`Remove ${item.title}`} onClick={() => { if (window.confirm(`Remove ${item.title}?`)) onChange({ ...board, items: board.items.filter(i => i.id !== item.id) }); }}>×</button></header>
        <div className="analytics-tile-body"><Tile item={item} filters={filterRef.current.filter(filter => !filter.tileIds || filter.tileIds.includes(item.id))} attachments={attachments} refresh={refresh} onInvestigate={onInvestigate} onCrossFilter={filter => setFilters([...filters, filter])} /></div>
      </article>)}
    </Grid>
  </div>;
}
