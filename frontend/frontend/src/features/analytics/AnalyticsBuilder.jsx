import React, { useState } from 'react';
import {
  TbCalendar, TbChevronRight, TbColumns, TbGripVertical, TbHash, TbLetterCase,
  TbPlus, TbSearch, TbSwitchHorizontal, TbX,
} from 'react-icons/tb';
import AnalyticsMeasureEditor, { AGGREGATION_LABELS } from './AnalyticsMeasureEditor';
import AnalyticsQueryOptions from './AnalyticsQueryOptions';
import AnalyticsVisualPicker from './AnalyticsVisualPicker';
import AnalyticsWorkbench from './AnalyticsWorkbench';
import { remapAnalysis } from './analyticsTransforms';
import './AnalyticsBuilder.css';

const FIELD_DRAG_TYPE = 'application/x-datastream-analytics-field';
const FIELD_TYPES = [['all', 'All'], ['number', 'Numbers'], ['string', 'Text'], ['date', 'Dates']];
const GRAINS = ['day', 'week', 'month', 'quarter', 'year'];
const FIELD_MARKS = { number: TbHash, date: TbCalendar, string: TbLetterCase };

function FieldWell({ target, active, over, choosing, onChoose, onAssign, onDragOver, onDragLeave, onDrop }) {
  const accepts = !!active && target.candidates.some(field => field.name === active.name);
  const state = !active ? 'idle' : accepts ? over ? 'over' : 'ready' : 'blocked';
  const action = accepts
    ? `${over ? target.replace ? 'Drop to replace with' : 'Drop' : target.replace ? 'Replace with' : 'Add'} ${active.name}`
    : active ? `Cannot place ${active.name} in ${target.title}` : `Drop a field or click to add to ${target.title}`;

  return <section className="analytics-field-well" aria-label={target.title} data-drop-state={state}
    onDragEnter={onDragOver} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
    <div className="analytics-well-heading">
      <target.icon aria-hidden="true" /><h3>{target.title}</h3>
      {target.count > 0 && <span>{target.count}</span>}
    </div>
    {target.entries}
    <button type="button" className="analytics-well-add" aria-label={action} aria-expanded={choosing ? true : undefined}
      disabled={active ? !accepts : !target.candidates.length}
      onClick={() => accepts ? onAssign(active) : onChoose()}>
      <TbPlus aria-hidden="true" /><span>{active ? accepts ? action : 'Field unavailable here' : 'Drop a field or click to add'}</span>
    </button>
    {choosing && <label className="analytics-well-picker">Field for {target.title}
      <select autoFocus value="" onChange={event => {
        const field = target.candidates.find(option => option.name === event.target.value);
        if (field) onAssign(field);
      }}>
        <option value="" disabled>Choose a field</option>
        {target.candidates.map(field => <option key={field.name}>{field.name}</option>)}
      </select>
    </label>}
    <small className="analytics-well-hint">{active && !accepts ? target.blocked : target.hint}</small>
    {target.footer}
  </section>;
}

function MeasureRow({ measure, index, editing, fallback, fields, metrics, onToggle, onChange, onRemove }) {
  const governed = metrics.find(metric => metric.id === measure.metric_id);
  const label = measure.label || governed?.label || governed?.name || measure.metric_id ||
    (measure.formula ? measure.id : measure.aggregation === 'count_rows' ? 'Rows' : measure.field || 'Unnamed measure');
  const method = measure.metric_id ? 'Governed metric' : measure.formula ? 'Formula' : AGGREGATION_LABELS[measure.aggregation || 'sum'];
  return <div className={`analytics-author-measure ${editing ? 'is-editing' : ''}`}>
    <div className="analytics-author-assignment">
      <button type="button" className="analytics-author-measure-toggle" aria-expanded={editing} aria-label={`Configure measure ${label}`} onClick={onToggle}>
        <span className="analytics-author-measure-mark" aria-hidden="true">Σ</span>
        <span className="analytics-author-measure-name"><strong>{label}</strong><small>{fallback ? 'Default row count' : method}</small></span>
        <TbChevronRight className="analytics-author-measure-chevron" aria-hidden="true" />
      </button>
      <button type="button" className="analytics-author-icon" disabled={!onRemove} aria-label={`Remove measure ${label}`} onClick={onRemove}><TbX /></button>
    </div>
    {editing && <AnalyticsMeasureEditor measure={measure} index={index} fields={fields} metrics={metrics} onChange={onChange} />}
  </div>;
}

