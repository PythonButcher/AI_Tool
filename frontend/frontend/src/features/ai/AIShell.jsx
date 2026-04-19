import React, { useState, useContext, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import { 
  FaRobot, FaRegCommentDots, FaTools, FaBook, FaDatabase, FaPlus, FaLightbulb, 
  FaHistory, FaChartBar, FaShieldAlt, FaCircle, FaInfoCircle, FaBolt,
  FaCheckCircle, FaExclamationTriangle, FaExternalLinkAlt, FaLayerGroup, FaFileAlt
} from "react-icons/fa";
import { TextField, Button, Paper, Box, Typography, Divider, Tooltip, Chip, Avatar, Tabs, Tab } from '@mui/material';
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
 * AIShell (Enterprise Polish)
 * 
 * A unique, high-fidelity Decision Intelligence workspace.
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

  // Behavior State
  const [userMessages, setUserMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [awaitingCleanInstructions, setAwaitingCleanInstructions] = useState(false);
  
  // Phase 4 Decision Chat State
  const [sessionState, setSessionState] = useState({});
  const [activeMode, setActiveMode] = useState('ask'); // ask, explore, decide

  // Mention State
  const [mentionQuery, setMentionQuery] = useState(null);
  const [isMentionOpen, setIsMentionOpen] = useState(false);
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  // Shell State
  const [activeSession, setActiveSession] = useState('Executive Analysis');
  
  const inputRef = useRef(null);
  const chatBodyRef = useRef(null);

  // Live Connection Status (Truth Alignment)
  const connectionStatus = useMemo(() => {
    const isSemanticActive = !!semanticModel;
    const isDataLoaded = (cleanedData?.length > 0) || (fullData?.length > 0);
    return {
      semantic: isSemanticActive ? 'Active' : 'Standby',
      data: isDataLoaded ? 'Connected' : 'Disconnected'
    };
  }, [semanticModel, cleanedData, fullData]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTo({
        top: chatBodyRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [userMessages, loading]);

  const resolveDatasetForNlp = () => {
    if (Array.isArray(cleanedData) && cleanedData.length > 0) return cleanedData;
    if (Array.isArray(fullData) && fullData.length > 0) return fullData;
    return null;
  };

  const handleUserCommand = async (command, dataset, instructions = null) => {
    try {
      const payload = { command, dataset };
      if (instructions) payload.instructions = instructions;
      const response = await axios.post(`${API_URL}/ai_cmd`, payload);
      if (command === "/charts") {
        if (!response.data.chartType || !response.data.chartData) {
          return { chartType: "Unknown", chartData: [] };
        }
        return response.data;
      }
      return response.data.reply;
    } catch (error) {
      console.error("AI command error:", error);
      return { chartType: "Unknown", chartData: [] };
    }
  };

  const handleActionClick = async (actionId) => {
    setLoading(true);
    setError(null);

    const datasetContext = resolveDatasetForNlp();
    const payload = {
      action: actionId,
      session_state: sessionState,
      dataset: datasetContext,
      semantic_model: semanticModel,
    };

    try {
      const response = await axios.post(`${API_URL}/api/decision/chat/actions`, payload);
      const data = response.data;

      if (data.status === 'success') {
        setUserMessages(prev => [
          ...prev, 
          { 
            role: "assistant", 
            content: data.assistant_message, 
            artifacts: data.artifacts,
            suggested_actions: data.session_state?.available_actions || []
          }
        ]);
        setSessionState(data.session_state || {});
      } else {
        setError(data.error?.message || "Action failed.");
      }
    } catch (err) {
      console.error("Decision action error:", err);
      setError("Failed to execute decision action.");
    } finally {
      setLoading(false);
    }
  };

  const handleModeChange = (event, newMode) => {
    setActiveMode(newMode);
    setSessionState(prev => ({ ...prev, active_mode: newMode }));
  };

  const renderAnswerArtifact = (content) => {
    if (!content) return null;

    // Case 1: Metric summary (Semantic)
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
               {content.rows.map((row, i) => (
                 <div key={i} className="ai-shell__answer-row">
                   <span className="ai-shell__answer-row-label">
                     {row.group_label || (row.group && Object.values(row.group).join(' | ')) || 'Total'}
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

    // Case 2: Raw summary
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
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'var(--text-secondary)' }}>TOP RESULT</Typography>
              <Typography variant="body2">{content.top_group.label}</Typography>
            </div>
          )}
        </div>
      );
    }

    // Fallback
    return <Typography variant="body2">{content.message || JSON.stringify(content)}</Typography>;
  };

  const renderArtifact = (artifact) => {
    if (!artifact) return null;

    switch (artifact.type) {
      case 'answer':
        return (
          <div className="ai-shell__artifact-card is-answer">
            <div className="ai-shell__artifact-header">
              <span className="ai-shell__artifact-title"><FaCheckCircle /> {artifact.title || 'Analysis Result'}</span>
            </div>
            <div className="ai-shell__artifact-content">
              {renderAnswerArtifact(artifact.content)}
            </div>
          </div>
        );

      case 'chart':
        return (
          <div className="ai-shell__artifact-card is-chart">
            <div className="ai-shell__artifact-header">
              <span className="ai-shell__artifact-title"><FaChartBar /> {artifact.title || 'Visualization'}</span>
            </div>
            <div className="ai-shell__artifact-content">
              <AICharts 
                aiChartType={artifact.content?.chartType || 'Bar'} 
                aiChartData={artifact.content?.chartData} 
              />
              {artifact.content?.explanation && (
                <Typography variant="caption" sx={{ mt: 1, display: 'block', opacity: 0.8 }}>
                  {artifact.content.explanation}
                </Typography>
              )}
            </div>
          </div>
        );

      case 'workspace_preview':
        const wpData = artifact.content || artifact;
        return (
          <div className="ai-shell__artifact-card is-workspace_preview">
            <div className="ai-shell__artifact-header">
              <span className="ai-shell__artifact-title"><FaLayerGroup /> {artifact.title || wpData.title || 'Decision Workspace'}</span>
              {artifact.handoff && <FaExternalLinkAlt size={12} style={{ opacity: 0.5 }} />}
            </div>
            <div className="ai-shell__artifact-content">
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{wpData.title || 'Untitled Workspace'}</Typography>
              <Typography variant="caption" sx={{ opacity: 0.7, mb: 2, display: 'block' }}>
                {wpData.scope_summary || 'No summary available.'}
              </Typography>
              
              <div className="ai-shell__preview-grid">
                <div className="ai-shell__preview-metric">
                  <span className="ai-shell__preview-metric-label">Status</span>
                  <span className="ai-shell__preview-metric-value" style={{ fontSize: '0.85rem' }}>
                    {wpData.status || 'Draft'}
                  </span>
                </div>
                <div className="ai-shell__preview-metric">
                  <span className="ai-shell__preview-metric-label">Missing Inputs</span>
                  <span className="ai-shell__preview-metric-value" style={{ color: (wpData.missing_inputs?.length > 0 ? 'var(--accent-red)' : 'inherit') }}>
                    {wpData.missing_inputs?.length || 0}
                  </span>
                </div>
                <div className="ai-shell__preview-metric">
                  <span className="ai-shell__preview-metric-label">Levers</span>
                  <span className="ai-shell__preview-metric-value">{wpData.lever_count || 0}</span>
                </div>
                <div className="ai-shell__preview-metric">
                  <span className="ai-shell__preview-metric-label">Unknowns</span>
                  <span className="ai-shell__preview-metric-value">{wpData.unknown_count || 0}</span>
                </div>
              </div>
            </div>
          </div>
        );

      case 'workspace_analysis_summary':
        return (
          <div className="ai-shell__artifact-card is-workspace_analysis_summary">
            <div className="ai-shell__artifact-header">
              <span className="ai-shell__artifact-title"><FaFileAlt /> {artifact.title || 'Analysis Summary'}</span>
            </div>
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
                <Typography variant="body2">{artifact.content?.summary?.headline || 'Analysis completed.'}</Typography>
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
    const newValue = e.target.value;
    const newCursorPos = e.target.selectionStart;
    setUserInput(newValue);

    const token = detectToken(newValue, newCursorPos);
    if (token !== null) {
      setMentionQuery(token);
      setIsMentionOpen(true);
      const textBefore = newValue.substring(0, newCursorPos);
      setMentionStartIndex(textBefore.lastIndexOf('@'));
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

    const datasetContext = resolveDatasetForNlp();
    const messageToSend = userInput;
    setUserInput(''); 

    setUserMessages(prev => [...prev, { role: "user", content: messageToSend, grounded: resolvedDatasets.length > 0 }]);

    // --- Specialized Command Routing ---
    if (AICommands.isCommand(messageToSend)) {
      const parts = messageToSend.split(" ");
      const cmd = parts[0];
      const instructions = parts.length > 1 ? parts.slice(1).join(" ") : null;

      if (cmd === "/charts") {
        const aiChartResponse = await handleUserCommand("/charts", datasetContext);
        if (aiChartResponse && Array.isArray(aiChartResponse.chartData)) {
          const formattedChartData = formatChartData(aiChartResponse);
          setAiChartType(formattedChartData.datasets[0]?.label || "Bar Chart");
          setAiChartData(formattedChartData);
          setShowAIChart(true);
          setLoading(false);
          return;
        }
      }

      if (cmd === "/clean") {
        try {
          const response = await axios.post(`${API_URL}/ai_cmd`, { 
            command: "/clean", 
            dataset: datasetContext,
            instructions 
          });
          
          let earlyResponseText;
          if (response.data.cleaned_data) {
            const newData = response.data.cleaned_data;
            setCleanedData(newData);
            await refreshSemanticModelFromDataset(newData, { source: 'ai_shell_clean', preserveUserMetrics: true });
            earlyResponseText = "Dataset optimized and semantic model refreshed.";
            setAwaitingCleanInstructions(false);
          } else if (response.data.suggestions) {
            earlyResponseText = response.data.suggestions;
            setAwaitingCleanInstructions(true);
          } else {
            earlyResponseText = "Optimization complete. No changes were found necessary.";
            setAwaitingCleanInstructions(false);
          }
          setUserMessages(prev => [...prev, { role: "assistant", content: earlyResponseText }]);
        } catch (err) {
          setError("Failed to process cleaning command.");
        } finally {
          setLoading(false);
        }
        return;
      }
    } else if (awaitingCleanInstructions) {
      // --- RESTORED: Awaiting Clean Instructions ---
      try {
        const response = await axios.post(`${API_URL}/ai_cmd`, { 
          command: "/clean", 
          dataset: datasetContext, 
          instructions: messageToSend 
        });
        
        let earlyResponseText;
        if (response.data.cleaned_data) {
          const newData = response.data.cleaned_data;
          setCleanedData(newData);
          await refreshSemanticModelFromDataset(newData, { source: 'ai_shell_clean_followup', preserveUserMetrics: true });
          earlyResponseText = "Dataset optimized based on your instructions.";
          setAwaitingCleanInstructions(false);
        } else {
          earlyResponseText = response.data.suggestions || "Unable to apply those instructions. Please refine and try again.";
        }
        setUserMessages(prev => [...prev, { role: "assistant", content: earlyResponseText }]);
      } catch (err) {
        setError("Error applying cleaning instructions.");
        setAwaitingCleanInstructions(false);
      } finally {
        setLoading(false);
      }
      return;
    }

    // --- Phase 4 Decision Chat Path (Primary) ---
    const conversation_history = userMessages.map(m => ({ role: m.role, content: m.content })).slice(-10);
    
    const payload = {
      user_message: messageToSend,
      dataset: datasetContext,
      semantic_model: semanticModel,
      conversation_history,
      session_state: sessionState,
      resolved_datasets: resolvedDatasets.map(ds => ds.name)
    };

    try {
      const response = await axios.post(`${API_URL}/api/decision/chat/turns`, payload);
      const data = response.data;

      if (data.status === 'success') {
        setUserMessages(prev => [
          ...prev, 
          { 
            role: "assistant", 
            content: data.assistant_message, 
            artifacts: data.artifacts,
            suggested_actions: data.suggested_actions || [],
            mode: data.mode
          }
        ]);
        setSessionState(data.session_state || {});
        if (data.mode) {
          setActiveMode(data.mode);
        }
      } else {
        setError(data.error?.message || "Connectivity error.");
      }
    } catch (err) {
      console.error("Decision turn error:", err);
      setError("⚠ Connectivity error. Please verify the backend service.");
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
      {/* 1. Command Rail (Navigation) */}
      <aside className="ai-shell__rail">
        <div className="ai-shell__rail-top">
          <Tooltip title="Ask" placement="right">
            <button 
              className={`ai-shell__rail-item ${activeMode === 'ask' ? 'is-active' : ''}`} 
              onClick={() => setActiveMode('ask')}
            >
              <FaRegCommentDots />
            </button>
          </Tooltip>
          <Tooltip title="Explore" placement="right">
            <button 
              className={`ai-shell__rail-item ${activeMode === 'explore' ? 'is-active' : ''}`} 
              onClick={() => setActiveMode('explore')}
            >
              <FaChartBar />
            </button>
          </Tooltip>
          <Tooltip title="Decide" placement="right">
            <button 
              className={`ai-shell__rail-item ${activeMode === 'decide' ? 'is-active' : ''}`} 
              onClick={() => setActiveMode('decide')}
            >
              <FaLightbulb />
            </button>
          </Tooltip>
        </div>
        
        <div className="ai-shell__rail-middle">
          <div className="ai-shell__rail-divider" />
          <Tooltip title="Analysis History" placement="right">
            <button className="ai-shell__rail-item is-disabled"><FaHistory /></button>
          </Tooltip>
          <Tooltip title="AI Skills (Placeholder)" placement="right">
            <button className="ai-shell__rail-item is-disabled"><FaTools /><span className="ai-shell__dot-alert" /></button>
          </Tooltip>
          <Tooltip title="Playbooks (Placeholder)" placement="right">
            <button className="ai-shell__rail-item is-disabled"><FaBook /></button>
          </Tooltip>
        </div>

        <div className="ai-shell__rail-bottom">
          <Tooltip title="Context Sources" placement="right">
            <button className="ai-shell__rail-item is-disabled"><FaDatabase /></button>
          </Tooltip>
        </div>
      </aside>

      {/* 2. Primary Workspace */}
      <main className="ai-shell__workspace">
        <header className="ai-shell__header">
          <div className="ai-shell__header-left">
            <Avatar className="ai-shell__avatar">
              <FaRobot />
            </Avatar>
            <div className="ai-shell__titles">
              <Typography variant="subtitle2" className="ai-shell__main-title">
                AI Analysis Suite
              </Typography>
              <div className="ai-shell__status-bar">
                <span className="ai-shell__status-item">
                  <FaCircle className={`ai-shell__indicator is-${connectionStatus.data.toLowerCase()}`} />
                  Data {connectionStatus.data}
                </span>
                <span className="ai-shell__status-item">
                  <FaBolt className={`ai-shell__indicator is-${connectionStatus.semantic.toLowerCase()}`} />
                  Semantic {connectionStatus.semantic}
                </span>
              </div>
            </div>
          </div>
          <div className="ai-shell__header-right">
             <Chip 
              label={activeMode.toUpperCase()} 
              size="small" 
              color={activeMode === 'decide' ? 'primary' : activeMode === 'explore' ? 'secondary' : 'default'}
              variant="outlined" 
              className="ai-shell__session-chip" 
            />
          </div>
        </header>

        {/* Clearer Mode Selector (Main Workspace) */}
        <div className="ai-shell__mode-tabs">
          <Tabs 
            value={activeMode} 
            onChange={handleModeChange} 
            centered 
            TabIndicatorProps={{ style: { backgroundColor: 'var(--text-primary)' } }}
          >
            <Tab label="Ask" value="ask" className="ai-shell__mode-tab" />
            <Tab label="Explore" value="explore" className="ai-shell__mode-tab" />
            <Tab label="Decide" value="decide" className="ai-shell__mode-tab" />
          </Tabs>
        </div>

        <div className="ai-shell__conversation" ref={chatBodyRef}>
          {userMessages.length === 0 && (
            <div className="ai-shell__welcome-hero">
              <div className="ai-shell__hero-icon"><FaRobot /></div>
              <Typography variant="h4" className="ai-shell__hero-title">
                {activeMode === 'decide' ? 'Frame a Decision' : activeMode === 'explore' ? 'Explore Analytics' : 'Intelligent Analysis'}
              </Typography>
              <Typography variant="body1" className="ai-shell__hero-subtitle">
                {activeMode === 'decide' 
                  ? 'Ask me to help with a business decision, like "Should we expand to Europe?"'
                  : activeMode === 'explore'
                  ? 'Ask for grounded metrics, trends, or visualizations.'
                  : 'Ground your conversation in semantic metrics or discover trends across your datasets.'}
              </Typography>
              <div className="ai-shell__hero-actions">
                <Chip icon={<FaPlus />} label="Compare Datasets" onClick={() => setUserInput('@')} clickable />
                <Chip icon={<FaChartBar />} label="Visualize Trends" onClick={() => setUserInput('Visualize ')} clickable />
                <Chip icon={<FaShieldAlt />} label="Grounded Cleaning" onClick={() => setUserInput('/clean')} clickable />
              </div>
            </div>
          )}
          
          {userMessages.map((msg, idx) => (
            <div key={idx} className={`ai-shell__message-row is-${msg.role}`}>
              <div className="ai-shell__message-card">
                <div className="ai-shell__message-header">
                  <span className="ai-shell__message-author">{msg.role === 'user' ? 'You' : 'AI Assistant'}</span>
                  {(msg.grounded || msg.role === 'assistant') && <span className="ai-shell__grounded-tag"><FaShieldAlt /> Grounded</span>}
                </div>
                <div className="ai-shell__message-content">{msg.content}</div>
                
                {msg.artifacts && msg.artifacts.length > 0 && (
                  <div className="ai-shell__artifact-container">
                    {msg.artifacts.map((art, aIdx) => (
                      <React.Fragment key={aIdx}>
                        {renderArtifact(art)}
                      </React.Fragment>
                    ))}
                  </div>
                )}

                {msg.suggested_actions && msg.suggested_actions.length > 0 && (
                  <div className="ai-shell__suggested-actions">
                    {msg.suggested_actions.map((act, actIdx) => (
                      <button 
                        key={actIdx} 
                        className="ai-shell__action-btn"
                        onClick={() => handleActionClick(act.action_id)}
                        disabled={loading || !act.enabled}
                      >
                        {act.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="ai-shell__message-row is-assistant">
              <div className="ai-shell__message-card is-loading">
                <div className="ai-shell__typing">
                  <span /><span /><span />
                </div>
              </div>
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
                placeholder={activeMode === 'decide' ? "Describe your decision..." : "Ask anything, type @ for data..."}
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
              >
                {loading ? <div className="ai-shell__spinner" /> : <FaBolt />}
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* 3. Context & Artifact Pane */}
      <aside className="ai-shell__context-pane">
        <div className="ai-shell__pane-header">
          <Typography variant="overline">Workspace Context</Typography>
        </div>
        
        <div className="ai-shell__ghost-stack">
          {/* RESTORED ORIGINAL FEATURES */}
          <div className="ai-shell__ghost-item">
            <div className="ai-shell__ghost-label"><FaDatabase /> Live Sources</div>
            <div className="ai-shell__ghost-box">
              <Typography variant="caption">No active grounding sources in focus.</Typography>
            </div>
          </div>

          <div className="ai-shell__ghost-item">
            <div className="ai-shell__ghost-label"><FaChartBar /> Recent Artifacts</div>
            <div className="ai-shell__ghost-placeholder">
              <div className="ai-shell__ghost-bar" style={{ width: '80%' }} />
              <div className="ai-shell__ghost-bar" style={{ width: '60%' }} />
              <div className="ai-shell__ghost-bar" style={{ width: '90%' }} />
            </div>
          </div>

          <div className="ai-shell__ghost-item">
            <div className="ai-shell__ghost-label"><FaLightbulb /> Decision Bridge</div>
            <div className="ai-shell__ghost-draft">
              <Typography variant="subtitle2">Workspace Bridge</Typography>
              <Typography variant="caption">Reserved for structured decision framing.</Typography>
            </div>
          </div>

          <Divider sx={{ my: 1, borderColor: 'var(--border-color)' }} />
          
          <Typography variant="overline" sx={{ mb: -1, mt: 1, display: 'block', color: 'var(--text-secondary)' }}>
            Decision Context
          </Typography>

          {/* NEW PHASE 4 FEATURES */}
          <div className="ai-shell__context-module">
            <div className="ai-shell__module-header">
              <span className="ai-shell__module-title">Schema Notes</span>
              <span className="ai-shell__coming-soon">Coming Soon</span>
            </div>
            <div className="ai-shell__module-empty">
              No metadata overrides detected for the grounded context.
            </div>
          </div>

          <div className="ai-shell__context-module">
            <div className="ai-shell__module-header">
              <span className="ai-shell__module-title">Business Terms</span>
              <span className="ai-shell__coming-soon">Coming Soon</span>
            </div>
            <div className="ai-shell__module-empty">
              Connect a glossary to align AI interpretations with local definitions.
            </div>
          </div>

          <div className="ai-shell__context-module">
            <div className="ai-shell__module-header">
              <span className="ai-shell__module-title">Assumptions / Constraints</span>
              <span className="ai-shell__coming-soon">Coming Soon</span>
            </div>
            <div className="ai-shell__module-empty">
              Explicit constraints identified in chat will appear here for verification.
            </div>
          </div>
        </div>

        <div className="ai-shell__pane-footer">
          <Typography variant="caption">Reserved for V2 Simulation & Trade-offs</Typography>
        </div>
      </aside>
    </div>
  );
}

export default AIShell;
