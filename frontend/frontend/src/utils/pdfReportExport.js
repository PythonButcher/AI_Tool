import { jsPDF } from 'jspdf';

const PAGE = {
  width: 612,
  height: 792,
  marginX: 48,
  marginY: 48,
  lineHeight: 14,
};

const sanitizeText = (value) => {
  const raw = typeof value === 'string' ? value : JSON.stringify(value ?? '', null, 2);
  const normalized = raw
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"');

  const ascii = Array.from(normalized)
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code === 10 || code === 13 || (code >= 32 && code <= 126);
    })
    .join('');

  return ascii.replace(/ +/g, ' ').trim();
};

const parseNumeric = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const summarizeDataset = (rows = []) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { rowCount: 0, columnCount: 0, missingByColumn: {}, numericalSummaries: [] };
  }

  const columns = Object.keys(rows[0] || {});
  const missingByColumn = {};
  const numericalSummaries = [];

  columns.forEach((column) => {
    const values = rows.map((row) => row?.[column]);
    missingByColumn[column] = values.filter(
      (value) => value === null || value === undefined || (typeof value === 'string' && value.trim() === '')
    ).length;

    const numericValues = values.map(parseNumeric).filter((value) => value !== null);
    if (!numericValues.length) return;

    const total = numericValues.reduce((sum, current) => sum + current, 0);
    numericalSummaries.push({
      column,
      count: numericValues.length,
      min: Math.min(...numericValues),
      max: Math.max(...numericValues),
      mean: total / numericValues.length,
    });
  });

  return {
    rowCount: rows.length,
    columnCount: columns.length,
    missingByColumn,
    numericalSummaries,
  };
};

const collectCharts = () => {
  const canvases = Array.from(document.querySelectorAll('.window-frame .window-content-area canvas'));

  return canvases
    .filter((canvas) => canvas.width > 10 && canvas.height > 10)
    .filter((canvas) => {
      const styles = window.getComputedStyle(canvas);
      return styles.display !== 'none' && styles.visibility !== 'hidden';
    })
    .map((canvas) => {
      const frame = canvas.closest('.window-frame');
      const title = sanitizeText(frame?.querySelector('.header-title')?.textContent || 'Chart');

      try {
        return {
          title,
          image: canvas.toDataURL('image/png', 1),
          width: canvas.width,
          height: canvas.height,
        };
      } catch (error) {
        console.warn('Failed to capture chart canvas.', error);
        return null;
      }
    })
    .filter(Boolean);
};

const buildExecutiveSummary = ({ storyState, pipelineResults, overrideText }) => {
  if (overrideText) return sanitizeText(overrideText);

  if (storyState?.sections?.length) {
    return sanitizeText(
      storyState.sections
        .map((section) => `${section.title}\n${section.content}`)
        .join('\n\n')
    );
  }

  const aiReport = pipelineResults?.ai_report?.result;
  if (aiReport) {
    return sanitizeText([aiReport.summary, aiReport.insights].filter(Boolean).join('\n\n'));
  }

  return 'No AI insights are available for this session.';
};

const ensureRoom = (pdf, y, spaceNeeded = PAGE.lineHeight) => {
  if (y + spaceNeeded <= PAGE.height - PAGE.marginY) return y;
  pdf.addPage();
  return PAGE.marginY;
};

const writeParagraph = (pdf, text, y, fontSize = 10) => {
  const safeText = sanitizeText(text);
  if (!safeText) return y;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(fontSize);
  const lines = pdf.splitTextToSize(safeText, PAGE.width - PAGE.marginX * 2);

  let nextY = y;
  lines.forEach((line) => {
    nextY = ensureRoom(pdf, nextY);
    pdf.text(line, PAGE.marginX, nextY);
    nextY += PAGE.lineHeight;
  });

  return nextY;
};

const writeSectionTitle = (pdf, text, y) => {
  const nextY = ensureRoom(pdf, y, 18);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.text(text, PAGE.marginX, nextY);
  return nextY + 18;
};

export const generateAnalyticalPdfReport = ({
  datasetRows = [],
  storyState,
  pipelineResults,
  fileLabel = 'active_session_data',
  executiveSummaryOverride,
}) => {
  const pdf = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait' });
  const stats = summarizeDataset(datasetRows);
  const executiveSummary = buildExecutiveSummary({
    storyState,
    pipelineResults,
    overrideText: executiveSummaryOverride,
  });
  const charts = collectCharts();

  let y = PAGE.marginY;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.text('Analytical Report', PAGE.marginX, y);
  y += 24;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.text(`File: ${sanitizeText(fileLabel)} | Date: ${new Date().toLocaleString()}`, PAGE.marginX, y);
  y += 22;

  y = writeSectionTitle(pdf, 'Dataset Statistics', y);
  y = writeParagraph(pdf, `Row count: ${stats.rowCount}` , y);
  y = writeParagraph(pdf, `Column count: ${stats.columnCount}`, y);
  y = writeParagraph(pdf, 'Missing values by column:', y);

  Object.entries(stats.missingByColumn).forEach(([column, missing]) => {
    y = writeParagraph(pdf, `- ${column}: ${missing}`, y);
  });

  y += 8;
  y = writeParagraph(pdf, 'Numerical summaries (count, min, max, mean):', y);

  if (!stats.numericalSummaries.length) {
    y = writeParagraph(pdf, '- No numeric columns found.', y);
  } else {
    stats.numericalSummaries.forEach((summary) => {
      y = writeParagraph(
        pdf,
        `- ${summary.column}: count=${summary.count}, min=${summary.min.toFixed(2)}, max=${summary.max.toFixed(2)}, mean=${summary.mean.toFixed(2)}`,
        y
      );
    });
  }

  y += 10;
  y = writeSectionTitle(pdf, 'Executive Summary', y);
  y = writeParagraph(pdf, executiveSummary, y);

  y += 10;
  y = writeSectionTitle(pdf, 'Visualizations', y);

  if (!charts.length) {
    y = writeParagraph(pdf, 'No visible charts were available during export.', y);
  } else {
    charts.forEach((chart, index) => {
      y = ensureRoom(pdf, y, 26);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.text(`${index + 1}. ${chart.title || 'Chart'}`, PAGE.marginX, y);
      y += 12;

      const maxWidth = PAGE.width - PAGE.marginX * 2;
      const targetHeight = Math.min((chart.height / chart.width) * maxWidth, 280);
      y = ensureRoom(pdf, y, targetHeight + 10);
      pdf.addImage(chart.image, 'PNG', PAGE.marginX, y, maxWidth, targetHeight, undefined, 'FAST');
      y += targetHeight + 14;
    });
  }

  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    pdf.setPage(i);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.text(`Page ${i} of ${pageCount}`, PAGE.width - 105, PAGE.height - 20);
  }

  const outputName = `analysis_report_${new Date().toISOString().split('T')[0]}.pdf`;
  pdf.save(outputName);
};
