import React from 'react';
import './DecisionPanel.css';
import DecisionBrief from './DecisionBrief';
import DecisionSignals from './DecisionSignals';
import DecisionRecommendations from './DecisionRecommendations';
import ScenarioPreview from './ScenarioPreview';

/**
 * Main panel for Decision Intelligence results.
 * 
 * @param {Object} props
 * @param {Object} props.bundle - The decision_bundle from the backend.
 * @param {Function} props.onActionClick - Callback when a recommendation action is clicked.
 * @param {Array} props.warnings - Optional warnings to display.
 */
const DecisionPanel = ({ bundle, onActionClick, warnings = [] }) => {
  if (!bundle) {
    return (
      <div className="decision-panel decision-panel--empty">
        <p>No decision data available. Run the decision pipeline to see insights.</p>
      </div>
    );
  }

  const { brief, signals, recommendations, scenario_preview } = bundle;

  return (
    <div className="decision-panel">
      {warnings && warnings.length > 0 && (
        <div className="decision-panel__warnings">
          {warnings.map((w, i) => (
            <div key={i} className="decision-warning">
              <span className="decision-warning__icon">⚠️</span>
              <span className="decision-warning__message">{typeof w === 'string' ? w : w.message}</span>
            </div>
          ))}
        </div>
      )}

      <div className="decision-panel__content">
        {brief && <DecisionBrief brief={brief} />}
        
        <div className="decision-panel__grid">
          <section className="decision-panel__section decision-panel__section--signals">
            <h3 className="decision-section-title">Signals & Evidence</h3>
            <DecisionSignals signals={signals} />
          </section>

          <section className="decision-panel__section decision-panel__section--recommendations">
            <h3 className="decision-section-title">Recommendations</h3>
            <DecisionRecommendations 
              recommendations={recommendations} 
              onActionClick={onActionClick}
            />
          </section>
        </div>

        {scenario_preview && scenario_preview.status === 'ready' && (
          <section className="decision-panel__section decision-panel__section--scenario">
            <h3 className="decision-section-title">Scenario Preview</h3>
            <ScenarioPreview preview={scenario_preview} />
          </section>
        )}
      </div>
    </div>
  );
};

export default DecisionPanel;
