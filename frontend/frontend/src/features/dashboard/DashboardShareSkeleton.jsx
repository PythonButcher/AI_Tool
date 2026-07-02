import React, { useState } from 'react';
import { useWindowContext } from '../../context/WindowContext';
import { FaTimes, FaUser, FaUsers, FaGlobe, FaInfoCircle } from 'react-icons/fa';
import './DashboardShareSkeleton.css';

function DashboardShareSkeleton({ isOpen, onClose }) {
  const { dashboardState, updateDashboardSharing, updateDashboard } = useWindowContext();
  const sharing = dashboardState.sharing;

  const [description, setDescription] = useState(dashboardState.description || '');
  const [ownerLabel, setOwnerLabel] = useState(sharing.ownerLabel || '');
  const [visibility, setVisibility] = useState(sharing.visibility || 'private_local');
  const [intendedRecipients, setIntendedRecipients] = useState(sharing.intendedRecipients?.join(', ') || '');
  const [teamPlaceholders, setTeamPlaceholders] = useState(sharing.teamPlaceholders?.join(', ') || '');
  const [shareNotes, setShareNotes] = useState(sharing.shareNotes || '');

  const handleSave = () => {
    updateDashboard({ description });
    updateDashboardSharing({
      status: 'ready_for_future_backend',
      ownerLabel,
      visibility,
      intendedRecipients: intendedRecipients.split(',').map(s => s.trim()).filter(Boolean),
      teamPlaceholders: teamPlaceholders.split(',').map(s => s.trim()).filter(Boolean),
      shareNotes,
      lastPreparedAt: new Date().toISOString(),
      enabled: true,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="dashboard-share-skeleton-overlay">
      <div className="dashboard-share-skeleton">
        <div className="dashboard-share-skeleton__header">
          <h2>Share Dashboard (Local Draft)</h2>
          <button className="dashboard-share-skeleton__close" onClick={onClose}><FaTimes /></button>
        </div>
        
        <div className="dashboard-share-skeleton__banner">
          <FaInfoCircle />
          <span>Permissions and live sharing are not connected yet. Authentication will be added in a later phase. This saves metadata locally.</span>
        </div>

        <div className="dashboard-share-skeleton__body">
          <div className="dashboard-share-skeleton__field">
            <label>Dashboard Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this dashboard about?"
              rows={2}
            />
          </div>

          <div className="dashboard-share-skeleton__field">
            <label>Owner Label</label>
            <input
              type="text"
              value={ownerLabel}
              onChange={(e) => setOwnerLabel(e.target.value)}
              placeholder="e.g. Sales Team Lead"
            />
          </div>

          <div className="dashboard-share-skeleton__field">
            <label>Visibility (Placeholder)</label>
            <div className="dashboard-share-skeleton__radio-group">
              <label className="radio-label">
                <input type="radio" value="private_local" checked={visibility === 'private_local'} onChange={(e) => setVisibility(e.target.value)} />
                <FaUser /> Private (Local only)
              </label>
              <label className="radio-label">
                <input type="radio" value="team_placeholder" checked={visibility === 'team_placeholder'} onChange={(e) => setVisibility(e.target.value)} />
                <FaUsers /> Team Placeholder
              </label>
              <label className="radio-label">
                <input type="radio" value="selected_people_placeholder" checked={visibility === 'selected_people_placeholder'} onChange={(e) => setVisibility(e.target.value)} />
                <FaGlobe /> Specific People (Coming Soon)
              </label>
            </div>
          </div>

          <div className="dashboard-share-skeleton__field">
            <label>Intended Teams (Comma separated labels)</label>
            <input
              type="text"
              value={teamPlaceholders}
              onChange={(e) => setTeamPlaceholders(e.target.value)}
              placeholder="e.g. Finance, Marketing"
              disabled={visibility === 'private_local'}
            />
          </div>

          <div className="dashboard-share-skeleton__field">
            <label>Intended Recipients (Comma separated labels)</label>
            <input
              type="text"
              value={intendedRecipients}
              onChange={(e) => setIntendedRecipients(e.target.value)}
              placeholder="e.g. execs@company.com"
              disabled={visibility === 'private_local'}
            />
          </div>

          <div className="dashboard-share-skeleton__field">
            <label>Notes for recipients</label>
            <textarea
              value={shareNotes}
              onChange={(e) => setShareNotes(e.target.value)}
              placeholder="Add some context for when this is shared..."
              rows={2}
            />
          </div>
        </div>

        <div className="dashboard-share-skeleton__footer">
          <button className="dashboard-share-skeleton__btn" onClick={onClose}>Cancel</button>
          <button className="dashboard-share-skeleton__btn dashboard-share-skeleton__btn--primary" onClick={handleSave}>
            Save Sharing Draft
          </button>
        </div>
      </div>
    </div>
  );
}

export default DashboardShareSkeleton;
