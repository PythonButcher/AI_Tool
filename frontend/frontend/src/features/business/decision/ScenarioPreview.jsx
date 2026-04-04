import React from 'react';

/**
 * Renders a lightweight scenario preview.
 */
const ScenarioPreview = ({ preview }) => {
  if (!preview || preview.status !== 'ready') return null;

  const { summary, projections, suggested_inputs } = preview;

  return (
    <div className="decision-scenario-preview">
      <div className="decision-scenario-header">
        <p className="decision-scenario-summary">{summary}</p>
        <div className="decision-scenario-inputs">
          <span className="scenario-input-label">Suggested Inputs:</span>
          {suggested_inputs && suggested_inputs.metric_targets && suggested_inputs.metric_targets.map((t, i) => (
            <span key={i} className="scenario-input-tag">
              {t.metric_id}: {(t.adjustment_value * 100).toFixed(0)}%
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
                  <span className="projection-label">Baseline</span>
                  <span className="projection-value">{proj.baseline_value?.toLocaleString()}</span>
                </div>
                <div className="projection-arrow">→</div>
                <div className="projection-value-block">
                  <span className="projection-label">Projected</span>
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
