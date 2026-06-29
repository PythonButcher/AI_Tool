import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  countActiveDashboardFilters,
  getDimensionValues,
  getFilterableDimensions,
  getTemporalDimensions,
} from '../../utils/dashboardFilterUtils';
import { normalizeDatasetRows, useActiveDataset, useSemanticModel } from '../../context/DataContext';
import { useWindowContext } from '../../context/WindowContext';
import { normalizeSemanticDimension } from '../../utils/semanticObjectUtils';
import SemanticMetricEditor from '../semantic/SemanticMetricEditor';
import { FaFilter, FaChevronUp, FaChevronDown, FaPlus, FaTrash, FaTimes } from 'react-icons/fa';
import './DashboardFilterBar.css';

const getSelectedValues = (event) => Array.from(event.target.selectedOptions).map((option) => option.value);

function DashboardFilterBar() {
  const activeDataset = useActiveDataset();
  const semanticModel = useSemanticModel();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSemanticEditorOpen, setIsSemanticEditorOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState(null);
  const [isDraftDirty, setIsDraftDirty] = useState(false);
  const previousFilterCountRef = useRef(0);
  const previousDateDimensionRef = useRef('');
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

  const currentDraft = draftFilters || dashboardState.filters;

  useEffect(() => {
    if (!isDraftDirty) {
      setDraftFilters(dashboardState.filters);
    }
  }, [dashboardState.filters, isDraftDirty]);

  useEffect(() => {
    const currentFilterCount = dashboardState.filters.dimensionFilters.length;
    const previousFilterCount = previousFilterCountRef.current;
    const previousDateDimension = previousDateDimensionRef.current;

    if (currentFilterCount > previousFilterCount) {
      setIsExpanded(true);
    }

    if (dashboardState.filters.dateDimensionId && dashboardState.filters.dateDimensionId !== previousDateDimension) {
      setIsExpanded(true);
    }

    previousFilterCountRef.current = currentFilterCount;
    previousDateDimensionRef.current = dashboardState.filters.dateDimensionId;
  }, [dashboardState.filters.dateDimensionId, dashboardState.filters.dimensionFilters.length]);

  const updateDimensionFilter = (filterId, updates) => {
    setDraftFilters((prev) => ({
      ...prev,
      dimensionFilters: prev.dimensionFilters.map((filter) => (
        filter.id === filterId ? { ...filter, ...updates } : filter
      )),
    }));
    setIsDraftDirty(true);
  };

  const addDimensionFilter = () => {
    setDraftFilters((prev) => ({
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
    setIsDraftDirty(true);
  };

  const removeDimensionFilter = (filterId) => {
    const updated = {
      ...currentDraft,
      dimensionFilters: currentDraft.dimensionFilters.filter((filter) => filter.id !== filterId),
    };
    setDraftFilters(updated);
    setDashboardFilters(updated);
    setIsDraftDirty(false);
  };

  const handleApplyFilters = () => {
    if (draftFilters) {
      setDashboardFilters(draftFilters);
      setIsDraftDirty(false);
    }
  };

  const handleClearFilters = () => {
    clearDashboardFilters();
    setIsDraftDirty(false);
  };

  return (
    <section className={`dashboard-filter-bar ${isExpanded ? 'is-expanded' : ''}`}>
      <div className="dashboard-filter-bar__topline">
        <div className="dashboard-filter-bar__title-block">
          <input
            className="dashboard-filter-bar__title-input"
            value={dashboardState.name}
            onChange={(event) => updateDashboard({ name: event.target.value })}
            aria-label="Dashboard name"
          />
          <div className="dashboard-filter-bar__badges">
            <span className="badge-business">Business Monitoring</span>
            {activeFilterCount > 0 && (
                <span className="badge-filters">
                    <FaFilter size={10} /> {activeFilterCount}
                </span>
            )}
          </div>
        </div>

        <div className="dashboard-filter-bar__actions">
          <button type="button" className="dashboard-filter-bar__btn dashboard-filter-bar__btn--primary" onClick={() => addDashboardKpi()}>
            <FaPlus /> Semantic KPI
          </button>
          <button
            type="button"
            className="dashboard-filter-bar__btn dashboard-filter-bar__btn--primary"
            onClick={() => addDashboardChart({ dataSourceMode: 'semantic' })}
          >
            <FaPlus /> Semantic Chart
          </button>
          <button 
            type="button" 
            className={`dashboard-filter-bar__btn dashboard-filter-bar__btn--primary ${isSemanticEditorOpen ? 'active' : ''}`} 
            onClick={() => setIsSemanticEditorOpen(true)}
            title="Manage semantic metrics"
          >
            <FaPlus /> Metrics
          </button>
          <button 
            type="button" 
            className={`dashboard-filter-bar__btn ${isExpanded ? 'active' : ''}`} 
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Collapse Filters' : 'Expand Filters'}
          >
            <FaFilter /> Filters {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
          </button>

          <button type="button" className="dashboard-filter-bar__btn" onClick={handleClearFilters} title="Clear all filters">
            Clear
          </button>
          
          <button 
            type="button" 
            className="dashboard-filter-bar__btn dashboard-filter-bar__btn--primary" 
            onClick={handleApplyFilters} 
            disabled={!isDraftDirty}
            title="Apply Filters"
            style={{ fontWeight: isDraftDirty ? 'bold' : 'normal' }}
          >
            Apply
          </button>
          
          <button type="button" className="dashboard-filter-bar__btn dashboard-filter-bar__btn--close" onClick={closeDashboard} title="Hide Dashboard">
            <FaTimes />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="dashboard-filter-bar__expanded-content">
            <div className="dashboard-filter-bar__filters">
                <div className="filter-group">
                    <label className="dashboard-filter-bar__field">
                    <span>Date Dimension</span>
                    <select
                        value={currentDraft.dateDimensionId}
                        onChange={(event) => {
                            setDraftFilters((prev) => ({
                                ...prev,
                                dateDimensionId: event.target.value,
                            }));
                            setIsDraftDirty(true);
                        }}
                    >
                        <option value="">No date filter</option>
                        {temporalDimensions.map((dimension) => (
                        <option key={dimension.id} value={dimension.id}>
                            {dimension.label}
                        </option>
                        ))}
                    </select>
                    </label>

                    <div className="date-range-inputs">
                        <label className="dashboard-filter-bar__field">
                        <span>Start</span>
                        <input
                            type="date"
                            value={currentDraft.startDate}
                            onChange={(event) => {
                                setDraftFilters((prev) => ({
                                    ...prev,
                                    startDate: event.target.value,
                                }));
                                setIsDraftDirty(true);
                            }}
                            disabled={!currentDraft.dateDimensionId}
                        />
                        </label>

                        <label className="dashboard-filter-bar__field">
                        <span>End</span>
                        <input
                            type="date"
                            value={currentDraft.endDate}
                            onChange={(event) => {
                                setDraftFilters((prev) => ({
                                    ...prev,
                                    endDate: event.target.value,
                                }));
                                setIsDraftDirty(true);
                            }}
                            disabled={!currentDraft.dateDimensionId}
                        />
                        </label>
                    </div>
                </div>

                <div className="dashboard-filter-bar__field dashboard-filter-bar__field--stacked">
                <div className="dashboard-filter-bar__field-header">
                    <span>Dimension Filters</span>
                    <button type="button" className="dashboard-filter-bar__mini-action" onClick={addDimensionFilter}>
                    <FaPlus /> Add filter
                    </button>
                </div>

                {currentDraft.dimensionFilters.length === 0 && (
                    <div className="dashboard-filter-bar__empty">No dimension filters active.</div>
                )}

                <div className="dimension-filters-list">
                    {currentDraft.dimensionFilters.map((filter) => {
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
                            className="multi-select"
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
                            title="Remove filter"
                            >
                            <FaTrash />
                            </button>
                        </div>
                        );
                    })}
                </div>
                </div>
            </div>
        </div>
      )}
      <SemanticMetricEditor
        isOpen={isSemanticEditorOpen}
        onClose={() => setIsSemanticEditorOpen(false)}
        semanticModel={semanticModel}
      />
    </section>
  );
}

export default DashboardFilterBar;
