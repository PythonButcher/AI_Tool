export const summarizeSemanticModel = (semanticModel) => {
  if (!semanticModel || typeof semanticModel !== 'object') return '';

  const inferredMetrics = (semanticModel.metrics || [])
    .filter((item) => item?.is_inferred)
    .slice(0, 8)
    .map((item) => item.label || item.name);
  const userDefinedMetrics = (semanticModel.metrics || [])
    .filter((item) => item?.is_user_defined)
    .slice(0, 8)
    .map((item) => {
      const label = item.label || item.name;
      const expressionType = item?.expression?.type === 'derived_formula' ? 'formula' : (item.default_aggregation || item?.expression?.aggregation || 'metric');
      return `${label} (${expressionType})`;
    });
  const dimensionNames = (semanticModel.dimensions || []).slice(0, 8).map((item) => item.label || item.name);
  const entityNames = (semanticModel.entities || []).slice(0, 5).map((item) => item.label || item.name);

  const summaryLines = [
    'Semantic model is available for the active dataset.',
    entityNames.length ? `Entities: ${entityNames.join(', ')}` : null,
    dimensionNames.length ? `Dimensions: ${dimensionNames.join(', ')}` : null,
    inferredMetrics.length ? `Inferred metrics: ${inferredMetrics.join(', ')}` : null,
    userDefinedMetrics.length ? `User-defined metrics: ${userDefinedMetrics.join(', ')}` : null,
  ].filter(Boolean);

  return summaryLines.join('\n');
};
