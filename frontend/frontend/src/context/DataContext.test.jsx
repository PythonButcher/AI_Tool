import React, { useContext, useEffect } from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { DataProvider, DataContext } from './DataContext';

// Mock fetch
global.fetch = jest.fn();

const TestComponent = ({ onStateChange }) => {
  const {
    activeWorkspace,
    analysisContext,
    setWorkspaceEnvelope,
    refreshWorkspace,
    workspaceRefreshStatus,
    workspaceRefreshError,
    workspaceVersionConflict,
    recordWorkspaceMutationConflict
  } = useContext(DataContext);

  useEffect(() => {
    onStateChange({
      activeWorkspace,
      analysisContext,
      setWorkspaceEnvelope,
      refreshWorkspace,
      workspaceRefreshStatus,
      workspaceRefreshError,
      workspaceVersionConflict,
      recordWorkspaceMutationConflict
    });
  }, [
    activeWorkspace,
    analysisContext,
    setWorkspaceEnvelope,
    refreshWorkspace,
    workspaceRefreshStatus,
    workspaceRefreshError,
    workspaceVersionConflict,
    recordWorkspaceMutationConflict,
    onStateChange
  ]);

  return <div>Test</div>;
};

describe('DataContext Workspace State', () => {
  let contextState;

  beforeEach(() => {
    jest.resetAllMocks();
    contextState = {};
  });

  const renderWithContext = () => {
    return render(
      <DataProvider>
        <TestComponent onStateChange={(state) => { contextState = state; }} />
      </DataProvider>
    );
  };

  it('atomically sets workspace envelope', async () => {
    renderWithContext();
    
    const envelope = {
      workspace: { workspace_id: 'ws1', version: 1, primary_source_id: 'src1', sources: [{ source_id: 'src1' }] },
      analysis_context: { workspace_id: 'ws1', workspace_version: 1, primary_source_id: 'src1', source_ids: ['src1'], relationship_ids: [] }
    };

    act(() => {
      contextState.setWorkspaceEnvelope(envelope);
    });

    expect(contextState.activeWorkspace).toEqual(envelope.workspace);
    expect(contextState.analysisContext).toEqual(envelope.analysis_context);
  });

  it('refreshes workspace and reconciles matching identity', async () => {
    renderWithContext();
    
    const initialEnvelope = {
      workspace: { workspace_id: 'ws1', version: 1, primary_source_id: 'src1', sources: [{ source_id: 'src1' }] },
      analysis_context: { workspace_id: 'ws1', workspace_version: 1, primary_source_id: 'src1', source_ids: ['src1'], relationship_ids: [] }
    };

    act(() => {
      contextState.setWorkspaceEnvelope(initialEnvelope);
    });

    const refreshedWorkspace = { ...initialEnvelope.workspace, name: 'Updated WS' };
    
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ workspace: refreshedWorkspace })
    });

    await act(async () => {
      await contextState.refreshWorkspace('ws1');
    });

    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/data-workspaces/ws1'));
    // Should NOT fetch analysis context because identity matches
    expect(global.fetch).toHaveBeenCalledTimes(1);

    expect(contextState.activeWorkspace.name).toBe('Updated WS');
    expect(contextState.analysisContext).toEqual(initialEnvelope.analysis_context);
  });

  it('refreshes workspace and fetches analysis context on version mismatch', async () => {
    renderWithContext();
    
    const initialEnvelope = {
      workspace: { workspace_id: 'ws1', version: 1, primary_source_id: 'src1', sources: [{ source_id: 'src1' }] },
      analysis_context: { workspace_id: 'ws1', workspace_version: 1, primary_source_id: 'src1', source_ids: ['src1'], relationship_ids: [] }
    };

    act(() => {
      contextState.setWorkspaceEnvelope(initialEnvelope);
    });

    const refreshedWorkspace = { workspace_id: 'ws1', version: 2, primary_source_id: 'src1', sources: [{ source_id: 'src1' }, { source_id: 'src2' }] };
    const newAnalysisContext = { workspace_id: 'ws1', workspace_version: 2, primary_source_id: 'src1', source_ids: ['src1'], relationship_ids: [] };
    
    // First call: workspace
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ workspace: refreshedWorkspace })
    });

    // Second call: analysis context (no source parameters)
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ workspace: refreshedWorkspace, analysis_context: newAnalysisContext })
    });

    await act(async () => {
      await contextState.refreshWorkspace('ws1');
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenNthCalledWith(2, expect.stringContaining('/api/data-workspaces/ws1/analysis-context'));
    
    expect(contextState.activeWorkspace).toEqual(refreshedWorkspace);
    expect(contextState.analysisContext).toEqual(newAnalysisContext);
    expect(contextState.analysisContext.source_ids).toEqual(['src1']); // Proves multiple memberships do not expand source_ids
  });

  it('handles refresh failure and preserves existing state', async () => {
    renderWithContext();
    
    const initialEnvelope = {
      workspace: { workspace_id: 'ws1', version: 1, primary_source_id: 'src1', sources: [{ source_id: 'src1' }] },
      analysis_context: { workspace_id: 'ws1', workspace_version: 1, primary_source_id: 'src1', source_ids: ['src1'], relationship_ids: [] }
    };

    act(() => {
      contextState.setWorkspaceEnvelope(initialEnvelope);
    });

    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: { code: 'backend_error', message: 'Server error' } })
    });

    await act(async () => {
      await contextState.refreshWorkspace('ws1');
    });

    expect(contextState.workspaceRefreshError).toEqual({ code: 'backend_error', message: 'Server error' });
    expect(contextState.activeWorkspace).toEqual(initialEnvelope.workspace);
    expect(contextState.analysisContext).toEqual(initialEnvelope.analysis_context);
  });

  it('handles stale-version reconciliation from mutation conflict', async () => {
    renderWithContext();
    
    // Simulate mutation conflict
    act(() => {
      contextState.recordWorkspaceMutationConflict({
        code: 'workspace_version_conflict',
        message: 'Conflict',
        attemptedVersion: 2
      });
    });

    expect(contextState.workspaceVersionConflict).toEqual({
      code: 'workspace_version_conflict',
      message: 'Conflict',
      attemptedVersion: 2,
      currentVersion: null
    });

    // Simulate refresh that learns current version
    const refreshedWorkspace = { workspace_id: 'ws1', version: 3, primary_source_id: 'src1', sources: [] };
    const newAnalysisContext = { workspace_id: 'ws1', workspace_version: 3, primary_source_id: 'src1', source_ids: [], relationship_ids: [] };
    
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ workspace: refreshedWorkspace })
    });
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ workspace: refreshedWorkspace, analysis_context: newAnalysisContext })
    });

    await act(async () => {
      await contextState.refreshWorkspace('ws1');
    });

    expect(contextState.workspaceVersionConflict).toEqual({
      code: 'workspace_version_conflict',
      message: 'Conflict',
      attemptedVersion: 2,
      currentVersion: 3
    });
  });
});
