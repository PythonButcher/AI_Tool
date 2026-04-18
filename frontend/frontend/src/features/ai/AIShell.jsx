import React, { useState, useContext, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import { 
  FaRobot, FaRegCommentDots, FaTools, FaBook, FaDatabase, FaPlus, FaLightbulb, 
  FaHistory, FaChartBar, FaShieldAlt, FaCircle, FaInfoCircle, FaBolt
} from "react-icons/fa";
import { TextField, Button, Paper, Box, Typography, Divider, Tooltip, Chip, Avatar } from '@mui/material';
import { DataContext } from '../../context/DataContext';
import { WarehouseContext } from '../../context/WarehouseContext';
import MentionDropdown from '../../components/data_management/MentionDropdown';
import { detectToken, extractTokens } from '../../utils/mentionUtils';
import { AICommands } from '../workflow/AiCommandBlock';
import { getDynamicColors } from '../../utils/ChartStyles';
import { summarizeSemanticModel } from '../../utils/semanticModelUtils';
import './AIShell.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const CHART_INTENT_KEYWORDS = [
  'plot', 'chart', 'graph', 'visualize', 'visualise', 'distribution', 'trend', 
  'over time', 'compare', 'versus', 'vs', 'breakdown', 'share', 'percentage', 
  'line chart', 'bar chart', 'pie chart', 'scatter',
];

