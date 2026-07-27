import { useHelpOverlay } from '../../context/HelpOverlayContext';

import { useState, useCallback, useContext, useRef, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './AiWorkflowLab.css';
import './AiWorkflowLabDropZone.css';
import { AiCommandBlocks, AiCommandGroups } from './AiCommandBlock';
import AiWorkLabNodeSizer from './AiWorkLabNodeSizer';
import { useContextMenu } from '../../hooks/useContextMenu';
import ContextMenu from '../../context/ContextMenu';
import { DataContext } from '../../context/DataContext';
import AIPipeline from './AIPipeline';
import DropZoneNode from './DropZoneNode';
import { useWindowContext } from '../../context/WindowContext';
import { FiCopy, FiDownload, FiPlay, FiPlus, FiRefreshCw, FiSave, FiUpload, FiHelpCircle, FiSidebar, FiXCircle, FiClock, FiRotateCw } from 'react-icons/fi';
import {
  buildReactFlowGraph,
  buildWorkflowDefinition,
  createDropZoneNode,
  createEmptyWorkflowMeta,
  createWorkflowNode,
  DROPZONE_NODE_ID,
} from './workflowGraph';
import { workflowApi } from './workflowApi';

const parsePreview = (preview) => {
  if (!preview) return [];
  if (Array.isArray(preview)) return preview;
  if (typeof preview === 'string') {
    try {
      return JSON.parse(preview);
    } catch (err) {
      console.error('AiWorkflowLab failed to parse dataset preview:', err);
      return [];
    }
  }
  return [];
};

const ensureDropZone = (rfNodes) => {
  if (rfNodes.some((node) => node.id === DROPZONE_NODE_ID)) {
    return rfNodes;
  }
  return [...rfNodes, createDropZoneNode()];
};

const toWorkflowMeta = (definition = {}) => ({
  id: definition.id || null,
  name: definition.name || 'Untitled Workflow',
  description: definition.description || 'Business automation workflow',
  category: definition.category || 'Custom',
  isTemplate: Boolean(definition.is_template || definition.isTemplate),
  sourceWorkflowId: definition.source_workflow_id || definition.sourceWorkflowId || null,
  continueOnError: Boolean(definition.continue_on_error || definition.continueOnError),
});

function AiWorkflowLab({ label = 'AI WorkFlow Lab:', savedState }) {
  const {
    uploadedData,
    fullData,
    cleanedData,
    pipelineResults,
    setPipelineResults,
    setCleanedData,
  } = useContext(DataContext);
  const { saveWindowContentState } = useWindowContext();
  const initialNodes = ensureDropZone(savedState?.nodes || [createDropZoneNode()]);
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(savedState?.edges || []);
  const [workflowMeta, setWorkflowMeta] = useState(savedState?.workflowMeta || createEmptyWorkflowMeta());
  const [hasExecuted, setHasExecuted] = useState(false);
  const [isHighlighted, setIsHighlighted] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState(savedState?.selectedNodeId || null);
  const [catalog, setCatalog] = useState({ workflows: [], templates: [] });
  const [catalogStatus, setCatalogStatus] = useState('idle');
  const [catalogError, setCatalogError] = useState(null);
  const [runState, setRunState] = useState(null);
  const [inspectedRunState, setInspectedRunState] = useState(null);
  const [runUiError, setRunUiError] = useState(null);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
  const [runHistory, setRunHistory] = useState([]);
  const [runHistoryStatus, setRunHistoryStatus] = useState('idle');
  const [isCancelling, setIsCancelling] = useState(false);

  const { isHelpVisible, toggleHelp, closeHelp } = useHelpOverlay();
  const workflowRef = useRef(null);
  const fileInputRef = useRef(null);
  const { clicked, coords, setClicked } = useContextMenu(workflowRef);

  const dataset = useMemo(
    () => cleanedData || fullData || parsePreview(uploadedData?.data_preview),
    [cleanedData, fullData, uploadedData]
  );

  const workflowDefinition = useMemo(
    () => buildWorkflowDefinition({ workflowMeta, nodes, edges }),
    [workflowMeta, nodes, edges]
  );

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) || null,
    [nodes, selectedNodeId]
  );

  const refreshCatalog = useCallback(async () => {
    setCatalogStatus('loading');
    setCatalogError(null);
    try {
      const response = await workflowApi.list();
      setCatalog(response);
      setCatalogStatus('ready');
    } catch (error) {
      console.error('Failed to load workflows:', error);
      setCatalogStatus('error');
      setCatalogError(error.response?.data?.error || error.message || 'Unable to load workflows.');
    }
  }, []);

  useEffect(() => {
    refreshCatalog();
  }, [refreshCatalog]);

  const importWorkflowSpec = useCallback((spec, opts = {}) => {
    if (!spec || !Array.isArray(spec.nodes)) {
      console.warn('Invalid workflow specification', spec);
      return;
    }

    const graph = buildReactFlowGraph(spec);
    setNodes(graph.nodes);
    setEdges(graph.edges);
    setWorkflowMeta(toWorkflowMeta(spec));
    setSelectedNodeId(graph.nodes.find((node) => node.id !== DROPZONE_NODE_ID)?.id || null);
    setRunState(null);
    setInspectedRunState(null);
    setRunUiError(null);
    setPipelineResults({});
    setHasExecuted(false);

    if (opts.autoRun && typeof window.runAIPipeline === 'function') {
      window.setTimeout(() => window.runAIPipeline(), 80);
    }
  }, [setPipelineResults]);

  useEffect(() => {
    window.importWorkflowSpec = importWorkflowSpec;
    return () => {
      if (window.importWorkflowSpec === importWorkflowSpec) {
        delete window.importWorkflowSpec;
      }
    };
  }, [importWorkflowSpec]);

  useEffect(() => {
    let timeoutId;
    const handleAutopilotReady = () => {
      setIsHighlighted(true);
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => setIsHighlighted(false), 1800);
    };

    window.addEventListener('autopilot-workflow-ready', handleAutopilotReady);
    return () => {
      window.removeEventListener('autopilot-workflow-ready', handleAutopilotReady);
      window.clearTimeout(timeoutId);
    };
  }, []);

  const triggerDownload = useCallback((spec) => {
    const json = JSON.stringify(spec, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().replace(/[:T]/g, '-').split('.')[0];
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${(spec.name || 'workflow').replace(/\s+/g, '-').toLowerCase()}-${timestamp}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, []);

  const handleExportWorkflow = useCallback(() => {
    triggerDownload(workflowDefinition);
  }, [triggerDownload, workflowDefinition]);

  const handleRunWorkflow = useCallback(() => {
    if (typeof window.runAIPipeline === 'function') {
      window.runAIPipeline();
    }
  }, []);

  const refreshRunHistory = useCallback(async () => {
    if (!workflowMeta.id) {
      setRunHistory([]);
      return;
    }
    setRunHistoryStatus('loading');
    try {
      const response = await workflowApi.listRuns({ workflowId: workflowMeta.id, limit: 20 });
      setRunHistory(response.runs || []);
      setRunHistoryStatus('ready');
    } catch (error) {
      console.error('Failed to load run history:', error);
      setRunHistoryStatus('error');
    }
  }, [workflowMeta.id]);

  useEffect(() => {
    if (workflowMeta.id && isRightSidebarOpen) {
      refreshRunHistory();
    }
  }, [workflowMeta.id, isRightSidebarOpen, refreshRunHistory]);

  const handleCancelRun = useCallback(async () => {
    if (!runState?.run_id || isCancelling) return;
    setIsCancelling(true);
    try {
      const result = await workflowApi.cancelRun(runState.run_id);
      setRunState(result);
    } catch (error) {
      console.error('Failed to cancel run:', error);
      setRunUiError(error.response?.data?.error || error.message || 'Unable to cancel the workflow run.');
    } finally {
      setIsCancelling(false);
    }
  }, [runState, isCancelling]);

  const handleSelectRun = useCallback(async (runId) => {
    if (!runId) return;
    try {
      const run = await workflowApi.getRun(runId);
      setInspectedRunState(runState?.run_id === runId ? null : run);
      setRunUiError(null);
      // Update pipeline results from the stored run
      if (run.results) {
        const merged = {};
        Object.entries(run.node_states || {}).forEach(([nodeId, nodeState]) => {
          const resultEntry = (run.results || {})[nodeId] || {};
          merged[nodeId] = {
            status: resultEntry.status || nodeState.status || 'idle',
            result: resultEntry.result || null,
            error: resultEntry.error || nodeState.error || null,
            command: resultEntry.command || nodeState.command || null,
            label: resultEntry.label || nodeState.label || nodeId,
          };
        });
        setPipelineResults(merged);
      }
    } catch (error) {
      console.error('Failed to load run:', error);
      setRunHistoryStatus('error');
    }
  }, [runState?.run_id, setPipelineResults]);

  const handleRefreshCurrentRun = useCallback(async () => {
    if (!runState?.run_id) return;
    try {
      const refreshed = await workflowApi.getRun(runState.run_id);
      setRunState(refreshed);
      setRunUiError(null);
    } catch (error) {
      console.error('Failed to refresh current run:', error);
      setRunUiError(error.response?.data?.error || error.message || 'Current run status is unavailable.');
    }
  }, [runState?.run_id]);

  const handleReturnToLiveRun = useCallback(() => {
    setInspectedRunState(null);
    if (!runState?.results) return;

    const merged = {};
    Object.entries(runState.node_states || {}).forEach(([nodeId, nodeState]) => {
      const resultEntry = (runState.results || {})[nodeId] || {};
      merged[nodeId] = {
        status: resultEntry.status || nodeState.status || 'idle',
        result: resultEntry.result || null,
        error: resultEntry.error || nodeState.error || null,
        command: resultEntry.command || nodeState.command || null,
        label: resultEntry.label || nodeState.label || nodeId,
      };
    });
    setPipelineResults(merged);
  }, [runState, setPipelineResults]);

  const handleActiveRunStateChange = useCallback((nextRunState) => {
    setRunState(nextRunState);
    if (nextRunState === null) {
      // Starting a new run always returns the execution panel to live state.
      setInspectedRunState(null);
      setRunUiError(null);
      return;
    }

    if (
      isRightSidebarOpen
      && ['completed', 'failed', 'cancelled', 'interrupted'].includes(nextRunState.status)
    ) {
      refreshRunHistory();
    }
  }, [isRightSidebarOpen, refreshRunHistory]);

  const handleExecuteDrop = useCallback(() => {
    handleRunWorkflow();
  }, [handleRunWorkflow]);

  const checkOverlapAndTrigger = useCallback(
    (node) => {
      const dropZoneElement = document.querySelector(`[data-id='${DROPZONE_NODE_ID}']`);
      const nodeEl = document.querySelector(`[data-id='${node.id}']`);
      if (!dropZoneElement || !nodeEl) return;

      const dropZoneRect = dropZoneElement.getBoundingClientRect();
      const nodeRect = nodeEl.getBoundingClientRect();

      const isIntersecting = !(
        nodeRect.right < dropZoneRect.left ||
        nodeRect.left > dropZoneRect.right ||
        nodeRect.bottom < dropZoneRect.top ||
        nodeRect.top > dropZoneRect.bottom
      );

      setNodes((prevNodes) => prevNodes.map((currentNode) => (
        currentNode.id === DROPZONE_NODE_ID
          ? { ...currentNode, data: { ...currentNode.data, hovering: isIntersecting } }
          : currentNode
      )));

      if (isIntersecting && !hasExecuted) {
        setHasExecuted(true);
        handleExecuteDrop();
      } else if (!isIntersecting && hasExecuted) {
        setHasExecuted(false);
      }
    },
    [handleExecuteDrop, hasExecuted]
  );

  const onConnect = useCallback((params) => {
    setEdges((currentEdges) => addEdge(params, currentEdges));
  }, []);

  const onNodesChange = useCallback((changes) => {
    setNodes((currentNodes) => {
      const updatedNodes = applyNodeChanges(changes, currentNodes);
      const draggedNode = changes.find((change) => change.type === 'position' || change.type === 'dimensions');

      if (draggedNode?.id) {
        const currentNode = updatedNodes.find((node) => node.id === draggedNode.id);
        if (currentNode?.data?.command === '/execute') {
          checkOverlapAndTrigger(currentNode);
        }
      }

      return updatedNodes;
    });
  }, [checkOverlapAndTrigger]);

  const onEdgesChange = useCallback((changes) => {
    setEdges((currentEdges) => applyEdgeChanges(changes, currentEdges));
  }, []);

  const handleAddNode = useCallback((type, positionOverride = null) => {
    const newNode = createWorkflowNode(
      type,
      positionOverride || {
        x: Math.max(coords.x - 140, 80),
        y: Math.max(coords.y - 80, 120),
      }
    );

    if (!newNode) {
      return;
    }

    setNodes((prevNodes) => [...prevNodes, newNode]);
    setSelectedNodeId(newNode.id);
    setIsRightSidebarOpen(true);
    setClicked(false);
  }, [coords, setClicked]);

  const handlePaletteAddNode = useCallback((type) => {
    const existingNodeCount = nodes.filter((node) => node.id !== DROPZONE_NODE_ID).length;
    handleAddNode(type, {
      x: 180 + (existingNodeCount % 3) * 260,
      y: 140 + Math.floor(existingNodeCount / 3) * 160,
    });
  }, [handleAddNode, nodes]);

  const updateWorkflowMeta = useCallback((key, value) => {
    setWorkflowMeta((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateSelectedNodeField = useCallback((field, value) => {
    if (!selectedNodeId) return;
    setNodes((prevNodes) => prevNodes.map((node) => {
      if (node.id !== selectedNodeId) {
        return node;
      }
      return {
        ...node,
        data: {
          ...node.data,
          [field]: value,
        },
      };
    }));
  }, [selectedNodeId]);

  const updateSelectedNodeParam = useCallback((key, value) => {
    if (!selectedNodeId) return;
    setNodes((prevNodes) => prevNodes.map((node) => {
      if (node.id !== selectedNodeId) {
        return node;
      }
      return {
        ...node,
        data: {
          ...node.data,
          params: {
            ...(node.data?.params || {}),
            [key]: value,
          },
        },
      };
    }));
  }, [selectedNodeId]);

  const handleSelectWorkflow = useCallback(async (workflowId) => {
    if (!workflowId) {
      return;
    }
    try {
      const workflow = await workflowApi.get(workflowId);
      importWorkflowSpec(workflow);
    } catch (error) {
      console.error('Failed to load workflow:', error);
      alert(error.response?.data?.error || 'Unable to load workflow.');
    }
  }, [importWorkflowSpec]);

  const handleCreateFromTemplate = useCallback(async (templateId) => {
    if (!templateId) {
      return;
    }
    try {
      const created = await workflowApi.createFromTemplate(templateId);
      await refreshCatalog();
      importWorkflowSpec(created);
    } catch (error) {
      console.error('Failed to create workflow from template:', error);
      alert(error.response?.data?.error || 'Unable to create workflow from template.');
    }
  }, [importWorkflowSpec, refreshCatalog]);

  const handleSaveWorkflow = useCallback(async (saveAsNew = false) => {
    try {
      const payload = {
        ...workflowDefinition,
        id: saveAsNew ? null : workflowDefinition.id,
        is_template: false,
      };
      const saved = payload.id
        ? await workflowApi.update(payload.id, payload)
        : await workflowApi.create(payload);
      setWorkflowMeta(toWorkflowMeta(saved));
      await refreshCatalog();
    } catch (error) {
      console.error('Failed to save workflow:', error);
      alert(error.response?.data?.error || 'Unable to save workflow.');
    }
  }, [refreshCatalog, workflowDefinition]);

  const handleDuplicateWorkflow = useCallback(async () => {
    try {
      let workflowId = workflowMeta.id;
      if (!workflowId) {
        const created = await workflowApi.create({
          ...workflowDefinition,
          is_template: false,
        });
        workflowId = created.id;
      }
      const duplicate = await workflowApi.duplicate(workflowId);
      await refreshCatalog();
      importWorkflowSpec(duplicate);
    } catch (error) {
      console.error('Failed to duplicate workflow:', error);
      alert(error.response?.data?.error || 'Unable to duplicate workflow.');
    }
  }, [importWorkflowSpec, refreshCatalog, workflowDefinition, workflowMeta.id]);

  const handleNewWorkflow = useCallback(() => {
    setNodes([createDropZoneNode()]);
    setEdges([]);
    setWorkflowMeta(createEmptyWorkflowMeta());
    setSelectedNodeId(null);
    setRunState(null);
    setInspectedRunState(null);
    setRunUiError(null);
    setPipelineResults({});
  }, [setPipelineResults]);

  const handleLoadWorkflowClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleWorkflowFileChange = useCallback((event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const text = loadEvent.target?.result;
        const parsed = JSON.parse(text);
        if (!parsed || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
          throw new Error('Workflow file is missing nodes or edges.');
        }
        importWorkflowSpec(parsed);
      } catch (error) {
        console.error('Failed to load workflow file', error);
        alert(error.message || 'Unable to load workflow JSON.');
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };

    reader.readAsText(file);
  }, [importWorkflowSpec]);

  useEffect(() => {
    saveWindowContentState('aiWorkflowLab', {
      nodes,
      edges,
      workflowMeta,
      selectedNodeId,
    });
  }, [nodes, edges, workflowMeta, selectedNodeId, saveWindowContentState]);

  const renderedNodes = nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      status: pipelineResults[node.id]?.status || 'idle',
      result: pipelineResults[node.id]?.result || null,
      error: pipelineResults[node.id]?.error || null,
    },
  }));

  const displayedRunState = inspectedRunState || runState;
  const runStatusLabel = displayedRunState?.status
    ? displayedRunState.status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Idle';
  const runProgress = displayedRunState?.progress || { total: workflowDefinition.execution_order.length, completed: 0, failed: 0, running: 0 };
  const isRunActive = !inspectedRunState && !runUiError && (runState?.status === 'running' || runState?.status === 'cancel_requested');
  const isTerminal = ['completed', 'failed', 'cancelled', 'interrupted'].includes(displayedRunState?.status);

  return (
    <div
      ref={workflowRef}
      className={`ai-workflow-lab-container${isHighlighted ? ' autopilot-highlight' : ''}`}
    >
      {isHelpVisible('aiFlow') && (
        <div className="help-overlay visible" style={{ zIndex: 9999, position: 'fixed', top: 0, left: 0 }}>
          <div className="help-overlay-content">
            <span className="help-overlay-close" onClick={() => closeHelp('aiFlow')}>
              ×
            </span>
            <h3>Business Automation Pipelines</h3>
            <ol>
              <li>Save workflows as reusable business automations with names, descriptions, and step layouts.</li>
              <li>Use templates as starting points for cleaning, insight generation, reporting, and AI analysis.</li>
              <li>Arrange steps visually and connect them to define execution order and dependencies.</li>
              <li>Run the full pipeline to track each step as idle, running, completed, or failed.</li>
              <li>Use the step details panel to keep node configuration business-focused instead of technical.</li>
            </ol>
          </div>
        </div>
      )}

      <header className="wf-header">
        <div className="wf-header-left">
          <div className="wf-name-container">
            <div className="wf-kicker">Automation Pipeline</div>
            <input
              className="wf-name-input"
              value={workflowMeta.name}
              onChange={(event) => updateWorkflowMeta('name', event.target.value)}
              placeholder="Quarterly revenue analysis"
            />
          </div>
        </div>

        <div className="wf-header-actions">
          <button type="button" className="wf-btn primary" onClick={handleRunWorkflow}>
            <FiPlay aria-hidden="true" />
            <span>Run</span>
          </button>
          <button type="button" className="wf-btn" onClick={() => handleSaveWorkflow(false)} title="Save changes">
            <FiSave aria-hidden="true" />
            <span>Save</span>
          </button>
          <div style={{ width: '1px', height: '24px', background: '#e2e8f0', margin: '0 4px' }} />
          <button type="button" className="wf-btn subtle icon-only" onClick={() => handleSaveWorkflow(true)} title="Save As New">
            <FiPlus aria-hidden="true" />
          </button>
          <button type="button" className="wf-btn subtle icon-only" onClick={handleDuplicateWorkflow} title="Duplicate">
            <FiCopy aria-hidden="true" />
          </button>
          <button type="button" className="wf-btn subtle icon-only" onClick={handleExportWorkflow} title="Export JSON">
            <FiDownload aria-hidden="true" />
          </button>
          <button type="button" className="wf-btn subtle icon-only" onClick={handleLoadWorkflowClick} title="Import JSON">
            <FiUpload aria-hidden="true" />
          </button>
          <button type="button" className="wf-btn subtle icon-only" onClick={handleNewWorkflow} title="Clear All">
            <FiRefreshCw aria-hidden="true" />
          </button>
          <button type="button" className="wf-btn subtle icon-only" onClick={() => toggleHelp('aiFlow')} title="Help">
            <FiHelpCircle aria-hidden="true" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="workflow-toolbar-file-input"
            onChange={handleWorkflowFileChange}
          />
        </div>
        <button type="button" className={`wf-btn subtle icon-only ${isRightSidebarOpen ? 'active' : ''}`} onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)} title="Toggle Panel">
            <FiSidebar aria-hidden="true" />
          </button>
      </header>

      <div className="wf-body">
        <aside className="wf-sidebar">
          <div className="wf-panel-section">
            <div className="wf-panel-title">Workflow Config</div>
            <div className="wf-field">
              <label>Description</label>
              <textarea
                className="wf-textarea"
                rows={3}
                value={workflowMeta.description}
                onChange={(event) => updateWorkflowMeta('description', event.target.value)}
                placeholder="Explain what this automation does for business users."
              />
            </div>

            <div className="wf-field">
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={workflowMeta.continueOnError}
                  onChange={(event) => updateWorkflowMeta('continueOnError', event.target.checked)}
                />
                <span>Continue if a step fails</span>
              </label>
            </div>

            <div className="wf-field">
              <label>Saved Workflows</label>
              <select className="wf-select" value="" onChange={(event) => handleSelectWorkflow(event.target.value)}>
                <option value="">Open saved workflow</option>
                {catalog.workflows.map((workflow) => (
                  <option key={workflow.id} value={workflow.id}>{workflow.name}</option>
                ))}
              </select>
            </div>

            <div className="wf-field">
              <label>Templates</label>
              <select className="wf-select" value="" onChange={(event) => handleCreateFromTemplate(event.target.value)}>
                <option value="">Create from template</option>
                {catalog.templates.map((template) => (
                  <option key={template.id} value={template.id}>{template.name}</option>
                ))}
              </select>
            </div>
            
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px' }}>
              {catalogStatus === 'loading' && 'Syncing catalog...'}
              {catalogStatus === 'error' && catalogError}
              {catalogStatus === 'ready' && `${catalog.workflows.length} workflows, ${catalog.templates.length} templates`}
            </div>
          </div>

          <div className="wf-panel-section">
            <div className="wf-panel-title">Node Library</div>
            {Object.entries(AiCommandGroups).map(([groupName, groupNodes]) => (
              <div key={groupName} className="wf-node-group">
                <div className="wf-node-group-title">{groupName}</div>
                <div className="wf-node-list">
                  {groupNodes.map((command) => (
                    <button
                      key={command.id}
                      type="button"
                      className="wf-node-item"
                      onClick={() => handlePaletteAddNode(Object.keys(AiCommandBlocks).find((key) => AiCommandBlocks[key].id === command.id))}
                    >
                      <span className="wf-node-item-title">{command.businessLabel || command.display}</span>
                      <span className="wf-node-item-desc">{command.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <main className="wf-canvas-area">
          <ReactFlow
            nodes={renderedNodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => {
              setSelectedNodeId(node.id);
              if (node.id !== DROPZONE_NODE_ID) {
                setIsRightSidebarOpen(true);
              }
            }}
            onPaneClick={() => setIsRightSidebarOpen(false)}
            fitView
            nodeTypes={{
              AiWorkLabNodeSizer,
              dropZoneNode: DropZoneNode,
            }}
          >
            <Background />
            <Controls />
          </ReactFlow>

          {clicked && (
            <ContextMenu
              x={coords.x}
              y={coords.y}
              options={Object.keys(AiCommandBlocks).map((key) => ({
                id: key,
                label: `Add ${AiCommandBlocks[key].display}`,
              }))}
              onSelect={handleAddNode}
            />
          )}
        </main>

        <aside className={`wf-sidebar right ${isRightSidebarOpen ? 'open' : ''}`}>
          <div className="wf-panel-section">
            <div className="wf-panel-title">Execution</div>
            {inspectedRunState && (
              <div className="wf-history-inspection" role="status">
                <span>
                  Viewing saved run from{' '}
                  {inspectedRunState.started_at
                    ? new Date(inspectedRunState.started_at).toLocaleString()
                    : 'an unknown start time'}.
                  {runState?.status === 'running' || runState?.status === 'cancel_requested'
                    ? ' A current run is still active.'
                    : ''}
                </span>
                <button
                  type="button"
                  className="wf-btn subtle"
                  onClick={handleReturnToLiveRun}
                >
                  Return to Current Run
                </button>
              </div>
            )}
            {runUiError && !inspectedRunState && (
              <div className="wf-empty-state wf-error-state" role="alert">
                <div>{runUiError}</div>
                <div>Live status may be stale. Refresh it before taking another action.</div>
                {runState?.run_id && (
                  <button
                    type="button"
                    className="wf-btn subtle"
                    onClick={handleRefreshCurrentRun}
                  >
                    Refresh Current Run
                  </button>
                )}
              </div>
            )}
            <div className="wf-run-stats">
              <div className="wf-stat-card">
                <span className="wf-stat-val">{runProgress.completed}</span>
                <span className="wf-stat-label">Done</span>
              </div>
              <div className="wf-stat-card">
                <span className="wf-stat-val" style={{ color: '#2563eb' }}>{runProgress.running}</span>
                <span className="wf-stat-label">Active</span>
              </div>
              <div className="wf-stat-card">
                <span className="wf-stat-val" style={{ color: '#ef4444' }}>{runProgress.failed}</span>
                <span className="wf-stat-label">Fail</span>
              </div>
            </div>

            <div className="wf-field">
              <label>
                Status:{' '}
                <span
                  className={`wf-status-badge wf-status-${(displayedRunState?.status || 'idle').replace(/_/g, '-')}`}
                  role="status"
                  aria-live="polite"
                >
                  {runStatusLabel}
                </span>
              </label>
            </div>

            {/* Cancel button — visible when run is active */}
            {isRunActive && (
              <button
                type="button"
                className="wf-btn wf-btn-cancel"
                onClick={handleCancelRun}
                disabled={isCancelling || runState?.status === 'cancel_requested'}
                aria-label={runState?.status === 'cancel_requested' ? 'Cancellation pending' : 'Cancel workflow run'}
                title={runState?.status === 'cancel_requested'
                  ? 'Cancellation requested — waiting for current node to finish'
                  : 'Cancel this workflow run'}
              >
                <FiXCircle aria-hidden="true" />
                <span>{runState?.status === 'cancel_requested' ? 'Cancelling…' : 'Cancel Run'}</span>
              </button>
            )}

            {/* Retry placeholder — visibly disabled and labeled as unavailable */}
            {isTerminal && (
              <button
                type="button"
                className="wf-btn wf-btn-retry-placeholder"
                disabled
                aria-disabled="true"
                title="Retry is not yet available. An idempotency and side-effect contract is required before retry can be safely enabled."
              >
                <FiRotateCw aria-hidden="true" />
                <span>Retry (Coming Later)</span>
              </button>
            )}

            {/* Timestamps */}
            {displayedRunState?.started_at && (
              <div className="wf-run-timestamp">
                <FiClock aria-hidden="true" size={12} />
                <span>Started: {new Date(displayedRunState.started_at).toLocaleString()}</span>
              </div>
            )}
            {displayedRunState?.finished_at && (
              <div className="wf-run-timestamp">
                <FiClock aria-hidden="true" size={12} />
                <span>Finished: {new Date(displayedRunState.finished_at).toLocaleString()}</span>
              </div>
            )}

            <div className="wf-panel-title" style={{ marginTop: '20px' }}>Sequence</div>
            <ol className="wf-exec-list">
              {workflowDefinition.execution_order.map((nodeId) => {
                const currentNode = workflowDefinition.nodes.find((node) => node.id === nodeId);
                const nodeState = displayedRunState?.node_states?.[nodeId];
                return (
                  <li
                    key={nodeId}
                    className={`wf-exec-item ${nodeState?.status ? `wf-exec-${nodeState.status}` : ''}`}
                  >
                    {currentNode?.label || nodeId}
                    {nodeState?.status && nodeState.status !== 'idle' && (
                      <span className={`wf-exec-status-badge wf-exec-status-${nodeState.status}`}>
                        {nodeState.status}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>

          {/* Run History Panel */}
          <div className="wf-panel-section">
            <div className="wf-panel-title">
              Run History
              <button
                type="button"
                className="wf-btn subtle icon-only"
                onClick={refreshRunHistory}
                title="Refresh run history"
                aria-label="Refresh run history"
                style={{ marginLeft: 'auto', padding: '4px' }}
              >
                <FiRefreshCw size={12} aria-hidden="true" />
              </button>
            </div>
            {runHistoryStatus === 'loading' && (
              <div className="wf-empty-state">Loading history…</div>
            )}
            {runHistoryStatus === 'error' && (
              <div className="wf-empty-state wf-error-state">Failed to load history.</div>
            )}
            {runHistoryStatus === 'ready' && runHistory.length === 0 && (
              <div className="wf-empty-state">No prior runs found.</div>
            )}
            {runHistory.length > 0 && (
              <ul className="wf-run-history-list" aria-label="Run history">
                {runHistory.map((run) => (
                  <li key={run.run_id} className="wf-run-history-item">
                    <button
                      type="button"
                      className={`wf-run-history-btn${displayedRunState?.run_id === run.run_id ? ' active' : ''}`}
                      onClick={() => handleSelectRun(run.run_id)}
                      aria-pressed={displayedRunState?.run_id === run.run_id}
                      aria-label={`${run.workflow_name || 'Run'} — ${run.status}`}
                    >
                      <span className={`wf-status-dot wf-status-dot-${(run.status || 'idle').replace(/_/g, '-')}`} />
                      <span className="wf-run-history-name">{run.workflow_name || 'Unnamed'}</span>
                      <span className="wf-run-history-status">{(run.status || 'idle').replace(/_/g, ' ')}</span>
                      <span className="wf-run-history-time">
                        {run.started_at ? new Date(run.started_at).toLocaleString() : '—'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="wf-panel-section">
            <div className="wf-panel-title">Step Inspector</div>
            {!selectedNode || selectedNode.id === DROPZONE_NODE_ID ? (
              <div style={{ fontSize: '13px', color: '#94a3b8', textAlign: 'center', padding: '20px 0' }}>
                Select a step on the canvas to configure business logic.
              </div>
            ) : (
              <div className="wf-node-inspector">
                <div className="wf-field">
                  <label>Step name</label>
                  <input
                    className="wf-input"
                    value={selectedNode.data?.label || ''}
                    onChange={(event) => updateSelectedNodeField('label', event.target.value)}
                  />
                </div>
                <div className="wf-field">
                  <label>Business description</label>
                  <textarea
                    className="wf-textarea"
                    rows={2}
                    value={selectedNode.data?.description || ''}
                    onChange={(event) => updateSelectedNodeField('description', event.target.value)}
                  />
                </div>
                <div className="wf-field">
                  <label>{selectedNode.data?.command === '/clean' ? 'Cleaning instructions' : 'Business focus'}</label>
                  <textarea
                    className="wf-textarea"
                    rows={4}
                    value={selectedNode.data?.command === '/clean'
                      ? selectedNode.data?.params?.instructions || ''
                      : selectedNode.data?.params?.focus || ''}
                    onChange={(event) => updateSelectedNodeParam(
                      selectedNode.data?.command === '/clean' ? 'instructions' : 'focus',
                      event.target.value
                    )}
                    placeholder={selectedNode.data?.command === '/clean'
                      ? 'Describe how this step should clean the dataset.'
                      : 'Describe what this step should emphasize for business users.'}
                  />
                </div>
                {selectedNode.data?.command !== '/clean' && (
                  <div className="wf-field">
                    <label>Business goal</label>
                    <input
                      className="wf-input"
                      value={selectedNode.data?.params?.goal || ''}
                      onChange={(event) => updateSelectedNodeParam('goal', event.target.value)}
                      placeholder="Optional outcome guidance"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>

      <AIPipeline
        workflowDefinition={workflowDefinition}
        dataset={dataset}
        onResults={setPipelineResults}
        onDataCleaned={setCleanedData}
        onRunStateChange={handleActiveRunStateChange}
        onRunError={setRunUiError}
      />
    </div>
  );
}

export default AiWorkflowLab;
