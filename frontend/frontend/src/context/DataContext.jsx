import React, { createContext, useState, useEffect, useMemo, useContext } from 'react';

export const DataContext = createContext();

export const DataProvider = ({ children }) => {
  const [uploadedData, setUploadedData] = useState(null);  // preview (≤100 rows)
  const [fullData, setFullData] = useState(null);  // entire table
  const [cleanedData, setCleanedData] = useState(null);
  const [filteredData, setFilteredData] = useState(null);
  const [pipelineResults, setPipelineResults] = useState({}); // ✅ NEW: results from AI pipeline
  const [aiReportReady, setAiReportReady] = useState(false); // flag when report finished
  const [showAiReport, setShowAiReport] = useState(false);

  // Anomaly Detection State
  const [anomalies, setAnomalies] = useState([]);
  const [isDetecting, setIsDetecting] = useState(false);

  const detectAnomalies = async () => {
    setIsDetecting(true);
    try {
      const response = await fetch('http://localhost:5000/api/analyze/outliers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ contamination: 0.05 }),
      });

      const result = await response.json();
      if (response.ok) {
        setAnomalies(result.outlier_indices || []);
        if (result.count === 0) {
          alert("No anomalies detected.");
        }
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error("Error detecting anomalies:", error);
      alert("Failed to detect anomalies.");
    } finally {
      setIsDetecting(false);
    }
  };

  useEffect(() => {
    console.log('DataContext fullData rows:', Array.isArray(fullData) ? fullData.length : 0);
  }, [fullData]);

  const value = useMemo(() => ({
    uploadedData, setUploadedData,
    fullData, setFullData,
    cleanedData, setCleanedData,
    filteredData, setFilteredData,
    pipelineResults, setPipelineResults,
    aiReportReady, setAiReportReady,
    showAiReport, setShowAiReport,
    anomalies, setAnomalies,
    isDetecting, detectAnomalies,
  }), [uploadedData, fullData, cleanedData, filteredData, pipelineResults, aiReportReady, showAiReport, anomalies, isDetecting]);

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