const isVisualizationRequest = (text) => {
  if (!text) return false;
  const lower = text.toLowerCase();
  return CHART_INTENT_KEYWORDS.some((keyword) => lower.includes(keyword));
};

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
      if (command === "/clean") {
        if (response.data.cleaned_data) return response.data.cleaned_data;
        if (response.data.suggestions) return response.data.suggestions;
        return null;
      }
      return response.data.reply;
    } catch (error) {
      console.error("AI command error:", error);
      return { chartType: "Unknown", chartData: [] };
    }
  };

  const resolveDatasetForNlp = () => {
    if (Array.isArray(cleanedData) && cleanedData.length > 0) return cleanedData;
    if (Array.isArray(fullData) && fullData.length > 0) return fullData;
    return null;
  };

  const attemptNaturalLanguageChart = async (query, dataset) => {
    try {
      const response = await axios.post(`${API_URL}/api/nlp/chart`, { query, dataset });
      return { success: true, data: response.data };
    } catch (error) {
      const backendMessage = error.response?.data?.error || error.response?.data?.message;
      return {
        success: false,
        error: backendMessage || 'Unable to generate a chart from the current dataset.',
      };
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
      // Fixed: MentionDropdown expects 'top' coordinate for absolute positioning above the bar
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

    let additionalContext = "";
    if (resolvedDatasets.length > 0) {
      try {
        const datasetIds = resolvedDatasets.map(ds => ds.id);
        const fetchResp = await axios.post(`${API_URL}/api/datahub/fetch_rows`, { dataset_ids: datasetIds });
        const fetchedData = fetchResp.data.datasets || {};
        const dataContexts = [];

        resolvedDatasets.forEach(ds => {
          const fileData = fetchedData[ds.id];
          if (fileData && !fileData.error && fileData.data) {
            dataContexts.push(`DATASET: "${ds.name}"\nCONTENT:\n${JSON.stringify(fileData.data)}`);
          }
        });

        if (dataContexts.length > 0) {
          additionalContext = `\nYou have access to the following user-selected datasets.\n\n${dataContexts.join('\n\n')}\n\n`;
        }
      } catch (err) {
        console.error("Error fetching dataset rows:", err);
        setError("Context grounding failed.");
        setLoading(false);
        return;
      }
    }

    const datasetContext = resolveDatasetForNlp();
    if ((!Array.isArray(datasetContext) || datasetContext.length === 0) && resolvedDatasets.length === 0) {
      setError('System grounded in Standby mode. Mention a dataset with @ to activate Analysis.');
      setLoading(false);
      return;
    }

    let responseText;
    let handledChart = false;

    if (!AICommands.isCommand(userInput) && isVisualizationRequest(userInput)) {
      const chartResult = await attemptNaturalLanguageChart(userInput, datasetContext);
      if (chartResult.success) {
        const chartPayload = chartResult.data;
        if (chartPayload?.chartType && chartPayload?.chartData) {
          setAiChartType(chartPayload.chartType);
          setAiChartData(chartPayload.chartData);
          setShowAIChart(true);
          responseText = chartPayload.explanation || `Generated ${chartPayload.chartType} visualization.`;
          handledChart = true;
        }
      }
    }

    if (handledChart) {
      setUserMessages(prev => [...prev, { role: "user", content: userInput, grounded: true }, { role: "assistant", content: responseText }]);
      setUserInput('');
      setLoading(false);
      return;
    }

    const semanticContext = summarizeSemanticModel(semanticModel);
    const conversation_history = [
      { role: "system", content: "You are an Enterprise Data Analyst. Ground every answer in the provided context. Be precise, concise, and professional." },
      { role: "system", content: `Context: ${JSON.stringify(datasetContext)}` },
      ...(semanticContext ? [{ role: "system", content: semanticContext }] : []),
      { role: "system", content: additionalContext },
      ...userMessages.slice(-5),
      { role: "user", content: userInput }
    ];

    // --- Command Routing ---

    if (AICommands.isCommand(userInput)) {
      const parts = userInput.split(" ");
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
          
          if (response.data.cleaned_data) {
            const newData = response.data.cleaned_data;
            setCleanedData(newData);
            await refreshSemanticModelFromDataset(newData, { source: 'ai_shell_clean', preserveUserMetrics: true });
            responseText = "Dataset optimized and semantic model refreshed.";
            setAwaitingCleanInstructions(false);
          } else if (response.data.suggestions) {
            responseText = response.data.suggestions;
            setAwaitingCleanInstructions(true);
          } else {
            responseText = "Optimization complete. No changes were found necessary.";
            setAwaitingCleanInstructions(false);
          }
        } catch (err) {
          responseText = "Failed to process cleaning command.";
        }
      } else {
        responseText = await handleUserCommand(cmd, datasetContext);
      }
    } else if (awaitingCleanInstructions) {
      // Treat the next message as cleaning instructions
      try {
        const response = await axios.post(`${API_URL}/ai_cmd`, { 
          command: "/clean", 
          dataset: datasetContext, 
          instructions: userInput 
        });
        
        if (response.data.cleaned_data) {
          const newData = response.data.cleaned_data;
          setCleanedData(newData);
          await refreshSemanticModelFromDataset(newData, { source: 'ai_shell_clean_followup', preserveUserMetrics: true });
          responseText = "Dataset optimized based on your instructions.";
          setAwaitingCleanInstructions(false);
        } else {
          responseText = response.data.suggestions || "Unable to apply those instructions. Please refine and try again.";
        }
      } catch (err) {
        responseText = "Error applying cleaning instructions.";
        setAwaitingCleanInstructions(false);
      }
    } else {
      // General AI Chat
      try {
        const response = await axios.post(`${API_URL}/ai`, { conversation_history, resolvedDatasets });
        responseText = response.data.reply;
      } catch (error) {
        responseText = "⚠ Connectivity error. Please verify the backend service.";
      }
    }

    setUserMessages(prev => [...prev, { role: "user", content: userInput, grounded: resolvedDatasets.length > 0 }, { role: "assistant", content: responseText }]);
    setUserInput('');
    setLoading(false);
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
          <Tooltip title="Current Analysis" placement="right">
            <button className="ai-shell__rail-item is-active"><FaRegCommentDots /></button>
          </Tooltip>
          <Tooltip title="Analysis History" placement="right">
            <button className="ai-shell__rail-item is-disabled"><FaHistory /></button>
          </Tooltip>
        </div>
        
        <div className="ai-shell__rail-middle">
          <div className="ai-shell__rail-divider" />
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
              <Typography variant="subtitle2" className="ai-shell__main-title">AI Analysis Suite</Typography>
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
             <Chip label={activeSession} size="small" variant="outlined" className="ai-shell__session-chip" />
          </div>
        </header>

        <div className="ai-shell__conversation" ref={chatBodyRef}>
          {userMessages.length === 0 && (
            <div className="ai-shell__welcome-hero">
              <div className="ai-shell__hero-icon"><FaRobot /></div>
              <Typography variant="h4" className="ai-shell__hero-title">Intelligent Analysis</Typography>
              <Typography variant="body1" className="ai-shell__hero-subtitle">
                Ground your conversation in semantic metrics or discover trends across your datasets.
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
                  {msg.grounded && <span className="ai-shell__grounded-tag"><FaShieldAlt /> Grounded</span>}
                </div>
                <div className="ai-shell__message-content">{msg.content}</div>
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
                placeholder="Ask anything, type @ for data..."
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
        </div>

        <div className="ai-shell__pane-footer">
          <Typography variant="caption">Reserved for V2 Simulation & Trade-offs</Typography>
        </div>
      </aside>
    </div>
  );
}

export default AIShell;
