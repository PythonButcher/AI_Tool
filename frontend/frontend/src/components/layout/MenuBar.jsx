import React, { useContext, useEffect, useRef, useState } from 'react';
import './MenuBar.css';
import FileUpload from '../data_management/FileUpload';
import ApiDataForm from '../../features/api/APiDataForm';
import DatabaseConnectForm from '../../features/database/DatabaseConnectForm';
import DataHubWindow from '../../features/database/DataHubWindow';
import {
  FaBook,
  FaBrain,
  FaBroom,
  FaChartBar,
  FaChevronDown,
  FaChevronUp,
  FaCogs,
  FaDatabase,
  FaFileAlt,
  FaFileExport,
  FaFilter,
  FaLightbulb,
  FaMagic,
  FaMoon,
  FaPen,
  FaPlus,
  FaRedoAlt,
  FaRobot,
  FaServer,
  FaSnowflake,
  FaSun,
  FaTable,
  FaTachometerAlt,
  FaUpload,
} from 'react-icons/fa';
import { TbCloudDataConnection } from 'react-icons/tb';
import { ThemeContext } from '../../context/ThemeContext';

const DESTINATIONS = {
  WORKSPACE: 'workspace',
  EXPLORE: 'explore',
  DASHBOARDS: 'dashboards',
  DECISIONS: 'decisions',
  AI: 'ai',
};

const inlinePanelMeta = {
  upload: {
    eyebrow: 'Data Intake',
    title: 'Upload File',
    badge: 'Import',
  },
  hub: {
    eyebrow: 'Catalog',
    title: 'Open Data Hub',
    badge: 'Managed',
  },
  api: {
    eyebrow: 'External Source',
    title: 'Connect API',
    badge: 'Live',
  },
  db: {
    eyebrow: 'Warehouse',
    title: 'Connect Database',
    badge: 'Secure',
  },
};

