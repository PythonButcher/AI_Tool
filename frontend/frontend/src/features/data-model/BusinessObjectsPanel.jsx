import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import './BusinessObjectsPanel.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const sortDefinitions = (list) =>
  [...list].sort((a, b) => {
    const byTime = String(a.created_at || '').localeCompare(String(b.created_at || ''));
    return byTime !== 0 ? byTime : String(a.object_id || '').localeCompare(String(b.object_id || ''));
  });

const INITIAL_SEARCH = { status: 'idle', records: [], hasMore: false, governance: null, error: null };
const INITIAL_DETAIL = { status: 'idle', record: null, relationships: [], governance: null, error: null };
const INITIAL_BROWSER = { objectId: null, query: '', submittedQuery: '', search: INITIAL_SEARCH, selectedKey: null, detail: INITIAL_DETAIL };
const formatCellValue = (v) => (v === null || v === undefined || v === '' ? '—' : typeof v === 'boolean' ? String(v) : typeof v === 'object' ? JSON.stringify(v) : String(v));
const readRecordJson = async (url, options, fallback) => {
  const res = options ? await fetch(url, options) : await fetch(url);
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  return { ok: res.ok, status: res.status, data, fallback };
};
const renderGovernanceNotice = (readiness, fallbackMessage) => {
  if (!readiness || readiness.status === 'ready') return null;
  const isBlocked = readiness.status === 'blocked';
  const primary = readiness.next_action || fallbackMessage || (isBlocked ? 'Access blocked by data governance.' : 'Governance warning detected.');
  const extra = (Array.isArray(readiness.reasons) ? readiness.reasons : []).map((r) => r?.message).filter((m) => m && m !== primary);
  return (
    <div className={isBlocked ? 'bo-gov-block' : 'bo-gov-warning'} role={isBlocked ? 'alert' : 'status'}>
      <strong className="bo-gov-title">{isBlocked ? 'Access Blocked' : 'Governance Warning'}</strong>
      <span>{primary}</span>
      {extra.length > 0 && <span className="bo-gov-reasons">{extra.join(' ')}</span>}
    </div>
  );
};
const renderBrowserError = (state, retryLabel, onRetry) => (
  <div className="bo-browser-error">
    {state.governance?.status === 'blocked' ? renderGovernanceNotice(state.governance, state.error?.message) : <div className="bo-alert" role="alert"><span>{state.error?.message}</span></div>}
    <div className="bo-alert-actions"><button type="button" className="btn btn-secondary" onClick={onRetry}>{retryLabel}</button></div>
  </div>
);

