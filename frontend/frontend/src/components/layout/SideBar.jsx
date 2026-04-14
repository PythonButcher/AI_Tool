import React, { useCallback, useContext, useMemo, useState } from 'react';
import {
  FaBook,
  FaBrain,
  FaBriefcase,
  FaBroom,
  FaChartBar,
  FaColumns,
  FaDatabase,
  FaFileAlt,
  FaFileExport,
  FaFilter,
  FaLightbulb,
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

const DESTINATIONS = {
  WORKSPACE: 'workspace',
  EXPLORE: 'explore',
  DASHBOARDS: 'dashboards',
  DECISIONS: 'decisions',
  AI: 'ai',
};

const navigationItems = [
  { id: DESTINATIONS.WORKSPACE, label: 'Workspace', icon: <FaDatabase /> },
  { id: DESTINATIONS.EXPLORE, label: 'Explore', icon: <FaChartBar /> },
  { id: DESTINATIONS.DASHBOARDS, label: 'Dashboards', icon: <FaTachometerAlt /> },
  { id: DESTINATIONS.DECISIONS, label: 'Decisions', icon: <FaBrain /> },
  { id: DESTINATIONS.AI, label: 'AI', icon: <FaRobot /> },
];

const chartShortcuts = [
  { type: 'Bar', icon: <FaChartBar />, description: 'Compare categories' },
  { type: 'Line', icon: <FaChartBar />, description: 'Trends over time' },
  { type: 'Pie', icon: <FaChartBar />, description: 'Part-to-whole' },
  { type: 'Doughnut', icon: <FaChartBar />, description: 'Radial distribution' },
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
  activeDestination,
  onDestinationSelect,
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
  setShowDataVisual,
  onStoryModelChange,
  setShowMachineLearning,
  onRunDecision,
  decisionReadiness,
}) {
  const [activeDrawer, setActiveDrawer] = useState(null);
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

  const handleNavClick = (id) => {
    onDestinationSelect(id);
    if (activeDrawer === id) {
      setActiveDrawer(null);
    } else {
      setActiveDrawer(id);
    }
  };

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
      alert("No data available. Please load a dataset first.");
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
    onDestinationSelect(DESTINATIONS.DASHBOARDS);
  }, [addDashboardKpi, onDestinationSelect]);

  const handleOpenSemanticEditor = useCallback((options = {}) => {
    setSemanticEditorRequest((prev) => ({
      isOpen: true,
      initialMetricId: options.metricId || '__new__',
      initialDraft: options.initialDraft || null,
      requestKey: prev.requestKey + 1,
    }));
    setActiveDrawer(DESTINATIONS.DECISIONS);
  }, []);

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

    onDestinationSelect(DESTINATIONS.DASHBOARDS);
  }, [onDestinationSelect, openDashboard, resolveFilterDimension, setDashboardFilters]);

  const renderDrawerContent = () => {
    if (activeDrawer === DESTINATIONS.WORKSPACE) {
      return (
        <>
          <DrawerHeader
            eyebrow="Destination"
            title="Workspace"
            description="Manage your data lifecycle from intake to inspection."
            onClose={() => setActiveDrawer(null)}
          />

          <div className="workflow-stat-row">
            <StatChip label="Rows" value={rowCount} />
            <StatChip label="Columns" value={columnCount} />
            <StatChip label="Status" value={hasDataset ? 'Ready' : 'Setup'} />
          </div>

          <div className="workflow-action-grid">
            <button type="button" className="workflow-action-card workflow-action-card--primary" onClick={() => {
              setShowDataPreview(true);
              restoreWindow('dataPreview');
            }}>
              <FaDatabase />
              <span>Data Hub</span>
              <small>Browse and manage your active datasets.</small>
            </button>

            <button type="button" className="workflow-action-card" onClick={() => {
              setShowRawViewer(true);
              restoreWindow('rawViewer');
            }}>
              <FaTable />
              <span>Raw Inspection</span>
              <small>Full spreadsheet-style view of all rows.</small>
            </button>

            <button type="button" className={`workflow-action-card ${showCleaningForm ? 'is-active' : ''}`} onClick={() => setShowCleaningForm((prev) => !prev)}>
              <FaBroom />
              <span>Clean Data</span>
              <small>Launch the cleaning engine tools.</small>
            </button>

            <button type="button" className={`workflow-action-card ${showExportPanel ? 'is-active' : ''}`} onClick={() => setShowExportPanel((prev) => !prev)}>
              <FaFileExport />
              <span>Export</span>
              <small>Save or download current results.</small>
            </button>
          </div>

          {showCleaningForm && (
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
          )}

          {showExportPanel && (
            <div className="workflow-embedded-panel workflow-embedded-panel--export">
              <FileExport />
            </div>
          )}
        </>
      );
    }

    if (activeDrawer === DESTINATIONS.EXPLORE) {
      return (
        <>
          <DrawerHeader
            eyebrow="Destination"
            title="Explore"
            description="Manual data exploration, field analysis, and chart gallery."
            onClose={() => setActiveDrawer(null)}
          />

          <div className="workflow-action-grid">
            <button type="button" className="workflow-action-card workflow-action-card--primary" onClick={() => {
              setShowDataVisual(true);
              onDestinationSelect(DESTINATIONS.EXPLORE);
            }}>
              <FaChartBar />
              <span>Chart Gallery</span>
              <small>Select from existing templates.</small>
            </button>
            <button type="button" className="workflow-action-card" onClick={() => {
              setShowWhiteBoard(true);
              restoreWindow('whiteBoard');
            }}>
              <FaPen />
              <span>Visual Sandbox</span>
              <small>Free-form whiteboard for exploration.</small>
            </button>
          </div>

          <p className="workflow-drawer__eyebrow" style={{ marginTop: '24px' }}>Quick Charts</p>
          <div className="workflow-shortcut-grid">
            {chartShortcuts.map((shortcut) => (
              <button
                key={shortcut.type}
                type="button"
                className="workflow-shortcut"
                onClick={() => handleQuickChart(shortcut.type)}
              >
                <span className="workflow-shortcut__icon">{shortcut.icon}</span>
                <div className="workflow-shortcut__copy">
                  <span className="workflow-shortcut__label">{shortcut.type}</span>
                  <span className="workflow-shortcut__description">{shortcut.description}</span>
                </div>
              </button>
            ))}
          </div>
        </>
      );
    }

    if (activeDrawer === DESTINATIONS.AI) {
      return (
        <>
          <DrawerHeader
            eyebrow="Destination"
            title="AI Suite"
            description="Intelligent assistance, automated reporting, and conversational analysis."
            onClose={() => setActiveDrawer(null)}
          />

          <div className="workflow-action-grid">
            <button type="button" className="workflow-action-card workflow-action-card--primary" onClick={onOpenAiChat}>
              <FaRobot />
              <span>AI Analysis</span>
              <small>Conversational data exploration.</small>
            </button>

            <button type="button" className="workflow-action-card" onClick={() => {
              setShowAiWorkflow(true);
              restoreWindow('aiWorkflowLab');
            }}>
              <FaPlus />
              <span>Workflow Lab</span>
              <small>Automated analysis pipelines.</small>
            </button>

            <button
              type="button"
              className="workflow-action-card"
              onClick={onAiReportClick}
              disabled={!aiReportReady}
            >
              <FaFileAlt />
              <span>AI Report</span>
              <small>{aiReportReady ? 'View latest intelligence.' : 'Run analysis to generate.'}</small>
            </button>

            <button type="button" className="workflow-action-card" onClick={() => handleGenerateStory('openai')}>
              <FaBook />
              <span>Story Gen</span>
              <small>Narrative from data insights.</small>
            </button>

            <button type="button" className="workflow-action-card" onClick={() => {
              setShowWhiteBoard(true);
              restoreWindow('whiteBoard');
            }}>
              <FaPen />
              <span>Whiteboard</span>
              <small>AI-assisted brainstorming.</small>
            </button>
          </div>
        </>
      );
    }

    if (activeDrawer === DESTINATIONS.DASHBOARDS) {
      return (
        <>
          <DrawerHeader
            eyebrow="Destination"
            title="Dashboards"
            description="High-level monitoring, KPI tracking, and dashboard layout control."
            onClose={() => setActiveDrawer(null)}
          />

          <div className="workflow-action-grid">
            <button type="button" className={`workflow-action-card workflow-action-card--primary ${isDashboardVisible ? 'is-active' : ''}`} onClick={onDashboardToggle}>
              <FaTachometerAlt />
              <span>{isDashboardVisible ? 'Hide Canvas' : 'Show Canvas'}</span>
              <small>Toggle the global monitoring dashboard.</small>
            </button>

            <button type="button" className="workflow-action-card" onClick={() => addDashboardKpi()}>
              <FaPlus />
              <span>New KPI</span>
              <small>Add a new metric monitoring card.</small>
            </button>

            <button type="button" className="workflow-action-card" onClick={() => addDashboardChart({ chartType: 'Bar' })}>
              <FaChartBar />
              <span>New Chart</span>
              <small>Add a data tile to the dashboard.</small>
            </button>

            <button type="button" className="workflow-action-card" onClick={() => setOpenDataFilter(true)}>
              <FaFilter />
              <span>Filters</span>
              <small>Manage dashboard-wide date and dimension filters.</small>
            </button>
          </div>
        </>
      );
    }

    /**
     * DECISIONS DRAWER
     * 
     * Redesigned for Phase 4 to be a 'Requirement Checklist' surface.
     * It explains the engine's logic and provides real-time feedback on readiness.
     */
    if (activeDrawer === DESTINATIONS.DECISIONS) {
      const missingRequirements = decisionReadiness?.missing_requirements || [];
      const isReady = decisionReadiness?.decision_ready && missingRequirements.length === 0;

      return (
        <>
          <DrawerHeader
            eyebrow="Destination"
            title="Decisions"
            description="Intelligent signals, automated recommendations, and outcome projections."
            onClose={() => setActiveDrawer(null)}
          />

          <div className="workflow-action-grid">
            {/* 
                Primary Action: Run Intelligence.
                Disabled until prerequisites are met, with contextual help text.
            */}
            <button
              type="button"
              className={`workflow-action-card ${isReady ? 'workflow-action-card--primary' : ''}`}
              onClick={onRunDecision}
              disabled={!isReady}
            >
              <FaLightbulb />
              <span>Run Intelligence</span>
              <small>{!isReady ? 'Satisfy requirements below.' : 'Evaluate scenarios and signals.'}</small>
            </button>
          </div>

          <div className="workflow-drawer__guidance">
            <h4 className="guidance-title">Status Checklist</h4>
            <ul className="guidance-list">
              {/* Dynamic checklist classes (is-ready / is-missing) provide visual reinforcement */}
              <li className={missingRequirements.includes('dataset') ? 'is-missing' : 'is-ready'}>
                <strong>Data Context:</strong> 
                {missingRequirements.includes('dataset') ? 'Connect a source.' : 'Connected.'}
              </li>
              <li className={missingRequirements.includes('semantic_model') ? 'is-missing' : 'is-ready'}>
                <strong>Semantic Logic:</strong> 
                {missingRequirements.includes('semantic_model') ? 'Define field meanings.' : 'Model Active.'}
              </li>
              <li className={missingRequirements.includes('metrics') ? 'is-missing' : 'is-ready'}>
                <strong>Business Goals:</strong> 
                {missingRequirements.includes('metrics') ? 'Define KPI metrics.' : 'Metrics Ready.'}
              </li>
            </ul>
            
            <div className="workflow-drawer__info-box">
              <h5 className="info-title">How it works</h5>
              <p className="workflow-drawer__copy">
                The engine evaluates recent anomalies against your defined metrics, 
                detects cross-field trends, and ranks recommendations based on statistical importance.
              </p>
            </div>
          </div>

          <p className="workflow-drawer__copy" style={{ marginTop: '24px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Manage your metrics and field definitions in the right-side <strong>Definitions</strong> pane.
          </p>
        </>
      );
    }


    return null;
  };

  return (
    <aside className={`workflow-shell ${activeDrawer ? 'has-drawer' : ''}`}>
      <div className="workflow-rail" aria-label="Global navigation">
        <div className="workflow-rail__top">
          {navigationItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`workflow-rail__button ${activeDestination === item.id ? 'is-active' : ''}`}
              onClick={() => handleNavClick(item.id)}
              aria-pressed={activeDestination === item.id}
              title={item.label}
            >
              <span className="workflow-rail__icon" aria-hidden="true">{item.icon}</span>
              <span className="workflow-rail__label">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {activeDrawer ? (
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
