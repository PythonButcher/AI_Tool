import React, { useLayoutEffect, useRef } from 'react';
import {
  TbChartArea, TbChartAreaLine, TbChartBar, TbChartDonut, TbChartHistogram, TbChartLine,
  TbChartPie, TbChartScatter, TbCheck, TbChevronDown, TbLayoutGrid, TbNumber123, TbSparkles, TbTable,
} from 'react-icons/tb';

const GROUPS = [
  { label: 'Compare', visuals: [
    ['bar', 'Column', TbChartBar, 'Compare values across categories'],
    ['horizontal', 'Horizontal bar', TbChartBar, 'Compare categories with longer labels'],
    ['grouped', 'Grouped column', TbChartBar, 'Compare measures side by side'],
    ['stacked', 'Stacked column', TbChartBar, 'Show how measures contribute to a total'],
    ['percent_stacked', '100% stacked', TbChartBar, 'Compare the share of each measure'],
    ['pie', 'Pie', TbChartPie, 'Show one measure as parts of a whole'],
    ['doughnut', 'Donut', TbChartDonut, 'Show one measure as shares of a total'],
  ] },
  { label: 'Trends', visuals: [
    ['line', 'Line', TbChartLine, 'Track values over an ordered axis'],
    ['area', 'Area', TbChartArea, 'Show magnitude over an ordered axis'],
    ['stacked_area', 'Stacked area', TbChartAreaLine, 'Track several measures and their combined magnitude'],
  ] },
  { label: 'Distribution', visuals: [
    ['scatter', 'Scatter', TbChartScatter, 'Plot the relationship between two numeric fields'],
    ['histogram', 'Histogram', TbChartHistogram, 'Count observations across numeric intervals'],
  ] },
  { label: 'Tables & KPIs', visuals: [
    ['table', 'Table', TbTable, 'Read rows and values in a table'],
    ['pivot', 'Pivot table', TbLayoutGrid, 'Cross-tabulate measures across rows and columns'],
    ['kpi', 'KPI', TbNumber123, 'Emphasize one or more headline metrics'],
  ] },
];

const VISUALS = new Map(GROUPS.flatMap(group => group.visuals.map(visual => [visual[0], visual])));

function VisualMark({ visual }) {
  const [id, , Icon] = visual;
  if (['bar', 'horizontal', 'grouped', 'stacked', 'percent_stacked'].includes(id)) {
    return <span className={`analytics-visual-mark analytics-visual-bars is-${id}`} aria-hidden="true">
      <i /><i /><i />
    </span>;
  }
  return <span className="analytics-visual-mark" aria-hidden="true"><Icon /></span>;
}

export default function AnalyticsVisualPicker({ view, open, onToggle, onSelect, onSuggest }) {
  const visual = VISUALS.get(view) || VISUALS.get('bar');
  const toggle = useRef(null);
  const gallery = useRef(null);
  useLayoutEffect(() => {
    if (open) gallery.current?.querySelector('button[aria-pressed="true"]')?.focus({ preventScroll: true });
  }, [open]);

  return <div className="analytics-visual-picker" onKeyDown={event => {
    if (event.key === 'Escape' && open) {
      event.stopPropagation();
      onToggle();
      toggle.current?.focus();
    }
  }}>
    <button type="button" className="analytics-visual-selected" ref={toggle} onClick={onToggle}
      aria-label={`Change visual, current visual is ${visual[1]}`} aria-expanded={open}>
      <VisualMark visual={visual} />
      <span className="analytics-visual-label"><small>Visualization</small><strong>{visual[1]}</strong></span>
      <span className="analytics-visual-change">Change <TbChevronDown aria-hidden="true" /></span>
    </button>
    {open && <div ref={gallery} className="analytics-visual-gallery" aria-label="Visual gallery">
      {GROUPS.map(group => <section key={group.label} aria-label={group.label}>
        <h3>{group.label}</h3>
        <div className="analytics-visual-grid">
          {group.visuals.map(type => <button key={type[0]} type="button" title={type[3]} aria-pressed={type[0] === view}
            onClick={() => { onSelect(type[0]); toggle.current?.focus({ preventScroll: true }); }}>
            <VisualMark visual={type} />
            <span>{type[1]}</span>
            {type[0] === view && <TbCheck className="analytics-visual-check" aria-hidden="true" />}
          </button>)}
        </div>
      </section>)}
      <button type="button" className="analytics-author-link" onClick={() => { onSuggest(); toggle.current?.focus({ preventScroll: true }); }}>
        <TbSparkles aria-hidden="true" /> Suggest from fields
      </button>
    </div>}
  </div>;
}
