import React, { useState, useRef, useEffect, useContext, useMemo } from 'react';
import './css/MenuBar.css';
import axios from 'axios';
import FileUpload from './FileUpload';
import ApiDataForm from './APiDataForm';
import DatabaseConnectForm from './database_components/DatabaseConnectForm';
import DragDrop from '../utils/DragDrop';
import { FaUpload, FaChartBar, FaServer, FaDatabase, FaRedoAlt, FaFilter } from 'react-icons/fa';
import { DataContext } from '../context/DataContext';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function MenuBar({ onStatsSelect, handleApiData, handleDatabaseData, setOpenDataFilter}) {
  const [activeDropdown, setActiveDropdown] = useState(null);
  const { setUploadedData } = useContext(DataContext);

  const uploadRef = useRef(null);
  const statsRef = useRef(null);
  const apiRef = useRef(null);
  const dbRef = useRef(null);

  const dropdownRefs = useMemo(() => ({
    upload: uploadRef,
    stats: statsRef,
    api: apiRef,
    db: dbRef
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
              <FileUpload label="Select a File to Upload:" onUploadComplete={() => setActiveDropdown(null)} />
              <DragDrop onFilesSelected={handleFileUpload} width="100%" height="200px" />
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
    </div>
  );
}

export default MenuBar;
