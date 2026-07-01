import React, { useState, useRef, useMemo, useContext, useEffect, useCallback } from 'react';
import { createPortal, flushSync } from 'react-dom';
import './CanvasContainer.css';
import WindowFrame from './WindowFrame';
import MinimizedDock from './MinimizedDock';
import SmartChartWindow from '../../features/charts/SmartChartWindow';
import AICharts from '../../features/ai/AICharts';
import AIShell from '../../features/ai/AIShell';
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
import DashboardSlicerPanel from '../../features/dashboard/DashboardSlicerPanel';
import DashboardCommandBar from '../../features/dashboard/DashboardCommandBar';
import KpiCardWindow from '../../features/dashboard/KpiCardWindow';
import { WINDOW_SIZING } from '../../utils/windowSizing';
import DecisionGraphWorkspace from '../../features/business/decision/graph/DecisionGraphWorkspace';
import DestinationHome from './DestinationHome';
import {
  FaSave,
  FaUndo,
  FaRedo,
  FaShare,
  FaTrash,
  FaFileExport,
  FaProjectDiagram,
  FaCogs,
  FaBookOpen,
  FaRobot,
  FaCompress,
  FaExternalLinkAlt
} from 'react-icons/fa';

const DESTINATIONS = {
  WORKSPACE: 'workspace',
  EXPLORE: 'explore',
  DASHBOARDS: 'dashboards',
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
  setAiChartData,
  setAiChartType,
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
  showAiChat,
  setShowAiChat,
  decisionReadiness,
  onOpenAiChat,
  onDestinationSelect,
  setShowDataVisual,
  setIsDataPaneOpen,
  showDecisionGraph,
  setShowDecisionGraph,
  onOpenDecisionGraph,
  decisionGraphContext,
  semanticModel,
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
    dashboardItems,
    dashboardState,
    updateDashboardItem,
    removeDashboardItem,
    addDashboardKpi,
    addDashboardChart,
    isAiChatOpen,
    toggleAiChat,
    restoreWindow,
  } = useWindowContext();

  const isDashboardDest = activeDestination === DESTINATIONS.DASHBOARDS;
  const isExploreDest = activeDestination === DESTINATIONS.EXPLORE;
  const isWorkspaceDest = activeDestination === DESTINATIONS.WORKSPACE;
  const isAiDest = activeDestination === DESTINATIONS.AI;

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
        addDashboardChart({
          chartType: 'Bar',
          dataSourceMode: isDashboardDest ? 'semantic' : 'raw'
        });
        break;
      default:
        console.warn('Unknown destination home action:', action);
    }
  }, [
    setShowDataVisual,
    onOpenAiChat,
    setShowAiWorkflow,
    restoreWindow,
    onDestinationSelect,
    activeDestination,
    setShowDataPreview,
    addDashboardKpi,
    addDashboardChart,
    isDashboardDest,
    setIsDataPaneOpen
  ]);

  const containerRef = useRef(null);
  const [containerBounds, setContainerBounds] = useState({ left: 0, top: 0, width: 1920, height: 1080 });
  const [focusStack, setFocusStack] = useState([]);
  const [isAiChatPoppedOut, setIsAiChatPoppedOut] = useState(false);
  const [aiChatPopupRoot, setAiChatPopupRoot] = useState(null);
  const aiChatPopupWindowRef = useRef(null);
  const isClosingAiChatPopupRef = useRef(false);
  const windowRegistry = useRef(new Map());

  useEffect(() => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setContainerBounds({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          const nextRect = containerRef.current.getBoundingClientRect();
          setContainerBounds({
            left: nextRect.left,
            top: nextRect.top,
            width: nextRect.width,
            height: nextRect.height,
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

  const getInitialState = (id, defaultGridW = 6, defaultGridH = 10, defaultPixelW, defaultPixelH, minW = 300, minH = 200) => {
    const saved = getWindowState(id);
    if (saved && saved.isPixel) {
      return {
        ...saved,
        w: Math.max(saved.w, minW),
        h: Math.max(saved.h, minH),
      };
    }

    const width = containerBounds.width || 1920;
    const height = containerBounds.height || 1080;
    if (saved && !saved.isPixel) {
      return {
        x: (saved.x / 10) * width,
        y: saved.y * 30,
        w: Math.max((saved.w / 10) * width, minW),
        h: Math.max(saved.h * 30, minH),
        isPixel: true,
      };
    }

    let largestWindowId = null;
    let maxArea = 0;

    windowRegistry.current.forEach((entry, windowId) => {
      if (!minimizedWindows[windowId]) {
        const { w, h } = entry.stateRef.current;
        const canSplitHorizontally = w >= minW * 2;
        const canSplitVertically = h >= minH * 2;
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
      const canSplitHorizontally = targetState.w >= minW * 2;
      const canSplitVertically = targetState.h >= minH * 2;
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
          w: Math.max(newWidth, minW),
          h: Math.max(targetState.h, minH),
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
          w: Math.max(targetState.w, minW),
          h: Math.max(newHeight, minH),
          isPixel: true,
        };
      }
    }

    const fallbackWidth = Math.max(defaultPixelW || Math.min(width * 0.65, 960), minW);
    const fallbackHeight = Math.max(defaultPixelH || Math.min(height * 0.6, 720), minH);
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

  const workflowElements = outputWindows
    .filter((windowItem) => !minimizedWindows[`workflow-${windowItem.id}`])
    .map((windowItem) => {
      const id = `workflow-${windowItem.id}`;
      let sizing = WINDOW_SIZING.WORKFLOW_NODE.TEXT;
      if (windowItem.type === 'chart') sizing = WINDOW_SIZING.WORKFLOW_NODE.CHART;
      if (windowItem.type === 'report') sizing = WINDOW_SIZING.WORKFLOW_NODE.REPORT;

      const initialState = getInitialState(id, 8, 15, sizing.defW, sizing.defH, sizing.minW, sizing.minH);

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
          minWidth={sizing.minW}
          minHeight={sizing.minH}
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
      initialState={getInitialState('dataPreview', 8, 20, WINDOW_SIZING.DATA_PREVIEW.defW, WINDOW_SIZING.DATA_PREVIEW.defH, WINDOW_SIZING.DATA_PREVIEW.minW, WINDOW_SIZING.DATA_PREVIEW.minH)}
      minWidth={WINDOW_SIZING.DATA_PREVIEW.minW}
      minHeight={WINDOW_SIZING.DATA_PREVIEW.minH}
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
      initialState={getInitialState('rawViewer', 8, 20, WINDOW_SIZING.RAW_VIEWER.defW, WINDOW_SIZING.RAW_VIEWER.defH, WINDOW_SIZING.RAW_VIEWER.minW, WINDOW_SIZING.RAW_VIEWER.minH)}
      minWidth={WINDOW_SIZING.RAW_VIEWER.minW}
      minHeight={WINDOW_SIZING.RAW_VIEWER.minH}
    >
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <RawDataViewer rows={fullData || []} pageSize={500} />
      </div>
    </WindowFrame>
  ) : null;

  const aiChartElement = (showAIChart && !minimizedWindows.aiChartWindow) ? (
    <WindowFrame
      {...getWindowProps('aiChartWindow', '📊 AI-Generated Chart', () => setShowAIChart(false), () => minimizeWindow('aiChartWindow', 'AI Chart'))}
      initialState={getInitialState('aiChartWindow', 8, 15, WINDOW_SIZING.AI_CHART.defW, WINDOW_SIZING.AI_CHART.defH, WINDOW_SIZING.AI_CHART.minW, WINDOW_SIZING.AI_CHART.minH)}
      minWidth={WINDOW_SIZING.AI_CHART.minW}
      minHeight={WINDOW_SIZING.AI_CHART.minH}
    >
      <div style={{ height: '100%', padding: '10px' }}>
        <AICharts aiChartType={aiChartType} aiChartData={aiChartData} />
      </div>
    </WindowFrame>
  ) : null;

  const workflowLabElement = (showAiWorkflow && !minimizedWindows.aiWorkflowLab) ? (
    <WindowFrame
      {...getWindowProps('aiWorkflowLab', 'AI Workflow Lab', () => setShowAiWorkflow(false), () => minimizeWindow('aiWorkflowLab', 'AI Workflow'))}
      initialState={getInitialState('aiWorkflowLab', 9, 25, WINDOW_SIZING.WORKFLOW_LAB.defW, WINDOW_SIZING.WORKFLOW_LAB.defH, WINDOW_SIZING.WORKFLOW_LAB.minW, WINDOW_SIZING.WORKFLOW_LAB.minH)}
      minWidth={WINDOW_SIZING.WORKFLOW_LAB.minW}
      minHeight={WINDOW_SIZING.WORKFLOW_LAB.minH}
    >
      <div className="workflow-content">
        <AiWorkflowLab savedState={getWindowContentState('aiWorkflowLab')} />
      </div>
    </WindowFrame>
  ) : null;

  const whiteBoardElement = (showWhiteBoard && !minimizedWindows.whiteBoard) ? (
    <WindowFrame
      {...getWindowProps('whiteBoard', '📊 White Board', () => setShowWhiteBoard(false), () => minimizeWindow('whiteBoard', 'White Board'))}
      initialState={getInitialState('whiteBoard', 9, 25, WINDOW_SIZING.WHITEBOARD.defW, WINDOW_SIZING.WHITEBOARD.defH, WINDOW_SIZING.WHITEBOARD.minW, WINDOW_SIZING.WHITEBOARD.minH)}
      minWidth={WINDOW_SIZING.WHITEBOARD.minW}
      minHeight={WINDOW_SIZING.WHITEBOARD.minH}
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

      const isPopulated = chart.mapping && (chart.mapping['X-Axis'] || chart.mapping['Y-Axis'] || chart.mapping.values || chart.semanticConfig?.metricId);
      const sizing = isPopulated ? WINDOW_SIZING.CHART.POPULATED : WINDOW_SIZING.CHART.BLANK;
      const initialState = getInitialState(chart.id, 6, 18, sizing.defW, sizing.defH, sizing.minW, sizing.minH);

      return (
        <WindowFrame
          {...getWindowProps(chart.id, chartTitle, () => removeChart(chart.id), () => minimizeWindow(chart.id, minimizedTitle))}
          initialState={initialState}
          minWidth={sizing.minW}
          minHeight={sizing.minH}
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
        const isPopulated = !!item.semanticConfig?.metricId;
        const sizing = isPopulated ? WINDOW_SIZING.KPI.POPULATED : WINDOW_SIZING.KPI.BLANK;

        return (
          <WindowFrame
            {...getWindowProps(item.id, `📌 ${item.title || 'KPI Card'}`, () => removeDashboardItem(item.id), () => minimizeWindow(item.id, item.title || 'KPI Card'))}
            initialState={getInitialState(item.id, 4, 8, sizing.defW, sizing.defH, sizing.minW, sizing.minH)}
            minWidth={sizing.minW}
            minHeight={sizing.minH}
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

      const isPopulated = item.mapping && (item.mapping['X-Axis'] || item.mapping['Y-Axis'] || item.mapping.values || item.semanticConfig?.metricId);
      const sizing = isPopulated ? WINDOW_SIZING.CHART.POPULATED : WINDOW_SIZING.CHART.BLANK;
      const initialState = getInitialState(item.id, 7, 18, sizing.defW, sizing.defH, sizing.minW, sizing.minH);

      return (
        <WindowFrame
          {...getWindowProps(item.id, `📊 Dashboard ${item.chartType} Chart`, () => removeDashboardItem(item.id), () => minimizeWindow(item.id, `Dashboard ${item.chartType} Chart`))}
          initialState={initialState}
          minWidth={sizing.minW}
          minHeight={sizing.minH}
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
      initialState={getInitialState('storyPanel', 9, 25, WINDOW_SIZING.STORY_PANEL.defW, WINDOW_SIZING.STORY_PANEL.defH, WINDOW_SIZING.STORY_PANEL.minW, WINDOW_SIZING.STORY_PANEL.minH)}
      minWidth={WINDOW_SIZING.STORY_PANEL.minW}
      minHeight={WINDOW_SIZING.STORY_PANEL.minH}
    >
      <DataStoryPanel uploadedData={uploadedData} cleanedData={cleanedData} model={storyModel} />
    </WindowFrame>
  ) : null;

  const machineLearningElement = (showMachineLearning && !minimizedWindows.machineLearning) ? (
    <WindowFrame
      {...getWindowProps('machineLearning', '🧠 Machine Learning', () => setShowMachineLearning(false), () => minimizeWindow('machineLearning', 'ML'))}
      initialState={getInitialState('machineLearning', 8, 20, WINDOW_SIZING.MACHINE_LEARNING.defW, WINDOW_SIZING.MACHINE_LEARNING.defH, WINDOW_SIZING.MACHINE_LEARNING.minW, WINDOW_SIZING.MACHINE_LEARNING.minH)}
      minWidth={WINDOW_SIZING.MACHINE_LEARNING.minW}
      minHeight={WINDOW_SIZING.MACHINE_LEARNING.minH}
    >
      <MachineLearningPanel />
    </WindowFrame>
  ) : null;


  const decisionGraphElement = (showDecisionGraph && !minimizedWindows.decisionGraph) ? (
    <WindowFrame
      {...getWindowProps('decisionGraph', '📊 Decision Graph', () => setShowDecisionGraph(false), () => minimizeWindow('decisionGraph', 'Decision Graph'))}
      initialState={getInitialState('decisionGraph', 9, 25, WINDOW_SIZING.DECISION_PANEL.defW, WINDOW_SIZING.DECISION_PANEL.defH, WINDOW_SIZING.DECISION_PANEL.minW, WINDOW_SIZING.DECISION_PANEL.minH)}
      minWidth={WINDOW_SIZING.DECISION_PANEL.minW}
      minHeight={WINDOW_SIZING.DECISION_PANEL.minH}
    >
      <DecisionGraphWorkspace
        dataset={decisionGraphContext?.dataset || (cleanedData?.length > 0 ? cleanedData : fullData?.length > 0 ? fullData : null)}
        semanticModel={decisionGraphContext?.semantic_model || semanticModel}
        initialContext={decisionGraphContext}
      />
    </WindowFrame>
  ) : null;

  const closeAiChatPopupWindow = useCallback(() => {
    const popupWindow = aiChatPopupWindowRef.current;
    aiChatPopupWindowRef.current = null;
    setAiChatPopupRoot(null);

    if (popupWindow && !popupWindow.closed) {
      popupWindow.close();
    }
  }, []);

  const prepareAiChatPopupWindow = useCallback((popupWindow) => {
    const popupDocument = popupWindow.document;

    popupDocument.open();
    popupDocument.write('<!doctype html><html><head><title>AI Chat</title></head><body><div id="ai-chat-popout-root"></div></body></html>');
    popupDocument.close();

    popupDocument.documentElement.className = document.documentElement.className;
    popupDocument.body.className = document.body.className;

    document.querySelectorAll('link[rel="stylesheet"], style').forEach((styleNode) => {
      popupDocument.head.appendChild(styleNode.cloneNode(true));
    });

    const popupBaseStyle = popupDocument.createElement('style');
    popupBaseStyle.textContent = `
      html,
      body,
      #ai-chat-popout-root {
        width: 100%;
        height: 100%;
        margin: 0;
        overflow: hidden;
        background: var(--bg-primary, #ffffff);
      }

      body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      }
    `;
    popupDocument.head.appendChild(popupBaseStyle);

    return popupDocument.getElementById('ai-chat-popout-root');
  }, []);

  const handleDockAiChat = useCallback(() => {
    isClosingAiChatPopupRef.current = true;
    closeAiChatPopupWindow();
    setIsAiChatPoppedOut(false);
    restoreWindow('aiChat');
    window.setTimeout(() => {
      isClosingAiChatPopupRef.current = false;
    }, 0);
  }, [closeAiChatPopupWindow, restoreWindow]);

  const handleToggleAiChatPopout = useCallback(() => {
    if (isAiChatPoppedOut) {
      handleDockAiChat();
      return;
    }

    const popupWindow = window.open(
      '',
      'ai-chat-popout',
      'popup=yes,width=1200,height=850,left=160,top=80,resizable=yes,scrollbars=no'
    );

    if (!popupWindow) {
      console.warn('AI Chat pop-out was blocked by the browser.');
      return;
    }

    const popupRoot = prepareAiChatPopupWindow(popupWindow);
    aiChatPopupWindowRef.current = popupWindow;
    setAiChatPopupRoot(popupRoot);
    setIsAiChatPoppedOut(true);
    restoreWindow('aiChat');
    popupWindow.focus();
  }, [handleDockAiChat, isAiChatPoppedOut, prepareAiChatPopupWindow, restoreWindow]);

  useEffect(() => {
    if (!isAiChatPoppedOut) return undefined;

    const checkPopupWindow = window.setInterval(() => {
      const popupWindow = aiChatPopupWindowRef.current;
      if (popupWindow && !popupWindow.closed) return;

      aiChatPopupWindowRef.current = null;
      setAiChatPopupRoot(null);
      setIsAiChatPoppedOut(false);

      if (!isClosingAiChatPopupRef.current) {
        restoreWindow('aiChat');
      }
    }, 500);

    return () => window.clearInterval(checkPopupWindow);
  }, [isAiChatPoppedOut, restoreWindow]);

  useEffect(() => () => {
    isClosingAiChatPopupRef.current = true;
    closeAiChatPopupWindow();
  }, [closeAiChatPopupWindow]);

  const handleMinimizeAiChat = useCallback(() => {
    isClosingAiChatPopupRef.current = true;

    flushSync(() => {
      setIsAiChatPoppedOut(false);
      setAiChatPopupRoot(null);
      minimizeWindow('aiChat', 'AI Chat');
    });

    const popupWindow = aiChatPopupWindowRef.current;
    aiChatPopupWindowRef.current = null;

    if (popupWindow && !popupWindow.closed) {
      popupWindow.close();
    }

    window.setTimeout(() => {
      isClosingAiChatPopupRef.current = false;
    }, 0);
  }, [minimizeWindow]);

  const handleCloseAiChat = useCallback(() => {
    isClosingAiChatPopupRef.current = true;
    closeAiChatPopupWindow();
    setIsAiChatPoppedOut(false);
    setShowAiChat(false);
    window.setTimeout(() => {
      isClosingAiChatPopupRef.current = false;
    }, 0);
  }, [closeAiChatPopupWindow, setShowAiChat]);

  const aiChatHeaderActions = (
    <button
      className={`header-button ai-chat-popout-button ${isAiChatPoppedOut ? 'is-active' : ''}`}
      onClick={(event) => {
        event.stopPropagation();
        handleToggleAiChatPopout();
      }}
      aria-label={isAiChatPoppedOut ? 'Dock AI Chat in app' : 'Open AI Chat in separate window'}
      title={isAiChatPoppedOut ? 'Dock AI Chat in app' : 'Open AI Chat in separate window'}
    >
      {isAiChatPoppedOut ? <FaCompress /> : <FaExternalLinkAlt />}
    </button>
  );

  const aiChatElement = showAiChat ? (
    <WindowFrame
      {...getWindowProps('aiChat', '🤖 AI Analysis Suite', handleCloseAiChat, handleMinimizeAiChat)}
      initialState={getInitialState('aiChat', 10, 25, 1100, 800)}
      minWidth={800}
      minHeight={600}
      headerActions={aiChatHeaderActions}
      isMinimized={!!minimizedWindows.aiChat}
      isExternalWindow={isAiChatPoppedOut && !!aiChatPopupRoot}
    >
      <AIShell
        setShowAIChart={setShowAIChart}
        setAiChartType={setAiChartType}
        setAiChartData={setAiChartData}
        onOpenDecisionGraph={onOpenDecisionGraph}
      />
    </WindowFrame>
  ) : null;

  const aiChatPortal = showAiChat && typeof document !== 'undefined'
    ? isAiChatPoppedOut && aiChatPopupRoot
      ? createPortal(aiChatElement, aiChatPopupRoot, 'ai-chat-popout-window')
      : createPortal(
        <div
          className="ai-chat-window-portal"
          style={{
            left: `${containerBounds.left}px`,
            top: `${containerBounds.top}px`,
            width: `${containerBounds.width}px`,
            height: `${containerBounds.height}px`,
          }}
        >
          {aiChatElement}
        </div>,
        document.body,
        'ai-chat-docked-window'
      )
    : null;

  const shouldShowHome = useMemo(() => {
    if (isWorkspaceDest) return !showDataPreview && !showRawViewer && !showMachineLearning;
    if (isExploreDest) return charts.length === 0 && !showDataPreview;
    if (isDashboardDest) return dashboardItems.length === 0;
    if (isAiDest) {
      const hasAiWorkflowWindows = outputWindows.length > 0;
      return !showAiWorkflow && !showAIChart && !showStoryPanel && !showWhiteBoard && !hasAiWorkflowWindows && !showAiChat;
    }
    return true;
  }, [
    isWorkspaceDest,
    isExploreDest,
    isDashboardDest,
    isAiDest,
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
    showDecisionGraph,
    showAiChat,
  ]);

  return (
    <div className="canvas-dnd-wrapper" style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {isDashboardDest && <DashboardCommandBar />}
      <div
        ref={containerRef}
        className="canvas-container desktop-surface"
        style={{ width: '100%', flex: 1, position: 'relative' }}
      >
        {isDashboardDest && <DashboardSlicerPanel />}
        {shouldShowHome && (
          <DestinationHome
            activeDestination={activeDestination}
            onAction={handleDestinationHomeAction}
            readiness={decisionReadiness}
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
        {isExploreDest && chartElements}
        {isDashboardDest && dashboardElements}
        {isAiDest && decisionGraphElement}
      </div>
      {aiChatPortal}
      <MinimizedDock />
    </div>
  );
}

export default CanvasContainer;
