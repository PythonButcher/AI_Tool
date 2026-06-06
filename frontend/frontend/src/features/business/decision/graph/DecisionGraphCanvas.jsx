import React, { useMemo, memo } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  Handle,
  Position,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

/**
 * Custom Node: VariableNode
 * Displays a variable with non-causal visual indicators.
 */
const VariableNode = memo(({ data, selected }) => {
  const isInsufficient = data.insufficientData;
  const isSelected = selected || data.selected;

  // Aesthetic colors & shadows
  const baseBg = isInsufficient ? '#f8f9fa' : '#ffffff';
  const borderColor = isSelected ? '#3b82f6' : (isInsufficient ? '#d1d5db' : '#9ca3af');
  const textColor = isInsufficient ? '#9ca3af' : '#1f2937';
  const shadow = isSelected 
    ? '0 4px 12px rgba(59, 130, 246, 0.3), 0 0 0 2px rgba(59, 130, 246, 0.2)' 
    : '0 2px 4px rgba(0,0,0,0.05)';

  const nodeStyle = {
    padding: '12px 16px',
    borderRadius: '12px',
    background: baseBg,
    border: `2px solid ${borderColor}`,
    boxShadow: shadow,
    color: textColor,
    minWidth: '160px',
    textAlign: 'center',
    position: 'relative',
    opacity: isInsufficient ? 0.85 : 1,
    fontFamily: '"Inter", "Roboto", sans-serif',
    transition: 'all 0.2s ease',
    // Striped background for insufficient data to make it distinct
    ...(isInsufficient && {
      backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.02) 10px, rgba(0,0,0,0.02) 20px)'
    })
  };

  const labelStyle = {
    fontWeight: isSelected ? '700' : '600',
    fontSize: '14px',
    marginBottom: '8px',
    color: isSelected ? '#1e40af' : textColor,
  };

  const badgeContainerStyle = {
    display: 'flex',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: '6px',
    marginTop: '4px',
    fontSize: '11px',
  };

  const badgeStyle = (bgColor, fgColor, borderCol) => ({
    background: bgColor,
    color: fgColor,
    padding: '3px 8px',
    borderRadius: '12px',
    fontWeight: '600',
    border: `1px solid ${borderCol}`
  });

  return (
    <div style={nodeStyle}>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      
      <div style={labelStyle}>{data.label || 'Variable'}</div>
      
      <div style={badgeContainerStyle}>
        {data.evidenceCoverage && (
          <span 
            style={badgeStyle('#e0f2fe', '#0369a1', '#bae6fd')} 
            title="Evidence Coverage"
          >
            Cov: {data.evidenceCoverage}
          </span>
        )}
        {data.reliability && (
          <span 
            style={badgeStyle('#fef3c7', '#b45309', '#fde68a')} 
            title="Reliability"
          >
            Rel: {data.reliability}
          </span>
        )}
      </div>

      {isInsufficient && (
        <div style={{ fontSize: '11px', marginTop: '8px', fontStyle: 'italic', color: '#9ca3af', fontWeight: '500' }}>
          Insufficient Data
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
});

/**
 * Custom Edge: AssociationEdge
 * Explicitly non-causal: no arrowheads, labeled "Association"
 */
const AssociationEdge = memo(({
  id,
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

  const isSelected = selected || data?.selected;
  // Use a dashed line to indicate observed association without implying direct causation
  const isWeak = data?.strength === 'weak';
  
  const edgeStyle = {
    ...style,
    strokeWidth: isSelected ? 3 : 2,
    stroke: isSelected ? '#3b82f6' : (isWeak ? '#9ca3af' : '#6b7280'),
    strokeDasharray: isWeak ? '4 4' : 'none',
    transition: 'all 0.2s ease',
  };

  return (
    <>
      {/* Note: markerEnd is intentionally omitted to prevent causal arrowheads */}
      <BaseEdge path={edgePath} style={edgeStyle} />
      
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              background: isSelected ? '#eff6ff' : '#ffffff',
              padding: '4px 8px',
              borderRadius: '8px',
              fontSize: '11px',
              fontWeight: '600',
              color: isSelected ? '#1e40af' : '#4b5563',
              border: `1px solid ${isSelected ? '#bfdbfe' : '#e5e7eb'}`,
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              pointerEvents: 'all',
              fontFamily: '"Inter", "Roboto", sans-serif',
            }}
            className="nodrag nopan"
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

/**
 * DecisionGraphCanvas Component
 * Renders a non-causal relationship graph using @xyflow/react
 */
export const DecisionGraphCanvas = ({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onEdgeClick,
}) => {
  // Memoize custom types to prevent re-renders
  const nodeTypes = useMemo(() => ({ variable: VariableNode }), []);
  const edgeTypes = useMemo(() => ({ association: AssociationEdge }), []);

  return (
    <div style={{ width: '100%', height: '100%', background: '#fafafa', borderRadius: '12px', overflow: 'hidden' }}>
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
        attributionPosition="bottom-right"
      >
        <Background color="#ccc" gap={16} />
        <Controls />
      </ReactFlow>
    </div>
  );
};

export default DecisionGraphCanvas;
