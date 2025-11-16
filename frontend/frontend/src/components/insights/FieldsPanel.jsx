import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useDraggable, useDndContext, DragOverlay } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  AiOutlineNumber,
  AiOutlineCalendar,
  AiOutlineTag,
  AiOutlineSearch,
} from 'react-icons/ai';
import { RxDragHandleDots2 } from 'react-icons/rx';
import { useActiveDataset } from '../../context/DataContext';
import './FieldsPanel.css';

/**
 * Light-weight, memoised helper that determines a semantic type for a field
 * using only the first row of the dataset (per the performance requirement).
 */
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

const FIELD_TYPE_META = {
  numeric: {
    label: 'Numeric fields',
    icon: <AiOutlineNumber />,
    description: 'Measures, values and totals',
  },
  categorical: {
    label: 'Categorical fields',
    icon: <AiOutlineTag />,
    description: 'Dimensions, labels and groupings',
  },
  temporal: {
    label: 'Temporal fields',
    icon: <AiOutlineCalendar />,
    description: 'Dates and time related values',
  },
};

const DATA_GROUP_ORDER = ['numeric', 'temporal', 'categorical'];

const clamp = (value, min, max) => {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), Math.max(min, max));
};

const INITIAL_PANEL_POSITION = { x: 96, y: 120 };

const FieldRowContent = ({ field }) => (
  <>
    <span className={`field-type-marker ${field.type}`} aria-hidden="true" />
    <span className="field-row-label">{field.name}</span>
    <span className="field-row-pill">{field.type}</span>
  </>
);

FieldRowContent.propTypes = {
  field: PropTypes.shape({
    name: PropTypes.string.isRequired,
    type: PropTypes.oneOf(['numeric', 'categorical', 'temporal']).isRequired,
  }).isRequired,
};

/**
 * Single draggable entry with metadata, memoised to avoid needless re-renders.
 * The payload still exposes the richer metadata so downstream drop-zones can
 * validate compatibility, but the visual treatment is intentionally minimal.
 */
const DraggableField = React.memo(({ field }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: field.name,
    data: {
      type: 'field',
      field: field.name,
      fieldType: field.type,
      metadata: field,
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`field-row ${isDragging ? 'is-dragging' : ''}`}
      title={`Sample value: ${field.sample}`}
      {...listeners}
      {...attributes}
    >
      <FieldRowContent field={field} />
    </div>
  );
});

DraggableField.displayName = 'DraggableField';

DraggableField.propTypes = {
  field: PropTypes.shape({
    name: PropTypes.string.isRequired,
    type: PropTypes.oneOf(['numeric', 'categorical', 'temporal']).isRequired,
    sample: PropTypes.string.isRequired,
  }).isRequired,
};

// FieldsPanel Component
const FieldsPanel = ({ cleanedData }) => {
  const activeDataset = useActiveDataset();
  const { active } = useDndContext();
  const panelRef = useRef(null);
  const dragStateRef = useRef(null);

  const [panelPosition, setPanelPosition] = useState(INITIAL_PANEL_POSITION);
  const [isPanelDragging, setIsPanelDragging] = useState(false);

  // Prefer the prop when provided (maintains backwards compatibility) but
  // fall back to the shared context for the cleaned → full → uploaded priority.
  const dataset = useMemo(() => {
    if (Array.isArray(cleanedData) && cleanedData.length) return cleanedData;
    return Array.isArray(activeDataset) && activeDataset.length ? activeDataset : null;
  }, [cleanedData, activeDataset]);

  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState({
    numeric: false,
    temporal: false,
    categorical: false,
  });

  const toggleGroup = useCallback((group) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [group]: !prev[group],
    }));
  }, []);

  const fieldsWithMeta = useMemo(() => {
    if (!dataset || dataset.length === 0) return [];
    const referenceRow = dataset[0] || {};

    return Object.keys(referenceRow).map((name) => {
      const rawValue = referenceRow[name];
      const type = inferFieldType(rawValue);
      const sample = formatSampleValue(rawValue);
      return {
        name,
        type,
        sample,
      };
    });
  }, [dataset]);

  const filteredFields = useMemo(() => {
    if (!searchTerm) return fieldsWithMeta;
    const query = searchTerm.toLowerCase();
    return fieldsWithMeta.filter((field) => field.name.toLowerCase().includes(query));
  }, [fieldsWithMeta, searchTerm]);

  const groupedFields = useMemo(() => {
    return filteredFields.reduce(
      (acc, field) => {
        const bucket = acc[field.type] ?? acc.categorical;
        bucket.push(field);
        return acc;
      },
      { numeric: [], temporal: [], categorical: [] }
    );
  }, [filteredFields]);

  const activeField = useMemo(() => {
    if (!active) return null;
    return fieldsWithMeta.find((field) => field.name === active.id) || null;
  }, [active, fieldsWithMeta]);

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

  useEffect(() => {
    return () => {
      if (dragStateRef.current?.cleanup) {
        dragStateRef.current.cleanup();
      }
    };
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

  if (!dataset) {
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
            <h3>Fields</h3>
            <span>0 total</span>
          </div>
        </div>
        <p className="fields-panel-empty-message">Upload or select a dataset to explore its fields.</p>
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
            <h3>Fields</h3>
            <span>{fieldsWithMeta.length} total</span>
          </div>
        </div>

        {/* Real-time filtering so long lists remain manageable. */}
        <label className="fields-search">
          <AiOutlineSearch className="fields-search-icon" />
          <input
            type="text"
            placeholder="Search fields"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            aria-label="Search fields"
          />
        </label>

        <div className="fields-panel-body">
          {DATA_GROUP_ORDER.map((groupKey) => {
            const fields = groupedFields[groupKey];
            if (!fields || fields.length === 0) return null;
            const meta = FIELD_TYPE_META[groupKey];
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
                  <span className="group-count" aria-label={`${fields.length} fields`}>
                    {fields.length}
                  </span>
                </button>

                <div className={`field-group-list ${collapsed ? 'is-collapsed' : ''}`}>
                  {fields.map((field) => (
                    <DraggableField key={field.name} field={field} />
                  ))}
                </div>
              </section>
            );
          })}

          {/* Guard to keep the UI communicative when filters remove every field. */}
          {filteredFields.length === 0 && (
            <div className="fields-empty-state">No fields match that search.</div>
          )}
        </div>
      </div>
      <DragOverlay>
        {activeField ? (
          <div className="field-row field-row-overlay" title={`Sample value: ${activeField.sample}`}>
            <FieldRowContent field={activeField} />
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
