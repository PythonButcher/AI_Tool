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

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: 10,
    },
    plugins: {
      legend: { display: true },
      tooltip: { enabled: true },
      backgroundColor: {
        color: 'white', // fallback if we use a plugin, optional
      },
    },
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

  const resolvedOptions =
    normalizedChartType === 'Scatter'
      ? {
          ...options,
          scales: {
            x: { type: 'linear', position: 'bottom' },
            y: { type: 'linear' },
          },
        }
      : options;
  
  return (
    <div style={{ width: "80%", height: "80%", margin: "auto", position: "relative" }}>
      <ChartToolbar chartRef={chartRef} />
      {normalizedChartType === "Bar" && (
        <Bar ref={chartRef} data={aiChartData} options={resolvedOptions} />
      )}
      {normalizedChartType === "Line" && (
        <Line ref={chartRef} data={aiChartData} options={resolvedOptions} />
      )}
      {normalizedChartType === "Pie" && (
        <Pie ref={chartRef} data={aiChartData} options={resolvedOptions} />
      )}
      {normalizedChartType === "Doughnut" && (
        <Doughnut ref={chartRef} data={aiChartData} options={resolvedOptions} />
      )}
      {normalizedChartType === "Scatter" && (
        <Scatter ref={chartRef} data={aiChartData} options={resolvedOptions} />
      )}
    </div>
  );
}

export default ChartComponentAI;
