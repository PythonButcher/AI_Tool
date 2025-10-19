import React, { useEffect, useMemo } from 'react';
import ChartComponentAI from '../chart_components/ChartComponentAI';
import PropTypes from 'prop-types';
import { getDynamicColors } from '../../utils/ChartStyles';

/**
 * Renders an AI-generated chart.
 * Accepts either full Chart.js-style data _{labels,datasets}_ **or**
 * a simple array of `{ label, value }` objects returned by the workflow.
 */
function AICharts({ aiChartType, aiChartData }) {

  console.log(
    `AICharts PROPS (from AIReporter): aiChartType: '${aiChartType}', aiChartData:`, aiChartData,
    `| typeof: ${typeof aiChartData}`,
    `| isArray: ${Array.isArray(aiChartData)}`,
    `| length: ${Array.isArray(aiChartData) ? aiChartData.length : 'N/A'}`
  );
  /* 1️⃣ Normalise chart-type strings coming back from the LLM */
  const normalizedChartType = useMemo(() => {
    if (!aiChartType) return null;
    const t = aiChartType.trim().toLowerCase();
    if (t === 'bar chart')       return 'Bar';
    if (t === 'line chart')      return 'Line';
    if (t === 'pie chart')       return 'Pie';
    if (t === 'doughnut chart')  return 'Doughnut';
    if (t === 'scatter chart' || t === 'scatter plot') return 'Scatter';
    if (t === 'histogram' || t === 'histogram chart') return 'Histogram';
    return aiChartType;          // fall-through to whatever the LLM sent
  }, [aiChartType]);

  /* 2️⃣ Massage raw arrays into Chart.js format when necessary */
  const preparedData = useMemo(() => {
    if (!aiChartData) return null;

    // Already well-formed
    if (aiChartData.labels && aiChartData.datasets) return aiChartData;

    // Simple [{label,value}] array ➜ build datasets on the fly
    if (
      Array.isArray(aiChartData) &&
      aiChartData.every(d => 'label' in d && 'value' in d)
    ) {
      return {
        labels: aiChartData.map(d => d.label),
        datasets: [
          {
            label: 'value',
            data: aiChartData.map(d => d.value),
          },
        ],
      };
    }
    // Anything else is unsupported
    return null;
  }, [aiChartData]);

  // Inject dynamic colors if datasets lack styling
  const coloredData = useMemo(() => {
    if (!preparedData) return null;
    const needsColor = !preparedData.datasets[0]?.backgroundColor;
    if (!needsColor) return preparedData;
    const colors = getDynamicColors(preparedData.labels.length);
    const datasets = preparedData.datasets.map(ds => ({
      ...ds,
      backgroundColor: colors.map(c => c.backgroundColor),
      borderColor: colors.map(c => c.borderColor),
      borderWidth: ds.borderWidth ?? 1,
    }));
    return { ...preparedData, datasets };
  }, [preparedData]);

  /* 3️⃣ Debug */
  useEffect(() => {
    console.log('📊 AICharts ready:', { normalizedChartType, preparedData });
  }, [normalizedChartType, preparedData]);

  /* 4️⃣ Graceful fallback */
  if (!preparedData) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        No valid chart data available.
      </div>
    );
  }

  /* 5️⃣ Render */
  return (
    <ChartComponentAI
      normalizedChartType={normalizedChartType}
      aiChartData={coloredData}
    />
  );
}

/* Prop validation */
AICharts.propTypes = {
  aiChartType: PropTypes.string.isRequired,
  aiChartData: PropTypes.oneOfType([PropTypes.object, PropTypes.array])
    .isRequired,
};

export default AICharts;