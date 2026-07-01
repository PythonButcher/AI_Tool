import React, { useEffect, useMemo, useState } from 'react';
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
import { FaPlus, FaTimes, FaSearch, FaChevronDown } from 'react-icons/fa';
import './DashboardSlicerPanel.css';

const CustomDropdown = ({ value, onChange, options, placeholder, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedLabel = options.find(opt => opt.value === value)?.label || placeholder;

  // Close when clicking outside can be added via blur or just handled simply with a transparent overlay
  return (
    <div className={`custom-dropdown ${isOpen ? 'is-open' : ''} ${className}`}>
      {isOpen && (
        <div 
          style={{position: 'fixed', inset: 0, zIndex: 45}} 
          onClick={() => setIsOpen(false)}
        />
      )}
      <button 
        type="button" 
        className="custom-dropdown__trigger" 
        onClick={() => setIsOpen(!isOpen)}
        style={{ zIndex: 46, position: 'relative' }}
      >
        <span>{selectedLabel}</span>
        <FaChevronDown size={12} />
      </button>
      <div className="custom-dropdown__menu">
        {options.map(opt => (
          <div 
            key={opt.value} 
            className="custom-dropdown__item"
            onClick={() => {
              onChange(opt.value);
              setIsOpen(false);
            }}
          >
            {opt.label}
          </div>
        ))}
      </div>
    </div>
  );
};

const SearchableDropdown = ({ value, onChange, options, placeholder, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(searchTerm.toLowerCase()) && opt.value !== ''
  );

  return (
    <div className={`custom-dropdown searchable-dropdown ${isOpen ? 'is-open' : ''} ${className}`}>
      {isOpen && (
        <div 
          style={{position: 'fixed', inset: 0, zIndex: 45}} 
          onClick={() => {
            setIsOpen(false);
            setSearchTerm('');
          }}
        />
      )}
      <div 
        className="custom-dropdown__trigger"
        onClick={() => setIsOpen(true)}
        style={{ zIndex: 46, position: 'relative', cursor: 'text' }}
      >
        <FaSearch size={12} style={{ opacity: 0.5, marginRight: '8px' }} />
        <input 
          type="text"
          className="searchable-dropdown__input"
          placeholder={placeholder}
          value={isOpen ? searchTerm : ''}
          onChange={(e) => setSearchTerm(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onFocus={() => setIsOpen(true)}
        />
      </div>
      {isOpen && (
        <div className="custom-dropdown__menu">
          {filteredOptions.length === 0 ? (
            <div className="custom-dropdown__item" style={{ opacity: 0.5, cursor: 'default' }}>No matches</div>
          ) : (
            filteredOptions.map(opt => (
              <div 
                key={opt.value} 
                className="custom-dropdown__item"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                  setSearchTerm('');
                }}
              >
                {opt.label}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

function DashboardSlicerPanel() {
  const activeDataset = useActiveDataset();
  const semanticModel = useSemanticModel();
  const [isSemanticEditorOpen, setIsSemanticEditorOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState(null);
  const [isDraftDirty, setIsDraftDirty] = useState(false);
  
  const {
    dashboardState,
    setDashboardFilters,
    clearDashboardFilters,
    isSlicerPanelOpen,
    toggleSlicerPanel,
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

  const currentDraft = draftFilters || dashboardState.filters;

  useEffect(() => {
    if (!isDraftDirty) {
      setDraftFilters(dashboardState.filters);
    }
  }, [dashboardState.filters, isDraftDirty]);

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
    setIsDraftDirty(true);
  };

  const handleApplyFilters = () => {
    if (draftFilters) {
      setDashboardFilters(draftFilters);
      setIsDraftDirty(false);
    }
  };

  const handleCancelFilters = () => {
    setDraftFilters(dashboardState.filters);
    setIsDraftDirty(false);
  };

  const handleClearFilters = () => {
    clearDashboardFilters();
    setIsDraftDirty(false);
  };

  const activeFilterCount = countActiveDashboardFilters(currentDraft);

  return (
    <aside className={`dashboard-slicer-panel ${isSlicerPanelOpen ? 'is-open' : 'is-closed'}`}>
      <div className="slicer-panel__header">
        <div className="slicer-panel__title-row">
          <span className="slicer-panel__title">Dashboard Slicers</span>
          <button 
            type="button" 
            className="slicer-panel__close-btn" 
            onClick={toggleSlicerPanel} 
            title="Close Slicers"
          >
            <FaTimes />
          </button>
        </div>
        {isDraftDirty && (
          <div className="slicer-panel__draft-warning">
            Unsaved draft changes
          </div>
        )}
      </div>

      <div className="slicer-panel__content">
        <div className="slicer-section">
          <div className="slicer-section__header">
            <span className="slicer-section__title">Date Slicer</span>
          </div>
          <div className="slicer-card">
            <CustomDropdown
              value={currentDraft.dateDimensionId}
              placeholder="No date filter"
              options={[
                { value: '', label: 'No date filter' },
                ...temporalDimensions.map(d => ({ value: d.id, label: d.label }))
              ]}
              onChange={(value) => {
                setDraftFilters((prev) => ({
                  ...prev,
                  dateDimensionId: value,
                  startDate: '',
                  endDate: ''
                }));
                setIsDraftDirty(true);
              }}
            />
            
            {currentDraft.dateDimensionId && (
              <div className="date-slicer-grid">
                <div className="date-input-group">
                  <span>Start Date</span>
                  <input
                    type="date"
                    value={currentDraft.startDate || ''}
                    onChange={(event) => {
                      setDraftFilters((prev) => ({ ...prev, startDate: event.target.value }));
                      setIsDraftDirty(true);
                    }}
                  />
                </div>
                <div className="date-input-group">
                  <span>End Date</span>
                  <input
                    type="date"
                    value={currentDraft.endDate || ''}
                    onChange={(event) => {
                      setDraftFilters((prev) => ({ ...prev, endDate: event.target.value }));
                      setIsDraftDirty(true);
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="slicer-section">
          <div className="slicer-section__header">
            <span className="slicer-section__title">Dimension Slicers</span>
          </div>
          
          {currentDraft.dimensionFilters.map((filter) => {
            const availableValues = getDimensionValues(rows, semanticModel, filter.dimensionId);
            
            return (
              <div key={filter.id} className="slicer-card">
                <div className="slicer-card__header">
                  <CustomDropdown
                    value={filter.dimensionId}
                    placeholder="Select dimension..."
                    options={[
                      { value: '', label: 'Select dimension...' },
                      ...filterableDimensions.map(d => ({ value: d.id, label: d.label }))
                    ]}
                    onChange={(value) => updateDimensionFilter(filter.id, {
                      dimensionId: value,
                      values: [],
                    })}
                  />
                  <button
                    type="button"
                    className="slicer-card__remove"
                    onClick={() => removeDimensionFilter(filter.id)}
                    title="Remove slicer"
                  >
                    <FaTimes />
                  </button>
                </div>

                {filter.dimensionId && (
                  <>
                    <SearchableDropdown
                      value=""
                      placeholder="Search to add filter value..."
                      options={[
                        ...availableValues
                          .filter(v => !filter.values.includes(v.value))
                          .map(v => ({ value: v.value, label: v.label }))
                      ]}
                      onChange={(value) => {
                        if (value && !filter.values.includes(value)) {
                          updateDimensionFilter(filter.id, { values: [...filter.values, value] });
                        }
                      }}
                    />

                    {filter.values.length > 0 && (
                      <div className="slicer-card__values-container">
                        {filter.values.map(val => (
                          <div key={val} className="slicer-chip">
                            {val}
                            <div 
                              className="slicer-chip__remove" 
                              onClick={() => {
                                updateDimensionFilter(filter.id, {
                                  values: filter.values.filter(v => v !== val)
                                });
                              }}
                            >
                              <FaTimes size={10} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}

          <button type="button" className="slicer-panel__add-btn" onClick={addDimensionFilter}>
            <FaPlus /> Add Dimension Slicer
          </button>
        </div>
      </div>

      <div className="slicer-panel__footer">
        {isDraftDirty && (
          <button 
            type="button" 
            className="slicer-panel__cancel-btn"
            onClick={handleCancelFilters}
          >
            Cancel
          </button>
        )}
        <button 
          type="button" 
          className="slicer-panel__apply-btn"
          disabled={!isDraftDirty}
          onClick={handleApplyFilters}
        >
          {isDraftDirty ? 'Apply Changes' : 'Applied'}
        </button>
        {activeFilterCount > 0 && (
          <button 
            type="button" 
            className="slicer-panel__clear-btn"
            onClick={handleClearFilters}
          >
            Clear All Slicers
          </button>
        )}
      </div>

      <SemanticMetricEditor
        isOpen={isSemanticEditorOpen}
        onClose={() => setIsSemanticEditorOpen(false)}
        semanticModel={semanticModel}
      />
    </aside>
  );
}

export default DashboardSlicerPanel;
