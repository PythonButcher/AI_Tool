import {
  captureVisibleChartImages,
  exportElementToPdf,
  exportStructuredPdf,
  readablePdfLabel,
  sanitizePdfText,
} from './appPdfExport';

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

const buildExecutiveSummary = ({ storyState, pipelineResults, overrideText }) => {
  if (overrideText) return sanitizePdfText(overrideText);

  if (storyState?.sections?.length) {
    return sanitizePdfText(
      storyState.sections
        .map((section) => `${section.title}\n${section.content}`)
        .join('\n\n')
    );
  }

  const aiReport = pipelineResults?.ai_report?.result;
  if (aiReport) {
    return sanitizePdfText([aiReport.summary, aiReport.insights].filter(Boolean).join('\n\n'));
  }

  return 'No AI insights are available for this session.';
};

const buildDatasetCards = (stats) => {
  const cards = [
    {
      title: 'Dataset Shape',
      body: `${stats.rowCount.toLocaleString()} rows and ${stats.columnCount.toLocaleString()} columns are available in the active export context.`,
    },
  ];

  const missingColumns = Object.entries(stats.missingByColumn)
    .filter(([, count]) => count > 0)
    .slice(0, 12);

  if (missingColumns.length) {
    cards.push({
      title: 'Missing Values',
      body: missingColumns.map(([column, count]) => `${readablePdfLabel(column)}: ${count}`).join(' | '),
    });
  }

  if (stats.numericalSummaries.length) {
    cards.push(
      ...stats.numericalSummaries.slice(0, 12).map((summary) => ({
        title: readablePdfLabel(summary.column),
        body: `Count ${summary.count.toLocaleString()} | Min ${summary.min.toFixed(2)} | Max ${summary.max.toFixed(2)} | Mean ${summary.mean.toFixed(2)}`,
      }))
    );
  }

  return cards;
};

const buildStoryCards = (storyState) => {
  if (!Array.isArray(storyState?.sections)) return [];
  return storyState.sections.map((section) => ({
    title: section.title,
    body: section.content,
  }));
};

export const generateAnalyticalPdfReport = async ({
  datasetRows = [],
  storyState,
  pipelineResults,
  fileLabel = 'active_session_data',
  executiveSummaryOverride,
  sourceElement,
  title = 'Analytical Report',
}) => {
  if (sourceElement) {
    const captured = await exportElementToPdf({
      element: sourceElement,
      title,
      subtitle: sanitizePdfText(fileLabel),
      fileName: 'analysis_report',
      footerLabel: 'Analytical Report',
    });
    if (captured) return;
  }

  const stats = summarizeDataset(datasetRows);
  const executiveSummary = buildExecutiveSummary({
    storyState,
    pipelineResults,
    overrideText: executiveSummaryOverride,
  });
  const charts = captureVisibleChartImages();

  exportStructuredPdf({
    title,
    subtitle: sanitizePdfText(fileLabel),
    fileName: 'analysis_report',
    footerLabel: 'Analytical Report',
    sections: [
      {
        title: 'Visible Summary',
        body: executiveSummary,
      },
      {
        title: 'Dataset Context',
        cards: buildDatasetCards(stats),
      },
      {
        title: 'Data Story',
        cards: buildStoryCards(storyState),
        emptyText: 'No Data Story sections are visible in the current session.',
      },
      {
        title: 'Visible Charts',
        body: charts.length ? undefined : 'No visible charts were available during export.',
        images: charts,
      },
    ],
  });
};
