// ChartComponent.jsx (new, standard component)
import React, { useRef, useMemo, useContext } from 'react';
import { Bar, Line, Pie, Doughnut, Scatter } from 'react-chartjs-2';
import ChartToolbar from './ChartToolbar';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { ThemeContext } from '../../context/ThemeContext';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
);

function ChartComponent({ chartType = 'Bar', chartData, mapping }) {
  const chartRef = useRef(null);
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'dark';

  const processedData = useMemo(() => {
    if (!chartData || !chartData.datasets) return chartData;

    return {
      ...chartData,
      datasets: chartData.datasets.map((ds) => ({
        ...ds,
        borderRadius: chartType === 'Bar' ? 6 : 0,
        tension: chartType === 'Line' ? 0.35 : 0,
        pointRadius: chartType === 'Line' || chartType === 'Scatter' ? 4 : 0,
        pointHoverRadius: 6,
        borderWidth: chartType === 'Line' ? 2.5 : 1,
        fill: chartType === 'Line' ? 'origin' : false,
        backgroundColor: ds.backgroundColor || (isDark ? 'rgba(59, 130, 246, 0.5)' : 'rgba(37, 99, 235, 0.6)'),
      })),
    };
  }, [chartData, chartType, isDark]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: {
        top: 20,
        bottom: 10,
        left: 10,
        right: 10,
      },
    },
    scales: {
      x: {
        display: chartType !== 'Pie' && chartType !== 'Doughnut',
        grid: {
          display: false,
        },
        border: {
          display: false,
        },
        ticks: {
          color: isDark ? '#94a3b8' : '#64748b',
          font: {
            family: "'Inter', sans-serif",
            size: 11,
          },
        },
      },
      y: {
        display: chartType !== 'Pie' && chartType !== 'Doughnut',
        grid: {
          color: isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(226, 232, 240, 0.6)',
          drawBorder: false,
          lineWidth: 1,
        },
        border: {
          display: false,
          dash: [4, 4],
        },
        ticks: {
          color: isDark ? '#94a3b8' : '#64748b',
          font: {
            family: "'Inter', sans-serif",
            size: 11,
          },
          padding: 8,
        },
      },
    },
    plugins: {
      legend: {
        display: chartType === 'Pie' || chartType === 'Doughnut',
        position: 'bottom',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 20,
          color: isDark ? '#f8fafc' : '#0f172a',
          font: {
            family: "'Inter', sans-serif",
            size: 12,
            weight: 500,
          },
        },
      },
      tooltip: {
        backgroundColor: isDark ? '#1e293b' : '#ffffff',
        titleColor: isDark ? '#f8fafc' : '#0f172a',
        bodyColor: isDark ? '#94a3b8' : '#475569',
        borderColor: isDark ? '#334155' : '#e2e8f0',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        displayColors: true,
        usePointStyle: true,
        titleFont: {
          family: "'Inter', sans-serif",
          size: 13,
          weight: 600,
        },
        bodyFont: {
          family: "'Inter', sans-serif",
          size: 12,
        },
      },
    },
  }), [chartType, isDark]);

  if (!chartData || !chartData.labels || !chartData.datasets) {
    return <div style={{ padding: "20px", textAlign: "center", color: "var(--text-secondary)" }}>Chart data is incomplete.</div>;
  }

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
      <ChartToolbar chartRef={chartRef} />
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        {chartType === "Bar" && <Bar ref={chartRef} data={processedData} options={options} />}
        {chartType === "Line" && <Line ref={chartRef} data={processedData} options={options} />}
        {chartType === "Pie" && <Pie ref={chartRef} data={processedData} options={options} />}
        {chartType === "Doughnut" && <Doughnut ref={chartRef} data={processedData} options={options} />}
        {chartType === "Scatter" && <Scatter ref={chartRef} data={processedData} options={options} />}
      </div>
    </div>
  );
}

export default ChartComponent;
