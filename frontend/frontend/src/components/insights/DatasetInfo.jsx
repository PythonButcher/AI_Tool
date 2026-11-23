import React, { useState, useEffect, useContext, useCallback } from 'react';
import axios from 'axios';
import './DatasetInfo.css';
import { useActiveDataset, DataContext } from '../../context/DataContext';
import { useWindowContext } from '../../context/WindowContext';
import SemanticModelPanel from './SemanticModelPanel';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function DatasetInfo({ selectedStat, className = '' }) {
  const [dataInfo, setDataInfo] = useState(null);
  const [statData, setStatData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const dataset = useActiveDataset();
  const { semanticModel, semanticModelStatus, analysisContext } = useContext(DataContext);
  const { addChart, addDashboardKpi, openDashboard } = useWindowContext();

  useEffect(() => {
    if (!dataset) return undefined;
    const controller = new AbortController();
    setDataInfo(null);
    setError(null);
    setIsLoading(true);
    const options = { signal: controller.signal };
    async function loadDataInfo() {
      try {
        const { data } = analysisContext?.primary_source_id
          ? await axios.post(`${API_URL}/api/numbers`, { analysis_context: analysisContext }, options)
          : await axios.get(`${API_URL}/api/numbers`, options);
        if (controller.signal.aborted) return;
        if (data?.data_info) setDataInfo(data.data_info);
        else setError('No data information returned from backend.');
      } catch (error) {
        if (!controller.signal.aborted) setError('Failed to fetch data information.');
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }
    loadDataInfo();
    return () => controller.abort();
  }, [dataset, analysisContext]);

  useEffect(() => {
    if (selectedStat) {
      fetchStatData(selectedStat);
    }
  }, [selectedStat]);

  const fetchStatData = async (statType) => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/stats`, {
        params: { statType },
      });
      if (response.data && response.data.data) {
        setStatData({ statType, data: response.data.data });
        setError(null);
      } else if (response.data && response.data.error) {
        setError(response.data.error);
      } else {
        setError('No statistical data returned from backend.');
      }
    } catch (err) {
      setError('Failed to fetch statistical data.');
      console.error('Error fetching statistical data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSemanticChart = useCallback((semanticUpdates = {}) => {
    addChart({
      type: 'Bar',
      dataSourceMode: 'semantic',
      semanticConfig: {
        metricId: '',
        groupBy: '',
        ...semanticUpdates,
      },
    });
  }, [addChart]);

  const handleCreateKpiCard = useCallback((semanticUpdates = {}) => {
    openDashboard();
    addDashboardKpi({
      semanticConfig: {
        metricId: '',
        groupBy: '',
        ...semanticUpdates,
      },
    });
  }, [addDashboardKpi, openDashboard]);

  return (
    <div className={`numbers-list-container ${className}`}>
      <h2 className="title">Dataset Information</h2>

      <SemanticModelPanel
        semanticModel={semanticModel}
        status={semanticModelStatus}
        onCreateSemanticChart={handleCreateSemanticChart}
        onCreateKpiCard={handleCreateKpiCard}
      />

      {isLoading && <p className="loading-message">Loading...</p>}
      {error && <p className="error-message">{error}</p>}

      {dataInfo && (
        <div className="data-preview-container">
          <h3 className="data-preview-title">Dataset Overview</h3>
          <pre className="data-preview-content">{dataInfo}</pre>
        </div>
      )}

      {statData && (
        <div className="stat-data-container">
          <h3 className="stat-data-title">
            Statistical Data: {statData.statType}
          </h3>
          <pre className="stat-data-content">
            {JSON.stringify(statData.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default DatasetInfo;
