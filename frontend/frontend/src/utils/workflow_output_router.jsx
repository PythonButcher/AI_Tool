export function getWorkflowWindows(results) {
  const windows = [];
  const isCompleted = (status) => status === 'completed' || status === 'success';

  const reportKey = Object.keys(results).find((id) => id.startsWith('ai_report'));
  if (reportKey) {
    const entry = results[reportKey];
    if (isCompleted(entry?.status) && entry.result) {
      windows.push({
        id: reportKey,
        type: 'report',
        label: 'AI Report',
        content: entry.result,
      });
      return windows;
    }
  }

  Object.entries(results).forEach(([nodeId, result]) => {
    if (!isCompleted(result?.status) || !result.result) return;

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
