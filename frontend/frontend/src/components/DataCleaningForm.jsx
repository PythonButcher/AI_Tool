import React, { useState, useContext } from 'react';
import axios from 'axios';
import './css/DataCleaningForm.css';
import CloseButton from './button_components/CloseButton'; // Reusable CloseButton component
import FileExport from './FileExport';
import { DataContext } from '../context/DataContext'; // Import the context

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function DataCleaningForm({ closeForm, setShowDataPreview }) {
  const { uploadedData, setCleanedData } = useContext(DataContext); // Use context to access global state
  const [cleaningTask, setCleaningTask] = useState('');
  const [fillValue, setFillValue] = useState('');
  const [cleanedPreview, setCleanedPreview] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  console.log("Current uploadedData:", uploadedData);


  const handleCleaningTaskChange = (e) => {
    setCleaningTask(e.target.value);
    setErrorMessage(null);
    setFillValue('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!cleaningTask) {
      setErrorMessage('Please select a cleaning task before submitting.');
      return;
    }

    const requestData = { task: cleaningTask };

    if (cleaningTask === 'fill_nulls') {
      if (!fillValue.trim()) {
        setErrorMessage('Please provide a value to fill nulls.');
        return;
      }
      requestData.fill_value = fillValue.trim();
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await axios.post(`${API_URL}/api/cleaning`, requestData);
      console.log('Cleaning API Response:', response.data); // Log full response
      const { cleaned_preview, cleaned_data } = response.data;

      if (!Array.isArray(cleaned_preview) || !Array.isArray(cleaned_data)) {
        throw new Error('Invalid data structure received from the server.');
      }

      setCleanedPreview(cleaned_preview);
      setCleanedData(cleaned_data);
    } catch (error) {
      console.error('Error cleaning data:', error);
      setErrorMessage(
        error.response?.data?.message ||
        error.message ||
        'Failed to clean data.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cleaning-form-overlay">
      <div className="data-cleaning-form">
        {/* Close Button for the Entire Form */}
        <CloseButton onClick={closeForm} />

        {errorMessage && <div className="error-message">{errorMessage}</div>}

        <div className="data-cleaning-dropdown-container">
          <label htmlFor="cleaning-task-select">Select Cleaning Task:</label>
          <select
            id="cleaning-task-select"
            value={cleaningTask}
            onChange={handleCleaningTaskChange}
            disabled={loading}
          >
            <option key="default" value="">-- Select Task --</option>
            <option key="remove_nulls" value="remove_nulls">Remove Nulls</option>
            <option key="fill_nulls" value="fill_nulls">Fill Nulls with Value</option>
            <option key="standardize" value="standardize">Standardize Data</option>
            <option key="remove_outliers" value="remove_outliers">Remove Outliers</option>
          </select>
        </div>

        {cleaningTask === 'fill_nulls' && (
          <div className="input-container">
            <label htmlFor="fill-value">Fill Value:</label>
            <input
              id="fill-value"
              type="text"
              value={fillValue}
              onChange={(e) => setFillValue(e.target.value)}
              placeholder="Enter value to fill nulls"
              disabled={loading}
            />
          </div>
        )}

        <button
          onClick={handleSubmit}
          className="submit-button"
          disabled={loading || !cleaningTask}
        >
          {loading ? 'Processing...' : 'Apply Cleaning Task'}
        </button>


        {/* Display cleaned data preview */}
        {cleanedPreview && cleanedPreview.length > 0 && (
          <div className="stats-container">
            <h3>Cleaned Data Preview</h3>
            <div className="uploaded-data-preview">
              <table className="data-table">
                <thead>
                  <tr>
                    {Object.keys(cleanedPreview[0] || {}).map((key) => (
                      <th key={key}>{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cleanedPreview.map((row, index) => (
                    <tr key={index}>
                      {Object.values(row).map((value, idx) => (
                        <td key={idx}>{value}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Include FileExport Component */}
            <FileExport data={cleanedPreview} />
          </div>
        )}

        {!cleanedPreview && !loading && (
          <div className="no-data-message">
            No preview available. Perform a cleaning task to see results.
          </div>
        )}
      </div>
    </div>
  );
}

export default DataCleaningForm;
