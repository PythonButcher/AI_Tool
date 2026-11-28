import React, { useEffect, useRef, useState } from 'react';
import {
  TbAlertCircle, TbArrowBarToDown, TbCalendar, TbCheck, TbChevronRight, TbColumns, TbGripVertical,
  TbHash, TbLetterCase, TbPlus, TbRotateClockwise, TbSearch, TbSwitchHorizontal, TbX,
} from 'react-icons/tb';
import AnalyticsMeasureEditor, { AGGREGATION_LABELS } from './AnalyticsMeasureEditor';
import AnalyticsQueryOptions from './AnalyticsQueryOptions';
import AnalyticsVisualPicker from './AnalyticsVisualPicker';
import AnalyticsWorkbench from './AnalyticsWorkbench';
import { remapAnalysis } from './analyticsTransforms';
import './AnalyticsBuilder.css';

const FIELD_DRAG_TYPE = 'application/x-devstream-analytics-field';
const FIELD_TYPES = [['all', 'All'], ['number', 'Numbers'], ['string', 'Text'], ['date', 'Dates']];
const TYPE_LABELS = { number: 'Number', string: 'Text', date: 'Date' };
const AGG_SHORT = {
  sum: 'SUM', avg: 'AVG', min: 'MIN', max: 'MAX', count: 'CNT',
  count_distinct: 'UNIQ', count_rows: 'ROWS', median: 'MED', percentile: 'PCT',
};
const GRAINS = ['day', 'week', 'month', 'quarter', 'year'];
const FIELD_MARKS = { number: TbHash, date: TbCalendar, string: TbLetterCase };

function FieldTypeMark({ type = 'string' }) {
  const Icon = FIELD_MARKS[type] || TbLetterCase;
  return <span className={`analytics-author-field-mark is-${type}`} aria-hidden="true"><Icon /></span>;
}

