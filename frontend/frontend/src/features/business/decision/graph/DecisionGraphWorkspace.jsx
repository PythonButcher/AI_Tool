import React, { useState, useEffect, useCallback } from 'react';
import './DecisionGraphWorkspace.css';

import DecisionGraphCanvas from './DecisionGraphCanvas';
import { getDecisionGraphCandidates, buildDecisionGraph } from '../decisionApi';

const DecisionGraphWorkspace = ({ dataset, semanticModel, initialContext }) => {
  // Graph Candidates State
  const [candidates, setCandidates] = useState([]);
  const [selectedVariableIds, setSelectedVariableIds] = useState(new Set());

  // Graph State
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(false);

  // Inspector State
  const [selectedElement, setSelectedElement] = useState(null); // { type: 'node'|'edge', data: Object }
  const [zoomLevel, setZoomLevel] = useState(1);
  const [error, setError] = useState(null);

  // Fetch candidates on mount
  useEffect(() => {
    let mounted = true;
    const fetchCandidates = async () => {
      if (!dataset || !semanticModel) return;
      try {
        setLoading(true);
        const payload = { dataset, semantic_model: semanticModel };
        const response = await getDecisionGraphCandidates(payload);
        if (mounted && response?.variable_candidates) {
          setCandidates(response.variable_candidates);
        }
      } catch (err) {
        console.error("Failed to fetch graph candidates", err);
        if (mounted) setError("Failed to fetch variable candidates.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchCandidates();
    return () => { mounted = false; };
  }, [dataset, semanticModel]);

  const toggleVariableSelection = (varId) => {
    setSelectedVariableIds(prev => {
      const next = new Set(prev);
      if (next.has(varId)) next.delete(varId);
      else next.add(varId);
      return next;
    });
  };

  const handleBuildGraph = async () => {
    if (selectedVariableIds.size === 0) {
      setError("Please select at least one variable.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const payload = {
        dataset,
        semantic_model: semanticModel,
        selected_variables: Array.from(selectedVariableIds),
        graph_mode: 'mixed'
      };

      if (initialContext?.evidence_board) {
        payload.evidence_board = initialContext.evidence_board;
      }
      if (initialContext?.frame) {
        payload.frame = initialContext.frame;
      }

      const response = await buildDecisionGraph(payload);

      if (response && response.nodes) {
        // Simple circular layout for nodes if backend doesn't provide positions
        const radius = 150;
        const mappedNodes = response.nodes.map((node, index) => {
          const angle = (index / response.nodes.length) * 2 * Math.PI;
          return {
            id: node.node_id || node.variable_id || `n_${index}`,
            type: 'variable',
            position: {
              x: Math.cos(angle) * radius + 300,
              y: Math.sin(angle) * radius + 200
            },
            data: {
              label: node.label,
              insufficientData: node.data_sufficiency?.status === 'insufficient',
              evidenceCoverage: node.evidence_coverage ? 'Yes' : null,
              reliability: null,
              rawNodeData: node
            }
          };
        });

        const mappedEdges = (response.edges || []).map((edge, index) => ({
          id: edge.edge_id || `e_${index}`,
          source: edge.source_node_id,
          target: edge.target_node_id,
          type: 'association',
          data: {
            label: edge.label || 'Association',
            relationshipType: edge.relationship_type,
            strength: edge.metrics?.strength || 'moderate',
            rawEdgeData: edge
          }
        }));

        setNodes(mappedNodes);
        setEdges(mappedEdges);
        setSelectedElement(null);
      }
    } catch (err) {
      console.error("Failed to build graph", err);
      setError("Failed to build decision graph.");
    } finally {
      setLoading(false);
    }
  };

  const handleNodeClick = (_, node) => {
    setSelectedElement({ type: 'node', data: node.data });
  };

  const handleEdgeClick = (_, edge) => {
    setSelectedElement({ type: 'edge', data: edge.data });
  };

  const renderInspectorContent = () => {
    if (!selectedElement) {
      return <p className="empty-inspector">Select a node or variable to inspect properties.</p>;
    }

    if (selectedElement.type === 'node') {
      const node = selectedElement.data.rawNodeData;
      if (!node) return <p>No detailed data available.</p>;

      return (
        <div className="inspector-content">
          <h4>{node.label}</h4>
          <p><strong>Type:</strong> {node.variable_type || node.node_type}</p>
          {node.data_type && <p><strong>Data Type:</strong> {node.data_type}</p>}
          {node.semantic_role && <p><strong>Semantic Role:</strong> {node.semantic_role}</p>}

          {node.data_sufficiency && (
            <div className="inspector-section">
              <h5>Data Sufficiency</h5>
              <p>Status: {node.data_sufficiency.status}</p>
              <p>{node.data_sufficiency.summary}</p>
            </div>
          )}

          {node.limitations && node.limitations.length > 0 && (
            <div className="inspector-section">
              <h5>Limitations</h5>
              <ul>
                {node.limitations.map((lim, i) => <li key={i}>{lim}</li>)}
              </ul>
            </div>
          )}
        </div>
      );
    }

    if (selectedElement.type === 'edge') {
      const edge = selectedElement.data.rawEdgeData;
      if (!edge) return <p>No detailed data available.</p>;

      return (
        <div className="inspector-content">
          <h4>{edge.label || 'Association'}</h4>
          <p><strong>Relationship Type:</strong> {edge.relationship_type}</p>
          <p><strong>Evidence Basis:</strong> {edge.evidence_basis}</p>
          <p><strong>Causal Status:</strong> {edge.causal_status || 'not_causal_claim'}</p>
          <p><strong>Reliability Label:</strong> {edge.reliability_label}</p>

          {edge.summary && (
             <div className="inspector-section">
               <h5>Summary</h5>
               <p>{edge.summary}</p>
             </div>
          )}

          {edge.metrics && (
            <div className="inspector-section">
              <h5>Metrics</h5>
              {edge.metrics.method && <p>Method: {edge.metrics.method}</p>}
              {edge.metrics.strength && <p>Strength: {edge.metrics.strength}</p>}
              {edge.metrics.direction && <p>Direction: {edge.metrics.direction}</p>}
              {edge.metrics.correlation !== undefined && <p>Correlation: {edge.metrics.correlation}</p>}
              {edge.metrics.trend_correlation !== undefined && <p>Trend Correlation: {edge.metrics.trend_correlation}</p>}
              {edge.metrics.cramers_v !== undefined && <p>Cramer's V: {edge.metrics.cramers_v}</p>}
              {edge.metrics.top_groups && <p>Top Groups: {edge.metrics.top_groups.join(', ')}</p>}
            </div>
          )}

          {edge.data_sufficiency && (
            <div className="inspector-section">
              <h5>Data Sufficiency</h5>
              <p>Status: {edge.data_sufficiency.status}</p>
              {edge.data_sufficiency.summary && <p>{edge.data_sufficiency.summary}</p>}
              {edge.data_sufficiency.row_count !== undefined && <p>Row Count: {edge.data_sufficiency.row_count}</p>}
              {edge.data_sufficiency.sample_size !== undefined && <p>Sample Size: {edge.data_sufficiency.sample_size}</p>}
            </div>
          )}

          {edge.limitations && edge.limitations.length > 0 && (
            <div className="inspector-section">
              <h5>Limitations</h5>
              <ul>
                {edge.limitations.map((lim, i) => <li key={i}>{lim}</li>)}
              </ul>
            </div>
          )}
        </div>
      );
    }
  };

  return (
    <div className="decision-graph-workspace">
      {/* Controls Bar */}
      <div className="graph-controls">
        <div className="graph-controls-left">
          <button className="control-btn" onClick={() => setZoomLevel(prev => prev + 0.1)}>Zoom In</button>
          <button className="control-btn" onClick={() => setZoomLevel(prev => Math.max(0.1, prev - 0.1))}>Zoom Out</button>
          <span className="zoom-level">{Math.round(zoomLevel * 100)}%</span>
          {loading && <span className="graph-loading">Loading...</span>}
          {error && <span className="graph-error">{error}</span>}
        </div>
      </div>

      <div className="graph-main-area">
        {/* Variable Tray */}
        <div className="variable-tray">
          <h3>Variables</h3>
          {initialContext?.evidence_board === undefined && (
            <p className="graph-error" style={{ fontSize: '11px', margin: '4px 0 8px', color: '#b45309' }}>
              Note: Evidence coverage is unavailable (launched without AI Chat context).
            </p>
          )}
          <button
            className="control-btn primary"
            style={{ width: '100%', marginBottom: '10px' }}
            onClick={handleBuildGraph}
            disabled={selectedVariableIds.size === 0 || loading}
          >
            Build Graph
          </button>
          <ul className="variable-list">
            {candidates.map(v => (
              <li key={v.variable_id} className="variable-item">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={selectedVariableIds.has(v.variable_id)}
                    onChange={() => toggleVariableSelection(v.variable_id)}
                  />
                  {v.label || v.name || v.variable_id}
                </label>
              </li>
            ))}
          </ul>
        </div>

        {/* Graph Canvas Container */}
        <div className="graph-canvas-container">
          <DecisionGraphCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={(changes) => {}}
            onEdgesChange={(changes) => {}}
            onNodeClick={handleNodeClick}
            onEdgeClick={handleEdgeClick}
          />
        </div>

        {/* Inspector */}
        <div className="graph-inspector">
          <h3>Inspector</h3>
          {renderInspectorContent()}
        </div>
      </div>
    </div>
  );
};

export default DecisionGraphWorkspace;
