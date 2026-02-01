import React, { createContext, useState, useEffect, useMemo, useContext } from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export const DataContext = createContext();

export const DataProvider = ({ children }) => {
  const [uploadedData, setUploadedData]   = useState(null);  // preview (≤100 rows)
  const [fullData,      setFullData]      = useState(null);  // entire table
  const [cleanedData,   setCleanedData]   = useState(null);
  const [filteredData,  setFilteredData]  = useState(null);
  const [pipelineResults, setPipelineResults] = useState({}); // ✅ NEW: results from AI pipeline
  const [aiReportReady, setAiReportReady] = useState(false); // flag when report finished
  const [showAiReport, setShowAiReport] = useState(false);
  const [anomalies, setAnomalies] = useState([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [mlPrepStatus, setMlPrepStatus] = useState(null);

  const detectAnomalies = async () => {
    if (isDetecting) return;
    setIsDetecting(true);
    try {
      const response = await fetch(`${API_URL}/api/outliers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contamination: 0.02 })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to detect anomalies');
      }

      const indices = Array.isArray(data.outlier_indices) ? data.outlier_indices : [];
      setAnomalies(indices);

      if (indices.length === 0) {
        alert('No outliers detected.');
      }
    } catch (error) {
      alert(`Failed to detect anomalies: ${error.message}`);
    } finally {
      setIsDetecting(false);
    }
  };

  useEffect(() => {
    setAnomalies([]);
    setMlPrepStatus(null);
  }, [uploadedData, fullData]);

  useEffect(() => {
    console.log('DataContext fullData rows:', Array.isArray(fullData) ? fullData.length : 0);
  }, [fullData]);

  const value = useMemo(() => ({
    uploadedData,  setUploadedData,
    fullData,      setFullData,
    cleanedData,   setCleanedData,
    filteredData,  setFilteredData,
    pipelineResults, setPipelineResults,
    aiReportReady, setAiReportReady,
    showAiReport,  setShowAiReport,
    anomalies, setAnomalies,
    isDetecting, setIsDetecting,
    detectAnomalies,
    mlPrepStatus, setMlPrepStatus,
  }), [uploadedData, fullData, cleanedData, filteredData, pipelineResults, aiReportReady, showAiReport, anomalies, isDetecting, mlPrepStatus]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

/* helper for previews, charts, etc. */
export const useActiveDataset = () => {
  const { filteredData, cleanedData, fullData, uploadedData } = useContext(DataContext);
  return filteredData ?? cleanedData ?? fullData ?? uploadedData;
};

// ✅ useDatasetMeta – derive row/column count
export const useDatasetMeta = () => {
  const dataset = useActiveDataset();
  const numRows = dataset ? dataset.length : 0;
  const numCols = dataset && dataset.length > 0 ? Object.keys(dataset[0]).length : 0;
  return { numRows, numCols };
};
