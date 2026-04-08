import React, { useCallback, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { DragOverlay, useDndContext, useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  AiOutlineCalendar,
  AiOutlineEdit,
  AiOutlineFilter,
  AiOutlineFundProjectionScreen,
  AiOutlineLineChart,
  AiOutlineNumber,
  AiOutlinePlusSquare,
  AiOutlineSearch,
  AiOutlineTag,
} from 'react-icons/ai';
import { useActiveDataset, useSemanticModel } from '../../context/DataContext';
import {
  normalizeSemanticDimension,
  normalizeSemanticMetric,
  toSemanticDragData,
} from '../../utils/semanticObjectUtils';
import './FieldsPanel.css';

const ANALYSIS_GROUP_META = {
  measures: {
    label: 'Measures',
    icon: <AiOutlineNumber />,
    description: 'Numeric columns and business metrics',
  },
  dimensions: {
    label: 'Dimensions',
    icon: <AiOutlineTag />,
    description: 'Categorical columns and business groupings',
  },
  time: {
    label: 'Time',
    icon: <AiOutlineCalendar />,
    description: 'Date and time columns',
  },
};

const UNIFIED_GROUP_ORDER = ['measures', 'dimensions', 'time'];

const inferFieldType = (value) => {
  if (value === null || value === undefined) return 'categorical';

  if (typeof value === 'number') {
    return Number.isNaN(value) ? 'categorical' : 'numeric';
  }

  if (value instanceof Date) {
    return 'temporal';
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return 'categorical';

    const numericCandidate = Number(trimmed);
    if (!Number.isNaN(numericCandidate)) {
      return 'numeric';
    }

    const temporalCandidate = Date.parse(trimmed);
    if (!Number.isNaN(temporalCandidate)) {
      return 'temporal';
    }
  }

  return 'categorical';
};

const formatSampleValue = (value) => {
  if (value === undefined || value === null) return '—';

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value).slice(0, 42);
    } catch {
      return '[object]';
    }
  }

  return String(value).slice(0, 42);
};

const buildSemanticTitle = (item) => {
  const parts = [item.description];
  if (item.field) parts.push(`Backed by field: ${item.field}`);
  return parts.filter(Boolean).join('\n');
};

const buildSemanticSubtitle = (item, fallbackLabel) => {
  if (item.description) return item.description;
  if (item.field) return `Backed by ${item.field}`;
  return fallbackLabel;
};

const stopActionEvent = (event) => {
  event.preventDefault();
  event.stopPropagation();
};

const FieldActionButton = ({ icon, label, onClick, disabled, title, tone }) => (
  <button
    type="button"
    className={`field-action-button ${tone ? `field-action-button--${tone}` : ''}`}
    onPointerDown={stopActionEvent}
    onMouseDown={stopActionEvent}
    onClick={(event) => {
      stopActionEvent(event);
      if (!disabled) {
        onClick();
      }
    }}
    disabled={disabled}
    title={title || label}
  >
    <span aria-hidden="true">{icon}</span>
    <span>{label}</span>
  </button>
);

FieldActionButton.propTypes = {
  icon: PropTypes.node.isRequired,
  label: PropTypes.string.isRequired,
  onClick: PropTypes.func,
  disabled: PropTypes.bool,
  title: PropTypes.string,
  tone: PropTypes.oneOf(['metric', 'dimension', 'neutral']),
};

FieldActionButton.defaultProps = {
  onClick: null,
  disabled: false,
  title: '',
  tone: 'neutral',
};

