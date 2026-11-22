import React, { useContext, useEffect, useRef, useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import axios from 'axios';
import { FaArrowRight, FaDatabase, FaSearch } from 'react-icons/fa';
import { WarehouseContext } from '../../context/WarehouseContext';
import './DataHubWindow.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const INITIAL_REGISTRATION = { id: '', name: '', path: '' };
const SOURCE_TYPES = { upload: 'File upload', api: 'API', sql: 'SQL', catalog: 'Registered file' };
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
const numberFormat = new Intl.NumberFormat();

function sourceType(source) {
  return SOURCE_TYPES[source.source_kind] || 'Saved dataset';
}

function displayDate(value) {
  if (!value) return 'Unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unavailable' : dateFormat.format(date);
}

function displayCount(count) {
  return Number.isFinite(count) ? numberFormat.format(count) : 'Unavailable';
}

function errorMessage(error, fallback) {
  const responseError = error.response?.data?.error;
  return typeof responseError === 'string' ? responseError : responseError?.message || fallback;
}

function DatasetDetails({ source }) {
  const sourceHeading = useRef(null);
  const sourceId = source?.source_id;
  useEffect(() => {
    if (sourceId) sourceHeading.current?.focus();
  }, [sourceId]);

  return (
    <aside className={`datahub-details${source ? ' has-selection' : ''}`} aria-labelledby="datahub-details-heading">
      <h2 id="datahub-details-heading">Dataset details</h2>
      {source ? (
        <>
          <h3 ref={sourceHeading} tabIndex={-1}>{source.name}</h3>
          <dl>
            <dt>Source ID</dt><dd>{source.source_id}</dd>
            <dt>Source type</dt><dd>{sourceType(source)}</dd>
            <dt>Rows</dt><dd>{displayCount(source.row_count)}</dd>
            <dt>Columns</dt><dd>{displayCount(source.column_count)}</dd>
            <dt>Added</dt><dd>{displayDate(source.created_at)}</dd>
            <dt>Updated</dt><dd>{displayDate(source.updated_at)}</dd>
          </dl>
          {source.governance_readiness?.status && (
            <div className="datahub-readiness">
              <strong>Data readiness</strong>
              <p>{source.governance_readiness.status}</p>
              {source.governance_readiness.reasons?.[0]?.message && (
                <p>{source.governance_readiness.reasons[0].message}</p>
              )}
            </div>
          )}
        </>
      ) : <p>Select a dataset to see its metadata and readiness.</p>}
    </aside>
  );
}

export default function DataHubWindow({ onUpload, onOpenInAnalytics, latestUploadId }) {
  const { refreshDatasets, removeDataset } = useContext(WarehouseContext);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [registration, setRegistration] = useState(INITIAL_REGISTRATION);
  const [mutation, setMutation] = useState(null);
  const [mutationError, setMutationError] = useState('');
  const [notice, setNotice] = useState('');
  const heading = useRef(null);

  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError('');
    axios.get(`${API_URL}/api/data-sources`, { signal: controller.signal }).then(({ data }) => {
      if (controller.signal.aborted) return;
      if (!Array.isArray(data?.sources)) throw new Error('Invalid catalog response');
      setSources(data.sources);
      refreshDatasets(data.sources.map(source => ({ id: source.source_id, name: source.name })));
    }).catch(error => {
      if (!controller.signal.aborted) setLoadError(errorMessage(error, 'Could not load saved datasets.'));
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [latestUploadId, refreshDatasets, revision]);

  const query = search.trim().toLocaleLowerCase();
  const visibleSources = sources.filter(source =>
    [source.name, source.source_id, sourceType(source)].some(value => value.toLocaleLowerCase().includes(query))
  );
  const selectedSource = sources.find(source => source.source_id === selectedId);
  const reload = () => setRevision(value => value + 1);

  function chooseRemoval(source) {
    setMutationError('');
    setNotice('');
    setRemoveTarget(source);
  }

  function dismissRemoval() {
    if (mutation) return;
    setRemoveTarget(null);
    setMutationError('');
  }

  async function confirmRemoval() {
    if (!removeTarget || mutation) return;
    const { source_id: id, name } = removeTarget;
    setMutation('removing');
    setMutationError('');
    try {
      await axios.delete(`${API_URL}/api/datahub/${encodeURIComponent(id)}`);
      setSources(previous => previous.filter(source => source.source_id !== id));
      removeDataset(id);
      setRemoveTarget(null);
      setNotice(`Removed ${name}.`);
      reload();
    } catch (error) {
      if (error.response?.status === 404) {
        setSources(previous => previous.filter(source => source.source_id !== id));
        removeDataset(id);
        setRemoveTarget(null);
        setNotice(`${name} is no longer in Data Hub.`);
        reload();
      } else {
        setMutationError(errorMessage(error, 'Could not remove the dataset. Try again.'));
      }
    } finally {
      setMutation(null);
    }
  }

  async function register(event) {
    event.preventDefault();
    if (mutation || loading) return;
    const fields = { id: registration.id.trim(), name: registration.name.trim(), path: registration.path.trim() };
    setMutationError('');
    setNotice('');
    if (!fields.id || !fields.name || !fields.path) {
      setMutationError('Enter a dataset ID, name, and server file path.');
      return;
    }
    setMutation('registering');
    try {
      await axios.post(`${API_URL}/api/datahub/register`, fields);
      setRegistration(INITIAL_REGISTRATION);
      setSearch('');
      setSelectedId(fields.id);
      setNotice(`Registered ${fields.name}.`);
      reload();
    } catch (error) {
      setMutationError(errorMessage(error, 'Could not register the dataset. Try again.'));
    } finally {
      setMutation(null);
    }
  }

  function openInAnalytics(source) {
    setMutationError('');
    if (!onOpenInAnalytics(source)) {
      setMutationError('Could not open the dataset. Open Analytics to resolve its workspace storage error, then try again.');
    }
  }

  return (
    <section className="datahub" aria-labelledby="datahub-title">
      <div className="datahub__body">
        <header className="datahub__heading">
          <div>
            <h1 id="datahub-title" ref={heading} tabIndex={-1}>Data Hub</h1>
            <p>Find saved datasets and open them in Analytics.</p>
          </div>
        </header>

        <div className="datahub__layout">
          <section className="datahub-library" aria-labelledby="datahub-library-heading">
            <div className="datahub-library__toolbar">
              <div>
                <h2 id="datahub-library-heading">Saved datasets</h2>
                {!loading && !loadError && <p role="status">{visibleSources.length} of {sources.length} datasets</p>}
              </div>
              <label className="datahub-search">
                <FaSearch aria-hidden="true" />
                <input
                  type="search"
                  aria-label="Search datasets"
                  placeholder="Search by name, type, or ID"
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                />
              </label>
            </div>

            {loading && <p className="datahub-message" role="status">Loading saved datasets…</p>}
            {loadError && (
              <div className="datahub-message" role="alert">
                <p>{loadError}</p>
                <button type="button" onClick={reload} disabled={!!mutation}>Retry</button>
              </div>
            )}
            {notice && <p className="datahub-message" role="status">{notice}</p>}
            {mutationError && !removeTarget && <p className="datahub-message datahub-error" role="alert">{mutationError}</p>}

            {!loading && !loadError && visibleSources.length === 0 && (
              <div className="datahub-empty">
                <FaDatabase aria-hidden="true" />
                <h3>{sources.length ? 'No matching datasets' : 'No saved datasets yet'}</h3>
                {sources.length
                  ? <button type="button" onClick={() => setSearch('')}>Clear search</button>
                  : <button type="button" onClick={onUpload}>Upload data</button>}
              </div>
            )}

            {visibleSources.length > 0 && (
              <ul className="datahub-list" aria-label="Saved datasets">
                {visibleSources.map(source => (
                  <li key={source.source_id} className={selectedId === source.source_id ? 'is-selected' : undefined}>
                    <div className="datahub-source">
                      <FaDatabase aria-hidden="true" />
                      <div>
                        <button
                          type="button"
                          className="datahub-source__name"
                          aria-label={`View details for ${source.name} (${source.source_id})`}
                          aria-pressed={selectedId === source.source_id}
                          onClick={() => setSelectedId(source.source_id)}
                        >
                          {source.name}
                        </button>
                        <span className="datahub-source__id">{source.source_id}</span>
                      </div>
                    </div>
                    <dl className="datahub-source__metadata">
                      <div><dt>Type</dt><dd>{sourceType(source)}</dd></div>
                      <div><dt>Rows</dt><dd>{displayCount(source.row_count)}</dd></div>
                      <div><dt>Added</dt><dd>{displayDate(source.created_at)}</dd></div>
                    </dl>
                    <div className="datahub-source__actions">
                      <button type="button" className="datahub-open" onClick={() => openInAnalytics(source)} disabled={!!mutation}>
                        Open in Analytics <FaArrowRight aria-hidden="true" />
                      </button>
                      <button type="button" className="datahub-remove" onClick={() => chooseRemoval(source)} disabled={loading || !!mutation}>
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <details className="datahub-register">
              <summary>Register an existing file</summary>
              <form onSubmit={register}>
                <p>Use a server file path. An existing dataset ID updates that record.</p>
                <div className="datahub-register__fields">
                  <label>Dataset ID<input required value={registration.id} onChange={event => setRegistration({ ...registration, id: event.target.value })} /></label>
                  <label>Name<input required value={registration.name} onChange={event => setRegistration({ ...registration, name: event.target.value })} /></label>
                  <label>Server file path<input required value={registration.path} onChange={event => setRegistration({ ...registration, path: event.target.value })} /></label>
                  <button type="submit" disabled={loading || !!mutation}>{mutation === 'registering' ? 'Registering…' : 'Register'}</button>
                </div>
              </form>
            </details>
          </section>

          <DatasetDetails source={selectedSource} />
        </div>
      </div>

      <Dialog
        open={!!removeTarget}
        onClose={dismissRemoval}
        aria-labelledby="datahub-remove-title"
        aria-describedby="datahub-remove-message"
      >
        <DialogTitle id="datahub-remove-title">Remove dataset?</DialogTitle>
        <DialogContent sx={{ overflowWrap: 'anywhere' }}>
          <p id="datahub-remove-message">Remove <strong>{removeTarget?.name}</strong> (ID {removeTarget?.source_id}) from Data Hub?</p>
          {mutationError && <p className="datahub-error" role="alert">{mutationError}</p>}
        </DialogContent>
        <DialogActions>
          <Button autoFocus disabled={!!mutation} onClick={dismissRemoval}>Cancel</Button>
          <Button color="error" variant="contained" disabled={!!mutation} onClick={confirmRemoval}>
            {mutation === 'removing' ? 'Removing…' : 'Remove dataset'}
          </Button>
        </DialogActions>
      </Dialog>
    </section>
  );
}
