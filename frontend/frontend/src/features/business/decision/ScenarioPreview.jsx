import React from 'react';
import { FaInfoCircle, FaExclamationTriangle, FaShieldAlt } from "react-icons/fa";

/**
 * Renders a lightweight statistical preview of a suggested business scenario.
 * 
 * Phase 8 Enhancement: Bounded Scenario Compare.
 * Bounded to direct adjustment/sensitivity comparison.
 */
const ScenarioPreview = ({ preview }) => {
  if (!preview) return null;

  if (preview.status !== 'ready') {
    return (
      <div className="ai-shell__do-scenario-locked">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <FaShieldAlt style={{ color: 'var(--text-secondary)' }} />
          <span style={{ fontWeight: 800 }}>Scenario Compare Unavailable</span>
        </div>
        <p style={{ margin: 0, opacity: 0.8, fontSize: '0.85rem' }}>{preview.summary}</p>
        {preview.limitations && preview.limitations.length > 0 && (
          <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
            <span style={{ display: 'block', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--accent-red)', marginBottom: '4px' }}>Limitations</span>
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.8rem', opacity: 0.9 }}>
              {preview.limitations.map((lim, i) => <li key={i}>{lim}</li>)}
            </ul>
          </div>
        )}
      </div>
    );
  }

  const { summary, inputs, baseline, comparison, projections, assumptions, limitations, source_scenario_ids } = preview;

  return (
    <div className="ai-shell__do-scenario-ready">
      <div className="ai-shell__do-scenario-header">
        <p className="ai-shell__do-scenario-summary">{summary}</p>
        {comparison?.method === 'direct_adjustment_sensitivity' && (
          <span className="ai-shell__do-scenario-method">Direct Adjustment Comparison</span>
        )}
      </div>

      {inputs && inputs.metric_targets && inputs.metric_targets.length > 0 && (
        <div className="ai-shell__do-scenario-inputs">
          <span className="ai-shell__do-scenario-inputs-lbl">Adjustments:</span>
          {inputs.metric_targets.map((t, i) => {
            const label = t.metric_ref?.label || t.metric_id || 'Metric';
            const val = t.adjustment_value || 0;
            const sign = val > 0 ? '+' : '';
            const displayVal = t.adjustment_type === 'percent'
              ? `${sign}${(val * 100).toFixed(0)}%`
              : `${sign}${val.toLocaleString()}`;

            return (
              <span key={i} className="ai-shell__do-scenario-input-tag">
                {label}: {displayVal}
              </span>
            );
          })}
        </div>
      )}

      {projections && projections.length > 0 && (
        <div className="ai-shell__do-scenario-grid">
          {projections.map((proj, i) => (
            <div key={i} className="ai-shell__do-scenario-card">
              <span className="ai-shell__do-scenario-metric">{proj.metric_ref?.label || 'Metric'}</span>
              <div className="ai-shell__do-scenario-vals">
                <div className="ai-shell__do-scenario-val-block">
                  <span className="ai-shell__do-scenario-val-lbl">
                    {proj.baseline_label || baseline?.period_context?.label || 'Current'}
                  </span>
                  <span className="ai-shell__do-scenario-val">
                    {proj.baseline_value?.toLocaleString()}
                  </span>
                </div>
                
                <div className="ai-shell__do-scenario-arrow">→</div>
                
                <div className="ai-shell__do-scenario-val-block">
                  <span className="ai-shell__do-scenario-val-lbl">
                    {proj.projected_label || 'Projected'}
                  </span>
                  <span className="ai-shell__do-scenario-val is-projected">
                    {proj.projected_value?.toLocaleString()}
                  </span>
                </div>
              </div>
              
              {Number.isFinite(proj.delta_pct) ? (
                <div className={`ai-shell__do-scenario-delta ${proj.delta_pct >= 0 ? 'is-up' : 'is-down'}`}>
                  {proj.delta_pct > 0 ? '+' : ''}{(proj.delta_pct * 100).toFixed(1)}% sensitivity delta
                </div>
              ) : Number.isFinite(proj.delta_value) ? (
                <div className={`ai-shell__do-scenario-delta ${proj.delta_value >= 0 ? 'is-up' : 'is-down'}`}>
                  {proj.delta_value > 0 ? '+' : ''}{proj.delta_value.toLocaleString()} sensitivity delta
                </div>
              ) : (
                <div className="ai-shell__do-scenario-delta is-unavailable">
                  Delta unavailable
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Assumptions and Limitations section */}
      {(assumptions?.length > 0 || limitations?.length > 0) && (
        <div className="ai-shell__do-scenario-footer">
          {assumptions?.length > 0 && (
            <div className="ai-shell__do-scenario-assumptions">
              <span className="ai-shell__do-scenario-footer-title"><FaInfoCircle /> Assumptions</span>
              <ul>
                {assumptions.map((assum, i) => <li key={i}>{assum}</li>)}
              </ul>
            </div>
          )}
          {limitations?.length > 0 && (
            <div className="ai-shell__do-scenario-limitations">
              <span className="ai-shell__do-scenario-footer-title"><FaExclamationTriangle /> Limitations</span>
              <ul>
                {limitations.map((lim, i) => <li key={i}>{lim}</li>)}
              </ul>
            </div>
          )}
          {source_scenario_ids?.length > 0 && (
            <div className="ai-shell__do-scenario-trace">
              Trace IDs: {source_scenario_ids.join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ScenarioPreview;
