import React, { useCallback, useContext, useMemo, useState } from 'react';
import {
  FaBook,
  FaBrain,
  FaBriefcase,
  FaBroom,
  FaChartBar,
  FaColumns,
  FaDatabase,
  FaFileExport,
  FaFilter,
  FaPen,
  FaPlus,
  FaRobot,
  FaTable,
  FaTachometerAlt,
  FaTimes,
} from 'react-icons/fa';
import DataCleaningForm from '../data_management/DataCleaningForm';
import FileExport from '../data_management/FileExport';
import FieldsPanel from '../insights/FieldsPanel';
import SemanticModelPanel from '../insights/SemanticModelPanel';
import { DataContext, normalizeDatasetRows, useActiveDataset, useSemanticModel } from '../../context/DataContext';
import { useWindowContext } from '../../context/WindowContext';
import { normalizeSemanticDimension } from '../../utils/semanticObjectUtils';
import './SideBar.css';

const workflowItems = [
  { id: 'data', label: 'Data', icon: <FaDatabase /> },
  { id: 'explore', label: 'Explore', icon: <FaColumns /> },
  { id: 'visualise', label: 'Visualise', icon: <FaChartBar /> },
  { id: 'business', label: 'Business', icon: <FaBriefcase /> },
  { id: 'ai', label: 'AI', icon: <FaRobot /> },
  { id: 'dashboard', label: 'Dashboard', icon: <FaTachometerAlt /> },
  { id: 'whiteboard', label: 'Whiteboard', icon: <FaPen /> },
];

const chartShortcuts = [
  { type: 'Bar', icon: <FaChartBar /> },
  { type: 'Line', icon: <FaChartBar /> },
  { type: 'Pie', icon: <FaChartBar /> },
  { type: 'Doughnut', icon: <FaChartBar /> },
];

const emptySemanticConfig = {
  metricId: '',
  groupBy: '',
};

const DrawerHeader = ({ eyebrow, title, description, onClose }) => (
  <div className="workflow-drawer__header">
    <div>
      <p className="workflow-drawer__eyebrow">{eyebrow}</p>
      <h2 className="workflow-drawer__title">{title}</h2>
      <p className="workflow-drawer__description">{description}</p>
    </div>
    <button type="button" className="workflow-drawer__close" onClick={onClose} aria-label="Close drawer">
      <FaTimes />
    </button>
  </div>
);

const StatChip = ({ label, value }) => (
  <div className="workflow-stat-chip">
    <span className="workflow-stat-chip__value">{value}</span>
    <span className="workflow-stat-chip__label">{label}</span>
  </div>
);

