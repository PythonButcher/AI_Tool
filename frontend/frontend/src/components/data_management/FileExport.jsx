import React, { useContext } from 'react';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import { DataContext, useActiveDataset } from '../../context/DataContext';
import { useWindowContext } from '../../context/WindowContext';
import './FileExport.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const parseNumeric = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const summarizeDataset = (rows = []) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      rowCount: 0,
      columnCount: 0,
      missingByColumn: {},
      numericalSummaries: [],
    };
  }

  const columns = Object.keys(rows[0] || {});
  const missingByColumn = {};
  const numericalSummaries = [];

  columns.forEach((column) => {
    const values = rows.map((row) => row?.[column]);

    const missing = values.filter(
      (value) =>
        value === null ||
        value === undefined ||
        (typeof value === 'string' && value.trim() === '')
    ).length;

    missingByColumn[column] = missing;

    const numericValues = values
      .map(parseNumeric)
      .filter((value) => value !== null);

    if (numericValues.length > 0) {
      const total = numericValues.reduce((acc, value) => acc + value, 0);
      const min = Math.min(...numericValues);
      const max = Math.max(...numericValues);
      const mean = total / numericValues.length;

      numericalSummaries.push({
        column,
        count: numericValues.length,
        min,
        max,
        mean,
      });
    }
  });

  return {
    rowCount: rows.length,
    columnCount: columns.length,
    missingByColumn,
    numericalSummaries,
  };
};

const splitText = (pdf, text, maxWidth) => {
  const safeText = String(text || '').replace(/\s+/g, ' ').trim();
  if (!safeText) return [];
  return pdf.splitTextToSize(safeText, maxWidth);
};

function FileExport() {
  const activeDataset = useActiveDataset();
  const { pipelineResults } = useContext(DataContext);
  const { getWindowContentState } = useWindowContext();

  const getExecutiveSummary = () => {
    const storyState = getWindowContentState('storyPanel');

    if (storyState?.sections?.length) {
      return storyState.sections
        .map((section) => `${section.title}: ${section.content}`)
        .join('\n\n');
    }

    const aiReport = pipelineResults?.ai_report?.result;
    if (aiReport) {
      return [aiReport.summary, aiReport.insights]
        .filter(Boolean)
        .map((value) => (typeof value === 'string' ? value : JSON.stringify(value, null, 2)))
        .join('\n\n');
    }

    return 'No AI analysis is currently available for this session.';
  };

  const addSectionTitle = (pdf, title, y) => {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.text(title, 40, y);
    return y + 16;
  };

  const addParagraph = (pdf, text, y, lineHeight = 14) => {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    const lines = splitText(pdf, text, 515);

    lines.forEach((line) => {
      if (y > 760) {
        pdf.addPage();
        y = 50;
      }
      pdf.text(line, 40, y);
      y += lineHeight;
    });

    return y;
  };

  const collectVisibleCharts = () => {
    const canvases = Array.from(document.querySelectorAll('.window-frame canvas'));

    return canvases
      .map((canvas) => {
        const frame = canvas.closest('.window-frame');
        const title = frame?.querySelector('.header-title')?.textContent?.trim() || 'Chart';

        try {
          const image = canvas.toDataURL('image/png', 1.0);
          return {
            title,
            image,
            width: canvas.width || 800,
            height: canvas.height || 500,
          };
        } catch (error) {
          console.warn('Unable to capture chart canvas:', error);
          return null;
        }
      })
      .filter(Boolean);
  };

  const handleExportPDF = () => {
    try {
      const datasetStats = summarizeDataset(activeDataset || []);
      const executiveSummary = getExecutiveSummary();
      const charts = collectVisibleCharts();

      const pdf = new jsPDF({ unit: 'pt', format: 'letter' });
      const pageWidth = pdf.internal.pageSize.getWidth();

      let y = 40;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(18);
      pdf.text('Analytical Report', 40, y);
      y += 20;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.text(`File: active_session_data | Generated: ${new Date().toLocaleString()}`, 40, y);
      y += 24;

      y = addSectionTitle(pdf, '1) Dataset Statistics', y);
      y = addParagraph(pdf, `Rows: ${datasetStats.rowCount} | Columns: ${datasetStats.columnCount}`, y);
      y += 4;

      y = addParagraph(pdf, 'Missing values by column:', y);
      Object.entries(datasetStats.missingByColumn).forEach(([column, missing]) => {
        y = addParagraph(pdf, `• ${column}: ${missing}`, y, 12);
      });

      y += 8;
      y = addParagraph(pdf, 'Numerical summaries (count/min/max/mean):', y);
      if (datasetStats.numericalSummaries.length === 0) {
        y = addParagraph(pdf, 'No numeric columns found.', y);
      } else {
        datasetStats.numericalSummaries.forEach((stat) => {
          y = addParagraph(
            pdf,
            `• ${stat.column}: count=${stat.count}, min=${stat.min.toFixed(2)}, max=${stat.max.toFixed(2)}, mean=${stat.mean.toFixed(2)}`,
            y,
            12
          );
        });
      }

      y += 16;
      if (y > 700) {
        pdf.addPage();
        y = 50;
      }

      y = addSectionTitle(pdf, '2) AI Executive Summary', y);
      y = addParagraph(pdf, executiveSummary, y);

      pdf.addPage();
      y = 50;
      y = addSectionTitle(pdf, '3) Visualizations', y);

      if (charts.length === 0) {
        y = addParagraph(pdf, 'No visible charts found to include in the report.', y);
      } else {
        charts.forEach((chart, index) => {
          if (y > 620) {
            pdf.addPage();
            y = 50;
          }

          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(12);
          pdf.text(`${index + 1}. ${chart.title}`, 40, y);
          y += 14;

          const targetWidth = 520;
          const targetHeight = Math.min((chart.height / chart.width) * targetWidth, 280);
          pdf.addImage(chart.image, 'PNG', 40, y, targetWidth, targetHeight, undefined, 'FAST');
          y += targetHeight + 20;
        });
      }

      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i += 1) {
        pdf.setPage(i);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.text(`Page ${i} of ${totalPages}`, pageWidth - 100, 770);
      }

      pdf.save(`analysis_report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('PDF export error:', error);
      alert('Failed to export analytical PDF report.');
    }
  };

  const handleExport = async (format) => {
    if (format === 'pdf') {
      handleExportPDF();
      return;
    }

    try {
      const response = await axios.get(`${API_URL}/api/export`, {
        params: { format },
        responseType: 'blob',
      });

      if (!response || !response.data) {
        throw new Error('No data received from export endpoint.');
      }

      const blob = new Blob([response.data], { type: response.headers['content-type'] });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `cleaned_data_${new Date().toISOString().split('T')[0]}.${format}`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export cleaned data. Please try again.');
    }
  };

  return (
    <div className="ExportClass">
      <button onClick={() => handleExport('csv')}>Export as CSV</button>
      <button onClick={() => handleExport('excel')}>Export as Excel</button>
      <button onClick={() => handleExport('pdf')}>Export as PDF</button>
    </div>
  );
}

export default FileExport;
