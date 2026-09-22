
import React, { useContext, useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { DataContext, useDatasetMeta, normalizeDatasetRows } from '../../context/DataContext';
import {
  FaDatabase, FaCrosshairs, FaLayerGroup, FaChevronDown, FaChevronUp, FaCheckDouble,
  FaUsers, FaSearch, FaRobot, FaInfoCircle, FaExclamationTriangle,
  FaTable, FaPlayCircle, FaCheckCircle, FaTimesCircle, FaSyncAlt,
  FaBoxOpen, FaCodeBranch, FaCheck, FaWrench, FaTools,
  FaBrain, FaCog, FaPlay, FaBan, FaCopy
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
  const [activeStage, setActiveStage] = useState('Configure');
  const [showGuidance, setShowGuidance] = useState(true);
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

  const activeDatasetSource = cleanedData ?? fullData ?? uploadedData;
  const activeDataset = useMemo(() => normalizeDatasetRows(activeDatasetSource), [activeDatasetSource]);

  const columns = useMemo(() => {
    if (!Array.isArray(activeDataset) || activeDataset.length === 0) return [];
    const sample = activeDataset[0];
    if (!sample || typeof sample !== 'object') return [];
    return Object.keys(sample);
  }, [activeDataset]);

  return (
    <div className="ml-studio-shell">
      <TopRibbon activeStage={activeStage} onStageSelect={setActiveStage} showGuidance={showGuidance} onToggleGuidance={() => setShowGuidance(!showGuidance)} />
      <div className="ml-studio-body">
         <AssetRail
            activeWorkspace={activeWorkspace}
            analysisContext={analysisContext}
            numRows={numRows}
            numCols={numCols}
         />
         <div className="ml-studio-center-column">
             {hasBlockedIdentity ? (
                 <main className="ml-studio-canvas" aria-label="Experiment Canvas">
                    <div className="canvas-state-message blocked-identity">
                       <FaExclamationTriangle className="canvas-icon error-icon" />
                       <h2>Identity Conflict</h2>
                       <p>Workspace identity must be reconciled before continuing.</p>
                       {workspaceVersionConflict && <div className="error-details">{workspaceVersionConflict.message}</div>}
                       {workspaceRefreshError && <div className="error-details">{workspaceRefreshError.message}</div>}
                    </div>
                 </main>
             ) : !hasRequiredIdentity ? (
                 <main className="ml-studio-canvas" aria-label="Experiment Canvas">
                    <div className="canvas-state-message no-dataset">
                       <FaDatabase className="canvas-icon neutral-icon" />
                       <h2>No Dataset Selected</h2>
                       <p>A governed workspace dataset must be selected to proceed.</p>
                    </div>
                 </main>
             ) : (
                 <>
                     <div className={activeStage === 'Configure' ? '' : 'hidden-stage'}>
                         <ExperimentCanvas
                            activeWorkspace={activeWorkspace}
                            analysisContext={analysisContext}
                            numRows={numRows}
                            numCols={numCols}
                            columns={columns}
                            onOpenCleaningForm={onOpenCleaningForm}
                            onRunStarted={fetchRuns}
                         />
                     </div>
                     {activeStage !== 'Configure' && (
                         <UnconnectedStage activeStage={activeStage} />
                     )}
                 </>
             )}
            <RunDock
               runsState={runsState}
               onRetry={fetchRuns}
               isIdentityAvailable={isIdentityAvailable}
            />
         </div>
         {showGuidance && <GuidanceSidebar activeStage={activeStage} />}
      </div>
    </div>
  );
}

function TopRibbon({ activeStage, onStageSelect, showGuidance, onToggleGuidance }) {
  const STAGES = [
    { id: 'Data & Goal', label: 'Data & Goal', icon: <FaDatabase /> },
    { id: 'Prepare Data', label: 'Prepare Data', icon: <FaWrench /> },
    { id: 'Configure', label: 'Configure', icon: <FaCog /> },
    { id: 'Train', label: 'Train', icon: <FaBrain /> },
    { id: 'Review Results', label: 'Review Results', icon: <FaSearch /> },
    { id: 'Use & Share', label: 'Use & Share', icon: <FaBoxOpen /> },
  ];

  return (
    <header className="ml-studio-ribbon" aria-label="Run Ribbon">
      <div className="ribbon-top-bar">
         <div className="experiment-info">
            <span className="experiment-name">Untitled Experiment</span>
            <span className="save-status">Not saved yet</span>
         </div>
         <div className="guidance-toggle">
            <label className="checkbox-wrapper semantic-btn">
              <input type="checkbox" checked={showGuidance} onChange={onToggleGuidance} />
              <span>Guidance</span>
            </label>
         </div>
      </div>
      <div className="ribbon-container">
        {STAGES.map((stage, i) => {
          const isCurrent = activeStage === stage.id;
          return (
            <React.Fragment key={stage.id}>
              <button
                className={`ribbon-stage semantic-btn ${isCurrent ? 'is-current' : 'is-inactive'}`}
                aria-current={isCurrent ? 'step' : undefined}
                onClick={() => onStageSelect(stage.id)}
              >
                <span className="ribbon-icon">{stage.icon}</span>
                <span className="ribbon-label">{stage.label}</span>
              </button>
              {i < STAGES.length - 1 && <div className="ribbon-connector"></div>}
            </React.Fragment>
          );
        })}
      </div>
    </header>
  );
}

function AssetRail({ activeWorkspace, analysisContext, numRows, numCols }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);
  const copyId = (id) => navigator.clipboard.writeText(id).catch(()=>{});

  return (
    <aside className={`ml-studio-rail ${isMobileExpanded ? 'is-mobile-expanded' : ''}`} aria-label="Asset Rail">
       <button
         className="semantic-btn mobile-rail-toggle"
         aria-expanded={isMobileExpanded}
         onClick={() => setIsMobileExpanded(!isMobileExpanded)}
       >
         <span><FaBoxOpen className="panel-icon"/> Asset Identity</span>
         {isMobileExpanded ? <FaChevronUp className="toggle-icon"/> : <FaChevronDown className="toggle-icon"/>}
       </button>
       <h3 className="panel-title desktop-rail-title"><FaBoxOpen className="panel-icon"/> Asset Identity</h3>

       <div className="rail-content">
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
           <div className="rail-item">
              <strong>Sources</strong>
              <span className="rail-value">{analysisContext?.source_ids?.length || 0} connected</span>
           </div>
           <div className="rail-item">
              <strong>Relationships</strong>
              <span className="rail-value">{analysisContext?.relationship_ids?.length || 0} defined</span>
           </div>
         </div>

         <div className="rail-section">
           <button className="semantic-btn expand-raw-btn" aria-expanded={isExpanded} onClick={() => setIsExpanded(!isExpanded)}>
             {isExpanded ? 'Hide Identifiers' : 'Show Identifiers'}
           </button>
           {isExpanded && (
             <div className="raw-identifiers">
               <div className="raw-id-item">
                 <span>Workspace ID:</span>
                 <code>{activeWorkspace?.workspace_id}</code>
                 {activeWorkspace?.workspace_id && <button className="semantic-btn copy-btn" aria-label="Copy workspace ID" onClick={() => copyId(activeWorkspace?.workspace_id)}><FaCopy /></button>}
               </div>
               {analysisContext?.source_ids?.map((id, idx) => (
                  <div className="raw-id-item" key={idx}>
                    <span>Source ID:</span>
                    <code>{id}</code>
                    <button className="semantic-btn copy-btn" aria-label="Copy source ID" onClick={() => copyId(id)}><FaCopy /></button>
                  </div>
               ))}
             </div>
           )}
         </div>
       </div>
    </aside>
  );
}

