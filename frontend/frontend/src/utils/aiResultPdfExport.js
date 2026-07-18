import {
  captureVisibleChartImages,
  exportStructuredPdf,
  sanitizePdfText,
} from './appPdfExport';

/**
 * Convert visible result values into safe, readable PDF text. The exporter is
 * intentionally limited to BI answers and charts; internal service state is
 * never dumped into a business-facing document.
 */
const readableValue = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return sanitizePdfText(String(value));
  }
  return sanitizePdfText(value.label || value.name || value.title || value.message || '');
};

const answerSections = (content = {}) => {
  const metric = content.metric?.label || content.metric?.name || content.fieldsUsed?.value;
  const summaryValue = content.summary?.value_formatted
    ?? content.summary?.value
    ?? content.value
    ?? content.top_group?.value;

  return [
    {
      title: 'Business Result',
      keyValues: [
        { label: 'Metric', value: metric },
        { label: 'Value', value: summaryValue },
        { label: 'Top Result', value: content.top_group?.label },
      ],
      body: content.message,
    },
    {
      title: 'Result Details',
      items: Array.isArray(content.rows)
        ? content.rows.slice(0, 40).map((row, index) => {
          const label = row.group_label
            || (row.group ? Object.values(row.group).join(' | ') : '')
            || `Row ${index + 1}`;
          return `${readableValue(label)}: ${readableValue(row.value_formatted ?? row.value)}`;
        })
        : [],
      emptyText: 'No additional result rows were shown.',
    },
  ];
};

const chartSections = (content = {}) => [
  {
    title: 'Business Chart',
    keyValues: [
      { label: 'Chart Type', value: content.chartType },
    ],
    body: content.explanation,
    images: captureVisibleChartImages(),
  },
  {
    title: 'Chart Values',
    items: Array.isArray(content.chartData?.labels)
      ? content.chartData.labels.slice(0, 50).map((label, index) => {
        const firstDataset = content.chartData.datasets?.[0] || {};
        return `${readableValue(label)}: ${readableValue(firstDataset.data?.[index])}`;
      })
      : [],
    emptyText: 'No chart values were available for export.',
  },
];

/**
 * Export one visible AI Chat BI artifact. Decision workspaces and Decision
 * Output artifacts are deliberately unsupported by this BI-only exporter.
 */
export const generateAiResultPdf = async ({ artifact }) => {
  if (!artifact || !['answer', 'chart'].includes(artifact.type)) return;

  const content = artifact.content || {};
  const fallbackTitle = artifact.type === 'chart' ? 'Business Chart' : 'Business Result';
  const title = sanitizePdfText(
    artifact.title
    || content.title
    || content.metric?.label
    || content.metric?.name
    || fallbackTitle,
  );

  exportStructuredPdf({
    title: `AI Business Intelligence: ${title}`,
    subtitle: artifact.type === 'chart' ? 'Chart Result' : 'Grounded Data Result',
    fileName: 'ai_business_result',
    footerLabel: 'AI Business Intelligence Export',
    sections: artifact.type === 'chart' ? chartSections(content) : answerSections(content),
  });
};
