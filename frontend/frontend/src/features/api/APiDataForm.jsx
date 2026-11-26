import React, { useEffect, useId, useRef, useState } from 'react';
import axios from 'axios';
import './APiDataForm.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function ApiDataForm({ handleApiData, onClose }) {
  const [apiUrl, setApiUrl] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const endpointId = useId();
  const activeRequest = useRef(null);
  useEffect(() => () => activeRequest.current?.abort(), []);

  const fetchData = async event => {
    event.preventDefault();
    const request = new AbortController();
    activeRequest.current = request;
    setIsLoading(true);
    setError(null);
  
    try {
      const response = await axios.post(`${API_URL}/api/fetch_external_data`, { api_url: apiUrl.trim() }, { signal: request.signal });
      if (request.signal.aborted) return;
  
      if (!response.data || !response.data.data_preview) {
        setError("Invalid API response format.");
        return;
      }
  
      handleApiData(response.data);
      if (onClose) onClose();
    } catch (err) {
      if (!request.signal.aborted) setError('Failed to fetch data. Check that the URL is reachable.');
    } finally {
      if (!request.signal.aborted) setIsLoading(false);
    }
  };
  
  return (
    <div className="api-data-content">
      <form className="api-data-form__row" onSubmit={fetchData}>
        <div className="api-input-group">
          <label className="api-input-label" htmlFor={endpointId}>Endpoint URL</label>
          <input
            className="api-data-form__input"
            id={endpointId}
            type="url"
            required
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            disabled={isLoading}
            placeholder="https://api.example.com/data"
          />
        </div>
        <button className="api-data-form__submit" type="submit" disabled={isLoading || !apiUrl.trim()}>
          {isLoading ? "Connecting..." : "Fetch Data"}
        </button>
      </form>
      {error && <p className="api-data-form__error" role="alert">{error}</p>}
      <p className="api-data-hint">
        Supports JSON endpoints returning structured arrays or data objects.
      </p>
    </div>
  );
}

export default ApiDataForm;
