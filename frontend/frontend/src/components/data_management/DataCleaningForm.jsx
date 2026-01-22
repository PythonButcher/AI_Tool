import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import './DataCleaningForm.css';
import CloseButton from '../buttons/CloseButton';
import FileExport from './FileExport';
import MLPrepPanel from './MLPrepPanel';
import { DataContext } from '../../context/DataContext';
import {
  FaFont, FaEraser, FaFilter, FaExchangeAlt, FaFillDrip, FaTrash,
  FaArrowUp, FaArrowDown, FaClone, FaHashtag, FaObjectGroup, FaCalendarAlt,
  FaEdit, FaSortAmountDown, FaTable, FaColumns, FaLayerGroup, FaIndent, FaOutdent
} from 'react-icons/fa';
import { MdMergeType, MdSplitscreen } from 'react-icons/md';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const TRANSFORM_LIBRARY = [
  {
    category: 'Text',
    transforms: [
      {
        type: 'trim_whitespace',
        label: 'Trim Whitespace',
        description: 'Remove leading and trailing spaces.',
        icon: <FaEraser />,
        fields: [{ name: 'columns', type: 'column-multi', label: 'Columns (optional)' }],
      },
      {
        type: 'change_case',
        label: 'Change Case',
        description: 'Uppercase, lowercase, or title case text.',
        icon: <FaFont />,
        fields: [
          { name: 'columns', type: 'column-multi', label: 'Columns (optional)' },
          {
            name: 'case',
            type: 'select',
            label: 'Case',
            options: [
              { label: 'lowercase', value: 'lower' },
              { label: 'UPPERCASE', value: 'upper' },
              { label: 'Title Case', value: 'title' },
            ],
            defaultValue: 'lower',
          },
        ],
      },
      {
        type: 'replace_values',
        label: 'Replace Values',
        description: 'Swap specific values with new content.',
        icon: <FaExchangeAlt />,
        fields: [
          { name: 'columns', type: 'column-multi', label: 'Columns (optional)' },
          { name: 'replacements', type: 'replacements', label: 'Value Replacements' },
        ],
      },
    ],
  },
  {
    category: 'Missing & Rows',
    transforms: [
      {
        type: 'replace_nulls',
        label: 'Replace Nulls',
        description: 'Fill null values with a strategy or value.',
        icon: <FaFillDrip />,
        fields: [
          { name: 'columns', type: 'column-multi', label: 'Columns (optional)' },
          {
            name: 'strategy',
            type: 'select',
            label: 'Strategy',
            options: [
              { label: 'Custom Value', value: 'value' },
              { label: 'Forward Fill', value: 'ffill' },
              { label: 'Backward Fill', value: 'bfill' },
              { label: 'Mean (numeric)', value: 'mean' },
              { label: 'Median (numeric)', value: 'median' },
              { label: 'Mode', value: 'mode' },
            ],
            defaultValue: 'value',
          },
          { name: 'value', type: 'text', label: 'Custom Value (optional)' },
        ],
      },
      {
        type: 'remove_nulls',
        label: 'Remove Nulls',
        description: 'Drop rows that contain nulls.',
        icon: <FaTrash />,
        fields: [{ name: 'columns', type: 'column-multi', label: 'Columns (optional)' }],
      },
      {
        type: 'filter_rows',
        label: 'Filter Rows',
        description: 'Keep rows that satisfy conditions.',
        icon: <FaFilter />,
        fields: [{ name: 'conditions', type: 'conditions', label: 'Conditions' }],
      },
      {
        type: 'remove_top_rows',
        label: 'Remove Top',
        description: 'Remove the first N rows.',
        icon: <FaArrowUp />,
        fields: [{ name: 'count', type: 'number', label: 'Number of rows', defaultValue: 1 }],
      },
      {
        type: 'remove_bottom_rows',
        label: 'Remove Bottom',
        description: 'Remove the last N rows.',
        icon: <FaArrowDown />,
        fields: [{ name: 'count', type: 'number', label: 'Number of rows', defaultValue: 1 }],
      },
      {
        type: 'keep_top_rows',
        label: 'Keep Top',
        description: 'Keep only the first N rows.',
        icon: <FaIndent />,
        fields: [{ name: 'count', type: 'number', label: 'Number of rows', defaultValue: 5 }],
      },
      {
        type: 'keep_bottom_rows',
        label: 'Keep Bottom',
        description: 'Keep only the last N rows.',
        icon: <FaOutdent />,
        fields: [{ name: 'count', type: 'number', label: 'Number of rows', defaultValue: 5 }],
      },
      {
        type: 'remove_duplicates',
        label: 'Remove Dupes',
        description: 'Remove duplicate rows.',
        icon: <FaClone />,
        fields: [
          { name: 'subset', type: 'column-multi', label: 'Subset columns (optional)' },
          {
            name: 'keep',
            type: 'select',
            label: 'Keep',
            options: [
              { label: 'First', value: 'first' },
              { label: 'Last', value: 'last' },
              { label: 'None', value: false },
            ],
            defaultValue: 'first',
          },
        ],
      },
    ],
  },
  {
    category: 'Columns & Types',
    transforms: [
      {
        type: 'convert_type',
        label: 'Data Type',
        description: 'Cast columns to numeric, string, date, or boolean.',
        icon: <FaHashtag />,
        fields: [
          { name: 'columns', type: 'column-multi', label: 'Columns' },
          {
            name: 'target',
            type: 'select',
            label: 'Target Type',
            options: [
              { label: 'String', value: 'string' },
              { label: 'Integer', value: 'int' },
              { label: 'Float', value: 'float' },
              { label: 'Numeric (coerce)', value: 'numeric' },
              { label: 'Datetime', value: 'datetime' },
              { label: 'Boolean', value: 'bool' },
            ],
            defaultValue: 'string',
          },
        ],
      },
      {
        type: 'split_column',
        label: 'Split Column',
        description: 'Split one column into many by delimiter.',
        icon: <MdSplitscreen />,
        fields: [
          { name: 'column', type: 'column', label: 'Column' },
          { name: 'delimiter', type: 'text', label: 'Delimiter', defaultValue: ' ' },
          { name: 'new_columns', type: 'text', label: 'New column names (comma separated)' },
          { name: 'drop_original', type: 'checkbox', label: 'Drop original column?' },
        ],
      },
      {
        type: 'merge_columns',
        label: 'Merge Columns',
        description: 'Combine multiple columns with a separator.',
        icon: <MdMergeType />,
        fields: [
          { name: 'columns', type: 'column-multi', label: 'Columns' },
          { name: 'separator', type: 'text', label: 'Separator', defaultValue: ' ' },
          { name: 'new_column', type: 'text', label: 'New column name', defaultValue: 'merged' },
        ],
      },
      {
        type: 'extract_date_component',
        label: 'Date Parts',
        description: 'Create a new column from date parts.',
        icon: <FaCalendarAlt />,
        fields: [
          { name: 'column', type: 'column', label: 'Date column' },
          {
            name: 'component',
            type: 'select',
            label: 'Component',
            options: [
              { label: 'Year', value: 'year' },
              { label: 'Month', value: 'month' },
              { label: 'Day', value: 'day' },
              { label: 'Weekday', value: 'weekday' },
              { label: 'ISO Week', value: 'week' },
            ],
            defaultValue: 'year',
          },
          { name: 'new_column', type: 'text', label: 'New column name (optional)' },
        ],
      },
      {
        type: 'rename_columns',
        label: 'Rename',
        description: 'Rename one or more columns.',
        icon: <FaEdit />,
        fields: [{ name: 'mappings', type: 'rename-map', label: 'Column Renames' }],
      },
      {
        type: 'reorder_columns',
        label: 'Reorder',
        description: 'Arrange columns in a custom order.',
        icon: <FaColumns />,
        fields: [{ name: 'order', type: 'order-text', label: 'Desired order (comma separated)' }],
      },
    ],
  },
  {
    category: 'Sorting & Shaping',
    transforms: [
      {
        type: 'sort_rows',
        label: 'Sort Rows',
        description: 'Sort by one or more columns.',
        icon: <FaSortAmountDown />,
        fields: [{ name: 'sort_by', type: 'sort-rules', label: 'Sort rules' }],
      },
      {
        type: 'group_by',
        label: 'Group By',
        description: 'Group rows and aggregate columns.',
        icon: <FaObjectGroup />,
        fields: [
          { name: 'group_columns', type: 'column-multi', label: 'Group columns' },
          { name: 'aggregations', type: 'aggregations', label: 'Aggregations' },
        ],
      },
      {
        type: 'pivot',
        label: 'Pivot',
        description: 'Create a pivot table.',
        icon: <FaTable />,
        fields: [
          { name: 'index', type: 'column-multi', label: 'Index columns' },
          { name: 'columns', type: 'column', label: 'Columns field' },
          { name: 'values', type: 'column', label: 'Values field' },
          {
            name: 'aggfunc',
            type: 'select',
            label: 'Aggregation',
            options: [
              { label: 'Sum', value: 'sum' },
              { label: 'Mean', value: 'mean' },
              { label: 'Count', value: 'count' },
              { label: 'Max', value: 'max' },
              { label: 'Min', value: 'min' },
            ],
            defaultValue: 'sum',
          },
        ],
      },
      {
        type: 'unpivot',
        label: 'Unpivot',
        description: 'Unpivot columns into attribute/value rows.',
        icon: <FaLayerGroup />,
        fields: [
          { name: 'id_vars', type: 'column-multi', label: 'ID columns' },
          { name: 'value_vars', type: 'column-multi', label: 'Value columns' },
          { name: 'var_name', type: 'text', label: 'Variable name', defaultValue: 'variable' },
          { name: 'value_name', type: 'text', label: 'Value name', defaultValue: 'value' },
        ],
      },
    ],
  },
];

