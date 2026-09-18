import React, { useContext, useEffect, useState, useRef, useCallback } from 'react';
import { DataContext, useDatasetMeta } from '../../context/DataContext';
import { 
  FaDatabase, FaCrosshairs, FaLayerGroup, FaCheckDouble, 
  FaUsers, FaSearch, FaRobot, FaInfoCircle, FaExclamationTriangle,
  FaTable, FaPlayCircle, FaCheckCircle, FaTimesCircle, FaSyncAlt,
  FaBoxOpen, FaCodeBranch
} from 'react-icons/fa';
import './MLStudioShell.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function MLStudioShell() {
  const {
    activeWorkspace,
    analysisContext,
    workspaceRefreshStatus,
    workspaceRefreshError,
    workspaceVersionConflict,
  } = useContext(DataContext);
  const { numRows, numCols } = useDatasetMeta();

  const [runsState, setRunsState] = useState({ status: 'idle', data: null, error: null });
  const fetchIdRef = useRef(0);

  const hasRequiredIdentity = Boolean(
    activeWorkspace?.workspace_id &&
    analysisContext?.workspace_version &&
    analysisContext?.source_ids?.length > 0 &&
    numRows > 0
  );

  const hasBlockedIdentity = Boolean(
    workspaceVersionConflict ||
    workspaceRefreshStatus === 'error' ||
    (activeWorkspace && analysisContext && (
      activeWorkspace.workspace_id !== analysisContext.workspace_id ||
      activeWorkspace.version !== analysisContext.workspace_version
    ))
  );

  const isIdentityAvailable = hasRequiredIdentity && !hasBlockedIdentity;

  const fetchRuns = useCallback(async () => {
    if (!isIdentityAvailable) return;
    
    const fetchId = ++fetchIdRef.current;
    setRunsState({ status: 'loading', data: null, error: null });
    
    try {
      const response = await fetch(`${API_URL}/api/ml-studio/v1/runs?limit=20`);
      if (fetchId !== fetchIdRef.current) return;
      
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = { error: { code: 'unknown_error', message: 'An unexpected error occurred.', remediation: 'Please try again.' } };
        }
        
        if (errorData?.error) {
           const err = new Error(errorData.error.message);
           err.code = errorData.error.code;
           err.remediation = errorData.error.remediation;
           throw err;
        } else {
           const err = new Error('ML Studio could not complete the request.');
           err.code = 'ml_studio_internal_error';
           err.remediation = 'Retry the request or inspect server health.';
           throw err;
        }
      }
      
      const data = await response.json();
      if (fetchId !== fetchIdRef.current) return;
      
      setRunsState({ status: 'success', data: data.runs, error: null });
    } catch (err) {
      if (fetchId !== fetchIdRef.current) return;
      setRunsState({ 
        status: 'error', 
        data: null, 
        error: {
          code: err.code || 'ml_studio_internal_error',
          message: err.message || 'ML Studio could not complete the request.',
          remediation: err.remediation || 'Retry the request or inspect server health.'
        } 
      });
    }
  }, [isIdentityAvailable]);

  useEffect(() => {
    if (isIdentityAvailable && runsState.status === 'idle') {
      fetchRuns();
    }
  }, [isIdentityAvailable, runsState.status, fetchRuns]);

  return (
    <div className="ml-studio-shell">
      <TopRibbon />
      <div className="ml-studio-body">
         <AssetRail 
            activeWorkspace={activeWorkspace} 
            analysisContext={analysisContext} 
            numRows={numRows} 
            numCols={numCols} 
         />
         <div className="ml-studio-center-column">
            <ExperimentCanvas 
               hasRequiredIdentity={hasRequiredIdentity} 
               hasBlockedIdentity={hasBlockedIdentity} 
               workspaceRefreshError={workspaceRefreshError}
               workspaceVersionConflict={workspaceVersionConflict}
            />
            <RunDock 
               runsState={runsState} 
               onRetry={fetchRuns} 
               isIdentityAvailable={isIdentityAvailable}
            />
         </div>
         <EvidenceInspector />
      </div>
    </div>
  );
}

