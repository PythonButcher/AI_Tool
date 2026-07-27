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
import LibraryDrawerWrapper from './LibraryDrawerWrapper';

import { AiCommandBlocks, AiCommandGroups } from './AiCommandBlock';
import AiWorkLabNodeSizer from './AiWorkLabNodeSizer';
import { useContextMenu } from '../../hooks/useContextMenu';
import ContextMenu from '../../context/ContextMenu';
import { DataContext } from '../../context/DataContext';
import AIPipeline from './AIPipeline';
import DropZoneNode from './DropZoneNode';
import { useWindowContext } from '../../context/WindowContext';
import {
  FiCopy,
  FiDownload,
  FiPlay,
  FiPlus,
  FiRefreshCw,
  FiSave,
  FiUpload,
  FiHelpCircle,
  FiXCircle,
  FiClock,
  FiRotateCw,
  FiSearch,
  FiCheck,
  FiX,
  FiSlash,
  FiZap,
  FiLoader,
  FiAlertTriangle,
  FiArrowLeft,
  FiLayers,
  FiBookmark,
  FiGrid,
  FiActivity,
  FiList,
  FiMousePointer,
} from 'react-icons/fi';
import {
  buildReactFlowGraph,
  buildWorkflowDefinition,
  createDropZoneNode,
  createEmptyWorkflowMeta,
  createWorkflowNode,
  DROPZONE_NODE_ID,
} from './workflowGraph';
import { workflowApi } from './workflowApi';

/* ── Helpers ──────────────────────────────────────────────────────── */

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

