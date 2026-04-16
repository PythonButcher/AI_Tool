import React from 'react';
import {
  FaBrain,
  FaChartBar,
  FaDatabase,
  FaRobot,
  FaTachometerAlt,
} from 'react-icons/fa';
import './SideBar.css';

const DESTINATIONS = {
  WORKSPACE: 'workspace',
  EXPLORE: 'explore',
  DASHBOARDS: 'dashboards',
  DECISIONS: 'decisions',
  AI: 'ai',
};

const navigationItems = [
  { id: DESTINATIONS.WORKSPACE, label: 'Workspace', icon: <FaDatabase /> },
  { id: DESTINATIONS.EXPLORE, label: 'Explore', icon: <FaChartBar /> },
  { id: DESTINATIONS.DASHBOARDS, label: 'Dashboards', icon: <FaTachometerAlt /> },
  { id: DESTINATIONS.DECISIONS, label: 'Decisions', icon: <FaBrain /> },
  { id: DESTINATIONS.AI, label: 'AI', icon: <FaRobot /> },
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
      </div>
    </aside>
  );
}

export default SideBar;
