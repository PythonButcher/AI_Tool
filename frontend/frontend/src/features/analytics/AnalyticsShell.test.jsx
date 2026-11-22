import React from 'react';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WindowProvider, useWindowContext } from '../../context/WindowContext';
import AnalyticsShell from './AnalyticsShell';
import { STORAGE_KEY, emptyWorkspace } from './analyticsStorage';
import { defaultAnalysis, inlineIdentity } from './analyticsModel';
import { WORKBENCH_LAYOUT_KEY, defaultWorkbenchLayout } from './analyticsWorkbenchLayout';

const mockRows = [{ sales: 12, region: 'East' }];
jest.mock('../../context/DataContext', () => ({
  DataContext: require('react').createContext({}),
  normalizeDatasetRows: value => value,
  useActiveDataset: () => mockRows,
  useSemanticModel: () => null,
}));
jest.mock('./AnalyticsResult', () => ({ result, config }) => <div data-testid="result">{result ? `${config.view}:${result.summary.value}` : 'No result'}</div>);
jest.mock('../charts/SmartChartWindow', () => () => null);
jest.mock('../dashboard/KpiCardWindow', () => () => null);

const source = { kind: 'inline', id: inlineIdentity(mockRows), name: 'Orders' };
const result = { rows: [{ value: 12 }], summary: { value: 12 }, row_count: 1, columns: ['value'], dataset: {}, executed_at: 'now' };
const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY));
let windowContext;
function Probe() { windowContext = useWindowContext(); return null; }
const mount = (props = {}) => render(<WindowProvider><Probe /><AnalyticsShell {...props} /></WindowProvider>);
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  window.confirm = jest.fn(() => true);
  const workspace = emptyWorkspace(); workspace.lastView = 'explore';
  workspace.drafts.current = { config: defaultAnalysis(source) };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
  global.fetch = jest.fn(async (url, options) => ({ ok: true, json: async () => !options?.body ? [] : JSON.parse(options.body).metadata_only
    ? { fields: [{ name: 'sales', type: 'number' }, { name: 'region', type: 'string' }], metrics: [] } : result }));
});
afterEach(() => jest.restoreAllMocks());

test('run, save, pin and reopen use one persisted query result', async () => {
  const view = mount();
  fireEvent.change(screen.getByLabelText('Analysis name'), { target: { value: 'Revenue' } });
  fireEvent.click(screen.getByText('Run analysis'));
  await screen.findByText('bar:12');
  fireEvent.click(screen.getByText('Save analysis'));
  expect(stored().explorations[0].result.summary.value).toBe(12);
  fireEvent.click(screen.getByText('Pin copy'));
  expect(stored().dashboards[0].items[0].analysis.title).toBe('Revenue');
  view.unmount(); mount();
  expect(screen.getByLabelText('Analysis name')).toHaveValue('Revenue');
  expect(screen.getByTestId('result')).toHaveTextContent('bar:12');
});

