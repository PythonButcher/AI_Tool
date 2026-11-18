import React, { useMemo, useRef, useState } from 'react';
import 'chart.js/auto';
import { Bar, Line, Scatter, Pie, Doughnut } from 'react-chartjs-2';
import { download, formatValue, tableCsv } from './analyticsModel';
import { useTheme } from '@mui/material/styles';
import { selectionFilter } from './analyticsTransforms';

const PALETTES = { blue: ['#4d8bfa', '#46b9ac', '#af83e8', '#f5b04a', '#ec7891'], teal: ['#169f91', '#60b8d5', '#6984d9', '#e8ae47', '#ce76b0'], warm: ['#e88945', '#de6578', '#b076cd', '#55a9bb', '#83ae62'] };

function ResultTable({ result, appearance, groups = [], onSelect }) {
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState(null);
  const [hidden, setHidden] = useState([]);
  const [order, setOrder] = useState(result.columns);
  const columns = [...order.filter(c => result.columns.includes(c)), ...result.columns.filter(c => !order.includes(c))].filter(c => !hidden.includes(c));
  const rows = useMemo(() => sort ? [...result.rows].sort((a, b) => {
    const left = a[sort.field], right = b[sort.field];
    if (left == null) return 1; if (right == null) return -1;
    return (typeof left === 'number' ? left - right : String(left).localeCompare(String(right))) * sort.direction;
  }) : result.rows, [result, sort]);
  const safePage = Math.min(page, Math.max(0, Math.ceil(rows.length / 50) - 1));
  return <div className="analytics-table">
    <details><summary>Table columns</summary><div className="analytics-actions">{result.columns.map(col => <label className="analytics-checkbox-row" key={col}><input type="checkbox" checked={!hidden.includes(col)} onChange={() => setHidden(list => list.includes(col) ? list.filter(c => c !== col) : [...list, col])} />{col}
      <button type="button" aria-label={`Move ${col} first`} onClick={() => setOrder([col, ...order.filter(c => c !== col)])}>Move first</button></label>)}</div></details>
    <div className="analytics-table-scroll"><table><thead><tr>{columns.map(col => <th key={col}><button type="button" onClick={() => setSort({ field: col, direction: sort?.field === col ? -sort.direction : 1 })}>{col} {sort?.field === col ? (sort.direction === 1 ? '↑' : '↓') : ''}</button></th>)}{onSelect && groups.length > 0 && <th>Investigate</th>}</tr></thead>
      <tbody>{rows.slice(safePage * 50, safePage * 50 + 50).map((row, index) => <tr key={index}>{columns.map(col => <td key={col}>{formatValue(row[col], appearance)}</td>)}{onSelect && groups.length > 0 && <td><button type="button" onClick={() => onSelect(selectionFilter(groups, row))}>Select row</button></td>}</tr>)}</tbody></table></div>
    <div className="analytics-tile-meta">
      <div className="analytics-actions"><button type="button" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>Previous rows</button><span>{rows.length ? safePage * 50 + 1 : 0}–{Math.min((safePage + 1) * 50, rows.length)} of {rows.length}</span><button type="button" disabled={(safePage + 1) * 50 >= rows.length} onClick={() => setPage(safePage + 1)}>Next rows</button></div>
      <button type="button" onClick={() => download('analytics-result.csv', tableCsv({ ...result, columns, rows }), 'text/csv;charset=utf-8')}>Export table CSV</button>
    </div>
  </div>;
}