function TopRibbon() {
  const STAGES = [
    { label: 'Data Snapshot', icon: <FaDatabase /> },
    { label: 'Goal', icon: <FaCrosshairs /> },
    { label: 'Features', icon: <FaLayerGroup /> },
    { label: 'Validation', icon: <FaCheckDouble /> },
    { label: 'Candidates', icon: <FaUsers /> },
    { label: 'Evidence', icon: <FaSearch /> },
    { label: 'Candidate', icon: <FaRobot /> },
  ];

  return (
    <header className="ml-studio-ribbon" aria-label="Run Ribbon">
      <div className="ribbon-container">
        {STAGES.map((stage, i) => (
          <div key={stage.label} className={`ribbon-stage ${i === 0 ? 'is-current' : 'is-inactive'}`} aria-current={i === 0 ? 'step' : undefined}>
            <span className="ribbon-icon">{stage.icon}</span>
            <span className="ribbon-label">{stage.label}</span>
            {i < STAGES.length - 1 && <div className="ribbon-connector"></div>}
          </div>
        ))}
      </div>
    </header>
  );
}

function AssetRail({ activeWorkspace, analysisContext, numRows, numCols }) {
  return (
    <aside className="ml-studio-rail" aria-label="Asset Rail">
       <h3 className="panel-title"><FaBoxOpen className="panel-icon"/> Asset Identity</h3>
       
       <div className="rail-section">
         <div className="rail-item">
           <strong>Workspace</strong>
           <span className="rail-value badge-primary">{activeWorkspace?.workspace_name || activeWorkspace?.workspace_id || 'None'}</span>
         </div>
         <div className="rail-item">
           <strong>Version</strong>
           <span className="rail-value badge-secondary"><FaCodeBranch className="inline-icon"/> {analysisContext?.workspace_version || 'None'}</span>
         </div>
         <div className="rail-item">
           <strong>Active Data</strong>
           <span className="rail-value badge-neutral"><FaTable className="inline-icon"/> {numRows.toLocaleString()} rows, {numCols.toLocaleString()} cols</span>
         </div>
       </div>

       <div className="rail-section">
         <strong>Sources</strong>
         {analysisContext?.source_ids?.length > 0 ? (
           <ul className="rail-list">{analysisContext.source_ids.map(id => <li key={id} className="rail-list-item">{id}</li>)}</ul>
         ) : <span className="rail-empty">None</span>}
       </div>
       
       <div className="rail-section">
         <strong>Relationships</strong>
         {analysisContext?.relationship_ids?.length > 0 ? (
           <ul className="rail-list">{analysisContext.relationship_ids.map(id => <li key={id} className="rail-list-item">{id}</li>)}</ul>
         ) : <span className="rail-empty">None</span>}
       </div>
    </aside>
  );
}

function ExperimentCanvas({ hasRequiredIdentity, hasBlockedIdentity, workspaceRefreshError, workspaceVersionConflict }) {
  return (
    <main className="ml-studio-canvas" aria-label="Experiment Canvas">
      {hasBlockedIdentity ? (
         <div className="canvas-state-message blocked-identity">
            <FaExclamationTriangle className="canvas-icon error-icon" />
            <h2>Identity Conflict</h2>
            <p>Workspace identity must be reconciled before continuing.</p>
            {workspaceVersionConflict && <div className="error-details">{workspaceVersionConflict.message}</div>}
            {workspaceRefreshError && <div className="error-details">{workspaceRefreshError.message}</div>}
         </div>
      ) : !hasRequiredIdentity ? (
         <div className="canvas-state-message no-dataset">
            <FaDatabase className="canvas-icon neutral-icon" />
            <h2>No Dataset Selected</h2>
            <p>A governed workspace dataset must be selected to proceed.</p>
         </div>
      ) : (
         <div className="canvas-state-message identity-available">
            <FaCheckCircle className="canvas-icon success-icon" />
            <h2>Dataset identity available</h2>
            <p className="canvas-subtitle">Experiment configuration is not part of this shell gate.</p>
         </div>
      )}
    </main>
  );
}

