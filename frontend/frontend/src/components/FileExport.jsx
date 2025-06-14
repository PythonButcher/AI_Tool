import React from 'react';
import axios from 'axios';
import './css/FileExport.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function FileExport() {
  const handleExport = async (format) => {
    try {
      // Perform API call to export endpoint
      const response = await axios.get(`${API_URL}/api/export`, {
        params: { format },
        responseType: 'blob', // Required for downloading binary files
      });

      // Validate response data
      if (!response || !response.data) {
        throw new Error("No data received from export endpoint.");
      }

      // Create a blob and download link for the file
      const blob = new Blob([response.data], { type: response.headers['content-type'] });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `cleaned_data_${new Date().toISOString().split('T')[0]}.${format}`
      ); // Dynamic file name with date
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Export error:", error);
      alert("Failed to export cleaned data. Please try again.");
    }
  };

  return (
    <div className="ExportClass">
      <button onClick={() => handleExport('csv')}>Export as CSV</button>
      <button onClick={() => handleExport('excel')}>Export as Excel</button>
      <button onClick={() => handleExport('pdf')}>Export as PDF</button>
    </div>
  );
}

export default FileExport;