function PivotTable({ result, appearance }) {
  const pivot = result.pivot;
  if (!pivot) return null;
  const measures = Object.keys(pivot.grand_totals);
  const key = row => JSON.stringify(pivot.row_fields.map(field => row[field]));
  const columnValues = [...new Map(result.rows.map(row => [JSON.stringify(row[pivot.column_field]), row[pivot.column_field]])).values()];
  const rowValues = [...new Map(result.rows.map(row => [key(row), row])).values()];
  const cells = new Map(result.rows.map(row => [`${key(row)}:${JSON.stringify(row[pivot.column_field])}`, row]));
  return <div className="analytics-table-scroll"><table><caption>Pivot — totals recomputed from source rows</caption><thead><tr><th>{pivot.row_fields.join(' / ')}</th>{columnValues.flatMap(value => measures.map(m => <th key={`${value}-${m}`}>{String(value ?? '(missing)')} · {m}</th>))}<th>Row totals</th></tr></thead>
    <tbody>{rowValues.map(row => <tr key={key(row)}><th>{pivot.row_fields.map(f => row[f] ?? '(missing)').join(' / ')}</th>{columnValues.flatMap(value => measures.map(m => <td key={`${value}-${m}`}>{formatValue(cells.get(`${key(row)}:${JSON.stringify(value)}`)?.[m], appearance)}</td>))}<td>{measures.map(m => `${m}: ${formatValue(pivot.row_totals.find(total => key(total) === key(row))?.[m], appearance)}`).join(' · ')}</td></tr>)}</tbody>
    <tfoot><tr><th>Column totals</th>{columnValues.flatMap(value => measures.map(m => <td key={`${value}-${m}`}>{formatValue(pivot.column_totals.find(row => row[pivot.column_field] === value)?.[m], appearance)}</td>))}<td>{measures.map(m => `${m}: ${formatValue(pivot.grand_totals[m], appearance)}`).join(' · ')}</td></tr></tfoot></table></div>;
}

