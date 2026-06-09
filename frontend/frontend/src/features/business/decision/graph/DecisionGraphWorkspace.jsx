import React, { useEffect, useMemo, useState } from 'react';
import { applyEdgeChanges, applyNodeChanges } from '@xyflow/react';
import './DecisionGraphWorkspace.css';

import GraphHeader from './GraphHeader';
import VariableTray from './VariableTray';
import InspectorPanel from './InspectorPanel';
import DecisionGraphCanvas from './DecisionGraphCanvas';
import { getDecisionGraphCandidates, buildDecisionGraph } from '../decisionApi';

const getNodeKind = (node) => node.node_type || node.variable_type || node.type || 'variable';

const groupNodesForLayout = (nodes) => {
  const groups = {
    evidence: [],
    dimension: [],
    metric: [],
    variable: [],
  };

  nodes.forEach((node) => {
    const kind = getNodeKind(node);
    if (kind === 'evidence') groups.evidence.push(node);
    else if (kind === 'dimension') groups.dimension.push(node);
    else if (kind === 'metric') groups.metric.push(node);
    else groups.variable.push(node);
  });

  return groups;
};

const lanePositions = (items, y, width = 280) => {
  const centerOffset = (items.length - 1) / 2;
  return items.map((node, index) => ({
    node,
    position: {
      x: (index - centerOffset) * width,
      y,
    },
  }));
};

const layoutGraphNodes = (responseNodes) => {
  const groups = groupNodesForLayout(responseNodes);
  const positioned = [
    ...lanePositions(groups.evidence, -260, 300),
    ...lanePositions(groups.dimension, -100, 320),
    ...lanePositions(groups.metric, 140, 320),
    ...lanePositions(groups.variable, 20, 300),
  ];

  const fallback = responseNodes.map((node, index) => ({
    node,
    position: {
      x: (index % 3) * 300,
      y: Math.floor(index / 3) * 180,
    },
  }));

  return positioned.length ? positioned : fallback;
};

const compactEdgeLabel = (edge) => {
  if (edge.relationship_type === 'evidence_coverage') return 'Coverage';
  const method = edge.metrics?.method;
  if (method === 'pearson_correlation') return 'Correlation';
  if (method === 'group_mean_difference') return 'Group difference';
  if (method === 'distribution_association') return 'Distribution';
  if (method === 'trend_correlation') return 'Trend';
  return 'Observed';
};

const DecisionGraphWorkspace = ({ dataset, semanticModel, initialContext }) => {
  const [candidates, setCandidates] = useState([]);
  const [selectedVariableIds, setSelectedVariableIds] = useState(new Set());
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedElement, setSelectedElement] = useState(null);
  const [error, setError] = useState(null);

  const hasDecisionContext = Boolean(initialContext?.evidence_board || initialContext?.frame);

  useEffect(() => {
    let mounted = true;
    const fetchCandidates = async () => {
      if (!dataset || !semanticModel) return;
      try {
        setLoading(true);
        const response = await getDecisionGraphCandidates({ dataset, semantic_model: semanticModel });
        if (mounted && response?.variable_candidates) {
          setCandidates(response.variable_candidates);
        }
      } catch (err) {
        console.error('Failed to fetch graph candidates', err);
        if (mounted) setError('Failed to fetch variable candidates.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchCandidates();
    return () => { mounted = false; };
  }, [dataset, semanticModel]);

  const graphStats = useMemo(() => ({
    selectedCount: selectedVariableIds.size,
    nodeCount: nodes.length,
    edgeCount: edges.length,
  }), [edges.length, nodes.length, selectedVariableIds.size]);

  const toggleVariableSelection = (varId) => {
    setSelectedVariableIds((prev) => {
      const next = new Set(prev);
      if (next.has(varId)) next.delete(varId);
      else next.add(varId);
      return next;
    });
  };

  const handleBuildGraph = async () => {
    if (selectedVariableIds.size === 0) {
      setError('Select at least one variable before building the graph.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const payload = {
        dataset,
        semantic_model: semanticModel,
        selected_variables: Array.from(selectedVariableIds),
        graph_mode: 'mixed',
      };

      if (initialContext?.evidence_board) payload.evidence_board = initialContext.evidence_board;
      if (initialContext?.frame) payload.frame = initialContext.frame;

      const response = await buildDecisionGraph(payload);

      if (response?.nodes) {
        const positionedNodes = layoutGraphNodes(response.nodes);
        const mappedNodes = positionedNodes.map(({ node, position }) => ({
          id: node.node_id || node.variable_id,
          type: 'variable',
          position,
          data: {
            label: node.label,
            insufficientData: node.data_sufficiency?.status === 'insufficient',
            evidenceCoverage: node.evidence_coverage ? 'Yes' : null,
            reliability: node.reliability_label || null,
            rawNodeData: node,
          },
        }));

        const mappedEdges = (response.edges || []).map((edge, index) => ({
          id: edge.edge_id || `edge_${index}`,
          source: edge.source_node_id,
          target: edge.target_node_id,
          type: 'association',
          data: {
            label: edge.label || 'Observed relationship',
            displayLabel: compactEdgeLabel(edge),
            relationshipType: edge.relationship_type,
            strength: edge.metrics?.strength || edge.reliability_label || 'observed',
            rawEdgeData: edge,
          },
        }));

        setNodes(mappedNodes);
        setEdges(mappedEdges);
        setSelectedElement(null);
      }
    } catch (err) {
      console.error('Failed to build graph', err);
      setError('Failed to build decision graph.');
    } finally {
      setLoading(false);
    }
  };

  const handleClearGraph = () => {
    setNodes([]);
    setEdges([]);
    setSelectedElement(null);
  };

  return (
    <div className="decision-graph-workspace">
      <GraphHeader
        loading={loading}
        error={error}
        graphStats={graphStats}
        hasDecisionContext={hasDecisionContext}
        onClearGraph={handleClearGraph}
      />

      <div className="graph-main-area">
        <VariableTray
          candidates={candidates}
          selectedVariableIds={selectedVariableIds}
          toggleVariableSelection={toggleVariableSelection}
          onBuildGraph={handleBuildGraph}
          loading={loading}
          hasDecisionContext={hasDecisionContext}
        />

        <main className="graph-canvas-container" aria-label="Decision graph canvas">
          <DecisionGraphCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={(changes) => setNodes((currentNodes) => applyNodeChanges(changes, currentNodes))}
            onEdgesChange={(changes) => setEdges((currentEdges) => applyEdgeChanges(changes, currentEdges))}
            onNodeClick={(_, node) => setSelectedElement({ type: 'node', data: node.data })}
            onEdgeClick={(_, edge) => setSelectedElement({ type: 'edge', data: edge.data })}
          />
        </main>

        <InspectorPanel selectedElement={selectedElement} />
      </div>
    </div>
  );
};

export default DecisionGraphWorkspace;