const buildDefaultValues = (fields = []) => {
  const defaults = {};
  fields.forEach((field) => {
    if (field.type === 'conditions') {
      defaults[field.name] = [{ column: '', operator: 'eq', value: '' }];
    } else if (field.type === 'replacements') {
      defaults[field.name] = [{ from: '', to: '' }];
    } else if (field.type === 'aggregations') {
      defaults[field.name] = [{ column: '', agg: 'sum', as: '' }];
    } else if (field.type === 'sort-rules') {
      defaults[field.name] = [{ column: '', direction: 'asc' }];
    } else if (field.type === 'rename-map') {
      defaults[field.name] = [{ from: '', to: '' }];
    } else {
      defaults[field.name] = field.defaultValue ?? (field.type === 'checkbox' ? false : '');
    }
  });
  return defaults;
};

const getTransformLookup = () => {
  const lookup = {};
  TRANSFORM_LIBRARY.forEach((group) => {
    group.transforms.forEach((transform) => {
      lookup[transform.type] = transform;
    });
  });
  return lookup;
};

const transformLookup = getTransformLookup();

const parsePreviewArray = (data) => {
  if (Array.isArray(data)) return data;
  if (data?.data_preview && Array.isArray(data.data_preview)) return data.data_preview;
  if (typeof data?.data_preview === 'string') {
    try {
      return JSON.parse(data.data_preview);
    } catch (error) {
      return [];
    }
  }
  return [];
};

