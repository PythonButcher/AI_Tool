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

const RIBBON_TAB_TO_WORKFLOW = {
  Home: 'data',
  Explore: 'explore',
  Visualise: 'visualise',
  Business: 'business',
  AI: 'ai',
  Dashboard: 'dashboard',
};

const WORKFLOW_TO_RIBBON_TAB = {
  data: 'Home',
  explore: 'Explore',
  visualise: 'Visualise',
  business: 'Business',
  ai: 'AI',
  dashboard: 'Dashboard',
};

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
  const {
    charts,
    updateChart,
    dashboardItems,
    dashboardState,
    updateDashboardItem,
    openDashboard,
    closeDashboard,
    restoreWindow,
  } = useWindowContext();

  console.log('App.jsx received uploadedData:', uploadedData);

  const [selectedStat, setSelectedStat] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [chartMapping, setChartMapping] = useState({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const [aiChartData, setAiChartData] = useState(null);
  const [aiChartType, setAiChartType] = useState('Bar');
  const [showWhiteBoard, setShowWhiteBoard] = useState(null);
  const [openDataFilter, setOpenDataFilter] = useState(false);
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
  const [activeRibbonTab, setActiveRibbonTab] = useState('Home');
  const [activeWorkflow, setActiveWorkflow] = useState('data');
  const [aiChatOpenRequestKey, setAiChatOpenRequestKey] = useState(0);
  const [menuBarHeight, setMenuBarHeight] = useState(116);

  useLoadRawData(showRawViewer, rawUploadFile, setFullData);

  useEffect(() => {
    if (uploadedData) {
      setShowChartWindow(true);
      setShowDataPreview(true);
    }
  }, [uploadedData]);

  useEffect(() => {
    if (pipelineResults?.ai_report?.status === 'completed' || pipelineResults?.ai_report?.status === 'success') {
      setAiReportReady(true);
    }
  }, [pipelineResults, setAiReportReady]);

  useEffect(() => {
    if (!cleanedData || !chartMapping['X-Axis'] || !chartMapping['Y-Axis']) return;
    const transformed = transformToChartData(cleanedData, {
      labelField: chartMapping['X-Axis'] || chartMapping.Category,
      dataFields: [chartMapping['Y-Axis'] || chartMapping.Value],
    });
    if (transformed) setChartData(transformed);
  }, [cleanedData, chartMapping]);

  const handleStatsSelect = useCallback((statType) => setSelectedStat(statType), []);

  const handleDataCleaned = useCallback((newData) => {
    if (!newData || newData.length === 0) {
      setCleanedData(null);
      setChartData(null);
      return;
    }
    setCleanedData(newData);
  }, [setCleanedData]);

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

  const handleSidebarButtonClick = useCallback((action) => {
    if (action === 'visualize') setShowDataVisual(true);
  }, []);
  const handleOpenAiChat = useCallback(() => {
    setAiChatOpenRequestKey((prev) => prev + 1);
  }, []);
  const handleRibbonTabChange = useCallback((tab) => {
    setActiveRibbonTab(tab);
    const mappedWorkflow = RIBBON_TAB_TO_WORKFLOW[tab];
    if (mappedWorkflow) {
      setActiveWorkflow(mappedWorkflow);
      return;
    }
    if (tab === 'Settings') {
      setActiveWorkflow(null);
    }
  }, []);
  const handleWorkflowSelect = useCallback((workflow) => {
    setActiveWorkflow((prev) => {
      const nextWorkflow = prev === workflow ? null : workflow;
      if (nextWorkflow && WORKFLOW_TO_RIBBON_TAB[nextWorkflow]) {
        setActiveRibbonTab(WORKFLOW_TO_RIBBON_TAB[nextWorkflow]);
      }
      return nextWorkflow;
    });
  }, []);
  const handleClosePreview = useCallback(() => setShowDataPreview(false), []);
  const handleCloseRawViewer = useCallback(() => setShowRawViewer(false), []);
  const handleCloseCanvas = useCallback(() => setShowCanvasContainer(false), []);
  const handleCanvasMinimize = useCallback(() => setShowCanvasMinimized((prev) => !prev), []);
  const handleAiReportOpen = useCallback(() => {
    setShowAiReport(true);
    setAiReportReady(false);
  }, [setAiReportReady, setShowAiReport]);
  const handleAiReportClose = useCallback(() => {
    setShowAiReport(false);
    setAiReportReady(false);
  }, [setAiReportReady, setShowAiReport]);
  const handleChartSelection = useCallback((chartType) => {
    setSelectedChartType(chartType);
    setShowChartWindow(true);
    setShowDataVisual(false);
  }, []);
  const handleCloseChartWindow = useCallback(() => setShowChartWindow(false), []);
  const handleStoryModelChange = (newModel) => setStoryModel(newModel);

  const handleFieldDrop = useCallback((axis, field) => {
    setChartMapping((prev) => {
      const updated = { ...prev };
      if (axis === 'x') {
        updated['X-Axis'] = field;
      } else if (axis === 'y') {
        updated['Y-Axis'] = field;
      }
      return updated;
    });
  }, []);

  const handleDashboardToggle = useCallback(() => {
    if (dashboardState.isVisible) {
      closeDashboard();
      return;
    }
    openDashboard();
  }, [closeDashboard, dashboardState.isVisible, openDashboard]);

  const handleDragEnd = useCallback(({ active, over }) => {
    console.log('Drag End:', { active, over });

    if (!over) {
      return;
    }

    const activePayload = active.data?.current;
    if (!activePayload) {
      return;
    }

    if (activePayload.type === 'semantic-object') {
      const dashboardItemId = over.data?.current?.dashboardItemId;
      const dashboardRole = over.data?.current?.dashboardRole;
      const acceptedObjectKinds = over.data?.current?.acceptedObjectKinds;

      if (
        acceptedObjectKinds
        && acceptedObjectKinds.length > 0
        && activePayload.objectKind
        && !acceptedObjectKinds.includes(activePayload.objectKind)
      ) {
        console.warn('Semantic object mismatch:', {
          objectKind: activePayload.objectKind,
          acceptedObjectKinds,
        });
        return;
      }

      if (dashboardItemId && dashboardRole === 'metric') {
        updateDashboardItem(dashboardItemId, {
          semanticConfig: {
            metricId: activePayload.semanticId || activePayload.metadata?.id || '',
          },
        });
        return;
      }

      const targetChartId = over.data?.current?.targetChartId;
      const semanticRole = over.data?.current?.semanticRole;

      if (!targetChartId || !semanticRole) {
        return;
      }

      const chart = charts.find((entry) => entry.id === targetChartId);
      const dashboardChart = dashboardItems.find((entry) => entry.id === targetChartId && entry.itemType === 'chart');
      const chartSemanticConfig = chart?.semanticConfig || dashboardChart?.semanticConfig || {};

      const nextSemanticConfig = {
        metricId: chartSemanticConfig.metricId || '',
        groupBy: chartSemanticConfig.groupBy || '',
      };

      if (semanticRole === 'metric') {
        nextSemanticConfig.metricId = activePayload.semanticId || activePayload.metadata?.id || '';
      }

      if (semanticRole === 'dimension') {
        nextSemanticConfig.groupBy = activePayload.semanticId || activePayload.metadata?.id || '';
      }

      if (dashboardChart) {
        updateDashboardItem(targetChartId, {
          dataSourceMode: 'semantic',
          semanticConfig: nextSemanticConfig,
        });
        return;
      }

      if (chart) {
        updateChart(targetChartId, {
          dataSourceMode: 'semantic',
          semanticConfig: nextSemanticConfig,
        });
      }
      return;
    }

    if (activePayload.type !== 'field') {
      console.warn('Invalid drop:', { over, type: activePayload.type });
      return;
    }

    const fieldName = activePayload.field;
    const fieldType = activePayload.fieldType;
    const allowedTypes = over.data?.current?.allowedTypes;

    if (allowedTypes && allowedTypes.length > 0 && fieldType && !allowedTypes.includes(fieldType)) {
      console.warn('Type Mismatch:', { fieldType, allowedTypes });
      return;
    }

    const targetChartId = over.data?.current?.targetChartId;
    const axisKey = over.data?.current?.axis;

    if (targetChartId && axisKey) {
      const chart = charts.find((item) => item.id === targetChartId);
      const dashboardChart = dashboardItems.find((item) => item.id === targetChartId && item.itemType === 'chart');
      const axisLabel = axisKey === 'x' ? 'X-Axis' : 'Y-Axis';

      if (dashboardChart) {
        const newMapping = { ...(dashboardChart.mapping || {}), [axisLabel]: fieldName };
        updateDashboardItem(targetChartId, { mapping: newMapping });
        return;
      }

      if (chart) {
        const newMapping = { ...chart.mapping, [axisLabel]: fieldName };
        updateChart(targetChartId, { mapping: newMapping });
      }
      return;
    }

    let axis = over.data?.current?.axis;
    if (!axis) {
      const id = over.id?.toString().toLowerCase();
      if (id?.includes('x')) axis = 'x';
      else if (id?.includes('y')) axis = 'y';
    }

    if (axis === 'x') handleFieldDrop('x', fieldName);
    else if (axis === 'y') handleFieldDrop('y', fieldName);
  }, [charts, dashboardItems, handleFieldDrop, updateChart, updateDashboardItem]);

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="app-container">
        {theme === 'dark' && isSnowing && <Snowfall style={{ zIndex: 1000, pointerEvents: 'none' }} />}
        <SideBar
          activeWorkflow={activeWorkflow}
          onWorkflowSelect={handleWorkflowSelect}
          onButtonClick={handleSidebarButtonClick}
          onDataCleaned={handleDataCleaned}
          uploadedData={uploadedData}
          cleanedData={cleanedData}
          showAiWorkflow={showAiWorkflow}
          setShowAiWorkflow={setShowAiWorkflow}
          setShowDataPreview={setShowDataPreview}
          setShowRawViewer={setShowRawViewer}
          setOpenDataFilter={setOpenDataFilter}
          onDashboardToggle={handleDashboardToggle}
          isDashboardVisible={dashboardState.isVisible}
          aiReportReady={aiReportReady}
          onAiReportClick={handleAiReportOpen}
          onOpenAiChat={handleOpenAiChat}
          setStoryData={setStoryData}
          setShowStoryPanel={setShowStoryPanel}
          showWhiteBoard={showWhiteBoard}
          setShowWhiteBoard={setShowWhiteBoard}
          onStoryModelChange={handleStoryModelChange}
          setShowMachineLearning={setShowMachineLearning}
        />

        <div className="main-content">
          <MenuBar
            activeTab={activeRibbonTab}
            onTabChange={handleRibbonTabChange}
            activeWorkflow={activeWorkflow}
            onWorkflowSelect={handleWorkflowSelect}
            onFileUploadSuccess={handleFileUpload}
            onStatsSelect={handleStatsSelect}
            showDataPreview={showDataPreview}
            setShowDataPreview={setShowDataPreview}
            setShowRawViewer={setShowRawViewer}
            handleApiData={handleApiData}
            handleDatabaseData={handleDatabaseData}
            setOpenDataFilter={setOpenDataFilter}
            aiReportReady={aiReportReady}
            onAiReportClick={handleAiReportOpen}
            isSnowing={isSnowing}
            onSnowToggle={() => setIsSnowing((prev) => !prev)}
            onDashboardToggle={handleDashboardToggle}
            isDashboardVisible={dashboardState.isVisible}
            onOpenAiChat={handleOpenAiChat}
            onOpenAiWorkflow={() => {
              setShowAiWorkflow(true);
              restoreWindow('aiWorkflowLab');
            }}
            onOpenStoryboard={() => {
              setStoryData(null);
              setShowStoryPanel(true);
              restoreWindow('storyPanel');
              setActiveWorkflow('ai');
              setActiveRibbonTab('AI');
            }}
            onOpenWhiteboard={() => {
              setShowWhiteBoard(true);
              restoreWindow('whiteBoard');
              setActiveWorkflow('whiteboard');
            }}
            onOpenChartGallery={() => {
              setShowDataVisual(true);
              setActiveWorkflow('visualise');
              setActiveRibbonTab('Visualise');
            }}
            onHeightChange={setMenuBarHeight}
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
          openRequestKey={aiChatOpenRequestKey}
          topOffset={menuBarHeight}
        />
      </div>
    </DndContext>
  );
}

function App() {
  return (
    <ThemeProvider>
      <MuiThemeContext>
        <WindowProvider>
          <WarehouseProvider>
            <HelpOverlayProvider>
              <AppContent />
            </HelpOverlayProvider>
          </WarehouseProvider>
        </WindowProvider>
      </MuiThemeContext>
    </ThemeProvider>
  );
}

export default App;

