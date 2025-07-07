import React, { useState, useEffect } from 'react';
import {
  Dialog,
  Grid2,
  DialogActions,
  DialogContent
} from '@mui/material';
import { FaChartBar, FaChartLine, FaChartPie, FaChartArea } from 'react-icons/fa';
import { FcDoughnutChart } from "react-icons/fc";
import CloseButton from '../button_components/CloseButton';
import CleanedButton from '../button_components/CleanedButton';
import '../css/chart_css/DataVisualizations.css'; // Import the premium CSS

const chartTypes = [
  { type: 'Bar', Icon: FaChartBar },
  { type: 'Line', Icon: FaChartLine },
  { type: 'Pie', Icon: FaChartPie },
  { type: 'Scatter', Icon: FaChartArea },
  { type: 'Doughnut', Icon: FcDoughnutChart }
];

function DataVisualizations({ onDataCleaned, setShowDataVisual, onSelectChart, uploadedData, setCleanedData }) {
  const [errorMessage, setErrorMessage] = useState(null);

  // Validate onDataCleaned
  useEffect(() => {
    if (!onDataCleaned ) {
      setErrorMessage('Please have cleaned data available to visualize.');
    } else {
      setErrorMessage(null);
    }
  }, [onDataCleaned]);

  const handleSelectChartType = (chartType) => {
    if (!onDataCleaned || onDataCleaned.length === 0) {
      alert("No cleaned data available. Please clean your data or click 'Data Is Clean'.");
      return;
    }
    onSelectChart(chartType);
    setShowDataVisual(false); // Close the modal after selection
  };

  return (
    <div className="data-visuals">
      <Dialog
        open={true}
        onClose={() => setShowDataVisual(false)}
        maxWidth="sm"
        fullWidth
      >
        <div className="dialog-container">
          {/* Modal Header */}
          <div className="dialog-header">
            <h6>Select a Chart Type</h6>
            <button
              onClick={() => setShowDataVisual(false)}
              className="dialog-close-btn"
            >
              ✕
            </button>
          </div>

          {/* Display Error Message and "Data Is Clean" Button */}
          {errorMessage && (
            <div className="error-container">
              <div className="error-message">{errorMessage}</div>
              <CleanedButton
                uploadedData={uploadedData}
                setCleanedData={setCleanedData}
 
              />
            </div>
          )}

          {/* Grid2 Layout for Chart Options */}
          <DialogContent>
            <Grid2 container spacing={2} justifyContent="center">
              {chartTypes.map(({ type, Icon }) => (
                <Grid2 xs={4} key={type}>
                  <div
                    className={`chart-thumbnail ${!onDataCleaned ? 'disabled' : ''}`}
                    onClick={() => handleSelectChartType(type)}
                    style={{ pointerEvents: onDataCleaned ? 'auto' : 'none' }}
                  >
                    <Icon size={40} />
                    <div className="chart-thumbnail-label">{type}</div>
                  </div>
                </Grid2>
              ))}
            </Grid2>
          </DialogContent>

          {/* Modal Footer */}
          <DialogActions className="dialog-actions">
            <CloseButton onClick={() => setShowDataVisual(false)} />
          </DialogActions>
        </div>
      </Dialog>
    </div>
  );
}

export default DataVisualizations;
