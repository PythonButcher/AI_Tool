// File: SketchParser.js
export function parseSketch(scene) {
  if (!scene || !Array.isArray(scene.elements)) {
    console.warn("🛑 SketchParser received invalid scene.");
    return {
      nodes: [],
      edges: [],
      meta: { parseNotes: ["Invalid or empty scene."] },
    };
  }

  const nodes = [];
  const edges = [];
  const parseNotes = [];

  const shapes = scene.elements.filter(el => el.type === "rectangle" || el.type === "ellipse");
  const texts  = scene.elements.filter(el => el.type === "text");
  const arrows = scene.elements.filter(el => el.type === "arrow");

  const shapeIdToNodeId = new Map();

  shapes.forEach((shape, index) => {
    // Step 1: find nearest text element
    const nearestText = texts
      .map(textEl => {
        const dx = textEl.x - shape.x;
        const dy = textEl.y - shape.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        return { el: textEl, dist };
      })
      .sort((a, b) => a.dist - b.dist)[0];

    const text = nearestText?.el?.text?.trim() || "";
    if (!text) {
      parseNotes.push(`Shape ${index} had no nearby text.`);
    }

    const [rawType, ...paramParts] = text.split(":");
    const type = rawType?.trim()?.toUpperCase();

    const supportedTypes = ["LOAD", "CLEAN", "CHART", "STORY", "EXECUTE"];
    const nodeType = supportedTypes.includes(type) ? type : "CUSTOM";

    if (nodeType === "CUSTOM") {
      parseNotes.push(`Shape ${index}: unknown type '${type}', defaulted to CUSTOM.`);
    }

    const params = {};
    const paramStr = paramParts.join(":").trim();
    if (paramStr) {
      paramStr.split(",").forEach(pair => {
        const [k, v] = pair.split("=").map(s => s.trim());
        if (k && v !== undefined) {
          params[k] = v;
        }
      });
    }

    const nodeId = `node-${shape.id}`;
    shapeIdToNodeId.set(shape.id, nodeId);

    nodes.push({
      id: nodeId,
      type: nodeType,
      label: text,
      params,
      position: { x: shape.x || 0, y: shape.y || 0 },
    });
  });

  arrows.forEach((el, index) => {
    const fromId = shapeIdToNodeId.get(el.startBinding?.elementId);
    const toId = shapeIdToNodeId.get(el.endBinding?.elementId);
    if (fromId && toId) {
      edges.push({
        id: `edge-${el.id || index}`,
        source: fromId,
        target: toId,
      });
    } else {
      parseNotes.push(`Arrow ${index}: missing source/target binding.`);
    }
  });

  return {
    nodes,
    edges,
    meta: { parseNotes },
  };
}
