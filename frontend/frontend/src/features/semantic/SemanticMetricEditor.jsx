import React, { useContext, useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import { DataContext, normalizeDatasetRows, useActiveDataset } from '../../context/DataContext';
import { normalizeSemanticMetric } from '../../utils/semanticObjectUtils';
import './SemanticMetricEditor.css';

const AGGREGATION_OPTIONS = [
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'min', label: 'Minimum' },
  { value: 'max', label: 'Maximum' },
  { value: 'count', label: 'Count' },
  { value: 'count_distinct', label: 'Distinct count' },
];

const FORMAT_OPTIONS = [
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Currency' },
  { value: 'percentage', label: 'Percentage' },
];

const FILTER_OPERATOR_OPTIONS = [
  { value: 'eq', label: 'Equals' },
  { value: 'neq', label: 'Not equal' },
  { value: 'gt', label: 'Greater than' },
  { value: 'gte', label: 'Greater than or equal' },
  { value: 'lt', label: 'Less than' },
  { value: 'lte', label: 'Less than or equal' },
  { value: 'contains', label: 'Contains' },
  { value: 'in', label: 'In list' },
  { value: 'not_in', label: 'Not in list' },
  { value: 'is_null', label: 'Is null' },
  { value: 'not_null', label: 'Is not null' },
];

const createEmptyFilter = (columns = []) => ({
  field: columns[0] || '',
  operator: 'eq',
  rawValue: '',
});

const createEmptyMetricForm = (columns = []) => ({
  name: '',
  description: '',
  definitionKind: 'column_aggregation',
  field: columns[0] || '',
  formula: columns.length >= 2 ? `[${columns[0]}] - [${columns[1]}]` : '',
  aggregation: 'sum',
  formatHint: 'number',
  filters: [],
});

const metricToFormState = (metric, columns = []) => ({
  name: metric?.name || metric?.label || '',
  description: metric?.description || '',
  definitionKind: metric?.expression?.type || metric?.definition_kind || 'column_aggregation',
  field: metric?.field || metric?.expression?.column || columns[0] || '',
  formula: metric?.expression?.formula || '',
  aggregation: metric?.default_aggregation || metric?.expression?.aggregation || 'sum',
  formatHint: metric?.format_hint || metric?.format?.hint || 'number',
  filters: (metric?.filters || metric?.expression?.filters || []).map((filter) => ({
    field: filter?.field || columns[0] || '',
    operator: filter?.operator || 'eq',
    rawValue: Array.isArray(filter?.values)
      ? filter.values.join(', ')
      : (filter?.value ?? ''),
  })),
});

