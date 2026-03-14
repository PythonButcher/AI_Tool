import React, { useState } from 'react';
import axios from 'axios';
import './APiDataForm.css';

const API_BACKEND_URL = "http://localhost:5000/api/fetch_external_data";

function ApiDataForm({ handleApiData }) {
  const [apiUrl, setApiUrl] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
  
    try {
      console.log("🚀 Sending API request to backend:", apiUrl); // This should log the API URL
  
      const response = await axios.post(API_BACKEND_URL, { api_url: apiUrl });
  
      console.log("🌍 Full API Response from Flask:", response.data);
  
      if (!response.data || !response.data.data_preview) {
        setError("Invalid API response format.");
        return;
      }
  
      handleApiData(response.data);
    } catch (err) {
      console.error("❌ API Fetch Error:", err);
      setError("Failed to fetch data. The API might be down or return an unsupported format.");
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="api-form-wrapper">
      <div className="api-form">
        <h3 className="api-form__title">Connect API</h3>
        <div className="api-form__row">
          <label className="api-form__label">API Endpoint URL</label>
          <input
            className="api-form__input"
            type="text"
            placeholder="https://api.example.com/data"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            disabled={isLoading}
          />
        </div>
        <button className="api-form__button" onClick={fetchData} disabled={isLoading || !apiUrl}>
          {isLoading ? "Fetching..." : "Fetch Data"}
        </button>
      </div>
      {error && <p className="error-message">{error}</p>}
    </div>
  );
}

export default ApiDataForm;
