import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';

import CleanSuggestionsModal from './CleanSuggestionsModal';
import { workflowApi } from './workflowApi';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const normaliseDataset = (data) => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch (err) {
      console.error('AIPipeline failed to parse dataset string:', err);
      return [];
    }
  }
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data_preview)) return data.data_preview;
  if (typeof data?.data_preview === 'string') {
    try {
      return JSON.parse(data.data_preview);
    } catch (err) {
      console.error('AIPipeline failed to parse dataset data_preview string:', err);
      return [];
    }
  }
  return [];
};

const cloneWorkflow = (workflow) => JSON.parse(JSON.stringify(workflow || {}));

const mergeRunStateIntoResults = (runState) => {
  const merged = {};
  const nodeStates = runState?.node_states || {};
  const resultEntries = runState?.results || {};

  Object.entries(nodeStates).forEach(([nodeId, nodeState]) => {
    const resultEntry = resultEntries[nodeId] || {};
    merged[nodeId] = {
      status: resultEntry.status || nodeState.status || 'idle',
      result: resultEntry.result || null,
      error: resultEntry.error || nodeState.error || null,
      command: resultEntry.command || nodeState.command || null,
      label: resultEntry.label || nodeState.label || nodeId,
    };
  });

  Object.entries(resultEntries).forEach(([nodeId, resultEntry]) => {
    merged[nodeId] = {
      status: resultEntry.status || merged[nodeId]?.status || 'idle',
      result: resultEntry.result || merged[nodeId]?.result || null,
      error: resultEntry.error || merged[nodeId]?.error || null,
      command: resultEntry.command || merged[nodeId]?.command || null,
      label: resultEntry.label || merged[nodeId]?.label || nodeId,
    };
  });

  return merged;
};

const getMissingCleanNodes = (workflow) => {
  const nodes = workflow?.nodes || [];
  return nodes.filter((node) => node.command === '/clean' && !node.params?.instructions?.trim());
};

const AIPipeline = ({ workflowDefinition, dataset, onResults, onDataCleaned, onRunStateChange }) => {
  const [pendingClean, setPendingClean] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [activeRunId, setActiveRunId] = useState(null);
  const pendingResolverRef = useRef(null);
  const lastAppliedCleanRef = useRef(null);
  const resolvedDataset = useMemo(() => normaliseDataset(dataset), [dataset]);

  const collectCleaningInstructions = useCallback(async (workflow) => {
    const workingCopy = cloneWorkflow(workflow);
    const cleanNodes = getMissingCleanNodes(workingCopy);

    for (const cleanNode of cleanNodes) {
      const response = await axios.post(`${API_URL}/ai_cmd`, {
        command: '/clean',
        dataset: resolvedDataset,
        params: cleanNode.params || {},
        execution_context: {
          mode: 'pipeline_prep',
          node_id: cleanNode.id,
          workflow_name: workingCopy.name,
        },
      });

      const instructions = await new Promise((resolve) => {
        pendingResolverRef.current = resolve;
        setPendingClean({
          nodeId: cleanNode.id,
          nodeLabel: cleanNode.label,
          suggestions: response.data?.suggestions || '',
        });
      });

      const targetNode = workingCopy.nodes.find((node) => node.id === cleanNode.id);
      if (targetNode) {
        targetNode.params = {
          ...(targetNode.params || {}),
          instructions: instructions || '',
        };
      }
    }

    return workingCopy;
  }, [resolvedDataset]);

  const pollRun = useCallback(async (runId) => {
    const runState = await workflowApi.getRun(runId);
    const nextResults = mergeRunStateIntoResults(runState);

    onResults?.(nextResults);
    onRunStateChange?.(runState);

    const cleanedNode = Object.values(nextResults).find(
      (entry) => entry.command === '/clean' && entry.status === 'completed' && Array.isArray(entry.result?.cleaned_data)
    );

    if (cleanedNode && lastAppliedCleanRef.current !== runId) {
      lastAppliedCleanRef.current = runId;
      onDataCleaned?.(cleanedNode.result.cleaned_data);
    }

    if (runState.status === 'completed' || runState.status === 'failed') {
      setIsRunning(false);
      setActiveRunId(null);
    }
  }, [onDataCleaned, onResults, onRunStateChange]);

  const runWorkflow = useCallback(async () => {
    if (isRunning) return;
    if (!workflowDefinition?.nodes?.length) {
      return;
    }

    setIsRunning(true);
    onRunStateChange?.(null);

    try {
      const preparedWorkflow = await collectCleaningInstructions(workflowDefinition);
      const startedRun = await workflowApi.execute(preparedWorkflow, resolvedDataset);
      setActiveRunId(startedRun.run_id);
      onRunStateChange?.(startedRun);
      onResults?.(mergeRunStateIntoResults(startedRun));
    } catch (error) {
      console.error('Failed to execute workflow:', error);
      setIsRunning(false);
      const message = error.response?.data?.error || error.message || 'Failed to execute workflow.';
      onResults?.({
        ai_report: {
          status: 'failed',
          result: null,
          error: message,
          command: 'ai_report',
          label: 'AI Report',
        },
      });
    }
  }, [collectCleaningInstructions, isRunning, onResults, onRunStateChange, resolvedDataset, workflowDefinition]);

  useEffect(() => {
    window.runAIPipeline = runWorkflow;
    return () => {
      if (window.runAIPipeline === runWorkflow) {
        delete window.runAIPipeline;
      }
    };
  }, [runWorkflow]);

  useEffect(() => {
    if (!activeRunId) {
      return undefined;
    }

    let isDisposed = false;

    const sync = async () => {
      if (isDisposed) {
        return;
      }
      try {
        await pollRun(activeRunId);
      } catch (error) {
        console.error('Failed to poll workflow run:', error);
        setIsRunning(false);
        setActiveRunId(null);
      }
    };

    sync();
    const intervalId = window.setInterval(sync, 1200);

    return () => {
      isDisposed = true;
      window.clearInterval(intervalId);
    };
  }, [activeRunId, pollRun]);

  return (
    <>
      {pendingClean && (
        <CleanSuggestionsModal
          title={`Cleaning Suggestions: ${pendingClean.nodeLabel}`}
          suggestions={pendingClean.suggestions}
          onApply={(instructions) => {
            pendingResolverRef.current?.(instructions);
            pendingResolverRef.current = null;
            setPendingClean(null);
          }}
          onSkip={() => {
            pendingResolverRef.current?.('');
            pendingResolverRef.current = null;
            setPendingClean(null);
          }}
        />
      )}
    </>
  );
};

export default AIPipeline;
