import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import './BusinessObjectsPanel.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const sortDefinitions = (list) =>
  [...list].sort((a, b) => {
    const byTime = String(a.created_at || '').localeCompare(String(b.created_at || ''));
    return byTime !== 0 ? byTime : String(a.object_id || '').localeCompare(String(b.object_id || ''));
  });

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

  const isMountedRef = useRef(true);
  const activeWorkspaceIdRef = useRef(workspaceId);
  activeWorkspaceIdRef.current = workspaceId;
  const fetchRequestIdRef = useRef(0);
  const saveRequestIdRef = useRef(0);
  const modelRefreshIdRef = useRef(0);
  const isSavingRef = useRef(false);
  const previousFocusRef = useRef(null);
  const displayNameInputRef = useRef(null);

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
    isSavingRef.current = false;
    saveRequestIdRef.current += 1;
    modelRefreshIdRef.current += 1;
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
    };
  }, []);

  const handleClose = useCallback(() => {
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

  const currentListState = listStateByWorkspace[workspaceId] || { loading: true, error: null };
  const savedDefinitions = objectsByWorkspace[workspaceId] || [];
  const relationshipById = useMemo(
    () => new Map(workspaceRelationships.map((r) => [r.relationship_id, r])),
    [workspaceRelationships]
  );

  return (
    <aside
      className="bo-panel"
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
                return (
                  <li
                    key={item.object_id}
                    className={`bo-card ${item.configuration_error ? 'bo-card-error' : ''}`}
                  >
                    <div className="bo-card-header">
                      <span className="bo-card-title">{item.display_name}</span>
                      <span className="bo-help-text">{srcLabel}</span>
                    </div>
                    <div className="bo-card-meta">
                      <span>Key: {item.record_key_field}</span>
                      <span>Label: {item.display_field || 'None'}</span>
                      <span>Relationships: {relLabels.length > 0 ? relLabels.join(', ') : 'None'}</span>
                    </div>
                    {item.configuration_error && (
                      <div className="bo-config-warning">
                        {item.configuration_error.message}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

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
