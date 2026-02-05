// File: CanvasContainer.jsx
import React, { useMemo, useContext, useRef, useState } from 'react';
import './CanvasContainer.css';
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
import useWindowInteractions from '../../hooks/useWindowInteractions';
import { clampLayoutToGrid } from '../../utils/windowLayout';

const RESIZE_HANDLES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

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
    snapEnabled,
    setSnapEnabled,
  } = useWindowContext();
  const [hiddenHarnessIds, setHiddenHarnessIds] = useState([]);
  const layoutMapRef = useRef(new Map());
  const containerRef = useRef(null);

  const setLayout = React.useCallback(
    (id, layout) => {
      layoutMapRef.current.set(id, layout);
      saveWindowState(id, layout);
    },
    [saveWindowState]
  );

  const {
    registerWindow,
    getWindowStyle,
    bindDragHandle,
    bindResizeHandle,
    isInteracting,
  } = useWindowInteractions({
    containerRef,
    getLayoutMap: () => layoutMapRef.current,
    setLayout,
    isLocked,
    focusWindow,
    snapEnabled,
  });

  const isHarness = useMemo(
    () => new URLSearchParams(window.location.search).has('windowHarness'),
    []
  );

  const { fullData } = useContext(DataContext);
  console.log("✅ CanvasContainer fullData length:", fullData?.length || 0); // (optional debug)
  console.log("🧨 FULLDATA RAW VALUE:", fullData);
  console.log("🧨 FULLDATA TYPE:", typeof fullData);
  console.log("🧨 FULLDATA isArray:", Array.isArray(fullData));
  console.log("🧨 FULLDATA LENGTH:", fullData?.length);



  const bringToFront = (id) => {
    focusWindow(id);
  };

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

  // Aggregate layouts so lock state reflects without remount.
  const layoutMap = new Map();
  const registerLayout = (id, layout, group, mode = 'cascade') => {
    const resolved = getResolvedLayout(id, layout, { cols: 10, mode });
    const fullLayout = { i: id, ...resolved };
    if (group) fullLayout.group = group;
    layoutMap.set(id, fullLayout);
    return fullLayout;
  };

  const snapToFit = (id) => {
    const item = layoutMapRef.current.get(id);
    if (!item) return;
    const constrained = clampLayoutToGrid({ ...item, x: 0, w: 10 }, 10);
    setLayout(id, constrained);
  };

  const renderResizeHandles = (id) =>
    RESIZE_HANDLES.map((handle) => (
      <div
        key={`${id}-${handle}`}
        className={`resize-handle resize-${handle}`}
        {...bindResizeHandle(id, handle)}
      />
    ));

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
          ref={registerWindow(`workflow-${win.id}`)}
          className={`window-frame grid-item ${activeWindowId === `workflow-${win.id}` ? 'is-active' : 'is-inactive'}`}
          onPointerDown={() => bringToFront(`workflow-${win.id}`)}
          style={{
            ...getWindowStyle(layout),
            zIndex: getZIndex(`workflow-${win.id}`),
          }}
        >
          <div
            className="window-header drag-handle"
            onDoubleClick={() => snapToFit(`workflow-${win.id}`)}
            {...bindDragHandle(`workflow-${win.id}`)}
          >
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
          {renderResizeHandles(`workflow-${win.id}`)}
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
            ref={registerWindow('dataPreview')}
            className={`window-frame grid-item ${activeWindowId === 'dataPreview' ? 'is-active' : 'is-inactive'}`}
            onPointerDown={() => bringToFront('dataPreview')}
            style={{
              ...getWindowStyle(layout),
              backgroundColor: '#f4f4f4',
              border: '2px solid #ccc',
              borderRadius: '6px',
              overflow: 'hidden',
              zIndex: getZIndex('dataPreview'),
            }}
          >
            <div
              className="window-header drag-handle"
              onDoubleClick={() => snapToFit('dataPreview')}
              {...bindDragHandle('dataPreview')}
            >
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
            {renderResizeHandles('dataPreview')}
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
            ref={registerWindow('rawViewer')}
            className={`window-frame grid-item ${activeWindowId === 'rawViewer' ? 'is-active' : 'is-inactive'}`}
            onPointerDown={() => bringToFront('rawViewer')}
            style={{
              ...getWindowStyle(layout),
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
              {...bindDragHandle('rawViewer')}
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
            {renderResizeHandles('rawViewer')}
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
            ref={registerWindow('aiChartWindow')}
            className={`window-frame grid-item ${activeWindowId === 'aiChartWindow' ? 'is-active' : 'is-inactive'}`}
            onPointerDown={() => bringToFront('aiChartWindow')}
            style={{ ...getWindowStyle(layout), zIndex: getZIndex('aiChartWindow') }}
          >
            <div
              className="window-header drag-handle"
              onDoubleClick={() => snapToFit('aiChartWindow')}
              {...bindDragHandle('aiChartWindow')}
            >
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
            {renderResizeHandles('aiChartWindow')}
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
            ref={registerWindow('aiWorkflowLab')}
            className={`window-frame grid-item ${activeWindowId === 'aiWorkflowLab' ? 'is-active' : 'is-inactive'}`}
            onPointerDown={() => bringToFront('aiWorkflowLab')}
            style={{
              ...getWindowStyle(finalLayout),
              backgroundColor: '#f4f4f4',
              border: '2px solid #ccc',
              borderRadius: '6px',
              overflow: 'hidden',
              zIndex: getZIndex('aiWorkflowLab'),
            }}
          >
            <div
              className="window-header drag-handle"
              onDoubleClick={() => snapToFit('aiWorkflowLab')}
              {...bindDragHandle('aiWorkflowLab')}
            >
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
            {renderResizeHandles('aiWorkflowLab')}
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
            ref={registerWindow('whiteBoard')}
            className={`window-frame grid-item ${activeWindowId === 'whiteBoard' ? 'is-active' : 'is-inactive'}`}
            onPointerDown={() => bringToFront('whiteBoard')}
            style={{ ...getWindowStyle(finalLayout), zIndex: getZIndex('whiteBoard') }}
          >
            <div
              className="window-header drag-handle"
              onDoubleClick={() => snapToFit('whiteBoard')}
              {...bindDragHandle('whiteBoard')}
            >
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
            {renderResizeHandles('whiteBoard')}
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
          ref={registerWindow(chart.id)}
          className={`window-frame grid-item ${activeWindowId === chart.id ? 'is-active' : 'is-inactive'}`}
          onPointerDown={() => bringToFront(chart.id)}
          style={{
            ...getWindowStyle(layout),
            zIndex: getZIndex(chart.id),
            border: '1px solid #ddd',
            borderRadius: '8px',
            overflow: 'hidden',
            backgroundColor: '#fff',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
          }}
        >
          <div
            className="window-header drag-handle"
            onDoubleClick={() => snapToFit(chart.id)}
            {...bindDragHandle(chart.id)}
          >
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
          {renderResizeHandles(chart.id)}
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
            ref={registerWindow('storyPanel')}
            className={`window-frame grid-item ${activeWindowId === 'storyPanel' ? 'is-active' : 'is-inactive'}`}
            onPointerDown={() => bringToFront('storyPanel')}
            style={{
              ...getWindowStyle(layout),
              backgroundColor: '#f4f4f4',
              border: '2px solid #ccc',
              borderRadius: '6px',
              overflow: 'hidden',
              zIndex: getZIndex('storyPanel'),
            }}
          >
            <div
              className="window-header drag-handle"
              onDoubleClick={() => snapToFit('storyPanel')}
              {...bindDragHandle('storyPanel')}
            >
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
            {renderResizeHandles('storyPanel')}
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
            ref={registerWindow('machineLearning')}
            className={`window-frame grid-item ${activeWindowId === 'machineLearning' ? 'is-active' : 'is-inactive'}`}
            onPointerDown={() => bringToFront('machineLearning')}
            style={{
              ...getWindowStyle(layout),
              backgroundColor: '#f4f4f4',
              border: '2px solid #ccc',
              borderRadius: '6px',
              overflow: 'hidden',
              zIndex: getZIndex('machineLearning'),
            }}
          >
            <div
              className="window-header drag-handle"
              onDoubleClick={() => snapToFit('machineLearning')}
              {...bindDragHandle('machineLearning')}
            >
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
            {renderResizeHandles('machineLearning')}
          </div>
        );
      })()
      : null;

  const harnessElements = isHarness
    ? [
      {
        id: 'harness-summary',
        title: 'Harness: Summary',
        layout: registerLayout('harness-summary', { x: 0, y: 0, w: 5, h: 8, minW: 3, minH: 4 }, 'harness', 'cascade'),
        content: (
          <div className="window-content" style={{ padding: '12px' }}>
            <p><strong>Goal:</strong> Feel the new drag/resize loop.</p>
            <p>Try snapping near edges; observe z-order & focus.</p>
          </div>
        ),
      },
      {
        id: 'harness-chart',
        title: 'Harness: Chart Panel',
        layout: registerLayout('harness-chart', { x: 5, y: 0, w: 5, h: 10, minW: 3, minH: 5 }, 'harness', 'cascade'),
        content: (
          <div className="window-content" style={{ padding: '12px' }}>
            <p>Placeholder for a visualization.</p>
            <div className="harness-block" />
          </div>
        ),
      },
      {
        id: 'harness-metrics',
        title: 'Harness: Metrics',
        layout: registerLayout('harness-metrics', { x: 0, y: 9, w: 4, h: 7, minW: 3, minH: 4 }, 'harness', 'cascade'),
        content: (
          <div className="window-content" style={{ padding: '12px' }}>
            <ul>
              <li>Drag: pointer-captured</li>
              <li>Resize: edges/corners</li>
              <li>Snap: near viewport</li>
            </ul>
          </div>
        ),
      },
      {
        id: 'harness-log',
        title: 'Harness: Activity',
        layout: registerLayout('harness-log', { x: 4, y: 10, w: 6, h: 7, minW: 3, minH: 4 }, 'harness', 'cascade'),
        content: (
          <div className="window-content" style={{ padding: '12px' }}>
            <p>Open real panels alongside to compare.</p>
          </div>
        ),
      },
    ]
    : [];

  layoutMapRef.current = layoutMap;

  const harnessNodes = harnessElements
    .filter((item) => !minimizedWindows[item.id] && !hiddenHarnessIds.includes(item.id))
    .map((item) => (
    <div
      key={item.id}
      ref={registerWindow(item.id)}
      className={`window-frame grid-item ${activeWindowId === item.id ? 'is-active' : 'is-inactive'}`}
      onPointerDown={() => bringToFront(item.id)}
      style={{ ...getWindowStyle(item.layout), zIndex: getZIndex(item.id) }}
    >
      <div
        className="window-header drag-handle"
        onDoubleClick={() => snapToFit(item.id)}
        {...bindDragHandle(item.id)}
      >
        <span className="header-title">{item.title}</span>
        <div className="header-button-group">
          <MinimizeButton onClick={() => minimizeWindow(item.id, item.title)} />
          <MaximizeButton windowId={item.id} />
          <CloseButton onClick={() => setHiddenHarnessIds((prev) => [...prev, item.id])} />
        </div>
      </div>
      {item.content}
      {renderResizeHandles(item.id)}
    </div>
  ));

  return (
    <div
      className={`canvas-dnd-wrapper ${isInteracting ? 'is-interacting' : ''}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => e.preventDefault()}
      style={{ width: '100%', height: '100%' }}
    >
      <div className="canvas-container" ref={containerRef}>
        {isHarness && (
          <div className="window-harness-bar">
            <span>Window Interaction Harness</span>
            <button
              type="button"
              className="harness-toggle"
              onClick={() => setSnapEnabled((prev) => !prev)}
            >
              Snap: {snapEnabled ? 'On' : 'Off'}
            </button>
          </div>
        )}
        <div className="window-layer">
          {harnessNodes}
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
    </div>
  );
}

export default CanvasContainer;
