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
 * @param {Object} props.readiness - Readiness metadata from the backend.
 */
const DecisionPanel = ({ bundle, onActionClick, warnings = [], readiness }) => {
  const missingRequirements = readiness?.missing_requirements || [];

  // Mapping backend state to guided setup UI
  const renderSetupGuidance = () => {
    if (missingRequirements.includes('dataset')) {
      return (
        <div className="decision-panel decision-panel--setup">
          <div className="decision-setup-message">
            <span className="decision-setup-icon">📁</span>
            <h3>Load a dataset</h3>
            <p>Load a dataset to enable Decision Intelligence.</p>
            <small>Go to the Data tab to upload or connect to a data source.</small>
          </div>
        </div>
      );
    }

    if (missingRequirements.includes('semantic_model')) {
      return (
        <div className="decision-panel decision-panel--setup">
          <div className="decision-setup-message">
            <span className="decision-setup-icon">🧠</span>
            <h3>Prepare semantic model</h3>
            <p>No semantic model context available for the decision pipeline.</p>
            <small>Ensure your dataset has a valid semantic mapping.</small>
          </div>
        </div>
      );
    }

    if (missingRequirements.includes('metrics')) {
      return (
        <div className="decision-panel decision-panel--setup">
          <div className="decision-setup-message">
            <span className="decision-setup-icon">📊</span>
            <h3>Define metrics</h3>
            <p>Decision Intelligence requires at least one metric.</p>
            <small>Use the Intelligence panel to define or map metrics from your dataset.</small>
          </div>
        </div>
      );
    }

    if (!bundle) {
      return (
        <div className="decision-panel decision-panel--empty">
          <p>No decision data available. Run the decision pipeline to see insights.</p>
        </div>
      );
    }

    return null;
  };

  const setupGuidance = renderSetupGuidance();
  if (setupGuidance) {
    return setupGuidance;
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
