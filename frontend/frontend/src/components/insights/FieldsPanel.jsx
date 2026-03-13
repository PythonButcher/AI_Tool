import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useDraggable, useDndContext, DragOverlay } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  AiOutlineNumber,
  AiOutlineCalendar,
  AiOutlineTag,
  AiOutlineSearch,
  AiOutlineFundProjectionScreen,
} from 'react-icons/ai';
import { RxDragHandleDots2 } from 'react-icons/rx';
import { useActiveDataset, useSemanticModel } from '../../context/DataContext';
import {
  normalizeSemanticMetric,
  normalizeSemanticDimension,
  toSemanticDragData,
} from '../../utils/semanticObjectUtils';
import './FieldsPanel.css';

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
      return JSON.stringify(value).slice(0, 40);
    } catch (error) {
      return '[object]';
    }
  }
  return String(value).slice(0, 40);
};

const ANALYSIS_GROUP_META = {
  semantic_metric: {
    label: 'Business Metrics',
    icon: <AiOutlineFundProjectionScreen />,
    description: 'Calculated business KPIs',
  },
  semantic_dimension: {
    label: 'Business Dimensions',
    icon: <AiOutlineTag />,
    description: 'Standardized categories',
  },
  numeric: {
    label: 'Measures',
    icon: <AiOutlineNumber />,
    description: 'Raw numeric columns',
  },
  categorical: {
    label: 'Categories',
    icon: <AiOutlineTag />,
    description: 'Raw string labels',
  },
  temporal: {
    label: 'Time',
    icon: <AiOutlineCalendar />,
    description: 'Raw date columns',
  },
};

const GROUP_ORDER = ['semantic_metric', 'semantic_dimension', 'numeric', 'temporal', 'categorical'];

const clamp = (value, min, max) => {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), Math.max(min, max));
};

const INITIAL_PANEL_POSITION = { x: 96, y: 120 };

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
      {item.subtitle && <span className="field-row-subtitle">{item.subtitle}</span>}
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

