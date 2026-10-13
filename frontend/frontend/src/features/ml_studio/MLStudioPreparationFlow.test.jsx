import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DataContext, useDatasetMeta } from '../../context/DataContext';
import MLStudioShell from './MLStudioShell';
import DataCleaningForm from '../../components/data_management/DataCleaningForm';

jest.mock('axios', () => ({ post: jest.fn(), get: jest.fn(), create: jest.fn() }));
jest.mock('../../context/DataContext', () => ({
  DataContext: require('react').createContext({}), useDatasetMeta: jest.fn(), normalizeDatasetRows: data => data || [],
}));
const draft = { experiment_id: 'exp-1', workspace_id: 'ws-1', etag: 'etag-1', draft_revision: 1,
  name: 'Saved experiment', snapshot_id: 'snap-1', task_type: 'regression', active_stage: 'Prepare Data' };
const operation = { operation_id: 'op-1', experiment_id: 'exp-1', workspace_id: 'ws-1', snapshot_id: 'snap-1', base_etag: 'etag-1',
  status: 'open', return_stage: 'Prepare Data', recipe: { steps: [{ action_type: 'remove_nulls', parameters: { columns: ['amount'] } }] } };
const envelope = (saved, context) => ({ draft: saved, preparation_context: context, workflow_state: { active_stage: 'Prepare Data' } });
const response = data => ({ ok: true, json: async () => data });

function Harness() {
  const [version, setVersion] = React.useState(1);
  const [editor, setEditor] = React.useState(null);
  const open = React.useCallback(props => setEditor(props.closeOverlay ? null : props), []);
  const refreshWorkspace = async () => { setVersion(2); return { workspace: { workspace_id: 'ws-1', version: 2 } }; };
  return <DataContext.Provider value={{ activeWorkspace: { workspace_id: 'ws-1', version },
    analysisContext: { workspace_id: 'ws-1', workspace_version: version, source_ids: ['source-1'] }, refreshWorkspace }}>
    <MLStudioShell onOpenCleaningForm={open} />
    {editor && <DataCleaningForm {...editor} closeForm={() => { editor.onClose?.(); setEditor(null); }} />}
  </DataContext.Provider>;
}

beforeEach(() => {
  global.fetch = jest.fn();
  global.crypto = { randomUUID: () => 'test-key' };
  useDatasetMeta.mockReturnValue({ numRows: 100, numCols: 2 });
});

function routes({ stale = false, apply = false } = {}) {
  let terminal = false;
  const fresh = { ...draft, draft_revision: 2, etag: 'etag-2', snapshot_id: 'snap-2' };
  global.fetch.mockImplementation(async (url, options) => {
    if (url.includes('/preparation/op-1')) {
      const action = JSON.parse(options.body).action;
      expect(action).toBe(apply ? 'apply' : 'cancel');
      terminal = true;
      return response({ ...envelope(apply ? fresh : draft, null), preparation: { ...operation, status: apply ? 'applied' : 'cancelled' } });
    }
    if (url.includes('/preparation')) {
      if (stale && !terminal) return { ok: false, json: async () => ({ error: { code: 'snapshot_stale', message: 'Data commit needs recovery.', remediation: 'Retry Apply.' } }) };
      return response({ snapshot_id: terminal && apply ? 'snap-2' : 'snap-1', issues: [], fixes: [], preparation_context: terminal ? null : operation });
    }
    if (url.includes('/drafts/exp-1')) return response(envelope(terminal && apply ? fresh : draft, terminal ? null : operation));
    if (url.includes('/drafts')) return response({ drafts: [terminal && apply ? fresh : draft] });
    if (url.includes('/runs')) return response({ runs: [] });
    throw new Error(`Unexpected request: ${url}`);
  });
}

