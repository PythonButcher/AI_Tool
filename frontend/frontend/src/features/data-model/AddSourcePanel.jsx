import React, { useState, useEffect, useContext } from 'react';
import './AddSourcePanel.css';
import { DataContext } from '../../context/DataContext';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const AddSourcePanel = ({ workspace, existingSources, onClose, onSuccess }) => {
  const [catalogSources, setCatalogSources] = useState([]);
  const [loadingSources, setLoadingSources] = useState(false);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { recordWorkspaceMutationConflict } = useContext(DataContext);

  // Form state
  const [sourceType, setSourceType] = useState('catalog'); // 'catalog' or 'upload'
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [file, setFile] = useState(null);
  const [alias, setAlias] = useState('');
  const [role, setRole] = useState('lookup'); // 'lookup' or 'context'

  // Conflict state
  const [conflictError, setConflictError] = useState(null);
  const [currentWorkspaceVersion, setCurrentWorkspaceVersion] = useState(workspace.version);

  useEffect(() => {
    // Update local workspace version if workspace prop changes (e.g. from refresh)
    setCurrentWorkspaceVersion(workspace.version);
  }, [workspace.version]);

  useEffect(() => {
    let isMounted = true;
    const fetchCatalog = async () => {
      setLoadingSources(true);
      setError(null);
      try {
        const res = await fetch(`${API_URL}/api/data-sources`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error?.message || 'Failed to fetch catalog sources');
        }
        if (isMounted) {
          const existingIds = existingSources.map(s => s.source_id);
          const available = (data.sources || []).filter(s => !existingIds.includes(s.source_id));
          setCatalogSources(available);
        }
      } catch (err) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setLoadingSources(false);
      }
    };
    fetchCatalog();
    return () => { isMounted = false; };
  }, [existingSources]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      if (!alias) {
        // Simple default alias from filename
        setAlias(selectedFile.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_]/g, '_'));
      }
    }
  };

  const handleSourceSelect = (e) => {
    const val = e.target.value;
    setSelectedSourceId(val);
    if (val && !alias) {
      const src = catalogSources.find(s => s.source_id === val);
      if (src) {
         setAlias(src.name.replace(/[^a-zA-Z0-9_]/g, '_'));
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (role === 'primary') {
      setConflictError('Role "primary" is not allowed for additional sources.');
      return;
    }
    if (sourceType === 'catalog' && !selectedSourceId) {
      setConflictError('Please select a catalog source.');
      return;
    }
    if (sourceType === 'upload' && !file) {
      setConflictError('Please select a file to upload.');
      return;
    }

    setIsSubmitting(true);
    setConflictError(null);
    setError(null);

    try {
      let res;
      let data;

      if (sourceType === 'catalog') {
        const payload = {
          source_id: selectedSourceId,
          version: currentWorkspaceVersion
        };
        if (alias) payload.alias = alias;
        if (role) payload.role = role;

        res = await fetch(`${API_URL}/api/data-workspaces/${workspace.workspace_id}/sources`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        data = await res.json();
      } else {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('workspace_id', workspace.workspace_id);
        formData.append('workspace_version', currentWorkspaceVersion);
        if (alias) formData.append('alias', alias);
        if (role) formData.append('role', role);

        res = await fetch(`${API_URL}/api/upload`, {
          method: 'POST',
          body: formData
        });
        data = await res.json();
      }

      if (!res.ok) {
        const errCode = data.error?.code;
        const errMsg = data.error?.message || 'Failed to add source';
        
        if (errCode === 'workspace_version_conflict' || errCode === 'workspace_alias_conflict' || errCode === 'duplicate_workspace_membership') {
           setConflictError(errMsg);
           
           if (errCode === 'workspace_version_conflict') {
              recordWorkspaceMutationConflict({
                code: errCode,
                message: errMsg,
                attemptedVersion: currentWorkspaceVersion
              });
              try {
                await onSuccess(true);
              } catch (refreshErr) {
                setConflictError(`${errMsg} (Refresh also failed: ${refreshErr.message})`);
              }
           }
           setIsSubmitting(false);
           return;
        }
        
        throw new Error(errMsg);
      }

      // Success
      try {
        await onSuccess(false, data);
        onClose();
      } catch (refreshErr) {
        setError(`Source added, but workspace refresh failed: ${refreshErr.message}`);
        setIsSubmitting(false);
      }
    } catch (err) {
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="add-source-overlay" role="dialog" aria-modal="true" aria-labelledby="add-source-title">
      <div className="add-source-panel">
        <div className="add-source-header">
          <h2 id="add-source-title">Add Source to Workspace</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close panel" disabled={isSubmitting}>&times;</button>
        </div>
        <div className="add-source-body">
          <p className="workspace-identifier">Targeting workspace: <strong>{workspace.name || workspace.workspace_id}</strong></p>
          
          <div className="source-type-selector">
            <label className={`type-radio ${sourceType === 'catalog' ? 'active' : ''}`}>
              <input type="radio" name="sourceType" value="catalog" checked={sourceType === 'catalog'} onChange={() => setSourceType('catalog')} disabled={isSubmitting} />
              Catalog Source
            </label>
            <label className={`type-radio ${sourceType === 'upload' ? 'active' : ''}`}>
              <input type="radio" name="sourceType" value="upload" checked={sourceType === 'upload'} onChange={() => setSourceType('upload')} disabled={isSubmitting} />
              File Upload
            </label>
          </div>

          <form onSubmit={handleSubmit} className="add-source-form">
            {sourceType === 'catalog' ? (
              <div className="form-group">
                <label htmlFor="catalog-select">Select Catalog Source</label>
                {loadingSources ? (
                  <div className="loading-text">Loading catalog...</div>
                ) : (
                  <select id="catalog-select" value={selectedSourceId} onChange={handleSourceSelect} disabled={isSubmitting || catalogSources.length === 0} required>
                    <option value="">-- Choose a source --</option>
                    {catalogSources.map(src => (
                      <option key={src.source_id} value={src.source_id}>
                        {src.name} {src.source_kind ? `(${src.source_kind})` : ''}
                      </option>
                    ))}
                  </select>
                )}
                {catalogSources.length === 0 && !loadingSources && (
                  <div className="form-help text-warning">No available catalog sources to add.</div>
                )}
              </div>
            ) : (
              <div className="form-group">
                <label htmlFor="file-upload">Upload Governed File</label>
                <input type="file" id="file-upload" onChange={handleFileChange} disabled={isSubmitting} required accept=".csv,.json,.parquet" />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="source-alias">Alias (optional)</label>
              <input type="text" id="source-alias" value={alias} onChange={(e) => setAlias(e.target.value)} disabled={isSubmitting} placeholder="e.g. sales_data" />
              <div className="form-help">Unique namespace for fields within this workspace.</div>
            </div>

            <div className="form-group">
              <label htmlFor="source-role">Role</label>
              <select id="source-role" value={role} onChange={(e) => setRole(e.target.value)} disabled={isSubmitting}>
                <option value="lookup">Lookup</option>
                <option value="context">Context</option>
              </select>
            </div>

            {error && <div className="panel-alert alert-error" role="alert">{error}</div>}
            {conflictError && <div className="panel-alert alert-warning" role="alert">{conflictError}</div>}

            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting || (sourceType === 'catalog' && !selectedSourceId) || (sourceType === 'upload' && !file)}>
                {isSubmitting ? 'Adding...' : 'Add Source'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddSourcePanel;