const BusinessObjectsPanel = ({ workspaceId, sources = [], relationships = [], onRefreshModel, onClose, triggerRef }) => {
  const [objectsByWorkspace, setObjectsByWorkspace] = useState({});
  const [listStateByWorkspace, setListStateByWorkspace] = useState({});
  const [refreshedModel, setRefreshedModel] = useState(null);
  const [draftWorkspaceId, setDraftWorkspaceId] = useState(workspaceId);
  const [displayName, setDisplayName] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [recordKeyField, setRecordKeyField] = useState('');
  const [displayField, setDisplayField] = useState('');
  const [relationshipIds, setRelationshipIds] = useState([]);
  const [formError, setFormError] = useState(null);
  const [canRefreshAfterSaveError, setCanRefreshAfterSaveError] = useState(false);
  const [canRefreshModelAfterConflict, setCanRefreshModelAfterConflict] = useState(false);
  const [isRefreshingModel, setIsRefreshingModel] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [browser, setBrowser] = useState(INITIAL_BROWSER);

  const isMountedRef = useRef(true);
  const activeWorkspaceIdRef = useRef(workspaceId);
  activeWorkspaceIdRef.current = workspaceId;
  const fetchRequestIdRef = useRef(0);
  const saveRequestIdRef = useRef(0);
  const modelRefreshIdRef = useRef(0);
  const browserRef = useRef({ objectId: null, key: null, searchId: 0, detailId: 0, pendingSearch: null, pendingDetail: null });
  const isSavingRef = useRef(false);
  const previousFocusRef = useRef(null);
  const displayNameInputRef = useRef(null);

  const invalidateBrowser = (nextObjectId = null) => {
    const b = browserRef.current;
    b.objectId = nextObjectId; b.key = null; b.searchId += 1; b.detailId += 1; b.pendingSearch = null; b.pendingDetail = null;
  };

  if (draftWorkspaceId !== workspaceId) {
    setDraftWorkspaceId(workspaceId);
    setRefreshedModel(null);
    setDisplayName('');
    setSourceId('');
    setRecordKeyField('');
    setDisplayField('');
    setRelationshipIds([]);
    setFormError(null);
    setCanRefreshAfterSaveError(false);
    setCanRefreshModelAfterConflict(false);
    setIsRefreshingModel(false);
    setIsSaving(false);
    setBrowser(INITIAL_BROWSER);
    isSavingRef.current = false;
    saveRequestIdRef.current += 1;
    modelRefreshIdRef.current += 1;
    invalidateBrowser(null);
  }

  useEffect(() => {
    isMountedRef.current = true;
    previousFocusRef.current = document.activeElement;
    displayNameInputRef.current?.focus();
    return () => {
      isMountedRef.current = false;
      fetchRequestIdRef.current += 1;
      saveRequestIdRef.current += 1;
      modelRefreshIdRef.current += 1;
      invalidateBrowser(null);
    };
  }, []);

  const handleClose = useCallback(() => {
    invalidateBrowser(null);
    const focusTarget = triggerRef?.current || previousFocusRef.current;
    onClose?.();
    if (focusTarget && typeof focusTarget.focus === 'function') {
      focusTarget.focus();
    }
  }, [onClose, triggerRef]);

  const effectiveSources = refreshedModel?.workspaceId === workspaceId && Array.isArray(refreshedModel.sources) ? refreshedModel.sources : sources;
  const effectiveRelationships =
    refreshedModel?.workspaceId === workspaceId && Array.isArray(refreshedModel.relationships)
      ? refreshedModel.relationships
      : relationships;

  const workspaceSources = useMemo(
    () => (effectiveSources || []).filter((s) => s && s.source_id && s.workspace_id === workspaceId),
    [effectiveSources, workspaceId]
  );

  const memberById = useMemo(
    () => new Map(workspaceSources.map((s) => [s.source_id, s])),
    [workspaceSources]
  );

  const workspaceRelationships = useMemo(
    () => (effectiveRelationships || []).filter((r) => r && r.relationship_id && r.workspace_id === workspaceId),
    [effectiveRelationships, workspaceId]
  );

  const selectedSource = memberById.get(sourceId) || null;
  const sourceFields = useMemo(
    () => (Array.isArray(selectedSource?.schema) ? selectedSource.schema.filter((f) => f && f.name) : []),
    [selectedSource]
  );

  const applicableRelationships = useMemo(() => {
    if (!sourceId || !memberById.has(sourceId)) return [];
    return workspaceRelationships.filter((rel) => {
      const isLeft = rel.left_source_id === sourceId;
      const isRight = rel.right_source_id === sourceId;
      if (!isLeft && !isRight) return false;
      const otherId = isLeft ? rel.right_source_id : rel.left_source_id;
      return Boolean(otherId && memberById.has(otherId));
    });
  }, [sourceId, memberById, workspaceRelationships]);

  const formatRelationshipLabel = useCallback(
    (rel, refSourceId) => {
      const isLeft = rel.left_source_id === refSourceId;
      const otherId = isLeft ? rel.right_source_id : rel.left_source_id;
      const other = memberById.get(otherId);
      const otherName = other?.alias || other?.name || otherId || rel.relationship_id;
      const pairs = (rel.field_pairs || [])
        .filter((p) => p && (p.left_field || p.right_field))
        .map((p) => `${p.left_field} = ${p.right_field}`)
        .join(', ');
      return pairs ? `${otherName} (${pairs})` : `${otherName} (${rel.relationship_id})`;
    },
    [memberById]
  );

  const loadDefinitions = useCallback(async (targetWorkspaceId = activeWorkspaceIdRef.current) => {
    if (!targetWorkspaceId) return;
    const requestId = ++fetchRequestIdRef.current;
    setListStateByWorkspace((prev) => ({
      ...prev,
      [targetWorkspaceId]: { loading: true, error: null },
    }));
    try {
      const url = `${API_URL}/api/data-workspaces/${encodeURIComponent(targetWorkspaceId)}/business-objects`;
      const res = await fetch(url);
      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      if (!isMountedRef.current || activeWorkspaceIdRef.current !== targetWorkspaceId || fetchRequestIdRef.current !== requestId) {
        return;
      }
      if (!res.ok) {
        throw new Error(data?.error?.message || 'Failed to load Business Objects.');
      }
      const items = Array.isArray(data?.business_objects) ? data.business_objects : [];
      setObjectsByWorkspace((prev) => {
        const byId = new Map((prev[targetWorkspaceId] || []).map((item) => [item.object_id, item]));
        for (const item of items) {
          if (item && item.object_id) {
            byId.set(item.object_id, item);
          }
        }
        return {
          ...prev,
          [targetWorkspaceId]: sortDefinitions(Array.from(byId.values())),
        };
      });
      setListStateByWorkspace((prev) => ({
        ...prev,
        [targetWorkspaceId]: { loading: false, error: null },
      }));
    } catch (err) {
      if (!isMountedRef.current || activeWorkspaceIdRef.current !== targetWorkspaceId || fetchRequestIdRef.current !== requestId) {
        return;
      }
      setListStateByWorkspace((prev) => ({
        ...prev,
        [targetWorkspaceId]: { loading: false, error: err.message || 'Failed to load Business Objects.' },
      }));
    }
  }, []);

  useEffect(() => {
    loadDefinitions(workspaceId);
  }, [workspaceId, loadDefinitions]);

  useEffect(() => {
    if (!sourceId) return;
    if (!memberById.has(sourceId)) {
      setSourceId('');
      setRecordKeyField('');
      setDisplayField('');
      setRelationshipIds([]);
      return;
    }
    const validFields = new Set(sourceFields.map((f) => f.name));
    setRecordKeyField((prev) => (prev && !validFields.has(prev) ? '' : prev));
    setDisplayField((prev) => (prev && !validFields.has(prev) ? '' : prev));
    const validRelIds = new Set(applicableRelationships.map((r) => r.relationship_id));
    setRelationshipIds((prev) => {
      const next = prev.filter((id) => validRelIds.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [sourceId, memberById, sourceFields, applicableRelationships]);

  const handleRefreshModel = async () => {
    if (!onRefreshModel || isSavingRef.current || isRefreshingModel) return;
    const targetWorkspaceId = workspaceId;
    const refreshId = ++modelRefreshIdRef.current;
    setIsRefreshingModel(true);
    try {
      const result = await onRefreshModel(targetWorkspaceId);
      if (!isMountedRef.current || activeWorkspaceIdRef.current !== targetWorkspaceId || modelRefreshIdRef.current !== refreshId) {
        return;
      }
      if (result && (Array.isArray(result.sources) || Array.isArray(result.relationships))) {
        setRefreshedModel({ workspaceId: targetWorkspaceId, sources: result.sources, relationships: result.relationships });
      }
    } catch (err) {
      if (isMountedRef.current && activeWorkspaceIdRef.current === targetWorkspaceId && modelRefreshIdRef.current === refreshId) {
        setFormError((prev) => prev || err.message || 'Failed to refresh model choices.');
      }
    } finally {
      if (isMountedRef.current && activeWorkspaceIdRef.current === targetWorkspaceId && modelRefreshIdRef.current === refreshId) {
        setIsRefreshingModel(false);
      }
    }
  };

  const handleSourceChange = (e) => {
    if (isSavingRef.current) return;
    const nextSourceId = e.target.value;
    setSourceId(nextSourceId);
    const nextSource = memberById.get(nextSourceId);
    const validFields = new Set((nextSource?.schema || []).map((f) => f.name));
    setRecordKeyField((prev) => (validFields.has(prev) ? prev : ''));
    setDisplayField((prev) => (validFields.has(prev) ? prev : ''));
    const validRelIds = new Set(
      workspaceRelationships
        .filter((r) => {
          if (r.left_source_id !== nextSourceId && r.right_source_id !== nextSourceId) return false;
          const otherId = r.left_source_id === nextSourceId ? r.right_source_id : r.left_source_id;
          return Boolean(otherId && memberById.has(otherId));
        })
        .map((r) => r.relationship_id)
    );
    setRelationshipIds((prev) => prev.filter((id) => validRelIds.has(id)));
  };

  const handleToggleRelationship = (relId) => {
    if (isSavingRef.current) return;
    setRelationshipIds((prev) =>
      prev.includes(relId) ? prev.filter((id) => id !== relId) : [...prev, relId]
    );
  };

  const handleSubmit = async (e) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    if (isSavingRef.current) return;

    if (!displayName.trim()) {
      setFormError('Display name is required.');
      return;
    }
    if (!sourceId || !memberById.has(sourceId)) {
      setFormError('Select a workspace source.');
      return;
    }
    const validFieldNames = new Set(sourceFields.map((f) => f.name));
    if (!recordKeyField || !validFieldNames.has(recordKeyField)) {
      setFormError('Select a record key field.');
      return;
    }

    const validRelIds = new Set(applicableRelationships.map((r) => r.relationship_id));
    const submittedWorkspaceId = workspaceId;
    const payload = {
      display_name: displayName,
      source_id: sourceId,
      record_key_field: recordKeyField,
      display_field: displayField && validFieldNames.has(displayField) ? displayField : null,
      relationship_ids: relationshipIds.filter((id) => validRelIds.has(id)),
    };

    isSavingRef.current = true;
    const saveId = ++saveRequestIdRef.current;
    setIsSaving(true);
    setFormError(null);
    setCanRefreshAfterSaveError(false);
    setCanRefreshModelAfterConflict(false);

    try {
      const url = `${API_URL}/api/data-workspaces/${encodeURIComponent(submittedWorkspaceId)}/business-objects`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      if (!isMountedRef.current || activeWorkspaceIdRef.current !== submittedWorkspaceId || saveRequestIdRef.current !== saveId) {
        return;
      }
      if (!res.ok) {
        setFormError(data?.error?.message || 'Failed to save Business Object.');
        setCanRefreshModelAfterConflict(res.status === 409);
        setCanRefreshAfterSaveError(res.status >= 500);
        isSavingRef.current = false;
        setIsSaving(false);
        return;
      }
      const saved = data?.business_object;
      if (saved && saved.object_id) {
        setObjectsByWorkspace((prev) => {
          const existing = (prev[submittedWorkspaceId] || []).filter((item) => item.object_id !== saved.object_id);
          return {
            ...prev,
            [submittedWorkspaceId]: sortDefinitions([...existing, saved]),
          };
        });
      }
      setDisplayName('');
      setSourceId('');
      setRecordKeyField('');
      setDisplayField('');
      setRelationshipIds([]);
      setFormError(null);
      setCanRefreshAfterSaveError(false);
      setCanRefreshModelAfterConflict(false);
      isSavingRef.current = false;
      setIsSaving(false);
    } catch (err) {
      if (!isMountedRef.current || activeWorkspaceIdRef.current !== submittedWorkspaceId || saveRequestIdRef.current !== saveId) {
        return;
      }
      setFormError(err.message || 'Network error while saving Business Object.');
      setCanRefreshAfterSaveError(true);
      setCanRefreshModelAfterConflict(false);
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  const runRecordSearch = useCallback(async (targetWs, targetObj, queryText) => {
    if (!targetWs || !targetObj) return;
    const b = browserRef.current;
    const sig = `${targetWs}|${targetObj}|${queryText}`;
    if (b.pendingSearch === sig) return;
    const reqId = ++b.searchId;
    b.detailId += 1; b.pendingSearch = sig; b.pendingDetail = null; b.key = null;
    setBrowser((p) => ({ ...p, objectId: targetObj, submittedQuery: queryText, selectedKey: null, detail: INITIAL_DETAIL, search: { ...INITIAL_SEARCH, status: 'loading' } }));
    try {
      const base = `${API_URL}/api/data-workspaces/${encodeURIComponent(targetWs)}/business-objects/${encodeURIComponent(targetObj)}/records`;
      const url = queryText ? `${base}?${new URLSearchParams({ q: queryText }).toString()}` : base;
      const { ok, status, data, fallback } = await readRecordJson(url, null, 'Failed to load records for this Business Object.');
      if (!isMountedRef.current || activeWorkspaceIdRef.current !== targetWs || b.objectId !== targetObj || b.searchId !== reqId) return;
      b.pendingSearch = null;
      const search = ok
        ? { status: 'ready', records: Array.isArray(data?.records) ? data.records : [], hasMore: Boolean(data?.has_more), governance: data?.governance_readiness || null, error: null }
        : { status: 'error', records: [], hasMore: false, governance: data?.governance_readiness || null, error: { code: data?.error?.code || 'record_search_failed', message: data?.error?.message || fallback, status } };
      setBrowser((p) => ({ ...p, search }));
    } catch (err) {
      if (!isMountedRef.current || activeWorkspaceIdRef.current !== targetWs || b.objectId !== targetObj || b.searchId !== reqId) return;
      b.pendingSearch = null;
      setBrowser((p) => ({ ...p, search: { status: 'error', records: [], hasMore: false, governance: null, error: { code: 'network_error', message: err.message || 'Network error while searching records.', status: 0 } } }));
    }
  }, []);

  const loadRecordDetail = useCallback(async (targetWs, targetObj, key) => {
    if (!targetWs || !targetObj || !key || typeof key.type !== 'string' || typeof key.value !== 'string') return;
    const b = browserRef.current;
    const typedKey = { type: key.type, value: key.value };
    const sig = `${targetWs}|${targetObj}|${typedKey.type}|${typedKey.value}`;
    if (b.pendingDetail === sig) return;
    const reqId = ++b.detailId;
    b.pendingDetail = sig; b.key = typedKey;
    setBrowser((p) => ({ ...p, selectedKey: typedKey, detail: { ...INITIAL_DETAIL, status: 'loading' } }));
    try {
      const url = `${API_URL}/api/data-workspaces/${encodeURIComponent(targetWs)}/business-objects/${encodeURIComponent(targetObj)}/records/detail`;
      const { ok, status, data, fallback } = await readRecordJson(
        url,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: typedKey }) },
        'Failed to load record details.'
      );
      if (!isMountedRef.current || activeWorkspaceIdRef.current !== targetWs || b.objectId !== targetObj || b.detailId !== reqId || b.key?.type !== typedKey.type || b.key?.value !== typedKey.value) return;
      b.pendingDetail = null;
      const detail = ok
        ? { status: 'ready', record: data?.record || null, relationships: Array.isArray(data?.relationships) ? data.relationships : [], governance: data?.governance_readiness || null, error: null }
        : { status: 'error', record: null, relationships: [], governance: data?.governance_readiness || null, error: { code: data?.error?.code || 'record_detail_failed', message: data?.error?.message || fallback, status } };
      setBrowser((p) => ({ ...p, detail }));
    } catch (err) {
      if (!isMountedRef.current || activeWorkspaceIdRef.current !== targetWs || b.objectId !== targetObj || b.detailId !== reqId) return;
      b.pendingDetail = null;
      setBrowser((p) => ({ ...p, detail: { status: 'error', record: null, relationships: [], governance: null, error: { code: 'network_error', message: err.message || 'Network error while loading record details.', status: 0 } } }));
    }
  }, []);

  const handleSelectDefinition = useCallback((item) => {
    if (!item?.object_id || (browserRef.current.objectId === item.object_id && browserRef.current.pendingSearch === `${workspaceId}|${item.object_id}|`)) return;
    invalidateBrowser(item.object_id);
    setBrowser({ ...INITIAL_BROWSER, objectId: item.object_id, search: { ...INITIAL_SEARCH, status: 'loading' } });
    runRecordSearch(workspaceId, item.object_id, '');
  }, [workspaceId, runRecordSearch]);

  const handleCloseBrowser = useCallback(() => { invalidateBrowser(null); setBrowser(INITIAL_BROWSER); }, []);
  const handleSearchSubmit = (e) => { e.preventDefault(); if (browser.objectId) runRecordSearch(workspaceId, browser.objectId, browser.query); };

  const currentListState = listStateByWorkspace[workspaceId] || { loading: true, error: null };
  const savedDefinitions = objectsByWorkspace[workspaceId] || [];
  const activeDefinition = savedDefinitions.find((i) => i.object_id === browser.objectId) || null;
  const relationshipById = useMemo(
    () => new Map(workspaceRelationships.map((r) => [r.relationship_id, r])),
    [workspaceRelationships]
  );

  return (
    <aside
      className={`bo-panel${activeDefinition ? ' bo-panel-browsing' : ''}`}
      role="dialog"
      aria-labelledby="business-objects-panel-title"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          handleClose();
        }
      }}
    >
      <div className="bo-panel-header">
        <h2 id="business-objects-panel-title">Business Objects</h2>
        <button type="button" className="close-btn" onClick={handleClose} aria-label="Close Business Objects">
          &times;
        </button>
      </div>

      <div className="bo-panel-body">
        <section className="bo-section" aria-label="Saved Business Objects">
          <h3 className="bo-section-title">Saved Definitions</h3>
          {currentListState.loading && (
            <div className="bo-state-box" role="status" aria-live="polite">
              Loading Business Objects...
            </div>
          )}
          {!currentListState.loading && currentListState.error && (
            <div className="bo-alert" role="alert">
              <span>{currentListState.error}</span>
              <div className="bo-alert-actions">
                <button type="button" className="btn btn-secondary" onClick={() => loadDefinitions(workspaceId)}>
                  Retry
                </button>
              </div>
            </div>
          )}
          {!currentListState.loading && !currentListState.error && savedDefinitions.length === 0 && (
            <div className="bo-state-box">
              <span>No Business Objects saved in this workspace yet.</span>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => displayNameInputRef.current?.focus()}
              >
                New Definition
              </button>
            </div>
          )}
          {!currentListState.loading && !currentListState.error && savedDefinitions.length > 0 && (
            <ul className="bo-list">
              {savedDefinitions.map((item) => {
                const srcMember = memberById.get(item.source_id);
                const srcLabel = srcMember ? srcMember.alias || srcMember.name || item.source_id : item.source_id;
                const relLabels = (item.relationship_ids || []).map((relId) => {
                  const rel = relationshipById.get(relId);
                  return rel ? formatRelationshipLabel(rel, item.source_id) : relId;
                });
                const isSelected = browser.objectId === item.object_id;
                return (
                  <li key={item.object_id} className={`bo-card${item.configuration_error ? ' bo-card-error' : ''}${isSelected ? ' bo-card-selected' : ''}`}>
                    <button type="button" className="bo-card-btn" aria-pressed={isSelected} onClick={() => handleSelectDefinition(item)}>
                      <span className="bo-card-header">
                        <span className="bo-card-title">{item.display_name}</span>
                        <span className="bo-help-text">{srcLabel}</span>
                      </span>
                      <span className="bo-card-meta">
                        <span>Key: {item.record_key_field}</span>
                        <span>Label: {item.display_field || 'None'}</span>
                        <span>Relationships: {relLabels.length > 0 ? relLabels.join(', ') : 'None'}</span>
                      </span>
                    </button>
                    {item.configuration_error && <div className="bo-config-warning">{item.configuration_error.message}</div>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {activeDefinition && (
          <section className="bo-section bo-browser" aria-label="Record Browser">
            <div className="bo-browser-header">
              <div className="bo-browser-heading">
                <h3 className="bo-browser-title">{activeDefinition.display_name} Records</h3>
                <span className="bo-help-text">{(memberById.get(activeDefinition.source_id)?.alias || memberById.get(activeDefinition.source_id)?.name || activeDefinition.source_id)} · Key: {activeDefinition.record_key_field}</span>
              </div>
              <button type="button" className="bo-text-btn" onClick={handleCloseBrowser} aria-label="Close Record Browser">Done</button>
            </div>
            <form className="bo-search-form" onSubmit={handleSearchSubmit}>
              <label htmlFor="bo-record-search" className="bo-search-label">Search {activeDefinition.display_name} records</label>
              <div className="bo-search-row">
                <input id="bo-record-search" type="search" maxLength={200} value={browser.query} onChange={(e) => setBrowser((p) => ({ ...p, query: e.target.value }))} placeholder="Search by name or ID..." />
                <button type="submit" className="btn btn-primary bo-search-btn">{browser.search.status === 'loading' ? 'Searching...' : 'Search'}</button>
              </div>
            </form>
            {browser.search.status === 'loading' && <div className="bo-state-box" role="status" aria-live="polite">Searching records...</div>}
            {browser.search.status === 'error' && renderBrowserError(browser.search, 'Retry Search', () => runRecordSearch(workspaceId, activeDefinition.object_id, browser.submittedQuery))}
            {browser.search.status === 'ready' && (
              <>
                {renderGovernanceNotice(browser.search.governance)}
                {browser.search.records.length === 0 ? <div className="bo-state-box" role="status">No matching records found.</div> : (
                  <div className="bo-record-results">
                    <ul className="bo-record-list" aria-label="Matching records">
                      {browser.search.records.map((rec) => {
                        const recSelected = browser.selectedKey?.type === rec.key.type && browser.selectedKey?.value === rec.key.value;
                        return (
                          <li key={`${rec.key.type}:${rec.key.value}`} className="bo-record-item">
                            <button type="button" className={`bo-record-btn${recSelected ? ' bo-record-btn-selected' : ''}`} aria-pressed={recSelected} onClick={() => loadRecordDetail(workspaceId, activeDefinition.object_id, rec.key)}>
                              <span className="bo-record-label" title={rec.label}>{rec.label}</span>
                              <span className="bo-record-key" title={rec.key.value}>{rec.key.value}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    {browser.search.hasMore && <div className="bo-truncation-note" role="status">Showing first {browser.search.records.length} matching records. Refine your search for more.</div>}
                  </div>
                )}
              </>
            )}
            {browser.selectedKey && browser.detail.status !== 'idle' && (
              <section className="bo-detail" aria-label="Record Detail">
                {browser.detail.status === 'loading' && <div className="bo-state-box" role="status" aria-live="polite">Loading record details...</div>}
                {browser.detail.status === 'error' && renderBrowserError(browser.detail, 'Retry Record', () => loadRecordDetail(workspaceId, activeDefinition.object_id, browser.selectedKey))}
                {browser.detail.status === 'ready' && browser.detail.record && (
                  <div className="bo-detail-body">
                    <div className="bo-detail-header">
                      <h4 className="bo-detail-title">{browser.detail.record.label}</h4>
                      <span className="bo-detail-id">{activeDefinition.record_key_field}: {browser.detail.record.key.value}</span>
                    </div>
                    {renderGovernanceNotice(browser.detail.governance)}
                    <dl className="bo-kv-grid">{Object.entries(browser.detail.record.fields || {}).map(([k, v]) => <div key={k} className="bo-kv-row"><dt>{k}</dt><dd>{formatCellValue(v)}</dd></div>)}</dl>
                    {browser.detail.relationships.map((relSec) => {
                      const relSrc = memberById.get(relSec.source_id);
                      const relTitle = relSrc?.alias || relSrc?.name || relSec.source_id;
                      const relRows = Array.isArray(relSec.rows) ? relSec.rows : [];
                      const relCols = relRows.length > 0 ? Array.from(new Set(relRows.flatMap((row) => Object.keys(row || {})))) : [];
                      return (
                        <section key={relSec.relationship_id} className="bo-rel-section" aria-label={`Related ${relTitle}`}>
                          <div className="bo-rel-header">
                            <h5 className="bo-rel-title">{relTitle}</h5>
                            {relSec.status === 'ready' && <span className="bo-rel-count">{relSec.has_more ? `${relRows.length} of ${relSec.total_count}` : `${relSec.total_count} ${relSec.total_count === 1 ? 'row' : 'rows'}`}</span>}
                          </div>
                          {relSec.status === 'unavailable' ? (
                            <div className="bo-rel-unavailable" role="status"><strong>Relationship unavailable</strong><span>{relSec.error?.message || 'This relationship is currently unavailable.'}</span></div>
                          ) : (
                            <>
                              {renderGovernanceNotice(relSec.governance_readiness)}
                              {relRows.length === 0 ? <div className="bo-rel-empty">No related rows for this record.</div> : (
                                <>
                                  <div className="bo-table-wrap">
                                    <table className="bo-table">
                                      <thead><tr>{relCols.map((col) => <th key={col} scope="col">{col}</th>)}</tr></thead>
                                      <tbody>{relRows.map((row, idx) => <tr key={idx}>{relCols.map((col) => <td key={col}>{formatCellValue(row?.[col])}</td>)}</tr>)}</tbody>
                                    </table>
                                  </div>
                                  {relSec.has_more && <div className="bo-truncation-note" role="status">Showing first {relRows.length} of {relSec.total_count} related rows.</div>}
                                </>
                              )}
                            </>
                          )}
                        </section>
                      );
                    })}
                  </div>
                )}
              </section>
            )}
          </section>
        )}

        <section className="bo-section" aria-label="Create Business Object">
          <h3 className="bo-section-title">Configure New Object</h3>
          <form className="bo-form" onSubmit={handleSubmit} noValidate>
            {formError && (
              <div className="bo-alert" role="alert" aria-live="assertive">
                <span>{formError}</span>
                {(canRefreshAfterSaveError || canRefreshModelAfterConflict) && (
                  <div className="bo-alert-actions">
                    {canRefreshAfterSaveError && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => loadDefinitions(workspaceId)}
                        disabled={isSaving}
                      >
                        Refresh Saved List
                      </button>
                    )}
                    {canRefreshModelAfterConflict && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleRefreshModel}
                        disabled={isSaving || isRefreshingModel}
                      >
                        {isRefreshingModel ? 'Refreshing...' : 'Refresh Model Choices'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="bo-field">
              <label htmlFor="bo-display-name">Display Name</label>
              <input
                ref={displayNameInputRef}
                id="bo-display-name"
                type="text"
                value={displayName}
                onChange={(e) => {
                  if (!isSavingRef.current) setDisplayName(e.target.value);
                }}
                disabled={isSaving}
                placeholder="e.g. Customer"
                required
              />
            </div>

            <div className="bo-field">
              <label htmlFor="bo-source-select">Member Source</label>
              <select
                id="bo-source-select"
                value={sourceId}
                onChange={handleSourceChange}
                disabled={isSaving}
                required
              >
                <option value="">Select source...</option>
                {workspaceSources.map((src) => (
                  <option key={src.source_id} value={src.source_id}>
                    {src.alias || src.name || src.source_id}
                  </option>
                ))}
              </select>
            </div>

            <div className="bo-field">
              <label htmlFor="bo-record-key-select">Record Key Field</label>
              <select
                id="bo-record-key-select"
                value={recordKeyField}
                onChange={(e) => {
                  if (!isSavingRef.current) setRecordKeyField(e.target.value);
                }}
                disabled={isSaving || !selectedSource}
                required
              >
                <option value="">Select record key...</option>
                {sourceFields.map((field) => (
                  <option key={field.name} value={field.name}>
                    {field.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="bo-field">
              <label htmlFor="bo-display-field-select">Label Field (optional)</label>
              <select
                id="bo-display-field-select"
                value={displayField}
                onChange={(e) => {
                  if (!isSavingRef.current) setDisplayField(e.target.value);
                }}
                disabled={isSaving || !selectedSource}
              >
                <option value="">None</option>
                {sourceFields.map((field) => (
                  <option key={field.name} value={field.name}>
                    {field.name}
                  </option>
                ))}
              </select>
            </div>

            <fieldset className="bo-fieldset" disabled={isSaving || !selectedSource}>
              <legend>Direct Relationships</legend>
              {!selectedSource && <span className="bo-help-text">Select a source to see relationships.</span>}
              {selectedSource && applicableRelationships.length === 0 && (
                <span className="bo-help-text">No direct relationships connect this source.</span>
              )}
              {applicableRelationships.map((rel) => {
                const label = formatRelationshipLabel(rel, sourceId);
                return (
                  <label key={rel.relationship_id} className="bo-checkbox-label">
                    <input
                      type="checkbox"
                      checked={relationshipIds.includes(rel.relationship_id)}
                      onChange={() => handleToggleRelationship(rel.relationship_id)}
                      disabled={isSaving}
                    />
                    <span>{label}</span>
                  </label>
                );
              })}
            </fieldset>

            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Business Object'}
            </button>
          </form>
        </section>
      </div>
    </aside>
  );
};

export default BusinessObjectsPanel;
