import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import MLStudioShell from './MLStudioShell';
import { DataContext, useDatasetMeta } from '../../context/DataContext';

jest.mock('../../context/DataContext', () => ({ DataContext: require('react').createContext({}), useDatasetMeta: jest.fn() }));
const response = data => ({ ok: true, json: async () => data });
const columns = ['x', 'y'].map(name => ({ name, logical_type: 'numeric', null_count: 0 }));

function setup({ failSave = false } = {}) {
  let current = { experiment_id: 'exp-1', workspace_id: 'ws-1', snapshot_id: 'snap-1', etag: 'e1', draft_revision: 1,
    name: 'Study', task_type: 'regression', active_stage: 'Configure', roles: { target: 'y', numeric: ['x'], categorical: [], time: [], group: [], ignored: [] } };
  let failed = false, assessment = null;
  const envelope = () => ({ draft: current, assessment, preparation_context: null, workflow_state: {
    active_stage: current.active_stage, assessment_current: !!assessment,
    stages: ['Data & Goal', 'Prepare Data', 'Configure', 'Train', 'Review Results', 'Use & Share'].map((stage, index) => ({ stage, state: index < 3 ? 'available' : 'locked' })),
  } });
  global.fetch.mockImplementation(async (url, options) => {
    if (url.includes('/assessment')) {
      expect(options.headers['If-Match']).toBe(current.etag);
      expect(JSON.parse(options.body)).toEqual({});
      assessment = { state: 'ready', issues: [], input_fingerprint: 'server-hash', bound_draft_revision: current.draft_revision, assessment_id: 'assessment-1' };
      current = { ...current, etag: 'assessed', draft_revision: current.draft_revision + 1 };
      return response(envelope());
    }
    if (options?.method === 'PATCH') {
      expect(options.headers['If-Match']).toBe(current.etag);
      if (failSave && !failed) { failed = true; return { ok: false, status: 503, json: async () => ({ error: { message: 'Storage unavailable', remediation: 'Retry saving.' } }) }; }
      current = { ...current, ...JSON.parse(options.body), draft_revision: current.draft_revision + 1, etag: `e${current.draft_revision + 1}` };
      return response(envelope());
    }
    if (url.includes('/snapshots/')) return response({ snapshot: { column_profile: columns } });
    if (url.includes('/preparation')) return response({ snapshot_id: 'snap-1', issues: [], fixes: [], preparation_context: null });
    if (url.includes('/drafts/exp-1')) return response(envelope());
    if (url.includes('/drafts')) return response({ drafts: [current] });
    if (url.includes('/runs')) return response({ runs: [] });
    throw new Error(`Unexpected request: ${url}`);
  });
  render(<DataContext.Provider value={{ activeWorkspace: { workspace_id: 'ws-1', version: 1 }, analysisContext: { workspace_id: 'ws-1', workspace_version: 1, source_ids: ['s1'] } }}><MLStudioShell /></DataContext.Provider>);
}

beforeEach(() => { global.fetch = jest.fn(); useDatasetMeta.mockReturnValue({ numRows: 100, numCols: 2 }); });

test('saves queued roles before server assessment and displays its readiness', async () => {
  setup(); fireEvent.click(await screen.findByRole('button', { name: 'Open' }));
  fireEvent.change(await screen.findByRole('combobox', { name: 'Role for x' }), { target: { value: 'categorical' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save & assess' }));
  expect(await screen.findByText('Configuration ready')).toBeInTheDocument();
  const writes = global.fetch.mock.calls.filter(([, options]) => options?.method);
  expect(writes[writes.length - 1][0]).toContain('/drafts/exp-1/assessment?workspace_id=ws-1');
  expect(JSON.parse(writes[writes.length - 2][1].body).roles).toMatchObject({ numeric: [], categorical: ['x'] });
  expect(global.fetch.mock.calls.some(([url]) => url.includes('/experiments') || url.includes('/preparation-assessments'))).toBe(false);
});

test('navigation flushes configuration edits and returning preserves roles and guidance', async () => {
  setup(); fireEvent.click(await screen.findByRole('button', { name: 'Open' }));
  fireEvent.change(await screen.findByRole('combobox', { name: 'Role for x' }), { target: { value: 'categorical' } });
  fireEvent.click(screen.getByRole('button', { name: /Prepare Data/i }));
  await screen.findByRole('main', { name: 'Prepare Data Canvas' });
  fireEvent.click(screen.getByRole('button', { name: /Configure/i }));
  expect(await screen.findByRole('combobox', { name: 'Role for x' })).toHaveValue('categorical');
  fireEvent.click(screen.getByRole('checkbox', { name: 'Guidance' }));
  expect(screen.queryByText(/Each column has one role/)).not.toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: 'Role for x' })).toHaveValue('categorical');
});

test('failed navigation save retains edits and retry uses the unchanged etag', async () => {
  setup({ failSave: true }); fireEvent.click(await screen.findByRole('button', { name: 'Open' }));
  fireEvent.change(await screen.findByRole('combobox', { name: 'Role for x' }), { target: { value: 'categorical' } });
  fireEvent.click(screen.getByRole('button', { name: /Prepare Data/i }));
  await screen.findByText(/Storage unavailable/);
  expect(screen.getByRole('combobox', { name: 'Role for x' })).toHaveValue('categorical');
  fireEvent.click(screen.getByRole('button', { name: /Retry Save/i }));
  await screen.findByRole('main', { name: 'Prepare Data Canvas' });
  const patches = global.fetch.mock.calls.filter(([, options]) => options?.method === 'PATCH');
  expect(patches).toHaveLength(2);
  expect(patches[0][1]).toEqual(patches[1][1]);
});
