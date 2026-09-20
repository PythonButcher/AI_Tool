
import React, { useContext, useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { DataContext, useDatasetMeta } from '../../context/DataContext';
import {
  FaDatabase, FaCrosshairs, FaLayerGroup, FaCheckDouble,
  FaUsers, FaSearch, FaRobot, FaInfoCircle, FaExclamationTriangle,
  FaTable, FaPlayCircle, FaCheckCircle, FaTimesCircle, FaSyncAlt,
  FaBoxOpen, FaCodeBranch, FaCheck, FaWrench, FaTools,
  FaBrain, FaCog, FaPlay, FaBan
} from 'react-icons/fa';
import './MLStudioShell.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

async function digestMessage(message) {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return `sha256:${hashHex}`;
}

export default function MLStudioShell({ onOpenCleaningForm }) {
  const {
    activeWorkspace,
    analysisContext,
    workspaceRefreshStatus,
    workspaceRefreshError,
    workspaceVersionConflict,
    uploadedData, fullData, cleanedData
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

  const identityKey = isIdentityAvailable
    ? `${activeWorkspace?.workspace_id}-${analysisContext?.workspace_version}`
    : null;

  const fetchRuns = useCallback(async () => {
    if (!isIdentityAvailable) return;

    const fetchId = ++fetchIdRef.current;
    setRunsState({ status: 'loading', data: null, error: null });

    try {
      const response = await fetch(`${API_URL}/api/ml-studio/v1/runs?limit=20`);
      if (fetchId !== fetchIdRef.current) return;

      if (!response.ok) {
        let errorData;
        try { errorData = await response.json(); } catch (e) {}
        if (fetchId !== fetchIdRef.current) return;
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
    if (!isIdentityAvailable) {
      fetchIdRef.current += 1;
      setRunsState({ status: 'idle', data: null, error: null });
      return;
    }
    fetchRuns();
    return () => { fetchIdRef.current += 1; };
  }, [identityKey, isIdentityAvailable, fetchRuns]);

  const activeDataset = cleanedData ?? fullData ?? uploadedData;
  const columns = useMemo(() => {
    if (!Array.isArray(activeDataset) || activeDataset.length === 0) return [];
    const sample = activeDataset[0];
    if (!sample || typeof sample !== 'object') return [];
    return Object.keys(sample);
  }, [activeDataset]);

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
               activeWorkspace={activeWorkspace}
               analysisContext={analysisContext}
               columns={columns}
               onOpenCleaningForm={onOpenCleaningForm}
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

function ExperimentCanvas({
  hasRequiredIdentity, hasBlockedIdentity, workspaceRefreshError, workspaceVersionConflict,
  activeWorkspace, analysisContext, columns, onOpenCleaningForm
}) {
  const [taskType, setTaskType] = useState('regression');
  const [target, setTarget] = useState('');
  const [numericFeatures, setNumericFeatures] = useState([]);
  const [categoricalFeatures, setCategoricalFeatures] = useState([]);
  const [excludedColumns, setExcludedColumns] = useState([]);

  const [splitStrategy, setSplitStrategy] = useState('random');

  const [isConfirmed, setIsConfirmed] = useState(false);

  const [prepStatus, setPrepStatus] = useState('idle'); // idle, loading, ready, blocked, error
  const [prepError, setPrepError] = useState(null);
  const [assessment, setAssessment] = useState(null);

  const [snapshotData, setSnapshotData] = useState(null);
  const [experimentData, setExperimentData] = useState(null);

  const reqIdRef = useRef(0);

  // Clear prep state when identity changes or navigation
  useEffect(() => {
    setPrepStatus('idle');
    setPrepError(null);
    setAssessment(null);
    setSnapshotData(null);
    setExperimentData(null);
    reqIdRef.current += 1;
  }, [activeWorkspace?.workspace_id, analysisContext?.workspace_version]);

  const validateForm = () => {
    if (!target) return 'Please select a target column.';
    if (numericFeatures.length === 0 && categoricalFeatures.length === 0) return 'Please select at least one feature column.';

    // Check disjoint
    const allFeatures = [...numericFeatures, ...categoricalFeatures];
    if (allFeatures.includes(target)) return 'Target cannot be a feature.';
    if (excludedColumns.includes(target)) return 'Target cannot be excluded.';

    for (const f of allFeatures) {
      if (excludedColumns.includes(f)) return 'A feature cannot be excluded.';
    }
    const hasDuplicates = new Set(allFeatures).size !== allFeatures.length;
    if (hasDuplicates) return 'Features must be unique across numeric and categorical roles.';

    return null;
  };

  const handleAssess = async (forceNewSnapshot = false, forceNewExperiment = false) => {
    const errorMsg = validateForm();
    if (errorMsg) {
      setPrepError({ code: 'validation_error', message: errorMsg, remediation: 'Fix the configuration and try again.' });
      return;
    }

    if (!isConfirmed) {
      setPrepError({ code: 'confirmation_required', message: 'You must explicitly confirm the target and feature roles.', remediation: 'Check the confirmation box.' });
      return;
    }

    const reqId = ++reqIdRef.current;
    setPrepStatus('loading');
    setPrepError(null);

    try {
      // 1. Create Snapshot
      let currentSnapshot = forceNewSnapshot ? null : snapshotData;
      if (!currentSnapshot) {
        const snapRes = await fetch(`${API_URL}/api/ml-studio/v1/snapshots`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspace_id: activeWorkspace.workspace_id,
            workspace_version: analysisContext.workspace_version,
            source_ids: analysisContext.source_ids || [],
            relationship_ids: analysisContext.relationship_ids || []
          })
        });
        if (reqId !== reqIdRef.current) return;
        const snapData = await snapRes.json();
        if (!snapRes.ok) throw snapData.error || { code: 'unknown', message: 'Failed to create snapshot.' };
        currentSnapshot = snapData.snapshot;
        setSnapshotData(currentSnapshot);
      }

      // 2. Create Experiment
      let currentExperiment = forceNewExperiment ? null : experimentData;
      if (!currentExperiment) {
        const experimentSpec = {
          contract_version: "ml_studio_contract_v1",
          experiment_id: `exp-${Date.now()}`,
          specification_version: 1,
          task_type: taskType,
          target,
          feature_roles: {
            numeric: numericFeatures,
            categorical: categoricalFeatures
          },
          excluded_columns: excludedColumns,
          split_policy: {
            strategy: splitStrategy,
            final_holdout_fraction: 0.2,
            cross_validation_folds: 5,
            time_column: null,
            group_column: null
          },
          candidate_families: taskType === 'regression'
            ? ['regularized_linear', 'random_forest', 'hist_gradient_boosting']
            : ['logistic', 'random_forest', 'hist_gradient_boosting'],
          metric_policy: {
            primary_metric: taskType === 'regression' ? 'rmse' : 'logloss',
            optimization: taskType === 'regression' ? 'minimize' : 'minimize',
            reported_metrics: taskType === 'regression' ? ['rmse', 'mae'] : ['logloss', 'roc_auc']
          },
          resource_limits: { max_rows: 100000, max_features: 100, max_candidates: 3, timeout_seconds: 3600 },
          random_seed_policy: { final_holdout_seed: 42, cross_validation_seed: 42, estimator_seed: 42 }
        };

        const expRes = await fetch(`${API_URL}/api/ml-studio/v1/experiments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(experimentSpec)
        });
        if (reqId !== reqIdRef.current) return;
        const expResData = await expRes.json();
        if (!expRes.ok) throw expResData.error || { code: 'unknown', message: 'Failed to create experiment.' };
        currentExperiment = expResData.experiment;
        setExperimentData(currentExperiment);
      }

      // 3. Assess
      const recipeSteps = [];
      const recipePayload = {
        contract_version: "ml_studio_contract_v1",
        recipe_id: `recipe-${Date.now()}`,
        workspace_id: activeWorkspace.workspace_id,
        base_snapshot_id: currentSnapshot.snapshot_id,
        base_recipe_hash: currentSnapshot.transformation_recipe_hash,
        recipe_version: 1,
        steps: recipeSteps,
      };

      const canonicalString = JSON.stringify({
        base_recipe_hash: recipePayload.base_recipe_hash,
        base_snapshot_id: recipePayload.base_snapshot_id,
        recipe_id: recipePayload.recipe_id,
        recipe_version: recipePayload.recipe_version,
        steps: recipePayload.steps,
        workspace_id: recipePayload.workspace_id
      });
      recipePayload.canonical_recipe_hash = await digestMessage(canonicalString);
      recipePayload.created_at = new Date().toISOString();
      recipePayload.created_by = null;

      const assessRes = await fetch(`${API_URL}/api/ml-studio/v1/preparation-assessments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          snapshot_id: currentSnapshot.snapshot_id,
          experiment_id: currentExperiment.experiment_id,
          specification_version: currentExperiment.specification_version,
          transformation_recipe: recipePayload
        })
      });
      if (reqId !== reqIdRef.current) return;
      const assessData = await assessRes.json();
      if (!assessRes.ok) throw assessData.error || { code: 'unknown', message: 'Failed to assess preparation.' };

      setAssessment(assessData.assessment);
      setPrepStatus(assessData.assessment.state === 'ready' ? 'ready' : 'blocked');

    } catch (err) {
      if (reqId !== reqIdRef.current) return;
      setPrepError({
        code: err.code || 'ml_studio_internal_error',
        message: err.message || 'An unexpected error occurred.',
        remediation: err.remediation || 'Please try again.'
      });
      setPrepStatus('error');
    }
  };

  const openFixInPowerQuery = (fix) => {
    const step = {
      type: fix.action_type,
      params: fix.parameters || {},
      id: `fix-${Date.now()}`
    };
    if (onOpenCleaningForm) {
      onOpenCleaningForm({
        initialSteps: [step],
        onApplyComplete: () => {
          // Refresh assessment truth after power query apply
          setAssessment(null);
          setPrepStatus('idle');
          setExperimentData(null);
          setSnapshotData(null); // Force new snapshot
          handleAssess(true, true); // Re-trigger assessment
        }
      });
    }
  };

  if (hasBlockedIdentity) {
    return (
      <main className="ml-studio-canvas" aria-label="Experiment Canvas">
         <div className="canvas-state-message blocked-identity">
            <FaExclamationTriangle className="canvas-icon error-icon" />
            <h2>Identity Conflict</h2>
            <p>Workspace identity must be reconciled before continuing.</p>
            {workspaceVersionConflict && <div className="error-details">{workspaceVersionConflict.message}</div>}
            {workspaceRefreshError && <div className="error-details">{workspaceRefreshError.message}</div>}
         </div>
      </main>
    );
  }

  if (!hasRequiredIdentity) {
    return (
      <main className="ml-studio-canvas" aria-label="Experiment Canvas">
         <div className="canvas-state-message no-dataset">
            <FaDatabase className="canvas-icon neutral-icon" />
            <h2>No Dataset Selected</h2>
            <p>A governed workspace dataset must be selected to proceed.</p>
         </div>
      </main>
    );
  }

  return (
    <main className="ml-studio-canvas" aria-label="Experiment Canvas">
      <div className="prep-form-container">
        <h2 className="prep-form-title">Experiment Configuration</h2>

        {prepError && (
          <div className="prep-alert error">
            <FaExclamationTriangle className="alert-icon" />
            <div className="alert-content">
              <strong>{prepError.message}</strong>
              <p>{prepError.remediation}</p>
              {prepError.code === 'snapshot_identity_stale' && (
                <button
                  className="retry-button"
                  onClick={() => { setSnapshotData(null); handleAssess(true, true); }}
                  type="button"
                >
                  <FaSyncAlt /> Reload Dataset
                </button>
              )}
            </div>
          </div>
        )}

        <div className="prep-form-grid" aria-busy={prepStatus === 'loading'}>
          <label className="prep-field">
            <span>Task Type</span>
            <select value={taskType} onChange={e => { setTaskType(e.target.value); setPrepStatus('idle'); setExperimentData(null); }} disabled={prepStatus === 'loading'}>
              <option value="regression">Regression</option>
              <option value="classification">Classification</option>
            </select>
          </label>

          <label className="prep-field">
            <span>Target Column</span>
            <select value={target} onChange={e => { setTarget(e.target.value); setPrepStatus('idle'); setExperimentData(null); }} disabled={prepStatus === 'loading'}>
              <option value="">Select target</option>
              {columns.map(col => <option key={col} value={col}>{col}</option>)}
            </select>
          </label>

          <label className="prep-field">
            <span>Numeric Features</span>
            <select multiple value={numericFeatures} onChange={e => { setNumericFeatures(Array.from(e.target.selectedOptions || []).map(o => o.value)); setPrepStatus('idle'); setExperimentData(null); }} disabled={prepStatus === 'loading'} className="multi-select">
              {columns.map(col => <option key={col} value={col}>{col}</option>)}
            </select>
          </label>

          <label className="prep-field">
            <span>Categorical Features</span>
            <select multiple value={categoricalFeatures} onChange={e => { setCategoricalFeatures(Array.from(e.target.selectedOptions || []).map(o => o.value)); setPrepStatus('idle'); setExperimentData(null); }} disabled={prepStatus === 'loading'} className="multi-select">
              {columns.map(col => <option key={col} value={col}>{col}</option>)}
            </select>
          </label>

          <label className="prep-field">
            <span>Excluded Columns</span>
            <select multiple value={excludedColumns} onChange={e => { setExcludedColumns(Array.from(e.target.selectedOptions || []).map(o => o.value)); setPrepStatus('idle'); setExperimentData(null); }} disabled={prepStatus === 'loading'} className="multi-select">
              {columns.map(col => <option key={col} value={col}>{col}</option>)}
            </select>
          </label>

          <label className="prep-field">
            <span>Split Strategy</span>
            <select value={splitStrategy} onChange={e => { setSplitStrategy(e.target.value); setPrepStatus('idle'); setExperimentData(null); }} disabled={prepStatus === 'loading'}>
              <option value="random">Random</option>
              {taskType === 'classification' && <option value="stratified">Stratified</option>}
            </select>
          </label>

          <div className="prep-field confirmation-field">
            <label className="checkbox-wrapper">
              <input type="checkbox" checked={isConfirmed} onChange={e => setIsConfirmed(e.target.checked)} disabled={prepStatus === 'loading'} />
              <span>I explicitly confirm the target and feature roles are correct.</span>
            </label>
          </div>

          <button
            type="button"
            className="assess-button"
            onClick={handleAssess}
            disabled={prepStatus === 'loading'}
          >
            {prepStatus === 'loading' ? 'Assessing...' : 'Assess Preparation Readiness'}
          </button>
        </div>

        {prepStatus === 'ready' && assessment && (
          <div className="prep-alert success">
            <FaCheck className="alert-icon" />
            <div className="alert-content">
              <strong>Dataset is Ready!</strong>
              <p>Assessment ID: {assessment.assessment_id}</p>
              <p>Fingerprint: {assessment.input_fingerprint}</p>
            </div>
          </div>
        )}

        {prepStatus === 'blocked' && assessment && (
          <div className="assessment-results">
            <h3 className="results-title"><FaBan /> Readiness Blocked</h3>
            <p>Please resolve the following issues before proceeding.</p>

            {assessment.issues?.map(issue => (
              <div key={issue.issue_id} className={`issue-card ${issue.severity}`}>
                <div className="issue-header">
                  <strong>{issue.severity.toUpperCase()}: {issue.message}</strong>
                </div>
                <p>{issue.remediation}</p>
              </div>
            ))}

            {assessment.suggested_fixes?.length > 0 && (
              <div className="suggested-fixes">
                <h4>Suggested Fixes</h4>
                {assessment.suggested_fixes.map(fix => (
                  <div key={fix.fix_id} className={`fix-card ${fix.status}`}>
                    <div className="fix-header">
                      <strong>Action: {fix.action_type}</strong>
                      <span className={`status-badge ${fix.status}`}>{fix.status}</span>
                    </div>
                    <p className="fix-reason">{fix.reason}</p>
                    <p className="fix-explanation">{fix.explanation}</p>
                    {fix.status === 'supported' && (
                      <button
                        className="power-query-btn"
                        onClick={() => openFixInPowerQuery(fix)}
                        type="button"
                      >
                        <FaTools /> Open in Power Query
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
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
