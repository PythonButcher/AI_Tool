import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { DragOverlay, useDndContext, useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  AiOutlineCalendar,
  AiOutlineFundProjectionScreen,
  AiOutlineNumber,
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

const FIELD_EXPLORER_TABS = [
  { id: 'raw', label: 'Raw Fields' },
  { id: 'business', label: 'Business Fields' },
];

const ANALYSIS_GROUP_META = {
  semantic_metric: {
    label: 'Business Metrics',
    icon: <AiOutlineFundProjectionScreen />,
    description: 'Reusable KPIs and derived measures',
  },
  semantic_dimension: {
    label: 'Business Dimensions',
    icon: <AiOutlineTag />,
    description: 'Reusable groupings for charts and filters',
  },
  numeric: {
    label: 'Measures',
    icon: <AiOutlineNumber />,
    description: 'Numeric source columns',
  },
  temporal: {
    label: 'Time',
    icon: <AiOutlineCalendar />,
    description: 'Date and time columns',
  },
  categorical: {
    label: 'Categories',
    icon: <AiOutlineTag />,
    description: 'Labels, names, and string fields',
  },
};

const GROUP_ORDER = {
  raw: ['numeric', 'temporal', 'categorical'],
  business: ['semantic_metric', 'semantic_dimension'],
};

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

const AnalysisRowContent = ({ item }) => (
  <>
    <span className={`field-type-marker ${item.type}`} aria-hidden="true" />
    <div className="field-row-main">
      <span className="field-row-label">{item.label}</span>
      {item.subtitle ? <span className="field-row-subtitle">{item.subtitle}</span> : null}
    </div>
    <span className={`field-row-pill field-row-pill--source field-row-pill--${item.source}`}>
      {item.sourceLabel}
    </span>
    <span className="field-row-pill">{item.helperLabel}</span>
  </>
);

AnalysisRowContent.propTypes = {
  item: PropTypes.shape({
    label: PropTypes.string.isRequired,
    subtitle: PropTypes.string,
    type: PropTypes.oneOf(['numeric', 'categorical', 'temporal']).isRequired,
    source: PropTypes.oneOf(['raw', 'semantic']).isRequired,
    sourceLabel: PropTypes.string.isRequired,
    helperLabel: PropTypes.string.isRequired,
  }).isRequired,
};

const DraggableAnalysisItem = React.memo(({ item }) => {
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
      <AnalysisRowContent item={item} />
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
    type: PropTypes.oneOf(['numeric', 'categorical', 'temporal']).isRequired,
    source: PropTypes.oneOf(['raw', 'semantic']).isRequired,
    sourceLabel: PropTypes.string.isRequired,
    helperLabel: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
  }).isRequired,
};

function FieldsPanel({ cleanedData }) {
  const activeDataset = useActiveDataset();
  const semanticModel = useSemanticModel();
  const { active } = useDndContext();
  const [activeTab, setActiveTab] = useState('raw');
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState({
    semantic_metric: false,
    semantic_dimension: false,
    numeric: false,
    temporal: false,
    categorical: false,
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
      subtitle: metric.expression?.type === 'derived_formula'
        ? 'Formula definition'
        : (metric.field ? `Backed by ${metric.field}` : 'Business definition'),
      title: buildSemanticTitle(metric),
      helperLabel: metric.helperLabel,
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
      subtitle: dimension.field ? `Backed by ${dimension.field}` : 'Business grouping',
      title: buildSemanticTitle(dimension),
      helperLabel: dimension.helperLabel,
      searchText: dimension.searchText,
    })),
    [semanticModel]
  );

  const filteredRawFields = useMemo(() => {
    if (!searchTerm) return rawFields;
    const query = searchTerm.toLowerCase();
    return rawFields.filter((field) => field.searchText.includes(query));
  }, [rawFields, searchTerm]);

  const filteredSemanticMetrics = useMemo(() => {
    if (!searchTerm) return semanticMetrics;
    const query = searchTerm.toLowerCase();
    return semanticMetrics.filter((metric) => metric.searchText.includes(query));
  }, [searchTerm, semanticMetrics]);

  const filteredSemanticDimensions = useMemo(() => {
    if (!searchTerm) return semanticDimensions;
    const query = searchTerm.toLowerCase();
    return semanticDimensions.filter((dimension) => dimension.searchText.includes(query));
  }, [searchTerm, semanticDimensions]);

  const groupedItems = useMemo(() => {
    const groupedRaw = filteredRawFields.reduce(
      (acc, field) => {
        const bucket = acc[field.type] ?? acc.categorical;
        bucket.push(field);
        return acc;
      },
      {
        numeric: [],
        temporal: [],
        categorical: [],
      }
    );

    return {
      ...groupedRaw,
      semantic_metric: filteredSemanticMetrics,
      semantic_dimension: filteredSemanticDimensions,
    };
  }, [filteredRawFields, filteredSemanticDimensions, filteredSemanticMetrics]);

  const activeTabItems = GROUP_ORDER[activeTab].reduce((total, groupKey) => total + (groupedItems[groupKey]?.length || 0), 0);
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

  const renderEmptyState = () => {
    if (activeTab === 'business') {
      return (
        <div className="fields-empty-state">
          <strong>No business fields yet.</strong>
          <span>Semantic metrics and dimensions will appear here when the active dataset provides them.</span>
        </div>
      );
    }

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
        <span>Try a different search or switch tabs to browse other field groups.</span>
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
            Business definitions
          </span>
        </div>

        <div className="fields-tab-strip" role="tablist" aria-label="Field explorer tabs">
          {FIELD_EXPLORER_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`fields-tab ${activeTab === tab.id ? 'is-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <label className="fields-search">
          <AiOutlineSearch className="fields-search-icon" />
          <input
            type="text"
            placeholder={activeTab === 'raw' ? 'Search raw fields' : 'Search business fields'}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            aria-label={activeTab === 'raw' ? 'Search raw fields' : 'Search business fields'}
          />
          <span className="fields-search-count">{activeTabItems}</span>
        </label>

        <div className="fields-panel-body">
          {activeTabItems > 0 ? (
            GROUP_ORDER[activeTab].map((groupKey) => {
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
                      <DraggableAnalysisItem key={item.dragId} item={item} />
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
};

FieldsPanel.defaultProps = {
  cleanedData: null,
};

export default FieldsPanel;