/** Relative time formatter */
const relativeTime = (dateStr) => {
  if (!dateStr) return '—';
  const timestamp = new Date(dateStr).getTime();
  if (!Number.isFinite(timestamp)) return 'Unknown time';
  const diff = Math.max(0, Date.now() - timestamp);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

/** Compact elapsed-time formatter for completed run summaries. */
const formatDuration = (startedAt, finishedAt) => {
  if (!startedAt || !finishedAt) return null;
  const started = new Date(startedAt).getTime();
  const finished = new Date(finishedAt).getTime();
  if (!Number.isFinite(started) || !Number.isFinite(finished) || finished < started) return null;
  const seconds = Math.max(0, Math.round((finished - started) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
};

// Circle icon — react-icons/fi does not export FiCircle
const FiCircle = (props) => (
  <svg viewBox="0 0 24 24" width={props.size || 16} height={props.size || 16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="12" r="10" />
  </svg>
);

/** Status icon mapping for execution rail and history */
const STATUS_ICONS = {
  idle: FiCircle,
  queued: FiClock,
  running: FiLoader,
  cancel_requested: FiSlash,
  cancelled: FiSlash,
  completed: FiCheck,
  failed: FiX,
  interrupted: FiZap,
  skipped: FiSlash,
};

/* ════════════════════════════════════════════════════════════════════
   AiWorkflowLab — Workflow Studio
   ════════════════════════════════════════════════════════════════════ */

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

  /* ── Core workflow state ──────────────────────────────────────── */
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
  const [runHistory, setRunHistory] = useState([]);
  const [runHistoryStatus, setRunHistoryStatus] = useState('idle');
  const [isCancelling, setIsCancelling] = useState(false);

  /* ── Studio-specific UI state ─────────────────────────────────── */
  const [commandDockTab, setCommandDockTab] = useState('steps');
  const [contextPanelTab, setContextPanelTab] = useState('inspector');
  const [nodeFilter, setNodeFilter] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('All');
  const [isLibraryOpen, setIsLibraryOpen] = useState(
    () => !savedState?.nodes?.some((node) => node.id !== DROPZONE_NODE_ID)
  );
  const [isContextPanelOpen, setIsContextPanelOpen] = useState(false);

  const { isHelpVisible, toggleHelp, closeHelp } = useHelpOverlay();
  const workflowRef = useRef(null);
  const fileInputRef = useRef(null);
  const { clicked, coords, setClicked } = useContextMenu(workflowRef);

  /* ── Derived data ─────────────────────────────────────────────── */

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

  const displayedRunState = inspectedRunState || runState;
  const runStatusLabel = displayedRunState?.status
    ? displayedRunState.status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Idle';
  const runProgress = displayedRunState?.progress || {
    total: workflowDefinition.execution_order.length,
    completed: 0,
    failed: 0,
    running: 0,
  };
  const hasActiveLiveRun = ['queued', 'running', 'cancel_requested'].includes(runState?.status);
  const isRunActive = !inspectedRunState && hasActiveLiveRun;
  const isTerminal = ['completed', 'failed', 'cancelled', 'interrupted'].includes(
    displayedRunState?.status
  );
  const isViewingHistory = Boolean(inspectedRunState);
  const statusClass = (displayedRunState?.status || 'idle').replace(/_/g, '-');
  const progressPercent =
    runProgress.total > 0
      ? Math.round(((runProgress.completed + runProgress.failed) / runProgress.total) * 100)
      : 0;

  /* ── Catalog & History ────────────────────────────────────────── */

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
    if (workflowMeta.id && contextPanelTab === 'history') {
      refreshRunHistory();
    }
  }, [workflowMeta.id, contextPanelTab, refreshRunHistory]);

  /* ── Workflow import / spec handling ──────────────────────────── */

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

  /* ── File operations ──────────────────────────────────────────── */

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

  /* ── Run lifecycle ────────────────────────────────────────────── */

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
      setInspectedRunState(null);
      setRunUiError(null);
      return;
    }
    if (
      contextPanelTab === 'history' &&
      ['completed', 'failed', 'cancelled', 'interrupted'].includes(nextRunState.status)
    ) {
      refreshRunHistory();
    }
  }, [contextPanelTab, refreshRunHistory]);

  /* ── Canvas interaction ───────────────────────────────────────── */

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

      setNodes((prevNodes) =>
        prevNodes.map((currentNode) =>
          currentNode.id === DROPZONE_NODE_ID
            ? { ...currentNode, data: { ...currentNode.data, hovering: isIntersecting } }
            : currentNode
        )
      );

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

  const onNodesChange = useCallback(
    (changes) => {
      setNodes((currentNodes) => {
        const updatedNodes = applyNodeChanges(changes, currentNodes);
        const draggedNode = changes.find(
          (change) => change.type === 'position' || change.type === 'dimensions'
        );
        if (draggedNode?.id) {
          const currentNode = updatedNodes.find((node) => node.id === draggedNode.id);
          if (currentNode?.data?.command === '/execute') {
            checkOverlapAndTrigger(currentNode);
          }
        }
        return updatedNodes;
      });
    },
    [checkOverlapAndTrigger]
  );

  const onEdgesChange = useCallback((changes) => {
    setEdges((currentEdges) => applyEdgeChanges(changes, currentEdges));
  }, []);

  /* ── Node management ──────────────────────────────────────────── */

  const handleAddNode = useCallback(
    (type, positionOverride = null) => {
      const newNode = createWorkflowNode(
        type,
        positionOverride || {
          x: Math.max(coords.x - 140, 80),
          y: Math.max(coords.y - 80, 120),
        }
      );
      if (!newNode) return;
      setNodes((prevNodes) => [...prevNodes, newNode]);
      setSelectedNodeId(newNode.id);
      setContextPanelTab('inspector');
      setClicked(false);
    },
    [coords, setClicked]
  );

  const handlePaletteAddNode = useCallback(
    (type) => {
      const existingNodeCount = nodes.filter((node) => node.id !== DROPZONE_NODE_ID).length;
      handleAddNode(type, {
        x: 180 + (existingNodeCount % 3) * 260,
        y: 140 + Math.floor(existingNodeCount / 3) * 160,
      });
    },
    [handleAddNode, nodes]
  );

  const updateWorkflowMeta = useCallback((key, value) => {
    setWorkflowMeta((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateSelectedNodeField = useCallback(
    (field, value) => {
      if (!selectedNodeId) return;
      setNodes((prevNodes) =>
        prevNodes.map((node) => {
          if (node.id !== selectedNodeId) return node;
          return { ...node, data: { ...node.data, [field]: value } };
        })
      );
    },
    [selectedNodeId]
  );

  const updateSelectedNodeParam = useCallback(
    (key, value) => {
      if (!selectedNodeId) return;
      setNodes((prevNodes) =>
        prevNodes.map((node) => {
          if (node.id !== selectedNodeId) return node;
          return {
            ...node,
            data: {
              ...node.data,
              params: { ...(node.data?.params || {}), [key]: value },
            },
          };
        })
      );
    },
    [selectedNodeId]
  );

  /* ── Workflow CRUD ────────────────────────────────────────────── */

  const handleSelectWorkflow = useCallback(
    async (workflowId) => {
      if (!workflowId) return;
      try {
        const workflow = await workflowApi.get(workflowId);
        importWorkflowSpec(workflow);
      } catch (error) {
        console.error('Failed to load workflow:', error);
        alert(error.response?.data?.error || 'Unable to load workflow.');
      }
    },
    [importWorkflowSpec]
  );

  const handleCreateFromTemplate = useCallback(
    async (templateId) => {
      if (!templateId) return;
      try {
        const created = await workflowApi.createFromTemplate(templateId);
        await refreshCatalog();
        importWorkflowSpec(created);
      } catch (error) {
        console.error('Failed to create workflow from template:', error);
        alert(error.response?.data?.error || 'Unable to create workflow from template.');
      }
    },
    [importWorkflowSpec, refreshCatalog]
  );

  const handleSaveWorkflow = useCallback(
    async (saveAsNew = false) => {
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
    },
    [refreshCatalog, workflowDefinition]
  );

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

  const handleWorkflowFileChange = useCallback(
    (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
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
    },
    [importWorkflowSpec]
  );

  /* ── Persist state ────────────────────────────────────────────── */

  useEffect(() => {
    saveWindowContentState('aiWorkflowLab', {
      nodes,
      edges,
      workflowMeta,
      selectedNodeId,
    });
  }, [nodes, edges, workflowMeta, selectedNodeId, saveWindowContentState]);

  /* ── Rendered nodes with status ───────────────────────────────── */

  const renderedNodes = nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      status: pipelineResults[node.id]?.status || 'idle',
      result: pipelineResults[node.id]?.result || null,
      error: pipelineResults[node.id]?.error || null,
    },
  }));

  /* ── Filtered command groups ──────────────────────────────────── */

  const visibleCommands = useMemo(() => {
    const q = nodeFilter.toLowerCase();
    return Object.entries(AiCommandGroups).flatMap(([groupName, groupNodes]) =>
      groupNodes
        .filter(
          (cmd) =>
            (selectedGroup === 'All' || selectedGroup === groupName) &&
            (!q ||
          (cmd.businessLabel || '').toLowerCase().includes(q) ||
          (cmd.display || '').toLowerCase().includes(q) ||
              (cmd.description || '').toLowerCase().includes(q))
        )
        .map((command) => ({ ...command, groupName }))
    );
  }, [nodeFilter, selectedGroup]);

  // --- Library Popout Logic ---
  const [isLibraryPoppedOut, setIsLibraryPoppedOut] = useState(false);
  const [libraryPopupRoot, setLibraryPopupRoot] = useState(null);
  const libraryPopupWindowRef = useRef(null);
  const isClosingLibraryPopupRef = useRef(false);

  const closeLibraryPopupWindow = useCallback(() => {
    const popupWindow = libraryPopupWindowRef.current;
    libraryPopupWindowRef.current = null;
    setLibraryPopupRoot(null);
    if (popupWindow && !popupWindow.closed) {
      popupWindow.close();
    }
  }, []);

  const prepareLibraryPopupWindow = useCallback((popupWindow) => {
    const popupDocument = popupWindow.document;
    popupDocument.open();
    popupDocument.write('<!doctype html><html><head><title>Add a Step</title></head><body><div id="library-popout-root"></div></body></html>');
    popupDocument.close();
    document.querySelectorAll('link[rel="stylesheet"], style').forEach((styleNode) => {
      popupDocument.head.appendChild(styleNode.cloneNode(true));
    });
    const popupBaseStyle = popupDocument.createElement('style');
    popupBaseStyle.textContent = `
      html, body, #library-popout-root { width: 100%; height: 100%; margin: 0; overflow: hidden; background: var(--wfs-bg-root, #f8fafc); }
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
    `;
    popupDocument.head.appendChild(popupBaseStyle);
    return popupDocument.getElementById('library-popout-root');
  }, []);

  const handleToggleLibraryPopout = useCallback(() => {
    if (isLibraryPoppedOut) {
      isClosingLibraryPopupRef.current = true;
      closeLibraryPopupWindow();
      setIsLibraryPoppedOut(false);
      window.setTimeout(() => { isClosingLibraryPopupRef.current = false; }, 0);
      return;
    }
    const popupWindow = window.open('', 'library-popout', 'popup=yes,width=1000,height=800,left=200,top=100,resizable=yes,scrollbars=no');
    if (!popupWindow) return;
    const popupRoot = prepareLibraryPopupWindow(popupWindow);
    libraryPopupWindowRef.current = popupWindow;
    setLibraryPopupRoot(popupRoot);
    setIsLibraryPoppedOut(true);
    popupWindow.focus();
  }, [isLibraryPoppedOut, closeLibraryPopupWindow, prepareLibraryPopupWindow]);

  useEffect(() => {
    if (!isLibraryPoppedOut) return;
    const checkPopupWindow = window.setInterval(() => {
      const popupWindow = libraryPopupWindowRef.current;
      if (popupWindow && !popupWindow.closed) return;
      libraryPopupWindowRef.current = null;
      setLibraryPopupRoot(null);
      setIsLibraryPoppedOut(false);
      if (!isClosingLibraryPopupRef.current) {
        setIsLibraryOpen(false);
      }
    }, 500);
    return () => window.clearInterval(checkPopupWindow);
  }, [isLibraryPoppedOut, setIsLibraryOpen]);
  // -----------------------------

