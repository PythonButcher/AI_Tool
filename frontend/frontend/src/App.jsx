// File: App.jsx
import React, { useState, useCallback, useEffect, useContext } from 'react';
import MenuBar from './components/layout/MenuBar';
import CanvasContainer from './components/layout/CanvasContainer';
import DatasetInfo from './components/insights/DatasetInfo';
import SideBar from './components/layout/SideBar';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import DataVisualizations from './features/charts/DataVisualization';
import { transformToChartData } from './utils/chartDataUtils';
import AIChat from './features/ai/AIChat';
import { DataContext } from './context/DataContext';
import { ThemeContext, ThemeProvider } from './context/ThemeContext';
import { WarehouseProvider } from './context/WarehouseContext';
import { HelpOverlayProvider } from './context/HelpOverlayContext';
import useLoadRawData from './hooks/useLoadRawData';
import Snowfall from 'react-snowfall';
// ⛔️ Removed: import DataStoryPanel from './components/DataStoryPanel';
import DataFilterPanel from './components/data_management/DataFilterPanel';
import './App.css';
import { MuiThemeContext } from './context/MuiThemeContext';
import { WindowProvider, useWindowContext } from './context/WindowContext';


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

// Main Content Component
function AppContent() {
  const {
    uploadedData, setUploadedData,
    setFullData,
    cleanedData, setCleanedData,
    pipelineResults, setPipelineResults,
    aiReportReady, setAiReportReady,
    showAiReport, setShowAiReport,
    setSemanticModel,
    refreshSemanticModelFromDataset,
  } = useContext(DataContext);

  const { theme } = useContext(ThemeContext); 

  const { charts, updateChart } = useWindowContext();

  console.log("App.jsx received uploadedData:", uploadedData);

  // Standard charting state
  const [selectedStat, setSelectedStat] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [chartMapping, setChartMapping] = useState({});
  const [xAxis, setXAxis] = useState(null);
  const [yAxis, setYAxis] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const [aiChartData, setAiChartData] = useState(null);
  const [aiChartType, setAiChartType] = useState('Bar');
  const [showWhiteBoard, setShowWhiteBoard] = useState(null)
  const [openDataFilter, setOpenDataFilter] = useState(false)
  const [showDataPreview, setShowDataPreview] = useState(false);
  const [showRawViewer, setShowRawViewer] = useState(false);
  const [showCanvasContainer, setShowCanvasContainer] = useState(true);
  const [showDataVisual, setShowDataVisual] = useState(false);
  const [selectedChartType, setSelectedChartType] = useState(null);
  const [showChartWindow, setShowChartWindow] = useState(false);
  const [showAIChart, setShowAIChart] = useState(false);
  const [showAiWorkflow, setShowAiWorkflow] = useState(false);
  const [showCanvasMinimized, setShowCanvasMinimized] = useState(false);
  const [previewMode, setPreviewMode] = useState('table');
  const [storyData, setStoryData] = useState(undefined);
  const [storyModel, setStoryModel] = useState('openai');
  const [showStoryPanel, setShowStoryPanel] = useState(false);
  const [outputWindows, setOutputWindows] = useState([]);
  const [rawUploadFile, setRawUploadFile] = useState(null);
  const [showMachineLearning, setShowMachineLearning] = useState(false);
  const [isSnowing, setIsSnowing] = useState(false);

  useLoadRawData(showRawViewer, rawUploadFile, setFullData);

  useEffect(() => { if (uploadedData) { setShowChartWindow(true); setShowDataPreview(true); } }, [uploadedData]);
  useEffect(() => { if (pipelineResults?.ai_report?.status === 'success') { setAiReportReady(true); } }, [pipelineResults, setAiReportReady]);

  // Old Chart Data Effect (Legacy)
  useEffect(() => {
    if (!cleanedData || !chartMapping['X-Axis'] || !chartMapping['Y-Axis']) return;
    const transformed = transformToChartData(cleanedData, {
      labelField: chartMapping['X-Axis'] || chartMapping['Category'],
      dataFields: [chartMapping['Y-Axis'] || chartMapping['Value']],
    });
    if (transformed) setChartData(transformed);
  }, [cleanedData, chartMapping]);


  // Callbacks
  const handleStatsSelect = useCallback((statType) => setSelectedStat(statType), []);

  const handleDataCleaned = useCallback((newData) => {
    if (!newData || newData.length === 0) { setCleanedData(null); setChartData(null); return; }
    setCleanedData(newData);
  }, [xAxis, yAxis]);

  const handleFileUpload = useCallback((raw, file = null) => {
    const previewRows = parseRecords(raw?.data_preview);
    const datasetRows = parseRecords(raw?.full_data ?? raw?.raw_data);
    const finalDataset = datasetRows.length ? datasetRows : previewRows;
    setUploadedData({
      data_preview: previewRows,
      semantic_model: raw?.semantic_model || null,
    });
    setFullData(finalDataset);
    setCleanedData(finalDataset);
    if (raw?.semantic_model) {
      setSemanticModel(raw.semantic_model);
    } else if (finalDataset.length > 0) {
      refreshSemanticModelFromDataset(finalDataset, {
        datasetName: file?.name || raw?.name,
        source: 'app_handle_upload',
      });
    }
    setShowDataPreview(true);
    if (file) setRawUploadFile(file);
  }, [setUploadedData, setFullData, setCleanedData, setSemanticModel, refreshSemanticModelFromDataset]);

  const handleApiData = (data) => {
    handleFileUpload(data);
  };
  const handleDatabaseData = (data) => {
    handleFileUpload(data);
  };

  const handleSidebarButtonClick = useCallback((action) => { if (action === 'visualize') setShowDataVisual(true); }, []);
  const handleClosePreview = useCallback(() => setShowDataPreview(false), []);
  const handleCloseRawViewer = useCallback(() => setShowRawViewer(false), []);
  const handleCloseCanvas = useCallback(() => setShowCanvasContainer(false), []);
  const handleCanvasMinimize = useCallback(() => setShowCanvasMinimized(prev => !prev), []);
  const handleAiReportOpen = useCallback(() => { setShowAiReport(true); setAiReportReady(false); }, []);
  const handleAiReportClose = useCallback(() => { setShowAiReport(false); setAiReportReady(false); }, []);
  const handleChartSelection = useCallback((chartType) => { setSelectedChartType(chartType); setShowChartWindow(true); setShowDataVisual(false); }, []);
  const handleCloseChartWindow = useCallback(() => setShowChartWindow(false), []);
  const handleStoryModelChange = (newModel) => setStoryModel(newModel);

  /* LEGACY ONE-CHART DROP HANDLER */
  const handleFieldDrop = useCallback((axis, field) => {
    setChartMapping((prev) => {
      const updated = { ...prev };
      if (axis === 'x') { setXAxis(field); updated['X-Axis'] = field; }
      else if (axis === 'y') { setYAxis(field); updated['Y-Axis'] = field; }
      return updated;
    });
  }, []);

  /* 🟢 MASTER DRAG HANDLER */
  const handleDragEnd = useCallback(({ active, over }) => {
    console.log("Drag End:", { active, over });

    // Only handle drops on valid targets when dragging a field
    if (!over || active.data?.current?.type !== 'field') {
      console.warn("Invalid drop:", { over, type: active.data?.current?.type });
      return;
    }

    const fieldName = active.data.current.field;
    const fieldType = active.data.current.fieldType;
    const allowedTypes = over.data?.current?.allowedTypes;

    // Type validation
    if (allowedTypes && allowedTypes.length > 0 && fieldType && !allowedTypes.includes(fieldType)) {
      console.warn("Type Mismatch:", { fieldType, allowedTypes });
      return;
    }

    // 1. CHECK FOR SMART CHART DROPS (TargetChartId)
    const targetChartId = over.data?.current?.targetChartId;
    const axisKey = over.data?.current?.axis; // 'x' or 'y'

    if (targetChartId && axisKey) {
      // Find current chart to get existing mapping
      const chart = charts.find(c => c.id === targetChartId);
      if (chart) {
        const axisLabel = axisKey === 'x' ? 'X-Axis' : 'Y-Axis';
        const newMapping = { ...chart.mapping, [axisLabel]: fieldName };
        updateChart(targetChartId, { mapping: newMapping });
      }
      return;
    }

    // 2. FALLBACK TO LEGACY DROPS (Global Axis DropZones)
    let axis = over.data?.current?.axis;
    if (!axis) {
      const id = over.id?.toString().toLowerCase();
      if (id?.includes('x')) axis = 'x';
      else if (id?.includes('y')) axis = 'y';
    }

    if (axis === 'x') handleFieldDrop('x', fieldName);
    else if (axis === 'y') handleFieldDrop('y', fieldName);

  }, [handleFieldDrop, charts, updateChart]);


  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="app-container">
        {theme === 'dark' && isSnowing && <Snowfall style={{ zIndex: 1000, pointerEvents: 'none' }} />}
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
          onStoryModelChange={handleStoryModelChange}
          setShowMachineLearning={setShowMachineLearning}
        />

        <div className="main-content">
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
            isSnowing={isSnowing}
            onSnowToggle={() => setIsSnowing(prev => !prev)}
          />

          <DataFilterPanel openDataFilter={openDataFilter} setOpenDataFilter={setOpenDataFilter} />

          {showDataVisual && (
            <DataVisualizations
              onDataCleaned={cleanedData}
              setShowDataVisual={setShowDataVisual}
              setCleanedData={setCleanedData}
              uploadedData={uploadedData}
              onSelectChart={handleChartSelection}
            />
          )}

          {showCanvasContainer && (
            <CanvasContainer
              showAiWorkflow={showAiWorkflow}
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
              setAiChartType={setAiChartType}
              aiChartData={aiChartData}
              aiChartType={aiChartType}
              showCanvasMinimized={showCanvasMinimized}
              setShowCanvasMinimized={setShowCanvasMinimized}
              handleCanvasMinimize={handleCanvasMinimize}
              chartMapping={chartMapping}
              storyData={storyData}
              setStoryData={setStoryData}
              showStoryPanel={showStoryPanel}
              setShowStoryPanel={setShowStoryPanel}
              setAiChartData={setAiChartData}
              chartData={chartData}
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
              showMachineLearning={showMachineLearning}
              setShowMachineLearning={setShowMachineLearning}
            >
              <DatasetInfo selectedStat={selectedStat} />
            </CanvasContainer>
          )}
        </div>

        <AIChat
          setShowAIChart={setShowAIChart}
          setAiChartType={setAiChartType}
          setAiChartData={setAiChartData}
        />
      </div>
    </DndContext>
  );
}

// 🟢 Main App Wrapper (Providers)
function App() {
  return (
    <ThemeProvider>
      <MuiThemeContext>
        <WindowProvider>
          <WarehouseProvider>
            <HelpOverlayProvider>
              {/* WindowContext is now available to AppContent */}
              <AppContent />
            </HelpOverlayProvider>
          </WarehouseProvider>
        </WindowProvider>
      </MuiThemeContext>
    </ThemeProvider>
  );
}

export default App;