const SemanticQuickActions = ({
  item,
  defaultMetricId,
  onCreateSemanticChart,
  onCreateSemanticKpi,
  onEditSemanticMetric,
  onAddDashboardFilter,
}) => {
  const canChart = typeof onCreateSemanticChart === 'function';
  const canKpi = typeof onCreateSemanticKpi === 'function' && item.objectKind === 'metric';
  const canEdit = typeof onEditSemanticMetric === 'function' && item.objectKind === 'metric';
  const canFilter = typeof onAddDashboardFilter === 'function';

  if (!canChart && !canKpi && !canEdit && !canFilter) {
    return null;
  }

  return (
    <div className="field-row-actions">
      {canChart && (
        <FieldActionButton
          icon={<AiOutlineLineChart />}
          label="Chart"
          tone={item.objectKind === 'metric' ? 'metric' : 'dimension'}
          onClick={() => onCreateSemanticChart(
            item.objectKind === 'metric'
              ? { metricId: item.id }
              : { metricId: defaultMetricId || '', groupBy: item.id }
          )}
          title={item.objectKind === 'metric'
            ? `Create a semantic chart for ${item.label}`
            : `Create a chart grouped by ${item.label}`}
        />
      )}
      {canKpi && (
        <FieldActionButton
          icon={<AiOutlinePlusSquare />}
          label="KPI"
          tone="metric"
          onClick={() => onCreateSemanticKpi({ metricId: item.id })}
          title={`Create a KPI card for ${item.label}`}
        />
      )}
      {canFilter && (
        <FieldActionButton
          icon={<AiOutlineFilter />}
          label="Filter"
          tone="neutral"
          onClick={() => onAddDashboardFilter(item)}
          title={`Add ${item.label} to dashboard filters`}
        />
      )}
      {canEdit && (
        <FieldActionButton
          icon={<AiOutlineEdit />}
          label={item.is_user_defined ? 'Edit' : 'View'}
          tone="neutral"
          onClick={() => onEditSemanticMetric(item)}
          title={item.is_user_defined
            ? `Edit the custom metric ${item.label}`
            : `Open the inferred metric ${item.label} in the editor`}
        />
      )}
    </div>
  );
};

SemanticQuickActions.propTypes = {
  item: PropTypes.shape({
    id: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    objectKind: PropTypes.oneOf(['metric', 'dimension']).isRequired,
    is_user_defined: PropTypes.bool,
  }).isRequired,
  defaultMetricId: PropTypes.string,
  onCreateSemanticChart: PropTypes.func,
  onCreateSemanticKpi: PropTypes.func,
  onEditSemanticMetric: PropTypes.func,
  onAddDashboardFilter: PropTypes.func,
};

SemanticQuickActions.defaultProps = {
  defaultMetricId: '',
  onCreateSemanticChart: null,
  onCreateSemanticKpi: null,
  onEditSemanticMetric: null,
  onAddDashboardFilter: null,
};

const AnalysisRowContent = ({ item, actions }) => (
  <>
    <span className={`field-type-marker ${item.type}`} aria-hidden="true" />
    <div className="field-row-main">
      <div className="field-row-heading">
        <span className="field-row-label">
          {item.label}
          {item.source === 'semantic' && (
            <span className="intelligent-badge" title="Powered by Field Intelligence">
              ★
            </span>
          )}
        </span>
      </div>
      {item.subtitle ? <span className="field-row-subtitle">{item.subtitle}</span> : null}
      {item.description && item.description !== item.subtitle ? (
        <span className="field-row-description">{item.description}</span>
      ) : null}
    </div>
    <div className="field-row-trailing">
      <div className="field-row-meta">
        <span className={`field-row-pill field-row-pill--source field-row-pill--${item.source}`}>
          {item.sourceLabel}
        </span>
        <span className="field-row-pill">{item.helperLabel}</span>
        {item.statusLabel ? (
          <span className={`field-row-pill field-row-pill--status field-row-pill--${item.is_user_defined ? 'custom' : 'inferred'}`}>
            {item.statusLabel}
          </span>
        ) : null}
        {item.backingLabel ? (
          <span className="field-row-pill field-row-pill--field">{item.backingLabel}</span>
        ) : null}
      </div>
      {actions}
    </div>
  </>
);

