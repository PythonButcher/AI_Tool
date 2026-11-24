import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FaArrowRight, FaChartBar, FaCheck, FaClipboardCheck, FaCode, FaColumns, FaCopy, FaDatabase, FaFilter, FaFolderOpen,
  FaKey, FaProjectDiagram, FaSave, FaSlidersH, FaTable, FaThList, FaUpload, FaWaveSquare,
} from 'react-icons/fa';
import ApiDataForm from '../api/APiDataForm';
import DatabaseConnectForm from '../database/DatabaseConnectForm';
import { describeFields, displayCell, filterWorkingRows, findDuplicateRows, profileField } from './workingRows';
import { CheckKeys, SummarizeRows, ValidateValues } from './DatasetChecks';
import { FieldSelect, RowsGrid } from './WorkbenchControls';
import './DataToolsWorkbench.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const TOOL_GROUPS = [
  { label: 'Inspect', tools: [
    { id: 'rows', label: 'Inspect rows', icon: FaTable },
    { id: 'fields', label: 'Fields and metrics', icon: FaColumns },
    { id: 'summary', label: 'Summarize rows', icon: FaThList },
  ] },
  { label: 'Prepare', tools: [
    { id: 'query', label: 'Power Query', icon: FaSlidersH },
    { id: 'filter', label: 'Filter rows', icon: FaFilter },
  ] },
  { label: 'Quality', tools: [
    { id: 'profile', label: 'Column profile', icon: FaChartBar },
    { id: 'duplicates', label: 'Duplicate rows', icon: FaCopy },
    { id: 'validate', label: 'Validate values', icon: FaClipboardCheck },
    { id: 'keys', label: 'Check keys', icon: FaKey },
    { id: 'outliers', label: 'Outliers', icon: FaWaveSquare },
  ] },
  { label: 'Sources', tools: [
    { id: 'api', label: 'Connect API', icon: FaCode },
    { id: 'sql', label: 'Connect database', icon: FaDatabase },
    { id: 'model', label: 'Data Model', icon: FaProjectDiagram },
  ] },
];

function FilterRows({ rows, fields, filteredRows, setFilteredRows, onOpenQuery, visible }) {
  const nextRuleId = useRef(1);
  const emptyRule = id => ({ id, field: fields[0]?.name || '', operator: 'contains', query: '' });
  const [rules, setRules] = useState(() => [emptyRule(0)]);
  const [gridVersion, setGridVersion] = useState(0);
  const invalidRule = ({ field, operator, query }) => !field || (operator !== 'missing' && !query.trim())
    || (['gt', 'lt'].includes(operator) && !Number.isFinite(Number(query)));
  const updateRule = (id, change) => setRules(current => current.map(rule => rule.id === id ? { ...rule, ...change } : rule));

  const apply = event => {
    event.preventDefault();
    setFilteredRows(filterWorkingRows(rows, rules));
    setGridVersion(version => version + 1);
  };

  if (!visible) return null;

  return (
    <>
      <header className="dt-panel__intro">
        <h2>Filter rows</h2>
        <p>Preview rows that match every rule. To apply a filter to the dataset, add a Filter Rows step in Power Query.</p>
        {onOpenQuery && <button className="dt-button" type="button" onClick={onOpenQuery}>Open Power Query <FaArrowRight aria-hidden="true" /></button>}
      </header>
      <form onSubmit={apply}>
        {rules.map(({ id, field, operator, query }, index) => (
          <fieldset className="dt-filter-rule" key={id}>
            <legend>{`Rule ${index + 1}`}</legend>
            <div className="dt-controls">
              <FieldSelect label="Field" fields={fields} value={field} onChange={value => updateRule(id, { field: value })} />
              <label className="dt-field">Condition
                <select value={operator} onChange={event => updateRule(id, { operator: event.target.value })}>
                  <option value="contains">Contains</option><option value="equals">Equals</option><option value="notEquals">Does not equal</option>
                  <option value="missing">Is empty</option><option value="gt">Greater than</option><option value="lt">Less than</option>
                </select>
              </label>
              {operator !== 'missing' && <label className="dt-field">Value<input value={query} onChange={event => updateRule(id, { query: event.target.value })} /></label>}
              {rules.length > 1 && <button className="dt-button" type="button" aria-label={`Remove rule ${index + 1}`} onClick={() => setRules(current => current.filter(rule => rule.id !== id))}>Remove</button>}
            </div>
          </fieldset>
        ))}
        <div className="dt-controls">
          <button type="button" className="dt-button" onClick={() => {
            const rule = emptyRule(nextRuleId.current);
            nextRuleId.current += 1;
            setRules(current => [...current, rule]);
          }}>Add rule</button>
          <button type="submit" className="dt-button dt-button--primary" disabled={rules.some(invalidRule)}>Apply preview filter</button>
          <button type="button" className="dt-button" disabled={filteredRows == null} onClick={() => { setFilteredRows(null); setRules([emptyRule(0)]); setGridVersion(version => version + 1); }}>Clear filter</button>
        </div>
      </form>
      <RowsGrid key={gridVersion} rows={filteredRows ?? rows} fields={fields} caption={filteredRows == null ? 'Working rows' : 'Matching rows'} />
    </>
  );
}

