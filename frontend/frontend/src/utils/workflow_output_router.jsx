// 📂 workflow_output_router.js — converted from .ts for JSX compatibility

/**
 * Converts raw pipelineResults into **one** renderable window for CanvasContainer.
 * Looks first for any consolidated `ai_report*` node; if found, it becomes the
 * sole window.  Otherwise falls back to the per-node text / chart logic.
 */
export function getWorkflowWindows(results) {
  const windows = [];

  // ✅ Prefer the consolidated AI-Reporter block
  const reportKey = Object.keys(results).find((id) => id.startsWith('ai_report'));
  if (reportKey) {
    const entry = results[reportKey];
    if (entry?.status === 'success' && entry.result) {
      windows.push({
        id: reportKey,
        type: 'report',        // CanvasContainer already supports this
        label: '🧠 AI Report',
        content: entry.result, // { summary, insights, execution, chartType, chartData }
      });
      return windows;         // ⬅️  stop – only one window required
    }
  }

  // ⬇️ fallback: keep existing behaviour if no report was built
  Object.entries(results).forEach(([nodeId, result]) => {
    if (result.status !== 'success' || !result.result) return;

    const { reply, chartType, chartData } = result.result;

    if (reply) {
      windows.push({
        id: nodeId,
        type: 'text',
        label: `Output: ${nodeId}`,
        content: reply,
      });
    }

    if (chartType && Array.isArray(chartData)) {
      windows.push({
        id: nodeId,
        type: 'chart',
        label: `Chart: ${nodeId}`,
        chartType,
        chartData,
      });
    }
  });

  return windows;
}
