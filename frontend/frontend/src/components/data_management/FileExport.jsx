import React, { useContext } from 'react';
import axios from 'axios';
import { FaFileCsv, FaFileExcel, FaFilePdf } from 'react-icons/fa';
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
      try {
        const response = await axios.get(`${API_URL}/api/export`, {
          params: { format: 'csv' },
          responseType: 'blob',
        });
        const govStatus = response.headers['x-dataset-governance-status'];
        const govAction = response.headers['x-dataset-governance-next-action'];

        if (govStatus === 'blocked') {
          alert(`Export Blocked (${govAction}): The dataset failed governance checks.`);
          return;
        }
        if (govStatus === 'warning') {
          alert(`Export Warning (${govAction}): The dataset has governance warnings.`);
        }
        handleExportPDF();
        return;
      } catch (error) {
        await handleExportError(error);
        return;
      }
    }

    try {
      const response = await axios.get(`${API_URL}/api/export`, {
        params: { format },
        responseType: 'blob',
      });

      if (!response || !response.data) {
        throw new Error('No data received from export endpoint.');
      }

      const govStatus = response.headers['x-dataset-governance-status'];
      const govAction = response.headers['x-dataset-governance-next-action'];

      if (govStatus === 'blocked') {
        alert(`Export Blocked (${govAction}): The dataset failed governance checks.`);
        return;
      }
      if (govStatus === 'warning') {
        alert(`Export Warning (${govAction}): The dataset has governance warnings.`);
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
      await handleExportError(error);
    }
  };

  const handleExportError = async (error) => {
    console.error('Export error:', error);
    if (error.response?.status === 422 && error.response.data instanceof Blob) {
      try {
        const text = await error.response.data.text();
        const data = JSON.parse(text);
        if (data.governance_readiness && data.governance_readiness.status === 'blocked') {
          const gr = data.governance_readiness;
          alert(`Export Blocked (${gr.next_action}): ${gr.reasons?.[0]?.message || 'Governance check failed.'}`);
          return;
        }
      } catch (e) {
        // Fallback
      }
    }

    if (error.response?.status === 422 && error.response?.headers?.['x-dataset-governance-status'] === 'blocked') {
      alert(`Export Blocked (${error.response.headers['x-dataset-governance-next-action']}): The dataset failed governance checks.`);
    } else {
      alert('Failed to export cleaned data. Please try again.');
    }
  };

  return (
    <div className="ExportClass">
      <button onClick={() => handleExport('csv')} aria-label="Export data as CSV" title="Export data as CSV">
        <FaFileCsv /> CSV
      </button>
      <button onClick={() => handleExport('excel')} aria-label="Export data as Excel" title="Export data as Excel">
        <FaFileExcel /> Excel
      </button>
      <button onClick={() => handleExport('pdf')} aria-label="Export current report as PDF" title="Export current report as PDF">
        <FaFilePdf /> PDF
      </button>
    </div>
  );
}

export default FileExport;