AnalysisRowContent.propTypes = {
  item: PropTypes.shape({
    label: PropTypes.string.isRequired,
    subtitle: PropTypes.string,
    description: PropTypes.string,
    type: PropTypes.oneOf(['numeric', 'categorical', 'temporal']).isRequired,
    source: PropTypes.oneOf(['raw', 'semantic']).isRequired,
    sourceLabel: PropTypes.string.isRequired,
    helperLabel: PropTypes.string.isRequired,
    statusLabel: PropTypes.string,
    is_user_defined: PropTypes.bool,
    backingLabel: PropTypes.string,
  }).isRequired,
  actions: PropTypes.node,
};

AnalysisRowContent.defaultProps = {
  actions: null,
};

const DraggableAnalysisItem = React.memo(({
  item,
  actions,
}) => {
  const dragData = item.dragType === 'semantic-object'
    ? toSemanticDragData(item)
    : {
      type: 'field',
      field: item.name,
      fieldType: item.type,
      metadata: item,
    };

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.dragId,
    data: dragData,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`field-row field-row--${item.source} ${isDragging ? 'is-dragging' : ''}`}
      title={item.title}
      {...listeners}
      {...attributes}
    >
      <AnalysisRowContent item={item} actions={actions} />
    </div>
  );
});

DraggableAnalysisItem.displayName = 'DraggableAnalysisItem';

DraggableAnalysisItem.propTypes = {
  item: PropTypes.shape({
    dragId: PropTypes.string.isRequired,
    dragType: PropTypes.oneOf(['field', 'semantic-object']).isRequired,
    name: PropTypes.string,
    label: PropTypes.string.isRequired,
    subtitle: PropTypes.string,
    description: PropTypes.string,
    type: PropTypes.oneOf(['numeric', 'categorical', 'temporal']).isRequired,
    source: PropTypes.oneOf(['raw', 'semantic']).isRequired,
    sourceLabel: PropTypes.string.isRequired,
    helperLabel: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
  }).isRequired,
  actions: PropTypes.node,
};

DraggableAnalysisItem.defaultProps = {
  actions: null,
};

const DESTINATIONS = {
  WORKSPACE: 'workspace',
  EXPLORE: 'explore',
  DASHBOARDS: 'dashboards',
  DECISIONS: 'decisions',
  AI: 'ai',
};

