import React from 'react';

/**
 * Renders the top-level executive summary of the decision intelligence run.
 * 
 * Phase 4 Enhancement: Time Intelligence Readiness.
 * This component now looks for 'period_label' or 'comparison_context' 
 * to provide a clear business timeframe for the metrics shown.
 */
const DecisionBrief = ({ brief }) => {
  if (!brief) return null;

  const { title, summary, themes, key_metrics, period_context } = brief;

  return (
    <div className="decision-brief">
      <div className="decision-brief__header">
        <div className="decision-brief__title-group">
          <h2 className="decision-brief__title">{title}</h2>
          {period_context?.label && (
            <span className="decision-period-context">
              Context: {period_context.label}
            </span>
          )}
        </div>
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
              <div className="decision-metric-header">
                <span className="decision-metric-label">{km.metric_ref.label}</span>
                {km.period_label && (
                  <span className="decision-metric-period">{km.period_label}</span>
                )}
              </div>
              
              <div className="decision-metric-value-row">
                <span className="decision-metric-value">
                  {km.current_value?.toLocaleString()}
                </span>
                {km.delta_pct !== undefined && km.delta_pct !== null && (
                  <div className="decision-metric-delta-group">
                    <span className={`decision-metric-delta ${km.delta_pct >= 0 ? 'up' : 'down'}`}>
                      {km.delta_pct > 0 ? '↑' : '↓'} {(Math.abs(km.delta_pct) * 100).toFixed(1)}%
                    </span>
                    {km.comparison_label && (
                      <span className="decision-comparison-label">vs {km.comparison_label}</span>
                    )}
                  </div>
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
