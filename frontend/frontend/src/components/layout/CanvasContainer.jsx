// File: CanvasContainer.jsx
import React, { useState, useRef, useMemo, useContext, useEffect, useCallback } from 'react';
import './CanvasContainer.css';
import WindowFrame from './WindowFrame';
import MinimizedDock from './MinimizedDock';
import RolesPanel from '../../features/charts/RolesPanel';
import ChartComponent from '../../features/charts/ChartComponent';
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

/**
 * Modern Desktop-Grade Canvas Container
 * Uses Pointer Events + RAF for 60fps window management.
 * Cooperative resizing is the default layout behavior (no user-facing toggle).
 */
function CanvasContainer({
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
}) {
  const {
    minimizedWindows, minimizeWindow,
    saveWindowState, getWindowState,
    toggleLock, isLocked, getWindowContentState,
    charts, removeChart
  } = useWindowContext();

  const containerRef = useRef(null);
  // Default bounds to standard desktop size to prevent 0-size issues on initial render
  const [containerBounds, setContainerBounds] = useState({ width: 1920, height: 1080 });
  const [focusStack, setFocusStack] = useState([]); // Array of IDs, last is on top
  
  // Managed layout is the default behavior (no user-facing toggle).

  // Registry for direct DOM access (High Performance)
  // Map<id, { node: HTMLElement, stateRef: MutableRefObject }>
  const windowRegistry = useRef(new Map());

  // Monitor container size - Non-blocking
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Initial measurement
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
        setContainerBounds({ width: rect.width, height: rect.height });
    }

    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
            setContainerBounds({
                width: entry.contentRect.width,
                height: entry.contentRect.height
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
      } catch (e) {
        console.error('Failed to parse dataset data_preview', e);
      }
    }
    return [];
  }, [dataset]);

  let outputWindows = getWorkflowWindows(pipelineResults || {});
  if (!showAiReport) {
    outputWindows = outputWindows.filter((w) => w.type !== 'report');
  }

  // --- Layout Arbiter Logic (The "Smart" Layer) ---

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

  /**
   * handleLayoutResize
   * Cooperatively resizes neighbor windows when the active window changes size.
   */
  const handleLayoutResize = useCallback((activeId, dx, dy, dir) => {
    const activeEntry = windowRegistry.current.get(activeId);
    if (!activeEntry) return { dx, dy };

    const current = activeEntry.stateRef.current; // State BEFORE this frame's delta
    const SNAP_DISTANCE = 15;
    const MIN_NEIGHBOR_WIDTH = 300;
    const MIN_NEIGHBOR_HEIGHT = 200;

    let allowedDx = dx;
    let allowedDy = dy;

    const edgesTouch = (edgeA, edgeB) => Math.abs(edgeA - edgeB) < SNAP_DISTANCE;

    // Apply updates to a neighbor directly (registry avoids React rerenders).
    const updateNeighbor = (id, updates) => {
      const entry = windowRegistry.current.get(id);
      if (!entry) return;

      const newState = { ...entry.stateRef.current, ...updates };
      entry.stateRef.current = newState;

      entry.node.style.transform = `translate(${newState.x}px, ${newState.y}px)`;
      entry.node.style.width = `${newState.w}px`;
      entry.node.style.height = `${newState.h}px`;

      // Persist immediately (debounced upstream if needed).
      saveWindowState(id, { ...newState, isPixel: true });
    };

    // Only adjust neighbors that are touching the active edge and overlapping in the other axis.
    windowRegistry.current.forEach((entry, neighborId) => {
      if (neighborId === activeId) return;
      const nState = entry.stateRef.current;

      const activeLeft = current.x;
      const activeRight = current.x + current.w;
      const activeTop = current.y;
      const activeBottom = current.y + current.h;
      const neighborRight = nState.x + nState.w;
      const neighborBottom = nState.y + nState.h;

      if (dir.includes('e') && edgesTouch(activeRight, nState.x)) {
        if (rangesOverlap(current.y, current.y + current.h, nState.y, neighborBottom)) {
          const maxShrink = nState.w - MIN_NEIGHBOR_WIDTH;
          if (dx > 0 && dx > maxShrink) {
            allowedDx = Math.min(allowedDx, maxShrink);
          }

          if (allowedDx !== 0) {
            updateNeighbor(neighborId, {
              x: nState.x + allowedDx,
              w: nState.w - allowedDx
            });
          }
        }
      }

      if (dir.includes('w') && edgesTouch(activeLeft, neighborRight)) {
        if (rangesOverlap(current.y, current.y + current.h, nState.y, neighborBottom)) {
          const maxShrink = nState.w - MIN_NEIGHBOR_WIDTH;
          if (dx < 0 && Math.abs(dx) > maxShrink) {
            allowedDx = Math.max(allowedDx, -maxShrink);
          }

          if (allowedDx !== 0) {
            updateNeighbor(neighborId, {
              w: nState.w + allowedDx
            });
          }
        }
      }

      if (dir.includes('s') && edgesTouch(activeBottom, nState.y)) {
        if (rangesOverlap(current.x, current.x + current.w, nState.x, neighborRight)) {
          const maxShrink = nState.h - MIN_NEIGHBOR_HEIGHT;
          if (dy > 0 && dy > maxShrink) {
            allowedDy = Math.min(allowedDy, maxShrink);
          }

          if (allowedDy !== 0) {
            updateNeighbor(neighborId, {
              y: nState.y + allowedDy,
              h: nState.h - allowedDy
            });
          }
        }
      }

      if (dir.includes('n') && edgesTouch(activeTop, neighborBottom)) {
        if (rangesOverlap(current.x, current.x + current.w, nState.x, neighborRight)) {
          const maxShrink = nState.h - MIN_NEIGHBOR_HEIGHT;
          if (dy < 0 && Math.abs(dy) > maxShrink) {
            allowedDy = Math.max(allowedDy, -maxShrink);
          }

          if (allowedDy !== 0) {
            updateNeighbor(neighborId, {
              h: nState.h + allowedDy
            });
          }
        }
      }
    });

    return { dx: allowedDx, dy: allowedDy };
  }, [rangesOverlap, saveWindowState]);

  /**
   * handleLayoutDrag
   * Snaps dragged windows to nearby edges (container or neighbor) to keep layouts aligned.
   */
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
      const nState = entry.stateRef.current;
      const neighborRight = nState.x + nState.w;
      const neighborBottom = nState.y + nState.h;

      const verticalOverlap = rangesOverlap(nextY, nextY + h, nState.y, neighborBottom);
      const horizontalOverlap = rangesOverlap(nextX, nextX + w, nState.x, neighborRight);

      if (verticalOverlap) {
        const snapRightDelta = Math.abs(nextX + w - nState.x);
        if (snapRightDelta < bestXDelta) {
          snappedX = nState.x - w;
          bestXDelta = snapRightDelta;
        }
        const snapLeftDelta = Math.abs(nextX - neighborRight);
        if (snapLeftDelta < bestXDelta) {
          snappedX = neighborRight;
          bestXDelta = snapLeftDelta;
        }
      }

      if (horizontalOverlap) {
        const snapBottomDelta = Math.abs(nextY + h - nState.y);
        if (snapBottomDelta < bestYDelta) {
          snappedY = nState.y - h;
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


  // --- Window Management Logic ---

  const handleFocus = useCallback((id) => {
    setFocusStack((prev) => {
      const filtered = prev.filter(wid => wid !== id);
      return [...filtered, id];
    });
  }, []);

  const getZIndex = (id) => {
    const idx = focusStack.indexOf(id);
    return idx === -1 ? 1 : 10 + idx; 
  };

  /**
   * getInitialState (Smart Placement)
   * Finds the largest visible window and splits it to place the new one.
   */
  const getInitialState = (id, defaultGridW = 6, defaultGridH = 10, defaultPixelW, defaultPixelH) => {
    // Keep aligned with useWindowInteraction min sizes to avoid tiny windows.
    const MIN_WINDOW_WIDTH = 300;
    const MIN_WINDOW_HEIGHT = 200;
    const saved = getWindowState(id);
    if (saved && saved.isPixel) {
        return {
            ...saved,
            w: Math.max(saved.w, MIN_WINDOW_WIDTH),
            h: Math.max(saved.h, MIN_WINDOW_HEIGHT)
        };
    }

    // Use existing conversion if saved logic exists
    const W = containerBounds.width || 1920; 
    const H = containerBounds.height || 1080;
    if (saved && !saved.isPixel) {
        return {
            x: (saved.x / 10) * W,
            y: saved.y * 30,
            w: Math.max((saved.w / 10) * W, MIN_WINDOW_WIDTH),
            h: Math.max(saved.h * 30, MIN_WINDOW_HEIGHT),
            isPixel: true
        };
    }

    // --- Smart Placement Strategy ---
    // 1. Find the window with the largest Area currently on screen.
    let largestWinId = null;
    let maxArea = 0;

    windowRegistry.current.forEach((entry, winId) => {
        // Skip minimized or closed
        if (!minimizedWindows[winId]) {
            const { w, h } = entry.stateRef.current;
            const canSplitHorizontally = w >= MIN_WINDOW_WIDTH * 2;
            const canSplitVertically = h >= MIN_WINDOW_HEIGHT * 2;
            if (canSplitHorizontally || canSplitVertically) {
                const area = w * h;
                if (area > maxArea) {
                    maxArea = area;
                    largestWinId = winId;
                }
            }
        }
    });

    if (largestWinId) {
        // Split this window
        const targetEntry = windowRegistry.current.get(largestWinId);
        const targetState = targetEntry.stateRef.current;
        
        // Decide split direction (Horizontal if wide, Vertical if tall)
        const canSplitHorizontally = targetState.w >= MIN_WINDOW_WIDTH * 2;
        const canSplitVertically = targetState.h >= MIN_WINDOW_HEIGHT * 2;
        const shouldSplitHorizontally = targetState.w > targetState.h * 1.2;

        if (shouldSplitHorizontally && canSplitHorizontally) {
            // Split Horizontally (Left / Right)
            const newW = targetState.w / 2;
            
            // Update Existing Window (Left Half)
            // We must update the DOM directly + State Ref + Persistence
            const updatedExisting = { ...targetState, w: newW };
            targetEntry.stateRef.current = updatedExisting;
            targetEntry.node.style.width = `${newW}px`;
            saveWindowState(largestWinId, { ...updatedExisting, isPixel: true });

            // Return New Window (Right Half)
            return {
                x: targetState.x + newW,
                y: targetState.y,
                w: newW,
                h: targetState.h,
                isPixel: true
            };
        } else if (canSplitVertically) {
            // Split Vertically (Top / Bottom)
            const newH = targetState.h / 2;

            // Update Existing Window (Top Half)
            const updatedExisting = { ...targetState, h: newH };
            targetEntry.stateRef.current = updatedExisting;
            targetEntry.node.style.height = `${newH}px`;
            saveWindowState(largestWinId, { ...updatedExisting, isPixel: true });

            // Return New Window (Bottom Half)
            return {
                x: targetState.x,
                y: targetState.y + newH,
                w: targetState.w,
                h: newH,
                isPixel: true
            };
        }
    }

    // If no windows to split, center it
    const fallbackWidth = Math.max(defaultPixelW || Math.min(W * 0.65, 960), MIN_WINDOW_WIDTH);
    const fallbackHeight = Math.max(defaultPixelH || Math.min(H * 0.6, 720), MIN_WINDOW_HEIGHT);
    return {
        x: Math.max((W - fallbackWidth) / 2, 20),
        y: Math.max((H - fallbackHeight) / 2, 80),
        w: fallbackWidth,
        h: fallbackHeight,
        isPixel: true
    };
  };

  const handleSave = useCallback((id, pixelState) => {
      saveWindowState(id, { ...pixelState, isPixel: true });
  }, [saveWindowState]);

  // --- Render Helpers ---

  // Common props for all windows
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
    onResize: handleLayoutResize, // Hook into the layout engine
    onDrag: handleLayoutDrag,
    registerWindow, // Connect to registry
  });


  // --- Window Generators ---

  // 1. Workflow Windows
  const workflowElements = outputWindows
    .filter((win) => !minimizedWindows[`workflow-${win.id}`])
    .map((win) => {
      const id = `workflow-${win.id}`;
      // Defaults: W=8/10 grid (~80%), H=6 grid (~180px)
      const initialState = getInitialState(id, 8, 15); 
      
      return (
        <WindowFrame
          {...getWindowProps(id, win.label, 
            // Close Handler
            () => {
               if (win.type === 'report') {
                    setPipelineResults({});
                    if (onCloseAiReport) onCloseAiReport();
                  } else {
                    setPipelineResults((prev) => {
                      const copy = { ...prev };
                      delete copy[win.id];
                      return copy;
                    });
                  }
            },
            // Minimize Handler
            () => minimizeWindow(id, win.label),
            // Maximize Handler
            (wid) => { /* Maximize logic if needed */ }
          )}
          initialState={initialState}
        >
            {win.type === 'text' && <pre style={{padding: '10px'}}>{win.content}</pre>}
            {win.type === 'chart' && <AICharts aiChartType={win.chartType} aiChartData={win.chartData} />}
            {win.type === 'report' && (
              <AIReporter
                summary={win.content.summary}
                outliers={win.content.outliers}
                insights={win.content.insights}
                execution={win.content.execution}
                chartType={win.content.chartType}
                chartData={win.content.chartData}
              />
            )}
        </WindowFrame>
      );
    });

  // 2. Data Preview
  const dataPreviewElement = (dataset && previewData.length > 0 && showDataPreview && !minimizedWindows['dataPreview']) ? (
      <WindowFrame
        {...getWindowProps('dataPreview', '📄 Data Preview', handleClosePreview, () => minimizeWindow('dataPreview', 'Data Preview'))}
        initialState={getInitialState('dataPreview', 8, 20)}
      >
        <div className="uploaded-data-preview">
            <div style={{padding: '0 10px 10px 10px'}}>
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

  // 3. Raw Data Viewer
  const rawDataElement = (showRawViewer && !minimizedWindows['rawViewer']) ? (
      <WindowFrame
        {...getWindowProps('rawViewer', '📜 Raw Data (All Rows)', handleCloseRawViewer, () => minimizeWindow('rawViewer', 'Raw Data'))}
        initialState={getInitialState('rawViewer', 8, 20)}
      >
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
             <RawDataViewer rows={fullData || []} pageSize={500} />
          </div>
      </WindowFrame>
  ) : null;

  // 4. AI Chart
  const aiChartElement = (showAIChart && !minimizedWindows['aiChartWindow']) ? (
      <WindowFrame
        {...getWindowProps('aiChartWindow', '📊 AI-Generated Chart', () => setShowAIChart(false), () => minimizeWindow('aiChartWindow', 'AI Chart'))}
        initialState={getInitialState('aiChartWindow', 8, 15)}
      >
        <div style={{ height: '100%', padding: '10px' }}>
             <AICharts aiChartType={aiChartType} aiChartData={aiChartData} />
        </div>
      </WindowFrame>
  ) : null;

  // 5. Workflow Lab
  const workflowLabElement = (showAiWorkflow && !minimizedWindows['aiWorkflowLab']) ? (
      <WindowFrame
        {...getWindowProps('aiWorkflowLab', 'AI Workflow Lab', () => setShowAiWorkflow(false), () => minimizeWindow('aiWorkflowLab', 'AI Workflow'))}
        initialState={getInitialState('aiWorkflowLab', 9, 25)}
      >
        <div className="workflow-content">
             <AiWorkflowLab savedState={getWindowContentState('aiWorkflowLab')} />
        </div>
      </WindowFrame>
  ) : null;

  // 6. Whiteboard
  const whiteBoardElement = (showWhiteBoard && !minimizedWindows['whiteBoard']) ? (
      <WindowFrame
        {...getWindowProps('whiteBoard', '📊 White Board', () => setShowWhiteBoard(false), () => minimizeWindow('whiteBoard', 'White Board'))}
        initialState={getInitialState('whiteBoard', 9, 25)}
      >
        <div style={{ height: '100%' }}>
            <Whiteboard savedScene={getWindowContentState('whiteBoard')} />
        </div>
      </WindowFrame>
  ) : null;

  // 7. Dynamic Charts
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

  // 8. Story Panel
  const storyPanelElement = (showStoryPanel && !minimizedWindows['storyPanel']) ? (
      <WindowFrame
        {...getWindowProps('storyPanel', '📖 Data Story', () => setShowStoryPanel(false), () => minimizeWindow('storyPanel', 'Story'))}
        initialState={getInitialState('storyPanel', 9, 25)}
      >
         <DataStoryPanel uploadedData={uploadedData} cleanedData={cleanedData} model={storyModel} />
      </WindowFrame>
  ) : null;

  // 9. Machine Learning
  const machineLearningElement = (showMachineLearning && !minimizedWindows['machineLearning']) ? (
      <WindowFrame
         {...getWindowProps('machineLearning', '🧠 Machine Learning', () => setShowMachineLearning(false), () => minimizeWindow('machineLearning', 'ML'))}
         initialState={getInitialState('machineLearning', 8, 20)}
      >
         <MachineLearningPanel />
      </WindowFrame>
  ) : null;


  return (
    <div className="canvas-dnd-wrapper" style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      
      <div 
        ref={containerRef} 
        className="canvas-container desktop-surface"
        style={{ width: '100%', height: '100%', position: 'relative' }}
      >
          {workflowElements}
          {dataPreviewElement}
          {rawDataElement}
          {aiChartElement}
          {workflowLabElement}
          {whiteBoardElement}
          {chartElements}
          {storyPanelElement}
          {machineLearningElement}
      </div>
      <MinimizedDock />
    </div>
  );
}

export default CanvasContainer;



