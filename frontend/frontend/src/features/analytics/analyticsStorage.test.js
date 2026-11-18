import { STORAGE_KEY, emptyWorkspace, loadAnalytics, commitWorkspace, importCollection } from './analyticsStorage';

beforeEach(() => localStorage.clear());
test('migration preserves layouts snapshots metadata and untouched backups', () => {
  const legacy = JSON.stringify({ state: { id: 'mine', name: 'Sales', filters: { dimensionFilters: [{ dimensionId: 'region', values: ['East'] }] } },
    items: [{ id: 'saved', itemType: 'chart', layout: { x: 6, y: 4, w: 6, h: 8 }, custom: 'keep',
      resultSnapshot: { schemaVersion: 'ai_chat_result_snapshot_v1', artifact: { value: 12 } }, sourceMetadata: { resultKey: 'stable' } }] });
  localStorage.setItem('chartStudioDashboard:v1', legacy);
  const loaded = loadAnalytics(localStorage);
  expect(loaded.status).toBe('migrate');
  commitWorkspace(localStorage, null, loaded.workspace);
  expect(localStorage.getItem('chartStudioDashboard:v1')).toBe(legacy);
  expect(loadAnalytics(localStorage).workspace.dashboards[0].items[0]).toMatchObject({ id: 'saved', custom: 'keep', layout: { x: 6 }, sourceMetadata: { resultKey: 'stable' } });
  expect(loadAnalytics(localStorage).workspace.dashboards).toHaveLength(1);
});
test('invalid primary storage remains protected even when an older backup is valid', () => {
  localStorage.setItem(STORAGE_KEY, '{broken');
  localStorage.setItem('businessMonitoringDashboard', JSON.stringify({ state: { name: 'Backup' }, items: [] }));
  const loaded = loadAnalytics(localStorage);
  expect(loaded.status).toBe('recovery_required');
  expect(loaded.workspace.dashboards[0].state.name).toBe('Backup');
  expect(localStorage.getItem(STORAGE_KEY)).toBe('{broken');
});
test('unknown schemas and duplicate identities require recovery', () => {
  const workspace = emptyWorkspace();
  workspace.schemaVersion = 99;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
  expect(loadAnalytics(localStorage).status).toBe('recovery_required');
  workspace.schemaVersion = 1;
  workspace.dashboards.push(workspace.dashboards[0]);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
  expect(loadAnalytics(localStorage).status).toBe('recovery_required');
});
test('read and write exceptions never erase a saved value', () => {
  expect(loadAnalytics({ getItem: () => { throw new Error('denied'); } }).status).toBe('recovery_required');
  const storage = { getItem: () => 'saved', setItem: () => { throw new Error('quota'); } };
  expect(() => commitWorkspace(storage, 'saved', emptyWorkspace())).toThrow('quota');
  expect(storage.getItem()).toBe('saved');
});
test('stale commits cannot overwrite another writer', () => {
  localStorage.setItem(STORAGE_KEY, 'other-tab');
  expect(() => commitWorkspace(localStorage, null, emptyWorkspace())).toThrow(/another tab/);
  expect(localStorage.getItem(STORAGE_KEY)).toBe('other-tab');
});
test('import makes independent IDs and requires source revalidation', () => {
  const source = emptyWorkspace();
  source.dashboards[0].items = [{ id: 'tile', itemType: 'chart' }];
  const imported = importCollection(source, emptyWorkspace());
  expect(imported.dashboards).toHaveLength(2);
  expect(imported.dashboards[1].state.id).not.toBe('dashboard-primary');
  expect(imported.dashboards[1].items[0]).toMatchObject({ requiresSourceReview: true });
  expect(source.dashboards[0].items[0].id).toBe('tile');
});
