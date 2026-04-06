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

const DestinationHome = ({ activeDestination, onAction }) => {
  const renderWorkspaceHome = () => (
    <div className="dest-home">
      <div className="dest-home__icon-orbit">
        <FaDatabase className="dest-home__main-icon" />
      </div>
      <h2 className="dest-home__title">Welcome to your Workspace</h2>
      <p className="dest-home__description">
        This is where your data journey begins. Start by uploading a dataset, 
        connecting to a database, or exploring your existing data hub.
      </p>
      <div className="dest-home__actions">
        <button className="dest-home__button dest-home__button--primary" onClick={() => onAction('upload')}>
          <FaPlus /> Start New Intake
        </button>
        <button className="dest-home__button" onClick={() => onAction('hub')}>
          Browse Data Hub <FaArrowRight />
        </button>
      </div>
    </div>
  );

  const renderExploreHome = () => (
    <div className="dest-home">
      <div className="dest-home__icon-orbit">
        <FaChartLine className="dest-home__main-icon" />
      </div>
      <h2 className="dest-home__title">Explore & Visualize</h2>
      <p className="dest-home__description">
        Dive deep into your fields. Create custom charts, analyze distributions, 
        and discover patterns in your data through manual exploration.
      </p>
      <div className="dest-home__actions">
        <button className="dest-home__button dest-home__button--primary" onClick={() => onAction('gallery')}>
          <FaChartBar /> Open Chart Gallery
        </button>
        <button className="dest-home__button" onClick={() => onAction('ai_chart')}>
          Try AI Charting <FaMagic />
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
        Leverage advanced intelligence to automate your analysis. Chat with your data, 
        generate complex workflows, or let AI write your business stories.
      </p>
      <div className="dest-home__actions">
        <button className="dest-home__button dest-home__button--ai" onClick={() => onAction('ai_chat')}>
          <FaRobot /> Launch AI Chat
        </button>
        <button className="dest-home__button" onClick={() => onAction('workflow_lab')}>
          Enter Workflow Lab <FaMagic />
        </button>
      </div>
      <div className="dest-home__feature-grid">
        <div className="dest-home__feature">
          <FaMagic />
          <span>NLP Charting</span>
        </div>
        <div className="dest-home__feature">
          <FaBrain />
          <span>Story Gen</span>
        </div>
        <div className="dest-home__feature">
          <FaChartLine />
          <span>Automated Reports</span>
        </div>
      </div>
    </div>
  );

  const renderDecisionsHome = () => (
    <div className="dest-home">
      <div className="dest-home__icon-orbit">
        <FaLightbulb className="dest-home__main-icon" />
      </div>
      <h2 className="dest-home__title">Decision Intelligence</h2>
      <p className="dest-home__description">
        Transform analysis into action. Monitor business signals, evaluate scenarios, 
        and receive intelligent recommendations for your next move.
      </p>
      <div className="dest-home__actions">
        <button className="dest-home__button dest-home__button--primary" onClick={() => onAction('run_intelligence')}>
          <FaLightbulb /> Run Intelligence
        </button>
        <button className="dest-home__button" onClick={() => onAction('definitions')}>
          Review Definitions <FaArrowRight />
        </button>
      </div>
    </div>
  );

  switch (activeDestination) {
    case DESTINATIONS.WORKSPACE: return renderWorkspaceHome();
    case DESTINATIONS.EXPLORE: return renderExploreHome();
    case DESTINATIONS.AI: return renderAIHome();
    case DESTINATIONS.DECISIONS: return renderDecisionsHome();
    default: return null;
  }
};

export default DestinationHome;
