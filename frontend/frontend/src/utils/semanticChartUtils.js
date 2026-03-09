const DEFAULT_SERIES_COLOR = {
  backgroundColor: 'rgba(33, 150, 243, 0.32)',
  borderColor: '#1976d2',
};

const coerceChartValue = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return value;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

export const buildSemanticChartData = (resolution) => {
  if (!resolution || typeof resolution !== 'object') return null;

  const labels = Array.isArray(resolution.chart_ready?.labels) && resolution.chart_ready.labels.length
    ? resolution.chart_ready.labels
    : ['All Data'];

  const sourceValues = Array.isArray(resolution.chart_ready?.values) && resolution.chart_ready.values.length
    ? resolution.chart_ready.values
    : [resolution.summary?.value ?? 0];

  return {
    labels,
    datasets: [
      {
        label: resolution.metric?.label || resolution.metric?.name || 'Semantic metric',
        data: sourceValues.map(coerceChartValue),
        backgroundColor: DEFAULT_SERIES_COLOR.backgroundColor,
        borderColor: DEFAULT_SERIES_COLOR.borderColor,
        borderWidth: 1,
      },
    ],
  };
};

export const formatSemanticValue = (value, formatHint) => {
  if (value === null || value === undefined || value === '') return 'No value';

  if (typeof value === 'number') {
    if (formatHint === 'currency') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 2,
      }).format(value);
    }

    if (formatHint === 'percentage') {
      return `${(value * 100).toFixed(1)}%`;
    }

    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 2,
    }).format(value);
  }

  return String(value);
};
