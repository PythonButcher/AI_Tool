import React, { useContext } from 'react';
import AICharts from '../ai/AICharts';
import { FaFilePdf } from 'react-icons/fa';
import { DataContext, useActiveDataset } from '../../context/DataContext';
import { useWindowContext } from '../../context/WindowContext';
import { generateAnalyticalPdfReport } from '../../utils/pdfReportExport';
import './AIReporter.css';

const Section = ({ title, content }) => (
  <div className="section-container">
    <h2 className="section-title">{title}</h2>
    <div className="section-content">{content || 'No data available.'}</div>
  </div>
);

const asText = (val) => (typeof val === 'string' ? val : (val && val.reply) || '');

const AIReporter = ({ summary, outliers, insights, execution, chartType, chartData }) => {
  const activeDataset = useActiveDataset();
  const { pipelineResults } = useContext(DataContext);
  const { getWindowContentState } = useWindowContext();

  const handleExportPDF = () => {
    const localSummary = [asText(summary), asText(insights), asText(outliers), asText(execution)]
      .filter(Boolean)
      .join('\n\n');

    generateAnalyticalPdfReport({
      datasetRows: activeDataset || [],
      storyState: getWindowContentState('storyPanel'),
      pipelineResults,
      title: 'AI Reporter',
      executiveSummaryOverride: localSummary || undefined,
    });
  };

  return (
    <div
      style={{
        background: '#f9f9f9',
        border: '1px solid #ccc',
        borderRadius: '16px',
        padding: '32px',
        maxWidth: '960px',
        margin: '0 auto',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}
    >
      <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '24px', textAlign: 'center' }}>
        AI Reporter
      </h1>

      {summary && <Section title="Summary" content={asText(summary)} />}
      {outliers && <Section title="Outliers" content={asText(outliers)} />}
      {insights && <Section title="Insights" content={asText(insights)} />}

      {chartType && chartData && (
        <Section
          title={`Chart Recommendation (${chartType})`}
          content={
            <div style={{ overflowX: 'auto', padding: '8px', height: '400px' }}>
              <AICharts aiChartType={chartType} aiChartData={chartData} />
            </div>
          }
        />
      )}
      <div style={{ textAlign: 'center', marginTop: '24px' }}>
        <button
          className="export-report-button"
          onClick={handleExportPDF}
          aria-label="Export report as PDF"
          title="Export report as PDF"
        >
          <FaFilePdf /> Export PDF
        </button>
      </div>
    </div>
  );
};

export default AIReporter;
