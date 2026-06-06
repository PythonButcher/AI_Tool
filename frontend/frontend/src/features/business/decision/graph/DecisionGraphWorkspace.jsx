import React, { useState } from 'react';
import './DecisionGraphWorkspace.css';

import DecisionGraphCanvas from './DecisionGraphCanvas';

const DecisionGraphWorkspace = () => {
  // State holding for variables
  const [variables, setVariables] = useState([
    { id: '1', position: { x: 0, y: 0 }, data: { label: 'Revenue' }, type: 'variable' },
    { id: '2', position: { x: 200, y: 100 }, data: { label: 'Marketing Spend' }, type: 'variable' }
  ]);
  const [edges, setEdges] = useState([
    { id: 'e1-2', source: '2', target: '1', type: 'association', data: { label: 'Observed Association' } }
  ]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  const handleNodeClick = (_, node) => setSelectedNode(node);

  return (
    <div className="decision-graph-workspace">
      {/* Controls Bar */}
      <div className="graph-controls">
        <div className="graph-controls-left">
          <button className="control-btn" onClick={() => setZoomLevel(prev => prev + 0.1)}>Zoom In</button>
          <button className="control-btn" onClick={() => setZoomLevel(prev => Math.max(0.1, prev - 0.1))}>Zoom Out</button>
          <span className="zoom-level">{Math.round(zoomLevel * 100)}%</span>
        </div>
        <div className="graph-controls-right">
          <button className="control-btn primary">Save Graph</button>
        </div>
      </div>

      <div className="graph-main-area">
        {/* Variable Tray */}
        <div className="variable-tray">
          <h3>Variables</h3>
          <button className="add-variable-btn" onClick={() => setVariables([...variables, { id: Date.now().toString(), position: { x: Math.random() * 200, y: Math.random() * 200 }, data: { label: `Var ${variables.length + 1}` }, type: 'variable' }])}>
            + Add Variable
          </button>
          <ul className="variable-list">
            {variables.map(v => (
              <li key={v.id} className="variable-item">{v.data.label}</li>
            ))}
          </ul>
        </div>

        {/* Graph Canvas Container */}
        <div className="graph-canvas-container">
          <DecisionGraphCanvas 
            nodes={variables}
            edges={edges}
            onNodesChange={(changes) => {
               // Basic stub for xyflow
            }}
            onEdgesChange={(changes) => {}}
            onNodeClick={handleNodeClick}
          />
        </div>

        {/* Inspector */}
        <div className="graph-inspector">
          <h3>Inspector</h3>
          {selectedNode ? (
            <div className="inspector-content">
              <p>Node ID: {selectedNode.id}</p>
              {/* Properties editing UI goes here */}
            </div>
          ) : (
            <p className="empty-inspector">Select a node or variable to inspect properties.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default DecisionGraphWorkspace;
