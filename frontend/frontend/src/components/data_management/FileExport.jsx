import React, { useContext } from 'react';
import axios from 'axios';
import { DataContext, useActiveDataset } from '../../context/DataContext';
import { useWindowContext } from '../../context/WindowContext';
import { generateAnalyticalPdfReport } from '../../utils/pdfReportExport';
import './FileExport.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function FileExport() {
  const activeDataset = useActiveDataset();
  const { pipelineResults } = useContext(DataContext);
  const { getWindowContentState } = useWindowContext();

  const handleExportPDF = () => {
    generateAnalyticalPdfReport({
      datasetRows: activeDataset || [],
      storyState: getWindowContentState('storyPanel'),
      pipelineResults,
    });
  };

  const handleExport = async (format) => {
    if (format === 'pdf') {
      handleExportPDF();
      return;
    }

    try {
      const response = await axios.get(`${API_URL}/api/export`, {
        params: { format },
        responseType: 'blob',
      });

      if (!response || !response.data) {
        throw new Error('No data received from export endpoint.');
      }

      const blob = new Blob([response.data], { type: response.headers['content-type'] });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `cleaned_data_${new Date().toISOString().split('T')[0]}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export cleaned data. Please try again.');
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