function FieldWell({ target, active, over, choosing, onChoose, onCloseMenu, onAssign, onDragOver, onDragLeave, onDrop }) {
  const wellRef = useRef(null);
  const addRef = useRef(null);
  const [menuQuery, setMenuQuery] = useState('');
  const accepts = !!active && target.candidates.some(field => field.name === active.name);
  const state = !active ? 'idle' : accepts ? over ? 'over' : 'ready' : 'blocked';
  const action = accepts
    ? `${over ? target.replace ? 'Drop to replace with' : 'Drop' : target.replace ? 'Replace with' : 'Add'} ${active.name}`
    : active ? `Cannot place ${active.name} in ${target.title}` : target.replace ? `Replace field in ${target.title}` : `Add field to ${target.title}`;
  const idleLabel = target.replace ? 'Drop field to replace' : target.count > 0 ? 'Drop another field' : `Drop ${target.dropNoun || 'field'} here`;
  const idleSub = target.replace ? 'or click to swap' : target.count > 0 ? 'or click to add' : 'or click to choose from list';
  const activeSub = over ? `Release to place in ${target.title}` : accepts ? `Click or drop into ${target.title}` : target.blocked;
  const DropIcon = target.count === 0 || active ? TbArrowBarToDown : TbPlus;
  const filteredCandidates = menuQuery.trim()
    ? target.candidates.filter(field => field.name.toLowerCase().includes(menuQuery.trim().toLowerCase()))
    : target.candidates;
  const statusText = target.count > 0
    ? (target.maxSlots === 1 ? '1 / 1' : `${target.count} placed`)
    : (target.required ? 'Required' : 'Optional');

  useEffect(() => {
    if (!choosing) {
      setMenuQuery('');
      return undefined;
    }
    const dismiss = event => {
      if (!wellRef.current?.contains(event.target)) onCloseMenu();
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [choosing, onCloseMenu]);

  return <section ref={wellRef}
    className={`analytics-field-well${target.count > 0 ? ' is-populated' : target.required ? ' is-required-empty' : ''}`}
    aria-label={target.title} data-drop-state={state}
    onDragEnter={onDragOver} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
    onKeyDown={event => {
      if (event.key === 'Escape' && choosing) {
        event.stopPropagation();
        onCloseMenu();
        addRef.current?.focus();
      }
    }}>
    <div className="analytics-well-header">
      <div className="analytics-well-heading">
        <target.icon aria-hidden="true" />
        <h3>{target.title}</h3>
        <span className={`analytics-well-status${target.count > 0 ? ' is-set' : target.required ? ' is-required' : ''}`}>{statusText}</span>
      </div>
      <p className="analytics-well-purpose">
        <span>{target.purpose}</span>
        {target.acceptsLabel && <span className="analytics-well-accepts">{target.acceptsLabel}</span>}
      </p>
    </div>
    {target.entries && <div className="analytics-well-items">{target.entries}</div>}
    <button ref={addRef} type="button" className={`analytics-well-add${target.count === 0 ? ' is-empty-zone' : ''}`} aria-label={action} aria-expanded={choosing ? true : undefined}
      disabled={active ? !accepts : !target.candidates.length}
      onClick={() => accepts ? onAssign(active) : onChoose()}>
      <span className="analytics-well-drop-icon" aria-hidden="true"><DropIcon /></span>
      <span className="analytics-well-add-copy">
        <span className="analytics-well-add-text">{active ? accepts ? action : 'Unavailable for this role' : idleLabel}</span>
        {(target.count === 0 || active) && (
          <small className="analytics-well-drop-cue" aria-hidden="true">{active ? activeSub : idleSub}</small>
        )}
      </span>
      {!active && target.count > 0 && target.candidates.length > 0 && (
        <span className="analytics-well-drop-cue" aria-hidden="true">{idleSub}</span>
      )}
    </button>
    {choosing && <div className="analytics-well-menu" role="group" aria-label={`Choose field for ${target.title}`}>
      <div className="analytics-well-menu-head">
        <span>Compatible fields ({filteredCandidates.length})</span>
        <button type="button" className="analytics-author-icon" aria-label={`Close ${target.title} chooser`} onClick={() => { onCloseMenu(); addRef.current?.focus(); }}><TbX /></button>
      </div>
      {target.candidates.length > 4 && (
        <div className="analytics-search-box analytics-well-search">
          <TbSearch className="analytics-search-icon" />
          <input aria-label={`Filter fields for ${target.title}`} placeholder="Filter fields…" value={menuQuery} onChange={event => setMenuQuery(event.target.value)} autoFocus />
        </div>
      )}
      <div className="analytics-well-menu-list">
        {filteredCandidates.map((field, index) => (
          <button key={field.name} type="button" className="analytics-well-option" autoFocus={target.candidates.length <= 4 && index === 0}
            aria-label={`Assign ${field.name} to ${target.title}`} onClick={() => onAssign(field)}>
            <FieldTypeMark type={field.type} />
            <span className="analytics-well-option-copy">
              <span className="analytics-well-option-name">{field.name}</span>
              {field.examples?.[0] !== undefined && <small className="analytics-well-option-sample">e.g. {String(field.examples[0])}</small>}
            </span>
            <small className="analytics-well-option-type">{TYPE_LABELS[field.type] || field.type}</small>
          </button>
        ))}
        {!filteredCandidates.length && <p className="analytics-well-menu-empty">No matching compatible fields.</p>}
      </div>
    </div>}
    {((active && !accepts) || target.alwaysHint || (!target.candidates.length && target.count === 0)) && (
      <small className="analytics-well-hint">{active && !accepts ? target.blocked : target.hint}</small>
    )}
    {target.footer}
  </section>;
}

function MeasureRow({ measure, index, editing, fallback, fields, metrics, onToggle, onChange, onRemove }) {
  const governed = metrics.find(metric => metric.id === measure.metric_id);
  const label = measure.label || governed?.label || governed?.name || measure.metric_id ||
    (measure.formula ? measure.id : measure.aggregation === 'count_rows' ? 'Rows' : measure.field || 'Unnamed measure');
  const method = measure.metric_id ? 'Governed metric' : measure.formula ? 'Formula' : AGGREGATION_LABELS[measure.aggregation || 'sum'];
  const tag = measure.metric_id ? 'METRIC' : measure.formula ? 'FX' : (AGG_SHORT[measure.aggregation || 'sum'] || 'VAL');
  return <div className={`analytics-author-measure${editing ? ' is-editing' : ''}${fallback ? ' is-fallback' : ''}`}>
    <div className={`analytics-author-assignment analytics-author-measure-row${fallback ? ' is-fallback' : ' is-type-number'}`}>
      <button type="button" className="analytics-author-measure-toggle" aria-expanded={editing} aria-label={`Configure measure ${label}`} onClick={onToggle}>
        <span className="analytics-measure-tag" aria-hidden="true">{tag}</span>
        <span className="analytics-author-measure-name">
          <strong>{label}</strong>
          <small>{fallback ? 'Auto default · choose a field to replace' : method}</small>
        </span>
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
  const [clearedValue, setClearedValue] = useState(false);
  const [showRemap, setShowRemap] = useState(false);
  const [oldField, setOldField] = useState('');
  const [newField, setNewField] = useState('');
  const [announcement, setAnnouncement] = useState('');

  const { query, view } = config;
  const activeField = fields.find(field => field.name === (draggedName || selectedName));
  const groups = query.group_by || [];
  const measures = query.measures || [];
  const firstMeasure = measures[0];
  const isDefaultRows = measures.length === 1 && firstMeasure?.id === 'value' && firstMeasure.label === 'Rows' &&
    firstMeasure.aggregation === 'count_rows' && !firstMeasure.field && !firstMeasure.metric_id && !firstMeasure.formula &&
    (!firstMeasure.post || firstMeasure.post === 'none');
  const clearedDefault = clearedValue && isDefaultRows;
  const fallback = (replaceDefaultValue || clearedValue) && isDefaultRows;
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
    if (measures.length <= 1) {
      changeQuery({ measures: [{ id: 'value', aggregation: 'count_rows', label: 'Rows' }], ...replaceSort(measures[index]?.id) });
      setClearedValue(true);
    } else {
      changeQuery({ measures: measures.filter((_, position) => position !== index), ...replaceSort(measures[index].id) });
    }
    setEditingMeasure(null);
  };
  const chooseView = nextView => {
    if (nextView !== view) onChange({ ...config, view: nextView, query: { ...query, mode: 'aggregate' } });
    setPickerOpen(false);
    setEditingMeasure(null);
    setChoosing(null);
  };
  const hasFilters = Array.isArray(query.filters) ? query.filters.length > 0 : !!(query.filters?.rules?.length || query.filters?.field);
  const canReset = groups.length > 0 || !clearedDefault || hasFilters || !!query.period || !!query.comparison || !!query.sort ||
    columns.length > 0 || !!query.field || (query.limit != null && query.limit !== 1000) || detailRows || view !== 'bar';
  const resetBuilder = () => {
    onChange({
      ...config,
      view: 'bar',
      query: { mode: 'aggregate', measures: [{ id: 'value', aggregation: 'count_rows', label: 'Rows' }], group_by: [], filters: [], limit: 1000 },
    });
    setClearedValue(true);
    setSelectedName(null);
    setDraggedName(null);
    setHovered(null);
    setChoosing(null);
    setEditingMeasure(null);
    setPickerOpen(false);
    setShowRemap(false);
    setAnnouncement('Analysis builder cleared.');
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
  const fieldType = name => fields.find(field => field.name === name)?.type || 'string';
  const scalarRow = (name, clear) => name && <div className={`analytics-author-assignment analytics-author-scalar is-type-${fieldType(name)}`}>
    <FieldTypeMark type={fieldType(name)} />
    <span>{name}</span><button type="button" className="analytics-author-icon" aria-label={`Remove ${name}`} onClick={clear}><TbX /></button>
  </div>;

  const groupTarget = {
    id: 'categories', icon: TbColumns,
    title: view === 'pivot' ? 'Grouping fields' : ['kpi', 'table'].includes(view) ? 'Group rows' : timeAxis ? 'Time or category axis' : 'Category axis',
    purpose: view === 'pivot' ? 'Rows first; last field becomes columns' : view === 'kpi' ? 'Optional breakdown across groups' : view === 'table' ? 'Group rows by shared values' : singleSeries ? 'Names each slice of the whole' : timeAxis ? 'Orders points across time or sequence' : view === 'horizontal' ? 'Labels each horizontal bar' : 'Splits bars along the horizontal axis',
    acceptsLabel: timeAxis ? 'Dates or categories' : 'Any field',
    hint: view === 'pivot' ? 'Add at least two fields. The last becomes columns.' : timeAxis ? 'Add a date or an ordered category.' : 'Add fields to group records together.',
    blocked: 'Choose an unused field or remove an assignment to make room.',
    count: groups.length,
    maxSlots: singleSeries ? 1 : undefined,
    required: singleSeries || view === 'pivot',
    alwaysHint: view === 'pivot' && groups.length < 2,
    replace: singleSeries && groups.length === 1,
    candidates: groups.length >= (singleSeries ? 2 : 4) ? [] : fields.filter(field => !groups.some(group => group.field === field.name)),
    assign: field => {
      const group = { field: field.name, ...(field.type === 'date' && timeAxis ? { grain: 'day' } : {}) };
      if (singleSeries && groups.length) changeQuery({ group_by: [group], ...replaceSort(groups[0].field, field.name) });
      else changeQuery({ group_by: [...groups, group] });
    },
    entries: groups.length ? groups.map((group, index) => <div className={`analytics-author-assignment analytics-author-group is-type-${fieldType(group.field)}`} key={group.field}>
      <FieldTypeMark type={fieldType(group.field)} />
      <div><strong>{group.field}</strong><small>{view === 'pivot' && groups.length > 1 ? (index === groups.length - 1 ? 'Columns' : 'Rows') : (TYPE_LABELS[fieldType(group.field)] || 'Field')}</small></div>
      <select aria-label={`Date grain for ${group.field}`} title="Date grouping" value={group.grain || ''}
        onChange={event => changeQuery({ group_by: groups.map((item, position) => position === index ? { ...item, grain: event.target.value || undefined } : item) })}>
        <option value="">As is</option>{GRAINS.map(grain => <option key={grain}>{grain}</option>)}
      </select>
      <button type="button" className="analytics-author-icon" aria-label={`Remove grouping ${group.field}`} onClick={() => removeGroup(group.field)}><TbX /></button>
    </div>) : null,
  };
  const measureTarget = {
    id: 'values', title: singleSeries ? 'Value' : 'Values', icon: TbHash,
    purpose: view === 'kpi' ? 'Headline metrics to highlight' : singleSeries ? 'Numeric share for each slice' : 'Metrics plotted and summarized',
    acceptsLabel: 'Numbers or counts',
    hint: clearedDefault ? 'Using row count until you drop or choose a field.' : fallback ? 'Choose a field to replace the default row count.' : singleSeries ? 'Use one measure. Choose a field to replace the value.' : 'Add fields to summarize or configure a measure.',
    blocked: 'Remove a measure before adding another.',
    count: clearedDefault ? 0 : measures.length,
    maxSlots: singleSeries ? 1 : undefined,
    required: !clearedDefault,
    alwaysHint: fallback,
    replace: (!clearedDefault && fallback) || (singleSeries && !clearedDefault && measures.length === 1),
    candidates: measures.length >= (singleSeries ? 2 : 12) ? [] : fields,
    assign: field => {
      setClearedValue(false);
      if (fallback || (singleSeries && measures.length)) changeQuery({ measures: [fromField(field, measures[0].id)] });
      else changeQuery({ measures: [...measures, fromField(field)] });
    },
    entries: !clearedDefault && measures.length ? measures.map((measure, index) => <MeasureRow key={index} measure={measure} index={index} editing={editingMeasure === index} fallback={fallback}
      fields={fields} metrics={metrics} onToggle={() => setEditingMeasure(previous => previous === index ? null : index)}
      onRemove={() => removeMeasure(index)}
      onChange={patch => changeQuery({
        measures: measures.map((item, position) => position === index ? { ...item, ...patch } : item),
        ...(patch.id === undefined ? {} : replaceSort(measure.id, patch.id)),
      })} />) : null,
    footer: !singleSeries && measures.length < 12 && <button type="button" className="analytics-author-link" onClick={() => {
      setClearedValue(false);
      if (clearedDefault) { setEditingMeasure(0); return; }
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
      id: `scatter-${index}`, title, icon: TbHash,
      purpose: index === 0 ? 'Horizontal numeric coordinate' : 'Vertical numeric coordinate',
      acceptsLabel: 'Numbers only', dropNoun: 'numeric field',
      hint: 'Use a numeric field.', blocked: 'Choose a different numeric field.',
      required: true, maxSlots: 1, replace: !!fieldName, count: fieldName ? 1 : 0,
      candidates: fields.filter(field => field.type === 'number' && field.name !== measures[1 - index]?.field),
      assign: update, entries: scalarRow(fieldName, () => update(null)),
    };
  });
  const histogramTarget = {
    id: 'histogram', title: 'Numeric field', icon: TbHash,
    purpose: 'Numeric values grouped into intervals',
    acceptsLabel: 'Numbers only', dropNoun: 'numeric field',
    hint: 'Values are grouped into intervals.', blocked: 'This visual only accepts numeric fields.',
    required: true, maxSlots: 1, replace: !!histogramField,
    count: histogramField ? 1 : 0,
    candidates: fields.filter(field => field.type === 'number'),
    assign: field => changeQuery({ field: field.name }),
    entries: scalarRow(histogramField, () => changeQuery({ field: '' })),
    footer: <label className="analytics-author-bins">Bins<input type="number" min="1" max="100" value={query.bins ?? 10}
      onChange={event => changeQuery({ bins: Number(event.target.value) })} /></label>,
  };
  const detailTarget = {
    id: 'columns', title: 'Columns', icon: TbColumns,
    purpose: 'Columns displayed in the detail table',
    acceptsLabel: 'Any field',
    hint: 'Add the fields to show in the table. An empty list shows all fields.', blocked: 'Choose a field that is not already listed.',
    count: columns.length,
    candidates: columns.length >= 100 ? [] : fields.filter(field => !columns.includes(field.name)),
    assign: field => changeQuery({ columns: [...columns, field.name] }),
    entries: columns.length ? columns.map(name => <React.Fragment key={name}>{scalarRow(name, () => changeQuery({ columns: columns.filter(field => field !== name), ...replaceSort(name) }))}</React.Fragment>) : null,
  };
  const targets = view === 'scatter' ? scatterTargets() : view === 'histogram' ? [histogramTarget] :
    detailRows ? [detailTarget] : view === 'kpi' ? [measureTarget, groupTarget] : [groupTarget, measureTarget];
  const measureSummary = measures.map(measure => {
    const label = measure.label || measure.field || 'Rows';
    if (measure.metric_id || measure.formula) return label;
    if (measure.aggregation === 'count_rows') return 'Row count';
    return `${AGGREGATION_LABELS[measure.aggregation || 'sum']} of ${label}`;
  }).join(', ');
  const setupSummary = (() => {
    if (view === 'scatter') {
      const axes = [measures[0]?.field, measures[1]?.field].filter(Boolean);
      const ready = new Set(axes).size === 2;
      return ready
        ? { ready: true, title: 'Ready to plot', detail: `${axes[0]} vs ${axes[1]}` }
        : { ready: false, title: `Needs ${2 - new Set(axes).size} more numeric field${new Set(axes).size === 1 ? '' : 's'}`, detail: 'Assign different numeric fields to X axis and Y axis.' };
    }
    if (view === 'histogram') {
      return histogramField
        ? { ready: true, title: 'Ready to plot', detail: `${histogramField} across ${query.bins ?? 10} bins` }
        : { ready: false, title: 'Needs 1 numeric field', detail: 'Choose a numeric field below to compute intervals.' };
    }
    if (singleSeries) {
      return groups.length === 1 && measures.length === 1
        ? { ready: true, title: 'Ready to plot', detail: `${measureSummary} by ${groups[0].field}` }
        : { ready: false, title: 'Needs 1 category and 1 value', detail: 'Assign one category slice and one value before running.' };
    }
    if (view === 'pivot') {
      if (!measures.length) return { ready: false, title: 'Needs at least 1 value', detail: 'Drop or choose a field for Values before running.' };
      return groups.length >= 2
        ? { ready: true, title: 'Ready to cross-tabulate', detail: `${measureSummary} across ${groups.map(group => group.field).join(' × ')}` }
        : { ready: false, title: `Add ${2 - groups.length} more grouping field${groups.length === 1 ? '' : 's'}`, detail: 'Pivot tables group rows first and use the last field as columns.' };
    }
    if (detailRows) {
      return { ready: true, title: 'Detail table ready', detail: columns.length ? `Showing ${columns.length} selected column${columns.length > 1 ? 's' : ''}` : 'Showing all dataset columns' };
    }
    if (!measures.length) return { ready: false, title: 'Needs at least 1 value', detail: 'Drop or choose a field for Values before running.' };
    if (groups.length) return { ready: true, title: 'Ready to run', detail: `${measureSummary} by ${groups.map(group => group.field).join(', ')}` };
    if (fallback) return { ready: true, title: 'Ready with default row count', detail: 'Choose a category or value below to break down your data.' };
    return { ready: true, title: 'Ready to run', detail: view === 'kpi' ? `${measureSummary} headline` : `${measureSummary} overall — add a category to split` };
  })();
  const expectedTarget = field => {
    if (view === 'scatter') {
      if (field.type !== 'number' || measures.slice(0, 2).some(measure => measure.field === field.name)) return null;
      return targets.find(target => !target.count) || null;
    }
    if (view === 'histogram') return field.type === 'number' && histogramField !== field.name ? histogramTarget : null;
    if (detailRows) return detailTarget;
    return field.type === 'number' ? measureTarget : groupTarget;
  };
  const quickAssign = field => {
    const expected = expectedTarget(field);
    if (!expected) {
      setAnnouncement(`${field.name} has no open default role. Select it to place explicitly.`);
      return;
    }
    if (!expected.candidates.some(candidate => candidate.name === field.name)) {
      setAnnouncement(`${field.name} is already assigned or unavailable in ${expected.title}.`);
      return;
    }
    assign(expected, field);
  };
  const fieldBadge = field => {
    if (view === 'scatter') return measures.slice(0, 2).some(m => m.field === field.name) ? ['Axis', true] : field.type === 'number' ? ['→ Axis', false] : ['', false];
    if (view === 'histogram') return histogramField === field.name ? ['Active', true] : field.type === 'number' ? ['→ Field', false] : ['', false];
    if (detailRows) return columns.includes(field.name) ? ['Shown', true] : ['→ Col', false];
    if (groups.some(group => group.field === field.name)) return ['Grouped', true];
    if (measures.some(measure => measure.field === field.name)) return ['Value', true];
    return [field.type === 'number' ? '→ Values' : '→ Group', false];
  };
  const assignmentAvailable = activeField && targets.some(target => target.candidates.some(field => field.name === activeField.name));
  const note = activeField
    ? assignmentAvailable ? `${activeField.name} selected — click a highlighted role.` : `${activeField.name} does not fit the available roles.`
    : 'Click to pick any role · Double-click or drag to assign.';
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
          const [roleLabel, placed] = fieldBadge(field);
          const isSelected = selectedName === field.name || draggedName === field.name;
          return <button key={field.name} type="button" className={`analytics-author-field is-${field.type}${placed ? ' is-placed' : ''}`}
            draggable aria-pressed={isSelected} aria-label={`Select field ${field.name}`}
            title={field.examples?.length ? `${field.name} · ${field.examples.join(', ')}` : `${field.name} · Double-click to assign`}
            onClick={() => { setSelectedName(previous => previous === field.name ? null : field.name); setChoosing(null); setAnnouncement(''); }}
            onDoubleClick={() => quickAssign(field)}
            onDragStart={event => {
              event.dataTransfer.setData(FIELD_DRAG_TYPE, field.name);
              event.dataTransfer.setData('text/plain', field.name);
              event.dataTransfer.effectAllowed = 'copy';
              setSelectedName(null); setDraggedName(field.name); setChoosing(null); setAnnouncement('');
            }}
            onDragEnd={() => { setDraggedName(null); setHovered(null); }}>
            <TbGripVertical className="analytics-author-grip" aria-hidden="true" /><FieldTypeMark type={field.type} />
            <span className="analytics-author-field-name">{field.name}</span>
            {(isSelected || roleLabel) && <span className="analytics-author-field-role" aria-hidden="true">{isSelected ? 'Selected' : roleLabel}</span>}
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
        <div className="analytics-section-bar">
          <span className="analytics-step-index" aria-hidden="true">02</span>
          <h3>Field assignment</h3>
          {activeField ? (
            <button type="button" className="analytics-author-link" aria-label="Clear field selection" onClick={() => setSelectedName(null)}>Cancel</button>
          ) : (
            <button type="button" className="analytics-reset-btn" aria-label="Reset all fields and options"
              title="Clear all assigned fields, filters, sort, and visual settings" disabled={!canReset} onClick={resetBuilder}>
              <TbRotateClockwise aria-hidden="true" /> Reset all
            </button>
          )}
        </div>
        {activeField ? (
          <div className="analytics-placement-banner">
            <FieldTypeMark type={activeField.type} />
            <div className="analytics-placement-copy">
              <strong>Placing {activeField.name}</strong>
              <small>{assignmentAvailable ? 'Click a highlighted slot below, or drag directly into it.' : 'No role accepts this field right now.'}</small>
            </div>
          </div>
        ) : (
          <div className={`analytics-setup-summary ${setupSummary.ready ? 'is-ready' : 'is-needs'}`}>
            {setupSummary.ready ? <TbCheck aria-hidden="true" /> : <TbAlertCircle aria-hidden="true" />}
            <div className="analytics-setup-copy">
              <strong>{setupSummary.title}</strong>
              <small>{setupSummary.detail}</small>
            </div>
          </div>
        )}
        {targets.map(target => <FieldWell key={target.id} target={target} active={activeField} over={hovered === target.id} choosing={choosing === target.id}
          onChoose={() => setChoosing(previous => previous === target.id ? null : target.id)} onCloseMenu={() => setChoosing(null)} onAssign={field => assign(target, field)}
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
      </div>
      <AnalyticsQueryOptions query={query} view={view} fields={fields} onChange={changeQuery} />
  </div>;

  return <AnalyticsWorkbench fields={fieldContents} builder={builderContents} results={results}
    fieldDetails={sourceLoading ? 'Loading schema' : `${fields.length} available`}
    fieldActions={<button type="button" className="analytics-author-icon" aria-label="Remap fields" title="Remap fields"
      aria-expanded={showRemap} onClick={() => setShowRemap(value => !value)}><TbSwitchHorizontal aria-hidden="true" /></button>} />;
}
