import React, { useContext } from 'react';
import './MachineLearningPanel.css';
import { DataContext } from '../../context/DataContext';

const MachineLearningPanel = () => {
  const { mlPrepStatus } = useContext(DataContext);

  return (
    <div className="machine-learning-panel">
      <h2>Machine Learning</h2>
      {mlPrepStatus?.ready ? (
        <p>
          Dataset is ready for <strong>{mlPrepStatus.modelLabel}</strong>.
        </p>
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