test('reopened operation can cancel and return without creating a new recipe', async () => {
  routes(); render(<Harness />);
  fireEvent.click(await screen.findByRole('button', { name: 'Open' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Resume preparation' }));
  expect(await screen.findByRole('dialog', { name: 'Power Query Editor' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel and return' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByRole('textbox', { name: 'Experiment Name' })).toHaveValue('Saved experiment');
  expect(global.fetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
});

test('editing a resumed recipe releases the parent lock even when the unsaved revision is then closed', async () => {
  routes(); render(<Harness />);
  fireEvent.click(await screen.findByRole('button', { name: 'Open' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Resume preparation' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Edit steps' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Edit Step' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Cancel and return' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(await screen.findByText('No missing values found in the current dataset.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Resume preparation' })).not.toBeInTheDocument();
  expect(global.fetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
});

test('pending commit recovery remains reachable when preparation options report a stale snapshot', async () => {
  routes({ stale: true, apply: true }); render(<Harness />);
  fireEvent.click(await screen.findByRole('button', { name: 'Open' }));
  expect(await screen.findByText('Data commit needs recovery.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Resume preparation' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Apply and return' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Experiment Name' })).toHaveValue('Saved experiment'));
  expect(await screen.findByText('No missing values found in the current dataset.')).toBeInTheDocument();
  const actions = global.fetch.mock.calls.filter(([, options]) => options?.method === 'POST');
  expect(actions).toHaveLength(1);
  expect(actions[0][0]).toContain('/preparation/op-1?workspace_id=ws-1');
  expect(actions[0][1].headers['If-Match']).toBe('etag-1');
});

test('bulk null treatment previews once, applies once and returns to refreshed preparation', async () => {
  let applied = false, started = false;
  const fresh = { ...draft, etag: 'etag-2', draft_revision: 2, snapshot_id: 'snap-2' };
  const issues = ['temperature', 'rain'].map(field => ({ issue_id: field, code: 'missing_values', field,
    count: 8, logical_type: 'numeric', training_imputation_available: true, message: `${field} contains nulls` }));
  global.fetch.mockImplementation(async (url, options) => {
    if (url.includes('/preparation/op-1')) {
      const action = JSON.parse(options.body).action;
      if (action === 'preview') return response({ preparation: operation,
        preview: { input_row_count: 100, row_count: 90, removed_row_count: 10, added_row_count: 0, preview: [{ temperature: 12, rain: 3 }] } });
      expect(action).toBe('apply'); applied = true;
      return response({ ...envelope(fresh, null), preparation: { ...operation, status: 'applied' } });
    }
    if (url.includes('/preparation')) {
      if (options?.method === 'POST') {
        expect(JSON.parse(options.body)).toMatchObject({ issue_id: null, fix_id: null,
          steps: [{ type: 'remove_nulls', params: { columns: ['temperature', 'rain'] } }] });
        started = true; return response({ preparation: operation });
      }
      return response({ snapshot_id: applied ? 'snap-2' : 'snap-1', row_count: applied ? 90 : 100,
        columns: ['temperature', 'rain'], issues: applied ? [] : issues, fixes: [], preparation_context: null });
    }
    if (url.includes('/drafts/exp-1')) return response(envelope(applied ? fresh : draft, null));
    if (url.includes('/drafts')) return response({ drafts: [applied ? fresh : draft] });
    if (url.includes('/runs')) return response({ runs: [] });
    throw new Error(`Unexpected request: ${url}`);
  });
  render(<Harness />);
  fireEvent.click(await screen.findByRole('button', { name: 'Open' }));
  fireEvent.change(await screen.findByRole('combobox', { name: 'Bulk missing-value treatment' }), { target: { value: 'remove' } });
  fireEvent.click(screen.getByRole('button', { name: 'Preview selected fixes' }));
  await screen.findByText('90 resulting rows · showing 1');
  expect(started).toBe(true); expect(applied).toBe(false);
  expect(screen.getByText('10')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Apply and return' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(await screen.findByText('No missing values found in the current dataset.')).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Experiment Name' })).toHaveValue('Saved experiment');
  expect(global.fetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(3);
});
