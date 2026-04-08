import React, { useState } from 'react';
import { FaDatabase, FaChevronRight, FaChevronLeft, FaSearch } from 'react-icons/fa';
import FieldsPanel from '../insights/FieldsPanel';
import './DataPane.css';

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
  return (
    <aside className={`data-pane ${isCollapsed ? 'is-collapsed' : ''}`}>
      <button 
        className="data-pane__toggle"
        onClick={() => setIsCollapsed(!isCollapsed)}
        title={isCollapsed ? "Expand Data Pane" : "Collapse Data Pane"}
      >
        {isCollapsed ? <FaChevronLeft /> : <FaChevronRight />}
      </button>

      <div className="data-pane__content">
        <header className="data-pane__header">
          <div className="data-pane__title">
            <FaDatabase className="data-pane__icon" />
            <h2>Data</h2>
          </div>
        </header>

        <div className="data-pane__body">
          <FieldsPanel 
            activeDestination={activeDestination}
            cleanedData={cleanedData}
            onCreateSemanticChart={onCreateSemanticChart}
            onCreateSemanticKpi={onCreateSemanticKpi}
            onEditSemanticMetric={onEditSemanticMetric}
            onAddDashboardFilter={onAddDashboardFilter}
          />
        </div>
      </div>
    </aside>
  );
};

export default DataPane;
