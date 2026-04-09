import React, { useState } from 'react';

/**
 * Transforms technical keys (snake_case/camelCase) into readable Title Case labels.
 * e.g., "growth_rate_pct" -> "Growth Rate Pct"
 */
const labelize = (key) => {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/\b\w/g, (l) => l.toUpperCase())
    .trim();
};

/**
 * Formats evidence values based on their probable type.
 */
const formatEvidenceValue = (value) => {
  if (value === null || value === undefined) return 'N/A';
  if (typeof value === 'number') {
    // If it looks like a percentage (0-1), format it. 
    // This is a heuristic; in a production app, we'd use metadata.
    if (Math.abs(value) <= 1 && value !== 0) {
      return `${(value * 100).toFixed(1)}%`;
    }
    return value.toLocaleString();
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

/**
 * DecisionSignals
 * 
 * Renders the ranked signals (anomalies, trends, observations) 
 * detected by the intelligence engine.
 * 
 * It prioritizes 'Evidence Parsing' to ensure technical payloads 
 * are readable for business users.
 */
const DecisionSignals = ({ signals }) => {
  const [expandedId, setExpandedId] = useState(null);

  if (!signals || signals.length === 0) {
    return (
      <div className="decision-empty-state">
        <p>No significant signals detected in the current data window.</p>
      </div>
    );
  }

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="decision-signals-list">
      {signals.map((signal) => (
        <div 
          key={signal.signal_id} 
          className={`decision-signal-card decision-signal-card--${signal.severity} ${expandedId === signal.signal_id ? 'is-expanded' : ''}`}
        >
          {/* Signal Header: Summary of the observation */}
          <div className="decision-signal-card__header" onClick={() => toggleExpand(signal.signal_id)}>
            <div className="decision-signal-card__title-row">
              <span className={`decision-severity-indicator decision-severity-indicator--${signal.severity}`} title={`Severity: ${signal.severity}`} />
              <h4 className="decision-signal-title">{signal.title}</h4>
            </div>
            <div className="decision-signal-card__meta">
              <span className="decision-importance">Signal Score: {signal.importance_score?.toFixed(0)}</span>
              <span className="decision-expand-icon">{expandedId === signal.signal_id ? '−' : '+'}</span>
            </div>
          </div>

          {/* Signal Body: Deep-dive evidence */}
          <div className="decision-signal-card__body">
            <p className="decision-signal-summary">{signal.summary}</p>
            
            {expandedId === signal.signal_id && signal.evidence && (
              <div className="decision-signal-evidence">
                <h5 className="evidence-title">Supporting Evidence</h5>
                <div className="evidence-structured">
                  {Object.entries(signal.evidence).map(([key, value]) => (
                    <div key={key} className="evidence-item">
                      <span className="evidence-label">{labelize(key)}:</span>
                      <span className="evidence-value">{formatEvidenceValue(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default DecisionSignals;
