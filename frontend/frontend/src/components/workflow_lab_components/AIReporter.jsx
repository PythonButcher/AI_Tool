// src/components/workflow_lab_components/AIReporter.jsx
import React, { useRef } from "react";
import AICharts from "../ai_ml_components/AICharts";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import "../css/AIReporter.css";


const Section = ({ title, content }) => (
  <div className="section-container">
    <h2 className="section-title">{title}</h2>
    <div className="section-content">
      {content || "No data available."}
    </div>
  </div>
);


/* 🔑 helper — returns the actual text, no matter the shape */
const asText = (val) =>
  typeof val === "string" ? val : (val && val.reply) || "";

// AIReporter.jsx
const AIReporter = ({ summary, insights, execution, chartType, chartData }) => {
  const reportRef = useRef(null);

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    const canvas = await html2canvas(reportRef.current);
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "px",
      format: [canvas.width, canvas.height],
    });
    pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
    pdf.save("ai_report.pdf");
  };

  console.log(
    `AIReporter PROPS: chartType: '${chartType}', chartData (FULL):`, chartData,
    `| typeof: ${typeof chartData}`,
    `| isArray: ${Array.isArray(chartData)}`,
    `| length: ${Array.isArray(chartData) ? chartData.length : 'N/A'}`
  );

  return (
    <div
      ref={reportRef}
      style={{
        background: "#f9f9f9",
        border: "1px solid #ccc",
        borderRadius: "16px",
        padding: "32px",
        maxWidth: "960px",
        margin: "0 auto",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
      }}
    >
      
      <h1 style={{ fontSize: "24px", fontWeight: "700", marginBottom: "24px", textAlign: "center" }}>
        🧠 AI Reporter
      </h1>

      {summary   && <Section title="📄 Summary"          content={asText(summary)}   />}
      {insights  && <Section title="💡 Insights"         content={asText(insights)}  />}
     
          {chartType && chartData && (
          <Section
            title={`📊 Chart Recommendation (${chartType})`}
            content={
              <div style={{ overflowX: "auto", padding: "8px", height: "400px" }}>
                <AICharts aiChartType={chartType} aiChartData={chartData} />␊
              </div>
            }
          />
        )}
      <div style={{ textAlign: "center", marginTop: "24px" }}>
        <button className="export-report-button" onClick={handleExportPDF}>
          Export Report as PDF
        </button>
      </div>
    </div>
  );
};

export default AIReporter;