function ColumnProfile({ rows, fields }) {
  const [field, setField] = useState(fields[0]?.name || '');
  const profile = useMemo(() => profileField(rows, field), [rows, field]);
  const filled = rows.length - profile.missing;
  const completeness = rows.length ? filled / rows.length : 0;
  const percent = completeness.toLocaleString(undefined, { style: 'percent', maximumFractionDigits: 1 });

  return (
    <>
      <header className="dt-panel__intro"><h2>Column profile</h2><p>Check completeness and the most common values across all loaded rows.</p></header>
      <div className="dt-controls"><FieldSelect label="Column" fields={fields} value={field} onChange={setField} /></div>
      <dl className="dt-stats" aria-label="Column statistics">
        <div><dt>Filled</dt><dd>{filled.toLocaleString()}</dd></div>
        <div><dt>Empty</dt><dd>{profile.missing.toLocaleString()}</dd></div>
        <div><dt>Distinct values</dt><dd>{profile.distinct.toLocaleString()}</dd></div>
        <div><dt>Completeness</dt><dd>{percent}</dd></div>
      </dl>
      <div className="dt-value-list">
        <h3>Most frequent values</h3>
        {profile.topValues.length === 0 ? <p>No populated values.</p> : (
          <ul>{profile.topValues.map(({ key, value, count }) => (
            <li key={key}>
              <span title={displayCell(value)}>{displayCell(value)}</span>
              <meter min={0} max={filled} value={count} aria-label={`Frequency of ${displayCell(value)}`} />
              <strong>{count.toLocaleString()}</strong>
            </li>
          ))}</ul>
        )}
      </div>
    </>
  );
}

function DuplicateRows({ rows, fields, onOpenQuery }) {
  const [field, setField] = useState('');
  const [result, setResult] = useState(null);

  return (
    <>
      <header className="dt-panel__intro">
        <h2>Duplicate rows</h2><p>Compare all loaded rows. Match on every field or check whether one field is unique.</p>
        {onOpenQuery && <button className="dt-button" type="button" onClick={onOpenQuery}>Open Power Query <FaArrowRight aria-hidden="true" /></button>}
      </header>
      <div className="dt-controls">
        <FieldSelect label="Compare by" fields={fields} value={field} onChange={value => { setField(value); setResult(null); }} emptyLabel="All fields" />
        <button className="dt-button dt-button--primary" type="button" onClick={() => setResult(findDuplicateRows(rows, field ? [field] : fields.map(item => item.name)))}>Find duplicates</button>
      </div>
      {result && (
        <>
          <p className="dt-result" role="status"><FaCheck aria-hidden="true" />{result.groupCount ? `${result.indices.length.toLocaleString()} matching rows across ${result.groupCount.toLocaleString()} ${result.groupCount === 1 ? 'group' : 'groups'}.` : 'No duplicate rows found.'}</p>
          {result.indices.length > 0 && <RowsGrid rows={rows} fields={fields} indices={result.indices} caption="Duplicate results" />}
        </>
      )}
    </>
  );
}

