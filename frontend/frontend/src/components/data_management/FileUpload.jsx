import React, { useState, useContext, useEffect, useRef } from 'react';
import axios from 'axios';
import './FileUpload.css';
import { WarehouseContext } from '../../context/WarehouseContext';
import { useHelpOverlay } from '../../context/HelpOverlayContext';
import { FaCloudUploadAlt, FaCheckCircle } from 'react-icons/fa';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function FileUpload({
  onUploadComplete,
  allowedExtensions = ['csv', 'xls', 'xlsx', 'json', 'pdf', 'geojson'],
  onFileUploadSuccess,
  onOpenDataHub,
}) {
  const warehouseContext = useContext(WarehouseContext);
  const { addDataset } = warehouseContext || {};
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [governanceNotice, setGovernanceNotice] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const { isHelpVisible, closeHelp } = useHelpOverlay();
  const helpId = 'fileUpload';
  const hiddenFileInput = useRef(null);
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

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
          id: response.data.source?.source_id || response.data.id || response.data.path || datasetName,
          name: response.data.source?.name || datasetName,
          path: response.data.path || response.data.filepath || datasetName,
        });
      }
      // A completed upload still attaches its data if the user moved on.
      // Only the original import view should close the current panel.
      if (onUploadComplete && isMounted.current) {
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

  return (
    <div className="file-upload-content">
      <div className="tab-panels">
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
      </div>
      {onOpenDataHub && (
        <button type="button" className="ghost-button" onClick={onOpenDataHub} disabled={isUploading}>
          Browse saved datasets
        </button>
      )}

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
