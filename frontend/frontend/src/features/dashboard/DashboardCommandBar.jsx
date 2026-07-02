import React, { useState } from 'react';
import { useWindowContext } from '../../context/WindowContext';
import { FaChartBar, FaCalculator, FaBook, FaFilter, FaEdit, FaEye, FaShareAlt } from 'react-icons/fa';
import SemanticMetricEditor from '../semantic/SemanticMetricEditor';
import DashboardShareSkeleton from './DashboardShareSkeleton';
import './DashboardCommandBar.css';

function DashboardCommandBar() {
  const {
    dashboardState,
    updateDashboard,
    addDashboardChart,
    addDashboardKpi,
    toggleSlicerPanel,
    setDashboardMode,
  } = useWindowContext();

  const [isSemanticEditorOpen, setIsSemanticEditorOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const isEditMode = dashboardState.mode === 'edit';

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
        <div className="command-bar__mode-toggle">
          <button
            className={`command-bar__btn command-bar__btn--toggle ${isEditMode ? 'is-active' : ''}`}
            onClick={() => setDashboardMode('edit')}
            title="Edit Layout"
          >
            <FaEdit /> Edit
          </button>
          <button
            className={`command-bar__btn command-bar__btn--toggle ${!isEditMode ? 'is-active' : ''}`}
            onClick={() => setDashboardMode('view')}
            title="View Dashboard"
          >
            <FaEye /> View
          </button>
        </div>

        <div className="command-bar__divider" />

        <button
          type="button"
          className="command-bar__btn"
          onClick={() => setIsShareModalOpen(true)}
          title="Share Dashboard Draft"
        >
          <FaShareAlt /> Share
        </button>

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
          disabled={!isEditMode}
        >
          <FaCalculator /> KPI
        </button>
        <button
          type="button"
          className="command-bar__btn"
          onClick={() => addDashboardChart({ dataSourceMode: 'semantic' })}
          title="Add Semantic Chart"
          disabled={!isEditMode}
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
      <DashboardShareSkeleton
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
      />
    </div>
  );
}

export default DashboardCommandBar;
