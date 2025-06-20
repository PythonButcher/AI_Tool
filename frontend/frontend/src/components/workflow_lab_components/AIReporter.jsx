// src/components/workflow_lab_components/AIReporter.jsx
import React from "react";
import AICharts from "../ai_ml_components/AICharts";


const Section = ({ title, content }) => (
  <div style={{ marginBottom: "24px" }}>
    <h2 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "8px", color: "#333" }}>
      {title}
    </h2>
    <div
      style={{
        background: "#fff",
        border: "1px solid #ddd",
        borderRadius: "8px",
        padding: "16px",
        whiteSpace: "pre-wrap",
        fontSize: "14px",
        color: "#555",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      }}
    >
      {content || "No data available."}
    </div>
  </div>
);

/* 🔑 helper — returns the actual text, no matter the shape */
const asText = (val) =>
  typeof val === "string" ? val : (val && val.reply) || "";

// AIReporter.jsx
const AIReporter = ({ summary, insights, execution, chartType, chartData }) => {
  console.log(
    `AIReporter PROPS: chartType: '${chartType}', chartData (FULL):`, chartData, // Log the full array
    `| typeof: ${typeof chartData}`,
    `| isArray: ${Array.isArray(chartData)}`,
    `| length: ${Array.isArray(chartData) ? chartData.length : 'N/A'}`
    // The 'first element' part can be removed if you're logging the full array,
    // as you can inspect it in the browser console.
  );
 // }
  return (
    <div
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

    </div>
  );
};

export default AIReporter;