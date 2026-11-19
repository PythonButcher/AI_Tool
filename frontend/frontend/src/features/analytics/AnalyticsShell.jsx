import React, { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  FaArrowLeft, FaBookmark, FaChartBar, FaChartLine, FaChevronDown,
  FaCode, FaColumns, FaCopy, FaDatabase, FaDownload,
  FaCompress, FaEllipsisH, FaExpand, FaFilePdf, FaFolderOpen, FaHashtag, FaHeading, FaHistory, FaLayerGroup,
  FaPalette, FaPlay, FaPlus, FaPrint, FaRedo, FaRobot, FaSearch,
  FaSlidersH, FaStickyNote, FaSyncAlt, FaTable, FaThLarge, FaThumbtack, FaTimes, FaTrash, FaUndo, FaUpload,
} from 'react-icons/fa';
import { DataContext, normalizeDatasetRows, useActiveDataset, useSemanticModel } from '../../context/DataContext';
import { useWindowContext } from '../../context/WindowContext';
import AnalyticsBuilder from './AnalyticsBuilder';
import AnalyticsDashboard, { AnalyticsDashboardFilters } from './AnalyticsDashboard';
import AnalyticsResult from './AnalyticsResult';
import AnalyticsAppearance from './AnalyticsAppearance';
import AnalyticsChangeExplorer from './AnalyticsChangeExplorer';
import { API, analyzeMetricChange, defaultAnalysis, download, filtersForTile, inlineIdentity, overviewTiles, queryAnalytics, querySignature, sourceKey, tableCsv, withDashboardFilters } from './analyticsModel';
import { checkpoint, clone, copyDashboard, emptyDashboard, importCollection, newId } from './analyticsStorage';
import './AnalyticsShell.css';

