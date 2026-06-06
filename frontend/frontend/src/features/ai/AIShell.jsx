import React, { useState, useContext, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import {
  FaRobot, FaRegCommentDots, FaTools, FaBook, FaDatabase, FaPlus, FaLightbulb,
  FaHistory, FaChartBar, FaShieldAlt, FaCircle, FaInfoCircle, FaPaperPlane,
  FaCheckCircle, FaExclamationTriangle, FaExternalLinkAlt, FaLayerGroup, FaFileAlt,
  FaEye, FaChevronRight, FaTerminal, FaSearch, FaCloud, FaFilePdf
} from "react-icons/fa";
import {
  TextField, Button, Box, Typography, Divider, Tooltip, Chip,
  Avatar, Tabs, Tab, Drawer, IconButton
} from '@mui/material';
import { DataContext } from '../../context/DataContext';
import { WarehouseContext } from '../../context/WarehouseContext';
import MentionDropdown from '../../components/data_management/MentionDropdown';
import { detectToken, extractTokens } from '../../utils/mentionUtils';
import { AICommands } from '../workflow/AiCommandBlock';
import AICharts from './AICharts';
import SemanticRef from '../business/decision/SemanticRef';
import ScenarioPreview from '../business/decision/ScenarioPreview';
import { generateDecisionArtifactPdf } from '../../utils/decisionPdfExport';
import './AIShell.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const WORKSPACE_TABS = [
  { id: 'threads', label: 'Threads', icon: <FaRegCommentDots /> },
  { id: 'playbooks', label: 'Playbooks', icon: <FaBook /> },
  { id: 'definitions', label: 'Definitions', icon: <FaDatabase /> },
  { id: 'briefs', label: 'Briefs', icon: <FaFileAlt /> },
  { id: 'checks', label: 'Checks', icon: <FaShieldAlt /> },
];

const MODES = [
  { id: 'ask', label: 'Inquire', promise: 'Grounded factual analysis' },
  { id: 'explore', label: 'Explore', promise: 'Visual trend discovery' },
  { id: 'decide', label: 'Decide', promise: 'Strategic path evaluation' },
];

/**
 * AIShell (Analytics-Agent Workspace)
 *
 * Re-implemented as a high-fidelity workspace with split conversation and inspection.
 */
