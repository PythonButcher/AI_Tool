// ChartComponent.jsx (new, standard component)
import React, { useRef } from 'react';
import { Bar, Line, Pie, Doughnut, Scatter } from 'react-chartjs-2';
import ChartToolbar from './ChartToolbar';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, BarController, LineElement,
  PointElement, ArcElement, Tooltip, Legend
} from 'chart.js';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, BarController,
  LineElement, PointElement, ArcElement, Tooltip, Legend
);

function ChartComponent({ chartType = 'Bar', chartData, mapping }) {
  const chartRef = useRef(null);

if (!chartData || !chartData.labels || !chartData.datasets) {
  return <div style={{ padding: "20px", textAlign: "center" }}>Chart data is incomplete.</div>;
}


  const options = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
    padding: {
      top: 20,
      bottom: 30,     // ✅ extra breathing room
      left: 10,
      right: 10
    }
  },
    plugins: { legend: { display: true }, tooltip: { enabled: true } },
    animation: {
      onComplete: () => {
        const chart = chartRef.current;
        if (chart) {
          const ctx = chart.ctx;
          ctx.save();
          ctx.globalCompositeOperation = 'destination-over';
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, chart.width, chart.height);
          ctx.restore();
        }
      },
    },
  };

  return (
    <div
      style={{
        width: "100%",
        height: "calc(95% - 8px)", // ✅ leave room for toolbar
        position: "relative",
        paddingBottom: "12px",       // ✅ prevent axis cutoffs
        boxSizing: "border-box",     // ✅ account for padding
      }}
    >

      <ChartToolbar chartRef={chartRef} />
      {chartType === "Bar" && <Bar ref={chartRef} data={chartData} options={options} />}
      {chartType === "Line" && <Line ref={chartRef} data={chartData} options={options} />}
      {chartType === "Pie" && <Pie ref={chartRef} data={chartData} options={options} />}
      {chartType === "Doughnut" && <Doughnut ref={chartRef} data={chartData} options={options} />}
      {chartType === "Scatter" && <Scatter ref={chartRef} data={chartData} options={options} />}
    </div>
  );
}

export default ChartComponent;
