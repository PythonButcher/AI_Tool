import React, { useState } from 'react';
import CleaningRibbon from './CleaningRibbon';
import AppliedStepsList from './AppliedStepsList';
import { TRANSFORM_LIBRARY, transformLookup, buildDefaultValues } from './CleaningConstants';

const list = value => Array.isArray(value) ? value : String(value || '').split(',').map(item => item.trim()).filter(Boolean);

export function normalizeCleaningStep({ type, params = {} }) {
  const normalized = { ...params };
  if (type === 'rename_columns' && Array.isArray(params.mappings)) {
    normalized.mappings = Object.fromEntries(params.mappings.filter(row => row.from && row.to).map(row => [row.from, row.to]));
  }
  if (type === 'reorder_columns') normalized.order = list(params.order);
  if (type === 'split_column') normalized.new_columns = list(params.new_columns);
  if (type === 'remove_duplicates') normalized.keep = params.keep === 'false' ? false : (params.keep ?? 'first');
  return { type, params: normalized };
}

const recordFields = {
  conditions: [['column', 'column'], ['operator', ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'not_contains', 'in', 'not_in', 'startswith', 'endswith']], ['value', 'text']],
  replacements: [['from', 'text'], ['to', 'text']],
  aggregations: [['column', 'column'], ['agg', ['sum', 'mean', 'count', 'max', 'min']], ['as', 'text']],
  'sort-rules': [['column', 'column'], ['direction', ['asc', 'desc']]],
  'rename-map': [['from', 'column'], ['to', 'text']],
};

