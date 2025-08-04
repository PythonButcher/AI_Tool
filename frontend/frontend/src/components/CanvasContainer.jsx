import React, { useEffect, useState, useRef } from 'react';
import './css/CanvasContainer.css';
import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import CloseButton from './button_components/CloseButton';
import MinimizeButton from './button_components/MinimizeButton';
import MaximizeButton from './button_components/MaximizeButton';
import MinimizedDock from './MinimizedDock';
import RolesPanel from './chart_components/RolesPanel';
import ChartComponent from './chart_components/ChartComponent';
import FieldsPanel from './FieldsPanel';
import { FaLock, FaLockOpen } from 'react-icons/fa';
import AICharts from './ai_ml_components/AICharts';
import AiWorkflowLab from './workflow_lab_components/AiWorkflowLab';
import PreviewModeSelector from './viewing_components/PreviewModeSelector';
import DataTablePreview from './viewing_components/DataTablePreview';
import DataStoryPanel from './DataStoryPanel';
import Whiteboard from './white_board_components/WhiteBoard';
import { JsonViewer } from 'view-json-react';
import { useActiveDataset } from '../context/DataContext';
import AIReporter from './workflow_lab_components/AIReporter';
import { getWorkflowWindows } from '../utils/workflow_output_router';
import { useWindowContext } from '../context/WindowContext';



const ResponsiveGridLayout = WidthProvider(Responsive);

