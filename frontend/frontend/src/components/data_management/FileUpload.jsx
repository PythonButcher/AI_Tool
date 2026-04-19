import React, { useState, useContext, useMemo, useRef } from 'react';
import axios from 'axios';
import './FileUpload.css';
import { DataContext } from '../../context/DataContext';
import { WarehouseContext } from '../../context/WarehouseContext';
import { useHelpOverlay } from '../../context/HelpOverlayContext';
import { FaCloudUploadAlt, FaSearch, FaTimes, FaCheckCircle } from 'react-icons/fa';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function FileUpload({
  label = 'Upload a File:',
  onUploadComplete,
  allowedExtensions = ['csv', 'xls', 'xlsx', 'json', 'pdf', 'geojson'],
  onFileUploadSuccess,
}) {
  const { setUploadedData } = useContext(DataContext);
  const warehouseContext = useContext(WarehouseContext);
  const { datasets = [], addDataset } = warehouseContext || {};
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('upload');
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { isHelpVisible, toggleHelp, closeHelp } = useHelpOverlay();
  const helpId = 'fileUpload';
  const hiddenFileInput = useRef(null);

  const filteredDatasets = useMemo(() => {
    const source = datasets && datasets.length
      ? datasets
      : [
          { id: 'mock-1', name: 'Sales Pipeline 2024', path: '/data/mock/sales_pipeline.csv' },
          { id: 'mock-2', name: 'Customer Feedback NLP', path: '/data/mock/feedback.json' },
          { id: 'mock-3', name: 'Geospatial Coverage', path: '/data/mock/coverage.geojson' },
        ];
    return source.filter((ds) =>
      ds.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [datasets, searchTerm]);

  const validateAndSetFile = (selectedFile) => {
    if (selectedFile) {
      const fileExtension = selectedFile.name.split('.').pop().toLowerCase();
      if (allowedExtensions.includes(fileExtension)) {
        setFile(selectedFile);
        setError(null);
      } else {
        setFile(null);
        setError('Invalid file type. Allowed types: ' + allowedExtensions.join(', '));
      }
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    validateAndSetFile(selectedFile);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const droppedFile = e.dataTransfer.files?.[0];
    validateAndSetFile(droppedFile);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleFileUpload = async () => {
    if (!file) {
      setError('Please select a file to upload');
      return;
    }

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API_URL}/api/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setUploadedData(response.data);
      if (onFileUploadSuccess) {
        onFileUploadSuccess(response.data, file);
      }
      if (addDataset && response?.data) {
        const datasetName = file.name.replace(/\.[^.]+$/, '');
        addDataset({
          id: response.data.id || response.data.path || datasetName,
          name: datasetName,
          path: response.data.path || response.data.filepath || datasetName,
        });
      }
      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (err) {
      setError('Failed to upload file');
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="file-upload-shell">
      <button
        type="button"
        className="open-panel-button"
        onClick={() => setIsPanelOpen((prev) => !prev)}
      >
        <FaCloudUploadAlt className="open-panel-icon" />
        {isPanelOpen ? 'Minimize' : 'Import'}
      </button>

      {isPanelOpen && (
        <div className="file-upload-panel">
          <div className="panel-header">
            <div className="panel-title">
              <div>
                <p className="panel-eyebrow">Source</p>
                <h3>{label}</h3>
              </div>
            </div>
            <div className="panel-actions">
              <button
                type="button"
                className="help-overlay-trigger"
                aria-label="Toggle help"
                onClick={() => toggleHelp(helpId)}
              >
                ?
              </button>
              <button
                type="button"
                className="close-panel"
                onClick={() => setIsPanelOpen(false)}
                aria-label="Close"
              >
                <FaTimes />
              </button>
            </div>
          </div>

          <div className="panel-body">
            <div className="tabs">
              <button
                className={`tab ${activeTab === 'upload' ? 'active' : ''}`}
                onClick={() => setActiveTab('upload')}
              >
                Upload
              </button>
              <button
                className={`tab ${activeTab === 'search' ? 'active' : ''}`}
                onClick={() => setActiveTab('search')}
              >
                Search
              </button>
            </div>

            <div className="tab-panels">
              {activeTab === 'upload' ? (
                <div className="tab-content upload-tab">
                  <div
                    className={`drop-zone ${dragActive ? 'drag-active' : ''}`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                  >
                    <div className="drop-inner">
                      <FaCloudUploadAlt className="drop-icon" />
                      <div className="drop-copy">
                        <p className="drop-title">Drop file here</p>
                        <p className="drop-subtitle">{allowedExtensions.join(', ')}</p>
                      </div>
                      <div className="drop-actions">
                        <input
                          ref={hiddenFileInput}
                          className="file-input"
                          type="file"
                          onChange={handleFileChange}
                        />
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => hiddenFileInput.current?.click()}
                        >
                          Browse
                        </button>
                        {file && (
                          <span className="file-chip">
                            <FaCheckCircle className="file-chip-icon" />
                            {file.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {error && <p className="error-message">{error}</p>}

                  {file && !error && (
                    <button
                      className="upload-button"
                      onClick={handleFileUpload}
                      disabled={isUploading}
                    >
                      {isUploading ? 'Uploading...' : 'Upload'}
                    </button>
                  )}
                </div>
              ) : (
                <div className="tab-content search-tab">
                  <div className="search-bar">
                    <FaSearch className="search-icon" />
                    <input
                      type="text"
                      placeholder="Search Hub"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="dataset-list">
                    {filteredDatasets.map((ds) => (
                      <div key={ds.id} className="dataset-card">
                        <div>
                          <p className="dataset-name">{ds.name}</p>
                          <p className="dataset-path">{ds.path}</p>
                        </div>
                        <button className="ghost-button">Open</button>
                      </div>
                    ))}
                    {filteredDatasets.length === 0 && (
                      <p className="empty-state">No datasets match your search.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {isHelpVisible(helpId) && (
            <div className="help-overlay visible">
              <div className="help-overlay-content">
                <span
                  className="help-overlay-close"
                  onClick={() => closeHelp(helpId)}
                >
                  ×
                </span>
                <h3>How File Upload Works</h3>
                <ol>
                  <li>Select a supported file: CSV, Excel, JSON, or PDF.</li>
                  <li>Click “Upload File” to send it to the backend for parsing.</li>
                  <li>Once uploaded, the data preview and cleaning tools appear automatically.</li>
                </ol>
                <p>Tip: Large files may take longer, and unsupported formats will show an error message.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
export default FileUpload;
