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

  const workflowRef = useRef(null);
  const { clicked, coords, setClicked } = useContextMenu(workflowRef);

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
