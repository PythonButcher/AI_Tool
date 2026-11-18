import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WindowProvider, useWindowContext } from '../../context/WindowContext';
import AnalyticsShell from './AnalyticsShell';
import { STORAGE_KEY, emptyWorkspace } from './analyticsStorage';
import { defaultAnalysis, inlineIdentity } from './analyticsModel';

const mockRows = [{ sales: 12, region: 'East' }];
jest.mock('../../context/DataContext', () => ({
  DataContext: require('react').createContext({}),
  normalizeDatasetRows: value => value,
  useActiveDataset: () => mockRows,
  useSemanticModel: () => null,
}));
jest.mock('./AnalyticsResult', () => ({ result, config }) => <div data-testid="result">{result ? `${config.view}:${result.summary.value}` : 'No result'}</div>);
jest.mock('./AnalyticsDashboard', () => ({ board, onInvestigate }) => <div>{board.items.map(item => <button key={item.id} onClick={() => onInvestigate(item, [])}>Investigate {item.title}</button>)}</div>);

const source = { kind: 'inline', id: inlineIdentity(mockRows), name: 'Orders' };
const result = { rows: [{ value: 12 }], summary: { value: 12 }, row_count: 1, columns: ['value'], dataset: {}, executed_at: 'now' };
const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY));
let windowContext;
function Probe() { windowContext = useWindowContext(); return null; }
const mount = () => render(<WindowProvider><Probe /><AnalyticsShell /></WindowProvider>);
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

test('chart modes requiring a different query retain the last compatible visualization and refuse stale pins', async () => {
  mount(); fireEvent.click(screen.getByText('Run analysis')); await screen.findByText('bar:12');
  fireEvent.change(screen.getByLabelText('Visualization'), { target: { value: 'histogram' } });
  expect(screen.getByTestId('result')).toHaveTextContent('bar:12');
  expect(screen.getByText(/Builder changed/)).toBeInTheDocument();
  fireEvent.click(screen.getByText('Pin copy'));
  expect(screen.getByRole('alert')).toHaveTextContent('Run the current analysis');
  expect(stored().dashboards[0].items).toHaveLength(0);
});

test('navigation before autosave preserves independent drafts immediately', async () => {
  mount(); fireEvent.change(screen.getByLabelText('Analysis name'), { target: { value: 'Unfinished investigation' } });
  fireEvent.click(screen.getByText('New analysis'));
  expect(Object.values(stored().drafts).filter(Boolean).some(draft => draft.config.title === 'Unfinished investigation')).toBe(true);
  fireEvent.click(screen.getByText('Recover draft: Unfinished investigation'));
  expect(screen.getByLabelText('Analysis name')).toHaveValue('Unfinished investigation');
  await screen.findByRole('button', { name: 'Measure sales' });
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
  mount(); fireEvent.click(screen.getByText('Investigate Original'));
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
