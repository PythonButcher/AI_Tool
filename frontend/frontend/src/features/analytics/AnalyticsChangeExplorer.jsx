import React, { useEffect, useRef, useState } from 'react';
import { FaArrowRight, FaDownload, FaPlay } from 'react-icons/fa';
import { download, formatValue, tableCsv } from './analyticsModel';

const EMPTY_PERIOD = { start: '', end: '' };
const NUMBER_STYLE = { decimals: 4 };
const UTC_DAY = 86400000;
const metricValue = value => formatValue(value, NUMBER_STYLE);
const signedValue = value => `${value > 0 ? '+' : ''}${metricValue(value)}`;
const driverLabel = driver => {
  if (driver.kind === 'other') return 'Other segments';
  if (driver.kind === 'missing') return 'Missing segment';
  if (driver.segment === '') return 'Empty text';
  return String(driver.segment);
};

function presetPeriods(days) {
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const day = offset => new Date(today - offset * UTC_DAY).toISOString().slice(0, 10);
  return { baseline: { start: day(days * 2), end: day(days + 1) }, current: { start: day(days), end: day(1) } };
}

function DateRange({ label, period, onChange }) {
  return <fieldset className="analytics-change-date-range">
    <legend>{label}</legend>
    <label>Start<input type="date" aria-label={`${label} start`} required value={period.start} onChange={e => onChange({ ...period, start: e.target.value })} /></label>
    <label>End<input type="date" aria-label={`${label} end`} required min={period.start || undefined} value={period.end} onChange={e => onChange({ ...period, end: e.target.value })} /></label>
  </fieldset>;
}

function ChangeWaterfall({ payload, driverIndex, onSelect }) {
  const { totals, drivers } = payload;
  let position = totals.baseline_value;
  const changes = drivers.map((driver, index) => {
    const start = position;
    position += driver.delta;
    return { key: `driver-${index}`, label: driverLabel(driver), start, end: position, value: driver.delta, index };
  });
  const rows = [
    { key: 'baseline', label: 'Baseline', start: 0, end: totals.baseline_value, value: totals.baseline_value },
    ...changes,
    { key: 'current', label: 'Current', start: 0, end: totals.current_value, value: totals.current_value },
  ];
  const positions = rows.flatMap(row => [row.start, row.end]);
  const minimum = Math.min(...positions);
  const span = Math.max(...positions) - minimum || 1;
  return <div className="analytics-change-waterfall" aria-label="Metric change waterfall">
    {rows.map(({ key, label, start, end, value, index }) => {
      const style = { left: `${(Math.min(start, end) - minimum) / span * 100}%`, width: `${Math.abs(end - start) / span * 100}%` };
      const direction = index == null ? 'total' : value > 0 ? 'up' : value < 0 ? 'down' : 'flat';
      const contents = <>
        <span className="analytics-change-row-label" title={label}>{label}</span>
        <span className="analytics-change-track" aria-hidden="true"><span className={`is-${direction}`} style={style} /></span>
        <strong>{index == null ? metricValue(value) : signedValue(value)}</strong>
      </>;
      return index == null
        ? <div key={key} className="analytics-change-row analytics-change-total">{contents}</div>
        : <button key={key} className="analytics-change-row" type="button" aria-pressed={driverIndex === index} onClick={() => onSelect(index)}>{contents}</button>;
    })}
  </div>;
}

