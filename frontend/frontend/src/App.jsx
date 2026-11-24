import React, { useState, useCallback, useEffect, useContext, useMemo } from 'react';
import MenuBar from './components/layout/MenuBar';
import CanvasContainer from './components/layout/CanvasContainer';
import DatasetInfo from './components/insights/DatasetInfo';
import DataPane from './components/layout/DataPane';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import DataVisualizations from './features/charts/DataVisualization';
import { transformToChartData } from './utils/chartDataUtils';
import AIChat from './features/ai/AIChat';
import { DataContext, normalizeDatasetRows, useActiveDataset } from './context/DataContext';
import { ThemeProvider } from './context/ThemeContext';
import { WarehouseProvider } from './context/WarehouseContext';
import { HelpOverlayProvider } from './context/HelpOverlayContext';
import DataFilterPanel from './components/data_management/DataFilterPanel';
import DataCleaningForm from './components/data_management/DataCleaningForm';
import SaveDatasetDialog from './features/database/SaveDatasetDialog';
import Snackbar from '@mui/material/Snackbar';
import './App.css';
import { MuiThemeContext } from './context/MuiThemeContext';
import { useWindowContext } from './context/WindowContext';
import GlobalDragOverlay from './components/layout/GlobalDragOverlay';
import WorkingDataHome from './components/layout/WorkingDataHome';
import { resolveAnalyticsDestination } from './features/analytics/analyticsNavigation';

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
  DATA_TOOLS: 'data_tools',
  DATA_HUB: 'data_hub',
  DATA_MODEL: 'data_model',
  EXPLORE: 'explore',
  DASHBOARDS: 'dashboards',
  AI: 'ai',
};

