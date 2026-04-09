import React, { useState, useRef, useMemo, useContext, useEffect, useCallback } from 'react';
import './CanvasContainer.css';
import WindowFrame from './WindowFrame';
import MinimizedDock from './MinimizedDock';
import SmartChartWindow from '../../features/charts/SmartChartWindow';
import AICharts from '../../features/ai/AICharts';
import AiAutopilot from '../../features/ai/AiAutopilot';
import AiWorkflowLab from '../../features/workflow/AiWorkflowLab';
import PreviewModeSelector from '../../features/viewing/PreviewModeSelector';
import DataTablePreview from '../../features/viewing/DataTablePreview';
import DataStoryPanel from '../insights/DataStoryPanel';
import Whiteboard from '../../features/whiteboard/WhiteBoard';
import { JsonViewer } from 'view-json-react';
import { useActiveDataset } from '../../context/DataContext';
import AIReporter from '../../features/workflow/AIReporter';
import { getWorkflowWindows } from '../../utils/workflow_output_router';
import { useWindowContext } from '../../context/WindowContext';
import { DataContext } from '../../context/DataContext';
import RawDataViewer from '../../features/viewing/RawDataViewer';
import MachineLearningPanel from '../../features/machine_learning/MachineLearningPanel';
import DashboardFilterBar from '../../features/dashboard/DashboardFilterBar';
import KpiCardWindow from '../../features/dashboard/KpiCardWindow';
import DecisionPanel from '../../features/business/decision/DecisionPanel';
import DestinationHome from './DestinationHome';

const DESTINATIONS = {
  WORKSPACE: 'workspace',
  EXPLORE: 'explore',
  DASHBOARDS: 'dashboards',
  DECISIONS: 'decisions',
  AI: 'ai',
};