function Outliers({ context }) {
  const [request, setRequest] = useState(null);
  const [state, setState] = useState({});

  useEffect(() => {
    if (!request || !context) return undefined;
    const controller = new AbortController();
    const detect = async () => {
      try {
        const response = await fetch(`${API_URL}/api/outliers`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ analysis_context: context, contamination: request.rate / 100 }),
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error?.message || result.error || 'Outlier detection failed.');
        if (!Number.isInteger(result.count)) throw new Error('Outlier detection returned an incomplete result.');
        if (!controller.signal.aborted) setState({ count: result.count });
      } catch (error) {
        if (!controller.signal.aborted) setState({ error: error.message });
      }
    };
    detect();
    return () => controller.abort();
  }, [context, request]);

  const [rate, setRate] = useState('2');
  const run = event => {
    event.preventDefault();
    setState({ loading: true });
    setRequest({ rate: Number(rate) });
  };

  return (
    <>
      <header className="dt-panel__intro"><h2>Outliers</h2><p>Look for unusual patterns in numeric fields in the working source.</p></header>
      {context ? (
        <form className="dt-controls" onSubmit={run}>
          <label className="dt-field">Expected outliers (%)<input type="number" min="0.1" max="50" step="0.1" required value={rate} onChange={event => setRate(event.target.value)} /></label>
          <button className="dt-button dt-button--primary" type="submit" disabled={state.loading}>{state.loading ? 'Checking…' : 'Run outlier detection'}</button>
        </form>
      ) : <p className="dt-empty-inline">Outlier detection requires a managed source. Joined analysis is available in Analytics.</p>}
      {state.error && <p className="dt-result dt-result--error" role="alert">{state.error}</p>}
      {state.count != null && <p className="dt-result" role="status">{state.count.toLocaleString()} potential {state.count === 1 ? 'outlier' : 'outliers'} found.</p>}
    </>
  );
}

function FieldsAndMetrics({ fields, metrics }) {
  return (
    <>
      <header className="dt-panel__intro"><h2>Fields and metrics</h2><p>Review the working schema and measures defined for this dataset.</p></header>
      <div className="dt-schema">
        <div><h3>Fields</h3><ul>{fields.map(field => <li key={field.name}><strong>{field.name}</strong><span>{field.type || 'Unknown type'}</span></li>)}</ul></div>
        <div>
          <h3>Metrics</h3>
          {metrics.length ? <ul>{metrics.map(metric => (
            <li key={metric.id}><strong>{metric.label || metric.name || metric.id}</strong><span>{metric.description || metric.aggregation || metric.format}</span></li>
          ))}</ul> : <p>No metrics are defined for this dataset.</p>}
        </div>
      </div>
    </>
  );
}

