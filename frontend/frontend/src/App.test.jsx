import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

function renderApp() {
  return render(
    <DataProvider>
      <WindowProvider>
        <App />
      </WindowProvider>
    </DataProvider>
  );
}

test('opens file import and Data Hub from an empty Workspace', async () => {
  axios.get.mockResolvedValue({ data: { datasets: [] } });
  renderApp();

  const canvas = within(screen.getByRole('main'));
  fireEvent.click(canvas.getByRole('button', { name: 'Upload data' }));
  expect(screen.getByRole('button', { name: 'Browse Files' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Back to Sources' }));
  expect(screen.getByRole('button', { name: /Local File/ })).toBeVisible();

  fireEvent.click(canvas.getByRole('button', { name: 'Data Hub', exact: true }));
  expect(await screen.findByText('No saved datasets yet')).toBeVisible();
  expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/\/api\/datahub\/datasets$/), { signal: expect.anything() });

  const banner = within(screen.getByRole('banner', { name: 'Datastream' }));
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
  const banner = within(screen.getByRole('banner', { name: 'Datastream' }));
  fireEvent.click(banner.getByRole('button', { name: 'Upload data' }));
  expect(banner.getByRole('button', { name: 'Data Preview' })).toBeDisabled();
  const file = new File(['Customer\ncustomer-42\n'], 'orders.csv', { type: 'text/csv' });
  fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file] } });
  fireEvent.click(screen.getByRole('button', { name: 'Complete Import' }));
  expect(await screen.findByText('customer-42')).toBeVisible();
  expect(axios.post.mock.calls[0][1].get('file')).toEqual(file);
  expect(banner.getByRole('button', { name: 'Data Preview' })).toBeEnabled();
  fireEvent.click(screen.getByTitle('Minimize'));
  await waitFor(() => expect(screen.queryByText('customer-42')).not.toBeInTheDocument());
  fireEvent.click(banner.getByRole('button', { name: 'Data Preview' }));
  expect(screen.getByText('customer-42')).toBeVisible();
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
  axios.get.mockImplementation(async () => ({ data: { datasets: entry ? [entry] : [] } }));
  axios.post.mockImplementation(async (url, payload) => {
    if (url.endsWith('/api/upload')) return { data: original };
    if (url.endsWith('/api/numbers')) return { data: { data_info: 'Data overview' } };
    if (url.endsWith('/refine-working')) return { data: refined };
    if (url.endsWith('/saved-datasets')) {
      entry = { dataset_id: 'saved-orders', name: payload.name, revision: (entry?.revision || 0) + 1, kind: 'refined' };
      return { data: { dataset: entry } };
    }
    if (url.endsWith('/saved-orders/open')) return { data: { dataset: entry, ...refined } };
    throw new Error(url);
  });
  const { container, unmount } = renderApp();
  const banner = within(screen.getByRole('banner', { name: 'Datastream' }));
  const navigation = within(screen.getByRole('navigation', { name: 'Main navigation' }));
  fireEvent.click(navigation.getByRole('button', { name: 'Data Hub' }));
  expect(await screen.findByText('No saved datasets yet')).toBeVisible();
  fireEvent.click(banner.getByRole('button', { name: 'Upload data' }));
  const file = new File(['Order\norder-0\n'], 'orders.csv', { type: 'text/csv' });
  fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file] } });
  fireEvent.click(screen.getByRole('button', { name: 'Complete Import' }));
  expect(await screen.findByText('order-0')).toBeVisible();
  expect(navigation.getByRole('button', { name: 'Workspace' })).toHaveAttribute('aria-current', 'page');
  expect(banner.getByRole('button', { name: 'Save Dataset' })).toBeVisible();
  fireEvent.click(navigation.getByRole('button', { name: 'Data Hub' }));
  expect(await screen.findByText('No saved datasets yet')).toBeVisible();
  fireEvent.click(navigation.getByRole('button', { name: 'Workspace' }));

  fireEvent.click(banner.getByLabelText('More actions'));
  fireEvent.click(banner.getByRole('button', { name: 'Refine data' }));
  fireEvent.click(screen.getByRole('button', { name: 'Missing & Rows' }));
  fireEvent.click(screen.getByRole('button', { name: 'Remove Top' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add Step' }));
  fireEvent.click(screen.getByRole('button', { name: 'Apply All' }));
  expect(await screen.findByText(/Refine changes applied/)).toBeVisible();
  expect(screen.queryByText('order-0')).not.toBeInTheDocument();
  expect(axios.post).toHaveBeenCalledWith(expect.stringMatching(/refine-working$/), expect.objectContaining({
    source_id: 'uploaded', steps: [{ type: 'remove_top_rows', params: { count: 1 } }],
  }), expect.any(Object));
  fireEvent.click(navigation.getByRole('button', { name: 'Data Hub' }));
  expect(await screen.findByText('No saved datasets yet')).toBeVisible();
  fireEvent.click(navigation.getByRole('button', { name: 'Workspace' }));

  fireEvent.click(banner.getByRole('button', { name: 'Save Dataset' }));
  const dialog = within(screen.getByRole('dialog', { name: 'Save Dataset' }));
  fireEvent.change(dialog.getByRole('textbox', { name: 'Dataset name' }), { target: { value: 'Refined orders' } });
  fireEvent.click(dialog.getByRole('button', { name: 'Save to Data Hub' }));
  expect(await screen.findByText(/Saved “Refined orders” to Data Hub/)).toBeVisible();
  expect(axios.post).toHaveBeenCalledWith(expect.stringMatching(/saved-datasets$/), expect.objectContaining({
    workspace_id: 'ws-refined', source_id: 'refined', kind: 'current', name: 'Refined orders',
  }), expect.any(Object));

  unmount();
  renderApp();
  const reopenedBanner = within(screen.getByRole('banner', { name: 'Datastream' }));
  fireEvent.click(reopenedBanner.getByRole('button', { name: 'Data Hub' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Open dataset' }));
  expect(await screen.findByText('order-1')).toBeVisible();
  fireEvent.click(reopenedBanner.getByLabelText('More actions'));
  fireEvent.click(reopenedBanner.getByRole('button', { name: 'Inspect or download rows' }));
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

  const banner = within(screen.getByRole('banner', { name: 'Datastream' }));
  const navigation = within(screen.getByRole('navigation', { name: 'Main navigation' }));
  fireEvent.click(navigation.getByRole('button', { name: 'Data Hub' }));
  const namedRecord = await screen.findByRole('button', { name: 'View details for Orders (orders-2)' });
  fireEvent.click(within(namedRecord.closest('li')).getByRole('button', { name: 'Open dataset' }));
  expect(await screen.findByText('restored-0')).toBeVisible();
  expect(navigation.getByRole('button', { name: 'Workspace' })).toHaveAttribute('aria-current', 'page');
  fireEvent.click(banner.getByLabelText('More actions'));
  fireEvent.click(banner.getByRole('button', { name: 'Inspect or download rows' }));
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
  const banner = within(screen.getByRole('banner', { name: 'Datastream' }));
  const nav = within(banner.getByRole('navigation', { name: 'Main navigation' }));
  expect(nav.getByRole('button', { name: 'Workspace' })).toHaveAttribute('aria-current', 'page');
  for (const label of ['Data Hub', 'Data Model', 'Analytics', 'ML Studio']) {
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

test('a completed upload does not replace a connection panel opened while it was pending', async () => {
  let finishUpload;
  axios.post.mockReturnValue(new Promise(resolve => { finishUpload = resolve; }));
  const { container } = renderApp();
  const banner = within(screen.getByRole('banner', { name: 'Datastream' }));
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
  expect(await screen.findByText('customer-43')).toBeVisible();
  expect(screen.getByPlaceholderText('https://api.example.com/data')).toBeVisible();
});