export default function AnalyticsResult({ result, config, onSelect, compact = false }) {
  const chartRef = useRef(null);
  const [tableOpen, setTableOpen] = useState(false);
  const theme = useTheme();
  const appearance = config.appearance || {};
  if (!result) return <div className="analytics-empty">Choose fields and run your analysis to see a result.</div>;
  if (!result.row_count) return <div className="analytics-empty" role="status">No matching rows. Adjust your filters or date range.</div>;
  const rows = result.rows || [];
  const groups = config.query?.group_by || [];
  const measures = config.query?.measures || [];
  const palette = PALETTES[appearance.palette] || PALETTES.blue;
  const conditionalColor = value => value == null || appearance.target === '' || appearance.target == null ? undefined : Number(value) >= Number(appearance.target) ? appearance.aboveColor || '#169f91' : appearance.belowColor || '#de6578';
  const labels = rows.map(row => groups.length ? groups.map(g => row[g.field] ?? '(missing)').join(' / ') : config.title || 'Total');
  const data = { labels, datasets: measures.map((measure, index) => ({ label: measure.label || measure.id, data: rows.map(row => row[measure.id]),
    borderColor: appearance.colors?.[measure.id] || palette[index % palette.length],
    backgroundColor: appearance.conditional ? rows.map(row => conditionalColor(row[measure.id]) || palette[index % palette.length]) : ['pie', 'doughnut'].includes(config.view) ? palette : appearance.colors?.[measure.id] || palette[index % palette.length],
    fill: ['area', 'stacked_area'].includes(config.view), tension: 0.2 })) };
  if (config.view === 'scatter') data.datasets = [{ label: config.title, data: rows.map(row => ({ x: row[measures[0]?.field], y: row[measures[1]?.field] })), backgroundColor: palette[0] }];
  if (config.view === 'histogram') { data.labels = rows.map(row => `${row.bin_start.toFixed(2)}–${row.bin_end.toFixed(2)}`); data.datasets = [{ label: 'Rows', data: rows.map(row => row.count), backgroundColor: palette[0] }]; }
  const stacked = ['stacked', 'percent_stacked', 'stacked_area'].includes(config.view);
  if (result.comparison?.aligned_rows && ['line', 'area', 'bar', 'horizontal', 'grouped'].includes(config.view)) {
    data.datasets.push(...measures.map((measure, index) => ({ label: `${measure.label || measure.id} · comparison`,
      data: result.comparison.aligned_rows.map(row => row[measure.id]), borderColor: palette[index % palette.length],
      backgroundColor: `${palette[index % palette.length]}55`, borderDash: [5, 4], fill: false })));
  }
  const options = { responsive: true, maintainAspectRatio: false, animation: false, indexAxis: config.view === 'horizontal' ? 'y' : 'x',
    plugins: { legend: { display: appearance.legend !== false, labels: { color: theme.palette.text.primary } }, tooltip: { enabled: true } },
    scales: ['pie', 'doughnut'].includes(config.view) ? undefined : { x: { stacked, ticks: { color: theme.palette.text.secondary }, grid: { color: theme.palette.divider }, title: { display: !!appearance.xLabel, text: appearance.xLabel, color: theme.palette.text.primary } }, y: { stacked, ticks: { color: theme.palette.text.secondary }, grid: { color: theme.palette.divider }, title: { display: !!appearance.yLabel, text: appearance.yLabel, color: theme.palette.text.primary } } },
    onClick: (_event, elements) => { const row = rows[elements[0]?.index]; if (row && groups.length) onSelect?.(selectionFilter(groups, row)); } };
  const reference = { id: 'analyticsReference', afterDraw(chart) {
    if (appearance.target === '' || appearance.target == null || !Number.isFinite(Number(appearance.target)) || !chart.scales.y) return;
    const y = chart.scales.y.getPixelForValue(Number(appearance.target));
    const { ctx, chartArea } = chart;
    if (y < chartArea.top || y > chartArea.bottom) return;
    ctx.save(); ctx.strokeStyle = '#ec7891'; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(chartArea.left, y); ctx.lineTo(chartArea.right, y); ctx.stroke(); ctx.restore();
  } };
  const Chart = ['line', 'area', 'stacked_area'].includes(config.view) ? Line : config.view === 'scatter' ? Scatter : config.view === 'pie' ? Pie : config.view === 'doughnut' ? Doughnut : Bar;
  return <div className="analytics-result">
    {config.view === 'kpi' ? <div className="analytics-kpis">{measures.map(measure => <div key={measure.id}><span>{measure.label || measure.id}</span><strong style={{ color: appearance.conditional ? conditionalColor(result.summary?.[measure.id]) : undefined }}>{formatValue(result.summary?.[measure.id], appearance)}</strong>
      {result.comparison && <small className={(result.comparison.deltas[measure.id]?.absolute ?? 0) >= 0 ? 'is-positive' : ''}>{formatValue(result.comparison.deltas[measure.id]?.absolute, appearance)} change · {result.comparison.deltas[measure.id]?.percent == null ? 'Percentage unavailable' : `${result.comparison.deltas[measure.id].percent.toFixed(1)}%`}</small>}</div>)}</div>
      : config.view === 'pivot' ? <PivotTable result={result} appearance={appearance} />
        : config.view !== 'table' && <div className={`analytics-chart ${compact ? 'is-compact' : ''}`} role="img" aria-label={`${config.title || 'Analysis'}: ${rows.length} results. Values available in the result table.`}><Chart ref={chartRef} data={data} options={options} plugins={[reference]} /></div>}
    <div className="analytics-tile-meta">
      <p className="analytics-scope">{result.row_count.toLocaleString()} matching source rows · {result.rows.length} displayed results{result.limit ? ` · limit ${result.limit}` : ''}{result.truncated ? ' (limited)' : ''} · {result.dataset?.scope || 'unknown'} source scope{result.executed_at ? ` · computed ${result.executed_at}` : ''}</p>
      <div className="analytics-actions"><button type="button" onClick={() => setTableOpen(!tableOpen)}>{tableOpen ? 'Hide' : 'Show'} result table</button>
        {!['table', 'pivot', 'kpi'].includes(config.view) && <button type="button" onClick={() => { if (!chartRef.current) return; const link = document.createElement('a'); link.href = chartRef.current.toBase64Image(); link.download = 'analytics-chart.png'; link.click(); }}>Export chart PNG</button>}</div>
    </div>
    {result.period && <p className="analytics-scope">{result.period.start} through {result.period.end}, inclusive UTC days. Boundary buckets may represent partial periods; source completeness is not inferred.</p>}}
    {(tableOpen || config.view === 'table') && <ResultTable key={JSON.stringify(result.columns)} result={result} appearance={appearance} groups={groups} onSelect={onSelect} />}
    {!compact && result.comparison && <details><summary>Comparison result · {result.comparison.kind === 'segment' ? 'Baseline segment' : `${result.comparison.start} to ${result.comparison.end}`}</summary>
      <table><thead><tr><th>Measure</th><th>Current total</th><th>Baseline total</th><th>Absolute change</th><th>Percentage change</th></tr></thead><tbody>{measures.map(m => <tr key={m.id}><th>{m.label || m.id}</th><td>{formatValue(result.summary?.[m.id], appearance)}</td><td>{formatValue(result.comparison.summary?.[m.id], appearance)}</td><td>{formatValue(result.comparison.deltas[m.id]?.absolute, appearance)}</td><td>{result.comparison.deltas[m.id]?.percent == null ? 'Unavailable (zero or missing baseline)' : `${result.comparison.deltas[m.id].percent.toFixed(2)}%`}</td></tr>)}</tbody></table>
      <ResultTable result={{ ...result, rows: result.comparison.rows }} appearance={appearance} /></details>}
  </div>;
}
