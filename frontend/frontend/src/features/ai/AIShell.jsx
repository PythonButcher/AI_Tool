import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import {
  FaChartBar,
  FaCheckCircle,
  FaChevronRight,
  FaCircle,
  FaCloud,
  FaDatabase,
  FaExclamationTriangle,
  FaExternalLinkAlt,
  FaEye,
  FaFilePdf,
  FaInfoCircle,
  FaLayerGroup,
  FaPaperPlane,
  FaPlus,
  FaRobot,
  FaShieldAlt,
  FaTerminal,
  FaThumbtack,
  FaTools,
} from 'react-icons/fa';
import {
  Avatar,
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

const TrustedResultCard = ({ biGrounding }) => {
  if (!biGrounding) return null;

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
  } = biGrounding;

  const datasetName = dataset?.dataset_name || 'unknown';
  const rowCount = row_count ?? 'unknown';
  const sourceRowCount = source_row_count ?? 'unknown';
  const metricName = metric_definition?.label || metric_definition?.name;

  return (
    <div className="ai-shell__trusted-result">
      <div className="ai-shell__trusted-header">
        <FaShieldAlt /> <span>BI Grounding</span>
      </div>
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
              {filters.map(f => `${f.field || 'unknown'} ${f.operator || ''} ${f.value ?? f.values?.join(',') ?? ''}`).join(' AND ')}
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
      </div>
    </div>
  );
};

/**
 * AI Chat keeps its established split-pane layout while returning to a focused
 * workflow: grounded answers, tables, charts, and conversational refinements.
 */