function SideBar({
  activeWorkflow,
  onWorkflowSelect,
  onButtonClick,
  onDataCleaned,
  cleanedData,
  showAiWorkflow,
  setShowAiWorkflow,
  setShowDataPreview,
  setShowRawViewer,
  setOpenDataFilter,
  onDashboardToggle,
  isDashboardVisible,
  aiReportReady,
  onAiReportClick,
  onOpenAiChat,
  setStoryData,
  setShowStoryPanel,
  setShowWhiteBoard,
  onStoryModelChange,
  setShowMachineLearning,
}) {
  const [showCleaningForm, setShowCleaningForm] = useState(false);
  const [showExportPanel, setShowExportPanel] = useState(false);
  const activeDataset = useActiveDataset();
  const semanticModel = useSemanticModel();
  const { semanticModelStatus } = useContext(DataContext);
  const {
    restoreWindow,
    addChart,
    addDashboardChart,
    addDashboardKpi,
    openDashboard,
    setDashboardFilters,
  } = useWindowContext();
  const [semanticEditorRequest, setSemanticEditorRequest] = useState({
    isOpen: false,
    initialMetricId: '__new__',
    initialDraft: null,
    requestKey: 0,
  });

  const datasetRows = useMemo(() => {
    const preferredRows = normalizeDatasetRows(cleanedData);
    if (preferredRows.length > 0) return preferredRows;
    return normalizeDatasetRows(activeDataset);
  }, [activeDataset, cleanedData]);
  const rowCount = datasetRows.length;
  const columnCount = rowCount > 0 ? Object.keys(datasetRows[0]).length : 0;
  const semanticMetricCount = semanticModel?.metrics?.length || 0;
  const semanticDimensionCount = semanticModel?.dimensions?.length || 0;
  const hasDataset = rowCount > 0;
  const semanticDimensions = useMemo(
    () => (semanticModel?.dimensions || []).map(normalizeSemanticDimension),
    [semanticModel]
  );

  const handleGenerateStory = (model) => {
    onStoryModelChange(model);
    setStoryData(null);
    setShowStoryPanel(true);
    restoreWindow('storyPanel');
  };

  const handleQuickChart = (type) => {
    if (!hasDataset) {
      alert("No cleaned data available. Please load a dataset before creating a chart.");
      return;
    }

    addChart({ type });
  };

  const handleCreateSemanticChart = useCallback((semanticOverrides = {}) => {
    addChart({
      type: 'Bar',
      dataSourceMode: 'semantic',
      semanticConfig: {
        ...emptySemanticConfig,
        ...semanticOverrides,
      },
    });
  }, [addChart]);

  const handleCreateSemanticKpi = useCallback((semanticOverrides = {}) => {
    addDashboardKpi({
      semanticConfig: {
        ...emptySemanticConfig,
        ...semanticOverrides,
      },
    });

    if (activeWorkflow !== 'dashboard') {
      onWorkflowSelect('dashboard');
    }
  }, [activeWorkflow, addDashboardKpi, onWorkflowSelect]);

  const handleOpenSemanticEditor = useCallback((options = {}) => {
    setSemanticEditorRequest((prev) => ({
      isOpen: true,
      initialMetricId: options.metricId || '__new__',
      initialDraft: options.initialDraft || null,
      requestKey: prev.requestKey + 1,
    }));

    if (activeWorkflow !== 'business') {
      onWorkflowSelect('business');
    }
  }, [activeWorkflow, onWorkflowSelect]);

  const handleCloseSemanticEditor = useCallback(() => {
    setSemanticEditorRequest((prev) => ({
      ...prev,
      isOpen: false,
      initialDraft: null,
      initialMetricId: '__new__',
    }));
  }, []);

  const resolveFilterDimension = useCallback((semanticObject) => {
    if (!semanticObject || !semanticDimensions.length) return null;

    if (semanticObject.objectKind === 'dimension') {
      return semanticDimensions.find((dimension) => dimension.id === semanticObject.id) || null;
    }

    const normalizedField = String(semanticObject.field || '').trim().toLowerCase();
    if (!normalizedField) return null;

    return semanticDimensions.find((dimension) => {
      const candidates = [dimension.id, dimension.name, dimension.label, dimension.field];
      return candidates.some((candidate) => String(candidate || '').trim().toLowerCase() === normalizedField);
    }) || null;
  }, [semanticDimensions]);

  const handleAddSemanticFilter = useCallback((semanticObject) => {
    const targetDimension = resolveFilterDimension(semanticObject);
    openDashboard();

    setDashboardFilters((prev) => {
      if (targetDimension?.fieldType === 'temporal') {
        return {
          ...prev,
          dateDimensionId: targetDimension.id,
        };
      }

      const existingFilter = prev.dimensionFilters.find((filter) => filter.dimensionId === targetDimension?.id);
      if (existingFilter) {
        return prev;
      }

      return {
        ...prev,
        dimensionFilters: [
          ...prev.dimensionFilters,
          {
            id: `dashboard-filter-${Date.now()}`,
            dimensionId: targetDimension?.id || '',
            values: [],
          },
        ],
      };
    });

    if (activeWorkflow !== 'dashboard') {
      onWorkflowSelect('dashboard');
    }
  }, [activeWorkflow, onWorkflowSelect, openDashboard, resolveFilterDimension, setDashboardFilters]);

  const renderDrawerContent = () => {
    if (activeWorkflow === 'data') {
      return (
        <>
          <DrawerHeader
            eyebrow="Workflow"
            title="Data"
            description="Load, preview, clean, and export datasets without leaving the left rail."
            onClose={() => onWorkflowSelect('data')}
          />

          <div className="workflow-stat-row">
            <StatChip label="Rows" value={rowCount} />
            <StatChip label="Columns" value={columnCount} />
            <StatChip label="Status" value={hasDataset ? 'Loaded' : 'Waiting'} />
          </div>

          <div className="workflow-action-grid">
            <button type="button" className="workflow-action-card" onClick={() => {
              setShowDataPreview(true);
              restoreWindow('dataPreview');
            }}>
              <FaTable />
              <span>Data Preview</span>
              <small>Open the preview window for the active dataset.</small>
            </button>

            <button type="button" className="workflow-action-card" onClick={() => {
              setShowRawViewer(true);
              restoreWindow('rawViewer');
            }}>
              <FaDatabase />
              <span>Raw Viewer</span>
              <small>Inspect the full raw dataset in its own window.</small>
            </button>

            <button type="button" className={`workflow-action-card ${showCleaningForm ? 'is-active' : ''}`} onClick={() => setShowCleaningForm((prev) => !prev)}>
              <FaBroom />
              <span>Cleaning Tools</span>
              <small>Show or hide the existing data-cleaning form.</small>
            </button>

            <button type="button" className={`workflow-action-card ${showExportPanel ? 'is-active' : ''}`} onClick={() => setShowExportPanel((prev) => !prev)}>
              <FaFileExport />
              <span>Export</span>
              <small>Reveal export controls for the current workspace.</small>
            </button>
          </div>

          {showCleaningForm ? (
            <div className="workflow-embedded-panel">
              <DataCleaningForm
                setCleanedData={onDataCleaned}
                closeForm={() => setShowCleaningForm(false)}
                onProceedToTraining={() => {
                  setShowMachineLearning(true);
                  restoreWindow('machineLearning');
                }}
              />
            </div>
          ) : null}

          {showExportPanel ? (
            <div className="workflow-embedded-panel workflow-embedded-panel--export">
              <FileExport />
            </div>
          ) : null}
        </>
      );
    }

    if (activeWorkflow === 'explore') {
      return (
        <>
          <DrawerHeader
            eyebrow="Workflow"
            title="Explore"
            description="Browse raw and business fields, then drag them straight into charts, KPIs, and dashboards."
            onClose={() => onWorkflowSelect('explore')}
          />

          <div className="workflow-stat-row">
            <StatChip label="Raw Fields" value={columnCount} />
            <StatChip label="Metrics" value={semanticMetricCount} />
            <StatChip label="Dimensions" value={semanticDimensionCount} />
          </div>

          <div className="workflow-action-grid workflow-action-grid--compact">
            <button type="button" className="workflow-action-card" onClick={() => setOpenDataFilter(true)}>
              <FaFilter />
              <span>Filter Dataset</span>
              <small>Open the existing filter drawer.</small>
            </button>

            <button type="button" className="workflow-action-card" onClick={() => {
              setShowDataPreview(true);
              restoreWindow('dataPreview');
            }}>
              <FaTable />
              <span>Preview Rows</span>
              <small>Keep one-click access to the current data preview.</small>
            </button>
          </div>

          <div className="workflow-fields-shell">
            <FieldsPanel
              cleanedData={datasetRows}
              onCreateSemanticChart={handleCreateSemanticChart}
              onCreateSemanticKpi={handleCreateSemanticKpi}
              onEditSemanticMetric={(metric) => handleOpenSemanticEditor({ metricId: metric?.id })}
              onAddDashboardFilter={handleAddSemanticFilter}
            />
          </div>
        </>
      );
    }

    if (activeWorkflow === 'visualise') {
      return (
        <>
          <DrawerHeader
            eyebrow="Workflow"
            title="Visualise"
            description="Start a chart quickly, then drag fields from Explore onto your chart windows."
            onClose={() => onWorkflowSelect('visualise')}
          />

          <div className="workflow-stat-row">
            <StatChip label="Dataset" value={hasDataset ? 'Ready' : 'Missing'} />
            <StatChip label="Charts" value="Quick add" />
            <StatChip label="Mode" value="Phase 1" />
          </div>

          <div className="workflow-action-grid">
            <button type="button" className="workflow-action-card workflow-action-card--primary" onClick={() => onButtonClick('visualize')}>
              <FaChartBar />
              <span>Chart Gallery</span>
              <small>Open the existing chart selection modal.</small>
            </button>

            <button type="button" className="workflow-action-card" onClick={() => onWorkflowSelect('explore')}>
              <FaColumns />
              <span>Open Field Explorer</span>
              <small>Jump back to drag raw or business fields.</small>
            </button>
          </div>

          <div className="workflow-shortcut-grid">
            {chartShortcuts.map((shortcut) => (
              <button
                key={shortcut.type}
                type="button"
                className="workflow-shortcut"
                onClick={() => handleQuickChart(shortcut.type)}
              >
                <span className="workflow-shortcut__icon">{shortcut.icon}</span>
                <span className="workflow-shortcut__label">{shortcut.type}</span>
              </button>
            ))}
          </div>

          <div className="workflow-phase-note">
            Drag fields from the Explore drawer onto any chart window to keep the existing axis-mapping behavior intact.
          </div>
        </>
      );
    }

    if (activeWorkflow === 'business') {
      return (
        <>
          <DrawerHeader
            eyebrow="Workflow"
            title="Business"
            description="Semantic definitions now drive charts, KPIs, filters, and metric management without removing raw dataset workflows."
            onClose={() => onWorkflowSelect('business')}
          />

          <SemanticModelPanel
            semanticModel={semanticModel}
            status={semanticModelStatus}
            onCreateSemanticChart={handleCreateSemanticChart}
            onCreateKpiCard={handleCreateSemanticKpi}
            onEditSemanticMetric={(metric) => handleOpenSemanticEditor({ metricId: metric?.id })}
            onAddDashboardFilter={handleAddSemanticFilter}
            editorRequest={semanticEditorRequest}
            onEditorClose={handleCloseSemanticEditor}
          />
        </>
      );
    }

    if (activeWorkflow === 'ai') {
      return (
        <>
          <DrawerHeader
            eyebrow="Workflow"
            title="AI"
            description="Keep AI chat, workflow lab, story generation, and reports close to the canvas."
            onClose={() => onWorkflowSelect('ai')}
          />

          <div className="workflow-stat-row">
            <StatChip label="Chat" value="Ready" />
            <StatChip label="Workflow" value={showAiWorkflow ? 'Open' : 'Closed'} />
            <StatChip label="Report" value={aiReportReady ? 'Ready' : 'Waiting'} />
          </div>

          <div className="workflow-action-grid">
            <button type="button" className="workflow-action-card workflow-action-card--primary" onClick={onOpenAiChat}>
              <FaRobot />
              <span>Open AI Chat</span>
              <small>Reveal the assistant panel with current data context.</small>
            </button>

            <button type="button" className="workflow-action-card" onClick={() => {
              setShowAiWorkflow(true);
              restoreWindow('aiWorkflowLab');
            }}>
              <FaPlus />
              <span>Workflow Lab</span>
              <small>Open the existing AI workflow window.</small>
            </button>

            <button type="button" className="workflow-action-card" onClick={() => handleGenerateStory('openai')}>
              <FaBook />
              <span>Story with OpenAI</span>
              <small>Launch the story panel using the OpenAI path.</small>
            </button>

            <button type="button" className="workflow-action-card" onClick={() => handleGenerateStory('gemini')}>
              <FaBook />
              <span>Story with Gemini</span>
              <small>Launch the story panel using the Gemini path.</small>
            </button>

            <button
              type="button"
              className="workflow-action-card"
              onClick={onAiReportClick}
              disabled={!aiReportReady}
            >
              <FaRobot />
              <span>AI Report</span>
              <small>{aiReportReady ? 'Open the completed AI report window.' : 'Enabled when an AI report is available.'}</small>
            </button>
          </div>
        </>
      );
    }

    if (activeWorkflow === 'dashboard') {
      return (
        <>
          <DrawerHeader
            eyebrow="Workflow"
            title="Dashboard"
            description="Open the monitoring canvas, then add KPI cards or dashboard charts from the drawer."
            onClose={() => onWorkflowSelect('dashboard')}
          />

          <div className="workflow-stat-row">
            <StatChip label="Canvas" value={isDashboardVisible ? 'Visible' : 'Hidden'} />
            <StatChip label="KPI" value="Enabled" />
            <StatChip label="Charts" value="Enabled" />
          </div>

          <div className="workflow-action-grid">
            <button type="button" className={`workflow-action-card workflow-action-card--primary ${isDashboardVisible ? 'is-active' : ''}`} onClick={onDashboardToggle}>
              <FaTachometerAlt />
              <span>{isDashboardVisible ? 'Hide Dashboard' : 'Show Dashboard'}</span>
              <small>Toggle the dashboard canvas in the main workspace.</small>
            </button>

            <button type="button" className="workflow-action-card" onClick={() => addDashboardKpi()}>
              <FaPlus />
              <span>Add KPI Card</span>
              <small>Create a dashboard KPI window immediately.</small>
            </button>

            <button type="button" className="workflow-action-card" onClick={() => addDashboardChart({ chartType: 'Bar' })}>
              <FaChartBar />
              <span>Add Dashboard Chart</span>
              <small>Seed the dashboard with a new chart tile.</small>
            </button>

            <button type="button" className="workflow-action-card" onClick={() => setOpenDataFilter(true)}>
              <FaFilter />
              <span>Filter Dataset</span>
              <small>Reuse the existing filter drawer for dashboard context.</small>
            </button>
          </div>
        </>
      );
    }

    if (activeWorkflow === 'whiteboard') {
      return (
        <>
          <DrawerHeader
            eyebrow="Workflow"
            title="Whiteboard"
            description="Keep exploratory canvas tools nearby while the new shell settles in."
            onClose={() => onWorkflowSelect('whiteboard')}
          />

          <div className="workflow-action-grid">
            <button type="button" className="workflow-action-card workflow-action-card--primary" onClick={() => {
              setShowWhiteBoard(true);
              restoreWindow('whiteBoard');
            }}>
              <FaPen />
              <span>Open Whiteboard</span>
              <small>Launch the freeform whiteboard workspace.</small>
            </button>

            <button type="button" className="workflow-action-card" onClick={() => {
              setShowMachineLearning(true);
              restoreWindow('machineLearning');
            }}>
              <FaBrain />
              <span>Machine Learning</span>
              <small>Open the existing machine-learning panel.</small>
            </button>
          </div>
        </>
      );
    }

    return null;
  };

  return (
    <aside className={`workflow-shell ${activeWorkflow ? 'has-drawer' : ''}`}>
      <div className="workflow-rail" aria-label="Workflow navigation">
        {workflowItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`workflow-rail__button ${activeWorkflow === item.id ? 'is-active' : ''}`}
            onClick={() => onWorkflowSelect(item.id)}
            aria-pressed={activeWorkflow === item.id}
            title={item.label}
          >
            <span className="workflow-rail__icon" aria-hidden="true">{item.icon}</span>
            <span className="workflow-rail__label">{item.label}</span>
          </button>
        ))}
      </div>

      {activeWorkflow ? (
        <div className="workflow-drawer">
          <div className="workflow-drawer__content">
            {renderDrawerContent()}
          </div>
        </div>
      ) : null}
    </aside>
  );
}

export default SideBar;
