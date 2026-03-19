import React, {
  createContext,
  useState,
  useEffect,
  useMemo,
  useContext,
  useCallback,
} from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export const DataContext = createContext();

const normalizeDatasetRows = (source) => {
  if (!source) return [];
  if (Array.isArray(source)) return source;
  if (typeof source === 'string') {
    try {
      const parsed = JSON.parse(source);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  if (Array.isArray(source?.data)) return source.data;
  if (Array.isArray(source?.full_data)) return source.full_data;
  if (Array.isArray(source?.cleaned_data)) return source.cleaned_data;
  if (Array.isArray(source?.data_preview)) return source.data_preview;
  if (typeof source?.data_preview === 'string') {
    try {
      const parsed = JSON.parse(source.data_preview);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

export { normalizeDatasetRows };

export const DataProvider = ({ children }) => {
  const [uploadedData, setUploadedData] = useState(null);
  const [fullData, setFullData] = useState(null);
  const [cleanedData, setCleanedData] = useState(null);
  const [filteredData, setFilteredData] = useState(null);
  const [pipelineResults, setPipelineResults] = useState({});
  const [aiReportReady, setAiReportReady] = useState(false);
  const [showAiReport, setShowAiReport] = useState(false);
  const [anomalies, setAnomalies] = useState([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [mlPrepStatus, setMlPrepStatus] = useState(null);
  const [semanticModel, setSemanticModel] = useState(null);
  const [semanticModelStatus, setSemanticModelStatus] = useState('idle');

  const detectAnomalies = useCallback(async () => {
    if (isDetecting) return;
    setIsDetecting(true);
    try {
      const response = await fetch(`${API_URL}/api/outliers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contamination: 0.02 }),
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
  }, [isDetecting]);

  const refreshSemanticModelFromDataset = useCallback(async (dataset, metadata = {}) => {
    const rows = normalizeDatasetRows(dataset);
    if (!rows.length) {
      setSemanticModel(null);
      setSemanticModelStatus('idle');
      return null;
    }

    setSemanticModelStatus('loading');
    try {
      const response = await fetch(`${API_URL}/api/semantic-model/infer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataset: rows,
          dataset_name: metadata.datasetName,
          dataset_id: metadata.datasetId,
          source: metadata.source || 'frontend_refresh',
          persist_current: true,
          preserve_user_metrics: Boolean(metadata.preserveUserMetrics),
          base_semantic_model: metadata.baseSemanticModel || (metadata.preserveUserMetrics ? semanticModel : null),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to refresh semantic model');
      }

      setSemanticModel(payload.semantic_model || null);
      setSemanticModelStatus('ready');
      return payload.semantic_model || null;
    } catch (error) {
      console.error('Failed to refresh semantic model:', error);
      setSemanticModelStatus('error');
      return null;
    }
  }, [semanticModel]);

  const listSemanticMetrics = useCallback(async () => {
    const response = await fetch(`${API_URL}/api/semantic-model/metrics`);
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || 'Failed to load semantic metrics');
    }

    if (payload.semantic_model) {
      setSemanticModel(payload.semantic_model);
      setSemanticModelStatus('ready');
    }

    return Array.isArray(payload.metrics) ? payload.metrics : [];
  }, []);

  const createSemanticMetric = useCallback(async (metricPayload) => {
    setSemanticModelStatus('loading');
    const response = await fetch(`${API_URL}/api/semantic-model/metrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metricPayload),
    });
    const payload = await response.json();

    if (!response.ok) {
      setSemanticModelStatus('error');
      throw new Error(payload.error || 'Failed to create semantic metric');
    }

    setSemanticModel(payload.semantic_model || null);
    setSemanticModelStatus('ready');
    return payload.metric;
  }, []);

  const updateSemanticMetric = useCallback(async (metricId, metricPayload) => {
    setSemanticModelStatus('loading');
    const response = await fetch(`${API_URL}/api/semantic-model/metrics/${encodeURIComponent(metricId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metricPayload),
    });
    const payload = await response.json();

    if (!response.ok) {
      setSemanticModelStatus('error');
      throw new Error(payload.error || 'Failed to update semantic metric');
    }

    setSemanticModel(payload.semantic_model || null);
    setSemanticModelStatus('ready');
    return payload.metric;
  }, []);

  const deleteSemanticMetric = useCallback(async (metricId) => {
    setSemanticModelStatus('loading');
    const response = await fetch(`${API_URL}/api/semantic-model/metrics/${encodeURIComponent(metricId)}`, {
      method: 'DELETE',
    });
    const payload = await response.json();

    if (!response.ok) {
      setSemanticModelStatus('error');
      throw new Error(payload.error || 'Failed to delete semantic metric');
    }

    setSemanticModel(payload.semantic_model || null);
    setSemanticModelStatus('ready');
    return true;
  }, []);

  useEffect(() => {
    setAnomalies([]);
    setMlPrepStatus(null);
  }, [uploadedData, fullData]);

  useEffect(() => {
    if (!uploadedData && !fullData && !cleanedData && !filteredData) {
      setSemanticModel(null);
      setSemanticModelStatus('idle');
    }
  }, [uploadedData, fullData, cleanedData, filteredData]);

  useEffect(() => {
    if (semanticModel && semanticModelStatus === 'idle') {
      setSemanticModelStatus('ready');
    }
  }, [semanticModel, semanticModelStatus]);

  useEffect(() => {
    console.log('DataContext fullData rows:', Array.isArray(fullData) ? fullData.length : 0);
  }, [fullData]);

  const value = useMemo(() => ({
    uploadedData,
    setUploadedData,
    fullData,
    setFullData,
    cleanedData,
    setCleanedData,
    filteredData,
    setFilteredData,
    pipelineResults,
    setPipelineResults,
    aiReportReady,
    setAiReportReady,
    showAiReport,
    setShowAiReport,
    anomalies,
    setAnomalies,
    isDetecting,
    setIsDetecting,
    detectAnomalies,
    mlPrepStatus,
    setMlPrepStatus,
    semanticModel,
    setSemanticModel,
    semanticModelStatus,
    refreshSemanticModelFromDataset,
    listSemanticMetrics,
    createSemanticMetric,
    updateSemanticMetric,
    deleteSemanticMetric,
  }), [
    uploadedData,
    fullData,
    cleanedData,
    filteredData,
    pipelineResults,
    aiReportReady,
    showAiReport,
    anomalies,
    isDetecting,
    detectAnomalies,
    mlPrepStatus,
    semanticModel,
    semanticModelStatus,
    refreshSemanticModelFromDataset,
    listSemanticMetrics,
    createSemanticMetric,
    updateSemanticMetric,
    deleteSemanticMetric,
  ]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useActiveDataset = () => {
  const { filteredData, cleanedData, fullData, uploadedData } = useContext(DataContext);
  return filteredData ?? cleanedData ?? fullData ?? uploadedData;
};

export const useDatasetMeta = () => {
  const dataset = useActiveDataset();
  const rows = normalizeDatasetRows(dataset);
  const numRows = rows.length;
  const numCols = rows.length > 0 ? Object.keys(rows[0]).length : 0;
  return { numRows, numCols };
};

export const useSemanticModel = () => {
  const { semanticModel } = useContext(DataContext);
  return semanticModel;
};

export const useBusinessDefinitions = () => {
  const semanticModel = useSemanticModel();
  return {
    entities: semanticModel?.entities || [],
    dimensions: semanticModel?.dimensions || [],
    metrics: semanticModel?.metrics || [],
    relationships: semanticModel?.relationships || [],
  };
};