const buildPayloadFromForm = (formState) => {
  const filters = (formState.filters || [])
    .filter((filter) => filter.field)
    .map((filter) => {
      const baseFilter = {
        field: filter.field,
        operator: filter.operator,
      };

      if (filter.operator === 'in' || filter.operator === 'not_in') {
        return {
          ...baseFilter,
          values: String(filter.rawValue || '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
        };
      }

      if (filter.operator !== 'is_null' && filter.operator !== 'not_null') {
        return {
          ...baseFilter,
          value: filter.rawValue,
        };
      }

      return baseFilter;
    });

  return {
    name: formState.name,
    description: formState.description,
    definition_kind: formState.definitionKind,
    field: formState.definitionKind === 'column_aggregation' ? formState.field : undefined,
    formula: formState.definitionKind === 'derived_formula' ? formState.formula : undefined,
    aggregation_behavior: formState.aggregation,
    format_hint: formState.formatHint,
    filters,
  };
};

function SemanticMetricEditor({ isOpen, onClose, semanticModel }) {
  const {
    listSemanticMetrics,
    createSemanticMetric,
    updateSemanticMetric,
    deleteSemanticMetric,
  } = useContext(DataContext);
  const activeDataset = useActiveDataset();

  const datasetRows = normalizeDatasetRows(activeDataset);
  const columns = useMemo(() => {
    if (Array.isArray(semanticModel?.field_profiles) && semanticModel.field_profiles.length > 0) {
      return semanticModel.field_profiles
        .map((profile) => profile?.name)
        .filter(Boolean);
    }
    if (datasetRows.length > 0 && typeof datasetRows[0] === 'object') {
      return Object.keys(datasetRows[0]);
    }
    return [];
  }, [datasetRows, semanticModel]);

  const metrics = useMemo(
    () => (semanticModel?.metrics || []).map(normalizeSemanticMetric),
    [semanticModel]
  );
  const userDefinedMetrics = useMemo(
    () => metrics.filter((metric) => metric.is_user_defined),
    [metrics]
  );
  const inferredMetrics = useMemo(
    () => metrics.filter((metric) => metric.is_inferred),
    [metrics]
  );

  const [selectedMetricId, setSelectedMetricId] = useState('__new__');
  const [formState, setFormState] = useState(() => createEmptyMetricForm(columns));
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const selectedMetric = useMemo(
    () => metrics.find((metric) => metric.id === selectedMetricId) || null,
    [metrics, selectedMetricId]
  );
  const isViewingExistingMetric = Boolean(selectedMetric);
  const isReadOnlyMetric = Boolean(selectedMetric?.is_inferred);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    let isMounted = true;
    listSemanticMetrics().catch((error) => {
      if (isMounted) {
        setErrorMessage(error.message || 'Failed to load semantic metrics.');
      }
    });

    return () => {
      isMounted = false;
    };
  }, [isOpen, listSemanticMetrics]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (!selectedMetricId || selectedMetricId === '__new__') {
      setFormState(createEmptyMetricForm(columns));
      return;
    }

    if (selectedMetric) {
      setFormState(metricToFormState(selectedMetric, columns));
    }
  }, [columns, isOpen, selectedMetric, selectedMetricId]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedMetricId('__new__');
      setFormState(createEmptyMetricForm(columns));
      setStatusMessage('');
      setErrorMessage('');
    }
  }, [columns, isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleClose = () => {
    if (isSaving) return;
    onClose();
  };

  const handleStartNew = () => {
    setSelectedMetricId('__new__');
    setFormState(createEmptyMetricForm(columns));
    setStatusMessage('');
    setErrorMessage('');
  };

  const handleFieldChange = (key, value) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
  };

  const handleFilterChange = (index, key, value) => {
    setFormState((prev) => ({
      ...prev,
      filters: prev.filters.map((filter, filterIndex) => (
        filterIndex === index
          ? { ...filter, [key]: value }
          : filter
      )),
    }));
  };

  const addFilter = () => {
    setFormState((prev) => ({
      ...prev,
      filters: [...prev.filters, createEmptyFilter(columns)],
    }));
  };

  const removeFilter = (index) => {
    setFormState((prev) => ({
      ...prev,
      filters: prev.filters.filter((_, filterIndex) => filterIndex !== index),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage('');
    setStatusMessage('');

    try {
      const payload = buildPayloadFromForm(formState);
      if (selectedMetric && selectedMetric.is_user_defined) {
        await updateSemanticMetric(selectedMetric.id, payload);
        setStatusMessage(`Updated ${payload.name}.`);
      } else {
        const createdMetric = await createSemanticMetric(payload);
        setSelectedMetricId(createdMetric?.id || '__new__');
        setStatusMessage(`Created ${payload.name}.`);
      }
    } catch (error) {
      setErrorMessage(error.message || 'Unable to save semantic metric.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedMetric?.is_user_defined) return;

    setIsSaving(true);
    setErrorMessage('');
    setStatusMessage('');

    try {
      await deleteSemanticMetric(selectedMetric.id);
      setSelectedMetricId('__new__');
      setFormState(createEmptyMetricForm(columns));
      setStatusMessage(`Deleted ${selectedMetric.label || selectedMetric.name}.`);
    } catch (error) {
      setErrorMessage(error.message || 'Unable to delete semantic metric.');
    } finally {
      setIsSaving(false);
    }
  };

  const modalContent = (
    <div className="semantic-metric-editor__backdrop" role="presentation" onClick={handleClose}>
      <div
        className="semantic-metric-editor"
        role="dialog"
        aria-modal="true"
        aria-label="Semantic metric editor"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="semantic-metric-editor__header">
          <div>
            <p className="semantic-metric-editor__eyebrow">Semantic Layer</p>
            <h3 className="semantic-metric-editor__title">Metric Definition Editor</h3>
            <p className="semantic-metric-editor__subtitle">
              Browse inferred metrics, then create or maintain reusable business metrics that power charts, KPI cards, dashboards, and AI analysis.
            </p>
          </div>
          <button
            type="button"
            className="semantic-metric-editor__close"
            onClick={handleClose}
            disabled={isSaving}
          >
            Close
          </button>
        </div>

        <div className="semantic-metric-editor__body">
          <aside className="semantic-metric-editor__sidebar">
            <div className="semantic-metric-editor__sidebar-header">
              <h4>Metrics</h4>
              <button
                type="button"
                className="semantic-metric-editor__new-button"
                onClick={handleStartNew}
                disabled={isSaving}
              >
                New metric
              </button>
            </div>

            <div className="semantic-metric-editor__group">
              <div className="semantic-metric-editor__group-label">
                Custom metrics
                <span>{userDefinedMetrics.length}</span>
              </div>
              {userDefinedMetrics.length > 0 ? (
                userDefinedMetrics.map((metric) => (
                  <button
                    key={metric.id}
                    type="button"
                    className={`semantic-metric-editor__metric-item ${selectedMetricId === metric.id ? 'is-active' : ''}`}
                    onClick={() => {
                      setSelectedMetricId(metric.id);
                      setErrorMessage('');
                      setStatusMessage('');
                    }}
                  >
                    <span className="semantic-metric-editor__metric-label">{metric.label}</span>
                    <span className="semantic-metric-editor__metric-meta">Editable</span>
                  </button>
                ))
              ) : (
                <p className="semantic-metric-editor__empty">No custom metrics yet.</p>
              )}
            </div>

            <div className="semantic-metric-editor__group">
              <div className="semantic-metric-editor__group-label">
                Inferred metrics
                <span>{inferredMetrics.length}</span>
              </div>
              {inferredMetrics.length > 0 ? (
                inferredMetrics.map((metric) => (
                  <button
                    key={metric.id}
                    type="button"
                    className={`semantic-metric-editor__metric-item ${selectedMetricId === metric.id ? 'is-active' : ''}`}
                    onClick={() => {
                      setSelectedMetricId(metric.id);
                      setErrorMessage('');
                      setStatusMessage('');
                    }}
                  >
                    <span className="semantic-metric-editor__metric-label">{metric.label}</span>
                    <span className="semantic-metric-editor__metric-meta">Inferred</span>
                  </button>
                ))
              ) : (
                <p className="semantic-metric-editor__empty">No inferred metrics available.</p>
              )}
            </div>
          </aside>

          <section className="semantic-metric-editor__panel">
            <div className="semantic-metric-editor__panel-header">
              <div>
                <h4>{isViewingExistingMetric ? (selectedMetric?.label || selectedMetric?.name) : 'Create a new business metric'}</h4>
                <p>
                  {isReadOnlyMetric
                    ? 'Inferred metrics are shown here for reference and remain read-only.'
                    : 'Save user-defined metrics here and they will immediately appear in the existing semantic chart, KPI, and AI surfaces.'}
                </p>
              </div>
              {selectedMetric?.status && (
                <span className={`semantic-metric-editor__status-pill semantic-metric-editor__status-pill--${selectedMetric.status}`}>
                  {selectedMetric.status === 'user_defined' ? 'Custom' : 'Inferred'}
                </span>
              )}
            </div>

            {(statusMessage || errorMessage) && (
              <div className={`semantic-metric-editor__message ${errorMessage ? 'is-error' : 'is-success'}`}>
                {errorMessage || statusMessage}
              </div>
            )}

            <form className="semantic-metric-editor__form" onSubmit={handleSubmit}>
              <label className="semantic-metric-editor__field">
                <span>Metric name</span>
                <input
                  type="text"
                  value={formState.name}
                  onChange={(event) => handleFieldChange('name', event.target.value)}
                  disabled={isReadOnlyMetric || isSaving}
                  placeholder="Revenue"
                  required
                />
              </label>

              <label className="semantic-metric-editor__field semantic-metric-editor__field--full">
                <span>Description</span>
                <textarea
                  rows={3}
                  value={formState.description}
                  onChange={(event) => handleFieldChange('description', event.target.value)}
                  disabled={isReadOnlyMetric || isSaving}
                  placeholder="Total recognized revenue across the active dataset."
                />
              </label>

              <label className="semantic-metric-editor__field">
                <span>Definition type</span>
                <select
                  value={formState.definitionKind}
                  onChange={(event) => handleFieldChange('definitionKind', event.target.value)}
                  disabled={isReadOnlyMetric || isSaving}
                >
                  <option value="column_aggregation">Column aggregation</option>
                  <option value="derived_formula">Formula</option>
                  <option value="count_rows">Row count</option>
                </select>
              </label>

              <label className="semantic-metric-editor__field">
                <span>Aggregation behavior</span>
                <select
                  value={formState.aggregation}
                  onChange={(event) => handleFieldChange('aggregation', event.target.value)}
                  disabled={isReadOnlyMetric || isSaving || formState.definitionKind === 'count_rows'}
                >
                  {AGGREGATION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              {formState.definitionKind === 'column_aggregation' && (
                <label className="semantic-metric-editor__field semantic-metric-editor__field--full">
                  <span>Source column</span>
                  <select
                    value={formState.field}
                    onChange={(event) => handleFieldChange('field', event.target.value)}
                    disabled={isReadOnlyMetric || isSaving}
                  >
                    {columns.map((column) => (
                      <option key={column} value={column}>{column}</option>
                    ))}
                  </select>
                </label>
              )}

              {formState.definitionKind === 'derived_formula' && (
                <label className="semantic-metric-editor__field semantic-metric-editor__field--full">
                  <span>Formula definition</span>
                  <textarea
                    rows={4}
                    value={formState.formula}
                    onChange={(event) => handleFieldChange('formula', event.target.value)}
                    disabled={isReadOnlyMetric || isSaving}
                    placeholder="[Revenue] - [Cost]"
                  />
                </label>
              )}

              <label className="semantic-metric-editor__field">
                <span>Display format</span>
                <select
                  value={formState.formatHint}
                  onChange={(event) => handleFieldChange('formatHint', event.target.value)}
                  disabled={isReadOnlyMetric || isSaving}
                >
                  {FORMAT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <div className="semantic-metric-editor__field semantic-metric-editor__field--full">
                <div className="semantic-metric-editor__filter-header">
                  <span>Metric filters</span>
                  {!isReadOnlyMetric && (
                    <button
                      type="button"
                      className="semantic-metric-editor__inline-button"
                      onClick={addFilter}
                      disabled={isSaving || columns.length === 0}
                    >
                      Add filter
                    </button>
                  )}
                </div>

                {formState.filters.length > 0 ? (
                  <div className="semantic-metric-editor__filters">
                    {formState.filters.map((filter, index) => (
                      <div className="semantic-metric-editor__filter-row" key={`${filter.field}-${index}`}>
                        <select
                          value={filter.field}
                          onChange={(event) => handleFilterChange(index, 'field', event.target.value)}
                          disabled={isReadOnlyMetric || isSaving}
                        >
                          {columns.map((column) => (
                            <option key={column} value={column}>{column}</option>
                          ))}
                        </select>
                        <select
                          value={filter.operator}
                          onChange={(event) => handleFilterChange(index, 'operator', event.target.value)}
                          disabled={isReadOnlyMetric || isSaving}
                        >
                          {FILTER_OPERATOR_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={filter.rawValue}
                          onChange={(event) => handleFilterChange(index, 'rawValue', event.target.value)}
                          disabled={isReadOnlyMetric || isSaving || filter.operator === 'is_null' || filter.operator === 'not_null'}
                          placeholder={filter.operator === 'in' || filter.operator === 'not_in' ? 'a, b, c' : 'Value'}
                        />
                        {!isReadOnlyMetric && (
                          <button
                            type="button"
                            className="semantic-metric-editor__remove-button"
                            onClick={() => removeFilter(index)}
                            disabled={isSaving}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="semantic-metric-editor__empty">No metric-level filters applied.</p>
                )}
              </div>

              <div className="semantic-metric-editor__footnote">
                Formula metrics use dataset column references like <code>[Revenue] - [Cost]</code>. Saved metrics resolve through the same centralized semantic metric resolver used by semantic charts and KPI cards.
              </div>

              <div className="semantic-metric-editor__actions">
                {!isReadOnlyMetric && (
                  <button type="submit" className="semantic-metric-editor__primary" disabled={isSaving}>
                    {selectedMetric?.is_user_defined ? 'Save changes' : 'Create metric'}
                  </button>
                )}
                {selectedMetric?.is_user_defined && (
                  <button
                    type="button"
                    className="semantic-metric-editor__danger"
                    onClick={handleDelete}
                    disabled={isSaving}
                  >
                    Delete metric
                  </button>
                )}
                <button type="button" className="semantic-metric-editor__secondary" onClick={handleClose} disabled={isSaving}>
                  Done
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
}

SemanticMetricEditor.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  semanticModel: PropTypes.shape({
    metrics: PropTypes.array,
    field_profiles: PropTypes.array,
  }),
};

SemanticMetricEditor.defaultProps = {
  isOpen: false,
  semanticModel: null,
};

export default SemanticMetricEditor;