// Use the same transformation catalog, ribbon and step controls as Power Query.
// The caller owns recipe persistence; these controls edit only an unsaved plan.
export default function TransformationPlanEditor({ steps, onChange, columns, disabled, onEditingChange }) {
  const [category, setCategory] = useState(TRANSFORM_LIBRARY[0].category);
  const [selected, setSelected] = useState(null);
  const [values, setValues] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [valueType, setValueType] = useState('text');
  const active = transformLookup[selected];
  const choose = type => {
    setSelected(type); setValues(buildDefaultValues(transformLookup[type]?.fields)); setEditingId(null); setError('');
    setValueType('text');
    onEditingChange?.(true);
  };
  const update = (name, value) => setValues(previous => ({ ...previous, [name]: value }));
  const edit = step => {
    setCategory(TRANSFORM_LIBRARY.find(group => group.transforms.some(item => item.type === step.type))?.category || category);
    setSelected(step.type); setEditingId(step.id); setError('');
    const params = { ...step.params };
    setValueType(typeof params.value === 'number' ? 'number' : typeof params.value === 'boolean' ? 'boolean' : 'text');
    if (step.type === 'rename_columns' && !Array.isArray(params.mappings)) params.mappings = Object.entries(params.mappings || {}).map(([from, to]) => ({ from, to }));
    if (step.type === 'split_column' && Array.isArray(params.new_columns)) params.new_columns = params.new_columns.join(', ');
    if (step.type === 'reorder_columns') params.order = list(params.order).join(', ');
    setValues({ ...buildDefaultValues(transformLookup[step.type]?.fields), ...params });
    onEditingChange?.(true);
  };
  const reset = () => { setSelected(null); setEditingId(null); setError(''); onEditingChange?.(false); };
  const save = () => {
    if (!active) return;
    if (!editingId && steps.length >= 100) { setError('A recipe can contain at most 100 steps.'); return; }
    const params = { ...values };
    if (selected === 'replace_nulls' && params.strategy === 'value') {
      if (valueType === 'number') {
        if (String(params.value).trim() === '' || !Number.isFinite(Number(params.value))) { setError('Enter a finite replacement number.'); return; }
        params.value = Number(params.value);
      } else if (valueType === 'boolean') {
        if (!['true', 'false'].includes(String(params.value).toLowerCase())) { setError('Enter true or false for a boolean replacement.'); return; }
        params.value = String(params.value).toLowerCase() === 'true';
      }
    }
    if (selected === 'filter_rows') params.conditions = (params.conditions || []).map(row => ({ ...row,
      value: ['in', 'not_in'].includes(row.operator) ? list(row.value) : row.value }));
    const step = { ...normalizeCleaningStep({ type: selected, params }), id: editingId || `step-${Date.now()}-${Math.random()}`, label: active.label };
    onChange(editingId ? steps.map(item => item.id === editingId ? step : item) : [...steps, step]);
    reset();
  };
  const columnOptions = <><option value="">Select column</option>{columns.map(column => <option key={column}>{column}</option>)}</>;
  const fieldInput = field => {
    const value = values[field.name];
    const records = recordFields[field.type];
    if (records) return <div className="ml-transform-records">
      {(Array.isArray(value) ? value : []).map((row, index) => <div className="ml-transform-record" key={index}>
        {records.map(([key, kind]) => {
          const change = next => update(field.name, value.map((item, rowIndex) => rowIndex === index ? { ...item, [key]: next } : item));
          const label = `${field.label} ${index + 1} ${key}`;
          return kind === 'column' ? <select key={key} aria-label={label} value={row[key] || ''} onChange={event => change(event.target.value)}>{columnOptions}</select>
            : Array.isArray(kind) ? <select key={key} aria-label={label} value={row[key] || kind[0]} onChange={event => change(event.target.value)}>{kind.map(option => <option key={option}>{option}</option>)}</select>
              : <input key={key} aria-label={label} placeholder={key} value={Array.isArray(row[key]) ? row[key].join(', ') : row[key] ?? ''} onChange={event => change(event.target.value)} />;
        })}
        <button type="button" aria-label={`Remove ${field.label} ${index + 1}`} onClick={() => update(field.name, value.filter((_, rowIndex) => rowIndex !== index))}>Remove</button>
      </div>)}
      <button type="button" onClick={() => update(field.name, [...(value || []), Object.fromEntries(records.map(([key, kind]) => [key, Array.isArray(kind) ? kind[0] : '']))])}>Add {field.label.toLowerCase()}</button>
    </div>;
    if (field.type === 'column-multi') return <select aria-label={field.label} multiple value={Array.isArray(value) ? value : []}
      onChange={event => update(field.name, Array.from(event.target.selectedOptions, option => option.value))}>{columns.map(column => <option key={column}>{column}</option>)}</select>;
    if (field.type === 'column') return <select aria-label={field.label} value={value || ''} onChange={event => update(field.name, event.target.value)}>{columnOptions}</select>;
    if (field.type === 'select') return <select aria-label={field.label} value={String(value ?? field.defaultValue ?? '')} onChange={event => update(field.name, event.target.value)}>
      {field.options.map(option => <option key={String(option.value)} value={String(option.value)}>{option.label}</option>)}</select>;
    if (field.type === 'checkbox') return <input aria-label={field.label} type="checkbox" checked={Boolean(value)} onChange={event => update(field.name, event.target.checked)} />;
    return <input aria-label={field.label} type={field.type === 'number' ? 'number' : 'text'} value={value ?? ''}
      onChange={event => update(field.name, field.type === 'number' ? Number(event.target.value) : event.target.value)} />;
  };
  return <fieldset className="ml-transform-plan" disabled={disabled}>
    <legend>Transformations</legend>
    <CleaningRibbon selectedCategory={category} onSelectCategory={setCategory} selectedTransform={selected} onSelectTransform={choose} />
    {active && <section className="ml-transform-form" aria-label={`${active.label} settings`}>
      <h3>{editingId ? 'Edit' : 'Add'} {active.label}</h3><p>{active.description}</p>
      {selected === 'replace_nulls' && ['mean', 'median', 'mode', 'bfill', 'ffill'].includes(values.strategy) && <p className="ml-transform-caution">For ML inputs, prefer handling missing values during training. Whole-dataset statistics or filling across time/series can leak information into evaluation.</p>}
      <div className="ml-transform-fields">{active.fields.map(field => <div className="ml-transform-field" key={field.name}><span>{field.label}</span>{fieldInput(field)}</div>)}</div>
      {selected === 'replace_nulls' && values.strategy === 'value' && <label className="ml-transform-field">Replacement value type<select value={valueType} onChange={event => setValueType(event.target.value)}><option value="text">Text</option><option value="number">Number</option><option value="boolean">Boolean</option></select></label>}
      {error && <p role="alert">{error}</p>}
      <div className="ml-transform-actions"><button type="button" onClick={save}>{editingId ? 'Update step' : 'Add step'}</button><button type="button" onClick={reset}>Discard step edit</button></div>
    </section>}
    <AppliedStepsList steps={steps.map(step => ({ ...step, label: transformLookup[step.type]?.label || step.type }))} editingId={editingId}
      onEditStep={edit} onDeleteStep={id => { onChange(steps.filter(step => step.id !== id)); if (editingId === id) reset(); }}
      onMoveStep={(index, direction) => {
        const next = [...steps], destination = index + direction;
        if (destination < 0 || destination >= next.length) return;
        [next[index], next[destination]] = [next[destination], next[index]];
        onChange(next);
      }} />
  </fieldset>;
}
