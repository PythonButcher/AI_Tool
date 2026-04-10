import React from 'react';

/**
 * Renders a lightweight statistical preview of a suggested business scenario.
 * 
 * Phase 4 Enhancement: Time Intelligence Readiness.
 * This component now uses dynamic labels for baseline and projected values,
 * allowing the engine to specify the comparison context (e.g., 'FY24 Actual' -> 'Projected').
 */
const ScenarioPreview = ({ preview }) => {
  if (!preview || preview.status !== 'ready') return null;

  const { summary, projections, suggested_inputs, period_context } = preview;

  return (
    <div className="decision-scenario-preview">
      <div className="decision-scenario-header">
        <div className="decision-scenario-title-row">
          <p className="decision-scenario-summary">{summary}</p>
          {period_context?.label && (
            <span className="decision-scenario-period">
              Period: {period_context.label}
            </span>
          )}
        </div>
        <div className="decision-scenario-inputs">
          <span className="scenario-input-label">Simulated Adjustments:</span>
          {suggested_inputs && suggested_inputs.metric_targets && suggested_inputs.metric_targets.map((t, i) => (
            <span key={i} className="scenario-input-tag">
              {t.metric_id}: {t.adjustment_value > 0 ? '+' : ''}{(t.adjustment_value * 100).toFixed(0)}%
            </span>
          ))}
        </div>
      </div>

      {projections && projections.length > 0 && (
        <div className="decision-projections-grid">
          {projections.map((proj, i) => (
            <div key={i} className="decision-projection-card">
              <span className="projection-metric">{proj.metric_ref.label}</span>
              <div className="projection-values">
                <div className="projection-value-block">
                  <span className="projection-label">
                    {proj.baseline_label || 'Current'}
                  </span>
                  <span className="projection-value">
                    {proj.baseline_value?.toLocaleString()}
                  </span>
                </div>
                
                <div className="projection-arrow">→</div>
                
                <div className="projection-value-block">
                  <span className="projection-label">
                    {proj.projected_label || 'Projected'}
                  </span>
                  <span className="projection-value projection-value--highlighted">
                    {proj.projected_value?.toLocaleString()}
                  </span>
                </div>
              </div>
              
              <div className={`projection-delta ${proj.delta_pct >= 0 ? 'up' : 'down'}`}>
                {proj.delta_pct > 0 ? '+' : ''}{(proj.delta_pct * 100).toFixed(1)}% expected change
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ScenarioPreview;
