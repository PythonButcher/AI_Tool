import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import MLStudioShell from './MLStudioShell';
import { DataContext, useDatasetMeta } from '../../context/DataContext';

jest.mock('../../context/DataContext', () => ({ DataContext: require('react').createContext({}), useDatasetMeta: jest.fn() }));
const response = data => ({ ok: true, json: async () => data });

function setup({ locked = false, open = false, stale = false, failSave = false, deferSave = false, deferredOptions = false, issues = [] } = {}) {
  let current = { experiment_id: 'exp-1', workspace_id: 'ws-1', snapshot_id: 'snap-1', etag: 'e1', draft_revision: 1,
    name: 'Study', task_type: 'regression', active_stage: 'Prepare Data',
    roles: { target: 'y', numeric: ['x'], categorical: [], time: [], group: [], ignored: [] } };
  let saveAttempts = 0, resolveSave, resolveOptions;
  const operation = open ? { operation_id: 'op-1', status: 'open' } : null;
  const envelope = () => ({ draft: current, preparation_context: operation, workflow_state: {
    active_stage: current.active_stage,
    stages: ['Data & Goal', 'Prepare Data', 'Configure'].map(stage => ({ stage, state: stage === 'Configure' && locked ? 'locked' : 'available' })),
  } });
  const options = () => response({ snapshot_id: stale ? 'old-snapshot' : current.snapshot_id, issues, fixes: [], preparation_context: operation });
  global.fetch.mockImplementation(async (url, init) => {
    if (init?.method === 'PATCH') {
      saveAttempts += 1;
      expect(init.headers['If-Match']).toBe(current.etag);
      if (failSave && saveAttempts === 1) return { ok: false, status: 503, json: async () => ({ error: { message: 'Storage unavailable', remediation: 'Retry saving.' } }) };
      if (deferSave) await new Promise(resolve => { resolveSave = resolve; });
      current = { ...current, ...JSON.parse(init.body), etag: 'e2', draft_revision: 2 };
      return response(envelope());
    }
    if (url.includes('/preparation')) {
      if (deferredOptions) return new Promise(resolve => { resolveOptions = () => resolve(options()); });
      return options();
    }
    if (url.includes('/snapshots/')) return response({ snapshot: { column_profile: ['x', 'y'].map(name => ({ name, logical_type: 'numeric', null_count: 0 })) } });
    if (url.includes('/drafts/exp-1')) return response(envelope());
    if (url.includes('/drafts')) return response({ drafts: [current] });
    if (url.includes('/runs')) return response({ runs: [] });
    throw new Error(`Unexpected request: ${url}`);
  });
  render(<DataContext.Provider value={{ activeWorkspace: { workspace_id: 'ws-1', version: 1 },
    analysisContext: { workspace_id: 'ws-1', workspace_version: 1, source_ids: ['source-1'] } }}><MLStudioShell /></DataContext.Provider>);
  return { releaseSave: () => resolveSave(), releaseOptions: () => resolveOptions() };
}

beforeEach(() => { global.fetch = jest.fn(); useDatasetMeta.mockReturnValue({ numRows: 100, numCols: 2 }); });

test('clean preparation opens Configure only after the queued name and stage save, with duplicate clicks blocked', async () => {
  const { releaseSave } = setup({ deferSave: true });
  fireEvent.click(await screen.findByRole('button', { name: 'Open' }));
  expect(await screen.findByRole('region', { name: 'Ready to configure' })).toBeInTheDocument();
  expect(screen.queryByText('Quality Findings')).not.toBeInTheDocument();
  expect(screen.getByText(/Training readiness is checked there/)).toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: 'Experiment Name' }), { target: { value: 'Renamed study' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue to Configure' }));
  const pending = await screen.findByRole('button', { name: 'Saving…' });
  expect(pending).toBeDisabled();
  fireEvent.click(pending);
  expect(screen.getByRole('main', { name: 'Prepare Data Canvas' })).toBeInTheDocument();
  const writes = global.fetch.mock.calls.filter(([, init]) => init?.method === 'PATCH');
  expect(writes).toHaveLength(1);
  expect(JSON.parse(writes[0][1].body)).toEqual({ name: 'Renamed study', active_stage: 'Configure' });
  await act(async () => releaseSave());
  expect(await screen.findByRole('main', { name: 'Configuration Canvas' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Configure' })).toHaveAttribute('aria-current', 'step');
  expect(screen.getByRole('textbox', { name: 'Experiment Name' })).toHaveValue('Renamed study');
});

test('failed continuation stays in preparation and Retry Save recovers the same navigation', async () => {
  setup({ failSave: true });
  fireEvent.click(await screen.findByRole('button', { name: 'Open' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Continue to Configure' }));
  await screen.findByText(/Storage unavailable/);
  expect(screen.getByRole('main', { name: 'Prepare Data Canvas' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Continue to Configure' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Retry Save' }));
  expect(await screen.findByRole('main', { name: 'Configuration Canvas' })).toBeInTheDocument();
  const writes = global.fetch.mock.calls.filter(([, init]) => init?.method === 'PATCH');
  expect(writes).toHaveLength(2);
  expect(writes[0][1]).toEqual(writes[1][1]);
});

test('a locked Configure stage has an explanation and cannot be bypassed by the result action', async () => {
  setup({ locked: true });
  fireEvent.click(await screen.findByRole('button', { name: 'Open' }));
  const button = await screen.findByRole('button', { name: 'Continue to Configure' });
  expect(button).toBeDisabled();
  expect(screen.getByText(/Configure is locked/)).toBeInTheDocument();
  fireEvent.click(button);
  expect(global.fetch.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false);
});

test.each([
  ['open operation', { open: true }],
  ['stale snapshot', { stale: true }],
  ['remaining issues', { issues: [{ issue_id: 'i-1', severity: 'warning', message: 'Missing values', remediation: 'Review this column.' }] }],
])('%s does not display a ready-to-configure result', async (_, state) => {
  setup(state);
  fireEvent.click(await screen.findByRole('button', { name: 'Open' }));
  await screen.findByRole('main', { name: 'Prepare Data Canvas' });
  await waitFor(() => expect(screen.queryByText('Loading options...')).not.toBeInTheDocument());
  expect(screen.queryByRole('region', { name: 'Ready to configure' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Continue to Configure' })).not.toBeInTheDocument();
});

test('the transition remains absent until the preparation response has arrived', async () => {
  const { releaseOptions } = setup({ deferredOptions: true });
  fireEvent.click(await screen.findByRole('button', { name: 'Open' }));
  await screen.findByText('Loading options...');
  expect(screen.queryByRole('button', { name: 'Continue to Configure' })).not.toBeInTheDocument();
  await act(async () => releaseOptions());
  expect(await screen.findByRole('button', { name: 'Continue to Configure' })).toBeEnabled();
});