/* ═══════════════════════════════════════════════════════════════
     RENDER — Studio Layout
     ═══════════════════════════════════════════════════════════════ */

  return (
    <div
      ref={workflowRef}
      className={`wf-studio${isHighlighted ? ' autopilot-highlight' : ''}`}
    >
      {/* Help overlay */}
      {isHelpVisible('aiFlow') && (
        <div className="help-overlay visible" style={{ zIndex: 9999, position: 'fixed', top: 0, left: 0 }}>
          <div className="help-overlay-content">
            <button
              type="button"
              className="help-overlay-close"
              onClick={() => closeHelp('aiFlow')}
              aria-label="Close workflow help"
            >
              ×
            </button>
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

      {/* ── Studio Header ─────────────────────────────────────── */}
      <header className="wf-studio-header">
        <div className="wf-studio-header-accent" />
        <div className="wf-studio-header-content">
          <div className="wf-studio-identity">
            <div className="wf-studio-identity-text">
              <span className="wf-studio-kicker">
                <FiZap size={11} aria-hidden="true" />
                {label.replace(/:$/, '')}
              </span>
              <input
                className="wf-studio-name"
                value={workflowMeta.name}
                onChange={(e) => updateWorkflowMeta('name', e.target.value)}
                placeholder="Untitled Workflow"
                aria-label="Workflow name"
              />
              <input
                className="wf-studio-desc"
                value={workflowMeta.description}
                onChange={(e) => updateWorkflowMeta('description', e.target.value)}
                placeholder="Add a description…"
                aria-label="Workflow description"
              />
            </div>
            <span
              className={`wf-studio-save-state ${workflowMeta.id ? 'saved' : 'unsaved'}`}
              title={workflowMeta.id ? 'This workflow has a saved record' : 'This workflow has not been saved yet'}
            >
              <span className="wf-studio-save-dot" aria-hidden="true" />
              {workflowMeta.id ? 'Saved workflow' : 'Draft'}
            </span>
          </div>

          <div className="wf-studio-actions">
            {/* Primary group */}
            <div className="wf-studio-action-group">
              <button
                type="button"
                className="wf-btn primary"
                onClick={handleRunWorkflow}
                disabled={hasActiveLiveRun}
                aria-label={hasActiveLiveRun ? 'Workflow run in progress' : 'Run workflow'}
              >
                <FiPlay aria-hidden="true" />
                <span>{hasActiveLiveRun ? 'Running' : 'Run'}</span>
              </button>
            </div>

            {/* Save group */}
            <div className="wf-studio-action-group">
              <button type="button" className="wf-btn" onClick={() => handleSaveWorkflow(false)} title="Save">
                <FiSave aria-hidden="true" />
                <span>Save</span>
              </button>
              <button type="button" className="wf-btn subtle icon-only" onClick={() => handleSaveWorkflow(true)} title="Save As New" aria-label="Save workflow as new">
                <FiPlus aria-hidden="true" />
              </button>
            </div>

            {/* Utility group */}
            <div className="wf-studio-action-group">
              <button type="button" className="wf-btn subtle icon-only" onClick={handleDuplicateWorkflow} title="Duplicate" aria-label="Duplicate workflow">
                <FiCopy aria-hidden="true" />
              </button>
              <button type="button" className="wf-btn subtle icon-only" onClick={handleExportWorkflow} title="Export JSON" aria-label="Export workflow as JSON">
                <FiDownload aria-hidden="true" />
              </button>
              <button type="button" className="wf-btn subtle icon-only" onClick={handleLoadWorkflowClick} title="Import JSON" aria-label="Import workflow from JSON">
                <FiUpload aria-hidden="true" />
              </button>
              <button type="button" className="wf-btn subtle icon-only" onClick={handleNewWorkflow} title="Clear All" aria-label="Clear workflow">
                <FiRefreshCw aria-hidden="true" />
              </button>
              <button type="button" className="wf-btn subtle icon-only" onClick={() => toggleHelp('aiFlow')} title="Help" aria-label="Open workflow help">
                <FiHelpCircle aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="workflow-toolbar-file-input"
          onChange={handleWorkflowFileChange}
        />
      </header>

      {/* ── Studio Body ───────────────────────────────────────── */}
      <div className="wf-studio-body">
        {/* ── Canvas Region ────────────────────────────────────── */}
        <div className="wf-canvas-region">
          <div className="wf-canvas-surface">
            <ReactFlow
              nodes={renderedNodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={(_, node) => {
                setSelectedNodeId(node.id);
                if (node.id !== DROPZONE_NODE_ID) {
                  setContextPanelTab('inspector');
                  setIsContextPanelOpen(true);
                }
              }}
              onPaneClick={() => setSelectedNodeId(null)}
              fitView
              nodeTypes={{
                AiWorkLabNodeSizer,
                dropZoneNode: DropZoneNode,
              }}
            >
              <Background color="#d8dee9" gap={24} size={1.25} />
              <Controls
                showInteractive={false}
                className="wf-canvas-controls"
              />
            </ReactFlow>

            <div className="wf-canvas-toolbar" aria-label="Workflow canvas tools">
              <button
                type="button"
                className={`wf-canvas-tool primary ${isLibraryOpen ? 'active' : ''}`}
                onClick={() => {
                  setCommandDockTab('steps');
                  setIsLibraryOpen((open) => !open);
                }}
                aria-expanded={isLibraryOpen}
              >
                <FiPlus size={16} aria-hidden="true" />
                Add step
              </button>
              <span className="wf-canvas-toolbar-divider" aria-hidden="true" />
              <button
                type="button"
                className="wf-canvas-tool"
                onClick={() => {
                  setCommandDockTab('saved');
                  setIsLibraryOpen(true);
                }}
              >
                <FiBookmark size={15} aria-hidden="true" />
                Workflows
              </button>
              <button
                type="button"
                className="wf-canvas-tool"
                onClick={() => {
                  setCommandDockTab('templates');
                  setIsLibraryOpen(true);
                }}
              >
                <FiGrid size={15} aria-hidden="true" />
                Templates
              </button>
              <span className="wf-canvas-toolbar-spacer" />
              <button
                type="button"
                className="wf-canvas-tool"
                onClick={() => {
                  setContextPanelTab('execution');
                  setIsContextPanelOpen(true);
                }}
              >
                <FiActivity size={15} aria-hidden="true" />
                Monitor
              </button>
              <button
                type="button"
                className="wf-canvas-tool"
                onClick={() => {
                  setContextPanelTab('history');
                  setIsContextPanelOpen(true);
                }}
              >
                <FiList size={15} aria-hidden="true" />
                Run history
              </button>
            </div>

            {workflowDefinition.execution_order.length === 0 && !isLibraryOpen && (
              <div className="wf-canvas-onboarding">
                <div className="wf-canvas-onboarding-icon">
                  <FiLayers size={24} aria-hidden="true" />
                </div>
                <h2>Build your first workflow</h2>
                <p>
                  Add a step, connect the actions in the order they should run, then test the
                  workflow from this canvas.
                </p>
                <div className="wf-canvas-onboarding-actions">
                  <button
                    type="button"
                    className="wf-btn primary"
                    onClick={() => {
                      setCommandDockTab('steps');
                      setIsLibraryOpen(true);
                    }}
                  >
                    <FiPlus aria-hidden="true" />
                    Choose a first step
                  </button>
                  <button
                    type="button"
                    className="wf-btn"
                    onClick={() => {
                      setCommandDockTab('templates');
                      setIsLibraryOpen(true);
                    }}
                  >
                    Browse templates
                  </button>
                </div>
              </div>
            )}

            {isLibraryOpen && (
              <LibraryDrawerWrapper
                isPoppedOut={isLibraryPoppedOut}
                popoutRoot={libraryPopupRoot}
                onTogglePopout={handleToggleLibraryPopout}
                onClose={() => setIsLibraryOpen(false)}
              >

                <div className="wf-library-header">
                  <div>
                    <span className="wf-library-eyebrow">Build without leaving the canvas</span>
                    <h2>
                      {commandDockTab === 'steps' && 'Add a step'}
                      {commandDockTab === 'saved' && 'Open a workflow'}
                      {commandDockTab === 'templates' && 'Start from a template'}
                    </h2>
                    <p>
                      {commandDockTab === 'steps'
                        ? 'Choose an action below. You can add as many steps as the workflow needs.'
                        : 'Pick an existing starting point and keep building from it.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="wf-library-close"
                    onClick={() => setIsLibraryOpen(false)}
                    aria-label="Close workflow library"
                  >
                    <FiX size={18} aria-hidden="true" />
                  </button>
                </div>

                <div className="wf-library-tabs" role="tablist" aria-label="Workflow library views">
                  {[
                    { id: 'steps', label: 'Steps', Icon: FiLayers },
                    { id: 'saved', label: 'Workflows', Icon: FiBookmark },
                    { id: 'templates', label: 'Templates', Icon: FiGrid },
                  ].map(({ id, label: tabLabel, Icon }) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      className={commandDockTab === id ? 'active' : ''}
                      onClick={() => setCommandDockTab(id)}
                      aria-selected={commandDockTab === id}
                    >
                      <Icon size={14} aria-hidden="true" />
                      {tabLabel}
                    </button>
                  ))}
                </div>

                <div className="wf-library-content">
                  {commandDockTab === 'steps' && (
                    <>
                      <div className="wf-library-search">
                        <FiSearch size={16} aria-hidden="true" />
                        <input
                          value={nodeFilter}
                          onChange={(event) => setNodeFilter(event.target.value)}
                          placeholder="Search by outcome or action"
                          aria-label="Search workflow steps"
                        />
                        {nodeFilter && (
                          <button
                            type="button"
                            onClick={() => setNodeFilter('')}
                            aria-label="Clear step search"
                          >
                            <FiX size={14} aria-hidden="true" />
                          </button>
                        )}
                      </div>

                      <div className="wf-library-categories" aria-label="Step categories">
                        {['All', ...Object.keys(AiCommandGroups)].map((groupName) => (
                          <button
                            key={groupName}
                            type="button"
                            className={selectedGroup === groupName ? 'active' : ''}
                            onClick={() => setSelectedGroup(groupName)}
                            aria-pressed={selectedGroup === groupName}
                          >
                            {groupName}
                            <span>
                              {groupName === 'All'
                                ? Object.values(AiCommandGroups).flat().length
                                : AiCommandGroups[groupName].length}
                            </span>
                          </button>
                        ))}
                      </div>

                      {visibleCommands.length > 0 ? (
                        <div className="wf-step-grid">
                          {visibleCommands.map((command) => {
                            const CommandIcon = command.icon;
                            const commandType = Object.keys(AiCommandBlocks).find(
                              (key) => AiCommandBlocks[key].id === command.id
                            );
                            return (
                              <button
                                key={command.id}
                                type="button"
                                className="wf-step-tile"
                                data-group={command.groupName}
                                onClick={() => handlePaletteAddNode(commandType)}
                              >
                                <span className="wf-step-tile-icon">
                                  {CommandIcon && <CommandIcon size={18} aria-hidden="true" />}
                                </span>
                                <span className="wf-step-tile-copy">
                                  <span className="wf-step-tile-meta">{command.groupName}</span>
                                  <strong>{command.businessLabel || command.display}</strong>
                                  <span>{command.description}</span>
                                </span>
                                <span className="wf-step-tile-add" aria-hidden="true">
                                  <FiPlus size={15} />
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="wf-empty-state">
                          No steps match this search. Try a different outcome or category.
                        </div>
                      )}

                      <label className="wf-library-setting">
                        <input
                          type="checkbox"
                          checked={workflowMeta.continueOnError}
                          onChange={(event) =>
                            updateWorkflowMeta('continueOnError', event.target.checked)
                          }
                        />
                        <span>
                          <strong>Continue after a failed step</strong>
                          <small>Useful when later actions can still produce a partial result.</small>
                        </span>
                      </label>
                    </>
                  )}

                  {commandDockTab === 'saved' && (
                    <div className="wf-library-list">
                      {catalogStatus === 'loading' && (
                        <div className="wf-empty-state">Loading workflows…</div>
                      )}
                      {catalogStatus === 'error' && (
                        <div className="wf-empty-state wf-error-banner">{catalogError}</div>
                      )}
                      {catalogStatus === 'ready' && catalog.workflows.length === 0 && (
                        <div className="wf-empty-state">
                          <FiBookmark size={26} aria-hidden="true" />
                          <strong>No saved workflows yet</strong>
                          <span>Save this workflow and it will be available here.</span>
                        </div>
                      )}
                      {catalog.workflows.map((workflow) => (
                        <button
                          key={workflow.id}
                          type="button"
                          className={`wf-library-row ${workflowMeta.id === workflow.id ? 'active' : ''}`}
                          onClick={() => {
                            handleSelectWorkflow(workflow.id);
                            setIsLibraryOpen(false);
                          }}
                        >
                          <span className="wf-library-row-icon">
                            <FiBookmark size={16} aria-hidden="true" />
                          </span>
                          <span>
                            <strong>{workflow.name}</strong>
                            <small>{workflow.description || 'No description'}</small>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {commandDockTab === 'templates' && (
                    <div className="wf-library-list">
                      {catalogStatus === 'loading' && (
                        <div className="wf-empty-state">Loading templates…</div>
                      )}
                      {catalogStatus === 'ready' && catalog.templates.length === 0 && (
                        <div className="wf-empty-state">
                          <FiGrid size={26} aria-hidden="true" />
                          <strong>No templates available</strong>
                          <span>Templates will appear here when they are published.</span>
                        </div>
                      )}
                      {catalog.templates.map((template) => (
                        <button
                          key={template.id}
                          type="button"
                          className="wf-library-row"
                          onClick={() => {
                            handleCreateFromTemplate(template.id);
                            setIsLibraryOpen(false);
                          }}
                        >
                          <span className="wf-library-row-icon template">
                            <FiGrid size={16} aria-hidden="true" />
                          </span>
                          <span>
                            <strong>{template.name}</strong>
                            <small>{template.description || 'Workflow template'}</small>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

              </LibraryDrawerWrapper>
            )}

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
          </div>

          {/* ── Execution Rail ──────────────────────────────────── */}
          <div
            className={`wf-execution-rail ${isRunActive ? 'active' : ''} ${isViewingHistory ? 'historical' : ''}`}
            role="region"
            aria-label="Execution status"
          >
            {/* Historical banner */}
            {isViewingHistory && (
              <div className="wf-historical-banner" role="status">
                <FiClock size={14} aria-hidden="true" />
                <span>
                  Viewing run from{' '}
                  {inspectedRunState.started_at
                    ? relativeTime(inspectedRunState.started_at)
                    : 'unknown time'}
                  {hasActiveLiveRun
                    ? ' · Live run still active'
                    : ''}
                </span>
                <button
                  type="button"
                  className="wf-btn subtle"
                  onClick={handleReturnToLiveRun}
                  style={{ marginLeft: 'auto' }}
                >
                  <FiArrowLeft size={14} aria-hidden="true" />
                  Return to Live
                </button>
              </div>
            )}

            {/* Error banner */}
            {runUiError && !inspectedRunState && (
              <div className="wf-error-banner" role="alert">
                <FiAlertTriangle size={14} aria-hidden="true" />
                <span>{runUiError}</span>
                {runState?.run_id && (
                  <button type="button" className="wf-btn subtle" onClick={handleRefreshCurrentRun}>
                    Refresh
                  </button>
                )}
              </div>
            )}

            {/* Status + progress */}
            <div className="wf-rail-main">
              <div className="wf-rail-status">
                <span
                  className={`wf-rail-status-badge ${statusClass}`}
                  role="status"
                  aria-live="polite"
                >
                  {STATUS_ICONS[displayedRunState?.status] &&
                    (() => {
                      const Icon = STATUS_ICONS[displayedRunState?.status];
                      return (
                        <Icon
                          size={12}
                          aria-hidden="true"
                          className={displayedRunState?.status === 'running' ? 'wf-icon-spin' : ''}
                        />
                      );
                    })()}
                  {runStatusLabel}
                </span>
              </div>

              <div className="wf-rail-progress">
                <div
                  className={`wf-rail-progress-fill ${isRunActive ? 'active' : ''}`}
                  style={{ width: `${progressPercent}%` }}
                  role="progressbar"
                  aria-valuenow={progressPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Workflow progress: ${progressPercent}%`}
                />
              </div>

              <div className="wf-rail-stats">
                <span>{runProgress.completed + runProgress.failed}/{runProgress.total} steps</span>
              </div>

              {/* Timestamps */}
              {displayedRunState?.started_at && (
                <div className="wf-rail-timer">
                  <FiClock size={11} aria-hidden="true" />
                  <span>{relativeTime(displayedRunState.started_at)}</span>
                </div>
              )}

              {/* Actions */}
              <div className="wf-rail-actions">
                {isRunActive && (
                  <button
                    type="button"
                    className="wf-btn danger"
                    onClick={handleCancelRun}
                    disabled={isCancelling || runState?.status === 'cancel_requested'}
                    aria-label={
                      runState?.status === 'cancel_requested'
                        ? 'Cancellation pending'
                        : 'Cancel workflow run'
                    }
                    title={
                      runState?.status === 'cancel_requested'
                        ? 'Cancellation requested — waiting for current node to finish'
                        : 'Cancel this workflow run'
                    }
                  >
                    <FiXCircle size={14} aria-hidden="true" />
                    <span>
                      {runState?.status === 'cancel_requested' ? 'Cancelling…' : 'Cancel'}
                    </span>
                  </button>
                )}
                {isTerminal && (
                  <button
                    type="button"
                    className="wf-btn disabled-placeholder"
                    disabled
                    aria-disabled="true"
                    title="Retry is not yet available. An idempotency and side-effect contract is required before retry can be safely enabled."
                  >
                    <FiRotateCw size={14} aria-hidden="true" />
                    <span>Retry (Coming Later)</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Context Panel (Right) ────────────────────────────── */}
        {isContextPanelOpen && (
        <aside className="wf-context-panel">
          <div className="wf-context-tabs" role="tablist" aria-label="Context panel tabs">
            <button
              type="button"
              role="tab"
              id="context-tab-inspector"
              className={`wf-context-tab ${contextPanelTab === 'inspector' ? 'active' : ''}`}
              onClick={() => setContextPanelTab('inspector')}
              aria-selected={contextPanelTab === 'inspector'}
              aria-controls="context-panel-inspector"
            >
              <FiMousePointer size={14} aria-hidden="true" />
              Inspector
            </button>
            <button
              type="button"
              role="tab"
              id="context-tab-execution"
              className={`wf-context-tab ${contextPanelTab === 'execution' ? 'active' : ''}`}
              onClick={() => setContextPanelTab('execution')}
              aria-selected={contextPanelTab === 'execution'}
              aria-controls="context-panel-execution"
            >
              <FiActivity size={14} aria-hidden="true" />
              Execution
            </button>
            <button
              type="button"
              role="tab"
              id="context-tab-history"
              className={`wf-context-tab ${contextPanelTab === 'history' ? 'active' : ''}`}
              onClick={() => setContextPanelTab('history')}
              aria-selected={contextPanelTab === 'history'}
              aria-controls="context-panel-history"
            >
              <FiList size={14} aria-hidden="true" />
              History
            </button>
            <button
              type="button"
              className="wf-context-close"
              onClick={() => setIsContextPanelOpen(false)}
              aria-label="Close details panel"
            >
              <FiX size={16} aria-hidden="true" />
            </button>
          </div>

          <div className="wf-context-content">
            {/* ── Inspector Tab ──────────────────────────────────── */}
            {contextPanelTab === 'inspector' && (
              <div
                id="context-panel-inspector"
                className="wf-inspector"
                role="tabpanel"
                aria-labelledby="context-tab-inspector"
              >
                {!selectedNode || selectedNode.id === DROPZONE_NODE_ID ? (
                  <div className="wf-inspector-empty">
                    <FiMousePointer size={32} aria-hidden="true" />
                    <div className="wf-inspector-empty-title">No Step Selected</div>
                    <div className="wf-inspector-empty-desc">
                      Click a step on the canvas to configure its business logic.
                    </div>
                  </div>
                ) : (
                  <div className="wf-inspector-form">
                    <div className="wf-inspector-field">
                      <label className="wf-inspector-label">Step name</label>
                      <input
                        className="wf-inspector-input"
                        value={selectedNode.data?.label || ''}
                        onChange={(e) => updateSelectedNodeField('label', e.target.value)}
                      />
                    </div>
                    <div className="wf-inspector-field">
                      <label className="wf-inspector-label">Business description</label>
                      <textarea
                        className="wf-inspector-textarea"
                        rows={2}
                        value={selectedNode.data?.description || ''}
                        onChange={(e) => updateSelectedNodeField('description', e.target.value)}
                      />
                    </div>
                    <div className="wf-inspector-field">
                      <label className="wf-inspector-label">
                        {selectedNode.data?.command === '/clean'
                          ? 'Cleaning instructions'
                          : 'Business focus'}
                      </label>
                      <textarea
                        className="wf-inspector-textarea"
                        rows={4}
                        value={
                          selectedNode.data?.command === '/clean'
                            ? selectedNode.data?.params?.instructions || ''
                            : selectedNode.data?.params?.focus || ''
                        }
                        onChange={(e) =>
                          updateSelectedNodeParam(
                            selectedNode.data?.command === '/clean' ? 'instructions' : 'focus',
                            e.target.value
                          )
                        }
                        placeholder={
                          selectedNode.data?.command === '/clean'
                            ? 'Describe how this step should clean the dataset.'
                            : 'Describe what this step should emphasize for business users.'
                        }
                      />
                    </div>
                    {selectedNode.data?.command !== '/clean' && (
                      <div className="wf-inspector-field">
                        <label className="wf-inspector-label">Business goal</label>
                        <input
                          className="wf-inspector-input"
                          value={selectedNode.data?.params?.goal || ''}
                          onChange={(e) => updateSelectedNodeParam('goal', e.target.value)}
                          placeholder="Optional outcome guidance"
                        />
                      </div>
                    )}

                    {/* Node status info */}
                    {pipelineResults[selectedNodeId] && pipelineResults[selectedNodeId].status !== 'idle' && (
                      <div className="wf-inspector-status-info">
                        <div className="wf-inspector-label">Status</div>
                        <span className={`wf-rail-status-badge ${(pipelineResults[selectedNodeId].status || '').replace(/_/g, '-')}`}>
                          {(pipelineResults[selectedNodeId].status || '').replace(/_/g, ' ')}
                        </span>
                        {pipelineResults[selectedNodeId].error && (
                          <div className="wf-error-banner" style={{ marginTop: 8 }}>
                            <FiAlertTriangle size={12} aria-hidden="true" />
                            <span>{pipelineResults[selectedNodeId].error}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Execution Tab ──────────────────────────────────── */}
            {contextPanelTab === 'execution' && (
              <div
                id="context-panel-execution"
                className="wf-exec-panel"
                role="tabpanel"
                aria-labelledby="context-tab-execution"
              >
                <div className="wf-exec-panel-title">Execution Sequence</div>

                {workflowDefinition.execution_order.length === 0 ? (
                  <div className="wf-empty-state">
                    <FiActivity size={24} style={{ marginBottom: 8, opacity: 0.4 }} />
                    <div>Add steps to see the execution sequence.</div>
                  </div>
                ) : (
                  <ol className="wf-exec-sequence">
                    {workflowDefinition.execution_order.map((nodeId, index) => {
                      const currentNode = workflowDefinition.nodes.find((node) => node.id === nodeId);
                      const nodeState = displayedRunState?.node_states?.[nodeId];
                      const nodeStatus = nodeState?.status || 'idle';
                      const StatusIcon = STATUS_ICONS[nodeStatus] || FiCircle;

                      return (
                        <li key={nodeId}>
                          <button
                            type="button"
                            className={`wf-exec-step ${nodeStatus.replace(/_/g, '-')}`}
                            onClick={() => {
                              setSelectedNodeId(nodeId);
                              setContextPanelTab('inspector');
                            }}
                            aria-label={`Step ${index + 1}: ${currentNode?.label || nodeId} — ${nodeStatus}`}
                          >
                            <span className="wf-exec-step-number">{index + 1}</span>
                            <span className="wf-exec-step-label">
                              {currentNode?.label || nodeId}
                            </span>
                            {nodeStatus !== 'idle' && (
                              <span className={`wf-exec-step-status ${nodeStatus.replace(/_/g, '-')}`}>
                                <StatusIcon
                                  size={12}
                                  aria-hidden="true"
                                  className={nodeStatus === 'running' ? 'wf-icon-spin' : ''}
                                />
                                {nodeStatus.replace(/_/g, ' ')}
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                )}

                {/* Timestamps */}
                {displayedRunState?.started_at && (
                  <div className="wf-exec-timestamp">
                    <FiClock aria-hidden="true" size={12} />
                    <span>Started: {new Date(displayedRunState.started_at).toLocaleString()}</span>
                  </div>
                )}
                {displayedRunState?.finished_at && (
                  <div className="wf-exec-timestamp">
                    <FiClock aria-hidden="true" size={12} />
                    <span>Finished: {new Date(displayedRunState.finished_at).toLocaleString()}</span>
                  </div>
                )}
              </div>
            )}

            {/* ── History Tab ────────────────────────────────────── */}
            {contextPanelTab === 'history' && (
              <div
                id="context-panel-history"
                className="wf-history-panel"
                role="tabpanel"
                aria-labelledby="context-tab-history"
              >
                <div className="wf-history-panel-header">
                  <span className="wf-exec-panel-title">Run History</span>
                  <button
                    type="button"
                    className="wf-btn subtle icon-only"
                    onClick={refreshRunHistory}
                    title="Refresh run history"
                    aria-label="Refresh run history"
                  >
                    <FiRefreshCw size={14} aria-hidden="true" />
                  </button>
                </div>

                {runHistoryStatus === 'loading' && (
                  <div className="wf-empty-state">
                    <FiLoader size={20} className="wf-icon-spin" aria-hidden="true" />
                    <div>Loading history…</div>
                  </div>
                )}
                {runHistoryStatus === 'error' && (
                  <div className="wf-empty-state wf-error-banner">Failed to load history.</div>
                )}
                {runHistoryStatus === 'ready' && runHistory.length === 0 && (
                  <div className="wf-empty-state">
                    <FiList size={24} style={{ marginBottom: 8, opacity: 0.4 }} />
                    <div>No prior runs found.</div>
                    <div style={{ fontSize: '11px', marginTop: 4 }}>Run a workflow to see its history.</div>
                  </div>
                )}
                {runHistory.length > 0 && (
                  <ul className="wf-history-list" aria-label="Run history">
                    {runHistory.map((run) => {
                      const runStatusClass = (run.status || 'idle').replace(/_/g, '-');
                      const HistIcon = STATUS_ICONS[run.status] || FiCircle;
                      const isSelected = displayedRunState?.run_id === run.run_id;
                      const duration = formatDuration(run.started_at, run.finished_at);
                      const completedSteps =
                        (run.progress?.completed || 0) + (run.progress?.failed || 0);
                      const totalSteps = run.progress?.total || 0;

                      return (
                        <li key={run.run_id}>
                          <button
                            type="button"
                            className={`wf-history-card ${isSelected ? 'active' : ''}`}
                            onClick={() => handleSelectRun(run.run_id)}
                            aria-pressed={isSelected}
                            aria-label={`${run.workflow_name || 'Run'} — ${run.status}`}
                          >
                            <div className={`wf-history-card-status ${runStatusClass}`}>
                              <HistIcon size={14} aria-hidden="true" />
                            </div>
                            <div className="wf-history-card-body">
                              <span className="wf-history-card-name">
                                {run.workflow_name || 'Unnamed'}
                              </span>
                              <div className="wf-history-card-meta">
                                <span className={`wf-history-card-outcome ${runStatusClass}`}>
                                  {(run.status || 'idle').replace(/_/g, ' ')}
                                </span>
                                <span className="wf-history-card-time">
                                  {relativeTime(run.started_at || run.created_at)}
                                </span>
                                {duration && (
                                  <span className="wf-history-card-duration">{duration}</span>
                                )}
                                {totalSteps > 0 && (
                                  <span className="wf-history-card-progress">
                                    {completedSteps}/{totalSteps} steps
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        </aside>
        )}
      </div>

      {/* ── Pipeline Runner (headless) ────────────────────────── */}
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
