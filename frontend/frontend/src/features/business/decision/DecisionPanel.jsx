import React from 'react';
import './DecisionPanel.css';
import DecisionBrief from './DecisionBrief';
import DecisionSignals from './DecisionSignals';
import DecisionRecommendations from './DecisionRecommendations';
import ScenarioPreview from './ScenarioPreview';
import { FaLightbulb, FaDatabase, FaBrain, FaChartBar, FaArrowRight } from 'react-icons/fa';

/**
 * DecisionPanel
 * 
 * The primary destination surface for Decision Intelligence.
 * It manages three distinct architectural states based on backend readiness:
 * 1. Setup Guidance (Missing data/logic)
 * 2. Orientation (Ready to run, explaining the value)
 * 3. Results (Active decision bundle rendering)
 * 
 * @param {Object} bundle - The active decision intelligence payload.
 * @param {Object} readiness - Metadata determining current pipeline capabilities.
 * @param {Array} warnings - UI-safe feedback from the intelligence engine.
 * @param {Function} onRunDecision - Triggers a new intelligence run.
 * @param {Function} onActionClick - Handles recommendation-driven chart/workflow launches.
 */
const DecisionPanel = ({ 
  bundle, 
  onActionClick, 
  warnings = [], 
  readiness, 
  onRunDecision,
  onOpenAiChat,
  setIsDataPaneOpen
}) => {
  // Extracting readiness state to drive the 'Guided UI' pattern.
  const missingRequirements = readiness?.missing_requirements || [];
  const isReady = readiness?.decision_ready && missingRequirements.length === 0;

  /**
   * State A: Setup Guidance
   * Renders when the pipeline is blocked by missing prerequisites.
   * Uses 'Soft CTAs' to nudge the user toward the Workspace or Definitions.
   */
  const renderSetupGuidance = () => {
    // Priority 1: No data context.
    if (missingRequirements.includes('dataset')) {
      return (
        <div className="decision-panel decision-panel--setup">
          <div className="decision-setup-message">
            <div className="decision-setup-icon-wrapper">
              <FaDatabase className="decision-setup-icon" />
            </div>
            <h3>Connect your data</h3>
            <p>Decision Intelligence requires an active dataset to begin detecting signals and anomalies.</p>
            <div className="decision-setup-actions">
              <button className="decision-setup-btn decision-setup-btn--primary" onClick={() => onOpenAiChat()}>
                Ask AI to help load data
              </button>
              <small>Or visit the <strong>Workspace</strong> to perform a manual intake.</small>
            </div>
          </div>
        </div>
      );
    }

    // Priority 2: Data exists but no semantic understanding.
    if (missingRequirements.includes('semantic_model')) {
      return (
        <div className="decision-panel decision-panel--setup">
          <div className="decision-setup-message">
            <div className="decision-setup-icon-wrapper">
              <FaBrain className="decision-setup-icon" />
            </div>
            <h3>Prepare Semantic Context</h3>
            <p>We found your data, but we need to understand the relationship between fields to generate logic.</p>
            <div className="decision-setup-actions">
              <button className="decision-setup-btn decision-setup-btn--primary" onClick={() => setIsDataPaneOpen(true)}>
                Review Definitions <FaArrowRight />
              </button>
              <small>Ensure your fields have valid semantic mappings in the side pane.</small>
            </div>
          </div>
        </div>
      );
    }

    // Priority 3: Data and logic exist but no metrics to evaluate.
    if (missingRequirements.includes('metrics')) {
      return (
        <div className="decision-panel decision-panel--setup">
          <div className="decision-setup-message">
            <div className="decision-setup-icon-wrapper">
              <FaChartBar className="decision-setup-icon" />
            </div>
            <h3>Define Business Metrics</h3>
            <p>At least one metric (e.g., Revenue, Churn) is required to evaluate performance impact.</p>
            <div className="decision-setup-actions">
              <button className="decision-setup-btn decision-setup-btn--primary" onClick={() => setIsDataPaneOpen(true)}>
                Add First Metric <FaArrowRight />
              </button>
              <small>Use the <strong>Definitions</strong> pane to map fields to business metrics.</small>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  /**
   * State B: Orientation
   * Renders when requirements are met but no run has been performed.
   * Teaches the user what to expect from the intelligence run.
   */
  const renderReadyState = () => {
    if (isReady && !bundle) {
      return (
        <div className="decision-panel decision-panel--ready">
          <div className="decision-ready-content">
            <div className="decision-ready-icon-orbit">
              <FaLightbulb className="decision-ready-icon" />
            </div>
            <h2 className="decision-ready-title">Ready for Intelligence Run</h2>
            <p className="decision-ready-description">
              Your semantic model and data are fully prepared. Running intelligence will trigger:
            </p>
            <ul className="decision-ready-features">
              <li><strong>Signal Detection:</strong> Identification of recent anomalies and trends.</li>
              <li><strong>Actionable Recommendations:</strong> Ranked next-steps for your KPIs.</li>
              <li><strong>Scenario Projections:</strong> Statistical previews of potential outcomes.</li>
            </ul>
            <button className="decision-run-btn" onClick={onRunDecision}>
              <FaLightbulb /> Run Intelligence Run
            </button>
          </div>
        </div>
      );
    }
    return null;
  };

  // Branching Logic for Setup and Orientation states.
  const setupGuidance = renderSetupGuidance();
  if (setupGuidance) return setupGuidance;

  const readyState = renderReadyState();
  if (readyState) return readyState;

  /**
   * State C: Results
   * Renders the full Decision Intelligence dashboard once a bundle is available.
   */
  const { brief, signals, recommendations, scenario_preview } = bundle || {};

  return (
    <div className="decision-panel">
      {/* 
          Rendering Warnings: 
          These are non-blocking 'Helper Copy' intended to provide context 
          on data quality or partial analysis results.
      */}
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

      {!bundle ? (
        <div className="decision-panel--empty">
          <p>Initializing Decision Intelligence...</p>
        </div>
      ) : (
        <div className="decision-panel__content">
          {/* Top-level Executive Summary */}
          {brief && <DecisionBrief brief={brief} />}
          
          <div className="decision-panel__grid">
            {/* Left Pane: Evidence and Observations */}
            <section className="decision-panel__section decision-panel__section--signals">
              <h3 className="decision-section-title">Signals & Evidence</h3>
              <DecisionSignals signals={signals} />
            </section>

            {/* Right Pane: Ranked Next Steps */}
            <section className="decision-panel__section decision-panel__section--recommendations">
              <h3 className="decision-section-title">Recommendations</h3>
              <DecisionRecommendations 
                recommendations={recommendations} 
                onActionClick={onActionClick}
              />
            </section>
          </div>

          {/* Bottom Pane: Statistical Previews (Optional based on data volume) */}
          {scenario_preview && scenario_preview.status === 'ready' && (
            <section className="decision-panel__section decision-panel__section--scenario">
              <h3 className="decision-section-title">Scenario Preview</h3>
              <ScenarioPreview preview={scenario_preview} />
            </section>
          )}
        </div>
      )}
    </div>
  );
};

export default DecisionPanel;
