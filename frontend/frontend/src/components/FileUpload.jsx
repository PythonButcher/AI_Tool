import React, { useState } from 'react';
import axios from 'axios';
import './css/FileUpload.css';
import { DataContext } from '../context/DataContext';
import { useContext } from 'react';
import { useHelpOverlay } from '../context/HelpOverlayContext';


const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function FileUpload({ label = "Upload a File:", onUploadComplete, allowedExtensions = ['csv', 'xls', 'xlsx', 'json', 'pdf', 'geojson'], onFileUploadSuccess }) {
  const { setUploadedData } = useContext(DataContext);
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const { isHelpVisible, toggleHelp, closeHelp } = useHelpOverlay();
  const helpId = 'fileUpload';


  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const fileExtension = selectedFile.name.split('.').pop().toLowerCase();
      if (allowedExtensions.includes(fileExtension)) {
        setFile(selectedFile);
        setError(null);
      } else {
        setFile(null);
        setError("Invalid file type. Allowed types: " + allowedExtensions.join(", "));
      }
    }
  };

  const handleFileUpload = async () => {
    if (!file) {
      setError("Please select a file to upload");
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
      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (error) {
      setError("Failed to upload file");
      console.error("Upload error:", error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
  <div className="file-upload-container">
    <div className="help-inline-header">
      <h3 className="upload-title">{label}</h3>
      <div className="help-inline-spacer" />
      <button
        type="button"
        className="help-overlay-trigger"
        onClick={() => toggleHelp('fileUpload')}
      >
        Help
      </button>
    </div>

    <input className="file-input" type="file" onChange={handleFileChange} />
    {file && <p className="file-name">File name: {file.name}</p>}

    {/* ✅ Show button only if file is selected and there's no error */}
    {file && !error && (
      <button className="upload-button" onClick={handleFileUpload} disabled={isUploading}>
        {isUploading ? 'Uploading...' : 'Upload File'}
      </button>
    )}

    {error && <p className="error-message">{error}</p>}

    {/* ✅ Help Overlay */}
    {isHelpVisible('fileUpload') && (
      <div className="help-overlay visible">
        <div className="help-overlay-content">
          <span
            className="help-overlay-close"
            onClick={() => closeHelp('fileUpload')}
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
);
}
export default FileUpload;
