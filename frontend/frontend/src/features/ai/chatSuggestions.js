export const buildChatSuggestions = (model) => {
  const metric = model?.metrics?.find(item => item.id && (item.label || item.name));
  if (!metric) return [];
  const metricName = metric.label || metric.name;
  const dimensions = model.dimensions || [];
  const isTime = item => item.semantic_kind === 'temporal' || ['date', 'datetime', 'timestamp'].includes(item.data_type);
  const category = dimensions.find(item => item.field && !isTime(item));
  const dates = dimensions.filter(isTime);
  const suggestions = [`What is ${metricName}?`];
  if (category) suggestions.push(`Show ${metricName} by ${category.label || category.name || category.field} as a chart`);
  if (dates.length === 1) suggestions.push(`Show monthly ${metricName} by ${dates[0].label || dates[0].field}`);
  if (category || dates.length === 1) {
    suggestions.push(`Build a dashboard with ${dates.length === 1 ? 'monthly ' : ''}${metricName}${category ? ` and a breakdown by ${category.label || category.field}` : ''}`);
  }
  return suggestions;
};
