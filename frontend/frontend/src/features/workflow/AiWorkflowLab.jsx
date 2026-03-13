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
import { FiCopy, FiDownload, FiPlay, FiPlus, FiRefreshCw, FiSave, FiUpload } from 'react-icons/fi';
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

  const runStatusLabel = runState?.status
    ? runState.status.charAt(0).toUpperCase() + runState.status.slice(1)
    : 'Idle';
  const runProgress = runState?.progress || { total: workflowDefinition.execution_order.length, completed: 0, failed: 0, running: 0 };

  return (
    <div
      ref={workflowRef}
      className={`ai-workflow-lab-container${isHighlighted ? ' autopilot-highlight' : ''}`}
      style={{ width: '100%', height: '100%', position: 'relative', zIndex: 2 }}
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

      <div className="workflow-metadata-panel">
        <div className="workflow-metadata-header">
          <div>
            <div className="workflow-kicker">Automation Pipeline</div>
            <h3>{label}</h3>
          </div>
          <button type="button" className="help-overlay-trigger" onClick={() => toggleHelp('aiFlow')}>
            ❓
          </button>
        </div>

        <label className="workflow-field">
          <span>Name</span>
          <input
            value={workflowMeta.name}
            onChange={(event) => updateWorkflowMeta('name', event.target.value)}
            placeholder="Quarterly revenue analysis"
          />
        </label>

        <label className="workflow-field">
          <span>Description</span>
          <textarea
            rows={3}
            value={workflowMeta.description}
            onChange={(event) => updateWorkflowMeta('description', event.target.value)}
            placeholder="Explain what this automation does for business users."
          />
        </label>

        <div className="workflow-summary-grid">
          <div>
            <strong>{workflowDefinition.nodes.length}</strong>
            <span>Steps</span>
          </div>
          <div>
            <strong>{workflowDefinition.edges.length}</strong>
            <span>Connections</span>
          </div>
          <div>
            <strong>{runStatusLabel}</strong>
            <span>Run status</span>
          </div>
        </div>

        <label className="workflow-field workflow-checkbox">
          <input
            type="checkbox"
            checked={workflowMeta.continueOnError}
            onChange={(event) => updateWorkflowMeta('continueOnError', event.target.checked)}
          />
          <span>Continue if a step fails</span>
        </label>

        <div className="workflow-selectors">
          <label className="workflow-field compact">
            <span>Saved workflows</span>
            <select value="" onChange={(event) => handleSelectWorkflow(event.target.value)}>
              <option value="">Open saved workflow</option>
              {catalog.workflows.map((workflow) => (
                <option key={workflow.id} value={workflow.id}>{workflow.name}</option>
              ))}
            </select>
          </label>
          <label className="workflow-field compact">
            <span>Templates</span>
            <select value="" onChange={(event) => handleCreateFromTemplate(event.target.value)}>
              <option value="">Create from template</option>
              {catalog.templates.map((template) => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="workflow-catalog-status">
          {catalogStatus === 'loading' && 'Loading workflow catalog...'}
          {catalogStatus === 'error' && catalogError}
          {catalogStatus === 'ready' && `${catalog.workflows.length} saved workflows, ${catalog.templates.length} templates`}
        </div>
      </div>

      <div className="workflow-lab-toolbar">
        <button type="button" className="workflow-toolbar-button primary" onClick={handleRunWorkflow}>
          <FiPlay aria-hidden="true" />
          <span>Run</span>
        </button>
        <button type="button" className="workflow-toolbar-button" onClick={() => handleSaveWorkflow(false)}>
          <FiSave aria-hidden="true" />
          <span>Save</span>
        </button>
        <button type="button" className="workflow-toolbar-button" onClick={() => handleSaveWorkflow(true)}>
          <FiPlus aria-hidden="true" />
          <span>Save As</span>
        </button>
        <button type="button" className="workflow-toolbar-button" onClick={handleDuplicateWorkflow}>
          <FiCopy aria-hidden="true" />
          <span>Duplicate</span>
        </button>
        <button type="button" className="workflow-toolbar-button" onClick={handleExportWorkflow}>
          <FiDownload aria-hidden="true" />
          <span>Export</span>
        </button>
        <button type="button" className="workflow-toolbar-button" onClick={handleLoadWorkflowClick}>
          <FiUpload aria-hidden="true" />
          <span>Import</span>
        </button>
        <button type="button" className="workflow-toolbar-button subtle" onClick={handleNewWorkflow}>
          <FiRefreshCw aria-hidden="true" />
          <span>New</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="workflow-toolbar-file-input"
          onChange={handleWorkflowFileChange}
        />
      </div>

      <div className="workflow-node-library">
        <div className="workflow-panel-title">Node Library</div>
        {Object.entries(AiCommandGroups).map(([groupName, groupNodes]) => (
          <div key={groupName} className="workflow-node-group">
            <div className="workflow-node-group-title">{groupName}</div>
            <div className="workflow-node-list">
              {groupNodes.map((command) => (
                <button
                  key={command.id}
                  type="button"
                  className="workflow-node-button"
                  onClick={() => handlePaletteAddNode(Object.keys(AiCommandBlocks).find((key) => AiCommandBlocks[key].id === command.id))}
                >
                  <span className="workflow-node-button-title">{command.businessLabel || command.display}</span>
                  <span className="workflow-node-button-copy">{command.description}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="workflow-side-panel right">
        <div className="workflow-panel-title">Execution</div>
        <div className="workflow-run-summary">
          <div className="run-metric">
            <strong>{runProgress.completed}</strong>
            <span>Completed</span>
          </div>
          <div className="run-metric">
            <strong>{runProgress.running}</strong>
            <span>Running</span>
          </div>
          <div className="run-metric">
            <strong>{runProgress.failed}</strong>
            <span>Failed</span>
          </div>
        </div>
        <div className="workflow-execution-order">
          <div className="workflow-subtitle">Execution Order</div>
          <ol>
            {workflowDefinition.execution_order.map((nodeId) => {
              const currentNode = workflowDefinition.nodes.find((node) => node.id === nodeId);
              return <li key={nodeId}>{currentNode?.label || nodeId}</li>;
            })}
          </ol>
        </div>

        <div className="workflow-panel-title with-margin">Step Details</div>
        {!selectedNode || selectedNode.id === DROPZONE_NODE_ID ? (
          <div className="workflow-empty-state">Select a pipeline step to edit its business guidance.</div>
        ) : (
          <div className="workflow-node-inspector">
            <label className="workflow-field compact">
              <span>Step name</span>
              <input
                value={selectedNode.data?.label || ''}
                onChange={(event) => updateSelectedNodeField('label', event.target.value)}
              />
            </label>
            <label className="workflow-field compact">
              <span>Business description</span>
              <textarea
                rows={3}
                value={selectedNode.data?.description || ''}
                onChange={(event) => updateSelectedNodeField('description', event.target.value)}
              />
            </label>
            <label className="workflow-field compact">
              <span>{selectedNode.data?.command === '/clean' ? 'Cleaning instructions' : 'Business focus'}</span>
              <textarea
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
            </label>
            {selectedNode.data?.command !== '/clean' && (
              <label className="workflow-field compact">
                <span>Business goal</span>
                <input
                  value={selectedNode.data?.params?.goal || ''}
                  onChange={(event) => updateSelectedNodeParam('goal', event.target.value)}
                  placeholder="Optional outcome or audience guidance"
                />
              </label>
            )}
          </div>
        )}
      </div>

      <ReactFlow
        nodes={renderedNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => setSelectedNodeId(node.id)}
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

      <AIPipeline
        workflowDefinition={workflowDefinition}
        dataset={dataset}
        onResults={setPipelineResults}
        onDataCleaned={setCleanedData}
        onRunStateChange={setRunState}
      />
    </div>
  );
}

export default AiWorkflowLab;




