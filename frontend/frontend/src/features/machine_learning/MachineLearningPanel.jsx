import React, { useContext, useMemo, useState } from 'react';
import axios from 'axios';
import './MachineLearningPanel.css';
import { DataContext } from '../../context/DataContext';
import DatasetInfo from '../../components/insights/DatasetInfo';
import AutoMLPanel from '../../components/data_management/AutoMLPanel';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const metricLabels = {
  r2: 'R² Score',
  mae: 'MAE',
  mse: 'MSE',
  rmse: 'RMSE',
  accuracy: 'Accuracy',
  precision: 'Precision',
  recall: 'Recall',
  f1: 'F1 Score',
};

const formatMetricValue = (value) => {
  if (value === null || value === undefined) return 'n/a';
  if (typeof value === 'number') return value.toFixed(4);
  return Array.isArray(value) ? JSON.stringify(value) : String(value);
};

const buildDisplayMetrics = (metrics) => {
  if (!metrics || typeof metrics !== 'object') return [];
  const entries = Object.entries(metrics);

  const mapped = entries.map(([key, value]) => ({
    key,
    label: metricLabels[key] || key,
    value,
  }));

  if (metrics.mse !== undefined && metrics.rmse === undefined && typeof metrics.mse === 'number') {
    mapped.push({
      key: 'rmse',
      label: 'RMSE',
      value: Math.sqrt(metrics.mse),
    });
  }

  return mapped;
};

const modelQualityHint = (modelId, metrics = {}) => {
  if (modelId === 'linear_regression') {
    const r2 = Number(metrics.r2);
    if (Number.isFinite(r2)) {
      if (r2 >= 0.85) return 'Strong fit for this dataset.';
      if (r2 >= 0.6) return 'Moderate fit; still useful but can improve.';
      return 'Weak fit; add features or more data for better predictions.';
    }
    return null;
  }

  if (modelId === 'logistic_regression') {
    const f1 = Number(metrics.f1);
    if (Number.isFinite(f1)) {
      if (f1 >= 0.85) return 'Strong classification performance.';
      if (f1 >= 0.7) return 'Moderate classification performance.';
      return 'Weak classification performance; consider better target/features.';
    }
    return null;
  }

  if (modelId === 'kmeans') {
    return 'For clustering, compare inertia and silhouette score rather than accuracy-style metrics.';
  }

  return null;
};

const MachineLearningPanelWrapper = () => {
  const [activeTab, setActiveTab] = useState('custom'); // 'custom' or 'automl'
  const { mlPrepStatus } = useContext(DataContext);
  const isReady = mlPrepStatus?.ready;

  return (
    <div className="machine-learning-panel">
      <div className="ml-panel-header">
        <h2>🧠 Machine Learning</h2>
        {isReady && (
          <div className="ml-tabs">
            <button
              className={`ml-tab ${activeTab === 'custom' ? 'active' : ''}`}
              onClick={() => setActiveTab('custom')}
            >
              Custom Training
            </button>
            <button
              className={`ml-tab ${activeTab === 'automl' ? 'active' : ''}`}
              onClick={() => setActiveTab('automl')}
            >
              AutoML Solver
            </button>
          </div>
        )}
      </div>

      <div className="ml-panel-body">
        {!isReady ? (
          <div className="ml-not-ready">
            <p>
              This dataset is not machine-learning ready yet. Please complete ML Prep
              in the Data Cleaning section before continuing.
            </p>
          </div>
        ) : activeTab === 'custom' ? (
          <CustomMLContent />
        ) : (
          <AutoMLPanel />
        )}
      </div>
    </div>
  );
};

const CustomMLContent = () => {
  const { mlPrepStatus, cleanedData, fullData, uploadedData } = useContext(DataContext);
  const isReady = mlPrepStatus?.ready;
  const modelLabel = mlPrepStatus?.modelLabel || null;
  const datasetId = mlPrepStatus?.datasetId || 'Current dataset';
  const requiresTarget = mlPrepStatus?.requiresTarget;
  const targetColumn = mlPrepStatus?.targetColumn || null;
  const modelId = mlPrepStatus?.modelId || null;

  const activeDataset = useMemo(() => cleanedData ?? fullData ?? uploadedData, [cleanedData, fullData, uploadedData]);
  const [trainingResult, setTrainingResult] = useState(null);
  const [trainingError, setTrainingError] = useState(null);
  const [isTraining, setIsTraining] = useState(false);

  const handleTrain = async () => {
    if (!isReady || !modelId) return;

    setIsTraining(true);
    setTrainingError(null);
    setTrainingResult(null);

    try {
      const response = await axios.post(`${API_URL}/api/ml_prep/train`, {
        dataset: activeDataset,
        model_type: modelId,
        target_column: requiresTarget ? targetColumn : undefined,
      });
      setTrainingResult(response.data);
    } catch (error) {
      setTrainingError(error.response?.data?.error || error.message || 'Model training failed.');
    } finally {
      setIsTraining(false);
    }
  };

  const displayMetrics = buildDisplayMetrics(trainingResult?.metrics);
  const qualityHint = modelQualityHint(modelId, trainingResult?.metrics);

  return (
    <>
      {modelLabel ? (
        <p>
          Dataset is ready for <strong>{modelLabel}</strong>.
        </p>
      ) : (
        <p>Dataset readiness confirmed, but model details are unavailable.</p>
      )}

      <div className="machine-learning-setup">
        <h3>Model Setup</h3>
        <div className="machine-learning-setup-row">
          <span className="machine-learning-setup-label">Model Type</span>
          <span className="machine-learning-setup-value">
            {modelLabel || 'Not available yet'}
          </span>
        </div>
        <div className="machine-learning-setup-row">
          <span className="machine-learning-setup-label">Dataset</span>
          <span className="machine-learning-setup-value">
            {datasetId || 'Not available yet'}
          </span>
        </div>
        {requiresTarget ? (
          <div className="machine-learning-setup-row">
            <span className="machine-learning-setup-label">Target Column</span>
            <span className="machine-learning-setup-value">
              {targetColumn || 'Not available yet'}
            </span>
          </div>
        ) : (
          <div className="machine-learning-setup-note">
            This model does not require a target column.
            <DatasetInfo className="ml-compact" />
          </div>
        )}
      </div>

      <button type="button" className="machine-learning-action" disabled={isTraining} onClick={handleTrain}>
        {isTraining ? 'Training...' : 'Train Model'}
      </button>

      {trainingError && <p className="machine-learning-error">{trainingError}</p>}

      {trainingResult && (
        <div className="machine-learning-results">
          <h3>Training Results</h3>
          {qualityHint && <p><strong>{qualityHint}</strong></p>}

          {displayMetrics.length > 0 && (
            <ul>
              {displayMetrics.map((item) => (
                <li key={item.key}>
                  <strong>{item.label}:</strong> {formatMetricValue(item.value)}
                </li>
              ))}
            </ul>
          )}

          {Array.isArray(trainingResult.predictions) && (
            <div>
              <h4>Predictions (first 10)</h4>
              <pre>{JSON.stringify(trainingResult.predictions.slice(0, 10), null, 2)}</pre>
            </div>
          )}

          {Array.isArray(trainingResult.clusters) && (
            <div>
              <h4>Cluster Assignments (first 10)</h4>
              <pre>{JSON.stringify(trainingResult.clusters.slice(0, 10), null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default MachineLearningPanelWrapper;