const FieldsPanel = ({ cleanedData }) => {
  const activeDataset = useActiveDataset();
  const semanticModel = useSemanticModel();
  const { active } = useDndContext();
  const panelRef = useRef(null);
  const dragStateRef = useRef(null);

  const [panelPosition, setPanelPosition] = useState(INITIAL_PANEL_POSITION);
  const [isPanelDragging, setIsPanelDragging] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState({
    semantic_metric: false,
    semantic_dimension: false,
    numeric: false,
    temporal: false,
    categorical: false,
  });

  const dataset = useMemo(() => {
    if (Array.isArray(cleanedData) && cleanedData.length) return cleanedData;
    return Array.isArray(activeDataset) && activeDataset.length ? activeDataset : null;
  }, [cleanedData, activeDataset]);

  const toggleGroup = useCallback((group) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [group]: !prev[group],
    }));
  }, []);

  const rawFields = useMemo(() => {
    if (!dataset || dataset.length === 0) return [];
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
        sourceLabel: 'Raw field',
        helperLabel: type,
        title: `Sample value: ${sample}`,
        sample,
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
      subtitle: metric.field ? `Backed by ${metric.field}` : 'Business definition',
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
        semantic_metric: [...filteredSemanticMetrics],
        semantic_dimension: [...filteredSemanticDimensions],
        numeric: [],
        temporal: [],
        categorical: [],
      }
    );

    groupedRaw.semantic_metric = filteredSemanticMetrics;
    groupedRaw.semantic_dimension = filteredSemanticDimensions;
    return groupedRaw;
  }, [filteredRawFields, filteredSemanticDimensions, filteredSemanticMetrics]);

  const totalSemanticObjects = semanticMetrics.length + semanticDimensions.length;
  const hasAnyAnalysisInputs = rawFields.length > 0 || totalSemanticObjects > 0;

  const activeItem = useMemo(() => {
    const current = active?.data?.current;
    if (!current) return null;
    if (current.type === 'field') return current.metadata || null;
    if (current.type === 'semantic-object') return current.metadata || null;
    return null;
  }, [active]);

  const startPanelDrag = useCallback(
    (event) => {
      if (event.button !== 0) return;
      const panelEl = panelRef.current;
      if (!panelEl) return;
      event.preventDefault();

      const rect = panelEl.getBoundingClientRect();
      const viewportWidth = window.innerWidth || rect.width;
      const viewportHeight = window.innerHeight || rect.height;
      const margin = 12;
      const bounds = {
        minX: margin,
        minY: margin,
        maxX: Math.max(margin, viewportWidth - rect.width - margin),
        maxY: Math.max(margin, viewportHeight - rect.height - margin),
      };

      const dragSnapshot = {
        startX: event.clientX,
        startY: event.clientY,
        initialX: panelPosition.x,
        initialY: panelPosition.y,
        bounds,
      };
      dragStateRef.current = dragSnapshot;
      setIsPanelDragging(true);

      const handlePointerMove = (moveEvent) => {
        if (!dragStateRef.current) return;
        moveEvent.preventDefault();
        const { startX, startY, initialX, initialY, bounds: moveBounds } = dragStateRef.current;
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;
        setPanelPosition({
          x: clamp(initialX + deltaX, moveBounds.minX, moveBounds.maxX),
          y: clamp(initialY + deltaY, moveBounds.minY, moveBounds.maxY),
        });
      };

      const handlePointerUp = () => {
        if (dragStateRef.current?.cleanup) {
          dragStateRef.current.cleanup();
        }
        dragStateRef.current = null;
        setIsPanelDragging(false);
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);

      dragStateRef.current.cleanup = () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
      };
    },
    [panelPosition]
  );

  useEffect(() => () => {
    if (dragStateRef.current?.cleanup) {
      dragStateRef.current.cleanup();
    }
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const panelEl = panelRef.current;
      if (!panelEl) return;
      const rect = panelEl.getBoundingClientRect();
      const margin = 12;
      const viewportWidth = window.innerWidth || rect.width;
      const viewportHeight = window.innerHeight || rect.height;
      setPanelPosition((prev) => ({
        x: clamp(prev.x, margin, Math.max(margin, viewportWidth - rect.width - margin)),
        y: clamp(prev.y, margin, Math.max(margin, viewportHeight - rect.height - margin)),
      }));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!hasAnyAnalysisInputs) {
    return (
      <div
        className={`fields-panel fields-panel-empty ${isPanelDragging ? 'is-moving' : ''}`}
        ref={panelRef}
        style={{ transform: `translate3d(${panelPosition.x}px, ${panelPosition.y}px, 0)` }}
      >
        <div
          className="fields-panel-header"
          onPointerDown={startPanelDrag}
          role="presentation"
        >
          <div className="fields-panel-grip" aria-hidden="true">
            <RxDragHandleDots2 />
          </div>
          <div className="fields-panel-title">
            <h3>Analysis Inputs</h3>
            <span>0 available</span>
          </div>
        </div>
        <p className="fields-panel-empty-message">
          Upload or select a dataset to explore raw fields and business definitions.
        </p>
      </div>
    );
  }

  return (
    <>
      <div
        ref={panelRef}
        className={`fields-panel ${isPanelDragging ? 'is-moving' : ''}`}
        style={{ transform: `translate3d(${panelPosition.x}px, ${panelPosition.y}px, 0)` }}
      >
        <div
          className="fields-panel-header"
          onPointerDown={startPanelDrag}
          role="presentation"
        >
          <div className="fields-panel-grip" aria-hidden="true">
            <RxDragHandleDots2 />
          </div>
          <div className="fields-panel-title">
            <h3>Analysis Inputs</h3>
            <span>{rawFields.length} raw fields · {totalSemanticObjects} business definitions</span>
          </div>
        </div>

        <div className="fields-panel-summary">
          <span className="fields-panel-summary__chip fields-panel-summary__chip--raw">Dataset columns</span>
          <span className="fields-panel-summary__chip fields-panel-summary__chip--semantic">Semantic metrics and dimensions</span>
        </div>

        <label className="fields-search">
          <AiOutlineSearch className="fields-search-icon" />
          <input
            type="text"
            placeholder="Search fields and business definitions"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            aria-label="Search fields and business definitions"
          />
        </label>

        <div className="fields-panel-body">
          {GROUP_ORDER.map((groupKey) => {
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
          })}

          {filteredRawFields.length === 0
            && filteredSemanticMetrics.length === 0
            && filteredSemanticDimensions.length === 0 && (
            <div className="fields-empty-state">No analysis inputs match that search.</div>
          )}
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
};

FieldsPanel.propTypes = {
  cleanedData: PropTypes.arrayOf(PropTypes.object),
};

FieldsPanel.defaultProps = {
  cleanedData: null,
};

export default FieldsPanel;
