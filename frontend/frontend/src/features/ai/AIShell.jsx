import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import {
  FaChartBar,
  FaChartLine,
  FaArrowUp,
  FaArrowRight,
  FaBars,
  FaCheckCircle,
  FaChevronRight,
  FaCircle,
  FaChevronDown,
  FaDatabase,
  FaExclamationTriangle,
  FaExternalLinkAlt,
  FaEye,
  FaFilePdf,
  FaInfoCircle,
  FaLayerGroup,
  FaPlus,
  FaRobot,
  FaShieldAlt,
  FaTimes,
  FaThumbtack,
} from 'react-icons/fa';
import {
  Button,
  Chip,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { DataContext } from '../../context/DataContext';
import { WarehouseContext } from '../../context/WarehouseContext';
import { useWindowContext } from '../../context/WindowContext';
import MentionDropdown from '../../components/data_management/MentionDropdown';
import { detectToken, extractTokens } from '../../utils/mentionUtils';
import { AICommands } from '../workflow/AiCommandBlock';
import { generateAiResultPdf } from '../../utils/aiResultPdfExport';
import AICharts from './AICharts';
import DashboardDraft from './DashboardDraft';
import { buildChatSuggestions } from './chatSuggestions';
import { canSaveResult, resultKey } from '../../utils/aiDashboardResults';
import './AIShell.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const BI_ARTIFACT_TYPES = new Set(['answer', 'chart']);

/**
 * Keep only the compact session state required for grounded BI follow-ups.
 * Decision-workspace state is intentionally discarded so an older chat cannot
 * silently re-enter the retired Decision Intelligence experience.
 */
const buildBiSessionState = (rawState = {}) => {
  const {
    draft_workspace,
    decision_state,
    clarification_state,
    available_actions,
    action_state,
    capability_state,
    decision_readiness,
    ...biState
  } = rawState || {};

  return {
    ...biState,
    active_mode: 'explore',
  };
};

/**
 * AI Chat is now a BI-only surface. Unknown and Decision Intelligence artifact
 * types are rejected at the integration boundary instead of leaking into the UI.
 */
const filterBiArtifacts = (artifacts) => (
  Array.isArray(artifacts)
    ? artifacts.filter((artifact) => BI_ARTIFACT_TYPES.has(artifact?.type))
    : []
);

const TrustedResultCard = ({ biGrounding, analysisLineage }) => {
  if (!biGrounding && !analysisLineage) return null;

  const lineage = analysisLineage || biGrounding?.analysis_lineage;

  const {
    dataset,
    row_count,
    source_row_count,
    freshness = {},
    cleaning = {},
    metric_definition,
    aggregation,
    dimensions = [],
    filters = [],
    time_period
  } = biGrounding || {};

  const datasetName = dataset?.dataset_name || 'unknown';
  const rowCount = row_count ?? 'unknown';
  const sourceRowCount = source_row_count ?? 'unknown';
  const metricName = metric_definition?.label || metric_definition?.name;

  return (
    <details className="ai-shell__trusted-result">
      <summary className="ai-shell__trusted-header">
        <FaShieldAlt /> <span>Source, metric and filters</span>
      </summary>
      <div className="ai-shell__trusted-content">
        <div className="ai-shell__trusted-row">
          <span className="ai-shell__trusted-label">Dataset</span>
          <span className="ai-shell__trusted-value">{datasetName}</span>
        </div>
        <div className="ai-shell__trusted-row">
          <span className="ai-shell__trusted-label">Row Basis</span>
          <span className="ai-shell__trusted-value">
            {rowCount} {rowCount !== 'unknown' && sourceRowCount !== 'unknown' && rowCount !== sourceRowCount ? `(filtered from ${sourceRowCount})` : ''}
          </span>
        </div>
        <div className="ai-shell__trusted-row">
          <span className="ai-shell__trusted-label">Freshness</span>
          <span className="ai-shell__trusted-value">
            {freshness.state || 'unknown'}{freshness.as_of ? ` as of ${freshness.as_of}` : ''}
          </span>
        </div>
        <div className="ai-shell__trusted-row">
          <span className="ai-shell__trusted-label">Cleaning</span>
          <span className="ai-shell__trusted-value">{cleaning.state || 'unknown'}</span>
        </div>
        {(metricName || aggregation) && (
          <div className="ai-shell__trusted-row">
            <span className="ai-shell__trusted-label">Metric</span>
            <span className="ai-shell__trusted-value">
              {metricName || 'unknown'} {aggregation ? `[${aggregation}]` : ''}
            </span>
          </div>
        )}
        {dimensions.length > 0 && (
          <div className="ai-shell__trusted-row">
            <span className="ai-shell__trusted-label">Dimensions</span>
            <span className="ai-shell__trusted-value">
              {dimensions.map(d => d.label || d.name || 'unknown').join(', ')}
            </span>
          </div>
        )}
        {filters.length > 0 && (
          <div className="ai-shell__trusted-row">
            <span className="ai-shell__trusted-label">Filters</span>
            <span className="ai-shell__trusted-value">
              {filters.map(f => `${f.label || f.field || 'unknown'} ${f.operator || ''} ${f.value ?? f.values?.join(',') ?? ''}`).join(' AND ')}
            </span>
          </div>
        )}
        {time_period && (
          <div className="ai-shell__trusted-row">
            <span className="ai-shell__trusted-label">Time Period</span>
            <span className="ai-shell__trusted-value">
              {time_period.start || 'unknown'} to {time_period.end || 'unknown'}
            </span>
          </div>
        )}
        {lineage && lineage.sources && lineage.sources.length > 1 && (
          <div className="ai-shell__trusted-row" style={{ gridColumn: '1 / -1' }}>
            <span className="ai-shell__trusted-label">Model Lineage</span>
            <span className="ai-shell__trusted-value" style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              {lineage.sources.map((s, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && <FaLayerGroup style={{ opacity: 0.4, fontSize: '0.65rem' }} />}
                  <span>{s.source_alias || s.source_name || 'unknown'}</span>
                </React.Fragment>
              ))}
            </span>
            {lineage.relationships && lineage.relationships.length > 0 && (
              <span className="ai-shell__trusted-value" style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', marginTop: '4px' }}>
                {lineage.relationships.map((rel, idx) => (
                  <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 6px', border: '1px solid var(--border-color)', borderRadius: '4px', background: 'var(--bg-primary)', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                    <FaLayerGroup style={{ fontSize: '0.55rem', opacity: 0.7 }} />
                    <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{rel.relationship_id}</span>
                    {rel.join_behavior && <span>{rel.join_behavior} join</span>}
                    {rel.cardinality && <span>({rel.cardinality.replace(/_/g, ' ')})</span>}
                  </span>
                ))}
              </span>
            )}
          </div>
        )}
      </div>
    </details>
  );
};

