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
 * Features: Managed Layout Engine (Cooperative Resizing)
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
  
  // Managed Layout Mode Toggle
  const [isManagedMode, setIsManagedMode] = useState(true);

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

  /**
   * handleLayoutResize
   * Cooperatively resizes neighbor windows when the active window changes size.
   */
  const handleLayoutResize = useCallback((activeId, dx, dy, dir) => {
    if (!isManagedMode) return { dx, dy };

    const activeEntry = windowRegistry.current.get(activeId);
    if (!activeEntry) return { dx, dy };

    const current = activeEntry.stateRef.current; // Current state BEFORE this frame's delta
    const threshold = 15; // Snapping distance
    const minSize = 200;

    let allowedDx = dx;
    let allowedDy = dy;

    // Helper: Apply updates to a neighbor directly
    const updateNeighbor = (id, updates) => {
        const entry = windowRegistry.current.get(id);
        if (!entry) return;
        
        // Update state ref
        const newState = { ...entry.stateRef.current, ...updates };
        entry.stateRef.current = newState;
        
        // Update DOM
        entry.node.style.transform = `translate(${newState.x}px, ${newState.y}px)`;
        entry.node.style.width = `${newState.w}px`;
        entry.node.style.height = `${newState.h}px`;
        
        // Notify persistence (debounced in real app, but direct for now)
        saveWindowState(id, { ...newState, isPixel: true });
    };

    // Iterate all windows to find neighbors
    windowRegistry.current.forEach((entry, neighborId) => {
        if (neighborId === activeId) return;
        const nState = entry.stateRef.current;

        // --- Horizontal Resize (East Edge of Active) ---
        if (dir.includes('e')) {
            // Check if Neighbor is to the Right of Active
            // Condition: Neighbor Left Edge approx equals Active Right Edge
            const activeRight = current.x + current.w;
            if (Math.abs(nState.x - activeRight) < threshold) {
                // Check Vertical Overlap
                const vOverlap = Math.min(current.y + current.h, nState.y + nState.h) - Math.max(current.y, nState.y);
                if (vOverlap > 0) {
                    // Pull/Push Neighbor Left Edge
                    // If we grow Right (dx > 0), Neighbor shrinks from Left (x += dx, w -= dx)
                    // If we shrink Left (dx < 0), Neighbor grows to Left (x += dx, w -= dx) -- wait, no.
                    // If Active grows (+dx), Neighbor starts later (x + dx), width smaller (w - dx).
                    
                    const maxShrink = nState.w - minSize;
                    const validDx = Math.min(dx, maxShrink);
                    
                    // If dx is negative (Active shrinking), Neighbor can grow indefinitely (up to Active's min width constraint handled by Active hook)
                    // But we simply apply the delta.
                    
                    // Constrain the 'allowedDx' based on neighbor's ability to shrink
                    if (dx > 0 && dx > maxShrink) {
                        allowedDx = Math.min(allowedDx, maxShrink);
                    }

                    // Apply to Neighbor
                    if (allowedDx !== 0) {
                        updateNeighbor(neighborId, {
                            x: nState.x + allowedDx,
                            w: nState.w - allowedDx
                        });
                    }
                }
            }
        }

        // --- Vertical Resize (South Edge of Active) ---
        if (dir.includes('s')) {
            const activeBottom = current.y + current.h;
            if (Math.abs(nState.y - activeBottom) < threshold) {
                // Check Horizontal Overlap
                const hOverlap = Math.min(current.x + current.w, nState.x + nState.w) - Math.max(current.x, nState.x);
                if (hOverlap > 0) {
                    // Push Neighbor Top Edge
                    const maxShrink = nState.h - minSize;
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
        }
        
        // Similar logic for West/North if needed, but usually E/S are primary resizing directions in 2-pane setups.
        // For full tiling, would implement all 4 directions.
    });

    return { dx: allowedDx, dy: allowedDy };
  }, [isManagedMode, saveWindowState]);


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
    const saved = getWindowState(id);
    if (saved && saved.isPixel) return saved;

    // Use existing conversion if saved logic exists
    const W = containerBounds.width || 1920; 
    if (saved && !saved.isPixel) {
        return {
            x: (saved.x / 10) * W,
            y: saved.y * 30,
            w: (saved.w / 10) * W,
            h: saved.h * 30,
            isPixel: true
        };
    }

    if (!isManagedMode) {
        // Fallback Cascade
        const count = focusStack.length;
        return {
            x: (count % 10) * 30 + 20,
            y: (count % 10) * 30 + 20,
            w: defaultPixelW || 600,
            h: defaultPixelH || 400,
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
            const area = entry.stateRef.current.w * entry.stateRef.current.h;
            if (area > maxArea) {
                maxArea = area;
                largestWinId = winId;
            }
        }
    });

    if (largestWinId) {
        // Split this window
        const targetEntry = windowRegistry.current.get(largestWinId);
        const targetState = targetEntry.stateRef.current;
        
        // Decide split direction (Horizontal if wide, Vertical if tall)
        if (targetState.w > targetState.h * 1.2) {
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
        } else {
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
    return {
        x: W / 4,
        y: 100,
        w: W / 2,
        h: W / 3,
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
    .map((chart) => (
      <WindowFrame
        {...getWindowProps(chart.id, `📊 ${chart.type} Chart`, () => removeChart(chart.id), () => minimizeWindow(chart.id, `${chart.type} Chart`))}
        initialState={getInitialState(chart.id, 6, 18)}
      >
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <SmartChartWindow
              id={chart.id}
              data={cleanedData || uploadedData}
              type={chart.type}
              mapping={chart.mapping}
              isLocked={isLocked(chart.id)}
            />
        </div>
      </WindowFrame>
    ));

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