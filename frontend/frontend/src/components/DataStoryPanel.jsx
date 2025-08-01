import React, { useEffect, useState } from "react";
import axios from "axios";
import ChartComponentAI from "./chart_components/ChartComponentAI";
import { getDynamicColors } from "../utils/ChartStyles";
import "./css/DataStoryPanel.css";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function DataStoryPanel({ uploadedData, cleanedData, model }) {
  const [story,  setStory]  = useState(null);
  const [error,  setError]  = useState(null);

  useEffect(() => {
    if (story || !(uploadedData || cleanedData)) return;

    (async () => {
      try {
        const payload =
          typeof (cleanedData || uploadedData)?.data_preview === "string"
            ? JSON.parse((cleanedData || uploadedData).data_preview)
            : (cleanedData || uploadedData);

        const route = model === 'gemini' ? '/api/storyboard-gemini' : '/api/storyboard';

        const { data } = await axios.post(`${API_URL}${route}`, {
          cleanedData,
          uploadedData: payload
        });

        setStory({
          sections : data.sections  || [],
          charts   : data.charts    || [],
        });
      } catch (e) {
        console.error("Storyboard fetch failed:", e);
        setError("AI failed to generate a storyboard.");
      }
    })();
  }, [story, uploadedData, cleanedData]);

  if (error) return <div className="story-panel">{error}</div>;
    if (!uploadedData && !cleanedData)
    return <div className="story-panel-no-data">Please upload some data to this app…</div>;
  if (!story)  return <div className="story-panel">Generating story…</div>;



  return (
    <div className="storyboard-wrapper">
      <div className="charts-column">
        {story.charts.length === 0 && <p>No AI charts returned.</p>}
        {story.charts.map((c, i) => {
          // 🔥 Add dynamic color here
          const colors = getDynamicColors(c.labels.length);
          const chartData = {
            labels: c.labels,
            datasets: [{
              label: c.title,
              data: c.values,
              backgroundColor: colors.map(col => col.backgroundColor),
              borderColor: colors.map(col => col.borderColor),
              borderWidth: 1,
            }]
          };

          return (
            <div key={i} className="chart-wrapper">
              <h5 className="chart-title">{c.title}</h5>
              <ChartComponentAI
                normalizedChartType={c.type}
                aiChartData={chartData}
              />
            </div>
          );
        })}
      </div>

      <div className="story-panel">
        <div className="panel-header">
          <svg width="10" height="10" style={{fill:"var(--nt-red)"}}>
            <circle cx="5" cy="5" r="5" />
          </svg>
          <h3>Data Story</h3>
          <span className="divider" />
        </div>

        {story.sections.map(({ title, content }, idx) => (
          <div key={idx} className="story-section">
            <h4>{title}</h4>
            <p>{content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
