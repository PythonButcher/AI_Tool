import React, { useRef } from 'react';
import { Bar, Line, Pie, Doughnut, Scatter } from 'react-chartjs-2';
import ChartToolbar from './ChartToolbar';
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

function ChartComponentAI({ normalizedChartType = 'Bar', aiChartData }) {
  const chartRef = useRef(null);

  if (!aiChartData || !aiChartData.datasets) {
    console.warn("⚠ Chart data is missing required properties.", aiChartData);
    return <div style={{ padding: "20px", textAlign: "center" }}>Chart data is incomplete.</div>;
  }

  const meta = aiChartData.meta || {};
  const axisLabels = meta.axisLabels || {};
  const legendConfig = meta.legend || {};
  const datasetCount = (aiChartData.datasets && aiChartData.datasets.length) || 0;
  const showLegend =
    legendConfig.display !== undefined ? legendConfig.display : datasetCount > 1;
  const legendPosition = legendConfig.position || 'top';

  const baseScales = (() => {
    if (normalizedChartType === 'Pie' || normalizedChartType === 'Doughnut') {
      return null;
    }
    const xTitle = axisLabels.x
      ? { display: true, text: axisLabels.x }
      : undefined;
    const yTitle = axisLabels.y
      ? { display: true, text: axisLabels.y }
      : undefined;
    return {
      x: {
        type: meta.xScaleType || 'category',
        title: xTitle,
      },
      y: {
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
      legend: { display: showLegend, position: legendPosition },
      tooltip: { enabled: true },
      backgroundColor: {
        color: 'white', // fallback if we use a plugin, optional
      },
    },
    ...(baseScales ? { scales: baseScales } : {}),
    // 🔥 Custom hook to fill background
    animation: {
      onComplete: () => {
        const chart = chartRef.current;
        if (chart) {
          const ctx = chart.ctx;
          ctx.save();
          ctx.globalCompositeOperation = 'destination-over';
          ctx.fillStyle = '#ffffff'; // white background
          ctx.fillRect(0, 0, chart.width, chart.height);
          ctx.restore();
        }
      },
    },
  };

  const resolvedOptions = (() => {
    if (normalizedChartType === 'Scatter') {
      const xTitle = axisLabels.x
        ? { display: true, text: axisLabels.x }
        : undefined;
      const yTitle = axisLabels.y
        ? { display: true, text: axisLabels.y }
        : undefined;
      return {
        ...options,
        scales: {
          x: { type: 'linear', position: 'bottom', title: xTitle },
          y: { type: 'linear', title: yTitle },
        },
      };
    }
    return options;
  })();

  const renderType = normalizedChartType === 'Histogram' ? 'Bar' : normalizedChartType;

  return (
    <div style={{ width: "80%", height: "80%", margin: "auto", position: "relative" }}>
      <ChartToolbar chartRef={chartRef} />
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
  );
}

export default ChartComponentAI;
