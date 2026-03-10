import React, { useMemo } from 'react';
import {
  countActiveDashboardFilters,
  getDimensionValues,
  getFilterableDimensions,
  getTemporalDimensions,
} from '../../utils/dashboardFilterUtils';
import { normalizeDatasetRows, useActiveDataset, useSemanticModel } from '../../context/DataContext';
import { useWindowContext } from '../../context/WindowContext';
import { normalizeSemanticDimension } from '../../utils/semanticObjectUtils';
import './DashboardFilterBar.css';

const getSelectedValues = (event) => Array.from(event.target.selectedOptions).map((option) => option.value);

function DashboardFilterBar() {
  const activeDataset = useActiveDataset();
  const semanticModel = useSemanticModel();
  const {
    dashboardState,
    setDashboardFilters,
    clearDashboardFilters,
    addDashboardChart,
    addDashboardKpi,
    closeDashboard,
    updateDashboard,
  } = useWindowContext();

  const rows = useMemo(() => normalizeDatasetRows(activeDataset), [activeDataset]);
  const temporalDimensions = useMemo(
    () => getTemporalDimensions(semanticModel).map(normalizeSemanticDimension),
    [semanticModel]
  );
  const filterableDimensions = useMemo(
    () => getFilterableDimensions(semanticModel).map(normalizeSemanticDimension),
    [semanticModel]
  );

  const activeFilterCount = countActiveDashboardFilters(dashboardState.filters);

  const updateDimensionFilter = (filterId, updates) => {
    setDashboardFilters((prev) => ({
      ...prev,
      dimensionFilters: prev.dimensionFilters.map((filter) => (
        filter.id === filterId ? { ...filter, ...updates } : filter
      )),
    }));
  };

  const addDimensionFilter = () => {
    setDashboardFilters((prev) => ({
      ...prev,
      dimensionFilters: [
        ...prev.dimensionFilters,
        {
          id: `dashboard-filter-${Date.now()}`,
          dimensionId: '',
          values: [],
        },
      ],
    }));
  };

  const removeDimensionFilter = (filterId) => {
    setDashboardFilters((prev) => ({
      ...prev,
      dimensionFilters: prev.dimensionFilters.filter((filter) => filter.id !== filterId),
    }));
  };

  return (
    <section className="dashboard-filter-bar">
      <div className="dashboard-filter-bar__topline">
        <div className="dashboard-filter-bar__title-block">
          <span className="dashboard-filter-bar__eyebrow">Business Monitoring</span>
          <input
            className="dashboard-filter-bar__title-input"
            value={dashboardState.name}
            onChange={(event) => updateDashboard({ name: event.target.value })}
            aria-label="Dashboard name"
          />
          <span className="dashboard-filter-bar__meta">
            {activeFilterCount > 0 ? `${activeFilterCount} global filters active` : 'No global filters'}
            {' '}
            · Saved locally
          </span>
        </div>

        <div className="dashboard-filter-bar__actions">
          <button type="button" className="dashboard-filter-bar__action dashboard-filter-bar__action--primary" onClick={() => addDashboardKpi()}>
            Add KPI card
          </button>
          <button
            type="button"
            className="dashboard-filter-bar__action"
            onClick={() => addDashboardChart({ dataSourceMode: 'semantic' })}
          >
            Add chart
          </button>
          <button type="button" className="dashboard-filter-bar__action" onClick={clearDashboardFilters}>
            Clear filters
          </button>
          <button type="button" className="dashboard-filter-bar__action dashboard-filter-bar__action--ghost" onClick={closeDashboard}>
            Hide dashboard
          </button>
        </div>
      </div>

      <div className="dashboard-filter-bar__filters">
        <label className="dashboard-filter-bar__field dashboard-filter-bar__field--date-dimension">
          <span>Date dimension</span>
          <select
            value={dashboardState.filters.dateDimensionId}
            onChange={(event) => setDashboardFilters((prev) => ({
              ...prev,
              dateDimensionId: event.target.value,
            }))}
          >
            <option value="">No date filter</option>
            {temporalDimensions.map((dimension) => (
              <option key={dimension.id} value={dimension.id}>
                {dimension.label}
              </option>
            ))}
          </select>
        </label>

        <label className="dashboard-filter-bar__field">
          <span>Start date</span>
          <input
            type="date"
            value={dashboardState.filters.startDate}
            onChange={(event) => setDashboardFilters((prev) => ({
              ...prev,
              startDate: event.target.value,
            }))}
            disabled={!dashboardState.filters.dateDimensionId}
          />
        </label>

        <label className="dashboard-filter-bar__field">
          <span>End date</span>
          <input
            type="date"
            value={dashboardState.filters.endDate}
            onChange={(event) => setDashboardFilters((prev) => ({
              ...prev,
              endDate: event.target.value,
            }))}
            disabled={!dashboardState.filters.dateDimensionId}
          />
        </label>

        <div className="dashboard-filter-bar__field dashboard-filter-bar__field--stacked">
          <div className="dashboard-filter-bar__field-header">
            <span>Dimension filters</span>
            <button type="button" className="dashboard-filter-bar__mini-action" onClick={addDimensionFilter}>
              + Add filter
            </button>
          </div>

          {dashboardState.filters.dimensionFilters.length === 0 && (
            <div className="dashboard-filter-bar__empty">No dimension filters yet.</div>
          )}

          {dashboardState.filters.dimensionFilters.map((filter) => {
            const availableValues = getDimensionValues(rows, semanticModel, filter.dimensionId);

            return (
              <div key={filter.id} className="dashboard-filter-bar__dimension-row">
                <select
                  value={filter.dimensionId}
                  onChange={(event) => updateDimensionFilter(filter.id, {
                    dimensionId: event.target.value,
                    values: [],
                  })}
                >
                  <option value="">Select dimension</option>
                  {filterableDimensions.map((dimension) => (
                    <option key={dimension.id} value={dimension.id}>
                      {dimension.label}
                    </option>
                  ))}
                </select>

                <select
                  multiple
                  value={filter.values}
                  onChange={(event) => updateDimensionFilter(filter.id, {
                    values: getSelectedValues(event),
                  })}
                  disabled={!filter.dimensionId}
                >
                  {availableValues.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  className="dashboard-filter-bar__mini-action dashboard-filter-bar__mini-action--danger"
                  onClick={() => removeDimensionFilter(filter.id)}
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default DashboardFilterBar;
