import React, { useEffect, useState } from 'react';
import { getDecisionAssets, getDecisionAssetById, archiveDecisionAsset, restoreDecisionAsset, deleteDecisionAsset } from './decisionApi';
import { FaHistory, FaFolderOpen, FaExclamationTriangle, FaSync, FaSearch, FaArchive, FaUndo, FaTrash, FaInfoCircle, FaTimes } from 'react-icons/fa';
import { Typography, CircularProgress, IconButton, Divider, TextField, Select, MenuItem, InputAdornment, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';
import './DecisionAssetLibrary.css';

export default function DecisionAssetLibrary({ onReopenAsset, activeAssetId, refreshTrigger, onAssetDeleted, onClose }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [readinessFilter, setReadinessFilter] = useState('');
  const [datasetFilter, setDatasetFilter] = useState('');
  const [graphStateFilter, setGraphStateFilter] = useState('');
  const [archivedFilter, setArchivedFilter] = useState('active');

  const [deleteConfirmAsset, setDeleteConfirmAsset] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchAssets = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (searchQuery) params.query = searchQuery;
      if (readinessFilter) params.readiness_state = readinessFilter;
      if (datasetFilter) params.dataset_label = datasetFilter;
      if (graphStateFilter) params.has_graph_state = graphStateFilter;

      if (archivedFilter === 'archived') {
        params.archived_state = true;
      } else if (archivedFilter === 'all') {
        params.include_archived = true;
      } else {
        params.archived_state = false;
      }

      const data = await getDecisionAssets(params);
      setAssets(data.assets || []);
    } catch (err) {
      setError(err?.error?.message || 'Failed to load saved decisions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [refreshTrigger, readinessFilter, graphStateFilter, archivedFilter]);

  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      fetchAssets();
    }
  };

  const handleSelectAsset = async (assetId) => {
    try {
      const asset = await getDecisionAssetById(assetId);
      onReopenAsset(asset);
    } catch (err) {
      console.error('Error reopening decision asset:', err);
      alert(err?.error?.message || 'Failed to reopen decision asset.');
    }
  };

  const handleArchive = async (e, assetId) => {
    e.stopPropagation();
    setActionLoading(true);
    try {
      await archiveDecisionAsset(assetId);
      await fetchAssets();
    } catch (err) {
      alert(err?.error?.message || 'Failed to archive asset.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestore = async (e, assetId) => {
    e.stopPropagation();
    setActionLoading(true);
    try {
      await restoreDecisionAsset(assetId);
      await fetchAssets();
    } catch (err) {
      alert(err?.error?.message || 'Failed to restore asset.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteClick = (e, asset) => {
    e.stopPropagation();
    setDeleteConfirmAsset(asset);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmAsset) return;
    setActionLoading(true);
    try {
      await deleteDecisionAsset(deleteConfirmAsset.asset_id);
      if (deleteConfirmAsset.asset_id === activeAssetId && onAssetDeleted) {
        onAssetDeleted();
      }
      setDeleteConfirmAsset(null);
      await fetchAssets();
    } catch (err) {
      alert(err?.error?.message || 'Failed to delete asset.');
    } finally {
      setActionLoading(false);
    }
  };

  const renderTooltipContent = (asset) => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '4px' }}>
        {asset.snapshot_notice && <Typography variant="caption" sx={{ fontStyle: 'italic', color: '#ff9800', mb: 1 }}>{asset.snapshot_notice}</Typography>}
        {asset.review_metadata?.evidence_item_count !== undefined && (
          <Typography variant="caption">Evidence: {asset.review_metadata.evidence_item_count} ({asset.review_metadata.evidence_status?.replace(/_/g, ' ')})</Typography>
        )}
        {asset.review_metadata?.export_section_count !== undefined && (
          <Typography variant="caption">Export Sections: {asset.review_metadata.export_section_count}</Typography>
        )}
        {asset.review_metadata?.scenario_status && (
          <Typography variant="caption">Scenario: {asset.review_metadata.scenario_status?.replace(/_/g, ' ')}</Typography>
        )}
        {asset.review_metadata?.graph_state_summary?.available && (
          <Typography variant="caption" sx={{ color: '#4da6ff', fontWeight: 'bold' }}>Graph State Saved</Typography>
        )}
      </div>
    );
  };

  return (
    <div className="decision-asset-library is-drawer-mode">
      <div className="decision-asset-library__header">
        <Typography variant="overline" sx={{ fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
          <FaHistory /> Saved Decision Snapshots
        </Typography>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <IconButton size="small" onClick={fetchAssets} disabled={loading} title="Refresh library" sx={{ color: 'var(--text-secondary)' }}>
            <FaSync className={loading ? 'spin' : ''} />
          </IconButton>
          {onClose && (
            <IconButton size="small" onClick={onClose} title="Close" sx={{ color: 'var(--text-secondary)' }}>
              <FaTimes />
            </IconButton>
          )}
        </div>
      </div>

      <div className="decision-asset-library__filters-compact">
        <TextField
          variant="outlined"
          size="small"
          placeholder="Search snapshots..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={handleSearchKeyPress}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <FaSearch style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }} />
              </InputAdornment>
            )
          }}
          sx={{ flex: 1, mb: 1 }}
        />
        <div className="decision-asset-library__filter-row-secondary">
          <Select
            variant="outlined"
            size="small"
            displayEmpty
            value={readinessFilter}
            onChange={(e) => setReadinessFilter(e.target.value)}
            sx={{ flex: 1, fontSize: '0.8rem' }}
            MenuProps={{ style: { zIndex: 99999 } }}
          >
            <MenuItem value=""><em>All Readiness</em></MenuItem>
            <MenuItem value="analysis_ready">Analysis Ready</MenuItem>
            <MenuItem value="limited">Limited</MenuItem>
            <MenuItem value="blocked">Blocked</MenuItem>
          </Select>
          <TextField
            variant="outlined"
            size="small"
            placeholder="Dataset label..."
            value={datasetFilter}
            onChange={(e) => setDatasetFilter(e.target.value)}
            onKeyPress={handleSearchKeyPress}
            sx={{ flex: 1, fontSize: '0.8rem' }}
          />
        </div>
        <div className="decision-asset-library__filter-row-secondary" style={{ marginTop: '8px' }}>
          <Select
            variant="outlined"
            size="small"
            displayEmpty
            value={graphStateFilter}
            onChange={(e) => setGraphStateFilter(e.target.value)}
            sx={{ flex: 1, fontSize: '0.8rem' }}
            MenuProps={{ style: { zIndex: 99999 } }}
          >
            <MenuItem value=""><em>Graph: Any</em></MenuItem>
            <MenuItem value="true">Has Graph State</MenuItem>
            <MenuItem value="false">No Graph State</MenuItem>
          </Select>
          <Select
            variant="outlined"
            size="small"
            displayEmpty
            value={archivedFilter}
            onChange={(e) => setArchivedFilter(e.target.value)}
            sx={{ flex: 1, fontSize: '0.8rem' }}
            MenuProps={{ style: { zIndex: 99999 } }}
          >
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="archived">Archived</MenuItem>
            <MenuItem value="all">All</MenuItem>
          </Select>
        </div>
      </div>

      <Divider sx={{ mb: 1, opacity: 0.1 }} />
      {loading && assets.length === 0 ? (
        <div className="decision-asset-library__loading">
          <CircularProgress size={20} />
          <Typography variant="caption">Loading library...</Typography>
        </div>
      ) : error ? (
        <div className="decision-asset-library__error">
          <FaExclamationTriangle />
          <Typography variant="caption">{error}</Typography>
        </div>
      ) : assets.length === 0 ? (
        <div className="decision-asset-library__empty">
          <Typography variant="caption">No saved decision snapshots found.</Typography>
        </div>
      ) : (
        <div className="decision-asset-library__list-compact">
          {assets.map((asset) => (
            <div
              key={asset.asset_id}
              className={`decision-asset-library__item-compact ${activeAssetId === asset.asset_id ? 'is-active' : ''} ${asset.is_archived || asset.archived ? 'is-archived' : ''}`}
              onClick={() => handleSelectAsset(asset.asset_id)}
            >
              <div className="decision-asset-library__item-compact-main">
                <FaFolderOpen className="decision-asset-library__item-compact-icon" />
                <div className="decision-asset-library__item-compact-info">
                  <div className="decision-asset-library__item-compact-title-row">
                    <span className="decision-asset-library__item-compact-title">{asset.title}</span>
                    {asset.truth_boundary && (
                      <span className="decision-asset-library__badge is-truth-boundary-compact">
                        {asset.truth_boundary.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                  <span className="decision-asset-library__item-compact-meta">
                    {new Date(asset.created_at).toLocaleDateString()} • {asset.review_metadata?.dataset_label || asset.dataset_label || 'No dataset'}
                  </span>
                </div>
              </div>

              <div className="decision-asset-library__item-compact-actions">
                <Tooltip title={renderTooltipContent(asset)} placement="left" arrow PopperProps={{ style: { zIndex: 99999 } }}>
                  <IconButton size="small" className="library-action-btn" onClick={(e) => e.stopPropagation()}>
                    <FaInfoCircle fontSize="inherit" />
                  </IconButton>
                </Tooltip>
                {!(asset.is_archived || asset.archived) ? (
                  <Tooltip title="Archive" arrow PopperProps={{ style: { zIndex: 99999 } }}>
                    <IconButton size="small" className="library-action-btn" onClick={(e) => handleArchive(e, asset.asset_id)} disabled={actionLoading}>
                      <FaArchive fontSize="inherit" />
                    </IconButton>
                  </Tooltip>
                ) : (
                  <Tooltip title="Restore" arrow PopperProps={{ style: { zIndex: 99999 } }}>
                    <IconButton size="small" className="library-action-btn" onClick={(e) => handleRestore(e, asset.asset_id)} disabled={actionLoading}>
                      <FaUndo fontSize="inherit" />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title="Delete" arrow PopperProps={{ style: { zIndex: 99999 } }}>
                  <IconButton size="small" className="library-action-btn delete-btn" onClick={(e) => handleDeleteClick(e, asset)} disabled={actionLoading}>
                    <FaTrash fontSize="inherit" />
                  </IconButton>
                </Tooltip>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!deleteConfirmAsset} onClose={() => setDeleteConfirmAsset(null)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Are you sure you want to permanently delete "{deleteConfirmAsset?.title}"? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmAsset(null)} disabled={actionLoading}>Cancel</Button>
          <Button onClick={confirmDelete} color="error" disabled={actionLoading}>Delete</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
