// File: App.jsx
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
import useLoadRawData from './hooks/useLoadRawData';
// ⛔️ Removed: import DataStoryPanel from './components/DataStoryPanel';
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

const parseRecords = (source) => {
  if (!source) return [];
  if (Array.isArray(source)) return source;
  if (typeof source === 'string') {
    try {
      return JSON.parse(source);
    } catch (err) {
      console.error('Failed to parse dataset payload:', err);
      return [];
    }
  }
  return [];
};

function App() {
const {
  uploadedData, setUploadedData,
  fullData, setFullData,
  cleanedData, setCleanedData,
  pipelineResults, setPipelineResults,
  aiReportReady, setAiReportReady,
  showAiReport, setShowAiReport
} = useContext(DataContext);



  console.log("App.jsx received uploadedData:", uploadedData);

  // Standard charting state
  const [selectedStat, setSelectedStat] = useState(null);
  // const [cleanedData, setCleanedData] = useState(null);
  const [chartData, setChartData] = useState(null);
  //const [chartType, setChartType] = useState('Bar');
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
  const [showRawViewer, setShowRawViewer] = useState(false);
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
  const [storyModel, setStoryModel] = useState('openai');
  const [showStoryPanel, setShowStoryPanel] = useState(false);
  const [outputWindows, setOutputWindows] = useState([]);
  const [rawUploadFile, setRawUploadFile] = useState(null);

  // 🔁 Auto-load fullData for RawDataViewer when viewer is opened
 useLoadRawData(showRawViewer, rawUploadFile, setFullData);

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
    console.log("App render raw data viewer:", showRawViewer);
  }, [showRawViewer]);
  
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
      dataFields: [yAxis || 'defaultData'],
    });
    if (transformed) {
      setChartData(transformed);
      console.log('Chart data transformed successfully.');
    } else {
      console.error('Failed to transform data.');
      setChartData(null);
    }
  }, [xAxis, yAxis]);

// App.jsx — update inside handleFileUpload (carefully scoped)
const handleFileUpload = useCallback((raw, file = null) => {
  const previewRows = parseRecords(raw?.data_preview).slice(0, 5);
  const datasetRows = parseRecords(raw?.full_data ?? raw?.raw_data);
  const finalDataset = datasetRows.length ? datasetRows : previewRows;

  setUploadedData({ data_preview: previewRows });
  setFullData(finalDataset);
  setCleanedData(finalDataset);
  console.log('App.jsx storing fullData rows:', Array.isArray(finalDataset) ? finalDataset.length : 0);
  setShowDataPreview(true);

  if (file) setRawUploadFile(file);
}, [setUploadedData, setFullData, setCleanedData]);


  const handleApiData = (data) => {
    const previewSource = Array.isArray(data) ? data : parseRecords(data?.data_preview);
    const previewRows = previewSource.slice(0, 5);
    const datasetRows = parseRecords(data?.full_data ?? data?.raw_data);
    const finalDataset = datasetRows.length ? datasetRows : previewRows;

    setUploadedData({ data_preview: previewRows });
    setFullData(finalDataset);
    setCleanedData(finalDataset);
    console.log('App.jsx storing fullData rows:', Array.isArray(finalDataset) ? finalDataset.length : 0);
    setShowDataPreview(true);
  };

  const handleDatabaseData = (data) => {
    const previewRows = parseRecords(data?.data_preview).slice(0, 5);
    const datasetRows = parseRecords(data?.full_data ?? data?.raw_data);
    const finalDataset = datasetRows.length ? datasetRows : previewRows;

    setUploadedData({ data_preview: previewRows });
    setFullData(finalDataset);
    setCleanedData(finalDataset);
    console.log('App.jsx storing fullData rows:', Array.isArray(finalDataset) ? finalDataset.length : 0);
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

  const handleCloseRawViewer = useCallback(() => {
    setShowRawViewer(false);
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

  const handleStoryModelChange = (newModel) => {
    console.log("Switching story model to:", newModel);
    setStoryModel(newModel);
  };

  // const handleDataViewerChange = (newViewer) => {
  //   console.log("Switching my data viewer to:", newViewer);
  //   setShowRawViewer(newViewer);
  // };

  const handleFieldDrop = useCallback(
    (axis, field) => {
      setChartMapping((prev) => {
        const updated = { ...prev };
        if (axis === 'x') {
          setXAxis(field);
          updated['X-Axis'] = field;
        } else if (axis === 'y') {
          setYAxis(field);
          updated['Y-Axis'] = field;
        }

        if (
          cleanedData &&
          updated['X-Axis'] &&
          updated['Y-Axis']
        ) {
          const transformed = transformToChartData(cleanedData, {
            labelField: updated['X-Axis'],
            dataFields: [updated['Y-Axis']],
          });
          setChartData(transformed);
        }

        return updated;
      });
    },
    [cleanedData]
  );

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
            setShowRawViewer={setShowRawViewer}
            setStoryData={setStoryData}
            setShowStoryPanel={setShowStoryPanel}
            showWhiteBoard={showWhiteBoard}
            setShowWhiteBoard={setShowWhiteBoard}
            onStoryModelChange={handleStoryModelChange} // new model selection
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
                chartData={chartData} // ✅ ADD THIS
                showWhiteBoard={showWhiteBoard}
                setShowWhiteBoard={setShowWhiteBoard}
                pipelineResults={pipelineResults} 
                setPipelineResults={setPipelineResults}
                outputWindows={outputWindows}
                setOutputWindows={setOutputWindows}
                showAiReport={showAiReport}
                onCloseAiReport={handleAiReportClose}
                storyModel={storyModel}
                showRawViewer={showRawViewer}
                handleCloseRawViewer={handleCloseRawViewer}

              >
                {/* ⬇️ Keep other children that should render inside the Data Preview window */}
                <DatasetInfo selectedStat={selectedStat} />

                {/* ⛔️ Removed: duplicate DataStoryPanel child render */}
                {/*
                {showStoryPanel && (
                  <DataStoryPanel
                    uploadedData={uploadedData}
                    cleanedData={cleanedData}
                    model={storyModel}
                  />
                )}
                */}
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
