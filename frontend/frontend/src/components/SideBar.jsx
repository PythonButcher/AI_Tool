import React, { useState } from 'react';
import OutsideClickWrapper from '../utils/OutsideClickWrapper';
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
import { AiOutlineEye } from "react-icons/ai";
import { BiSpreadsheet } from "react-icons/bi";
import { SiGooglegemini } from "react-icons/si";
import { PiOpenAiLogo } from "react-icons/pi";
import './css/SideBar.css';
import DataCleaningForm from './DataCleaningForm';
import FileExport from './FileExport';
import FieldsPanel from './FieldsPanel';



const SideBar = ({ onButtonClick, onDataCleaned, 
                   cleanedData, setShowDataPreview, setShowRawViewer,
                   setStoryData,setShowAiWorkflow,
                   setShowStoryPanel, setShowWhiteBoard,
                   storyModel, onStoryModelChange }) => {
  const [showCleaningForm, setShowCleaningForm] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
//  const [showDataViewerDropdown, setShowDataViewerDropdown] = useState(false);
  const [showFieldsPanel, setShowFieldsPanel] = useState(false); // Toggle for FieldsPanel
  const [showModelOptions, setShowModelOptions] = useState(false);
  const [showDataViewerOptions, setShowDataViewerOptions] = useState(false)
               
                  
  console.log('cleanedData in SideBar:', cleanedData);
  console.log("Type of cleanedData:", typeof cleanedData);
  if (!cleanedData) {
    console.warn("cleanedData is NULL or UNDEFINED in SideBar.");
    console.log('AI Models available:', storyModel)
    console.log('Here are the data viewer options: ', showDataViewerOptions)
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

  // Toggles the DataView dropdown visibility
  //const toggleDataViewerDropdown = () => {
   // setShowDataViewerDropdown((prev) => !prev);
//  };

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

  
  const parsedDataPreview = Array.isArray(cleanedData)
    ? cleanedData
    : Array.isArray(cleanedData?.data_preview)
    ? cleanedData.data_preview
    : typeof cleanedData?.data_preview === 'string'
    ? JSON.parse(cleanedData.data_preview)
    : [];

  const fields = parsedDataPreview.length > 0
    ? Object.keys(parsedDataPreview[0])
    : [];

console.log("Extracted fields:", fields);

  return (
    <div className="sidebar-container">


{/* Data Viewer Button */}
<div
  className="sidebar-button"
  data-tooltip="Data Viewer"
  aria-haspopup="menu"
  aria-expanded={showDataViewerOptions}
  onClick={() => setShowDataViewerOptions(prev => !prev)}
>
  <FaTable className="sidebar-button-icon" />
</div>

{/* Data Viewer Options Submenu */}
{showDataViewerOptions && (
  <OutsideClickWrapper onOutsideClick={() => setShowDataViewerOptions(false)}>
    <div className="data-choice-menu">
      <div
        className="sidebar-subbutton"
        data-tooltip="Data Preview"
        onClick={() => {
          setShowDataPreview(true);      // existing feature
          setShowDataViewerOptions(false);
        }}
      >
        <AiOutlineEye className="sidebar-button-icon" />
      </div>

      <div
        className="sidebar-subbutton"
        data-tooltip="Raw data"
        onClick={() => {
          setShowRawViewer(true);        // new feature
          setShowDataViewerOptions(false);
          console.log('clicked raw → calling', setShowRawViewer(true))
        }}
      >
        <BiSpreadsheet className="sidebar-button-icon" />
      </div>
    </div>
  </OutsideClickWrapper>
)}


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
        onClick={() => setShowModelOptions(prev => !prev)}
      >
        <FaBook className="sidebar-button-icon" />
      </div>

      {/* Model Options Submenu */}
      {showModelOptions && (
        <OutsideClickWrapper onOutsideClick={() => setShowModelOptions(false)}>
        <div className="model-choice-menu">
          <div
            className="sidebar-subbutton"
            data-tooltip="Use OpenAI"
            onClick={() => {
              onStoryModelChange("openai");
              handleGenerateStory();
              setShowModelOptions(false);
            }}
          >
            <PiOpenAiLogo className="sidebar-button-icon" />
          </div>

          <div
            className="sidebar-subbutton"
            data-tooltip="Use Gemini"
            onClick={() => {
              onStoryModelChange("gemini");
              handleGenerateStory();
              setShowModelOptions(false);
            }}
          >
            <SiGooglegemini className="sidebar-button-icon" />
          </div>
        </div>
        </OutsideClickWrapper>
      )}

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
        <OutsideClickWrapper onOutsideClick={() => setShowExportDropdown(false)}>
        <FaFileExport
          className="sidebar-button-icon"
          onClick={toggleExportDropdown}
        />
        {showExportDropdown && (
          <div className="export-dropdown">
            <FileExport />
          </div>
        )}
        </OutsideClickWrapper>
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

        {/* Render DataCleaningForm when visible */}
      {showCleaningForm && (
        <DataCleaningForm
          setCleanedData={onDataCleaned}
          closeForm={closeDataCleaningForm}
          />
      )}

      {/* FieldsPanel wrapped to close on outside click */}
      {showFieldsPanel && fields.length > 0 && (
        <OutsideClickWrapper onOutsideClick={() => setShowFieldsPanel(false)}>
          <FieldsPanel cleanedData={parsedDataPreview} />
        </OutsideClickWrapper>
      )}

          </div>
        );
};

export default SideBar;
