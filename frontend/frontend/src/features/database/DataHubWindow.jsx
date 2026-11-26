import React, { useContext, useEffect, useRef, useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import axios from 'axios';
import { FaArrowRight, FaDatabase, FaSearch } from 'react-icons/fa';
import { WarehouseContext } from '../../context/WarehouseContext';
import './DataHubWindow.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const INITIAL_REGISTRATION = { id: '', name: '', path: '' };
const DATASET_TYPES = { source: 'Saved source', refined: 'Refined copy', model: 'Live model', legacy: 'Registered file' };
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
const updatedFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium' });
const numberFormat = new Intl.NumberFormat();

function sourceType(source) {
  if (source.kind === 'legacy' && source.source_kind === 'sql') return 'PostgreSQL snapshot';
  return DATASET_TYPES[source.kind] || 'Saved dataset';
}

function displayDate(value, format = dateFormat) {
  if (!value) return 'Unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unavailable' : format.format(date);
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
  const sourceId = source?.dataset_id;
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
            <dt>Type</dt><dd>{sourceType(source)}</dd>
            <dt>Rows</dt><dd>{displayCount(source.row_count)}</dd>
            <dt>Columns</dt><dd>{displayCount(source.column_count)}</dd>
            <dt>Added</dt><dd>{displayDate(source.created_at)}</dd>
            <dt>Updated</dt><dd>{displayDate(source.updated_at)}</dd>
          </dl>
          {source.kind === 'model' && <p>Rows are calculated from the saved relationships and source data.</p>}
          {source.kind === 'refined' && <p>This copy contains the rows produced by Refine.</p>}
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

export default function DataHubWindow({ onUpload, onOpenDataset }) {
  const { refreshDatasets, removeDataset } = useContext(WarehouseContext);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [removal, setRemoval] = useState(null);
  const [registration, setRegistration] = useState(INITIAL_REGISTRATION);
  const [mutation, setMutation] = useState(null);
  const [mutationError, setMutationError] = useState('');
  const [notice, setNotice] = useState('');
  const heading = useRef(null);
  const catalogRequest = useRef(null);
  const openRequest = useRef(null);

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    return () => openRequest.current?.abort();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    catalogRequest.current = controller;
    setLoading(true);
    setLoadError('');
    axios.get(`${API_URL}/api/datahub/datasets`, { signal: controller.signal }).then(({ data }) => {
      if (controller.signal.aborted) return;
      if (!Array.isArray(data?.datasets)) throw new Error('Invalid catalog response');
      setSources(data.datasets);
      refreshDatasets(data.datasets.filter(source => source.kind === 'legacy').map(source => ({
        id: source.source_id, name: source.name, source_kind: source.source_kind,
      })));
    }).catch(error => {
      if (!controller.signal.aborted) setLoadError(errorMessage(error, 'Could not load saved datasets.'));
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [refreshDatasets, revision]);

  const query = search.trim().toLocaleLowerCase();
  const visibleSources = sources.filter(source =>
    [source.name, source.dataset_id, sourceType(source)].some(value => value.toLocaleLowerCase().includes(query))
  );
  const selectedSource = sources.find(source => source.dataset_id === selectedId);
  const removeTarget = removal?.target;
  const deleteAll = removeTarget === 'all';
  const removalOpen = removal?.open ?? false;
  const confirmLabel = deleteAll ? 'Yes' : 'Remove dataset';
  const pendingLabel = deleteAll ? 'Deleting…' : 'Removing…';
  const reload = () => setRevision(value => value + 1);

  function chooseRemoval(target) {
    setMutationError('');
    setNotice('');
    setRemoval({ open: true, target });
  }

  // Keep the target visible while the dialog fades out.
  const closeRemoval = () => setRemoval(previous => ({ ...previous, open: false }));

  function dismissRemoval() {
    if (mutation) return;
    closeRemoval();
    setMutationError('');
  }

  async function confirmRemoval() {
    if (!removalOpen || deleteAll || mutation) return;
    const { dataset_id: id, name, kind } = removeTarget;
    setMutation('removing');
    setMutationError('');
    try {
      const endpoint = kind === 'legacy' ? 'datahub' : 'datahub/saved-datasets';
      await axios.delete(`${API_URL}/api/${endpoint}/${encodeURIComponent(id)}`);
      setSources(previous => previous.filter(source => source.dataset_id !== id));
      removeDataset(id);
      closeRemoval();
      setNotice(`Removed ${name}.`);
      reload();
    } catch (error) {
      if (error.response?.status === 404) {
        setSources(previous => previous.filter(source => source.dataset_id !== id));
        removeDataset(id);
        closeRemoval();
        setNotice(`${name} is no longer in Data Hub.`);
        reload();
      } else {
        setMutationError(errorMessage(error, 'Could not remove the dataset. Try again.'));
      }
    } finally {
      setMutation(null);
    }
  }

  async function confirmDeleteAll() {
    if (!removalOpen || !deleteAll || mutation) return;
    setMutation('deleting-all');
    setMutationError('');
    try {
      await axios.delete(`${API_URL}/api/datahub`);
      catalogRequest.current?.abort();
      setSources([]);
      refreshDatasets([]);
      setSelectedId(null);
      setSearch('');
      closeRemoval();
      setNotice('Deleted all saved datasets.');
      reload();
    } catch (error) {
      setMutationError(errorMessage(error, 'Could not delete saved datasets. Try again.'));
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

  async function openDataset(source) {
    if (openRequest.current || mutation) return;
    const controller = new AbortController();
    openRequest.current = controller;
    setMutation('opening');
    setMutationError('');
    setNotice('');
    try {
      const { data } = await axios.post(`${API_URL}/api/datahub/datasets/${encodeURIComponent(source.dataset_id)}/open`, {}, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (data?.dataset?.dataset_id !== source.dataset_id || !data.workspace?.workspace_id || !data.analysis_context || !Array.isArray(data.full_data)) {
        throw new Error('Incomplete activation response');
      }
      onOpenDataset(data);
    } catch (error) {
      if (!controller.signal.aborted) setMutationError(errorMessage(error, 'Could not open the dataset. Try again.'));
    } finally {
      if (!controller.signal.aborted) {
        openRequest.current = null;
        setMutation(null);
      }
    }
  }

  return (
    <section className="datahub" aria-labelledby="datahub-title">
      <div className="datahub__body">
        <header className="datahub__heading">
          <div>
            <h1 id="datahub-title" ref={heading} tabIndex={-1}>Data Hub</h1>
            <p>Open a saved dataset to continue working with its data.</p>
          </div>
        </header>

        <div className="datahub__layout">
          <section className="datahub-library" aria-labelledby="datahub-library-heading">
            <div className="datahub-library__toolbar">
              <div>
                <h2 id="datahub-library-heading">Saved datasets</h2>
                {!loading && !loadError && <p role="status">{visibleSources.length} of {sources.length} datasets</p>}
              </div>
              <div className="datahub-library__actions">
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
                <button
                  type="button"
                  className="datahub-remove"
                  onClick={() => chooseRemoval('all')}
                  disabled={loading || !!loadError || sources.length === 0 || !!mutation}
                >
                  Delete All
                </button>
              </div>
            </div>

            {loading && <p className="datahub-message" role="status">Loading saved datasets…</p>}
            {loadError && (
              <div className="datahub-message" role="alert">
                <p>{loadError}</p>
                <button type="button" onClick={reload} disabled={!!mutation}>Retry</button>
              </div>
            )}
            {notice && <p className="datahub-message" role="status">{notice}</p>}
            {mutation === 'opening' && <p className="datahub-message" role="status">Opening dataset…</p>}
            {mutationError && !removalOpen && <p className="datahub-message datahub-error" role="alert">{mutationError}</p>}

            {!loading && !loadError && visibleSources.length === 0 && (
              <div className="datahub-empty">
                <FaDatabase aria-hidden="true" />
                <h3>{sources.length ? 'No matching datasets' : 'No saved datasets yet'}</h3>
                {!sources.length && <p>Use Save Dataset in the workspace to add data here.</p>}
                {sources.length
                  ? <button type="button" onClick={() => setSearch('')}>Clear search</button>
                  : <button type="button" onClick={onUpload}>Upload data</button>}
              </div>
            )}

            {visibleSources.length > 0 && (
              <ul className="datahub-list" aria-label="Saved datasets">
                {visibleSources.map(source => (
                  <li key={source.dataset_id} className={selectedId === source.dataset_id ? 'is-selected' : undefined}>
                    <div className="datahub-source">
                      <FaDatabase aria-hidden="true" />
                      <div>
                        <button
                          type="button"
                          className="datahub-source__name"
                          aria-label={`View details for ${source.name} (${source.dataset_id})`}
                          aria-pressed={selectedId === source.dataset_id}
                          onClick={() => setSelectedId(source.dataset_id)}
                        >
                          {source.name}
                        </button>
                        <span className="datahub-source__id">{source.revision ? `Revision ${source.revision}` : sourceType(source)}</span>
                      </div>
                    </div>
                    <dl className="datahub-source__metadata">
                      <div><dt>Type</dt><dd>{sourceType(source)}</dd></div>
                      <div><dt>Rows</dt><dd>{displayCount(source.row_count)}</dd></div>
                      <div><dt>Updated</dt><dd>{displayDate(source.updated_at || source.created_at, updatedFormat)}</dd></div>
                    </dl>
                    <div className="datahub-source__actions">
                      <button type="button" className="datahub-open" onClick={() => openDataset(source)} disabled={!!mutation}>
                        Open dataset <FaArrowRight aria-hidden="true" />
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
        open={removalOpen}
        onClose={dismissRemoval}
        aria-labelledby="datahub-remove-title"
        aria-describedby="datahub-remove-message"
      >
        <DialogTitle id="datahub-remove-title">{deleteAll ? 'Are you sure?' : 'Remove dataset?'}</DialogTitle>
        <DialogContent sx={{ overflowWrap: 'anywhere' }}>
          <p id="datahub-remove-message">
            {deleteAll
              ? 'Delete all saved datasets from Data Hub, including datasets hidden by search? Backing files will be kept.'
              : <>Remove <strong>{removeTarget?.name}</strong> from Data Hub?</>}
          </p>
          {mutationError && <p className="datahub-error" role="alert">{mutationError}</p>}
        </DialogContent>
        <DialogActions>
          <Button autoFocus disabled={!!mutation} onClick={dismissRemoval}>{deleteAll ? 'No' : 'Cancel'}</Button>
          <Button color="error" variant="contained" disabled={!!mutation} onClick={deleteAll ? confirmDeleteAll : confirmRemoval}>
            {mutation ? pendingLabel : confirmLabel}
          </Button>
        </DialogActions>
      </Dialog>
    </section>
  );
}