const TOOLS = [
  { id: 'actions', label: 'Actions', icon: FaSlidersH, description: 'Build, run, and manage the current workspace' },
  { id: 'change', label: 'Change Explorer', icon: FaChartLine, description: 'Explain metric changes by segment, volume, and value' },
  { id: 'library', label: 'Library', icon: FaFolderOpen, description: 'Saved dashboards, analyses, drafts, and templates' },
  { id: 'format', label: 'Format', icon: FaPalette, description: 'Chart appearance and tile properties' },
  { id: 'reports', label: 'Reports', icon: FaDownload, description: 'Export and print reports or back up the workspace' },
  { id: 'ai', label: 'AI & Charts', icon: FaRobot, description: 'Chart gallery, AI Chart, and AI Chat' },
  { id: 'history', label: 'History', icon: FaHistory, description: 'Undo, redo, and restore saved revisions' },
];
const TOOL_DIRECTORY = { id: 'all', label: 'Analytics tools', icon: FaLayerGroup, description: 'Choose a tool for this workspace' };

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
  const [metadata, setMetadata] = useState(null);
  const [sources, setSources] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('recent');
  const [favorites, setFavorites] = useState(false);
  const [toolPanel, setToolPanel] = useState(null);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [lineageOpen, setLineageOpen] = useState(false);
  const [focus, setFocus] = useState(false);
  const [dense, setDense] = useState(false);
  const [selectedTile, setSelectedTile] = useState(null);
  const [targetBoard, setTargetBoard] = useState(workspace.activeDashboardId);
  const [history, setHistory] = useState({ past: [], future: [] });
  const [boardHistory, setBoardHistory] = useState({ past: [], future: [] });
  const [dashboardRefresh, setDashboardRefresh] = useState(0);
  const [drillHistory, setDrillHistory] = useState([]);
  const [composerSession, setComposerSession] = useState({ id: 0, replaceDefaultValue: false });
  const request = useRef(null);
  const sequence = useRef(0);
  const draftRef = useRef(draft); draftRef.current = draft;
  const draftSnapshot = useRef(null);
  draftSnapshot.current = dirty ? { config: draft, resultConfig, result, origin, analysisId: workspace.activeAnalysisId, savedAt: new Date().toISOString() } : null;
  const shellRef = useRef(null);
  const focusButtonRef = useRef(null);
  const importRef = useRef(null);
  const switcherRef = useRef(null);
  const toolRailRef = useRef(null);
  const panelHeadingRef = useRef(null);
  const drawerScrollRef = useRef(null);
  const dashboardFiltersRef = useRef(null);
  const board = workspace.dashboards.find(d => d.state.id === workspace.activeDashboardId);
  const mode = workspace.lastView;
  const allSources = useMemo(() => [defaultSource, analysisContext && { kind: 'workspace', id: analysisContext.workspace_id, name: 'Active governed workspace', analysis_context: analysisContext }, ...sources].filter(Boolean), [defaultSource, analysisContext, sources]);
  const dashboardSource = board.state.analyticsSource || defaultSource;
  const selectedSource = mode === 'explore' ? draft.source : dashboardSource;
  const attachments = useMemo(() => ({ rows, inlineId, model }), [rows, inlineId, model]);
  const sourceSignature = selectedSource ? JSON.stringify(selectedSource) : '';
  const sourceMetadata = metadata?.signature === sourceSignature && metadata.attachments === attachments ? metadata : null;
  const fields = sourceMetadata?.fields || [];
  const metrics = sourceMetadata?.metrics || [];
  const resetComposer = useCallback((replaceDefaultValue = false) => {
    setComposerSession(previous => ({ id: previous.id + 1, replaceDefaultValue }));
  }, []);
  useLayoutEffect(() => {
    if (!focus) return undefined;
    const shell = shellRef.current;
    const focusButton = focusButtonRef.current;
    // Move the same workspace into the browser's top layer without remounting
    // the canvas, queries, or draft. A browser without popovers keeps it inline.
    if (typeof shell.showPopover === 'function' && typeof shell.hidePopover === 'function') {
      shell.setAttribute('popover', 'manual');
      try {
        shell.showPopover();
      } catch {
        shell.removeAttribute('popover');
      }
    }
    focusButton.focus({ preventScroll: true });
    return () => {
      if (shell.hasAttribute('popover')) {
        shell.hidePopover();
        shell.removeAttribute('popover');
      }
      if (focusButton.isConnected) focusButton.focus({ preventScroll: true });
    };
  }, [focus]);
  useLayoutEffect(() => {
    if (drawerScrollRef.current) drawerScrollRef.current.scrollTop = 0;
    panelHeadingRef.current?.focus({ preventScroll: true });
  }, [toolPanel]);
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
      resetComposer(!action.view || action.view === 'bar');
      cancel(); setDraft({ ...defaultAnalysis(defaultSource), view: action.view || 'bar' });
      setResult(null); setResultConfig(null); setDirty(true); setOrigin(null);
    }
  }, [workspace.pendingAction, commit, preserveDraft, defaultSource, cancel, resetComposer]);
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
    if (!sourceSignature) return undefined;
    const source = JSON.parse(sourceSignature);
    const controller = new AbortController();
    queryAnalytics(defaultAnalysis(source), attachments, { signal: controller.signal, metadataOnly: true }).then(data => {
      if (!controller.signal.aborted) setMetadata({ signature: sourceSignature, attachments, fields: data.fields, metrics: data.metrics });
    }).catch(failure => { if (!controller.signal.aborted) setMetadata({ signature: sourceSignature, attachments, error: failure.message }); });
    return () => controller.abort();
  }, [sourceSignature, attachments]);
  useEffect(() => {
    const dismiss = event => {
      if (switcherRef.current?.open && !switcherRef.current.contains(event.target)) {
        switcherRef.current.open = false;
      }
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, []);
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
  const switchMode = nextMode => { if (nextMode === mode) return; cancel(); setError(''); commit(next => ({ ...preserveDraft(next), lastView: nextMode })); };
  const openDashboard = id => {
    cancel(); setError('');
    commit(next => remember({ ...preserveDraft(next), activeDashboardId: id, lastView: 'dashboards' }, id));
  };
  const openAnalysis = analysis => {
    if (!commit(next => remember({ ...preserveDraft(next, true), lastView: 'explore', activeAnalysisId: analysis.id }, analysis.id))) return;
    resetComposer();
    cancel(); setDraft({ ...clone(analysis.config), requiresSourceReview: !!analysis.requiresSourceReview }); setResult(analysis.result || null); setResultConfig(analysis.config); setDirty(false); setOrigin(null); setHistory({ past: [], future: [] });
    if (analysis.requiresSourceReview) setError('Review the imported source and select a dataset before running.');
  };
  const startAnalysis = (view = 'bar', title, starter) => {
    if (!commit(next => ({ ...preserveDraft(next, true), lastView: 'explore', activeAnalysisId: null }))) return false;
    resetComposer(!starter && !title && view === 'bar');
    cancel();
    setDraft(starter || { ...defaultAnalysis(selectedSource), view, ...(title ? { title } : {}) });
    setResult(null); setResultConfig(null); setDirty(!!(starter || title)); setOrigin(null); setHistory({ past: [], future: [] }); setDrillHistory([]); setError('');
    if (mode === 'dashboards') setTargetBoard(board.state.id);
    return true;
  };
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
  const closeTool = useCallback(() => {
    toolRailRef.current?.querySelector(`[data-tool="${toolPanel}"]`)?.focus();
    setToolPanel(null);
  }, [toolPanel]);
  useEffect(() => {
    const listener = event => {
      if (event.key === 'Escape') {
        if (focus) {
          event.preventDefault();
          setFocus(false);
        } else if (switcherRef.current?.open) {
          switcherRef.current.open = false;
          switcherRef.current.querySelector('summary')?.focus();
        } else if (toolPanel && shellRef.current?.contains(event.target)) {
          event.preventDefault();
          closeTool();
        }
        return;
      }
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key === 's') { event.preventDefault(); if (mode === 'explore') saveAnalysis(); }
      if (event.key === 'z' && !['INPUT', 'TEXTAREA'].includes(event.target.tagName)) { event.preventDefault(); undo(event.shiftKey); }
    };
    window.addEventListener('keydown', listener); return () => window.removeEventListener('keydown', listener);
  }, [closeTool, focus, mode, saveAnalysis, toolPanel, undo]);
  const changeBoard = nextBoard => {
    const saved = commit(next => ({ ...next, dashboards: next.dashboards.map(b => b.state.id === nextBoard.state.id ? { ...nextBoard, state: { ...nextBoard.state, updatedAt: new Date().toISOString() }, revisions: checkpoint(b) } : b) }));
    if (saved) {
      setBoardHistory(h => ({ past: [...h.past.slice(-19), clone(board)], future: [] }));
    }
    return saved;
  };
  const makeOverviewItems = () => overviewTiles(selectedSource, fields).map(item => ({ ...item, id: newId('dashboard-tile') }));
  const canGenerateOverview = !!sourceMetadata?.fields && !(mode === 'explore' && draft.requiresSourceReview);
  const generateOverview = () => {
    if (!canGenerateOverview || board.items.length) return;
    changeBoard({ ...board, state: { ...board.state, mode: 'edit', analyticsSource: selectedSource }, items: makeOverviewItems() });
  };
  const createBoard = template => {
    const name = window.prompt('Dashboard name', template ? 'Business overview' : 'New dashboard'); if (!name?.trim()) return;
    const value = emptyDashboard(name.trim());
    value.state.analyticsSource = selectedSource;
    if (template && canGenerateOverview) value.items = makeOverviewItems();
    commit(next => ({ ...preserveDraft(next), dashboards: [...next.dashboards, value], activeDashboardId: value.state.id, lastView: 'dashboards' }));
  };
  const saveTemplate = () => {
    const name = window.prompt('Template name', board.state.name); if (!name?.trim()) return;
    const template = { id: newId('template'), name: name.trim(), items: board.items.filter(item => !item.resultSnapshot).map(item => ({ ...clone(item), result: null, resultSnapshot: null, sourceMetadata: undefined })) };
    if (commit(next => ({ ...next, templates: [...next.templates, template] }))) setNotice('Reusable layout saved. Fixed AI snapshots are excluded; live definitions and notes are retained.');
  };
  const instantiateTemplate = template => {
    if (!selectedSource || (mode === 'explore' && draft.requiresSourceReview)) { setError('Choose and confirm the dataset for this template first.'); return; }
    const value = emptyDashboard(`${template.name} dashboard`);
    value.state.analyticsSource = selectedSource;
    value.items = template.items.map(item => ({ ...clone(item), id: newId('dashboard-tile'), requiresSourceReview: false,
      analysis: item.analysis ? { ...item.analysis, source: clone(selectedSource), requiresSourceReview: false } : undefined }));
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
        if (kind === 'dashboard') next[key].push(copyDashboard(value, `${meta.name} (copy)`));
        else {
          const copied = { ...clone(value), id: newId(kind), name: `${meta.name} (copy)`, revisions: [] };
          copied.config.title = copied.name;
          next[key].push(copied);
        }
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
  const investigate = (item, filters, liveResult) => {
    if (!commit(next => ({ ...preserveDraft(next, true), lastView: 'explore', activeAnalysisId: null }))) return;
    const base = clone(item.analysis || { ...defaultAnalysis(defaultSource), title: item.title,
      query: { ...defaultAnalysis(defaultSource).query, measures: [{ id: 'value', field: item.mapping?.['Y-Axis'], aggregation: item.mapping?.['Y-Axis'] ? 'sum' : 'count_rows', metric_id: item.semanticConfig?.metricId || undefined }], group_by: item.mapping?.['X-Axis'] ? [{ field: item.mapping['X-Axis'] }] : [] } });
    const config = withDashboardFilters(base, filters);
    config.requiresSourceReview = !!item.requiresSourceReview;
    setOrigin({ boardId: board.state.id, itemId: item.id, original: JSON.stringify(item) });
    const retained = liveResult || item.result || null;
    resetComposer();
    cancel(); setDraft(config); setResult(retained); setResultConfig(liveResult ? config : item.result ? item.analysis : null); setDirty(true); setDrillHistory([]); setHistory({ past: [], future: [] });
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
      const kpi = draft.view === 'kpi';
      const item = { ...(update ? b.items.find(i => i.id === origin.itemId) : {}), id: update ? origin.itemId : newId('dashboard-tile'), itemType: kpi ? 'kpi' : 'chart', title: draft.title, analysis: clone(draft), result: clone(result), requiresSourceReview: false,
        layout: update ? b.items.find(i => i.id === origin.itemId).layout : { x: 0, y: Math.max(0, ...b.items.map(i => (i.layout?.y || 0) + (i.layout?.h || 7))), w: kpi ? 4 : 6, h: kpi ? 4 : 7 }, updatedAt: new Date().toISOString() };
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
  const recoveredDrafts = Object.entries(workspace.drafts).filter(([key, value]) => key !== 'current' && value);
  const restoreDraft = (key, value) => {
    if (!commit(next => {
      const drafts = { ...next.drafts };
      delete drafts[key];
      const retained = preserveDraft({ ...next, drafts }, key !== 'current');
      return { ...retained, drafts: { ...retained.drafts, current: clone(value) }, activeAnalysisId: value.analysisId || null, lastView: 'explore' };
    })) return;
    resetComposer();
    cancel(); setDraft(clone(value.config)); setResult(value.result); setResultConfig(value.resultConfig);
    setDirty(true); setOrigin(value.origin || null); setHistory({ past: [], future: [] }); setDrillHistory([]); setError('');
  };
  const inspected = board.items.find(item => item.id === selectedTile);
  const resultIsCurrent = !!result && querySignature(resultConfig) === querySignature(draft);
  const appearance = mode === 'explore' ? draft.appearance || {} : inspected?.analysis?.appearance || inspected?.display || {};
  const changeAppearance = patch => mode === 'explore' ? changeDraft({ ...draft, appearance: { ...appearance, ...patch } }) : inspected && changeBoard({ ...board, items: board.items.map(item => item.id === inspected.id ? { ...item, analysis: item.analysis ? { ...item.analysis, appearance: { ...appearance, ...patch } } : undefined, display: { ...item.display, ...patch } } : item) });
  const currentHistory = mode === 'explore' ? history : boardHistory;
  const activeTool = toolPanel === 'all' ? TOOL_DIRECTORY : TOOLS.find(tool => tool.id === toolPanel);
  const revisions = (mode === 'explore' ? saved?.revisions : board.revisions) || [];
  const showTool = (id, toggle = false) => {
    setFocus(false);
    setToolPanel(previous => toggle && previous === id ? null : id);
  };
  const selectTile = id => { setSelectedTile(id); showTool('format'); };
  const refreshDashboard = () => setDashboardRefresh(value => value + 1);
  const hasLiveTiles = board.items.some(item => item.analysis && !item.requiresSourceReview);
  const addDashboardText = type => {
    const id = newId('dashboard-tile');
    const y = Math.max(0, ...board.items.map(item => (item.layout?.y || 0) + (item.layout?.h || 6)));
    if (changeBoard({ ...board, state: { ...board.state, mode: 'edit' }, items: [...board.items, {
      id, itemType: type, title: type === 'section' ? 'Section' : 'Notes', text: '',
      layout: { x: 0, y, w: type === 'section' ? 12 : 6, h: type === 'section' ? 2 : 4 },
    }] })) selectTile(id);
  };
  const setDashboardMode = nextMode => {
    if (board.state.mode !== nextMode) changeBoard({ ...board, state: { ...board.state, mode: nextMode } });
  };
  const showDashboardFilters = () => {
    showTool('actions');
    requestAnimationFrame(() => dashboardFiltersRef.current?.focus());
  };
  const backToOrigin = () => openDashboard(workspace.dashboards.some(value => value.state.id === origin.boardId) ? origin.boardId : workspace.activeDashboardId);
  const goBackOneDrill = () => {
    changeDraft(drillHistory[drillHistory.length - 1]);
    setDrillHistory(list => list.slice(0, -1));
  };
  const launchTool = launch => {
    setFocus(false);
    launch?.();
  };
  const discussInChat = () => {
    const config = mode === 'explore' ? draft : { ...defaultAnalysis(selectedSource), title: board.state.name };
    try {
      if (!config.source || config.requiresSourceReview) throw new Error('Confirm the selected dataset first.');
      sessionStorage.setItem('analytics:chat-context', JSON.stringify({ source: config.source, query: config.query, title: config.title }));
      launchTool(onOpenAiChat);
      window.dispatchEvent(new Event('analytics:chat-context'));
    } catch (failure) {
      setError(failure.message);
    }
  };
  const exportWorkspace = () => download('analytics-workspace.json', JSON.stringify(workspace, null, 2), 'application/json');
  const exportDefinitions = () => {
    const definitions = { ...workspace, drafts: {},
      dashboards: workspace.dashboards.map(value => ({ ...value, revisions: [], items: value.items.map(item => ({ ...item, result: null })) })),
      explorations: workspace.explorations.map(value => ({ ...value, result: null, revisions: [] })) };
    download('analytics-definitions.json', JSON.stringify(definitions, null, 2), 'application/json');
  };
  const exportCsv = () => download('analytics-result.csv', tableCsv(result), 'text/csv;charset=utf-8');
  const changeFilters = mode === 'explore' ? draft.query.filters || [] :
    filtersForTile({ analysis: { source: selectedSource } }, board.state.analyticsFilters || []).map(filter => filter.rule);
  const changeDefaults = mode === 'explore' ? {
    dateField: draft.query.period?.field || draft.query.group_by.find(group => group.grain)?.field,
    segmentField: draft.query.group_by.find(group => !group.grain)?.field,
    metricField: draft.query.measures.find(measure => measure.aggregation === 'sum' && !measure.metric_id && !measure.formula)?.field,
  } : {};
  const openChangeSegment = (request, driver) => {
    const label = driver.kind === 'missing' ? 'Missing segment' : String(driver.segment);
    const base = defaultAnalysis(request.source);
    const rule = { field: request.segment_field, operator: 'eq', type: 'segment', value: driver.segment };
    const filters = Array.isArray(request.filters) ? [...request.filters, rule] :
      request.filters?.op === 'and' && Array.isArray(request.filters.rules)
        ? { ...request.filters, rules: [...request.filters.rules, rule] }
        : { op: 'and', rules: [request.filters, rule] };
    const config = {
      ...base, view: 'line', title: `Change Explorer · ${label}`,
      query: {
        ...base.query,
        measures: [{ id: request.date_field === 'value' ? 'metric_value' : 'value', ...request.metric, label: request.metric.field || 'Records' }],
        group_by: [{ field: request.date_field, grain: 'day' }],
        period: { field: request.date_field, ...request.current },
        comparison: { kind: 'custom', ...request.baseline },
        filters,
      },
    };
    if (startAnalysis(config.view, config.title, config)) closeTool();
  };

  return <section ref={shellRef} className={`analytics-shell ${focus ? 'is-focus' : ''} ${dense ? 'is-dense' : ''}`} aria-label="Analytics workspace">
    <header className="analytics-header">
      <details className="analytics-switcher" ref={switcherRef}>
        <summary aria-label={`Workspace switcher: ${mode === 'explore' ? draft.title : board.state.name}`}>
          <span className="analytics-brand-badge"><FaChartLine /></span>
          <span className="analytics-title-block">
            <span className="analytics-eyebrow">Analytics Studio</span>
            <span className="analytics-workspace-name">{mode === 'explore' ? draft.title || 'Untitled analysis' : board.state.name}</span>
          </span>
          <FaChevronDown className="analytics-switcher-chevron" />
        </summary>
        <div className="analytics-switcher-menu">
          <div className="analytics-menu-heading">{mode === 'explore' ? 'Saved analyses' : 'Dashboards'}</div>
          <div className="analytics-switcher-assets">
            {mode === 'explore' ? workspace.explorations.map(analysis => (
              <button type="button" key={analysis.id} aria-current={analysis.id === workspace.activeAnalysisId ? 'true' : undefined}
                onClick={() => { switcherRef.current.open = false; openAnalysis(analysis); }}>
                <FaChartBar /><span>{analysis.name}</span>
              </button>
            )) : workspace.dashboards.map(({ state }) => (
              <button type="button" key={state.id} aria-current={state.id === workspace.activeDashboardId ? 'true' : undefined}
                onClick={() => { switcherRef.current.open = false; openDashboard(state.id); }}>
                <FaThLarge /><span>{state.name}</span>
              </button>
            ))}
          </div>
          <div className="analytics-switcher-actions">
            <button type="button" onClick={() => { switcherRef.current.open = false; startAnalysis(); }}><FaPlus /><span>New analysis</span></button>
            <button type="button" onClick={() => { switcherRef.current.open = false; createBoard(false); }}><FaThLarge /><span>New dashboard</span></button>
            <button type="button" aria-expanded={toolPanel === 'library' && !focus} onClick={() => { switcherRef.current.open = false; showTool('library'); }}>
              <FaFolderOpen /><span>Open Library</span>{recoveredDrafts.length > 0 && <small>{recoveredDrafts.length} recoverable</small>}
            </button>
          </div>
        </div>
      </details>

      <div className="analytics-header-context">
        <div className="analytics-mode-switch" role="group" aria-label="Analytics view mode">
          <button type="button" onClick={() => switchMode('dashboards')} aria-label="Dashboard" title="Dashboard" aria-pressed={mode === 'dashboards'}><FaThLarge /><span>Dashboard</span></button>
          <button type="button" onClick={() => switchMode('explore')} aria-label="Analysis" title="Analysis" aria-pressed={mode === 'explore'}><FaChartBar /><span>Analysis</span></button>
        </div>
        <div className="analytics-dataset-pill" title={selectedSource?.name || 'Choose a dataset'}>
          <FaDatabase className="analytics-dataset-icon" />
          <select aria-label="Analytics dataset" value={sourceKey(selectedSource)} onChange={event => {
            const source = allSources.find(option => sourceKey(option) === event.target.value);
            if (!source) return;
            setError('');
            if (mode === 'explore') changeDraft({ ...draft, source, requiresSourceReview: false });
            else changeBoard({ ...board, state: { ...board.state, analyticsSource: source } });
          }}>
            <option value="" disabled>Choose a dataset</option>
            {selectedSource && !allSources.some(source => sourceKey(source) === sourceKey(selectedSource)) && <option value={sourceKey(selectedSource)}>{selectedSource.name || selectedSource.id} (unavailable)</option>}
            {allSources.map(source => <option key={sourceKey(source)} value={sourceKey(source)}>{source.name}</option>)}
          </select>
        </div>
      </div>

      <div className="analytics-header-tools">
        {mode === 'explore' && <button type="button" className="is-primary analytics-run-btn" onClick={run} disabled={status === 'loading' || !draft.source} aria-label="Run analysis" title="Run analysis">
          <FaPlay /><span>{status === 'loading' ? 'Running…' : 'Run analysis'}</span>
        </button>}
        <button ref={focusButtonRef} type="button" className={`analytics-focus-button ${focus ? 'is-primary' : ''}`}
          title={focus ? 'Exit focus (Esc)' : 'Enter focus mode'} aria-pressed={focus} onClick={() => setFocus(value => !value)}>
          {focus ? <FaCompress /> : <FaExpand />}<span>{focus ? 'Exit focus' : 'Focus'}</span>
          {focus && <kbd aria-hidden="true">Esc</kbd>}
        </button>
      </div>
    </header>

    <div className="analytics-tool-dock" hidden={focus}>
      <nav ref={toolRailRef} className="analytics-tool-rail" aria-label="Analytics tools">
        {[TOOL_DIRECTORY, ...TOOLS].map(({ id, label, icon: Icon, description }) => (
          <button type="button" className={`analytics-tool-trigger ${id === 'all' ? 'analytics-tool-home' : ''}`} key={id}
            data-tool={id} title={description} aria-expanded={toolPanel === id} aria-controls={toolPanel === id ? 'analytics-tool-panel' : undefined}
            onClick={() => showTool(id, true)}>
            <Icon /><span>{id === 'all' ? 'Tools' : label}</span>{id === 'all' && <FaChevronDown className="analytics-tool-chevron" />}
          </button>
        ))}
      </nav>

      <aside id="analytics-tool-panel" className="analytics-drawer" hidden={!activeTool} aria-label={toolPanel === 'all' ? 'Analytics tool drawer' : `Analytics ${activeTool?.label || 'tools'}`}>
        {activeTool && <header className="analytics-drawer-header">
          <div>
            <h2 ref={panelHeadingRef} tabIndex={-1}>{activeTool.label}</h2>
            <small>{toolPanel === 'library' ? `${workspace.dashboards.length + workspace.explorations.length} saved assets` : activeTool.description}</small>
          </div>
          <button type="button" className="analytics-drawer-close" onClick={closeTool}><FaTimes /><span>Close tools</span></button>
        </header>}
        <div className="analytics-drawer-scroll" ref={drawerScrollRef}>
          <div hidden={toolPanel !== 'change'}>
            <AnalyticsChangeExplorer key={JSON.stringify([sourceSignature, mode, changeFilters])}
              source={selectedSource} fields={fields} loadingFields={!!selectedSource && !sourceMetadata}
              sourceNeedsReview={mode === 'explore' && draft.requiresSourceReview} contextFilters={changeFilters} defaults={changeDefaults}
              requestChange={(request, signal) => analyzeMetricChange(request, attachments, signal)} openAnalysis={openChangeSegment} />
          </div>
          {toolPanel === 'all' && <div className="analytics-drawer-grid analytics-tool-directory">
            {TOOLS.map(({ id, label, icon: Icon, description }) => (
              <button type="button" key={id} onClick={() => showTool(id)}>
                <span className="analytics-directory-icon"><Icon /></span><span><strong>{label}</strong><small>{description}</small></span>
              </button>
            ))}
          </div>}

          {toolPanel === 'actions' && <div className="analytics-drawer-grid analytics-workspace-actions">
            {mode === 'explore' ? <>
              <div className="analytics-inspector-card analytics-tool-actions">
                <h3>Analysis</h3>
                <button type="button" onClick={run} disabled={status === 'loading' || !draft.source}><FaPlay /> Run analysis</button>
                {status === 'loading' && <button type="button" onClick={cancel}><FaTimes /> Cancel query</button>}
                <button type="button" onClick={saveAnalysis}><FaBookmark /> Save analysis</button>
                <button type="button" onClick={() => { detail(); closeTool(); }}><FaTable /> Inspect detail rows</button>
                {!!drillHistory.length && <button type="button" onClick={goBackOneDrill}><FaArrowLeft /> Back one drill</button>}
              </div>
              <div className="analytics-inspector-card analytics-tool-actions">
                <h3>Dashboard destination</h3>
                <label>Pin destination<select value={targetBoard} onChange={e => setTargetBoard(e.target.value)}>{workspace.dashboards.map(value => <option key={value.state.id} value={value.state.id}>{value.state.name}</option>)}</select></label>
                <button type="button" disabled={!result} onClick={() => pin(false)}><FaThumbtack /> Pin copy</button>
                {origin && <button type="button" onClick={() => pin(true)}><FaThumbtack /> Update original</button>}
                {origin && <button type="button" onClick={backToOrigin}><FaArrowLeft /> Back to dashboard</button>}
              </div>
            </> : <>
              <div className="analytics-inspector-card analytics-tool-actions">
                <h3>Add to dashboard</h3>
                {!board.items.length && <button type="button" onClick={generateOverview} disabled={!canGenerateOverview}><FaLayerGroup /> Generate overview</button>}
                <button type="button" onClick={() => { startAnalysis(); closeTool(); }}><FaChartBar /> Build a chart</button>
                <button type="button" onClick={() => { startAnalysis('kpi'); closeTool(); }}><FaHashtag /> Build a KPI</button>
                <button type="button" onClick={() => addDashboardText('text')}><FaStickyNote /> Add notes</button>
                <button type="button" onClick={() => addDashboardText('section')}><FaHeading /> Add section</button>
              </div>
              <div className="analytics-inspector-card analytics-tool-actions">
                <h3>Dashboard layout</h3>
                <button type="button" onClick={() => setDashboardMode('edit')} aria-pressed={board.state.mode !== 'view'}>Edit layout</button>
                <button type="button" onClick={() => setDashboardMode('view')} aria-pressed={board.state.mode === 'view'}>View layout</button>
                <button type="button" onClick={refreshDashboard} disabled={!hasLiveTiles}><FaSyncAlt /> Refresh live tiles</button>
              </div>
              <div className="analytics-inspector-card analytics-workspace-filters">
                <h3 ref={dashboardFiltersRef} tabIndex={-1}>Dashboard filters</h3>
                <AnalyticsDashboardFilters board={board} source={selectedSource} fields={fields} onChange={changeBoard} />
              </div>
            </>}
            <div className="analytics-inspector-card analytics-tool-actions">
              <h3>Workspace display</h3>
              <button type="button" onClick={() => setDense(value => !value)} aria-pressed={dense}><FaSlidersH /> Compact spacing</button>
              <button type="button" onClick={() => setFocus(true)}><FaExpand /> Enter focus</button>
            </div>
          </div>}

          {toolPanel === 'library' && <div className="analytics-drawer-grid analytics-library">
            <section className="analytics-library-assets" aria-label="Saved assets">
              <div className="analytics-search-box">
                <FaSearch className="analytics-search-icon" />
                <input aria-label="Search Analytics library" placeholder="Search names and tags…" value={search} onChange={e => setSearch(e.target.value)} />
              </div>

              <div className="analytics-control-row">
                <select aria-label="Library sort" value={sort} onChange={e => setSort(e.target.value)}><option value="recent">Recently updated</option><option value="name">Name</option></select>
                <label className="analytics-checkbox-row"><input type="checkbox" checked={favorites} onChange={e => setFavorites(e.target.checked)} />Favorites only</label>
              </div>

              {recoveredDrafts.map(([key, value]) => <div className="analytics-draft-card" key={key}>
                <button type="button" onClick={() => restoreDraft(key, value)}>Recover draft: {value.config.title}</button>
                <button type="button" aria-label={`Discard draft ${value.config.title}`} onClick={() => {
                  if (window.confirm(`Discard recovered draft ${value.config.title}?`)) commit(next => ({ ...next, drafts: { ...next.drafts, [key]: null } }));
                }}>×</button>
              </div>)}

              <div className="analytics-library-list">
                {objects.map(item => (
                  <article key={item.id} className={(item.kind === 'dashboard' && mode === 'dashboards' && workspace.activeDashboardId === item.id) || (item.kind === 'analysis' && mode === 'explore' && workspace.activeAnalysisId === item.id) ? 'is-active' : ''}>
                    <div className="analytics-asset-row">
                      <button type="button" className="analytics-library-open" onClick={() => item.kind === 'dashboard' ? openDashboard(item.id) : openAnalysis(item)}>
                        <small>{item.kind}{workspace.recent?.includes(item.id) ? ' · recent' : ''}</small>
                        <strong>{item.name}</strong>
                        {!!item.tags?.length && <small className="analytics-tag-line">{item.tags.join(', ')}</small>}
                      </button>
                      <div className="analytics-asset-btns">
                        <button type="button" className="analytics-icon-btn" aria-label={`Favorite ${item.name}`} aria-pressed={!!item.favorite} onClick={() => manageObject(item.kind, item.id, 'favorite')}>{item.favorite ? '★' : '☆'}</button>
                        <button type="button" className="analytics-icon-btn" aria-label={`Manage ${item.name}`} onClick={() => setActiveMenuId(activeMenuId === item.id ? null : item.id)}><FaEllipsisH /></button>
                      </div>
                    </div>
                    {activeMenuId === item.id && (
                      <div className="analytics-context-menu">
                        {['rename', 'duplicate', 'tags', 'delete'].map(action => (
                          <button type="button" key={action} onClick={() => { manageObject(item.kind, item.id, action); setActiveMenuId(null); }}>{action}</button>
                        ))}
                      </div>
                    )}
                  </article>
                ))}
              </div>
              {!objects.length && <p className="analytics-empty-hint">No saved assets match these filters.</p>}
            </section>
            <section className="analytics-library-utilities" aria-label="Create and import">
              <div className="analytics-library-create">
                <button type="button" className="is-primary" onClick={() => startAnalysis()}><FaPlus /><span>New analysis</span></button>
                <button type="button" onClick={() => createBoard(false)}><FaThLarge /><span>New dashboard</span></button>
                <button type="button" onClick={() => createBoard(true)} disabled={!canGenerateOverview}><FaLayerGroup /><span>Overview template</span></button>
                <button type="button" onClick={() => importRef.current.click()}><FaUpload /><span>Import workspace JSON</span></button>
              </div>
              <div className="analytics-inspector-card">
                <div className="analytics-card-title"><FaLayerGroup /><span>Local templates</span></div>
                <button type="button" className="analytics-icon-pill" onClick={saveTemplate}><FaPlus /><span>Save current dashboard as template</span></button>
                {workspace.templates.map(template => (
                  <div className="analytics-control-row" key={template.id}>
                    <button type="button" onClick={() => instantiateTemplate(template)}>Use {template.name} with selected dataset</button>
                    <button type="button" aria-label={`Delete template ${template.name}`} onClick={() => { if (window.confirm(`Delete template ${template.name}?`)) commit(next => ({ ...next, templates: next.templates.filter(t => t.id !== template.id) })); }}><FaTrash /></button>
                  </div>
                ))}
              </div>
            </section>
          </div>}

          <div className={`analytics-drawer-grid analytics-drawer-grid--${toolPanel}`}>
            {toolPanel === 'format' && <>
              {mode === 'dashboards' && (inspected ? (
                <div className="analytics-inspector-card">
                  <label>Tile title<input value={inspected.title} onChange={e => changeBoard({ ...board, items: board.items.map(item => item.id === inspected.id ? { ...item, title: e.target.value } : item) })} /></label>
                  {['text', 'section'].includes(inspected.itemType) && <label>Text<textarea value={inspected.text || ''} onChange={e => changeBoard({ ...board, items: board.items.map(item => item.id === inspected.id ? { ...item, text: e.target.value } : item) })} /></label>}
                  <label className="analytics-checkbox-row"><input type="checkbox" checked={!!inspected.locked} onChange={e => changeBoard({ ...board, items: board.items.map(item => item.id === inspected.id ? { ...item, locked: e.target.checked } : item) })} />Lock position</label>
                </div>
              ) : <p className="analytics-empty-hint">{board.items.length ? 'Choose a tile to format.' : 'Add a tile to customize its appearance.'}</p>)}
              {mode === 'dashboards' && board.items.length > 0 && (
                <label className="analytics-format-target">Dashboard tile
                  <select value={inspected?.id || ''} onChange={event => setSelectedTile(event.target.value || null)}>
                    <option value="">Choose a tile</option>
                    {board.items.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
                  </select>
                </label>
              )}
              {(mode === 'explore' || (inspected && !['text', 'section'].includes(inspected.itemType))) &&
                <AnalyticsAppearance appearance={appearance} measures={mode === 'explore' ? draft.query.measures : inspected?.analysis?.query.measures} onChange={changeAppearance} />}
            </>}

            {toolPanel === 'reports' && <>
              <div className="analytics-inspector-card analytics-tool-actions">
                <h3>Report output</h3>
                <button type="button" onClick={exportPdf}><FaFilePdf /><span>Export report PDF</span></button>
                <button type="button" onClick={() => window.print()}><FaPrint /><span>Print presentation</span></button>
                {mode === 'explore' && <button type="button" onClick={exportCsv} disabled={!result} title={result ? undefined : 'Run an analysis to export its results'}><FaTable /><span>Export result CSV</span></button>}
              </div>
              <div className="analytics-inspector-card analytics-tool-actions">
                <h3>Workspace files</h3>
                <button type="button" onClick={exportWorkspace}><FaDownload /><span>Export workspace JSON</span></button>
                <button type="button" onClick={exportDefinitions}><FaCopy /><span>Export definitions JSON</span></button>
              </div>
            </>}

            {toolPanel === 'ai' && <div className="analytics-inspector-card analytics-tool-actions">
              <button type="button" onClick={() => launchTool(onOpenGallery)}><FaColumns /><span>Chart gallery<small>Start with a visualization</small></span></button>
              <button type="button" onClick={() => launchTool(onOpenAiChart)}><FaChartBar /><span>AI Chart<small>Describe the chart you want to build</small></span></button>
              <button type="button" onClick={discussInChat}><FaRobot /><span>Discuss in AI Chat<small>Open a chat draft with the selected dataset</small></span></button>
            </div>}

            {toolPanel === 'history' && <>
              <div className="analytics-inspector-card analytics-tool-actions">
                <h3>Recent edits</h3>
                <button type="button" disabled={!currentHistory.past.length} onClick={() => undo(false)}><FaUndo /><span>Undo</span><kbd>Ctrl/Cmd+Z</kbd></button>
                <button type="button" disabled={!currentHistory.future.length} onClick={() => undo(true)}><FaRedo /><span>Redo</span><kbd>Ctrl/Cmd+Shift+Z</kbd></button>
              </div>
              <div className="analytics-inspector-card analytics-tool-actions">
                <h3>Saved revisions</h3>
                {[...revisions].reverse().map((revision, index) => (
                  <button type="button" key={index} onClick={() => {
                    if (!window.confirm('Restore this saved revision?')) return;
                    if (mode === 'explore') changeDraft(clone(revision.value.config));
                    else changeBoard({ ...clone(revision.value), revisions: board.revisions });
                  }}><FaHistory /><span>Restore revision<small><time dateTime={revision.savedAt}>{new Date(revision.savedAt).toLocaleString()}</time></small></span></button>
                ))}
                {!revisions.length && <small>No saved revisions yet.</small>}
              </div>
            </>}
          </div>
        </div>
      </aside>
    </div>

    {analyticsStorage.error && <div role="alert" className="analytics-error">{analyticsStorage.error}<button type="button" onClick={analyticsStorage.retry}>Retry save</button><button type="button" onClick={() => download('analytics-recovery.json', JSON.stringify(analyticsStorage.pending || workspace, null, 2), 'application/json')}>Export retained work</button><button type="button" onClick={analyticsStorage.discard}>Discard pending save</button>{analyticsStorage.status === 'recovery_required' && <button type="button" onClick={() => { if (window.confirm('Preserve the damaged primary value as a recovery copy and restore the displayed backup?')) analyticsStorage.recover(); }}>Recover backup</button>}</div>}
    {(error || sourceMetadata?.error) && <p role="alert" className="analytics-error">{error || sourceMetadata.error}</p>}{notice && <p role="status" className="analytics-notice">{notice}<button type="button" aria-label="Dismiss notification" onClick={() => setNotice('')}>×</button></p>}

    <div className="analytics-body">

      <main className={`analytics-main analytics-main--${mode}`}>
        {mode === 'explore' ? <>
          <div className="analytics-actions analytics-query-actions">
            <div className="analytics-query-primary">
              <input aria-label="Analysis name" value={draft.title} onChange={e => changeDraft({ ...draft, title: e.target.value })} />
              {status === 'loading' && <button type="button" onClick={cancel}><FaTimes /><span>Cancel query</span></button>}
              {draft.requiresSourceReview && <button type="button" onClick={() => {
                const source = allSources.find(option => sourceKey(option) === sourceKey(draft.source));
                if (source) changeDraft({ ...draft, source, requiresSourceReview: false });
                else setError('Reattach this source or choose an available dataset.');
              }}>Confirm imported dataset</button>}
              <button type="button" className="analytics-icon-pill" onClick={saveAnalysis}><FaBookmark /><span>Save analysis</span></button>
              {dirty && <small>Draft autosaves locally</small>}
              <button type="button" className="analytics-icon-pill" onClick={detail}><FaTable /><span>Inspect detail rows</span></button>
            </div>
            <div className="analytics-query-pin">
              <span className="analytics-pin-group">
                <FaThumbtack className="analytics-pin-icon" />
                <select aria-label="Pin target dashboard" value={targetBoard} onChange={e => setTargetBoard(e.target.value)}>{workspace.dashboards.map(b => <option key={b.state.id} value={b.state.id}>{b.state.name}</option>)}</select>
                <button type="button" disabled={!result} onClick={() => pin(false)}>Pin copy</button>
              </span>
              {origin && <>
                <button type="button" className="is-primary" onClick={() => pin(true)}>Update original</button>
                <button type="button" className="analytics-icon-pill" onClick={backToOrigin}><FaArrowLeft /><span>Back to dashboard</span></button>
              </>}
              {!!drillHistory.length && <button type="button" className="analytics-icon-pill" onClick={goBackOneDrill}><FaArrowLeft /><span>Back one drill</span></button>}
            </div>
          </div>

          {result && !resultIsCurrent && <p className="analytics-notice">Builder changed. Run the analysis to apply your edits to the result.</p>}

          <div className="analytics-workbench-grid">
            <AnalyticsBuilder key={composerSession.id} config={draft} fields={fields} metrics={metrics} sourceLoading={!!selectedSource && !sourceMetadata}
              replaceDefaultValue={composerSession.replaceDefaultValue} onChange={changeDraft} />
            <div className="analytics-result-panel">
              <h2 className="analytics-result-heading">Results</h2>
              <AnalyticsResult result={result} config={resultConfig ? { ...resultConfig, view: resultIsCurrent ? draft.view : resultConfig.view, appearance: draft.appearance } : draft} onSelect={resultIsCurrent ? drill : undefined} />
              {result && (
                <div className="analytics-lineage-footer">
                  <button type="button" className={`analytics-icon-pill ${lineageOpen ? 'is-selected' : ''}`} onClick={() => setLineageOpen(v => !v)}>
                    <FaCode /><span>Source, filters and execution details</span>
                  </button>
                  {lineageOpen && (
                    <div className="analytics-popover-tray">
                      <p className="analytics-scope">Computed {result.executed_at}. This is query time, not source freshness.</p>
                      <pre>{JSON.stringify({ dataset: result.dataset, filters: result.filters, period: result.period, metrics: result.metrics, lineage: result.analysis_lineage }, null, 2)}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </> : (
          <AnalyticsDashboard key={board.state.id} board={board} attachments={attachments} onChange={changeBoard} onInvestigate={investigate}
            onNewAnalysis={startAnalysis} selectedTile={selectedTile} onSelectTile={selectTile}
            source={selectedSource} fields={fields} sourceLoading={!!selectedSource && !sourceMetadata} canGenerateOverview={canGenerateOverview} onGenerateOverview={generateOverview}
            refresh={dashboardRefresh} onRefresh={refreshDashboard} onOpenFilters={showDashboardFilters} filtersOpen={toolPanel === 'actions' && !focus}
            onAddText={addDashboardText} onSelectMode={setDashboardMode} />
        )}
      </main>

    </div>
    <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={async event => {
      const input = event.currentTarget;
      const file = input.files[0];
      if (!file) return;
      try {
        if (file.size > 10000000) throw new Error('Import is limited to 10 MB.');
        const value = JSON.parse(await file.text());
        if (!commit(next => importCollection(value, next))) throw new Error('Import could not be saved.');
        setNotice('Imported objects require source review before refresh.');
      } catch (failure) {
        setError(failure.message);
      } finally {
        input.value = '';
      }
    }} />
  </section>;
}
