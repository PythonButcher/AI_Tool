import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DataContext, normalizeDatasetRows, useActiveDataset, useSemanticModel } from '../../context/DataContext';
import { useWindowContext } from '../../context/WindowContext';
import AnalyticsBuilder from './AnalyticsBuilder';
import AnalyticsDashboard from './AnalyticsDashboard';
import AnalyticsResult from './AnalyticsResult';
import AnalyticsAppearance from './AnalyticsAppearance';
import { API, defaultAnalysis, download, inlineIdentity, queryAnalytics, querySignature, tableCsv } from './analyticsModel';
import { checkpoint, clone, emptyDashboard, importCollection, newId } from './analyticsStorage';
import './AnalyticsShell.css';

export default function AnalyticsShell({ onOpenAiChat, onOpenGallery, onOpenAiChart }) {
  const { analyticsWorkspace: workspace, updateAnalyticsWorkspace: commit, analyticsStorage } = useWindowContext();
  const activeDataset = useActiveDataset();
  const model = useSemanticModel();
  const { analysisContext } = useContext(DataContext);
  const rows = useMemo(() => normalizeDatasetRows(activeDataset), [activeDataset]);
  const inlineId = useMemo(() => inlineIdentity(rows), [rows]);
  const defaultSource = useMemo(() => rows.length ? { kind: 'inline', id: inlineId, name: model?.dataset?.name || 'Current attached data', row_scope: 'unknown' } : null, [inlineId, model?.dataset?.name, rows.length]);
  const saved = workspace.explorations.find(a => a.id === workspace.activeAnalysisId);
  const [draft, setDraft] = useState(() => clone(workspace.drafts.current?.config || saved?.config || defaultAnalysis(defaultSource)));
  const [result, setResult] = useState(() => workspace.drafts.current?.result || saved?.result || null);
  const [resultConfig, setResultConfig] = useState(() => workspace.drafts.current?.resultConfig || saved?.config || null);
  const [dirty, setDirty] = useState(!!workspace.drafts.current);
  const [origin, setOrigin] = useState(workspace.drafts.current?.origin || null);
  const [fields, setFields] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [sources, setSources] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('recent');
  const [actionSearch, setActionSearch] = useState('');
  const [actionsOpen, setActionsOpen] = useState(false);
  const [favorites, setFavorites] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(() => window.innerWidth > 760);
  const [inspectorOpen, setInspectorOpen] = useState(() => window.innerWidth > 1200);
  const [focus, setFocus] = useState(false);
  const [dense, setDense] = useState(false);
  const [selectedTile, setSelectedTile] = useState(null);
  const [targetBoard, setTargetBoard] = useState(workspace.activeDashboardId);
  const [history, setHistory] = useState({ past: [], future: [] });
  const [boardHistory, setBoardHistory] = useState({ past: [], future: [] });
  const [drillHistory, setDrillHistory] = useState([]);
  const request = useRef(null);
  const sequence = useRef(0);
  const draftRef = useRef(draft); draftRef.current = draft;
  const draftSnapshot = useRef(null);
  draftSnapshot.current = dirty ? { config: draft, resultConfig, result, origin, analysisId: workspace.activeAnalysisId, savedAt: new Date().toISOString() } : null;
  const shellRef = useRef(null);
  const importRef = useRef(null);
  const board = workspace.dashboards.find(d => d.state.id === workspace.activeDashboardId);
  const mode = workspace.lastView;
  const attachments = useMemo(() => ({ rows, inlineId, model, selectedSource: draft.source }), [rows, inlineId, model, draft.source]);
  const allSources = useMemo(() => [defaultSource, analysisContext && { kind: 'workspace', id: analysisContext.workspace_id, name: 'Active governed workspace', analysis_context: analysisContext }, ...sources].filter(Boolean), [defaultSource, analysisContext, sources]);
  const cancel = useCallback(() => { request.current?.abort(); sequence.current += 1; setStatus('idle'); }, []);
  const preserveDraft = useCallback((next, archive = false) => {
    if (!draftSnapshot.current) return next;
    const drafts = { ...next.drafts, current: clone(draftSnapshot.current) };
    if (archive) {
      if (Object.entries(drafts).filter(([key, value]) => key !== 'current' && value).length >= 20) throw new Error('Your 20 recovered drafts are retained. Save or discard an older draft before starting another.');
      drafts[newId('draft')] = drafts.current;
      drafts.current = null;
    }
    return { ...next, drafts };
  }, []);
  const changeDraft = useCallback(next => {
    cancel(); setHistory(h => ({ past: [...h.past.slice(-29), clone(draftRef.current)], future: [] }));
    setDraft(next); setDirty(true); setError('');
  }, [cancel]);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => { setBoardHistory({ past: [], future: [] }); setSelectedTile(null); }, [workspace.activeDashboardId]);
  useEffect(() => { if (!workspace.dashboards.some(b => b.state.id === targetBoard)) setTargetBoard(workspace.activeDashboardId); }, [workspace.dashboards, workspace.activeDashboardId, targetBoard]);
  useEffect(() => { cancel(); }, [inlineId, cancel]);
  useEffect(() => () => { if (draftSnapshot.current) commit(next => preserveDraft(next)); }, [commit, preserveDraft]);
  useEffect(() => {
    if (!workspace.pendingAction) return;
    const action = workspace.pendingAction;
    if (commit(next => ({ ...preserveDraft(next, true), pendingAction: null, activeAnalysisId: null, lastView: 'explore' }))) {
      cancel(); setDraft({ ...defaultAnalysis(defaultSource), view: action.view || 'bar' });
      setResult(null); setResultConfig(null); setDirty(true); setOrigin(null);
    }
  }, [workspace.pendingAction, commit, preserveDraft, defaultSource, cancel]);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API}/api/datahub/list`, { signal: controller.signal }).then(r => { if (!r.ok) throw new Error('Data Hub list unavailable'); return r.json(); })
      .then(list => { if (!controller.signal.aborted) setSources(Array.isArray(list) ? list.map(d => ({ kind: 'datahub', id: d.id, name: d.name })) : []); })
      .catch(failure => { if (!controller.signal.aborted) setNotice(`${failure.message}. Attached data remains available.`); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!draft.source && defaultSource) setDraft(previous => ({ ...previous, source: defaultSource }));
  }, [defaultSource, draft.source]);
  useEffect(() => {
    if (!draft.source) { setFields([]); setMetrics([]); return undefined; }
    const controller = new AbortController();
    setFields([]); setMetrics([]);
    queryAnalytics(draft, attachments, { signal: controller.signal, metadataOnly: true }).then(data => {
      if (!controller.signal.aborted) { setFields(data.fields); setMetrics(data.metrics || []); }
    }).catch(failure => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
    // Metadata follows source identity, not each builder keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.source, attachments.inlineId, attachments.model]);
  useEffect(() => {
    if (!dirty || mode !== 'explore') return undefined;
    const timer = setTimeout(() => commit(next => preserveDraft(next)), 800);
    return () => clearTimeout(timer);
  }, [draft, dirty, result, resultConfig, mode, commit, preserveDraft]);
  const run = async () => {
    if (draftRef.current.requiresSourceReview) { setError('Select and confirm the imported dataset before running.'); return; }
    cancel(); const id = ++sequence.current; const controller = new AbortController(); request.current = controller;
    const config = clone(draftRef.current); setStatus('loading'); setError('');
    try {
      const data = await queryAnalytics(config, attachments, { signal: controller.signal });
      if (id !== sequence.current || controller.signal.aborted) return;
      setResult(data); setResultConfig(config); setStatus('ready'); setDirty(true);
    } catch (failure) { if (!controller.signal.aborted && id === sequence.current) { setError(failure.message); setStatus('error'); } }
  };
  const remember = (next, id) => ({ ...next, recent: [id, ...(next.recent || []).filter(v => v !== id)].slice(0, 30) });
  const switchMode = nextMode => { cancel(); commit(next => ({ ...preserveDraft(next), lastView: nextMode })); };
  const openAnalysis = analysis => {
    if (!commit(next => remember({ ...preserveDraft(next, true), lastView: 'explore', activeAnalysisId: analysis.id }, analysis.id))) return;
    cancel(); setDraft({ ...clone(analysis.config), requiresSourceReview: !!analysis.requiresSourceReview }); setResult(analysis.result || null); setResultConfig(analysis.config); setDirty(false); setOrigin(null); setHistory({ past: [], future: [] });
    if (analysis.requiresSourceReview) setError('Review the imported source and select a dataset before running.');
  };
  const startAnalysis = () => { if (!commit(next => ({ ...preserveDraft(next, true), lastView: 'explore', activeAnalysisId: null }))) return; cancel(); setDraft(defaultAnalysis(defaultSource || allSources[0])); setResult(null); setResultConfig(null); setDirty(false); setOrigin(null); setHistory({ past: [], future: [] }); };
  const saveAnalysis = useCallback(() => {
    if (!draftRef.current.title.trim()) { setError('Give this analysis a name.'); return; }
    const id = workspace.activeAnalysisId || newId('analysis');
    const now = new Date().toISOString();
    const success = commit(next => {
      const existing = next.explorations.find(a => a.id === id);
      const record = { ...existing, id, name: draftRef.current.title.trim(), config: clone(draftRef.current),
        result: querySignature(resultConfig) === querySignature(draftRef.current) ? result : null,
        createdAt: existing?.createdAt || now, updatedAt: now, tags: existing?.tags || [], revisions: existing ? checkpoint(existing) : [], requiresSourceReview: !!draftRef.current.requiresSourceReview };
      return remember({ ...next, activeAnalysisId: id, explorations: [...next.explorations.filter(a => a.id !== id), record], drafts: { ...next.drafts, current: null } }, id);
    });
    if (success) { setDirty(false); setNotice('Analysis saved in this browser.'); }
  }, [commit, workspace.activeAnalysisId, result, resultConfig]);
  const undo = useCallback((redo = false) => {
    if (mode === 'explore') {
      const stack = redo ? history.future : history.past; if (!stack.length) return;
      const value = stack[stack.length - 1];
      setHistory({ past: redo ? [...history.past, clone(draft)] : history.past.slice(0, -1), future: redo ? history.future.slice(0, -1) : [...history.future, clone(draft)] });
      cancel(); setDraft(value); setDirty(true);
    } else {
      const stack = redo ? boardHistory.future : boardHistory.past; if (!stack.length) return;
      const value = stack[stack.length - 1];
      if (commit(next => ({ ...next, dashboards: next.dashboards.map(b => b.state.id === board.state.id ? value : b) }))) setBoardHistory({ past: redo ? [...boardHistory.past, clone(board)] : boardHistory.past.slice(0, -1), future: redo ? boardHistory.future.slice(0, -1) : [...boardHistory.future, clone(board)] });
    }
  }, [mode, history, draft, cancel, boardHistory, commit, board]);
  useEffect(() => {
    const listener = event => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key === 'k') { event.preventDefault(); setActionsOpen(value => !value); }
      if (event.key === 's') { event.preventDefault(); if (mode === 'explore') saveAnalysis(); }
      if (event.key === 'z' && !['INPUT', 'TEXTAREA'].includes(event.target.tagName)) { event.preventDefault(); undo(event.shiftKey); }
    };
    window.addEventListener('keydown', listener); return () => window.removeEventListener('keydown', listener);
  }, [mode, saveAnalysis, undo]);
  const changeBoard = nextBoard => {
    if (commit(next => ({ ...next, dashboards: next.dashboards.map(b => b.state.id === nextBoard.state.id ? { ...nextBoard, state: { ...nextBoard.state, updatedAt: new Date().toISOString() }, revisions: checkpoint(b) } : b) }))) {
      setBoardHistory(h => ({ past: [...h.past.slice(-19), clone(board)], future: [] }));
    }
  };
  const createBoard = template => {
    const name = window.prompt('Dashboard name', template ? 'Business overview' : 'New dashboard'); if (!name?.trim()) return;
    const value = emptyDashboard(name.trim());
    if (template) value.items = ['Key metric', 'Trend', 'Breakdown'].map((title, i) => ({ id: newId('dashboard-tile'), itemType: 'chart', title,
      analysis: { ...defaultAnalysis(defaultSource || allSources[0]), title, view: i ? 'bar' : 'kpi' }, result: null,
      layout: { x: i === 2 ? 6 : 0, y: i ? 4 : 0, w: i ? 6 : 12, h: i ? 7 : 4 } }));
    commit(next => ({ ...preserveDraft(next), dashboards: [...next.dashboards, value], activeDashboardId: value.state.id, lastView: 'dashboards' }));
  };
  const saveTemplate = () => {
    const name = window.prompt('Template name', board.state.name); if (!name?.trim()) return;
    const template = { id: newId('template'), name: name.trim(), items: board.items.filter(item => !item.resultSnapshot).map(item => ({ ...clone(item), result: null, resultSnapshot: null, sourceMetadata: undefined })) };
    if (commit(next => ({ ...next, templates: [...next.templates, template] }))) setNotice('Reusable layout saved. Fixed AI snapshots are excluded; live definitions and notes are retained.');
  };
  const instantiateTemplate = template => {
    if (!draft.source) { setError('Choose the dataset for this template first.'); return; }
    const value = emptyDashboard(`${template.name} dashboard`);
    value.items = template.items.map(item => ({ ...clone(item), id: newId('dashboard-tile'), requiresSourceReview: false,
      analysis: item.analysis ? { ...item.analysis, source: clone(draft.source), requiresSourceReview: false } : undefined }));
    commit(next => ({ ...preserveDraft(next), dashboards: [...next.dashboards, value], activeDashboardId: value.state.id, lastView: 'dashboards' }));
  };
  const manageObject = (kind, id, action) => {
    const value = kind === 'dashboard' ? workspace.dashboards.find(b => b.state.id === id) : workspace.explorations.find(a => a.id === id);
    const meta = kind === 'dashboard' ? value.state : value;
    let input;
    if (action === 'delete' && !window.confirm(`Delete ${meta.name}?`)) return;
    if (['rename', 'tags'].includes(action)) { input = window.prompt(action === 'rename' ? 'Name' : 'Tags, separated by commas', action === 'rename' ? meta.name : (meta.tags || []).join(', ')); if (input === null || (action === 'rename' && !input.trim())) return; }
    commit(next => {
      const key = kind === 'dashboard' ? 'dashboards' : 'explorations';
      if (action === 'delete') {
        next[key] = next[key].filter(v => (kind === 'dashboard' ? v.state.id : v.id) !== id);
        if (!next.dashboards.length) next.dashboards.push(emptyDashboard());
        if (next.activeDashboardId === id) next.activeDashboardId = next.dashboards[0].state.id;
        if (next.activeAnalysisId === id) next.activeAnalysisId = null;
      } else if (action === 'duplicate') {
        const copied = clone(value); const newIdentity = newId(kind);
        if (kind === 'dashboard') { copied.state.id = newIdentity; copied.state.name += ' (copy)'; copied.items = copied.items.map(item => ({ ...item, id: newId('dashboard-tile') })); }
        else { copied.id = newIdentity; copied.name += ' (copy)'; copied.config.title = copied.name; }
        copied.revisions = []; next[key].push(copied);
      } else {
        next[key] = next[key].map(v => {
          const m = kind === 'dashboard' ? v.state : v; if (m.id !== id) return v;
          const patch = action === 'favorite' ? { favorite: !m.favorite } : action === 'tags' ? { tags: input.split(',').map(t => t.trim()).filter(Boolean) } : { name: input.trim() };
          return kind === 'dashboard' ? { ...v, state: { ...m, ...patch } } : { ...v, ...patch, config: action === 'rename' ? { ...v.config, title: input.trim() } : v.config };
        });
      }
      return next;
    });
  };
  const investigate = (item, filters) => {
    if (!commit(next => ({ ...preserveDraft(next, true), lastView: 'explore', activeAnalysisId: null }))) return;
    const config = clone(item.analysis || { ...defaultAnalysis(defaultSource), title: item.title,
      query: { ...defaultAnalysis(defaultSource).query, measures: [{ id: 'value', field: item.mapping?.['Y-Axis'], aggregation: item.mapping?.['Y-Axis'] ? 'sum' : 'count_rows', metric_id: item.semanticConfig?.metricId || undefined }], group_by: item.mapping?.['X-Axis'] ? [{ field: item.mapping['X-Axis'] }] : [] } });
    config.query.filters = { op: 'and', rules: [config.query.filters || [], ...filters.filter(f => !f.sourceId || f.sourceId === config.source?.id).map(f => f.rule)] };
    config.requiresSourceReview = !!item.requiresSourceReview;
    setOrigin({ boardId: board.state.id, itemId: item.id, original: JSON.stringify(item) });
    cancel(); setDraft(config); setResult(item.result || null); setResultConfig(item.result ? item.analysis : null); setDirty(true); setDrillHistory([]);
  };
  const pin = update => {
    if (!result || querySignature(resultConfig) !== querySignature(draft) || draft.requiresSourceReview) { setError('Run the current analysis before saving a dashboard result.'); return; }
    const boardId = update ? origin?.boardId : targetBoard;
    if (!workspace.dashboards.some(b => b.state.id === boardId)) { setError('Choose an available target dashboard.'); return; }
    let updatedItem;
    const success = commit(next => ({ ...next, dashboards: next.dashboards.map(b => {
      if (b.state.id !== boardId) return b;
      if (update) {
        const original = b.items.find(item => item.id === origin.itemId);
        if (!original || JSON.stringify(original) !== origin.original) throw new Error('The original tile changed or was removed. Pin a copy instead.');
      }
      const item = { ...(update ? b.items.find(i => i.id === origin.itemId) : {}), id: update ? origin.itemId : newId('dashboard-tile'), itemType: 'chart', title: draft.title, analysis: clone(draft), result: clone(result), requiresSourceReview: false,
        layout: update ? b.items.find(i => i.id === origin.itemId).layout : { x: 0, y: Math.max(0, ...b.items.map(i => (i.layout?.y || 0) + (i.layout?.h || 7))), w: 6, h: 7 }, updatedAt: new Date().toISOString() };
      updatedItem = item;
      return { ...b, revisions: checkpoint(b), items: update ? b.items.map(i => i.id === item.id ? item : i) : [...b.items, item] };
    }) }));
    if (success) { if (update) setOrigin({ ...origin, original: JSON.stringify(updatedItem) }); setNotice(update ? 'Original tile updated.' : 'Result pinned to the selected dashboard.'); }
  };
  const drill = rule => { setDrillHistory(list => [...list, clone(draft)]); changeDraft({ ...draft, query: { ...draft.query, filters: { op: 'and', rules: [draft.query.filters || [], rule] } } }); setNotice('Selection added as a drill filter. Choose a breakdown field and run.'); };
  const detail = () => changeDraft({ ...draft, view: 'table', query: { ...draft.query, mode: 'rows', comparison: undefined, columns: fields.slice(0, 30).map(f => f.name), sort: undefined } });
  const exportPdf = async () => {
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
      const target = shellRef.current.querySelector('.analytics-main');
      const canvas = await html2canvas(target, { backgroundColor: '#ffffff', scale: 1, height: target.scrollHeight, windowHeight: target.scrollHeight });
      const pdf = new jsPDF({ orientation: 'landscape' });
      const width = pdf.internal.pageSize.getWidth() - 20;
      const pageHeight = pdf.internal.pageSize.getHeight() - 30;
      const pixelsPerPage = Math.floor(pageHeight * canvas.width / width);
      for (let y = 0; y < canvas.height; y += pixelsPerPage) {
        if (y) pdf.addPage();
        const slice = document.createElement('canvas'); slice.width = canvas.width; slice.height = Math.min(pixelsPerPage, canvas.height - y);
        slice.getContext('2d').drawImage(canvas, 0, y, canvas.width, slice.height, 0, 0, canvas.width, slice.height);
        pdf.text(`${mode === 'explore' ? draft.title : board.state.name} · ${new Date().toLocaleString()}`, 10, 10);
        pdf.addImage(slice.toDataURL('image/png'), 'PNG', 10, 20, width, slice.height * width / canvas.width);
      }
      pdf.save('analytics-report.pdf');
    } catch (failure) { setError(`Report export failed: ${failure.message}`); }
  };
  const objects = [...workspace.dashboards.map(b => ({ ...b.state, kind: 'dashboard' })), ...workspace.explorations.map(a => ({ ...a, kind: 'analysis' }))]
    .filter(item => (!favorites || item.favorite) && `${item.name} ${(item.tags || []).join(' ')}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  const inspected = board.items.find(item => item.id === selectedTile);
  const appearance = mode === 'explore' ? draft.appearance || {} : inspected?.analysis?.appearance || inspected?.display || {};
  const changeAppearance = patch => mode === 'explore' ? changeDraft({ ...draft, appearance: { ...appearance, ...patch } }) : inspected && changeBoard({ ...board, items: board.items.map(item => item.id === inspected.id ? { ...item, analysis: item.analysis ? { ...item.analysis, appearance: { ...appearance, ...patch } } : undefined, display: { ...item.display, ...patch } } : item) });
  const actions = [{ name: 'New analysis', run: startAnalysis }, { name: 'New dashboard', run: () => createBoard(false) },
    { name: 'Save analysis', run: saveAnalysis }, { name: 'Undo', run: () => undo(false) }, { name: 'Redo', run: () => undo(true) },
    { name: 'Export report PDF', run: exportPdf }, { name: 'Toggle focus', run: () => setFocus(value => !value) },
    { name: 'Chart gallery', run: onOpenGallery }, { name: 'AI Chart', run: onOpenAiChart }];
  return <section ref={shellRef} className={`analytics-shell ${focus ? 'is-focus' : ''} ${dense ? 'is-dense' : ''}`} aria-label="Analytics workspace">
    <header className="analytics-header">
      <div className="analytics-title-block">
        <span className="analytics-eyebrow">Analytics · {mode === 'explore' ? 'Analysis Workbench' : 'Dashboard Monitor'}</span>
        <h1>{mode === 'explore' ? draft.title : board.state.name}</h1>
      </div>
      <div className="analytics-header-controls">
        <button type="button" onClick={() => setLibraryOpen(!libraryOpen)} aria-expanded={libraryOpen}>Library</button>
        <div className="analytics-mode-switch" role="group" aria-label="Analytics view mode">
          <button type="button" onClick={() => switchMode('dashboards')} aria-pressed={mode === 'dashboards'}>Dashboard</button>
          <button type="button" onClick={() => switchMode('explore')} aria-pressed={mode === 'explore'}>Analysis</button>
        </div>
        <button type="button" onClick={() => setInspectorOpen(!inspectorOpen)} aria-expanded={inspectorOpen}>Inspector</button>
        <button type="button" onClick={() => setFocus(!focus)}>{focus ? 'Exit focus' : 'Focus'}</button>
        <div className="analytics-command-wrap">
          <button type="button" onClick={() => setActionsOpen(value => !value)} aria-expanded={actionsOpen}>Search actions · Ctrl/Cmd+K</button>
          {actionsOpen && <div className="analytics-command-popover" role="search">
            <input autoFocus aria-label="Search Analytics actions" placeholder="Type a command…" value={actionSearch} onChange={e => setActionSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') setActionsOpen(false); }} />
            {actions.filter(action => action.name.toLowerCase().includes(actionSearch.toLowerCase())).map(action => <button type="button" key={action.name} onClick={() => { action.run?.(); setActionsOpen(false); }}>{action.name}</button>)}
          </div>}
        </div>
      </div>
    </header>
    <div className="analytics-context">
      <div className="analytics-context-left">
        <label>Dataset<select aria-label="Analytics dataset" value={draft.source ? `${draft.source.kind}:${draft.source.id}` : ''} onChange={e => { const source = allSources.find(s => `${s.kind}:${s.id}` === e.target.value); if (source) changeDraft({ ...draft, source, requiresSourceReview: false }); }}><option value="">Choose a dataset</option>{draft.source && !allSources.some(s => s.kind === draft.source.kind && s.id === draft.source.id) && <option value={`${draft.source.kind}:${draft.source.id}`}>{draft.source.name || draft.source.id} (reattach source)</option>}{allSources.map(s => <option key={`${s.kind}:${s.id}`} value={`${s.kind}:${s.id}`}>{s.name}</option>)}</select></label>
        {draft.requiresSourceReview && <button type="button" className="is-primary" onClick={() => { const source = allSources.find(s => s.kind === draft.source?.kind && s.id === draft.source?.id); if (source) changeDraft({ ...draft, source, requiresSourceReview: false }); else setError('Reattach this source or choose an available dataset.'); }}>Confirm imported dataset</button>}
        {!!fields.length && <span className="analytics-status-pill">{fields.length} fields{metrics.length ? ` · ${metrics.length} governed metrics` : ''}</span>}
      </div>
      <div className="analytics-context-right">
        <span className={`analytics-status-pill ${mode === 'explore' && dirty ? 'is-dirty' : ''}`}>{mode === 'explore' ? dirty ? 'Unsaved analysis · draft autosaves locally' : 'Saved analysis' : 'Dashboard changes save locally'}</span>
        <button type="button" onClick={() => undo(false)}>Undo</button>
        <button type="button" onClick={() => undo(true)}>Redo</button>
        <button type="button" onClick={() => setDense(!dense)}>{dense ? 'Comfortable' : 'Compact'} density</button>
      </div>
    </div>
    {analyticsStorage.error && <div role="alert" className="analytics-error">{analyticsStorage.error}<button type="button" onClick={analyticsStorage.retry}>Retry save</button><button type="button" onClick={() => download('analytics-recovery.json', JSON.stringify(analyticsStorage.pending || workspace, null, 2), 'application/json')}>Export retained work</button><button type="button" onClick={analyticsStorage.discard}>Discard pending save</button>{analyticsStorage.status === 'recovery_required' && <button type="button" onClick={() => { if (window.confirm('Preserve the damaged primary value as a recovery copy and restore the displayed backup?')) analyticsStorage.recover(); }}>Recover backup</button>}</div>}
    {error && <p role="alert" className="analytics-error">{error}</p>}{notice && <p role="status" className="analytics-notice">{notice}<button type="button" aria-label="Dismiss notification" onClick={() => setNotice('')}>×</button></p>}
    <div className="analytics-body">
      {libraryOpen && !focus && <aside className="analytics-library" aria-label="Analytics library">
        <div className="analytics-tile-meta"><h2>Your workspace</h2><small>{objects.length} saved</small></div>
        <div className="analytics-library-create">
          <button type="button" className="is-primary" onClick={startAnalysis}>New analysis</button>
          <button type="button" onClick={() => createBoard(false)}>New dashboard</button>
          <button type="button" onClick={() => createBoard(true)}>Overview template</button>
        </div>
        <input aria-label="Search Analytics library" placeholder="Search names and tags" value={search} onChange={e => setSearch(e.target.value)} />
        <div className="analytics-control-row">
          <select aria-label="Library sort" value={sort} onChange={e => setSort(e.target.value)}><option value="recent">Recently updated</option><option value="name">Name</option></select>
          <label className="analytics-checkbox-row"><input type="checkbox" checked={favorites} onChange={e => setFavorites(e.target.checked)} />Favorites only</label>
        </div>
        {Object.entries(workspace.drafts).filter(([, value]) => value).map(([key, value]) => <div className="analytics-draft-card" key={key}><button type="button" onClick={() => {
          if (!commit(next => ({ ...preserveDraft(next, true), activeAnalysisId: value.analysisId || null, lastView: 'explore' }))) return;
          cancel(); setDraft(clone(value.config)); setResult(value.result); setResultConfig(value.resultConfig); setDirty(true); setOrigin(value.origin || null);
        }}>Recover draft: {value.config.title}</button><button type="button" aria-label={`Discard draft ${value.config.title}`} onClick={() => { if (window.confirm(`Discard recovered draft ${value.config.title}?`)) commit(next => ({ ...next, drafts: { ...next.drafts, [key]: null } })); }}>×</button></div>)}
        {objects.map(item => <article key={item.id} className={(item.kind === 'dashboard' && mode === 'dashboards' && workspace.activeDashboardId === item.id) || (item.kind === 'analysis' && mode === 'explore' && workspace.activeAnalysisId === item.id) ? 'is-active' : ''}>
          <button type="button" className="analytics-library-open" onClick={() => item.kind === 'dashboard' ? commit(next => remember({ ...preserveDraft(next), activeDashboardId: item.id, lastView: 'dashboards' }, item.id)) : openAnalysis(item)}><small>{item.kind}{workspace.recent?.includes(item.id) ? ' · recent' : ''}</small><strong>{item.name}</strong>{!!item.tags?.length && <small>{item.tags.join(', ')}</small>}</button>
          <div className="analytics-actions"><button type="button" aria-label={`Favorite ${item.name}`} aria-pressed={!!item.favorite} onClick={() => manageObject(item.kind, item.id, 'favorite')}>{item.favorite ? '★' : '☆'}</button><details><summary>Manage</summary><div className="analytics-actions">{['rename', 'duplicate', 'tags', 'delete'].map(action => <button type="button" key={action} onClick={() => manageObject(item.kind, item.id, action)}>{action}</button>)}</div></details></div>
        </article>)}
        <details><summary>Local templates</summary><div className="analytics-actions"><button type="button" onClick={saveTemplate}>Save current dashboard as template</button>{workspace.templates.map(template => <div className="analytics-control-row" key={template.id}><button type="button" onClick={() => instantiateTemplate(template)}>Use {template.name} with selected dataset</button><button type="button" aria-label={`Delete template ${template.name}`} onClick={() => { if (window.confirm(`Delete template ${template.name}?`)) commit(next => ({ ...next, templates: next.templates.filter(t => t.id !== template.id) })); }}>×</button></div>)}</div></details>
        <details><summary>Import and export</summary><div className="analytics-actions"><button type="button" onClick={() => download('analytics-workspace.json', JSON.stringify(workspace, null, 2), 'application/json')}>Export workspace JSON</button><button type="button" onClick={() => download('analytics-definitions.json', JSON.stringify({ ...workspace, drafts: {}, dashboards: workspace.dashboards.map(b => ({ ...b, revisions: [], items: b.items.map(i => ({ ...i, result: null })) })), explorations: workspace.explorations.map(a => ({ ...a, result: null, revisions: [] })) }, null, 2), 'application/json')}>Export definitions JSON</button><button type="button" onClick={() => importRef.current.click()}>Import workspace JSON</button></div><input ref={importRef} type="file" accept="application/json,.json" hidden onChange={async e => { const file = e.target.files[0]; if (!file) return; try { if (file.size > 10000000) throw new Error('Import is limited to 10 MB.'); const value = JSON.parse(await file.text()); if (!commit(next => importCollection(value, next))) throw new Error('Import could not be saved.'); setNotice('Imported objects require source review before refresh.'); } catch (failure) { setError(failure.message); } e.target.value = ''; }} /></details>
      </aside>}
      <main className="analytics-main">
        {mode === 'explore' ? <>
          <div className="analytics-actions analytics-query-actions">
            <div className="analytics-query-primary">
              <input aria-label="Analysis name" value={draft.title} onChange={e => changeDraft({ ...draft, title: e.target.value })} />
              <button type="button" className="is-primary" onClick={run} disabled={status === 'loading' || !draft.source}>{status === 'loading' ? 'Running…' : 'Run analysis'}</button>
              {status === 'loading' && <button type="button" onClick={cancel}>Cancel query</button>}
              <button type="button" onClick={saveAnalysis}>Save analysis</button>
              <button type="button" onClick={detail}>Inspect detail rows</button>
            </div>
            <div className="analytics-query-pin">
              <select aria-label="Pin target dashboard" value={targetBoard} onChange={e => setTargetBoard(e.target.value)}>{workspace.dashboards.map(b => <option key={b.state.id} value={b.state.id}>{b.state.name}</option>)}</select>
              <button type="button" disabled={!result} onClick={() => pin(false)}>Pin copy</button>
              {origin && <><button type="button" onClick={() => pin(true)}>Update original</button><button type="button" onClick={() => commit(next => ({ ...next, activeDashboardId: next.dashboards.some(b => b.state.id === origin.boardId) ? origin.boardId : next.activeDashboardId, lastView: 'dashboards' }))}>Back to dashboard</button></>}
              {!!drillHistory.length && <button type="button" onClick={() => { changeDraft(drillHistory[drillHistory.length - 1]); setDrillHistory(list => list.slice(0, -1)); }}>Back one drill</button>}
            </div>
          </div>
          {result && querySignature(resultConfig) !== querySignature(draft) && <p className="analytics-notice">Builder changed. Showing the last result; run again to apply edits.</p>}
          <div className="analytics-analysis">
            <aside className="analytics-build-panel"><AnalyticsBuilder config={draft} fields={fields} metrics={metrics} onChange={changeDraft} /></aside>
            <div className="analytics-result-panel">
              <AnalyticsResult result={result} config={resultConfig ? { ...resultConfig, view: querySignature(resultConfig) === querySignature(draft) ? draft.view : resultConfig.view, appearance: draft.appearance } : draft} onSelect={drill} />
              {result && <details><summary>Source, filters and execution details</summary><p>Computed {result.executed_at}. This is query time, not source freshness.</p><pre>{JSON.stringify({ dataset: result.dataset, filters: result.filters, period: result.period, metrics: result.metrics, lineage: result.analysis_lineage }, null, 2)}</pre></details>}
            </div>
          </div>
        </> : <AnalyticsDashboard board={board} attachments={attachments} onChange={changeBoard} onInvestigate={investigate} onNewAnalysis={startAnalysis} selectedTile={selectedTile} onSelectTile={setSelectedTile} />}
      </main>
      {inspectorOpen && !focus && <aside className="analytics-inspector" aria-label="Analytics inspector">
        <h2>{mode === 'explore' ? 'Appearance' : inspected?.title || 'Select a tile'}</h2>
        {mode === 'dashboards' && inspected && <>
          <label>Tile title<input value={inspected.title} onChange={e => changeBoard({ ...board, items: board.items.map(item => item.id === inspected.id ? { ...item, title: e.target.value } : item) })} /></label>
          {['text', 'section'].includes(inspected.itemType) && <label>Text<textarea value={inspected.text || ''} onChange={e => changeBoard({ ...board, items: board.items.map(item => item.id === inspected.id ? { ...item, text: e.target.value } : item) })} /></label>}
          <label className="analytics-checkbox-row"><input type="checkbox" checked={!!inspected.locked} onChange={e => changeBoard({ ...board, items: board.items.map(item => item.id === inspected.id ? { ...item, locked: e.target.checked } : item) })} />Lock position</label>
        </>}
        <AnalyticsAppearance appearance={appearance} measures={mode === 'explore' ? draft.query.measures : inspected?.analysis?.query.measures} onChange={changeAppearance} />
        <div className="analytics-actions">
          <button type="button" onClick={exportPdf}>Export report PDF</button>
          <button type="button" onClick={() => window.print()}>Print presentation</button>
          {result && mode === 'explore' && <button type="button" onClick={() => download('analytics-result.csv', tableCsv(result), 'text/csv;charset=utf-8')}>Export result CSV</button>}
        </div>
        <details><summary>Saved revisions</summary><div className="analytics-actions">{(mode === 'explore' ? saved?.revisions || [] : board.revisions || []).map((revision, index) => <button type="button" key={index} onClick={() => { if (!window.confirm('Restore this saved revision?')) return; if (mode === 'explore') changeDraft(clone(revision.value.config)); else changeBoard({ ...clone(revision.value), revisions: board.revisions }); }}>{revision.savedAt}</button>)}</div></details>
        <details><summary>Connected tools</summary><div className="analytics-actions"><button type="button" onClick={onOpenGallery}>Chart gallery</button><button type="button" onClick={onOpenAiChart}>AI Chart</button><button type="button" onClick={() => { try { if (!draft.source || draft.requiresSourceReview) throw new Error('Confirm the selected dataset first.'); sessionStorage.setItem('analytics:chat-context', JSON.stringify({ source: draft.source, query: draft.query, title: draft.title })); onOpenAiChat?.(); window.dispatchEvent(new Event('analytics:chat-context')); } catch (failure) { setError(failure.message); } }}>Discuss in AI Chat</button></div></details>
        <small>Shortcuts: Ctrl/Cmd+S saves an analysis. Ctrl/Cmd+Z undoes, Shift+Z redoes outside text inputs. Local device storage; no team sharing.</small>
      </aside>}
    </div>
  </section>;
}
