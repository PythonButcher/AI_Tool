
import React, { useContext, useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { DataContext, useDatasetMeta } from '../../context/DataContext';
import {
  FaDatabase, FaLayerGroup, FaChevronDown, FaChevronUp,
  FaSearch, FaInfoCircle, FaExclamationTriangle,
  FaTable, FaPlayCircle, FaCheckCircle, FaTimesCircle, FaSyncAlt,
  FaBoxOpen, FaCodeBranch, FaWrench, FaTools,
  FaBrain, FaCog, FaCopy
} from 'react-icons/fa';
import './MLStudioShell.css';
import ConfigurationStage from './ConfigurationStage';
import TrainingStage from './TrainingStage';
import ReviewStage from './ReviewStage';
import UseShareStage from './UseShareStage';
import { readable } from './TrainingStage';
import './StudioDesign.css';
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
function draftFromEnvelope(data, previous = null) {
  const preparation_context = Object.prototype.hasOwnProperty.call(data, 'preparation_context')
    ? data.preparation_context
    : previous?.experiment_id === data.draft.experiment_id ? previous.preparation_context : null;
  const assessment = Object.prototype.hasOwnProperty.call(data, 'assessment') ? data.assessment
    : previous?.experiment_id === data.draft.experiment_id ? previous.assessment : null;
  return { ...data.draft, preparation_context, assessment, assessment_current: data.workflow_state?.assessment_current === true };
}
export default function MLStudioShell({ onOpenCleaningForm }) {
  const {
    activeWorkspace,
    analysisContext,
    workspaceRefreshStatus,
    workspaceRefreshError,
    workspaceVersionConflict,
    refreshWorkspace
  } = useContext(DataContext);
  const { numRows, numCols } = useDatasetMeta();
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
  const identityRef = useRef(identityKey);
  const preparationResumeRef = useRef(null);
  useEffect(() => { identityRef.current = identityKey; }, [identityKey]);
  const [runsState, setRunsState] = useState({ status: 'idle', data: null, error: null });
  const [activeStage, setActiveStage] = useState('Configure');
  const [showGuidance, setShowGuidance] = useState(true);
  const [draftsState, setDraftsState] = useState({ status: 'idle', data: null, error: null });
  const [activeDraft, setActiveDraft] = useState(null);
  const [pendingDraftAction, setPendingDraftAction] = useState(null);
  const [draftActionError, setDraftActionError] = useState(null);
  const runsFetchIdRef = useRef(0);
  const draftsFetchIdRef = useRef(0);
  const fetchDrafts = useCallback(async () => {
    if (!isIdentityAvailable) return;
    const fetchId = ++draftsFetchIdRef.current;
    setDraftsState({ status: 'loading', data: null, error: null });
    try {
      const response = await fetch(`${API_URL}/api/ml-studio/v1/drafts?workspace_id=${activeWorkspace.workspace_id}`);
      if (fetchId !== draftsFetchIdRef.current) return;
      const data = await response.json();
      if (fetchId !== draftsFetchIdRef.current) return;
      if (!response.ok) throw data.error || new Error('Failed to fetch drafts');
      setDraftsState({ status: 'success', data: data.drafts, error: null });
    } catch (err) {
      if (fetchId !== draftsFetchIdRef.current) return;
      setDraftsState({
        status: 'error', data: null,
        error: { message: err.message || 'An unexpected error occurred.', code: err.code || 'error', remediation: err.remediation || 'Please try again.' }
      });
    }
  }, [isIdentityAvailable, activeWorkspace?.workspace_id]);
  const handleCreateDraft = async () => {
    if (pendingDraftAction) return;
    const currentIdentity = identityKey;
    setPendingDraftAction('creating');
    try {
      const res = await fetch(`${API_URL}/api/ml-studio/v1/drafts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: activeWorkspace.workspace_id })
      });
      const data = await res.json();
      if (identityRef.current !== currentIdentity) return;
      if (!res.ok) throw data.error || new Error('Failed to create draft');
      lastHeaderSaveOkRef.current = true;
      setActiveDraft(draftFromEnvelope(data));
      setWorkflowState(data.workflow_state);
      setActiveStage(data.workflow_state.active_stage);
      setShowGuidance(data.draft.guidance_enabled !== false);
      fetchDrafts();
    } catch (err) {
      if (identityRef.current !== currentIdentity) return;
      setDraftsState({
        status: 'error', data: null,
        error: { message: err.message || 'Failed to create draft.', code: err.code || 'error', remediation: err.remediation || 'Please try again.' }
      });
    } finally {
      if (identityRef.current === currentIdentity) setPendingDraftAction(null);
    }
  };
  const handleReopenDraft = async (experiment_id) => {
    if (pendingDraftAction) return;
    const currentIdentity = identityKey;
    setPendingDraftAction(`reopening-${experiment_id}`);
    try {
      const res = await fetch(`${API_URL}/api/ml-studio/v1/drafts/${experiment_id}?workspace_id=${activeWorkspace.workspace_id}`);
      const data = await res.json();
      if (identityRef.current !== currentIdentity) return;
      if (!res.ok) throw data.error || new Error('Failed to reopen draft');
      lastHeaderSaveOkRef.current = true;
      setActiveDraft(draftFromEnvelope(data));
      setWorkflowState(data.workflow_state);
      setActiveStage(data.workflow_state.active_stage);
      setShowGuidance(data.draft.guidance_enabled !== false);
    } catch (err) {
      if (identityRef.current !== currentIdentity) return;
      setDraftsState({
        status: 'error', data: null,
        error: { message: err.message || 'Failed to open draft.', code: err.code || 'error', remediation: err.remediation || 'Please try again.' }
      });
    } finally {
      if (identityRef.current === currentIdentity) setPendingDraftAction(null);
    }
  };
  const reopenDraftRef = useRef(handleReopenDraft);
  reopenDraftRef.current = handleReopenDraft;
  const handleDuplicateDraft = async (experiment_id) => {
    if (pendingDraftAction) return;
    const currentIdentity = identityKey;
    setPendingDraftAction(`duplicating-${experiment_id}`);
    setDraftActionError(null);
    try {
      const res = await fetch(`${API_URL}/api/ml-studio/v1/drafts/${experiment_id}/duplicate?workspace_id=${activeWorkspace.workspace_id}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (identityRef.current !== currentIdentity) return;
      if (!res.ok) throw data.error || new Error('Failed to duplicate draft');
      fetchDrafts();
    } catch (err) {
      if (identityRef.current !== currentIdentity) return;
      setDraftActionError({
        experiment_id,
        action: 'duplicate',
        error: {
          message: err.message || 'Failed to duplicate draft.',
          code: err.code || 'error',
          remediation: err.remediation || 'Please try again.'
        }
      });
    } finally {
      if (identityRef.current === currentIdentity) setPendingDraftAction(null);
    }
  };
  const handleDeleteDraft = async (draft) => {
    if (pendingDraftAction || !window.confirm(`Delete "${draft.name}" from this workspace? Saved runs will remain available.`)) return;
    const currentIdentity = identityKey;
    setPendingDraftAction(`deleting-${draft.experiment_id}`);
    setDraftActionError(null);
    try {
      const res = await fetch(`${API_URL}/api/ml-studio/v1/drafts/${draft.experiment_id}?workspace_id=${activeWorkspace.workspace_id}`, {
        method: 'DELETE',
        headers: { 'If-Match': draft.etag }
      });
      if (identityRef.current !== currentIdentity) return;
      if (!res.ok) {
        const data = await res.json();
        throw data.error || new Error('Failed to delete experiment.');
      }
      fetchDrafts();
    } catch (err) {
      if (identityRef.current !== currentIdentity) return;
      setDraftActionError({
        experiment_id: draft.experiment_id,
        action: 'delete',
        error: {
          message: err.message || 'Failed to delete experiment.',
          remediation: err.remediation || 'Retry after checking the saved experiment.'
        }
      });
    } finally {
      if (identityRef.current === currentIdentity) setPendingDraftAction(null);
    }
  };
  const fetchRuns = useCallback(async () => {
    if (!isIdentityAvailable) return;
    const fetchId = ++runsFetchIdRef.current;
    setRunsState({ status: 'loading', data: null, error: null });
    try {
      const response = await fetch(`${API_URL}/api/ml-studio/v1/runs?limit=20&workspace_id=${encodeURIComponent(activeWorkspace.workspace_id)}`);
      if (fetchId !== runsFetchIdRef.current) return;
      if (!response.ok) {
        let errorData;
        try { errorData = await response.json(); } catch (e) {}
        if (fetchId !== runsFetchIdRef.current) return;
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
      if (fetchId !== runsFetchIdRef.current) return;
      setRunsState({ status: 'success', data: data.runs, error: null });
    } catch (err) {
      if (fetchId !== runsFetchIdRef.current) return;
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
  }, [isIdentityAvailable, activeWorkspace?.workspace_id]);
  useEffect(() => {
    runsFetchIdRef.current += 1; draftsFetchIdRef.current += 1;
    setRunsState({ status: 'idle', data: null, error: null });
    setDraftsState({ status: 'idle', data: null, error: null });
    setActiveDraft(null);
    setWorkflowState(null);
    setSaveState('saved');
    setSaveError(null);
    setPendingDraftAction(null);
    setDraftActionError(null);
    if (!isIdentityAvailable) {
      return;
    }
    fetchRuns();
    fetchDrafts();
    const resume = preparationResumeRef.current;
    if (resume?.workspace_id === activeWorkspace?.workspace_id) {
      preparationResumeRef.current = null;
      reopenDraftRef.current(resume.experiment_id);
    }
    return () => { runsFetchIdRef.current += 1; draftsFetchIdRef.current += 1; identityRef.current = null; };
  }, [identityKey, isIdentityAvailable, fetchRuns, fetchDrafts, activeWorkspace?.workspace_id]);
  const [workflowState, setWorkflowState] = useState(null);
  const [saveState, setSaveState] = useState('saved');
  const [stagePending, setStagePending] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [localName, setLocalName] = useState('');
  const [draftReloadKey, setDraftReloadKey] = useState(0);
  const saveTimerRef = useRef(null);
  const pendingEditsRef = useRef({});
  const isSavingRef = useRef(false);
  const stageSavingRef = useRef(false);
  const lastHeaderSaveOkRef = useRef(true);
  const etagRef = useRef(null);
  const activeDraftRef = useRef(activeDraft);
  useEffect(() => { activeDraftRef.current = activeDraft; }, [activeDraft]);
  useEffect(() => {
    if (activeDraft && saveState !== 'conflict') {
      setLocalName(activeDraft.name || '');
      etagRef.current = activeDraft.etag;
    }
  }, [activeDraft, saveState]);
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      pendingEditsRef.current = {};
      isSavingRef.current = false;
    };
  }, [identityKey, activeDraft?.experiment_id]);
  const flushSave = useCallback(async () => {
    const draft = activeDraftRef.current;
    if (!draft || saveState === 'conflict') return false;
    if (isSavingRef.current) return false;
    const patch = { ...pendingEditsRef.current };
    if (Object.keys(patch).length === 0) return true;
    pendingEditsRef.current = {};
    isSavingRef.current = true;
    lastHeaderSaveOkRef.current = null;
    setSaveState('saving');
    const currentIdentity = identityRef.current;
    try {
      const res = await fetch(`${API_URL}/api/ml-studio/v1/drafts/${draft.experiment_id}?workspace_id=${activeWorkspace.workspace_id}`, {
         method: 'PATCH',
         headers: { 'Content-Type': 'application/json', 'If-Match': etagRef.current },
         body: JSON.stringify(patch)
      });
      const data = await res.json();
      if (identityRef.current !== currentIdentity || activeDraftRef.current?.experiment_id !== draft.experiment_id) return false;
      if (!res.ok) {
         lastHeaderSaveOkRef.current = false;
         pendingEditsRef.current = { ...patch, ...pendingEditsRef.current };
         if (res.status === 409 || data.error?.code === 'draft_revision_conflict') {
            setSaveState('conflict');
            setSaveError(data.error);
         } else {
            setSaveState('save_error');
            setSaveError(data.error || { message: 'Failed to save.', remediation: 'Try again.' });
         }
         return false;
      } else {
         lastHeaderSaveOkRef.current = true;
         etagRef.current = data.draft.etag;
         activeDraftRef.current = draftFromEnvelope(data, activeDraftRef.current);
         setActiveDraft(previous => draftFromEnvelope(data, previous));
         setWorkflowState(data.workflow_state);
      setActiveStage(data.workflow_state.active_stage);
         setSaveState('saved');
         setSaveError(null);
         if (patch.name !== undefined) fetchDrafts();
         return true;
      }
    } catch (err) {
      if (identityRef.current !== currentIdentity || activeDraftRef.current?.experiment_id !== draft.experiment_id) return false;
      lastHeaderSaveOkRef.current = false;
      pendingEditsRef.current = { ...patch, ...pendingEditsRef.current };
      setSaveState('save_error');
      setSaveError({ message: err.message || 'Network error.', code: 'error', remediation: 'Please try again.' });
      return false;
    } finally {
      if (identityRef.current === currentIdentity && activeDraftRef.current?.experiment_id === draft.experiment_id) {
        isSavingRef.current = false;
        if (lastHeaderSaveOkRef.current === true && Object.keys(pendingEditsRef.current).length > 0) {
           saveTimerRef.current = setTimeout(flushSave, 100);
        }
      }
    }
  }, [activeWorkspace?.workspace_id, saveState, fetchDrafts]);
  const scheduleSave = useCallback((edits) => {
    if (saveState === 'conflict') return;
    pendingEditsRef.current = { ...pendingEditsRef.current, ...edits };
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(flushSave, 500);
  }, [flushSave, saveState]);
  const handleReloadDraft = async () => {
    if (!activeDraft) return;
    const currentIdentity = identityRef.current;
    try {
      setSaveState('saving');
      const res = await fetch(`${API_URL}/api/ml-studio/v1/drafts/${activeDraft.experiment_id}?workspace_id=${activeWorkspace.workspace_id}`);
      const data = await res.json();
      if (identityRef.current !== currentIdentity) return;
      if (!res.ok) throw new Error('Failed to reload draft');
      etagRef.current = data.draft.etag;
      setActiveDraft(draftFromEnvelope(data));
      setWorkflowState(data.workflow_state);
      setActiveStage(data.workflow_state.active_stage);
      setShowGuidance(data.draft.guidance_enabled !== false);
      setLocalName(data.draft.name || '');
      pendingEditsRef.current = {};
      lastHeaderSaveOkRef.current = true;
      setSaveState('saved');
      setSaveError(null);
      setDraftReloadKey(key => key + 1);
    } catch (err) {
      if (identityRef.current !== currentIdentity) return;
      setSaveState('save_error');
      setSaveError({ message: 'Failed to reload.', remediation: 'Try again.' });
    }
  };
  const handleNameChange = (e) => {
    const val = e.target.value;
    if (val.length > 500) return;
    setLocalName(val);
    if (val.trim() !== '') {
      scheduleSave({ name: val.trim() });
    }
  };
  const handleToggleGuidance = () => {
    const newVal = !showGuidance;
    setShowGuidance(newVal);
    scheduleSave({ guidance_enabled: newVal });
  };
  const handleStageSelect = async (stageId) => {
    if (saveState === 'conflict' || isSavingRef.current || stageSavingRef.current) return;
    if (workflowState) {
       const stageInfo = workflowState.stages?.find(s => s.stage === stageId);
       if (workflowState.stages && (!stageInfo || stageInfo.state === 'locked')) return;
    }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    pendingEditsRef.current = { ...pendingEditsRef.current, active_stage: stageId };
    const ok = await flushSave();
    if (ok) {
       // activeStage updated by flushSave via workflow_state
    }
  };
  const handleGoHome = async () => {
     if (saveState === 'conflict' || isSavingRef.current || stageSavingRef.current) return;
     if (Object.keys(pendingEditsRef.current).length > 0) {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        const ok = await flushSave();
        if (!ok) return; // remain on draft if save fails
     }
     setActiveDraft(null);
     setWorkflowState(null);
  };
  const handleExplicitStageSave = async (payload) => {
    if (stageSavingRef.current || !activeDraftRef.current) {
      return { success: false, error: { message: 'A save is already in progress.' } };
    }
    stageSavingRef.current = true;
    setStagePending(true);
    const currentIdentity = identityRef.current;
    const experimentId = activeDraftRef.current.experiment_id;
    const stillCurrent = () => identityRef.current === currentIdentity && activeDraftRef.current?.experiment_id === experimentId;
    try {
      // Header edits must finish first because every successful PATCH changes the ETag.
      let attempts = 0;
      while (isSavingRef.current || Object.keys(pendingEditsRef.current).length > 0) {
        if (!stillCurrent()) return { success: false, error: { message: 'Draft identity changed during save.' } };
        if (isSavingRef.current) {
          if (++attempts > 50) return { success: false, error: { message: 'Waiting for the experiment save timed out.' } };
          await new Promise(resolve => setTimeout(resolve, 100));
          continue;
        }
        if (lastHeaderSaveOkRef.current === false || saveState === 'conflict') {
          return { success: false, error: { message: 'Resolve the experiment save error before continuing.' } };
        }
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        if (!await flushSave()) {
          return { success: false, error: { message: 'Save the experiment details before continuing.' } };
        }
      }
      if (!stillCurrent() || lastHeaderSaveOkRef.current === false || saveState === 'conflict') {
        return { success: false, error: { message: 'Reload the current draft before continuing.' } };
      }
      if (Object.keys(payload).length === 0) return { success: true, draft: activeDraftRef.current };
      isSavingRef.current = true;
      setSaveState('saving');
      const res = await fetch(`${API_URL}/api/ml-studio/v1/drafts/${experimentId}?workspace_id=${activeWorkspace.workspace_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'If-Match': etagRef.current },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!stillCurrent()) return { success: false, error: { message: 'Draft identity changed during save.' } };
      if (!res.ok) {
        const error = data.error || { message: 'Failed to save Data & Goal.' };
        if (res.status === 409 || error.code === 'draft_revision_conflict') {
          setSaveState('conflict');
          setSaveError(error);
        } else {
          setSaveState('saved');
        }
        return { success: false, error };
      }
      etagRef.current = data.draft.etag;
      activeDraftRef.current = draftFromEnvelope(data, activeDraftRef.current);
      setActiveDraft(previous => draftFromEnvelope(data, previous));
      setWorkflowState(data.workflow_state);
      setActiveStage(data.workflow_state.active_stage);
      setSaveState('saved');
      setSaveError(null);
      return { success: true, draft: data.draft };
    } catch (err) {
      if (stillCurrent()) setSaveState('saved');
      return { success: false, error: { message: err.message || 'Network error.' } };
    } finally {
      if (stillCurrent()) {
        isSavingRef.current = false;
        stageSavingRef.current = false;
        setStagePending(false);
      }
    }
  };
  const handleAssessDraft = async (settings) => {
    const saved = await handleExplicitStageSave(settings);
    if (!saved.success) return saved;
    const identity = identityRef.current;
    const experimentId = saved.draft.experiment_id;
    stageSavingRef.current = true;
    setStagePending(true);
    isSavingRef.current = true;
    try {
      const response = await fetch(`${API_URL}/api/ml-studio/v1/drafts/${experimentId}/assessment?workspace_id=${activeWorkspace.workspace_id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'If-Match': saved.draft.etag }, body: '{}',
      });
      const data = await response.json();
      if (identityRef.current !== identity || activeDraftRef.current?.experiment_id !== experimentId) return { success: false, error: { message: 'Experiment changed.' } };
      if (!response.ok) throw data.error || new Error('Assessment failed.');
      etagRef.current = data.draft.etag;
      activeDraftRef.current = draftFromEnvelope(data);
      setActiveDraft(draftFromEnvelope(data));
      setWorkflowState(data.workflow_state);
      setSaveState('saved');
      return { success: true };
    } catch (error) {
      return { success: false, error: { message: error.message || 'Assessment response was lost.', remediation: error.remediation || 'Reload the saved experiment to recover its assessment, or assess again.' } };
    } finally {
      if (identityRef.current === identity && activeDraftRef.current?.experiment_id === experimentId) {
        stageSavingRef.current = false; isSavingRef.current = false; setStagePending(false);
        if (Object.keys(pendingEditsRef.current).length) saveTimerRef.current = setTimeout(flushSave, 100);
      }
    }
  };
  const handlePreparationFinished = async (result) => {
    const draft = activeDraftRef.current;
    if (!draft || result.draft.experiment_id !== draft.experiment_id || result.draft.workspace_id !== activeWorkspace?.workspace_id) return;
    etagRef.current = result.draft.etag;
    setActiveDraft(draftFromEnvelope(result));
    setWorkflowState(result.workflow_state);
    setActiveStage(result.workflow_state.active_stage);
    if (result.preparation.status === 'applied' && refreshWorkspace) {
      preparationResumeRef.current = { workspace_id: draft.workspace_id, experiment_id: draft.experiment_id };
      const refreshed = await refreshWorkspace(draft.workspace_id);
      if (!refreshed) throw new Error('Data was applied. Refresh the workspace, then reopen this experiment to recover its saved state.');
    }
  };
  return (
    <div className="ml-studio-shell">
      <TopRibbon
        activeStage={activeStage}
        onStageSelect={handleStageSelect}
        showGuidance={showGuidance}
        onToggleGuidance={handleToggleGuidance}
        activeDraft={activeDraft}
        onGoHome={handleGoHome}
        saveState={saveState}
        stagePending={stagePending}
        saveError={saveError}
        localName={localName}
        onNameChange={handleNameChange}
        onReloadDraft={handleReloadDraft}
        onRetrySave={flushSave}
        workflowState={workflowState}
      />
      <div className="ml-studio-body">
         <AssetRail
            draft={activeDraft}
            workflowState={workflowState}
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
             ) : !activeDraft ? (
                 <ExperimentHome
                   draftsState={draftsState}
                   onCreate={handleCreateDraft}
                   onReopen={handleReopenDraft}
                   onDuplicate={handleDuplicateDraft}
                   onDelete={handleDeleteDraft}
                   pendingAction={pendingDraftAction}
                   onRetry={() => { setDraftActionError(null); fetchDrafts(); }}
                   draftActionError={draftActionError}
                 />
             ) : (
                 <>
                     {activeStage === 'Configure' && <ConfigurationStage
                       key={`${activeDraft.experiment_id}-${activeDraft.snapshot_id}-${activeDraft.task_type}-${draftReloadKey}`}
                       draft={activeDraft} showGuidance={showGuidance} onEdit={scheduleSave}
                       onAssess={handleAssessDraft} onContinue={() => handleStageSelect('Train')}
                       canTrain={workflowState?.stages?.some(stage => stage.stage === 'Train' && ['available', 'active', 'complete'].includes(stage.state))}
                     />}
                                          {activeStage === 'Data & Goal' && (
                         <DataGoalStage
                 showGuidance={showGuidance}
                            key={`${activeDraft.experiment_id}-${draftReloadKey}`}
                            activeWorkspace={activeWorkspace}
                            analysisContext={analysisContext}
                            activeDraft={activeDraft}
                            onSaveRequest={handleExplicitStageSave}
                         />
                     )}
                     {activeStage === 'Prepare Data' && (
                         <PrepareDataStage
                 showGuidance={showGuidance}
                            activeWorkspace={activeWorkspace}
                            analysisContext={analysisContext}
                            activeDraft={activeDraft}
                            onOpenCleaningForm={onOpenCleaningForm}
                            onSaveRequest={handleExplicitStageSave}
                            onPreparationFinished={handlePreparationFinished}
                         />
                     )}
                     {activeStage === 'Train' && <TrainingStage
                       key={`${activeDraft.experiment_id}-${draftReloadKey}`}
                       draft={activeDraft} showGuidance={showGuidance}
                       onBeforeSubmit={handleExplicitStageSave}
                       onRunChanged={async () => {
                         const identity = identityRef.current;
                         const experimentId = activeDraft.experiment_id;
                         try {
                           const response = await fetch(`${API_URL}/api/ml-studio/v1/drafts/${experimentId}/workflow?workspace_id=${activeDraft.workspace_id}`);
                           const data = await response.json();
                           if (response.ok && identity === identityRef.current && activeDraftRef.current?.experiment_id === experimentId) setWorkflowState(data.workflow_state);
                         } catch { /* The training panel supplies retry and error handling. */ }
                         fetchRuns();
                       }}
                       onReview={() => handleStageSelect('Review Results')}
                     />}
                     {activeStage === 'Review Results' && <ReviewStage
                       key={`${activeDraft.experiment_id}-${draftReloadKey}`}
                       draft={activeDraft} showGuidance={showGuidance} onBeforeDecision={handleExplicitStageSave}
                       onWorkflowChanged={setWorkflowState} onContinue={() => handleStageSelect('Use & Share')}
                     />}
                     {activeStage === 'Use & Share' && <UseShareStage
                       key={`${activeDraft.experiment_id}-${draftReloadKey}`}
                       draft={activeDraft} selectionId={workflowState?.selection_id} showGuidance={showGuidance}
                       onBeforePredict={handleExplicitStageSave}
                     />}
                 </>
             )}
            <RunDock
               runsState={runsState}
               onRetry={fetchRuns}
               isIdentityAvailable={isIdentityAvailable}
            />
         </div>

      </div>
    </div>
  );
}