function CanvasContainer({
  activeDestination,
  children,
  uploadedData,
  showDataPreview,
  handleClosePreview,
  cleanedData,
  selectedChartType,
  handleCloseChartWindow,
  showChartWindow,
  chartData,
  aiChartData,
  aiChartType,
  showStoryPanel,
  setShowStoryPanel,
  showAIChart,
  setShowAIChart,
  showAiWorkflow,
  setShowAiWorkflow,
  chartMapping,
  previewMode,
  setPreviewMode,
  setShowDataPreview,
  showWhiteBoard,
  setShowWhiteBoard,
  pipelineResults,
  setPipelineResults,
  showAiReport,
  onCloseAiReport,
  storyModel,
  showRawViewer,
  handleCloseRawViewer,
  showMachineLearning,
  setShowMachineLearning,
  showDecisionPanel,
  setShowDecisionPanel,
  decisionBundle,
  onDecisionAction,
  decisionReadiness,
  decisionWarnings,
  onOpenAiChat,
  onRunDecision,
  setShowDataVisual,
  setIsDataPaneOpen,
}) {
  const {
    minimizedWindows,
    minimizeWindow,
    saveWindowState,
    getWindowState,
    toggleLock,
    isLocked,
    getWindowContentState,
    charts,
    removeChart,
    dashboardState,
    dashboardItems,
    removeDashboardItem,
    addDashboardKpi,
    addDashboardChart,
    restoreWindow,
  } = useWindowContext();

  const handleDestinationHomeAction = useCallback((action) => {
    switch (action) {
      case 'gallery':
        setShowDataVisual(true);
        break;
      case 'ai_chat':
        onOpenAiChat();
        break;
      case 'workflow_lab':
        setShowAiWorkflow(true);
        restoreWindow('aiWorkflowLab');
        break;
      case 'run_intelligence':
        onRunDecision();
        break;
      case 'ai_chart':
        onOpenAiChat();
        break;
      case 'upload':
        // Trigger data preview which handles intake
        setShowDataPreview(true);
        restoreWindow('dataPreview');
        break;
      case 'hub':
        // In the new shell, 'hub' is basically the data preview/management window
        setShowDataPreview(true);
        restoreWindow('dataPreview');
        break;
      case 'definitions':
        // Orient user toward the semantic definitions in the DataPane
        setIsDataPaneOpen(true);
        break;
      case 'new_kpi':
        addDashboardKpi();
        break;
      case 'new_chart':
        addDashboardChart({ chartType: 'Bar' });
        break;
      default:
        console.warn('Unknown destination home action:', action);
    }
  }, [
    setShowDataVisual, 
    onOpenAiChat, 
    setShowAiWorkflow, 
    restoreWindow, 
    onRunDecision, 
    setShowDataPreview, 
    setShowDecisionPanel,
    addDashboardKpi,
    addDashboardChart
  ]);

  const containerRef = useRef(null);
  const [containerBounds, setContainerBounds] = useState({ width: 1920, height: 1080 });
  const [focusStack, setFocusStack] = useState([]);
  const windowRegistry = useRef(new Map());

  useEffect(() => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setContainerBounds({ width: rect.width, height: rect.height });
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          setContainerBounds({
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          });
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const { fullData } = useContext(DataContext);
  const dataset = useActiveDataset();

  const previewData = useMemo(() => {
    if (Array.isArray(dataset)) return dataset.slice(0, 100);
    if (typeof dataset?.data_preview === 'string') {
      try {
        const arr = JSON.parse(dataset.data_preview);
        return arr.slice(0, 100);
      } catch (error) {
        console.error('Failed to parse dataset data_preview', error);
      }
    }
    return [];
  }, [dataset]);

  let outputWindows = getWorkflowWindows(pipelineResults || {});
  if (!showAiReport) {
    outputWindows = outputWindows.filter((windowItem) => windowItem.type !== 'report');
  }

  const registerWindow = useCallback((id, node, stateRef) => {
    if (node && stateRef) {
      windowRegistry.current.set(id, { node, stateRef });
    } else {
      windowRegistry.current.delete(id);
    }
  }, []);

  const rangesOverlap = useCallback(
    (startA, endA, startB, endB) => Math.min(endA, endB) - Math.max(startA, startB) > 0,
    []
  );

  const handleLayoutResize = useCallback((activeId, dx, dy, dir) => {
    const activeEntry = windowRegistry.current.get(activeId);
    if (!activeEntry) return { dx, dy };

    const current = activeEntry.stateRef.current;
    const SNAP_DISTANCE = 15;
    const MIN_NEIGHBOR_WIDTH = 300;
    const MIN_NEIGHBOR_HEIGHT = 200;

    let allowedDx = dx;
    let allowedDy = dy;

    const edgesTouch = (edgeA, edgeB) => Math.abs(edgeA - edgeB) < SNAP_DISTANCE;

    const updateNeighbor = (id, updates) => {
      const entry = windowRegistry.current.get(id);
      if (!entry) return;

      const newState = { ...entry.stateRef.current, ...updates };
      entry.stateRef.current = newState;

      entry.node.style.transform = `translate(${newState.x}px, ${newState.y}px)`;
      entry.node.style.width = `${newState.w}px`;
      entry.node.style.height = `${newState.h}px`;
      saveWindowState(id, { ...newState, isPixel: true });
    };

    windowRegistry.current.forEach((entry, neighborId) => {
      if (neighborId === activeId) return;
      const neighborState = entry.stateRef.current;

      const activeLeft = current.x;
      const activeRight = current.x + current.w;
      const activeTop = current.y;
      const activeBottom = current.y + current.h;
      const neighborRight = neighborState.x + neighborState.w;
      const neighborBottom = neighborState.y + neighborState.h;

      if (dir.includes('e') && edgesTouch(activeRight, neighborState.x)) {
        if (rangesOverlap(current.y, current.y + current.h, neighborState.y, neighborBottom)) {
          const maxShrink = neighborState.w - MIN_NEIGHBOR_WIDTH;
          if (dx > 0 && dx > maxShrink) {
            allowedDx = Math.min(allowedDx, maxShrink);
          }

          if (allowedDx !== 0) {
            updateNeighbor(neighborId, {
              x: neighborState.x + allowedDx,
              w: neighborState.w - allowedDx,
            });
          }
        }
      }

      if (dir.includes('w') && edgesTouch(activeLeft, neighborRight)) {
        if (rangesOverlap(current.y, current.y + current.h, neighborState.y, neighborBottom)) {
          const maxShrink = neighborState.w - MIN_NEIGHBOR_WIDTH;
          if (dx < 0 && Math.abs(dx) > maxShrink) {
            allowedDx = Math.max(allowedDx, -maxShrink);
          }

          if (allowedDx !== 0) {
            updateNeighbor(neighborId, {
              w: neighborState.w + allowedDx,
            });
          }
        }
      }

      if (dir.includes('s') && edgesTouch(activeBottom, neighborState.y)) {
        if (rangesOverlap(current.x, current.x + current.w, neighborState.x, neighborRight)) {
          const maxShrink = neighborState.h - MIN_NEIGHBOR_HEIGHT;
          if (dy > 0 && dy > maxShrink) {
            allowedDy = Math.min(allowedDy, maxShrink);
          }

          if (allowedDy !== 0) {
            updateNeighbor(neighborId, {
              y: neighborState.y + allowedDy,
              h: neighborState.h - allowedDy,
            });
          }
        }
      }

      if (dir.includes('n') && edgesTouch(activeTop, neighborBottom)) {
        if (rangesOverlap(current.x, current.x + current.w, neighborState.x, neighborRight)) {
          const maxShrink = neighborState.h - MIN_NEIGHBOR_HEIGHT;
          if (dy < 0 && Math.abs(dy) > maxShrink) {
            allowedDy = Math.max(allowedDy, -maxShrink);
          }

          if (allowedDy !== 0) {
            updateNeighbor(neighborId, {
              h: neighborState.h + allowedDy,
            });
          }
        }
      }
    });

    return { dx: allowedDx, dy: allowedDy };
  }, [rangesOverlap, saveWindowState]);

  const handleLayoutDrag = useCallback((activeId, nextX, nextY) => {
    const activeEntry = windowRegistry.current.get(activeId);
    if (!activeEntry) return { x: nextX, y: nextY };

    const { w, h } = activeEntry.stateRef.current;
    const SNAP_DISTANCE = 15;
    const container = containerRef.current
      ? containerRef.current.getBoundingClientRect()
      : { width: 1920, height: 1080 };

    let snappedX = nextX;
    let snappedY = nextY;
    let bestXDelta = SNAP_DISTANCE + 1;
    let bestYDelta = SNAP_DISTANCE + 1;

    if (Math.abs(nextX) < SNAP_DISTANCE) {
      snappedX = 0;
      bestXDelta = Math.abs(nextX);
    }
    if (Math.abs(nextY) < SNAP_DISTANCE) {
      snappedY = 0;
      bestYDelta = Math.abs(nextY);
    }
    if (Math.abs(nextX + w - container.width) < bestXDelta) {
      snappedX = container.width - w;
      bestXDelta = Math.abs(nextX + w - container.width);
    }
    if (Math.abs(nextY + h - container.height) < bestYDelta) {
      snappedY = container.height - h;
      bestYDelta = Math.abs(nextY + h - container.height);
    }

    windowRegistry.current.forEach((entry, neighborId) => {
      if (neighborId === activeId) return;
      const neighborState = entry.stateRef.current;
      const neighborRight = neighborState.x + neighborState.w;
      const neighborBottom = neighborState.y + neighborState.h;

      const verticalOverlap = rangesOverlap(nextY, nextY + h, neighborState.y, neighborBottom);
      const horizontalOverlap = rangesOverlap(nextX, nextX + w, neighborState.x, neighborRight);

      if (verticalOverlap) {
        const snapRightDelta = Math.abs(nextX + w - neighborState.x);
        if (snapRightDelta < bestXDelta) {
          snappedX = neighborState.x - w;
          bestXDelta = snapRightDelta;
        }
        const snapLeftDelta = Math.abs(nextX - neighborRight);
        if (snapLeftDelta < bestXDelta) {
          snappedX = neighborRight;
          bestXDelta = snapLeftDelta;
        }
      }

      if (horizontalOverlap) {
        const snapBottomDelta = Math.abs(nextY + h - neighborState.y);
        if (snapBottomDelta < bestYDelta) {
          snappedY = neighborState.y - h;
          bestYDelta = snapBottomDelta;
        }
        const snapTopDelta = Math.abs(nextY - neighborBottom);
        if (snapTopDelta < bestYDelta) {
          snappedY = neighborBottom;
          bestYDelta = snapTopDelta;
        }
      }
    });

    return { x: snappedX, y: snappedY };
  }, [rangesOverlap]);

  const handleFocus = useCallback((id) => {
    setFocusStack((prev) => {
      const filtered = prev.filter((windowId) => windowId !== id);
      return [...filtered, id];
    });
  }, []);

  const getZIndex = (id) => {
    const idx = focusStack.indexOf(id);
    return idx === -1 ? 1 : 10 + idx;
  };

  const getInitialState = (id, defaultGridW = 6, defaultGridH = 10, defaultPixelW, defaultPixelH) => {
    const MIN_WINDOW_WIDTH = 300;
    const MIN_WINDOW_HEIGHT = 200;
    const saved = getWindowState(id);
    if (saved && saved.isPixel) {
      return {
        ...saved,
        w: Math.max(saved.w, MIN_WINDOW_WIDTH),
        h: Math.max(saved.h, MIN_WINDOW_HEIGHT),
      };
    }

    const width = containerBounds.width || 1920;
    const height = containerBounds.height || 1080;
    if (saved && !saved.isPixel) {
      return {
        x: (saved.x / 10) * width,
        y: saved.y * 30,
        w: Math.max((saved.w / 10) * width, MIN_WINDOW_WIDTH),
        h: Math.max(saved.h * 30, MIN_WINDOW_HEIGHT),
        isPixel: true,
      };
    }

    let largestWindowId = null;
    let maxArea = 0;

    windowRegistry.current.forEach((entry, windowId) => {
      if (!minimizedWindows[windowId]) {
        const { w, h } = entry.stateRef.current;
        const canSplitHorizontally = w >= MIN_WINDOW_WIDTH * 2;
        const canSplitVertically = h >= MIN_WINDOW_HEIGHT * 2;
        if (canSplitHorizontally || canSplitVertically) {
          const area = w * h;
          if (area > maxArea) {
            maxArea = area;
            largestWindowId = windowId;
          }
        }
      }
    });

    if (largestWindowId) {
      const targetEntry = windowRegistry.current.get(largestWindowId);
      const targetState = targetEntry.stateRef.current;
      const canSplitHorizontally = targetState.w >= MIN_WINDOW_WIDTH * 2;
      const canSplitVertically = targetState.h >= MIN_WINDOW_HEIGHT * 2;
      const shouldSplitHorizontally = targetState.w > targetState.h * 1.2;

      if (shouldSplitHorizontally && canSplitHorizontally) {
        const newWidth = targetState.w / 2;
        const updatedExisting = { ...targetState, w: newWidth };
        targetEntry.stateRef.current = updatedExisting;
        targetEntry.node.style.width = `${newWidth}px`;
        saveWindowState(largestWindowId, { ...updatedExisting, isPixel: true });

        return {
          x: targetState.x + newWidth,
          y: targetState.y,
          w: newWidth,
          h: targetState.h,
          isPixel: true,
        };
      }

      if (canSplitVertically) {
        const newHeight = targetState.h / 2;
        const updatedExisting = { ...targetState, h: newHeight };
        targetEntry.stateRef.current = updatedExisting;
        targetEntry.node.style.height = `${newHeight}px`;
        saveWindowState(largestWindowId, { ...updatedExisting, isPixel: true });

        return {
          x: targetState.x,
          y: targetState.y + newHeight,
          w: targetState.w,
          h: newHeight,
          isPixel: true,
        };
      }
    }

    const fallbackWidth = Math.max(defaultPixelW || Math.min(width * 0.65, 960), MIN_WINDOW_WIDTH);
    const fallbackHeight = Math.max(defaultPixelH || Math.min(height * 0.6, 720), MIN_WINDOW_HEIGHT);
    return {
      x: Math.max((width - fallbackWidth) / 2, 20),
      y: Math.max((height - fallbackHeight) / 2, 80),
      w: fallbackWidth,
      h: fallbackHeight,
      isPixel: true,
    };
  };

  const handleSave = useCallback((id, pixelState) => {
    saveWindowState(id, { ...pixelState, isPixel: true });
  }, [saveWindowState]);

  const getWindowProps = (id, title, onClose, onMinimize, onMaximize = null) => ({
    id,
    title,
    key: id,
    containerRef,
    zIndex: getZIndex(id),
    isActive: focusStack[focusStack.length - 1] === id,
    onFocus: handleFocus,
    onSave: handleSave,
    onClose,
    onMinimize,
    onMaximize,
    isLocked: isLocked(id),
    onToggleLock: toggleLock,
    onResize: handleLayoutResize,
    onDrag: handleLayoutDrag,
    registerWindow,
  });

  const isDashboardDest = activeDestination === DESTINATIONS.DASHBOARDS;
  const isExploreDest = activeDestination === DESTINATIONS.EXPLORE;
  const isWorkspaceDest = activeDestination === DESTINATIONS.WORKSPACE;
  const isDecisionDest = activeDestination === DESTINATIONS.DECISIONS;
  const isAiDest = activeDestination === DESTINATIONS.AI;

  const workflowElements = outputWindows
    .filter((windowItem) => !minimizedWindows[`workflow-${windowItem.id}`])
    .map((windowItem) => {
      const id = `workflow-${windowItem.id}`;
      const initialState = getInitialState(id, 8, 15);

      return (
        <WindowFrame
          {...getWindowProps(
            id,
            windowItem.label,
            () => {
              if (windowItem.type === 'report') {
                setPipelineResults({});
                if (onCloseAiReport) onCloseAiReport();
              } else {
                setPipelineResults((prev) => {
                  const copy = { ...prev };
                  delete copy[windowItem.id];
                  return copy;
                });
              }
            },
            () => minimizeWindow(id, windowItem.label),
            () => {}
          )}
          initialState={initialState}
        >
          {windowItem.type === 'text' && <pre style={{ padding: '10px' }}>{windowItem.content}</pre>}
          {windowItem.type === 'chart' && <AICharts aiChartType={windowItem.chartType} aiChartData={windowItem.chartData} />}
          {windowItem.type === 'report' && (
            <AIReporter
              summary={windowItem.content.summary}
              outliers={windowItem.content.outliers}
              insights={windowItem.content.insights}
              execution={windowItem.content.execution}
              chartType={windowItem.content.chartType}
              chartData={windowItem.content.chartData}
            />
          )}
        </WindowFrame>
      );
    });

  const dataPreviewElement = (dataset && previewData.length > 0 && showDataPreview && !minimizedWindows.dataPreview) ? (
    <WindowFrame
      {...getWindowProps('dataPreview', '📄 Data Preview', handleClosePreview, () => minimizeWindow('dataPreview', 'Data Preview'))}
      initialState={getInitialState('dataPreview', 8, 20)}
    >
      <div className="uploaded-data-preview">
        <div style={{ padding: '0 10px 10px 10px' }}>
          <PreviewModeSelector previewMode={previewMode} setPreviewMode={setPreviewMode} />
          <AiAutopilot setShowAiWorkflow={setShowAiWorkflow} />
        </div>

        {previewMode === 'table' && <DataTablePreview data={previewData} />}
        {previewMode === 'json' && (
          <div className="json-viewer-container" style={{ padding: '16px', overflowY: 'auto' }}>
            <JsonViewer
              data={previewData}
              expandLevel={2}
              onCopy={(copyData) => console.log('Copied data:', copyData)}
              style={{ fontSize: '14px', color: '#383838' }}
            />
          </div>
        )}
        {children}
      </div>
    </WindowFrame>
  ) : null;

  const rawDataElement = (showRawViewer && !minimizedWindows.rawViewer) ? (
    <WindowFrame
      {...getWindowProps('rawViewer', '📜 Raw Data (All Rows)', handleCloseRawViewer, () => minimizeWindow('rawViewer', 'Raw Data'))}
      initialState={getInitialState('rawViewer', 8, 20)}
    >
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <RawDataViewer rows={fullData || []} pageSize={500} />
      </div>
    </WindowFrame>
  ) : null;

  const aiChartElement = (showAIChart && !minimizedWindows.aiChartWindow) ? (
    <WindowFrame
      {...getWindowProps('aiChartWindow', '📊 AI-Generated Chart', () => setShowAIChart(false), () => minimizeWindow('aiChartWindow', 'AI Chart'))}
      initialState={getInitialState('aiChartWindow', 8, 15)}
    >
      <div style={{ height: '100%', padding: '10px' }}>
        <AICharts aiChartType={aiChartType} aiChartData={aiChartData} />
      </div>
    </WindowFrame>
  ) : null;

  const workflowLabElement = (showAiWorkflow && !minimizedWindows.aiWorkflowLab) ? (
    <WindowFrame
      {...getWindowProps('aiWorkflowLab', 'AI Workflow Lab', () => setShowAiWorkflow(false), () => minimizeWindow('aiWorkflowLab', 'AI Workflow'))}
      initialState={getInitialState('aiWorkflowLab', 9, 25)}
    >
      <div className="workflow-content">
        <AiWorkflowLab savedState={getWindowContentState('aiWorkflowLab')} />
      </div>
    </WindowFrame>
  ) : null;

  const whiteBoardElement = (showWhiteBoard && !minimizedWindows.whiteBoard) ? (
    <WindowFrame
      {...getWindowProps('whiteBoard', '📊 White Board', () => setShowWhiteBoard(false), () => minimizeWindow('whiteBoard', 'White Board'))}
      initialState={getInitialState('whiteBoard', 9, 25)}
    >
      <div style={{ height: '100%' }}>
        <Whiteboard savedScene={getWindowContentState('whiteBoard')} />
      </div>
    </WindowFrame>
  ) : null;

  const chartElements = charts
    .filter((chart) => !minimizedWindows[chart.id])
    .map((chart) => {
      const chartTitle = chart.dataSourceMode === 'semantic'
        ? `📊 Semantic ${chart.type} Chart`
        : `📊 ${chart.type} Chart`;
      const minimizedTitle = chart.dataSourceMode === 'semantic'
        ? `Semantic ${chart.type} Chart`
        : `${chart.type} Chart`;

      return (
        <WindowFrame
          {...getWindowProps(chart.id, chartTitle, () => removeChart(chart.id), () => minimizeWindow(chart.id, minimizedTitle))}
          initialState={getInitialState(chart.id, 6, 18)}
        >
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <SmartChartWindow
              id={chart.id}
              data={cleanedData || uploadedData}
              type={chart.type}
              mapping={chart.mapping}
              isLocked={isLocked(chart.id)}
              dataSourceMode={chart.dataSourceMode}
              semanticConfig={chart.semanticConfig}
            />
          </div>
        </WindowFrame>
      );
    });

  const dashboardElements = dashboardItems
    .filter((item) => !minimizedWindows[item.id])
    .map((item) => {
      if (item.itemType === 'kpi') {
        return (
          <WindowFrame
            {...getWindowProps(item.id, `📌 ${item.title || 'KPI Card'}`, () => removeDashboardItem(item.id), () => minimizeWindow(item.id, item.title || 'KPI Card'))}
            initialState={getInitialState(item.id, 4, 8, 380, 260)}
          >
            <KpiCardWindow
              id={item.id}
              item={item}
              dashboardFilters={dashboardState.filters}
              isLocked={isLocked(item.id)}
            />
          </WindowFrame>
        );
      }

      return (
        <WindowFrame
          {...getWindowProps(item.id, `📊 Dashboard ${item.chartType} Chart`, () => removeDashboardItem(item.id), () => minimizeWindow(item.id, `Dashboard ${item.chartType} Chart`))}
          initialState={getInitialState(item.id, 7, 18, 680, 420)}
        >
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <SmartChartWindow
              id={item.id}
              data={cleanedData || uploadedData}
              type={item.chartType}
              mapping={item.mapping}
              isLocked={isLocked(item.id)}
              dataSourceMode={item.dataSourceMode}
              semanticConfig={item.semanticConfig}
              externalFilters={dashboardState.filters}
            />
          </div>
        </WindowFrame>
      );
    });

  const storyPanelElement = (showStoryPanel && !minimizedWindows.storyPanel) ? (
    <WindowFrame
      {...getWindowProps('storyPanel', '📖 Data Story', () => setShowStoryPanel(false), () => minimizeWindow('storyPanel', 'Story'))}
      initialState={getInitialState('storyPanel', 9, 25)}
    >
      <DataStoryPanel uploadedData={uploadedData} cleanedData={cleanedData} model={storyModel} />
    </WindowFrame>
  ) : null;

  const machineLearningElement = (showMachineLearning && !minimizedWindows.machineLearning) ? (
    <WindowFrame
      {...getWindowProps('machineLearning', '🧠 Machine Learning', () => setShowMachineLearning(false), () => minimizeWindow('machineLearning', 'ML'))}
      initialState={getInitialState('machineLearning', 8, 20)}
    >
      <MachineLearningPanel />
    </WindowFrame>
  ) : null;

  const decisionPanelElement = (showDecisionPanel && !minimizedWindows.decisionPanel) ? (
    <WindowFrame
      {...getWindowProps('decisionPanel', '🧠 Decision Intelligence', () => setShowDecisionPanel(false), () => minimizeWindow('decisionPanel', 'Decision Intelligence'))}
      initialState={getInitialState('decisionPanel', 9, 25, 1200, 800)}
    >
      <DecisionPanel 
        bundle={decisionBundle} 
        onActionClick={onDecisionAction}
        readiness={decisionReadiness}
        warnings={decisionWarnings}
      />
    </WindowFrame>
  ) : null;

  const shouldShowHome = useMemo(() => {
    if (isWorkspaceDest) return !showDataPreview && !showRawViewer && !showMachineLearning;
    if (isExploreDest) return charts.length === 0 && !showDataPreview;
    if (isDashboardDest) return dashboardItems.length === 0;
    if (isAiDest) {
      const hasAiWorkflowWindows = outputWindows.length > 0;
      return !showAiWorkflow && !showAIChart && !showStoryPanel && !showWhiteBoard && !hasAiWorkflowWindows;
    }
    if (isDecisionDest) return !showDecisionPanel && charts.length === 0;
    return true;
  }, [
    isWorkspaceDest,
    isExploreDest,
    isDashboardDest,
    isAiDest,
    isDecisionDest,
    showDataPreview,
    showRawViewer,
    showMachineLearning,
    charts.length,
    dashboardItems.length,
    showAiWorkflow,
    showAIChart,
    showStoryPanel,
    showWhiteBoard,
    outputWindows.length,
    showDecisionPanel,
  ]);

  return (
    <div className="canvas-dnd-wrapper" style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <div
        ref={containerRef}
        className="canvas-container desktop-surface"
        style={{ width: '100%', height: '100%', position: 'relative' }}
      >
        {isDashboardDest && <DashboardFilterBar />}
        {shouldShowHome && (
          <DestinationHome 
            activeDestination={activeDestination} 
            onAction={handleDestinationHomeAction} 
          />
        )}
        
        {/* Render relevant windows for the active destination */}
        {(isAiDest || isWorkspaceDest) && workflowElements}
        {(isWorkspaceDest || isExploreDest) && dataPreviewElement}
        {isWorkspaceDest && rawDataElement}
        {isWorkspaceDest && machineLearningElement}
        {(isExploreDest || isAiDest) && aiChartElement}
        {isAiDest && workflowLabElement}
        {isAiDest && whiteBoardElement}
        {isAiDest && storyPanelElement}
        {(isExploreDest || isDecisionDest) && chartElements}
        {isDashboardDest && dashboardElements}
        {isDecisionDest && decisionPanelElement}
      </div>
      <MinimizedDock />
    </div>
  );
}

export default CanvasContainer;