function ChangeOutput({ payload, request, openAnalysis }) {
  const [driverIndex, setDriverIndex] = useState(0);
  const driver = payload.drivers[driverIndex];
  const { totals } = payload;
  const exportDrivers = () => {
    const columns = ['kind', 'segment', 'baseline_value', 'current_value', 'delta', 'baseline_count', 'current_count', 'volume_effect', 'rate_effect'];
    download('analytics-change-explorer.csv', tableCsv({ columns, rows: payload.drivers }), 'text/csv;charset=utf-8');
  };
  return <div className="analytics-change-output">
    <div className="analytics-change-metrics">
      {[['Baseline', totals.baseline_value], ['Current', totals.current_value], ['Net change', totals.delta]].map(([label, value]) => (
        <div key={label}><small>{label}</small><strong>{label === 'Net change' ? signedValue(value) : metricValue(value)}</strong></div>
      ))}
    </div>
    <div className="analytics-change-answer">
      <section className="analytics-inspector-card" aria-label="Segment contributions">
        <div className="analytics-change-title"><h3>Contribution by segment</h3><button type="button" onClick={exportDrivers} disabled={!driver}><FaDownload /> Export CSV</button></div>
        <p className="analytics-scope">{payload.segment_count.toLocaleString()} segments · {payload.dataset?.scope || 'unknown'} source scope</p>
        {totals.baseline_count || totals.current_count
          ? <ChangeWaterfall payload={payload} driverIndex={driverIndex} onSelect={setDriverIndex} />
          : <p className="analytics-empty-hint">No matching observations in either period.</p>}
      </section>
      <section className="analytics-inspector-card analytics-change-effects" aria-label="Change factors">
        <h3>Change factors</h3>
        <dl>
          <div><dt>Total volume effect</dt><dd>{signedValue(totals.volume_effect)}</dd></div>
          {request.metric.aggregation === 'sum' && <div><dt>Total value per observation effect</dt><dd>{signedValue(totals.rate_effect)}</dd></div>}
        </dl>
        {driver && <>
          <h4>{driverLabel(driver)}</h4>
          <dl>
            <div><dt>Baseline → current</dt><dd>{metricValue(driver.baseline_value)} → {metricValue(driver.current_value)}</dd></div>
            <div><dt>Observations</dt><dd>{metricValue(driver.baseline_count)} → {metricValue(driver.current_count)}</dd></div>
            <div><dt>Volume effect</dt><dd>{signedValue(driver.volume_effect)}</dd></div>
            {request.metric.aggregation === 'sum' && <div><dt>Value per observation effect</dt><dd>{signedValue(driver.rate_effect)}</dd></div>}
          </dl>
          {driver.kind !== 'other' && <button type="button" onClick={() => openAnalysis(request, driver)}><FaArrowRight /> Open segment in Analysis</button>}
        </>}
        <details className="analytics-change-method">
          <summary>How attribution works</summary>
          <p>Counts attribute movement to volume. For sums, each segment separates the change in observation count from the change in average value, weighting each with the midpoint of the other factor. Segments present in only one period contribute through volume.</p>
        </details>
      </section>
    </div>
  </div>;
}

