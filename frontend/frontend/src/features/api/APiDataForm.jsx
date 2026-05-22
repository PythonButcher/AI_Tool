import React, { useState } from 'react';
import axios from 'axios';
import './APiDataForm.css';
import { FaServer, FaTimes, FaMinus } from 'react-icons/fa';

const API_BACKEND_URL = "http://localhost:5000/api/fetch_external_data";

function ApiDataForm({ handleApiData, onClose }) {
  const [apiUrl, setApiUrl] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
  
    try {
      const response = await axios.post(API_BACKEND_URL, { api_url: apiUrl });
  
      if (!response.data || !response.data.data_preview) {
        setError("Invalid API response format.");
        return;
      }
  
      handleApiData(response.data);
      if (onClose) onClose();
    } catch (err) {
      console.error("❌ API Fetch Error:", err);
      setError("Failed to fetch data. Ensure the URL is valid and reachable.");
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="api-data-content">
      <div className="api-data-form__row">
        <div className="api-input-group">
          <label className="api-input-label">Endpoint URL</label>
          <input
            className="api-data-form__input"
            type="text"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            disabled={isLoading}
            placeholder="https://api.example.com/data"
          />
        </div>
        <button className="api-data-form__submit" onClick={fetchData} disabled={isLoading || !apiUrl}>
          {isLoading ? "Connecting..." : "Fetch Data"}
        </button>
      </div>
      {error && <p className="api-data-form__error">{error}</p>}
      <p className="api-data-hint">
        Supports JSON endpoints returning structured arrays or data objects.
      </p>
    </div>
  );
}

export default ApiDataForm;
