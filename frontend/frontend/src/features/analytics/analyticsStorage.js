import { createDefaultDashboardFilters } from '../../utils/dashboardFilterUtils';
import { createDefaultDashboardCanvasSettings, createDefaultDashboardSharingSkeleton, normalizeDashboardItemLayout } from '../../utils/dashboardCanvasUtils';

export const STORAGE_KEY = 'analyticsWorkspace:v1';
export const clone = value => JSON.parse(JSON.stringify(value));
export const newId = prefix => `${prefix}-${window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
export const emptyDashboard = (name = 'Business Dashboard', id = newId('dashboard')) => ({
  state: { id, name, mode: 'edit', isVisible: true, filters: createDefaultDashboardFilters(),
    canvas: createDefaultDashboardCanvasSettings(), sharing: createDefaultDashboardSharingSkeleton(), layoutVersion: 1,
    tags: [], favorite: false, updatedAt: new Date().toISOString() }, items: [], revisions: [],
});
export const emptyWorkspace = () => ({ schemaVersion: 1, revision: 0, activeDashboardId: 'dashboard-primary',
  lastView: 'dashboards', activeAnalysisId: null, dashboards: [emptyDashboard('Business Dashboard', 'dashboard-primary')],
  explorations: [], drafts: {}, recent: [], templates: [] });

export function validateFilters(node, depth = 0) {
  if (depth > 5) throw new Error('Filter groups may be nested at most five levels.');
  if (Array.isArray(node)) {
    if (node.length > 30) throw new Error('Use at most 30 conditions per filter group.');
    node.forEach(rule => validateFilters(rule, depth + 1));
  } else if (node && typeof node === 'object') {
    if ('rules' in node) {
      if (!['and', 'or'].includes(node.op || 'and') || !Array.isArray(node.rules)) throw new Error('Invalid filter group.');
      validateFilters(node.rules, depth);
    } else if (typeof node.field !== 'string' || typeof node.operator !== 'string') throw new Error('Each filter needs a field and operator.');
  } else throw new Error('Filters must be conditions or a group of conditions.');
}

function validateAnalysis(config) {
  if (!config || typeof config.title !== 'string' || typeof config.view !== 'string'
      || !Array.isArray(config.query?.measures) || !config.query.measures.length
      || !Array.isArray(config.query.group_by)
      || config.query.measures.some(m => !m || typeof m.id !== 'string')
      || config.query.group_by.some(g => !g || typeof g.field !== 'string')) throw new Error('Invalid analysis configuration.');
  if (config.source && (!['inline', 'datahub', 'workspace'].includes(config.source.kind) || typeof config.source.id !== 'string')) throw new Error('Invalid analysis source.');
  validateFilters(config.query.filters || []);
}

export function normalizeWorkspace(value) {
  if (!value || value.schemaVersion !== 1 || !Array.isArray(value.dashboards) || !value.dashboards.length
      || !Array.isArray(value.explorations) || !Number.isInteger(value.revision) || value.revision < 0) {
    throw new Error('This Analytics collection is damaged or uses an unsupported version.');
  }
  const ids = new Set();
  const itemIds = new Set();
  for (const board of value.dashboards) {
    if (!board?.state?.id || typeof board.state.name !== 'string' || !Array.isArray(board.items) || ids.has(board.state.id)) {
      throw new Error('A dashboard identity or record is invalid.');
    }
    ids.add(board.state.id);
    for (const item of board.items) {
      if (!item || typeof item !== 'object' || !item.id || itemIds.has(item.id)) throw new Error('A dashboard tile identity is invalid.');
      itemIds.add(item.id);
      if (item.analysis) validateAnalysis(item.analysis);
    }
  }
  if (!ids.has(value.activeDashboardId)) throw new Error('The selected dashboard is missing.');
  const analysisIds = new Set();
  for (const analysis of value.explorations) {
    if (!analysis?.id || typeof analysis.name !== 'string' || !analysis.config || typeof analysis.config !== 'object' || analysisIds.has(analysis.id)) {
      throw new Error('A saved analysis is invalid.');
    }
    analysisIds.add(analysis.id);
    validateAnalysis(analysis.config);
  }
  if (value.drafts && (typeof value.drafts !== 'object' || Array.isArray(value.drafts))) throw new Error('Invalid analysis drafts.');
  Object.values(value.drafts || {}).filter(Boolean).forEach(draft => validateAnalysis(draft.config));
  if (value.recent && !Array.isArray(value.recent)) throw new Error('Invalid recent items.');
  if (value.templates && (!Array.isArray(value.templates) || value.templates.some(t => !t.id || typeof t.name !== 'string' || !Array.isArray(t.items)))) throw new Error('Invalid dashboard templates.');
  (value.templates || []).forEach(template => template.items.forEach(item => { if (item.analysis) validateAnalysis(item.analysis); }));
  return { ...emptyWorkspace(), ...value, drafts: value.drafts || {}, recent: value.recent || [] };
}

function migrateBoard(parsed) {
  if (!parsed?.state || Array.isArray(parsed.state) || !Array.isArray(parsed.items)) throw new Error('Invalid dashboard backup.');
  const base = emptyDashboard(parsed.state.name || 'Business Dashboard', parsed.state.id || 'dashboard-primary');
  const board = { ...base, state: { ...base.state, ...parsed.state }, items: parsed.items.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Damaged tile in backup.');
    return { ...item, id: item.id || `dashboard-migrated-${index}`, layout: item.layout || normalizeDashboardItemLayout(null, index, item.itemType || 'chart') };
  }) };
  return normalizeWorkspace({ ...emptyWorkspace(), activeDashboardId: board.state.id, dashboards: [board] });
}

export function loadAnalytics(storage) {
  let original = null;
  try {
    original = storage.getItem(STORAGE_KEY);
    if (original !== null) {
      try { return { workspace: normalizeWorkspace(JSON.parse(original)), original, status: 'ready' }; }
      catch { /* Keep damaged primary bytes intact while seeking a displayable backup. */ }
    }
    let damaged = original !== null;
    for (const key of ['chartStudioDashboard:v1', 'businessMonitoringDashboard']) {
      const raw = storage.getItem(key);
      if (raw === null) continue;
      try { return { workspace: migrateBoard(JSON.parse(raw)), original, status: original === null ? 'migrate' : 'recovery_required' }; }
      catch { damaged = true; }
    }
    return { workspace: emptyWorkspace(), original, status: damaged ? 'recovery_required' : 'migrate' };
  } catch {
    return { workspace: emptyWorkspace(), original, status: 'recovery_required' };
  }
}

export function commitWorkspace(storage, expected, candidate) {
  if (storage.getItem(STORAGE_KEY) !== expected) throw new Error('Analytics changed in another tab. Export your draft, then reload before saving.');
  const normalized = normalizeWorkspace(candidate);
  const serialized = JSON.stringify(normalized);
  storage.setItem(STORAGE_KEY, serialized);
  return serialized;
}

export function checkpoint(record) {
  const { revisions, ...saved } = record;
  return [...(revisions || []).slice(-9), { savedAt: new Date().toISOString(), value: clone(saved) }];
}

export function copyDashboard(board, name, sourceReview = false) {
  const tileIds = new Map(board.items.map(tile => [tile.id, newId('dashboard-tile')]));
  const copy = clone(board);
  copy.state = { ...copy.state, id: newId('dashboard'), name };
  if (copy.state.analyticsFilters) {
    copy.state.analyticsFilters = copy.state.analyticsFilters.flatMap(filter => {
      if (!filter.tileIds?.length) return [filter];
      const remapped = filter.tileIds.map(id => tileIds.get(id)).filter(Boolean);
      return remapped.length ? [{ ...filter, tileIds: remapped }] : [];
    });
  }
  copy.items = copy.items.map(item => ({ ...item, id: tileIds.get(item.id),
    requiresSourceReview: sourceReview || item.requiresSourceReview }));
  copy.revisions = [];
  return copy;
}

export function importCollection(input, current) {
  const imported = normalizeWorkspace(input);
  // Import creates distinct objects, never overwrites existing work or executes queries.
  const dashboards = imported.dashboards.map(board => copyDashboard(board, `${board.state.name} (imported)`, true));
  const explorations = imported.explorations.map(analysis => ({ ...clone(analysis), id: newId('analysis'), name: `${analysis.name} (imported)`,
    requiresSourceReview: true, revisions: [] }));
  return { ...current, dashboards: [...current.dashboards, ...dashboards], explorations: [...current.explorations, ...explorations] };
}
