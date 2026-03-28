import React, { useContext, useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import { AiOutlineBulb, AiOutlineCopy, AiOutlineSearch } from 'react-icons/ai';
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

const humanize = (value) => String(value || '')
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/\b\w/g, (char) => char.toUpperCase());

const extractFormulaColumns = (formula) => {
  const matches = String(formula || '').match(/\[([^\]]+)\]/g) || [];
  return matches.map((match) => match.slice(1, -1).trim()).filter(Boolean);
};

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

const buildNameSuggestions = (formState) => {
  if (formState.definitionKind === 'count_rows') return ['Row Count', 'Total Records'];

  if (formState.definitionKind === 'derived_formula') {
    const columns = extractFormulaColumns(formState.formula);
    if (columns.length >= 2) {
      return [`${humanize(columns[0])} vs ${humanize(columns[1])}`, `${humanize(columns[0])} Delta`];
    }
    return ['Derived Metric'];
  }

  const fieldLabel = humanize(formState.field);
  const prefixMap = {
    sum: 'Total',
    avg: 'Average',
    min: 'Minimum',
    max: 'Maximum',
    count: 'Count of',
    count_distinct: 'Unique',
  };
  const prefix = prefixMap[formState.aggregation] || 'Metric';
  return [
    fieldLabel ? `${prefix} ${fieldLabel}` : 'Business Metric',
    fieldLabel ? `${fieldLabel} (${humanize(formState.aggregation)})` : 'Business Metric',
  ];
};

const buildDescriptionSuggestions = (formState, suggestedName) => {
  if (formState.definitionKind === 'count_rows') {
    return ['Counts the number of rows in the active dataset after dashboard and metric filters are applied.'];
  }

  if (formState.definitionKind === 'derived_formula') {
    const columns = extractFormulaColumns(formState.formula);
    if (columns.length >= 2) {
      return [`Calculates ${suggestedName || 'this metric'} from ${humanize(columns[0])} and ${humanize(columns[1])}.`];
    }
    return ['Calculates a reusable business metric from a custom formula.'];
  }

  const fieldLabel = humanize(formState.field);
  return [
    fieldLabel
      ? `${suggestedName || 'This metric'} aggregates ${fieldLabel} for semantic charts, KPI cards, and dashboards.`
      : 'Reusable semantic metric for charts, KPI cards, and dashboards.',
  ];
};

const buildFormulaSuggestions = (numericColumns = []) => {
  if (numericColumns.length < 2) return [];
  const [first, second, third] = numericColumns;
  const suggestions = [
    { label: `${humanize(first)} - ${humanize(second)}`, value: `[${first}] - [${second}]` },
    { label: `${humanize(first)} / ${humanize(second)}`, value: `[${first}] / [${second}]` },
  ];

  if (third) {
    suggestions.push({ label: `${humanize(first)} + ${humanize(third)}`, value: `[${first}] + [${third}]` });
  }

  return suggestions;
};

