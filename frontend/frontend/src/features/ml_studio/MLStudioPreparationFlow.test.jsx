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

test('pending commit recovery remains reachable when preparation options report a stale snapshot', async () => {
  routes({ stale: true, apply: true }); render(<Harness />);
  fireEvent.click(await screen.findByRole('button', { name: 'Open' }));
  expect(await screen.findByText('Data commit needs recovery.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Resume preparation' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Apply and return' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Experiment Name' })).toHaveValue('Saved experiment'));
  expect(await screen.findByText('This bounded check found no missing-value issues.')).toBeInTheDocument();
  const actions = global.fetch.mock.calls.filter(([, options]) => options?.method === 'POST');
  expect(actions).toHaveLength(1);
  expect(actions[0][0]).toContain('/preparation/op-1?workspace_id=ws-1');
  expect(actions[0][1].headers['If-Match']).toBe('etag-1');
});
