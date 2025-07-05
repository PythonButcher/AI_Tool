import React, {  useEffect } from 'react';
import './css/CanvasContainer.css';
import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import CloseButton from './button_components/CloseButton';
import MinimizeButton from './button_components/MinimizeButton';
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
import DropZone from '../utils/DropZone';

const ResponsiveGridLayout = WidthProvider(Responsive);

function CanvasContainer({
  children,
  uploadedData,
  showDataPreview,
  handleClosePreview,
  handleCloseCanvas,
  showFieldsPanel,
  handleToggleField,
  cleanedData,
  selectedChartType,
  handleCloseChartWindow,
  handleCloseStoryBoard,
  showChartWindow,
  xAxis,
  yAxis,
  setXAxis,
  setYAxis,
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
  setChartMapping,
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
  console.log('Initial uploadedData received:', uploadedData);
  console.log('Selected Chart Type:', selectedChartType);
  console.log('showChartWindow:', showChartWindow);
  console.log('CanvasContainer received cleanedData:', cleanedData);
  console.log('CanvasContainer received chartData:', aiChartData);
  console.log('📊 showAIChart state in CanvasContainer:', showAIChart);
  console.log('🛠 AI Chart Props in CanvasContainer:', {
    showAIChart,
    aiChartType,
    aiChartData,
  });

  console.log("pipelineResults (debug):", pipelineResults);
  console.log("🧪 pipelineResults FULL:", pipelineResults);
  Object.entries(pipelineResults).forEach(([nodeId, nodeResult]) => {
    console.log(`🧪 node ${nodeId}:`, nodeResult);
  });

  let outputWindows = getWorkflowWindows(pipelineResults || {});
  if (!showAiReport) {
    outputWindows = outputWindows.filter(w => w.type !== 'report');
  }

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
  console.log("Dataset length :", previewData.len);
  console.log("DEBUG active dataset:", dataset);
  console.log("DEBUG previewData:", previewData);
  const handleFieldDrop = (axis, field) => {
    if (axis === "x") {
      setXAxis(field);
      setChartMapping(prev => ({ ...prev, "X-Axis": field }));
    } else if (axis === "y") {
      setYAxis(field);
      setChartMapping(prev => ({ ...prev, "Y-Axis": field }));
    }
  };


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
          layouts={{}}
          breakpoints={{ lg: 1200 }}
          cols={{ lg: 10 }}
          rowHeight={30}
          isResizable
          isDraggable
          compactType={null}
          preventCollision
        >
          {/* ✅ Dynamic Workflow Output Windows */} {/* */}
          {outputWindows.map((win, idx) => (
            <div
              key={`workflow-output-${idx}`}
              className="grid-item"
              data-grid={
                win.type === 'report'
                  ? { x: 0, y: 0, w: 10, h: 30, minW: 7, minH: 15 } // 🔥 Full-page like expansion
                  : { x: 1, y: 40 + idx * 4, w: 8, h: 6, minW: 3, minH: 3 }
              }
            >
              <div className="window-header drag-handle"> {/* Your existing structure */} {/* */}
                <span className="header-title">{win.label}</span> {/* */}
                <div className="header-button-group"> {/* */}
                  <MinimizeButton onClick={handleCanvasMinimize} /> {/* */}
                  <CloseButton
                    onClick={() => {
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
                    }}
                  /> {/* */}
                </div>
              </div>
              <div className="window-content" style={{ padding: '10px', overflow: 'auto' }}> {/* Your existing structure */} {/* */}
                {/* Your existing conditional rendering based on win.type */}
                {win.type === 'text' && <pre>{win.content}</pre>} {/* */}
                {win.type === 'chart' && (
                  <AICharts aiChartType={win.chartType} aiChartData={win.chartData} /> //
      
                )}
                {win.type === 'report' && (
                  <AIReporter
                    summary={win.content.summary} //
                    insights={win.content.insights} //
                    execution={win.content.execution} //
                    chartType={win.content.chartType} //
                    chartData={win.content.chartData} //
                  />
                )}
              </div>
            </div>
          ))}


          {/* Data Preview Section */}

          {dataset && previewData.length > 0 && showDataPreview && (

            <div
              key={`dataPreview-${showDataPreview}-${showCanvasMinimized}`}
              className="grid-item"
              data-grid={
                showCanvasMinimized
                  ? {
                      x: 0,
                      y: 0,
                      w: 9.9,
                      h: 2,
                      resizeHandles: [],
                      static: true,
                    }
                  : {
                      x: 0,
                      y: 0,
                      w: 10,
                      h: 15,
                      minW: 3,
                      minH: 2,
                      resizeHandles: ['se', 'e', 's'],
                      static: false,
                    }
              }
              style={{
                position: showCanvasMinimized ? 'fixed' : 'relative',
                bottom: showCanvasMinimized ? '-1000px' : undefined,
                left: showCanvasMinimized ? '0px' : undefined,
                width: showCanvasMinimized ? '250px' : '100%',
                height: showCanvasMinimized ? '20px' : 'auto',
                zIndex: showCanvasMinimized ? 1200 : undefined,
                backgroundColor: '#f4f4f4',
                border: '2px solid #ccc',
                borderRadius: '6px',
                overflow: 'hidden',
                cursor: 'default',
                transition: 'all 0.5s ease',
              }}
            >
              <div className="window-header drag-handle">
                <span className="header-title">
                  {showCanvasMinimized ? 'Data Preview (Minimized)' : '📄 Data Preview'}
                </span>
                <div className="header-button-group">
                  <MinimizeButton onClick={handleCanvasMinimize} />
                  <CloseButton
                    onClick={() => {
                      handleClosePreview();
                      setShowCanvasMinimized(false);
                    }}
                  />
                </div>
              </div>

              {!showCanvasMinimized && (
                <>
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
                </>
              )}
            </div>
          )}

          {/* -------------------AI-Generated Chart Section --------------------*/}
          {showAIChart && (
            <div
              key="aiChartWindow"
              className="grid-item"
              data-grid={{
                x: 0,
                y: 0,
                w: 10,
                h: 15,
                minW: 3,
                minH: 5,
                resizeHandles: ['se', 'e', 's'],
              }}
            >
              <div className="window-header drag-handle">
                <span className="header-title">📊 AI-Generated Chart</span>
                <div className="header-button-group">
                  <MinimizeButton onClick={handleCanvasMinimize} />
                  <CloseButton onClick={() => setShowAIChart(false)} />
                </div>
              </div>

              <div
                className="window-content"
                style={{ padding: '10px', height: 'calc(100% - 40px)', overflow: 'auto' }}
              >
                <AICharts aiChartType={aiChartType} aiChartData={aiChartData} />
              </div>
            </div>
          )}

          {/*-------------------------- AI Workflow Lab Section ----------------------------*/}
          {showAiWorkflow && (
            <div
              key={`aiWorkflowLab-${showAiWorkflow}-${showCanvasMinimized}`}
              className="grid-item"
              data-grid={
                showCanvasMinimized
                  ? {
                      x: 0,
                      y: 0,
                      w: 10,
                      h: 2,
                      resizeHandles: [],
                      static: true,
                    }
                  : {
                      x: 0,
                      y: 0,
                      w: 10,
                      h: 27.5,
                      minW: 2,
                      minH: 2,
                      resizeHandles: ['se', 'e', 's'],
                      static: true,
                    }
              }
              style={{
                position: showCanvasMinimized ? 'fixed' : 'relative',
                bottom: showCanvasMinimized ? '-1000px' : undefined,
                left: showCanvasMinimized ? '0px' : undefined,
                width: showCanvasMinimized ? '250px' : '100%',
                height: showCanvasMinimized ? '20px' : 'auto',
                zIndex: showCanvasMinimized ? 1200 : undefined,
                backgroundColor: '#f4f4f4',
                border: '2px solid #ccc',
                borderRadius: '6px',
                overflow: 'hidden',
                cursor: 'default',
                transition: 'all 0.5s ease',
              }}
            >
              <div className="window-header drag-handle">
                <span className="header-title">
                  {showCanvasMinimized ? 'AI Workflow Lab (Minimized)' : 'AI Workflow Lab'}
                </span>
                <div className="header-button-group">
                  <MinimizeButton onClick={handleCanvasMinimize} />
                  <CloseButton onClick={() => setShowAiWorkflow(false)} />
                </div>
              </div>

              {!showCanvasMinimized && (
                <div className="uploaded-data-preview workflow-content">
                  <AiWorkflowLab />
                </div>
              )}
            </div>
          )}

           {/* -------------------White Board Tool--------------------*/}
          {showWhiteBoard && (
            <div
              key="showWhiteBoard"
              className="grid-item"
              data-grid={{
                x: 0,
                y: 0,
                w: 10,
                h: 27.5,
                minW: 2,
                minH: 2,
                resizeHandles: ['se', 'e', 's'],
                static: true,
              }}
            >
              <div className="window-header drag-handle">
                <span className="header-title">📊 White Board</span>
                <div className="header-button-group">
                  <MinimizeButton onClick={handleCanvasMinimize} />
                  <CloseButton onClick={() => setShowWhiteBoard(false)} />
                </div>
              </div>

              <div
                className="window-content"
                style={{ padding: '10px', height: 'calc(100% - 40px)', overflow: 'auto' }}
              >
                <Whiteboard />
              </div>
            </div>
          )}

          {/* --------------------Standard Chart Window Section ------------------------*/}
          {showChartWindow && selectedChartType && (
            <div
              key="chartWindow"
              className="grid-item"
              data-grid={{
                x: 2,
                y: 15,
                w: 8,
                h: 15,
                minW: 3,
                minH: 5,
                resizeHandles: ['se', 'e', 's'],
              }}
            >
              <div className="preview-header drag-handle">
                <span>📊 Chart Visualization</span>
                <CloseButton onClick={handleCloseChartWindow} />
              </div>

              <ChartComponent
                chartType={selectedChartType}
                chartData={chartData}
                mapping={chartMapping}
              />

              <div className="chart-dropzones">
                <DropZone
                  axis="x"
                  currentField={xAxis}
                  onFieldDrop={(field) => handleFieldDrop('x', field)}
                />
                <DropZone
                  axis="y"
                  currentField={yAxis}
                  onFieldDrop={(field) => handleFieldDrop('y', field)}
                />
              </div>

              {/* RolesPanel (new component you’ll add next) */}
              <RolesPanel
                chartType={selectedChartType}
                mapping={chartMapping}
                setMapping={setChartMapping}
              />
            </div>
          )}

           {/*------------------------- AI Storyboard ----------------------------*/}
           {showStoryPanel && (
            <div
              key={`storyWindow-${showCanvasMinimized}`}
              className="grid-item"
              data-grid={
                showCanvasMinimized
                  ? {
                      x: 0,
                      y: 31,
                      w: 2,
                      h: 2,
                      resizeHandles: [],
                      static: true,
                    }
                  : {
                      x: 1,
                      y: 0,
                      w: 9,     // ✅ Maximize horizontal space (out of 10 total)
                      h: 31,    // ✅ More vertical space (tallest so far)
                      minW: 7,
                      minH: 15,
                      resizeHandles: ['se', 'e', 's'],
                      static: false,
                    }
              }
              
              style={{
                position: showCanvasMinimized ? 'fixed' : 'relative',
                zIndex: showCanvasMinimized ? 1200 : undefined,
                backgroundColor: '#f4f4f4',
                border: '2px solid #ccc',
                borderRadius: '6px',
                overflow: 'hidden',
                cursor: 'default',
                transition: 'all 0.5s ease',
              }}
            >
              <div className="window-header drag-handle">
                <span className="header-title">
                  {showCanvasMinimized ? 'Data Story (Minimized)' : '📖 Data Story'}
                </span>
                <MinimizeButton onClick={handleCanvasMinimize} />
                <CloseButton onClick={() => setShowStoryPanel(false)} />
              </div>

              {!showCanvasMinimized && (
                <div className="window-content" style={{ padding: '10px', height: 'calc(100% - 40px)', overflow: 'auto' }}>
                  <DataStoryPanel uploadedData={uploadedData} cleanedData={cleanedData} />
                </div>
              )}
            </div>
          )}

          {/*-------------------------- Fields Panel Section --------------------------------*/}
          {showFieldsPanel && uploadedData && (
            <div
              key="fieldsPanel"
              className="grid-item"
              data-grid={{
                x: 8,
                y: 10,
                w: 4,
                h: 15,
                minW: 3,
                minH: 5,
                resizeHandles: ['se', 'e', 's'],
              }}
            >
              <div className="preview-header drag-handle">
                <span>Fields Panel</span>
                <CloseButton
                  onClick={() => {
                    setShowAiWorkflow(false);
                    setShowCanvasMinimized(false);
                  }}
                />
              </div>
              <FieldsPanel cleanedData={cleanedData} />
            </div>
            
          )}
        </ResponsiveGridLayout>
      </div>
    </div>
  );
}

export default CanvasContainer;
