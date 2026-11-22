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
jest.mock('./features/data-model/SourceModelCanvas', () => () => null);

const originalFetch = global.fetch;

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
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
  axios.get.mockResolvedValue({ data: { sources: [] } });
  renderApp();

  const canvas = within(screen.getByRole('main'));
  fireEvent.click(canvas.getByRole('button', { name: 'Upload data' }));
  expect(screen.getByRole('button', { name: 'Browse Files' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Back to Sources' }));
  expect(screen.getByRole('button', { name: /Local File/ })).toBeVisible();

  fireEvent.click(canvas.getByRole('button', { name: 'Data Hub', exact: true }));
  expect(await screen.findByText('No saved datasets yet')).toBeVisible();
  expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/\/api\/data-sources$/), { signal: expect.anything() });

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

test('opening a saved dataset uses its identity and recovers the existing Analytics draft', async () => {
  const previous = { kind: 'datahub', id: 'orders-1', name: 'Orders' };
  const selected = { kind: 'datahub', id: 'orders-2', name: 'Orders' };
  const workspace = emptyWorkspace();
  workspace.drafts.current = { config: { ...defaultAnalysis(previous), title: 'Existing draft' } };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
  axios.get.mockResolvedValue({ data: { sources: [previous, selected].map(source => ({
    source_id: source.id, name: source.name, source_kind: 'upload',
  })) } });
  global.fetch = jest.fn(async (url, options) => {
    const payload = options?.body && JSON.parse(options.body);
    if (!payload) return { ok: true, json: async () => [previous, selected] };
    if (payload.source.id === selected.id) return { ok: false, json: async () => ({ error: 'Saved dataset is unavailable.' }) };
    return { ok: true, json: async () => ({ fields: [], metrics: [] }) };
  });
  renderApp();

  fireEvent.click(within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name: 'Data Hub' }));
  const namedRecord = await screen.findByRole('button', { name: 'View details for Orders (orders-2)' });
  fireEvent.click(within(namedRecord.closest('li')).getByRole('button', { name: 'Open in Analytics' }));
  expect(await screen.findByText('Saved dataset is unavailable.')).toBeVisible();
  expect(screen.getByRole('combobox', { name: 'Analytics dataset' })).toHaveValue('datahub:orders-2');
  const request = global.fetch.mock.calls.map(([, options]) => options?.body && JSON.parse(options.body))
    .find(payload => payload?.source.id === selected.id);
  expect(request).toMatchObject({ source: selected, metadata_only: true });
  expect(request).not.toHaveProperty('dataset');
  const drafts = JSON.parse(localStorage.getItem(STORAGE_KEY)).drafts;
  expect(Object.values(drafts)).toContainEqual(expect.objectContaining({
    config: expect.objectContaining({ title: 'Existing draft', source: previous }),
  }));
  expect(within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name: 'Analytics' })).toHaveAttribute('aria-current', 'page');
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
