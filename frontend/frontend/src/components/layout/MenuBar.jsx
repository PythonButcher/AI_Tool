import React, { useContext, useEffect, useRef, useState } from 'react';
import './MenuBar.css';
import FileUpload from '../data_management/FileUpload';
import ApiDataForm from '../../features/api/APiDataForm';
import DatabaseConnectForm from '../../features/database/DatabaseConnectForm';
import DataHubWindow from '../../features/database/DataHubWindow';
import {
  FaChartBar,
  FaChevronDown,
  FaChevronUp,
  FaDatabase,
  FaFileAlt,
  FaFilter,
  FaMagic,
  FaMoon,
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

const RIBBON_TABS = ['Home', 'Explore', 'Visualise', 'Business', 'AI', 'Dashboard', 'Settings'];

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
}) {
  return (
    <button
      type="button"
      className={`ribbon-command ${active ? 'is-active' : ''} ${emphasized ? 'is-emphasized' : ''}`}
      onClick={onClick}
      disabled={disabled}
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
  activeTab,
  onTabChange,
  activeWorkflow,
  onWorkflowSelect,
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
}) {
  const [activeSurface, setActiveSurface] = useState(null);
  const [isRibbonCollapsed, setIsRibbonCollapsed] = useState(true);
  const { theme, toggleTheme } = useContext(ThemeContext);
  const barRef = useRef(null);

  useEffect(() => {
    setActiveSurface(null);
  }, [activeTab]);

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
  }, [activeSurface, activeTab, isRibbonCollapsed, onHeightChange]);

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

  const renderActiveRibbon = () => {
    if (activeTab === 'Home') {
      return (
        <>
          <RibbonGroup title="Load Data" caption="Bring datasets into the workspace">
            <RibbonCommand
              icon={<FaUpload />}
              label="Upload File"
              description="Import a local dataset"
              onClick={() => toggleSurface('upload')}
              active={activeSurface === 'upload'}
              emphasized
            />
            <RibbonCommand
              icon={<TbCloudDataConnection />}
              label="Open Hub"
              description="Browse managed datasets"
              onClick={() => toggleSurface('hub')}
              active={activeSurface === 'hub'}
            />
            <RibbonCommand
              icon={<FaServer />}
              label="Connect API"
              description="Stream data from an endpoint"
              onClick={() => toggleSurface('api')}
              active={activeSurface === 'api'}
            />
            <RibbonCommand
              icon={<FaDatabase />}
              label="Connect DB"
              description="Query warehouse tables"
              onClick={() => toggleSurface('db')}
              active={activeSurface === 'db'}
            />
          </RibbonGroup>

          <RibbonGroup title="Workspace" caption="Jump into the next workflow">
            <RibbonCommand
              icon={<FaTable />}
              label="Data Workflow"
              description="Open the left drawer for preview, cleaning, and export"
              onClick={() => onWorkflowSelect('data')}
              active={activeWorkflow === 'data'}
            />
            <RibbonCommand
              icon={<FaRedoAlt />}
              label="Reset App"
              description="Reload the current workspace"
              onClick={handleReset}
            />
          </RibbonGroup>
        </>
      );
    }

    if (activeTab === 'Explore') {
      return (
        <>
          <RibbonGroup title="Inspect" caption="Preview and filter the active dataset">
            <RibbonCommand
              icon={<FaTable />}
              label="Open Explore"
              description="Dock the field explorer in the left rail"
              onClick={() => onWorkflowSelect('explore')}
              active={activeWorkflow === 'explore'}
              emphasized
            />
            <RibbonCommand
              icon={<FaTable />}
              label="Data Preview"
              description="Open the preview window"
              onClick={() => setShowDataPreview(true)}
            />
            <RibbonCommand
              icon={<FaTable />}
              label="Raw Viewer"
              description="Open the full raw-data viewer"
              onClick={() => setShowRawViewer(true)}
            />
            <RibbonCommand
              icon={<FaFilter />}
              label="Filter Panel"
              description="Apply dataset filters"
              onClick={() => setOpenDataFilter(true)}
            />
          </RibbonGroup>

          <RibbonGroup title="Quick Stats" caption="Fast summary actions from the current dataset">
            <RibbonCommand
              icon={<FaChartBar />}
              label="Mean"
              description="Average value for a selected field"
              onClick={() => onStatsSelect('mean')}
            />
            <RibbonCommand
              icon={<FaChartBar />}
              label="Median"
              description="Middle value for distribution checks"
              onClick={() => onStatsSelect('median')}
            />
            <RibbonCommand
              icon={<FaChartBar />}
              label="Mode"
              description="Most frequent observed value"
              onClick={() => onStatsSelect('mode')}
            />
          </RibbonGroup>
        </>
      );
    }

    if (activeTab === 'Visualise') {
      return (
        <>
          <RibbonGroup title="Build" caption="Launch chart workflows without leaving the canvas">
            <RibbonCommand
              icon={<FaChartBar />}
              label="Visualise Drawer"
              description="Open chart templates and shortcuts"
              onClick={() => onWorkflowSelect('visualise')}
              active={activeWorkflow === 'visualise'}
              emphasized
            />
            <RibbonCommand
              icon={<FaChartBar />}
              label="Chart Gallery"
              description="Use the existing chart picker"
              onClick={onOpenChartGallery}
            />
          </RibbonGroup>

          <RibbonGroup title="Flow" caption="Move quickly between fields and charts">
            <RibbonCommand
              icon={<FaTable />}
              label="Field Explorer"
              description="Open the Explore drawer to drag fields"
              onClick={() => onWorkflowSelect('explore')}
            />
            <RibbonCommand
              icon={<FaTachometerAlt />}
              label="Dashboard"
              description="Jump into dashboard-focused work"
              onClick={() => onWorkflowSelect('dashboard')}
            />
          </RibbonGroup>
        </>
      );
    }

    if (activeTab === 'Business') {
      return (
        <>
          <RibbonGroup title="Definitions" caption="Phase 1 keeps semantics discoverable in the shell">
            <RibbonCommand
              icon={<FaTable />}
              label="Business Drawer"
              description="Open business definitions and KPI shortcuts"
              onClick={() => onWorkflowSelect('business')}
              active={activeWorkflow === 'business'}
              emphasized
            />
            <RibbonCommand
              icon={<FaTachometerAlt />}
              label={isDashboardVisible ? 'Hide Dashboard' : 'Open Dashboard'}
              description="Toggle the dashboard canvas"
              onClick={onDashboardToggle}
              active={isDashboardVisible}
            />
          </RibbonGroup>

          <RibbonGroup title="Next Up" caption="Deeper semantic workflows are staged for later phases">
            <RibbonCommand
              icon={<FaTable />}
              label="Explore Fields"
              description="Use business fields from the Explore drawer"
              onClick={() => onWorkflowSelect('explore')}
            />
            <RibbonCommand
              icon={<FaFileAlt />}
              label="AI Report"
              description={aiReportReady ? 'Open the latest completed report' : 'Report becomes active when ready'}
              onClick={onAiReportClick}
              disabled={!aiReportReady}
              badge={aiReportReady ? 'Ready' : 'Waiting'}
            />
          </RibbonGroup>
        </>
      );
    }

    if (activeTab === 'AI') {
      return (
        <>
          <RibbonGroup title="Assist" caption="Open AI surfaces without leaving the main workspace">
            <RibbonCommand
              icon={<FaRobot />}
              label="AI Drawer"
              description="Open workflow, story, and report shortcuts"
              onClick={() => onWorkflowSelect('ai')}
              active={activeWorkflow === 'ai'}
              emphasized
            />
            <RibbonCommand
              icon={<FaRobot />}
              label="Open Chat"
              description="Reveal the AI assistant panel"
              onClick={onOpenAiChat}
            />
            <RibbonCommand
              icon={<FaMagic />}
              label="Workflow Lab"
              description="Open the existing AI workflow window"
              onClick={onOpenAiWorkflow}
            />
            <RibbonCommand
              icon={<FaFileAlt />}
              label="Storyboard"
              description="Open the current narrative workflow"
              onClick={onOpenStoryboard}
            />
          </RibbonGroup>

          <RibbonGroup title="Support" caption="Keep supporting tools close at hand">
            <RibbonCommand
              icon={<FaFileAlt />}
              label="AI Report"
              description={aiReportReady ? 'Open the completed report window' : 'Will enable when the report is ready'}
              onClick={onAiReportClick}
              disabled={!aiReportReady}
              badge={aiReportReady ? 'Ready' : 'Soon'}
            />
            <RibbonCommand
              icon={<FaTable />}
              label="Whiteboard"
              description="Jump to the freeform workspace"
              onClick={onOpenWhiteboard}
            />
          </RibbonGroup>
        </>
      );
    }

    if (activeTab === 'Dashboard') {
      return (
        <>
          <RibbonGroup title="Monitoring" caption="Open and manage dashboard-focused work">
            <RibbonCommand
              icon={<FaTachometerAlt />}
              label="Dashboard Drawer"
              description="Open KPI and dashboard actions in the rail"
              onClick={() => onWorkflowSelect('dashboard')}
              active={activeWorkflow === 'dashboard'}
              emphasized
            />
            <RibbonCommand
              icon={<FaTachometerAlt />}
              label={isDashboardVisible ? 'Hide Canvas' : 'Show Canvas'}
              description="Toggle dashboard mode on the workspace"
              onClick={onDashboardToggle}
              active={isDashboardVisible}
            />
          </RibbonGroup>

          <RibbonGroup title="Insight" caption="Use current reporting and chart tools together">
            <RibbonCommand
              icon={<FaFileAlt />}
              label="Open Report"
              description={aiReportReady ? 'Review the latest AI analysis' : 'No AI report ready yet'}
              onClick={onAiReportClick}
              disabled={!aiReportReady}
              badge={aiReportReady ? 'Ready' : 'Waiting'}
            />
            <RibbonCommand
              icon={<FaChartBar />}
              label="Chart Gallery"
              description="Add another chart from the existing picker"
              onClick={onOpenChartGallery}
            />
          </RibbonGroup>
        </>
      );
    }

    return (
      <>
        <RibbonGroup title="Appearance" caption="Keep the new shell consistent across themes">
          <RibbonCommand
            icon={theme === 'dark' ? <FaSun /> : <FaMoon />}
            label={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            description="Toggle the application theme"
            onClick={toggleTheme}
            emphasized
          />
          <RibbonCommand
            icon={<FaSnowflake />}
            label="Snow"
            description={theme === 'dark' ? 'Toggle the winter easter egg' : 'Available in dark mode'}
            onClick={onSnowToggle}
            active={isSnowing}
            disabled={theme !== 'dark'}
          />
        </RibbonGroup>

        <RibbonGroup title="Workspace" caption="Utility actions for the overall app shell">
          <RibbonCommand
            icon={<FaRedoAlt />}
            label="Reset App"
            description="Reload the full application"
            onClick={handleReset}
          />
          <RibbonCommand
            icon={isRibbonCollapsed ? <FaChevronDown /> : <FaChevronUp />}
            label={isRibbonCollapsed ? 'Expand Ribbon' : 'Collapse Ribbon'}
            description="Hide or show ribbon groups"
            onClick={() => setIsRibbonCollapsed((prev) => !prev)}
          />
        </RibbonGroup>
      </>
    );
  };

  return (
    <header ref={barRef} className={`menu-bar ${isRibbonCollapsed ? 'is-collapsed' : ''}`}>
      <div className="menu-bar__topline">
        <div className="menu-bar__identity" aria-label="Application shell">
          <span className="menu-bar__app-dot" aria-hidden="true" />
          <span className="menu-bar__app-name">AI Tool</span>
        </div>

        <nav className="menu-tab-strip" aria-label="Primary ribbon tabs">
          {RIBBON_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`menu-tab ${activeTab === tab ? 'is-active' : ''}`}
              onClick={() => onTabChange(tab)}
            >
              {tab}
            </button>
          ))}
        </nav>

        <div className="menu-bar__utility">
          {activeWorkflow ? (
            <span className="menu-bar__workflow-chip">
              {activeWorkflow}
            </span>
          ) : null}

          {aiReportReady ? (
            <button type="button" className="menu-bar__utility-pill" onClick={onAiReportClick}>
              <FaFileAlt />
              Report
            </button>
          ) : null}

          <button
            type="button"
            className="menu-bar__collapse-toggle"
            onClick={() => setIsRibbonCollapsed((prev) => !prev)}
            aria-label={isRibbonCollapsed ? 'Expand ribbon' : 'Collapse ribbon'}
          >
            {isRibbonCollapsed ? <FaChevronDown /> : <FaChevronUp />}
          </button>
        </div>
      </div>

      {!isRibbonCollapsed ? (
        <div className="menu-ribbon">
          <div className="menu-ribbon__groups">
            {renderActiveRibbon()}
          </div>
          {renderInlinePanel()}
        </div>
      ) : null}
    </header>
  );
}

export default MenuBar;
