import React, { useMemo, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import Paper from '@mui/material/Paper';
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
    <Paper
      ref={setNodeRef}
      style={style}
      elevation={0}
      className={`fields-panel-item ${isDragging ? 'dragging' : ''}`}
      {...listeners}
      {...attributes}
    >
      <div className="field-item-header">
        <div className={`field-icon ${field.type}`}>{FIELD_TYPE_META[field.type]?.icon}</div>
        <div>
          <div className="field-name">{field.name}</div>
          <div className="field-type-pill">{field.type}</div>
        </div>
      </div>
      <div className="field-sample" title={`Sample value: ${field.sample}`}>
        Sample: <span>{field.sample}</span>
      </div>
    </Paper>
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

      <label className="fields-search">
        <AiOutlineSearch />
        <input
          type="text"
          placeholder="Search fields"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
      </label>

      <div className="fields-groups">
        {DATA_GROUP_ORDER.map((groupKey) => {
          const fields = groupedFields[groupKey];
          if (!fields || fields.length === 0) return null;
          const meta = FIELD_TYPE_META[groupKey];
          const collapsed = collapsedGroups[groupKey];

          return (
            <div className="fields-group" key={groupKey}>
              <button
                type="button"
                className="group-header"
                onClick={() => toggleGroup(groupKey)}
                aria-expanded={!collapsed}
              >
                <div className={`group-icon ${groupKey}`}>{meta.icon}</div>
                <div>
                  <div className="group-title">{meta.label}</div>
                  <div className="group-description">{meta.description}</div>
                </div>
                <span className="group-count">{fields.length}</span>
              </button>
              <div className={`group-content ${collapsed ? 'collapsed' : ''}`}>
                {fields.map((field) => (
                  <DraggableField key={field.name} field={field} />
                ))}
              </div>
            </div>
          );
        })}
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