/**
 * AI Chat keeps its established split-pane layout while returning to a focused
 * workflow: grounded answers, tables, charts, and conversational refinements.
 */
function AIShell({ onOpenDashboard } = {}) {
  const {
    activeWorkspace,
    cleanedData,
    fullData,
    setCleanedData,
    semanticModel,
    refreshSemanticModelFromDataset,
  } = useContext(DataContext);
  const { datasets = [] } = useContext(WarehouseContext);
  const { addDashboardResults, openDashboard, dashboardItems = [] } = useWindowContext();

  const [userMessages, setUserMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [governanceWarning, setGovernanceWarning] = useState(null);
  const [awaitingCleanInstructions, setAwaitingCleanInstructions] = useState(false);
  const [sessionState, setSessionState] = useState({ active_mode: 'explore' });
  const [activeArtifact, setActiveArtifact] = useState(null);
  const [isResultsPaneOpen, setIsResultsPaneOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [pinFeedbackIds, setPinFeedbackIds] = useState({});
  const [failedRequest, setFailedRequest] = useState(null);
  const [notice, setNotice] = useState(null);

  const [mentionQuery, setMentionQuery] = useState(null);
  const [isMentionOpen, setIsMentionOpen] = useState(false);
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const inputRef = useRef(null);
  const resultsToggleRef = useRef(null);
  const resultsHeadingRef = useRef(null);
  const chatBodyRef = useRef(null);
  const requestRef = useRef(null);
  const dataScope = useMemo(() => ({ workspaceId: activeWorkspace?.workspace_id, version: activeWorkspace?.version, semanticModel, cleanedData, fullData }), [activeWorkspace?.workspace_id, activeWorkspace?.version, semanticModel, cleanedData, fullData]);
  const scopeRef = useRef(dataScope);
  scopeRef.current = dataScope;
  const previousScope = useRef(dataScope);

  useEffect(() => {
    if (isResultsPaneOpen) resultsHeadingRef.current?.focus();
  }, [isResultsPaneOpen]);

  const closeResults = () => {
    setIsResultsPaneOpen(false);
    resultsToggleRef.current?.focus();
  };
  const suggestions = useMemo(() => buildChatSuggestions(semanticModel), [semanticModel]);
  const datasetLabel = sessionState.dataset_context?.dataset?.dataset_name
    || activeWorkspace?.name || activeWorkspace?.workspace_name || semanticModel?.dataset?.name || 'No data selected';
  const viewDashboard = () => {
    openDashboard();
    onOpenDashboard?.();
  };

  useEffect(() => {
    if (previousScope.current !== dataScope) {
      requestRef.current?.controller.abort();
      requestRef.current = null;
      setLoading(false);
      setSessionState({ active_mode: 'explore' });
      setAwaitingCleanInstructions(false);
      setActiveArtifact(null);
      setError(null);
      setFailedRequest(null);
      setGovernanceWarning(null);
      setNotice('Data context changed. Your earlier results remain available; new questions use the selected data.');
      previousScope.current = dataScope;
    }
  }, [dataScope]);

  useEffect(() => () => {
    requestRef.current?.controller.abort();
    requestRef.current = null;
  }, []);

  const connectionStatus = useMemo(() => {
    const dataLoaded = Boolean(activeWorkspace?.workspace_id) || (cleanedData?.length > 0) || (fullData?.length > 0);
    return {
      semantic: semanticModel ? 'Active' : 'Standby',
      data: dataLoaded ? 'Connected' : 'Disconnected',
    };
  }, [activeWorkspace?.workspace_id, semanticModel, cleanedData, fullData]);

  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTo?.({
        top: chatBodyRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [userMessages, loading]);

  const resolveDatasetForNlp = () => {
    if (Array.isArray(cleanedData) && cleanedData.length > 0) return cleanedData;
    if (Array.isArray(fullData) && fullData.length > 0) return fullData;
    return null;
  };

  /**
   * Preserve explicit Data Hub references without attaching unrelated active
   * inline rows. This is the same canonical dataset identity rule used by the
   * working conversational analytics path.
   */
  const resolveRequestContext = (targetSessionState, explicitTokens = []) => {
    const availableDatasets = Array.isArray(datasets) ? datasets : [];
    const resolvedDatasets = availableDatasets.filter((dataset) => explicitTokens.includes(dataset.name));
    let payloadDataset = resolveDatasetForNlp();
    let payloadSemanticModel = semanticModel;
    let datasetRef;

    if (resolvedDatasets.length === 1) {
      const selectedDataset = resolvedDatasets[0];
      const semanticDataset = payloadSemanticModel?.dataset;
      const isActiveInline = semanticDataset
        && (semanticDataset.id === selectedDataset.id || semanticDataset.name === selectedDataset.name);

      if (isActiveInline) {
        datasetRef = {
          source: 'active',
          dataset_id: selectedDataset.id,
          dataset_name: selectedDataset.name,
        };
      } else {
        datasetRef = {
          source: 'datahub',
          dataset_id: selectedDataset.id,
          dataset_name: selectedDataset.name,
        };
        payloadDataset = undefined;
        payloadSemanticModel = undefined;
      }
    } else if (resolvedDatasets.length > 1) {
      payloadDataset = undefined;
      payloadSemanticModel = undefined;
    } else {
      const scopedDataset = targetSessionState?.dataset_context?.dataset;
      if (scopedDataset?.source === 'datahub') {
        payloadDataset = undefined;
        payloadSemanticModel = undefined;
        datasetRef = scopedDataset;
      } else if (scopedDataset) {
        datasetRef = scopedDataset;
      }
    }

    return {
      payloadDataset,
      payloadSemanticModel,
      datasetRef,
      resolvedDatasets,
    };
  };

  const handleInspect = (artifact) => {
    if (!BI_ARTIFACT_TYPES.has(artifact?.type)) return;
    setActiveArtifact(artifact);
    setIsResultsPaneOpen(true);
  };

  const handleExportArtifactPdf = (artifact) => {
    if (!BI_ARTIFACT_TYPES.has(artifact?.type)) return;
    generateAiResultPdf({ artifact });
  };

  const renderExportButton = (artifact, className = '') => (
    <Tooltip title="Export result as PDF" arrow>
      <IconButton
        size="small"
        className={`ai-shell__export-icon-btn ${className}`}
        aria-label="Export result as PDF"
        onClick={(event) => {
          event.stopPropagation();
          handleExportArtifactPdf(artifact);
        }}
      >
        <FaFilePdf />
      </IconButton>
    </Tooltip>
  );

  const renderAnswerContent = (content = {}, canRefine = true) => {
    if (content.reason_code === 'analytics_clarification_required') {
      return <div className="ai-shell__clarification">
        <p>{content.message}</p>
        {content.choices?.map(choice => <button key={choice.user_message} type="button" disabled={loading || !canRefine}
          onClick={() => submitTurn({ message: choice.user_message })}>{choice.label}</button>)}
      </div>;
    }
    const metricLabel = content.metric?.label || content.metric?.name || content.fieldsUsed?.value;
    const summaryValue = content.summary?.value_formatted
      ?? content.summary?.value
      ?? content.value
      ?? content.top_group?.value;
    const rows = Array.isArray(content.rows) ? content.rows.slice(0, 20) : [];

    if (metricLabel || summaryValue !== undefined || rows.length > 0) {
      return (
        <div className="ai-shell__answer-card">
          {(summaryValue !== undefined || metricLabel) && (
            <div className="ai-shell__answer-metric-header">
              {summaryValue !== undefined && (
                <Typography className="ai-shell__answer-metric-value">{summaryValue}</Typography>
              )}
              {metricLabel && (
                <Typography className="ai-shell__answer-metric-label">{metricLabel}</Typography>
              )}
            </div>
          )}

          {content.message && (
            <Typography variant="body2" sx={{ lineHeight: 1.7, mb: rows.length ? 2 : 0 }}>
              {content.message}
            </Typography>
          )}

          {content.top_group?.label && (
            <div className="ai-shell__answer-highlight">
              <Typography variant="overline" sx={{ fontWeight: 900, color: 'var(--text-secondary)' }}>
                Top result
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>{content.top_group.label}</Typography>
            </div>
          )}

          {rows.length > 0 && (
            <div className="ai-shell__answer-rows">
              {rows.map((row, index) => (
                <div key={`${row.group_label || 'row'}-${index}`} className="ai-shell__answer-row">
                  <span className="ai-shell__answer-row-label">
                    {row.group_label || (row.group && Object.values(row.group).join(' | ')) || `Row ${index + 1}`}
                  </span>
                  <span className="ai-shell__answer-row-value">{row.value_formatted ?? row.value ?? ''}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <Typography variant="body2" sx={{ lineHeight: 1.7 }}>
        {content.message || 'The query completed, but no readable result was returned.'}
      </Typography>
    );
  };

  const renderArtifact = (artifact, isInspector = false) => {
    if (!BI_ARTIFACT_TYPES.has(artifact?.type)) return null;
    const { type, content = {}, inspectable } = artifact;
    const baseClass = isInspector ? 'ai-shell__active-artifact' : 'ai-shell__artifact-preview-card';

    if (type === 'answer') {
      return (
        <div className={`${baseClass} is-answer`}>
          <div className="ai-shell__artifact-header">
            <span className="ai-shell__artifact-title"><FaCheckCircle /> Business result</span>
            <div className="ai-shell__artifact-header-actions">
              {canSaveResult(artifact) && <Button size="small" onClick={() => saveResult(artifact)}>
                {dashboardItems.some(item => item.sourceMetadata?.resultKey === resultKey(artifact)) ? 'On dashboard' : 'Save KPI'}
              </Button>}
              {renderExportButton(artifact)}
              {!isInspector && inspectable && (
                <IconButton size="small" onClick={() => handleInspect(artifact)} aria-label="Open result">
                  <FaExternalLinkAlt style={{ fontSize: '0.7rem' }} />
                </IconButton>
              )}
            </div>
          </div>
          <div className="ai-shell__artifact-content">{renderAnswerContent(content, artifact.scope === dataScope)}</div>
          <TrustedResultCard biGrounding={artifact.bi_grounding} analysisLineage={artifact.analysis_lineage} />
        </div>
      );
    }

    if (!isInspector) {
      return (
        <div className="ai-shell__artifact-preview-container">
          <div className="ai-shell__artifact-preview-link">
            <div className="ai-shell__preview-icon"><FaChartBar /></div>
            <button type="button" className="ai-shell__preview-info" onClick={() => handleInspect(artifact)}>
              <Typography variant="caption" className="ai-shell__preview-type">Visualization</Typography>
              <Typography variant="body2" className="ai-shell__preview-title">
                {artifact.title || content.title || content.explanation || `${content.chartType || 'Chart'} result`}
              </Typography>
            </button>
            <div className="ai-shell__preview-actions">
              {renderExportButton(artifact, 'is-preview-export')}
              <IconButton size="small" className="ai-shell__preview-action" aria-label="Open chart" onClick={() => handleInspect(artifact)}>
                <FaChevronRight />
              </IconButton>
            </div>
          </div>
          <TrustedResultCard biGrounding={artifact.bi_grounding} analysisLineage={artifact.analysis_lineage} />
        </div>
      );
    }

    return (
      <div className={`${baseClass} is-chart`}>
        <div className="ai-shell__artifact-content">
          <div className="ai-shell__artifact-export-bar">
            <span>Export this BI result</span>
            {renderExportButton(artifact)}
          </div>

          {content?.chartSpec?.schemaVersion === 'chart_spec_v1' && (
            <div className="ai-shell__chart-actions">
              <Button
                variant="contained"
                size="medium"
                startIcon={<FaThumbtack />}
                onClick={() => saveResult(artifact)}
                disabled={!canSaveResult(artifact) || dashboardItems.some(item => item.sourceMetadata?.resultKey === resultKey(artifact))}
              >
                {pinFeedbackIds[resultKey(artifact)] || dashboardItems.some(item => item.sourceMetadata?.resultKey === resultKey(artifact)) ? 'On dashboard' : 'Save to Dashboard'}
              </Button>
              <Button
                variant="outlined"
                size="medium"
                startIcon={<FaChartBar />}
                onClick={viewDashboard}
              >
                View Dashboard
              </Button>
            </div>
          )}

          <div className="ai-shell__chart-canvas"><AICharts aiChartType={content.chartType || 'Bar'} aiChartData={content.chartData} /></div>
          {content.explanation && (
            <Typography variant="body2" sx={{ mt: 2, lineHeight: 1.7, opacity: 0.75 }}>
              {content.explanation}
            </Typography>
          )}
        </div>
        <TrustedResultCard biGrounding={artifact.bi_grounding} analysisLineage={artifact.analysis_lineage} />
      </div>
    );
  };

  const handleMentionSelect = (datasetName) => {
    const startIndex = mentionStartIndex === -1 ? userInput.lastIndexOf('@') : mentionStartIndex;
    const before = userInput.substring(0, startIndex);
    const afterStart = userInput.substring(startIndex + 1);
    const spaceIndex = afterStart.search(/\s/);
    const endIndex = spaceIndex === -1 ? userInput.length : startIndex + 1 + spaceIndex;
    const after = userInput.substring(endIndex);
    setUserInput(`${before}@${datasetName} ${after}`);
    setIsMentionOpen(false);
    setMentionStartIndex(-1);
    inputRef.current?.focus();
  };

  const chooseData = () => {
    // Keep the question intact when data is selected from a toolbar control.
    const prefix = userInput.trimEnd();
    const value = prefix.endsWith('@') ? prefix : `${prefix}${prefix ? ' ' : ''}@`;
    setUserInput(value);
    setMentionQuery('');
    setMentionStartIndex(value.length - 1);
    setMentionPosition({ top: -180, left: 0 });
    setHighlightedIndex(0);
    setIsMentionOpen(true);
    inputRef.current?.focus();
  };

  const handleInputChange = (event) => {
    const value = event.target.value;
    const cursorPosition = event.target.selectionStart;
    setUserInput(value);
    setHighlightedIndex(0);
    const token = detectToken(value, cursorPosition);

    if (token !== null) {
      setMentionQuery(token);
      setIsMentionOpen(true);
      setMentionStartIndex(value.substring(0, cursorPosition).lastIndexOf('@'));
      setMentionPosition({ top: -180, left: 15 });
    } else {
      setIsMentionOpen(false);
      setMentionStartIndex(-1);
    }
  };

  const runCleanCommand = async (message, datasetContext, followUp = false, signal, isCurrent = () => true) => {
    const parts = message.split(' ');
    const instructions = followUp ? message : (parts.length > 1 ? parts.slice(1).join(' ') : null);
    const response = await axios.post(`${API_URL}/ai_cmd`, {
      command: '/clean',
      dataset: datasetContext,
      instructions,
    }, { signal, timeout: 120000 });

    if (!isCurrent()) return '';

    if (response.data.cleaned_data) {
      setCleanedData(response.data.cleaned_data);
      await refreshSemanticModelFromDataset(response.data.cleaned_data, {
        source: followUp ? 'ai_shell_clean_followup' : 'ai_shell_clean',
        preserveUserMetrics: true,
      });
      setAwaitingCleanInstructions(false);
      return 'Data cleaning complete. The semantic model is refreshed and ready for analysis.';
    }

    if (response.data.suggestions) {
      setAwaitingCleanInstructions(true);
      return response.data.suggestions;
    }

    setAwaitingCleanInstructions(false);
    return 'The active data context is ready.';
  };

  const submitTurn = async ({ message, previousState = sessionState, refinement, retry = false }) => {
    message = message.trim();
    if (!message || requestRef.current) return;
    const controller = new AbortController();
    const request = { controller, scope: dataScope, message };
    requestRef.current = request;
    const isCurrent = () => requestRef.current === request && scopeRef.current === request.scope;
    const tokens = extractTokens(message, datasets);
    const biSessionState = buildBiSessionState(previousState);
    setLoading(true);
    setError(null);
    setFailedRequest(null);
    setNotice(null);
    setGovernanceWarning(null);
    if (!retry) {
      setUserInput('');
      setUserMessages(previous => [...previous, { role: 'user', content: message, scope: dataScope }]);
    } else {
      setUserInput(current => current === message ? '' : current);
    }

    try {
      if ((AICommands.isCommand(message) && message.split(' ')[0] === '/clean') || awaitingCleanInstructions) {
        const reply = await runCleanCommand(message, resolveDatasetForNlp(), awaitingCleanInstructions, controller.signal, isCurrent);
        if (isCurrent()) setUserMessages(previous => [...previous, { role: 'assistant', content: reply, scope: dataScope }]);
        return;
      }
      const { payloadDataset, payloadSemanticModel, datasetRef } = resolveRequestContext(biSessionState, tokens);
      const response = await axios.post(`${API_URL}/api/decision/chat/turns`, {
        workspace_id: tokens.length || datasetRef?.source === 'datahub' ? undefined : activeWorkspace?.workspace_id,
        user_message: message,
        dataset: payloadDataset,
        semantic_model: payloadSemanticModel,
        dataset_ref: datasetRef,
        resolved_datasets: tokens,
        requested_mode: (payloadDataset || datasetRef || activeWorkspace?.workspace_id) ? 'explore' : 'ask',
        conversation_history: userMessages.filter(item => item.scope === dataScope)
          .map(({ role, content }) => ({ role, content })).slice(-10),
        session_state: biSessionState,
        ...(refinement ? { analytics_refinement: refinement } : {}),
      }, { signal: controller.signal, timeout: 120000 });
      if (!isCurrent()) return;
      const data = response.data;
      if (data.status !== 'success') throw new Error(data.error?.message || 'The BI query could not be completed.');
      const nextSessionState = buildBiSessionState(data.session_state);
      const withIdentity = artifact => ({ ...artifact, dataset_context: nextSessionState.dataset_context, scope: dataScope });
      const biArtifacts = filterBiArtifacts(data.artifacts).map(withIdentity);
      const draft = data.dashboard_draft ? {
        ...data.dashboard_draft,
        items: data.dashboard_draft.items.map(item => ({
          ...item, ...(item.artifact ? { artifact: withIdentity(item.artifact) } : {}),
        })),
      } : null;
      const verified = biArtifacts.some(artifact => artifact.bi_grounding?.metric_definition && !artifact.content?.reason_code);
      setUserMessages(previous => [...previous, {
        role: 'assistant', content: data.assistant_message || 'The BI query completed.',
        artifacts: biArtifacts, dashboard_draft: draft,
        suggested_actions: data.suggested_actions || [],
        grounded: verified, session_state: nextSessionState, scope: dataScope,
      }]);
      setSessionState(nextSessionState);
      if (data.governance_readiness?.status === 'warning') {
        setGovernanceWarning(data.governance_readiness.reasons?.[0]?.message || 'The data has a quality warning that may affect this result.');
      }
      const latest = biArtifacts[biArtifacts.length - 1];
      if (latest && !draft) setActiveArtifact(latest);
    } catch (failure) {
      if (!isCurrent() || controller.signal.aborted) return;
      const detail = failure.response?.data;
      setError(detail?.governance_readiness?.reasons?.[0]?.message || detail?.error?.message
        || (failure.code === 'ECONNABORTED' ? 'This analysis took too long. Retry or ask a narrower question.' : 'Could not complete this analysis. Check your data connection and try again.'));
      setFailedRequest({ message, previousState: biSessionState, refinement, scope: dataScope });
      setUserInput(current => current || message);
    } finally {
      if (requestRef.current === request) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  };

  const handleSendMessage = () => submitTurn({ message: userInput });

  const handleSuggestedAction = (action, previousSessionState) => {
    if (action?.enabled && action.kind === 'analytics_refinement' && action.analytics_refinement) {
      return submitTurn({ message: action.label, previousState: previousSessionState, refinement: action.analytics_refinement });
    }
  };

  const stopRequest = () => {
    const request = requestRef.current;
    if (!request) return;
    request.controller.abort();
    requestRef.current = null;
    setLoading(false);
    setUserInput(current => current || request.message);
    setNotice('Stopped waiting for this result. Edit your question or send it again.');
  };

  const saveResult = artifact => {
    try {
      const result = addDashboardResults([{ artifact }]);
      setError(null);
      setPinFeedbackIds(previous => ({ ...previous, [resultKey(artifact)]: true }));
      setNotice(result.added.length ? 'Result saved to your dashboard.' : 'This result is already on your dashboard.');
    } catch (failure) {
      setError(failure.message);
    }
  };

  const handleKeyDown = (event) => {
    if (event.nativeEvent?.isComposing || event.isComposing) return;
    if (isMentionOpen) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsMentionOpen(false);
        return;
      }

      const filteredDatasets = datasets.filter((dataset) => (
        dataset.name.toLowerCase().includes(mentionQuery?.toLowerCase() || '')
      ));
      if (filteredDatasets.length > 0) {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setHighlightedIndex((previous) => Math.min(previous + 1, filteredDatasets.length - 1));
          return;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          setHighlightedIndex((previous) => Math.max(previous - 1, 0));
          return;
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          handleMentionSelect(filteredDatasets[Math.min(highlightedIndex, filteredDatasets.length - 1)].name);
          setHighlightedIndex(0);
          return;
        }
      }
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className={`ai-shell ${isResultsPaneOpen ? 'has-open-results' : ''}`}>
      <header className="ai-shell__header">
        <div className="ai-shell__header-left">
          <Tooltip title={isSidebarOpen ? 'Hide sidebar for more chat space' : 'Show chat sidebar'}>
            <button type="button" className="ai-shell__sidebar-toggle"
              aria-label={isSidebarOpen ? 'Hide chat sidebar' : 'Show chat sidebar'}
              aria-expanded={isSidebarOpen} aria-controls="ai-chat-navigation"
              onClick={() => setIsSidebarOpen(open => !open)}><FaBars /></button>
          </Tooltip>
          <div className="ai-shell__brand-mark" aria-hidden="true"><FaLayerGroup /></div>
          <div className="ai-shell__titles">
            <h1 className="ai-shell__main-title">AI Chat <span>Business intelligence</span></h1>
            <p className="ai-shell__header-subtitle">From a good question to a clear next step.</p>
          </div>
        </div>
        <div className="ai-shell__header-right">
          <button type="button" className="ai-shell__header-action ai-shell__dashboard-link" aria-label="Open dashboard" onClick={viewDashboard}>
            <FaChartBar /><span>Dashboard</span><FaExternalLinkAlt className="ai-shell__external-icon" />
          </button>
          <button ref={resultsToggleRef} type="button" className={`ai-shell__header-action ${isResultsPaneOpen ? 'is-selected' : ''}`}
            aria-label="Toggle Results Pane" aria-expanded={isResultsPaneOpen} aria-controls="ai-chat-results"
            onClick={() => setIsResultsPaneOpen(open => !open)}>
            <FaEye /><span>Results</span>{activeArtifact && <span className="ai-shell__result-dot" />}
          </button>
        </div>
      </header>

      <div className="ai-shell__body">
      <nav id="ai-chat-navigation" className={`ai-shell__left-rail ${isSidebarOpen ? 'is-open' : 'is-collapsed'}`}
        aria-label="Chat tools" aria-hidden={!isSidebarOpen} inert={!isSidebarOpen ? '' : undefined}>
        <div className="ai-shell__rail-inner">
        <div className="ai-shell__rail-top">
          <span className="ai-shell__rail-label">Workspace</span>
          <Tooltip title="AI Chat" placement="right">
            <span className="ai-shell__rail-item is-active" aria-current="page"><FaRobot /><span>Chat</span></span>
          </Tooltip>
          <Tooltip title="Choose data" placement="right">
            <button type="button" className="ai-shell__rail-item" aria-label="Choose data" onClick={chooseData}><FaDatabase /><span>Data</span></button>
          </Tooltip>
          <Tooltip title="Prepare a cleaning request" placement="right">
            <button type="button" className="ai-shell__rail-item" aria-label="Clean Data" onClick={() => { setUserInput('/clean'); inputRef.current?.focus(); }}><FaShieldAlt /><span>Prepare</span></button>
          </Tooltip>
        </div>
        <div className="ai-shell__rail-bottom">
          <span className="ai-shell__rail-label">Your work</span>
          <Tooltip title="Open dashboard" placement="right">
            <button type="button" className="ai-shell__rail-item" aria-label="Go to dashboard" onClick={viewDashboard}><FaChartBar /><span>Dashboard</span></button>
          </Tooltip>
          <Tooltip title="Show results" placement="right">
            <button type="button" className="ai-shell__rail-item" aria-label="Show results" onClick={() => setIsResultsPaneOpen(true)}><FaEye /><span>Results</span></button>
          </Tooltip>
        </div>
        </div>
      </nav>

      <main className="ai-shell__workspace">
        <details className="ai-shell__data-context">
          <summary>
            <span className="ai-shell__source-icon"><FaDatabase /></span>
            <span className="ai-shell__source-name"><span>Working with</span><strong>{datasetLabel}</strong></span>
            <span className="ai-shell__source-status"><FaCircle className={`ai-shell__indicator is-${connectionStatus.data.toLowerCase()}`} />{semanticModel?.metrics?.length || 0} metrics</span>
            <FaChevronDown className="ai-shell__details-chevron" />
          </summary>
          <div className="ai-shell__data-details">
          <p>Metrics: {semanticModel?.metrics?.map(item => item.label || item.name).join(', ') || 'Select data to see available metrics.'}</p>
          <p>Breakdowns: {semanticModel?.dimensions?.map(item => item.label || item.field).join(', ') || 'No semantic dimensions loaded.'}</p>
          {activeWorkspace?.workspace_id && <p>Queries use the active workspace model. Source relationships are validated by the server.</p>}
          </div>
        </details>

        <div className={`ai-shell__conversation ${userMessages.length === 0 ? 'is-empty' : ''}`} ref={chatBodyRef} aria-label="Conversation">
          {userMessages.length === 0 && (
            <div className="ai-shell__welcome-hero">
              <div className="ai-shell__hero-eyebrow"><span className="ai-shell__hero-icon"><FaChartLine /></span>Your data, a little clearer</div>
              <Typography component="h2" className="ai-shell__hero-title">What would you like<br />to understand?</Typography>
              <Typography variant="body1" className="ai-shell__hero-subtitle">
                Explore a metric, spot a trend, or turn a question into a dashboard. Start with what matters to your business.
              </Typography>
              {suggestions.length > 0 ? <>
                <div className="ai-shell__section-label">A few places to start</div>
                <div className="ai-shell__starter-grid" aria-label="Suggested business questions">
                  {suggestions.map(question => {
                    const kind = question.startsWith('Build') ? 'dashboard' : question.includes('monthly') ? 'trend' : question.includes('as a chart') ? 'breakdown' : 'metric';
                    const label = { dashboard: 'Build a dashboard', trend: 'Follow a trend', breakdown: 'Compare a breakdown', metric: 'Explore a metric' }[kind];
                    const QuestionIcon = { dashboard: FaLayerGroup, trend: FaChartLine, breakdown: FaChartBar, metric: FaDatabase }[kind];
                    return <button key={question} type="button" aria-label={question} onClick={() => { setUserInput(question); inputRef.current?.focus(); }}>
                      <span className="ai-shell__starter-heading"><QuestionIcon /><span>{label}</span><FaArrowRight /></span>
                      <span className="ai-shell__starter-question">{question}</span>
                    </button>;
                  })}
                </div>
              </> : <div className="ai-shell__connect-card">
                <FaDatabase /><div><strong>Start with your data</strong><p>Choose a dataset to ask questions in context.</p></div>
                <button type="button" onClick={chooseData}>Choose Dataset <FaArrowRight /></button>
              </div>}
            </div>
          )}

          {userMessages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`ai-shell__message-row is-${message.role}`}>
              {message.role === 'assistant' && <div className="ai-shell__message-avatar" aria-hidden="true"><FaLayerGroup /></div>}
              <div className="ai-shell__message-card">
                <div className="ai-shell__message-header">
                  <span className="ai-shell__message-author">{message.role === 'user' ? 'You' : 'AI Chat'}</span>
                  {message.grounded && (
                    <span className="ai-shell__grounded-tag"><FaShieldAlt /> Grounded</span>
                  )}
                </div>
                <div className="ai-shell__message-content">{message.content}</div>

                {message.dashboard_draft && <DashboardDraft draft={message.dashboard_draft} onAdd={addDashboardResults} onInspect={handleInspect} onOpenDashboard={viewDashboard} />}

                {!message.dashboard_draft && message.artifacts?.length > 0 && (
                  <div className="ai-shell__artifact-container">
                    {message.artifacts.map((artifact, artifactIndex) => (
                      <React.Fragment key={artifact.artifact_id || artifact.id || artifactIndex}>
                        {renderArtifact(artifact, false)}
                      </React.Fragment>
                    ))}
                  </div>
                )}

                {message.suggested_actions?.length > 0 && (
                  <div className="ai-shell__suggested-actions">
                    {message.suggested_actions.map(action => {
                      const isDisabled = !action.enabled || loading || message.scope !== dataScope;
                      const title = isDisabled ? action.disabled_reason || 'Action disabled' : '';
                      return (
                        <Tooltip key={action.action_id} title={title}>
                          <span>
                            <Chip
                              label={action.label}
                              onClick={isDisabled ? undefined : () => handleSuggestedAction(action, message.session_state)}
                              disabled={isDisabled}
                              className={`ai-shell__suggested-action-chip ${isDisabled ? 'is-disabled' : 'is-enabled'}`}
                              clickable={!isDisabled}
                              variant="outlined"
                              size="small"
                            />
                          </span>
                        </Tooltip>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="ai-shell__message-row is-assistant">
              <div className="ai-shell__message-card is-loading">
                <div className="ai-shell__typing"><span /><span /><span /></div>
                <span role="status">Analyzing your data…</span>
                <button type="button" onClick={stopRequest}>Stop waiting</button>
              </div>
            </div>
          )}
          {governanceWarning && (
            <div className="ai-shell__alert-bar is-warning">
              <FaExclamationTriangle /> {governanceWarning}
            </div>
          )}
          {notice && <div className="ai-shell__notice" role="status">{notice}</div>}
          {error && <div className="ai-shell__alert-bar" role="alert"><FaInfoCircle /> {error}
            {failedRequest?.scope === dataScope && <button type="button" disabled={loading} onClick={() => submitTurn({ ...failedRequest, retry: true })}>Retry last question</button>}
          </div>}
        </div>

        <div className="ai-shell__footer">
          <div className="ai-shell__input-wrapper">
            {isMentionOpen && (
              <MentionDropdown
                query={mentionQuery}
                position={mentionPosition}
                onSelect={handleMentionSelect}
                onClose={() => setIsMentionOpen(false)}
                highlightedIndex={highlightedIndex}
                onHighlight={setHighlightedIndex}
              />
            )}
            <div className="ai-shell__input-bar">
              <TextField
                inputRef={inputRef}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question about your business…"
                inputProps={{ 'aria-label': 'Business question' }}
                variant="standard"
                fullWidth
                value={userInput}
                onChange={handleInputChange}
                multiline
                maxRows={6}
                InputProps={{ disableUnderline: true }}
              />
            </div>
            <div className="ai-shell__composer-toolbar">
              <div className="ai-shell__composer-tools">
                <Tooltip title="Choose data without clearing your question">
                  <button type="button" className="ai-shell__composer-tool" aria-label="Choose dataset for question" onClick={chooseData}><FaPlus /><span>Data</span></button>
                </Tooltip>
                <Tooltip title="Prepare a data cleaning request">
                  <button type="button" className="ai-shell__composer-tool" aria-label="Prepare data cleaning question" onClick={() => { setUserInput('/clean'); inputRef.current?.focus(); }}><FaShieldAlt /><span>Clean</span></button>
                </Tooltip>
              </div>
              <span className="ai-shell__keyboard-hint"><kbd>Enter</kbd> to send</span>
              <button
                type="button"
                className="ai-shell__send-btn"
                onClick={handleSendMessage}
                disabled={loading || !userInput.trim()}
                aria-label="Send Message"
              >
                {loading ? <div className="ai-shell__spinner" /> : <><span>Send</span><FaArrowUp className="ai-shell__send-icon" /></>}
              </button>
            </div>
          </div>
          <div className="ai-shell__composer-hint"><FaShieldAlt /><span>Answers grounded in your data. Review the details behind each result.</span></div>
        </div>
      </main>

      <aside id="ai-chat-results" aria-label="BI Results" hidden={!isResultsPaneOpen} className={`ai-shell__results-pane ${isResultsPaneOpen ? 'is-open' : 'is-closed'} ${activeArtifact ? 'has-result' : ''}`}>
        <div className="ai-shell__pane-header">
          <div><span className="ai-shell__section-label">Your analysis</span><h2 ref={resultsHeadingRef} tabIndex={-1}>Result details</h2></div>
          <IconButton onClick={closeResults} size="small" aria-label="Close Results Pane">
            <FaTimes />
          </IconButton>
        </div>

        <div className="ai-shell__result-viewer">
          {activeArtifact && <div className="ai-shell__viewer-label"><FaCircle /><span>{activeArtifact.title || 'Active result'}</span></div>}
          {activeArtifact ? (
            renderArtifact(activeArtifact, true)
          ) : (
            <div className="ai-shell__viewer-empty">
              <div className="ai-shell__viewer-empty-icon"><FaChartBar /></div>
              <h3>Room for a closer look</h3>
              <p>Your charts and business results appear here, with the details behind every answer.</p>
              <div className="ai-shell__result-guide">
                <div><FaEye /><span><strong>Explore the result</strong><span>Inspect charts and key numbers.</span></span></div>
                <div><FaDatabase /><span><strong>See the source</strong><span>Review metrics, filters and data.</span></span></div>
                <div><FaLayerGroup /><span><strong>Keep what matters</strong><span>Save useful results to a dashboard.</span></span></div>
              </div>
            </div>
          )}
        </div>
      </aside>
      </div>
    </div>
  );
}

export default AIShell;