const columnListFromData = (dataset) => {
  const sample = Array.isArray(dataset) && dataset.length > 0 ? dataset[0] : null;
  if (sample && typeof sample === 'object') return Object.keys(sample);
  if (dataset?.data_preview) {
    const preview = parsePreviewArray(dataset) || [];
    if (preview.length > 0) return Object.keys(preview[0]);
  }
  return [];
};

function DataCleaningForm({ closeForm, setShowDataPreview }) {
  const { uploadedData, fullData, cleanedData, setCleanedData } = React.useContext(DataContext);
  const [activePanel, setActivePanel] = useState('cleaning');
  const [selectedCategory, setSelectedCategory] = useState(TRANSFORM_LIBRARY[0]?.category);
  const [selectedTransform, setSelectedTransform] = useState(null); // No default selected initially
  const [formValues, setFormValues] = useState({});
  const [steps, setSteps] = useState([]);
  const [previewRows, setPreviewRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const columns = useMemo(() => {
    const source = cleanedData ?? fullData ?? uploadedData;
    return columnListFromData(source);
  }, [cleanedData, fullData, uploadedData]);

  useEffect(() => {
    if (selectedTransform) {
      const activeTransform = transformLookup[selectedTransform];
      setFormValues(buildDefaultValues(activeTransform?.fields));
    } else {
      setFormValues({});
    }
  }, [selectedTransform]);

  const handleFieldChange = (name, value) => {
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const templateForField = (fieldName) => {
    const field = transformLookup[selectedTransform]?.fields?.find((f) => f.name === fieldName);
    if (!field) return {};
    if (field.type === 'conditions') return { column: '', operator: 'eq', value: '' };
    if (field.type === 'replacements') return { from: '', to: '' };
    if (field.type === 'aggregations') return { column: '', agg: 'sum', as: '' };
    if (field.type === 'sort-rules') return { column: '', direction: 'asc' };
    if (field.type === 'rename-map') return { from: '', to: '' };
    return {};
  };

  const handleArrayFieldChange = (fieldName, index, key, value) => {
    setFormValues((prev) => {
      const updated = [...(prev[fieldName] || [])];
      updated[index] = { ...updated[index], [key]: value };
      return { ...prev, [fieldName]: updated };
    });
  };

  const addRowToArrayField = (fieldName, template) => {
    setFormValues((prev) => ({ ...prev, [fieldName]: [...(prev[fieldName] || []), template] }));
  };

  const removeRowFromArrayField = (fieldName, index) => {
    setFormValues((prev) => {
      const updated = [...(prev[fieldName] || [])];
      updated.splice(index, 1);
      const fallback = templateForField(fieldName);
      return { ...prev, [fieldName]: updated.length ? updated : [fallback] };
    });
  };

  const addStep = () => {
    setError(null);
    setSuccess(null);
    const active = transformLookup[selectedTransform];
    if (!active) return;
    const stepPayload = { type: active.type, label: active.label, params: formValues };
    if (editingId) {
      setSteps((prev) => prev.map((s) => (s.id === editingId ? { ...stepPayload, id: s.id } : s)));
      setEditingId(null);
      setSuccess('Step updated');
    } else {
      setSteps((prev) => [...prev, { ...stepPayload, id: Date.now() }]);
      setSuccess('Step added');
    }
  };

  const editStep = (step) => {
    const category = TRANSFORM_LIBRARY.find((c) => c.transforms.some((t) => t.type === step.type))?.category;
    if (category) setSelectedCategory(category);
    setSelectedTransform(step.type);
    setFormValues(step.params);
    setEditingId(step.id);
    setError(null);
    setSuccess(null);
  };

  const deleteStep = (id) => {
    setSteps((prev) => prev.filter((s) => s.id !== id));
    if (editingId === id) {
      setEditingId(null);
      const active = transformLookup[selectedTransform];
      if (active) setFormValues(buildDefaultValues(active.fields));
    }
  };

  const moveStep = (index, direction) => {
    setSteps((prev) => {
      const newSteps = [...prev];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const temp = newSteps[index];
      newSteps[index] = newSteps[targetIndex];
      newSteps[targetIndex] = temp;
      return newSteps;
    });
  };

  const renderField = (field) => {
    const value = formValues[field.name];
    switch (field.type) {
      case 'text':
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
          />
        );
      case 'number':
        return (
          <input
            type="number"
            value={value || 0}
            onChange={(e) => handleFieldChange(field.name, Number(e.target.value))}
          />
        );
      case 'checkbox':
        return (
          <div className="checkbox-wrapper">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => handleFieldChange(field.name, e.target.checked)}
            />
          </div>
        );
      case 'select':
        return (
          <select value={value ?? field.defaultValue ?? ''} onChange={(e) => handleFieldChange(field.name, e.target.value)}>
            {(field.options || []).map((opt) => (
              <option key={opt.value?.toString()} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );
      case 'column':
        return (
          <select value={value || ''} onChange={(e) => handleFieldChange(field.name, e.target.value)}>
            <option value="">Select column</option>
            {columns.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
        );
      case 'column-multi':
        return (
          <select
            multiple
            value={value || []}
            onChange={(e) => handleFieldChange(
              field.name,
              Array.from(e.target.selectedOptions).map((o) => o.value)
            )}
            className="multi-select"
          >
            {columns.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
        );
      case 'conditions':
        return (
          <div className="field-array">
            {(value || []).map((row, idx) => (
              <div className="field-array-row" key={`${field.name}-${idx}`}>
                <select
                  value={row.column || ''}
                  onChange={(e) => handleArrayFieldChange(field.name, idx, 'column', e.target.value)}
                >
                  <option value="">Column</option>
                  {columns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
                <select
                  value={row.operator}
                  onChange={(e) => handleArrayFieldChange(field.name, idx, 'operator', e.target.value)}
                >
                  <option value="eq">Equals</option>
                  <option value="neq">!=</option>
                  <option value="gt">&gt;</option>
                  <option value="gte">&gt;=</option>
                  <option value="lt">&lt;</option>
                  <option value="lte">&lt;=</option>
                  <option value="contains">Contains</option>
                  <option value="not_contains">!Contain</option>
                  <option value="in">In</option>
                  <option value="not_in">Not In</option>
                  <option value="startswith">Starts</option>
                  <option value="endswith">Ends</option>
                </select>
                <input
                  type="text"
                  value={row.value ?? ''}
                  placeholder="value"
                  onChange={(e) =>
                    handleArrayFieldChange(
                      field.name,
                      idx,
                      'value',
                      row.operator === 'in' || row.operator === 'not_in'
                        ? e.target.value.split(',').map((v) => v.trim())
                        : e.target.value
                    )
                  }
                />
                <button type="button" onClick={() => removeRowFromArrayField(field.name, idx)}>
                  ×
                </button>
              </div>
            ))}
            <button type="button" className="chip" onClick={() => addRowToArrayField(field.name, { column: '', operator: 'eq', value: '' })}>
              + Condition
            </button>
          </div>
        );
      case 'replacements':
        return (
          <div className="field-array">
            {(value || []).map((row, idx) => (
              <div className="field-array-row" key={`${field.name}-${idx}`}>
                <input
                  type="text"
                  placeholder="From"
                  value={row.from ?? ''}
                  onChange={(e) => handleArrayFieldChange(field.name, idx, 'from', e.target.value)}
                />
                <input
                  type="text"
                  placeholder="To"
                  value={row.to ?? ''}
                  onChange={(e) => handleArrayFieldChange(field.name, idx, 'to', e.target.value)}
                />
                <button type="button" onClick={() => removeRowFromArrayField(field.name, idx)}>
                  ×
                </button>
              </div>
            ))}
            <button type="button" className="chip" onClick={() => addRowToArrayField(field.name, { from: '', to: '' })}>
              + Replacement
            </button>
          </div>
        );
      case 'aggregations':
        return (
          <div className="field-array">
            {(value || []).map((row, idx) => (
              <div className="field-array-row" key={`${field.name}-${idx}`}>
                <select
                  value={row.column || ''}
                  onChange={(e) => handleArrayFieldChange(field.name, idx, 'column', e.target.value)}
                >
                  <option value="">Column</option>
                  {columns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
                <select
                  value={row.agg || 'sum'}
                  onChange={(e) => handleArrayFieldChange(field.name, idx, 'agg', e.target.value)}
                >
                  <option value="sum">Sum</option>
                  <option value="mean">Mean</option>
                  <option value="count">Count</option>
                  <option value="max">Max</option>
                  <option value="min">Min</option>
                </select>
                <input
                  type="text"
                  placeholder="Alias"
                  value={row.as ?? ''}
                  onChange={(e) => handleArrayFieldChange(field.name, idx, 'as', e.target.value)}
                />
                <button type="button" onClick={() => removeRowFromArrayField(field.name, idx)}>
                  ×
                </button>
              </div>
            ))}
            <button type="button" className="chip" onClick={() => addRowToArrayField(field.name, { column: '', agg: 'sum', as: '' })}>
              + Aggregation
            </button>
          </div>
        );
      case 'sort-rules':
        return (
          <div className="field-array">
            {(value || []).map((row, idx) => (
              <div className="field-array-row" key={`${field.name}-${idx}`}>
                <select
                  value={row.column || ''}
                  onChange={(e) => handleArrayFieldChange(field.name, idx, 'column', e.target.value)}
                >
                  <option value="">Column</option>
                  {columns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
                <select
                  value={row.direction || 'asc'}
                  onChange={(e) => handleArrayFieldChange(field.name, idx, 'direction', e.target.value)}
                >
                  <option value="asc">Asc</option>
                  <option value="desc">Desc</option>
                </select>
                <button type="button" onClick={() => removeRowFromArrayField(field.name, idx)}>
                  ×
                </button>
              </div>
            ))}
            <button type="button" className="chip" onClick={() => addRowToArrayField(field.name, { column: '', direction: 'asc' })}>
              + Sort Rule
            </button>
          </div>
        );
      case 'rename-map':
        return (
          <div className="field-array">
            {(value || []).map((row, idx) => (
              <div className="field-array-row" key={`${field.name}-${idx}`}>
                <select
                  value={row.from || ''}
                  onChange={(e) => handleArrayFieldChange(field.name, idx, 'from', e.target.value)}
                >
                  <option value="">Column</option>
                  {columns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="New name"
                  value={row.to ?? ''}
                  onChange={(e) => handleArrayFieldChange(field.name, idx, 'to', e.target.value)}
                />
                <button type="button" onClick={() => removeRowFromArrayField(field.name, idx)}>
                  ×
                </button>
              </div>
            ))}
            <button type="button" className="chip" onClick={() => addRowToArrayField(field.name, { from: '', to: '' })}>
              + Rename
            </button>
          </div>
        );
      case 'order-text':
        return (
          <textarea
            rows={2}
            placeholder="col1, col2, col3..."
            value={value || ''}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
          />
        );
      default:
        return null;
    }
  };

  const buildStepPayload = () =>
    steps.map(({ type, params }) => {
      if (type === 'rename_columns') {
        const mapping = {};
        (params.mappings || []).forEach((m) => {
          if (m.from && m.to) mapping[m.from] = m.to;
        });
        return { type, params: { mappings: mapping } };
      }
      if (type === 'reorder_columns') {
        const order = Array.isArray(params.order)
          ? params.order
          : (params.order || '')
              .split(',')
              .map((c) => c.trim())
              .filter(Boolean);
        return { type, params: { order } };
      }
      if (type === 'remove_duplicates') {
        const keep =
          params.keep === 'false' || params.keep === false
            ? false
            : params.keep || 'first';
        return { type, params: { ...params, keep } };
      }
      if (type === 'replace_values') {
        const replacements = (params.replacements || []).filter((r) => r.from !== undefined && r.from !== '');
        return { type, params: { ...params, replacements } };
      }
      if (type === 'split_column') {
        const newColumns = typeof params.new_columns === 'string'
          ? params.new_columns.split(',').map((c) => c.trim()).filter(Boolean)
          : params.new_columns;
        return { type, params: { ...params, new_columns: newColumns } };
      }
      return { type, params };
    });

  const runCleaning = async (previewOnly = true) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await axios.post(`${API_URL}/api/manual_cleaning`, {
        steps: buildStepPayload(),
        preview_only: previewOnly,
      });
      const { preview, cleaned_data } = response.data;
      setPreviewRows(preview || []);
      if (!previewOnly) {
        setCleanedData(cleaned_data);
        setSuccess('Cleaning applied and dataset updated.');
        if (setShowDataPreview) setShowDataPreview(true);
      } else {
        setSuccess('Preview updated');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to apply cleaning steps.');
    } finally {
      setLoading(false);
    }
  };

  const renderRibbon = () => (
    <div className="cleaning-ribbon-container">
      {/* Category Tabs */}
      <div className="ribbon-tabs">
        {TRANSFORM_LIBRARY.map((category) => (
          <button
            key={category.category}
            className={`ribbon-tab ${selectedCategory === category.category ? 'active' : ''}`}
            onClick={() => {
              setSelectedCategory(category.category);
              // Do not automatically select a tool, keep panel closed until tool click
              // setSelectedTransform(null); 
            }}
          >
            {category.category}
          </button>
        ))}
      </div>

      {/* Toolbar Icons for Active Category */}
      <div className="ribbon-toolbar">
        {TRANSFORM_LIBRARY.find(c => c.category === selectedCategory)?.transforms.map((transform) => (
          <button
            key={transform.type}
            className={`ribbon-btn ${selectedTransform === transform.type ? 'active' : ''}`}
            onClick={() => {
              setSelectedTransform(transform.type);
              setSuccess(null);
              setError(null);
            }}
            title={`${transform.label} - ${transform.description}`}
          >
            <div className="ribbon-icon">{transform.icon}</div>
            <div className="ribbon-label">{transform.label}</div>
          </button>
        ))}
      </div>
    </div>
  );

  const renderAppliedSteps = () => (
    <div className="applied-steps-panel">
      <div className="panel-header">Applied Steps</div>
      <div className="steps-list">
        {steps.length === 0 && <div className="muted-text">No steps yet.</div>}
        {steps.map((step, idx) => (
          <div key={step.id} className={`step-item ${editingId === step.id ? 'editing' : ''}`}>
             <div className="step-info">
               <span className="step-number">{idx + 1}</span>
               <div className="step-details">
                 <div className="step-name">{step.label}</div>
                 <div className="step-type">{step.type}</div>
               </div>
             </div>
             <div className="step-controls">
               <button onClick={() => editStep(step)} title="Edit"><FaEdit /></button>
               <button onClick={() => deleteStep(step.id)} title="Remove"><FaTrash /></button>
               <div className="step-arrows">
                  <button onClick={() => moveStep(idx, -1)} disabled={idx === 0}>↑</button>
                  <button onClick={() => moveStep(idx, 1)} disabled={idx === steps.length - 1}>↓</button>
               </div>
             </div>
          </div>
        ))}
      </div>
    </div>
  );

  const activeTransform = transformLookup[selectedTransform];

  return (
    <div className="cleaning-form-overlay">
      <div className="manual-cleaning-shell">
        <div className="manual-cleaning-header">
          <div className="header-left">
            <div className="header-title">
              <h2>Power Query Editor</h2>
              <p className="subtitle">Visual Data Transformation Interface</p>
            </div>
            <div className="header-tabs">
              <button
                type="button"
                className={`header-tab ${activePanel === 'cleaning' ? 'active' : ''}`}
                onClick={() => setActivePanel('cleaning')}
              >
                Data Cleaning
              </button>
              <button
                type="button"
                className={`header-tab ${activePanel === 'ml_prep' ? 'active' : ''}`}
                onClick={() => setActivePanel('ml_prep')}
              >
                ML Prep
              </button>
            </div>
          </div>
          <div className="header-actions">
             {activePanel === 'cleaning' && (
               <>
                 <button className="preview-trigger" onClick={() => runCleaning(true)} disabled={steps.length === 0 || loading}>
                   Run Preview
                 </button>
                 <button className="apply-trigger" onClick={() => runCleaning(false)} disabled={steps.length === 0 || loading}>
                   Apply All
                 </button>
               </>
             )}
             <CloseButton onClick={closeForm} />
          </div>
        </div>

        <div className="manual-cleaning-body">
          {activePanel === 'cleaning' ? (
            <>
              {/* Top Ribbon */}
              {renderRibbon()}

              {/* Configuration Panel (Collapsible/Conditional) */}
              {activeTransform && (
                 <div className="config-panel">
                   <div className="config-header">
                     <h3>Configure: {activeTransform.label}</h3>
                     <button className="close-config" onClick={() => { setSelectedTransform(null); setEditingId(null); }}>×</button>
                   </div>
                   <div className="config-content">
                      <p className="config-desc">{activeTransform.description}</p>
                      <div className="config-form-grid">
                        {(activeTransform.fields || []).map((field) => (
                          <label key={field.name} className="config-field">
                            <span>{field.label}</span>
                            {renderField(field)}
                          </label>
                        ))}
                      </div>
                   </div>
                   <div className="config-footer">
                      <button type="button" onClick={addStep} className="add-step-btn">
                        {editingId ? 'Update Step' : 'Add Step'}
                      </button>
                   </div>
                 </div>
              )}

              {/* Messages */}
              {(error || success) && (
                <div className={`status-bar ${error ? 'error' : 'success'}`}>
                  {error || success}
                </div>
              )}

              {/* Main Workspace: applied steps (left/right) + preview (center/bottom) */}
              <div className="workspace-area">
                 <div className="preview-container">
                    {previewRows && previewRows.length > 0 ? (
                      <div className="table-scroll">
                        <table className="preview-table">
                          <thead>
                            <tr>
                              {Object.keys(previewRows[0]).map((key) => (
                                <th key={key}>{key}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {previewRows.map((row, idx) => (
                              <tr key={idx}>
                                {Object.keys(previewRows[0]).map((key) => (
                                  <td key={`${idx}-${key}`}>{row[key]}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="empty-state">
                        <FaTable className="empty-icon" />
                        <p>Add steps from the ribbon above and click "Run Preview" to see results.</p>
                      </div>
                    )}
                 </div>

                 {/* Right Panel: Applied Steps */}
                 <div className="sidebar-right">
                    {renderAppliedSteps()}
                 </div>
              </div>
            </>
          ) : (
            <MLPrepPanel onSwitchToCleaning={() => setActivePanel('cleaning')} />
          )}
        </div>
      </div>
    </div>
  );
}

export default DataCleaningForm;
