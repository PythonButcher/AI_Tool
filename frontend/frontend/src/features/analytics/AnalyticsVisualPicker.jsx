import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
const QUICK_IDS = ['bar', 'line', 'area', 'pie', 'table', 'kpi'];
const QUICK_VISUALS = QUICK_IDS.map(id => VISUALS.get(id));

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
  const [previewId, setPreviewId] = useState(null);
  const root = useRef(null);
  const toggle = useRef(null);
  const gallery = useRef(null);
  const preview = VISUALS.get(previewId) || visual;

  useLayoutEffect(() => {
    if (open) gallery.current?.querySelector('button[aria-pressed="true"]')?.focus({ preventScroll: true });
    else setPreviewId(null);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const dismiss = event => {
      if (!root.current?.contains(event.target)) onToggle();
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open, onToggle]);

  return <div ref={root} className="analytics-visual-picker" onKeyDown={event => {
    if (event.key === 'Escape' && open) {
      event.stopPropagation();
      onToggle();
      toggle.current?.focus();
    }
  }}>
    <div className="analytics-section-bar">
      <span className="analytics-step-index" aria-hidden="true">01</span>
      <h3>Visualization</h3>
      <button type="button" className="analytics-author-link" onClick={() => { onSuggest(); toggle.current?.focus({ preventScroll: true }); }}>
        <TbSparkles aria-hidden="true" /> Suggest from fields
      </button>
    </div>
    <button type="button" className="analytics-visual-selected" ref={toggle} onClick={onToggle}
      aria-label={`Change visual, current visual is ${visual[1]}`} aria-expanded={open}>
      <VisualMark visual={visual} />
      <span className="analytics-visual-label"><strong>{visual[1]}</strong><small>{visual[3]}</small></span>
      <span className="analytics-visual-change">{open ? 'Close' : 'All 15'} <TbChevronDown aria-hidden="true" /></span>
    </button>
    {!open && <div className="analytics-visual-quick" role="group" aria-label="Quick visual switcher">
      {QUICK_VISUALS.map(type => (
        <button key={type[0]} type="button" title={type[3]} aria-pressed={type[0] === view} onClick={() => onSelect(type[0])}>
          <VisualMark visual={type} /><span>{type[1]}</span>
        </button>
      ))}
    </div>}
    {open && <div ref={gallery} className="analytics-visual-gallery" aria-label="Visual gallery" onMouseLeave={() => setPreviewId(null)}>
      {GROUPS.map(group => <section key={group.label} aria-label={group.label}>
        <h3>{group.label}</h3>
        <div className="analytics-visual-grid">
          {group.visuals.map(type => <button key={type[0]} type="button" title={type[3]} aria-pressed={type[0] === view}
            onMouseEnter={() => setPreviewId(type[0])} onFocus={() => setPreviewId(type[0])}
            onClick={() => { onSelect(type[0]); toggle.current?.focus({ preventScroll: true }); }}>
            <VisualMark visual={type} />
            <span>{type[1]}</span>
            {type[0] === view && <TbCheck className="analytics-visual-check" aria-hidden="true" />}
          </button>)}
        </div>
      </section>)}
      <p className="analytics-visual-preview"><strong>{preview[1]}</strong><span>{preview[3]}</span></p>
    </div>}
  </div>;
}
