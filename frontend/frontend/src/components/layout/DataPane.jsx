import React, { useContext, useState } from 'react';
import { 
  FaDatabase, 
  FaChevronRight, 
  FaChevronLeft, 
  FaBrain, 
  FaChartBar, 
  FaTachometerAlt,
  FaPlus,
  FaServer,
  FaCloudUploadAlt,
  FaBoxOpen
} from 'react-icons/fa';
import FieldsPanel from '../insights/FieldsPanel';
import SemanticModelPanel from '../insights/SemanticModelPanel';
import FileUpload from '../data_management/FileUpload';
import ApiDataForm from '../../features/api/APiDataForm';
import DatabaseConnectForm from '../../features/database/DatabaseConnectForm';
import DataHubWindow from '../../features/database/DataHubWindow';
import { DataContext } from '../../context/DataContext';
import './DataPane.css';

const DESTINATIONS = {
  WORKSPACE: 'workspace',
  EXPLORE: 'explore',
  DASHBOARDS: 'dashboards',
  DECISIONS: 'decisions',
  AI: 'ai',
};

const DataPane = ({ 
  activeDestination,
  cleanedData,
  onCreateSemanticChart,
  onCreateSemanticKpi,
  onEditSemanticMetric,
  onAddDashboardFilter,
  isCollapsed,
  setIsCollapsed,
  onFileUploadSuccess,
  handleApiData,
  handleDatabaseData,
  activeTab = 'catalog',
  setActiveTab,
}) => {
  const { semanticModel, semanticModelStatus } = useContext(DataContext);
  const [activeSource, setActiveSource] = useState(null); // 'upload', 'api', 'db', 'hub'

  // Determine which panel to show based on destination
  const showSemantic = activeDestination === DESTINATIONS.DASHBOARDS || activeDestination === DESTINATIONS.DECISIONS;
  
  const getHeaderInfo = () => {
    if (activeTab === 'sources') {
      return { title: 'Data Ingestion', icon: <FaPlus />, eyebrow: 'Connect' };
    }
    switch (activeDestination) {
      case DESTINATIONS.DASHBOARDS:
        return { title: 'Definitions', icon: <FaTachometerAlt />, eyebrow: 'Dashboard Seeds' };
      case DESTINATIONS.DECISIONS:
        return { title: 'Semantic Layer', icon: <FaBrain />, eyebrow: 'Business Logic' };
      case DESTINATIONS.EXPLORE:
        return { title: 'Field Catalog', icon: <FaChartBar />, eyebrow: 'Exploration' };
      default:
        return { title: 'Data Fields', icon: <FaDatabase />, eyebrow: 'Workspace' };
    }
  };

  const header = getHeaderInfo();

  const renderSourceContent = () => {
    if (!activeSource) {
      return (
        <div className="sources-grid">
          <button className="source-card" onClick={() => setActiveSource('upload')}>
            <FaCloudUploadAlt className="source-card__icon" />
            <div className="source-card__info">
              <h4>Local File</h4>
              <p>CSV, Excel, JSON, PDF</p>
            </div>
          </button>
          <button className="source-card" onClick={() => setActiveSource('api')}>
            <FaServer className="source-card__icon" />
            <div className="source-card__info">
              <h4>Remote API</h4>
              <p>REST JSON endpoints</p>
            </div>
          </button>
          <button className="source-card" onClick={() => setActiveSource('db')}>
            <FaDatabase className="source-card__icon" />
            <div className="source-card__info">
              <h4>SQL Warehouse</h4>
              <p>PostgreSQL, MySQL</p>
            </div>
          </button>
          <button className="source-card" onClick={() => setActiveSource('hub')}>
            <FaBoxOpen className="source-card__icon" />
            <div className="source-card__info">
              <h4>Data Hub</h4>
              <p>Managed datasets</p>
            </div>
          </button>
        </div>
      );
    }

    return (
      <div className="source-active-view">
        <button className="source-back-btn" onClick={() => setActiveSource(null)}>
          <FaChevronLeft /> Back to Sources
        </button>
        <div className="source-component-wrapper">
          {activeSource === 'upload' && (
            <FileUpload 
              onUploadComplete={() => {setActiveSource(null); setActiveTab('catalog');}} 
              onFileUploadSuccess={onFileUploadSuccess} 
            />
          )}
          {activeSource === 'api' && (
            <ApiDataForm 
              handleApiData={(data) => { handleApiData(data); setActiveSource(null); setActiveTab('catalog'); }} 
              onClose={() => setActiveSource(null)} 
            />
          )}
          {activeSource === 'db' && (
            <DatabaseConnectForm 
              handleDatabaseData={(data) => { handleDatabaseData(data); setActiveSource(null); setActiveTab('catalog'); }} 
              onClose={() => setActiveSource(null)} 
            />
          )}
          {activeSource === 'hub' && (
            <DataHubWindow />
          )}
        </div>
      </div>
    );
  };

  return (
    <aside className={`data-pane ${isCollapsed ? 'is-collapsed' : ''} ${showSemantic ? 'data-pane--semantic' : ''}`}>
      <button 
        className="data-pane__toggle"
        onClick={() => setIsCollapsed(!isCollapsed)}
        title={isCollapsed ? "Expand Data Pane" : "Collapse Data Pane"}
      >
        {isCollapsed ? <FaChevronLeft /> : <FaChevronRight />}
      </button>

      <div className="data-pane__content">
        <header className="data-pane__header">
          <div className="data-pane__title-group">
            <span className="data-pane__eyebrow">{header.eyebrow}</span>
            <div className="data-pane__title">
              {React.cloneElement(header.icon, { className: "data-pane__icon" })}
              <h2>{header.title}</h2>
            </div>
          </div>
          
          <div className="data-pane__tabs">
            <button 
              className={`data-pane__tab ${activeTab === 'catalog' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('catalog')}
            >
              Catalog
            </button>
            <button 
              className={`data-pane__tab ${activeTab === 'sources' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('sources')}
            >
              Connect
            </button>
          </div>
        </header>

        <div className="data-pane__body">
          {activeTab === 'catalog' ? (
            showSemantic ? (
              <SemanticModelPanel 
                semanticModel={semanticModel}
                status={semanticModelStatus}
                onCreateSemanticChart={onCreateSemanticChart}
                onCreateKpiCard={onCreateSemanticKpi}
                onEditSemanticMetric={onEditSemanticMetric}
                onAddDashboardFilter={onAddDashboardFilter}
              />
            ) : (
              <FieldsPanel 
                activeDestination={activeDestination}
                cleanedData={cleanedData}
                onCreateSemanticChart={onCreateSemanticChart}
                onCreateSemanticKpi={onCreateSemanticKpi}
                onEditSemanticMetric={onEditSemanticMetric}
                onAddDashboardFilter={onAddDashboardFilter}
              />
            )
          ) : (
            renderSourceContent()
          )}
        </div>
      </div>
    </aside>
  );
};

export default DataPane;
