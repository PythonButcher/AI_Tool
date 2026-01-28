import React, { useContext } from 'react';
import './MachineLearningPanel.css';
import { DataContext } from '../../context/DataContext';

const MachineLearningPanel = () => {
  const { mlPrepStatus } = useContext(DataContext);
  const isReady = mlPrepStatus?.ready;
  const modelLabel = mlPrepStatus?.modelLabel || null;
  const datasetId = mlPrepStatus?.datasetId || null;
  const requiresTarget = mlPrepStatus?.requiresTarget;
  const targetColumn = mlPrepStatus?.targetColumn || null;

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
              </div>
            )}
          </div>

          <button type="button" className="machine-learning-action" disabled>
            Train Model (Coming Soon)
          </button>
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
