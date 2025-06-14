// DatasetInfo.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './css/DatasetInfo.css'; // You can keep or rename the CSS file as needed
import { useActiveDataset } from '../context/DataContext';


const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

/**
 * This component replaces the old "NumbersList" but
 * removes all chart-related logic. It still fetches:
 *  - General data info (dataset metadata, etc.)
 *  - Statistical data based on a `selectedStat`
 */
function DatasetInfo({ selectedStat }) {
  const [dataInfo, setDataInfo] = useState(null);
  const [statData, setStatData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const dataset = useActiveDataset();

  /**
   * Whenever `uploadedData` changes:
   *  1. Fetch general data info from backend.
   *  2. (Optional) We could fetch other data
   *     or do additional logic here if needed.
   */
  useEffect(() => {
  if (dataset) {
    fetchDataInfo();
  }
}, [dataset]);


  /**
   * Whenever `selectedStat` changes, fetch the
   * corresponding statistical data.
   */
  useEffect(() => {
    if (selectedStat) {
      fetchStatData(selectedStat);
    }
  }, [selectedStat]);

  /**
   * Fetch dataset information (like metadata).
   */
  const fetchDataInfo = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/numbers`);
      if (response.data && response.data.data_info) {
        setDataInfo(response.data.data_info);
      } else {
        setError('No data information returned from backend.');
      }
    } catch (err) {
      setError('Failed to fetch data information.');
      console.error('Error fetching data info:', err);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Fetch statistical data based on the selectedStat parameter.
   * e.g., 'mean', 'median', etc.
   */
  const fetchStatData = async (statType) => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/stats`, {
        params: { statType },
      });
      if (response.data && response.data.data) {
        setStatData({ statType, data: response.data.data });
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

  return (
    <div className="numbers-list-container">
      <h2 className="title">Dataset Information</h2>

      {isLoading && <p className="loading-message">Loading...</p>}
      {error && <p className="error-message">{error}</p>}

      {/* Display basic dataset info if available */}
      {dataInfo && (
        <div className="data-preview-container">
          <h3 className="data-preview-title">Dataset Overview</h3>
          <pre className="data-preview-content">{dataInfo}</pre>
        </div>
      )}

      {/* Display statistical data if user selected a stat */}
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
