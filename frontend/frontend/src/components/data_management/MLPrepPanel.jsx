import React, { useEffect, useMemo, useState, useContext } from 'react';
import axios from 'axios';
import { DataContext } from '../../context/DataContext';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const MODEL_TYPES_WITH_TARGET = new Set(['linear_regression', 'logistic_regression']);

const getColumnList = (dataset) => {
  if (!Array.isArray(dataset) || dataset.length === 0) return [];
  const sample = dataset[0];
  if (!sample || typeof sample !== 'object') return [];
  return Object.keys(sample);
};

const friendlyModelLabel = (modelId, models) => {
  const match = models.find((model) => model.id === modelId);
  return match?.name || modelId;
};

function MLPrepPanel({ onSwitchToCleaning }) {
  const { cleanedData, fullData, uploadedData } = useContext(DataContext);
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [targetColumn, setTargetColumn] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const activeDataset = cleanedData ?? fullData ?? uploadedData;
  const columns = useMemo(() => getColumnList(activeDataset), [activeDataset]);

  useEffect(() => {
    let mounted = true;
    const fetchModels = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/ml_prep/models`);
        if (mounted) {
          setModels(response.data.models || []);
        }
      } catch (err) {
        if (mounted) {
          setError(err.response?.data?.error || err.message || 'Failed to load models.');
        }
      }
    };

    fetchModels();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!MODEL_TYPES_WITH_TARGET.has(selectedModel)) {
      setTargetColumn('');
    }
  }, [selectedModel]);

  const handleCheck = async () => {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await axios.post(`${API_URL}/api/ml_prep/check`, {
        model_type: selectedModel,
        target_column: targetColumn || undefined,
      });
      setResult(response.data);
    } catch (err) {
      setResult(null);
      setError(err.response?.data?.error || err.message || 'Failed to check dataset readiness.');
    } finally {
      setLoading(false);
    }
  };

  const showTargetColumn = MODEL_TYPES_WITH_TARGET.has(selectedModel);
  const ready = result?.ready;
  const issues = result?.issues || [];
  const suggestions = result?.suggestions || [];

  return (
    <div className="ml-prep-panel">
      <div className="ml-prep-header">
        <div>
          <h3>ML Preparation Check</h3>
          <p className="ml-prep-subtitle">
            Validate your dataset before training a model and get tailored cleaning tips.
          </p>
        </div>
        {onSwitchToCleaning && (
          <button type="button" className="ml-prep-link" onClick={onSwitchToCleaning}>
            Open Data Cleaning
          </button>
        )}
      </div>

      <div className="ml-prep-form">
        <label className="ml-prep-field">
          <span>Model</span>
          <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
            <option value="">Select a model</option>
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
        </label>

        {showTargetColumn && (
          <label className="ml-prep-field">
            <span>Target Column</span>
            <select value={targetColumn} onChange={(e) => setTargetColumn(e.target.value)}>
              <option value="">Select target</option>
              {columns.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </label>
        )}

        <button
          type="button"
          className="ml-prep-check"
          onClick={handleCheck}
          disabled={!selectedModel || (showTargetColumn && !targetColumn) || loading}
        >
          {loading ? 'Checking...' : 'Check Data'}
        </button>
      </div>

      {error && <div className="ml-prep-alert error">{error}</div>}

      {result && !error && (
        <div className={`ml-prep-alert ${ready ? 'success' : 'warning'}`}>
          {ready ? (
            <div>
              <strong>Ready!</strong> Dataset is prepared for{' '}
              {friendlyModelLabel(selectedModel, models)}.
            </div>
          ) : (
            <div>
              <strong>Needs attention.</strong> Address the items below before training.
            </div>
          )}
        </div>
      )}

      {result && !ready && !error && (
        <div className="ml-prep-results">
          <div>
            <h4>Issues</h4>
            {issues.length === 0 ? (
              <p className="muted-text">No issues detected.</p>
            ) : (
              <ul>
                {issues.map((issue, idx) => (
                  <li key={`issue-${idx}`}>{issue}</li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h4>Suggestions</h4>
            {suggestions.length === 0 ? (
              <p className="muted-text">No suggestions available.</p>
            ) : (
              <ul>
                {suggestions.map((suggestion, idx) => (
                  <li key={`suggestion-${idx}`}>{suggestion}</li>
                ))}
              </ul>
            )}
            <p className="ml-prep-hint">
              Suggestions map to Data Cleaning tools like Replace Nulls, Convert Type,
              Split/Merge Columns, and Remove Nulls.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default MLPrepPanel;
