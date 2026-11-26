import React, { useMemo, useRef, useState } from 'react';
import 'chart.js/auto';
import { Bar, Line, Scatter, Pie, Doughnut } from 'react-chartjs-2';
import {
  FaArrowDown, FaArrowUp, FaChevronLeft, FaChevronRight,
  FaChartBar, FaColumns, FaDownload, FaFilter, FaSearch, FaTable,
} from 'react-icons/fa';
import { download, formatValue, tableCsv } from './analyticsModel';
import { useTheme } from '@mui/material/styles';
import { selectionFilter } from './analyticsTransforms';

const PALETTES = {
  blue: ['#3b82f6', '#14b8a6', '#8b5cf6', '#f59e0b', '#ec4899'],
  teal: ['#0d9488', '#38bdf8', '#6366f1', '#eab308', '#d946ef'],
  warm: ['#f97316', '#f43f5e', '#a855f7', '#06b6d4', '#84cc16'],
};

function EmptyVisual({ message, isStatus = false }) {
  return (
    <div className="analytics-empty-canvas" role={isStatus ? 'status' : undefined}>
      <span className="analytics-empty-icon"><FaChartBar aria-hidden="true" /></span>
      <strong>{message}</strong>
    </div>
  );
}

function ResultTable({ result, appearance, groups = [], onSelect }) {
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState(null);
  const [hidden, setHidden] = useState([]);
  const [order, setOrder] = useState(result.columns);
  const [rowQuery, setRowQuery] = useState('');
  const [colsOpen, setColsOpen] = useState(false);

  const columns = useMemo(() => [...order.filter(c => result.columns.includes(c)), ...result.columns.filter(c => !order.includes(c))]
    .filter(c => !hidden.includes(c)), [order, result.columns, hidden]);
  const filteredRows = useMemo(() => {
    if (!rowQuery.trim()) return result.rows;
    const q = rowQuery.toLowerCase();
    return result.rows.filter(r => columns.some(col => String(r[col] ?? '').toLowerCase().includes(q)));
  }, [result.rows, rowQuery, columns]);

  const rows = useMemo(() => sort ? [...filteredRows].sort((a, b) => {
    const left = a[sort.field], right = b[sort.field];
    if (left == null) return right == null ? 0 : 1;
    if (right == null) return -1;
    return (typeof left === 'number' ? left - right : String(left).localeCompare(String(right))) * sort.direction;
  }) : filteredRows, [filteredRows, sort]);

  const safePage = Math.min(page, Math.max(0, Math.ceil(rows.length / 50) - 1));
  return <div className="analytics-table-card">
    <div className="analytics-table-toolbar">
      <div className="analytics-search-box is-compact">
        <FaSearch className="analytics-search-icon" />
        <input aria-label="Filter displayed rows" placeholder="Filter displayed rows…" value={rowQuery} onChange={e => { setRowQuery(e.target.value); setPage(0); }} />
      </div>
      <div className="analytics-actions">
        <button type="button" className={`analytics-icon-pill ${colsOpen ? 'is-selected' : ''}`} onClick={() => setColsOpen(v => !v)}>
          <FaColumns /><span>Table columns ({columns.length}/{result.columns.length})</span>
        </button>
        <button type="button" className="analytics-icon-pill" onClick={() => download('analytics-result.csv', tableCsv({ ...result, columns, rows }), 'text/csv;charset=utf-8')}>
          <FaDownload /><span>Export table CSV</span>
        </button>
      </div>
    </div>

    {colsOpen && <div className="analytics-popover-tray">
      <div className="analytics-actions">
        {result.columns.map(col => (
          <label className="analytics-checkbox-row analytics-col-chip" key={col}>
            <input type="checkbox" checked={!hidden.includes(col)} onChange={() => setHidden(list => list.includes(col) ? list.filter(c => c !== col) : [...list, col])} />
            <span>{col}</span>
            <button type="button" aria-label={`Move ${col} first`} onClick={() => setOrder([col, ...order.filter(c => c !== col)])}>Pin 1st</button>
          </label>
        ))}
      </div>
    </div>}

    <div className="analytics-table-scroll">
      <table>
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col}>
                <button type="button" className="analytics-th-btn" onClick={() => setSort({ field: col, direction: sort?.field === col ? -sort.direction : 1 })}>
                  <span>{col}</span>
                  <span className="analytics-sort-indicator">{sort?.field === col ? (sort.direction === 1 ? '↑' : '↓') : '↕'}</span>
                </button>
              </th>
            ))}
            {onSelect && groups.length > 0 && <th>Investigate</th>}
          </tr>
        </thead>
        <tbody>
          {rows.slice(safePage * 50, safePage * 50 + 50).map((row, index) => (
            <tr key={index}>
              {columns.map(col => <td key={col}>{formatValue(row[col], appearance)}</td>)}
              {onSelect && groups.length > 0 && (
                <td>
                  <button type="button" className="analytics-icon-pill" onClick={() => onSelect(selectionFilter(groups, row))}>
                    <FaFilter /><span>Select row</span>
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <div className="analytics-table-footer">
      <span className="analytics-scope">Showing {rows.length ? safePage * 50 + 1 : 0}–{Math.min((safePage + 1) * 50, rows.length)} of {rows.length} rows</span>
      <div className="analytics-actions">
        <button type="button" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}><FaChevronLeft /><span>Previous rows</span></button>
        <button type="button" disabled={(safePage + 1) * 50 >= rows.length} onClick={() => setPage(safePage + 1)}><span>Next rows</span><FaChevronRight /></button>
      </div>
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
  return <div className="analytics-table-scroll"><table><caption>Pivot matrix — subtotals and grand totals recomputed from source rows</caption><thead><tr><th>{pivot.row_fields.join(' / ')}</th>{columnValues.flatMap(value => measures.map(m => <th key={`${value}-${m}`}>{String(value ?? '(missing)')} · {m}</th>))}<th>Row totals</th></tr></thead>
    <tbody>{rowValues.map(row => <tr key={key(row)}><th>{pivot.row_fields.map(f => row[f] ?? '(missing)').join(' / ')}</th>{columnValues.flatMap(value => measures.map(m => <td key={`${value}-${m}`}>{formatValue(cells.get(`${key(row)}:${JSON.stringify(value)}`)?.[m], appearance)}</td>))}<td>{measures.map(m => `${m}: ${formatValue(pivot.row_totals.find(total => key(total) === key(row))?.[m], appearance)}`).join(' · ')}</td></tr>)}</tbody>
    <tfoot><tr><th>Column totals</th>{columnValues.flatMap(value => measures.map(m => <td key={`${value}-${m}`}>{formatValue(pivot.column_totals.find(row => row[pivot.column_field] === value)?.[m], appearance)}</td>))}<td>{measures.map(m => `${m}: ${formatValue(pivot.grand_totals[m], appearance)}`).join(' · ')}</td></tr></tfoot></table></div>;
}

export default function AnalyticsResult({ result, config, onSelect, compact = false }) {
  const chartRef = useRef(null);
  const [tableOpen, setTableOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const theme = useTheme();
  const appearance = config.appearance || {};
  if (!result) return <EmptyVisual message={config.source ? 'Run the analysis to see your results.' : 'Choose a dataset to start.'} />;
  if (!result.row_count && config.view !== 'kpi') return <EmptyVisual message="No matching rows. Adjust your filters or date range." isStatus />;

  const rows = result.rows || [];
  const groups = config.query?.group_by || [];
  const measures = config.query?.measures || [];
  const palette = PALETTES[appearance.palette] || PALETTES.blue;
  const conditionalColor = value => value == null || appearance.target === '' || appearance.target == null ? undefined : Number(value) >= Number(appearance.target) ? appearance.aboveColor || '#169f91' : appearance.belowColor || '#de6578';
  const labels = rows.map(row => groups.length ? groups.map(g => row[g.field] ?? '(missing)').join(' / ') : config.title || 'Total');
  const data = {
    labels,
    datasets: measures.map((measure, index) => ({
      label: measure.label || measure.id,
      data: rows.map(row => row[measure.id]),
      borderColor: appearance.colors?.[measure.id] || palette[index % palette.length],
      backgroundColor: appearance.conditional
        ? rows.map(row => conditionalColor(row[measure.id]) || palette[index % palette.length])
        : ['pie', 'doughnut'].includes(config.view)
          ? palette
          : appearance.colors?.[measure.id] || palette[index % palette.length],
      borderRadius: ['bar', 'horizontal', 'grouped', 'stacked', 'percent_stacked', 'histogram'].includes(config.view) ? 6 : 0,
      fill: ['area', 'stacked_area'].includes(config.view),
      tension: 0.28,
    })),
  };
  if (config.view === 'scatter') data.datasets = [{ label: config.title, data: rows.map(row => ({ x: row[measures[0]?.field], y: row[measures[1]?.field] })), backgroundColor: palette[0] }];
  if (config.view === 'histogram') { data.labels = rows.map(row => `${row.bin_start.toFixed(2)}–${row.bin_end.toFixed(2)}`); data.datasets = [{ label: 'Rows', data: rows.map(row => row.count), backgroundColor: palette[0], borderRadius: 5 }]; }
  const stacked = ['stacked', 'percent_stacked', 'stacked_area'].includes(config.view);
  if (result.comparison?.aligned_rows && ['line', 'area', 'bar', 'horizontal', 'grouped'].includes(config.view)) {
    data.datasets.push(...measures.map((measure, index) => ({
      label: `${measure.label || measure.id} · comparison`,
      data: result.comparison.aligned_rows.map(row => row[measure.id]),
      borderColor: palette[index % palette.length],
      backgroundColor: `${palette[index % palette.length]}44`,
      borderDash: [5, 4],
      fill: false,
    })));
  }
  const horizontal = config.view === 'horizontal';
  const isCount = config.view === 'histogram' || (measures.length > 0 && measures.every(measure =>
    ['count_rows', 'count', 'count_distinct'].includes(measure.aggregation) && (!measure.post || measure.post === 'none')));
  const axisOptions = (axis, label) => ({
    stacked,
    ticks: { color: theme.palette.text.secondary, precision: isCount && axis === (horizontal ? 'x' : 'y') ? 0 : undefined },
    grid: { color: theme.palette.divider },
    title: { display: !!label, text: label, color: theme.palette.text.primary },
  });
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    indexAxis: horizontal ? 'y' : 'x',
    plugins: {
      legend: { display: appearance.legend !== false, labels: { color: theme.palette.text.primary, usePointStyle: true, boxWidth: 8 } },
      tooltip: { enabled: true },
    },
    scales: ['pie', 'doughnut'].includes(config.view) ? undefined : {
      x: axisOptions('x', appearance.xLabel),
      y: axisOptions('y', appearance.yLabel),
    },
    onClick: (_event, elements) => { const row = rows[elements[0]?.index]; if (row && groups.length) onSelect?.(selectionFilter(groups, row)); },
  };
  const reference = {
    id: 'analyticsReference',
    afterDraw(chart) {
      const scale = chart.scales[horizontal ? 'x' : 'y'];
      if (appearance.target === '' || appearance.target == null || !Number.isFinite(Number(appearance.target)) || !scale) return;
      const position = scale.getPixelForValue(Number(appearance.target));
      const { ctx, chartArea } = chart;
      const { top, bottom, left, right } = chartArea;
      if (horizontal ? position < left || position > right : position < top || position > bottom) return;
      ctx.save();
      ctx.strokeStyle = '#ec4899';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(horizontal ? position : left, horizontal ? top : position);
      ctx.lineTo(horizontal ? position : right, horizontal ? bottom : position);
      ctx.stroke();
      ctx.restore();
    },
  };
  const Chart = ['line', 'area', 'stacked_area'].includes(config.view) ? Line : config.view === 'scatter' ? Scatter : config.view === 'pie' ? Pie : config.view === 'doughnut' ? Doughnut : Bar;

  return <div className="analytics-result">
    {/* Executive Summary Ribbon above non-KPI charts */}
    {!compact && config.view !== 'kpi' && result.summary && measures.length > 0 && (
      <div className="analytics-summary-ribbon">
        {measures.map(measure => {
          const delta = result.comparison?.deltas?.[measure.id];
          const isPos = (delta?.absolute ?? 0) >= 0;
          return (
            <div key={measure.id} className="analytics-summary-stat">
              <span className="analytics-summary-label">{measure.label || measure.id}</span>
              <strong className="analytics-summary-value">{formatValue(result.summary?.[measure.id], appearance)}</strong>
              {delta && (
                <span className={`analytics-delta-badge ${isPos ? 'is-positive' : 'is-negative'}`}>
                  {isPos ? <FaArrowUp /> : <FaArrowDown />}
                  {delta.percent == null ? formatValue(delta.absolute, appearance) : `${delta.percent.toFixed(1)}%`}
                </span>
              )}
            </div>
          );
        })}
      </div>
    )}

    {config.view === 'kpi' ? (
      <div className="analytics-kpis">
        {measures.map(measure => {
          const delta = result.comparison?.deltas?.[measure.id];
          const isPos = (delta?.absolute ?? 0) >= 0;
          return (
            <div key={measure.id} className="analytics-kpi-card">
              <span className="analytics-kpi-label">{measure.label || measure.id}</span>
              <strong style={{ color: appearance.conditional ? conditionalColor(result.summary?.[measure.id]) : undefined }}>
                {formatValue(result.summary?.[measure.id], appearance)}
              </strong>
              {result.comparison && (
                <small className={`analytics-delta-badge ${isPos ? 'is-positive' : 'is-negative'}`}>
                  {isPos ? <FaArrowUp /> : <FaArrowDown />}
                  {formatValue(delta?.absolute, appearance)} change · {delta?.percent == null ? 'Percentage unavailable' : `${delta.percent.toFixed(1)}%`}
                </small>
              )}
            </div>
          );
        })}
      </div>
    ) : config.view === 'pivot' ? (
      <PivotTable result={result} appearance={appearance} />
    ) : config.view !== 'table' && (
      <div className={`analytics-chart ${compact ? 'is-compact' : ''}`} role="img" aria-label={`${config.title || 'Analysis'}: ${rows.length} results. Values available in the result table.`}>
        <Chart ref={chartRef} data={data} options={options} plugins={[reference]} />
      </div>
    )}

    <div className={`analytics-result-bar ${compact ? 'is-compact' : ''}`}>
      <div className="analytics-telemetry-pills">
        <span className="analytics-telemetry-chip">{result.row_count.toLocaleString()} {compact ? 'rows' : 'matching source rows'}</span>
        {(!compact || result.truncated) && <span className="analytics-telemetry-chip">{result.rows.length} displayed{result.truncated ? ` · limit ${result.limit}` : ''}</span>}
        <span className="analytics-telemetry-chip">
          {result.dataset?.scope || 'Unknown'} scope{result.executed_at && <> · <time dateTime={result.executed_at} title={result.executed_at}>{new Date(result.executed_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</time></>}
        </span>
      </div>
      <div className="analytics-actions">
        {config.view !== 'table' && <button type="button" className={`analytics-icon-pill ${tableOpen ? 'is-selected' : ''}`} onClick={() => setTableOpen(!tableOpen)} aria-expanded={tableOpen}>
          <FaTable /><span>{tableOpen ? 'Hide table' : 'Result table'}</span>
        </button>}
        {!['table', 'pivot', 'kpi'].includes(config.view) && (
          <button type="button" className="analytics-icon-pill" onClick={() => { if (!chartRef.current) return; const link = document.createElement('a'); link.href = chartRef.current.toBase64Image(); link.download = 'analytics-chart.png'; link.click(); }}>
            <FaDownload /><span>Export chart PNG</span>
          </button>
        )}
        {!compact && result.comparison && (
          <button type="button" className={`analytics-icon-pill ${compareOpen ? 'is-selected' : ''}`} onClick={() => setCompareOpen(v => !v)}>
            <span>Comparison details</span>
          </button>
        )}
      </div>
    </div>

    {result.period && <p className="analytics-scope">{result.period.start} through {result.period.end}, inclusive UTC days. Boundary buckets may represent partial periods; source completeness is not inferred.</p>}

    {(tableOpen || config.view === 'table') && <ResultTable key={JSON.stringify(result.columns)} result={result} appearance={appearance} groups={groups} onSelect={onSelect} />}

    {!compact && result.comparison && compareOpen && (
      <div className="analytics-popover-tray">
        <strong>Comparison result · {result.comparison.kind === 'segment' ? 'Baseline segment' : `${result.comparison.start} to ${result.comparison.end}`}</strong>
        <div className="analytics-table-scroll">
          <table>
            <thead><tr><th>Measure</th><th>Current total</th><th>Baseline total</th><th>Absolute change</th><th>Percentage change</th></tr></thead>
            <tbody>{measures.map(m => <tr key={m.id}><th>{m.label || m.id}</th><td>{formatValue(result.summary?.[m.id], appearance)}</td><td>{formatValue(result.comparison.summary?.[m.id], appearance)}</td><td>{formatValue(result.comparison.deltas[m.id]?.absolute, appearance)}</td><td>{result.comparison.deltas[m.id]?.percent == null ? 'Unavailable (zero or missing baseline)' : `${result.comparison.deltas[m.id].percent.toFixed(2)}%`}</td></tr>)}</tbody>
          </table>
        </div>
        <ResultTable result={{ ...result, rows: result.comparison.rows }} appearance={appearance} />
      </div>
    )}
  </div>;
}
