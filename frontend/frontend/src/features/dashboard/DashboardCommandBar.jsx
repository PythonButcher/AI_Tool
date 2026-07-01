import React, { useState } from 'react';
import { useWindowContext } from '../../context/WindowContext';
import { FaChartBar, FaCalculator, FaBook, FaTimes, FaFilter } from 'react-icons/fa';
import SemanticMetricEditor from '../semantic/SemanticMetricEditor';
import './DashboardCommandBar.css';

function DashboardCommandBar() {
  const {
    dashboardState,
    updateDashboard,
    addDashboardChart,
    addDashboardKpi,
    toggleSlicerPanel,
  } = useWindowContext();

  const [isSemanticEditorOpen, setIsSemanticEditorOpen] = useState(false);

  // Compute active filters to show as chips
  const activeFilters = dashboardState.filters?.dimensionFilters?.filter(f => f.dimensionId && f.values.length > 0) || [];
  const dateFilter = dashboardState.filters?.dateDimensionId ? dashboardState.filters : null;

  let activeCount = activeFilters.reduce((sum, f) => sum + f.values.length, 0);
  if (dateFilter && (dateFilter.startDate || dateFilter.endDate)) {
    activeCount += 1;
  }

  return (
    <div className="dashboard-command-bar">
      <div className="command-bar__left">
        <input
          className="command-bar__title-input"
          value={dashboardState.name}
          onChange={(event) => updateDashboard({ name: event.target.value })}
          aria-label="Dashboard name"
          placeholder="Dashboard Name"
        />
        <div className="command-bar__chips">
          {dateFilter && (dateFilter.startDate || dateFilter.endDate) && (
            <div className="command-bar__chip">
              Date: {dateFilter.startDate} to {dateFilter.endDate}
            </div>
          )}
          {activeFilters.map(filter => (
            <div key={filter.id} className="command-bar__chip" title={filter.values.join(', ')}>
              {filter.dimensionId}: {filter.values.length > 1 ? `${filter.values[0]} +${filter.values.length - 1}` : filter.values[0]}
            </div>
          ))}
        </div>
      </div>

      <div className="command-bar__right">
        <button 
          type="button" 
          className="command-bar__btn command-bar__btn--primary"
          onClick={toggleSlicerPanel}
        >
          <FaFilter />
          Slicers
          {activeCount > 0 && <span className="command-bar__slicer-count">{activeCount}</span>}
        </button>
        <button 
          type="button" 
          className="command-bar__btn" 
          onClick={() => addDashboardKpi()}
          title="Add Semantic KPI"
        >
          <FaCalculator /> KPI
        </button>
        <button
          type="button"
          className="command-bar__btn"
          onClick={() => addDashboardChart({ dataSourceMode: 'semantic' })}
          title="Add Semantic Chart"
        >
          <FaChartBar /> Chart
        </button>
        <button 
          type="button" 
          className="command-bar__btn" 
          onClick={() => setIsSemanticEditorOpen(true)}
          title="Manage Semantic Metrics"
        >
          <FaBook /> Metrics
        </button>
      </div>

      <SemanticMetricEditor
        isOpen={isSemanticEditorOpen}
        onClose={() => setIsSemanticEditorOpen(false)}
      />
    </div>
  );
}

export default DashboardCommandBar;
