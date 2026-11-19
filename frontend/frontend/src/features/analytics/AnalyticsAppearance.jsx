import React from 'react';
import { FaChartBar, FaCheck, FaEye, FaHashtag, FaPalette } from 'react-icons/fa';

const SWATCHES = {
  blue: { label: 'Ocean Mineral', cls: 'swatch-blue' },
  teal: { label: 'Emerald Tide', cls: 'swatch-teal' },
  warm: { label: 'Amber Sunset', cls: 'swatch-warm' },
};

export default function AnalyticsAppearance({ appearance, measures = [], onChange }) {
  const activePalette = appearance.palette || 'blue';
  return <div className="analytics-appearance">
    <div className="analytics-inspector-card">
      <div className="analytics-card-title"><FaPalette /><span>Color Theme & Series</span></div>
      <div className="analytics-swatch-grid" role="group" aria-label="Color palette presets">
        {['blue', 'teal', 'warm'].map(p => (
          <button
            type="button"
            key={p}
            className={`analytics-swatch-btn ${activePalette === p ? 'is-selected' : ''}`}
            onClick={() => onChange({ palette: p })}
          >
            <span className={`analytics-swatch-dots ${SWATCHES[p].cls}`}><i /><i /><i /></span>
            <span>{SWATCHES[p].label}</span>
            {activePalette === p && <FaCheck className="analytics-swatch-check" />}
          </button>
        ))}
      </div>
      <label className="analytics-sr-select">Palette<select value={activePalette} onChange={e => onChange({ palette: e.target.value })}>{['blue', 'teal', 'warm'].map(p => <option key={p}>{p}</option>)}</select></label>
      {measures.length > 0 && <div className="analytics-series-colors">
        {measures.map((measure, index) => (
          <label key={measure.id} className="analytics-color-chip">
            <span>{measure.label || measure.id} color</span>
            <input type="color" value={appearance.colors?.[measure.id] || ['#4d8bfa', '#46b9ac', '#af83e8'][index % 3]} onChange={e => onChange({ colors: { ...appearance.colors, [measure.id]: e.target.value } })} />
          </label>
        ))}
      </div>}
    </div>

    <div className="analytics-inspector-card">
      <div className="analytics-card-title"><FaHashtag /><span>Number & Date Formatting</span></div>
      <div className="analytics-pill-group">
        {['number', 'currency', 'percent'].map(u => (
          <button type="button" key={u} className={appearance.unit === u || (!appearance.unit && u === 'number') ? 'is-selected' : ''} onClick={() => onChange({ unit: u })}>
            {u === 'number' ? '1,234.5' : u === 'currency' ? '$ Currency' : '% Percent'}
          </button>
        ))}
      </div>
      <div className="analytics-builder-grid">
        <label>Number format<select value={appearance.unit || 'number'} onChange={e => onChange({ unit: e.target.value })}>{['number', 'currency', 'percent'].map(u => <option key={u}>{u}</option>)}</select></label>
        <label>Decimals<input type="number" min="0" max="8" value={appearance.decimals ?? 2} onChange={e => onChange({ decimals: Math.max(0, Math.min(8, Number(e.target.value))) })} /></label>
      </div>
      {appearance.unit === 'currency' && <label>Currency<select value={appearance.currency || 'USD'} onChange={e => onChange({ currency: e.target.value })}>{['USD', 'EUR', 'GBP', 'CAD', 'JPY', 'AUD', 'INR'].map(c => <option key={c}>{c}</option>)}</select></label>}
      <label>Date format<select value={appearance.dateFormat || 'iso'} onChange={e => onChange({ dateFormat: e.target.value })}><option value="iso">ISO (YYYY-MM-DD)</option><option value="short">Local short date</option><option value="long">Local long date</option></select></label>
    </div>

    <div className="analytics-inspector-card">
      <div className="analytics-card-title"><FaChartBar /><span>Targets & Thresholds</span></div>
      <label>Target / reference line<input type="number" placeholder="e.g. 1000" value={appearance.target ?? ''} onChange={e => onChange({ target: e.target.value })} /></label>
      <label className="analytics-checkbox-row"><input type="checkbox" checked={!!appearance.conditional} onChange={e => onChange({ conditional: e.target.checked })} />Color values against target</label>
      {appearance.conditional && <div className="analytics-series-colors">
        <label className="analytics-color-chip"><span>At or above target</span><input type="color" value={appearance.aboveColor || '#169f91'} onChange={e => onChange({ aboveColor: e.target.value })} /></label>
        <label className="analytics-color-chip"><span>Below target</span><input type="color" value={appearance.belowColor || '#de6578'} onChange={e => onChange({ belowColor: e.target.value })} /></label>
      </div>}
    </div>

    <div className="analytics-inspector-card">
      <div className="analytics-card-title"><FaEye /><span>Axes & Legend</span></div>
      <div className="analytics-builder-grid">
        {['xLabel', 'yLabel'].map(key => <label key={key}>{key === 'xLabel' ? 'Horizontal axis' : 'Vertical axis'}<input placeholder={key === 'xLabel' ? 'X-axis title' : 'Y-axis title'} value={appearance[key] || ''} onChange={e => onChange({ [key]: e.target.value })} /></label>)}
      </div>
      <label className="analytics-checkbox-row"><input type="checkbox" checked={appearance.legend !== false} onChange={e => onChange({ legend: e.target.checked })} />Show legend</label>
    </div>
  </div>;
}