function FieldsPanel({
  activeDestination,
  cleanedData,
  onCreateSemanticChart,
  onCreateSemanticKpi,
  onEditSemanticMetric,
  onAddDashboardFilter,
}) {
  const activeDataset = useActiveDataset();
  const semanticModel = useSemanticModel();
  const { active } = useDndContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState({
    measures: false,
    dimensions: false,
    time: false,
  });

  const dataset = useMemo(() => {
    if (Array.isArray(cleanedData) && cleanedData.length > 0) return cleanedData;
    if (Array.isArray(activeDataset) && activeDataset.length > 0) return activeDataset;
    return [];
  }, [activeDataset, cleanedData]);

  const rawFields = useMemo(() => {
    if (!dataset.length) return [];

    const referenceRow = dataset[0] || {};

    return Object.keys(referenceRow).map((name) => {
      const rawValue = referenceRow[name];
      const type = inferFieldType(rawValue);
      const sample = formatSampleValue(rawValue);

      return {
        dragId: `field:${name}`,
        dragType: 'field',
        name,
        label: name,
        subtitle: `Sample: ${sample}`,
        description: '',
        type,
        source: 'raw',
        sourceLabel: 'Raw',
        helperLabel: type,
        title: `Sample value: ${sample}`,
        searchText: `${name} ${type} ${sample}`.toLowerCase(),
      };
    });
  }, [dataset]);

  const semanticMetrics = useMemo(
    () => (semanticModel?.metrics || []).map(normalizeSemanticMetric).map((metric) => ({
      ...metric,
      dragId: `semantic:metric:${metric.id}`,
      dragType: 'semantic-object',
      type: 'numeric',
      source: 'semantic',
      sourceLabel: 'Metric',
      subtitle: buildSemanticSubtitle(metric, metric.definitionLabel),
      description: metric.description || '',
      title: buildSemanticTitle(metric),
      helperLabel: metric.helperLabel,
      backingLabel: metric.field ? `Field: ${metric.field}` : '',
      searchText: metric.searchText,
    })),
    [semanticModel]
  );

  const semanticDimensions = useMemo(
    () => (semanticModel?.dimensions || []).map(normalizeSemanticDimension).map((dimension) => ({
      ...dimension,
      dragId: `semantic:dimension:${dimension.id}`,
      dragType: 'semantic-object',
      type: dimension.fieldType,
      source: 'semantic',
      sourceLabel: 'Dimension',
      subtitle: buildSemanticSubtitle(dimension, 'Business grouping'),
      description: dimension.description || '',
      title: buildSemanticTitle(dimension),
      helperLabel: dimension.helperLabel,
      backingLabel: dimension.field ? `Field: ${dimension.field}` : '',
      searchText: dimension.searchText,
    })),
    [semanticModel]
  );

  const defaultMetricId = semanticMetrics[0]?.id || '';

  const filteredRawFields = useMemo(() => {
    if (!searchTerm) return rawFields;
    const query = searchTerm.toLowerCase();
    return rawFields.filter((field) => field.searchText.includes(query));
  }, [rawFields, searchTerm]);

  const filteredSemanticMetrics = useMemo(() => {
    const query = searchTerm.toLowerCase();
    return semanticMetrics.filter((metric) => !searchTerm || metric.searchText.includes(query));
  }, [searchTerm, semanticMetrics]);

  const filteredSemanticDimensions = useMemo(() => {
    const query = searchTerm.toLowerCase();
    return semanticDimensions.filter((dimension) => !searchTerm || dimension.searchText.includes(query));
  }, [searchTerm, semanticDimensions]);

  const groupedItems = useMemo(() => {
    const groups = {
      measures: [],
      dimensions: [],
      time: [],
    };

    filteredRawFields.forEach((field) => {
      if (field.type === 'numeric') groups.measures.push(field);
      else if (field.type === 'temporal') groups.time.push(field);
      else groups.dimensions.push(field);
    });

    filteredSemanticMetrics.forEach((metric) => {
      groups.measures.push(metric);
    });

    filteredSemanticDimensions.forEach((dimension) => {
      if (dimension.type === 'temporal') groups.time.push(dimension);
      else groups.dimensions.push(dimension);
    });

    return groups;
  }, [filteredRawFields, filteredSemanticDimensions, filteredSemanticMetrics]);

  const totalFilteredCount = UNIFIED_GROUP_ORDER
    .reduce((total, groupKey) => total + (groupedItems[groupKey]?.length || 0), 0);

  const totalSemanticObjects = semanticMetrics.length + semanticDimensions.length;

  const activeItem = useMemo(() => {
    const current = active?.data?.current;
    if (!current) return null;
    if (current.type === 'field') return current.metadata || null;
    if (current.type === 'semantic-object') return current.metadata || null;
    return null;
  }, [active]);

  const toggleGroup = (group) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [group]: !prev[group],
    }));
  };

  const isItemRelevant = useCallback((item) => {
    if (!activeDestination) return true;
    
    switch (activeDestination) {
      case DESTINATIONS.WORKSPACE:
        return item.source === 'raw';
      case DESTINATIONS.DASHBOARDS:
        return item.source === 'semantic' || item.type === 'temporal';
      case DESTINATIONS.DECISIONS:
        return item.source === 'semantic';
      case DESTINATIONS.EXPLORE:
      case DESTINATIONS.AI:
      default:
        return true;
    }
  }, [activeDestination]);

  const renderEmptyState = () => {
    if (!dataset.length) {
      return (
        <div className="fields-empty-state">
          <strong>No dataset loaded.</strong>
          <span>Upload or connect a dataset from the Home tab to explore fields here.</span>
        </div>
      );
    }

    return (
      <div className="fields-empty-state">
        <strong>No matching fields.</strong>
        <span>Try a different search term to browse your field catalog.</span>
      </div>
    );
  };

  return (
    <>
      <div className="fields-panel fields-panel--docked">
        <div className="fields-panel-header">
          <div className="fields-panel-title">
            <h3>Field Explorer</h3>
            <span>{rawFields.length} raw fields · {totalSemanticObjects} business fields</span>
          </div>
        </div>

        <div className="fields-panel-summary">
          <span className="fields-panel-summary__chip fields-panel-summary__chip--raw">
            Dataset columns
          </span>
          <span className="fields-panel-summary__chip fields-panel-summary__chip--semantic">
            ★ Field Intelligence
          </span>
        </div>

        <label className="fields-search">
          <AiOutlineSearch className="fields-search-icon" />
          <input
            type="text"
            placeholder="Search all fields, metrics, or groupings"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            aria-label="Search fields"
          />
          <span className="fields-search-count">{totalFilteredCount}</span>
        </label>

        <div className="fields-panel-body">
          {totalFilteredCount > 0 ? (
            UNIFIED_GROUP_ORDER.map((groupKey) => {
              const items = groupedItems[groupKey];
              if (!items || items.length === 0) return null;

              const meta = ANALYSIS_GROUP_META[groupKey];
              const collapsed = collapsedGroups[groupKey];

              return (
                <section className="field-group" key={groupKey}>
                  <button
                    type="button"
                    className="field-group-toggle"
                    onClick={() => toggleGroup(groupKey)}
                    aria-expanded={!collapsed}
                  >
                    <span className={`group-icon ${groupKey}`} aria-hidden="true">
                      {meta.icon}
                    </span>
                    <div className="group-copy">
                      <p className="group-title">{meta.label}</p>
                      <p className="group-description">{meta.description}</p>
                    </div>
                    <span className="group-count" aria-label={`${items.length} items`}>
                      {items.length}
                    </span>
                  </button>

                  <div className={`field-group-list ${collapsed ? 'is-collapsed' : ''}`}>
                    {items.map((item) => (
                      <div key={item.dragId} className={isItemRelevant(item) ? '' : 'field-row--irrelevant'}>
                        <DraggableAnalysisItem
                          item={item}
                          actions={item.source === 'semantic' ? (
                            <SemanticQuickActions
                              item={item}
                              defaultMetricId={defaultMetricId}
                              onCreateSemanticChart={onCreateSemanticChart}
                              onCreateSemanticKpi={onCreateSemanticKpi}
                              onEditSemanticMetric={onEditSemanticMetric}
                              onAddDashboardFilter={onAddDashboardFilter}
                            />
                          ) : null}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              );
            })
          ) : renderEmptyState()}
        </div>
      </div>

      <DragOverlay>
        {activeItem ? (
          <div className="field-row field-row-overlay" title={activeItem.title}>
            <AnalysisRowContent item={activeItem} />
          </div>
        ) : null}
      </DragOverlay>
    </>
  );
}

FieldsPanel.propTypes = {
  cleanedData: PropTypes.arrayOf(PropTypes.object),
  onCreateSemanticChart: PropTypes.func,
  onCreateSemanticKpi: PropTypes.func,
  onEditSemanticMetric: PropTypes.func,
  onAddDashboardFilter: PropTypes.func,
};

FieldsPanel.defaultProps = {
  cleanedData: null,
  onCreateSemanticChart: null,
  onCreateSemanticKpi: null,
  onEditSemanticMetric: null,
  onAddDashboardFilter: null,
};

export default FieldsPanel;
