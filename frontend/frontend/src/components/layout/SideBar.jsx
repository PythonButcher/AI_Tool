import React from 'react';
import {
  FaChartBar,
  FaDatabase,
  FaRobot,
  FaTachometerAlt,
  FaProjectDiagram,
} from 'react-icons/fa';
import './SideBar.css';

const DESTINATIONS = {
  WORKSPACE: 'workspace',
  DATA_MODEL: 'data_model',
  EXPLORE: 'explore',
  DASHBOARDS: 'dashboards',
  AI: 'ai',
};

const navigationItems = [
  { id: DESTINATIONS.WORKSPACE, label: 'Workspace', icon: <FaDatabase /> },
  { id: DESTINATIONS.DATA_MODEL, label: 'Data Model', icon: <FaProjectDiagram /> },
  { id: DESTINATIONS.EXPLORE, label: 'Explore', icon: <FaChartBar /> },
  { id: DESTINATIONS.DASHBOARDS, label: 'Dashboards', icon: <FaTachometerAlt /> },
];

/**
 * SideBar (Optimized)
 * 
 * Consistently narrow navigation rail.
 * Secondary destination actions have been relocated to the top ribbon.
 */
function SideBar({
  activeDestination,
  onDestinationSelect,
}) {
  return (
    <aside className="workflow-shell">
      <div className="workflow-rail" aria-label="Global navigation">
        <div className="workflow-rail__top">
          {navigationItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`workflow-rail__button ${activeDestination === item.id ? 'is-active' : ''}`}
              onClick={() => onDestinationSelect(item.id)}
              aria-pressed={activeDestination === item.id}
              title={item.label}
            >
              <span className="workflow-rail__icon" aria-hidden="true">{item.icon}</span>
              <span className="workflow-rail__label">{item.label}</span>
            </button>
          ))}
        </div>
        <div className="workflow-rail__bottom">
          <button
            type="button"
            className={`workflow-rail__button ${activeDestination === DESTINATIONS.AI ? 'is-active' : ''}`}
            onClick={() => onDestinationSelect(DESTINATIONS.AI)}
            aria-pressed={activeDestination === DESTINATIONS.AI}
            title="AI Suite"
          >
            <span className="workflow-rail__icon" aria-hidden="true"><FaRobot /></span>
            <span className="workflow-rail__label">AI Suite</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

export default SideBar;
