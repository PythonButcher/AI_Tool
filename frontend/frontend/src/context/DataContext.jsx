import React, { createContext, useState, useEffect, useMemo, useContext } from 'react';

export const DataContext = createContext();

export const DataProvider = ({ children }) => {
  const [uploadedData, setUploadedData]   = useState(null);  // preview (≤100 rows)
  const [fullData,      setFullData]      = useState(null);  // entire table
  const [cleanedData,   setCleanedData]   = useState(null);
  const [filteredData,  setFilteredData]  = useState(null);
  const [pipelineResults, setPipelineResults] = useState({}); // ✅ NEW: results from AI pipeline
  const [aiReportReady, setAiReportReady] = useState(false); // flag when report finished
  const [showAiReport, setShowAiReport] = useState(false);

  useEffect(() => console.log('📦 fullData rows:', fullData?.length || 0), [fullData]);

  const value = useMemo(() => ({
    uploadedData,  setUploadedData,
    fullData,      setFullData,
    cleanedData,   setCleanedData,
    filteredData,  setFilteredData,
    pipelineResults, setPipelineResults,
    aiReportReady, setAiReportReady,
    showAiReport,  setShowAiReport,
  }), [uploadedData, fullData, cleanedData, filteredData, pipelineResults, aiReportReady, showAiReport]);

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