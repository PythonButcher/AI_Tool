import React, { useState, useContext, useMemo, useRef } from 'react';
import axios from 'axios';
import './FileUpload.css';
import { DataContext } from '../../context/DataContext';
import { WarehouseContext } from '../../context/WarehouseContext';
import { useHelpOverlay } from '../../context/HelpOverlayContext';
import { FaCloudUploadAlt, FaSearch, FaTimes, FaCheckCircle, FaMinus, FaQuestionCircle } from 'react-icons/fa';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function FileUpload({
  label = 'Upload a File:',
  onUploadComplete,
  allowedExtensions = ['csv', 'xls', 'xlsx', 'json', 'pdf', 'geojson'],
  onFileUploadSuccess,
}) {
  const warehouseContext = useContext(WarehouseContext);
  const { datasets = [], addDataset } = warehouseContext || {};
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [governanceNotice, setGovernanceNotice] = useState(null);
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
        setGovernanceNotice(null);
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
    setGovernanceNotice(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      // Let the browser set the multipart boundary; manually setting the
      // Content-Type can make otherwise valid CSV uploads unreadable.
      const response = await axios.post(`${API_URL}/api/upload`, formData);

      if (response.data.governance_readiness?.status === 'warning') {
        const readiness = response.data.governance_readiness;
        setGovernanceNotice(`Warning: ${readiness.reasons?.[0]?.message || 'Dataset quality needs review.'} ${readiness.next_action}`);
      }

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
      const readiness = err.response?.data?.governance_readiness;
      if (err.response?.status === 422 && readiness?.status === 'blocked') {
        setError(`Upload blocked: ${readiness.reasons?.[0]?.message || 'Dataset governance checks failed.'} ${readiness.next_action}`);
      } else {
        setError(err.response?.data?.error || 'Failed to upload file');
      }
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (onUploadComplete) {
      onUploadComplete();
    } else {
      setIsPanelOpen(false);
    }
  };

  return (
    <div className="file-upload-content">
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
          Search Hub
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
                    style={{ display: 'none' }}
                  />
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => hiddenFileInput.current?.click()}
                  >
                    Browse Files
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
            {governanceNotice && <p className="upload-governance-notice">{governanceNotice}</p>}

            {file && !error && (
              <button
                className="upload-button"
                onClick={handleFileUpload}
                disabled={isUploading}
              >
                {isUploading ? 'Uploading...' : 'Complete Import'}
              </button>
            )}
          </div>
        ) : (
          <div className="tab-content search-tab">
            <div className="search-bar">
              <FaSearch className="search-icon" />
              <input
                type="text"
                placeholder="Find in data catalog..."
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

      {isHelpVisible(helpId) && (
        <div className="help-overlay visible">
          <div className="help-overlay-content">
            <span
              className="help-overlay-close"
              onClick={() => closeHelp(helpId)}
            >
              ×
            </span>
            <h3>Data Import</h3>
            <ol>
              <li>Select CSV, Excel, JSON, or PDF.</li>
              <li>Click “Complete Import” to parse the data.</li>
              <li>Preview and refine your data automatically.</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
export default FileUpload;