function AIShell({ setShowAIChart, setAiChartType, setAiChartData, onOpenWorkspace }) {
  const {
    cleanedData,
    fullData,
    setCleanedData,
    semanticModel,
    refreshSemanticModelFromDataset,
  } = useContext(DataContext);
  const { datasets } = useContext(WarehouseContext);

  // Shell State
  const [userMessages, setUserMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [awaitingCleanInstructions, setAwaitingCleanInstructions] = useState(false);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState('threads');

  // Phase 4 Logic State
  const [sessionState, setSessionState] = useState({});
  const [activeMode, setActiveMode] = useState('ask');
  const [activeArtifact, setActiveArtifact] = useState(null);
  const [isResultsPaneOpen, setIsResultsPaneOpen] = useState(true);
  const [isContextPaneOpen, setIsContextPaneOpen] = useState(false);

  // Phase 5: Chat-native correction panel state
  // correctionPanelOpen tracks whether the inline correction form is visible in the inspector
  const [correctionPanelOpen, setCorrectionPanelOpen] = useState(false);
  // correctionType: which backend-supported correction type the user is submitting
  const [correctionType, setCorrectionType] = useState('time_horizon');
  // correctionTargetPath: stable path for the selected correction type
  const [correctionTargetPath, setCorrectionTargetPath] = useState('decision_scope.time_horizon');
  // correctionReplacement: the new value the user wants to apply
  const [correctionReplacement, setCorrectionReplacement] = useState('');
  // correctionReason: optional user-facing audit reason string
  const [correctionReason, setCorrectionReason] = useState('');

  // Derive mode context for visibility
  const modeContext = useMemo(() => sessionState?.mode_context || {}, [sessionState]);

  // Mention State
  const [mentionQuery, setMentionQuery] = useState(null);
  const [isMentionOpen, setIsMentionOpen] = useState(false);
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const inputRef = useRef(null);
  const chatBodyRef = useRef(null);

  // Connection Metadata
  const connectionStatus = useMemo(() => {
    const isSemanticActive = !!semanticModel;
    const isDataLoaded = (cleanedData?.length > 0) || (fullData?.length > 0);
    return {
      semantic: isSemanticActive ? 'Active' : 'Standby',
      data: isDataLoaded ? 'Connected' : 'Disconnected'
    };
  }, [semanticModel, cleanedData, fullData]);

  // Auto-scroll logic
  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTo({ top: chatBodyRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [userMessages, loading]);

  const resolveDatasetForNlp = () => {
    if (Array.isArray(cleanedData) && cleanedData.length > 0) return cleanedData;
    if (Array.isArray(fullData) && fullData.length > 0) return fullData;
    return null;
  };

  const handleActionClick = async (actionId, scopedSessionState = null) => {
    // If the action is specifically to open a workspace, handle continuity immediately
    if (actionId === 'open_workspace' && onOpenWorkspace) {
      const activeState = scopedSessionState || sessionState;
      const workspace = activeState.workspace ||
                        activeState.draft_workspace ||
                        activeState.decision_state?.workspace ||
                        activeState.decision_state?.draft_workspace ||
                        activeState.decision_workspace;

      if (workspace) {
        onOpenWorkspace(workspace);
        return;
      }
    }

    setLoading(true);
    setError(null);
    setActiveArtifact(null); // Clear stale inspector state immediately

    const payload = {
      action: actionId,
      session_state: scopedSessionState || sessionState,
      dataset: resolveDatasetForNlp(),
      semantic_model: semanticModel,
    };

    try {
      const response = await axios.post(`${API_URL}/api/decision/chat/actions`, payload);
      const data = response.data;

      if (data.status === 'success') {
        // If the action response itself contains a workspace, and it's an open intent, handle it
        if (actionId === 'open_workspace' && data.decision_workspace && onOpenWorkspace) {
          onOpenWorkspace(data.decision_workspace);
          setLoading(false);
          return;
        }

        const newAssistantMsg = {
          role: "assistant",
          content: data.assistant_message,
          artifacts: data.artifacts,
          suggested_actions: data.suggested_actions || data.session_state?.available_actions || [],
          mode: data.mode,
          session_state: data.session_state || {}, // Scoped state for this turn
          capability_state: data.capability_state,
          decision_readiness: data.decision_readiness
        };
        setUserMessages(prev => [...prev, newAssistantMsg]);
        setSessionState(data.session_state || {});
        if (data.mode) setActiveMode(data.mode);

        if (data.artifacts && data.artifacts.length > 0) {
          const lastArt = data.artifacts[data.artifacts.length - 1];
          // Only auto-focus if it's a rich, inspectable artifact
          const richTypes = ['chart', 'workspace_preview', 'workspace_analysis_summary', 'decision_output'];
          if (richTypes.includes(lastArt.type)) {
            setActiveArtifact({
              ...lastArt,
              contextActions: newAssistantMsg.suggested_actions,
              contextSessionState: newAssistantMsg.session_state,
              contextCapabilityState: newAssistantMsg.capability_state,
              contextDecisionReadiness: newAssistantMsg.decision_readiness
            });
            setIsResultsPaneOpen(true);
          }
        }
      } else {
        setError(data.error?.message || "Action execution failed.");
      }
    } catch (err) {
      setError("Connectivity failure during action.");
    } finally {
      setLoading(false);
    }
  };

  /**
   * handleCorrectionSubmit
   *
   * Phase 5: Sends a deterministic correction to /api/decision/chat/actions
   * with action: "draft_workspace" and a valid correction object.
   *
   * The backend contract (decision_objects.md) requires:
   *   action: "draft_workspace"
   *   session_state: from the artifact's scoped session state
   *   dataset: resolved active dataset
   *   semantic_model: current semantic model
   *   correction: { correction_type, target_path, replacement, reason }
   *
   * On success, the backend returns workspace_preview (compatibility) and
   * appended decision_output with updated correction_state.
   * We use the last rich artifact as the active result pane artifact.
   */
  const handleCorrectionSubmit = async (correctionPayload, scopedSessionState = null) => {
    if (!correctionPayload || !correctionPayload.correction_type) {
      setError('Correction type is required.');
      return;
    }
    // Require a replacement value for all types except remove_mapping
    if (correctionPayload.correction_type !== 'remove_mapping' &&
        (correctionPayload.replacement === '' || correctionPayload.replacement === null || correctionPayload.replacement === undefined)) {
      setError('A replacement value is required for this correction type.');
      return;
    }

    setLoading(true);
    setError(null);
    setCorrectionPanelOpen(false); // Close the correction form immediately while loading

    let replacementValue = correctionPayload.replacement;

    // Phase 5: Build contract-valid replacement shapes per the backend contract
    if (correctionPayload.correction_type === 'time_horizon') {
      replacementValue = {
        kind: 'named_period',
        label: String(correctionPayload.replacement),
        grain: 'unknown',
      };
    } else if (correctionPayload.correction_type === 'objective_direction') {
      replacementValue = String(correctionPayload.replacement);
    } else if (correctionPayload.correction_type === 'lever_controllability') {
      const isControllable = correctionPayload.replacement === 'true' || correctionPayload.replacement === true;
      replacementValue = {
        controllable: isControllable,
      };
    } else if (correctionPayload.correction_type === 'objective_metric') {
      replacementValue = {
        field: String(correctionPayload.replacement),
      };
    }

    // Build the full request payload per the backend contract
    const payload = {
      action: 'draft_workspace',
      session_state: scopedSessionState || sessionState,
      dataset: resolveDatasetForNlp(),
      semantic_model: semanticModel,
      correction: {
        correction_type: correctionPayload.correction_type,
        target_path: correctionPayload.target_path,
        replacement: replacementValue,
        reason: correctionPayload.reason || null,
      },
    };

    try {
      const response = await axios.post(`${API_URL}/api/decision/chat/actions`, payload);
      const data = response.data;

      if (data.status === 'success') {
        // Build the assistant message with correction context
        const newAssistantMsg = {
          role: 'assistant',
          content: data.assistant_message,
          artifacts: data.artifacts,
          suggested_actions: data.suggested_actions || data.session_state?.available_actions || [],
          mode: data.mode,
          session_state: data.session_state || {}, // Scoped state carries correction context forward
          capability_state: data.capability_state,
          decision_readiness: data.decision_readiness,
        };
        setUserMessages(prev => [...prev, newAssistantMsg]);
        // Always update global session state with the corrected session state
        // so follow-up actions (like analyze_workspace) use the corrected state
        setSessionState(data.session_state || {});
        if (data.mode) setActiveMode(data.mode);

        // Auto-focus the last rich artifact (backend returns workspace_preview first,
        // then appended decision_output — we want the decision_output)
        if (data.artifacts && data.artifacts.length > 0) {
          const lastArt = data.artifacts[data.artifacts.length - 1];
          const richTypes = ['chart', 'workspace_preview', 'workspace_analysis_summary', 'decision_output'];
          if (richTypes.includes(lastArt.type)) {
            setActiveArtifact({
              ...lastArt,
              contextActions: newAssistantMsg.suggested_actions,
              contextSessionState: newAssistantMsg.session_state,
              contextCapabilityState: newAssistantMsg.capability_state,
              contextDecisionReadiness: newAssistantMsg.decision_readiness,
            });
            setIsResultsPaneOpen(true);
          }
        }
      } else {
        setError(data.error?.message || 'Correction submission failed.');
      }
    } catch (err) {
      setError('Connectivity failure during correction.');
    } finally {
      setLoading(false);
      // Reset correction form fields for next use
      setCorrectionReplacement('');
      setCorrectionReason('');
    }
  };

  const handleModeChange = (event, newMode) => {
    if (!newMode) return;
    setActiveMode(newMode);
    setSessionState(prev => ({
      ...prev,
      active_mode: newMode,
      mode_context: {
        ...(prev.mode_context || {}),
        reason: null // Clear stale backend reason on manual override
      }
    }));
  };

  const renderAnswerArtifact = (content) => {
    if (!content) return null;

    // High-fidelity structured rendering
    if (content.metric && content.summary) {
      return (
        <div className="ai-shell__answer-card">
          <div className="ai-shell__answer-metric-header">
            <Typography className="ai-shell__answer-metric-value">
              {content.summary.value_formatted || content.summary.value}
            </Typography>
            <Typography className="ai-shell__answer-metric-label">
              {content.metric.label || content.metric.name}
            </Typography>
          </div>
          {content.rows && content.rows.length > 0 && (
            <div className="ai-shell__answer-rows">
               {content.rows.slice(0, 15).map((row, i) => (
                 <div key={i} className="ai-shell__answer-row">
                   <span className="ai-shell__answer-row-label">
                     {row.group_label || (row.group && Object.values(row.group).join(' | ')) || 'Segment'}
                   </span>
                   <span className="ai-shell__answer-row-value">
                     {row.value_formatted || row.value}
                   </span>
                 </div>
               ))}
            </div>
          )}
        </div>
      );
    }

    if (content.fieldsUsed && content.aggregation) {
      return (
        <div className="ai-shell__answer-card">
          <div className="ai-shell__answer-metric-header">
            <Typography className="ai-shell__answer-metric-value">
              {content.value !== undefined ? content.value : (content.top_group?.value || '---')}
            </Typography>
            <Typography className="ai-shell__answer-metric-label">
              {content.aggregation.toUpperCase()} of {content.fieldsUsed.value}
            </Typography>
          </div>
          {content.top_group && (
            <div className="ai-shell__answer-highlight">
              <Typography variant="overline" sx={{ fontWeight: 900, color: 'var(--text-secondary)' }}>PRIMARY ATTRIBUTE</Typography>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>{content.top_group.label}</Typography>
            </div>
          )}
        </div>
      );
    }

    return <Typography variant="body2" sx={{ lineHeight: 1.7 }}>{content.message || JSON.stringify(content)}</Typography>;
  };

  const handleInspect = (artifact, messageActions = null, messageSessionState = null, messageCapabilityState = null, messageDecisionReadiness = null) => {
    setActiveArtifact({
      ...artifact,
      contextActions: messageActions,
      contextSessionState: messageSessionState,
      contextCapabilityState: messageCapabilityState,
      contextDecisionReadiness: messageDecisionReadiness
    });
    setIsResultsPaneOpen(true);
  };

  const isPdfExportableArtifact = (artifact) => {
    return ['answer', 'chart', 'workspace_preview', 'workspace_analysis_summary'].includes(artifact?.type);
  };

  const handleExportArtifactPdf = (artifact, messageSessionState = null, messageCapabilityState = null, messageDecisionReadiness = null) => {
    if (!isPdfExportableArtifact(artifact)) return;

    generateDecisionArtifactPdf({
      artifact,
      contextSessionState: messageSessionState || artifact.contextSessionState || sessionState,
      contextCapabilityState: messageCapabilityState || artifact.contextCapabilityState || sessionState?.capability_state,
      contextDecisionReadiness: messageDecisionReadiness || artifact.contextDecisionReadiness || sessionState?.decision_readiness,
    });
  };

  const renderArtifactExportButton = (artifact, messageSessionState = null, messageCapabilityState = null, messageDecisionReadiness = null, className = '') => {
    if (!isPdfExportableArtifact(artifact)) return null;

    return (
      <Tooltip title="Export result as PDF" arrow>
        <IconButton
          size="small"
          className={`ai-shell__export-icon-btn ${className}`}
          aria-label="Export result as PDF"
          onClick={(event) => {
            event.stopPropagation();
            handleExportArtifactPdf(artifact, messageSessionState, messageCapabilityState, messageDecisionReadiness);
          }}
        >
          <FaFilePdf />
        </IconButton>
      </Tooltip>
    );
  };

  const renderArtifactExportBar = (artifact, messageSessionState = null, messageCapabilityState = null, messageDecisionReadiness = null) => {
    if (!isPdfExportableArtifact(artifact)) return null;

    return (
      <div className="ai-shell__artifact-export-bar">
        <span>Export this result for review</span>
        {renderArtifactExportButton(artifact, messageSessionState, messageCapabilityState, messageDecisionReadiness)}
      </div>
    );
  };

  const renderArtifact = (artifact, isInspector = false, contextActions = null, contextSessionState = null, contextCapabilityState = null, contextDecisionReadiness = null) => {
    if (!artifact) return null;

    const {
      type,
      content,
      render_hint,
      inspectable,
      source,
      mode: artMode
    } = artifact;

    // Use passed context metadata or stored artifact context for inspector
    const lookupActions = contextActions || artifact.contextActions || sessionState?.available_actions || [];
    const lookupSessionState = contextSessionState || artifact.contextSessionState || sessionState;
    const lookupCapabilityState = contextCapabilityState || artifact.contextCapabilityState || sessionState?.capability_state;
    const lookupDecisionReadiness = contextDecisionReadiness || artifact.contextDecisionReadiness || sessionState?.decision_readiness;

    const baseClass = isInspector ? "ai-shell__active-artifact" : "ai-shell__artifact-preview-card";

    // Helper to format object arrays into SemanticRef components
    const renderSemanticList = (items, type) => {
      if (!Array.isArray(items) || items.length === 0) return <Typography variant="body2" sx={{ opacity: 0.5 }}>Not specified</Typography>;
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingLeft: '12px', borderLeft: '2px solid var(--text-primary)' }}>
          {items.map((item, i) => {
            const metricRef = item.metric_ref || (type === 'lever' && item.binding?.binding_type === 'metric' ? item.binding.metric_ref : null);
            const dimensionRef = item.dimension_ref || (type === 'lever' && item.binding?.binding_type === 'dimension' ? item.binding.dimension_ref : null);

            if (metricRef?.metric_id || dimensionRef?.dimension_id) {
              return <SemanticRef key={i} metric_ref={metricRef} dimension_ref={dimensionRef} type={type} compact />;
            }

            // Build a fallback ref from flattened fields
            const fallbackLabel = item.label || item.binding_label || item.metric || item.dimension_id || item.field || item.strings || (typeof item === 'string' ? item : 'Unbound item');
            const fallbackRef = { label: fallbackLabel };

            return (
              <SemanticRef
                key={i}
                metric_ref={type !== 'segment' ? fallbackRef : null}
                dimension_ref={type === 'segment' ? fallbackRef : null}
                type={type}
                compact
              />
            );
          })}
        </div>
      );
    };

    // Metadata-driven visibility: In-thread we show links for inspectable rich content
    // unless render_hint explicitly asks for 'inline' presentation.
    if (!isInspector && inspectable && render_hint !== 'inline') {
      // Relaxed check: Allow answers that have either semantic metric or raw analytics fields
      const hasContent = content?.metric || (content?.fieldsUsed && content?.aggregation);
      if (type === 'answer' && !hasContent) return null;

      return (
        <div className="ai-shell__artifact-preview-link" onClick={() => handleInspect(artifact, contextActions, contextSessionState, contextCapabilityState, contextDecisionReadiness)}>
          <div className="ai-shell__preview-icon">
            {type === 'chart' ? <FaChartBar /> : type === 'workspace_preview' ? <FaLayerGroup /> : type === 'decision_output' ? <FaShieldAlt /> : type === 'answer' ? <FaCheckCircle /> : <FaFileAlt />}
          </div>
          <div className="ai-shell__preview-info">
            <Typography variant="caption" className="ai-shell__preview-type">
              {source ? `${source.toUpperCase()} • ` : ''}{type === 'chart' ? 'Visualization' : type === 'workspace_preview' ? 'Workspace' : type === 'decision_output' ? 'Decision Frame' : type === 'answer' ? 'Data Result' : 'Analysis'}
            </Typography>
            <Typography variant="body2" className="ai-shell__preview-title" noWrap>
              {artifact.title || content?.title || content?.chartType || content?.summary?.headline || content?.metric?.label || content?.metric?.name || content?.fieldsUsed?.value || 'View Details'}
            </Typography>
          </div>
          <div className="ai-shell__preview-actions">
            {renderArtifactExportButton(artifact, contextSessionState, contextCapabilityState, contextDecisionReadiness, 'is-preview-export')}
            <IconButton size="small" className="ai-shell__preview-action" aria-label="View Details">
              <FaChevronRight />
            </IconButton>
          </div>
        </div>
      );
    }

    switch (type) {
      case 'answer':
        // Inline answers or inspector view. Relaxed check for raw analytics results.
        const hasContent = content?.metric || (content?.fieldsUsed && content?.aggregation);
        if (!isInspector && !hasContent && render_hint !== 'inline') return null;

        return (
          <div className={`${baseClass} is-answer`}>
            {!isInspector && (
              <div className="ai-shell__artifact-header">
                <span className="ai-shell__artifact-title">
                   <FaCheckCircle /> {source || 'Result'} {artMode ? `(${artMode})` : ''}
                </span>
                <div className="ai-shell__artifact-header-actions">
                  {renderArtifactExportButton(artifact, contextSessionState, contextCapabilityState, contextDecisionReadiness)}
                  {inspectable && <IconButton size="small" onClick={() => handleInspect(artifact, contextActions, contextSessionState, contextCapabilityState, contextDecisionReadiness)} aria-label="Inspect Result"><FaExternalLinkAlt style={{ fontSize: '0.7rem' }} /></IconButton>}
                </div>
              </div>
            )}
            <div className="ai-shell__artifact-content">
              {isInspector && renderArtifactExportBar(artifact, lookupSessionState, lookupCapabilityState, lookupDecisionReadiness)}
              {renderAnswerArtifact(content)}
            </div>
          </div>
        );

      case 'chart':
        return (
          <div className={`${baseClass} is-chart`}>
            {isInspector && (
              <div className="ai-shell__artifact-content" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                {renderArtifactExportBar(artifact, lookupSessionState, lookupCapabilityState, lookupDecisionReadiness)}
                <AICharts aiChartType={content?.chartType || 'Bar'} aiChartData={content?.chartData} />
                {content?.explanation && (
                  <Typography variant="caption" sx={{ mt: 2, display: 'block', opacity: 0.6 }}>{content.explanation}</Typography>
                )}
              </div>
            )}
          </div>
        );

      case 'workspace_preview':
        const wp = content || artifact;
        const dr = wp.decision_readiness || wp.content?.decision_readiness || lookupDecisionReadiness || wp;

        // Derive capability state by merging artifact-level and response-level context
        const artCs = wp.capability_state || wp.content?.capability_state || dr?.capability_state;
        const respCs = lookupCapabilityState;
        const cs = { ...respCs, ...artCs };

        // Explicitly merge unsupported_requested_capabilities so they don't get shadowed
        const mergedUnsupported = [
          ...new Set([
            ...(artCs?.unsupported_requested_capabilities || []),
            ...(respCs?.unsupported_requested_capabilities || [])
          ])
        ];
        if (mergedUnsupported.length > 0) {
          cs.unsupported_requested_capabilities = mergedUnsupported;
        }

        // Slice 2.5: Prefer Plain-English Kickoff fields
        // Backend now sends decision_kickoff as an object
        const isKickoff = !!wp.decision_kickoff;

        // Phase 3: Check for additive correction_result in workspace_preview
        const hasCorrection = !!wp.correction_result;
        const cr_res = wp.correction_result;
        const cr_trace = wp.trace;



        const unresolvedMappings = wp.drafting?.prompt_matches?.unresolved_mappings || wp.unresolved_mappings || [];

        return (
          <div className={`${baseClass} is-workspace_preview`}>
            <div className="ai-shell__artifact-content">
              {isInspector && renderArtifactExportBar(artifact, lookupSessionState, lookupCapabilityState, lookupDecisionReadiness)}
              {/* Phase 3: Render Correction if present */}
              {hasCorrection && (
                <div className="ai-shell__correction-container" style={{ marginBottom: '32px', padding: '16px', background: 'rgba(0, 102, 255, 0.03)', borderRadius: '12px', border: '1px solid rgba(0, 102, 255, 0.1)' }}>
                  <header style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <Typography variant="overline" sx={{ fontWeight: 900, opacity: 0.5 }}>
                        Correction Applied
                      </Typography>
                      {cr_res?.readiness_state && (
                        <Chip
                          label={cr_res.readiness_state.replace('_', ' ')}
                          size="small"
                          sx={{
                            height: '18px',
                            fontSize: '0.65rem',
                            fontWeight: 900,
                            textTransform: 'uppercase',
                            bgcolor: cr_res.readiness_state === 'analysis_ready' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                            color: cr_res.readiness_state === 'analysis_ready' ? 'var(--accent-green)' : '#f59e0b',
                            border: '1px solid currentColor'
                          }}
                        />
                      )}
                    </div>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                      {cr_res?.summary || 'Workspace mapping updated'}
                    </Typography>
                  </header>

                  <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '8px', fontSize: '0.8rem', marginBottom: '16px' }}>
                    <Typography variant="caption" sx={{ fontWeight: 800, opacity: 0.5 }}>TARGET</Typography>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{cr_res?.target_path}</Typography>
                    <Typography variant="caption" sx={{ fontWeight: 800, opacity: 0.5 }}>PREVIOUS</Typography>
                    <Typography variant="caption" sx={{ opacity: 0.6 }}>{typeof cr_res?.previous_value === 'object' ? JSON.stringify(cr_res.previous_value) : String(cr_res?.previous_value || 'None')}</Typography>
                    <Typography variant="caption" sx={{ fontWeight: 800, opacity: 0.5, color: 'var(--accent-blue)' }}>NEW VALUE</Typography>
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>{typeof cr_res?.new_value === 'object' ? JSON.stringify(cr_res.new_value) : String(cr_res?.new_value)}</Typography>
                  </div>

                  {cr_trace && (
                    <div style={{ borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '12px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '8px' }}>
                        {cr_trace.semantic_confidence !== undefined && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Typography variant="caption" sx={{ fontWeight: 800, opacity: 0.4 }}>CONFIDENCE</Typography>
                            <Typography variant="caption" sx={{ fontWeight: 700 }}>{(cr_trace.semantic_confidence * 100).toFixed(0)}%</Typography>
                          </div>
                        )}
                        {cr_trace.source && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Typography variant="caption" sx={{ fontWeight: 800, opacity: 0.4 }}>SOURCE</Typography>
                            <Typography variant="caption" sx={{ fontWeight: 700 }}>{cr_trace.source.toUpperCase()}</Typography>
                          </div>
                        )}
                        {cr_trace.observational_boundary && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Typography variant="caption" sx={{ fontWeight: 800, opacity: 0.4 }}>BOUNDARY</Typography>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: 'var(--accent-blue)' }}>{cr_trace.observational_boundary.replace('_', ' ').toUpperCase()}</Typography>
                          </div>
                        )}
                      </div>

                      {cr_trace.warnings?.length > 0 && (
                        <div style={{ marginTop: '8px' }}>
                          {cr_trace.warnings.map((w, i) => (
                            <Typography key={i} variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f59e0b', fontWeight: 600, mb: 0.5 }}>
                              <FaExclamationTriangle size={10} /> {w}
                            </Typography>
                          ))}
                        </div>
                      )}

                      {cr_trace.timestamp && (
                        <Typography variant="caption" sx={{ display: 'block', mt: 1, opacity: 0.3, fontSize: '0.65rem', textAlign: 'right' }}>
                          Applied at {new Date(cr_trace.timestamp).toLocaleTimeString()}
                        </Typography>
                      )}
                    </div>
                  )}
                </div>
              )}

              {isKickoff ? (
                <div className="ai-shell__kickoff-container">
                  <header className="ai-shell__kickoff-header" style={{ marginBottom: '24px' }}>
                    <Typography variant="overline" sx={{ fontWeight: 900, opacity: 0.5, letterSpacing: '0.15em', display: 'block', mb: 1 }}>
                      Decision Kickoff
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                      {wp.title || 'Untitled Decision Framework'}
                    </Typography>
                  </header>

                  <div className="ai-shell__kickoff-summary" style={{ marginBottom: '28px' }}>
                    <Typography variant="body1" sx={{ lineHeight: 1.6, opacity: 0.9, fontSize: '1.05rem' }}>
                      {wp.decision_kickoff?.summary || wp.decision_kickoff}
                    </Typography>
                  </div>

                  <div className="ai-shell__kickoff-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                    <div className="ai-shell__kickoff-item">
                      <Typography variant="overline" sx={{ fontWeight: 900, opacity: 0.4, display: 'block', mb: 0.5 }}>Objective</Typography>
                      {wp.objective_metric ? (
                        <div style={{ paddingLeft: '12px', borderLeft: '2px solid var(--text-primary)' }}>
                          <SemanticRef
                            metric_ref={wp.objective_metric.metric_id ? wp.objective_metric : { label: typeof wp.objective_metric === 'string' ? wp.objective_metric : wp.objective_metric?.label || wp.objective_metric?.name || 'Not specified' }}
                            type="objective"
                            compact
                          />
                        </div>
                      ) : (
                        <Typography variant="body2" sx={{ fontWeight: 700, borderLeft: '2px solid var(--text-primary)', pl: 1.5, opacity: 0.5 }}>Not specified</Typography>
                      )}
                    </div>
                    <div className="ai-shell__kickoff-item">
                      <Typography variant="overline" sx={{ fontWeight: 900, opacity: 0.4, display: 'block', mb: 0.5 }}>Time Horizon</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, borderLeft: '2px solid var(--text-primary)', pl: 1.5 }}>{wp.time_horizon || 'Ongoing'}</Typography>
                    </div>
                    <div className="ai-shell__kickoff-item">
                      <Typography variant="overline" sx={{ fontWeight: 900, opacity: 0.4, display: 'block', mb: 0.5 }}>Primary Levers</Typography>
                      {renderSemanticList(wp.levers, 'lever')}
                    </div>
                    <div className="ai-shell__kickoff-item">
                      <Typography variant="overline" sx={{ fontWeight: 900, opacity: 0.4, display: 'block', mb: 0.5 }}>Segmentation</Typography>
                      {renderSemanticList(wp.segment_dimensions, 'segment')}
                    </div>
                    <div className="ai-shell__kickoff-item" style={{ gridColumn: '1 / -1' }}>
                      <Typography variant="overline" sx={{ fontWeight: 900, opacity: 0.4, display: 'block', mb: 0.5 }}>Guardrails</Typography>
                      {renderSemanticList(wp.guardrails, 'guardrail')}
                    </div>
                  </div>

                  {unresolvedMappings.length > 0 && (
                    <div className="ai-shell__unresolved-zone" style={{ marginBottom: '32px', padding: '16px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                      <Typography variant="overline" sx={{ fontWeight: 900, color: '#ef4444', display: 'block', mb: 1.5 }}>Unresolved Semantic Mappings</Typography>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {unresolvedMappings.map((m, i) => {
                          const mappingType = m.mapping_type || 'unresolved';
                          const coreTerm = m.label || m.name || m.term || m.field || 'unknown term';
                          const candidateSummary = m.candidate_labels?.length > 0 ? ` [${m.candidate_labels[0]}${m.candidate_labels.length > 1 ? '...' : ''}]` : '';
                          const reasonInfo = m.reason ? ` (${m.reason})` : '';

                          // Build high-fidelity label from type + term + metadata
                          const labelText = `${mappingType}: ${coreTerm}${candidateSummary}${reasonInfo}`;

                          const ref = {
                            label: labelText,
                            confidence: m.confidence,
                            reason: m.reason,
                            candidate_labels: m.candidate_labels
                          };
                          return (
                            <SemanticRef
                              key={i}
                              metric_ref={m.mapping_type === 'metric' ? ref : null}
                              dimension_ref={m.mapping_type === 'dimension' ? ref : null}
                              type="unresolved"
                              compact
                            />
                          );
                        })}
                      </div>
                      <Typography variant="caption" sx={{ display: 'block', mt: 1.5, opacity: 0.6 }}>
                        These terms were identified in your prompt but could not be confidently bound to the current semantic model.
                      </Typography>
                    </div>
                  )}

                  <Divider sx={{ mb: 3, opacity: 0.1 }} />

                  <div className="ai-shell__kickoff-footer">
                    <div className="ai-shell__kickoff-status-block" style={{ marginBottom: '24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                        <FaCheckCircle style={{ color: (dr?.readiness_state === 'analysis_ready' || wp.status === 'ready') ? 'var(--accent-green)' : 'var(--text-secondary)', fontSize: '1rem' }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.75rem' }}>
                          {dr?.readiness_state ? dr.readiness_state.replace('_', ' ') : (wp.status_label || (wp.status === 'ready' ? 'Framework Ready' : 'Incomplete'))}
                        </Typography>
                      </div>
                      <Typography variant="body2" sx={{ display: 'block', opacity: 0.7, lineHeight: 1.5 }}>
                        {wp.readiness_meaning || (dr?.readiness_state === 'analysis_ready' ? 'This framework is structurally complete and ready for observational analysis.' : 'Missing required inputs to begin analysis.')}
                      </Typography>
                    </div>

                    {dr?.truth_boundary === 'observational_analysis_only' && (
                      <div className="ai-shell__kickoff-boundary" style={{ marginBottom: '24px', padding: '12px', borderLeft: '3px solid var(--accent-blue)', background: 'rgba(0, 102, 255, 0.05)' }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5, color: 'var(--accent-blue)' }}>Reliability Boundary</Typography>
                        <Typography variant="body2" sx={{ opacity: 0.8 }}>
                          Currently limited to <strong>observational analysis</strong>. Causal simulation, optimization, and final recommendations are unsupported in the current runtime.
                        </Typography>
                      </div>
                    )}

                    {(wp.truthfulness_note || dr?.not_ready_for_recommendation) && (
                      <div className="ai-shell__kickoff-truth" style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', marginBottom: '28px', border: '1px solid var(--border-color)' }}>
                        <Typography variant="caption" sx={{ opacity: 0.6, display: 'block', lineHeight: 1.5 }}>
                          <FaInfoCircle style={{ marginRight: '8px', fontSize: '0.8rem', verticalAlign: 'middle', marginTop: '-2px' }} />
                          {wp.truthfulness_note || 'Outputs are for decision support only and should not be treated as final recommendations.'}
                        </Typography>
                      </div>
                    )}

                    {cs?.unsupported_requested_capabilities?.length > 0 && (
                      <div className="ai-shell__unsupported-requested" style={{ marginBottom: '24px', padding: '12px', borderRadius: '8px', border: '1px solid var(--accent-red)', background: 'rgba(239, 68, 68, 0.05)' }}>
                        <Typography variant="caption" sx={{ fontWeight: 900, color: 'var(--accent-red)', display: 'block', mb: 1, textTransform: 'uppercase' }}>
                          Unsupported Capabilities Detected
                        </Typography>
                        <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.8rem', opacity: 0.8 }}>
                          {cs.unsupported_requested_capabilities.map((cap, i) => (
                            <li key={i}><strong>{cap.replace('_', ' ')}</strong> was requested but is not yet supported.</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {wp.recommended_next_action && (() => {
                      const actionId = wp.recommended_next_action?.action_id || wp.recommended_next_action;
                      // Use the scoped lookupActions from renderArtifact scope
                      const fullAction = lookupActions.find(a => a.action_id === actionId) || wp.recommended_next_action;

                      const isPrimary = fullAction?.priority === 'primary';
                      const isEnabled = dr?.allowed_next_actions ? dr.allowed_next_actions.includes(actionId) : fullAction?.enabled !== false;
                      const blockerInfo = dr?.blocked_state?.is_blocked ? dr.blocked_state.blocking_missing_inputs?.join(', ') : null;
                      const tooltip = blockerInfo ? `Blocked by: ${blockerInfo}` : (fullAction?.availability_reason || fullAction?.description || fullAction?.reason || '');

                      return (
                        <div className="ai-shell__kickoff-action-zone">
                          <Typography variant="overline" sx={{ fontWeight: 900, opacity: 0.5, display: 'block', mb: 1.5 }}>Recommended Next Step</Typography>
                          <Tooltip title={tooltip} arrow>
                            <span>
                              <Button
                                variant="contained"
                                fullWidth
                                disabled={loading || !isEnabled}
                                startIcon={<FaSearch />}
                                sx={{
                                  borderRadius: '12px',
                                  py: 1.5,
                                  textTransform: 'none',
                                  fontWeight: 900,
                                  fontSize: '0.9rem',
                                  bgcolor: isPrimary ? 'var(--text-primary)' : 'var(--bg-secondary)',
                                  color: isPrimary ? 'var(--bg-primary)' : 'var(--text-primary)',
                                  '&:hover': {
                                    bgcolor: isPrimary ? 'var(--text-primary)' : 'var(--bg-tertiary)',
                                    filter: 'brightness(1.1)'
                                  },
                                  '&:disabled': {
                                    opacity: 0.5,
                                    bgcolor: 'var(--bg-secondary)',
                                    color: 'var(--text-secondary)'
                                  }
                                }}
                                onClick={() => handleActionClick(actionId === 'Analyze workspace' ? 'analyze_workspace' : actionId, lookupSessionState)}
                              >
                                {fullAction?.label || wp.recommended_next_action?.label || wp.recommended_next_action}
                              </Button>
                            </span>
                          </Tooltip>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                // Compatibility Fallback for older sparse previews
                <>
                  <Typography variant="h6" sx={{ fontWeight: 900, mb: 1 }}>{wp.title || 'Decision Path'}</Typography>
                  <Typography variant="body1" sx={{ opacity: 0.7, mb: 4 }}>{wp.scope_summary}</Typography>
                  <div className="ai-shell__preview-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '20px' }}>
                    <div className="ai-shell__preview-metric"><span className="ai-shell__preview-metric-label">Status</span><span className="ai-shell__preview-metric-value">{wp.status || 'Draft'}</span></div>
                    <div className="ai-shell__preview-metric"><span className="ai-shell__preview-metric-label">Levers</span><span className="ai-shell__preview-metric-value">{wp.lever_count || 0}</span></div>
                    <div className="ai-shell__preview-metric"><span className="ai-shell__preview-metric-label">Inputs Needed</span><span className="ai-shell__preview-metric-value" style={{ color: (wp.missing_inputs?.length > 0 ? 'var(--accent-red)' : 'inherit') }}>{wp.missing_inputs?.length || 0}</span></div>
                  </div>
                </>
              )}

              {wp.missing_inputs?.length > 0 && (
                <div className="ai-shell__kickoff-clarifications" style={{ marginTop: '32px' }}>
                  <Typography variant="overline" sx={{ fontWeight: 900, opacity: 0.5, display: 'block', mb: 2 }}>Required Clarifications</Typography>
                  <div className="ai-shell__analysis-list">
                    {wp.missing_inputs.map((input, i) => (
                      <div key={i} className="ai-shell__analysis-item" style={{ marginBottom: '12px' }}>
                         <span className="ai-shell__analysis-icon is-blocker"><FaExclamationTriangle /></span>
                         <Typography variant="body2" sx={{ fontWeight: 600 }}>{input}</Typography>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 'workspace_analysis_summary':
        const hasItems = content?.items && content.items.length > 0;
        const rankedDiagnostics = content?.ranked_diagnostics || [];
        const obsBoundary = content?.observational_boundary || content?.workspace_analysis?.observational_boundary;

        return (
          <div className={`${baseClass} is-workspace_analysis_summary`}>
            <div className="ai-shell__artifact-content">
              {isInspector && renderArtifactExportBar(artifact, lookupSessionState, lookupCapabilityState, lookupDecisionReadiness)}

              {rankedDiagnostics.length > 0 ? (
                <div className="ai-shell__ranked-diagnostics" style={{ marginBottom: '32px' }}>
                  <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <Typography variant="overline" sx={{ fontWeight: 900, opacity: 0.5 }}>Ranked Observational Evidence</Typography>
                    {obsBoundary && (
                      <span style={{ fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', padding: '2px 8px', borderRadius: '4px', background: 'rgba(0, 102, 255, 0.05)', color: 'var(--accent-blue)', border: '1px solid var(--accent-blue)' }}>
                        Observational Only
                      </span>
                    )}
                  </header>
                  <div className="ai-shell__analysis-list">
                    {rankedDiagnostics.map((rd, i) => (
                      <div key={i} className="ai-shell__analysis-item" style={{ marginBottom: '20px', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--text-primary)', color: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 900 }}>
                              {rd.evidence_rank || (i + 1)}
                            </span>
                            <Typography variant="body2" sx={{ fontWeight: 800 }}>
                              {rd.source_diagnostic?.headline || rd.source_diagnostic?.title || 'Observational Diagnostic'}
                            </Typography>
                          </div>
                          <div className={`ai-shell__strength-badge is-${rd.evidence_strength}`} style={{ fontSize: '0.7rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', border: '1px solid currentColor', opacity: 0.8 }}>
                            {rd.evidence_strength?.toUpperCase()}
                          </div>
                        </div>

                        <Typography variant="caption" sx={{ display: 'block', mb: 1.5, opacity: 0.8, lineHeight: 1.4 }}>
                          {rd.source_diagnostic?.summary || rd.source_diagnostic?.description}
                        </Typography>

                        <div className="ai-shell__rd-meta" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '12px' }}>
                          {rd.relevance_score !== undefined && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Typography variant="caption" sx={{ fontWeight: 800, opacity: 0.4 }}>RELEVANCE</Typography>
                              <Typography variant="caption" sx={{ fontWeight: 700 }}>{(rd.relevance_score * 100).toFixed(0)}%</Typography>
                            </div>
                          )}
                          {rd.data_sufficiency?.status && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Typography variant="caption" sx={{ fontWeight: 800, opacity: 0.4 }}>DATA</Typography>
                              <Typography variant="caption" sx={{ fontWeight: 700, color: rd.data_sufficiency.status === 'sufficient' ? 'var(--accent-green)' : '#f59e0b' }}>
                                {rd.data_sufficiency.status.toUpperCase()}
                              </Typography>
                            </div>
                          )}
                        </div>

                        {rd.limitations?.length > 0 && (
                          <div style={{ marginTop: '12px', padding: '8px', background: 'rgba(0,0,0,0.03)', borderRadius: '6px' }}>
                            <Typography variant="caption" sx={{ fontStyle: 'italic', opacity: 0.6 }}>
                              Limitations: {rd.limitations.join(' • ')}
                            </Typography>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : hasItems ? (
                <div className="ai-shell__analysis-list">
                  <Typography variant="overline" sx={{ fontWeight: 900, mb: 2, display: 'block', opacity: 0.5 }}>Diagnostic Breakdown {artMode ? `• ${artMode.toUpperCase()}` : ''}</Typography>
                  {content.items.map((item, i) => {
                    const isObj = typeof item === 'object' && item !== null;
                    // Primary text: Prefer label, then statement, then headline, then title
                    const statement = isObj ? (item.label || item.statement || item.headline || item.title) : item;

                    // Secondary text: Prefer description, then summary, then reason, then category
                    const description = isObj ? (item.description || item.summary || item.reason || (item.category ? `Category: ${item.category}` : null)) : null;

                    // Severity/Blocker logic: check blocks_simulation, is_blocker, or high/critical severity
                    const isBlocker = isObj ? !!(item.blocks_simulation || item.is_blocker || item.severity === 'high' || item.severity === 'critical') : false;

                    return (
                      <div key={i} className="ai-shell__analysis-item" style={{ marginBottom: '16px' }}>
                        <span className={`ai-shell__analysis-icon ${isBlocker ? 'is-blocker' : 'is-assumption'}`}>
                          {isBlocker ? <FaExclamationTriangle /> : <FaCheckCircle />}
                        </span>
                        <div className="ai-shell__analysis-text">
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>{statement}</Typography>
                          {description && <Typography variant="caption" sx={{ opacity: 0.6 }}>{description}</Typography>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="ai-shell__analysis-empty">
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>{content?.summary?.headline || content?.headline || 'Analysis finalized.'}</Typography>
                  {content?.summary?.content && <Typography variant="body2" sx={{ opacity: 0.7 }}>{content.summary.content}</Typography>}
                  {!content?.summary?.headline && !content?.headline && (
                    <Typography variant="caption" sx={{ opacity: 0.5, fontStyle: 'italic' }}>No diagnostic details identified for this state.</Typography>
                  )}
                </div>
              )}

              {content?.missing_inputs?.length > 0 && (
                <div className="ai-shell__kickoff-clarifications" style={{ marginTop: '24px' }}>
                  <Typography variant="overline" sx={{ fontWeight: 900, opacity: 0.5, display: 'block', mb: 2 }}>Required Clarifications</Typography>
                  <div className="ai-shell__analysis-list">
                    {content.missing_inputs.map((input, i) => (
                      <div key={i} className="ai-shell__analysis-item" style={{ marginBottom: '12px' }}>
                         <span className="ai-shell__analysis-icon is-blocker"><FaExclamationTriangle /></span>
                         <Typography variant="body2" sx={{ fontWeight: 600 }}>{input}</Typography>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {content?.truthfulness_note && (
                <div className="ai-shell__kickoff-truth" style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', marginTop: '24px', border: '1px solid var(--border-color)' }}>
                  <Typography variant="caption" sx={{ opacity: 0.6, display: 'block', lineHeight: 1.5 }}>
                    <FaInfoCircle style={{ marginRight: '8px', fontSize: '0.8rem', verticalAlign: 'middle', marginTop: '-2px' }} />
                    {content.truthfulness_note}
                  </Typography>
                </div>
              )}
            </div>
          </div>
        );

      case 'decision_output': {
        const doTitle = artifact.title || artifact.content?.title || 'Decision Framework';
        const doSummary = artifact.summary || artifact.content?.summary || '';
        const doDt = artifact.dataset_trust || artifact.content?.dataset_trust;
        const doFrame = artifact.frame || artifact.content?.frame;
        const doReadiness = artifact.readiness || artifact.content?.readiness || lookupDecisionReadiness;
        const doCorrection = artifact.correction_state || artifact.content?.correction_state;
        const doEvidence = artifact.evidence_board || artifact.content?.evidence_board;
        const doMap = artifact.decision_map || artifact.content?.decision_map;
        const doScenario = artifact.scenario_compare || artifact.content?.scenario_compare;
        const doGates = artifact.advanced_gates || artifact.content?.advanced_gates || [];
        const doTruthBoundary = artifact.truth_boundary || artifact.content?.truth_boundary || 'observational_analysis_only';

        return (
          <div className={`${baseClass} is-decision-output`}>
            <div className="ai-shell__artifact-content" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              {isInspector && renderArtifactExportBar(artifact, lookupSessionState, lookupCapabilityState, lookupDecisionReadiness)}

              {/* 1. EXECUTIVE BRIEF */}
              <div className="ai-shell__do-brief">
                <Typography variant="h4" className="ai-shell__do-title">{doTitle}</Typography>
                {doSummary && (
                  <Typography variant="body1" className="ai-shell__do-summary">
                    {doSummary}
                  </Typography>
                )}
              </div>

              {/* 2. DATASET TRUST (Compact Strip) */}
              {doDt && (
                <div className="ai-shell__do-trust-strip">
                  <div className="ai-shell__do-trust-main">
                    <FaDatabase className="ai-shell__do-trust-icon" />
                    <Typography variant="caption" sx={{ fontWeight: 800 }}>
                      {doDt.source_label || 'Grounded'}: {doDt.dataset?.dataset_name || 'Active dataset'}
                    </Typography>
                    {doDt.semantic_ready ? (
                      <span className="ai-shell__do-trust-badge is-good">Semantic Ready</span>
                    ) : (
                      <span className="ai-shell__do-trust-badge is-warn">No Semantic Model</span>
                    )}
                  </div>
                  <Tooltip title={`Rows: ${doDt.row_count?.toLocaleString() || 0} • Cols: ${doDt.column_count?.toLocaleString() || 0} • Transforms: ${doDt.transform_state || 'unknown'} • Freshness: ${doDt.stale_state?.replace('_', ' ') || 'unknown'}`} arrow>
                    <span className="ai-shell__do-trust-details">Health Metrics <FaInfoCircle /></span>
                  </Tooltip>
                  {doDt.warnings && doDt.warnings.length > 0 && (
                    <div className="ai-shell__do-trust-warnings">
                      {doDt.warnings.map((w, idx) => (
                        <Tooltip key={idx} title={w} arrow>
                          <span className="ai-shell__do-trust-warning-icon"><FaExclamationTriangle /></span>
                        </Tooltip>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 3. DECISION FRAME */}
              {doFrame && (
                <div className="ai-shell__do-frame">
                  <Typography variant="overline" className="ai-shell__do-section-lbl">Decision Frame</Typography>
                  <div className="ai-shell__do-frame-grid">
                    <div className="ai-shell__do-frame-col">
                      <Typography variant="caption" className="ai-shell__do-frame-col-lbl">Target & Drivers</Typography>
                      <div className="ai-shell__do-frame-list">
                        <div className="ai-shell__do-frame-row">
                          <span className="ai-shell__do-frame-role">Goal</span>
                          {doFrame.goal ? (
                            <SemanticRef metric_ref={doFrame.goal.metric_ref || doFrame.goal.metric_id ? doFrame.goal : { label: doFrame.goal.label || 'Not specified' }} type="objective" compact />
                          ) : <span className="ai-shell__do-frame-empty">Not specified</span>}
                        </div>
                        <div className="ai-shell__do-frame-row">
                          <span className="ai-shell__do-frame-role">Levers</span>
                          <span className="ai-shell__do-frame-vals">{renderSemanticList(doFrame.drivers, 'lever')}</span>
                        </div>
                      </div>
                    </div>
                    <div className="ai-shell__do-frame-col">
                      <Typography variant="caption" className="ai-shell__do-frame-col-lbl">Constraints & Breakdowns</Typography>
                      <div className="ai-shell__do-frame-list">
                        <div className="ai-shell__do-frame-row">
                          <span className="ai-shell__do-frame-role">Limits</span>
                          <span className="ai-shell__do-frame-vals">{renderSemanticList(doFrame.limits, 'guardrail')}</span>
                        </div>
                        <div className="ai-shell__do-frame-row">
                          <span className="ai-shell__do-frame-role">Segments</span>
                          <span className="ai-shell__do-frame-vals">{renderSemanticList(doFrame.breakdowns, 'segment')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {(doFrame.assumptions?.length > 0 || doFrame.unknowns?.length > 0) && (
                    <details className="ai-shell__do-frame-details">
                      <summary>Assumptions & Unknowns ({((doFrame.assumptions?.length || 0) + (doFrame.unknowns?.length || 0))})</summary>
                      <div className="ai-shell__do-frame-details-body">
                        {doFrame.assumptions?.map((item, idx) => <div key={`a-${idx}`} className="ai-shell__do-detail-item">• {typeof item === 'object' ? item.statement || item.label : item}</div>)}
                        {doFrame.unknowns?.map((item, idx) => <div key={`u-${idx}`} className="ai-shell__do-detail-item is-warn">• {typeof item === 'object' ? item.statement || item.label : item}</div>)}
                      </div>
                    </details>
                  )}
                </div>
              )}

              {/* 4. READINESS & ACTIONS (AND CORRECTION STATE) */}
              <div className="ai-shell__do-action-bar">
                {doCorrection && (doCorrection.status === 'updated' || doCorrection.status === 'success') && (
                  <div className="ai-shell__do-correction-toast">
                    <FaTools className="ai-shell__do-correction-icon" />
                    <span>{doCorrection.latest?.summary || doCorrection.summary || 'Correction applied'}</span>
                    {doCorrection.latest && (
                      <Tooltip title={`Target: ${doCorrection.latest.target_path} | Prev: ${typeof doCorrection.latest.previous_value === 'object' ? JSON.stringify(doCorrection.latest.previous_value) : String(doCorrection.latest.previous_value ?? 'None')} | New: ${typeof doCorrection.latest.new_value === 'object' ? JSON.stringify(doCorrection.latest.new_value) : String(doCorrection.latest.new_value ?? '—')}`} arrow>
                        <span className="ai-shell__do-correction-diff">Details</span>
                      </Tooltip>
                    )}
                  </div>
                )}

                {doReadiness && (
                  <div className="ai-shell__do-readiness">
                    <div className="ai-shell__do-readiness-status">
                      <FaCheckCircle className={`ai-shell__do-readiness-icon ${doReadiness.readiness_state === 'analysis_ready' ? 'is-ready' : 'is-standby'}`} />
                      <div>
                        <Typography variant="subtitle2" sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {doReadiness.readiness_state ? doReadiness.readiness_state.replace('_', ' ') : 'Incomplete Frame'}
                        </Typography>
                      </div>
                    </div>
                    {doReadiness.blocked_state?.is_blocked && doReadiness.blocked_state.blocking_missing_inputs?.length > 0 && (
                      <div className="ai-shell__do-readiness-blockers">
                        <span className="ai-shell__do-readiness-blocker-lbl">Missing Inputs:</span>
                        {doReadiness.blocked_state.blocking_missing_inputs.join(', ')}
                      </div>
                    )}
                    <div className="ai-shell__do-readiness-actions">
                      {doReadiness.allowed_next_actions?.map((actId, idx) => {
                        const actDetails = lookupActions.find(a => a.action_id === actId) || { label: actId.replace('_', ' '), enabled: true };
                        const isPrimary = actDetails.priority === 'primary' || actId === 'analyze_workspace';
                        const isEnabled = doReadiness.allowed_next_actions.includes(actId) && actDetails.enabled !== false;
                        return (
                          <Button
                            key={idx}
                            variant={isPrimary ? "contained" : "outlined"}
                            disabled={loading || !isEnabled}
                            startIcon={actId === 'analyze_workspace' ? <FaSearch /> : <FaTools />}
                            size="small"
                            sx={{
                              borderRadius: '8px',
                              textTransform: 'none',
                              fontWeight: 800,
                              bgcolor: isPrimary ? 'var(--text-primary)' : 'transparent',
                              color: isPrimary ? 'var(--bg-primary)' : 'var(--text-primary)',
                              borderColor: 'var(--text-primary)',
                              '&:hover': {
                                bgcolor: isPrimary ? 'var(--text-primary)' : 'var(--bg-secondary)',
                                filter: isPrimary ? 'brightness(1.1)' : 'none'
                              }
                            }}
                            onClick={() => handleActionClick(actId, lookupSessionState)}
                          >
                            {actDetails.label || actId.replace('_', ' ')}
                          </Button>
                        );
                      })}
                      <Button
                        variant="contained"
                        disabled={loading}
                        startIcon={<FaLayerGroup />}
                        size="small"
                        sx={{
                          borderRadius: '8px',
                          textTransform: 'none',
                          fontWeight: 800,
                          bgcolor: 'var(--accent-blue)',
                          color: '#fff',
                          '&:hover': {
                            bgcolor: 'var(--accent-blue)',
                            filter: 'brightness(1.1)'
                          }
                        }}
                        onClick={() => handleActionClick('open_workspace', lookupSessionState)}
                      >
                        Launch Decision Graph
                      </Button>
                    </div>
                  </div>
                )}

                {/* Inline Correction Panel (Phase 5) */}
                {isInspector && (
                  <div className="ai-shell__correction-panel-zone" style={{ marginTop: '12px' }}>
                    {!correctionPanelOpen ? (
                      <button id="ai-shell-correction-trigger-btn" className="ai-shell__correction-trigger-btn" onClick={() => setCorrectionPanelOpen(true)} disabled={loading}>
                        <FaTools style={{ fontSize: '0.75rem' }} /> Adjust Frame
                      </button>
                    ) : (
                      <div id="ai-shell-correction-panel" className="ai-shell__correction-form-panel">
                        <div className="ai-shell__correction-form-header">
                          <Typography variant="overline" sx={{ fontWeight: 900, opacity: 0.5 }}>Apply Correction</Typography>
                          <button className="ai-shell__correction-form-close" onClick={() => { setCorrectionPanelOpen(false); setCorrectionReplacement(''); setCorrectionReason(''); }}>✕</button>
                        </div>
                        <div className="ai-shell__correction-form-row">
                          <label className="ai-shell__correction-form-label">Type</label>
                          <select className="ai-shell__correction-form-select" value={correctionType} onChange={(e) => {
                              const selected = e.target.value;
                              setCorrectionType(selected);
                              const pathMap = { time_horizon: 'decision_scope.objective.time_horizon', objective_direction: 'decision_scope.objective.direction', objective_metric: 'decision_scope.objective.metric_ref', lever_controllability: 'decision_scope.levers[0].controllable' };
                              setCorrectionTargetPath(pathMap[selected] || `decision_scope.${selected}`);
                              if (selected === 'objective_direction') setCorrectionReplacement('maximize');
                              else if (selected === 'lever_controllability') setCorrectionReplacement('true');
                              else setCorrectionReplacement('');
                            }}>
                            <option value="time_horizon">Time Horizon</option>
                            <option value="objective_direction">Objective Direction</option>
                            <option value="objective_metric">Objective Metric</option>
                            <option value="lever_controllability">Lever Controllability</option>
                          </select>
                        </div>
                        <div className="ai-shell__correction-form-row">
                          <label className="ai-shell__correction-form-label">New Value</label>
                          {correctionType === 'objective_direction' ? (
                            <select className="ai-shell__correction-form-select" value={correctionReplacement || 'maximize'} onChange={(e) => setCorrectionReplacement(e.target.value)} disabled={loading}>
                              <option value="maximize">maximize</option><option value="minimize">minimize</option><option value="maintain">maintain</option><option value="achieve_target">achieve_target</option>
                            </select>
                          ) : correctionType === 'lever_controllability' ? (
                            <select className="ai-shell__correction-form-select" value={correctionReplacement || 'true'} onChange={(e) => setCorrectionReplacement(e.target.value)} disabled={loading}>
                              <option value="true">Controllable</option><option value="false">Outcome (false)</option>
                            </select>
                          ) : (
                            <input className="ai-shell__correction-form-input" type="text" value={correctionReplacement} onChange={(e) => setCorrectionReplacement(e.target.value)} disabled={loading} />
                          )}
                        </div>
                        <div className="ai-shell__correction-form-row">
                          <label className="ai-shell__correction-form-label">Reason (optional)</label>
                          <input className="ai-shell__correction-form-input" type="text" value={correctionReason} onChange={(e) => setCorrectionReason(e.target.value)} disabled={loading} />
                        </div>
                        <button className="ai-shell__correction-submit-btn" disabled={loading || !String(correctionReplacement).trim()} onClick={() => handleCorrectionSubmit({ correction_type: correctionType, target_path: correctionTargetPath, replacement: typeof correctionReplacement === 'string' ? correctionReplacement.trim() : correctionReplacement, reason: correctionReason.trim() || null }, lookupSessionState)}>
                          {loading ? 'Applying…' : 'Submit'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 5. EVIDENCE BOARD */}
              {doEvidence && (
                <div className="ai-shell__do-evidence">
                  <Typography variant="overline" className="ai-shell__do-section-lbl">Evidence Board</Typography>
                  {doEvidence.status === 'analyzed' && doEvidence.items && doEvidence.items.length > 0 ? (
                    <div className="ai-shell__do-evidence-grid">
                      {doEvidence.items.map((rd, i) => (
                        <div key={i} className="ai-shell__do-evidence-card">
                          <div className="ai-shell__do-evidence-body">
                            <div className="ai-shell__do-evidence-header">
                              <div className="ai-shell__do-evidence-title-row">
                                <span className="ai-shell__do-evidence-rank">{rd.rank || (i + 1)}</span>
                                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{rd.title || 'Observational Insight'}</Typography>
                              </div>
                              <div className="ai-shell__do-evidence-actions">
                                <span className={`ai-shell__do-evidence-strength is-${rd.strength || 'moderate'}`}>
                                  {rd.strength?.toUpperCase() || 'MODERATE'}
                                </span>
                                {rd.source_diagnostic_id && (
                                  <Tooltip title={`Source ID: ${rd.source_diagnostic_id}`} arrow>
                                    <span className="ai-shell__do-evidence-source"><FaInfoCircle /></span>
                                  </Tooltip>
                                )}
                              </div>
                            </div>
                            <Typography variant="body2" className="ai-shell__do-evidence-summary">
                              {rd.summary}
                            </Typography>
                          </div>

                          <div className="ai-shell__do-evidence-footer">
                            {rd.covers && (
                              <div className="ai-shell__do-evidence-meta">
                                <strong>Coverage:</strong> {[
                                  rd.covers.goal && 'Goal',
                                  ...(rd.covers.drivers?.map(d => d.label || d.name) || []),
                                  ...(rd.covers.limits?.map(l => l.label || l.name) || []),
                                  ...(rd.covers.breakdowns?.map(b => b.label || b.name) || [])
                                ].filter(Boolean).join(', ') || 'General'}
                              </div>
                            )}

                            <div className="ai-shell__do-evidence-health">
                              {rd.data_sufficiency && (
                                <span className={`ai-shell__do-evidence-sufficiency is-${rd.data_sufficiency.status}`}>
                                  <FaCircle size={6} /> {rd.data_sufficiency.status === 'sufficient' ? 'Data Sufficient' : 'Data Limited'}
                                </span>
                              )}
                              {rd.limitations && rd.limitations.length > 0 && (
                                <Tooltip title={rd.limitations.join(' • ')} arrow>
                                  <span className="ai-shell__do-evidence-caveats"><FaExclamationTriangle size={10} /> {rd.limitations.length} Caveats</span>
                                </Tooltip>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Typography variant="body2" sx={{ opacity: 0.6, fontStyle: 'italic', mt: 1 }}>
                      {doEvidence.summary || 'Run observational analysis to ground decision drivers.'}
                    </Typography>
                  )}
                </div>
              )}

              {/* 6. SECONDARY SECTIONS (Map, Compare, Gates) */}
              <div className="ai-shell__do-secondary">
                {/* DECISION MAP */}
                {doMap && doMap.nodes && doMap.nodes.length > 0 && (
                  <details className="ai-shell__do-secondary-details">
                    <summary>Decision Map</summary>
                    <div className="ai-shell__do-map-wrap">
                      <div className="ai-shell__do-map-nodes">
                        {doMap.nodes.map((node, i) => (
                          <div key={i} className={`ai-shell__do-map-node is-${node.node_type || 'unknown'}`}>
                            <span className="ai-shell__do-map-node-lbl">{node.label}</span>
                            <span className="ai-shell__do-map-node-type">{node.node_type}</span>
                          </div>
                        ))}
                      </div>
                      {doMap.edges && doMap.edges.length > 0 && (
                        <div className="ai-shell__do-map-edges">
                          {doMap.edges.map((edge, i) => {
                            const srcNode = doMap.nodes.find(n => n.node_id === edge.source_node_id);
                            const tgtNode = doMap.nodes.find(n => n.node_id === edge.target_node_id);
                            return (
                              <div key={i} className="ai-shell__do-map-edge">
                                {srcNode?.label || edge.source_node_id} ‹ {edge.relationship_type?.replace('_', ' ')} › {tgtNode?.label || edge.target_node_id}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </details>
                )}

                {/* SCENARIO COMPARE */}
                {doScenario && (
                  <details className="ai-shell__do-secondary-details">
                    <summary>Scenario Compare</summary>
                    <div className="ai-shell__do-scenario-wrap">
                      {doScenario.status === 'ready' ? (
                        <ScenarioPreview preview={doScenario} />
                      ) : (
                        <span className="ai-shell__do-scenario-locked">
                          <FaShieldAlt /> {doScenario.summary || 'Requires complete frame and active evidence.'}
                        </span>
                      )}
                    </div>
                  </details>
                )}

                {/* ADVANCED GATES */}
                {doGates && doGates.length > 0 && (
                  <details className="ai-shell__do-secondary-details">
                    <summary>Advanced Capabilities</summary>
                    <div className="ai-shell__do-gates-wrap">
                      {doGates.map((gate, i) => (
                        <div key={i} className="ai-shell__do-gate-card">
                          <span className="ai-shell__do-gate-title">{gate.capability?.replace('_', ' ') || 'capability'}</span>
                          <span className="ai-shell__do-gate-reason">{gate.reason || 'Unsupported'}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>

              {/* 7. RELIABILITY BOUNDARY */}
              <div className="ai-shell__do-reliability-boundary">
                <FaInfoCircle />
                <span>
                  <strong>Observational Boundary:</strong> {doTruthBoundary.replace('_', ' ')}. No causal forecast claims supported.
                </span>
              </div>
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  const handleMentionSelect = (datasetName) => {
    let startIdx = mentionStartIndex;
    if (startIdx === -1) startIdx = userInput.lastIndexOf('@');
    const before = userInput.substring(0, startIdx);
    const afterStart = userInput.substring(startIdx + 1);
    const spaceIndex = afterStart.search(/\s/);
    const endIdx = spaceIndex === -1 ? userInput.length : (startIdx + 1 + spaceIndex);
    const after = userInput.substring(endIdx);
    setUserInput(`${before}@${datasetName} ${after}`);
    setIsMentionOpen(false);
    setMentionStartIndex(-1);
    if (inputRef.current) inputRef.current.focus();
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    const pos = e.target.selectionStart;
    setUserInput(val);
    const token = detectToken(val, pos);
    if (token !== null) {
      setMentionQuery(token);
      setIsMentionOpen(true);
      const before = val.substring(0, pos);
      setMentionStartIndex(before.lastIndexOf('@'));
      setMentionPosition({ top: -180, left: 15 });
    } else {
      setIsMentionOpen(false);
      setMentionStartIndex(-1);
    }
  };

  const handleSendMessage = async () => {
    if (!userInput.trim()) return;

    const tokens = extractTokens(userInput);
    const resolvedDatasets = datasets.filter(ds => tokens.includes(ds.name));

    setLoading(true);
    setError(null);
    setActiveArtifact(null); // Clear stale inspector state immediately

    const dsContext = resolveDatasetForNlp();
    const msg = userInput;
    setUserInput('');

    setUserMessages(prev => [...prev, { role: "user", content: msg, grounded: resolvedDatasets.length > 0 }]);

    // --- Commands Routing ---
    if (AICommands.isCommand(msg)) {
      const parts = msg.split(" ");
      const cmd = parts[0];
      const inst = parts.length > 1 ? parts.slice(1).join(" ") : null;

      if (cmd === "/clean") {
        try {
          const resp = await axios.post(`${API_URL}/ai_cmd`, { command: "/clean", dataset: dsContext, instructions: inst });
          let reply;
          if (resp.data.cleaned_data) {
            setCleanedData(resp.data.cleaned_data);
            await refreshSemanticModelFromDataset(resp.data.cleaned_data, { source: 'ai_shell_clean', preserveUserMetrics: true });
            reply = "Context optimized. Semantic model refreshed.";
            setAwaitingCleanInstructions(false);
          } else if (resp.data.suggestions) {
            reply = resp.data.suggestions;
            setAwaitingCleanInstructions(true);
          } else {
            reply = "Context stabilized.";
            setAwaitingCleanInstructions(false);
          }
          setUserMessages(prev => [...prev, { role: "assistant", content: reply }]);
        } catch (err) {
          setError("Command processor failed.");
        } finally {
          setLoading(false);
        }
        return;
      }
    } else if (awaitingCleanInstructions) {
      try {
        const resp = await axios.post(`${API_URL}/ai_cmd`, { command: "/clean", dataset: dsContext, instructions: msg });
        let reply;
        if (resp.data.cleaned_data) {
          setCleanedData(resp.data.cleaned_data);
          await refreshSemanticModelFromDataset(resp.data.cleaned_data, { source: 'ai_shell_clean_followup', preserveUserMetrics: true });
          reply = "Instructions applied. Environment ready.";
          setAwaitingCleanInstructions(false);
        } else {
          reply = resp.data.suggestions || "Clarification required for analysis.";
        }
        setUserMessages(prev => [...prev, { role: "assistant", content: reply }]);
      } catch (err) {
        setError("Context update failed.");
        setAwaitingCleanInstructions(false);
      } finally {
        setLoading(false);
      }
      return;
    }

    // --- Phase 4 Decision Chat Path (Primary for analytics & decisions) ---
    const payload = {
      user_message: msg,
      dataset: dsContext,
      semantic_model: semanticModel,
      conversation_history: userMessages.map(m => ({ role: m.role, content: m.content })).slice(-10),
      session_state: { ...sessionState, active_mode: activeMode },
      resolved_datasets: resolvedDatasets.map(ds => ds.name)
    };

    try {
      const response = await axios.post(`${API_URL}/api/decision/chat/turns`, payload);
      const data = response.data;

      if (data.status === 'success') {
        const newMsg = {
          role: "assistant",
          content: data.assistant_message,
          artifacts: data.artifacts,
          suggested_actions: data.suggested_actions || [],
          mode: data.mode,
          session_state: data.session_state || {}, // Scoped state
          capability_state: data.capability_state,
          decision_readiness: data.decision_readiness
        };
        setUserMessages(prev => [...prev, newMsg]);
        setSessionState(data.session_state || {});
        if (data.mode) setActiveMode(data.mode);

        if (data.artifacts && data.artifacts.length > 0) {
          const lastArt = data.artifacts[data.artifacts.length - 1];
          // Only auto-focus if it's a rich, inspectable artifact
          const richTypes = ['chart', 'workspace_preview', 'workspace_analysis_summary', 'decision_output'];
          if (richTypes.includes(lastArt.type)) {
            setActiveArtifact({
              ...lastArt,
              contextActions: newMsg.suggested_actions,
              contextSessionState: newMsg.session_state,
              contextCapabilityState: newMsg.capability_state,
              contextDecisionReadiness: newMsg.decision_readiness
            });
            setIsResultsPaneOpen(true);
          }
        }
      } else {
        setError(data.error?.message || "Intelligence engine unavailable.");
      }
    } catch (err) {
      setError("⚠ Connectivity error. Verify backend service status.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (!isMentionOpen) return;
    const filtered = datasets.filter((ds) => ds.name.toLowerCase().includes(mentionQuery?.toLowerCase() || ""));
    if (filtered.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedIndex(prev => (prev < filtered.length - 1 ? prev + 1 : prev)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightedIndex(prev => (prev > 0 ? prev - 1 : prev)); }
    else if (e.key === 'Enter') { e.preventDefault(); handleMentionSelect(filtered[highlightedIndex].name); setHighlightedIndex(0); }
    else if (e.key === 'Escape') setIsMentionOpen(false);
  };

  return (
    <div className="ai-shell">
      {/* 1. Side Command Rail */}
      <aside className="ai-shell__rail">
        <div className="ai-shell__rail-top">
          {MODES.map(m => (
            <Tooltip key={m.id} title={m.label} placement="right">
              <button
                className={`ai-shell__rail-item ${activeMode === m.id ? 'is-active' : ''}`}
                onClick={() => handleModeChange(null, m.id)}
                aria-label={m.label}
              >
                {m.id === 'ask' ? <FaRegCommentDots /> : m.id === 'explore' ? <FaChartBar /> : <FaLightbulb />}
              </button>
            </Tooltip>
          ))}
        </div>
        <div className="ai-shell__rail-middle">
          <div className="ai-shell__rail-divider" />
          <Tooltip title="Skills" placement="right">
            <button className="ai-shell__rail-item is-disabled" aria-label="Skills">
              <FaTools /><span className="ai-shell__dot-alert" />
            </button>
          </Tooltip>
          <Tooltip title="Library" placement="right">
            <button className="ai-shell__rail-item" onClick={() => {/* Placeholder for Library */}} aria-label="Library">
              <FaHistory />
            </button>
          </Tooltip>
          <Tooltip title="Context & Metadata" placement="right">
            <button
              className={`ai-shell__rail-item ${isContextPaneOpen ? 'is-active' : ''}`}
              onClick={() => setIsContextPaneOpen(true)}
              aria-label="Context & Metadata"
            >
              <FaLayerGroup />
            </button>
          </Tooltip>
        </div>
      </aside>

      {/* 1.5 Context Drawer (Consolidated Pop-out) */}
      <Drawer
        anchor="left"
        open={isContextPaneOpen}
        onClose={() => setIsContextPaneOpen(false)}
        PaperProps={{
          sx: {
            width: 350,
            bgcolor: 'var(--bg-primary)',
            borderRight: '1px solid var(--border-color)',
            boxShadow: '20px 0 50px rgba(0,0,0,0.3)',
            color: 'var(--text-primary)',
            padding: '32px'
          }
        }}
      >
        <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="overline" sx={{ fontWeight: 900, letterSpacing: '0.15em' }}>Context & Grounding</Typography>
          <IconButton onClick={() => setIsContextPaneOpen(false)} size="small" sx={{ color: 'var(--text-secondary)' }} aria-label="Close Context"><FaChevronRight style={{ transform: 'rotate(180deg)' }} /></IconButton>
        </Box>

        <div className="ai-shell__secondary-content" style={{ padding: 0 }}>
          <div className="ai-shell__ghost-item">
            <div className="ai-shell__ghost-label"><FaDatabase /> Grounding Sources</div>
            <div className="ai-shell__ghost-box"><Typography variant="caption" sx={{ opacity: 0.6 }}>No active grounding sources in immediate focus.</Typography></div>
          </div>

          <div className="ai-shell__ghost-item">
            <div className="ai-shell__ghost-label"><FaHistory /> Analysis History</div>
            <div className="ai-shell__ghost-placeholder">
              <div className="ai-shell__ghost-bar" style={{ width: '80%' }} /><div className="ai-shell__ghost-bar" style={{ width: '60%' }} /><div className="ai-shell__ghost-bar" style={{ width: '90%' }} />
            </div>
          </div>

          <div className="ai-shell__ghost-item">
            <div className="ai-shell__ghost-label"><FaLightbulb /> Decision Bridge</div>
            <div className="ai-shell__ghost-draft">
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Strategy Bridge</Typography>
              <Typography variant="caption" sx={{ opacity: 0.5 }}>Reserved for handoff to structured observational analysis.</Typography>
            </div>
          </div>

          <Divider sx={{ my: 2, borderColor: 'var(--border-color)' }} />

          <div className="ai-shell__context-module">
            <div className="ai-shell__module-header"><span className="ai-shell__module-title">Schema Metadata</span><span className="ai-shell__coming-soon">Soon</span></div>
            <div className="ai-shell__module-empty">No metadata overrides detected.</div>
          </div>

          <div className="ai-shell__context-module">
            <div className="ai-shell__module-header"><span className="ai-shell__module-title">Enterprise Glossary</span><span className="ai-shell__coming-soon">Soon</span></div>
            <div className="ai-shell__module-empty">Agent glossary sync inactive.</div>
          </div>

          <div className="ai-shell__context-module">
            <div className="ai-shell__module-header"><span className="ai-shell__module-title">Hard Constraints</span><span className="ai-shell__coming-soon">Soon</span></div>
            <div className="ai-shell__module-empty">No explicit constraints identified in thread.</div>
          </div>
        </div>
      </Drawer>

      {/* 2. Primary Conversation Workspace */}
      <main className="ai-shell__workspace">
        <header className="ai-shell__header">
          <div className="ai-shell__header-left">
            <Avatar className="ai-shell__avatar"><FaRobot /></Avatar>
            <div className="ai-shell__titles">
              <Typography variant="subtitle2" className="ai-shell__main-title">Intelligence Agent</Typography>
              <div className="ai-shell__status-bar">
                <span className="ai-shell__status-item"><FaCircle className={`ai-shell__indicator is-${connectionStatus.data.toLowerCase()}`} /> {connectionStatus.data}</span>
                <span className="ai-shell__status-item"><FaCloud className={`ai-shell__indicator is-${connectionStatus.semantic.toLowerCase()}`} /> Semantic {connectionStatus.semantic}</span>
              </div>
            </div>
          </div>
          <div className="ai-shell__header-right">
             <IconButton onClick={() => setIsResultsPaneOpen(!isResultsPaneOpen)} size="small" aria-label="Toggle Results Pane">
               <FaEye style={{ color: isResultsPaneOpen ? 'var(--text-primary)' : 'var(--text-secondary)' }} />
             </IconButton>
          </div>
        </header>

        {/* Workspace Level Tabs */}
        <div className="ai-shell__workspace-tabs">
          <Tabs value={activeWorkspaceTab} onChange={(e, v) => setActiveWorkspaceTab(v)} variant="scrollable" scrollButtons="auto">
            {WORKSPACE_TABS.map(tab => {
              // Only allow Threads and Briefs for now as they are the most functional
              const isFunctional = ['threads', 'briefs'].includes(tab.id);
              return (
                <Tab
                  key={tab.id}
                  label={tab.label}
                  value={tab.id}
                  className={`ai-shell__workspace-tab ${!isFunctional ? 'is-disabled' : ''}`}
                  disabled={!isFunctional}
                />
              );
            })}
          </Tabs>
        </div>

        {/* Functional Mode Selector */}
        <div className="ai-shell__mode-bar">
          <div className="ai-shell__mode-container">
            <div className="ai-shell__mode-group">
              {MODES.map(m => (
                <button
                  key={m.id}
                  className={`ai-shell__mode-btn ${activeMode === m.id ? 'is-active' : ''}`}
                  onClick={() => handleModeChange(null, m.id)}
                >
                  <span>{m.label}</span>
                  <span className="ai-shell__mode-promise">{m.promise}</span>
                </button>
              ))}
            </div>
            {modeContext.reason && (
              <div className="ai-shell__mode-reason">
                <FaInfoCircle className="ai-shell__mode-reason-icon" />
                <Typography variant="caption">{modeContext.reason}</Typography>
              </div>
            )}
          </div>
        </div>

        <div className="ai-shell__conversation" ref={chatBodyRef}>
          {userMessages.length === 0 && (
            <div className="ai-shell__welcome-hero">
              <div className="ai-shell__hero-icon"><FaRobot /></div>
              <Typography variant="h4" className="ai-shell__hero-title">
                {activeMode === 'decide' ? 'Draft Decision Frame' : activeMode === 'explore' ? 'Grounded Exploration' : 'Agent Intelligence'}
              </Typography>
              <Typography variant="body1" className="ai-shell__hero-subtitle">
                {activeMode === 'decide' ? 'Frame complex business decisions to evaluate levers and uncertainty.' : activeMode === 'explore' ? 'Identify trends and distributions across your grounded dataset sources.' : 'Ask for high-level summaries or query specific metric performance.'}
              </Typography>
              <div className="ai-shell__hero-actions">
                <Chip icon={<FaPlus />} label="Dataset Bridge" onClick={() => setUserInput('@')} clickable />
                <Chip icon={<FaChartBar />} label="Quick Visual" onClick={() => setUserInput('Visualize ')} clickable />
                <Chip icon={<FaShieldAlt />} label="Grounded Observational Analysis" onClick={() => setUserInput('/clean')} clickable />
              </div>
            </div>
          )}

          {userMessages.map((msg, idx) => (
            <div key={idx} className={`ai-shell__message-row is-${msg.role}`}>
              <div className="ai-shell__message-card">
                <div className="ai-shell__message-header">
                  <span className="ai-shell__message-author">{msg.role === 'user' ? 'You' : 'Agent'}</span>
                  {(msg.grounded || msg.role === 'assistant') && <span className="ai-shell__grounded-tag"><FaShieldAlt /> Grounded</span>}
                </div>
                <div className="ai-shell__message-content">{msg.content}</div>

                {msg.artifacts && msg.artifacts.length > 0 && (
                  <div className="ai-shell__artifact-container">
                    {msg.artifacts.map((art, aIdx) => <React.Fragment key={aIdx}>{renderArtifact(art, false, msg.suggested_actions, msg.session_state, msg.capability_state, msg.decision_readiness)}</React.Fragment>)}
                  </div>
                )}

                {msg.suggested_actions && msg.suggested_actions.length > 0 && (
                  <div className="ai-shell__suggested-actions">
                    {msg.suggested_actions
                      .filter(act => {
                        // Prevent duplicate action surfaces if the same action is rendered in a specialized artifact card
                        // Check both top-level artifact and nested content
                        const hasKickoffAction = msg.artifacts?.some(art => {
                          if (art.type !== 'workspace_preview') return false;
                          const artAction = art.recommended_next_action || art.content?.recommended_next_action;
                          const artActionId = artAction?.action_id || artAction;
                          return artActionId === act.action_id;
                        });
                        return !hasKickoffAction;
                      })
                      .map((act, actIdx) => (
                        <Tooltip key={actIdx} title={act.availability_reason || act.description || ''} arrow>
                          <span>
                            <button
                              className={`ai-shell__action-btn ${act.priority === 'primary' ? 'is-primary' : ''} ${!act.enabled ? 'is-disabled' : ''}`}
                              onClick={() => handleActionClick(act.action_id, msg.session_state)}
                              disabled={loading || !act.enabled}
                            >
                              {act.label}
                            </button>
                          </span>
                        </Tooltip>
                      ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && <div className="ai-shell__message-row is-assistant"><div className="ai-shell__message-card is-loading"><div className="ai-shell__typing"><span /><span /><span /></div></div></div>}
          {error && <div className="ai-shell__alert-bar"><FaInfoCircle /> {error}</div>}
        </div>

        <div className="ai-shell__footer">
          <div className="ai-shell__input-wrapper">
             {isMentionOpen && <MentionDropdown query={mentionQuery} position={mentionPosition} onSelect={handleMentionSelect} onClose={() => setIsMentionOpen(false)} highlightedIndex={highlightedIndex} onHighlight={setHighlightedIndex} />}
            <div className="ai-shell__input-bar">
              <TextField inputRef={inputRef} onKeyDown={handleKeyDown} placeholder={activeMode === 'decide' ? "Frame a decision..." : "Inquire, type @ for data..."} variant="standard" fullWidth value={userInput} onChange={handleInputChange} disabled={loading} multiline maxRows={6} InputProps={{ disableUnderline: true }} />
              <button className="ai-shell__send-btn" onClick={handleSendMessage} disabled={loading || !userInput.trim()} aria-label="Send Message">{loading ? <div className="ai-shell__spinner" /> : <FaPaperPlane className="ai-shell__send-icon" />}</button>
            </div>
          </div>
        </div>
      </main>

      {/* 3. DEDICATED RESULTS PANE (The Major Product Surface) */}
      <aside className={`ai-shell__results-pane ${isResultsPaneOpen ? 'is-open' : 'is-closed'}`}>
        <div className="ai-shell__pane-header">
          <Typography variant="overline" sx={{ fontWeight: 900, letterSpacing: '0.15em' }}>Inspection Workspace</Typography>
          <IconButton onClick={() => setIsResultsPaneOpen(false)} size="small" aria-label="Close Results Pane"><FaChevronRight /></IconButton>
        </div>

        {/* Primary Viewer: Dominates above the fold */}
        <div className="ai-shell__result-viewer">
          <div className="ai-shell__viewer-label"><FaEye /> Active Result Viewer</div>
          {activeArtifact ? (
            renderArtifact(activeArtifact, true, activeArtifact.contextActions, activeArtifact.contextSessionState, activeArtifact.contextCapabilityState, activeArtifact.contextDecisionReadiness)
          ) : (
            <div className="ai-shell__viewer-empty">
              <div className="ai-shell__viewer-empty-icon"><FaTerminal /></div>
              <Typography variant="caption">Query the agent on the left to generate active visualizations, path previews, or structured analysis results.</Typography>
            </div>
          )}
        </div>

        <div className="ai-shell__pane-footer" style={{ padding: '24px', background: 'var(--bg-primary)', borderTop: '1px solid var(--border-color)', marginTop: 'auto' }}>
          <Typography variant="caption" sx={{ opacity: 0.3, fontWeight: 800, letterSpacing: '0.1em' }}>DI PHASE 4 • WORKSPACE AGENT V1</Typography>
        </div>
      </aside>
    </div>
  );
}

export default AIShell;
