import React, { useRef } from 'react';
import { Bar, Line, Pie, Doughnut, Scatter } from 'react-chartjs-2';
import ChartToolbar from './ChartToolbar';
import { useTheme } from '@mui/material/styles';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  LineElement,
  LineController,
  PointElement,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  LineElement,
  LineController,
  PointElement,
  ArcElement,
  Tooltip,
  Legend
);

function ChartComponentAI({ normalizedChartType = 'Bar', aiChartData, onExportPdf }) {
  const chartRef = useRef(null);
  const { palette } = useTheme();
  const axisStyle = { ticks: { color: palette.text.secondary }, grid: { color: palette.divider } };

  if (!aiChartData || !aiChartData.datasets) {
    console.warn("⚠ Chart data is missing required properties.", aiChartData);
    return <div style={{ padding: "20px", textAlign: "center" }}>Chart data is incomplete.</div>;
  }

  const meta = aiChartData.meta || {};
  const resolvedChartType = meta.chartType || normalizedChartType || 'Bar';
  const axisLabels = meta.axisLabels || {};
  const legendConfig = meta.legend || {};
  const datasetCount = (aiChartData.datasets && aiChartData.datasets.length) || 0;
  const showLegend =
    legendConfig.display !== undefined ? legendConfig.display : datasetCount > 1;
  const legendPosition = legendConfig.position || 'top';

  const baseScales = (() => {
    if (resolvedChartType === 'Pie' || resolvedChartType === 'Doughnut') {
      return null;
    }
    const xTitle = axisLabels.x
      ? { display: true, text: axisLabels.x, color: palette.text.secondary }
      : undefined;
    const yTitle = axisLabels.y
      ? { display: true, text: axisLabels.y, color: palette.text.secondary }
      : undefined;
    return {
      x: {
        ...axisStyle,
        type: meta.xScaleType || 'category',
        title: xTitle,
      },
      y: {
        ...axisStyle,
        beginAtZero: meta.beginAtZero !== undefined ? meta.beginAtZero : true,
        title: yTitle,
      },
    };
  })();

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: 10,
    },
    plugins: {
      legend: { display: showLegend, position: legendPosition, labels: { color: palette.text.primary } },
      tooltip: {
        enabled: true, backgroundColor: palette.background.paper,
        titleColor: palette.text.primary, bodyColor: palette.text.secondary,
        borderColor: palette.divider, borderWidth: 1,
      },
    },
    interaction: {
      mode: 'index',
      intersect: false,
    },
    ...(baseScales ? { scales: baseScales } : {}),
    animation: {
      onComplete: () => {
        const chart = chartRef.current;
        if (chart) {
          const ctx = chart.ctx;
          ctx.save();
          ctx.globalCompositeOperation = 'destination-over';
          ctx.fillStyle = palette.background.paper;
          ctx.fillRect(0, 0, chart.width, chart.height);
          ctx.restore();
        }
      },
    },
  };

  const resolvedOptions = (() => {
    if (resolvedChartType === 'Scatter') {
      const xTitle = axisLabels.x
        ? { display: true, text: axisLabels.x, color: palette.text.secondary }
        : undefined;
      const yTitle = axisLabels.y
        ? { display: true, text: axisLabels.y, color: palette.text.secondary }
        : undefined;
      return {
        ...options,
        scales: {
          x: { ...axisStyle, type: 'linear', position: 'bottom', title: xTitle },
          y: { ...axisStyle, type: 'linear', title: yTitle },
        },
      };
    }
    return options;
  })();

  const renderType = resolvedChartType === 'Histogram' ? 'Bar' : resolvedChartType;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        boxSizing: "border-box",
        overflow: "hidden"
      }}
    >
      <ChartToolbar chartRef={chartRef} onExportPdf={onExportPdf} />
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        {renderType === "Bar" && (
          <Bar ref={chartRef} data={aiChartData} options={resolvedOptions} />
        )}
        {renderType === "Line" && (
          <Line ref={chartRef} data={aiChartData} options={resolvedOptions} />
        )}
        {renderType === "Pie" && (
          <Pie ref={chartRef} data={aiChartData} options={resolvedOptions} />
        )}
        {renderType === "Doughnut" && (
          <Doughnut ref={chartRef} data={aiChartData} options={resolvedOptions} />
        )}
        {renderType === "Scatter" && (
          <Scatter ref={chartRef} data={aiChartData} options={resolvedOptions} />
        )}
      </div>
    </div>
  );
}

export default ChartComponentAI;