function ExperimentCanvas({
  activeWorkspace, analysisContext, numRows, numCols, columns, onOpenCleaningForm, onRunStarted
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

  const [runSubmitStatus, setRunSubmitStatus] = useState('idle');
  const [runSubmitError, setRunSubmitError] = useState(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const reqIdRef = useRef(0);

  // Clear prep state when identity changes or navigation
  useEffect(() => {
    setPrepStatus('idle');
    setPrepError(null);
    setAssessment(null);
    setSnapshotData(null);
    setExperimentData(null);
    setRunSubmitStatus('idle');
    setRunSubmitError(null);
    setIdempotencyKey(crypto.randomUUID());
    reqIdRef.current += 1;
  }, [activeWorkspace?.workspace_id, analysisContext?.workspace_version]);

  const guidanceState = useMemo(() => {
    if (!target) return { status: 'incomplete', text: 'Choose a target', icon: <FaInfoCircle /> };
    if (numericFeatures.length === 0 && categoricalFeatures.length === 0) return { status: 'incomplete', text: 'Choose at least one feature', icon: <FaInfoCircle /> };
    if (!isConfirmed) return { status: 'incomplete', text: 'Confirm the roles', icon: <FaInfoCircle /> };

    if (prepStatus === 'loading') return { status: 'incomplete', text: 'Assessing...', icon: <FaSyncAlt className="spin-icon" /> };
    if (prepStatus === 'blocked') return { status: 'error', text: 'Resolve readiness issues', icon: <FaExclamationTriangle /> };
    if (prepStatus === 'ready') return { status: 'ready', text: 'Ready to start run', icon: <FaCheckCircle /> };

    return { status: 'ready', text: 'Ready to assess', icon: <FaCheckCircle /> };
  }, [target, numericFeatures, categoricalFeatures, isConfirmed, prepStatus]);

  const handleTargetChange = (val) => {
    setTarget(val);
    setPrepStatus('idle');
    setExperimentData(null);
    if (val) {
      setNumericFeatures(prev => prev.filter(f => f !== val));
      setCategoricalFeatures(prev => prev.filter(f => f !== val));
      setExcludedColumns(prev => prev.filter(f => f !== val));
    }
  };

  const handleNumericFeaturesChange = (vals) => {
    const valid = vals.filter(f => f !== target);
    setNumericFeatures(valid);
    setPrepStatus('idle');
    setExperimentData(null);
    setCategoricalFeatures(prev => prev.filter(f => !valid.includes(f)));
    setExcludedColumns(prev => prev.filter(f => !valid.includes(f)));
  };

  const handleCategoricalFeaturesChange = (vals) => {
    const valid = vals.filter(f => f !== target);
    setCategoricalFeatures(valid);
    setPrepStatus('idle');
    setExperimentData(null);
    setNumericFeatures(prev => prev.filter(f => !valid.includes(f)));
    setExcludedColumns(prev => prev.filter(f => !valid.includes(f)));
  };

  const handleExcludedColumnsChange = (vals) => {
    const valid = vals.filter(f => f !== target);
    setExcludedColumns(valid);
    setPrepStatus('idle');
    setExperimentData(null);
    setNumericFeatures(prev => prev.filter(f => !valid.includes(f)));
    setCategoricalFeatures(prev => prev.filter(f => !valid.includes(f)));
  };

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
    setRunSubmitStatus('idle');
    setRunSubmitError(null);
    setIdempotencyKey(crypto.randomUUID());

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

  const handleStartRun = async () => {
    setRunSubmitStatus('loading');
    setRunSubmitError(null);

    const revision = process.env.REACT_APP_GIT_SHA?.length >= 7 && process.env.REACT_APP_GIT_SHA?.length <= 64
      ? process.env.REACT_APP_GIT_SHA
      : 'web-ui-unknown';

    try {
      const response = await fetch(`${API_URL}/api/ml-studio/v1/runs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify({
          experiment_id: experimentData.experiment_id,
          specification_version: experimentData.specification_version,
          snapshot_id: snapshotData.snapshot_id,
          parameters: {},
          environment: { client: 'ai_tool_web' },
          code_revision: revision
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw data.error || { code: 'unknown', message: 'Failed to start run.' };
      }

      await onRunStarted();
      setRunSubmitStatus('idle');
      setIdempotencyKey(crypto.randomUUID());
    } catch (err) {
      setRunSubmitStatus('error');
      setRunSubmitError({
        code: err.code || 'ml_studio_internal_error',
        message: err.message || 'An unexpected error occurred.',
        remediation: err.remediation || 'Please try again.'
      });
    }
  };



  return (
    <main className="ml-studio-canvas" aria-label="Experiment Canvas">
      <div className="prep-form-container">
        <div className="connected-dataset-panel">
          <div className="dataset-label">
            <FaDatabase className="inline-icon" />
            <strong>{activeWorkspace?.workspace_name || activeWorkspace?.workspace_id || 'Active Dataset'}</strong>
          </div>
          <div className="dataset-stats">
            {numRows.toLocaleString()} rows • {numCols.toLocaleString()} cols
          </div>
        </div>

        <div className={`guidance-panel ${guidanceState.status}`}>
          <span className="guidance-icon">{guidanceState.icon}</span>
          <span><strong>Next Step:</strong> {guidanceState.text}</span>
        </div>

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
            <select value={target} onChange={e => handleTargetChange(e.target.value)} disabled={prepStatus === 'loading'}>
              <option value="">Select target</option>
              {columns.map(col => <option key={col} value={col}>{col}</option>)}
            </select>
          </label>

          <label className="prep-field">
            <span>Numeric Features</span>
            <select multiple value={numericFeatures} onChange={e => handleNumericFeaturesChange(Array.from(e.target.selectedOptions || []).map(o => o.value))} disabled={prepStatus === 'loading'} className="multi-select">
              {columns.map(col => <option key={col} value={col}>{col}</option>)}
            </select>
          </label>

          <label className="prep-field">
            <span>Categorical Features</span>
            <select multiple value={categoricalFeatures} onChange={e => handleCategoricalFeaturesChange(Array.from(e.target.selectedOptions || []).map(o => o.value))} disabled={prepStatus === 'loading'} className="multi-select">
              {columns.map(col => <option key={col} value={col}>{col}</option>)}
            </select>
          </label>

          <label className="prep-field">
            <span>Excluded Columns</span>
            <select multiple value={excludedColumns} onChange={e => handleExcludedColumnsChange(Array.from(e.target.selectedOptions || []).map(o => o.value))} disabled={prepStatus === 'loading'} className="multi-select">
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
              <div className="start-run-container">
                <button
                  type="button"
                  className="start-run-button"
                  onClick={handleStartRun}
                  disabled={runSubmitStatus === 'loading'}
                >
                  {runSubmitStatus === 'loading' ? 'Starting Run…' : 'Start Run'}
                </button>
                {runSubmitStatus === 'error' && runSubmitError && (
                  <div className="run-submit-error" role="alert">
                    <FaExclamationTriangle className="inline-icon error-text" />
                    <span className="error-text"><strong>{runSubmitError.message}</strong> {runSubmitError.remediation}</span>
                  </div>
                )}
              </div>
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

function UnconnectedStage({ activeStage }) {
  const unconnectedInfo = {
    'Data & Goal': { purpose: 'Define the business goal and metrics.', prerequisite: 'None', providedBy: 'Dataset Selection' },
    'Prepare Data': { purpose: 'Clean and transform data.', prerequisite: 'Goal definition', providedBy: 'Data & Goal' },
    'Train': { purpose: 'Train models.', prerequisite: 'Prepared data and configuration', providedBy: 'Configure' },
    'Review Results': { purpose: 'Evaluate model performance.', prerequisite: 'Completed run', providedBy: 'Train' },
    'Use & Share': { purpose: 'Deploy and share model.', prerequisite: 'Selected candidate', providedBy: 'Review Results' }
  };
  const info = unconnectedInfo[activeStage];

  if (!info) return null;

  return (
    <main className="ml-studio-canvas" aria-label="Experiment Canvas">
      <div className="canvas-state-message">
         <FaInfoCircle className="canvas-icon neutral-icon" />
         <h2>Not connected yet</h2>
         <p><strong>Purpose:</strong> {info.purpose}</p>
         <p><strong>Missing Prerequisite:</strong> {info.prerequisite}</p>
         <p><strong>Provided By:</strong> {info.providedBy}</p>
      </div>
    </main>
  );
}

function GuidanceSidebar({ activeStage }) {
  const guidanceContent = {
    'Data & Goal': 'Define the business goal and metrics. (Currently unconnected)',
    'Prepare Data': 'Clean and transform data. (Currently unconnected)',
    'Configure': 'Configure the machine learning experiment. Select task type, target, and features. Ensure all roles are disjoint and explicitly confirmed.',
    'Train': 'Train models based on the configuration. (Currently unconnected)',
    'Review Results': 'Evaluate model performance and compare candidates. (Currently unconnected)',
    'Use & Share': 'Deploy and share the selected model. (Currently unconnected)'
  };

  return (
    <aside className="ml-studio-inspector" aria-label="Guidance">
       <h3 className="panel-title"><FaInfoCircle className="panel-icon"/> Guidance</h3>
       <div className="inspector-card">
         <div className="inspector-card-content">
           <p>{guidanceContent[activeStage]}</p>
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
  const [isExpanded, setIsExpanded] = useState(true);

  if (!isIdentityAvailable) {
     return <section className="ml-studio-dock empty-dock" aria-label="Recent local runs"></section>;
  }

  return (
    <section className={`ml-studio-dock ${isExpanded ? '' : 'collapsed'}`} aria-label="Recent local runs" aria-busy={runsState.status === 'loading'}>
       <div className="dock-header">
         <button className="semantic-btn dock-toggle-btn" aria-expanded={isExpanded} onClick={() => setIsExpanded(!isExpanded)}>
           <h3><FaLayerGroup className="panel-icon"/> Recent local runs</h3>
         </button>
         {runsState.status === 'success' && runsState.data && (
           <span className="run-count">{runsState.data.length} durable runs</span>
         )}
       </div>

       {isExpanded && (
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
       )}
    </section>
  );
}