export default function DataToolsWorkbench({
  dataset, rows, schema, metrics, sourceContext, filteredRows, setFilteredRows,
  canRefine, isApplyingRefine, refineUnavailableReason, powerQuery, tool, setTool, actions,
}) {
  const fields = useMemo(() => describeFields(rows, schema), [rows, schema]);
  const hasRows = Boolean(rows.length);
  const isDisabled = id => {
    if (id === 'api' || id === 'sql') return false;
    if (id === 'query') return !canRefine;
    if (id === 'model') return !dataset?.canModel;
    if (['filter', 'profile', 'duplicates', 'validate', 'keys', 'summary'].includes(id)) return !hasRows || !fields.length;
    return !dataset;
  };
  const currentTool = isDisabled(tool) ? 'rows' : tool;
  const openQuery = canRefine ? () => setTool('query') : undefined;

  return (
    <section className="dt-workbench" aria-labelledby="data-tools-heading">
      <div className="dt-workbench__inner">
        <header className="dt-hero">
          <div className="dt-hero__identity">
            <span className="dt-hero__icon"><FaSlidersH aria-hidden="true" /></span>
            <div>
              <h1 id="data-tools-heading">Data Tools</h1>
              <p>{dataset?.name || 'No dataset open'}</p>
            </div>
          </div>
          {dataset && <dl className="dt-hero__stats" aria-label="Working dataset details">
            <div><dt>Rows loaded</dt><dd>{rows.length.toLocaleString()}</dd></div>
            <div><dt>Fields</dt><dd>{fields.length.toLocaleString()}</dd></div>
          </dl>}
          <div className="dt-hero__actions">
            {dataset?.canSave && <button type="button" className="dt-button dt-button--primary" onClick={actions.save} disabled={isApplyingRefine}><FaSave aria-hidden="true" /> Save Dataset</button>}
            <button type="button" className="dt-button" onClick={actions.upload}><FaUpload aria-hidden="true" /> Upload data</button>
            <button type="button" className="dt-button" onClick={actions.openHub}><FaFolderOpen aria-hidden="true" /> Open Data Hub</button>
          </div>
        </header>

        <div className="dt-ribbon" aria-label="Data tools">
          {TOOL_GROUPS.map(({ label, tools }) => (
            <div className="dt-ribbon__group" role="group" key={label} aria-label={label} data-group={label.toLowerCase()}>
              <h2>{label}</h2>
              <div className="dt-ribbon__commands">
                {tools.map(({ id, label: name, icon: Icon }) => (
                  <button type="button" key={id} disabled={isDisabled(id)}
                    aria-pressed={id === 'model' ? undefined : currentTool === id}
                    aria-describedby={id === 'query' && dataset && !canRefine ? 'dt-refine-limit' : undefined}
                    onClick={id === 'model' ? actions.openModel : () => setTool(id)}>
                    <Icon aria-hidden="true" /><span>{name}</span>{id === 'model' && <FaArrowRight aria-hidden="true" />}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {dataset && !canRefine && <p className="dt-limit" id="dt-refine-limit">{refineUnavailableReason}</p>}

        {canRefine && <div className="dt-panel dt-panel--query" hidden={currentTool !== 'query'}>{powerQuery}</div>}
        {hasRows && fields.length > 0 && <div className="dt-panel" hidden={currentTool !== 'filter'}>
          <FilterRows rows={rows} fields={fields} filteredRows={filteredRows} setFilteredRows={setFilteredRows} onOpenQuery={openQuery} visible={currentTool === 'filter'} />
        </div>}
        {!['query', 'filter'].includes(currentTool) && <div className="dt-panel">
          {currentTool === 'rows' && (dataset ? (
            <>
              {filteredRows != null && <p className="dt-result">Preview filter active. <button type="button" className="dt-text-button" onClick={() => setTool('filter')}>Review filter</button></p>}
              <RowsGrid key={filteredRows == null ? 'all' : 'filtered'} rows={filteredRows ?? rows} fields={fields} caption="Working rows" />
            </>
          ) : (
            <div className="dt-empty"><FaTable aria-hidden="true" /><h2>Open a dataset</h2><p>Upload a file, open a saved dataset from Data Hub, or connect a source to start.</p></div>
          ))}
          {currentTool === 'profile' && <ColumnProfile rows={rows} fields={fields} />}
          {currentTool === 'duplicates' && <DuplicateRows rows={rows} fields={fields} onOpenQuery={openQuery} />}
          {currentTool === 'validate' && <ValidateValues rows={rows} fields={fields} />}
          {currentTool === 'keys' && <CheckKeys rows={rows} fields={fields} />}
          {currentTool === 'summary' && <SummarizeRows rows={rows} fields={fields} />}
          {currentTool === 'outliers' && <Outliers context={sourceContext} />}
          {currentTool === 'fields' && <FieldsAndMetrics fields={fields} metrics={metrics} />}
          {currentTool === 'api' && <><header className="dt-panel__intro"><h2>Connect API</h2><p>Load a JSON response into the working grid for inspection.</p></header><ApiDataForm handleApiData={actions.loadConnection} /></>}
          {currentTool === 'sql' && <><header className="dt-panel__intro"><h2>Connect database</h2><p>Choose a source table and open its preview in the working grid.</p></header><DatabaseConnectForm handleDatabaseData={actions.loadConnection} /></>}
        </div>}
      </div>
    </section>
  );
}
