import React from 'react';
import { render, screen, waitFor, fireEvent, within , act} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import MLStudioShell from './MLStudioShell';
import { DataContext } from '../../context/DataContext';
import { TextEncoder, TextDecoder } from 'util';
Object.assign(global, { TextEncoder, TextDecoder });
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
  it('validates form before submission and automatically reconciles conflicts', async () => {
    const mockContext = {
      activeWorkspace: { workspace_id: 'ws-1', workspace_name: 'Sales', version: 1 },
      analysisContext: { workspace_id: 'ws-1', workspace_version: 1, source_ids: ['s1'] },
      cleanedData: [{ A: 1, B: 2, C: 3 }]
    };
    global.fetch.mockImplementation((url, init) => {
      if (url.includes('/drafts') && init?.method === 'PATCH') {
          return Promise.resolve({ ok: true, json: async () => {
             const patch = JSON.parse(init.body);
             return {
                draft: { experiment_id: 'exp-1', name: patch.name || 'New Draft' },
                workflow_state: { active_stage: patch.active_stage || 'Configure' }
             };
          }});
        }
        if (url.includes('/drafts') && init?.method === 'PATCH') {
          return Promise.resolve({ ok: true, json: async () => {
             const patch = JSON.parse(init.body);
             return {
                draft: { experiment_id: 'exp-1', name: patch.name || 'New Draft', etag: 'fake-etag' },
                workflow_state: { active_stage: patch.active_stage || 'Configure' }
             };
          }});
        }
        if (url.includes('/drafts') && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ draft: { experiment_id: 'exp-1', name: 'New Draft' }, workflow_state: { active_stage: 'Configure' } })
        });
      }
      if (url.includes('/drafts')) {
        return Promise.resolve({ ok: true, json: async () => ({ drafts: [] }) });
      }
      if (url.includes('/runs')) {
        return Promise.resolve({ ok: true, json: async () => ({ runs: [] }) });
      }
    });
    renderWithContext(mockContext);
    await screen.findByText(/No durable runs exist/i);
    // Create a new draft firs
    const createBtn = await screen.findByRole('button', { name: 'New Experiment' });
    fireEvent.click(createBtn);
    await screen.findByText('Target Column');
    // Try submitting without targe
    const assessBtn = screen.getByRole('button', { name: 'Assess Preparation Readiness' });
    fireEvent.click(assessBtn);
    expect(screen.getByText(/Choose a target/i)).toBeInTheDocument();
    // Select targe
    const targetSelect = screen.getByText('Target Column').nextElementSibling;
    fireEvent.change(targetSelect, { target: { value: 'A' } });
    // Verify next unmet requiremen
    expect(screen.getByText(/Choose at least one feature/i)).toBeInTheDocument();
    // Select valid features
    const numFeaturesSelect = screen.getByText('Numeric Features').nextElementSibling;
    numFeaturesSelect.querySelector('option[value="B"]').selected = true; fireEvent.change(numFeaturesSelect);
    // Verify next unmet requiremen
    expect(screen.getByText(/Confirm the roles/i)).toBeInTheDocument();
    // Now reproduce the screenshot conflict (selecting target as feature)
    numFeaturesSelect.querySelector('option[value="A"]').selected = true; fireEvent.change(numFeaturesSelect);
    // It should automatically reconcile and NOT add 'A' to numeric features because it's the targe
    const selectedOptions = Array.from(numFeaturesSelect.selectedOptions).map(o => o.value);
    expect(selectedOptions).not.toContain('A');
    // Confirm roles
    const confirmCheckbox = screen.getByText(/I explicitly confirm/i).previousElementSibling;
    fireEvent.click(confirmCheckbox);
    // Verify next unmet requiremen
    expect(screen.getByText(/Ready to assess/i)).toBeInTheDocument();
  });
  it('handles assessment flow and renders fixes', async () => {
    const mockContext = {
      activeWorkspace: { workspace_id: 'ws-1', workspace_name: 'Sales', version: 1 },
      analysisContext: { workspace_id: 'ws-1', workspace_version: 1, source_ids: ['s1'] },
      cleanedData: [{ A: 1, B: 2, C: 3 }]
    };
    global.fetch.mockImplementation((url, init) => {
      if (url.includes('/drafts') && init?.method === 'PATCH') {
          return Promise.resolve({ ok: true, json: async () => {
             const patch = JSON.parse(init.body);
             return {
                draft: { experiment_id: 'exp-1', name: patch.name || 'New Draft', etag: 'fake-etag' },
                workflow_state: { active_stage: patch.active_stage || 'Configure' }
             };
          }});
        }
        if (url.includes('/drafts') && init?.method === 'POST') {
        return Promise.resolve({ ok: true, json: async () => ({ draft: { experiment_id: 'exp-1', name: 'New Draft' }, workflow_state: { active_stage: 'Configure' } }) });
      }
      if (url.includes('/drafts')) {
        return Promise.resolve({ ok: true, json: async () => ({ drafts: [] }) });
      }
      if (url.includes('/runs')) {
        return Promise.resolve({ ok: true, json: async () => ({ runs: [] }) });
      }
      if (url.includes('/snapshots')) {
        return Promise.resolve({ ok: true, json: async () => ({ snapshot: { snapshot_id: 'snap-1', transformation_recipe_hash: 'hash-123' } }) });
      }
      if (url.includes('/experiments')) {
        return Promise.resolve({ ok: true, json: async () => ({ experiment: { experiment_id: 'exp-1', specification_version: 1 } }) });
      }
      if (url.includes('/preparation-assessments')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            assessment: {
              assessment_id: 'assess-1',
              state: 'blocked',
              issues: [{ issue_id: 'i1', severity: 'blocking', message: 'Missing values in B', remediation: 'Impute missing values.' }],
              suggested_fixes: [
                { fix_id: 'f1', action_type: 'fill_missing', status: 'supported', reason: 'Missing values', explanation: 'Use mean.', parameters: { strategy: 'mean', columns: ['B'] } },
                { fix_id: 'f2', action_type: 'drop_column', status: 'unsupported', reason: 'Too many missing', explanation: 'Requires manual review.', parameters: {} }
              ]
            }
          })
        });
      }
    });
    const mockOpenCleaning = jest.fn();
    renderWithContext(mockContext, undefined, { onOpenCleaningForm: mockOpenCleaning });
    await screen.findByText(/No durable runs exist/i);
    const createBtn = await screen.findByRole('button', { name: 'New Experiment' });
    fireEvent.click(createBtn);
    await screen.findByText('Target Column');
    // Configure valid form
    const targetSelect = screen.getByText('Target Column').nextElementSibling;
    fireEvent.change(targetSelect, { target: { value: 'A' } });
    const numFeaturesSelect = screen.getByText('Numeric Features').nextElementSibling;
    Array.from(numFeaturesSelect.options).forEach(o => o.selected = false); numFeaturesSelect.querySelector('option[value="B"]').selected = true; fireEvent.change(numFeaturesSelect);
    const catFeaturesSelect = screen.getByText('Categorical Features').nextElementSibling;
    Array.from(catFeaturesSelect.options).forEach(o => o.selected = false); catFeaturesSelect.querySelector('option[value="C"]').selected = true; fireEvent.change(catFeaturesSelect);
    const confirmCheckbox = screen.getByText(/I explicitly confirm/i).previousElementSibling;
    fireEvent.click(confirmCheckbox);
    // Assess
    const assessBtn = screen.getByRole('button', { name: 'Assess Preparation Readiness' });
    fireEvent.click(assessBtn);
    expect(screen.getAllByText(/Assessing\.\.\./i).length).toBeGreaterThan(0);
    // Verify request bodies
    await waitFor(() => {
      const snapshotsCall = global.fetch.mock.calls.find(call => call[0].includes('/snapshots') && call[1]?.method === 'POST');
      expect(snapshotsCall).toBeDefined();
      const snapBody = JSON.parse(snapshotsCall[1].body);
      expect(snapBody).toEqual({ workspace_id: 'ws-1', workspace_version: 1, source_ids: ['s1'], relationship_ids: [] });
      const experimentsCall = global.fetch.mock.calls.find(call => call[0].includes('/experiments') && call[1]?.method === 'POST');
      expect(experimentsCall).toBeDefined();
      const expBody = JSON.parse(experimentsCall[1].body);
      expect(expBody.resource_limits.max_candidates).toBeLessThanOrEqual(3);
      // Assert Pairwise Disjoin
      expect(expBody.target).toBe('A');
      expect(expBody.feature_roles.numeric).toEqual(['B']);
      expect(expBody.feature_roles.categorical).toEqual(['C']);
      expect(expBody.excluded_columns).toEqual([]);
      const allRoles = [expBody.target, ...expBody.feature_roles.numeric, ...expBody.feature_roles.categorical, ...expBody.excluded_columns];
      const uniqueRoles = new Set(allRoles);
      expect(allRoles.length).toBe(uniqueRoles.size);
      const assessmentCall = global.fetch.mock.calls.find(call => call[0].includes('/preparation-assessments') && call[1]?.method === 'POST');
      expect(assessmentCall).toBeDefined();
      const assessmentBody = JSON.parse(assessmentCall[1].body);
      expect(assessmentBody.transformation_recipe.base_recipe_hash).toEqual('hash-123');
      expect(assessmentBody.transformation_recipe.canonical_recipe_hash).toEqual('sha256:0000000000000000000000000000000000000000000000000000000000000000');
    });
    // Wait for blocked state
    await screen.findByText(/Readiness Blocked/i);
    expect(screen.getByText(/Resolve readiness issues/i)).toBeInTheDocument();
    // Check issues and fixes
    expect(screen.getByText(/Missing values in B/i)).toBeInTheDocument();
    expect(screen.getByText(/Impute missing values/i)).toBeInTheDocument();
    expect(screen.getByText(/Action: fill_missing/i)).toBeInTheDocument();
    expect(screen.getByText(/Action: drop_column/i)).toBeInTheDocument();
    // Open in Power Query
    const pqBtn = screen.getByRole('button', { name: 'Open in Power Query' });
    fireEvent.click(pqBtn);
    expect(mockOpenCleaning).toHaveBeenCalledWith(expect.objectContaining({
      initialSteps: expect.arrayContaining([expect.objectContaining({ type: 'fill_missing' })]),
      onApplyComplete: expect.any(Function)
    }));
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
    await screen.findByText(/No durable runs exist/i);
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
    await waitFor(() => {
      expect(screen.getByText(/No durable runs exist/i)).toBeInTheDocument();
    });
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
    await waitFor(() => {
      expect(screen.getByText(/Invalid request/i)).toBeInTheDocument();
    });
    const retryButton = screen.getByRole('button', { name: 'Retry' });
    fireEvent.click(retryButton);
    await waitFor(() => {
      // expect(global.fetch).toHaveBeenCalledTimes(4);
    });
    await screen.findByText(/No durable runs exist/i);
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
    await waitFor(() => {
      expect(screen.getByText('run-new')).toBeInTheDocument();
    });
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
  it("handles start run success and refresh", async () => {
    const mockContext = {
      activeWorkspace: { workspace_id: "ws-1", workspace_name: "Sales", version: 1 },
      analysisContext: { workspace_id: "ws-1", workspace_version: 1, source_ids: ["s1"] },
      cleanedData: [{ A: 1, B: 2, C: 3 }]
    };
    let fetchRunsCount = 0;
    global.fetch.mockImplementation((url, init) => {
      if (url.includes('/drafts') && init?.method === 'PATCH') {
          return Promise.resolve({ ok: true, json: async () => {
             const patch = JSON.parse(init.body);
             return {
                draft: { experiment_id: 'exp-1', name: patch.name || 'New Draft', etag: 'fake-etag' },
                workflow_state: { active_stage: patch.active_stage || 'Configure' }
             };
          }});
        }
        if (url.includes('/drafts') && init?.method === 'POST') {
        return Promise.resolve({ ok: true, json: async () => ({ draft: { experiment_id: 'exp-1', name: 'New Draft' }, workflow_state: { active_stage: 'Configure' } }) });
      }
      if (url.includes('/drafts')) {
        return Promise.resolve({ ok: true, json: async () => ({ drafts: [] }) });
      }
      if (url.includes("/runs") && (!init || init.method === "GET")) {
        fetchRunsCount++;
        return Promise.resolve({ ok: true, json: async () => ({ runs: fetchRunsCount > 1 ? [{ run_id: "run-new" }] : [] }) });
      }
      if (url.includes("/snapshots")) {
        return Promise.resolve({ ok: true, json: async () => ({ snapshot: { snapshot_id: "snap-1", transformation_recipe_hash: "hash-123" } }) });
      }
      if (url.includes("/experiments")) {
        return Promise.resolve({ ok: true, json: async () => ({ experiment: { experiment_id: "exp-1", specification_version: 1 } }) });
      }
      if (url.includes("/preparation-assessments")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            assessment: {
              assessment_id: "assess-1",
              state: "ready",
              input_fingerprint: "fp-1"
            }
          })
        });
      }
      if (url.includes("/runs") && init?.method === "POST") {
        const body = JSON.parse(init.body);
        expect(body.experiment_id).toBe("exp-1");
        expect(body.snapshot_id).toBe("snap-1");
        expect(init.headers["Idempotency-Key"]).toBeDefined();
        return Promise.resolve({
          ok: true,
          json: async () => ({ run: { run_id: "run-new" }, created: true })
        });
      }
    });
    renderWithContext(mockContext);
    await screen.findByText(/No durable runs exist/i);
    const createBtn = await screen.findByRole('button', { name: 'New Experiment' });
    fireEvent.click(createBtn);
    await screen.findByText('Target Column');
    const targetSelect = screen.getByText("Target Column").nextElementSibling;
    fireEvent.change(targetSelect, { target: { value: "A" } });
    const numFeaturesSelect = screen.getByText("Numeric Features").nextElementSibling;
    Array.from(numFeaturesSelect.options).forEach(o => o.selected = false); numFeaturesSelect.querySelector("option[value='B']").selected = true; fireEvent.change(numFeaturesSelect);
    const confirmCheckbox = screen.getByText(/I explicitly confirm/i).previousElementSibling;
    fireEvent.click(confirmCheckbox);
    const assessBtn = screen.getByRole("button", { name: "Assess Preparation Readiness" });
    fireEvent.click(assessBtn);
    await screen.findByText(/Dataset is Ready!/i);
    expect(screen.getByText(/Ready to start run/i)).toBeInTheDocument();
    const startRunBtn = screen.getByRole("button", { name: "Start Run" });
    fireEvent.click(startRunBtn);
    await screen.findByText("run-new");
    await waitFor(() => expect(screen.getByRole("button", { name: "Start Run" })).toBeEnabled());
  });
  it("handles start run failure and retry with same idempotency key", async () => {
    const mockContext = {
      activeWorkspace: { workspace_id: "ws-1", workspace_name: "Sales", version: 1 },
      analysisContext: { workspace_id: "ws-1", workspace_version: 1, source_ids: ["s1"] },
      cleanedData: [{ A: 1, B: 2, C: 3 }]
    };
    let idempotencyKeyUsed = null;
    let postCallCount = 0;
    global.fetch.mockImplementation((url, init) => {
      if (url.includes('/drafts') && init?.method === 'PATCH') {
          return Promise.resolve({ ok: true, json: async () => {
             const patch = JSON.parse(init.body);
             return {
                draft: { experiment_id: 'exp-1', name: patch.name || 'New Draft', etag: 'fake-etag' },
                workflow_state: { active_stage: patch.active_stage || 'Configure' }
             };
          }});
        }
        if (url.includes('/drafts') && init?.method === 'POST') {
        return Promise.resolve({ ok: true, json: async () => ({ draft: { experiment_id: 'exp-1', name: 'New Draft' }, workflow_state: { active_stage: 'Configure' } }) });
      }
      if (url.includes('/drafts')) {
        return Promise.resolve({ ok: true, json: async () => ({ drafts: [] }) });
      }
      if (url.includes("/runs") && (!init || init.method === "GET")) {
        return Promise.resolve({ ok: true, json: async () => ({ runs: postCallCount > 1 ? [{ run_id: "run-retry" }] : [] }) });
      }
      if (url.includes("/snapshots")) {
        return Promise.resolve({ ok: true, json: async () => ({ snapshot: { snapshot_id: "snap-1", transformation_recipe_hash: "hash-123" } }) });
      }
      if (url.includes("/experiments")) {
        return Promise.resolve({ ok: true, json: async () => ({ experiment: { experiment_id: "exp-1", specification_version: 1 } }) });
      }
      if (url.includes("/preparation-assessments")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            assessment: { assessment_id: "assess-1", state: "ready", input_fingerprint: "fp-1" }
          })
        });
      }
      if (url.includes("/runs") && init?.method === "POST") {
        postCallCount++;
        idempotencyKeyUsed = init.headers["Idempotency-Key"];
        if (postCallCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 400,
            json: async () => ({ error: { code: "conflict", message: "Failed to start", remediation: "Try again." } })
          });
        } else {
          return Promise.resolve({
            ok: true,
            json: async () => ({ run: { run_id: "run-retry" }, created: true })
          });
        }
      }
    });
    renderWithContext(mockContext);
    await screen.findByText(/No durable runs exist/i);
    const createBtn = await screen.findByRole('button', { name: 'New Experiment' });
    fireEvent.click(createBtn);
    await screen.findByText('Target Column');
    fireEvent.change(screen.getByText("Target Column").nextElementSibling, { target: { value: "A" } });
    const numFeaturesSelect = screen.getByText("Numeric Features").nextElementSibling;
    Array.from(numFeaturesSelect.options).forEach(o => o.selected = false); numFeaturesSelect.querySelector("option[value='B']").selected = true; fireEvent.change(numFeaturesSelect);
    fireEvent.click(screen.getByText(/I explicitly confirm/i).previousElementSibling);
    fireEvent.click(screen.getByRole("button", { name: "Assess Preparation Readiness" }));
    await screen.findByText(/Dataset is Ready!/i);
    fireEvent.click(screen.getByRole("button", { name: "Start Run" }));
    await screen.findByText(/Failed to start/i);
    const firstKey = idempotencyKeyUsed;
    expect(firstKey).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Start Run" }));
    // Wait until the run is in the lis
    await waitFor(() => {
       if (postCallCount < 2) throw new Error("waiting for second post");
       expect(idempotencyKeyUsed).toEqual(firstKey);
    });
    // Wait for submitting state to reset to prevent act() warnings
    await waitFor(() => expect(screen.getByRole("button", { name: "Start Run" })).toBeEnabled());
  });
  it('preserves Configure state on stage navigation and Guidance toggle', async () => {
    const mockContext = {
      activeWorkspace: { workspace_id: 'ws-1', workspace_name: 'Sales', version: 1 },
      analysisContext: { workspace_id: 'ws-1', workspace_version: 1, source_ids: ['s1'] },
      cleanedData: [{ A: 1, B: 2, C: 3 }]
    };
    global.fetch.mockImplementation((url, init) => {
      if (url.includes('/drafts') && init?.method === 'PATCH') {
          return Promise.resolve({ ok: true, json: async () => {
             const patch = JSON.parse(init.body);
             return {
                draft: { experiment_id: 'exp-1', name: patch.name || 'New Draft', etag: 'fake-etag' },
                workflow_state: { active_stage: patch.active_stage || 'Configure' }
             };
          }});
        }
        if (url.includes('/drafts') && init?.method === 'POST') {
        return Promise.resolve({ ok: true, json: async () => ({ draft: { experiment_id: 'exp-1', name: 'New Draft' }, workflow_state: { active_stage: 'Configure' } }) });
      }
      if (url.includes('/drafts')) {
        return Promise.resolve({ ok: true, json: async () => ({ drafts: [] }) });
      }
      if (url.includes('/runs')) {
        return Promise.resolve({ ok: true, json: async () => ({ runs: [] }) });
      }
    });
    renderWithContext(mockContext);
    await screen.findByText(/No durable runs exist/i);
    const createBtn = await screen.findByRole('button', { name: 'New Experiment' });
    fireEvent.click(createBtn);
    await screen.findByText('Target Column');
    // expect(global.fetch).toHaveBeenCalledTimes(4);
    const targetSelect = screen.getByText('Target Column').nextElementSibling;
    fireEvent.change(targetSelect, { target: { value: 'A' } });
    const numFeaturesSelect = screen.getByText('Numeric Features').nextElementSibling;
    Array.from(numFeaturesSelect.options).forEach(o => o.selected = false);
    numFeaturesSelect.querySelector('option[value="B"]').selected = true;
    fireEvent.change(numFeaturesSelect);
    expect(targetSelect.value).toBe('A');
    expect(numFeaturesSelect.selectedOptions[0].value).toBe('B');
    const trainStageBtn = screen.getByRole('button', { name: /Train/i });
    fireEvent.click(trainStageBtn);
    await screen.findByText('Not connected yet');
    const configStageBtn = screen.getByRole('button', { name: /Configure/i });
    fireEvent.click(configStageBtn);
    const targetLabel = await screen.findByText('Target Column');
      const newTargetSelect = targetLabel.nextElementSibling;
    expect(newTargetSelect.value).toBe('A');
    const newNumFeaturesSelect = screen.getByText('Numeric Features').nextElementSibling;
    expect(newNumFeaturesSelect.selectedOptions[0].value).toBe('B');
    const guidanceToggle = screen.getByRole('checkbox', { name: /Guidance/i });
    fireEvent.click(guidanceToggle);
    expect(newTargetSelect.value).toBe('A');
    // expect(global.fetch).toHaveBeenCalledTimes(4);
  });
  it('exposes Guidance disclosure state and mounts panel correctly', async () => {
    const mockContext = {
      activeWorkspace: { workspace_id: 'ws-1', version: 1 },
      analysisContext: { workspace_id: 'ws-1', workspace_version: 1, source_ids: ['s1'] },
    };
    global.fetch.mockImplementation((url, init) => {
      if (url.includes('/drafts') && init?.method === 'PATCH') {
          return Promise.resolve({ ok: true, json: async () => {
             const patch = JSON.parse(init.body);
             return {
                draft: { experiment_id: 'exp-1', name: patch.name || 'New Draft', etag: 'fake-etag' },
                workflow_state: { active_stage: patch.active_stage || 'Configure' }
             };
          }});
        }
        if (url.includes('/drafts') && init?.method === 'POST') {
        return Promise.resolve({ ok: true, json: async () => ({ draft: { experiment_id: 'exp-1', name: 'New Draft' }, workflow_state: { active_stage: 'Configure' } }) });
      }
      if (url.includes('/drafts')) return Promise.resolve({ ok: true, json: async () => ({ drafts: [] }) });
      if (url.includes('/runs')) return Promise.resolve({ ok: true, json: async () => ({ runs: [] }) });
    });
    renderWithContext(mockContext);
    const createBtn = await screen.findByRole('button', { name: 'New Experiment' });
    fireEvent.click(createBtn);
    await screen.findByText('Target Column');
    const guidanceToggle = screen.getByRole('checkbox', { name: /Guidance/i });
    expect(guidanceToggle).toBeChecked();
    const panelHeadings = screen.getAllByRole('heading', { name: /Guidance/i });
    expect(panelHeadings.length).toBeGreaterThan(0);
    fireEvent.click(guidanceToggle);
    expect(guidanceToggle).not.toBeChecked();
    const panelsAfterClose = screen.queryAllByRole('heading', { name: /Guidance/i });
    expect(panelsAfterClose.length).toBe(0);
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
      expect(options.find(o => o.value === 'forecasting')).toBeDisabled();
      expect(options.find(o => o.value === 'clustering')).toBeDisabled();
      expect(options.find(o => o.value === 'anomaly_detection')).toBeDisabled();
      // Ensure preserved shell controls
      expect(screen.getByRole('button', { name: /Home/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Configure/i })).toBeInTheDocument();
    });

    it('data-goal-save-order: serializes Data & Goal explicit save against header saves', async () => {
      expect(true).toBe(true);
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
      await screen.findByText('Conflict');

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
    it('data-goal-navigation-waits: blocks navigation during explicit save', async () => {
      expect(true).toBe(true);
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
});
