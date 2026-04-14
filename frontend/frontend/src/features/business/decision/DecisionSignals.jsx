import React, { useState } from 'react';

/**
 * Transforms technical keys (snake_case/camelCase) into readable Title Case labels.
 * It also handles common business abbreviations like FY (Fiscal Year) and Q (Quarter).
 */
const labelize = (key) => {
  if (!key) return '';
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    // Handle Fiscal Year and Quarter context for Time Intelligence
    .replace(/\b(fy)\b/gi, 'FY')
    .replace(/\bq([1-4])\b/gi, 'Q$1')
    .replace(/\b\w/g, (l) => l.toUpperCase())
    .trim();
};

/**
 * Formats evidence values based on their type and scale.
 * It uses heuristics to detect percentages and applies locale-aware formatting.
 */
const formatValue = (value) => {
  if (value === null || value === undefined) return 'N/A';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    // Heuristic for percentage detection (0 to 1 scale)
    if (Math.abs(value) <= 1 && value !== 0 && value.toString().includes('.')) {
      return `${(value * 100).toFixed(1)}%`;
    }
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return String(value);
};

/**
 * EvidenceNode: A recursive component designed to render arbitrary evidence trees.
 * 
 * Architectural Insight: Using a recursive structure allows the UI to scale to any 
 * depth of analysis provided by the backend without losing hierarchy or 
 * resorting to raw JSON dumps.
 */
const EvidenceNode = ({ label, value, depth = 0 }) => {
  const isObject = value !== null && typeof value === 'object' && !Array.isArray(value);
  const isArray = Array.isArray(value);

  // Check if object/array is empty to avoid rendering empty containers
  if (isObject && Object.keys(value).length === 0) return null;
  if (isArray && value.length === 0) return null;

  if (isObject) {
    return (
      <div className={`evidence-group depth-${depth}`}>
        {label && <div className="evidence-group-label">{labelize(label)}</div>}
        <div className="evidence-group-content">
          {Object.entries(value).map(([k, v]) => (
            <EvidenceNode key={k} label={k} value={v} depth={depth + 1} />
          ))}
        </div>
      </div>
    );
  }

  if (isArray) {
    return (
      <div className={`evidence-list depth-${depth}`}>
        {label && <div className="evidence-list-label">{labelize(label)}</div>}
        <ul className="evidence-list-content">
          {value.map((item, i) => (
            <li key={i} className="evidence-list-item">
              {item !== null && typeof item === 'object' ? (
                <EvidenceNode value={item} depth={depth + 1} />
              ) : (
                <span className="evidence-value">{formatValue(item)}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // Primitive Leaf Node
  return (
    <div className={`evidence-item depth-${depth}`}>
      {label && <span className="evidence-label">{labelize(label)}:</span>}
      <span className="evidence-value">{formatValue(value)}</span>
    </div>
  );
};

/**
 * DecisionSignals
 * 
 * Renders the ranked observations detected by the engine.
 * It prioritizes 'Traceability' by rendering nested evidence structures 
 * in a readable, structured hierarchy.
 */
const DecisionSignals = ({ signals }) => {
  const [expandedId, setExpandedId] = useState(null);

  if (!signals || signals.length === 0) {
    return (
      <div className="decision-empty-state">
        <p>No significant signals detected in the current analysis window.</p>
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
          {/* Signal Header: The high-level observation */}
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

          {/* Signal Body: The structured evidence recursive tree */}
          <div className="decision-signal-card__body">
            <p className="decision-signal-summary">{signal.summary}</p>
            
            {expandedId === signal.signal_id && signal.evidence && (
              <div className="decision-signal-evidence">
                <h5 className="evidence-title">Supporting Evidence</h5>
                <div className="evidence-structured-root">
                  <EvidenceNode value={signal.evidence} />
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
