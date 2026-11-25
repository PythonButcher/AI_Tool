import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import App from './App';
import { DataProvider } from './context/DataContext';
import { WindowProvider } from './context/WindowContext';
import { STORAGE_KEY, emptyWorkspace } from './features/analytics/analyticsStorage';
import { defaultAnalysis } from './features/analytics/analyticsModel';

jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('./features/whiteboard/WhiteBoard', () => () => null);
jest.mock('./features/data-model/SourceModelCanvas', () => ({ workspaceId }) => workspaceId || null);

const originalFetch = global.fetch;

beforeEach(() => {
  localStorage.clear();
  jest.resetAllMocks();
  axios.get.mockResolvedValue({ data: { data_info: 'Data overview' } });
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(() => { global.fetch = originalFetch; });

function renderApp(address = '/?app=devstream') {
  window.history.replaceState(null, '', address);
  return render(
    <DataProvider>
      <WindowProvider>
        <App />
      </WindowProvider>
    </DataProvider>
  );
}

async function traverseBrowser(direction) {
  await act(async () => {
    const navigated = new Promise(resolve => window.addEventListener('popstate', resolve, { once: true }));
    window.history[direction]();
    await navigated;
  });
}

test('the default hub opens Devstream with the keyboard and preserves its destination across navigation', async () => {
  renderApp('/?source=example#notes');

  const launch = screen.getByRole('link', { name: 'Open Devstream' });
  expect(screen.getByRole('heading', { name: 'Datastream' })).toBeVisible();
  expect(document.title).toBe('Datastream');
  expect(screen.queryByRole('banner', { name: 'Devstream' })).not.toBeInTheDocument();
  expect(axios.get).not.toHaveBeenCalled();
  expect(new URL(launch.href).searchParams.get('source')).toBe('example');
  expect(new URL(launch.href).hash).toBe('#notes');

  for (let step = 0; step < 20 && document.activeElement !== launch; step += 1) {
    userEvent.tab();
  }
  expect(launch).toHaveFocus();
  act(() => { userEvent.keyboard('{Enter}'); });
  expect(window.location.search).toBe('?source=example&app=devstream');
  expect(document.title).toBe('Devstream | Datastream');
  expect(screen.getByRole('main')).toHaveFocus();
  expect(screen.getByRole('button', { name: 'Devstream home' })).toBeVisible();
  const navigation = within(screen.getByRole('navigation', { name: 'Main navigation' }));
  expect(navigation.getByRole('button', { name: 'Workspace' })).toHaveAttribute('aria-current', 'page');
  fireEvent.click(navigation.getByRole('button', { name: 'Data Tools' }));

  await traverseBrowser('back');
  expect(screen.getByRole('heading', { name: 'Datastream' })).toHaveFocus();
  expect(screen.queryByRole('navigation', { name: 'Main navigation' })).not.toBeInTheDocument();

  await traverseBrowser('forward');
  expect(navigation.getByRole('button', { name: 'Data Tools' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('region', { name: 'Data Tools' })).toBeVisible();

  fireEvent.click(screen.getByRole('link', { name: 'Datastream hub' }));
  expect(window.location.search).toBe('?source=example');
  expect(window.location.hash).toBe('#notes');
  expect(screen.getByRole('heading', { name: 'Datastream' })).toHaveFocus();
  fireEvent.click(screen.getByRole('link', { name: 'Open Devstream' }));
  expect(navigation.getByRole('button', { name: 'Data Tools' })).toHaveAttribute('aria-current', 'page');
});

test('legacy workspace bookmarks open Devstream and the hub provides the current launch address', () => {
  renderApp('/?app=datastream&source=example#notes');

  expect(screen.getByRole('banner', { name: 'Devstream' })).toBeVisible();
  expect(document.title).toBe('Devstream | Datastream');
  fireEvent.click(screen.getByRole('link', { name: 'Datastream hub' }));

  expect(window.location.search).toBe('?source=example');
  expect(window.location.hash).toBe('#notes');
  expect(screen.getByRole('link', { name: 'Open Devstream' })).toHaveAttribute(
    'href', new URL('/?source=example&app=devstream#notes', window.location.origin).href
  );
});

test('the hub does not handle keyboard shortcuts from retained Analytics', () => {
  renderApp();
  fireEvent.click(screen.getByRole('button', { name: 'Analytics', exact: true }));
  const analytics = screen.getByRole('region', { name: 'Analytics workspace' });
  expect(fireEvent.keyDown(analytics, { key: 'z', ctrlKey: true })).toBe(false);

  fireEvent.click(screen.getByRole('link', { name: 'Datastream hub' }));
  expect(fireEvent.keyDown(screen.getByRole('main'), { key: 'z', ctrlKey: true })).toBe(true);
});

test('a workspace dialog stays off the hub and keeps its unsaved draft on browser forward', async () => {
  const rows = [{ Customer: 'customer-42' }];
  axios.post.mockResolvedValue({ data: {
    data_preview: rows,
    full_data: rows,
    source: { source_id: 'orders-source' },
    semantic_model: { dimensions: [], metrics: [] },
    workspace: { workspace_id: 'orders-workspace', primary_source_id: 'orders-source', version: 1, sources: [{ source_id: 'orders-source' }] },
    analysis_context: { workspace_id: 'orders-workspace' },
  } });
  const { container } = renderApp('/');
  fireEvent.click(screen.getByRole('link', { name: 'Open Devstream' }));
  fireEvent.click(within(screen.getByRole('banner', { name: 'Devstream' })).getByRole('button', { name: 'Upload data' }));
  const file = new File(['Customer\ncustomer-42\n'], 'orders.csv', { type: 'text/csv' });
  fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file] } });
  fireEvent.click(screen.getByRole('button', { name: 'Complete Import' }));
  const workspace = within(await screen.findByRole('region', { name: 'Workspace' }));
  fireEvent.click(await workspace.findByRole('button', { name: 'Save Dataset' }));

  const dialog = screen.getByRole('dialog', { name: 'Save Dataset' });
  const name = within(dialog).getByRole('textbox', { name: 'Dataset name' });
  name.focus();
  fireEvent.change(name, { target: { value: 'Unsaved orders draft' } });

  await traverseBrowser('back');
  expect(screen.getByRole('heading', { name: 'Datastream' })).toHaveFocus();
  expect(dialog).not.toBeVisible();

  await traverseBrowser('forward');
  expect(dialog).toBeVisible();
  expect(name).toHaveFocus();
  expect(name).toHaveValue('Unsaved orders draft');
});

