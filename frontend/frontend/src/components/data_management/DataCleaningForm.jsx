import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import Modal from '@mui/material/Modal';
import './DataCleaningForm.css';
import CloseButton from '../buttons/CloseButton';
import { DataContext, normalizeDatasetRows } from '../../context/DataContext';
import { useHelpOverlay } from '../../context/HelpOverlayContext';
import {
  TRANSFORM_LIBRARY,
  transformLookup,
  buildDefaultValues
} from './cleaning_components/CleaningConstants';
import CleaningRibbon from './cleaning_components/CleaningRibbon';
import AppliedStepsList from './cleaning_components/AppliedStepsList';
import DataCleaningPreview from './cleaning_components/DataCleaningPreview';
import PreparationEditor from '../../features/ml_studio/PreparationEditor';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const PREVIEW_LIMIT = 100;

function previewColumns(rows, schema) {
  return Array.from(new Set([...(schema ?? []).map(field => field.name), ...rows.flatMap(row => Object.keys(row ?? {}))]));
}

function DataCleaningForm(props) {
  if (props.mlStudioMode && (props.mlStudioOpeningContext?.base_etag || props.mlStudioOpeningContext?.preparation)) {
    return <PreparationEditor context={props.mlStudioOpeningContext} initialSteps={props.initialSteps || []} closeForm={props.closeForm} onFinished={props.onPreparationFinished} />;
  }
  return <LegacyDataCleaningForm {...props} />;
}

