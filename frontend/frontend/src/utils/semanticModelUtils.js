export const summarizeSemanticModel = (semanticModel) => {
  if (!semanticModel || typeof semanticModel !== 'object') return '';

  const metricNames = (semanticModel.metrics || []).slice(0, 8).map((item) => item.label || item.name);
  const dimensionNames = (semanticModel.dimensions || []).slice(0, 8).map((item) => item.label || item.name);
  const entityNames = (semanticModel.entities || []).slice(0, 5).map((item) => item.label || item.name);

  const summaryLines = [
    'Semantic model is available for the active dataset.',
    entityNames.length ? `Entities: ${entityNames.join(', ')}` : null,
    dimensionNames.length ? `Dimensions: ${dimensionNames.join(', ')}` : null,
    metricNames.length ? `Metrics: ${metricNames.join(', ')}` : null,
  ].filter(Boolean);

  return summaryLines.join('\n');
};
