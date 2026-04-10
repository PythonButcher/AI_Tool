import React from 'react';
import { FaChartBar } from 'react-icons/fa';

/**
 * Renders actionable recommendations derived from the decision intelligence run.
 */
const DecisionRecommendations = ({ recommendations, onActionClick }) => {
  if (!recommendations || recommendations.length === 0) {
    return (
      <div className="decision-empty-state">
        <p>No actionable recommendations available for the current signals.</p>
      </div>
    );
  }

  return (
    <div className="decision-recommendations-list">
      {recommendations.map((rec) => (
        <div 
          key={rec.recommendation_id} 
          className={`decision-recommendation-card decision-recommendation-card--${rec.priority}`}
        >
          {/* Recommendation Header: Priority and Title */}
          <div className="decision-recommendation-header">
            <h4 className="decision-recommendation-title">{rec.title}</h4>
            <span className={`decision-priority-badge decision-priority-badge--${rec.priority}`}>
              {rec.priority} Priority
            </span>
          </div>
          
          <p className="decision-recommendation-summary">{rec.summary}</p>
          
          {/* Recommendation Actions: Contextual tools to address the recommendation */}
          {rec.actions && rec.actions.length > 0 && (
            <div className="decision-recommendation-actions">
              {rec.actions.map((action, i) => (
                <button
                  key={i}
                  type="button"
                  className="decision-action-button"
                  onClick={() => onActionClick(action)}
                  title={`Launch ${action.label}`}
                >
                  <span className="decision-action-icon"><FaChartBar /></span>
                  <div className="decision-action-copy">
                    <span className="decision-action-label">{action.label}</span>
                    <small className="decision-action-description">{action.description}</small>
                  </div>
                </button>
              ))}
            </div>
          )}
          
          {/* Recommendation Footer: Projected outcome of taking action */}
          <div className="decision-recommendation-footer">
            <span className="decision-outcome-hint">
              <strong>Expected Outcome:</strong> {rec.expected_outcome}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default DecisionRecommendations;
