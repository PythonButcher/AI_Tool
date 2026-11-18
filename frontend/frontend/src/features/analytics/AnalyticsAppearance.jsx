import React from 'react';

export default function AnalyticsAppearance({ appearance, measures = [], onChange }) {
  return <>
    <label>Palette<select value={appearance.palette || 'blue'} onChange={e => onChange({ palette: e.target.value })}>{['blue', 'teal', 'warm'].map(p => <option key={p}>{p}</option>)}</select></label>
    {measures.map((measure, index) => <label key={measure.id}>{measure.label || measure.id} color<input type="color" value={appearance.colors?.[measure.id] || ['#4d8bfa', '#46b9ac', '#af83e8'][index % 3]} onChange={e => onChange({ colors: { ...appearance.colors, [measure.id]: e.target.value } })} /></label>)}
    <label>Number format<select value={appearance.unit || 'number'} onChange={e => onChange({ unit: e.target.value })}>{['number', 'currency', 'percent'].map(u => <option key={u}>{u}</option>)}</select></label>
    {appearance.unit === 'currency' && <label>Currency<select value={appearance.currency || 'USD'} onChange={e => onChange({ currency: e.target.value })}>{['USD', 'EUR', 'GBP', 'CAD', 'JPY', 'AUD', 'INR'].map(c => <option key={c}>{c}</option>)}</select></label>}
    <label>Decimals<input type="number" min="0" max="8" value={appearance.decimals ?? 2} onChange={e => onChange({ decimals: Math.max(0, Math.min(8, Number(e.target.value))) })} /></label>
    <label>Date format<select value={appearance.dateFormat || 'iso'} onChange={e => onChange({ dateFormat: e.target.value })}><option value="iso">ISO</option><option value="short">Local short date</option><option value="long">Local long date</option></select></label>
    <label>Target / reference line<input type="number" value={appearance.target ?? ''} onChange={e => onChange({ target: e.target.value })} /></label>
    <label><input type="checkbox" checked={!!appearance.conditional} onChange={e => onChange({ conditional: e.target.checked })} />Color values against target</label>
    {appearance.conditional && <><label>At or above target<input type="color" value={appearance.aboveColor || '#169f91'} onChange={e => onChange({ aboveColor: e.target.value })} /></label><label>Below target<input type="color" value={appearance.belowColor || '#de6578'} onChange={e => onChange({ belowColor: e.target.value })} /></label></>}
    {['xLabel', 'yLabel'].map(key => <label key={key}>{key === 'xLabel' ? 'Horizontal axis' : 'Vertical axis'}<input value={appearance[key] || ''} onChange={e => onChange({ [key]: e.target.value })} /></label>)}
    <label><input type="checkbox" checked={appearance.legend !== false} onChange={e => onChange({ legend: e.target.checked })} />Show legend</label>
  </>;
}
