import React, { useState, useContext, useMemo } from 'react';
import axios from 'axios';
import { DataContext } from '../../context/DataContext';
import {
  FaRobot,
  FaCheckCircle,
  FaExclamationTriangle,
  FaChartLine,
  FaBrain,
  FaLightbulb,
} from 'react-icons/fa';
import './AutoMLPanel.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const getColumnList = (dataset) => {
  if (!Array.isArray(dataset) || dataset.length === 0) return [];
  const sample = dataset[0];
  if (!sample || typeof sample !== 'object') return [];
  return Object.keys(sample);
};

const formatMetric = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'n/a';
  if (typeof value === 'number') return value.toFixed(4);
  return String(value);
};

const getPrimaryMetricLabel = (problemType) =>
  problemType === 'regression' ? 'R² Score' : 'F1 Score';

const MetricRow = ({ label, value, isBest }) => (
  <div className={`metric-row ${isBest ? 'best' : ''}`}>
    <span className="metric-label">{label}:</span>
    <span className="metric-value">{formatMetric(value)}</span>
  </div>
);

const ModelCard = ({ model, isBest, problemType }) => {
  const metrics = model.metrics || {};
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
  const [testSize, setTestSize] = useState(0.2);
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
        dataset: activeDataset,
        target_column: targetColumn,
        test_size: Number(testSize),
      });
      setResults(response.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'AutoML training failed.');
    } finally {
      setLoading(false);
    }
  };

  const bestModel = results?.best_model;
  const allModels = results?.all_models || [];
  const nonBestModels = allModels.filter((m) => m.model_id !== bestModel?.model_id);

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

          <label className="automl-field automl-test-size">
            <span>Test Split</span>
            <input
              type="number"
              min="0.1"
              max="0.5"
              step="0.05"
              value={testSize}
              onChange={(e) => setTestSize(e.target.value)}
              disabled={loading}
            />
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

      {results && bestModel && (
        <div className="automl-results">
          <div className="results-summary-banner">
            <div className="summary-item">
              <span className="label">Problem Type:</span>
              <span className="value type-tag">{results.problem_type?.toUpperCase()}</span>
            </div>
            <div className="summary-item">
              <span className="label">Target:</span>
              <span className="value">{results.target_column}</span>
            </div>
            <div className="summary-item">
              <span className="label">Best Model:</span>
              <span className="value highlight">{bestModel.model_name}</span>
            </div>
          </div>

          <div className="results-grid-container">
            <div className="best-model-section">
              <h4><FaCheckCircle /> Winning Model</h4>
              <ModelCard
                model={allModels.find((m) => m.model_id === bestModel.model_id) || bestModel}
                isBest={true}
                problemType={results.problem_type}
              />
            </div>

            <div className="all-models-section">
              <h4>Candidate Models Performance</h4>
              <div className="candidate-grid">
                {nonBestModels.map((model) => (
                  <ModelCard
                    key={model.model_id}
                    model={model}
                    isBest={false}
                    problemType={results.problem_type}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="automl-details-grid">
            {results.training_summary && (
              <div className="automl-detail-card">
                <h5>Training Summary</h5>
                <ul>
                  <li>Rows used: {results.training_summary.rows_used}</li>
                  <li>Feature columns: {results.training_summary.feature_columns}</li>
                  <li>Train/Test rows: {results.training_summary.train_rows} / {results.training_summary.test_rows}</li>
                  <li>Test split: {results.training_summary.test_split}</li>
                </ul>
                {Array.isArray(results.training_summary.warnings) && results.training_summary.warnings.length > 0 && (
                  <div className="automl-warning-box">
                    {results.training_summary.warnings.map((warning) => (
                      <p key={warning}>{warning}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {results.insights && (
              <div className="automl-detail-card">
                <h5><FaLightbulb /> Insight Summary</h5>
                {results.insights.overview && <p>{results.insights.overview}</p>}
                {results.insights.quality_assessment && <p><strong>{results.insights.quality_assessment}</strong></p>}
                {Array.isArray(results.insights.key_findings) && results.insights.key_findings.length > 0 && (
                  <ul>
                    {results.insights.key_findings.map((finding) => (
                      <li key={finding}>{finding}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {Array.isArray(results.feature_importance) && results.feature_importance.length > 0 && (
              <div className="automl-detail-card">
                <h5>Feature Importance</h5>
                <ul>
                  {results.feature_importance.map((item) => (
                    <li key={item.feature}>
                      {item.feature}: {formatMetric(item.importance)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {Array.isArray(results.prediction_preview) && results.prediction_preview.length > 0 && (
              <div className="automl-detail-card">
                <h5>Prediction Preview</h5>
                <pre>{JSON.stringify(results.prediction_preview, null, 2)}</pre>
              </div>
            )}
          </div>

          <div className="automl-footer-note">
            <p>
              <FaChartLine /> Models were ranked by {getPrimaryMetricLabel(results.problem_type)} on a hold-out test split.
            </p>
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


