import React, { useEffect } from 'react';
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
  const { minimizedWindows, minimizeWindow, restoreWindow } = useWindowContext();

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

  return (
    <div className="canvas-dnd-wrapper" onDragOver={(e) => e.preventDefault()} onDrop={(e) => e.preventDefault()} style={{ width: '100%', height: '100%' }}>
      <div className="canvas-container">
        <ResponsiveGridLayout
          className="layout"
          layouts={{}}
          breakpoints={{ lg: 1200 }}
          cols={{ lg: 10 }}
          rowHeight={30}
          isResizable
          isDraggable
          compactType={null}
          preventCollision
        >

          {/* Workflow output windows */}
          {outputWindows.filter(win => !minimizedWindows[`workflow-${win.id}`]).map((win, idx) => (
            <div key={`workflow-output-${win.id}`} className="grid-item"
              data-grid={win.type === 'report' ? { x: 0, y: 0, w: 10, h: 30, minW: 7, minH: 15 } : { x: 1, y: 40 + idx * 4, w: 8, h: 6, minW: 3, minH: 3 }}>
              <div className="window-header drag-handle">
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
          ))}

          {/* Data Preview */}
          {dataset && previewData.length > 0 && showDataPreview && !minimizedWindows['dataPreview'] && (
            <div key="dataPreview" className="grid-item" data-grid={{ x: 0, y: 0, w: 10, h: 15, minW: 3, minH: 2, resizeHandles: ['se', 'e', 's'], static: false }}
              style={{ backgroundColor: '#f4f4f4', border: '2px solid #ccc', borderRadius: '6px', overflow: 'hidden' }}>
              <div className="window-header drag-handle">
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
          )}

          {/* AI Chart */}
          {showAIChart && !minimizedWindows['aiChartWindow'] && (
            <div key="aiChartWindow" className="grid-item" data-grid={{ x: 0, y: 0, w: 10, h: 15, minW: 3, minH: 5, resizeHandles: ['se', 'e', 's'] }}>
              <div className="window-header drag-handle">
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
          )}

          {/* Workflow Lab */}
          {showAiWorkflow && !minimizedWindows['aiWorkflowLab'] && (
            <div key="aiWorkflowLab" className="grid-item" data-grid={{ x: 0, y: 0, w: 10, h: 27.5, minW: 2, minH: 2, resizeHandles: ['se', 'e', 's'], static: true }}
              style={{ backgroundColor: '#f4f4f4', border: '2px solid #ccc', borderRadius: '6px', overflow: 'hidden' }}>
              <div className="window-header drag-handle">
                <span className="header-title">AI Workflow Lab</span>
                <div className="header-button-group">
                  <MinimizeButton onClick={() => minimizeWindow('aiWorkflowLab', 'AI Workflow')} />
                  <MaximizeButton windowId="aiWorkflowLab" />
                  <CloseButton onClick={() => setShowAiWorkflow(false)} />
                </div>
              </div>
              <div className="uploaded-data-preview workflow-content">
                <AiWorkflowLab />
              </div>
            </div>
          )}

          {/* Whiteboard */}
          {showWhiteBoard && !minimizedWindows['whiteBoard'] && (
            <div key="whiteBoard" className="grid-item" data-grid={{ x: 0.5, y: 0.5, w: 10, h: 27.5, minW: 2, minH: 2, resizeHandles: ['se', 'e', 's'], static: true }}>
              <div className="window-header drag-handle">
                <span className="header-title">📊 White Board</span>
                <div className="header-button-group">
                  <MinimizeButton onClick={() => minimizeWindow('whiteBoard', 'White Board')} />
                  <MaximizeButton windowId="whiteBoard" />
                  <CloseButton onClick={() => setShowWhiteBoard(false)} />
                </div>
              </div>
              <div className="window-content" style={{ padding: '10px', height: 'calc(100% - 40px)', overflow: 'auto' }}>
                <Whiteboard />
              </div>
            </div>
          )}

          {/* Chart Window */}
          {showChartWindow && selectedChartType && !minimizedWindows['chartWindow'] && (
            <div key="chartWindow" className="grid-item" data-grid={{ x: 0.5, y: 0.5, w: 9, h: 27.5, minW: 4, minH: 8, maxH: 30, resizeHandles: ['se', 'e', 's'] }}
              style={{ minWidth: '150px', minHeight: '150px', overflow: 'hidden', backgroundColor: '#fff', zIndex: 5, borderRadius: '8px' }}>
              <div className="preview-header drag-handle">
                <span>📊 Chart Visualization</span>
                <div className="header-button-group">
                  <MinimizeButton onClick={() => minimizeWindow('chartWindow', 'Chart')} />
                  <CloseButton onClick={handleCloseChartWindow} />
                </div>
              </div>
              <ChartComponent chartType={selectedChartType} chartData={chartData} mapping={chartMapping} />
              <RolesPanel chartType={selectedChartType} mapping={chartMapping} />
            </div>
          )}

          {/* Data Story */}
          {showStoryPanel && !minimizedWindows['storyPanel'] && (
            <div key="storyWindow" className="grid-item" data-grid={{ x: 1, y: 0, w: 9, h: 31, minW: 7, minH: 15, resizeHandles: ['se', 'e', 's'], static: false }}
              style={{ backgroundColor: '#f4f4f4', border: '2px solid #ccc', borderRadius: '6px', overflow: 'hidden' }}>
              <div className="window-header drag-handle">
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
          )}

        </ResponsiveGridLayout>
        <MinimizedDock />
      </div>
    </div>
  );
}

export default CanvasContainer;
