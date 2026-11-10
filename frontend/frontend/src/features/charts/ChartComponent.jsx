// ChartComponent.jsx (new, standard component)
import React, { useRef, useMemo } from 'react';
import { Bar, Line, Pie, Doughnut, Scatter, Radar } from 'react-chartjs-2';
import ChartToolbar from './ChartToolbar';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  RadialLinearScale,
  BarElement,
  BarController,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { useTheme } from '@mui/material/styles';
import { PALETTES } from './ChartColorPicker';

ChartJS.register(
  CategoryScale,
  LinearScale,
  RadialLinearScale,
  BarElement,
  BarController,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
);

function ChartComponent({ chartType = 'Bar', chartData, mapping, display = {} }) {
  const chartRef = useRef(null);
  const { palette } = useTheme();

  const processedData = useMemo(() => {
    if (!chartData || !chartData.datasets) return chartData;

    const activePalette = PALETTES[display?.paletteId] || PALETTES.default;
    const isPie = chartType === 'Pie' || chartType === 'Doughnut';

    return {
      ...chartData,
      datasets: chartData.datasets.map((ds, index) => {
        let backgroundColor, borderColor;

        if (isPie) {
          const dataLength = ds.data?.length || chartData.labels?.length || 1;
          backgroundColor = display?.customColors?.length
            ? display.customColors
            : Array.from({ length: dataLength }).map((_, i) => activePalette.colors[i % activePalette.colors.length]);
          borderColor = palette.background.paper;
        } else {
          const defaultColor = activePalette.colors[index % activePalette.colors.length];
          const seriesOverride = display?.seriesColors?.[ds.label];
          backgroundColor = seriesOverride || defaultColor;
          borderColor = backgroundColor;
        }

        return {
          ...ds,
          borderRadius: chartType === 'Bar' ? 6 : 0,
          tension: chartType === 'Line' || chartType === 'Radar' ? 0.35 : 0,
          pointRadius: chartType === 'Line' || chartType === 'Scatter' || chartType === 'Radar' ? 4 : 0,
          pointHoverRadius: 6,
          borderWidth: chartType === 'Line' || chartType === 'Radar' ? 2.5 : 1,
          fill: chartType === 'Line' || chartType === 'Radar' ? 'origin' : false,
          backgroundColor: chartType === 'Radar' ? `${backgroundColor}33` : backgroundColor,
          borderColor: borderColor || ds.borderColor,
        };
      }),
    };
  }, [chartData, chartType, palette, display]);

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
        display: chartType !== 'Pie' && chartType !== 'Doughnut' && chartType !== 'Radar',
        grid: {
          display: false,
        },
        border: {
          display: false,
        },
        ticks: {
          color: palette.text.secondary,
          font: {
            family: "'Inter', sans-serif",
            size: 11,
          },
        },
      },
      y: {
        display: chartType !== 'Pie' && chartType !== 'Doughnut' && chartType !== 'Radar',
        grid: {
          color: palette.divider,
          drawBorder: false,
          lineWidth: 1,
        },
        border: {
          display: false,
          dash: [4, 4],
        },
        ticks: {
          color: palette.text.secondary,
          font: {
            family: "'Inter', sans-serif",
            size: 11,
          },
          padding: 8,
        },
      },
      ...(chartType === 'Radar' && {
        r: {
          ticks: {
            color: palette.text.secondary,
            backdropColor: 'transparent',
            font: { family: "'Inter', sans-serif", size: 10 }
          },
          grid: { color: palette.divider },
          angleLines: { color: palette.divider },
          pointLabels: { 
            color: palette.text.secondary,
            font: { family: "'Inter', sans-serif", size: 11 }
          }
        }
      }),
    },
    plugins: {
      legend: {
        display: chartType === 'Pie' || chartType === 'Doughnut',
        position: 'bottom',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 20,
          color: palette.text.primary,
          font: {
            family: "'Inter', sans-serif",
            size: 12,
            weight: 500,
          },
        },
      },
      tooltip: {
        backgroundColor: palette.background.paper,
        titleColor: palette.text.primary,
        bodyColor: palette.text.secondary,
        borderColor: palette.divider,
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
  }), [chartType, palette]);

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
        {chartType === "Radar" && <Radar ref={chartRef} data={processedData} options={options} />}
      </div>
    </div>
  );
}

export default ChartComponent;
