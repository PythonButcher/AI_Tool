import React, { useState, useCallback, useEffect, useContext } from 'react';
import MenuBar from './components/MenuBar';
import CanvasContainer from './components/CanvasContainer';
import DatasetInfo from './components/DatasetInfo';
import SideBar from './components/SideBar';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import DataCleaningForm from './components/DataCleaningForm';
import DataVisualizations from './components/chart_components/DataVisualization';
import { transformToChartData } from './utils/chartDataUtils';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import AIChat from './components/ai_ml_components/AIChat';
import { DataContext } from './context/DataContext';
import DataStoryPanel from './components/DataStoryPanel';
import DataFilterPanel from './components/DataFilterPanel';
import './App.css';

// Define a custom theme using Material-UI's theming capability
const theme = createTheme({
  palette: {
    primary: {
      main: '#b0b0b0', // Nintendo grey
    },
    secondary: {
      main: '#5a5a5a', // Darker grey
    },
  },
});

function App() {
  const { uploadedData, setUploadedData, setFullData, pipelineResults, setPipelineResults, aiReportReady, setAiReportReady, showAiReport, setShowAiReport } = useContext(DataContext);
  console.log("App.jsx received uploadedData:", uploadedData);

  // Standard charting state
  const [selectedStat, setSelectedStat] = useState(null);
  const [cleanedData, setCleanedData] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [chartType, setChartType] = useState('Bar');
  const [chartMapping, setChartMapping] = useState({});   // { 'X-Axis': 'Region', 'Y-Axis': 'Sales' }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );


  // AI charting state (separate from standard)
  const [aiChartData, setAiChartData] = useState(null);
  const [aiChartType, setAiChartType] = useState('Bar');

  // whiteboard and other non chart visual tools
  const [showWhiteBoard, setShowWhiteBoard] = useState(null)
  const [openDataFilter, setOpenDataFilter] = useState(false)

  // UI & interaction state
  const [xAxis, setXAxis] = useState(null);
  const [yAxis, setYAxis] = useState(null);
  const [showDataPreview, setShowDataPreview] = useState(false);
  const [showCanvasContainer, setShowCanvasContainer] = useState(true);
  const [showDataVisual, setShowDataVisual] = useState(false);
  const [selectedChartType, setSelectedChartType] = useState(null);
  const [showChartWindow, setShowChartWindow] = useState(false);
  const [showAIChart, setShowAIChart] = useState(false);
  const [showCleaningForm, setShowCleaningForm] = useState(false);
  const [showAiWorkflow, setShowAiWorkflow] = useState(false);
  const [showCanvasMinimized, setShowCanvasMinimized] = useState(false);
  const [previewMode, setPreviewMode] = useState('table'); // "table" or "json"
  const [storyData, setStoryData] = useState(undefined);
  const [showStoryPanel, setShowStoryPanel] = useState(false);
  const [outputWindows, setOutputWindows] = useState([]);

  

  useEffect(() => {
    if (uploadedData) {
      setShowChartWindow(true);
      setShowDataPreview(true);
    }
  }, [uploadedData]);

  useEffect(() => {
    console.log("Sidebar render cleanedData:", uploadedData);
  }, [uploadedData]);
  
useEffect(() => {
  console.log("📉 Filtered data:", openDataFilter);
}, [openDataFilter]);

  // Notify when AI report has been generated
  useEffect(() => {
    if (pipelineResults?.ai_report?.status === 'success') {
      setAiReportReady(true);
    }
  }, [pipelineResults, setAiReportReady]);


  useEffect(() => {
    console.log("📊 showAIChart state changed:", showAIChart);
  }, [showAIChart]);

  // Standard chartData transformation (NOT AI)
  useEffect(() => {
    if (
      !cleanedData ||
      !chartMapping['X-Axis'] ||
      !chartMapping['Y-Axis']
    ) {
      console.warn('Missing dependencies for chartData transformation.');
      return;
    }
  
    const transformed = transformToChartData(cleanedData, {
      labelField: chartMapping['X-Axis'] || chartMapping['Category'],
      dataFields: [chartMapping['Y-Axis'] || chartMapping['Value']],
    });
  
    if (transformed) {
      setChartData(transformed);
    } else {
      setChartData(null);
    }
  }, [cleanedData, chartMapping]);
  

  const closeCleaningForm = () => setShowCleaningForm(false);

  const handleStatsSelect = useCallback((statType) => {
    setSelectedStat(statType);
  }, []);

  const handleDataCleaned = useCallback((newData) => {
    if (!newData || newData.length === 0) {
      console.error('No data to clean.');
      setCleanedData(null);
      setChartData(null);
      return;
    }
    console.log('Cleaning data triggered:', newData);
    setCleanedData(newData);

    const transformed = transformToChartData(newData, {
      labelField: xAxis || 'defaultLabel',
      dataField: yAxis || 'defaultData',
    });
    if (transformed) {
      setChartData(transformed);
      console.log('Chart data transformed successfully.');
    } else {
      console.error('Failed to transform data.');
      setChartData(null);
    }
  }, [xAxis, yAxis]);

  const handleFileUpload = useCallback((raw) => {
    // raw is whatever the backend returns
    setUploadedData(raw);                       // preview for UI
    const allRows =
      Array.isArray(raw)                  ? raw
      : Array.isArray(raw?.data_preview)  ? raw.data_preview
      : typeof raw?.data_preview === 'string'
        ? JSON.parse(raw.data_preview)
        : [];
    setFullData(allRows);                     // store full data
    setCleanedData(allRows);                  // initialize cleanedData for charting
    setShowDataPreview(true);
  }, [setUploadedData, setFullData, setCleanedData]);

  const handleApiData = (data) => {
    setUploadedData({
      data_preview: Array.isArray(data) ? data : [data], // ✅ Ensures correct format
    });
    setShowDataPreview(true);  // ✅ Triggers preview window
  };

  const handleDatabaseData = (data) => {
    setUploadedData({
      data_preview: Array.isArray(data?.data_preview) ? data.data_preview : []
    });
    setShowDataPreview(true);
  };
  

  const handleSidebarButtonClick = useCallback((action) => {
    if (action === 'visualize') {
      setShowDataVisual(true);
    }
  }, []);

  const handleClosePreview = useCallback(() => {
    setShowDataPreview(false);
  }, []);

  const handleCloseCanvas = useCallback(() => {
    setShowCanvasContainer(false);
  }, []);

  const handleCanvasMinimize = useCallback(() => {
    setShowCanvasMinimized(prev => !prev);
  }, []);

  const handleAiReportOpen = useCallback(() => {
    setShowAiReport(true);
    setAiReportReady(false);
  }, []);

  const handleAiReportClose = useCallback(() => {
    setShowAiReport(false);
    setAiReportReady(false);
  }, []);
  

  const handleChartSelection = useCallback((chartType) => {
    console.log('Chart type selected:', chartType);
    setSelectedChartType(chartType);
    setShowChartWindow(true);
    setShowDataVisual(false);
  }, []);

  const handleCloseChartWindow = useCallback(() => {
    console.log('Closing chart window');
    setShowChartWindow(false);
  }, []);

  const handleFieldDrop = useCallback((axis, field) => {
    if (axis === 'x') {
      setXAxis(field);
      setChartMapping(prev => ({ ...prev, 'X-Axis': field }));
    } else if (axis === 'y') {
      setYAxis(field);
      setChartMapping(prev => ({ ...prev, 'Y-Axis': field }));
    }
  }, []);

  // Handle drag end events, mapping dropped field to the correct axis
  const handleDragEnd = useCallback(({ active, over }) => {
    // Only handle drops on valid targets when dragging a field
    if (!over || active.data?.current?.type !== 'field') return;
    const fieldName = active.data.current.field;

    // Prefer droppable metadata but fall back to id parsing
    let axis = over.data?.current?.axis;
    if (!axis) {
      const id = over.id?.toString().toLowerCase();
      if (id?.includes('x')) axis = 'x';
      else if (id?.includes('y')) axis = 'y';
    }

    if (axis === 'x') {
      handleFieldDrop('x', fieldName);
    } else if (axis === 'y') {
      handleFieldDrop('y', fieldName);
    }
  }, [handleFieldDrop]);


  return (
    <ThemeProvider theme={theme}>
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="app-container">
          {/* Sidebar with actions and data cleaning */}
          <SideBar
            onButtonClick={handleSidebarButtonClick}
            onDataCleaned={handleDataCleaned}
            uploadedData={uploadedData}
            cleanedData={cleanedData}
            showAiWorkflow={showAiWorkflow}
            setShowAiWorkflow={setShowAiWorkflow}
            setShowDataPreview={setShowDataPreview}
            setStoryData={setStoryData}
            setShowStoryPanel={setShowStoryPanel}
            showWhiteBoard={showWhiteBoard}
            setShowWhiteBoard={setShowWhiteBoard}
          />

          <div className="main-content">
            {/* Top menu bar with file upload and statistics selection */}
            <MenuBar
              onFileUploadSuccess={handleFileUpload}
              onStatsSelect={handleStatsSelect}
              showDataPreview={showDataPreview}
              setShowDataPreview={setShowDataPreview}
              handleApiData={handleApiData}
              handleDatabaseData={handleDatabaseData}
              setOpenDataFilter={setOpenDataFilter}
              aiReportReady={aiReportReady}
              onAiReportClick={handleAiReportOpen}
            />

            <DataFilterPanel openDataFilter={openDataFilter} setOpenDataFilter={setOpenDataFilter} />

            {/* Data Visualization Component (conditionally rendered) */}
            {showDataVisual && (
              <DataVisualizations
                onDataCleaned={cleanedData}
                setShowDataVisual={setShowDataVisual}
                setCleanedData={setCleanedData}
                uploadedData={uploadedData}
                onSelectChart={handleChartSelection}
              />
            )}
        
            {/* Data Cleaning Form */}
            {showCleaningForm && (
              <DataCleaningForm
                uploadedData={uploadedData}
                setCleanedData={setCleanedData}
                setShowDataPreview={setShowDataPreview}
                closeForm={closeCleaningForm}
              />
            )}

            {/* Canvas Container wraps multiple display components */}
            {showCanvasContainer && (
                <CanvasContainer
                  showAiWorkflow={showAiWorkflow}  // ✅ Pass state down
                  setShowAiWorkflow={setShowAiWorkflow}
                  uploadedData={uploadedData || null}
                  showDataPreview={showDataPreview}
                  previewMode={previewMode}              
                  setPreviewMode={setPreviewMode}
                  setShowDataPreview={setShowDataPreview}
                  handleClosePreview={handleClosePreview}
                  handleCloseCanvas={handleCloseCanvas}
                  cleanedData={cleanedData}
                  selectedChartType={selectedChartType}
                  handleCloseChartWindow={handleCloseChartWindow}
                  showChartWindow={showChartWindow}
                  showAIChart={showAIChart}
                  setShowAIChart={setShowAIChart}
                  setAiChartType = {setAiChartType}
                  aiChartData={aiChartData}
                  aiChartType={aiChartType}
                  showCanvasMinimized={showCanvasMinimized}
                  setShowCanvasMinimized={setShowCanvasMinimized}
                  handleCanvasMinimize={handleCanvasMinimize}
                  chartMapping={chartMapping}                // ✅ NEW
                  storyData={storyData}
                  setStoryData={setStoryData}
                  showStoryPanel={showStoryPanel}
                  setShowStoryPanel={setShowStoryPanel}
                  setAiChartData={setAiChartData}
                  showWhiteBoard={showWhiteBoard}
                  setShowWhiteBoard={setShowWhiteBoard}
                  pipelineResults={pipelineResults} 
                  setPipelineResults={setPipelineResults}
                  outputWindows={outputWindows}
                  setOutputWindows={setOutputWindows}
                  showAiReport={showAiReport}
                  onCloseAiReport={handleAiReportClose}
                  >
                    
                  {/* Dataset information displayed within the CanvasContainer */}
                 <DatasetInfo selectedStat={selectedStat} />
                  {/* Render the AI-generated story panel if requested */}
                  {showStoryPanel && (
                  <DataStoryPanel
                    uploadedData={uploadedData}
                    cleanedData={cleanedData} // optional if used
                  />
                )}
                </CanvasContainer>
                                
                )}
              </div>

          {/* AI Chat component for interacting with AI */}
          <AIChat
            setShowAIChart={setShowAIChart}
            setAiChartType={setAiChartType}
            setAiChartData={setAiChartData}
          />
          
        </div>
        </DndContext>
    </ThemeProvider>
  );
}

export default App;
