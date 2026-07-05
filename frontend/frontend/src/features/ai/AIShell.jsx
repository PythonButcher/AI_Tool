import React, { useState, useContext, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import {
  FaRobot, FaTools, FaDatabase, FaPlus, FaLayerGroup,
  FaChartBar, FaShieldAlt, FaCircle, FaInfoCircle, FaPaperPlane,
  FaCheckCircle, FaExclamationTriangle, FaExternalLinkAlt, FaFileAlt,
  FaEye, FaChevronRight, FaTerminal, FaSearch, FaCloud, FaFilePdf,
  FaThumbtack, FaTimes, FaMagic
} from "react-icons/fa";
import {
  TextField, Button, Typography, Divider, Tooltip, Chip,
  Avatar, IconButton, Dialog, DialogContent
} from '@mui/material';
import { DataContext } from '../../context/DataContext';
import { WarehouseContext } from '../../context/WarehouseContext';
import { useWindowContext } from '../../context/WindowContext';
import MentionDropdown from '../../components/data_management/MentionDropdown';
import { detectToken, extractTokens } from '../../utils/mentionUtils';
import { AICommands } from '../workflow/AiCommandBlock';
import AICharts from './AICharts';
import SemanticRef from '../business/decision/SemanticRef';
import ScenarioPreview from '../business/decision/ScenarioPreview';
import { generateDecisionArtifactPdf } from '../../utils/decisionPdfExport';
import { saveDecisionAsset } from '../business/decision/decisionApi';
import DecisionAssetLibrary from '../business/decision/DecisionAssetLibrary';
import DecisionOutputReview from './DecisionOutputReview';
import './AIShell.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

/**
 * AIShell (Analytics-Agent Workspace)
 *
 * Re-implemented as a high-fidelity workspace with split conversation and inspection.
 */
function AIShell({ setShowAIChart, setAiChartType, setAiChartData, onOpenDecisionGraph }) {
  const {
    cleanedData,
    fullData,
    setCleanedData,
    semanticModel,
    refreshSemanticModelFromDataset,
  } = useContext(DataContext);
  const { datasets } = useContext(WarehouseContext);
  const { addDashboardChart, addChart } = useWindowContext();

  // Shell State
  const [userMessages, setUserMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [awaitingCleanInstructions, setAwaitingCleanInstructions] = useState(false);
  const [sessionReadiness, setSessionReadiness] = useState(null);
  const [pinFeedbackIds, setPinFeedbackIds] = useState({});
  const [sessionState, setSessionState] = useState({});
  const [activeMode, setActiveMode] = useState('ask');
  const [activeArtifact, setActiveArtifact] = useState(null);
  const [isResultsPaneOpen, setIsResultsPaneOpen] = useState(true);

  // Saved Assets State
  const [saveTitle, setSaveTitle] = useState('');
  const [savingAsset, setSavingAsset] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [libraryRefreshKey, setLibraryRefreshKey] = useState(0);
  const [fullscreenAsset, setFullscreenAsset] = useState(null);

  useEffect(() => {
    if (activeArtifact) {
      setSaveTitle(activeArtifact.title || activeArtifact.content?.title || '');
      setSaveSuccess(false);
      setSaveError(null);
    }
  }, [activeArtifact]);

  // Phase 5: Chat-native correction panel state
  // correctionPanelOpen tracks whether the inline correction form is visible in the inspector
  const [correctionPanelOpen, setCorrectionPanelOpen] = useState(false);
  // correctionType: which backend-supported correction type the user is submitting
  const [correctionType, setCorrectionType] = useState('time_horizon');
  // correctionTargetPath: stable path for the selected correction type
  const [correctionTargetPath, setCorrectionTargetPath] = useState('decision_scope.time_horizon');
  // correctionReplacement: the new value the user wants to apply
  const [correctionReplacement, setCorrectionReplacement] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [governanceWarning, setGovernanceWarning] = useState(null);



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
    // Phase 10: Map open_workspace to an in-chat inspector view of the most recent decision_output artifact
    if (actionId === 'open_workspace') {
      const relevantArtifact = [...userMessages].reverse().flatMap(msg => msg.artifacts || []).find(a => a.type === 'decision_output');
      if (relevantArtifact) {
        handleInspect(relevantArtifact, null, scopedSessionState || sessionState);
      } else {
        setUserMessages(prev => [...prev, {
          role: "assistant",
          content: "No active decision output is available to open. Please describe your objective to start a new decision analysis."
        }]);
      }
      return;
    }

    if (actionId === 'open_decision_graph' && onOpenDecisionGraph) {
      // Look for the most recent decision_output for context
      const relevantArtifact = [...userMessages].reverse().flatMap(msg => msg.artifacts || []).find(a => a.type === 'decision_output');
      const payload = relevantArtifact?.content?.decision_output || relevantArtifact?.content || {};

      const datasetContext = typeof resolveDatasetForNlp === 'function' ? resolveDatasetForNlp() : null;
      if (!datasetContext || !semanticModel) {
        setUserMessages(prev => [...prev, {
          role: "assistant",
          content: "Decision Graph requires an active dataset and semantic model."
        }]);
        return;
      }

      onOpenDecisionGraph({
        evidence_board: payload.evidence_board,
        frame: payload.frame,
        dataset: datasetContext,
        semantic_model: semanticModel
      });
      return;
    }

    setLoading(true);
    setError(null);
    setGovernanceWarning(null);

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

        if (data.governance_readiness?.status === 'warning') {
          const readiness = data.governance_readiness;
          setGovernanceWarning(
            `Warning (${readiness.next_action}): ${readiness.reasons?.[0]?.message || 'Dataset quality needs review.'}`,
          );
        }

        if (data.governance_readiness && data.governance_readiness.status === 'warning') {
          const gr = data.governance_readiness;
          setGovernanceWarning(`Warning (${gr.next_action}): ${gr.reasons?.[0]?.message || 'Dataset issues detected.'}`);
        }

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
      if (err.response?.status === 422 && err.response?.data?.governance_readiness?.status === 'blocked') {
        const gr = err.response.data.governance_readiness;
        setError(`Blocked (${gr.next_action}): ${gr.reasons?.[0]?.message || 'Governance checks failed.'}`);
      } else {
        setError("Connectivity failure during action.");
      }
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
    setGovernanceWarning(null);
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
      const readiness = err.response?.data?.governance_readiness;
      if (err.response?.status === 422 && readiness?.status === 'blocked') {
        setError(
          `Blocked (${readiness.next_action}): ${readiness.reasons?.[0]?.message || 'Governance checks failed.'}`,
        );
      } else {
        setError('Connectivity failure during correction.');
      }
    } finally {
      setLoading(false);
      // Reset correction form fields for next use
      setCorrectionReplacement('');
      setCorrectionReason('');
    }
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
    return ['answer', 'chart', 'workspace_preview', 'workspace_analysis_summary', 'decision_output'].includes(artifact?.type);
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

  const handleSaveAsset = async () => {
    if (!activeArtifact) return;
    setSavingAsset(true);
    setSaveSuccess(false);
    setSaveError(null);
    try {
      const rawOutput = activeArtifact.content?.decision_output || activeArtifact.content || activeArtifact;

      const decisionOutput = {
        type: 'decision_output',
        render_hint: 'decision_output',
        inspectable: true,
        default_view: 'inspector',
        schema_version: rawOutput.schema_version || 'di_phase3_decision_output_v1',
        title: rawOutput.title,
        summary: rawOutput.summary,
        dataset_trust: rawOutput.dataset_trust,
        frame: rawOutput.frame,
        readiness: rawOutput.readiness,
        correction_state: rawOutput.correction_state,
        evidence_board: rawOutput.evidence_board,
        decision_map: rawOutput.decision_map,
        scenario_compare: rawOutput.scenario_compare,
        advanced_gates: rawOutput.advanced_gates,
        export_sections: rawOutput.export_sections,
        source_refs: rawOutput.source_refs,
        command_center: rawOutput.command_center,
        truth_boundary: rawOutput.truth_boundary || 'observational_analysis_only'
      };

      const payload = {
        title: saveTitle ? saveTitle.trim() : undefined,
        decision_output: decisionOutput,
      };

      if (rawOutput.graph_state) {
        payload.graph_state = rawOutput.graph_state;
      } else if (activeArtifact.graph_state) {
        payload.graph_state = activeArtifact.graph_state;
      }

      const savedAsset = await saveDecisionAsset(payload);

      setActiveArtifact({
        type: 'decision_output',
        asset_id: savedAsset.asset_id,
        created_at: savedAsset.created_at,
        snapshot_notice: savedAsset.snapshot_notice,
        title: savedAsset.title,
        content: savedAsset.decision_output,
        ...savedAsset.decision_output,
        graph_state: savedAsset.graph_state
      });

      setSaveSuccess(true);
      setLibraryRefreshKey(prev => prev + 1);
    } catch (err) {
      console.error(err);
      setSaveError(err?.error?.message || err?.message || 'Failed to save decision asset.');
    } finally {
      setSavingAsset(false);
    }
  };

  const handleReopenAsset = (asset) => {
    if (!asset) return;
    setActiveArtifact({
      type: 'decision_output',
      asset_id: asset.asset_id,
      schema_version: asset.schema_version,
      created_at: asset.created_at,
      snapshot_notice: asset.snapshot_notice,
      decision_output: asset.decision_output,
      content: asset.decision_output,
      ...asset.decision_output,
      title: asset.title,
      graph_state: asset.graph_state,
    });
    setIsResultsPaneOpen(true);
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
                
                {content?.chartSpec?.schemaVersion === 'chart_spec_v1' && (
                  <div className="ai-shell__chart-actions">
                    <Button
                      variant="contained"
                      color="primary"
                      size="medium"
                      startIcon={<FaThumbtack />}
                      onClick={() => {
                        addDashboardChart({
                          type: content.chartType || 'Bar',
                          mapping: content.chartData?.mapping || {},
                          dataSourceMode: 'semantic',
                          chartSpec: content.chartSpec
                        });
                        const feedId = artifact.id || `temp-${Date.now()}`;
                        setPinFeedbackIds(prev => ({ ...prev, [feedId]: true }));
                        setTimeout(() => setPinFeedbackIds(prev => ({ ...prev, [feedId]: false })), 2000);
                      }}
                    >
                      {pinFeedbackIds[artifact.id || ''] ? 'Pinned!' : 'Pin to Dashboard'}
                    </Button>
                    <Button
                      variant="outlined"
                      size="medium"
                      startIcon={<FaChartBar />}
                      onClick={() => addChart({
                        type: content.chartType || 'Bar',
                        mapping: content.chartData?.mapping || {},
                        dataSourceMode: 'semantic',
                        chartSpec: content.chartSpec
                      })}
                    >
                      Open Chart Window
                    </Button>
                  </div>
                )}
                
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
                      if (actionId === 'open_workspace') return null;

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
        const datasetContext = typeof resolveDatasetForNlp === 'function' ? resolveDatasetForNlp() : null;
        const hasData = datasetContext && !!semanticModel;
        return (
          <DecisionOutputReview
            artifact={artifact}
            isInspector={isInspector}
            contextActions={lookupActions}
            contextSessionState={lookupSessionState}
            contextCapabilityState={lookupCapabilityState}
            contextDecisionReadiness={lookupDecisionReadiness}
            renderArtifactExportBar={renderArtifactExportBar}
            handleExportArtifactPdf={handleExportArtifactPdf}
            fullscreenAsset={fullscreenAsset}
            setFullscreenAsset={setFullscreenAsset}
            saveTitle={saveTitle}
            setSaveTitle={setSaveTitle}
            handleSaveAsset={handleSaveAsset}
            savingAsset={savingAsset}
            saveSuccess={saveSuccess}
            saveError={saveError}
            loading={loading}
            handleActionClick={handleActionClick}
            onOpenDecisionGraph={onOpenDecisionGraph}
            hasData={hasData}
            datasetContext={datasetContext}
            semanticModel={semanticModel}
            correctionPanelOpen={correctionPanelOpen}
            setCorrectionPanelOpen={setCorrectionPanelOpen}
            correctionType={correctionType}
            setCorrectionType={setCorrectionType}
            correctionTargetPath={correctionTargetPath}
            setCorrectionTargetPath={setCorrectionTargetPath}
            correctionReplacement={correctionReplacement}
            setCorrectionReplacement={setCorrectionReplacement}
            correctionReason={correctionReason}
            setCorrectionReason={setCorrectionReason}
            handleCorrectionSubmit={handleCorrectionSubmit}
            resolveDatasetForNlp={resolveDatasetForNlp}
          />
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
    setGovernanceWarning(null);

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

        if (data.governance_readiness && data.governance_readiness.status === 'warning') {
          const gr = data.governance_readiness;
          setGovernanceWarning(`Warning (${gr.next_action}): ${gr.reasons?.[0]?.message || 'Dataset issues detected.'}`);
        }

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
      if (err.response?.status === 422 && err.response?.data?.governance_readiness?.status === 'blocked') {
        const gr = err.response.data.governance_readiness;
        setError(`Blocked (${gr.next_action}): ${gr.reasons?.[0]?.message || 'Governance checks failed.'}`);
      } else {
        setError("⚠ Connectivity error. Verify backend service status.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (isMentionOpen) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsMentionOpen(false);
        return;
      }
      const filtered = datasets.filter((ds) => ds.name.toLowerCase().includes(mentionQuery?.toLowerCase() || ""));
      if (filtered.length > 0) {
        if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedIndex(prev => (prev < filtered.length - 1 ? prev + 1 : prev)); return; }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightedIndex(prev => (prev > 0 ? prev - 1 : prev)); return; }
        else if (e.key === 'Enter') { e.preventDefault(); handleMentionSelect(filtered[highlightedIndex].name); setHighlightedIndex(0); return; }
      }
    }
    
    // Normal chat behavior
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="ai-shell">

      {/* 1. Left Command Rail (Future Tools) */}
      <nav className="ai-shell__left-rail">
        <div className="ai-shell__rail-top">
           <Tooltip title="AI Chat" placement="right">
             <div className="ai-shell__rail-item is-active"><FaRobot /></div>
           </Tooltip>
           <Tooltip title="Data Connections (Future)" placement="right">
             <div className="ai-shell__rail-item"><FaDatabase /></div>
           </Tooltip>
           <Tooltip title="Custom Workflows (Future)" placement="right">
             <div className="ai-shell__rail-item"><FaTools /></div>
           </Tooltip>
        </div>
        <div className="ai-shell__rail-bottom">
           <Tooltip title="Agent Settings (Future)" placement="right">
             <div className="ai-shell__rail-item"><FaLayerGroup /></div>
           </Tooltip>
        </div>
      </nav>

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



        <div className="ai-shell__conversation" ref={chatBodyRef}>
          {userMessages.length === 0 && (
            <div className="ai-shell__welcome-hero">
              <div className="ai-shell__hero-icon"><FaRobot /></div>
              <Typography variant="h4" className="ai-shell__hero-title">
                Agent Intelligence
              </Typography>
              <Typography variant="body1" className="ai-shell__hero-subtitle">
                Ask for high-level summaries, explore datasets, or frame complex business decisions.
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
          {governanceWarning && <div className="ai-shell__alert-bar" style={{ backgroundColor: '#fff3cd', color: '#856404' }}><FaExclamationTriangle /> {governanceWarning}</div>}
          {error && <div className="ai-shell__alert-bar"><FaInfoCircle /> {error}</div>}
        </div>

        <div className="ai-shell__footer">
          <div className="ai-shell__input-wrapper">
             {isMentionOpen && <MentionDropdown query={mentionQuery} position={mentionPosition} onSelect={handleMentionSelect} onClose={() => setIsMentionOpen(false)} highlightedIndex={highlightedIndex} onHighlight={setHighlightedIndex} />}
            <div className="ai-shell__input-bar">
              <TextField inputRef={inputRef} onKeyDown={handleKeyDown} placeholder="Ask a question, type @ for data..." variant="standard" fullWidth value={userInput} onChange={handleInputChange} disabled={loading} multiline maxRows={6} InputProps={{ disableUnderline: true }} />
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

        {/* Compact Saved Decisions control (Library) */}
        <DecisionAssetLibrary
          onReopenAsset={handleReopenAsset}
          activeAssetId={activeArtifact?.asset_id}
          refreshTrigger={libraryRefreshKey}
        />
      </aside>

      {/* Fullscreen Review Overlay */}
      <Dialog
        fullScreen
        open={!!fullscreenAsset}
        onClose={() => setFullscreenAsset(null)}
        sx={{ zIndex: 1300 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, zIndex: 10 }}>
          <Typography variant="h6" sx={{ fontWeight: 900 }}>Saved Decision Review</Typography>
          <Button onClick={() => setFullscreenAsset(null)} sx={{ fontWeight: 800, color: 'var(--text-primary)' }}>
            Close
          </Button>
        </div>
        <DialogContent sx={{ p: 0, m: 0, background: 'var(--bg-secondary)', overflowY: 'auto' }}>
          <div style={{ padding: '24px' }}>
            {fullscreenAsset && renderArtifact(fullscreenAsset, true, fullscreenAsset.contextActions, fullscreenAsset.contextSessionState, fullscreenAsset.contextCapabilityState, fullscreenAsset.contextDecisionReadiness)}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AIShell;
