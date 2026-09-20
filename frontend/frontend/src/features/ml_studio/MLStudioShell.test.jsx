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

  it('validates form before submission', async () => {
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

    // Initial run fetch
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    // Try submitting without target
    const assessBtn = screen.getByRole('button', { name: 'Assess Preparation Readiness' });
    fireEvent.click(assessBtn);

    expect(screen.getByText('Please select a target column.')).toBeInTheDocument();

    // Select target
    const targetSelect = screen.getByText('Target Column').nextElementSibling;
    fireEvent.change(targetSelect, { target: { value: 'A' } });

    // Submit without features
    fireEvent.click(assessBtn);
    expect(screen.getByText('Please select at least one feature column.')).toBeInTheDocument();

    // Select feature overlapping target
    const numFeaturesSelect = screen.getByText('Numeric Features').nextElementSibling;
    numFeaturesSelect.querySelector('option[value="A"]').selected = true; fireEvent.change(numFeaturesSelect);

    fireEvent.click(assessBtn);
    expect(screen.getByText('Target cannot be a feature.')).toBeInTheDocument();

    // Select valid features but don't confirm
    Array.from(numFeaturesSelect.options).forEach(o => o.selected = false); numFeaturesSelect.querySelector('option[value="B"]').selected = true; fireEvent.change(numFeaturesSelect);
    fireEvent.click(assessBtn);
    expect(screen.getByText('You must explicitly confirm the target and feature roles.')).toBeInTheDocument();
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

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    // Configure valid form
    const targetSelect = screen.getByText('Target Column').nextElementSibling;
    fireEvent.change(targetSelect, { target: { value: 'A' } });

    const numFeaturesSelect = screen.getByText('Numeric Features').nextElementSibling;
    Array.from(numFeaturesSelect.options).forEach(o => o.selected = false); numFeaturesSelect.querySelector('option[value="B"]').selected = true; fireEvent.change(numFeaturesSelect);

    const confirmCheckbox = screen.getByText('I explicitly confirm the target and feature roles are correct.').previousElementSibling;
    fireEvent.click(confirmCheckbox);

    // Assess
    const assessBtn = screen.getByRole('button', { name: 'Assess Preparation Readiness' });
    fireEvent.click(assessBtn);

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

      const assessmentCall = global.fetch.mock.calls.find(call => call[0].includes('/preparation-assessments') && call[1]?.method === 'POST');
      expect(assessmentCall).toBeDefined();
      const assessmentBody = JSON.parse(assessmentCall[1].body);
      expect(assessmentBody.transformation_recipe.base_recipe_hash).toEqual('hash-123');
      expect(assessmentBody.transformation_recipe.canonical_recipe_hash).toEqual('sha256:0000000000000000000000000000000000000000000000000000000000000000');
    });

    // Wait for blocked state
    await waitFor(() => {
      expect(screen.getByText('Readiness Blocked')).toBeInTheDocument();
    });

    // Check issues and fixes
    expect(screen.getByText('BLOCKING: Missing values in B')).toBeInTheDocument();
    expect(screen.getByText('Impute missing values.')).toBeInTheDocument();
    expect(screen.getByText('Action: fill_missing')).toBeInTheDocument();
    expect(screen.getByText('Action: drop_column')).toBeInTheDocument();

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
      expect(screen.getByText('No durable runs exist. Run creation arrives later.')).toBeInTheDocument();
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
      expect(screen.getByText('Invalid request')).toBeInTheDocument();
    });

    const retryButton = screen.getByRole('button', { name: 'Retry' });
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
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
});
