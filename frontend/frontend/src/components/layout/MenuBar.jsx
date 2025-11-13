import React, { useState, useRef, useEffect, useContext, useMemo } from 'react';
import './MenuBar.css';
import axios from 'axios';
import FileUpload from '../data_management/FileUpload';
import ApiDataForm from '../../api/APiDataForm';
import DatabaseConnectForm from '../../database/DatabaseConnectForm';
import DragDrop from '../../utils/DragDrop';
import DataHubWindow from '../../database/DataHubWindow';
import { FaUpload, FaChartBar, FaServer, FaDatabase, FaRedoAlt, FaFilter, FaFileAlt, FaSun, FaMoon } from 'react-icons/fa';
import { TbCloudDataConnection } from "react-icons/tb";
import { DataContext } from '../../context/DataContext';
import { ThemeContext } from '../../context/ThemeContext';


const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function MenuBar({ onFileUploadSuccess,  onStatsSelect, 
                  handleApiData, handleDatabaseData, setOpenDataFilter, 
                  aiReportReady, onAiReportClick }) {
  const [activeDropdown, setActiveDropdown] = useState(null);
  const { setUploadedData } = useContext(DataContext);
  const { theme, toggleTheme } = useContext(ThemeContext);

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
              <DragDrop onFilesSelected={handleFileUpload} width="100%" height="200px" />
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
              <DataHubWindow  />
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
          <FaChartBar
            className="menu-icon-only"
            title="Statistics"
            onClick={() => setActiveDropdown(prev => prev === 'stats' ? null : 'stats')}
          />
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
            <FaFileAlt
              className="menu-icon-only ai-report-icon"
              title="AI Report Ready"
              onClick={onAiReportClick}
            />
            <div className="ai-report-popup">AI Report is ready</div>
          </div>
        )}

        {/* Reset App */}
        <FaRedoAlt
          className="menu-icon-only"
          title="Reset Application"
          onClick={handleReset}
        />

        {/* Filter Slicer Trigger */}
        <FaFilter
          className="menu-icon-only"
          title="Open Filter Panel"
          onClick={() => setOpenDataFilter(true)}  // placeholder
        />
      </div>
      <button
        className="menu-icon-only theme-toggle-btn"
        title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        onClick={toggleTheme}
      >
        {theme === 'dark' ? <FaSun /> : <FaMoon />}
  </button>
    </div>
  );
}

export default MenuBar;
