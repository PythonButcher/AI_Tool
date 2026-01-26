import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import './DataCleaningForm.css';
import CloseButton from '../buttons/CloseButton';
import MLPrepPanel from './MLPrepPanel';
import { DataContext } from '../../context/DataContext';
import { useHelpOverlay } from '../../context/HelpOverlayContext';
import { 
  TRANSFORM_LIBRARY, 
  transformLookup, 
  buildDefaultValues 
} from './cleaning_components/CleaningConstants';
import CleaningRibbon from './cleaning_components/CleaningRibbon';
import AppliedStepsList from './cleaning_components/AppliedStepsList';
import DataCleaningPreview from './cleaning_components/DataCleaningPreview';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

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
  const { isHelpVisible, toggleHelp, closeHelp } = useHelpOverlay();

  const helpId = 'dataCleaning';

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

  const activeTransform = transformLookup[selectedTransform];

  const addMlPrepFix = (suggestion) => {
    const transform = transformLookup[suggestion.action_type];
    if (!transform) {
      setError(`Unsupported ML Prep action: ${suggestion.action_type}`);
      return;
    }

    const params = { ...(suggestion.params || {}) };
    if (suggestion.columns && suggestion.columns.length > 0 && !params.columns) {
      params.columns = suggestion.columns;
    }

    setSteps((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        type: suggestion.action_type,
        label: transform.label,
        params,
      },
    ]);
    setError(null);
    setSuccess('ML Prep fix added to Applied Steps.');
  };

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
             <button
          type="button"
          className="help-overlay-trigger"
          onClick={() => toggleHelp(helpId)}
        >
          ❓
        </button>
             <CloseButton onClick={closeForm} />
          </div>
        </div>

        <div className="manual-cleaning-body">
          {activePanel === 'cleaning' ? (
            <>
              {/* Top Ribbon */}
              <CleaningRibbon 
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                selectedTransform={selectedTransform}
                onSelectTransform={(type) => {
                  setSelectedTransform(type);
                  setSuccess(null);
                  setError(null);
                }}
              />

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
                 {/* Preview Container */}
                 <DataCleaningPreview previewRows={previewRows} />

                 {/* Right Panel: Applied Steps */}
                 <div className="sidebar-right">
                    <AppliedStepsList 
                      steps={steps}
                      editingId={editingId}
                      onEditStep={editStep}
                      onDeleteStep={deleteStep}
                      onMoveStep={moveStep}
                    />
                 </div>          
              </div>                     
            </>
          ) : (          
            <MLPrepPanel
              onSwitchToCleaning={() => setActivePanel('cleaning')}
              onAddFix={addMlPrepFix}
            />           
          )}
          {/* ✅ Help Overlay */}
          {isHelpVisible(helpId) && (
            <div className="help-overlay visible">
              <div className="help-overlay-content">
                <span
                  className="help-overlay-close"
                  onClick={() => closeHelp(helpId)}
                >
                  ×
                </span>
                <h3>Data Cleaning</h3>
                  <ul>
                    <li>Use the Data Cleaning tools to fix structural issues in your dataset, such as missing values, incorrect data types, duplicate rows, or malformed columns.</li>
                    <li>Cleaning steps are added incrementally and can be previewed before being applied, allowing you to safely refine your data without permanent changes.</li>
                  </ul>

                  <h3>ML Prep</h3>
                  <ul>
                    <li>The ML Prep section analyzes your current dataset to determine whether it is suitable for specific machine learning models.</li>
                    <li>When issues are found, ML Prep suggests concrete cleaning actions that you can add directly to your cleaning workflow.</li>
                  </ul>

              </div>
            </div>
          )}
        </div>
      </div>   
    </div>
    
  );
}

export default DataCleaningForm;