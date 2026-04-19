import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
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

/**
 * RibbonCommand
 * Simplified for high-density professional UI. 
 * Shows only icon and concise label.
 */
function RibbonCommand({
  icon,
  label,
  description,
  onClick,
  active,
  emphasized,
  disabled,
}) {
  return (
    <button
      type="button"
      className={`ribbon-command ${active ? 'is-active' : ''} ${emphasized ? 'is-emphasized' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={description || label}
    >
      <span className="ribbon-command__icon" aria-hidden="true">{icon}</span>
      <span className="ribbon-command__label">{label}</span>
    </button>
  );
}

function RibbonGroup({ title, children }) {
  return (
    <section className="ribbon-group">
      <div className="ribbon-group__body">{children}</div>
      <div className="ribbon-group__footer">
        <span className="ribbon-group__title">{title}</span>
      </div>
    </section>
  );
}

function MenuBar({
  activeDestination,
  onDestinationSelect,
  onFileUploadSuccess,
  setShowDataPreview,
  setShowRawViewer,
  handleApiData,
  handleDatabaseData,
  setOpenDataFilter,
  aiReportReady,
  onAiReportClick,
  onDashboardToggle,
  isDashboardVisible,
  onOpenAiChat,
  onOpenAiWorkflow,
  onOpenStoryboard,
  onOpenWhiteboard,
  onOpenChartGallery,
  onHeightChange,
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

  const handleReset = useCallback(() => window.location.reload(), []);

  const toggleSurface = useCallback((surfaceId) => {
    setActiveSurface((prev) => (prev === surfaceId ? null : surfaceId));
  }, []);

  useEffect(() => {
    if (!onHeightChange || !barRef.current) return;
    const updateHeight = () => {
      if (barRef.current) onHeightChange(Math.ceil(barRef.current.getBoundingClientRect().height));
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(barRef.current);
    return () => observer.disconnect();
  }, [activeSurface, activeDestination, isRibbonCollapsed, onHeightChange]);

  const renderInlinePanel = () => {
    if (!activeSurface) return null;
    const meta = inlinePanelMeta[activeSurface];
    let content = null;
    if (activeSurface === 'upload') content = <FileUpload onUploadComplete={() => setActiveSurface(null)} onFileUploadSuccess={onFileUploadSuccess} />;
    if (activeSurface === 'hub') content = <DataHubWindow />;
    if (activeSurface === 'api') content = <ApiDataForm handleApiData={handleApiData} />;
    if (activeSurface === 'db') content = <DatabaseConnectForm handleDatabaseData={handleDatabaseData} onClose={() => setActiveSurface(null)} />;
    if (!content || !meta) return null;

    return (
      <div className="ribbon-inline-panel">
        <div className="ribbon-inline-panel__header">
          <h3 className="ribbon-inline-panel__title">{meta.title}</h3>
        </div>
        <div className="ribbon-inline-panel__body">{content}</div>
      </div>
    );
  };

  return (
    <header ref={barRef} className={`menu-bar ${isRibbonCollapsed ? 'is-collapsed' : ''}`}>
      <div className="menu-bar__topline">
        <div className="menu-bar__identity" onClick={() => onDestinationSelect(DESTINATIONS.WORKSPACE)} style={{ cursor: 'pointer' }}>
          <span className="menu-bar__app-dot" />
          <span className="menu-bar__app-name">AI Tool</span>
        </div>
        <div className="menu-bar__context">
          <span className="menu-bar__breadcrumb-sep">/</span>
          <span className="menu-bar__active-dest">
            {Object.entries(DESTINATIONS).find(([_, v]) => v === activeDestination)?.[0].toLowerCase() || 'workspace'}
          </span>
        </div>
        <div className="menu-bar__utility">
          <button type="button" className={`menu-bar__setup-trigger ${!isRibbonCollapsed ? 'is-active' : ''}`} onClick={() => setIsRibbonCollapsed(!isRibbonCollapsed)}>
            <FaCogs /> <span>Commands</span>
          </button>
          <div className="menu-bar__divider" />
          {aiReportReady && <button type="button" className="menu-bar__utility-pill" onClick={onAiReportClick}><FaFileAlt /> Report</button>}
        </div>
      </div>

      {!isRibbonCollapsed && (
        <div className="menu-ribbon">
          <div className="menu-ribbon__groups">
            {/* Contextual Groups */}
            {activeDestination === DESTINATIONS.WORKSPACE && (
              <RibbonGroup title="Workspace">
                <RibbonCommand icon={<TbCloudDataConnection />} label="Catalog" onClick={() => setShowDataPreview(true)} emphasized />
                <RibbonCommand icon={<FaTable />} label="Inspect" onClick={() => setShowRawViewer(true)} />
                <RibbonCommand icon={<FaBroom />} label="Refine" onClick={() => setShowCleaningForm(!showCleaningForm)} active={showCleaningForm} />
                <RibbonCommand icon={<FaFileExport />} label="Export" onClick={() => setShowExportPanel(!showExportPanel)} active={showExportPanel} />
              </RibbonGroup>
            )}
            {activeDestination === DESTINATIONS.EXPLORE && (
              <RibbonGroup title="Explore">
                <RibbonCommand icon={<FaChartBar />} label="Library" onClick={onOpenChartGallery} emphasized />
                <RibbonCommand icon={<FaPen />} label="Board" onClick={onOpenWhiteboard} />
                <div className="ribbon-divider-v" />
                <RibbonCommand icon={<FaPlus />} label="Bar" onClick={() => addChart({ type: 'Bar' })} />
                <RibbonCommand icon={<FaPlus />} label="Line" onClick={() => addChart({ type: 'Line' })} />
              </RibbonGroup>
            )}
            {activeDestination === DESTINATIONS.DASHBOARDS && (
              <RibbonGroup title="Dashboards">
                <RibbonCommand icon={<FaTachometerAlt />} label={isDashboardVisible ? 'Hide' : 'Show'} onClick={onDashboardToggle} active={isDashboardVisible} emphasized />
                <RibbonCommand icon={<FaPlus />} label="KPI" onClick={() => addDashboardKpi()} />
                <RibbonCommand icon={<FaChartBar />} label="Chart" onClick={() => addDashboardChart({ chartType: 'Bar' })} />
                <RibbonCommand icon={<FaFilter />} label="Filters" onClick={() => setOpenDataFilter(true)} />
              </RibbonGroup>
            )}
            {activeDestination === DESTINATIONS.DECISIONS && (
              <RibbonGroup title="Decisions">
                <RibbonCommand 
                  icon={<FaLightbulb />} 
                  label="Analyze" 
                  onClick={onRunDecision} 
                  disabled={!(decisionReadiness?.decision_ready && (decisionReadiness?.missing_requirements?.length || 0) === 0)} 
                  emphasized 
                />
              </RibbonGroup>
            )}
            {activeDestination === DESTINATIONS.AI && (
              <RibbonGroup title="AI Suite">
                <RibbonCommand icon={<FaRobot />} label="Chat" onClick={onOpenAiChat} emphasized />
                <RibbonCommand icon={<FaPlus />} label="Automation" onClick={onOpenAiWorkflow} />
                <RibbonCommand icon={<FaFileAlt />} label="Report" onClick={onAiReportClick} disabled={!aiReportReady} />
                <RibbonCommand icon={<FaBook />} label="Narrative" onClick={onOpenStoryboard} />
              </RibbonGroup>
            )}

            <RibbonGroup title="Sources">
              <RibbonCommand icon={<FaUpload />} label="Upload" onClick={() => toggleSurface('upload')} active={activeSurface === 'upload'} />
              <RibbonCommand icon={<FaServer />} label="API" onClick={() => toggleSurface('api')} active={activeSurface === 'api'} />
              <RibbonCommand icon={<FaDatabase />} label="DB" onClick={() => toggleSurface('db')} active={activeSurface === 'db'} />
            </RibbonGroup>

            <RibbonGroup title="System">
              <RibbonCommand icon={theme === 'dark' ? <FaSun /> : <FaMoon />} label="Theme" onClick={toggleTheme} />
              <RibbonCommand icon={<FaRedoAlt />} label="Reload" onClick={handleReset} />
            </RibbonGroup>
          </div>
          {renderInlinePanel()}
        </div>
      )}
    </header>
  );
}

export default MenuBar;
