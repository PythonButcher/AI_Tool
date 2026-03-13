import { AiCommandBlocks } from './AiCommandBlock';

export const DROPZONE_NODE_ID = 'dropzone-node';

export const createDropZoneNode = () => ({
  id: DROPZONE_NODE_ID,
  type: 'dropZoneNode',
  position: { x: 600, y: 900 },
  data: { hovering: false },
  deletable: false,
  draggable: false,
  selectable: false,
});

export const deriveCommandType = (node) => {
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

  if (command.startsWith('/')) {
    return command.slice(1);
  }

  return command;
};

export const buildNodeParams = (commandType, params = {}) => {
  const defaults = AiCommandBlocks[commandType]?.defaultParams || {};
  return {
    ...defaults,
    ...(params && typeof params === 'object' ? params : {}),
  };
};

export const createWorkflowNode = (commandType, position = { x: 200, y: 200 }, overrides = {}) => {
  const command = AiCommandBlocks[commandType];
  if (!command) {
    return null;
  }

  return {
    id: overrides.id || `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'AiWorkLabNodeSizer',
    position,
    data: {
      icon: command.icon,
      label: overrides.label || command.display,
      description: overrides.description || command.description,
      command: command.command,
      params: buildNodeParams(commandType, overrides.params),
      commandType,
    },
  };
};

export const buildWorkflowDefinition = ({ workflowMeta, nodes, edges }) => {
  const workflowNodes = (nodes || [])
    .filter((node) => node.id !== DROPZONE_NODE_ID)
    .map((node) => {
      const params = node.data?.params && typeof node.data.params === 'object'
        ? node.data.params
        : {};

      const type = deriveCommandType(node);

      return {
        id: node.id,
        type: typeof type === 'string' ? type : null,
        label: node.data?.label,
        description: node.data?.description || '',
        command: node.data?.command,
        params,
        position: node.position,
      };
    });

  const workflowEdges = (edges || []).map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
  }));

  return {
    id: workflowMeta?.id || null,
    name: workflowMeta?.name || 'Untitled Workflow',
    description: workflowMeta?.description || '',
    category: workflowMeta?.category || 'Custom',
    is_template: Boolean(workflowMeta?.isTemplate),
    source_workflow_id: workflowMeta?.sourceWorkflowId || null,
    continue_on_error: Boolean(workflowMeta?.continueOnError),
    nodes: workflowNodes,
    edges: workflowEdges,
    execution_order: computeExecutionOrder(workflowNodes, workflowEdges),
  };
};

export const computeExecutionOrder = (nodes, edges) => {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return [];
  }

  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const indegree = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(nodes.map((node) => [node.id, []]));

  (edges || []).forEach((edge) => {
    if (!nodeMap.has(edge.source) || !nodeMap.has(edge.target)) {
      return;
    }

    outgoing.get(edge.source).push(edge.target);
    indegree.set(edge.target, (indegree.get(edge.target) || 0) + 1);
  });

  const sortByCanvasPosition = (leftId, rightId) => {
    const leftNode = nodeMap.get(leftId) || {};
    const rightNode = nodeMap.get(rightId) || {};
    const leftY = leftNode.position?.y || 0;
    const rightY = rightNode.position?.y || 0;
    if (leftY !== rightY) {
      return leftY - rightY;
    }
    return (leftNode.position?.x || 0) - (rightNode.position?.x || 0);
  };

  const queue = Array.from(indegree.entries())
    .filter(([, degree]) => degree === 0)
    .map(([nodeId]) => nodeId)
    .sort(sortByCanvasPosition);

  const ordered = [];

  while (queue.length > 0) {
    const nodeId = queue.shift();
    ordered.push(nodeId);

    outgoing.get(nodeId).forEach((targetId) => {
      const nextValue = (indegree.get(targetId) || 0) - 1;
      indegree.set(targetId, nextValue);
      if (nextValue === 0) {
        queue.push(targetId);
        queue.sort(sortByCanvasPosition);
      }
    });
  }

  if (ordered.length !== nodes.length) {
    return [...nodes]
      .sort((left, right) => {
        const leftY = left.position?.y || 0;
        const rightY = right.position?.y || 0;
        if (leftY !== rightY) {
          return leftY - rightY;
        }
        return (left.position?.x || 0) - (right.position?.x || 0);
      })
      .map((node) => node.id);
  }

  return ordered;
};

export const buildReactFlowNodeFromWorkflow = (workflowNode) => {
  const typeKey = String(workflowNode?.type || '').toLowerCase();
  const command = workflowNode?.command || AiCommandBlocks[typeKey]?.command || `/${typeKey}`;
  const commandDef = AiCommandBlocks[typeKey] || Object.values(AiCommandBlocks).find((item) => item.command === command);

  return {
    id: workflowNode.id || `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'AiWorkLabNodeSizer',
    position: workflowNode.position || { x: 200, y: 200 },
    data: {
      icon: commandDef?.icon || null,
      label: workflowNode.label || commandDef?.display || workflowNode.type || 'Custom Step',
      description: workflowNode.description || commandDef?.description || '',
      command,
      params: buildNodeParams(typeKey || deriveCommandType({ data: { command } }), workflowNode.params),
      commandType: typeKey || deriveCommandType({ data: { command } }),
    },
  };
};

export const buildReactFlowGraph = (workflowDefinition) => {
  const nodes = Array.isArray(workflowDefinition?.nodes) ? workflowDefinition.nodes : [];
  const edges = Array.isArray(workflowDefinition?.edges) ? workflowDefinition.edges : [];

  return {
    nodes: [...nodes.map(buildReactFlowNodeFromWorkflow), createDropZoneNode()],
    edges: edges.map((edge) => ({
      id: edge.id || `edge-${Math.random().toString(36).slice(2, 8)}`,
      source: edge.source,
      target: edge.target,
      type: 'default',
    })),
  };
};

export const createEmptyWorkflowMeta = () => ({
  id: null,
  name: 'Untitled Workflow',
  description: 'Business automation workflow',
  category: 'Custom',
  isTemplate: false,
  sourceWorkflowId: null,
  continueOnError: false,
});
