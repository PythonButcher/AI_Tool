import React, { useState } from 'react';

/**
 * Renders the ranked signals and supporting evidence.
 */
const DecisionSignals = ({ signals }) => {
  const [expandedId, setExpandedId] = useState(null);

  if (!signals || signals.length === 0) {
    return <p className="decision-empty-state">No signals detected for this run.</p>;
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
          <div className="decision-signal-card__header" onClick={() => toggleExpand(signal.signal_id)}>
            <div className="decision-signal-card__title-row">
              <span className={`decision-severity-indicator decision-severity-indicator--${signal.severity}`} />
              <h4 className="decision-signal-title">{signal.title}</h4>
            </div>
            <div className="decision-signal-card__meta">
              <span className="decision-importance">Score: {signal.importance_score?.toFixed(0)}</span>
              <span className="decision-expand-icon">{expandedId === signal.signal_id ? '−' : '+'}</span>
            </div>
          </div>

          <div className="decision-signal-card__body">
            <p className="decision-signal-summary">{signal.summary}</p>
            
            {expandedId === signal.signal_id && signal.evidence && (
              <div className="decision-signal-evidence">
                <h5 className="evidence-title">Supporting Evidence</h5>
                <pre className="evidence-payload">
                  {JSON.stringify(signal.evidence, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default DecisionSignals;
