import React, { useState, useRef, useEffect, useContext, useMemo } from 'react';
import './MenuBar.css';
import axios from 'axios';
import FileUpload from '../data_management/FileUpload';
import ApiDataForm from '../../features/api/APiDataForm';
import DatabaseConnectForm from '../../features/database/DatabaseConnectForm';
import DataHubWindow from '../../features/database/DataHubWindow';
import { FaUpload, FaChartBar, FaServer, FaDatabase, FaRedoAlt, FaFilter, FaFileAlt, FaSun, FaMoon, FaSpaceShuttle } from 'react-icons/fa';
import { TbCloudDataConnection } from "react-icons/tb";
import { DataContext } from '../../context/DataContext';
import { ThemeContext } from '../../context/ThemeContext';


const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function MenuBar({ onFileUploadSuccess, onStatsSelect,
  handleApiData, handleDatabaseData, setOpenDataFilter,
  aiReportReady, onAiReportClick }) {
  const [activeDropdown, setActiveDropdown] = useState(null);
  const { setUploadedData } = useContext(DataContext);
  const { theme, setTheme } = useContext(ThemeContext);

  const uploadRef = useRef(null);
  const statsRef = useRef(null);
  const apiRef = useRef(null);
  const dbRef = useRef(null);
  const dbHubRef = useRef(null);
  const themeRef = useRef(null)

  const dropdownRefs = useMemo(() => ({
    upload: uploadRef,
    stats: statsRef,
    api: apiRef,
    db: dbRef,
    hub: dbHubRef,
    theme: themeRef
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

  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) {
      alert('No file selected. Please upload a valid file.');
      return;
    }

    const file = files[0];
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API_URL}/api/upload`, formData);
      console.log('Backend response:', response.data);
      setUploadedData(response.data);
      if (onFileUploadSuccess) {
        onFileUploadSuccess(response.data);
      }
      setActiveDropdown(null);
    } catch (error) {
      console.error('File upload error:', error);
      alert(`Failed to upload file: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleReset = () => window.location.reload();

  return (
    <div className="menu-bar">
      <div className="menu-title">AI Data Visualization Tool</div>

      <div className="menu-actions">
        {/* ───── LEFT SECTION: Primary Button Clusters ───── */}
        <div className="menu-bar-left">
          {/* Upload File Dropdown */}
          <div className="menu-button-container" ref={uploadRef}>
            <button
              className="menu-button"
              onClick={() => setActiveDropdown(prev => prev === 'upload' ? null : 'upload')}
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

          {/* Datahub Button */}
          <div className="menu-button-container" ref={dbHubRef}>
            <button
              className="menu-button"
              onClick={() => setActiveDropdown(prev => prev === 'open' ? null : 'open')}
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

          {/* API Dropdown */}
          <div className="menu-button-container" ref={apiRef}>
            <button
              className="menu-button"
              onClick={() => setActiveDropdown(prev => prev === 'api' ? null : 'api')}
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

          {/* Database Dropdown */}
          <div className="menu-button-container" ref={dbRef}>
            <button
              className="menu-button"
              onClick={() => setActiveDropdown(prev => prev === 'db' ? null : 'db')}
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

        {/* ───── RIGHT SECTION: Icon-Only Tools ───── */}
        <div className="menu-bar-right">
          {/* Stats Icon with Dropdown */}
          <div className="menu-button-container" ref={statsRef}>
            <button
              className="menu-icon-btn"
              title="Statistics"
              onClick={() => setActiveDropdown(prev => prev === 'stats' ? null : 'stats')}
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

          {/* Reset App */}
          <button
            className="menu-icon-btn"
            title="Reset Application"
            onClick={handleReset}
          >
            <FaRedoAlt />
          </button>

          {/* Filter Slicer Trigger */}
          <button
            className="menu-icon-btn"
            title="Open Filter Panel"
            onClick={() => setOpenDataFilter(true)}
          >
            <FaFilter />
          </button>

          <div className="menu-button-container" ref={themeRef}>
            <button
              className="menu-icon-btn theme-toggle-btn"
              title="Change Theme"
              onClick={() => setActiveDropdown(prev => prev === 'theme' ? null : 'theme')}
            >
              {theme === 'startrek' ? <FaSpaceShuttle /> : theme === 'dark' ? <FaMoon /> : <FaSun />}
            </button>
            {activeDropdown === 'theme' && (
              <div className="menu-dropdown right-aligned">
                <div className="dropdown-content">
                  <button onClick={() => { setTheme('light'); setActiveDropdown(null); }}>
                    <FaSun style={{ marginRight: '8px' }} /> Light Mode
                  </button>
                  <button onClick={() => { setTheme('dark'); setActiveDropdown(null); }}>
                    <FaMoon style={{ marginRight: '8px' }} /> Dark Mode
                  </button>
                  <button onClick={() => { setTheme('startrek'); setActiveDropdown(null); }}>
                    <FaSpaceShuttle style={{ marginRight: '8px' }} /> Star Trek
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MenuBar;
