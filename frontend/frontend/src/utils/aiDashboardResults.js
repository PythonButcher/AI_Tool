// Only executed results can enter the dashboard. Clarification and narrative
// answers may carry dataset context but are not numerical KPI cards.
export const canSaveResult = (artifact) => {
  if (!artifact?.bi_grounding?.metric_definition || artifact.content?.reason_code) return false;
  if (artifact.type === 'chart') {
    return Array.isArray(artifact.content?.chartData?.labels)
      && artifact.content.chartData.labels.length > 0
      && Array.isArray(artifact.content.chartData.datasets);
  }
  return artifact.type === 'answer' && Number.isFinite(artifact.content?.summary?.value)
    && !(artifact.bi_grounding.dimensions?.length);
};

const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
};

export const resultKey = (artifact) => JSON.stringify(canonical({
  type: artifact.type,
  dataset: artifact.dataset_context || artifact.bi_grounding?.dataset,
  lineage: artifact.analysis_lineage || artifact.bi_grounding?.analysis_lineage,
  metric: artifact.bi_grounding?.metric_definition,
  aggregation: artifact.bi_grounding?.aggregation,
  dimensions: artifact.bi_grounding?.dimensions,
  filters: artifact.bi_grounding?.filters,
  period: artifact.bi_grounding?.time_period,
  grain: artifact.bi_grounding?.time_granularity,
  data: artifact.type === 'chart' ? artifact.content?.chartData : artifact.content?.summary,
}));

let nextId = 0;
export const dashboardItemFromResult = (artifact, title) => {
  if (!canSaveResult(artifact)) throw new Error('Choose a verified chart or ungrouped metric total.');
  const savedAt = new Date().toISOString();
  const { scope, ...result } = artifact;
  const snapshot = JSON.parse(JSON.stringify(result));
  return {
    id: `dashboard-result-${Date.now()}-${++nextId}`,
    itemType: artifact.type === 'chart' ? 'chart' : 'kpi',
    title: title?.trim() || artifact.title || 'Business result',
    chartType: artifact.content?.chartType,
    chartSpec: artifact.content?.chartSpec || null,
    dataSourceMode: 'snapshot',
    resultSnapshot: { schemaVersion: 'ai_chat_result_snapshot_v1', artifact: snapshot, savedAt },
    sourceMetadata: {
      sourceSurface: 'ai_chat', sourceMode: artifact.source || 'semantic',
      sourceArtifactId: artifact.artifact_id || artifact.id || null,
      datasetName: artifact.bi_grounding.dataset?.dataset_name || artifact.bi_grounding.dataset?.name || null,
      resultKey: resultKey(artifact),
    },
    createdAt: savedAt, updatedAt: savedAt,
  };
};

export const appendDashboardResults = (existing, selections) => {
  const keys = new Set(existing.map(item => item.sourceMetadata?.resultKey).filter(Boolean));
  const items = [...existing];
  const added = [];
  let bottom = Math.max(0, ...existing.map(item => (item.layout?.y || 0) + (item.layout?.h || 0)));
  for (const { artifact, title } of selections) {
    const item = dashboardItemFromResult(artifact, title);
    if (keys.has(item.sourceMetadata.resultKey)) continue;
    keys.add(item.sourceMetadata.resultKey);
    // Append below existing content regardless of its manually edited layout.
    item.layout = { x: 0, y: bottom, w: item.itemType === 'kpi' ? 3 : 6, h: item.itemType === 'kpi' ? 4 : 8 };
    bottom += item.layout.h;
    items.push(item);
    added.push(item.id);
  }
  return { items, added, skipped: selections.length - added.length };
};
