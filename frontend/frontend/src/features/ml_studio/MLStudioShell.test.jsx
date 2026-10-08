import React from 'react';
import { render, screen, waitFor, fireEvent, within , act} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import MLStudioShell from './MLStudioShell';
import DataCleaningForm from '../../components/data_management/DataCleaningForm';
import { DataContext } from '../../context/DataContext';
import { HelpOverlayProvider } from '../../context/HelpOverlayContext';
import { TextEncoder, TextDecoder } from 'util';
Object.assign(global, { TextEncoder, TextDecoder });

jest.mock('axios', () => ({
  post: jest.fn(),
  get: jest.fn(),
  create: jest.fn(),
  default: { post: jest.fn(), get: jest.fn(), create: jest.fn() }
}));
// Mock dataset meta hook
jest.mock('../../context/DataContext', () => {
  const actual = jest.requireActual('../../context/DataContext');
  return {
    ...actual,
    useDatasetMeta: jest.fn()
  };
});
import { useDatasetMeta } from '../../context/DataContext';
const renderWithContext = (contextValue, metaValue = { numRows: 100, numCols: 5 }, props = {}) => {
  useDatasetMeta.mockReturnValue(metaValue);
  return render(
    <DataContext.Provider value={contextValue}>
      <MLStudioShell {...props} />
    </DataContext.Provider>
  );
};
describe('MLStudioShell', () => {
  let originalFetch;
  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = jest.fn();
    // Default crypto for digestMessage
    if (!global.crypto) {
      global.crypto = {};
    }
    global.crypto.subtle = {
      digest: jest.fn().mockResolvedValue(new ArrayBuffer(32))
    };
    global.crypto.randomUUID = jest.fn().mockReturnValue('mock-uuid-1234');
  });
  afterEach(() => {
    global.fetch = originalFetch;
    jest.resetAllMocks();
  });
  it('renders "No Dataset Selected" when identity is incomplete', () => {
    renderWithContext({
      activeWorkspace: null,
      analysisContext: null,
    }, { numRows: 0, numCols: 0 });
    expect(screen.getByText('No Dataset Selected')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });
  it('renders "Identity Conflict" when blocked by version conflict', () => {
    renderWithContext({
      activeWorkspace: { workspace_id: 'ws-1', version: 1 },
      analysisContext: { workspace_id: 'ws-1', workspace_version: 1, source_ids: ['s1'] },
      workspaceVersionConflict: { message: 'Version conflict detected.' }
    });
    expect(screen.getByText('Identity Conflict')).toBeInTheDocument();
    expect(screen.getByText('Version conflict detected.')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });
  it('renders loading state and fetches run list when identity is available', async () => {
    global.fetch.mockImplementation((url) => {
      if (url.includes('/drafts')) return Promise.resolve({ ok: true, json: async () => ({ drafts: [] }) });
      if (url.includes('/runs')) return Promise.resolve({ ok: true, json: async () => ({ runs: [] }) });
    });
    renderWithContext({
      activeWorkspace: { workspace_id: 'ws-1', workspace_name: 'Sales', version: 1 },
      analysisContext: { workspace_id: 'ws-1', workspace_version: 1, source_ids: ['s1'] },
    });
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/ml-studio/v1/runs?limit=20'));
    });
    fireEvent.click(screen.getByRole('button', { name: /Recent local runs/ }));
    await screen.findByText(/No saved runs yet/i);
  });
  it('renders populated run list', async () => {
    const mockRuns = [
      {
        run_id: 'run-1',
        experiment_id: 'exp-1',
        specification_version: 1,
        snapshot_id: 'snap-1',
        status: 'completed',
        progress_stage: 'evaluation_complete',
        submitted_at: '2026-09-17T14:20:00+00:00'
      }
    ];
    global.fetch.mockImplementation((url) => {
      if (url.includes('/drafts')) return Promise.resolve({ ok: true, json: async () => ({ drafts: [] }) });
      if (url.includes('/runs')) return Promise.resolve({ ok: true, json: async () => ({ runs: mockRuns }) });
    });
    renderWithContext({
      activeWorkspace: { workspace_id: 'ws-1', version: 1 },
      analysisContext: { workspace_id: 'ws-1', workspace_version: 1, source_ids: ['s1'] },
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Recent local runs/ })).toHaveAttribute('aria-expanded', 'false');
    });
    fireEvent.click(screen.getByRole('button', { name: /Recent local runs/ }));
    await waitFor(() => {
      expect(screen.getByText('run-1')).toBeInTheDocument();
    });
  });
  it('renders empty run list message', async () => {
    global.fetch.mockImplementation((url) => {
      if (url.includes('/drafts')) return Promise.resolve({ ok: true, json: async () => ({ drafts: [] }) });
      if (url.includes('/runs')) return Promise.resolve({ ok: true, json: async () => ({ runs: [] }) });
    });
    renderWithContext({
      activeWorkspace: { workspace_id: 'ws-1', version: 1 },
      analysisContext: { workspace_id: 'ws-1', workspace_version: 1, source_ids: ['s1'] },
    });
    fireEvent.click(screen.getByRole('button', { name: /Recent local runs/ }));
    expect(await screen.findByText(/No saved runs yet/i)).toBeInTheDocument();
  });
  it('renders error state and handles retry', async () => {
    let runCount = 0;
    global.fetch.mockImplementation((url) => {
      if (url.includes('/drafts')) return Promise.resolve({ ok: true, json: async () => ({ drafts: [] }) });
      if (url.includes('/runs')) {
        runCount++;
        if (runCount === 1) return Promise.resolve({ ok: false, status: 400, json: async () => ({ error: { message: 'Invalid request', remediation: 'Fix it' } }) });
        return Promise.resolve({ ok: true, json: async () => ({ runs: [] }) });
      }
    });
    renderWithContext({
      activeWorkspace: { workspace_id: 'ws-1', version: 1 },
      analysisContext: { workspace_id: 'ws-1', workspace_version: 1, source_ids: ['s1'] },
    });
    fireEvent.click(screen.getByRole('button', { name: /Recent local runs/ }));
    expect(await screen.findByText(/Invalid request/i)).toBeInTheDocument();
    const retryButton = screen.getByRole('button', { name: 'Retry' });
    fireEvent.click(retryButton);
    await waitFor(() => {
      // expect(global.fetch).toHaveBeenCalledTimes(4);
    });
    await screen.findByText(/No saved runs yet/i);
  });
  it('ignores response from old identity after identity transition', async () => {
    let resolveFirstRequest;
    const firstRequestPromise = new Promise(resolve => resolveFirstRequest = resolve);
    let runCallCount = 0;
    global.fetch.mockImplementation((url) => {
      if (url.includes('/drafts')) return Promise.resolve({ ok: true, json: async () => ({ drafts: [] }) });
      if (url.includes('/runs')) {
        runCallCount++;
        if (runCallCount === 1) return firstRequestPromise;
        return Promise.resolve({ ok: true, json: async () => ({ runs: [{ run_id: 'run-new', experiment_id: 'exp-new', status: 'completed' }] }) });
      }
    });
    useDatasetMeta.mockReturnValue({ numRows: 100, numCols: 5 });
    const { rerender } = render(
      <DataContext.Provider value={{
        activeWorkspace: { workspace_id: 'ws-1', version: 1 },
        analysisContext: { workspace_id: 'ws-1', workspace_version: 1, source_ids: ['s1'] }
      }}>
        <MLStudioShell />
      </DataContext.Provider>
    );
    // Identity transition
    rerender(
      <DataContext.Provider value={{
        activeWorkspace: { workspace_id: 'ws-2', version: 1 },
        analysisContext: { workspace_id: 'ws-2', workspace_version: 1, source_ids: ['s2'] }
      }}>
        <MLStudioShell />
      </DataContext.Provider>
    );
    resolveFirstRequest({
      ok: true,
      json: async () => ({ runs: [{ run_id: 'run-old', experiment_id: 'exp-old', status: 'completed' }] })
    });
    fireEvent.click(screen.getByRole('button', { name: /Recent local runs/ }));
    expect(await screen.findByText('run-new')).toBeInTheDocument();
    expect(screen.queryByText('run-old')).not.toBeInTheDocument();
    // Allow old request promise chain to resolve
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  it('ignores completion after component unmounts', async () => {
    let resolveRequest;
    const requestPromise = new Promise(resolve => resolveRequest = resolve);
    global.fetch.mockImplementation((url) => {
      if (url.includes('/drafts')) return Promise.resolve({ ok: true, json: async () => ({ drafts: [] }) });
      if (url.includes('/runs')) return requestPromise;
    });
    const { unmount } = renderWithContext({
      activeWorkspace: { workspace_id: 'ws-1', version: 1 },
      analysisContext: { workspace_id: 'ws-1', workspace_version: 1, source_ids: ['s1'] },
    });
    unmount();
    const mockJson = jest.fn().mockResolvedValue({ runs: [] });
    resolveRequest({
      ok: true,
      json: mockJson
    });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(mockJson).not.toHaveBeenCalled();
  });
  it.each([
    ['queued', 'queued', 'progress_stage_alpha'],
    ['running', 'running', 'progress_stage_beta'],
    ['cancel_requested', 'cancel_requested', 'progress_stage_gamma'],
    ['completed', 'completed', 'progress_stage_delta'],
    ['failed', 'failed', 'progress_stage_epsilon'],
    ['cancelled', 'cancelled', 'progress_stage_zeta'],
    ['interrupted', 'interrupted', 'progress_stage_eta']
  ])('renders run status %s correctly with explicit progress text', async (status, expectedText, expectedProgress) => {
    const mockRuns = [
      {
        run_id: 'run-1',
        experiment_id: 'exp-1',
        specification_version: 1,
        snapshot_id: 'snap-1',
        status: status,
        progress_stage: expectedProgress,
        submitted_at: '2026-09-17T14:20:00+00:00'
      }
    ];
    global.fetch.mockImplementation((url) => {
      if (url.includes('/drafts')) return Promise.resolve({ ok: true, json: async () => ({ drafts: [] }) });
      if (url.includes('/runs')) return Promise.resolve({ ok: true, json: async () => ({ runs: mockRuns }) });
    });
    renderWithContext({
      activeWorkspace: { workspace_id: 'ws-1', version: 1 },
      analysisContext: { workspace_id: 'ws-1', workspace_version: 1, source_ids: ['s1'] },
    });
    // Wait for the row to render and locate it by run ID
    fireEvent.click(screen.getByRole('button', { name: /Recent local runs/ }));
    const rowElement = await screen.findByText('run-1');
    const rowContainer = rowElement.closest('tr');
    const cells = within(rowContainer).getAllByRole('cell');
    // Status is column index 4, Stage is column index 5
    expect(cells[4].textContent.trim()).toBe(expectedText);
    expect(cells[5].textContent.trim()).toBe(expectedProgress);
  });
  describe('Data & Goal Stage', () => {
    it('data-goal-controls-survive: renders schema and problem choices, and preserves shell controls', async () => {
      global.fetch.mockImplementation((url, init) => {
        if (url.includes('/drafts') && init?.method === 'POST') {
          return Promise.resolve({ ok: true, json: async () => ({ draft: { experiment_id: 'exp-1', name: 'New Draft' }, workflow_state: { active_stage: 'Data & Goal' } }) });
        }
        if (url.includes('/snapshots') && init?.method === 'POST') {
          return Promise.resolve({ ok: true, json: async () => ({ snapshot: { snapshot_id: 'snap-1', workspace_id: 'ws-1', workspace_version: 1, source_ids: ['s1'], relationship_ids: [] } }) });
        }
        if (url.includes('/manual-cleaning')) {
          return Promise.resolve({ ok: true, json: async () => ({ row_count: 150, schema: [{ name: 'colA', data_type: 'int64' }], preview: [{ colA: 42 }] }) });
        }
        if (url.includes('/drafts')) return Promise.resolve({ ok: true, json: async () => ({ drafts: [] }) });
        if (url.includes('/runs')) return Promise.resolve({ ok: true, json: async () => ({ runs: [] }) });
      });
      renderWithContext({
        activeWorkspace: { workspace_id: 'ws-1', version: 1 },
        analysisContext: { workspace_id: 'ws-1', workspace_version: 1, source_ids: ['s1'] },
      });
      fireEvent.click(await screen.findByRole('button', { name: 'New Experiment' }));
      // Wait for schema and preview to load
      await screen.findByText('colA');
      await screen.findByText('int64');
      await screen.findByText('42');
      // Problem choices
      const select = screen.getByRole('combobox', { name: /Problem Choice/i });
      expect(select).toBeInTheDocument();
      const options = Array.from(select.options);
      expect(options.length).toBe(5);
      expect(options.find(o => o.value === 'regression')).toBeEnabled();
      expect(options.find(o => o.value === 'classification')).toBeEnabled();
      expect(options.find(o => o.value === 'forecasting')).toBeEnabled();
      expect(options.find(o => o.value === 'clustering')).toBeEnabled();
      expect(options.find(o => o.value === 'anomaly_detection')).toBeEnabled();
      // Ensure preserved shell controls
      expect(screen.getByRole('button', { name: /Home/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Configure/i })).toBeInTheDocument();
    });

    it('data-goal-save-order: serializes Data & Goal explicit save against header saves', async () => {
      let resolveHeader;
      let resolveStage;
      const headerResponse = new Promise(resolve => { resolveHeader = resolve; });
      const stageResponse = new Promise(resolve => { resolveStage = resolve; });
      const draft = { experiment_id: 'exp-1', workspace_id: 'ws-1', name: 'New Draft', snapshot_id: null, etag: 'etag-1' };
      const workflow = stage => ({ active_stage: stage, stages: [
        { stage: 'Data & Goal', state: stage === 'Data & Goal' ? 'active' : 'available' },
        { stage: 'Prepare Data', state: stage === 'Prepare Data' ? 'active' : 'available' }
      ] });
      global.fetch.mockImplementation((url, init) => {
        if (url.includes('/drafts/exp-1') && init?.method === 'PATCH') {
          const patch = JSON.parse(init.body);
          return patch.name !== undefined ? headerResponse : stageResponse;
        }
        if (url.includes('/drafts') && init?.method === 'POST') {
          return Promise.resolve({ ok: true, json: async () => ({ draft, workflow_state: workflow('Data & Goal') }) });
        }
        if (url.includes('/snapshots') && init?.method === 'POST') {
          return Promise.resolve({ ok: true, json: async () => ({ snapshot: { snapshot_id: 'snap-1', workspace_id: 'ws-1', workspace_version: 1, source_ids: ['s1'], relationship_ids: [] } }) });
        }
        if (url.includes('/manual-cleaning')) {
          return Promise.resolve({ ok: true, json: async () => ({ row_count: 150, schema: [{ name: 'colA', data_type: 'int64' }], preview: [{ colA: 42 }] }) });
        }
        if (url.includes('/preparation')) {
          return Promise.resolve({ ok: true, json: async () => ({ snapshot_id: 'snap-1', issues: [], fixes: [], preparation_context: null }) });
        }
        if (url.includes('/drafts')) return Promise.resolve({ ok: true, json: async () => ({ drafts: [] }) });
        if (url.includes('/runs')) return Promise.resolve({ ok: true, json: async () => ({ runs: [] }) });
      });

      renderWithContext({
        activeWorkspace: { workspace_id: 'ws-1', version: 1 },
        analysisContext: { workspace_id: 'ws-1', workspace_version: 1, source_ids: ['s1'] }
      });
      fireEvent.click(await screen.findByRole('button', { name: 'New Experiment' }));
      await screen.findByText('colA');
      fireEvent.change(screen.getByRole('textbox', { name: 'Experiment Name' }), { target: { value: 'Updated Name' } });
      await waitFor(() => expect(global.fetch.mock.calls.filter(([url, init]) => url.includes('/drafts/exp-1') && init?.method === 'PATCH')).toHaveLength(1));

      fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
      expect(screen.getByRole('button', { name: /Home/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Data & Goal' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Prepare Data' })).toBeDisabled();
      expect(global.fetch.mock.calls.filter(([url, init]) => url.includes('/drafts/exp-1') && init?.method === 'PATCH')).toHaveLength(1);

      await act(async () => {
        resolveHeader({ ok: true, json: async () => ({ draft: { ...draft, name: 'Updated Name', etag: 'etag-2' }, workflow_state: workflow('Data & Goal') }) });
      });
      await waitFor(() => expect(global.fetch.mock.calls.filter(([url, init]) => url.includes('/drafts/exp-1') && init?.method === 'PATCH')).toHaveLength(2));
      const patches = global.fetch.mock.calls.filter(([url, init]) => url.includes('/drafts/exp-1') && init?.method === 'PATCH');
      expect(patches[0][1].headers['If-Match']).toBe('etag-1');
      expect(patches[1][1].headers['If-Match']).toBe('etag-2');
      expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();

      await act(async () => {
        resolveStage({ ok: true, json: async () => ({ draft: { ...draft, etag: 'etag-3', snapshot_id: 'snap-1', active_stage: 'Prepare Data' }, workflow_state: workflow('Prepare Data') }) });
      });
      expect(await screen.findByRole('main', { name: 'Prepare Data Canvas' })).toBeInTheDocument();
    });
    it('data-goal-explicit-retry: preserves fields and retries save', async () => {
      jest.useFakeTimers();
      let failCount = 0;
      global.fetch.mockImplementation((url, init) => {
        if (url.includes('/drafts/exp-1') && init?.method === 'PATCH') {
          failCount++;
          if (failCount === 1) return Promise.resolve({ ok: false, status: 500, json: async () => ({ error: { message: 'Network error' } }) });
          return Promise.resolve({ ok: true, json: async () => ({ draft: { experiment_id: 'exp-1', etag: 'etag-after' }, workflow_state: { active_stage: 'Data & Goal' } }) });
        }
        if (url.includes('/drafts') && init?.method === 'POST') return Promise.resolve({ ok: true, json: async () => ({ draft: { experiment_id: 'exp-1', name: 'New Draft' }, workflow_state: { active_stage: 'Data & Goal' } }) });
        if (url.includes('/snapshots') && init?.method === 'POST') return Promise.resolve({ ok: true, json: async () => ({ snapshot: { snapshot_id: 'snap-1', workspace_id: 'ws-1', workspace_version: 1, source_ids: ['s1'], relationship_ids: [] } }) });
        if (url.includes('/manual-cleaning')) return Promise.resolve({ ok: true, json: async () => ({ row_count: 150, schema: [{ name: 'colA', data_type: 'int64' }], preview: [{ colA: 42 }] }) });
        if (url.includes('/drafts')) return Promise.resolve({ ok: true, json: async () => ({ drafts: [] }) });
        if (url.includes('/runs')) return Promise.resolve({ ok: true, json: async () => ({ runs: [] }) });
      });
      renderWithContext({
        activeWorkspace: { workspace_id: 'ws-1', version: 1 },
        analysisContext: { workspace_id: 'ws-1', workspace_version: 1, source_ids: ['s1'] },
      });
      fireEvent.click(await screen.findByRole('button', { name: 'New Experiment' }));
      await screen.findByText('colA');
      const saveBtn = screen.getByRole('button', { name: 'Save Data & Goal' });
      fireEvent.click(saveBtn);

      await screen.findByText('Network error');

      await act(async () => { jest.advanceTimersByTime(5000); });
      const stagePatches = global.fetch.mock.calls.filter(c => c[0].includes('exp-1') && c[1]?.method === 'PATCH');
      expect(stagePatches.length).toBe(1);

      fireEvent.click(screen.getByRole('button', { name: 'Retry Save' }));

      await waitFor(() => {
        const patches = global.fetch.mock.calls.filter(c => c[0].includes('exp-1') && c[1]?.method === 'PATCH');
        expect(patches.length).toBe(2);
      });

      jest.useRealTimers();
    });
    it('data-goal-conflict-and-duplicate: preserves local text on 409', async () => {
      global.fetch.mockImplementation((url, init) => {
        if (url.includes('/drafts/exp-1') && init?.method === 'PATCH') {
          return Promise.resolve({ ok: false, status: 409, json: async () => ({ error: { message: 'Conflict' } }) });
        }
        if (url.includes('/drafts') && init?.method === 'POST') return Promise.resolve({ ok: true, json: async () => ({ draft: { experiment_id: 'exp-1', name: 'New Draft' }, workflow_state: { active_stage: 'Data & Goal' } }) });
        if (url.includes('/snapshots') && init?.method === 'POST') return Promise.resolve({ ok: true, json: async () => ({ snapshot: { snapshot_id: 'snap-1', workspace_id: 'ws-1', workspace_version: 1, source_ids: ['s1'], relationship_ids: [] } }) });
        if (url.includes('/manual-cleaning')) return Promise.resolve({ ok: true, json: async () => ({ row_count: 150, schema: [{ name: 'colA', data_type: 'int64' }], preview: [{ colA: 42 }] }) });
        if (url.includes('/drafts')) return Promise.resolve({ ok: true, json: async () => ({ drafts: [] }) });
        if (url.includes('/runs')) return Promise.resolve({ ok: true, json: async () => ({ runs: [] }) });
      });
      renderWithContext({
        activeWorkspace: { workspace_id: 'ws-1', version: 1 },
        analysisContext: { workspace_id: 'ws-1', workspace_version: 1, source_ids: ['s1'] },
      });
      fireEvent.click(await screen.findByRole('button', { name: 'New Experiment' }));
      await screen.findByText('colA');
      const goalInput = screen.getByPlaceholderText(/Describe the business goal/i);
      fireEvent.change(goalInput, { target: { value: 'Important Goal' } });
      const saveBtn = screen.getByRole('button', { name: 'Save Data & Goal' });
      fireEvent.click(saveBtn);
      fireEvent.click(saveBtn);
      expect((await screen.findAllByText('Conflict')).length).toBeGreaterThan(0);

      const stagePatches = global.fetch.mock.calls.filter(c => c[0].includes('exp-1') && c[1]?.method === 'PATCH');
      expect(stagePatches.length).toBe(1);

      expect(goalInput.value).toBe('Important Goal');
    });
    it('data-goal-stale-response: unmount/identity change blocks deferred responses', async () => {
      let resolvePatch;
      const patchPromise = new Promise(res => resolvePatch = res);
      global.fetch.mockImplementation((url, init) => {
        if (url.includes('/drafts/exp-1') && init?.method === 'PATCH') return patchPromise;
        if (url.includes('/drafts') && init?.method === 'POST') return Promise.resolve({ ok: true, json: async () => ({ draft: { experiment_id: 'exp-1', name: 'New Draft' }, workflow_state: { active_stage: 'Data & Goal' } }) });
        if (url.includes('/snapshots') && init?.method === 'POST') return Promise.resolve({ ok: true, json: async () => ({ snapshot: { snapshot_id: 'snap-1', workspace_id: 'ws-1', workspace_version: 1, source_ids: ['s1'], relationship_ids: [] } }) });
        if (url.includes('/manual-cleaning')) return Promise.resolve({ ok: true, json: async () => ({ row_count: 150, schema: [{ name: 'colA', data_type: 'int64' }], preview: [{ colA: 42 }] }) });
        if (url.includes('/drafts')) return Promise.resolve({ ok: true, json: async () => ({ drafts: [] }) });
        if (url.includes('/runs')) return Promise.resolve({ ok: true, json: async () => ({ runs: [] }) });
      });
      const { rerender } = renderWithContext({
        activeWorkspace: { workspace_id: 'ws-1', version: 1 },
        analysisContext: { workspace_id: 'ws-1', workspace_version: 1, source_ids: ['s1'] },
      });
      fireEvent.click(await screen.findByRole('button', { name: 'New Experiment' }));
      await screen.findByText('colA');
      const saveBtn = screen.getByRole('button', { name: 'Save Data & Goal' });
      fireEvent.click(saveBtn);

      rerender(
        <DataContext.Provider value={{
          activeWorkspace: { workspace_id: 'ws-2', version: 1 },
          analysisContext: { workspace_id: 'ws-2', workspace_version: 1, source_ids: ['s2'] },
        }}>
          <MLStudioShell />
        </DataContext.Provider>
      );

      await act(async () => {
         resolvePatch({ ok: true, json: async () => ({ draft: { experiment_id: 'exp-1', name: 'Updated Name' }, workflow_state: { active_stage: 'Prepare Data' } }) });
      });
      expect(screen.getByRole('button', { name: 'New Experiment' })).toBeInTheDocument();
    });
  });
  describe('Duplicate Draft', () => {
    it('defers POST, prevents multiple actions, then updates list on success', async () => {
      let resolveDuplicate;
      const duplicatePromise = new Promise(resolve => resolveDuplicate = resolve);
      global.fetch.mockImplementation((url, init) => {
        if (url.includes('/drafts') && url.includes('/duplicate') && init?.method === 'POST') {
          return duplicatePromise;
        }
        if (url.includes('/drafts') && !init) {
          return Promise.resolve({ ok: true, json: async () => ({ drafts: [{ experiment_id: 'exp-1', workspace_id: 'ws-1', draft_revision: 3, name: 'Original', active_stage: 'Configure', updated_at: '2026-01-01' }] }) });
        }
        if (url.includes('/runs')) {
          return Promise.resolve({ ok: true, json: async () => ({ runs: [] }) });
        }
      });
      renderWithContext({
        activeWorkspace: { workspace_id: 'ws-1', version: 1 },
        analysisContext: { workspace_id: 'ws-1', workspace_version: 1, source_ids: ['s1'] },
      });
      const duplicateBtn = await screen.findByRole('button', { name: 'Duplicate Original' });
      fireEvent.click(duplicateBtn);
      expect(screen.getByText('Duplicating...')).toBeInTheDocument();
      expect(duplicateBtn).toBeDisabled();
      // Ensure open is also disabled or not causing actions
      const openBtn = screen.getByRole('button', { name: 'Open' });
      expect(openBtn).toBeDisabled();
      // Trigger a second row action (double click)
      fireEvent.click(duplicateBtn);
      const duplicateCalls = global.fetch.mock.calls.filter(call => call[0].includes('/duplicate'));
      expect(duplicateCalls.length).toBe(1);
      // Resolve duplicate
      global.fetch.mockImplementation((url, init) => {
        if (url.includes('/drafts') && !init) {
          return Promise.resolve({ ok: true, json: async () => ({ drafts: [
            { experiment_id: 'exp-1', workspace_id: 'ws-1', draft_revision: 3, name: 'Original', active_stage: 'Configure', updated_at: '2026-01-01' },
            { experiment_id: 'copy-1', workspace_id: 'ws-1', draft_revision: 1, name: 'Copy of Original', active_stage: 'Data & Goal', updated_at: '2026-01-02' }
          ] }) });
        }
        if (url.includes('/runs')) return Promise.resolve({ ok: true, json: async () => ({ runs: [] }) });
      });
      resolveDuplicate({ ok: true, json: async () => ({ draft: { experiment_id: 'copy-1', workspace_id: 'ws-1', draft_revision: 1, name: 'Copy of Original', active_stage: 'Data & Goal' }, workflow_state: { active_stage: 'Data & Goal' } }) });
      await screen.findByText('Copy of Original');
      expect(screen.queryByText('Duplicating...')).not.toBeInTheDocument();
      // Assert displayed copy identity and revision
      const rowContainer = screen.getByText('Copy of Original').closest('.draft-info');
      expect(within(rowContainer).getByText('ID: copy-1')).toBeInTheDocument();
      expect(within(rowContainer).getByText('Rev: 1')).toBeInTheDocument();
      expect(within(rowContainer).getByText('Stage: Data & Goal')).toBeInTheDocument();
      // Home preserved controls
      expect(screen.getByRole('button', { name: 'New Experiment' })).toBeEnabled();
      const openBtns = screen.getAllByRole('button', { name: 'Open' });
      expect(openBtns.length).toBe(2);
      expect(openBtns[0]).toBeEnabled();
      // Ensure recent-runs dock is preserved on Home
      expect(screen.getByRole('button', { name: /Recent local runs/ })).toBeInTheDocument();
      // Open the copy to verify draft controls
      global.fetch.mockImplementation((url, init) => {
        if (url.includes('/drafts/copy-1') && (!init || init.method === 'GET')) {
          return Promise.resolve({ ok: true, json: async () => ({ draft: { experiment_id: 'copy-1', name: 'Copy of Original' }, workflow_state: { active_stage: 'Configure' } }) });
        }
        if (url.includes('/runs')) return Promise.resolve({ ok: true, json: async () => ({ runs: [] }) });
        if (url.includes('/drafts')) return Promise.resolve({ ok: true, json: async () => ({ drafts: [] }) });
      });
      fireEvent.click(openBtns[1]); // open the copy
      await screen.findByDisplayValue('Copy of Original');
      // Draft preserved controls
      const guidanceToggle = screen.getByRole('checkbox', { name: /Guidance/i });
      expect(guidanceToggle).toBeVisible();
      expect(guidanceToggle).toBeEnabled();
      // Configure form state (just check stage is Configure)
      expect(screen.getByRole('button', { name: /Configure/i })).toHaveAttribute('aria-current', 'step');
      // Recent-runs dock in draft
      expect(screen.getByRole('button', { name: /Recent local runs/ })).toBeInTheDocument();
    });
    it('leaves original visible, shows error, and allows retry on failure', async () => {
      jest.useFakeTimers();
      try {
        let failCount = 0;
        global.fetch.mockImplementation((url, init) => {
          if (url.includes('/drafts') && url.includes('/duplicate') && init?.method === 'POST') {
            failCount++;
            if (failCount === 1) {
              return Promise.resolve({ ok: false, status: 400, json: async () => ({ error: { message: 'Failed to duplicate', remediation: 'Try again' } }) });
            } else {
              return Promise.resolve({ ok: true, json: async () => ({ draft: { experiment_id: 'copy-1' }, workflow_state: {} }) });
            }
          }
          if (url.includes('/drafts') && !init) {
            if (failCount === 0 || failCount === 1) {
              return Promise.resolve({ ok: true, json: async () => ({ drafts: [{ experiment_id: 'exp-1', workspace_id: 'ws-1', name: 'Original', active_stage: 'Data & Goal', updated_at: '2026-01-01' }] }) });
            } else {
              return Promise.resolve({ ok: true, json: async () => ({ drafts: [
                { experiment_id: 'exp-1', workspace_id: 'ws-1', name: 'Original', active_stage: 'Data & Goal', updated_at: '2026-01-01' },
                { experiment_id: 'copy-1', workspace_id: 'ws-1', name: 'Copy of Original', active_stage: 'Data & Goal', updated_at: '2026-01-01' }
              ] }) });
            }
          }
          if (url.includes('/runs')) {
            return Promise.resolve({ ok: true, json: async () => ({ runs: [] }) });
          }
        });
        renderWithContext({
          activeWorkspace: { workspace_id: 'ws-1', version: 1 },
          analysisContext: { workspace_id: 'ws-1', workspace_version: 1, source_ids: ['s1'] },
        });
        const duplicateBtn = await screen.findByRole('button', { name: 'Duplicate Original' });
        fireEvent.click(duplicateBtn);
        await screen.findByText(/Failed to duplicate/);
        expect(screen.getByText(/Try again/)).toBeInTheDocument();
        // No timer retry
        jest.advanceTimersByTime(10000);
        const duplicateCalls = global.fetch.mock.calls.filter(call => call[0].includes('/duplicate'));
        expect(duplicateCalls.length).toBe(1);
        // Preserved controls check on Home after failure
        expect(screen.getByRole('button', { name: 'New Experiment' })).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Open' })).toBeEnabled();
        const retryBtn = screen.getByRole('button', { name: 'Retry' });
        fireEvent.click(retryBtn);
        await screen.findByText('Copy of Original');
      } finally {
        jest.useRealTimers();
      }
    });
    it('invalidates pending duplicate on unmount or identity change', async () => {
      let resolveDuplicate;
      const duplicatePromise = new Promise(resolve => resolveDuplicate = resolve);
      global.fetch.mockImplementation((url, init) => {
        if (url.includes('/drafts') && url.includes('/duplicate') && init?.method === 'POST') {
          return duplicatePromise;
        }
        if (url.includes('/drafts') && !init) {
          if (url.includes('ws-1')) {
            return Promise.resolve({ ok: true, json: async () => ({ drafts: [{ experiment_id: 'exp-1', workspace_id: 'ws-1', name: 'Original', active_stage: 'Data & Goal', updated_at: '2026-01-01' }] }) });
          } else {
            return Promise.resolve({ ok: true, json: async () => ({ drafts: [] }) });
          }
        }
        if (url.includes('/runs')) {
          return Promise.resolve({ ok: true, json: async () => ({ runs: [] }) });
        }
      });
      const { rerender } = renderWithContext({
        activeWorkspace: { workspace_id: 'ws-1', version: 1 },
        analysisContext: { workspace_id: 'ws-1', workspace_version: 1, source_ids: ['s1'] },
      });
      const duplicateBtn = await screen.findByRole('button', { name: 'Duplicate Original' });
      fireEvent.click(duplicateBtn);
      rerender(
        <DataContext.Provider value={{
          activeWorkspace: { workspace_id: 'ws-2', version: 1 },
          analysisContext: { workspace_id: 'ws-2', workspace_version: 1, source_ids: ['s2'] },
        }}>
          <MLStudioShell />
        </DataContext.Provider>
      );
      resolveDuplicate({ ok: true, json: async () => ({ draft: { experiment_id: 'copy-1' }, workflow_state: {} }) });
      await new Promise(resolve => setTimeout(resolve, 0));
      const getDraftsCalls = global.fetch.mock.calls.filter(call => call[0].includes('/drafts') && !call[1]);
      // Should not have a call to refresh ws-1 drafts after identity change
      const refreshCall = getDraftsCalls.find(call => call[0].includes('ws-1') && getDraftsCalls.indexOf(call) > 0);
      expect(refreshCall).toBeUndefined();
    });
  });
  describe('Delete Draft', () => {
    it('confirms, sends the listed ETag, and removes only after server success', async () => {
      const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
      let resolveDelete;
      let deleted = false;
      const deletion = new Promise(resolve => { resolveDelete = resolve; });
      global.fetch.mockImplementation((url, init) => {
        if (url.includes('/drafts/exp-1') && init?.method === 'DELETE') return deletion;
        if (url.includes('/drafts') && !init) return Promise.resolve({ ok: true, json: async () => ({ drafts: deleted ? [] : [
          { experiment_id: 'exp-1', workspace_id: 'ws-1', draft_revision: 1, etag: 'etag-1', name: 'Original', active_stage: 'Data & Goal', updated_at: '2026-01-01' }
        ] }) });
        if (url.includes('/runs')) return Promise.resolve({ ok: true, json: async () => ({ runs: [] }) });
      });
      try {
        renderWithContext({ activeWorkspace: { workspace_id: 'ws-1', version: 1 }, analysisContext: { workspace_id: 'ws-1', workspace_version: 1, source_ids: ['s1'] } });
        const deleteButton = await screen.findByRole('button', { name: 'Delete Original' });
        confirm.mockReturnValueOnce(false);
        fireEvent.click(deleteButton);
        expect(global.fetch.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);
        fireEvent.click(deleteButton);
        expect(deleteButton).toBeDisabled();
        expect(screen.getByText('Original')).toBeInTheDocument();
        const deleteCall = global.fetch.mock.calls.find(([, init]) => init?.method === 'DELETE');
        expect(deleteCall[1].headers['If-Match']).toBe('etag-1');
        deleted = true;
        await act(async () => { resolveDelete({ ok: true, status: 204 }); });
        await screen.findByText('No Experiments Found');
        expect(screen.queryByText('Original')).not.toBeInTheDocument();
      } finally {
        confirm.mockRestore();
      }
    });

    it('keeps the experiment and shows the server error after a failed delete', async () => {
      const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
      global.fetch.mockImplementation((url, init) => {
        if (url.includes('/drafts/exp-1') && init?.method === 'DELETE') return Promise.resolve({ ok: false, status: 409, json: async () => ({ error: { message: 'Draft changed', remediation: 'Reload the experiment list.' } }) });
        if (url.includes('/drafts') && !init) return Promise.resolve({ ok: true, json: async () => ({ drafts: [
          { experiment_id: 'exp-1', workspace_id: 'ws-1', draft_revision: 1, etag: 'etag-1', name: 'Original', active_stage: 'Data & Goal', updated_at: '2026-01-01' }
        ] }) });
        if (url.includes('/runs')) return Promise.resolve({ ok: true, json: async () => ({ runs: [] }) });
      });
      try {
        renderWithContext({ activeWorkspace: { workspace_id: 'ws-1', version: 1 }, analysisContext: { workspace_id: 'ws-1', workspace_version: 1, source_ids: ['s1'] } });
        fireEvent.click(await screen.findByRole('button', { name: 'Delete Original' }));
        await screen.findByText(/Draft changed/);
        expect(screen.getByText('Original')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Delete Original' })).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Refresh list' })).toBeEnabled();
      } finally {
        confirm.mockRestore();
      }
    });
  });
  describe('Prepare Data Stage', () => {
    it('prepare-data-options-render: renders issues, fixes, or empty state correctly', async () => {
      global.fetch.mockImplementation((url, init) => {
        if (url.includes('/drafts') && init?.method === 'POST') {
          return Promise.resolve({ ok: true, json: async () => ({ draft: { experiment_id: 'exp-1', snapshot_id: 'snap-1' }, workflow_state: { active_stage: 'Prepare Data' } }) });
        }
        if (url.includes('/preparation')) {
          return Promise.resolve({ ok: true, json: async () => ({
             snapshot_id: 'snap-1',
             issues: [{ issue_id: 'i-1', code: 'missing_values', severity: 'warning', field: 'colA', message: 'Missing values found', remediation: 'Fix them' }],
             fixes: [{ fix_id: 'f-1', issue_id: 'i-1', action_type: 'remove_nulls', support_status: 'supported', explanation: 'Removes rows with nulls' }],
             preparation_context: null
          })});
        }
        if (url.includes('/drafts')) return Promise.resolve({ ok: true, json: async () => ({ drafts: [] }) });
        if (url.includes('/runs')) return Promise.resolve({ ok: true, json: async () => ({ runs: [] }) });
      });

      renderWithContext({
        activeWorkspace: { workspace_id: 'ws-1', version: 1 },
        analysisContext: { workspace_id: 'ws-1', workspace_version: 1, source_ids: ['s1'] },
      });

      fireEvent.click(await screen.findByRole('button', { name: 'New Experiment' }));

      await screen.findByText('WARNING: Missing values found');
      expect(screen.getByText('Fix them')).toBeInTheDocument();
      expect(screen.getByText('Action: remove_nulls')).toBeInTheDocument();
      expect(screen.getByText('Removes rows with nulls')).toBeInTheDocument();
    });

    it('prepare-data-options-open: the open fixture shows a pending-operation explanation', async () => {
      global.fetch.mockImplementation((url, init) => {
        if (url.includes('/drafts') && init?.method === 'POST') {
          return Promise.resolve({ ok: true, json: async () => ({ draft: { experiment_id: 'exp-1', snapshot_id: 'snap-1' }, workflow_state: { active_stage: 'Prepare Data' } }) });
        }
        if (url.includes('/preparation')) {
          return Promise.resolve({ ok: true, json: async () => ({
             snapshot_id: 'snap-1',
             issues: [], fixes: [],
             preparation_context: { status: 'open', operation_id: 'op-123' }
          })});
        }
        if (url.includes('/drafts')) return Promise.resolve({ ok: true, json: async () => ({ drafts: [] }) });
        if (url.includes('/runs')) return Promise.resolve({ ok: true, json: async () => ({ runs: [] }) });
      });

      renderWithContext({
        activeWorkspace: { workspace_id: 'ws-1', version: 1 },
        analysisContext: { workspace_id: 'ws-1', workspace_version: 1, source_ids: ['s1'] },
      });

      fireEvent.click(await screen.findByRole('button', { name: 'New Experiment' }));

      await screen.findByText('Preparation operation is currently open.');
      expect(screen.getByText(/op-123/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Continue to Configure' })).not.toBeInTheDocument();
    });

    it('prepare-data-options-identity: a deferred old GET response after workspace/version, experiment, or snapshot change cannot replace the current view.', async () => {
      let resolveOptions;
      const optionsPromise = new Promise(res => resolveOptions = res);

      global.fetch.mockImplementation((url, init) => {
        if (url.includes('/drafts') && init?.method === 'POST') {
          return Promise.resolve({ ok: true, json: async () => ({ draft: { experiment_id: 'exp-1', snapshot_id: 'snap-1' }, workflow_state: { active_stage: 'Prepare Data' } }) });
        }
        if (url.includes('/preparation')) {
          return optionsPromise;
        }
        if (url.includes('/drafts')) return Promise.resolve({ ok: true, json: async () => ({ drafts: [] }) });
        if (url.includes('/runs')) return Promise.resolve({ ok: true, json: async () => ({ runs: [] }) });
      });

      const { rerender } = renderWithContext({
        activeWorkspace: { workspace_id: 'ws-1', version: 1 },
        analysisContext: { workspace_id: 'ws-1', workspace_version: 1, source_ids: ['s1'] },
      });

      fireEvent.click(await screen.findByRole('button', { name: 'New Experiment' }));
      await screen.findByText('Loading options...');

      // Transition identity
      rerender(
        <DataContext.Provider value={{
          activeWorkspace: { workspace_id: 'ws-2', version: 1 },
          analysisContext: { workspace_id: 'ws-2', workspace_version: 1, source_ids: ['s2'] },
        }}>
          <MLStudioShell />
        </DataContext.Provider>
      );

      await act(async () => {
         resolveOptions({ ok: true, json: async () => ({
             snapshot_id: 'snap-1', issues: [{ issue_id: 'stale-issue', severity: 'warning', message: 'Stale' }], fixes: []
         })});
      });

      expect(screen.queryByText('Stale')).not.toBeInTheDocument();
    });

    it('prepare-data-options-error: safe server error/remediation and explicit Retry render without hiding the shell', async () => {
      let failCount = 0;
      global.fetch.mockImplementation((url, init) => {
        if (url.includes('/drafts') && init?.method === 'POST') {
          return Promise.resolve({ ok: true, json: async () => ({ draft: { experiment_id: 'exp-1', snapshot_id: 'snap-1' }, workflow_state: { active_stage: 'Prepare Data' } }) });
        }
        if (url.includes('/preparation')) {
          failCount++;
          if (failCount === 1) {
             return Promise.resolve({ ok: false, status: 400, json: async () => ({ error: { message: 'Network Failure', remediation: 'Try again buddy.' } }) });
          }
          return Promise.resolve({ ok: true, json: async () => ({
             snapshot_id: 'snap-1', issues: [], fixes: [], preparation_context: null
          })});
        }
        if (url.includes('/drafts')) return Promise.resolve({ ok: true, json: async () => ({ drafts: [] }) });
        if (url.includes('/runs')) return Promise.resolve({ ok: true, json: async () => ({ runs: [] }) });
      });

      renderWithContext({
        activeWorkspace: { workspace_id: 'ws-1', version: 1 },
        analysisContext: { workspace_id: 'ws-1', workspace_version: 1, source_ids: ['s1'] },
      });

      fireEvent.click(await screen.findByRole('button', { name: 'New Experiment' }));

      await screen.findByText('Network Failure');
      expect(screen.getByText('Try again buddy.')).toBeInTheDocument();

      // Explicit Retry without hiding shell
      expect(screen.getByRole('button', { name: /Home/i })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Retry/i }));

      await screen.findByText('No missing values found in the current dataset.');
    });

    it('prepare-data-controls-survive: preserved shell controls remain visible and interactive after load and retry', async () => {
      global.fetch.mockImplementation((url, init) => {
        if (url.includes('/drafts') && init?.method === 'POST') {
          return Promise.resolve({ ok: true, json: async () => ({ draft: { experiment_id: 'exp-1', snapshot_id: 'snap-1' }, workflow_state: { active_stage: 'Prepare Data' } }) });
        }
        if (url.includes('/preparation')) {
          return Promise.resolve({ ok: true, json: async () => ({
             snapshot_id: 'snap-1', issues: [], fixes: [], preparation_context: null
          })});
        }
        if (url.includes('/drafts')) return Promise.resolve({ ok: true, json: async () => ({ drafts: [] }) });
        if (url.includes('/runs')) return Promise.resolve({ ok: true, json: async () => ({ runs: [] }) });
      });

      renderWithContext({
        activeWorkspace: { workspace_id: 'ws-1', version: 1 },
        analysisContext: { workspace_id: 'ws-1', workspace_version: 1, source_ids: ['s1'] },
      });

      fireEvent.click(await screen.findByRole('button', { name: 'New Experiment' }));

      await screen.findByText('No missing values found in the current dataset.');

      // Check preserved controls
      expect(screen.getByRole('button', { name: /Home/i })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Configure' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Prepare Data' })).toBeEnabled();
      expect(screen.getByRole('button', { name: /Recent local runs/i })).toBeEnabled();
      expect(screen.getByRole('checkbox', { name: /Guidance/i })).toBeEnabled();
    });
  });

  describe('Guidance and Contextual Help', () => {
    let originalFetch;
    beforeEach(() => {
      originalFetch = global.fetch;
      global.fetch = jest.fn();
      if (!global.crypto) global.crypto = {};
      global.crypto.subtle = { digest: jest.fn().mockResolvedValue(new ArrayBuffer(32)) };
      global.crypto.randomUUID = jest.fn().mockReturnValue('mock-uuid-1234');
    });
    afterEach(() => {
      global.fetch = originalFetch;
      jest.resetAllMocks();
    });

    it('toggles guidance without hiding a Data & Goal save error or local edits', async () => {
      const draft = { experiment_id: 'exp-1', workspace_id: 'ws-1', name: 'New Draft', etag: 'etag-1', guidance_enabled: true };
      const workflow = { active_stage: 'Data & Goal', stages: [
        { stage: 'Data & Goal', state: 'active' }, { stage: 'Prepare Data', state: 'available' }
      ] };
      global.fetch.mockImplementation((url, init) => {
        if (url.includes('/drafts/exp-1') && init?.method === 'PATCH') {
          const patch = JSON.parse(init.body);
          if (patch.guidance_enabled !== undefined) {
            return Promise.resolve({ ok: true, json: async () => ({ draft: { ...draft, ...patch, etag: 'etag-2' }, workflow_state: workflow }) });
          }
          return Promise.resolve({ ok: false, status: 400, json: async () => ({ error: { message: 'Save rejected', remediation: 'Check the goal.' } }) });
        }
        if (url.includes('/drafts') && init?.method === 'POST') {
          return Promise.resolve({ ok: true, json: async () => ({ draft, workflow_state: workflow }) });
        }
        if (url.includes('/snapshots') && init?.method === 'POST') {
          return Promise.resolve({ ok: true, json: async () => ({ snapshot: { snapshot_id: 'snap-1', workspace_id: 'ws-1', workspace_version: 1, source_ids: ['s1'], relationship_ids: [] } }) });
        }
        if (url.includes('/manual-cleaning')) {
          return Promise.resolve({ ok: true, json: async () => ({ row_count: 1, schema: [{ name: 'colA', data_type: 'int64' }], preview: [{ colA: 42 }] }) });
        }
        if (url.includes('/drafts')) return Promise.resolve({ ok: true, json: async () => ({ drafts: [] }) });
        if (url.includes('/runs')) return Promise.resolve({ ok: true, json: async () => ({ runs: [] }) });
      });
      renderWithContext({
        activeWorkspace: { workspace_id: 'ws-1', version: 1 },
        analysisContext: { workspace_id: 'ws-1', workspace_version: 1, source_ids: ['s1'] },
      });
      fireEvent.click(await screen.findByRole('button', { name: 'New Experiment' }));
      await screen.findByText('colA');
      const guidanceToggle = screen.getByRole('checkbox', { name: 'Guidance' });
      expect(screen.getByRole('button', { name: 'Help for Dataset' })).toBeInTheDocument();
      fireEvent.click(guidanceToggle);
      expect(screen.queryByRole('button', { name: 'Help for Dataset' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Data & Goal' })).toBeEnabled();
      const goal = screen.getByRole('textbox', { name: 'Goal (Optional)' });
      fireEvent.change(goal, { target: { value: 'Important goal' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save Data & Goal' }));
      await screen.findByText('Save rejected');
      fireEvent.click(guidanceToggle);
      expect(screen.getByRole('button', { name: 'Help for Dataset' })).toBeInTheDocument();
      expect(goal).toHaveValue('Important goal');
      expect(screen.getByText('Save rejected')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Help for Dataset' }));
      expect(screen.getByText('Dataset Help')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Close help' }));
      expect(screen.queryByText('Dataset Help')).not.toBeInTheDocument();
    });
  });

  describe('ML Studio Opening Mode', () => {
    it('shows a focused dialog outside the canvas and reopens Power Query after Return', async () => {
      const draft = { experiment_id: 'exp-1', snapshot_id: 'snap-1', draft_revision: 1, etag: 'etag-1', name: 'Quantity check' };
      global.fetch.mockImplementation((url, init) => {
        if (url.includes('/drafts') && init?.method === 'POST') {
          return Promise.resolve({ ok: true, json: async () => ({ draft, workflow_state: { active_stage: 'Prepare Data' } }) });
        }
        if (url.includes('/preparation')) {
          return Promise.resolve({ ok: true, json: async () => ({
            snapshot_id: 'snap-1',
            issues: [{ issue_id: 'issue-qty', code: 'missing_values', severity: 'warning', field: 'Qty', message: 'This field contains missing values.' }],
            fixes: [{ issue_id: 'issue-qty', fix_id: 'fix-qty', action_type: 'remove_nulls', affected_columns: ['Qty'], parameters: { columns: ['Qty'] }, support_status: 'supported', explanation: 'Remove rows missing this field; this may reduce the sample.' }],
            preparation_context: null,
          }) });
        }
        return Promise.resolve({ ok: true, json: async () => url.includes('/runs') ? { runs: [] } : { drafts: [] } });
      });
      const opened = jest.fn();
      function Parent() {
        const [editorProps, setEditorProps] = React.useState(null);
        const openEditor = React.useCallback((props) => {
          if (props.closeOverlay) return setEditorProps(null);
          opened(props);
          setEditorProps(props);
        }, []);
        return (
          <HelpOverlayProvider>
            <DataContext.Provider value={{
              activeWorkspace: { workspace_id: 'ws-1', version: 1 },
              analysisContext: { workspace_id: 'ws-1', workspace_version: 1, source_ids: ['source-1'] },
              uploadedData: [], fullData: [],
            }}>
              <MLStudioShell onOpenCleaningForm={openEditor} />
              {editorProps && <DataCleaningForm {...editorProps} closeForm={() => {
                editorProps.onClose();
                setEditorProps(null);
              }} />}
            </DataContext.Provider>
          </HelpOverlayProvider>
        );
      }
      useDatasetMeta.mockReturnValue({ numRows: 100, numCols: 5 });
      render(<Parent />);
      fireEvent.click(await screen.findByRole('button', { name: 'New Experiment' }));
      const trigger = await screen.findByRole('button', { name: 'Open in Power Query' });
      trigger.focus();
      fireEvent.click(trigger);
      const dialog = screen.getByRole('dialog', { name: 'Open in Power Query?' });
      expect(dialog.closest('.prep-form-container')).toBeNull();
      expect(within(dialog).getByRole('button', { name: 'Stay' })).toHaveFocus();
      fireEvent.keyDown(document.activeElement, { key: 'Tab' });
      expect(within(dialog).getByRole('button', { name: 'Open Power Query' })).toHaveFocus();
      fireEvent.keyDown(document.activeElement, { key: 'Escape' });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
      expect(opened).not.toHaveBeenCalled();

      fireEvent.click(trigger);
      fireEvent.click(screen.getByRole('button', { name: 'Open Power Query' }));
      await waitFor(() => expect(opened).toHaveBeenCalledTimes(1));
      expect(screen.queryByRole('dialog', { name: 'Open in Power Query?' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Run Preview' })).toBeVisible();
      expect(screen.getByRole('button', { name: 'Apply and return' })).toBeVisible();
      fireEvent.click(screen.getByRole('button', { name: 'Cancel and return' }));
      const reopenedTrigger = await screen.findByRole('button', { name: 'Open in Power Query' });
      expect(reopenedTrigger).toBeEnabled();
      fireEvent.click(reopenedTrigger);
      fireEvent.click(screen.getByRole('button', { name: 'Open Power Query' }));
      await waitFor(() => expect(opened).toHaveBeenCalledTimes(2));
      expect(opened.mock.calls[1][0].mlStudioOpeningContext).toMatchObject({ experiment_id: 'exp-1', draft_revision: 1, field: 'Qty' });
      expect(global.fetch.mock.calls.filter(([, init]) => init?.method && init.method !== 'GET')).toHaveLength(1);
    });

    it('Stay preserves the saved experiment without requests', async () => {
      global.fetch.mockImplementation((url, init) => {
        if (url.includes('/drafts') && init?.method === 'POST') {
          return Promise.resolve({ ok: true, json: async () => ({ draft: { experiment_id: 'exp-1', snapshot_id: 'snap-1' }, workflow_state: { active_stage: 'Prepare Data' } }) });
        }
        if (url.includes('/preparation')) {
          return Promise.resolve({ ok: true, json: async () => ({
             snapshot_id: 'snap-1',
             issues: [{ issue_id: 'i1', severity: 'blocking', message: 'Missing values in B', field: 'B' }],
             fixes: [{ issue_id: 'i1', fix_id: 'f1', action_type: 'fill_missing', support_status: 'supported', explanation: 'Use mean.', parameters: {} }],
             preparation_context: { status: 'idle' }
          })});
        }
        if (url.includes('/drafts')) return Promise.resolve({ ok: true, json: async () => ({ drafts: [] }) });
        if (url.includes('/runs')) return Promise.resolve({ ok: true, json: async () => ({ runs: [] }) });
      });

      renderWithContext({
        activeWorkspace: { workspace_id: 'ws-1', version: 1 },
        analysisContext: { workspace_id: 'ws-1', workspace_version: 1, source_ids: ['s1'] },
      }, undefined, { onOpenCleaningForm: jest.fn() });

      fireEvent.click(await screen.findByRole('button', { name: 'New Experiment' }));
      await screen.findByText(/Missing values in B/i);

      const fetchCountBefore = global.fetch.mock.calls.length;

      fireEvent.click(screen.getByRole('button', { name: /Open in Power Query/i }));
      expect(screen.getByText(/Open in Power Query\?/i)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Stay' }));

      expect(screen.queryByText(/Open in Power Query\?/i)).not.toBeInTheDocument();
      expect(global.fetch.mock.calls.length).toBe(fetchCountBefore);
    });

    it('Open carries current issue identity and returns to the same experiment', async () => {
      global.fetch.mockImplementation((url, init) => {
        if (url.includes('/drafts') && init?.method === 'POST') {
          return Promise.resolve({ ok: true, json: async () => ({ draft: { experiment_id: 'exp-1', snapshot_id: 'snap-1', draft_revision: 1, name: 'MyExp' }, workflow_state: { active_stage: 'Prepare Data' } }) });
        }
        if (url.includes('/preparation')) {
          return Promise.resolve({ ok: true, json: async () => ({
             snapshot_id: 'snap-1',
             issues: [{ issue_id: 'i1', severity: 'blocking', message: 'Missing values in B', field: 'B' }],
             fixes: [{ issue_id: 'i1', fix_id: 'f1', action_type: 'fill_missing', support_status: 'supported', explanation: 'Use mean.', parameters: { strategy: 'mean' } }],
             preparation_context: { status: 'idle' }
          })});
        }
        if (url.includes('/drafts')) return Promise.resolve({ ok: true, json: async () => ({ drafts: [] }) });
        if (url.includes('/runs')) return Promise.resolve({ ok: true, json: async () => ({ runs: [] }) });
      });

      const mockOpenCleaning = jest.fn();
      renderWithContext({
        activeWorkspace: { workspace_id: 'ws-1', version: 1 },
        analysisContext: { workspace_id: 'ws-1', workspace_version: 1, source_ids: ['s1'] },
      }, undefined, { onOpenCleaningForm: mockOpenCleaning });

      fireEvent.click(await screen.findByRole('button', { name: 'New Experiment' }));
      await screen.findByText(/Missing values in B/i);

      fireEvent.click(screen.getByRole('button', { name: /Open in Power Query/i }));
      fireEvent.click(screen.getAllByRole('button', { name: /Open Power Query/i })[0]);

      await waitFor(() => expect(mockOpenCleaning).toHaveBeenCalled());
      expect(mockOpenCleaning).toHaveBeenCalledWith(expect.objectContaining({
        mlStudioMode: true,
        mlStudioOpeningContext: expect.objectContaining({
          experiment_id: 'exp-1',
          workspace_id: 'ws-1',
          snapshot_id: 'snap-1',
          draft_revision: 1,
          issue_id: 'i1',
          fix_id: 'f1',
          return_stage: 'Prepare Data',
          title: 'MyExp',
          field: 'B',
          action: 'fill_missing',
          explanation: 'Use mean.'
        }),
        initialSteps: expect.arrayContaining([expect.objectContaining({ type: 'fill_missing', params: { strategy: 'mean' } })]),
        onClose: expect.any(Function)
      }));
    });

    it('invalidates opening on identity change and unmount', async () => {
      global.fetch.mockImplementation((url, init) => {
        if (url.includes('/drafts') && init?.method === 'POST') {
          return Promise.resolve({ ok: true, json: async () => ({ draft: { experiment_id: 'exp-1', snapshot_id: 'snap-1', draft_revision: 1 }, workflow_state: { active_stage: 'Prepare Data' } }) });
        }
        if (url.includes('/preparation')) {
          return Promise.resolve({ ok: true, json: async () => ({
             snapshot_id: 'snap-1',
             issues: [{ issue_id: 'i1', severity: 'blocking', message: 'Missing values in B', field: 'B' }],
             fixes: [{ issue_id: 'i1', fix_id: 'f1', action_type: 'fill_missing', support_status: 'supported', explanation: 'Use mean.', parameters: {} }],
             preparation_context: { status: 'idle' }
          })});
        }
        if (url.includes('/drafts')) return Promise.resolve({ ok: true, json: async () => ({ drafts: [] }) });
        if (url.includes('/runs')) return Promise.resolve({ ok: true, json: async () => ({ runs: [] }) });
      });

      const mockOpenCleaning = jest.fn();
      useDatasetMeta.mockReturnValue({ numRows: 100, numCols: 5 });
      const { rerender, unmount } = render(
        <DataContext.Provider value={{
          activeWorkspace: { workspace_id: 'ws-1', version: 1 },
          analysisContext: { workspace_id: 'ws-1', workspace_version: 1, source_ids: ['s1'] }
        }}>
          <MLStudioShell onOpenCleaningForm={mockOpenCleaning} />
        </DataContext.Provider>
      );

      fireEvent.click(await screen.findByRole('button', { name: 'New Experiment' }));
      await screen.findByText(/Missing values in B/i);

      fireEvent.click(screen.getByRole('button', { name: /Open in Power Query/i }));
      fireEvent.click(screen.getAllByRole('button', { name: /Open Power Query/i })[0]);

      await waitFor(() => expect(mockOpenCleaning).toHaveBeenCalled());
      const onCloseCb = mockOpenCleaning.mock.calls.find(call => call[0]?.mlStudioMode)[0].onClose;

      rerender(
        <DataContext.Provider value={{
          activeWorkspace: { workspace_id: 'ws-2', version: 1 },
          analysisContext: { workspace_id: 'ws-2', workspace_version: 1, source_ids: ['s2'] }
        }}>
          <MLStudioShell onOpenCleaningForm={mockOpenCleaning} />
        </DataContext.Provider>
      );

      onCloseCb();
      const prepCalls = global.fetch.mock.calls.filter(c => c[0].includes('/preparation'));
      expect(prepCalls.length).toBeGreaterThan(1);

      unmount();
      expect(mockOpenCleaning).toHaveBeenCalledWith(expect.objectContaining({ closeOverlay: true }));
    });

    it('opening respects missing, empty, failed, stale and pending options', async () => {
      global.fetch.mockImplementation((url, init) => {
        if (url.includes('/drafts') && init?.method === 'POST') {
          return Promise.resolve({ ok: true, json: async () => ({ draft: { experiment_id: 'exp-1', snapshot_id: 'snap-1' }, workflow_state: { active_stage: 'Prepare Data' } }) });
        }
        if (url.includes('/preparation')) {
          return Promise.resolve({ ok: true, json: async () => ({
             snapshot_id: 'snap-2',
             issues: [{ issue_id: 'i1', severity: 'blocking', message: 'Missing values in B', field: 'B' }],
             fixes: [{ issue_id: 'i1', fix_id: 'f1', action_type: 'fill_missing', support_status: 'supported', explanation: 'Use mean.', parameters: {} }],
             preparation_context: { status: 'idle' }
          })});
        }
        if (url.includes('/drafts')) return Promise.resolve({ ok: true, json: async () => ({ drafts: [] }) });
        if (url.includes('/runs')) return Promise.resolve({ ok: true, json: async () => ({ runs: [] }) });
      });

      renderWithContext({
        activeWorkspace: { workspace_id: 'ws-1', version: 1 },
        analysisContext: { workspace_id: 'ws-1', workspace_version: 1, source_ids: ['s1'] },
      });

      fireEvent.click(await screen.findByRole('button', { name: 'New Experiment' }));
      await screen.findByText(/Missing values in B/i);

      fireEvent.click(screen.getByRole('button', { name: /Open in Power Query/i }));

      expect(screen.getByText(/Cannot Open Power Query/i)).toBeInTheDocument();
      expect(screen.getByText(/Save the active experiment/i)).toBeInTheDocument();
    });

    it('Power Query stays open across App gateway rerenders', async () => {
      global.fetch.mockImplementation((url, init) => {
        if (url.includes('/drafts') && init?.method === 'POST') {
          return Promise.resolve({ ok: true, json: async () => ({ draft: { experiment_id: 'exp-1', snapshot_id: 'snap-1' }, workflow_state: { active_stage: 'Prepare Data' } }) });
        }
        if (url.includes('/preparation')) {
          return Promise.resolve({ ok: true, json: async () => ({
             snapshot_id: 'snap-1',
             issues: [{ issue_id: 'i1', severity: 'blocking', message: 'Missing values in B', field: 'B' }],
             fixes: [{ issue_id: 'i1', fix_id: 'f1', action_type: 'fill_missing', support_status: 'supported', explanation: 'Use mean.', parameters: {} }],
             preparation_context: { status: 'idle' }
          })});
        }
        if (url.includes('/drafts')) return Promise.resolve({ ok: true, json: async () => ({ drafts: [] }) });
        if (url.includes('/runs')) return Promise.resolve({ ok: true, json: async () => ({ runs: [] }) });
      });
      useDatasetMeta.mockReturnValue({ numRows: 100, numCols: 5 });

      const StatefulParent = () => {
        const [cleaningFormProps, setCleaningFormProps] = React.useState(null);
        const [showCleaningForm, setShowCleaningForm] = React.useState(false);
        const [counter, setCounter] = React.useState(0);

        const handleOpenCleaningForm = React.useCallback((props) => {
          if (props && props.closeOverlay) {
            setShowCleaningForm(false);
            setCleaningFormProps(null);
            return;
          }
          setCleaningFormProps(props);
          setShowCleaningForm(true);
        }, []);

        return (
          <HelpOverlayProvider>
            <DataContext.Provider value={{
              activeWorkspace: { workspace_id: 'ws-1', version: 1 },
              analysisContext: { workspace_id: 'ws-1', workspace_version: 1, source_ids: ['s1'] },
              uploadedData: [],
              fullData: []
            }}>
              <button onClick={() => setCounter(c => c + 1)}>Rerender Parent {counter}</button>
              <MLStudioShell onOpenCleaningForm={handleOpenCleaningForm} />
              {showCleaningForm && (
                 <DataCleaningForm
                   closeForm={() => {
                     if (cleaningFormProps && cleaningFormProps.onClose) {
                       cleaningFormProps.onClose();
                     }
                     setShowCleaningForm(false);
                     setCleaningFormProps(null);
                   }}
                   {...cleaningFormProps}
                 />
              )}
            </DataContext.Provider>
          </HelpOverlayProvider>
        );
      };

      render(<StatefulParent />);

      fireEvent.click(await screen.findByRole('button', { name: 'New Experiment' }));
      await screen.findByText(/Missing values in B/i);

      fireEvent.click(screen.getByRole('button', { name: /Open in Power Query/i }));
      fireEvent.click(screen.getAllByRole('button', { name: /Open Power Query/i })[0]);

      // Wait for DataCleaningForm to render
      await screen.findByText(/Missing values in B/i);
      expect(screen.getAllByText(/Use mean./i).length).toBeGreaterThan(0);

      const fetchCountBefore = global.fetch.mock.calls.length;
      fireEvent.click(screen.getByRole('button', { name: 'Rerender Parent 0' }));
      expect(screen.getByRole('button', { name: 'Rerender Parent 1' })).toBeInTheDocument();

      // Ensure the overlay survives
      expect(screen.getAllByText(/Use mean./i).length).toBeGreaterThan(0);
      // Ensure no fetch was fired
      expect(global.fetch.mock.calls.length).toBe(fetchCountBefore);

      // Exercise the real editor's Return action
      fireEvent.click(screen.getByRole('button', { name: /Return to Prepare Data/i }));

      // Editor should close and we return to ML Studio
      expect(screen.queryByRole('button', { name: /Return to Prepare Data/i })).not.toBeInTheDocument();
      // Fetch options should have been called upon returning
      expect(global.fetch.mock.calls.length).toBeGreaterThan(fetchCountBefore);
    });

    it('Power Query invalidates on draft revision change', async () => {
      global.fetch.mockImplementation((url, init) => {
        if (url.includes('/drafts') && init?.method === 'POST') {
          return Promise.resolve({ ok: true, json: async () => ({ draft: { experiment_id: 'exp-1', snapshot_id: 'snap-1', draft_revision: 1 }, workflow_state: { active_stage: 'Prepare Data' } }) });
        }
        if (url.includes('/preparation')) {
          return Promise.resolve({ ok: true, json: async () => ({
             snapshot_id: 'snap-1',
             issues: [{ issue_id: 'i1', severity: 'blocking', message: 'Missing values in B', field: 'B' }],
             fixes: [{ issue_id: 'i1', fix_id: 'f1', action_type: 'remove_nulls', support_status: 'supported', explanation: 'Remove null rows.', parameters: {} }],
             preparation_context: { status: 'idle' }
          })});
        }
        if (url.includes('/drafts')) return Promise.resolve({ ok: true, json: async () => ({ drafts: [] }) });
        if (url.includes('/runs')) return Promise.resolve({ ok: true, json: async () => ({ runs: [] }) });
      });
      useDatasetMeta.mockReturnValue({ numRows: 100, numCols: 5 });

      const StatefulParent = () => {
        const [cleaningFormProps, setCleaningFormProps] = React.useState(null);
        const [showCleaningForm, setShowCleaningForm] = React.useState(false);
        const [draftRevision, setDraftRevision] = React.useState(1);

        const [capturedOnClose, setCapturedOnClose] = React.useState(null);

        const handleOpenCleaningForm = React.useCallback((props) => {
          if (props && props.closeOverlay) {
            setShowCleaningForm(false);
            setCleaningFormProps(null);
            return;
          }
          setCleaningFormProps(props);
          if (props && props.onClose) {
            setCapturedOnClose(() => props.onClose);
          }
          setShowCleaningForm(true);
        }, []);

        return (
          <HelpOverlayProvider>
            <DataContext.Provider value={{
              activeWorkspace: { workspace_id: 'ws-1', version: 1 },
              analysisContext: { workspace_id: 'ws-1', workspace_version: 1, source_ids: ['s1'] },
              uploadedData: [],
              fullData: []
            }}>
              <button onClick={() => setDraftRevision(r => r + 1)}>Bump Revision {draftRevision}</button>
              {capturedOnClose && <button onClick={capturedOnClose}>Invoke Stale Callback</button>}
              {/* Note: we mock activeDraft bump indirectly by intercepting MLStudioShell or modifying fetch?
                  Wait, MLStudioShell owns activeDraft via fetchDrafts. We can't change activeDraft from parent directly.
                  Wait! activeDraft is passed internally in MLStudioShell!
                  How to trigger a draft_revision change?
                  Maybe by clicking Save?
              */}
              <MLStudioShell onOpenCleaningForm={handleOpenCleaningForm} />
              {showCleaningForm && (
                 <DataCleaningForm
                   closeForm={() => {
                     if (cleaningFormProps && cleaningFormProps.onClose) {
                       cleaningFormProps.onClose();
                     }
                     setShowCleaningForm(false);
                     setCleaningFormProps(null);
                   }}
                   {...cleaningFormProps}
                 />
              )}
            </DataContext.Provider>
          </HelpOverlayProvider>
        );
      };

      render(<StatefulParent />);

      fireEvent.click(await screen.findByRole('button', { name: 'New Experiment' }));
      await screen.findByText(/Missing values in B/i);

      fireEvent.click(screen.getByRole('button', { name: /Open in Power Query/i }));
      fireEvent.click(screen.getAllByRole('button', { name: /Open Power Query/i })[0]);

      // Wait for DataCleaningForm to render
      await screen.findByText(/Missing values in B/i);
      expect(screen.getAllByText(/Remove null rows./i).length).toBeGreaterThan(0);

      // Now we need to change draft revision.
      // Saving the stage or changing something that bumps draft_revision...
      // Or we can just trigger a save!
      // We also need to mock the /drafts GET to return the updated draft so activeDraft.draft_revision updates
      global.fetch.mockImplementation((url, init) => {
        if (url.includes('/drafts/exp-1') && init?.method === 'PATCH') {
          return Promise.resolve({ ok: true, json: async () => ({ draft: { experiment_id: 'exp-1', snapshot_id: 'snap-1', draft_revision: 2, name: 'New Name' }, workflow_state: { active_stage: 'Prepare Data' } }) });
        }
        if (url.includes('/drafts') && (!init || init.method === 'GET')) {
          return Promise.resolve({ ok: true, json: async () => ({ drafts: [{ experiment_id: 'exp-1', snapshot_id: 'snap-1', draft_revision: 2, name: 'New Name' }] }) });
        }
        if (url.includes('/runs')) return Promise.resolve({ ok: true, json: async () => ({ runs: [] }) });
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });

      // We trigger a save by changing the experiment name and blurring
      const nameInput = screen.getByRole('textbox', { name: 'Experiment Name' });
      fireEvent.change(nameInput, { target: { value: 'New Name' } });
      fireEvent.blur(nameInput);

      // Wait for PATCH fetch to happen
      await waitFor(() => {
        const patchCall = global.fetch.mock.calls.find(c => c[0].includes('/drafts/exp-1') && c[1]?.method === 'PATCH');
        expect(patchCall).toBeDefined();
      }, { timeout: 3000 });

      // Also wait for the subsequent GET /drafts
      await waitFor(() => {
        const getCall = global.fetch.mock.calls.find(c => c[0].includes('/drafts') && (!c[1] || c[1].method === 'GET') && c[0] !== '/api/ml-studio/v1/drafts'); // well it's already there maybe
        // Actually just waiting a bit for state to settle
      });

      // The save is debounced, so we wait for the save status to show 'Saved'
      await waitFor(() => expect(screen.getByText('Saved')).toBeInTheDocument(), { timeout: 3000 });

      // After save, draft_revision becomes 2. The overlayIdentityRef was snap-1-1.
      // Since it changed, the overlay should be closed!
      expect(screen.queryByRole('button', { name: /Return to Prepare Data/i })).not.toBeInTheDocument();

      // If we somehow had a stale reference and called onClose now, it shouldn't refetch
      const fetchCountBefore = global.fetch.mock.calls.length;

      // Invoke the stale callback captured during opening
      fireEvent.click(screen.getByRole('button', { name: 'Invoke Stale Callback' }));

      // Since identity changed, onClose shouldn't trigger a refetch of preparation options
      expect(global.fetch.mock.calls.length).toBe(fetchCountBefore);
    });
  });
});