test('the workbench arranges, locks, and restores panels independently of the analysis', async () => {
  jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1440);
  const view = mount();
  fireEvent.change(screen.getByLabelText('Analysis name'), { target: { value: 'Revenue' } });
  fireEvent.click(screen.getByRole('button', { name: 'Run analysis' }));
  const result = await screen.findByText('bar:12');
  const saved = () => JSON.parse(localStorage.getItem(WORKBENCH_LAYOUT_KEY));
  fireEvent.click(screen.getByRole('button', { name: 'Edit layout' }));
  const results = screen.getByRole('button', { name: 'Move or resize Results' });
  fireEvent.keyDown(results, { key: 'ArrowLeft' });
  expect(saved()).toBeNull();
  fireEvent.keyDown(results, { key: 'ArrowLeft', shiftKey: true });
  fireEvent.keyDown(results, { key: 'ArrowDown' });
  fireEvent.click(screen.getByRole('button', { name: 'Lock Results layout' }));
  expect(saved().find(panel => panel.i === 'results')).toMatchObject({ x: 10, y: 1, w: 13, locked: true });
  expect(screen.queryByRole('button', { name: 'Move or resize Results' })).not.toBeInTheDocument();
  expect(screen.getByText('bar:12')).toBe(result);
  expect(screen.getByLabelText('Analysis name')).toHaveValue('Revenue');
  view.unmount();
  mount();
  expect(screen.getByRole('img', { name: 'Results layout locked' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Edit layout' }));
  fireEvent.click(screen.getByRole('button', { name: 'Unlock Results layout' }));
  expect(screen.getByRole('button', { name: 'Move or resize Results' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Reset layout' }));
  expect(saved()).toEqual(defaultWorkbenchLayout());
});

test('chart modes requiring a different query retain the last compatible visualization and refuse stale pins', async () => {
  mount(); fireEvent.click(screen.getByText('Run analysis')); await screen.findByText('bar:12');
  fireEvent.click(screen.getByRole('button', { name: /^Change visual/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Histogram' }));
  expect(screen.getByTestId('result')).toHaveTextContent('bar:12');
  expect(screen.getByText(/Builder changed/)).toBeInTheDocument();
  fireEvent.click(screen.getByText('Pin copy'));
  expect(screen.getByRole('alert')).toHaveTextContent('Run the current analysis');
  expect(stored().dashboards[0].items).toHaveLength(0);
});

test('adding a dashboard chart guides drag and click assignment and keeps measure controls collapsed', async () => {
  const workspace = stored();
  workspace.lastView = 'dashboards';
  workspace.dashboards[0].items = [{ id: 'note', title: 'Notes', itemType: 'text', text: 'Context', layout: { x: 0, y: 0, w: 4, h: 4 } }];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
  mount();
  const canvas = within(screen.getByLabelText('Dashboard canvas actions'));
  fireEvent.click(canvas.getByText('Add tile'));
  fireEvent.click(canvas.getByRole('button', { name: 'Chart' }));
  const region = await screen.findByRole('button', { name: 'Select field region' });
  const category = screen.getByRole('region', { name: 'Category axis' });
  const values = within(screen.getByRole('region', { name: 'Values' }));

  const mime = new Map();
  const dataTransfer = { setData: (type, data) => mime.set(type, data), getData: type => mime.get(type) || '' };
  fireEvent.dragStart(region, { dataTransfer });
  expect(category).toHaveAttribute('data-drop-state', 'ready');
  fireEvent.dragOver(category, { dataTransfer });
  expect(category).toHaveAttribute('data-drop-state', 'over');
  expect(within(category).getByRole('button', { name: 'Drop region' })).toBeVisible();
  fireEvent.drop(category, { dataTransfer });
  expect(category).toHaveAttribute('data-drop-state', 'idle');
  expect(within(category).getByText('region')).toBeVisible();

  fireEvent.click(screen.getByRole('button', { name: 'Select field sales' }));
  fireEvent.click(values.getByRole('button', { name: 'Replace with sales' }));
  expect(values.queryByLabelText('Measure 1 aggregation')).not.toBeInTheDocument();
  fireEvent.click(values.getByRole('button', { name: 'Configure measure sales' }));
  fireEvent.change(values.getByLabelText('Measure 1 aggregation'), { target: { value: 'avg' } });
  fireEvent.click(screen.getByRole('button', { name: 'Run analysis' }));
  await screen.findByText('bar:12');
  const calls = fetch.mock.calls.filter(([, options]) => options?.body && !JSON.parse(options.body).metadata_only);
  expect(JSON.parse(calls.pop()[1].body).query).toMatchObject({
    group_by: [{ field: 'region' }],
    measures: [{ id: 'value', label: 'sales', field: 'sales', aggregation: 'avg' }],
  });
});

test('Scatter exposes two numeric targets and rejects duplicate and categorical assignments', async () => {
  mount();
  const region = await screen.findByRole('button', { name: 'Select field region' });
  fireEvent.click(screen.getByRole('button', { name: /^Change visual/ }));
  expect(within(screen.getByLabelText('Visual gallery')).getAllByRole('button', { pressed: false })).toHaveLength(14);
  fireEvent.click(screen.getByRole('button', { name: 'Scatter' }));
  const x = screen.getByRole('region', { name: 'X axis' });
  const y = screen.getByRole('region', { name: 'Y axis' });
  fireEvent.click(region);
  expect(x).toHaveAttribute('data-drop-state', 'blocked');
  expect(y).toHaveAttribute('data-drop-state', 'blocked');
  const sales = screen.getByRole('button', { name: 'Select field sales' });
  fireEvent.click(sales);
  fireEvent.click(within(x).getByRole('button', { name: 'Add sales' }));
  fireEvent.click(sales);
  expect(y).toHaveAttribute('data-drop-state', 'blocked');
  fireEvent.click(screen.getByRole('button', { name: 'Run analysis' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('two different numeric fields'));
});

test('navigation before autosave preserves independent drafts immediately', async () => {
  mount(); fireEvent.change(screen.getByLabelText('Analysis name'), { target: { value: 'Unfinished investigation' } });
  fireEvent.click(screen.getByLabelText(/Workspace switcher/));
  fireEvent.click(screen.getByText('New analysis'));
  expect(Object.values(stored().drafts).filter(Boolean).some(draft => draft.config.title === 'Unfinished investigation')).toBe(true);
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Analytics tools' })).getByRole('button', { name: 'Library' }));
  fireEvent.click(screen.getByText('Recover draft: Unfinished investigation'));
  expect(screen.getByLabelText('Analysis name')).toHaveValue('Unfinished investigation');
  expect(Object.keys(stored().drafts)).toEqual(['current']);
  await screen.findByRole('button', { name: 'Select field sales' });
});

test('late query responses cannot overwrite an edited draft', async () => {
  let resolve;
  fetch.mockImplementation(async (_url, options) => {
    if (!options?.body) return { ok: true, json: async () => [] };
    if (JSON.parse(options.body).metadata_only) return { ok: true, json: async () => ({ fields: [], metrics: [] }) };
    return new Promise(done => { resolve = done; });
  });
  mount(); fireEvent.click(screen.getByText('Run analysis'));
  fireEvent.change(screen.getByLabelText('Analysis name'), { target: { value: 'Changed' } });
  await act(async () => resolve({ ok: true, json: async () => result }));
  expect(screen.getByTestId('result')).toHaveTextContent('No result');
  expect(screen.getByLabelText('Analysis name')).toHaveValue('Changed');
});

test('imported analysis cannot run until its source is explicitly confirmed', async () => {
  const workspace = stored();
  workspace.drafts.current.config.requiresSourceReview = true;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
  mount(); fireEvent.click(screen.getByText('Run analysis'));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('confirm the imported dataset'));
  expect(fetch.mock.calls.filter(([, options]) => options?.body && !JSON.parse(options.body).metadata_only)).toHaveLength(0);
  fireEvent.click(screen.getByText('Confirm imported dataset'));
  fireEvent.click(screen.getByText('Run analysis')); await screen.findByText('bar:12');
});

test('investigation does not mutate its origin until explicit update and conflicts are rejected', async () => {
  const workspace = stored(); workspace.lastView = 'dashboards'; workspace.drafts = {};
  workspace.dashboards[0].items = [{ id: 'tile', title: 'Original', itemType: 'chart', analysis: { ...defaultAnalysis(source), title: 'Original' }, result, layout: { x: 6, y: 3, w: 6, h: 7 } }];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
  mount(); fireEvent.click(screen.getByRole('button', { name: 'Investigate' }));
  fireEvent.change(screen.getByLabelText('Analysis name'), { target: { value: 'Investigation' } });
  expect(stored().dashboards[0].items[0].title).toBe('Original');
  fireEvent.click(screen.getByText('Run analysis')); await screen.findByText('bar:12');
  await waitFor(() => expect(screen.getByText('Run analysis')).toBeEnabled());
  fireEvent.click(screen.getByText('Update original'));
  expect(stored().dashboards[0].items[0]).toMatchObject({ title: 'Investigation', layout: { x: 6, y: 3 } });
  act(() => windowContext.updateDashboardItem('tile', { title: 'Concurrent edit' }));
  fireEvent.click(screen.getByText('Update original'));
  expect(screen.getByRole('alert')).toHaveTextContent('original tile changed');
});

test('empty dashboard generates real overview tiles from the dashboard dataset and can undo as one edit', async () => {
  const workspace = stored();
  workspace.lastView = 'dashboards';
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
  fetch.mockImplementation(async (_url, options) => ({ ok: true, json: async () => !options?.body ? [{ id: 'sales-data', name: 'Sales data' }]
    : JSON.parse(options.body).metadata_only ? { fields: [
      { name: 'sales', type: 'number' }, { name: 'region', type: 'string' }, { name: 'order_date', type: 'date' },
    ] } : result }));
  mount();
  expect(screen.queryByLabelText('Dashboard canvas actions')).not.toBeInTheDocument();
  await screen.findByRole('option', { name: 'Sales data' });
  fireEvent.change(screen.getByLabelText('Analytics dataset'), { target: { value: 'datahub:sales-data' } });
  const generate = screen.getByRole('button', { name: /Generate overview/ });
  await waitFor(() => expect(generate).toBeEnabled());
  fireEvent.click(generate);

  const items = stored().dashboards[0].items;
  expect(items.map(item => item.analysis.view)).toEqual(['kpi', 'kpi', 'kpi', 'line', 'horizontal']);
  expect(items.every(item => item.analysis.source.id === 'sales-data')).toBe(true);
  expect(items[3].analysis.query.group_by).toEqual([{ field: 'order_date', grain: 'month' }]);
  expect(items[4].analysis.query.group_by).toEqual([{ field: 'region' }]);
  expect(stored().drafts.current.config.source.id).toBe(source.id);
  await screen.findByLabelText('Dashboard canvas actions');
  await waitFor(() => expect(fetch.mock.calls.filter(([, options]) => options?.body && !JSON.parse(options.body).metadata_only)).toHaveLength(5));
  fireEvent.click(screen.getByRole('button', { name: 'History' }));
  fireEvent.click(screen.getByRole('button', { name: /^Undo/ }));
  expect(stored().dashboards[0].items).toHaveLength(0);
});

test('dashboard filters scope both segment populations and leave unrelated datasets alone', async () => {
  const workspace = stored();
  workspace.lastView = 'dashboards';
  const alternate = { id: source.id, kind: 'datahub', name: 'Another dataset' };
  const baseline = { field: 'region', value: 'West' };
  const sourceConfig = defaultAnalysis(source);
  workspace.dashboards[0].items = [source, alternate].map((tileSource, index) => ({
    id: `tile-${index}`, title: tileSource.name, itemType: 'chart',
    analysis: { ...sourceConfig, source: tileSource, query: { ...sourceConfig.query, comparison: { kind: 'segment', filters: [baseline] } } },
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
  mount();
  const requests = () => fetch.mock.calls.flatMap(([, options]) => options?.body ? [JSON.parse(options.body)] : []).filter(request => !request.metadata_only);
  await waitFor(() => expect(requests()).toHaveLength(2));
  fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
  await screen.findByRole('option', { name: 'region' });
  fireEvent.change(screen.getByLabelText('Filter field'), { target: { value: 'region' } });
  fireEvent.change(screen.getByLabelText('Dashboard filter value'), { target: { value: 'East' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply filter' }));

  await waitFor(() => expect(requests()).toHaveLength(3));
  const [filtered] = requests().slice(-1);
  expect(filtered.source.kind).toBe('inline');
  const rule = { field: 'region', operator: 'eq', value: 'East' };
  expect(filtered.query.filters.rules).toContainEqual(rule);
  expect(filtered.query.comparison.filters.rules).toEqual([[baseline], rule]);
});

test('exit focus works by button and Escape and restores tools without remounting the analysis', async () => {
  mount();
  const title = screen.getByLabelText('Analysis name');
  fireEvent.change(title, { target: { value: 'Focus draft' } });
  fireEvent.click(screen.getByRole('button', { name: 'Run analysis' }));
  await screen.findByText('bar:12');

  const toolRail = () => screen.queryByRole('navigation', { name: 'Analytics tools' });
  fireEvent.click(within(toolRail()).getByRole('button', { name: 'Format' }));
  fireEvent.click(screen.getByRole('button', { name: 'Focus' }));
  const exit = screen.getByRole('button', { name: 'Exit focus' });
  expect(exit).toHaveFocus();
  expect(toolRail()).not.toBeInTheDocument();
  expect(screen.queryByRole('complementary', { name: 'Analytics Format' })).not.toBeInTheDocument();

  fireEvent.click(exit);
  expect(screen.getByRole('button', { name: 'Focus' })).toHaveFocus();
  expect(screen.getByRole('complementary', { name: 'Analytics Format' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Focus' }));
  fireEvent.keyDown(screen.getByRole('button', { name: 'Exit focus' }), { key: 'Escape' });
  expect(toolRail()).toBeVisible();
  expect(screen.getByLabelText('Analysis name')).toBe(title);
  expect(title).toHaveValue('Focus draft');
  expect(screen.getByTestId('result')).toHaveTextContent('bar:12');
});

test('named tool panels expose exports, chart tools, and history from the dashboard', async () => {
  const workspace = stored();
  workspace.lastView = 'dashboards';
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
  const onOpenGallery = jest.fn();
  mount({ onOpenGallery });
  const toolRail = within(screen.getByRole('navigation', { name: 'Analytics tools' }));
  for (const [tool, action] of [
    ['Library', 'Import workspace JSON'], ['Reports', 'Export report PDF'],
    ['AI & Charts', 'Chart gallery'], ['History', 'Undo'],
  ]) {
    fireEvent.click(toolRail.getByRole('button', { name: tool }));
    const panel = screen.getByRole('complementary', { name: new RegExp(`^Analytics ${tool}$`, 'i') });
    expect(within(panel).getByRole('button', { name: new RegExp(action) })).toBeVisible();
    if (tool === 'AI & Charts') fireEvent.click(within(panel).getByRole('button', { name: /Chart gallery/ }));
  }
  expect(onOpenGallery).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button', { name: 'Commands' })).not.toBeInTheDocument();
  const toolsButton = toolRail.getByRole('button', { name: 'Tools' });
  fireEvent.click(toolsButton);
  const directory = screen.getByRole('complementary', { name: 'Analytics tool drawer' });
  fireEvent.click(within(directory).getByRole('button', { name: /^Actions/ }));
  const actions = screen.getByRole('complementary', { name: 'Analytics Actions' });
  expect(within(actions).getByRole('button', { name: 'Add notes' })).toBeVisible();
  fireEvent.keyDown(within(actions).getByRole('button', { name: 'Close tools' }), { key: 'Escape' });
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  expect(toolRail.getByRole('button', { name: 'Actions' })).toHaveFocus();
});

test('Change Explorer keeps its result across drawer sections and opens an exact segment comparison', async () => {
  const changeValue = { baseline_value: 20, current_value: 60, delta: 40, baseline_count: 2, current_count: 3, volume_effect: 15, rate_effect: 25 };
  const changeResult = { schema_version: 1, dataset: { scope: 'full' }, totals: changeValue, segment_count: 1,
    drivers: [{ ...changeValue, kind: 'segment', segment: 'East' }] };
  fetch.mockImplementation(async (url, options) => ({ ok: true, json: async () => {
    if (!options?.body) return [];
    if (url.endsWith('/change-explorer')) return changeResult;
    if (JSON.parse(options.body).metadata_only) return { fields: [
      { name: 'date', type: 'date' }, { name: 'sales', type: 'number' }, { name: 'region', type: 'string' },
    ] };
    return result;
  } }));
  mount();
  const tools = within(screen.getByRole('navigation', { name: 'Analytics tools' }));
  fireEvent.click(tools.getByRole('button', { name: 'Change Explorer' }));
  const drawer = within(screen.getByRole('complementary', { name: 'Analytics Change Explorer' }));
  await drawer.findByRole('option', { name: 'date' });
  fireEvent.change(drawer.getByLabelText('Metric'), { target: { value: 'sum' } });
  fireEvent.change(drawer.getByLabelText('Numeric field'), { target: { value: 'sales' } });
  for (const [label, day] of [
    ['Baseline start', '2026-01-01'], ['Baseline end', '2026-01-02'],
    ['Current start', '2026-02-01'], ['Current end', '2026-02-02'],
  ]) fireEvent.change(drawer.getByLabelText(label), { target: { value: day } });
  fireEvent.click(drawer.getByRole('button', { name: 'Explain change' }));
  await drawer.findByText('Contribution by segment');
  const changeRequest = fetch.mock.calls.find(([url]) => url.endsWith('/change-explorer'))[1];
  expect(JSON.parse(changeRequest.body)).toMatchObject({
    source, dataset: mockRows, date_field: 'date', segment_field: 'region', metric: { aggregation: 'sum', field: 'sales' },
    baseline: { start: '2026-01-01', end: '2026-01-02' }, current: { start: '2026-02-01', end: '2026-02-02' },
  });

  fireEvent.click(tools.getByRole('button', { name: 'Reports' }));
  fireEvent.click(tools.getByRole('button', { name: 'Change Explorer' }));
  fireEvent.click(drawer.getByRole('button', { name: 'Open segment in Analysis' }));
  expect(screen.getByLabelText('Analysis name')).toHaveValue('Change Explorer · East');
  fireEvent.click(screen.getByRole('button', { name: 'Run analysis' }));
  await screen.findByText('line:12');
  const queryRequest = fetch.mock.calls.filter(([url, options]) => url.endsWith('/query') && !JSON.parse(options.body).metadata_only).pop()[1];
  expect(JSON.parse(queryRequest.body).query).toMatchObject({
    filters: [{ field: 'region', operator: 'eq', type: 'segment', value: 'East' }],
    period: { field: 'date', start: '2026-02-01', end: '2026-02-02' },
    comparison: { kind: 'custom', start: '2026-01-01', end: '2026-01-02' },
  });
  fireEvent.click(within(screen.getByRole('region', { name: 'Query options' })).getByRole('button', { name: /^Filters/ }));
  fireEvent.change(screen.getByLabelText('Filter 1 operator'), { target: { value: 'contains' } });
  fireEvent.click(screen.getByRole('button', { name: 'Run analysis' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Run analysis' })).toBeEnabled());
  const edited = fetch.mock.calls.filter(([url, options]) => url.endsWith('/query') && !JSON.parse(options.body).metadata_only).pop()[1];
  expect(JSON.parse(edited.body).query.filters.rules).toEqual([{ field: 'region', operator: 'contains', value: 'East' }]);
});
