import React, { useContext } from 'react';
import { 
  FaDatabase, 
  FaChevronRight, 
  FaChevronLeft, 
  FaBrain, 
  FaChartBar, 
  FaTachometerAlt 
} from 'react-icons/fa';
import FieldsPanel from '../insights/FieldsPanel';
import SemanticModelPanel from '../insights/SemanticModelPanel';
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
}) => {
  const { semanticModel, semanticModelStatus } = useContext(DataContext);

  // Determine which panel to show based on destination
  const showSemantic = activeDestination === DESTINATIONS.DASHBOARDS || activeDestination === DESTINATIONS.DECISIONS;
  
  const getHeaderInfo = () => {
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
        </header>

        <div className="data-pane__body">
          {showSemantic ? (
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
          )}
        </div>
      </div>
    </aside>
  );
};

export default DataPane;
