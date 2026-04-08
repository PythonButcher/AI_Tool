import React from 'react';

/**
 * Renders the top-level decision brief summary.
 */
const DecisionBrief = ({ brief }) => {
  if (!brief) return null;

  const { title, summary, themes, key_metrics } = brief;

  return (
    <div className="decision-brief">
      <div className="decision-brief__header">
        <h2 className="decision-brief__title">{title}</h2>
        <div className="decision-brief__themes">
          {themes && themes.map((theme, i) => (
            <span key={i} className="decision-theme-badge">{theme}</span>
          ))}
        </div>
      </div>
      
      <p className="decision-brief__summary">{summary}</p>

      {key_metrics && key_metrics.length > 0 && (
        <div className="decision-brief__metrics">
          {key_metrics.map((km, i) => (
            <div key={i} className={`decision-metric-card decision-metric-card--${km.status}`}>
              <span className="decision-metric-label">{km.metric_ref.label}</span>
              <div className="decision-metric-value-row">
                <span className="decision-metric-value">
                  {km.current_value}
                </span>
                {km.delta_pct !== undefined && km.delta_pct !== null && (
                  <span className={`decision-metric-delta ${km.delta_pct >= 0 ? 'up' : 'down'}`}>
                    {km.delta_pct > 0 ? '↑' : '↓'} {(Math.abs(km.delta_pct) * 100).toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DecisionBrief;
