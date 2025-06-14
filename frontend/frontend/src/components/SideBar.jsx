import React, { useState } from 'react';
import {
  FaBroom,
  FaChartBar,
  FaBook,
  FaFileExport,
  FaCog,
  FaColumns,
  FaTable,
  FaPen,
} from 'react-icons/fa';
import { FcWorkflow } from "react-icons/fc";
import './css/SideBar.css';
import DataCleaningForm from './DataCleaningForm';
import FileExport from './FileExport';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';


const SideBar = ({ onButtonClick, onDataCleaned, 
                  cleanedData, setShowDataPreview, 
                  setStoryData,setShowAiWorkflow, setShowStoryPanel,
                   setShowWhiteBoard}) => {
  const [showCleaningForm, setShowCleaningForm] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [showFieldsPanel, setShowFieldsPanel] = useState(false); // Toggle for FieldsPanel


  console.log('cleanedData in SideBar:', cleanedData);
  console.log("Type of cleanedData:", typeof cleanedData);
  if (!cleanedData) {
    console.warn("cleanedData is NULL or UNDEFINED in SideBar.");
}
  // Toggles DataCleaningForm visibility
  const handleDataCleaningClick = () => {
    setShowCleaningForm((prev) => !prev);
  };

  // Closes the DataCleaningForm
  const closeDataCleaningForm = () => {
    setShowCleaningForm(false);
  };

  // Toggles the export dropdown visibility
  const toggleExportDropdown = () => {
    setShowExportDropdown((prev) => !prev);
  };

  // Toggles FieldsPanel visibility
  const toggleFieldsPanel = () => {
    setShowFieldsPanel((prev) => !prev);
  };

  const handleGenerateStory = () => {
    console.log("📖 Generate Story button clicked");
    // Reset storyData to null to trigger a new fetch in DataStoryPanel's useEffect
    setStoryData(null);
    // Explicitly show the story panel
    setShowStoryPanel(true);
  };

  const handleWhiteBoard = () => {
   console.log("🔳 Open the whiteboard");
   setShowWhiteBoard(true); // ensures it's explicitly turned on
 };

  
  const parsedDataPreview = cleanedData?.data_preview
  ? JSON.parse(cleanedData.data_preview)
  : [];

  const fields = parsedDataPreview.length > 0
  ? Object.keys(parsedDataPreview[0])
  : [];

console.log("Extracted fields:", fields);

  return (
    <div className="sidebar-container">

     {/* DatasetInfo Button */}
        <div
          className="sidebar-button"
          data-tooltip="Data Summary"
          onClick={() => setShowDataPreview(true)}
        >
          <FaTable className="sidebar-button-icon" />
        </div>

      {/* Data Cleaning Button */}
      <div
        className="sidebar-button"
        data-tooltip="Data Cleaning"
        onClick={handleDataCleaningClick}
      >
        <FaBroom className="sidebar-button-icon" />
      </div>

      {/* Data Visualization Button */}
      <div
        className="sidebar-button"
        data-tooltip="Data Visualization"
        onClick={() => onButtonClick('visualize')} // Trigger visualization action
      >
        <FaChartBar className="sidebar-button-icon" />
      </div>

       {/* AI workflow*/}
       <div
        className="sidebar-button"
        data-tooltip="AI Workflow Lab"
        onClick={() => setShowAiWorkflow(prev => !prev)} // clearly toggles visibility
    >
        <FcWorkflow className="sidebar-button-icon" />
    </div>
    
      {/* Generate Storyboard Button */}
      <div
        className="sidebar-button"
        data-tooltip="Generate Story"
        onClick={handleGenerateStory}
      >
        <FaBook className="sidebar-button-icon" />
      </div>

      {/* Generate White Board */}
      <div
        className="sidebar-button"
        data-tooltip="White Board"
        onClick={handleWhiteBoard}
      >
        <FaPen className="sidebar-button-icon" />
      </div>

      {/* Export Data Button */}
      <div className="sidebar-button" data-tooltip="Export Data">
        <FaFileExport
          className="sidebar-button-icon"
          onClick={toggleExportDropdown}
        />
        {showExportDropdown && (
          <div className="export-dropdown">
            <FileExport />
          </div>
        )}
      </div>

      {/* Settings Button */}
      <div className="sidebar-button" data-tooltip="Settings">
        <FaCog className="sidebar-button-icon" />
      </div>

      {/* Toggle Fields Panel Button */}
      <div
        className="sidebar-button"
        data-tooltip="Toggle Fields Panel"
        onClick={toggleFieldsPanel}
      >
        <FaColumns className="sidebar-button-icon" />
      </div>

      {/* FieldsPanel */}
      {showFieldsPanel && fields.length > 0 && (
        <Paper className="fields-panel" elevation={3}>
          <h3 className="fields-panel-header">Fields in Dataset</h3>
          <Grid container spacing={2}>
            {fields.map((field) => (
              <Grid item xs={12} key={field}>
                <Paper
                  elevation={1}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', field)}
                  className="fields-panel-item"
                >
                  {field}
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      {/* Render DataCleaningForm when visible */}
      {showCleaningForm && (
        <DataCleaningForm
          setCleanedData={onDataCleaned}
          closeForm={closeDataCleaningForm}
        />
      )}
    </div>
  );
};

export default SideBar;