function AppContent() {
  const {
    uploadedData, setUploadedData,
    fullData, setFullData,
    cleanedData, setCleanedData,
    filteredData, setFilteredData,
    pipelineResults, setPipelineResults,
    aiReportReady, setAiReportReady,
    showAiReport, setShowAiReport,
    setSemanticModel,
    refreshSemanticModelFromDataset,
    setWorkspaceEnvelope,
    activeWorkspace, analysisContext,
  } = useContext(DataContext);

  const {
    charts,
    updateChart,
    dashboardItems,
    updateDashboardItem,
    openDashboard,
    closeDashboard,
    restoreWindow,
    addChart,
    addDashboardKpi,
    setDashboardFilters,
    updateAnalyticsWorkspace,
  } = useWindowContext();

  // Navigation & Workflow State
  const [activeDestination, setActiveDestination] = useState(DESTINATIONS.WORKSPACE);
  const [activeWorkflow, setActiveWorkflow] = useState(null);
  
  // UI & Layout State
  const [chartData, setChartData] = useState(null);
  const [chartMapping, setChartMapping] = useState({});
  const [isDataPaneOpen, setIsDataPaneOpen] = useState(false);
  const [activeDataPaneTab, setActiveDataPaneTab] = useState('catalog');
  const [activeSource, setActiveSource] = useState(null);
  const dataset = useActiveDataset();
  const previewData = useMemo(() => normalizeDatasetRows(dataset).slice(0, 100), [dataset]);

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
  const [showAiChat, setShowAiChat] = useState(false);
  const [showCanvasMinimized, setShowCanvasMinimized] = useState(false);
  const [previewMode, setPreviewMode] = useState('table');
  const [storyData, setStoryData] = useState(undefined);
  const [storyModel] = useState('openai');
  const [showStoryPanel, setShowStoryPanel] = useState(false);
  const [workingName, setWorkingName] = useState('');
  const [savedDataset, setSavedDataset] = useState(null);
  const [savedScope, setSavedScope] = useState(null);
  const [refineAllowed, setRefineAllowed] = useState(true);
  const [showSaveDataset, setShowSaveDataset] = useState(false);
  const [datasetNotice, setDatasetNotice] = useState('');
  const [showMachineLearning, setShowMachineLearning] = useState(false);
  const [outputWindows, setOutputWindows] = useState([]);
  
  // Panel states moved from Sidebar
  const [showCleaningForm, setShowCleaningForm] = useState(false);
  const [cleaningFormProps, setCleaningFormProps] = useState(null);

  const workingRows = useMemo(() => normalizeDatasetRows(cleanedData ?? fullData ?? uploadedData), [cleanedData, fullData, uploadedData]);
  const hasWorkingDataset = Boolean(uploadedData || activeWorkspace?.primary_source_id || workingRows.length);
  const canRefineWorkingDataset = hasWorkingDataset && Boolean(workingRows.length)
    && (!activeWorkspace || (refineAllowed && activeWorkspace.sources?.length === 1));
  const canSaveWorkingDataset = Boolean(activeWorkspace?.primary_source_id);
  const refineUnavailableReason = workingRows.length
    ? 'Refine is available for a dataset with one source and no relationships.'
    : 'Refine requires a dataset with rows.';

  // AI State
  const [aiChartData, setAiChartData] = useState(null);
  const [aiChartType, setAiChartType] = useState('Bar');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleOpenAiChat = useCallback(() => {
    setShowAiChat(true);
    restoreWindow('aiChat');
  }, [restoreWindow]);

  const openSourcePanel = useCallback((source) => {
    setActiveSource(source);
    setActiveDataPaneTab('sources');
    setIsDataPaneOpen(true);
  }, []);

  const handleOpenPreview = useCallback(() => {
    setShowDataPreview(true);
    restoreWindow('dataPreview');
  }, [restoreWindow]);

  const handleDestinationSelect = useCallback((destination) => {
    const target = resolveAnalyticsDestination(destination);
    setActiveDestination(target.destination);
    if (target.destination === DESTINATIONS.DATA_HUB || target.destination === DESTINATIONS.DATA_TOOLS) {
      setIsDataPaneOpen(false);
      setActiveSource(null);
    }
    if (target.destination === 'analytics') {
      if (target.view) updateAnalyticsWorkspace(workspace => ({ ...workspace, lastView: target.view }));
      setActiveWorkflow('analytics');
      openDashboard();
      return;
    }

    if (destination === DESTINATIONS.AI) {
      setActiveWorkflow('ai');
      closeDashboard();
      handleOpenAiChat();
    } else {
      setActiveWorkflow(null);
      closeDashboard();
    }
  }, [openDashboard, closeDashboard, handleOpenAiChat, updateAnalyticsWorkspace]);

  const openDataHub = useCallback(() => {
    handleDestinationSelect(DESTINATIONS.DATA_HUB);
  }, [handleDestinationSelect]);

  const handleOpenCleaningForm = useCallback((props) => {
    if (props && props.closeOverlay) {
      setShowCleaningForm(false);
      setCleaningFormProps(null);
      return;
    }
    setCleaningFormProps(props);
    setShowCleaningForm(true);
  }, []);

  const installWorkingDataset = useCallback((raw, name, saved = null) => {
    const previewRows = parseRecords(raw?.data_preview);
    const datasetRows = parseRecords(raw?.full_data ?? raw?.raw_data);
    const finalDataset = datasetRows.length ? datasetRows : previewRows;
    
    setUploadedData({
      data_preview: previewRows,
      semantic_model: raw?.semantic_model || null,
      source: raw?.source || null,
      schema: raw?.schema ?? raw?.source?.schema ?? null,
    });
    setFullData(finalDataset);
    setCleanedData(finalDataset);
    setFilteredData(null);
    setWorkingName(name || '');
    setSavedDataset(saved?.revision ? saved : null);
    setSavedScope(saved?.kind === 'model' ? raw.analysis_context : null);
    setRefineAllowed(raw?.capabilities?.refine ?? true);
    setShowSaveDataset(false);
    setShowRawViewer(false);
    setDatasetNotice('');
    setOpenDataFilter(false);
    setShowCleaningForm(false);
    setCleaningFormProps(null);
    setWorkspaceEnvelope({ workspace: raw?.workspace ?? null, analysis_context: raw?.analysis_context ?? null });

    if (raw?.semantic_model) {
      setSemanticModel(raw.semantic_model);
    } else if (finalDataset.length > 0) {
      refreshSemanticModelFromDataset(finalDataset, {
        datasetName: name,
        source: 'app_handle_upload',
      });
    } else {
      setSemanticModel(null);
    }
    handleOpenPreview();
  }, [setUploadedData, setFullData, setCleanedData, setFilteredData, setSemanticModel, refreshSemanticModelFromDataset, setWorkspaceEnvelope, handleOpenPreview]);

  const handleFileUpload = useCallback((raw, file = null) => {
    installWorkingDataset(raw, file?.name || raw?.source?.name || raw?.name);
    if (activeDestination === DESTINATIONS.DATA_HUB || activeDestination === DESTINATIONS.DATA_TOOLS) {
      handleDestinationSelect(DESTINATIONS.WORKSPACE);
    }
  }, [activeDestination, handleDestinationSelect, installWorkingDataset]);

  const handleOpenDataset = useCallback(raw => {
    installWorkingDataset(raw, raw.dataset.name, raw.dataset);
    handleDestinationSelect(DESTINATIONS.WORKSPACE);
  }, [installWorkingDataset, handleDestinationSelect]);

  const handleWorkingRefine = useCallback(raw => {
    installWorkingDataset(raw, workingName, savedDataset);
    setSavedScope(null);
    setDatasetNotice('Refine changes applied. Use Save Dataset to keep them in Data Hub.');
    if (activeDestination === DESTINATIONS.DATA_TOOLS) handleDestinationSelect(DESTINATIONS.WORKSPACE);
  }, [installWorkingDataset, workingName, savedDataset, activeDestination, handleDestinationSelect]);


  const handleApiData = (data) => handleFileUpload(data);
  const handleDatabaseData = (data) => handleFileUpload(data);

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
    const views = { Bar: 'bar', Line: 'line', Pie: 'pie', Doughnut: 'doughnut', Scatter: 'scatter', Histogram: 'histogram' };
    updateAnalyticsWorkspace(workspace => ({ ...workspace, lastView: 'explore', pendingAction: { type: 'chart', view: views[chartType] || 'bar', id: Date.now() } }));
    setActiveDestination('analytics');
    setShowDataVisual(false);
  }, [updateAnalyticsWorkspace]);
  const handleCloseChartWindow = useCallback(() => setShowChartWindow(false), []);

  const handleCreateSemanticChart = useCallback((semanticOverrides = {}) => {
    addChart({
      type: 'Bar',
      dataSourceMode: 'semantic',
      semanticConfig: { metricId: '', groupBy: '', ...semanticOverrides },
    });
  }, [addChart]);

  const handleCreateSemanticKpi = useCallback((semanticOverrides = {}) => {
    addDashboardKpi({
      semanticConfig: { metricId: '', groupBy: '', ...semanticOverrides },
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




  // Legacy decision workspace functions removed in Phase 10


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


  const handleFieldDrop = useCallback((axis, field) => {
    setChartMapping((prev) => {
      const updated = { ...prev };
      if (axis === 'x') updated['X-Axis'] = field;
      else if (axis === 'y') updated['Y-Axis'] = field;
      return updated;
    });
  }, []);

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
        const newMapping = { ...(chart.mapping || {}), [axisLabel]: fieldName };
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

  const previewWorkingDataset = () => {
    handleDestinationSelect(DESTINATIONS.WORKSPACE);
    setShowRawViewer(false);
    handleOpenPreview();
  };

  const openWorkingFields = () => {
    setActiveDataPaneTab('catalog');
    setIsDataPaneOpen(true);
  };

  const inspectWorkingRows = () => {
    handleDestinationSelect(DESTINATIONS.WORKSPACE);
    setShowRawViewer(true);
    restoreWindow('rawViewer');
  };

  const workingDataSurface = [DESTINATIONS.WORKSPACE, DESTINATIONS.DATA_TOOLS].includes(activeDestination) ? (
    <WorkingDataHome
      tools={activeDestination === DESTINATIONS.DATA_TOOLS}
      dataset={hasWorkingDataset ? {
        name: workingName || uploadedData?.source?.name || 'Current dataset',
        savedName: savedDataset?.name,
        rowCount: workingRows.length,
        fieldCount: uploadedData?.schema?.length ?? Object.keys(workingRows[0] || {}).length,
        canSave: canSaveWorkingDataset,
        canModel: Boolean(activeWorkspace?.workspace_id && activeWorkspace?.primary_source_id),
      } : null}
      canRefine={canRefineWorkingDataset}
      refineUnavailableReason={refineUnavailableReason}
      actions={{
        openTools: () => handleDestinationSelect(DESTINATIONS.DATA_TOOLS),
        upload: () => openSourcePanel('upload'),
        openSources: () => openSourcePanel(null),
        openHub: openDataHub,
        openRefine: () => handleOpenCleaningForm(null),
        inspectRows: inspectWorkingRows,
        filterRows: () => {
          previewWorkingDataset();
          setOpenDataFilter(true);
        },
        preview: previewWorkingDataset,
        openFields: openWorkingFields,
        connectApi: () => openSourcePanel('api'),
        connectDatabase: () => openSourcePanel('db'),
        openModel: () => handleDestinationSelect(DESTINATIONS.DATA_MODEL),
      }}
    />
  ) : null;

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <GlobalDragOverlay />
      <div className="app-container">
        <MenuBar
          activeDestination={activeDestination}
          onDestinationSelect={handleDestinationSelect}
          onOpenPreview={previewWorkingDataset}
          canPreview={previewData.length > 0 || Boolean(activeWorkspace?.primary_source_id)}
          canSaveDataset={canSaveWorkingDataset && [DESTINATIONS.WORKSPACE, DESTINATIONS.DATA_TOOLS, DESTINATIONS.DATA_MODEL].includes(activeDestination)}
          onSaveDataset={() => setShowSaveDataset(true)}
          onOpenSourcePanel={openSourcePanel}
          onOpenFields={openWorkingFields}
          aiReportReady={aiReportReady}
          onAiReportClick={handleAiReportOpen}
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
        />

        <main className="main-content">
          <DataFilterPanel key={activeWorkspace?.workspace_id || 'local'} openDataFilter={openDataFilter} setOpenDataFilter={setOpenDataFilter} />

          {showSaveDataset && activeWorkspace?.primary_source_id && (
            <SaveDatasetDialog
              workspace={activeWorkspace}
              savedDataset={savedDataset}
              datasetName={workingName}
              hasPreviewFilter={filteredData != null}
              analysisContext={savedScope?.workspace_id === analysisContext?.workspace_id && savedScope?.workspace_version === activeWorkspace.version ? savedScope : null}
              onClose={() => setShowSaveDataset(false)}
              onSaved={record => {
                setSavedDataset(record);
                setWorkingName(record.name);
                setShowSaveDataset(false);
                setDatasetNotice(`Saved “${record.name}” to Data Hub.`);
              }}
            />
          )}
          <Snackbar open={Boolean(datasetNotice)} message={datasetNotice} autoHideDuration={6000} onClose={() => setDatasetNotice('')} />

          {showCleaningForm && (
            <DataCleaningForm
              key={cleaningFormProps?.mlStudioMode ? 'ml-studio' : activeWorkspace?.workspace_id || 'local'}
              workingWorkspace={cleaningFormProps?.mlStudioMode ? null : activeWorkspace}
              workingDatasetName={workingName}
              onWorkingRefine={handleWorkingRefine}
              closeForm={() => {
                if (cleaningFormProps && cleaningFormProps.onClose) {
                  cleaningFormProps.onClose();
                }
                setShowCleaningForm(false);
                setCleaningFormProps(null);
              }}
              setShowDataPreview={setShowDataPreview}
              onProceedToTraining={() => {
                setShowMachineLearning(true);
                setShowCleaningForm(false);
              }}
              {...(cleaningFormProps || {})}
            />
          )}

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
              workingDataSurface={workingDataSurface}
              hasWorkingDataset={hasWorkingDataset}
              showAiWorkflow={showAiWorkflow}
              setShowAiWorkflow={setShowAiWorkflow}
              uploadedData={uploadedData || null}
              showDataPreview={showDataPreview}
              previewData={previewData}
              previewMode={previewMode}
              setPreviewMode={setPreviewMode}
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
              showAiChat={showAiChat}
              setShowAiChat={setShowAiChat}
              activeWorkflow={activeWorkflow}
              setActiveWorkflow={setActiveWorkflow}
              onOpenCleaningForm={handleOpenCleaningForm}

              onDestinationSelect={handleDestinationSelect}
              setShowDataVisual={setShowDataVisual}
              setIsDataPaneOpen={setIsDataPaneOpen}
              onOpenSourcePanel={openSourcePanel}
              onOpenDataHub={openDataHub}
              onOpenDataset={handleOpenDataset}
              workingDatasetName={workingName}
              onOpenAiChat={handleOpenAiChat}
            >
              <DatasetInfo />
            </CanvasContainer>
          )}
        </main>

        <DataPane
          activeDestination={activeDestination}
          cleanedData={cleanedData}
          isCollapsed={!isDataPaneOpen}
          setIsCollapsed={(val) => setIsDataPaneOpen(!val)}
          onCreateSemanticChart={handleCreateSemanticChart}
          onCreateSemanticKpi={handleCreateSemanticKpi}
          onAddDashboardFilter={handleAddSemanticFilter}
          onFileUploadSuccess={handleFileUpload}
          handleApiData={handleApiData}
          handleDatabaseData={handleDatabaseData}
          activeTab={activeDataPaneTab}
          setActiveTab={setActiveDataPaneTab}
          activeSource={activeSource}
          setActiveSource={setActiveSource}
          onOpenDataHub={openDataHub}
        />
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