function InfoPopover({ id, label, text }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const popoverRef = React.useRef();

  React.useEffect(() => {
    function handleClickOutside(e) {
      if (isOpen && popoverRef.current && !popoverRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') setIsOpen(false);
  };

  return (
    <div className="info-popover-container" ref={popoverRef} onKeyDown={handleKeyDown}>
      <button
        type="button"
        className="info-popover-trigger semantic-btn"
        onClick={(e) => { e.preventDefault(); setIsOpen(!isOpen); }}
        aria-label={"Help for " + label}
        aria-expanded={isOpen}
        aria-controls={id}
      >
        <FaInfoCircle className="info-popover-icon" />
      </button>
      {isOpen && (
        <div id={id} className="info-popover-content" role="region" aria-label={"Help for " + label}>
          <div className="info-popover-header">
            <strong>{label} Help</strong>
            <button
              type="button"
              className="semantic-btn close-btn"
              onClick={() => setIsOpen(false)}
              aria-label="Close help"
            >
              &times;
            </button>
          </div>
          <p>{text}</p>
        </div>
      )}
    </div>
  );
}

function TopRibbon({ activeStage, onStageSelect, showGuidance, onToggleGuidance, activeDraft, onGoHome, saveState, stagePending, saveError, localName, onNameChange, onReloadDraft, onRetrySave, workflowState }) {
  const STAGES = [
    { id: 'Data & Goal', label: 'Data & Goal', icon: <FaDatabase /> },
    { id: 'Prepare Data', label: 'Prepare Data', icon: <FaWrench /> },
    { id: 'Configure', label: 'Configure', icon: <FaCog /> },
    { id: 'Train', label: 'Train', icon: <FaBrain /> },
    { id: 'Review Results', label: 'Review Results', icon: <FaSearch /> },
    { id: 'Use & Share', label: 'Use & Share', icon: <FaBoxOpen /> },
  ];
  const isHome = !activeDraft;
  return (
    <header className="ml-studio-ribbon" aria-label="Run Ribbon">
      <div className="ribbon-top-bar">
         <div className="experiment-info">
            <div className="ml-studio-brand">
              <span className="ml-studio-brand-mark" aria-hidden="true"><FaBrain /></span>
              <div className="ml-studio-brand-copy">
                <span className="ml-studio-brand-title">ML Studio</span>
                <span className="ml-studio-brand-context">{isHome ? 'Experiments' : 'Experiment workspace'}</span>
              </div>
            </div>
            {!isHome && (
               <button className="semantic-btn back-home-btn" onClick={onGoHome} title="Back to Experiments" disabled={stagePending || saveState === 'saving'}>
                 <FaChevronDown className="inline-icon" /> Home
               </button>
            )}
            {!isHome && (
              <span className="experiment-name">
                 <input
                   type="text"
                   className="experiment-name-input"
                   value={localName}
                   onChange={onNameChange}
                   aria-label="Experiment Name"
                   maxLength={500}
                   disabled={stagePending || saveState === 'saving' || saveState === 'conflict'}
                 />
              </span>
            )}
            {!isHome && (
              <span className={`save-status status-${saveState}`} role="status">
                 {saveState === 'saving' && 'Saving...'}
                 {saveState === 'saved' && 'Saved'}
                 {saveState === 'save_error' && 'Save Error'}
                 {saveState === 'conflict' && 'Conflict'}
              </span>
            )}
         </div>
         {!isHome && (
            <div className="guidance-toggle">
               {workflowState?.experiment_complete && <span className="ml-cycle-complete"><FaCheckCircle aria-hidden="true" /> Cycle complete</span>}
               <label className="checkbox-wrapper semantic-btn">
                 <input type="checkbox" checked={showGuidance} onChange={onToggleGuidance} disabled={stagePending} />
                 <span>Guidance</span>
               </label>
            </div>
         )}
      </div>
      {!isHome && saveState === 'conflict' && (
         <div className="conflict-warning">
            <FaExclamationTriangle className="inline-icon" />
            <span className="conflict-message">{saveError?.message} {saveError?.remediation}</span>
            <button className="semantic-btn reload-btn" onClick={() => {
               if (window.confirm("Reloading will replace your local edits. Continue?")) {
                  onReloadDraft();
               }
            }}>Reload saved version</button>
         </div>
      )}
      {!isHome && saveState === 'save_error' && saveError && (
         <div className="save-error-warning">
            <FaExclamationTriangle className="inline-icon" />
            <span className="error-message">{saveError?.message} {saveError?.remediation}</span>
            <button className="semantic-btn retry-btn" onClick={onRetrySave}>Retry Save</button>
         </div>
      )}
      {!isHome && (
         <nav className="ribbon-container" aria-label="Experiment stages">
                      {STAGES.map((stage, i) => {
             const isCurrent = activeStage === stage.id;
             const stageInfo = workflowState?.stages?.find(s => s.stage === stage.id);
             const isLocked = workflowState?.stages && (!stageInfo || stageInfo.state === 'locked');
             return (
               <React.Fragment key={stage.id}>
                 <button
                   className={`ribbon-stage semantic-btn ${isCurrent ? 'is-current' : 'is-inactive'} ${isLocked ? 'is-locked' : ''} state-${stageInfo?.state || 'available'}`}
                   aria-current={isCurrent ? 'step' : undefined}
                   onClick={() => onStageSelect(stage.id)}
                   disabled={isLocked || stagePending || saveState === 'saving' || saveState === 'conflict'}
                   title={isLocked ? `Complete the prerequisite first: ${(stageInfo?.blocker_codes || []).map(readable).join(', ')}` : stageInfo?.state === 'stale' ? 'Saved settings changed; evidence needs refresh' : stageInfo?.state === 'complete' ? 'This step has saved completion evidence' : ''}
                 >
                   <span className="ribbon-icon" aria-hidden="true">{stageInfo?.state === 'complete' ? <FaCheckCircle /> : <span className="ml-stage-number">{i + 1}</span>}</span>
                   <span className="ribbon-label">{stage.label}{stageInfo?.state === 'stale' && <small>Needs refresh</small>}</span>
                 </button>
                 {i < STAGES.length - 1 && <div className="ribbon-connector"></div>}
               </React.Fragment>
             );
           })}
         </nav>
      )}
    </header>
  );
}
function ExperimentHome({ draftsState, onCreate, onReopen, onDuplicate, onDelete, pendingAction, onRetry, draftActionError }) {
  const [query, setQuery] = useState('');
  if (draftsState.status === 'loading' || draftsState.status === 'idle') {
    return <main className="ml-studio-canvas" aria-label="Experiment Home"><div className="canvas-state-message"><FaSyncAlt className="canvas-icon neutral-icon spin-icon" /><h2>Loading experiments...</h2></div></main>;
  }
  if (draftsState.status === 'error') {
    return (
      <main className="ml-studio-canvas" aria-label="Experiment Home">
         <div className="canvas-state-message error-state">
            <FaExclamationTriangle className="canvas-icon error-icon" />
            <h2>{draftsState.error.message}</h2>
            <p>{draftsState.error.remediation}</p>
            <button className="semantic-btn retry-btn" onClick={onRetry}>Retry</button>
         </div>
      </main>
    );
  }
  const allDrafts = draftsState.data || [];
  const drafts = allDrafts.filter(draft => `${draft.name} ${draft.task_type || ''}`.toLowerCase().includes(query.toLowerCase()));
  if (allDrafts.length === 0) {
    return (
      <main className="ml-studio-canvas" aria-label="Experiment Home">
        <div className="canvas-state-message no-dataset">
          <FaBrain className="canvas-icon neutral-icon" />
          <span className="ml-eyebrow">From governed data to a considered decision</span>
          <h2>No Experiments Found</h2>
          <p className="empty-state-text">Prepare your data, compare models and keep the evidence behind your choice. Every experiment stays local and can be resumed.</p>
          <div className="ml-task-overview"><span>Predict values</span><span>Classify</span><span>Forecast</span><span>Find groups</span><span>Detect unusual rows</span></div>
          <button
            className="start-run-button"
            onClick={onCreate}
            disabled={pendingAction !== null}
          >
            {pendingAction === 'creating' ? 'Creating...' : 'New Experiment'}
          </button>
        </div>
      </main>
    );
  }
  return (
    <main className="ml-studio-canvas align-top" aria-label="Experiment Home">
      <div className="experiment-home-container">
        <div className="experiment-home-header">
          <div><span className="ml-eyebrow">Your local model workspace</span><h2 className="prep-form-title">Workspace Experiments</h2><p>Resume a saved experiment or explore a new question with the same governed data.</p></div>
          <button
            className="start-run-button"
            onClick={onCreate}
            disabled={pendingAction !== null}
          >
            {pendingAction === 'creating' ? 'Creating...' : 'New Experiment'}
          </button>
        </div>
        <div className="ml-home-toolbar"><span>{allDrafts.length} saved experiments</span><label>Find an experiment<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name or task" /></label></div>
        {drafts.length === 0 && <p role="status">No experiments match this search.</p>}
        <div className="drafts-list">
          {drafts.map(draft => (
            <div key={draft.experiment_id} className="draft-item-container">
              <div className="draft-card">
                <div className="draft-info">
                  <h4>{draft.name}</h4>
                  <span className="ml-draft-task">{draft.task_type ? readable(draft.task_type) : 'Choose a task'}</span>
                  <details className="draft-identity-meta"><summary>Saved identity</summary>
                    <span className="draft-id" aria-label="Experiment ID">ID: {draft.experiment_id}</span>
                    <span className="draft-rev" aria-label="Revision">Rev: {draft.draft_revision}</span>
                  </details>
                  <span className="draft-stage">Stage: {draft.active_stage}</span>
                  <span className="draft-updated">Updated: {new Date(draft.updated_at).toLocaleString()}</span>
                </div>
                <div className="draft-actions">
                  <button
                    className="semantic-btn duplicate-btn"
                    onClick={() => onDuplicate(draft.experiment_id)}
                    aria-label={`Duplicate ${draft.name}`}
                    disabled={pendingAction !== null}
                  >
                    {pendingAction === `duplicating-${draft.experiment_id}` ? 'Duplicating...' : 'Duplicate'}
                  </button>
                  <button
                    className="semantic-btn reopen-btn"
                    onClick={() => onReopen(draft.experiment_id)}
                    disabled={pendingAction !== null}
                  >
                    {pendingAction === `reopening-${draft.experiment_id}` ? 'Opening...' : 'Open'}
                  </button>
                  <button
                    className="semantic-btn delete-btn"
                    onClick={() => onDelete(draft)}
                    aria-label={`Delete ${draft.name}`}
                    disabled={pendingAction !== null}
                  >
                    {pendingAction === `deleting-${draft.experiment_id}` ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
              {draftActionError && draftActionError.experiment_id === draft.experiment_id && (
                <div className="draft-row-error">
                  <FaExclamationTriangle className="inline-icon error-icon" />
                  <span className="error-message">{draftActionError.error.message} {draftActionError.error.remediation}</span>
                  <button className="semantic-btn retry-btn" onClick={() => draftActionError.action === 'delete' ? onRetry() : onDuplicate(draft.experiment_id)}>
                    {draftActionError.action === 'delete' ? 'Refresh list' : 'Retry'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
function AssetRail({ activeWorkspace, analysisContext, numRows, numCols, draft, workflowState }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const copyId = async id => {
    try { await navigator.clipboard.writeText(id); setCopyStatus('Identifier copied'); }
    catch { setCopyStatus('Copy unavailable. Select the displayed identifier to copy it.'); }
  };
  return (
    <aside className={`ml-studio-rail ${isMobileExpanded ? 'is-mobile-expanded' : ''}`} aria-label="Asset Rail">
       <button
         className="semantic-btn mobile-rail-toggle"
         aria-expanded={isMobileExpanded}
         onClick={() => setIsMobileExpanded(!isMobileExpanded)}
       >
         <span><FaDatabase className="panel-icon"/> Data context · {numRows.toLocaleString()} rows</span>
         {isMobileExpanded ? <FaChevronUp className="toggle-icon"/> : <FaChevronDown className="toggle-icon"/>}
       </button>
       <h3 className="panel-title desktop-rail-title"><FaDatabase className="panel-icon"/> Data context</h3>
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
           {draft && <div className="ml-context-question"><span className="ml-eyebrow">This experiment</span><strong>{readable(draft.task_type) || 'Task not chosen'}</strong>{draft.goal && <p>{draft.goal}</p>}<span className="ml-context-state">{workflowState?.experiment_complete ? 'Candidate selected' : draft.assessment_current && draft.assessment?.state === 'ready' ? 'Configuration assessed' : 'Preparation & design'}</span></div>}
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
           {copyStatus && <p className="ml-output-note" role="status">{copyStatus}</p>}
         </div>
       </div>
    </aside>
  );
}
function DataGoalStage({ showGuidance, activeWorkspace, analysisContext, activeDraft, workflowState, onSaveRequest }) {
  const [snapshotState, setSnapshotState] = useState({ status: 'loading', data: null, error: null, stale: false });
  const [previewState, setPreviewState] = useState({ status: 'loading', data: null, error: null });
  const [taskType, setTaskType] = useState(activeDraft?.task_type || 'regression');
  const [goal, setGoal] = useState(activeDraft?.goal || '');
  const [saveStatus, setSaveStatus] = useState({ status: 'idle', error: null });
  const identityKey = `${activeWorkspace?.workspace_id}-${analysisContext?.workspace_version}`;
  const reqIdRef = useRef(0);
  const savePendingRef = useRef(false);
  // We must track if there's an open preparation context in the draft.
  const isOpenPreparation = activeDraft?.preparation_context?.status === 'open';
  const loadDataAndGoal = useCallback(async (forceReload = false) => {
    const reqId = ++reqIdRef.current;
    setSnapshotState(prev => ({ ...prev, status: 'loading', error: null }));
    setPreviewState(prev => ({ ...prev, status: 'loading', error: null }));
    setSaveStatus({ status: 'idle', error: null });
    const currentIdentity = {
      workspace_id: activeWorkspace.workspace_id,
      workspace_version: analysisContext.workspace_version,
      source_ids: analysisContext.source_ids || [],
      relationship_ids: analysisContext.relationship_ids || []
    };
    // 1. Snapshot Loading
    try {
      let snapshotData = null;
      let isStale = false;
      if (!forceReload && activeDraft?.snapshot_id) {
         const snapRes = await fetch(`${API_URL}/api/ml-studio/v1/snapshots/${activeDraft.snapshot_id}`);
         const data = await snapRes.json();
         if (reqId !== reqIdRef.current) return;
         if (!snapRes.ok) throw data.error || { message: 'Failed to load snapshot' };
         snapshotData = data.snapshot;
         const arraysMatch = (a, b) => a.length === b.length && a.every((val, i) => val === b[i]);
         if (snapshotData.workspace_id !== currentIdentity.workspace_id ||
             snapshotData.workspace_version !== currentIdentity.workspace_version ||
             !arraysMatch(snapshotData.source_ids || [], currentIdentity.source_ids) ||
             !arraysMatch(snapshotData.relationship_ids || [], currentIdentity.relationship_ids)) {
            isStale = true;
         }
      }
      if ((!snapshotData || forceReload) && !isOpenPreparation) {
         // Create new snapshot for current identity
         const snapRes = await fetch(`${API_URL}/api/ml-studio/v1/snapshots`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify(currentIdentity)
         });
         const data = await snapRes.json();
         if (reqId !== reqIdRef.current) return;
         if (!snapRes.ok) throw data.error || { message: 'Failed to create snapshot' };
         snapshotData = data.snapshot;
         isStale = false;
      }
      if (reqId === reqIdRef.current) {
        setSnapshotState({ status: 'success', data: snapshotData, stale: isStale, error: null });
      }
    } catch (err) {
      if (reqId === reqIdRef.current) {
        setSnapshotState({ status: 'error', data: null, stale: false, error: err });
      }
    }
    // 2. Preview Loading
    try {
      const prevRes = await fetch(`${API_URL}/api/data-workspaces/${activeWorkspace.workspace_id}/manual-cleaning`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
            workspace_version: currentIdentity.workspace_version,
            source_id: currentIdentity.source_ids[0] || '', // Using first source as primary
            steps: [],
            preview_only: true
         })
      });
      const data = await prevRes.json();
      if (reqId !== reqIdRef.current) return;
      if (!prevRes.ok) throw data.error || { message: 'Failed to load preview' };
      setPreviewState({ status: 'success', data: data, error: null });
    } catch (err) {
      if (reqId === reqIdRef.current) {
        setPreviewState({ status: 'error', data: null, error: err });
      }
    }
  }, [activeWorkspace, analysisContext, activeDraft?.snapshot_id, isOpenPreparation]);
  const dataGoalLoader = useRef(loadDataAndGoal);
  dataGoalLoader.current = loadDataAndGoal;
  useEffect(() => {
    // Reload on workspace identity changes, not on every saved header revision.
    dataGoalLoader.current();
    return () => { reqIdRef.current += 1; };
  }, [identityKey]);
  const handleSave = async (doContinue = false) => {
     if (savePendingRef.current) return;
     if (snapshotState.stale) return; // Do not save stale snapshot
     if (isOpenPreparation) return;
     savePendingRef.current = true;
     setSaveStatus({ status: 'loading', error: null });
     const reqId = ++reqIdRef.current;
     try {
       const payload = {
          snapshot_id: snapshotState.data.snapshot_id,
          task_type: taskType,
          goal: goal || null
       };
       if (doContinue) payload.active_stage = 'Prepare Data';
       const result = await onSaveRequest(payload);
       if (reqId !== reqIdRef.current) return;
       if (!result.success) throw result.error || { message: 'Failed to save Data & Goal' };
       setSaveStatus({ status: 'success', error: null });
     } catch (err) {
       if (reqId === reqIdRef.current) {
          setSaveStatus({ status: 'error', error: err });
       }
     } finally {
       savePendingRef.current = false;
     }
  };
  const isFormDisabled = snapshotState.status === 'loading' || previewState.status === 'loading' || isOpenPreparation || saveStatus.status === 'loading' || snapshotState.stale || snapshotState.status === 'error';
  return (
    <main className="ml-studio-canvas" aria-label="Data and Goal Canvas">
      <div className="prep-form-container">
        <h2 className="prep-form-title">Data & Goal</h2>
        {isOpenPreparation && (
          <div className="prep-alert error">
             <FaExclamationTriangle className="alert-icon" />
             <div className="alert-content">
                <strong>Preparation is open for this draft.</strong>
                <p>Apply or cancel preparation before editing the draft.</p>
             </div>
          </div>
        )}
        {snapshotState.stale && !isOpenPreparation && (
          <div className="prep-alert warning">
             <FaExclamationTriangle className="alert-icon" />
             <div className="alert-content">
                <strong>The workspace identity has changed.</strong>
                <p>The saved dataset snapshot does not match your current workspace version or relationships.</p>
                <button className="retry-button" onClick={() => loadDataAndGoal(true)} type="button">
                  <FaSyncAlt /> Reload current Data Model identities
                </button>
             </div>
          </div>
        )}
        {snapshotState.status === 'error' && (
           <div className="prep-alert error">
             <FaExclamationTriangle className="alert-icon" />
             <div className="alert-content">
                <strong>{snapshotState.error.message}</strong>
                <p>{snapshotState.error.remediation}</p>
                <button className="retry-button" onClick={() => loadDataAndGoal()} type="button">
                  <FaSyncAlt /> Retry Snapshot
                </button>
             </div>
          </div>
        )}
        <div className="connected-dataset-panel">
          <div className="dataset-label">
            <FaDatabase className="inline-icon" />
            <strong>Dataset: {activeWorkspace?.workspace_name || activeWorkspace?.workspace_id || 'Unknown'}</strong>
            {showGuidance && <InfoPopover id="help-dataset" label="Dataset" text="The locked dataset schema used for this experiment." />}
          </div>
          <div className="dataset-stats">
            {previewState.data?.row_count !== undefined ? previewState.data.row_count.toLocaleString() : '---'} rows • {previewState.data?.schema?.length || '---'} cols
          </div>
        </div>
        <div className="data-preview-section">
           <h3>Server Schema & Preview</h3>
           {previewState.status === 'loading' ? (
             <div className="canvas-state-message"><FaSyncAlt className="canvas-icon neutral-icon spin-icon" /> Loading schema...</div>
           ) : previewState.status === 'error' ? (
             <div className="prep-alert error">
                <FaExclamationTriangle className="alert-icon" />
                <div className="alert-content">
                   <strong>{previewState.error.message}</strong>
                   <p>{previewState.error.remediation}</p>
                </div>
             </div>
           ) : (
             <div className="schema-table-container">
                <table className="schema-table">
                  <thead>
                    <tr>
                      <th>Column</th>
                      <th>Type</th>
                      <th>Sample Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewState.data?.schema?.map((col, idx) => (
                      <tr key={idx}>
                        <td>{col.name}</td>
                        <td>{col.data_type}</td>
                        <td>
                          {previewState.data.preview && previewState.data.preview.length > 0
                            ? String(previewState.data.preview[0][col.name] ?? 'null')
                            : '---'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
           )}
        </div>
        <div className="prep-form-grid" >
          <label className="prep-field">
            <span>Problem Choice {showGuidance && <InfoPopover id="help-problem" label="Problem Choice" text="Select the type of machine learning task to perform." />}</span>
            <select
               aria-label="Problem Choice"
               value={taskType}
               onChange={e => setTaskType(e.target.value)}
               disabled={isFormDisabled}
            >
              <option value="regression">Predict a number (regression)</option>
              <option value="classification">Classify (classification)</option>
              <option value="forecasting">Forecast (forecasting)</option>
              <option value="clustering">Find groups (clustering)</option>
              <option value="anomaly_detection">Detect unusual observations (anomaly detection)</option>
            </select>
          </label>
          <label className="prep-field">
            <span>Goal (Optional) {showGuidance && <InfoPopover id="help-goal" label="Goal" text="State the business objective this model will solve." />}</span>
            <textarea
               aria-label="Goal (Optional)"
               value={goal}
               onChange={e => setGoal(e.target.value)}
               disabled={isFormDisabled}
               placeholder="Describe the business goal for this model"
               rows={3}
            />
          </label>
        </div>
        {saveStatus.status === 'error' && (
           <div className="prep-alert error">
             <FaExclamationTriangle className="alert-icon" />
             <div className="alert-content">
                <strong>{saveStatus.error.message}</strong>
                <p>{saveStatus.error.remediation}</p>
                <button className="retry-button" onClick={() => handleSave(false)} type="button">
                  <FaSyncAlt /> Retry Save
                </button>
             </div>
          </div>
        )}
        <div className="start-run-container" >
           <button
             className="semantic-btn save-data-goal-btn"
             onClick={() => handleSave(false)}
             disabled={isFormDisabled}
           >
             Save Data & Goal
           </button>
           {showGuidance && <div style={{display: 'inline-flex', alignItems: 'center', marginLeft: '8px'}}><InfoPopover id="help-save" label="Save Data & Goal" text="Save your selections to update the draft state." /></div>}
           <button
             className="start-run-button"
             onClick={() => handleSave(true)}
             disabled={isFormDisabled}
           >
             {saveStatus.status === 'loading' ? 'Saving...' : 'Save and continue'}
           </button>
        </div>
      </div>
    </main>
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
  const [isExpanded, setIsExpanded] = useState(false);
  const activeCount = (runsState.data || []).filter(run => ['queued', 'running', 'cancel_requested'].includes(run.status)).length;
  if (!isIdentityAvailable) {
     return <section className="ml-studio-dock empty-dock" aria-label="Recent local runs"></section>;
  }
  return (
    <section className={`ml-studio-dock ${isExpanded ? '' : 'collapsed'}`} aria-label="Recent local runs" aria-busy={runsState.status === 'loading'}>
       <div className="dock-header">
         <button className="semantic-btn dock-toggle-btn" aria-expanded={isExpanded} aria-controls="ml-run-activity" onClick={() => setIsExpanded(!isExpanded)}>
           <span><FaLayerGroup className="panel-icon"/> Recent local runs</span>{isExpanded ? <FaChevronDown aria-hidden="true" /> : <FaChevronUp aria-hidden="true" />}
         </button>
         {runsState.status === 'success' && runsState.data && (
           <span className="run-count" role="status">{activeCount ? `${activeCount} active · ` : ''}{runsState.data.length} saved runs</span>
         )}
         {runsState.status === 'error' && <span className="run-count" role="status">Run activity unavailable · expand to retry</span>}
       </div>
       {isExpanded && (
       <div className="dock-content" id="ml-run-activity">
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
              <p>No saved runs yet. Assess a configuration, then start training.</p>
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

function PowerQueryOpeningDialog({ field, onStay, onOpen }) {
  const stayRef = useRef(null);
  const openRef = useRef(null);

  useEffect(() => {
    const trigger = document.activeElement;
    stayRef.current?.focus();
    return () => {
      if (trigger?.isConnected) trigger.focus();
    };
  }, []);

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onStay();
    } else if (event.key === 'Tab') {
      // Keep both forward and backward keyboard navigation inside the choice.
      event.preventDefault();
      const next = document.activeElement === stayRef.current ? openRef.current : stayRef.current;
      next?.focus();
    }
  };

  // Render outside the scrolling canvas so the choice cannot be clipped or offscreen.
  return createPortal(
    <div className="ml-power-query-dialog-backdrop">
      <section className="ml-power-query-dialog" role="dialog" aria-modal="true"
        aria-labelledby="ml-power-query-dialog-title" aria-describedby="ml-power-query-dialog-description"
        onKeyDown={handleKeyDown}>
        <h2 id="ml-power-query-dialog-title">Open in Power Query?</h2>
        <p id="ml-power-query-dialog-description">
          Preview the suggested fix for column <strong>{field}</strong> and review its effect.
          Opening the editor leaves your dataset unchanged. You decide whether to apply it.
        </p>
        <div className="ml-power-query-dialog-actions">
          <button ref={stayRef} className="ml-dialog-cancel-btn" onClick={onStay} type="button">Stay</button>
          <button ref={openRef} className="power-query-btn" onClick={onOpen} type="button"><FaTools /> Open Power Query</button>
        </div>
      </section>
    </div>,
    document.body
  );
}

function PrepareDataStage({ showGuidance, activeWorkspace, analysisContext, activeDraft, onOpenCleaningForm, onSaveRequest, onPreparationFinished }) {
  const [optionsState, setOptionsState] = useState({ status: 'idle', data: null, error: null });
  const [confirmation, setConfirmation] = useState(null);
  const [actionableExplanation, setActionableExplanation] = useState(null);
  const [opening, setOpening] = useState(false);
  const openingRef = useRef(false);
  const reqIdRef = useRef(0);
  const explanationRef = useRef(null);

  useEffect(() => {
    if (actionableExplanation) explanationRef.current?.focus();
  }, [actionableExplanation]);

  const scopeIdentity = `${activeWorkspace?.workspace_id}-${analysisContext?.workspace_version}-${activeDraft?.experiment_id}-${activeDraft?.snapshot_id}`;
  const identityKey = `${scopeIdentity}-${activeDraft?.draft_revision}`;
  const scopeRef = useRef(scopeIdentity);
  useEffect(() => { scopeRef.current = scopeIdentity; return () => { scopeRef.current = null; }; }, [scopeIdentity]);

  const fetchOptions = useCallback(async () => {
    if (!activeWorkspace?.workspace_id || !activeDraft?.experiment_id) {
       setOptionsState({ status: 'error', data: null, error: { message: 'Missing workspace or experiment identity.', code: 'identity_missing', remediation: 'Ensure draft is saved.' } });
       return;
    }

    const reqId = ++reqIdRef.current;
    setOptionsState({ status: 'loading', data: null, error: null });

    try {
      const res = await fetch(`${API_URL}/api/ml-studio/v1/drafts/${activeDraft.experiment_id}/preparation?workspace_id=${activeWorkspace.workspace_id}`);
      const data = await res.json();

      if (reqId !== reqIdRef.current) return;

      if (!res.ok) {
         throw data.error || { message: 'Failed to load preparation options.', code: 'error', remediation: 'Please try again.' };
      }

      setOptionsState({ status: 'success', data, error: null });
    } catch (err) {
      if (reqId === reqIdRef.current) {
        setOptionsState({
          status: 'error', data: null,
          error: {
             message: err.message || 'An unexpected error occurred.',
             code: err.code || 'error',
             remediation: err.remediation || 'Please try again.'
          }
        });
      }
    }
  }, [activeWorkspace?.workspace_id, activeDraft?.experiment_id]);
  const overlayIdentityRef = useRef(null);
  const latestPropsRef = useRef({ onOpenCleaningForm, fetchOptions });
  useEffect(() => {
    latestPropsRef.current = { onOpenCleaningForm, fetchOptions };
  });

  useEffect(() => {
    fetchOptions();
    setConfirmation(null);
    setActionableExplanation(null);
    const scopeIdentity = identityKey;
    return () => {
      reqIdRef.current += 1;
      const { onOpenCleaningForm: openFn } = latestPropsRef.current;
      if (overlayIdentityRef.current === scopeIdentity && openFn) {
        openFn({ closeOverlay: true });
        overlayIdentityRef.current = null;
      }
    };
  }, [identityKey, fetchOptions]);

  const { status, data, error } = optionsState;

  const handleOpenPowerQueryClick = (issue, fix) => {
    if (data?.preparation_context?.status === 'open') return;
    if (!activeWorkspace?.workspace_id || !activeDraft?.experiment_id || !activeDraft?.snapshot_id || !data || data.snapshot_id !== activeDraft.snapshot_id) {
       setActionableExplanation("Save the active experiment and dataset snapshot to configure preparation.");
       return;
    }
    if (typeof onOpenCleaningForm !== 'function') {
      setActionableExplanation('Power Query is unavailable. Reload the application and try again.');
      return;
    }
    if (!issue.field || !fix.action_type || fix.support_status !== 'supported') return;
    setActionableExplanation(null);
    setConfirmation({ issue, fix });
  };

  const handleStay = () => {
    setConfirmation(null);
  };

  const handleConfirmOpen = async () => {
    if (!confirmation || openingRef.current || overlayIdentityRef.current === identityKey) return;
    if (typeof onOpenCleaningForm !== 'function') {
      setConfirmation(null);
      setActionableExplanation('Power Query is unavailable. Reload the application and try again.');
      return;
    }
    openingRef.current = true;
    setOpening(true);
    let currentIdentity = identityKey;
    try {
      const saved = await onSaveRequest({});
      if (scopeRef.current !== scopeIdentity) return;
      if (!saved.success) throw new Error(saved.error?.message || 'Save the draft before preparing data.');
      currentIdentity = `${scopeIdentity}-${saved.draft.draft_revision}`;
      overlayIdentityRef.current = currentIdentity;
      onOpenCleaningForm({
       mlStudioMode: true,
       mlStudioOpeningContext: {
         experiment_id: activeDraft.experiment_id,
         workspace_id: activeWorkspace.workspace_id,
         snapshot_id: activeDraft.snapshot_id,
         draft_revision: saved.draft.draft_revision,
         base_etag: saved.draft.etag,
         issue_id: confirmation.issue.issue_id,
         fix_id: confirmation.fix.fix_id,
         return_stage: "Prepare Data",
         title: activeDraft.name || "Experiment",
         field: confirmation.issue.field,
         action: confirmation.fix.action_type,
         explanation: confirmation.fix.explanation,
       },
       initialSteps: [{ type: confirmation.fix.action_type, params: confirmation.fix.parameters || {}, id: `fix-${Date.now()}` }],
       onPreparationFinished,
       onClose: () => {
         const { fetchOptions: fetchFn } = latestPropsRef.current;
         if (overlayIdentityRef.current !== currentIdentity) return;
         overlayIdentityRef.current = null;
         if (fetchFn) fetchFn();
       }
      });
      setConfirmation(null);
    } catch (err) {
      overlayIdentityRef.current = null;
      setConfirmation(null);
      setActionableExplanation(err.message || 'Power Query could not open. Please try again.');
    } finally {
      openingRef.current = false;
      setOpening(false);
    }
  };

  const handleResume = () => {
    const preparation = data?.preparation_context || activeDraft.preparation_context;
    if (!preparation || typeof onOpenCleaningForm !== 'function') return;
    overlayIdentityRef.current = identityKey;
    onOpenCleaningForm({ mlStudioMode: true,
      mlStudioOpeningContext: { ...preparation, preparation, title: activeDraft.name },
      initialSteps: [], onPreparationFinished,
      onClose: () => { overlayIdentityRef.current = null; fetchOptions(); },
    });
  };

  return (
    <main className="ml-studio-canvas" aria-label="Prepare Data Canvas">
      <div className="prep-form-container">
        <h2 className="prep-form-title">Prepare Data <span className="stage-heading-help">{showGuidance && <InfoPopover id="help-prepare" label="Prepare Data" text="Clean and transform data." />}</span></h2>

        {status === 'loading' && (
           <div className="canvas-state-message">
              <FaSyncAlt className="canvas-icon neutral-icon spin-icon" />
              <h2>Loading options...</h2>
           </div>
        )}

        {status === 'error' && (
           <div className="prep-alert error">
             <FaExclamationTriangle className="alert-icon" />
             <div className="alert-content">
                <strong>{error.message}</strong>
                <p>{error.remediation}</p>
                <button className="retry-button" onClick={fetchOptions} type="button">
                  <FaSyncAlt /> Retry
                </button>
                {activeDraft.preparation_context?.status === 'open' && <button type="button" className="power-query-btn" onClick={handleResume}>Resume preparation</button>}
             </div>
           </div>
        )}

        {status === 'success' && data && (
           <div className="preparation-options">
              {data.preparation_context?.status === 'open' && (
                 <div className="prep-alert warning">
                   <FaExclamationTriangle className="alert-icon" />
                   <div className="alert-content">
                     <strong>Preparation operation is currently open.</strong>
                     <p>A preparation step is pending (Operation ID: {data.preparation_context.operation_id}). Complete or cancel it to proceed.</p>
                     <button type="button" className="power-query-btn" onClick={handleResume}>Resume preparation</button>
                   </div>
                 </div>
              )}

              {actionableExplanation && (
                 <div className="prep-alert warning" role="alert" tabIndex={-1} ref={explanationRef}>
                   <FaExclamationTriangle className="alert-icon" />
                   <div className="alert-content">
                     <strong>Cannot Open Power Query</strong>
                     <p>{actionableExplanation}</p>
                   </div>
                 </div>
              )}

              {confirmation && (
                 <PowerQueryOpeningDialog field={confirmation.issue.field} onStay={handleStay} onOpen={handleConfirmOpen} />
              )}
              {opening && <p role="status">Saving experiment before opening preparation…</p>}

              <div className="assessment-results">
                 <h3 className="results-title">Quality Findings</h3>
                 {!data.issues || data.issues.length === 0 ? (
                    <div className="canvas-state-message">
                       <FaCheckCircle className="canvas-icon neutral-icon" />
                       <p>This bounded check found no missing-value issues.</p>
                    </div>
                 ) : (
                    data.issues.map(issue => (
                       <div key={issue.issue_id} className={`issue-card ${issue.severity}`}>
                          <div className="issue-header">
                            <strong>{issue.severity.toUpperCase()}: {issue.message}</strong>
                          </div>
                          {issue.field && <p className="issue-field-label"><strong>Column:</strong> {issue.field}</p>}
                          <p>{issue.remediation}</p>
                          <div className="raw-id-item text-muted"><small>Issue ID: {issue.issue_id}</small></div>

                          {data.fixes?.filter(f => f.issue_id === issue.issue_id).map(fix => (
                             <div key={fix.fix_id} className={`fix-card ${fix.support_status}`}>
                               <div className="fix-header">
                                 <strong>Action: {fix.action_type}</strong>
                               </div>
                               <p className="fix-explanation">{fix.explanation}</p>
                               <div className="raw-id-item text-muted"><small>Fix ID: {fix.fix_id}</small></div>
                               {fix.support_status === 'supported' && (
                                  <button
                                    className="power-query-btn"
                                    onClick={() => handleOpenPowerQueryClick(issue, fix)}
                                    type="button"
                                    disabled={data.preparation_context?.status === 'open' || !!confirmation}
                                  >
                                    <FaTools /> Open in Power Query
                                  </button>
                               )}
                             </div>
                          ))}
                       </div>
                    ))
                 )}
              </div>
           </div>
        )}
      </div>
    </main>
  );
}
