import React, { useState, useRef, useEffect, useContext, useMemo } from 'react';
import './MenuBar.css';
import FileUpload from '../data_management/FileUpload';
import ApiDataForm from '../../features/api/APiDataForm';
import DatabaseConnectForm from '../../features/database/DatabaseConnectForm';
import DataHubWindow from '../../features/database/DataHubWindow';
import {
  FaUpload,
  FaChartBar,
  FaServer,
  FaDatabase,
  FaRedoAlt,
  FaFilter,
  FaFileAlt,
  FaSun,
  FaMoon,
  FaTachometerAlt,
} from 'react-icons/fa';
import { TbCloudDataConnection } from 'react-icons/tb';
import { ThemeContext } from '../../context/ThemeContext';

function MenuBar({
  onFileUploadSuccess,
  onStatsSelect,
  handleApiData,
  handleDatabaseData,
  setOpenDataFilter,
  aiReportReady,
  onAiReportClick,
  onSnowToggle,
  isSnowing,
  onDashboardToggle,
  isDashboardVisible,
}) {
  const [activeDropdown, setActiveDropdown] = useState(null);
  const { theme, toggleTheme } = useContext(ThemeContext);

  const uploadRef = useRef(null);
  const statsRef = useRef(null);
  const apiRef = useRef(null);
  const dbRef = useRef(null);
  const dbHubRef = useRef(null);
  const themeRef = useRef(null);

  const dropdownRefs = useMemo(() => ({
    upload: uploadRef,
    stats: statsRef,
    api: apiRef,
    db: dbRef,
    hub: dbHubRef,
    theme: themeRef,
  }), []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      const isOutside = Object.values(dropdownRefs).every(
        (ref) => ref.current && !ref.current.contains(event.target)
      );
      if (isOutside) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownRefs]);

  const handleReset = () => window.location.reload();

  return (
    <div className="menu-bar">
      <div className="menu-title">AI Data Visualization Tool</div>

      <div className="menu-actions">
        <div className="menu-bar-left">
          <div className="menu-button-container" ref={uploadRef}>
            <button
              className="menu-button"
              onClick={() => setActiveDropdown((prev) => prev === 'upload' ? null : 'upload')}
            >
              <FaUpload className="menu-icon" />
              Upload File
            </button>
            {activeDropdown === 'upload' && (
              <div className="menu-dropdown">
                <FileUpload
                  label="Select a File to Upload:"
                  onUploadComplete={() => setActiveDropdown(null)}
                  onFileUploadSuccess={onFileUploadSuccess}
                />
              </div>
            )}
          </div>

          <div className="menu-button-container" ref={dbHubRef}>
            <button
              className="menu-button"
              onClick={() => setActiveDropdown((prev) => prev === 'open' ? null : 'open')}
            >
              <TbCloudDataConnection className="menu-icon" />
              Open Hub
            </button>
            {activeDropdown === 'open' && (
              <div className="menu-dropdown">
                <DataHubWindow />
              </div>
            )}
          </div>

          <div className="menu-button-container" ref={apiRef}>
            <button
              className="menu-button"
              onClick={() => setActiveDropdown((prev) => prev === 'api' ? null : 'api')}
            >
              <FaServer className="menu-icon" />
              Connect API
            </button>
            {activeDropdown === 'api' && (
              <div className="menu-dropdown">
                <ApiDataForm handleApiData={handleApiData} />
              </div>
            )}
          </div>

          <div className="menu-button-container" ref={dbRef}>
            <button
              className="menu-button"
              onClick={() => setActiveDropdown((prev) => prev === 'db' ? null : 'db')}
            >
              <FaDatabase className="menu-icon" />
              Connect DB
            </button>
            {activeDropdown === 'db' && (
              <div className="menu-dropdown">
                <DatabaseConnectForm
                  handleDatabaseData={handleDatabaseData}
                  onClose={() => setActiveDropdown(null)}
                />
              </div>
            )}
          </div>
        </div>

        <div className="menu-bar-right">
          <div className="menu-button-container" ref={statsRef}>
            <button
              className="menu-icon-btn"
              title="Statistics"
              onClick={() => setActiveDropdown((prev) => prev === 'stats' ? null : 'stats')}
            >
              <FaChartBar />
            </button>
            {activeDropdown === 'stats' && (
              <div className="menu-dropdown">
                <div className="dropdown-content">
                  <button onClick={() => onStatsSelect('mean')}>Mean</button>
                  <button onClick={() => onStatsSelect('median')}>Median</button>
                  <button onClick={() => onStatsSelect('mode')}>Mode</button>
                </div>
              </div>
            )}
          </div>

          <button
            className={`menu-icon-btn ${isDashboardVisible ? 'menu-icon-btn-active' : ''}`}
            title={isDashboardVisible ? 'Hide Business Dashboard' : 'Open Business Dashboard'}
            onClick={onDashboardToggle}
          >
            <FaTachometerAlt />
          </button>

          {aiReportReady && (
            <div className="ai-report-notification">
              <button
                className="menu-icon-btn ai-report-icon"
                title="AI Report Ready"
                onClick={onAiReportClick}
              >
                <FaFileAlt />
              </button>
              <div className="ai-report-popup">AI Report is ready</div>
            </div>
          )}

          <button
            className="menu-icon-btn"
            title="Reset Application"
            onClick={handleReset}
          >
            <FaRedoAlt />
          </button>

          <button
            className="menu-icon-btn"
            title="Open Filter Panel"
            onClick={() => setOpenDataFilter(true)}
          >
            <FaFilter />
          </button>

          <button
            className="menu-icon-btn theme-toggle-btn"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            onClick={toggleTheme}
            ref={themeRef}
          >
            {theme === 'dark' ? <FaSun /> : <FaMoon />}
          </button>

          {theme === 'dark' && (
            <button
              className={`menu-icon-btn ${isSnowing ? 'active' : ''}`}
              title="Let it snow!"
              onClick={onSnowToggle}
            >
              ❄️
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default MenuBar;