export default function AnalyticsChangeExplorer({ source, fields, loadingFields, sourceNeedsReview, contextFilters, defaults, requestChange, openAnalysis }) {
  const [dateField, setDateField] = useState(defaults.dateField || '');
  const [segmentField, setSegmentField] = useState(defaults.segmentField || '');
  const [aggregation, setAggregation] = useState(defaults.metricField ? 'sum' : 'count_rows');
  const [metricField, setMetricField] = useState(defaults.metricField || '');
  const [baseline, setBaseline] = useState(EMPTY_PERIOD);
  const [current, setCurrent] = useState(EMPTY_PERIOD);
  const [useFilters, setUseFilters] = useState(true);
  const [run, setRun] = useState({ status: 'idle' });
  const active = useRef(null);
  useEffect(() => () => active.current?.abort(), []);

  const update = (setter, value) => {
    active.current?.abort();
    setter(value);
    setRun({ status: 'idle' });
  };
  const effectiveDate = fields.some(field => field.name === dateField) ? dateField : fields.find(field => field.type === 'date')?.name || '';
  const segmentOptions = fields.filter(field => field.name !== effectiveDate);
  const effectiveSegment = segmentOptions.some(field => field.name === segmentField) ? segmentField : segmentOptions.find(field => field.type === 'string')?.name || '';
  const numbers = fields.filter(field => field.type === 'number');
  const effectiveMetric = numbers.some(field => field.name === metricField) ? metricField : '';
  const boundsValid = baseline.start && baseline.end && current.start && current.end &&
    baseline.start <= baseline.end && baseline.end < current.start && current.start <= current.end;
  const canRun = !!source && !sourceNeedsReview && effectiveDate && effectiveSegment && boundsValid &&
    (aggregation === 'count_rows' || effectiveMetric);
  const anyDatesEntered = baseline.end && current.start;
  const hasContextFilters = Array.isArray(contextFilters) ? contextFilters.length > 0 : Boolean(contextFilters);

  const submit = async event => {
    event.preventDefault();
    if (!canRun || run.status === 'loading') return;
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    const request = { source, date_field: effectiveDate, segment_field: effectiveSegment, baseline, current,
      filters: useFilters ? contextFilters : [], metric: { aggregation, ...(aggregation === 'sum' ? { field: effectiveMetric } : {}) } };
    setRun({ status: 'loading' });
    try {
      const payload = await requestChange(request, controller.signal);
      if (!controller.signal.aborted) setRun({ status: 'ready', payload, request });
    } catch (error) {
      if (!controller.signal.aborted) setRun({ status: 'error', message: error.message });
    }
  };

  const applyPreset = days => {
    const periods = presetPeriods(days);
    update(setBaseline, periods.baseline);
    setCurrent(periods.current);
  };

  return <div className="analytics-change-layout">
    <form className="analytics-inspector-card analytics-change-form" onSubmit={submit}>
      <div><h3>Compare periods</h3><small>{source?.name || 'Choose a dataset in the Analytics bar'}</small></div>
      <label>Metric<select value={aggregation} onChange={e => update(setAggregation, e.target.value)}>
        <option value="count_rows">Record count</option><option value="sum" disabled={!numbers.length}>Sum of a numeric field</option>
      </select></label>
      {aggregation === 'sum' && <label>Numeric field<select value={effectiveMetric} required onChange={e => update(setMetricField, e.target.value)}>
        <option value="">Choose a field</option>{numbers.map(field => <option key={field.name}>{field.name}</option>)}
      </select></label>}
      <div className="analytics-change-fields">
        <label>Date field<select value={effectiveDate} required onChange={e => update(setDateField, e.target.value)}>
          <option value="">Choose a field</option>{fields.map(field => <option key={field.name}>{field.name}</option>)}
        </select></label>
        <label>Break down by<select value={effectiveSegment} required onChange={e => update(setSegmentField, e.target.value)}>
          <option value="">Choose a field</option>{segmentOptions.map(field => <option key={field.name}>{field.name}</option>)}
        </select></label>
      </div>
      <div className="analytics-actions">
        <button type="button" onClick={() => applyPreset(7)}>Last 7 days</button>
        <button type="button" onClick={() => applyPreset(30)}>Last 30 days</button>
      </div>
      <DateRange label="Baseline" period={baseline} onChange={value => update(setBaseline, value)} />
      <DateRange label="Current" period={current} onChange={value => update(setCurrent, value)} />
      {anyDatesEntered && baseline.end >= current.start && <p className="analytics-scope">The baseline must end before the current period starts.</p>}
      {hasContextFilters && <label className="analytics-checkbox-row"><input type="checkbox" checked={useFilters} onChange={e => update(setUseFilters, e.target.checked)} /> Apply workspace filters</label>}
      {sourceNeedsReview && <p className="analytics-scope">Confirm the imported dataset in Analysis first.</p>}
      {loadingFields && <p className="analytics-scope">Loading dataset fields…</p>}
      <div className="analytics-actions">
        <button type="submit" className="is-primary" disabled={!canRun || run.status === 'loading'}><FaPlay /> {run.status === 'loading' ? 'Explaining change…' : 'Explain change'}</button>
        {run.status === 'loading' && <button type="button" onClick={() => update(setRun, { status: 'idle' })}>Cancel</button>}
      </div>
      {run.status === 'error' && <p role="alert" className="analytics-change-error">{run.message}</p>}
    </form>
    {run.status === 'ready'
      ? <ChangeOutput payload={run.payload} request={run.request} openAnalysis={openAnalysis} />
      : <div className="analytics-change-empty" role={run.status === 'loading' ? 'status' : undefined}>
        <strong>{run.status === 'loading' ? 'Comparing the two periods' : 'Find the drivers of a metric change'}</strong>
        <p>Compare the same metric across two periods and see how each segment contributed.</p>
      </div>}
  </div>;
}
