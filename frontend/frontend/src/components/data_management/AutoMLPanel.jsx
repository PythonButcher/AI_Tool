import React, { useState, useContext, useMemo } from 'react';
import axios from 'axios';
import { DataContext } from '../../context/DataContext';
import { FaRobot, FaCheckCircle, FaExclamationTriangle, FaChartLine, FaBrain } from 'react-icons/fa';
import './AutoMLPanel.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const getColumnList = (dataset) => {
  if (!Array.isArray(dataset) || dataset.length === 0) return [];
  const sample = dataset[0];
  if (!sample || typeof sample !== 'object') return [];
  return Object.keys(sample);
};

const MetricRow = ({ label, value, isBest }) => (
  <div className={`metric-row ${isBest ? 'best' : ''}`}>
    <span className="metric-label">{label}:</span>
    <span className="metric-value">{typeof value === 'number' ? value.toFixed(4) : value}</span>
  </div>
);

const ModelCard = ({ model, isBest, problemType }) => {
  const metrics = model.metrics;
  return (
    <div className={`model-card ${isBest ? 'best-model' : ''}`}>
      <div className="model-card-header">
        <h4>{model.model_name}</h4>
        {isBest && <span className="best-badge"><FaCheckCircle /> Best</span>}
      </div>
      <div className="model-card-metrics">
        {problemType === 'regression' ? (
          <>
            <MetricRow label="R² Score" value={metrics.r2} isBest={isBest} />
            <MetricRow label="MAE" value={metrics.mae} />
            <MetricRow label="RMSE" value={metrics.rmse} />
          </>
        ) : (
          <>
            <MetricRow label="F1 Score" value={metrics.f1} isBest={isBest} />
            <MetricRow label="Accuracy" value={metrics.accuracy} />
            <MetricRow label="Precision" value={metrics.precision} />
            <MetricRow label="Recall" value={metrics.recall} />
          </>
        )}
      </div>
    </div>
  );
};

function AutoMLPanel() {
  const { cleanedData, fullData, uploadedData } = useContext(DataContext);
  const [targetColumn, setTargetColumn] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);

  const activeDataset = cleanedData ?? fullData ?? uploadedData;
  const columns = useMemo(() => getColumnList(activeDataset), [activeDataset]);

  const handleTrain = async () => {
    if (!targetColumn) return;

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await axios.post(`${API_URL}/api/automl/train`, {
        target_column: targetColumn,
      });
      setResults(response.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'AutoML training failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="automl-panel">
      <div className="automl-header">
        <div className="header-icon-title">
          <FaRobot className="automl-main-icon" />
          <div>
            <h3>AutoML Problem Solver</h3>
            <p className="automl-subtitle">
              Automatically detect problem type, preprocess data, and find the best predictive model.
            </p>
          </div>
        </div>
      </div>

      <div className="automl-config">
        <div className="config-row">
          <label className="automl-field">
            <span>Target Column (to predict)</span>
            <select 
              value={targetColumn} 
              onChange={(e) => setTargetColumn(e.target.value)}
              disabled={loading}
            >
              <option value="">Select target...</option>
              {columns.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="automl-run-btn"
            onClick={handleTrain}
            disabled={!targetColumn || loading}
          >
            {loading ? (
              <>
                <div className="spinner-small" /> Training Models...
              </>
            ) : (
              <>
                <FaBrain /> Start AutoML
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="automl-alert error">
          <FaExclamationTriangle /> {error}
        </div>
      )}

      {results && (
        <div className="automl-results">
          <div className="results-summary-banner">
            <div className="summary-item">
              <span className="label">Problem Type:</span>
              <span className="value type-tag">{results.problem_type.toUpperCase()}</span>
            </div>
            <div className="summary-item">
              <span className="label">Target:</span>
              <span className="value">{results.target_column}</span>
            </div>
            <div className="summary-item">
              <span className="label">Best Model:</span>
              <span className="value highlight">{results.best_model.model_name}</span>
            </div>
          </div>

          <div className="results-grid-container">
            <div className="best-model-section">
              <h4><FaCheckCircle /> Winning Model</h4>
              <ModelCard 
                model={results.all_models.find(m => m.model_id === results.best_model.model_id)} 
                isBest={true} 
                problemType={results.problem_type}
              />
            </div>

            <div className="all-models-section">
              <h4>Candidate Models Performance</h4>
              <div className="candidate-grid">
                {results.all_models
                  .filter(m => m.model_id !== results.best_model.model_id)
                  .map((model) => (
                    <ModelCard 
                      key={model.model_id} 
                      model={model} 
                      isBest={false} 
                      problemType={results.problem_type}
                    />
                  ))
                }
              </div>
            </div>
          </div>
          
          <div className="automl-footer-note">
             <p><FaChartLine /> Models were evaluated using {results.problem_type === 'regression' ? 'R² Score' : 'F1 Score'} on a 20% hold-out test set.</p>
          </div>
        </div>
      )}

      {!results && !loading && !error && (
        <div className="automl-placeholder">
          <FaRobot className="placeholder-icon" />
          <p>Select a target column and click "Start AutoML" to begin the automated machine learning workflow.</p>
        </div>
      )}
    </div>
  );
}

export default AutoMLPanel;
