import React, { useState } from 'react';
import axios from 'axios';
import './css/FileUpload.css';
import { DataContext } from '../context/DataContext';
import { useContext } from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function FileUpload({ label = "Upload a File:", onUploadComplete, allowedExtensions = ['csv', 'xls', 'xlsx', 'json', 'pdf', 'geojson'] }) {
  const { setUploadedData } = useContext(DataContext);
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

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
      <h3 className="upload-title">{label}</h3>
      <input className="file-input" type="file" onChange={handleFileChange} />
      {file && <p className="file-name">File name: {file.name}</p>}

      {/* ✅ Show button only if file is selected and there's no error */}
      {file && !error && (
        <button className="upload-button" onClick={handleFileUpload} disabled={isUploading}>
          {isUploading ? 'Uploading...' : 'Upload File'}
        </button>
      )}

      {error && <p className="error-message">{error}</p>}
    </div>
  );
}

export default FileUpload;