function EvidenceInspector() {
  return (
    <aside className="ml-studio-inspector" aria-label="Evidence Inspector">
       <h3 className="panel-title"><FaSearch className="panel-icon"/> Evidence Inspector</h3>
       <div className="inspector-card">
         <FaInfoCircle className="inspector-card-icon" />
         <div className="inspector-card-content">
           <p><strong>Truth Boundary</strong></p>
           <p>Current boundaries are restricted to local experimentation.</p>
           <p>Models displayed here are not evaluated for external use.</p>
         </div>
       </div>
    </aside>
  );
}

function StatusPill({ status }) {
  const statusMap = {
    'completed': { icon: <FaCheckCircle />, className: 'status-success' },
    'running': { icon: <FaSyncAlt className="spin-icon" />, className: 'status-running' },
    'failed': { icon: <FaTimesCircle />, className: 'status-error' },
    'queued': { icon: <FaPlayCircle />, className: 'status-neutral' },
  };
  
  const mapped = statusMap[status?.toLowerCase()] || { icon: <FaInfoCircle />, className: 'status-neutral' };
  
  return (
    <span className={`status-pill ${mapped.className}`}>
      {mapped.icon} {status}
    </span>
  );
}

function RunDock({ runsState, onRetry, isIdentityAvailable }) {
  if (!isIdentityAvailable) {
     return <section className="ml-studio-dock empty-dock" aria-label="Run Dock"></section>;
  }

  return (
    <section className="ml-studio-dock" aria-label="Run Dock" aria-busy={runsState.status === 'loading'}>
       <div className="dock-header">
         <h3><FaLayerGroup className="panel-icon"/> Run Dock</h3>
         {runsState.status === 'success' && runsState.data && (
           <span className="run-count">{runsState.data.length} durable runs</span>
         )}
       </div>
       
       <div className="dock-content">
         {runsState.status === 'loading' && (
           <div className="run-dock-skeleton">
              <div className="skeleton-row header-row"></div>
              <div className="skeleton-row"></div>
              <div className="skeleton-row"></div>
              <div className="skeleton-row"></div>
           </div>
         )}
         {runsState.status === 'error' && runsState.error && (
           <div className="run-dock-error" role="alert">
              <FaExclamationTriangle className="error-card-icon" />
              <div className="error-card-body">
                <p className="error-message"><strong>{runsState.error.message}</strong></p>
                <p className="error-remediation">{runsState.error.remediation}</p>
              </div>
              <button className="retry-button" onClick={onRetry} type="button"><FaSyncAlt /> Retry</button>
           </div>
         )}
         {runsState.status === 'success' && runsState.data && runsState.data.length === 0 && (
           <div className="run-dock-empty">
              <FaBoxOpen className="empty-icon" />
              <p>No durable runs exist. Run creation arrives later.</p>
           </div>
         )}
         {runsState.status === 'success' && runsState.data && runsState.data.length > 0 && (
           <div className="run-list-container">
              <table className="run-table">
                 <thead>
                    <tr>
                       <th>Run ID</th>
                       <th>Experiment</th>
                       <th>Version</th>
                       <th>Snapshot</th>
                       <th>Status</th>
                       <th>Stage</th>
                       <th>Submitted</th>
                    </tr>
                 </thead>
                 <tbody>
                    {runsState.data.map(run => (
                       <tr key={run.run_id}>
                          <td className="font-mono">{run.run_id}</td>
                          <td className="font-medium">{run.experiment_id}</td>
                          <td><span className="version-badge">v{run.specification_version || (run.run_specification && run.run_specification.specification_version)}</span></td>
                          <td className="font-mono text-muted">{run.snapshot_id}</td>
                          <td><StatusPill status={run.status} /></td>
                          <td className="stage-cell">{run.progress_stage || 'N/A'}</td>
                          <td className="text-muted">{new Date(run.submitted_at).toLocaleString(undefined, {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}</td>
                       </tr>
                    ))}
                 </tbody>
              </table>
           </div>
         )}
       </div>
    </section>
  );
}

export default MLStudioShell;
