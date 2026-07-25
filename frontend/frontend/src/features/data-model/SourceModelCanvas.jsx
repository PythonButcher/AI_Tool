import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ReactFlow, Controls, Background, MarkerType, Handle, Position, ConnectionMode } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './SourceModelCanvas.css';
import RelationshipInspector from './RelationshipInspector';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const SourceNode = ({ data }) => {
  const { source } = data;
  const isPrimary = source.role === 'primary';

  return (
    <div className={`source-node ${isPrimary ? 'primary' : 'context'}`}>
      <div className="node-header">
        <span className="node-title">{source.alias || source.name}</span>
        {isPrimary && <span className="badge">Primary</span>}
      </div>
      <div className="node-body">
        {source.schema && source.schema.map(field => (
          <div key={field.name} className="field-row">
            <Handle type="target" position={Position.Left} id={field.name} style={{top: 'auto'}} className="field-handle target-handle" />
            <span className="field-name" title={field.name}>{field.name}</span>
            <span className="field-type">{field.data_type}</span>
            <Handle type="source" position={Position.Right} id={field.name} style={{top: 'auto'}} className="field-handle source-handle" />
          </div>
        ))}
      </div>
    </div>
  );
};

const SourceModelCanvas = ({ workspaceId }) => {
  const [sources, setSources] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [refreshCounter, setRefreshCounter] = useState(0);
  const [draftRelationship, setDraftRelationship] = useState(null);
  const [selectedRelationship, setSelectedRelationship] = useState(null);

  const handleRefresh = useCallback(() => {
    setRefreshCounter(c => c + 1);
  }, []);

  const handleSave = useCallback((updatedRel) => {
    setDraftRelationship(null);
    setSelectedRelationship(updatedRel);
    handleRefresh();
  }, [handleRefresh]);

  const handleCancel = useCallback(() => {
    setDraftRelationship(null);
    setSelectedRelationship(null);
  }, []);

  useEffect(() => {
    if (!workspaceId) {
      return;
    }

    let isMounted = true;
    const fetchWorkspaceData = async () => {
      setLoading(true);
      setError(null);

      try {
        const wsRes = await fetch(`${API_URL}/api/data-workspaces/${workspaceId}`);
        const wsData = await wsRes.json();
        if (!wsRes.ok) throw new Error(wsData.error?.message || wsData.error || 'Failed to fetch workspace');

        const workspaceSources = wsData.workspace?.sources || [];

        let fullSources = [];
        if (workspaceSources.length > 0) {
          const sourceParams = workspaceSources.map(s => `source_id=${s.source_id}`).join('&');
          const acRes = await fetch(`${API_URL}/api/data-workspaces/${workspaceId}/analysis-context?${sourceParams}`);
          const acData = await acRes.json();
          if (!acRes.ok) {
            if (acData.error?.code === 'managed_source_unavailable') {
               throw new Error('Managed source unavailable. Please re-upload.');
            }
            throw new Error(acData.error?.message || 'Failed to fetch source details');
          }
          fullSources = acData.sources || [];
        }

        const mergedSources = workspaceSources.map(wsSrc => {
          const detail = fullSources.find(s => s.source_id === wsSrc.source_id) || {};
          return { ...detail, ...wsSrc };
        });

        const relRes = await fetch(`${API_URL}/api/data-workspaces/${workspaceId}/relationships`);
        const relData = await relRes.json();
        if (!relRes.ok) {
           throw new Error(relData.error?.message || 'Failed to fetch relationships');
        }
        const fetchedRelationships = relData.relationships || [];

        if (isMounted) {
          setSources(mergedSources);
          setRelationships(fetchedRelationships);

          // Reconcile selection if it exists (e.g. after validation or activation)
          setSelectedRelationship(current => {
             if (current) {
                return fetchedRelationships.find(r => r.relationship_id === current.relationship_id) || null;
             }
             return current;
          });
        }
      } catch (err) {
        if (isMounted) setError(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchWorkspaceData();
    return () => { isMounted = false; };
  }, [workspaceId, refreshCounter]);

  const onConnect = useCallback((params) => {
    if (params.source === params.target) return;

    setDraftRelationship({
      left_source_id: params.source,
      right_source_id: params.target,
      field_pairs: [{ left_field: params.sourceHandle, right_field: params.targetHandle }],
      cardinality: 'one_to_one',
      join_behavior: 'inner',
      filter_direction: 'none'
    });
    setSelectedRelationship(null);
  }, []);

  const onEdgeClick = useCallback((event, edge) => {
    setDraftRelationship(null);
    if (edge.data && edge.data.relationship) {
      setSelectedRelationship(edge.data.relationship);
    }
  }, []);

  const onPaneClick = useCallback(() => {
    if (!draftRelationship) {
      setSelectedRelationship(null);
    }
  }, [draftRelationship]);

  const { nodes, edges } = useMemo(() => {
    const rfNodes = sources.map((src, i) => {
      const position = src.position ? { x: src.position.x ?? (250 * i + 100), y: src.position.y ?? 150 } : { x: 250 * i + 100, y: 150 };
      return {
        id: src.source_id,
        type: 'sourceNode',
        position: position,
        data: { source: src }
      };
    });

    const rfEdges = relationships.map(rel => {
      const isExecutable = !rel.is_suggested && rel.is_active && rel.is_confirmed && rel.validation_state === 'valid' && rel.cardinality !== 'many_to_many';

      let strokeColor = '#888';
      if (isExecutable) strokeColor = '#4caf50'; // active, valid
      else if (rel.validation_state === 'invalid' || rel.validation_state === 'blocked' || rel.cardinality === 'many_to_many') strokeColor = '#dc3545';
      else strokeColor = '#ffc107'; // stale, suggested, unconfirmed

      const isSelected = selectedRelationship?.relationship_id === rel.relationship_id;
      if (isSelected) {
        strokeColor = '#0d6efd';
      }

      let statusList = [];
      if (rel.is_suggested) statusList.push('Suggested');
      if (!rel.is_active) statusList.push('Inactive');
      if (!rel.is_confirmed) statusList.push('Unconfirmed');
      if (rel.validation_state !== 'valid') statusList.push(rel.validation_state);
      if (rel.cardinality === 'many_to_many') statusList.push('many_to_many');

      const statusText = isExecutable ? 'Executable' : statusList.join(', ');
      const labelText = `${rel.cardinality}\n(${statusText})`;

      return {
        id: rel.relationship_id,
        source: rel.left_source_id,
        target: rel.right_source_id,
        sourceHandle: rel.field_pairs && rel.field_pairs[0] ? rel.field_pairs[0].left_field : undefined,
        targetHandle: rel.field_pairs && rel.field_pairs[0] ? rel.field_pairs[0].right_field : undefined,
        type: 'smoothstep',
        animated: isExecutable,
        label: labelText,
        style: { stroke: strokeColor, strokeWidth: isSelected ? 4 : (isExecutable ? 3 : 2) },
        markerEnd: { type: MarkerType.ArrowClosed, color: strokeColor },
        data: { relationship: rel }
      };
    });

    if (draftRelationship) {
      rfEdges.push({
        id: 'draft-edge',
        source: draftRelationship.left_source_id,
        target: draftRelationship.right_source_id,
        sourceHandle: draftRelationship.field_pairs[0]?.left_field,
        targetHandle: draftRelationship.field_pairs[0]?.right_field,
        type: 'smoothstep',
        animated: true,
        label: 'Draft',
        style: { stroke: '#0d6efd', strokeWidth: 3, strokeDasharray: '5,5' },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#0d6efd' }
      });
    }

    return { nodes: rfNodes, edges: rfEdges };
  }, [sources, relationships, selectedRelationship, draftRelationship]);

  const nodeTypes = useMemo(() => ({ sourceNode: SourceNode }), []);

  if (loading && sources.length === 0) return <div className="canvas-state" role="status" aria-live="polite">Loading data model...</div>;
  if (error && sources.length === 0) {
     return <div className="canvas-state error" role="alert" aria-live="assertive">{error.message}</div>;
  }
  if (!workspaceId) {
     return <div className="canvas-state empty" role="status" aria-live="polite">No active workspace. Upload data to begin modeling.</div>;
  }
  if (sources.length === 0) {
     return <div className="canvas-state empty" role="status" aria-live="polite">Workspace has no sources.</div>;
  }

  const activeRelationship = draftRelationship || selectedRelationship;

  return (
    <div className="source-model-canvas">
      <ReactFlow 
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        nodesDraggable={false}
        nodesConnectable={true}
        elementsSelectable={true}
        connectionMode={ConnectionMode.Loose}
        onConnect={onConnect}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
      >
        <Background gap={20} color="#e0e0e0" />
        <Controls showInteractive={false} />
      </ReactFlow>

      {relationships.length === 0 && !draftRelationship && (
        <div className="no-relationships-overlay" role="status" aria-live="polite">
          No relationships defined. Connect fields between sources to draft one.
        </div>
      )}

      {activeRelationship && (
        <RelationshipInspector
          workspaceId={workspaceId}
          relationship={activeRelationship}
          sources={sources}
          onSave={handleSave}
          onCancel={handleCancel}
          onRefresh={handleRefresh}
        />
      )}
    </div>
  );
};

export default SourceModelCanvas;
