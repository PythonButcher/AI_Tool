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
  FaCogs,
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

const DESTINATIONS = {
  WORKSPACE: 'workspace',
  EXPLORE: 'explore',
  DASHBOARDS: 'dashboards',
  DECISIONS: 'decisions',
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

  const renderActiveRibbon = () => {
    return (
      <>
        <RibbonGroup title="Data Sources" caption="Import or connect datasets">
          <RibbonCommand
            icon={<FaUpload />}
            label="Upload File"
            description="Local CSV/JSON"
            onClick={() => toggleSurface('upload')}
            active={activeSurface === 'upload'}
            emphasized
          />
          <RibbonCommand
            icon={<TbCloudDataConnection />}
            label="Data Hub"
            description="Managed catalog"
            onClick={() => toggleSurface('hub')}
            active={activeSurface === 'hub'}
          />
          <RibbonCommand
            icon={<FaServer />}
            label="API"
            description="External endpoint"
            onClick={() => toggleSurface('api')}
            active={activeSurface === 'api'}
          />
          <RibbonCommand
            icon={<FaDatabase />}
            label="Database"
            description="Warehouse table"
            onClick={() => toggleSurface('db')}
            active={activeSurface === 'db'}
          />
        </RibbonGroup>

        <RibbonGroup title="App" caption="Workspace settings">
          <RibbonCommand
            icon={theme === 'dark' ? <FaSun /> : <FaMoon />}
            label={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            onClick={toggleTheme}
          />
          <RibbonCommand
            icon={<FaSnowflake />}
            label="Snow"
            onClick={onSnowToggle}
            active={isSnowing}
            disabled={theme !== 'dark'}
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
            <span>Data & Setup</span>
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