function SemanticMetricEditor({
  isOpen,
  onClose,
  semanticModel,
  initialMetricId,
  initialDraft,
  openRequestKey,
}) {
  const { listSemanticMetrics, createSemanticMetric, updateSemanticMetric, deleteSemanticMetric } = useContext(DataContext);
  const activeDataset = useActiveDataset();
  const datasetRows = normalizeDatasetRows(activeDataset);
  const fieldProfiles = useMemo(
    () => (Array.isArray(semanticModel?.field_profiles) ? semanticModel.field_profiles : []),
    [semanticModel]
  );
  const columns = useMemo(() => {
    if (fieldProfiles.length > 0) {
      return fieldProfiles.map((profile) => profile?.name).filter(Boolean);
    }
    if (datasetRows.length > 0 && typeof datasetRows[0] === 'object') {
      return Object.keys(datasetRows[0]);
    }
    return [];
  }, [datasetRows, fieldProfiles]);

  const numericColumns = useMemo(() => {
    const fromProfiles = fieldProfiles
      .filter((profile) => profile?.data_type === 'number' || profile?.semantic_role === 'metric')
      .map((profile) => profile?.name)
      .filter(Boolean);
    return fromProfiles.length > 0 ? fromProfiles : columns.slice(0, 5);
  }, [columns, fieldProfiles]);

  const metrics = useMemo(() => (semanticModel?.metrics || []).map(normalizeSemanticMetric), [semanticModel]);
  const userDefinedMetrics = useMemo(() => metrics.filter((metric) => metric.is_user_defined), [metrics]);
  const inferredMetrics = useMemo(() => metrics.filter((metric) => metric.is_inferred), [metrics]);

  const [selectedMetricId, setSelectedMetricId] = useState('__new__');
  const [formState, setFormState] = useState(() => createEmptyMetricForm(columns));
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [metricSearch, setMetricSearch] = useState('');

  const selectedMetric = useMemo(() => metrics.find((metric) => metric.id === selectedMetricId) || null, [metrics, selectedMetricId]);
  const isViewingExistingMetric = Boolean(selectedMetric);
  const isReadOnlyMetric = Boolean(selectedMetric?.is_inferred);
  const nameSuggestions = buildNameSuggestions(formState);
  const descriptionSuggestions = buildDescriptionSuggestions(formState, nameSuggestions[0]);
  const formulaSuggestions = buildFormulaSuggestions(numericColumns);

  const filteredUserDefinedMetrics = useMemo(() => {
    const query = metricSearch.trim().toLowerCase();
    if (!query) return userDefinedMetrics;
    return userDefinedMetrics.filter((metric) => metric.searchText.includes(query));
  }, [metricSearch, userDefinedMetrics]);

  const filteredInferredMetrics = useMemo(() => {
    const query = metricSearch.trim().toLowerCase();
    if (!query) return inferredMetrics;
    return inferredMetrics.filter((metric) => metric.searchText.includes(query));
  }, [metricSearch, inferredMetrics]);

  useEffect(() => {
    if (!isOpen) return undefined;

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
    if (!isOpen) return;

    setSelectedMetricId(initialMetricId || '__new__');
    setFormState({
      ...createEmptyMetricForm(columns),
      ...(initialDraft || {}),
    });
    setStatusMessage('');
    setErrorMessage('');
    setMetricSearch('');
  }, [columns, initialDraft, initialMetricId, isOpen, openRequestKey]);

  useEffect(() => {
    if (!isOpen) return;
    if (selectedMetricId === '__new__') return;

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
      setMetricSearch('');
    }
  }, [columns, isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleClose = () => {
    if (isSaving) return;
    onClose();
  };

  const handleStartNew = (draft = null) => {
    setSelectedMetricId('__new__');
    setFormState({
      ...createEmptyMetricForm(columns),
      ...(draft || {}),
    });
    setStatusMessage('');
    setErrorMessage('');
  };

  const handleFieldChange = (key, value) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
  };

  const handleDefinitionKindChange = (value) => {
    setFormState((prev) => {
      const nextState = { ...prev, definitionKind: value };
      if (value === 'derived_formula' && !prev.formula && formulaSuggestions[0]) {
        nextState.formula = formulaSuggestions[0].value;
      }
      return nextState;
    });
  };

  const handleFilterChange = (index, key, value) => {
    setFormState((prev) => ({
      ...prev,
      filters: prev.filters.map((filter, filterIndex) => (
        filterIndex === index ? { ...filter, [key]: value } : filter
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

  const duplicateInferredMetric = () => {
    if (!selectedMetric) return;

    handleStartNew({
      ...metricToFormState(selectedMetric, columns),
      name: `${selectedMetric.label} Copy`,
      description: selectedMetric.description
        ? `${selectedMetric.description} (customized copy)`
        : '',
    });
    setStatusMessage(`Started a custom copy of ${selectedMetric.label}.`);
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
      handleStartNew();
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
              Review inferred metrics, maintain custom ones, and keep every semantic chart and KPI on the same resolver-backed definitions.
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
                onClick={() => handleStartNew()}
                disabled={isSaving}
              >
                New metric
              </button>
            </div>

            <label className="semantic-metric-editor__search">
              <AiOutlineSearch />
              <input
                type="text"
                value={metricSearch}
                onChange={(event) => setMetricSearch(event.target.value)}
                placeholder="Search semantic metrics"
              />
            </label>

            <div className="semantic-metric-editor__group">
              <div className="semantic-metric-editor__group-label">
                Custom metrics
                <span>{filteredUserDefinedMetrics.length}</span>
              </div>
              {filteredUserDefinedMetrics.length > 0 ? (
                filteredUserDefinedMetrics.map((metric) => (
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
                    <div className="semantic-metric-editor__metric-item-top">
                      <span className="semantic-metric-editor__metric-label">{metric.label}</span>
                      <span className="semantic-metric-editor__metric-pill semantic-metric-editor__metric-pill--custom">Editable</span>
                    </div>
                    <span className="semantic-metric-editor__metric-meta">{metric.definitionLabel} · {metric.helperLabel}</span>
                  </button>
                ))
              ) : (
                <p className="semantic-metric-editor__empty">No custom metrics yet.</p>
              )}
            </div>

            <div className="semantic-metric-editor__group">
              <div className="semantic-metric-editor__group-label">
                Inferred metrics
                <span>{filteredInferredMetrics.length}</span>
              </div>
              {filteredInferredMetrics.length > 0 ? (
                filteredInferredMetrics.map((metric) => (
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
                    <div className="semantic-metric-editor__metric-item-top">
                      <span className="semantic-metric-editor__metric-label">{metric.label}</span>
                      <span className="semantic-metric-editor__metric-pill semantic-metric-editor__metric-pill--inferred">Read only</span>
                    </div>
                    <span className="semantic-metric-editor__metric-meta">{metric.definitionLabel} · {metric.helperLabel}</span>
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
                    ? 'Inferred metrics stay read-only so the inferred layer remains trustworthy. Create a custom copy when you need to tailor one.'
                    : 'Saved custom metrics appear immediately in semantic charts, KPI cards, dashboard filters, and other business workflows.'}
                </p>
              </div>
              {selectedMetric?.statusLabel ? (
                <span className={`semantic-metric-editor__status-pill semantic-metric-editor__status-pill--${selectedMetric.is_user_defined ? 'user_defined' : 'inferred'}`}>
                  {selectedMetric.statusLabel}
                </span>
              ) : null}
            </div>

            {(statusMessage || errorMessage) && (
              <div className={`semantic-metric-editor__message ${errorMessage ? 'is-error' : 'is-success'}`}>
                {errorMessage || statusMessage}
              </div>
            )}

            {isReadOnlyMetric ? (
              <div className="semantic-metric-editor__read-only-banner">
                <div>
                  <strong>Inferred metric</strong>
                  <span>This definition came from semantic inference and is shown here for inspection.</span>
                </div>
                <button
                  type="button"
                  className="semantic-metric-editor__secondary"
                  onClick={duplicateInferredMetric}
                  disabled={isSaving}
                >
                  <AiOutlineCopy />
                  <span>Duplicate as custom</span>
                </button>
              </div>
            ) : null}

            <form className="semantic-metric-editor__form" onSubmit={handleSubmit}>
              <div className="semantic-metric-editor__section semantic-metric-editor__section--identity">
                <div className="semantic-metric-editor__section-header">
                  <h5>Metric Identity</h5>
                  <span>What business question this metric should answer</span>
                </div>

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
              </div>

              <div className="semantic-metric-editor__section semantic-metric-editor__section--definition">
                <div className="semantic-metric-editor__section-header">
                  <h5>Definition</h5>
                  <span>Choose how the metric is resolved</span>
                </div>

                <label className="semantic-metric-editor__field">
                  <span>Definition type</span>
                  <select
                    value={formState.definitionKind}
                    onChange={(event) => handleDefinitionKindChange(event.target.value)}
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
              </div>

              <div className="semantic-metric-editor__section semantic-metric-editor__section--suggestions">
                <div className="semantic-metric-editor__section-header">
                  <h5><AiOutlineBulb /> Smart suggestions</h5>
                  <span>Local helper prompts based on your selected columns and metric shape</span>
                </div>

                <div className="semantic-metric-editor__suggestion-group">
                  <strong>Name</strong>
                  <div className="semantic-metric-editor__suggestions">
                    {nameSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        className="semantic-metric-editor__suggestion-chip"
                        onClick={() => handleFieldChange('name', suggestion)}
                        disabled={isReadOnlyMetric || isSaving}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="semantic-metric-editor__suggestion-group">
                  <strong>Description</strong>
                  <div className="semantic-metric-editor__suggestions">
                    {descriptionSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        className="semantic-metric-editor__suggestion-chip"
                        onClick={() => handleFieldChange('description', suggestion)}
                        disabled={isReadOnlyMetric || isSaving}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>

                {formState.definitionKind === 'derived_formula' ? (
                  <div className="semantic-metric-editor__suggestion-group">
                    <strong>Formula templates</strong>
                    <div className="semantic-metric-editor__suggestions">
                      {formulaSuggestions.length > 0 ? formulaSuggestions.map((suggestion) => (
                        <button
                          key={suggestion.value}
                          type="button"
                          className="semantic-metric-editor__suggestion-chip"
                          onClick={() => handleFieldChange('formula', suggestion.value)}
                          disabled={isReadOnlyMetric || isSaving}
                        >
                          {suggestion.label}
                        </button>
                      )) : (
                        <span className="semantic-metric-editor__empty">Load at least two numeric columns to unlock formula suggestions.</span>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="semantic-metric-editor__section semantic-metric-editor__section--filters semantic-metric-editor__field--full">
                <div className="semantic-metric-editor__filter-header">
                  <div className="semantic-metric-editor__section-header">
                    <h5>Metric filters</h5>
                    <span>Optional row-level conditions applied before resolver aggregation</span>
                  </div>
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
                Formula metrics use dataset column references like <code>[Revenue] - [Cost]</code>. Saved metrics continue to resolve through the same centralized semantic metric resolver used by semantic charts and KPI cards.
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
  initialMetricId: PropTypes.string,
  initialDraft: PropTypes.object,
  openRequestKey: PropTypes.number,
};

SemanticMetricEditor.defaultProps = {
  isOpen: false,
  semanticModel: null,
  initialMetricId: '__new__',
  initialDraft: null,
  openRequestKey: 0,
};

export default SemanticMetricEditor;
