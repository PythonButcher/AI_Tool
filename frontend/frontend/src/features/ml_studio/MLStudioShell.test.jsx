import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import MLStudioShell from './MLStudioShell';
import { DataContext } from '../../context/DataContext';

// Mock dataset meta hook
jest.mock('../../context/DataContext', () => {
  const actual = jest.requireActual('../../context/DataContext');
  return {
    ...actual,
    useDatasetMeta: jest.fn()
  };
});

import { useDatasetMeta } from '../../context/DataContext';

const renderWithContext = (contextValue, metaValue = { numRows: 100, numCols: 5 }) => {
  useDatasetMeta.mockReturnValue(metaValue);
  return render(
    <DataContext.Provider value={contextValue}>
      <MLStudioShell />
    </DataContext.Provider>
  );
};

describe('MLStudioShell', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = jest.fn();
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
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ runs: [] })
    });

    renderWithContext({
      activeWorkspace: { workspace_id: 'ws-1', workspace_name: 'Sales', version: 1 },
      analysisContext: { workspace_id: 'ws-1', workspace_version: 1, source_ids: ['s1'] },
    });

    expect(screen.getByText('Dataset identity available')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Run Dock' })).toHaveAttribute('aria-busy', 'true');
    
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
    expect(screen.getByText('evaluation_complete')).toBeInTheDocument();
    expect(screen.getByText('completed')).toBeInTheDocument();
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
    expect(screen.getByText('Fix it')).toBeInTheDocument();

    const retryButton = screen.getByRole('button', { name: 'Retry' });
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
    
    await waitFor(() => {
      expect(screen.getByText('No durable runs exist. Run creation arrives later.')).toBeInTheDocument();
    });
  });
});
