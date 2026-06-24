import React, { useEffect, useState } from 'react';
import { getDecisionAssets, getDecisionAssetById } from './decisionApi';
import { FaHistory, FaFolderOpen, FaExclamationTriangle, FaSync } from 'react-icons/fa';
import { Typography, CircularProgress, IconButton, Divider } from '@mui/material';
import './DecisionAssetLibrary.css';

export default function DecisionAssetLibrary({ onReopenAsset, activeAssetId, refreshTrigger }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAssets = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDecisionAssets();
      setAssets(data.assets || []);
    } catch (err) {
      setError(err?.error?.message || 'Failed to load saved decisions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [refreshTrigger]);

  const handleSelectAsset = async (assetId) => {
    try {
      const asset = await getDecisionAssetById(assetId);
      onReopenAsset(asset);
    } catch (err) {
      console.error('Error reopening decision asset:', err);
      alert(err?.error?.message || 'Failed to reopen decision asset.');
    }
  };

  return (
    <div className="decision-asset-library">
      <div className="decision-asset-library__header">
        <Typography variant="overline" sx={{ fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
          <FaHistory /> Saved Decision Snapshots
        </Typography>
        <IconButton size="small" onClick={fetchAssets} disabled={loading} title="Refresh library" sx={{ color: 'var(--text-secondary)' }}>
          <FaSync className={loading ? 'spin' : ''} />
        </IconButton>
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
        <div className="decision-asset-library__list">
          {assets.map((asset) => (
            <div
              key={asset.asset_id}
              className={`decision-asset-library__item ${activeAssetId === asset.asset_id ? 'is-active' : ''}`}
              onClick={() => handleSelectAsset(asset.asset_id)}
            >
              <div className="decision-asset-library__item-main">
                <FaFolderOpen className="decision-asset-library__item-icon" />
                <div className="decision-asset-library__item-info">
                  <span className="decision-asset-library__item-title">{asset.title}</span>
                  <span className="decision-asset-library__item-meta">
                    {new Date(asset.created_at).toLocaleString()} • {asset.dataset_label || 'No dataset'}
                  </span>
                </div>
              </div>
              <div className="decision-asset-library__item-badges" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                {asset.truth_boundary && (
                  <span className="decision-asset-library__badge is-truth-boundary" style={{ border: '1px solid var(--accent-blue)', color: 'var(--accent-blue)', background: 'rgba(0, 102, 255, 0.05)' }}>
                    {asset.truth_boundary.replace(/_/g, ' ')}
                  </span>
                )}
                {asset.readiness_state && (
                  <span className={`decision-asset-library__badge is-${asset.readiness_state}`}>
                    {asset.readiness_state.replace('_', ' ')}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
