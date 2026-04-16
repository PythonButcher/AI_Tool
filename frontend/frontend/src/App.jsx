import React, { useState, useCallback, useEffect, useContext } from 'react';
import MenuBar from './components/layout/MenuBar';
import CanvasContainer from './components/layout/CanvasContainer';
import DatasetInfo from './components/insights/DatasetInfo';
import SideBar from './components/layout/SideBar';
import DataPane from './components/layout/DataPane';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import DataVisualizations from './features/charts/DataVisualization';
import { transformToChartData } from './utils/chartDataUtils';
import AIChat from './features/ai/AIChat';
import { DataContext, normalizeDatasetRows } from './context/DataContext';
import { ThemeContext, ThemeProvider } from './context/ThemeContext';
import { WarehouseProvider } from './context/WarehouseContext';
import { HelpOverlayProvider } from './context/HelpOverlayContext';
import useLoadRawData from './hooks/useLoadRawData';
import Snowfall from 'react-snowfall';
import DataFilterPanel from './components/data_management/DataFilterPanel';
import './App.css';
import { MuiThemeContext } from './context/MuiThemeContext';
import { useWindowContext } from './context/WindowContext';
import { runDecisionPipeline, createDecisionWorkspace } from './features/business/decision/decisionApi';

// ... (keep the rest of imports)

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

const DESTINATIONS = {
  WORKSPACE: 'workspace',
  EXPLORE: 'explore',
  DASHBOARDS: 'dashboards',
  DECISIONS: 'decisions',
  AI: 'ai',
};

const EMPTY_DECISION_READINESS = {
  dataset_loaded: false,
  semantic_ready: false,
  decision_ready: false,
  missing_requirements: ['dataset', 'semantic_model', 'metrics'],
};

