import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import ChartComponentAI from "../../features/charts/ChartComponentAI";
import { getDynamicColors } from "../../utils/ChartStyles";
import { useActiveDataset, DataContext } from '../../context/DataContext';
import { useWindowContext } from '../../context/WindowContext';
import { generateAnalyticalPdfReport } from '../../utils/pdfReportExport';
import "./DataStoryPanel.css";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";


export default function DataStoryPanel({ uploadedData, cleanedData, model, savedState }) {
  const activeDataset = useActiveDataset();
  const { pipelineResults } = React.useContext(DataContext);
  const { saveWindowContentState } = useWindowContext();
  const [story, setStory] = useState(savedState || null);  // ✅ initialize from savedState
  const [error, setError] = useState(null);

  console.log("📘 story model in DataStoryPanel:", model);
  
  useEffect(() => {
    // ✅ Hydrate from savedState if available and story hasn't been set yet
    if (savedState && !story) {
      setStory(savedState);
      return;
    }

    // ✅ Skip if story already exists or no data to fetch from
    if (story || !(uploadedData || cleanedData)) return;

    (async () => {
      try {
        const payload =
          typeof (cleanedData || uploadedData)?.data_preview === "string"
            ? JSON.parse((cleanedData || uploadedData).data_preview)
            : (cleanedData || uploadedData);

        const route = model === 'gemini' ? '/api/storyboard-gemini' : '/api/storyboard-openai';

        const { data } = await axios.post(`${API_URL}${route}`, {
          cleanedData,
          uploadedData: payload,
        });

        setStory({
          sections: data.sections || [],
          charts: data.charts || [],
        });
      } catch (e) {
        console.error("Storyboard fetch failed:", e);
        setError("AI failed to generate a storyboard.");
      }
    })();
  }, [story, uploadedData, cleanedData, savedState, model]);

  // DataStoryPanel.jsx
  useEffect(() => {
    if (story) {
      saveWindowContentState('storyPanel', story);
    }
  }, [story, saveWindowContentState]);

  const chartConfigs = useMemo(() => {
    if (!story) return [];
    return story.charts.map((c) => {
      const colors = getDynamicColors(c.labels.length);
      return {
        title: c.title,
        type: c.type,
        data: {
          labels: c.labels,
          datasets: [
            {
              label: c.title,
              data: c.values,
              backgroundColor: colors.map((col) => col.backgroundColor),
              borderColor: colors.map((col) => col.borderColor),
              borderWidth: 1,
            },
          ],
        },
      };
    });
  }, [story]);

  if (error) return <div className="story-panel">{error}</div>;
  if (!uploadedData && !cleanedData)
    return <div className="story-panel-no-data">Please upload some data to this app…</div>;
  if (!story) return <div className="story-panel">Generating story…</div>;

  const handleExportStoryPdf = () => {
    generateAnalyticalPdfReport({
      datasetRows: activeDataset || [],
      storyState: story,
      pipelineResults,
      executiveSummaryOverride: story.sections
        ?.map((section) => `${section.title}\n${section.content}`)
        .join('\n\n'),
    });
  };

  return (
    <div className="storyboard-wrapper">
      <div className="charts-column">
        {chartConfigs.length === 0 && <p>No AI charts returned.</p>}
        {chartConfigs.map((cfg, i) => (
          <div key={i} className="chart-wrapper">
            <h5 className="chart-title">{cfg.title}</h5>
            <ChartComponentAI
              normalizedChartType={cfg.type}
              aiChartData={cfg.data}
              onExportPdf={handleExportStoryPdf}
            />
          </div>
        ))}
      </div>

      <div className="story-panel">
        <div className="panel-header">
          <svg width="10" height="0" style={{ fill: "var(--nt-red)" }}>
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
