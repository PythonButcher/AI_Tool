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
    <div className="api-data-form">
      <div className="api-data-form__header">
        <p className="api-data-form__eyebrow">Remote Data Source</p>
        <h3 className="api-data-form__title">Connect to an API endpoint</h3>
      </div>
      <label className="api-data-form__field">
        <span className="api-data-form__label">API Endpoint</span>
        <input
          className="api-data-form__input"
          type="text"
          value={apiUrl}
          onChange={(e) => setApiUrl(e.target.value)}
          disabled={isLoading}
          placeholder="https://api.example.com/data"
        />
      </label>
      <button className="api-data-form__button" onClick={fetchData} disabled={isLoading}>
        {isLoading ? "Fetching..." : "Fetch Data"}
      </button>
      {error && <p className="api-data-form__error">{error}</p>}
    </div>
  );
}

export default ApiDataForm;
