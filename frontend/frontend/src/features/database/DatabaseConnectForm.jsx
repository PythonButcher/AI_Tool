import React, { useEffect, useId, useRef, useState } from 'react';
import axios from 'axios';
import './DatabaseConnectForm.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const POSTGRES_URL = `${API_URL}/api/postgres`;
const initialConnection = { host: '', port: '5432', user: '', password: '', dbname: '', sslmode: 'prefer' };
const tableKey = ({ schema, table }) => JSON.stringify([schema, table]);
const tableLabel = ({ schema, table }) => `${schema}.${table}`;
const displayError = (error) => {
  const { error: failure, governance_readiness: readiness } = error.response?.data || {};
  const message = failure?.message || 'The PostgreSQL request failed. Try again.';
  return [message, readiness?.reasons?.[0]?.message, readiness?.next_action].filter(Boolean).join(' ');
};

function DatabaseConnectForm({ handleDatabaseData, onClose }) {
  const [connection, setConnection] = useState(initialConnection);
  const [databases, setDatabases] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [selections, setSelections] = useState({});
  const [primaryKey, setPrimaryKey] = useState('');
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(50);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [savedModels, setSavedModels] = useState(null);
  const [listError, setListError] = useState('');
  const request = useRef(null);
  const id = useId();

  useEffect(() => {
    const controller = new AbortController();
    axios.get(`${POSTGRES_URL}/workspaces`, { signal: controller.signal })
      .then(({ data }) => { if (!controller.signal.aborted) setSavedModels(data.workspaces); })
      .catch(() => { if (!controller.signal.aborted) setListError('Saved models could not be loaded. Reopen the panel to retry.'); });
    return () => {
      controller.abort();
      request.current?.abort();
    };
  }, []);

  const perform = async (label, path, payload, receive) => {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(label);
    setError('');
    try {
      const { data } = await axios.post(`${POSTGRES_URL}${path}`, payload, {
        signal: controller.signal,
        timeout: 180000,
      });
      if (!controller.signal.aborted) receive(data);
    } catch (err) {
      if (!controller.signal.aborted) setError(displayError(err));
    } finally {
      if (request.current === controller) request.current = null;
      if (!controller.signal.aborted) setBusy('');
    }
  };

  const changeConnection = ({ target: { name: field, value } }) => {
    setConnection(previous => ({ ...previous, [field]: value }));
    if (field !== 'dbname') setDatabases(null);
  };

  const findDatabases = event => {
    event.preventDefault();
    perform('Finding databases…', '/databases', connection, data => {
      setDatabases(data.databases);
      if (!connection.dbname && data.databases.length === 1) {
        setConnection(previous => ({ ...previous, dbname: data.databases[0] }));
      }
    });
  };

  const browseTables = event => {
    event.preventDefault();
    perform('Loading tables…', '/tables', connection, data => {
      setCatalog(data);
      setName(`${data.database} model`.slice(0, 100));
      setSelections({});
      setPrimaryKey('');
      setSearch('');
      setVisibleCount(50);
    });
  };

  const selectedTables = Object.values(selections);
  const toggleTable = table => {
    const key = tableKey(table);
    if (selections[key]) {
      const next = { ...selections };
      delete next[key];
      setSelections(next);
      if (primaryKey === key) setPrimaryKey(Object.keys(next)[0] || '');
    } else {
      setSelections(previous => ({
        ...previous,
        [key]: { schema: table.schema, table: table.table, columns: table.columns.map(column => column.name) },
      }));
      if (!primaryKey) setPrimaryKey(key);
    }
  };

  const selectColumns = (key, columns) => {
    setSelections(previous => ({ ...previous, [key]: { ...previous[key], columns } }));
  };

  const openModel = data => {
    setConnection(initialConnection);
    handleDatabaseData(data);
    onClose?.();
  };

  const saveModel = event => {
    event.preventDefault();
    if (!canSave) return;
    const { schema, table } = selections[primaryKey];
    perform('Saving snapshots…', '/workspaces', {
      connection,
      name: name.trim(),
      tables: selectedTables,
      primary: { schema, table },
    }, openModel);
  };

  const matchingTables = catalog?.tables.filter(table => tableLabel(table).toLowerCase().includes(search.trim().toLowerCase())) || [];
  const canSave = Boolean(name.trim() && selections[primaryKey] && selectedTables.every(
    table => table.columns.length && table.columns.length <= catalog?.limits.columns_per_table,
  ));

  return (
    <div className="db-connect-content">
      {error && <p className="db-form__error" role="alert">{error}</p>}
      {busy && <p className="db-form__status" role="status">{busy}</p>}
      {!catalog ? (
        <>
          <section className="db-saved-models" aria-labelledby={`${id}-saved`}>
            <h3 id={`${id}-saved`}>Saved PostgreSQL models</h3>
            {listError ? <p role="alert">{listError}</p> : savedModels === null ? <p>Loading saved models…</p> : (
              savedModels.length ? (
                <ul>
                  {savedModels.map(model => (
                    <li key={model.workspace_id}>
                      <button type="button" className="db-form__secondary" disabled={Boolean(busy)}
                        onClick={() => perform('Opening model…', `/workspaces/${encodeURIComponent(model.workspace_id)}/open`, undefined, openModel)}>
                        {model.name}
                      </button>
                      <span>{model.source_count} {model.source_count === 1 ? 'source' : 'sources'}</span>
                    </li>
                  ))}
                </ul>
              ) : <p>Saved models will appear here.</p>
            )}
          </section>
          <form onSubmit={findDatabases} aria-label="PostgreSQL connection">
            <fieldset className="db-form__fields" disabled={Boolean(busy)}>
              <legend>Connect to PostgreSQL</legend>
              <div className="db-form__grid">
                <label className="db-form__field db-form__field--wide">
                  <span className="db-form__label">Host</span>
                  <input className="db-form__input" name="host" value={connection.host} onChange={changeConnection} required />
                </label>
                <label className="db-form__field">
                  <span className="db-form__label">Port</span>
                  <input className="db-form__input" name="port" type="number" min="1" max="65535" value={connection.port} onChange={changeConnection} required />
                </label>
                <label className="db-form__field">
                  <span className="db-form__label">SSL mode</span>
                  <select className="db-form__input" name="sslmode" value={connection.sslmode} onChange={changeConnection}>
                    <option value="prefer">Prefer</option>
                    <option value="require">Require</option>
                    <option value="verify-full">Verify server</option>
                    <option value="disable">Disable</option>
                  </select>
                </label>
                <label className="db-form__field">
                  <span className="db-form__label">Username</span>
                  <input className="db-form__input" name="user" value={connection.user} onChange={changeConnection} autoComplete="username" required />
                </label>
                <label className="db-form__field">
                  <span className="db-form__label">Password</span>
                  <input className="db-form__input" name="password" type="password" value={connection.password} onChange={changeConnection} autoComplete="off" />
                </label>
                <label className="db-form__field db-form__field--wide">
                  <span className="db-form__label">Database</span>
                  <input className="db-form__input" name="dbname" value={connection.dbname} onChange={changeConnection}
                    placeholder="Enter a name or find databases" list={`${id}-databases`} />
                  <datalist id={`${id}-databases`}>{databases?.map(database => <option key={database} value={database} />)}</datalist>
                </label>
              </div>
              <div className="db-form__actions">
                <button className="db-form__secondary" type="submit">Find databases</button>
                <button className="db-form__submit" type="button"
                  disabled={!connection.host.trim() || !connection.user.trim() || !connection.dbname.trim()}
                  onClick={browseTables}>Browse tables</button>
              </div>
              {databases && (
                <label className="db-form__field db-form__field--wide">
                  <span className="db-form__label">Available databases</span>
                  <select className="db-form__input" name="dbname" value={databases.includes(connection.dbname) ? connection.dbname : ''} onChange={changeConnection}>
                    <option value="">{databases.length ? 'Choose a database' : 'No databases found'}</option>
                    {databases.map(database => <option key={database} value={database}>{database}</option>)}
                  </select>
                </label>
              )}
            </fieldset>
          </form>
        </>
      ) : (
        <form onSubmit={saveModel} aria-label="Save PostgreSQL model">
          <fieldset className="db-form__fields" disabled={Boolean(busy)}>
            <legend>Select tables and columns</legend>
            <div className="db-form__actions">
              <span className="db-form__database">{catalog.database}</span>
              <button type="button" className="db-form__secondary" onClick={() => { setCatalog(null); setError(''); }}>Change connection</button>
            </div>
            <p className="db-form__status">Save a copy of the selected data. Include the key columns you want to use in Data Model relationships.</p>
            <label className="db-form__field">
              <span className="db-form__label">Find a table</span>
              <input className="db-form__input" value={search} onChange={event => { setSearch(event.target.value); setVisibleCount(50); }} />
            </label>
            <p className="db-form__status">{selectedTables.length} of {catalog.limits.tables} tables selected</p>
            <div className="db-form__table-list">
              {!matchingTables.length && <p className="db-form__status">No readable tables match.</p>}
              {matchingTables.slice(0, visibleCount).map(table => {
                const key = tableKey(table);
                const selected = selections[key];
                const atLimit = selectedTables.length >= catalog.limits.tables;
                return (
                  <div className="db-form__table" key={key}>
                    <label className="db-form__check">
                      <input type="checkbox" checked={Boolean(selected)} disabled={!selected && atLimit} onChange={() => toggleTable(table)} />
                      <strong>{tableLabel(table)}</strong>
                      <span className="db-form__status">{table.columns.length} columns</span>
                    </label>
                    {selected && (
                      <details open>
                        <summary>Columns in {tableLabel(table)} ({selected.columns.length} selected)</summary>
                        <div className="db-form__actions">
                          <button type="button" className="db-form__secondary" onClick={() => selectColumns(key, table.columns.map(column => column.name))}>Select all</button>
                          <button type="button" className="db-form__secondary" onClick={() => selectColumns(key, [])}>Clear columns</button>
                        </div>
                        {selected.columns.length > catalog.limits.columns_per_table && (
                          <p className="db-form__error">Choose at most {catalog.limits.columns_per_table} columns from this table.</p>
                        )}
                        <ul className="db-form__column-list">
                          {table.columns.map(column => {
                            const checked = selected.columns.includes(column.name);
                            return (
                              <li key={column.name}>
                                <label className="db-form__check">
                                  <input type="checkbox" checked={checked} onChange={() => {
                                    const next = new Set(selected.columns);
                                    if (checked) next.delete(column.name);
                                    else next.add(column.name);
                                    selectColumns(key, table.columns.map(item => item.name).filter(columnName => next.has(columnName)));
                                  }} />
                                  <span>{column.name}</span>
                                  <small>{column.data_type}</small>
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      </details>
                    )}
                  </div>
                );
              })}
              {matchingTables.length > visibleCount && (
                <button type="button" className="db-form__secondary" onClick={() => setVisibleCount(count => count + 50)}>Show more tables</button>
              )}
            </div>
            <label className="db-form__field">
              <span className="db-form__label">Primary table</span>
              <select className="db-form__input" value={primaryKey} onChange={event => setPrimaryKey(event.target.value)} required>
                <option value="">Select a table</option>
                {selectedTables.map(table => <option key={tableKey(table)} value={tableKey(table)}>{tableLabel(table)}</option>)}
              </select>
            </label>
            <label className="db-form__field">
              <span className="db-form__label">Model name</span>
              <input className="db-form__input" value={name} maxLength={100} onChange={event => setName(event.target.value)} required />
            </label>
            <button className="db-form__submit" type="submit" disabled={!canSave}>Save PostgreSQL model</button>
          </fieldset>
        </form>
      )}
    </div>
  );
}

export default DatabaseConnectForm;
