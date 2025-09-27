// 📂 AiWorkflowLab.jsx — cleaned and fixed DropZone behavior with working hover

import { useState, useCallback, useContext, useRef, useEffect } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "../css/workflow_lab_css/AiWorkflowLab.css";
import "../css/workflow_lab_css/AiWorkflowLabDropZone.css";
import { AiCommandBlocks } from "../workflow_lab_components/AiCommandBlock";
import AiWorkLabNodeSizer from "./AiWorkLabNodeSizer";
import { useContextMenu } from "../../hooks/useContextMenu";
import ContextMenu from "../../context/ContextMenu";
import { DataContext } from "../../context/DataContext";
import AIPipeline from './AIPipeline';
import DropZoneNode from './DropZoneNode';
import { useWindowContext } from "../../context/WindowContext";
import { FiDownload, FiUpload } from "react-icons/fi";

const initialNodes = [
  {
    id: 'dropzone-node',
    type: 'dropZoneNode',
    position: { x: 600, y: 900 },
    data: { hovering: false },
    deletable: false,
    draggable: false,
    selectable: false,
  },
];

const initialEdges = [];

function AiWorkflowLab({ savedState }) {
  const { uploadedData, cleanedData, pipelineResults, setPipelineResults, setCleanedData } = useContext(DataContext);
  const { saveWindowContentState } = useWindowContext();
  const [nodes, setNodes] = useState(savedState?.nodes || initialNodes);
  const [edges, setEdges] = useState(savedState?.edges || initialEdges);
  const [hasExecuted, setHasExecuted] = useState(false);

   // --- NEW: helper to map spec node.type -> AiCommandBlocks entry + node data
  const mapSpecTypeToBlockKey = useCallback((t) => {
    const type = String(t || "").toUpperCase();
    // Adjust these keys to match your AiCommandBlocks keys exactly
    switch (type) {
      case "SUMMARY": return "summary";   // maps to AiCommandBlocks.summary
      case "CHARTS": return "charts";     // maps to AiCommandBlocks.charts
      case "INSIGHTS": return "insights"; // maps to AiCommandBlocks.insights
      case "CLEAN": return "clean";       // maps to AiCommandBlocks.clean
      case "EXECUTE": return "execute";   // maps to AiCommandBlocks.execute
      default: return null;               // falls back to CUSTOM
    }
  }, []);

  // --- NEW: Build a React Flow node from a WorkflowSpec node
  const buildRfNodeFromSpec = useCallback((specNode) => {
    const blockKey = mapSpecTypeToBlockKey(specNode.type);
    const block = blockKey ? AiCommandBlocks[blockKey] : null;

    const label = block?.display || specNode.label || specNode.type || "Custom";
    const command = block?.command || `/${(specNode.type || "custom").toLowerCase()}`;
    const params = specNode.params && typeof specNode.params === "object" ? specNode.params : {};

    return {
      id: specNode.id || `node-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      type: "AiWorkLabNodeSizer",
      position: specNode.position || { x: 200, y: 200 },
      data: {
        icon: block?.icon || null,
        label,
        command,
        // We’ll keep params so downstream nodes/pipeline can use them
        params,
        commandType: blockKey || (typeof specNode.type === "string" ? specNode.type.toLowerCase() : null),
      },
    };
  }, [mapSpecTypeToBlockKey]);

  // --- NEW: Importer — replace current graph with compiled spec
  const importWorkflowSpec = useCallback((spec, opts = {}) => {
    try {
      if (!spec || !Array.isArray(spec.nodes)) {
        console.warn("⚠️ importWorkflowSpec: invalid spec", spec);
        return;
      }

      // Build RF nodes from spec (plus keep the dropzone node at the end)
      const rfNodes = spec.nodes.map(buildRfNodeFromSpec);
      const rfEdges = (spec.edges || []).map(e => ({
        id: e.id || `edge-${Math.random().toString(36).slice(2,7)}`,
        source: e.source,
        target: e.target,
        type: "default",
      }));

      // Always include the non-deletable Drop Zone
      const dropZone = initialNodes[0];
      const nextNodes = [...rfNodes, dropZone];

      setNodes(nextNodes);
      setEdges(rfEdges);

      console.log("✅ Imported workflow spec:", { nodes: nextNodes, edges: rfEdges });

      if (opts.autoRun && typeof window.runAIPipeline === "function") {
        // slight defer to ensure ReactFlow has committed the new graph
        setTimeout(() => window.runAIPipeline(), 50);
      }
    } catch (err) {
      console.error("❌ importWorkflowSpec failed:", err);
    }
  }, [buildRfNodeFromSpec]);

  // --- NEW: Expose imperative API on window (like your run hook)
  useEffect(() => {
    window.importWorkflowSpec = importWorkflowSpec;
    return () => {
      if (window.importWorkflowSpec === importWorkflowSpec) {
        delete window.importWorkflowSpec;
      }
    };
  }, [importWorkflowSpec]);

  const workflowRef = useRef(null);
  const fileInputRef = useRef(null);
  const { clicked, coords, setClicked } = useContextMenu(workflowRef);

  const deriveCommandType = useCallback((node) => {
    const explicitType = node?.data?.commandType;
    if (explicitType) {
      return explicitType;
    }

    const command = node?.data?.command;
    if (!command) {
      return null;
    }

    const matchedKey = Object.keys(AiCommandBlocks).find(
      (key) => AiCommandBlocks[key].command === command
    );

    if (matchedKey) {
      return matchedKey;
    }

    if (command.startsWith("/")) {
      return command.slice(1);
    }

    return command;
  }, []);

  const exportWorkflowSpec = useCallback(() => {
    const workflowNodes = nodes
      .filter((node) => node.id !== "dropzone-node")
      .map((node) => {
        const params = node.data?.params && typeof node.data.params === "object"
          ? node.data.params
          : {};

        const type = deriveCommandType(node);

        const specNode = {
          id: node.id,
          type: typeof type === "string" ? type : null,
          label: node.data?.label,
          icon: node.data?.icon,
          params,
          position: node.position,
        };

        if (!specNode.type) {
          delete specNode.type;
        }

        if (!specNode.icon) {
          delete specNode.icon;
        }

        if (!specNode.label) {
          delete specNode.label;
        }

        return specNode;
      });

    const workflowEdges = edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
    }));

    return { nodes: workflowNodes, edges: workflowEdges };
  }, [deriveCommandType, edges, nodes]);

  const triggerDownload = useCallback((spec) => {
    try {
      const json = JSON.stringify(spec, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const timestamp = new Date()
        .toISOString()
        .replace(/[:T]/g, "-")
        .split(".")[0];
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `workflow-${timestamp}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("❌ Failed to export workflow spec", err);
    }
  }, []);

  const handleSaveWorkflow = useCallback(() => {
    const spec = exportWorkflowSpec();
    triggerDownload(spec);
  }, [exportWorkflowSpec, triggerDownload]);

  const handleLoadWorkflowClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleWorkflowFileChange = useCallback(
    (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) {
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result;
          const parsed = JSON.parse(text);

          if (!parsed || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
            console.warn("⚠️ Invalid workflow file: missing nodes or edges", parsed);
            alert("Unable to load workflow: the file is missing nodes or edges.");
            return;
          }

          setPipelineResults({});
          setHasExecuted(false);
          importWorkflowSpec(parsed);
        } catch (error) {
          console.error("❌ Failed to load workflow file", error);
          alert("Unable to load workflow: the file is not valid JSON.");
        } finally {
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        }
      };

      reader.readAsText(file);
    },
    [importWorkflowSpec, setPipelineResults]
  );

  const handleExecuteDrop = async () => {
    console.log("🚀 Execute node dropped! Triggering AIPipeline...");
    if (typeof window.runAIPipeline === "function") {
      window.runAIPipeline();
    } else {
      console.warn("⚠️ AIPipeline not registered yet.");
    }
  };

  const checkOverlapAndTrigger = useCallback(
    (node) => {
      const dropZoneElement = document.querySelector("[data-id='dropzone-node']");
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
        prevNodes.map((n) =>
          n.id === 'dropzone-node'
            ? { ...n, data: { ...n.data, hovering: isIntersecting } }
            : n
        )
      );

      if (isIntersecting && !hasExecuted) {
        setHasExecuted(true);
        handleExecuteDrop();
      } else if (!isIntersecting && hasExecuted) {
        setHasExecuted(false);
      }
    },
    [hasExecuted]
  );

  // 🔁 Add this new handler
  const onConnect = useCallback((params) => {
    console.log("🔗 New edge created:", params);
    setEdges((eds) => addEdge(params, eds));
  }, []);


  const onNodesChange = useCallback(
    (changes) => {
      setNodes((nds) => {
        const updatedNodes = applyNodeChanges(changes, nds);

        const draggedNode = changes.find(
          (change) => change.type === "position" || change.type === "dimensions"
        );

        if (draggedNode && draggedNode.id) {
          const node = updatedNodes.find((n) => n.id === draggedNode.id);
          if (node?.data?.command === "/execute") {
            checkOverlapAndTrigger(node);
          }
        }

        return updatedNodes;
      });
    },
    [checkOverlapAndTrigger]
  );

  const onEdgesChange = useCallback((changes) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  const handleAddNode = useCallback(
    (type) => {
      const command = AiCommandBlocks[type];
      if (!command) return;

      const newNode = {
        id: `node-${Date.now()}`,
        type: "AiWorkLabNodeSizer",
        data: {
          icon: command.icon,
          label: command.display,
          command: command.command,
          params: {},
          commandType: type,
        },
        position: {
          x: coords.x - 100,
          y: coords.y - 75,
        },
      };

      setNodes((prevNodes) => [...prevNodes, newNode]);
      setClicked(false);
    },
    [coords, setClicked]
  );

  useEffect(() => {
    saveWindowContentState('aiWorkflowLab', { nodes, edges });
  }, [nodes, edges, saveWindowContentState]);

  const renderedNodes = nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      status: pipelineResults[node.id]?.status || null,
      result: pipelineResults[node.id]?.result || null,
      error: pipelineResults[node.id]?.error || null,
    },
  }));

  return (
    <div
      ref={workflowRef}
      className="ai-workflow-lab-container"
      style={{ width: "100%", height: "100%", position: "relative", zIndex: 2 }}
    >
      <div className="workflow-lab-toolbar">
        <button type="button" className="workflow-toolbar-button" onClick={handleSaveWorkflow}>
          <FiDownload aria-hidden="true" />
          <span>Save Workflow</span>
        </button>
        <button type="button" className="workflow-toolbar-button" onClick={handleLoadWorkflowClick}>
          <FiUpload aria-hidden="true" />
          <span>Load Workflow</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="workflow-toolbar-file-input"
          onChange={handleWorkflowFileChange}
        />
      </div>
      <ReactFlow
        nodes={renderedNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        nodeTypes={{
          AiWorkLabNodeSizer: AiWorkLabNodeSizer,
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
        nodes={nodes}
        dataset={cleanedData || uploadedData}
        onResults={setPipelineResults}
        onDataCleaned={setCleanedData}
      />
    </div>
  );
}

export default AiWorkflowLab;
