import React, { memo, useMemo } from 'react';
import {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  Position,
  ReactFlow,
  getBezierPath,
} from '@xyflow/react';
import { FiAlertCircle, FiBarChart2, FiDatabase, FiFileText, FiLink2, FiShield } from 'react-icons/fi';
import '@xyflow/react/dist/style.css';

const nodeKind = (data) => {
  const raw = data?.rawNodeData || {};
  return raw.node_type || raw.variable_type || raw.type || 'variable';
};

const kindLabel = (kind) => {
  if (kind === 'metric') return 'Metric';
  if (kind === 'dimension') return 'Dimension';
  if (kind === 'evidence') return 'Evidence';
  return 'Variable';
};

const kindIcon = (kind) => {
  if (kind === 'metric') return <FiBarChart2 aria-hidden="true" />;
  if (kind === 'dimension') return <FiDatabase aria-hidden="true" />;
  if (kind === 'evidence') return <FiFileText aria-hidden="true" />;
  return <FiLink2 aria-hidden="true" />;
};

const VariableNode = memo(({ data, selected }) => {
  const kind = nodeKind(data);
  const insufficient = data.insufficientData;
  const supported = data.evidenceCoverage || data.reliability;

  return (
    <div className={`decision-node decision-node--${kind} ${selected ? 'is-selected' : ''} ${insufficient ? 'is-insufficient' : ''}`}>
      <Handle className="decision-node__handle" type="target" position={Position.Top} />
      <Handle className="decision-node__handle" type="target" position={Position.Left} />

      <div className="decision-node__top">
        <span className="decision-node__kind">{kindIcon(kind)} {kindLabel(kind)}</span>
        {insufficient && <span className="decision-node__warning"><FiAlertCircle aria-hidden="true" /> Limited</span>}
      </div>

      <div className="decision-node__label">{data.label || 'Variable'}</div>

      <div className="decision-node__footer">
        {supported ? (
          <span><FiShield aria-hidden="true" /> Evidence tracked</span>
        ) : (
          <span>Ready for inspection</span>
        )}
      </div>

      <Handle className="decision-node__handle" type="source" position={Position.Right} />
      <Handle className="decision-node__handle" type="source" position={Position.Bottom} />
    </div>
  );
});

const AssociationEdge = memo(({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  selected,
}) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const relationshipType = data?.relationshipType || 'observed_association';
  const isCoverage = relationshipType === 'evidence_coverage';
  const isHypothesis = relationshipType === 'user_hypothesis';
  const strength = data?.strength || 'observed';
  const label = data?.displayLabel || data?.label || (isCoverage ? 'Coverage' : isHypothesis ? 'Hypothesis' : 'Observed');

  const edgeStyle = {
    ...style,
    stroke: selected ? '#1d4ed8' : isCoverage ? '#0f766e' : isHypothesis ? '#8b5cf6' : '#64748b',
    strokeWidth: selected ? 3 : isCoverage ? 2.4 : isHypothesis ? 2.0 : 1.8,
    strokeDasharray: isCoverage ? 'none' : isHypothesis ? '4 4' : '7 7',
  };

  return (
    <>
      <BaseEdge path={edgePath} style={edgeStyle} />
      <EdgeLabelRenderer>
        <button
          type="button"
          className={`decision-edge-label decision-edge-label--${isCoverage ? 'coverage' : isHypothesis ? 'hypothesis' : 'association'} ${selected ? 'is-selected' : ''}`}
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}
        >
          <span>{label}</span>
          {!isCoverage && !isHypothesis && <small>{strength}</small>}
          {isHypothesis && <small>Unvalidated</small>}
        </button>
      </EdgeLabelRenderer>
    </>
  );
});

export const DecisionGraphCanvas = ({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onEdgeClick,
}) => {
  const nodeTypes = useMemo(() => ({ variable: VariableNode }), []);
  const edgeTypes = useMemo(() => ({ association: AssociationEdge }), []);
  const hasGraph = nodes.length > 0;

  return (
    <div className="graph-canvas-stage">
      {!hasGraph && (
        <div className="graph-empty-overlay">
          <div className="graph-empty-overlay__mark"><FiLink2 aria-hidden="true" /></div>
          <h3>Build a decision graph</h3>
          <p>Select variables in the build scope panel, then generate a graph to inspect observed relationships and evidence coverage.</p>
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        attributionPosition="bottom-right"
      >
        <Background color="#cbd5e1" gap={22} size={1.2} />
        <Controls position="bottom-left" showInteractive={false} />
      </ReactFlow>
    </div>
  );
};

export default DecisionGraphCanvas;