function AppContent() {
  /**
   * 1. CONTEXT & STATE INITIALIZATION
   * All state and context hooks MUST be at the top level of the component.
   */
  const {
    uploadedData, setUploadedData,
    fullData, setFullData,
    cleanedData, setCleanedData,
    pipelineResults, setPipelineResults,
    aiReportReady, setAiReportReady,
    showAiReport, setShowAiReport,
    semanticModel,
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
    addChart,
    addDashboardKpi,
    setDashboardFilters,
  } = useWindowContext();

  // Navigation & Workflow State
  const [activeDestination, setActiveDestination] = useState(DESTINATIONS.WORKSPACE);
  const [activeWorkflow, setActiveWorkflow] = useState(null);
  
  // UI & Layout State
  const [selectedStat, setSelectedStat] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [chartMapping, setChartMapping] = useState({});
  const [isSnowing, setIsSnowing] = useState(false);
  const [activeRibbonTab, setActiveRibbonTab] = useState('Home');
  const [aiChatOpenRequestKey, setAiChatOpenRequestKey] = useState(0);
  const [menuBarHeight, setMenuBarHeight] = useState(64);
  const [isDataPaneOpen, setIsDataPaneOpen] = useState(true);

  // Feature Windows & Visibility State
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
  const [rawUploadFile, setRawUploadFile] = useState(null);
  const [showMachineLearning, setShowMachineLearning] = useState(false);
  const [outputWindows, setOutputWindows] = useState([]);

  // AI & Decision Intelligence State
  const [aiChartData, setAiChartData] = useState(null);
  const [aiChartType, setAiChartType] = useState('Bar');
  const [showDecisionPanel, setShowDecisionPanel] = useState(false);
  const [decisionBundle, setDecisionBundle] = useState(null);
  const [decisionWorkspace, setDecisionWorkspace] = useState(null);
  const [decisionReadiness, setDecisionReadiness] = useState(EMPTY_DECISION_READINESS);
  const [decisionWarnings, setDecisionWarnings] = useState([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  /**
   * 2. HANDLERS (useCallback)
   * These MUST be defined before they are used in any useEffect or passed to children.
   */

  // Navigation & Orchestration
  const handleOpenAiChat = useCallback(() => {
    setActiveDestination(DESTINATIONS.AI);
    setActiveWorkflow('ai');
    closeDashboard();
    setAiChatOpenRequestKey((prev) => prev + 1);
  }, [closeDashboard]);

  const handleDestinationSelect = useCallback((destination) => {
    setActiveDestination(destination);
    
    if (destination === DESTINATIONS.EXPLORE) {
      setIsDataPaneOpen(true);
      setActiveWorkflow('explore');
      closeDashboard();
    } else if (destination === DESTINATIONS.DASHBOARDS) {
      setActiveWorkflow('dashboard');
      openDashboard();
      setIsDataPaneOpen(true);
    } else if (destination === DESTINATIONS.DECISIONS) {
      setActiveWorkflow('business');
      closeDashboard();
      setIsDataPaneOpen(true);
      setShowDecisionPanel(true);
      restoreWindow('decisionPanel');
    } else if (destination === DESTINATIONS.AI) {
      setActiveWorkflow('ai');
      closeDashboard();
      handleOpenAiChat();
    } else {
      setActiveWorkflow(null);
      closeDashboard();
    }
  }, [openDashboard, closeDashboard, handleOpenAiChat, restoreWindow]);

  const handleRibbonTabChange = useCallback((tab) => {
    const tabToDest = {
      'Home': DESTINATIONS.WORKSPACE,
      'Visualise': DESTINATIONS.EXPLORE,
      'Explore': DESTINATIONS.EXPLORE,
      'Dashboard': DESTINATIONS.DASHBOARDS,
      'Business': DESTINATIONS.DECISIONS,
      'AI': DESTINATIONS.AI,
    };
    if (tabToDest[tab]) {
      handleDestinationSelect(tabToDest[tab]);
    }
  }, [handleDestinationSelect]);

  const handleWorkflowSelect = useCallback((workflow) => {
    const workflowToDest = {
      'data': DESTINATIONS.WORKSPACE,
      'explore': DESTINATIONS.EXPLORE,
      'visualise': DESTINATIONS.EXPLORE,
      'dashboard': DESTINATIONS.DASHBOARDS,
      'business': DESTINATIONS.DECISIONS,
    };
    if (workflowToDest[workflow]) {
      handleDestinationSelect(workflowToDest[workflow]);
    }
  }, [handleDestinationSelect]);

  // Data Lifecycle
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

  const handleApiData = (data) => handleFileUpload(data);
  const handleDatabaseData = (data) => handleFileUpload(data);

  // UI Component Handlers
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

  // Semantic Object Handlers
  const handleCreateSemanticChart = useCallback((semanticOverrides = {}) => {
    addChart({
      type: 'Bar',
      dataSourceMode: 'semantic',
      semanticConfig: {
        metricId: '',
        groupBy: '',
        ...semanticOverrides,
      },
    });
  }, [addChart]);

  const handleCreateSemanticKpi = useCallback((semanticOverrides = {}) => {
    addDashboardKpi({
      semanticConfig: {
        metricId: '',
        groupBy: '',
        ...semanticOverrides,
      },
    });
    if (activeWorkflow !== 'dashboard') {
      setActiveWorkflow('dashboard');
    }
  }, [activeWorkflow, addDashboardKpi]);

  const handleAddSemanticFilter = useCallback((semanticObject) => {
    openDashboard();
    setDashboardFilters((prev) => ({
      ...prev,
      dimensionFilters: [
        ...prev.dimensionFilters,
        {
          id: `dashboard-filter-${Date.now()}`,
          dimensionId: semanticObject.id || '',
          values: [],
        },
      ],
    }));
    if (activeWorkflow !== 'dashboard') {
      setActiveWorkflow('dashboard');
    }
  }, [activeWorkflow, openDashboard, setDashboardFilters]);

  // Decision Intelligence Actions
  const getExplicitDecisionRows = useCallback(() => {
    const cleanedRows = normalizeDatasetRows(cleanedData);
    if (cleanedRows.length > 0) return cleanedRows;

    const fullRows = normalizeDatasetRows(fullData);
    if (fullRows.length > 0) return fullRows;

    return normalizeDatasetRows(uploadedData);
  }, [cleanedData, fullData, uploadedData]);

  const resetDecisionStateToNoDataset = useCallback(() => {
    setDecisionBundle(null);
    setDecisionWarnings([]);
    setDecisionReadiness(EMPTY_DECISION_READINESS);
  }, []);

  const getDecisionPayloadBase = useCallback(() => {
    const datasetRows = getExplicitDecisionRows();
    const resolvedSemanticModel = semanticModel || uploadedData?.semantic_model || null;
    const semanticDataset = resolvedSemanticModel?.dataset;

    return {
      dataset: datasetRows.length > 0 ? datasetRows : null,
      semantic_model: datasetRows.length > 0 ? resolvedSemanticModel : null,
      dataset_ref: datasetRows.length > 0 && semanticDataset?.id ? {
        source: 'datahub',
        dataset_id: semanticDataset.id,
        dataset_name: semanticDataset.name,
      } : null,
    };
  }, [getExplicitDecisionRows, semanticModel, uploadedData]);

  const fetchDecisionReadiness = useCallback(async () => {
    try {
      const datasetRows = getExplicitDecisionRows();
      if (datasetRows.length === 0) {
        resetDecisionStateToNoDataset();
        return;
      }

      const payload = getDecisionPayloadBase();
      const result = await runDecisionPipeline(payload);
      if (result.readiness) setDecisionReadiness(result.readiness);
      if (result.warnings) setDecisionWarnings(result.warnings);
    } catch (err) {
      console.error('[DecisionIntelligence] Readiness fetch failed:', err);
    }
  }, [getDecisionPayloadBase, getExplicitDecisionRows, resetDecisionStateToNoDataset]);

  const handleRunDecision = useCallback(async () => {
    try {
      const datasetRows = getExplicitDecisionRows();
      if (datasetRows.length === 0) {
        resetDecisionStateToNoDataset();
        return;
      }

      const payload = {
        ...getDecisionPayloadBase(),
        include_anomaly_detection: true,
        include_scenario_preview: true,
      };
      const result = await runDecisionPipeline(payload);
      if (result.readiness) setDecisionReadiness(result.readiness);
      if (result.warnings) setDecisionWarnings(result.warnings);
      if (result.status === 'success') {
        setDecisionBundle(result.decision_bundle);
        setShowDecisionPanel(true);
        restoreWindow('decisionPanel');
      }
    } catch (err) {
      console.error('[DecisionIntelligence] Execution failed:', err);
    }
  }, [getDecisionPayloadBase, getExplicitDecisionRows, resetDecisionStateToNoDataset, restoreWindow]);

  useEffect(() => {
    if (getExplicitDecisionRows().length === 0) {
      resetDecisionStateToNoDataset();
    }
  }, [getExplicitDecisionRows, resetDecisionStateToNoDataset]);

  const handleDecisionAction = useCallback((action) => {
    if (action.action_type === 'break_down_metric') {
      const { metric_id, group_by } = action.payload;
      addChart({
        type: 'Bar',
        dataSourceMode: 'semantic',
        semanticConfig: {
          metricId: metric_id,
          groupBy: Array.isArray(group_by) ? group_by[0] : group_by,
        },
      });
    }
  }, [addChart]);

  const handleCreateDecisionWorkspace = useCallback(async (payload) => {
    try {
      const result = await createDecisionWorkspace(payload);
      if (result.status === 'success') {
        setDecisionWorkspace(result.decision_workspace);
        setDecisionReadiness(result.decision_workspace.readiness);
        if (result.warnings) setDecisionWarnings(result.warnings);
      }
    } catch (err) {
      console.error('[DecisionIntelligence] Workspace creation failed:', err);
    }
  }, []);

  const handleResetDecisionWorkspace = useCallback(() => {
    setDecisionWorkspace(null);
    setDecisionBundle(null);
    fetchDecisionReadiness();
  }, [fetchDecisionReadiness]);

  /**
   * 3. EFFECTS & SUBSCRIPTIONS
   */
  useLoadRawData(showRawViewer, rawUploadFile, setFullData);

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

  useEffect(() => {
    if (activeWorkflow === 'business') {
      fetchDecisionReadiness();
    }
  }, [activeWorkflow, fetchDecisionReadiness, uploadedData, semanticModel]);

  // Drag and Drop Logic
  const handleFieldDrop = useCallback((axis, field) => {
    setChartMapping((prev) => {
      const updated = { ...prev };
      if (axis === 'x') updated['X-Axis'] = field;
      else if (axis === 'y') updated['Y-Axis'] = field;
      return updated;
    });
  }, []);

  const handleDashboardToggle = useCallback(() => {
    if (dashboardState.isVisible) closeDashboard();
    else openDashboard();
  }, [closeDashboard, dashboardState.isVisible, openDashboard]);

  const handleDragEnd = useCallback(({ active, over }) => {
    if (!over) return;
    const activePayload = active.data?.current;
    if (!activePayload) return;

    if (activePayload.type === 'semantic-object') {
      const dashboardItemId = over.data?.current?.dashboardItemId;
      const dashboardRole = over.data?.current?.dashboardRole;
      const acceptedObjectKinds = over.data?.current?.acceptedObjectKinds;

      if (acceptedObjectKinds && acceptedObjectKinds.length > 0 && activePayload.objectKind && !acceptedObjectKinds.includes(activePayload.objectKind)) return;

      if (dashboardItemId && dashboardRole === 'metric') {
        updateDashboardItem(dashboardItemId, {
          semanticConfig: { metricId: activePayload.semanticId || activePayload.metadata?.id || '' },
        });
        return;
      }

      const targetChartId = over.data?.current?.targetChartId;
      const semanticRole = over.data?.current?.semanticRole;
      if (!targetChartId || !semanticRole) return;

      const chart = charts.find((entry) => entry.id === targetChartId);
      const dashboardChart = dashboardItems.find((entry) => entry.id === targetChartId && entry.itemType === 'chart');
      const chartSemanticConfig = chart?.semanticConfig || dashboardChart?.semanticConfig || {};

      const nextSemanticConfig = {
        metricId: chartSemanticConfig.metricId || '',
        groupBy: chartSemanticConfig.groupBy || '',
      };

      if (semanticRole === 'metric') nextSemanticConfig.metricId = activePayload.semanticId || activePayload.metadata?.id || '';
      if (semanticRole === 'dimension') nextSemanticConfig.groupBy = activePayload.semanticId || activePayload.metadata?.id || '';

      if (dashboardChart) {
        updateDashboardItem(targetChartId, { dataSourceMode: 'semantic', semanticConfig: nextSemanticConfig });
        return;
      }
      if (chart) {
        updateChart(targetChartId, { dataSourceMode: 'semantic', semanticConfig: nextSemanticConfig });
      }
      return;
    }

    if (activePayload.type !== 'field') return;
    const fieldName = activePayload.field;
    const fieldType = activePayload.fieldType;
    const allowedTypes = over.data?.current?.allowedTypes;

    if (allowedTypes && allowedTypes.length > 0 && fieldType && !allowedTypes.includes(fieldType)) return;

    const targetChartId = over.data?.current?.targetChartId;
    const axisKey = over.data?.current?.axis;

    if (targetChartId && axisKey) {
      const chart = charts.find((item) => item.id === targetChartId);
      const dashboardChart = dashboardItems.find((item) => item.id === targetChartId && item.itemType === 'chart');
      const axisLabel = axisKey === 'x' ? 'X-Axis' : 'Y-Axis';

      if (dashboardChart) {
        const newMapping = { ...(dashboardChart.mapping || {}), [axisLabel]: fieldName };
        updateDashboardItem(targetChartId, { dataSourceMode: 'raw', mapping: newMapping });
        return;
      }
      if (chart) {
        const newMapping = { ...chart.mapping, [axisLabel]: fieldName };
        updateChart(targetChartId, { dataSourceMode: 'raw', mapping: newMapping });
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

  /**
   * 4. FINAL RENDER
   */
  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="app-container">
        {theme === 'dark' && isSnowing && <Snowfall style={{ zIndex: 1000, pointerEvents: 'none' }} />}
        <SideBar
          activeDestination={activeDestination}
          onDestinationSelect={handleDestinationSelect}
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
          setShowDataVisual={setShowDataVisual}
          onStoryModelChange={handleStoryModelChange}
          setShowMachineLearning={setShowMachineLearning}
          onRunDecision={handleRunDecision}
          decisionReadiness={decisionReadiness}
        />

        <div className="main-content">
          <MenuBar
            activeDestination={activeDestination}
            onDestinationSelect={handleDestinationSelect}
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
              handleDestinationSelect(DESTINATIONS.EXPLORE);
            }}
            onOpenWhiteboard={() => {
              setShowWhiteBoard(true);
              restoreWindow('whiteBoard');
              handleDestinationSelect(DESTINATIONS.EXPLORE);
            }}
            onOpenChartGallery={() => {
              setShowDataVisual(true);
              handleDestinationSelect(DESTINATIONS.EXPLORE);
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
              activeDestination={activeDestination}
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
              showDecisionPanel={showDecisionPanel}
              setShowDecisionPanel={setShowDecisionPanel}
              decisionBundle={decisionBundle}
              decisionWorkspace={decisionWorkspace}
              onCreateDecisionWorkspace={handleCreateDecisionWorkspace}
              getDecisionPayloadBase={getDecisionPayloadBase}
              onDecisionAction={handleDecisionAction}
              decisionReadiness={decisionReadiness}
              decisionWarnings={decisionWarnings}
              onOpenAiChat={handleOpenAiChat}
              onRunDecision={handleRunDecision}
              onResetDecisionWorkspace={handleResetDecisionWorkspace}
              onDestinationSelect={handleDestinationSelect}
              setShowDataVisual={setShowDataVisual}
              setIsDataPaneOpen={setIsDataPaneOpen}
            >
              <DatasetInfo selectedStat={selectedStat} />
            </CanvasContainer>
          )}
        </div>

        <DataPane
          activeDestination={activeDestination}
          cleanedData={cleanedData}
          isCollapsed={!isDataPaneOpen}
          setIsCollapsed={(val) => setIsDataPaneOpen(!val)}
          onCreateSemanticChart={handleCreateSemanticChart}
          onCreateSemanticKpi={handleCreateSemanticKpi}
          onAddDashboardFilter={handleAddSemanticFilter}
        />

        {/* Global AI Shortcut Icon - Only visible when not in the dedicated AI Shell */}
        {activeDestination !== DESTINATIONS.AI && (
          <AIChat onOpenAiChat={handleOpenAiChat} />
        )}
      </div>
    </DndContext>
  );
}

function App() {
  return (
    <ThemeProvider>
      <MuiThemeContext>
        <WarehouseProvider>
          <HelpOverlayProvider>
            <AppContent />
          </HelpOverlayProvider>
        </WarehouseProvider>
      </MuiThemeContext>
    </ThemeProvider>
  );
}

export default App;