function AIShell() {
  const {
    cleanedData,
    fullData,
    setCleanedData,
    semanticModel,
    refreshSemanticModelFromDataset,
  } = useContext(DataContext);
  const { datasets = [] } = useContext(WarehouseContext);
  const { addDashboardChart, addChart } = useWindowContext();

  const [userMessages, setUserMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [governanceWarning, setGovernanceWarning] = useState(null);
  const [awaitingCleanInstructions, setAwaitingCleanInstructions] = useState(false);
  const [sessionState, setSessionState] = useState({ active_mode: 'explore' });
  const [activeArtifact, setActiveArtifact] = useState(null);
  const [isResultsPaneOpen, setIsResultsPaneOpen] = useState(true);
  const [pinFeedbackIds, setPinFeedbackIds] = useState({});

  const [mentionQuery, setMentionQuery] = useState(null);
  const [isMentionOpen, setIsMentionOpen] = useState(false);
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const inputRef = useRef(null);
  const chatBodyRef = useRef(null);

  const connectionStatus = useMemo(() => {
    const dataLoaded = (cleanedData?.length > 0) || (fullData?.length > 0);
    return {
      semantic: semanticModel ? 'Active' : 'Standby',
      data: dataLoaded ? 'Connected' : 'Disconnected',
    };
  }, [semanticModel, cleanedData, fullData]);

  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTo({
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

  const renderAnswerContent = (content = {}) => {
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
              {renderExportButton(artifact)}
              {!isInspector && inspectable && (
                <IconButton size="small" onClick={() => handleInspect(artifact)} aria-label="Open result">
                  <FaExternalLinkAlt style={{ fontSize: '0.7rem' }} />
                </IconButton>
              )}
            </div>
          </div>
          <div className="ai-shell__artifact-content">{renderAnswerContent(content)}</div>
          <TrustedResultCard biGrounding={artifact.bi_grounding} />
        </div>
      );
    }

    if (!isInspector) {
      return (
        <div className="ai-shell__artifact-preview-container">
          <div className="ai-shell__artifact-preview-link" onClick={() => handleInspect(artifact)}>
            <div className="ai-shell__preview-icon"><FaChartBar /></div>
            <div className="ai-shell__preview-info">
              <Typography variant="caption" className="ai-shell__preview-type">Visualization</Typography>
              <Typography variant="body2" className="ai-shell__preview-title">
                {artifact.title || content.title || content.explanation || `${content.chartType || 'Chart'} result`}
              </Typography>
            </div>
            <div className="ai-shell__preview-actions">
              {renderExportButton(artifact, 'is-preview-export')}
              <IconButton size="small" className="ai-shell__preview-action" aria-label="Open chart">
                <FaChevronRight />
              </IconButton>
            </div>
          </div>
          <TrustedResultCard biGrounding={artifact.bi_grounding} />
        </div>
      );
    }

    return (
      <div className={`${baseClass} is-chart`}>
        <div className="ai-shell__artifact-content" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
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
                onClick={() => {
                  addDashboardChart({
                    type: content.chartType || 'Bar',
                    mapping: content.chartData?.mapping || {},
                    dataSourceMode: 'semantic',
                    chartSpec: content.chartSpec,
                  });
                  const feedbackId = artifact.id || artifact.artifact_id || 'active-chart';
                  setPinFeedbackIds((previous) => ({ ...previous, [feedbackId]: true }));
                  setTimeout(() => {
                    setPinFeedbackIds((previous) => ({ ...previous, [feedbackId]: false }));
                  }, 2000);
                }}
              >
                {pinFeedbackIds[artifact.id || artifact.artifact_id || 'active-chart'] ? 'Pinned!' : 'Pin to Dashboard'}
              </Button>
              <Button
                variant="outlined"
                size="medium"
                startIcon={<FaChartBar />}
                onClick={() => addChart({
                  type: content.chartType || 'Bar',
                  mapping: content.chartData?.mapping || {},
                  dataSourceMode: 'semantic',
                  chartSpec: content.chartSpec,
                })}
              >
                Open Chart Window
              </Button>
            </div>
          )}

          <AICharts aiChartType={content.chartType || 'Bar'} aiChartData={content.chartData} />
          {content.explanation && (
            <Typography variant="body2" sx={{ mt: 2, lineHeight: 1.7, opacity: 0.75 }}>
              {content.explanation}
            </Typography>
          )}
        </div>
        <TrustedResultCard biGrounding={artifact.bi_grounding} />
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

  const handleInputChange = (event) => {
    const value = event.target.value;
    const cursorPosition = event.target.selectionStart;
    setUserInput(value);
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

  const runCleanCommand = async (message, datasetContext, followUp = false) => {
    const parts = message.split(' ');
    const instructions = followUp ? message : (parts.length > 1 ? parts.slice(1).join(' ') : null);
    const response = await axios.post(`${API_URL}/ai_cmd`, {
      command: '/clean',
      dataset: datasetContext,
      instructions,
    });

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

  const handleSendMessage = async () => {
    const message = userInput.trim();
    if (!message || loading) return;

    const tokens = extractTokens(message, datasets);
    const datasetContext = resolveDatasetForNlp();
    setUserInput('');
    setLoading(true);
    setError(null);
    setGovernanceWarning(null);
    setUserMessages((previous) => [
      ...previous,
      { role: 'user', content: message, grounded: tokens.length > 0 },
    ]);

    try {
      if (AICommands.isCommand(message) && message.split(' ')[0] === '/clean') {
        const reply = await runCleanCommand(message, datasetContext, false);
        setUserMessages((previous) => [...previous, { role: 'assistant', content: reply, grounded: true }]);
        return;
      }

      if (awaitingCleanInstructions) {
        const reply = await runCleanCommand(message, datasetContext, true);
        setUserMessages((previous) => [...previous, { role: 'assistant', content: reply, grounded: true }]);
        return;
      }

      const biSessionState = buildBiSessionState(sessionState);
      const {
        payloadDataset,
        payloadSemanticModel,
        datasetRef,
      } = resolveRequestContext(biSessionState, tokens);

      const response = await axios.post(`${API_URL}/api/decision/chat/turns`, {
        user_message: message,
        dataset: payloadDataset,
        semantic_model: payloadSemanticModel,
        dataset_ref: datasetRef,
        resolved_datasets: tokens,
        requested_mode: (payloadDataset || datasetRef) ? 'explore' : 'ask',
        conversation_history: userMessages
          .map(({ role, content }) => ({ role, content }))
          .slice(-10),
        session_state: biSessionState,
      });

      const data = response.data;
      if (data.status !== 'success') {
        throw new Error(data.error?.message || 'The BI query could not be completed.');
      }

      const biArtifacts = filterBiArtifacts(data.artifacts);
      const responseEnteredDecisionMode = data.mode === 'decide'
        || (Array.isArray(data.artifacts) && data.artifacts.some((artifact) => !BI_ARTIFACT_TYPES.has(artifact?.type)));
      const assistantMessage = responseEnteredDecisionMode && biArtifacts.length === 0
        ? 'Ask about a metric, segment, time period, comparison, table, or chart and I will analyze the active data.'
        : (data.assistant_message || 'The BI query completed.');
      const nextSessionState = buildBiSessionState(data.session_state);

      setUserMessages((previous) => [...previous, {
        role: 'assistant',
        content: assistantMessage,
        artifacts: biArtifacts,
        grounded: Boolean(payloadDataset || datasetRef),
        session_state: nextSessionState,
      }]);
      setSessionState(nextSessionState);

      if (data.governance_readiness?.status === 'warning') {
        setGovernanceWarning(
          data.governance_readiness.reasons?.[0]?.message
          || 'The active dataset has a quality warning that may affect this result.',
        );
      }

      const lastBiArtifact = biArtifacts[biArtifacts.length - 1];
      if (lastBiArtifact) {
        setActiveArtifact(lastBiArtifact);
        setIsResultsPaneOpen(true);
      }
    } catch (requestError) {
      const readinessMessage = requestError.response?.data?.governance_readiness?.reasons?.[0]?.message;
      setError(readinessMessage || requestError.message || 'Could not reach the analytics service.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event) => {
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
          handleMentionSelect(filteredDatasets[highlightedIndex].name);
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
    <div className="ai-shell">
      <nav className="ai-shell__left-rail">
        <div className="ai-shell__rail-top">
          <Tooltip title="AI Chat" placement="right">
            <div className="ai-shell__rail-item is-active"><FaRobot /></div>
          </Tooltip>
          <Tooltip title="Data Connections" placement="right">
            <div className="ai-shell__rail-item"><FaDatabase /></div>
          </Tooltip>
          <Tooltip title="Custom Workflows" placement="right">
            <div className="ai-shell__rail-item"><FaTools /></div>
          </Tooltip>
        </div>
        <div className="ai-shell__rail-bottom">
          <Tooltip title="AI Settings" placement="right">
            <div className="ai-shell__rail-item"><FaLayerGroup /></div>
          </Tooltip>
        </div>
      </nav>

      <main className="ai-shell__workspace">
        <header className="ai-shell__header">
          <div className="ai-shell__header-left">
            <Avatar className="ai-shell__avatar"><FaRobot /></Avatar>
            <div className="ai-shell__titles">
              <Typography variant="subtitle2" className="ai-shell__main-title">Business Intelligence Agent</Typography>
              <div className="ai-shell__status-bar">
                <span className="ai-shell__status-item">
                  <FaCircle className={`ai-shell__indicator is-${connectionStatus.data.toLowerCase()}`} />
                  {connectionStatus.data}
                </span>
                <span className="ai-shell__status-item">
                  <FaCloud className={`ai-shell__indicator is-${connectionStatus.semantic.toLowerCase()}`} />
                  Semantic {connectionStatus.semantic}
                </span>
              </div>
            </div>
          </div>
          <div className="ai-shell__header-right">
            <IconButton onClick={() => setIsResultsPaneOpen((open) => !open)} size="small" aria-label="Toggle Results Pane">
              <FaEye style={{ color: isResultsPaneOpen ? 'var(--text-primary)' : 'var(--text-secondary)' }} />
            </IconButton>
          </div>
        </header>

        <div className="ai-shell__conversation" ref={chatBodyRef}>
          {userMessages.length === 0 && (
            <div className="ai-shell__welcome-hero">
              <div className="ai-shell__hero-icon"><FaRobot /></div>
              <Typography variant="h4" className="ai-shell__hero-title">Business Intelligence</Typography>
              <Typography variant="body1" className="ai-shell__hero-subtitle">
                Ask plain-language questions about your data, compare business metrics, and create charts.
              </Typography>
              <div className="ai-shell__hero-actions">
                <Chip icon={<FaPlus />} label="Choose Dataset" onClick={() => setUserInput('@')} clickable />
                <Chip icon={<FaChartBar />} label="Create Chart" onClick={() => setUserInput('Show ')} clickable />
                <Chip icon={<FaShieldAlt />} label="Clean Data" onClick={() => setUserInput('/clean')} clickable />
              </div>
            </div>
          )}

          {userMessages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`ai-shell__message-row is-${message.role}`}>
              <div className="ai-shell__message-card">
                <div className="ai-shell__message-header">
                  <span className="ai-shell__message-author">{message.role === 'user' ? 'You' : 'Agent'}</span>
                  {message.grounded && (
                    <span className="ai-shell__grounded-tag"><FaShieldAlt /> Grounded</span>
                  )}
                </div>
                <div className="ai-shell__message-content">{message.content}</div>

                {message.artifacts?.length > 0 && (
                  <div className="ai-shell__artifact-container">
                    {message.artifacts.map((artifact, artifactIndex) => (
                      <React.Fragment key={artifact.artifact_id || artifact.id || artifactIndex}>
                        {renderArtifact(artifact, false)}
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="ai-shell__message-row is-assistant">
              <div className="ai-shell__message-card is-loading">
                <div className="ai-shell__typing"><span /><span /><span /></div>
              </div>
            </div>
          )}
          {governanceWarning && (
            <div className="ai-shell__alert-bar" style={{ backgroundColor: '#fff3cd', color: '#856404' }}>
              <FaExclamationTriangle /> {governanceWarning}
            </div>
          )}
          {error && <div className="ai-shell__alert-bar"><FaInfoCircle /> {error}</div>}
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
                placeholder="Ask a business question, or type @ to choose data..."
                variant="standard"
                fullWidth
                value={userInput}
                onChange={handleInputChange}
                disabled={loading}
                multiline
                maxRows={6}
                InputProps={{ disableUnderline: true }}
              />
              <button
                className="ai-shell__send-btn"
                onClick={handleSendMessage}
                disabled={loading || !userInput.trim()}
                aria-label="Send Message"
              >
                {loading ? <div className="ai-shell__spinner" /> : <FaPaperPlane className="ai-shell__send-icon" />}
              </button>
            </div>
          </div>
        </div>
      </main>

      <aside className={`ai-shell__results-pane ${isResultsPaneOpen ? 'is-open' : 'is-closed'}`}>
        <div className="ai-shell__pane-header">
          <Typography variant="overline" sx={{ fontWeight: 900, letterSpacing: '0.15em' }}>BI Results</Typography>
          <IconButton onClick={() => setIsResultsPaneOpen(false)} size="small" aria-label="Close Results Pane">
            <FaChevronRight />
          </IconButton>
        </div>

        <div className="ai-shell__result-viewer">
          <div className="ai-shell__viewer-label"><FaEye /> Active Result</div>
          {activeArtifact ? (
            renderArtifact(activeArtifact, true)
          ) : (
            <div className="ai-shell__viewer-empty">
              <div className="ai-shell__viewer-empty-icon"><FaTerminal /></div>
              <Typography variant="caption">
                Ask a question to display the latest business result or chart here.
              </Typography>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

export default AIShell;
