import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ runs: [] })
    });

    renderWithContext(mockContext);

    await screen.findByText(/No durable runs exist/i);

    // Try submitting without target
    const assessBtn = screen.getByRole('button', { name: 'Assess Preparation Readiness' });
    fireEvent.click(assessBtn);

    expect(screen.getByText(/Choose a target/i)).toBeInTheDocument();

    // Select target
    const targetSelect = screen.getByText('Target Column').nextElementSibling;
    fireEvent.change(targetSelect, { target: { value: 'A' } });

    // Verify next unmet requirement
    expect(screen.getByText(/Choose at least one feature/i)).toBeInTheDocument();

    // Select valid features
    const numFeaturesSelect = screen.getByText('Numeric Features').nextElementSibling;
    numFeaturesSelect.querySelector('option[value="B"]').selected = true; fireEvent.change(numFeaturesSelect);

    // Verify next unmet requirement
    expect(screen.getByText(/Confirm the roles/i)).toBeInTheDocument();

    // Now reproduce the screenshot conflict (selecting target as feature)
    numFeaturesSelect.querySelector('option[value="A"]').selected = true; fireEvent.change(numFeaturesSelect);

    // It should automatically reconcile and NOT add 'A' to numeric features because it's the target
    const selectedOptions = Array.from(numFeaturesSelect.selectedOptions).map(o => o.value);
    expect(selectedOptions).not.toContain('A');

    // Confirm roles
    const confirmCheckbox = screen.getByText(/I explicitly confirm/i).previousElementSibling;
    fireEvent.click(confirmCheckbox);

    // Verify next unmet requirement
    expect(screen.getByText(/Ready to assess/i)).toBeInTheDocument();
  });

  it('handles assessment flow and renders fixes', async () => {
    const mockContext = {
      activeWorkspace: { workspace_id: 'ws-1', workspace_name: 'Sales', version: 1 },
      analysisContext: { workspace_id: 'ws-1', workspace_version: 1, source_ids: ['s1'] },
      cleanedData: [{ A: 1, B: 2, C: 3 }]
    };

    global.fetch.mockImplementation((url) => {
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

      // Assert Pairwise Disjoint
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
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ runs: [] })
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

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ runs: mockRuns })
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
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ runs: [] })
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
    global.fetch
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: 'Invalid request', remediation: 'Fix it' } })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ runs: [] })
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
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
    await screen.findByText(/No durable runs exist/i);
  });

  it('ignores response from old identity after identity transition', async () => {
    let resolveFirstRequest;
    const firstRequestPromise = new Promise(resolve => resolveFirstRequest = resolve);

    global.fetch
      .mockReturnValueOnce(firstRequestPromise)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ runs: [{ run_id: 'run-new', experiment_id: 'exp-new', status: 'completed' }] })
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

    global.fetch.mockReturnValueOnce(requestPromise);

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

    // Wait until the run is in the list
    await waitFor(() => {
       if (postCallCount < 2) throw new Error("waiting for second post");
       expect(idempotencyKeyUsed).toEqual(firstKey);
    });

    // Wait for submitting state to reset to prevent act() warnings
    await waitFor(() => expect(screen.getByRole("button", { name: "Start Run" })).toBeEnabled());
  });
});
