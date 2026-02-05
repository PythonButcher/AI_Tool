// File: CanvasContainer.jsx
import React, { useRef, useMemo, useContext } from 'react';
import './CanvasContainer.css';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import ReactGridLayout from 'react-grid-layout';
import CloseButton from '../buttons/CloseButton';
import MinimizeButton from '../buttons/MinimizeButton';
import MaximizeButton from '../buttons/MaximizeButton';
import MinimizedDock from './MinimizedDock';
import RolesPanel from '../../features/charts/RolesPanel';
import ChartComponent from '../../features/charts/ChartComponent';
import SmartChartWindow from '../../features/charts/SmartChartWindow';
import { FaLock, FaLockOpen } from 'react-icons/fa';
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
import { clampLayoutToGrid } from '../../utils/windowLayout';

const ResponsiveGridLayout = ReactGridLayout.WidthProvider(ReactGridLayout.Responsive);

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
    minimizedWindows,
    minimizeWindow,
    saveWindowState,
    getResolvedLayout,
    toggleLock,
    isLocked,
    getWindowContentState,
    charts,
    removeChart,
    focusWindow,
    getZIndex,
    activeWindowId,
  } = useWindowContext();
  const layoutRef = useRef([]);

  const { fullData } = useContext(DataContext);
  console.log("✅ CanvasContainer fullData length:", fullData?.length || 0); // (optional debug)
  console.log("🧨 FULLDATA RAW VALUE:", fullData);
  console.log("🧨 FULLDATA TYPE:", typeof fullData);
  console.log("🧨 FULLDATA isArray:", Array.isArray(fullData));
  console.log("🧨 FULLDATA LENGTH:", fullData?.length);



  const bringToFront = (id) => {
    focusWindow(id);
  };

  const linkedResize = true;

  const dataset = useActiveDataset();
  const previewData = useMemo(() => {
    if (Array.isArray(dataset)) {
      return dataset.length <= 100 ? dataset : dataset.slice(0, 100);
    }
    if (typeof dataset?.data_preview === 'string') {
      try {
        const arr = JSON.parse(dataset.data_preview);
        return arr.length <= 100 ? arr : arr.slice(0, 100);
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

  // Aggregate layouts for react-grid-layout so lock state reflects without remount.
  const layoutLg = [];
  const registerLayout = (id, layout, group, mode = 'cascade') => {
    const resolved = getResolvedLayout(id, layout, { cols: 10, mode });
    const fullLayout = { i: id, ...resolved };
    if (group) fullLayout.group = group;
    layoutLg.push(fullLayout);
    return fullLayout;
  };

  const applyLinkedResize = (layout, target, axis, save = true) => {
    const key = axis === 'x' ? 'x' : 'y';
    const sizeKey = axis === 'x' ? 'w' : 'h';
    const minKey = axis === 'x' ? 'minW' : 'minH';
    const maxKey = axis === 'x' ? 'maxW' : 'maxH';

    const groupItems = target.group
      ? layout.filter((item) => item.group === target.group)
      : axis === 'x'
        ? layout.filter((item) => item.y === target.y)
        : layout.filter((item) => item.x === target.x);

    if (groupItems.length <= 1) return;

    const sorted = groupItems.slice().sort((a, b) => a[key] - b[key]);
    const total = axis === 'x' ? 10 : sorted.reduce((sum, item) => sum + item[sizeKey], 0);
    const staticTotal = sorted
      .filter((item) => item.i !== target.i && item.static)
      .reduce((sum, item) => sum + item[sizeKey], 0);

    const adjustable = sorted.filter((item) => item.i !== target.i && !item.static);
    if (adjustable.length === 0) return;

    const adjustableTotal = adjustable.reduce((sum, item) => sum + item[sizeKey], 0);
    let remaining = total - target[sizeKey] - staticTotal;
    let nextPos = Math.min(...sorted.map((item) => item[key]));

    sorted.forEach((item) => {
      if (item.i === target.i) {
        item[key] = nextPos;
        nextPos += item[sizeKey];
      } else if (item.static) {
        item[key] = nextPos;
        nextPos += item[sizeKey];
      } else {
        let newSize = adjustableTotal
          ? Math.round(remaining * (item[sizeKey] / adjustableTotal))
          : Math.floor(remaining / adjustable.length);

        newSize = Math.max(newSize, item[minKey] || 1);
        if (item[maxKey]) newSize = Math.min(newSize, item[maxKey]);

        if (item === adjustable[adjustable.length - 1]) {
          newSize = remaining;
        }
        item[key] = nextPos;
        item[sizeKey] = newSize;
        nextPos += newSize;
        remaining -= newSize;
      }
      if (save) saveWindowState(item.i, item);
    });
  };

  const handleResize = (layout, oldItem, newItem) => {
    if (linkedResize) {
      if (newItem.w !== oldItem.w) applyLinkedResize(layout, newItem, 'x', false);
      if (newItem.h !== oldItem.h) applyLinkedResize(layout, newItem, 'y', false);
    }
    layoutRef.current = layout;
  };

  const handleResizeStop = (layout, oldItem, newItem) => {
    const snapThreshold = 1;
    if (10 - newItem.w <= snapThreshold) {
      newItem.w = 10;
    }
    if (linkedResize) {
      if (newItem.w !== oldItem.w) applyLinkedResize(layout, newItem, 'x');
      if (newItem.h !== oldItem.h) applyLinkedResize(layout, newItem, 'y');
    } else {
      saveWindowState(newItem.i, newItem);
    }
    const constrained = clampLayoutToGrid(newItem, 10);
    newItem.x = constrained.x;
    newItem.y = constrained.y;
    newItem.w = constrained.w;
    newItem.h = constrained.h;
    layoutRef.current = layout;
  };

  const snapToFit = (id) => {
    const layout = layoutRef.current.slice();
    const item = layout.find((l) => l.i === id);
    if (!item) return;
    item.x = 0;
    item.w = 10;
    applyLinkedResize(layout, item, 'x');
    applyLinkedResize(layout, item, 'y');
    layoutRef.current = layout;
  };

  const workflowElements = outputWindows
    .filter((win) => !minimizedWindows[`workflow-${win.id}`])
    .map((win, idx) => {
      const defaultLayout =
        win.type === 'report'
          ? { x: 0, y: 0, w: 10, h: 30, minW: 7, minH: 15 }
          : { x: 1, y: 40 + idx * 4, w: 8, h: 6, minW: 3, minH: 3 };

      const layout = registerLayout(
        `workflow-${win.id}`,
        { ...defaultLayout, static: isLocked(`workflow-${win.id}`) },
        'workflow',
        win.type === 'report' ? 'grid' : 'cascade'
      );

      return (
        <div
          key={`workflow-output-${win.id}`}
          className={`grid-item ${activeWindowId === `workflow-${win.id}` ? 'is-active' : 'is-inactive'}`}
          data-grid={layout}
          onMouseDown={() => bringToFront(`workflow-${win.id}`)}
          style={{ zIndex: getZIndex(`workflow-${win.id}`) }}
        >
          <div className="window-header drag-handle" onDoubleClick={() => snapToFit(`workflow-${win.id}`)}>
            <span className="header-title">{win.label}</span>
            <div className="header-button-group">
              <MinimizeButton onClick={() => minimizeWindow(`workflow-${win.id}`, win.label)} />
              <MaximizeButton windowId={`workflow-${win.id}`} />
              <CloseButton
                onClick={() => {
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
                }}
              />
            </div>
          </div>
          <div className="window-content" style={{ padding: '10px', overflow: 'auto' }}>
            {win.type === 'text' && <pre>{win.content}</pre>}
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
          </div>
        </div>
      );
    });

  const dataPreviewElement =
    dataset && previewData.length > 0 && showDataPreview && !minimizedWindows['dataPreview']
      ? (() => {
        const layout = registerLayout(
          'dataPreview',
          { x: 0, y: 0, w: 10, h: 15, minW: 3, minH: 2, resizeHandles: ['se', 'e', 's'], static: isLocked('dataPreview') },
          'preview',
          'grid'
        );

        return (
          <div
            key="dataPreview"
            className={`grid-item ${activeWindowId === 'dataPreview' ? 'is-active' : 'is-inactive'}`}
            data-grid={layout}
            onMouseDown={() => bringToFront('dataPreview')}
            style={{
              backgroundColor: '#f4f4f4',
              border: '2px solid #ccc',
              borderRadius: '6px',
              overflow: 'hidden',
              zIndex: getZIndex('dataPreview'),
            }}
          >
            <div className="window-header drag-handle" onDoubleClick={() => snapToFit('dataPreview')}>
              <span className="header-title">📄 Data Preview</span>
              <div className="header-button-group">
                <AiAutopilot setShowAiWorkflow={setShowAiWorkflow} />
                <MinimizeButton onClick={() => minimizeWindow('dataPreview', 'Data Preview')} />
                <MaximizeButton windowId="dataPreview" />
                <CloseButton onClick={handleClosePreview} />
              </div>
            </div>
            <div className="uploaded-data-preview">
              <PreviewModeSelector previewMode={previewMode} setPreviewMode={setPreviewMode} />
              {previewMode === 'table' && <DataTablePreview data={previewData} />}
              {previewMode === 'json' && (
                <div
                  style={{
                    backgroundColor: '#F8F8F2',
                    borderRadius: '12px',
                    padding: '16px',
                    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.2)',
                    fontFamily: '"Press Start 2P", cursive',
                    color: '#282828',
                    border: '3px solid #E60012',
                    maxHeight: '400px',
                    overflowY: 'auto',
                  }}
                >
                  <JsonViewer
                    data={previewData}
                    expandLevel={2}
                    onCopy={(copyData) => console.log('Copied data:', copyData)}
                    style={{ fontSize: '14px', color: '#383838' }}
                  />
                </div>
              )}
            </div>
            <div className="uploaded-data-preview">{children}</div>
          </div>
        );
      })()
      : null;

  const rawDataElement =
    showRawViewer && !minimizedWindows['rawViewer']
      ? (() => {
        const layout = registerLayout(
          'rawViewer',
          {
            x: 0,
            y: 16,
            w: 10,
            h: 16,
            minW: 3,
            minH: 6,
            resizeHandles: ['se', 'e', 's'],
            static: isLocked('rawViewer'),
          },
          'preview',
          'grid'
        );

        return (
          <div
            key="rawViewer"
            className={`grid-item ${activeWindowId === 'rawViewer' ? 'is-active' : 'is-inactive'}`}
            data-grid={layout}
            onMouseDown={() => bringToFront('rawViewer')}
            style={{
              backgroundColor: '#fff',
              border: '2px solid #ccc',
              borderRadius: '6px',
              overflow: 'hidden',
              zIndex: getZIndex('rawViewer'),
            }}
          >
            <div
              className="window-header drag-handle"
              onDoubleClick={() => snapToFit('rawViewer')}
            >
              <span className="header-title">📜 Raw Data (All Rows)</span>
              <div className="header-button-group">
                <AiAutopilot setShowAiWorkflow={setShowAiWorkflow} />
                <MinimizeButton
                  onClick={() => minimizeWindow('rawViewer', 'Raw Data')}
                />
                <MaximizeButton windowId="rawViewer" />
                <CloseButton onClick={handleCloseRawViewer} />
              </div>
            </div>

            <div
              className="window-content"
              style={{
                padding: '10px',
                height: 'calc(100% - 40px)',
                overflow: 'auto',
              }}
            >
              {/* Prefer a paginated viewer to avoid freezing on large datasets */}
              {/* If you created RawDataViewer, use it: */}
              <RawDataViewer
                rows={fullData || []}
                pageSize={500}
              />

            </div>
          </div>
        );
      })()
      : null;


  const aiChartElement =
    showAIChart && !minimizedWindows['aiChartWindow']
      ? (() => {
        const layout = registerLayout(
          'aiChartWindow',
          { x: 0, y: 0, w: 10, h: 15, minW: 3, minH: 5, resizeHandles: ['se', 'e', 's'], static: isLocked('aiChartWindow') },
          'preview',
          'cascade'
        );

        return (
          <div
            key="aiChartWindow"
            className={`grid-item ${activeWindowId === 'aiChartWindow' ? 'is-active' : 'is-inactive'}`}
            data-grid={layout}
            onMouseDown={() => bringToFront('aiChartWindow')}
            style={{ zIndex: getZIndex('aiChartWindow') }}
          >
            <div className="window-header drag-handle" onDoubleClick={() => snapToFit('aiChartWindow')}>
              <span className="header-title">📊 AI-Generated Chart</span>
              <div className="header-button-group">
                <MinimizeButton onClick={() => minimizeWindow('aiChartWindow', 'AI Chart')} />
                <MaximizeButton windowId="aiChartWindow" />
                <CloseButton onClick={() => setShowAIChart(false)} />
              </div>
            </div>
            <div className="window-content" style={{ padding: '10px', height: 'calc(100% - 40px)', overflow: 'auto' }}>
              <AICharts aiChartType={aiChartType} aiChartData={aiChartData} />
            </div>
          </div>
        );
      })()
      : null;

  const workflowLabElement =
    showAiWorkflow && !minimizedWindows['aiWorkflowLab']
      ? (() => {
        const contentState = getWindowContentState('aiWorkflowLab');
        const finalLayout = registerLayout(
          'aiWorkflowLab',
          { x: 0, y: 0, w: 10, h: 27.5, minW: 2, minH: 2, resizeHandles: ['se', 'e', 's'], static: isLocked('aiWorkflowLab') },
          'lab',
          'grid'
        );

        return (
          <div
            key="aiWorkflowLab"
            className={`grid-item ${activeWindowId === 'aiWorkflowLab' ? 'is-active' : 'is-inactive'}`}
            data-grid={finalLayout}
            onMouseDown={() => bringToFront('aiWorkflowLab')}
            style={{ backgroundColor: '#f4f4f4', border: '2px solid #ccc', borderRadius: '6px', overflow: 'hidden', zIndex: getZIndex('aiWorkflowLab') }}
          >
            <div className="window-header drag-handle" onDoubleClick={() => snapToFit('aiWorkflowLab')}>
              <span className="header-title">AI Workflow Lab</span>
              <div className="header-button-group">
                <button
                  className="header-button"
                  onClick={() => toggleLock('aiWorkflowLab')}
                  title={isLocked('aiWorkflowLab') ? 'Unlock Window' : 'Lock Window'}
                >
                  {isLocked('aiWorkflowLab') ? <FaLock /> : <FaLockOpen />}
                </button>
                <MinimizeButton onClick={() => minimizeWindow('aiWorkflowLab', 'AI Workflow')} />
                <MaximizeButton windowId="aiWorkflowLab" />
                <CloseButton onClick={() => setShowAiWorkflow(false)} />
              </div>
            </div>
            <div className="uploaded-data-preview workflow-content">
              <AiWorkflowLab savedState={contentState} />
            </div>
          </div>
        );
      })()
      : null;

  const whiteBoardElement =
    showWhiteBoard && !minimizedWindows['whiteBoard']
      ? (() => {
        const contentState = getWindowContentState('whiteBoard');
        const finalLayout = registerLayout(
          'whiteBoard',
          { x: 0, y: 0, w: 10, h: 27.5, minW: 2, minH: 2, resizeHandles: ['se', 'e', 's'], static: isLocked('whiteBoard') },
          'lab',
          'grid'
        );

        return (
          <div
            key="whiteBoard"
            className={`grid-item ${activeWindowId === 'whiteBoard' ? 'is-active' : 'is-inactive'}`}
            data-grid={finalLayout}
            onMouseDown={() => bringToFront('whiteBoard')}
            style={{ zIndex: getZIndex('whiteBoard') }}
          >
            <div className="window-header drag-handle" onDoubleClick={() => snapToFit('whiteBoard')}>
              <span className="header-title">📊 White Board</span>
              <div className="header-button-group">
                <button
                  className="header-button"
                  onClick={() => toggleLock('whiteBoard')}
                  title={isLocked('whiteBoard') ? 'Unlock Window' : 'Lock Window'}
                >
                  {isLocked('whiteBoard') ? <FaLock /> : <FaLockOpen />}
                </button>
                <MinimizeButton onClick={() => minimizeWindow('whiteBoard', 'White Board')} />
                <MaximizeButton windowId="whiteBoard" />
                <CloseButton onClick={() => setShowWhiteBoard(false)} />
              </div>
            </div>
            <div className="window-content" style={{ padding: '10px', height: 'calc(100% - 40px)', overflow: 'auto' }}>
              <Whiteboard savedScene={contentState} />
            </div>
          </div>
        );
      })()
      : null;

  /* DYNAMIC CHART WINDOWS */
  const chartElements = charts
    .filter((chart) => !minimizedWindows[chart.id])
    .map((chart) => {
      const layout = registerLayout(
        chart.id,
        {
          x: 0,
          y: 0,
          w: 8,
          h: 18,
          minW: 4,
          minH: 8,
          resizeHandles: ['se', 'e', 's'],
          static: isLocked(chart.id)
        },
        'charts',
        'cascade'
      );

      return (
        <div
          key={chart.id}
          className={`grid-item ${activeWindowId === chart.id ? 'is-active' : 'is-inactive'}`}
          data-grid={layout}
          onMouseDown={() => bringToFront(chart.id)}
          style={{
            zIndex: getZIndex(chart.id),
            border: '1px solid #ddd',
            borderRadius: '8px',
            overflow: 'hidden',
            backgroundColor: '#fff',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
          }}
        >
          <div className="window-header drag-handle" onDoubleClick={() => snapToFit(chart.id)}>
            <span className="header-title">📊 {chart.type} Chart</span>
            <div className="header-button-group">
              <button
                className="header-button"
                onClick={() => toggleLock(chart.id)}
                title={isLocked(chart.id) ? 'Unlock Window' : 'Lock Window'}
              >
                {isLocked(chart.id) ? <FaLock /> : <FaLockOpen />}
              </button>
              <MinimizeButton onClick={() => minimizeWindow(chart.id, `${chart.type} Chart`)} />
              <MaximizeButton windowId={chart.id} />
              <CloseButton onClick={() => removeChart(chart.id)} />
            </div>
          </div>

          <div style={{ width: '100%', height: 'calc(100% - 32px)', position: 'relative' }}>
            <SmartChartWindow
              id={chart.id}
              data={cleanedData || uploadedData} // Pass active data
              type={chart.type}
              mapping={chart.mapping}
              isLocked={isLocked(chart.id)}
            />
          </div>
        </div>
      );
    });

  // Old static chart element removed in favor of dynamic `chartElements`
  const chartWindowElement = null;

  const storyPanelElement =
    showStoryPanel && !minimizedWindows['storyPanel']
      ? (() => {
        const layout = registerLayout(
          'storyPanel',
          { x: 1, y: 0, w: 9, h: 31, minW: 7, minH: 15, resizeHandles: ['se', 'e', 's'], static: isLocked('storyPanel') },
          'story',
          'grid'
        );

        return (
          <div
            key="storyPanel"
            className={`grid-item ${activeWindowId === 'storyPanel' ? 'is-active' : 'is-inactive'}`}
            data-grid={layout}
            onMouseDown={() => bringToFront('storyPanel')}
            style={{ backgroundColor: '#f4f4f4', border: '2px solid #ccc', borderRadius: '6px', overflow: 'hidden', zIndex: getZIndex('storyPanel') }}
          >
            <div className="window-header drag-handle" onDoubleClick={() => snapToFit('storyPanel')}>
              <span className="header-title">📖 Data Story</span>
              <div className="header-button-group">
                <button
                  className="header-button"
                  onClick={() => toggleLock('storyPanel')}
                  title={isLocked('storyPanel') ? 'Unlock Window' : 'Lock Window'}
                >
                  {isLocked('storyPanel') ? <FaLock /> : <FaLockOpen />}
                </button>
                <MinimizeButton onClick={() => minimizeWindow('storyPanel', 'Story')} />
                <MaximizeButton windowId="storyPanel" />
                <CloseButton onClick={() => setShowStoryPanel(false)} />
              </div>
            </div>
            <div className="window-content" style={{ height: 'calc(100% - 40px)', display: 'flex', flexDirection: 'column' }}>
              <DataStoryPanel uploadedData={uploadedData} cleanedData={cleanedData} model={storyModel} />
            </div>
          </div>
        );
      })()
      : null;

  const machineLearningElement =
    showMachineLearning && !minimizedWindows['machineLearning']
      ? (() => {
        const layout = registerLayout(
          'machineLearning',
          { x: 2, y: 0, w: 8, h: 16, minW: 4, minH: 6, resizeHandles: ['se', 'e', 's'], static: isLocked('machineLearning') },
          'machine-learning',
          'grid'
        );

        return (
          <div
            key="machineLearning"
            className={`grid-item ${activeWindowId === 'machineLearning' ? 'is-active' : 'is-inactive'}`}
            data-grid={layout}
            onMouseDown={() => bringToFront('machineLearning')}
            style={{ backgroundColor: '#f4f4f4', border: '2px solid #ccc', borderRadius: '6px', overflow: 'hidden', zIndex: getZIndex('machineLearning') }}
          >
            <div className="window-header drag-handle" onDoubleClick={() => snapToFit('machineLearning')}>
              <span className="header-title">🧠 Machine Learning</span>
              <div className="header-button-group">
                <MinimizeButton onClick={() => minimizeWindow('machineLearning', 'Machine Learning')} />
                <MaximizeButton windowId="machineLearning" />
                <CloseButton onClick={() => setShowMachineLearning(false)} />
              </div>
            </div>
            <div className="window-content" style={{ height: 'calc(100% - 40px)', overflow: 'auto' }}>
              <MachineLearningPanel />
            </div>
          </div>
        );
      })()
      : null;

  layoutRef.current = layoutLg;

  return (
    <div
      className="canvas-dnd-wrapper"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => e.preventDefault()}
      style={{ width: '100%', height: '100%' }}
    >
      <div className="canvas-container">
        <ResponsiveGridLayout
          className="layout"
          layouts={{ lg: layoutLg }}
          breakpoints={{ lg: 1200 }}
          cols={{ lg: 10 }}
          rowHeight={30}
          isResizable
          isDraggable
          compactType={null}
          preventCollision
          resizeHandles={['se', 'e', 's']}
          draggableHandle=".window-header"
          draggableCancel=".whiteboard-content"
          onResize={handleResize}
          onResizeStop={handleResizeStop}
          onDragStart={(layout, oldItem, newItem) => bringToFront(newItem.i)}
          onDragStop={(layout, oldItem, newItem) => {
            const constrained = clampLayoutToGrid(newItem, 10);
            newItem.x = constrained.x;
            newItem.y = constrained.y;
            newItem.w = constrained.w;
            newItem.h = constrained.h;
            layoutRef.current = layout;
            saveWindowState(newItem.i, newItem);
          }}
          onLayoutChange={(currentLayout) => {
            layoutRef.current = currentLayout;
            currentLayout.forEach((item) => saveWindowState(item.i, item));
          }}
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
        </ResponsiveGridLayout>
        <MinimizedDock />
      </div>
    </div>
  );
}

export default CanvasContainer;
