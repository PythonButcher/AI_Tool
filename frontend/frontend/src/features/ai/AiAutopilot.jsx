import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { FaMagic, FaSpinner } from 'react-icons/fa';

import { DataContext } from '../../context/DataContext';
import { useWindowContext } from '../../context/WindowContext';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const AiAutopilot = ({ setShowAiWorkflow }) => {
  const {
    cleanedData,
    fullData,
    uploadedData,
    pipelineResults,
    setShowAiReport,
    setAiReportReady,
  } = useContext(DataContext);
  const { restoreWindow, openWindow } = useWindowContext();

  const [isRunning, setIsRunning] = useState(false);
  const [pendingNodeIds, setPendingNodeIds] = useState([]);
  const [errorMessage, setErrorMessage] = useState(null);

  const hasDataset = useMemo(() => {
    if (Array.isArray(cleanedData) && cleanedData.length) return true;
    if (Array.isArray(fullData) && fullData.length) return true;
    if (uploadedData &&
      ((Array.isArray(uploadedData.data_preview) && uploadedData.data_preview.length) ||
        (Array.isArray(uploadedData.data) && uploadedData.data.length))) {
      return true;
    }
    return false;
  }, [cleanedData, fullData, uploadedData]);

  const waitForWorkflowImport = useCallback((spec) => {
    let attempts = 0;
    const maxAttempts = 20;

    const tryImport = () => {
      if (typeof window.importWorkflowSpec === 'function') {
        window.importWorkflowSpec(spec, { autoRun: true });
      } else if (attempts < maxAttempts) {
        attempts += 1;
        setTimeout(tryImport, 80);
      } else {
        console.warn('⚠️ AiAutopilot: AiWorkflowLab did not register importWorkflowSpec in time.');
      }
    };

    tryImport();
  }, []);

  const handleClick = useCallback(async () => {
    if (!hasDataset || isRunning) {
      if (!hasDataset) {
        setErrorMessage('No dataset is currently loaded.');
      }
      return;
    }

    setErrorMessage(null);
    setIsRunning(true);
    setPendingNodeIds([]);
    if (setAiReportReady) {
      setAiReportReady(false);
    }

    try {
      const payload = {
        cleanedData,
        fullData,
        uploadedData,
      };

      const response = await axios.post(`${API_URL}/api/autopilot`, payload);
      const spec = response.data;

      if (!spec || !Array.isArray(spec.nodes)) {
        console.log(' These', spec, 'nodes are present')
        throw new Error('Autopilot returned an invalid workflow specification.');
      }

      const nodeIds = spec.nodes.map((node) => node.id).filter(Boolean);
      setPendingNodeIds(nodeIds);

      if (typeof setShowAiWorkflow === 'function') {
        setShowAiWorkflow(true);
      }
      openWindow?.('aiWorkflowLab');
      restoreWindow?.('aiWorkflowLab');
      waitForWorkflowImport(spec);
      
    } catch (error) {
      console.error('❌ AiAutopilot failed:', error);
      setErrorMessage(error.message || 'Unable to start Autopilot.');
      setIsRunning(false);
    }
  }, [
    cleanedData,
    fullData,
    uploadedData,
    hasDataset,
    isRunning,
    openWindow,
    restoreWindow,
    setAiReportReady,
    setShowAiWorkflow,
    waitForWorkflowImport,
  ]);

  useEffect(() => {
    if (!isRunning || pendingNodeIds.length === 0) {
      return;
    }

    const nodesComplete = pendingNodeIds.every((id) => {
      const entry = pipelineResults?.[id];
      return entry && entry.status && entry.status !== 'pending';
    });

    if (!nodesComplete) {
      return;
    }

    const reportReady = pipelineResults?.ai_report?.status === 'success';

    setIsRunning(false);
    setPendingNodeIds([]);

    if (reportReady) {
      setShowAiReport?.(true);
      window.dispatchEvent(new CustomEvent('autopilot-workflow-ready', { detail: { target: 'aiWorkflowLab' } }));
    } else {
      setErrorMessage('Autopilot finished but the AI report could not be assembled.');
    }
  }, [isRunning, pendingNodeIds, pipelineResults, setErrorMessage, setShowAiReport]);

  return (
    <button
      type="button"
      className={`header-button autopilot-button${isRunning ? ' running' : ''}`}
      onClick={handleClick}
      disabled={!hasDataset || isRunning}
      aria-label="Run AI Insight Autopilot"
      title={errorMessage || 'Run AI Insight Autopilot'}
    >
      {isRunning ? (
        <FaSpinner className="autopilot-spinner" aria-hidden="true" />
      ) : (
        <FaMagic aria-hidden="true" />
      )}
    </button>
  );
};

export default AiAutopilot;

