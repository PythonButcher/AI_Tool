import React, { useMemo, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  AiOutlineNumber,
  AiOutlineCalendar,
  AiOutlineTag,
  AiOutlineSearch,
} from 'react-icons/ai';
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
      {...listeners}
      {...attributes}
    >
      <div className={`field-type-icon ${field.type}`} aria-hidden="true">
        {FIELD_TYPE_META[field.type]?.icon}
      </div>
      <div className="field-row-text">
        <div className="field-row-name">{field.name}</div>
        <div className="field-row-meta">
          <span className="field-row-type">{field.type}</span>
          <span aria-hidden="true">•</span>
          <span className="field-row-sample" title={`Sample value: ${field.sample}`}>
            {field.sample}
          </span>
        </div>
      </div>
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

  if (!dataset) {
    return (
      <div className="fields-panel fields-panel-empty">
        <div className="fields-panel-header">
          <h3>Fields</h3>
        </div>
        <p className="fields-panel-empty-message">Upload or select a dataset to explore its fields.</p>
      </div>
    );
  }

  return (
    <div className="fields-panel">
      <div className="fields-panel-header">
        <h3>Fields</h3>
        <span>{fieldsWithMeta.length} total</span>
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
        {/* Minimal group sections mimic the Power BI hierarchy while staying compact. */}
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
  );
};

FieldsPanel.propTypes = {
  cleanedData: PropTypes.arrayOf(PropTypes.object),
};

FieldsPanel.defaultProps = {
  cleanedData: null,
};

export default FieldsPanel;
