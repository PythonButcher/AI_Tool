import React from 'react';
import { 
  FaRobot, FaChartLine, FaTachometerAlt, FaLightbulb, FaDatabase,
  FaPlus, FaArrowRight, FaMagic, FaChartBar, FaBrain
} from 'react-icons/fa';
import './DestinationHome.css';

const DESTINATIONS = {
  WORKSPACE: 'workspace',
  EXPLORE: 'explore',
  DASHBOARDS: 'dashboards',
  DECISIONS: 'decisions',
  AI: 'ai',
};

/**
 * DestinationHome
 * 
 * The landing surface for each primary destination (Workspace, Explore, AI, etc.)
 * when no windows are active. 
 * 
 * Phase 4 Enhancement: Proactive Disclosure
 * This component now checks the 'readiness' state of Decision Intelligence.
 * If data is prepared, it shows a 'Bridge' CTA even when the user is in 
 * Workspace or Dashboards, encouraging cross-destination value discovery.
 * 
 * @param {string} activeDestination - The current active rail destination.
 * @param {Function} onAction - Global action dispatcher for destination-level events.
 * @param {Object} readiness - Decision Intelligence readiness metadata.
 */
const DestinationHome = ({ activeDestination, onAction, readiness }) => {
  // Logic to determine if Decision Intelligence is 'Latent' (Ready but not yet run).
  const missingRequirements = readiness?.missing_requirements || [];
  const isDecisionReady = readiness?.decision_ready && missingRequirements.length === 0;

  /**
   * Renders the Workspace home.
   * Proactively nudges toward Decisions if data is loaded and ready.
   */
  const renderWorkspaceHome = () => (
    <div className="dest-home">
      <div className="dest-home__icon-orbit">
        <FaDatabase className="dest-home__main-icon" />
      </div>
      <h2 className="dest-home__title">Welcome to your Workspace</h2>
      <p className="dest-home__description">
        Manage your data lifecycle. Upload new datasets, connect to live sources, 
        or refine your existing data hub.
      </p>
      <div className="dest-home__actions">
        <button className="dest-home__button dest-home__button--primary" onClick={() => onAction('upload')}>
          <FaPlus /> Upload
        </button>
        <button className="dest-home__button" onClick={() => onAction('hub')}>
          Data Hub <FaArrowRight />
        </button>
      </div>

      {/* Decision Bridge: Proactive Disclosure when setup is complete */}
      {isDecisionReady && (
        <div className="dest-home__bridge">
          <FaLightbulb />
          <span>Your data is prepared for <strong>Decision Intelligence</strong>.</span>
          <button onClick={() => onAction('run_intelligence')}>Analyze</button>
        </div>
      )}
    </div>
  );

  const renderExploreHome = () => (
    <div className="dest-home">
      <div className="dest-home__icon-orbit">
        <FaChartLine className="dest-home__main-icon" />
      </div>
      <h2 className="dest-home__title">Explore & Visualize</h2>
      <p className="dest-home__description">
        Dive deep into your fields. Discover patterns, analyze distributions, 
        and build custom charts through manual exploration.
      </p>
      <div className="dest-home__actions">
        <button className="dest-home__button dest-home__button--primary" onClick={() => onAction('gallery')}>
          <FaChartBar /> Gallery
        </button>
        <button className="dest-home__button" onClick={() => onAction('ai_chart')}>
          AI Chart <FaMagic />
        </button>
      </div>
    </div>
  );

  const renderAIHome = () => (
    <div className="dest-home dest-home--ai">
      <div className="dest-home__icon-orbit">
        <FaRobot className="dest-home__main-icon" />
      </div>
      <h2 className="dest-home__title">AI Analysis Suite</h2>
      <p className="dest-home__description">
        Grounded Intelligence. Chat with your data,
        generate complex workflows, or automate your business reporting.
      </p>
      <div className="dest-home__actions">
        <button className="dest-home__button dest-home__button--ai" onClick={() => onAction('ai_chat')}>
          <FaRobot /> Chat
        </button>
        <button className="dest-home__button" onClick={() => onAction('workflow_lab')}>
          Workflows <FaMagic />
        </button>
      </div>
    </div>
  );

  /**
   * Renders the Decisions home.
   * Uses 'Guided Setup' logic to provide concrete next steps instead of empty states.
   */
  const renderDecisionsHome = () => {
    // Branching based on missing prerequisites.
    if (missingRequirements.includes('dataset')) {
      return (
        <div className="dest-home">
          <div className="dest-home__icon-orbit">
            <FaDatabase className="dest-home__main-icon" />
          </div>
          <h2 className="dest-home__title">Connect Data to Begin</h2>
          <p className="dest-home__description">
            Decision Intelligence needs a dataset to evaluate signals and scenarios. 
            Connect your first source to enable this destination.
          </p>
          <div className="dest-home__actions">
            <button className="dest-home__button dest-home__button--primary" onClick={() => onAction('upload')}>
              <FaPlus /> Upload
            </button>
          </div>
        </div>
      );
    }

    if (missingRequirements.includes('semantic_model') || missingRequirements.includes('metrics')) {
      return (
        <div className="dest-home">
          <div className="dest-home__icon-orbit">
            <FaBrain className="dest-home__main-icon" />
          </div>
          <h2 className="dest-home__title">Define Your Metrics</h2>
          <p className="dest-home__description">
            We found your data, but we need to understand your business goals. 
            Define your semantic metrics to begin generating recommendations.
          </p>
          <div className="dest-home__actions">
            <button className="dest-home__button dest-home__button--primary" onClick={() => onAction('definitions')}>
              Definitions <FaArrowRight />
            </button>
          </div>
        </div>
      );
    }

    // Ready state: Final nudge before execution.
    return (
      <div className="dest-home">
        <div className="dest-home__icon-orbit dest-home__icon-orbit--ready">
          <FaLightbulb className="dest-home__main-icon" />
        </div>
        <h2 className="dest-home__title">Intelligence is Ready</h2>
        <p className="dest-home__description">
          All setup requirements are met. Run the engine to evaluate signals, 
          receive recommendations, and preview potential business outcomes.
        </p>
        <div className="dest-home__actions">
          <button className="dest-home__button dest-home__button--primary" onClick={() => onAction('run_intelligence')}>
            <FaLightbulb /> Analyze
          </button>
        </div>
      </div>
    );
  };

  /**
   * Renders the Dashboards home.
   * Proactively nudges toward Decisions if deeper analysis is ready.
   */
  const renderDashboardsHome = () => (
    <div className="dest-home">
      <div className="dest-home__icon-orbit">
        <FaTachometerAlt className="dest-home__main-icon" />
      </div>
      <h2 className="dest-home__title">Business Monitoring</h2>
      <p className="dest-home__description">
        Track your high-level business health. Create KPI cards, 
        monitor trends, and build custom operation views.
      </p>
      <div className="dest-home__actions">
        <button className="dest-home__button dest-home__button--primary" onClick={() => onAction('new_kpi')}>
          <FaPlus /> KPI
        </button>
        <button className="dest-home__button" onClick={() => onAction('new_chart')}>
          Chart <FaArrowRight />
        </button>
      </div>

      {isDecisionReady && (
        <div className="dest-home__bridge">
          <FaBrain />
          <span>Setup complete. <strong>Decision Intelligence</strong> can now analyze these metrics.</span>
          <button onClick={() => onAction('go_to_decisions')}>Decisions</button>
        </div>
      )}
    </div>
  );


  switch (activeDestination) {
    case DESTINATIONS.WORKSPACE: return renderWorkspaceHome();
    case DESTINATIONS.EXPLORE: return renderExploreHome();
    case DESTINATIONS.AI: return renderAIHome();
    case DESTINATIONS.DECISIONS: return renderDecisionsHome();
    case DESTINATIONS.DASHBOARDS: return renderDashboardsHome();
    default: return null;
  }
};

export default DestinationHome;