function RibbonCommand({
  icon,
  label,
  description,
  onClick,
  active,
  emphasized,
  badge,
  disabled,
  title,
}) {
  return (
    <button
      type="button"
      className={`ribbon-command ${active ? 'is-active' : ''} ${emphasized ? 'is-emphasized' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={title || description}
    >
      <span className="ribbon-command__icon" aria-hidden="true">{icon}</span>
      <span className="ribbon-command__copy">
        <span className="ribbon-command__label-row">
          <span className="ribbon-command__label">{label}</span>
          {badge ? <span className="ribbon-command__badge">{badge}</span> : null}
        </span>
        {description ? <span className="ribbon-command__description">{description}</span> : null}
      </span>
    </button>
  );
}

function RibbonGroup({ title, caption, children }) {
  return (
    <section className="ribbon-group">
      <div className="ribbon-group__body">{children}</div>
      <div className="ribbon-group__footer">
        <span className="ribbon-group__title">{title}</span>
        {caption ? <span className="ribbon-group__caption">{caption}</span> : null}
      </div>
    </section>
  );
}

function MenuBar({
  activeDestination,
  onDestinationSelect,
  onFileUploadSuccess,
  onStatsSelect,
  setShowDataPreview,
  setShowRawViewer,
  handleApiData,
  handleDatabaseData,
  setOpenDataFilter,
  aiReportReady,
  onAiReportClick,
  onSnowToggle,
  isSnowing,
  onDashboardToggle,
  isDashboardVisible,
  onOpenAiChat,
  onOpenAiWorkflow,
  onOpenStoryboard,
  onOpenWhiteboard,
  onOpenChartGallery,
  onHeightChange,
  // New props for consolidated actions
  setShowCleaningForm,
  showCleaningForm,
  setShowExportPanel,
  showExportPanel,
  onRunDecision,
  decisionReadiness,
  addChart,
  addDashboardKpi,
  addDashboardChart,
}) {
  const [activeSurface, setActiveSurface] = useState(null);
  const [isRibbonCollapsed, setIsRibbonCollapsed] = useState(true);
  const { theme, toggleTheme } = useContext(ThemeContext);
  const barRef = useRef(null);

  useEffect(() => {
    if (!onHeightChange || !barRef.current) {
      return undefined;
    }

    const updateHeight = () => {
      if (!barRef.current) return;
      onHeightChange(Math.ceil(barRef.current.getBoundingClientRect().height));
    };

    updateHeight();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateHeight);
      return () => window.removeEventListener('resize', updateHeight);
    }

    const observer = new ResizeObserver(() => updateHeight());
    observer.observe(barRef.current);
    return () => observer.disconnect();
  }, [activeSurface, activeDestination, isRibbonCollapsed, onHeightChange]);

  const handleReset = () => window.location.reload();

  const toggleSurface = (surfaceId) => {
    setActiveSurface((prev) => (prev === surfaceId ? null : surfaceId));
  };

  const renderInlinePanel = () => {
    if (!activeSurface) return null;

    const meta = inlinePanelMeta[activeSurface];
    let content = null;

    if (activeSurface === 'upload') {
      content = (
        <FileUpload
          label="Select a File to Upload:"
          onUploadComplete={() => setActiveSurface(null)}
          onFileUploadSuccess={onFileUploadSuccess}
        />
      );
    }

    if (activeSurface === 'hub') {
      content = <DataHubWindow />;
    }

    if (activeSurface === 'api') {
      content = <ApiDataForm handleApiData={handleApiData} />;
    }

    if (activeSurface === 'db') {
      content = (
        <DatabaseConnectForm
          handleDatabaseData={handleDatabaseData}
          onClose={() => setActiveSurface(null)}
        />
      );
    }

    if (!content || !meta) return null;

    return (
      <div className="ribbon-inline-panel">
        <div className="ribbon-inline-panel__header">
          <div>
            <p className="ribbon-inline-panel__eyebrow">{meta.eyebrow}</p>
            <h3 className="ribbon-inline-panel__title">{meta.title}</h3>
          </div>
          <span className="ribbon-inline-panel__badge">{meta.badge}</span>
        </div>
        <div className="ribbon-inline-panel__body">
          {content}
        </div>
      </div>
    );
  };

  const renderWorkspaceRibbon = () => (
    <RibbonGroup title="Workspace Tools" caption="Data lifecycle management">
      <RibbonCommand
        icon={<TbCloudDataConnection />}
        label="Data Hub"
        description="Dataset catalog"
        onClick={() => {
          setShowDataPreview(true);
        }}
        emphasized
      />
      <RibbonCommand
        icon={<FaTable />}
        label="Raw Inspection"
        description="Spreadsheet view"
        onClick={() => setShowRawViewer(true)}
      />
      <RibbonCommand
        icon={<FaBroom />}
        label="Clean Data"
        description="Data optimization"
        onClick={() => setShowCleaningForm(!showCleaningForm)}
        active={showCleaningForm}
      />
      <RibbonCommand
        icon={<FaFileExport />}
        label="Export"
        description="Download results"
        onClick={() => setShowExportPanel(!showExportPanel)}
        active={showExportPanel}
      />
    </RibbonGroup>
  );

  const renderExploreRibbon = () => (
    <RibbonGroup title="Explore Tools" caption="Analysis & Visualization">
      <RibbonCommand
        icon={<FaChartBar />}
        label="Gallery"
        description="Templates"
        onClick={onOpenChartGallery}
        emphasized
      />
      <RibbonCommand
        icon={<FaPen />}
        label="Sandbox"
        description="Visual whiteboard"
        onClick={onOpenWhiteboard}
      />
      <div className="ribbon-divider-v" />
      <RibbonCommand
        icon={<FaPlus />}
        label="Bar"
        description="Quick chart"
        onClick={() => addChart({ type: 'Bar' })}
      />
      <RibbonCommand
        icon={<FaPlus />}
        label="Line"
        description="Quick chart"
        onClick={() => addChart({ type: 'Line' })}
      />
    </RibbonGroup>
  );

  const renderDashboardRibbon = () => (
    <RibbonGroup title="Dashboard Controls" caption="Monitoring layout">
      <RibbonCommand
        icon={<FaTachometerAlt />}
        label={isDashboardVisible ? 'Hide Canvas' : 'Show Canvas'}
        description="Toggle dashboard"
        onClick={onDashboardToggle}
        active={isDashboardVisible}
        emphasized
      />
      <RibbonCommand
        icon={<FaPlus />}
        label="New KPI"
        description="Metric card"
        onClick={() => addDashboardKpi()}
      />
      <RibbonCommand
        icon={<FaChartBar />}
        label="New Chart"
        description="Data tile"
        onClick={() => addDashboardChart({ chartType: 'Bar' })}
      />
      <RibbonCommand
        icon={<FaFilter />}
        label="Filters"
        description="Global slices"
        onClick={() => setOpenDataFilter(true)}
      />
    </RibbonGroup>
  );

  const renderDecisionRibbon = () => {
    const isReady = decisionReadiness?.decision_ready && (decisionReadiness?.missing_requirements?.length || 0) === 0;
    return (
      <RibbonGroup title="Decision Engine" caption="Signals & Scenarios">
        <RibbonCommand
          icon={<FaLightbulb />}
          label="Run Intelligence"
          description={isReady ? 'Evaluate scenarios' : 'Prerequisites missing'}
          onClick={onRunDecision}
          disabled={!isReady}
          emphasized={isReady}
        />
      </RibbonGroup>
    );
  };

  const renderAiRibbon = () => (
    <RibbonGroup title="AI Suite" caption="Intelligence tools">
      <RibbonCommand
        icon={<FaRobot />}
        label="AI Analysis"
        description="Chat explorer"
        onClick={onOpenAiChat}
        emphasized
      />
      <RibbonCommand
        icon={<FaPlus />}
        label="Workflow Lab"
        description="Automation"
        onClick={onOpenAiWorkflow}
      />
      <RibbonCommand
        icon={<FaFileAlt />}
        label="AI Report"
        description="Latest insights"
        onClick={onAiReportClick}
        disabled={!aiReportReady}
      />
      <RibbonCommand
        icon={<FaBook />}
        label="Story Gen"
        description="Narrative"
        onClick={() => onOpenStoryboard()}
      />
      <RibbonCommand
        icon={<FaPen />}
        label="Whiteboard"
        description="Brainstorming"
        onClick={onOpenWhiteboard}
      />
    </RibbonGroup>
  );

  const renderActiveRibbon = () => {
    return (
      <>
        {/* Contextual Group Based on Destination */}
        {activeDestination === DESTINATIONS.WORKSPACE && renderWorkspaceRibbon()}
        {activeDestination === DESTINATIONS.EXPLORE && renderExploreRibbon()}
        {activeDestination === DESTINATIONS.DASHBOARDS && renderDashboardRibbon()}
        {activeDestination === DESTINATIONS.DECISIONS && renderDecisionRibbon()}
        {activeDestination === DESTINATIONS.AI && renderAiRibbon()}

        <RibbonGroup title="Data Sources" caption="Import datasets">
          <RibbonCommand
            icon={<FaUpload />}
            label="Upload"
            description="Local file"
            onClick={() => toggleSurface('upload')}
            active={activeSurface === 'upload'}
          />
          <RibbonCommand
            icon={<FaServer />}
            label="API"
            description="External"
            onClick={() => toggleSurface('api')}
            active={activeSurface === 'api'}
          />
          <RibbonCommand
            icon={<FaDatabase />}
            label="DB"
            description="Warehouse"
            onClick={() => toggleSurface('db')}
            active={activeSurface === 'db'}
          />
        </RibbonGroup>

        <RibbonGroup title="System" caption="App settings">
          <RibbonCommand
            icon={theme === 'dark' ? <FaSun /> : <FaMoon />}
            label="Theme"
            onClick={toggleTheme}
          />
          <RibbonCommand
            icon={<FaRedoAlt />}
            label="Reload"
            onClick={handleReset}
          />
        </RibbonGroup>
      </>
    );
  };

  const getDestinationLabel = () => {
    const item = Object.entries(DESTINATIONS).find(([key, val]) => val === activeDestination);
    return item ? item[0].charAt(0) + item[0].slice(1).toLowerCase() : 'Workspace';
  };

  return (
    <header ref={barRef} className={`menu-bar ${isRibbonCollapsed ? 'is-collapsed' : ''}`}>
      <div className="menu-bar__topline">
        <div className="menu-bar__identity" onClick={() => onDestinationSelect(DESTINATIONS.WORKSPACE)} style={{ cursor: 'pointer' }}>
          <span className="menu-bar__app-dot" aria-hidden="true" />
          <span className="menu-bar__app-name">AI Tool</span>
        </div>

        <div className="menu-bar__context">
          <span className="menu-bar__breadcrumb-sep">/</span>
          <span className="menu-bar__active-dest">{getDestinationLabel()}</span>
        </div>

        <div className="menu-bar__utility">
          <button 
            type="button" 
            className={`menu-bar__setup-trigger ${!isRibbonCollapsed ? 'is-active' : ''}`}
            onClick={() => setIsRibbonCollapsed((prev) => !prev)}
          >
            <FaCogs />
            <span>Commands</span>
            {isRibbonCollapsed ? <FaChevronDown /> : <FaChevronUp />}
          </button>

          <div className="menu-bar__divider" />

          {aiReportReady && (
            <button type="button" className="menu-bar__utility-pill" onClick={onAiReportClick}>
              <FaFileAlt />
              Report
            </button>
          )}
        </div>
      </div>

      {!isRibbonCollapsed && (
        <div className="menu-ribbon">
          <div className="menu-ribbon__groups">
            {renderActiveRibbon()}
          </div>
          {renderInlinePanel()}
        </div>
      )}
    </header>
  );
}

export default MenuBar;
