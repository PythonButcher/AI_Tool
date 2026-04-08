import React from 'react';

/**
 * Renders actionable recommendations.
 */
const DecisionRecommendations = ({ recommendations, onActionClick }) => {
  if (!recommendations || recommendations.length === 0) {
    return <p className="decision-empty-state">No recommendations prepared.</p>;
  }

  return (
    <div className="decision-recommendations-list">
      {recommendations.map((rec) => (
        <div 
          key={rec.recommendation_id} 
          className={`decision-recommendation-card decision-recommendation-card--${rec.priority}`}
        >
          <div className="decision-recommendation-header">
            <h4 className="decision-recommendation-title">{rec.title}</h4>
            <span className={`decision-priority-badge decision-priority-badge--${rec.priority}`}>
              {rec.priority}
            </span>
          </div>
          
          <p className="decision-recommendation-summary">{rec.summary}</p>
          
          {rec.actions && rec.actions.length > 0 && (
            <div className="decision-recommendation-actions">
              {rec.actions.map((action, i) => (
                <button
                  key={i}
                  type="button"
                  className="decision-action-button"
                  onClick={() => onActionClick(action)}
                >
                  <span className="decision-action-icon">📊</span>
                  <div className="decision-action-copy">
                    <span className="decision-action-label">{action.label}</span>
                    <small className="decision-action-description">{action.description}</small>
                  </div>
                </button>
              ))}
            </div>
          )}
          
          <div className="decision-recommendation-footer">
            <span className="decision-outcome-hint">
              <strong>Outcome:</strong> {rec.expected_outcome}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default DecisionRecommendations;