function LegacyDataCleaningForm({
  closeForm, setShowDataPreview, initialSteps = [], onApplyComplete, mlStudioMode, mlStudioOpeningContext,
  workingWorkspace, workingDatasetName, onWorkingRefine, onApplyingRefine, embedded = false, visible = true,
}) {
  const {
    uploadedData,
    fullData,
    cleanedData,
    setCleanedData,
    setSemanticModel,
    refreshSemanticModelFromDataset,
  } = React.useContext(DataContext);
  const [selectedCategory, setSelectedCategory] = useState(TRANSFORM_LIBRARY[0]?.category);
  const [selectedTransform, setSelectedTransform] = useState(null); // No default selected initially
  const [formValues, setFormValues] = useState({});
  const [steps, setSteps] = useState(initialSteps);
  const [previewResult, setPreviewResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const refineInFlight = useRef(null);
  const refinePreview = useRef(null);
  const refineOperation = useRef(null);
  const { isHelpVisible, toggleHelp, closeHelp } = useHelpOverlay();

  const helpId = 'dataCleaning';

  const sourceRows = useMemo(() => normalizeDatasetRows(cleanedData ?? fullData ?? uploadedData), [cleanedData, fullData, uploadedData]);
  const sourcePreview = useMemo(() => sourceRows.slice(0, PREVIEW_LIMIT), [sourceRows]);
  const schema = uploadedData?.schema ?? uploadedData?.source?.schema;
  const sourceColumns = useMemo(() => previewColumns(sourcePreview, schema), [sourcePreview, schema]);
  const datasetName = workingDatasetName || uploadedData?.source?.name || uploadedData?.semantic_model?.dataset?.name;
  const workspaceVersion = workingWorkspace?.version;
  const sourceId = workingWorkspace?.primary_source_id;
  const currentPreview = previewResult?.recipe === steps && previewResult.sourceRows === sourceRows &&
    previewResult.sourceId === sourceId && previewResult.workspaceVersion === workspaceVersion ? previewResult : null;
  const columns = currentPreview ? Array.from(new Set([...sourceColumns, ...currentPreview.columns])) : sourceColumns;
  const hasDataset = Boolean(sourceId || uploadedData || sourceRows.length);

  useEffect(() => {
    setLoading(false);
    return () => {
      refineInFlight.current?.abort();
      refineInFlight.current = null;
    };
  }, [sourceRows, sourceId, workspaceVersion]);

  const recordPreview = (rows, rowCount, schema) => {
    setPreviewResult({ rows, rowCount, columns: previewColumns(rows, schema), recipe: steps, sourceRows, sourceId, workspaceVersion });
  };

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
    if (mlStudioMode || loading || !sourceRows.length) return;
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
    if (mlStudioMode || loading) return;
    const category = TRANSFORM_LIBRARY.find((c) => c.transforms.some((t) => t.type === step.type))?.category;
    if (category) setSelectedCategory(category);
    setSelectedTransform(step.type);
    setFormValues(step.params);
    setEditingId(step.id);
    setError(null);
    setSuccess(null);
  };

  const deleteStep = (id) => {
    if (mlStudioMode || loading) return;
    setSuccess(null);
    setSteps((prev) => prev.filter((s) => s.id !== id));
    if (editingId === id) {
      setEditingId(null);
      const active = transformLookup[selectedTransform];
      if (active) setFormValues(buildDefaultValues(active.fields));
    }
  };

  const moveStep = (index, direction) => {
    if (mlStudioMode || loading) return;
    setSuccess(null);
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

  const runWorkingRefine = async (steps, previewOnly) => {
    const controller = new AbortController();
    refineInFlight.current = controller;
    const fields = {
      workspace_id: workingWorkspace.workspace_id, workspace_version: workingWorkspace.version,
      source_id: workingWorkspace.primary_source_id, steps,
    };
    const signature = JSON.stringify(fields);
    const fingerprint = refinePreview.current?.signature === signature ? refinePreview.current.fingerprint : undefined;
    if (!previewOnly && (refineOperation.current?.signature !== signature || refineOperation.current?.fingerprint !== fingerprint)) {
      refineOperation.current = { signature, fingerprint, id: window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}` };
    }
    const payload = previewOnly ? fields : { ...fields, request_id: refineOperation.current.id, ...(fingerprint && { source_fingerprint: fingerprint }) };
    const endpoint = previewOnly ? 'refine-preview' : 'refine-working';
    try {
      const { data } = await axios.post(`${API_URL}/api/datahub/${endpoint}`, payload, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (previewOnly) {
        refinePreview.current = { signature, fingerprint: data.source_fingerprint };
        recordPreview(data.preview || [], data.row_count, data.schema);
        setSuccess('Preview updated');
      } else {
        if (!data.workspace?.workspace_id || !data.analysis_context || !Array.isArray(data.full_data)) throw new Error('Incomplete Refine result. Try again.');
        onWorkingRefine(data);
      }
    } catch (err) {
      if (!controller.signal.aborted) setError(err.response?.data?.error?.message || err.message || 'Failed to apply cleaning steps.');
    } finally {
      if (!controller.signal.aborted) {
        refineInFlight.current = null;
        setLoading(false);
      }
    }
  };

  const runCleaning = async (previewOnly = true) => {
    if (mlStudioMode || loading || refineInFlight.current || !sourceRows.length) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    if (workingWorkspace && onWorkingRefine) {
      if (!previewOnly) onApplyingRefine?.(true);
      try {
        await runWorkingRefine(buildStepPayload(), previewOnly);
      } finally {
        if (!previewOnly) onApplyingRefine?.(false);
      }
      return;
    }
    const controller = new AbortController();
    refineInFlight.current = controller;
    try {
      const response = await axios.post(`${API_URL}/api/manual_cleaning`, {
        steps: buildStepPayload(),
        preview_only: previewOnly,
      }, { signal: controller.signal });
      if (controller.signal.aborted) return;
      const { preview, cleaned_data, semantic_model } = response.data;
      recordPreview(preview || [], response.data.row_count ?? cleaned_data?.length);
      if (!previewOnly) {
        setCleanedData(cleaned_data);
        if (semantic_model) {
          setSemanticModel(semantic_model);
        } else {
          refreshSemanticModelFromDataset(cleaned_data, { source: 'manual_cleaning_apply', preserveUserMetrics: true });
        }
        setSuccess('Cleaning applied and dataset updated.');
        if (embedded) {
          setSteps([]);
          setEditingId(null);
          setSelectedTransform(null);
        }
        if (setShowDataPreview) setShowDataPreview(true);
        if (onApplyComplete) onApplyComplete();
      } else {
        setSuccess('Preview updated');
      }
    } catch (err) {
      if (!controller.signal.aborted) setError(err.response?.data?.error?.message || err.response?.data?.error || err.message || 'Failed to apply cleaning steps.');
    } finally {
      if (!controller.signal.aborted) {
        refineInFlight.current = null;
        setLoading(false);
      }
    }
  };

  if (embedded && !visible) return null;

  const activeTransform = transformLookup[selectedTransform];

  const editor = (
      <div className={`manual-cleaning-shell${embedded ? ' manual-cleaning-shell--embedded' : ''}`}
        role={mlStudioMode ? undefined : embedded ? 'region' : 'dialog'}
        aria-modal={mlStudioMode || embedded ? undefined : true} aria-labelledby="refine-editor-title">
        <div className="manual-cleaning-header">
          <div className="header-left">
            <div className="header-title">
              <h2 id="refine-editor-title">Power Query Editor</h2>
              {mlStudioMode ? (
                 <p className="subtitle">
                   Experiment: {mlStudioOpeningContext?.title} ({mlStudioOpeningContext?.experiment_id}) | Workspace: {mlStudioOpeningContext?.workspace_id} | Snapshot: {mlStudioOpeningContext?.snapshot_id}
                 </p>
              ) : (
                 <p className="subtitle">{datasetName || (hasDataset ? 'Current dataset' : 'No dataset selected')}</p>
              )}
            </div>
          </div>
          <div className="header-actions">
            {!mlStudioMode && (
              <>
                <button className="preview-trigger" onClick={() => runCleaning(true)} disabled={!sourceRows.length || steps.length === 0 || loading}>
                  Run Preview
                </button>
                <button className="apply-trigger" onClick={() => runCleaning(false)} disabled={!sourceRows.length || steps.length === 0 || loading}>
                  Apply All
                </button>
              </>
            )}
            {mlStudioMode && (
                <button className="apply-trigger" onClick={closeForm}>
                  Return to Prepare Data
                </button>
            )}
            <button
              type="button"
              className="help-overlay-trigger"
              onClick={() => toggleHelp(helpId)}
            >
              ❓
            </button>
            {!embedded && <CloseButton onClick={closeForm} />}
          </div>
        </div>

        <div className="manual-cleaning-body">
          {/* Top Ribbon */}
          {!mlStudioMode && (
             <CleaningRibbon
               selectedCategory={selectedCategory}
               onSelectCategory={setSelectedCategory}
               selectedTransform={selectedTransform}
               onSelectTransform={(type) => {
                 setSelectedTransform(type);
                 setEditingId(null);
                 setFormValues(buildDefaultValues(transformLookup[type]?.fields));
                 setSuccess(null);
                 setError(null);
               }}
             />
          )}

          {/* Configuration Panel (Collapsible/Conditional) */}
          {!mlStudioMode && activeTransform && (
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
                  <button type="button" onClick={addStep} className="add-step-btn" disabled={loading || !sourceRows.length}>
                    {editingId ? 'Update Step' : 'Add Step'}
                  </button>
               </div>
             </div>
          )}

          {/* Messages */}
          {(error || success) && (
            <div className={`status-bar ${error ? 'error' : 'success'}`} role={error ? 'alert' : 'status'}>
              {error || success}
            </div>
          )}

          {/* Main Workspace: applied steps (left/right) + preview (center/bottom) */}
          <div className="workspace-area">
             {mlStudioMode ? (
               <div className="ml-prep-panel">
                  <h3>Suggested Preparation Step</h3>
                  <div className="ml-prep-card info">
                     <div className="ml-prep-card-header">
                       <span className="ml-prep-card-title">Affected Column: {mlStudioOpeningContext?.field}</span>
                     </div>
                     <p className="ml-prep-card-reason"><strong>Action:</strong> {mlStudioOpeningContext?.action}</p>
                     <p className="ml-prep-card-action"><strong>Explanation:</strong> {mlStudioOpeningContext?.explanation}</p>
                  </div>
                  {steps.length > 0 && (
                    <div className="config-panel">
                       <div className="config-header">
                         <h3>Step Parameters</h3>
                       </div>
                       <pre className="ml-prep-card">
                          {JSON.stringify(steps[0].params, null, 2)}
                       </pre>
                    </div>
                  )}
                  <p className="text-muted ml-prep-hint">
                    Previewing and applying changes will arrive separately in a future update. The global dataset preview is hidden to ensure safe isolation of your saved experiment.
                  </p>
               </div>
             ) : (
               <>
                 <DataCleaningPreview
                   rows={currentPreview?.rows ?? sourcePreview}
                   columns={currentPreview?.columns ?? sourceColumns}
                   totalRows={currentPreview?.rowCount ?? sourceRows.length}
                   isResult={Boolean(currentPreview)}
                   hasDataset={hasDataset}
                 />
                 <div className="sidebar-right">
                    <AppliedStepsList
                      steps={steps}
                      editingId={editingId}
                      onEditStep={editStep}
                      onDeleteStep={deleteStep}
                      onMoveStep={moveStep}
                    />
                 </div>
               </>
             )}
          </div>

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
              </div>
            </div>
          )}
        </div>
      </div>
  );

  if (mlStudioMode) return <div className="cleaning-form-overlay">{editor}</div>;
  if (embedded) return editor;

  return <Modal open onClose={closeForm} hideBackdrop className="cleaning-form-overlay">{editor}</Modal>;
}

export default DataCleaningForm;
