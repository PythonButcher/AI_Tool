export const API = process.env.REACT_APP_API_URL || 'http://localhost:5000';
export const VIEWS = ['bar', 'horizontal', 'grouped', 'stacked', 'percent_stacked', 'line', 'area', 'stacked_area', 'scatter', 'pie', 'doughnut', 'histogram', 'table', 'pivot', 'kpi'];
export const AGGREGATIONS = ['sum', 'avg', 'min', 'max', 'count', 'count_distinct', 'count_rows', 'median', 'percentile'];
export const POSTS = ['none', 'percent_total', 'running_total', 'moving_average', 'rank', 'cumulative_percent'];
export const defaultAnalysis = source => ({ source, title: 'Untitled analysis', view: 'bar', appearance: { palette: 'blue', decimals: 2, unit: 'number', legend: true },
  query: { mode: 'aggregate', measures: [{ id: 'value', aggregation: 'count_rows', label: 'Rows' }], group_by: [], filters: [], limit: 1000 } });

export function inlineIdentity(rows) {
  // Identity labels attachments locally; the backend SHA-256 fingerprint detects changes.
  let hash = 2166136261;
  const text = JSON.stringify(rows);
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  return `inline-${(hash >>> 0).toString(16)}-${text.length}`;
}

export function executionQuery(config) {
  const query = { ...config.query };
  if (config.view === 'histogram') return { ...query, mode: 'histogram', field: query.field || query.measures[0]?.field, bins: query.bins || 10 };
  if (config.view === 'scatter') return { ...query, mode: 'rows', columns: query.measures.map(m => m.field).filter(Boolean), numeric_columns: query.measures.map(m => m.field).filter(Boolean), sort: undefined };
  return { ...query, normalize_stack: config.view === 'percent_stacked', mode: config.view === 'pivot' ? 'pivot' : query.mode === 'rows' ? 'rows' : 'aggregate' };
}

export const querySignature = config => config ? JSON.stringify({ source: config.source, query: executionQuery(config) }) : '';

export async function queryAnalytics(config, attachments, { signal, metadataOnly = false } = {}) {
  const source = config.source;
  if (!source) throw new Error('Choose a dataset.');
  if (!metadataOnly && config.view === 'scatter' && (config.query.measures.length !== 2 || config.query.measures.some(m => !m.field))) throw new Error('Scatter needs exactly two numeric fields as measures.');
  if (!metadataOnly && ['pie', 'doughnut'].includes(config.view) && (config.query.measures.length !== 1 || config.query.group_by.length !== 1)) throw new Error('Pie and doughnut charts need one measure and one category.');
  if (source.kind === 'inline' && source.id !== attachments.inlineId) throw new Error('This analysis belongs to a different upload. Choose the current dataset to rebind it explicitly.');
  const response = await fetch(`${API}/api/analytics/query`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
    body: JSON.stringify({ source, query: executionQuery(config), metadata_only: metadataOnly,
      dataset: source.kind === 'inline' ? attachments.rows : undefined,
      semantic_model: source.kind === 'inline' ? attachments.model : undefined }) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'The query could not run.');
  return payload;
}

export function download(name, content, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function tableCsv(result) {
  const cell = value => {
    let text = String(value ?? '');
    if (typeof value === 'string' && /^[\s]*[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  return [result.columns.map(cell).join(','), ...result.rows.map(row => result.columns.map(key => cell(row[key])).join(','))].join('\r\n');
}
export function formatValue(value, appearance = {}) {
  if (value === null || value === undefined) return '—';
  if (typeof value !== 'number') {
    if (appearance.dateFormat && appearance.dateFormat !== 'iso' && /^\d{4}-\d{2}-\d{2}(T|$)/.test(String(value))) {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return new Intl.DateTimeFormat(undefined, { dateStyle: appearance.dateFormat, timeZone: 'UTC' }).format(date);
    }
    return String(value);
  }
  const options = { maximumFractionDigits: Number(appearance.decimals ?? 2) };
  if (appearance.unit === 'currency') Object.assign(options, { style: 'currency', currency: appearance.currency || 'USD' });
  if (appearance.unit === 'percent') Object.assign(options, { style: 'percent' });
  try { return new Intl.NumberFormat(undefined, options).format(value); } catch { return String(value); }
}
