import React, { useContext, useMemo, useState } from 'react';
import axios from 'axios';
import './MachineLearningPanel.css';
import { DataContext } from '../../context/DataContext';
import DatasetInfo from '../../components/insights/DatasetInfo';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const MachineLearningPanel = () => {
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

  const renderMetrics = () => {
    if (!trainingResult?.metrics) return null;
    return Object.entries(trainingResult.metrics).map(([key, value]) => {
      const display = Array.isArray(value) ? JSON.stringify(value) : String(value);
      return (
        <li key={key}>
          <strong>{key}:</strong> {display}
        </li>
      );
    });
  };

  return (
    <div className="machine-learning-panel">
      <h2>Machine Learning</h2>
      {isReady ? (
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
              <ul>{renderMetrics()}</ul>

              {Array.isArray(trainingResult.predictions) && (
                <div>
                  <h4>Predictions (first 20)</h4>
                  <pre>{JSON.stringify(trainingResult.predictions.slice(0, 20), null, 2)}</pre>
                </div>
              )}

              {Array.isArray(trainingResult.clusters) && (
                <div>
                  <h4>Cluster Assignments (first 20)</h4>
                  <pre>{JSON.stringify(trainingResult.clusters.slice(0, 20), null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <p>
          This dataset is not machine-learning ready yet. Please complete ML Prep
          in the Data Cleaning section before continuing.
        </p>
      )}
    </div>
  );
};

export default MachineLearningPanel;