test('opens file import and Data Hub from an empty Workspace', async () => {
  axios.get.mockResolvedValue({ data: { datasets: [] } });
  renderApp();

  const canvas = within(screen.getByRole('main'));
  fireEvent.click(canvas.getByRole('button', { name: 'Upload data' }));
  expect(screen.getByRole('button', { name: 'Browse Files' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Back to Sources' }));
  expect(screen.getByRole('button', { name: /Local File/ })).toBeVisible();

  fireEvent.click(canvas.getByRole('button', { name: 'Open from Data Hub' }));
  expect(await screen.findByText('No saved datasets yet')).toBeVisible();
  expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/\/api\/datahub\/datasets$/), { signal: expect.anything() });

  const banner = within(screen.getByRole('banner', { name: 'Devstream' }));
  fireEvent.click(banner.getByRole('button', { name: 'Upload data' }));
  expect(screen.getByRole('button', { name: 'Browse Files' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Browse saved datasets' }));
  expect(screen.getByRole('heading', { name: 'Data Hub', level: 1 })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Browse Files' })).not.toBeInTheDocument();
  fireEvent.click(banner.getByRole('button', { name: 'Data Hub' }));
  expect(screen.getByRole('searchbox', { name: 'Search datasets' })).toBeVisible();
});

test('an upload attaches its dataset and enables Data Preview', async () => {
  axios.post.mockResolvedValue({ data: {
    source: { source_id: 'orders-source' },
    data_preview: [{ Customer: 'customer-42' }],
    full_data: [{ Customer: 'customer-42' }],
    semantic_model: { dimensions: [], metrics: [] },
    workspace: { workspace_id: 'orders-workspace', sources: [] },
    analysis_context: { workspace_id: 'orders-workspace' },
  } });
  const { container } = renderApp();
  const banner = within(screen.getByRole('banner', { name: 'Devstream' }));
  fireEvent.click(banner.getByRole('button', { name: 'Upload data' }));
  expect(banner.getByRole('button', { name: 'Data Preview' })).toBeDisabled();
  const file = new File(['Customer\ncustomer-42\n'], 'orders.csv', { type: 'text/csv' });
  fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file] } });
  fireEvent.click(screen.getByRole('button', { name: 'Complete Import' }));
  const workspace = within(screen.getByRole('region', { name: 'Workspace' }));
  expect(await workspace.findByRole('heading', { name: 'orders.csv', level: 1 })).toBeVisible();
  expect(workspace.getByRole('heading', { name: 'Deterministic dataset summary', level: 2 })).toBeVisible();
  expect(within(workspace.getByRole('table', { name: 'Deterministic field summary' })).getByText('Customer')).toBeVisible();
  expect(screen.queryByText('customer-42')).not.toBeInTheDocument();
  expect(axios.post.mock.calls[0][1].get('file')).toEqual(file);
  expect(banner.getByRole('button', { name: 'Data Preview' })).toBeEnabled();
  expect(workspace.getByRole('button', { name: 'Browse data tools' })).toBeVisible();
  fireEvent.click(banner.getByRole('button', { name: 'Data Preview' }));
  expect(screen.getByText('customer-42')).toBeVisible();
  fireEvent.click(screen.getByTitle('Minimize'));
  await waitFor(() => expect(screen.queryByText('customer-42')).not.toBeInTheDocument());
  expect(workspace.getByRole('heading', { name: 'Deterministic dataset summary', level: 2 })).toBeVisible();
});

test('upload and Refine stay out of Data Hub until Save Dataset, then the full edited rows reopen', async () => {
  const initialRows = Array.from({ length: 132 }, (_, index) => ({ Order: `order-${index}` }));
  const envelope = (id, rows) => ({
    data_preview: rows.slice(0, 5), full_data: rows, source: { source_id: id, name: 'orders.csv' },
    workspace: { workspace_id: `ws-${id}`, primary_source_id: id, version: 1, sources: [{ source_id: id }] },
    analysis_context: { workspace_id: `ws-${id}`, workspace_version: 1, primary_source_id: id, source_ids: [id], relationship_ids: [] },
    semantic_model: { dimensions: [], metrics: [] },
  });
  const original = envelope('uploaded', initialRows);
  const refined = envelope('refined', initialRows.slice(1));
  let entry;
  let finishRefine;
  axios.get.mockImplementation(async () => ({ data: { datasets: entry ? [entry] : [] } }));
  axios.post.mockImplementation(async (url, payload) => {
    if (url.endsWith('/api/upload')) return { data: original };
    if (url.endsWith('/api/numbers')) return { data: { data_info: 'Data overview' } };
    if (url.endsWith('/refine-working')) return new Promise(resolve => { finishRefine = resolve; });
    if (url.endsWith('/saved-datasets')) {
      entry = { dataset_id: 'saved-orders', name: payload.name, revision: (entry?.revision || 0) + 1, kind: 'refined' };
      return { data: { dataset: entry } };
    }
    if (url.endsWith('/saved-orders/open')) return { data: { dataset: entry, ...refined } };
    throw new Error(url);
  });
  const { container, unmount } = renderApp();
  const banner = within(screen.getByRole('banner', { name: 'Devstream' }));
  const navigation = within(screen.getByRole('navigation', { name: 'Main navigation' }));
  fireEvent.click(navigation.getByRole('button', { name: 'Data Hub' }));
  expect(await screen.findByText('No saved datasets yet')).toBeVisible();
  fireEvent.click(banner.getByRole('button', { name: 'Upload data' }));
  const file = new File(['Order\norder-0\n'], 'orders.csv', { type: 'text/csv' });
  fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file] } });
  fireEvent.click(screen.getByRole('button', { name: 'Complete Import' }));
  expect(await within(await screen.findByRole('region', { name: 'Workspace' })).findByRole('heading', { name: 'orders.csv', level: 1 })).toBeVisible();
  expect(screen.queryByText('order-0')).not.toBeInTheDocument();
  expect(navigation.getByRole('button', { name: 'Workspace' })).toHaveAttribute('aria-current', 'page');
  expect(banner.getByRole('button', { name: 'Save Dataset' })).toBeVisible();
  fireEvent.click(navigation.getByRole('button', { name: 'Data Hub' }));
  expect(await screen.findByText('No saved datasets yet')).toBeVisible();
  fireEvent.click(navigation.getByRole('button', { name: 'Workspace' }));

  fireEvent.click(navigation.getByRole('button', { name: 'Data Tools' }));
  const tools = within(screen.getByRole('region', { name: 'Data Tools' }));
  expect(tools.getByText('orders.csv')).toBeVisible();
  expect(tools.getByText('132')).toBeVisible();
  expect(within(tools.getByRole('table', { name: 'Working rows' })).getByText('order-0')).toBeVisible();
  fireEvent.click(tools.getByRole('button', { name: 'Filter rows' }));
  fireEvent.change(tools.getByRole('textbox', { name: 'Value' }), { target: { value: 'order-131' } });
  fireEvent.click(tools.getByRole('button', { name: 'Apply preview filter' }));
  expect(within(tools.getByRole('table', { name: 'Matching rows' })).getByText('order-131')).toBeVisible();
  fireEvent.click(navigation.getByRole('button', { name: 'Workspace' }));
  fireEvent.click(within(screen.getByRole('region', { name: 'Workspace' })).getByRole('button', { name: 'Refine data' }));
  const editor = within(screen.getByRole('region', { name: 'Power Query Editor' }));
  expect(screen.queryByRole('dialog', { name: 'Power Query Editor' })).not.toBeInTheDocument();
  const sourcePreview = within(editor.getByRole('table', { name: 'Current data' }));
  expect(sourcePreview.getByRole('columnheader', { name: 'Order' })).toBeVisible();
  expect(sourcePreview.getByText('order-0')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Missing & Rows' }));
  fireEvent.click(screen.getByRole('button', { name: 'Remove Top' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add Step' }));
  fireEvent.click(screen.getByRole('button', { name: 'Apply All' }));
  expect(screen.getByRole('button', { name: 'Save Dataset' })).toBeDisabled();
  await act(async () => finishRefine({ data: refined }));
  expect(await screen.findByText(/Refine changes applied/)).toBeVisible();
  expect(navigation.getByRole('button', { name: 'Data Tools' })).toHaveAttribute('aria-current', 'page');
  expect(await screen.findByText('order-1')).toBeVisible();
  expect(screen.queryByText('order-0')).not.toBeInTheDocument();
  expect(axios.post).toHaveBeenCalledWith(expect.stringMatching(/refine-working$/), expect.objectContaining({
    source_id: 'uploaded', steps: [{ type: 'remove_top_rows', params: { count: 1 } }],
  }), expect.any(Object));
  fireEvent.click(navigation.getByRole('button', { name: 'Data Hub' }));
  expect(await screen.findByText('No saved datasets yet')).toBeVisible();
  fireEvent.click(navigation.getByRole('button', { name: 'Data Tools' }));

  fireEvent.click(within(screen.getByRole('region', { name: 'Data Tools' })).getByRole('button', { name: 'Save Dataset' }));
  const dialog = within(screen.getByRole('dialog', { name: 'Save Dataset' }));
  fireEvent.change(dialog.getByRole('textbox', { name: 'Dataset name' }), { target: { value: 'Refined orders' } });
  fireEvent.click(dialog.getByRole('button', { name: 'Save to Data Hub' }));
  expect(await screen.findByText(/Saved “Refined orders” to Data Hub/)).toBeVisible();
  expect(axios.post).toHaveBeenCalledWith(expect.stringMatching(/saved-datasets$/), expect.objectContaining({
    workspace_id: 'ws-refined', source_id: 'refined', kind: 'current', name: 'Refined orders',
  }), expect.any(Object));

  unmount();
  renderApp();
  const reopenedBanner = within(screen.getByRole('banner', { name: 'Devstream' }));
  fireEvent.click(reopenedBanner.getByRole('button', { name: 'Data Hub' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Open dataset' }));
  expect(await within(await screen.findByRole('region', { name: 'Workspace' })).findByRole('heading', { name: 'Refined orders', level: 1 })).toBeVisible();
  expect(screen.queryByText('order-1')).not.toBeInTheDocument();
  fireEvent.click(within(screen.getByRole('region', { name: 'Workspace' })).getByRole('button', { name: 'Inspect rows' }));
  expect(screen.getByText('order-1')).toBeVisible();
  expect(screen.getByText('order-131')).toBeVisible();
  expect(screen.queryByText('order-0')).not.toBeInTheDocument();
  fireEvent.click(reopenedBanner.getByRole('button', { name: 'Save Dataset' }));
  const updateDialog = within(screen.getByRole('dialog', { name: 'Save Dataset' }));
  expect(updateDialog.getByRole('button', { name: 'Save a copy' })).toBeVisible();
  fireEvent.click(updateDialog.getByRole('button', { name: 'Update dataset' }));
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(expect.stringMatching(/saved-datasets$/), expect.objectContaining({
    dataset_id: 'saved-orders', expected_revision: 1,
  }), expect.any(Object)));
});

test('opening a saved model restores full workbench data and offers its exact Analytics scope without replacing a draft', async () => {
  const previous = { kind: 'datahub', id: 'orders-1', name: 'Orders' };
  const selected = { kind: 'model', dataset_id: 'orders-2', name: 'Orders', revision: 1 };
  const context = { workspace_id: 'saved-orders-workspace', workspace_version: 1, primary_source_id: 'orders-primary',
    source_ids: ['orders-primary', 'orders-items'], relationship_ids: ['orders-to-items'] };
  const rows = Array.from({ length: 131 }, (_, index) => ({ line: `restored-${index}` }));
  const workspace = emptyWorkspace();
  workspace.lastView = 'explore';
  workspace.drafts.current = { config: { ...defaultAnalysis(previous), title: 'Existing draft' } };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
  axios.get.mockResolvedValue({ data: { datasets: [
    { dataset_id: 'orders-1', name: 'Orders', kind: 'source', revision: 1 }, selected,
  ] } });
  axios.post.mockResolvedValue({ data: {
    dataset: selected, data_preview: rows.slice(0, 5), full_data: rows,
    source: { source_id: context.primary_source_id }, semantic_model: { dimensions: [], metrics: [] },
    workspace: { workspace_id: context.workspace_id, primary_source_id: context.primary_source_id, version: 1, sources: [{}, {}] },
    analysis_context: context,
  } });
  global.fetch = jest.fn(async (url, options) => {
    const payload = options?.body && JSON.parse(options.body);
    if (!payload) return { ok: true, json: async () => [previous] };
    return { ok: true, json: async () => ({ fields: [], metrics: [] }) };
  });
  renderApp();

  const banner = within(screen.getByRole('banner', { name: 'Devstream' }));
  const navigation = within(screen.getByRole('navigation', { name: 'Main navigation' }));
  fireEvent.click(navigation.getByRole('button', { name: 'Data Hub' }));
  const namedRecord = await screen.findByRole('button', { name: 'View details for Orders (orders-2)' });
  fireEvent.click(within(namedRecord.closest('li')).getByRole('button', { name: 'Open dataset' }));
  expect(await within(await screen.findByRole('region', { name: 'Workspace' })).findByRole('heading', { name: 'Orders', level: 1 })).toBeVisible();
  expect(screen.queryByText('restored-0')).not.toBeInTheDocument();
  expect(navigation.getByRole('button', { name: 'Workspace' })).toHaveAttribute('aria-current', 'page');
  fireEvent.click(within(screen.getByRole('region', { name: 'Workspace' })).getByRole('button', { name: 'Inspect rows' }));
  expect(screen.getByText('restored-130')).toBeVisible();
  fireEvent.click(navigation.getByRole('button', { name: 'Data Model' }));
  expect(screen.getByText(context.workspace_id)).toBeVisible();
  const drafts = JSON.parse(localStorage.getItem(STORAGE_KEY)).drafts;
  expect(Object.values(drafts)).toContainEqual(expect.objectContaining({
    config: expect.objectContaining({ title: 'Existing draft', source: previous }),
  }));
  fireEvent.click(navigation.getByRole('button', { name: 'Analytics' }));
  const selector = await screen.findByRole('combobox', { name: 'Analytics dataset' });
  expect(selector).toHaveValue('datahub:orders-1');
  fireEvent.change(selector, { target: { value: `workspace:${context.workspace_id}` } });
  await waitFor(() => {
    const request = global.fetch.mock.calls.map(([, options]) => options?.body && JSON.parse(options.body))
      .find(payload => payload?.source?.id === context.workspace_id);
    expect(request).toMatchObject({ source: { kind: 'workspace', analysis_context: context }, metadata_only: true });
    expect(request).not.toHaveProperty('dataset');
  });
});

test('the header exposes primary destinations and dismisses secondary actions from the keyboard', () => {
  renderApp();
  const banner = within(screen.getByRole('banner', { name: 'Devstream' }));
  const nav = within(banner.getByRole('navigation', { name: 'Main navigation' }));
  expect(nav.getByRole('button', { name: 'Workspace' })).toHaveAttribute('aria-current', 'page');
  for (const label of ['Data Tools', 'Data Hub', 'Data Model', 'Analytics', 'ML Studio']) {
    expect(nav.getByRole('button', { name: label })).toBeVisible();
  }
  fireEvent.click(nav.getByRole('button', { name: 'Data Model' }));
  expect(nav.getByRole('button', { name: 'Data Model' })).toHaveAttribute('aria-current', 'page');
  expect(banner.getByRole('button', { name: 'AI Chat' })).toBeVisible();
  expect(banner.queryByRole('button', { name: 'Commands' })).not.toBeInTheDocument();

  const more = banner.getByLabelText('More actions');
  fireEvent.click(more);
  expect(banner.getByRole('button', { name: 'Connect API' })).toBeVisible();
  fireEvent.keyDown(banner.getByRole('button', { name: 'Connect API' }), { key: 'Escape' });
  expect(more.closest('details')).not.toHaveAttribute('open');
  expect(more).toHaveFocus();
});

test('Data Tools exposes the actual data work and guides an empty workspace to a source', () => {
  renderApp();
  const nav = within(screen.getByRole('navigation', { name: 'Main navigation' }));
  fireEvent.click(screen.getByTitle('Expand Data Pane'));
  expect(screen.getByTitle('Collapse Data Pane')).toBeVisible();
  fireEvent.click(nav.getByRole('button', { name: 'Data Tools' }));
  expect(screen.getByTitle('Expand Data Pane')).toBeVisible();
  expect(nav.getByRole('button', { name: 'Data Tools' })).toHaveAttribute('aria-current', 'page');
  const tools = within(screen.getByRole('region', { name: 'Data Tools' }));
  for (const name of ['Power Query', 'Filter rows', 'Inspect rows', 'Fields and metrics', 'Column profile', 'Duplicate rows', 'Data Model']) {
    expect(tools.getByRole('button', { name })).toBeDisabled();
  }
  expect(tools.getByRole('button', { name: 'Upload data' })).toBeEnabled();
  expect(tools.getByRole('button', { name: 'Open Data Hub' })).toBeEnabled();
  fireEvent.click(tools.getByRole('button', { name: 'Connect API' }));
  expect(tools.getByRole('textbox', { name: 'Endpoint URL' })).toBeVisible();
});

test('loads API results into the inline grid and discards a connection response after leaving its tool', async () => {
  let finishStale;
  axios.post.mockImplementation((url, payload) => {
    if (url.endsWith('/api/fetch_external_data')) {
      if (payload.api_url.endsWith('/stale')) return new Promise(resolve => { finishStale = resolve; });
      return Promise.resolve({ data: { data_preview: [{ Region: 'North' }], semantic_model: { dataset: { name: 'API orders' } } } });
    }
    return Promise.resolve({ data: {} });
  });
  renderApp();
  const nav = within(screen.getByRole('navigation', { name: 'Main navigation' }));
  fireEvent.click(nav.getByRole('button', { name: 'Data Tools' }));
  const connect = url => {
    const tools = within(screen.getByRole('region', { name: 'Data Tools' }));
    fireEvent.click(tools.getByRole('button', { name: 'Connect API' }));
    fireEvent.change(tools.getByRole('textbox', { name: 'Endpoint URL' }), { target: { value: url } });
    fireEvent.click(tools.getByRole('button', { name: 'Fetch Data' }));
  };
  connect('https://example.com/stale');
  const signal = axios.post.mock.calls.find(([, payload]) => payload?.api_url?.endsWith('/stale'))[2].signal;
  fireEvent.click(within(screen.getByRole('region', { name: 'Data Tools' })).getByRole('button', { name: 'Connect database' }));
  expect(signal.aborted).toBe(true);
  await act(async () => finishStale({ data: { data_preview: [{ Region: 'Stale' }] } }));
  expect(screen.getByRole('heading', { name: 'Connect database' })).toBeVisible();

  connect('https://example.com/orders');
  expect(await screen.findByRole('table', { name: 'Working rows' })).toHaveTextContent('North');
  expect(screen.getByText('API orders')).toBeVisible();
  expect(screen.queryByText('Stale')).not.toBeInTheDocument();
  expect(nav.getByRole('button', { name: 'Data Tools' })).toHaveAttribute('aria-current', 'page');
});

test('a completed upload does not replace a connection panel opened while it was pending', async () => {
  let finishUpload;
  axios.post.mockReturnValue(new Promise(resolve => { finishUpload = resolve; }));
  const { container } = renderApp();
  const banner = within(screen.getByRole('banner', { name: 'Devstream' }));
  fireEvent.click(banner.getByRole('button', { name: 'Upload data' }));
  const file = new File(['Customer\ncustomer-43\n'], 'orders.csv', { type: 'text/csv' });
  fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file] } });
  fireEvent.click(screen.getByRole('button', { name: 'Complete Import' }));

  fireEvent.click(banner.getByLabelText('More actions'));
  fireEvent.click(banner.getByRole('button', { name: 'Connect API' }));
  expect(screen.getByPlaceholderText('https://api.example.com/data')).toBeVisible();
  finishUpload({ data: {
    source: { source_id: 'orders-source' },
    data_preview: [{ Customer: 'customer-43' }],
    semantic_model: { dimensions: [], metrics: [] },
  } });
  expect(await within(screen.getByRole('region', { name: 'Workspace' })).findByRole('heading', { name: 'orders.csv', level: 1 })).toBeVisible();
  expect(screen.queryByText('customer-43')).not.toBeInTheDocument();
  expect(screen.getByPlaceholderText('https://api.example.com/data')).toBeVisible();
});