function CanvasContainer({
  children,
  uploadedData,
  showDataPreview,
  handleClosePreview,
  handleCloseCanvas,
  cleanedData,
  selectedChartType,
  handleCloseChartWindow,
  handleCloseStoryBoard,
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
  showCanvasMinimized,
  setShowCanvasMinimized,
  handleCanvasMinimize,
  chartMapping,
  previewMode,
  setPreviewMode,
  showWhiteBoard,
  setShowWhiteBoard,
  pipelineResults,
  setPipelineResults,
  setOutputWindows,
  showAiReport,
  onCloseAiReport,
}) {
  const { minimizedWindows, minimizeWindow,
          restoreWindow, saveWindowState,
          getWindowState, toggleLock, isLocked,
          getWindowContentState } = useWindowContext();

  const [zIndices, setZIndices] = useState({});
  const zCounter = useRef(1);
  const layoutRef = useRef([]);
  const bringToFront = (id) => {
    setZIndices(prev => ({ ...prev, [id]: ++zCounter.current }));
  };
  const linkedResize = true;

  const dataset = useActiveDataset();
  const previewData = React.useMemo(() => {
    if (Array.isArray(dataset)) return dataset.length <= 100 ? dataset : dataset.slice(0, 100);
    if (typeof dataset?.data_preview === 'string') {
      try {
        const arr = JSON.parse(dataset.data_preview);
        return arr.length <= 100 ? arr : arr.slice(0, 100);
      } catch (e) {
        console.error("❌ Failed to parse dataset data_preview", e);
      }
    }
    return [];
  }, [dataset]);

  let outputWindows = getWorkflowWindows(pipelineResults || {});
  if (!showAiReport) {
    outputWindows = outputWindows.filter(w => w.type !== 'report');
  }

  // Collect layouts for react-grid-layout so that updates like locking
  // immediately reflect without remounting windows.
  const layoutLg = [];
  const registerLayout = (id, layout, group) => {
    const fullLayout = { i: id, ...layout };
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
      ? layout.filter(item => item.group === target.group)
      : axis === 'x'
        ? layout.filter(item => item.y === target.y)
        : layout.filter(item => item.x === target.x);
    if (groupItems.length <= 1) return;
    const sorted = groupItems.slice().sort((a, b) => a[key] - b[key]);
    const total = axis === 'x' ? 10 : sorted.reduce((sum, item) => sum + item[sizeKey], 0);
    const staticTotal = sorted
      .filter(item => item.i !== target.i && item.static)
      .reduce((sum, item) => sum + item[sizeKey], 0);
    const adjustable = sorted.filter(item => item.i !== target.i && !item.static);
    if (adjustable.length === 0) return;
    const adjustableTotal = adjustable.reduce((sum, item) => sum + item[sizeKey], 0);
    let remaining = total - target[sizeKey] - staticTotal;
    let nextPos = Math.min(...sorted.map(item => item[key]));
    sorted.forEach(item => {
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
    layoutRef.current = layout;
  };

  const snapToFit = (id) => {
    const layout = layoutRef.current.slice();
    const item = layout.find(l => l.i === id);
    if (!item) return;
    item.x = 0;
    item.w = 10;
    applyLinkedResize(layout, item, 'x');
    applyLinkedResize(layout, item, 'y');
    layoutRef.current = layout;
  };

  const workflowElements = outputWindows
    .filter(win => !minimizedWindows[`workflow-${win.id}`])
    .map((win, idx) => {
      const saved = getWindowState(`workflow-${win.id}`);
      const defaultLayout = win.type === 'report'
        ? { x: 0, y: 0, w: 10, h: 30, minW: 7, minH: 15 }
        : { x: 1, y: 40 + idx * 4, w: 8, h: 6, minW: 3, minH: 3 };
      const layout = registerLayout(`workflow-${win.id}`, {
        ...(saved || defaultLayout),
        static: isLocked(`workflow-${win.id}`)
      }, 'workflow');

      return (
        <div
          key={`workflow-output-${win.id}`}
          className="grid-item"
          data-grid={layout}
          onMouseDown={() => bringToFront(`workflow-${win.id}`)}
          style={{ zIndex: zIndices[`workflow-${win.id}`] || 1 }}
        >
          <div className="window-header drag-handle" onDoubleClick={() => snapToFit(`workflow-${win.id}`)}>
            <span className="header-title">{win.label}</span>
            <div className="header-button-group">
              <MinimizeButton onClick={() => minimizeWindow(`workflow-${win.id}`, win.label)} />
              <MaximizeButton windowId={`workflow-${win.id}`} />
              <CloseButton onClick={() => {
                if (win.type === 'report') {
                  setPipelineResults({});
                  if (onCloseAiReport) onCloseAiReport();
                } else {
                  setPipelineResults(prev => {
                    const copy = { ...prev };
                    delete copy[win.id];
                    return copy;
                  });
                }
              }} />
            </div>
          </div>
          <div className="window-content" style={{ padding: '10px', overflow: 'auto' }}>
            {win.type === 'text' && <pre>{win.content}</pre>}
            {win.type === 'chart' && <AICharts aiChartType={win.chartType} aiChartData={win.chartData} />}
            {win.type === 'report' && <AIReporter summary={win.content.summary} insights={win.content.insights} execution={win.content.execution} chartType={win.content.chartType} chartData={win.content.chartData} />}
          </div>
        </div>
      );
    });

  const dataPreviewElement = (dataset && previewData.length > 0 && showDataPreview && !minimizedWindows['dataPreview']) ? (() => {
    const saved = getWindowState('dataPreview');
    const layout = registerLayout('dataPreview', {
      ...(saved || { x: 0, y: 0, w: 10, h: 15, minW: 3, minH: 2, resizeHandles: ['se', 'e', 's'] }),
      static: isLocked('dataPreview')
    }, 'preview');

    return (
      <div
        key="dataPreview"
        className="grid-item"
        data-grid={layout}
        onMouseDown={() => bringToFront('dataPreview')}
        style={{ backgroundColor: '#f4f4f4', border: '2px solid #ccc', borderRadius: '6px', overflow: 'hidden', zIndex: zIndices['dataPreview'] || 1 }}
      >
        <div className="window-header drag-handle" onDoubleClick={() => snapToFit('dataPreview')}>
          <span className="header-title">📄 Data Preview</span>
          <div className="header-button-group">
            <MinimizeButton onClick={() => minimizeWindow('dataPreview', 'Data Preview')} />
            <MaximizeButton windowId="dataPreview" />
            <CloseButton onClick={handleClosePreview} />
          </div>
        </div>
        <div className="uploaded-data-preview">
          <PreviewModeSelector previewMode={previewMode} setPreviewMode={setPreviewMode} />
          {previewMode === 'table' && <DataTablePreview data={previewData} />}
          {previewMode === 'json' && (
            <div style={{ backgroundColor: '#F8F8F2', borderRadius: '12px', padding: '16px', boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.2)', fontFamily: '"Press Start 2P", cursive', color: '#282828', border: '3px solid #E60012', maxHeight: '400px', overflowY: 'auto' }}>
              <JsonViewer data={previewData} expandLevel={2} onCopy={(copyData) => console.log('Copied data:', copyData)} style={{ fontSize: '14px', color: '#383838' }} />
            </div>
          )}
        </div>
        <div className="uploaded-data-preview">{children}</div>
      </div>
    );
  })() : null;

  const aiChartElement = (showAIChart && !minimizedWindows['aiChartWindow']) ? (() => {
    const saved = getWindowState('aiChartWindow');
    const layout = registerLayout('aiChartWindow', {
      ...(saved || { x: 0, y: 0, w: 10, h: 15, minW: 3, minH: 5, resizeHandles: ['se', 'e', 's'] }),
      static: isLocked('aiChartWindow')
    }, 'preview');

    return (
      <div
        key="aiChartWindow"
        className="grid-item"
        data-grid={layout}
        onMouseDown={() => bringToFront('aiChartWindow')}
        style={{ zIndex: zIndices['aiChartWindow'] || 1 }}
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
  })() : null;

  const workflowLabElement = (showAiWorkflow && !minimizedWindows['aiWorkflowLab']) ? (() => {
    const saved = getWindowState('aiWorkflowLab');
    const contentState = getWindowContentState('aiWorkflowLab');
    const finalLayout = registerLayout('aiWorkflowLab', {
      ...(saved || { x: 0, y: 0, w: 10, h: 27.5, minW: 2, minH: 2, resizeHandles: ['se', 'e', 's'] }),
      static: isLocked('aiWorkflowLab')
    }, 'lab');

    return (
      <div
        key="aiWorkflowLab"
        className="grid-item"
        data-grid={finalLayout}
        onMouseDown={() => bringToFront('aiWorkflowLab')}
        style={{ backgroundColor: '#f4f4f4', border: '2px solid #ccc', borderRadius: '6px', overflow: 'hidden', zIndex: zIndices['aiWorkflowLab'] || 1 }}
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
  })() : null;

  const whiteBoardElement = (showWhiteBoard && !minimizedWindows['whiteBoard']) ? (() => {
    const saved = getWindowState('whiteBoard');
    const contentState = getWindowContentState('whiteBoard');
    const finalLayout = registerLayout('whiteBoard', {
      ...(saved || { x: 0, y: 0, w: 10, h: 27.5, minW: 2, minH: 2, resizeHandles: ['se', 'e', 's'] }),
      static: isLocked('whiteBoard')
    }, 'lab');

    return (
      <div
        key="whiteBoard"
        className="grid-item"
        data-grid={finalLayout}
        onMouseDown={() => bringToFront('whiteBoard')}
        style={{ zIndex: zIndices['whiteBoard'] || 1 }}
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
  })() : null;

  const chartWindowElement = (showChartWindow && selectedChartType && !minimizedWindows['chartWindow']) ? (() => {
    const saved = getWindowState('chartWindow');
    const layout = registerLayout('chartWindow', {
      ...(saved || { x: 0.5, y: 0.5, w: 9, h: 27.5, minW: 4, minH: 8, maxH: 30, resizeHandles: ['se', 'e', 's'] }),
      static: isLocked('chartWindow')
    }, 'charts');

    return (
      <div
        key="chartWindow"
        className="grid-item"
        data-grid={layout}
        onMouseDown={() => bringToFront('chartWindow')}
        style={{ minWidth: '150px', minHeight: '150px', overflow: 'hidden', backgroundColor: '#fff', borderRadius: '8px', zIndex: zIndices['chartWindow'] || 5 }}
      >
        <div className="preview-header drag-handle" onDoubleClick={() => snapToFit('chartWindow')}>
          <span>📊 Chart Visualization</span>
          <div className="header-button-group">
            <MinimizeButton onClick={() => minimizeWindow('chartWindow', 'Chart')} />
            <CloseButton onClick={handleCloseChartWindow} />
          </div>
        </div>
        <ChartComponent chartType={selectedChartType} chartData={chartData} mapping={chartMapping} />
        <RolesPanel chartType={selectedChartType} mapping={chartMapping} />
      </div>
    );
  })() : null;

  const storyPanelElement = (showStoryPanel && !minimizedWindows['storyPanel']) ? (() => {
    const saved = getWindowState('storyPanel');
    const layout = registerLayout('storyPanel', {
      ...(saved || { x: 1, y: 0, w: 9, h: 31, minW: 7, minH: 15, resizeHandles: ['se', 'e', 's'] }),
      static: isLocked('storyPanel')
    }, 'story');

    return (
      <div
        key="storyWindow"
        className="grid-item"
        data-grid={layout}
        onMouseDown={() => bringToFront('storyPanel')}
        style={{ backgroundColor: '#f4f4f4', border: '2px solid #ccc', borderRadius: '6px', overflow: 'hidden', zIndex: zIndices['storyPanel'] || 1 }}
      >
        <div className="window-header drag-handle" onDoubleClick={() => snapToFit('storyPanel')}>
          <span className="header-title">📖 Data Story</span>
          <div className="header-button-group">
            <MinimizeButton onClick={() => minimizeWindow('storyPanel', 'Story')} />
            <CloseButton onClick={() => setShowStoryPanel(false)} />
          </div>
        </div>
        <div className="window-content" style={{ padding: '10px', height: 'calc(100% - 40px)', overflow: 'auto' }}>
          <DataStoryPanel uploadedData={uploadedData} cleanedData={cleanedData} />
        </div>
      </div>
    );
  })() : null;

  layoutRef.current = layoutLg;

  return (
    <div className="canvas-dnd-wrapper" onDragOver={(e) => e.preventDefault()} onDrop={(e) => e.preventDefault()} style={{ width: '100%', height: '100%' }}>
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
          onLayoutChange={(currentLayout) => {
            layoutRef.current = currentLayout;
            currentLayout.forEach(item => saveWindowState(item.i, item));
           }}
        >

          {workflowElements}
          {dataPreviewElement}
          {aiChartElement}
          {workflowLabElement}
          {whiteBoardElement}
          {chartWindowElement}
          {storyPanelElement}

        </ResponsiveGridLayout>
        <MinimizedDock />
      </div>
    </div>
  );
}

export default CanvasContainer;
