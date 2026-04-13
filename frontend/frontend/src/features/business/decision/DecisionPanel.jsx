import React from 'react';
import './DecisionPanel.css';
import './DecisionWorkspace.css';
import DecisionBrief from './DecisionBrief';
import DecisionSignals from './DecisionSignals';
import DecisionRecommendations from './DecisionRecommendations';
import ScenarioPreview from './ScenarioPreview';
import DecisionWorkspaceComposer from './DecisionWorkspaceComposer';
import DecisionWorkspaceView from './DecisionWorkspaceView';
import { FaLightbulb, FaDatabase, FaBrain, FaChartBar, FaArrowRight } from 'react-icons/fa';

/**
 * DecisionPanel
 * 
 * The primary destination surface for Decision Intelligence.
 * DI 2.0 updates this to be centered around scoped decision workspaces.
 */
const DecisionPanel = ({ 
  bundle, 
  onActionClick, 
  warnings = [], 
  readiness, 
  onRunDecision,
  onOpenAiChat,
  setIsDataPaneOpen,
  workspace,
  onCreateWorkspace,
  onResetWorkspace,
  datasetContext
}) => {
  // Extracting readiness state to drive the 'Guided UI' pattern.
  const missingRequirements = readiness?.missing_requirements || [];
  
  /**
   * State A: Setup Guidance
   * Renders when the pipeline is blocked by missing prerequisites (Legacy & 2.0).
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
            <p>Decision Intelligence requires an active dataset to begin structuring your workspace.</p>
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

    return null;
  };

  // Branching Logic for Setup states.
  const setupGuidance = renderSetupGuidance();
  if (setupGuidance) return setupGuidance;

  /**
   * DI 2.0 FLOW: Scoped Workspace
   * If we have a dataset but no workspace yet, show the Composer.
   * If we have a workspace, show the Workspace View.
   */
  if (!workspace) {
    return (
      <div className="decision-panel">
        <DecisionWorkspaceComposer 
          onCreateWorkspace={onCreateWorkspace} 
          datasetContext={datasetContext}
        />
      </div>
    );
  }

  // If we have a workspace, render it.
  return (
    <div className="decision-panel">
      <DecisionWorkspaceView 
        workspace={workspace} 
        onCreateNew={onResetWorkspace}
      />
      
      {/* Optional Legacy Bundle Support: If a bundle exists, we can still show signals below the workspace */}
      {bundle && (
        <div className="decision-panel__legacy-results">
          <div className="legacy-divider">
            <span>Diagnostic Signals</span>
          </div>
          <div className="decision-panel__grid">
            <section className="decision-panel__section">
              <h3 className="decision-section-title">Evidence</h3>
              <DecisionSignals signals={bundle.signals} />
            </section>
            <section className="decision-panel__section">
              <h3 className="decision-section-title">Recommendations</h3>
              <DecisionRecommendations 
                recommendations={bundle.recommendations} 
                onActionClick={onActionClick}
              />
            </section>
          </div>
        </div>
      )}
    </div>
  );
};

export default DecisionPanel;