export default function AnalyticsBuilder({ config, fields, metrics = [], sourceLoading, replaceDefaultValue = false, onChange, results }) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedName, setSelectedName] = useState(null);
  const [draggedName, setDraggedName] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [choosing, setChoosing] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingMeasure, setEditingMeasure] = useState(null);
  const [showRemap, setShowRemap] = useState(false);
  const [oldField, setOldField] = useState('');
  const [newField, setNewField] = useState('');
  const [announcement, setAnnouncement] = useState('');

  const { query, view } = config;
  const activeField = fields.find(field => field.name === (draggedName || selectedName));
  const groups = query.group_by || [];
  const measures = query.measures || [];
  const firstMeasure = measures[0];
  const fallback = replaceDefaultValue && measures.length === 1 && firstMeasure.id === 'value' && firstMeasure.label === 'Rows' &&
    firstMeasure.aggregation === 'count_rows' && !firstMeasure.field && !firstMeasure.metric_id && !firstMeasure.formula &&
    (!firstMeasure.post || firstMeasure.post === 'none');
  const singleSeries = view === 'pie' || view === 'doughnut';
  const detailRows = view === 'table' && query.mode === 'rows';
  const timeAxis = ['line', 'area', 'stacked_area'].includes(view);
  const columns = query.columns || [];
  const histogramField = query.field ?? measures[0]?.field;
  const visibleFields = fields.filter(field =>
    (typeFilter === 'all' || field.type === typeFilter) && field.name.toLowerCase().includes(search.trim().toLowerCase()));

  const changeQuery = patch => onChange({ ...config, query: { ...query, ...patch } });
  const nextMeasureId = (list = measures) => {
    const reserved = new Set([...fields.map(field => field.name), ...list.map(measure => measure.id)]);
    let index = 1;
    while (reserved.has(`m${index}`)) index += 1;
    return `m${index}`;
  };
  const fromField = (field, id = nextMeasureId()) => ({
    id, label: field.name, field: field.name, aggregation: field.type === 'number' ? 'sum' : 'count_distinct',
  });
  const replaceSort = (oldName, nextName) => query.sort && query.sort.field === oldName
    ? { sort: nextName ? { ...query.sort, field: nextName } : undefined } : {};
  const removeGroup = name => changeQuery({ group_by: groups.filter(group => group.field !== name), ...replaceSort(name) });
  const removeMeasure = index => {
    changeQuery({ measures: measures.filter((_, position) => position !== index), ...replaceSort(measures[index].id) });
    setEditingMeasure(null);
  };
  const chooseView = nextView => {
    if (nextView !== view) onChange({ ...config, view: nextView, query: { ...query, mode: 'aggregate' } });
    setPickerOpen(false);
    setEditingMeasure(null);
    setChoosing(null);
  };
  const assign = (target, field) => {
    if (!target.candidates.some(candidate => candidate.name === field?.name)) return;
    target.assign(field);
    setAnnouncement(`${field.name} assigned to ${target.title}.`);
    setSelectedName(null);
    setDraggedName(null);
    setHovered(null);
    setChoosing(null);
  };
  const scalarRow = (name, clear) => name && <div className="analytics-author-assignment analytics-author-scalar">
    <span>{name}</span><button type="button" className="analytics-author-icon" aria-label={`Remove ${name}`} onClick={clear}><TbX /></button>
  </div>;

  const groupTarget = {
    id: 'categories', icon: TbColumns,
    title: view === 'pivot' ? 'Grouping fields' : ['kpi', 'table'].includes(view) ? 'Group rows' : timeAxis ? 'Time or category axis' : 'Category axis',
    hint: view === 'pivot' ? 'Add at least two fields. The last becomes columns.' : timeAxis ? 'Add a date or an ordered category.' : 'Add fields to group records together.',
    blocked: 'Choose an unused field or remove an assignment to make room.',
    count: groups.length,
    replace: singleSeries && groups.length === 1,
    candidates: groups.length >= (singleSeries ? 2 : 4) ? [] : fields.filter(field => !groups.some(group => group.field === field.name)),
    assign: field => {
      const group = { field: field.name, ...(field.type === 'date' && timeAxis ? { grain: 'day' } : {}) };
      if (singleSeries && groups.length) changeQuery({ group_by: [group], ...replaceSort(groups[0].field, field.name) });
      else changeQuery({ group_by: [...groups, group] });
    },
    entries: groups.map((group, index) => <div className="analytics-author-assignment analytics-author-group" key={group.field}>
      <div><strong>{group.field}</strong>{view === 'pivot' && groups.length > 1 && <small>{index === groups.length - 1 ? 'Columns' : 'Rows'}</small>}</div>
      <select aria-label={`Date grain for ${group.field}`} title="Date grouping" value={group.grain || ''}
        onChange={event => changeQuery({ group_by: groups.map((item, position) => position === index ? { ...item, grain: event.target.value || undefined } : item) })}>
        <option value="">As is</option>{GRAINS.map(grain => <option key={grain}>{grain}</option>)}
      </select>
      <button type="button" className="analytics-author-icon" aria-label={`Remove grouping ${group.field}`} onClick={() => removeGroup(group.field)}><TbX /></button>
    </div>),
  };
  const measureTarget = {
    id: 'values', title: singleSeries ? 'Value' : 'Values', icon: TbHash,
    hint: fallback ? 'Add a field to replace the default row count.' : singleSeries ? 'Use one measure. Add a field to replace the value.' : 'Add fields to summarize or configure a measure.',
    blocked: 'Remove a measure before adding another.',
    count: measures.length,
    replace: fallback || (singleSeries && measures.length === 1),
    candidates: measures.length >= (singleSeries ? 2 : 12) ? [] : fields,
    assign: field => {
      if (fallback || (singleSeries && measures.length)) changeQuery({ measures: [fromField(field, measures[0].id)] });
      else changeQuery({ measures: [...measures, fromField(field)] });
    },
    entries: measures.map((measure, index) => <MeasureRow key={index} measure={measure} index={index} editing={editingMeasure === index} fallback={fallback}
      fields={fields} metrics={metrics} onToggle={() => setEditingMeasure(previous => previous === index ? null : index)}
      onRemove={measures.length > 1 ? () => removeMeasure(index) : undefined}
      onChange={patch => changeQuery({
        measures: measures.map((item, position) => position === index ? { ...item, ...patch } : item),
        ...(patch.id === undefined ? {} : replaceSort(measure.id, patch.id)),
      })} />),
    footer: !singleSeries && measures.length < 12 && <button type="button" className="analytics-author-link" onClick={() => {
      changeQuery({ measures: [...measures, { id: nextMeasureId(), aggregation: 'count_rows' }] });
      setEditingMeasure(measures.length);
    }}>New measure <TbChevronRight aria-hidden="true" /></button>,
  };
  const scatterTargets = () => ['X axis', 'Y axis'].map((title, index) => {
    const fieldName = measures[index]?.field;
    const update = field => {
      const list = [...measures];
      while (list.length <= index) list.push({ id: nextMeasureId(list), aggregation: 'count_rows' });
      const { id } = list[index];
      list[index] = field ? fromField(field, id) : { id, aggregation: 'count_rows' };
      changeQuery({ measures: list });
    };
    return {
      id: `scatter-${index}`, title, icon: TbHash, hint: 'Use a numeric field.', blocked: 'Choose a different numeric field.',
      replace: !!fieldName, count: fieldName ? 1 : 0,
      candidates: fields.filter(field => field.type === 'number' && field.name !== measures[1 - index]?.field),
      assign: update, entries: scalarRow(fieldName, () => update(null)),
    };
  });
  const histogramTarget = {
    id: 'histogram', title: 'Numeric field', icon: TbHash,
    hint: 'Values are grouped into intervals.', blocked: 'This visual only accepts numeric fields.',
    replace: !!histogramField,
    count: histogramField ? 1 : 0,
    candidates: fields.filter(field => field.type === 'number'),
    assign: field => changeQuery({ field: field.name }),
    entries: scalarRow(histogramField, () => changeQuery({ field: '' })),
    footer: <label className="analytics-author-bins">Bins<input type="number" min="1" max="100" value={query.bins ?? 10}
      onChange={event => changeQuery({ bins: Number(event.target.value) })} /></label>,
  };
  const detailTarget = {
    id: 'columns', title: 'Columns', icon: TbColumns,
    hint: 'Add the fields to show in the table. An empty list shows all fields.', blocked: 'Choose a field that is not already listed.',
    count: columns.length,
    candidates: columns.length >= 100 ? [] : fields.filter(field => !columns.includes(field.name)),
    assign: field => changeQuery({ columns: [...columns, field.name] }),
    entries: columns.map(name => <React.Fragment key={name}>{scalarRow(name, () => changeQuery({ columns: columns.filter(field => field !== name), ...replaceSort(name) }))}</React.Fragment>),
  };
  const targets = view === 'scatter' ? scatterTargets() : view === 'histogram' ? [histogramTarget] :
    detailRows ? [detailTarget] : view === 'kpi' ? [measureTarget, groupTarget] : [groupTarget, measureTarget];
  const assignmentAvailable = activeField && targets.some(target => target.candidates.some(field => field.name === activeField.name));
  const note = activeField
    ? assignmentAvailable ? `${activeField.name} selected. Choose a highlighted target.` : `${activeField.name} does not fit the available targets.`
    : 'Drag a field or select it to choose a target.';
  const canDrop = target => !!draggedName && target.candidates.some(field => field.name === draggedName);

  const fieldContents = <div className="analytics-author-fields">
      {showRemap && <div className="analytics-author-option-editor">
        <label>Original field<input value={oldField} onChange={event => setOldField(event.target.value)} /></label>
        <label>Replacement field<select value={newField} onChange={event => setNewField(event.target.value)}>
          <option value="">Choose field</option>{fields.map(field => <option key={field.name}>{field.name}</option>)}
        </select></label>
        <button type="button" disabled={!oldField || !newField} onClick={() => { onChange(remapAnalysis(config, { [oldField]: newField })); setShowRemap(false); }}>Remap field</button>
      </div>}
      <div className="analytics-author-field-controls">
        <div className="analytics-search-box"><TbSearch className="analytics-search-icon" /><input aria-label="Search fields" placeholder="Search fields" value={search} onChange={event => setSearch(event.target.value)} /></div>
        <div className="analytics-author-field-types" role="group" aria-label="Filter fields by type">
          {FIELD_TYPES.map(([type, label]) => <button key={type} type="button" aria-pressed={typeFilter === type} onClick={() => setTypeFilter(type)}>{label}</button>)}
        </div>
      </div>
      <div className="analytics-author-field-list">
        {visibleFields.map(field => {
          const Icon = FIELD_MARKS[field.type] || TbLetterCase;
          return <button key={field.name} type="button" className={`analytics-author-field is-${field.type}`}
            draggable aria-pressed={selectedName === field.name || draggedName === field.name} aria-label={`Select field ${field.name}`}
            title={field.examples?.length ? `${field.name} · ${field.examples.join(', ')}` : field.name}
            onClick={() => { setSelectedName(previous => previous === field.name ? null : field.name); setChoosing(null); setAnnouncement(''); }}
            onDragStart={event => {
              event.dataTransfer.setData(FIELD_DRAG_TYPE, field.name);
              event.dataTransfer.setData('text/plain', field.name);
              event.dataTransfer.effectAllowed = 'copy';
              setSelectedName(null); setDraggedName(field.name); setChoosing(null); setAnnouncement('');
            }}
            onDragEnd={() => { setDraggedName(null); setHovered(null); }}>
            <TbGripVertical className="analytics-author-grip" aria-hidden="true" /><span className="analytics-author-field-mark"><Icon aria-hidden="true" /></span>
            <span className="analytics-author-field-name">{field.name}</span>
          </button>;
        })}
        {!visibleFields.length && <p className="analytics-empty-hint">{sourceLoading ? 'Loading fields…' : config.source ? 'No matching fields.' : 'Choose a dataset to browse fields.'}</p>}
      </div>
      {fields.length > 0 && <p className="analytics-author-field-note" role="status">{announcement || note}</p>}
  </div>;

  const builderContents = <div className="analytics-author-panel">
      <AnalyticsVisualPicker view={view} open={pickerOpen} onToggle={() => setPickerOpen(value => !value)} onSelect={chooseView}
        onSuggest={() => chooseView(groups.some(group => group.grain) ? 'line' : groups.length ? 'bar' : 'kpi')} />
      <div className="analytics-author-mapping">
        <div className="analytics-author-mapping-title">
          <h3>Field mapping</h3>
          {activeField && <button type="button" className="analytics-author-icon" aria-label="Clear field selection" onClick={() => setSelectedName(null)}><TbX /></button>}
        </div>
        {targets.map(target => <FieldWell key={target.id} target={target} active={activeField} over={hovered === target.id} choosing={choosing === target.id}
          onChoose={() => setChoosing(previous => previous === target.id ? null : target.id)} onAssign={field => assign(target, field)}
          onDragOver={event => {
            if (!canDrop(target)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
            if (hovered !== target.id) setHovered(target.id);
          }}
          onDragLeave={event => {
            if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setHovered(null);
          }}
          onDrop={event => {
            event.preventDefault();
            const name = event.dataTransfer.getData(FIELD_DRAG_TYPE);
            assign(target, fields.find(field => field.name === name));
            setDraggedName(null);
            setHovered(null);
          }} />)}
        {singleSeries && (groups.length !== 1 || measures.length !== 1) &&
          <p className="analytics-author-requirement">This visual uses exactly one category and one value.</p>}
      </div>
      <AnalyticsQueryOptions query={query} view={view} fields={fields} onChange={changeQuery} />
  </div>;

  return <AnalyticsWorkbench fields={fieldContents} builder={builderContents} results={results}
    fieldDetails={sourceLoading ? 'Loading schema' : `${fields.length} available`}
    fieldActions={<button type="button" className="analytics-author-icon" aria-label="Remap fields" title="Remap fields"
      aria-expanded={showRemap} onClick={() => setShowRemap(value => !value)}><TbSwitchHorizontal aria-hidden="true" /></button>} />;
}
