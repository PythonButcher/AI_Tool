import React, { useState, useContext, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import { 
  FaRobot, FaRegCommentDots, FaTools, FaBook, FaDatabase, FaPlus, FaLightbulb, 
  FaHistory, FaChartBar, FaShieldAlt, FaCircle, FaInfoCircle, FaPaperPlane,
  FaCheckCircle, FaExclamationTriangle, FaExternalLinkAlt, FaLayerGroup, FaFileAlt,
  FaEye, FaChevronRight, FaTerminal, FaSearch, FaCloud
} from "react-icons/fa";
import { 
  TextField, Button, Paper, Box, Typography, Divider, Tooltip, Chip, 
  Avatar, Tabs, Tab, Drawer, IconButton, ToggleButton, ToggleButtonGroup
} from '@mui/material';
import { DataContext } from '../../context/DataContext';
import { WarehouseContext } from '../../context/WarehouseContext';
import MentionDropdown from '../../components/data_management/MentionDropdown';
import { detectToken, extractTokens } from '../../utils/mentionUtils';
import { AICommands } from '../workflow/AiCommandBlock';
import { getDynamicColors } from '../../utils/ChartStyles';
import { summarizeSemanticModel } from '../../utils/semanticModelUtils';
import AICharts from './AICharts';
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

const formatChartData = (chartResponse) => {
  const labels = chartResponse.chartData.map(item => {
    if (typeof item === "object") {
      const labelKey = Object.keys(item).find(k => k.toLowerCase() !== "value") || "label";
      return String(item[labelKey]);
    }
    return String(item);
  });

  const data = chartResponse.chartData.map(item =>
    typeof item === "object" && "value" in item
      ? Number(item.value) || 0
      : Number(item) || 0
  );

  const colors = getDynamicColors(labels.length);

  return {
    labels,
    datasets: [{
      label: chartResponse.chartType || "AI-Generated Chart",
      data,
      backgroundColor: colors.map(c => c.backgroundColor),
      borderColor: colors.map(c => c.borderColor),
      borderWidth: 1,
    }]
  };
};

/**
 * AIShell (Analytics-Agent Workspace)
 * 
 * Re-implemented as a high-fidelity workspace with split conversation and inspection.
 */
function AIShell({ setShowAIChart, setAiChartType, setAiChartData }) {
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

  const handleActionClick = async (actionId) => {
    setLoading(true);
    setError(null);

    const payload = {
      action: actionId,
      session_state: sessionState,
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
          suggested_actions: data.session_state?.available_actions || []
        };
        setUserMessages(prev => [...prev, newAssistantMsg]);
        setSessionState(data.session_state || {});
        
        if (data.artifacts && data.artifacts.length > 0) {
          setActiveArtifact(data.artifacts[data.artifacts.length - 1]);
          setIsResultsPaneOpen(true);
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

  const handleModeChange = (event, newMode) => {
    if (!newMode) return;
    setActiveMode(newMode);
    setSessionState(prev => ({ ...prev, active_mode: newMode }));
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

  const renderArtifact = (artifact, isInspector = false) => {
    if (!artifact) return null;

    const baseClass = isInspector ? "ai-shell__active-artifact" : "ai-shell__artifact-card";

    switch (artifact.type) {
      case 'answer':
        return (
          <div className={`${baseClass} is-answer`}>
            {!isInspector && <div className="ai-shell__artifact-header"><span className="ai-shell__artifact-title"><FaCheckCircle /> Result</span></div>}
            <div className="ai-shell__artifact-content">{renderAnswerArtifact(artifact.content)}</div>
          </div>
        );

      case 'chart':
        return (
          <div className={`${baseClass} is-chart`}>
            {!isInspector && <div className="ai-shell__artifact-header"><span className="ai-shell__artifact-title"><FaChartBar /> Visualization</span></div>}
            <div className="ai-shell__artifact-content">
              <AICharts aiChartType={artifact.content?.chartType || 'Bar'} aiChartData={artifact.content?.chartData} />
              {artifact.content?.explanation && (
                <Typography variant="caption" sx={{ mt: 2, display: 'block', opacity: 0.6 }}>{artifact.content.explanation}</Typography>
              )}
            </div>
          </div>
        );

      case 'workspace_preview':
        const wp = artifact.content || artifact;
        return (
          <div className={`${baseClass} is-workspace_preview`}>
            {!isInspector && <div className="ai-shell__artifact-header"><span className="ai-shell__artifact-title"><FaLayerGroup /> Workspace Draft</span></div>}
            <div className="ai-shell__artifact-content">
              <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1 }}>{wp.title || 'Decision Path'}</Typography>
              <Typography variant="body2" sx={{ opacity: 0.7, mb: 3 }}>{wp.scope_summary}</Typography>
              <div className="ai-shell__preview-grid">
                <div className="ai-shell__preview-metric"><span className="ai-shell__preview-metric-label">Status</span><span className="ai-shell__preview-metric-value">{wp.status || 'Draft'}</span></div>
                <div className="ai-shell__preview-metric"><span className="ai-shell__preview-metric-label">Levers</span><span className="ai-shell__preview-metric-value">{wp.lever_count || 0}</span></div>
                <div className="ai-shell__preview-metric"><span className="ai-shell__preview-metric-label">Inputs Needed</span><span className="ai-shell__preview-metric-value" style={{ color: (wp.missing_inputs?.length > 0 ? 'var(--accent-red)' : 'inherit') }}>{wp.missing_inputs?.length || 0}</span></div>
              </div>
            </div>
          </div>
        );

      case 'workspace_analysis_summary':
        return (
          <div className={`${baseClass} is-workspace_analysis_summary`}>
            {!isInspector && <div className="ai-shell__artifact-header"><span className="ai-shell__artifact-title"><FaFileAlt /> Intelligence Summary</span></div>}
            <div className="ai-shell__artifact-content">
              {artifact.content?.items ? (
                <div className="ai-shell__analysis-list">
                  {artifact.content.items.map((item, i) => (
                    <div key={i} className="ai-shell__analysis-item">
                      <span className={`ai-shell__analysis-icon ${item.blocks_simulation ? 'is-blocker' : 'is-assumption'}`}>
                        {item.blocks_simulation ? <FaExclamationTriangle /> : <FaCheckCircle />}
                      </span>
                      <Typography variant="body2">{item.statement || item.description || item}</Typography>
                    </div>
                  ))}
                </div>
              ) : (
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{artifact.content?.summary?.headline || 'Analysis finalized.'}</Typography>
              )}
            </div>
          </div>
        );

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
            reply = "Optimization complete. Context is stable.";
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
          reply = resp.data.suggestions || "Clarification required for optimization.";
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
          mode: data.mode
        };
        setUserMessages(prev => [...prev, newMsg]);
        setSessionState(data.session_state || {});
        if (data.mode) setActiveMode(data.mode);
        
        if (data.artifacts && data.artifacts.length > 0) {
          setActiveArtifact(data.artifacts[data.artifacts.length - 1]);
          setIsResultsPaneOpen(true);
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
              >
                {m.id === 'ask' ? <FaRegCommentDots /> : m.id === 'explore' ? <FaChartBar /> : <FaLightbulb />}
              </button>
            </Tooltip>
          ))}
        </div>
        <div className="ai-shell__rail-middle">
          <div className="ai-shell__rail-divider" />
          <Tooltip title="Skills" placement="right"><button className="ai-shell__rail-item is-disabled"><FaTools /><span className="ai-shell__dot-alert" /></button></Tooltip>
          <Tooltip title="Library" placement="right"><button className="ai-shell__rail-item" onClick={() => {/* Placeholder for Library */}}><FaHistory /></button></Tooltip>
          <Tooltip title="Context & Metadata" placement="right">
            <button 
              className={`ai-shell__rail-item ${isContextPaneOpen ? 'is-active' : ''}`} 
              onClick={() => setIsContextPaneOpen(true)}
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
          <IconButton onClick={() => setIsContextPaneOpen(false)} size="small" sx={{ color: 'var(--text-secondary)' }}><FaChevronRight style={{ transform: 'rotate(180deg)' }} /></IconButton>
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
              <Typography variant="caption" sx={{ opacity: 0.5 }}>Reserved for handoff to structured simulation path.</Typography>
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
             <IconButton onClick={() => setIsResultsPaneOpen(!isResultsPaneOpen)} size="small">
               <FaEye style={{ color: isResultsPaneOpen ? 'var(--text-primary)' : 'var(--text-secondary)' }} />
             </IconButton>
          </div>
        </header>

        {/* Workspace Level Tabs */}
        <div className="ai-shell__workspace-tabs">
          <Tabs value={activeWorkspaceTab} onChange={(e, v) => setActiveWorkspaceTab(v)} variant="scrollable" scrollButtons="auto">
            {WORKSPACE_TABS.map(tab => (
              <Tab key={tab.id} label={tab.label} value={tab.id} className="ai-shell__workspace-tab" />
            ))}
          </Tabs>
        </div>

        {/* Functional Mode Selector */}
        <div className="ai-shell__mode-bar">
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
        </div>

        <div className="ai-shell__conversation" ref={chatBodyRef}>
          {userMessages.length === 0 && (
            <div className="ai-shell__welcome-hero">
              <div className="ai-shell__hero-icon"><FaRobot /></div>
              <Typography variant="h4" className="ai-shell__hero-title">
                {activeMode === 'decide' ? 'Draft Strategic Path' : activeMode === 'explore' ? 'Grounded Exploration' : 'Agent Intelligence'}
              </Typography>
              <Typography variant="body1" className="ai-shell__hero-subtitle">
                {activeMode === 'decide' ? 'Frame complex business decisions to evaluate levers and uncertainty.' : activeMode === 'explore' ? 'Identify trends and distributions across your grounded dataset sources.' : 'Ask for high-level summaries or query specific metric performance.'}
              </Typography>
              <div className="ai-shell__hero-actions">
                <Chip icon={<FaPlus />} label="Dataset Bridge" onClick={() => setUserInput('@')} clickable />
                <Chip icon={<FaChartBar />} label="Quick Visual" onClick={() => setUserInput('Visualize ')} clickable />
                <Chip icon={<FaShieldAlt />} label="Grounded Optimization" onClick={() => setUserInput('/clean')} clickable />
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
                    {msg.artifacts.map((art, aIdx) => <React.Fragment key={aIdx}>{renderArtifact(art)}</React.Fragment>)}
                  </div>
                )}

                {msg.suggested_actions && msg.suggested_actions.length > 0 && (
                  <div className="ai-shell__suggested-actions">
                    {msg.suggested_actions.map((act, actIdx) => (
                      <button key={actIdx} className="ai-shell__action-btn" onClick={() => handleActionClick(act.action_id)} disabled={loading || !act.enabled}>{act.label}</button>
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
              <button className="ai-shell__send-btn" onClick={handleSendMessage} disabled={loading || !userInput.trim()}>{loading ? <div className="ai-shell__spinner" /> : <FaPaperPlane className="ai-shell__send-icon" />}</button>
            </div>
          </div>
        </div>
      </main>

      {/* 3. DEDICATED RESULTS PANE (The Major Product Surface) */}
      <aside className={`ai-shell__results-pane ${isResultsPaneOpen ? 'is-open' : 'is-closed'}`}>
        <div className="ai-shell__pane-header">
          <Typography variant="overline" sx={{ fontWeight: 900, letterSpacing: '0.15em' }}>Inspection Workspace</Typography>
          <IconButton onClick={() => setIsResultsPaneOpen(false)} size="small"><FaChevronRight /></IconButton>
        </div>

        {/* Primary Viewer: Dominates above the fold */}
        <div className="ai-shell__result-viewer">
          <div className="ai-shell__viewer-label"><FaEye /> Active Result Viewer</div>
          {activeArtifact ? (
            renderArtifact(activeArtifact, true)
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
