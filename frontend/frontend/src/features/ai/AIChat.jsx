import React, { useState, useContext, useEffect, useRef } from 'react';
import axios from 'axios';
import { FaRobot } from "react-icons/fa";
import './AIChat.css';
import { TextField, Button, Paper, Box } from '@mui/material';
import { DataContext } from '../../context/DataContext';
import { WarehouseContext } from '../../context/WarehouseContext';
import MentionDropdown from '../../components/data_management/MentionDropdown';
import { detectToken, extractTokens } from '../../utils/mentionUtils'; // Check spelling: detectToken vs dectectToken
import { AICommands } from '../workflow/AiCommandBlock';
import { getDynamicColors } from '../../utils/ChartStyles';
import { summarizeSemanticModel } from '../../utils/semanticModelUtils';


const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const CHART_INTENT_KEYWORDS = [
  'plot',
  'chart',
  'graph',
  'visualize',
  'visualise',
  'distribution',
  'trend',
  'over time',
  'compare',
  'versus',
  'vs',
  'breakdown',
  'share',
  'percentage',
  'line chart',
  'bar chart',
  'pie chart',
  'scatter',
];


const isVisualizationRequest = (text) => {
  if (!text) return false;
  const lower = text.toLowerCase();
  return CHART_INTENT_KEYWORDS.some((keyword) => lower.includes(keyword));
};




// Chart formatting utility
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

function AIChat({ setShowAIChart, setAiChartType, setAiChartData }) {
  const {
    cleanedData,
    fullData,
    setCleanedData,
    semanticModel,
    refreshSemanticModelFromDataset,
  } = useContext(DataContext);
  const { datasets } = useContext(WarehouseContext)
  const [showChat, setShowChat] = useState(false);
  const [userMessages, setUserMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [awaitingCleanInstructions, setAwaitingCleanInstructions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState(null);
  const [isMentionOpen, setIsMentionOpen] = useState(false);
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const inputRef = useRef(null);
  const chatPanelRef = useRef(null);
  const chatIconRef = useRef(null);

  const toggleChat = () => setShowChat(prev => !prev);

  console.log("Here are the datasets:", WarehouseContext.Provider)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        !showChat ||
        !chatPanelRef.current ||
        !chatIconRef.current
      ) {
        return;
      }

      const clickedOutsidePanel = !chatPanelRef.current.contains(event.target);
      const clickedOutsideIcon = !chatIconRef.current.contains(event.target);

      if (clickedOutsidePanel && clickedOutsideIcon) {
        setShowChat(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showChat]);

  const handleUserCommand = async (command, dataset, instructions = null) => {
    try {
      const payload = { command, dataset };
      if (instructions) payload.instructions = instructions;
      const response = await axios.post(`${API_URL}/ai_cmd`, payload);
      if (command === "/charts") {
        if (!response.data.chartType || !response.data.chartData) {
          console.error("Missing chart data fields:", response.data);
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
      const response = await axios.post(`${API_URL}/api/nlp/chart`, {
        query,
        dataset,
      });
      console.log('AIChat /api/nlp/chart status:', response.status);
      return { success: true, data: response.data };
    } catch (error) {
      const status = error.response?.status;
      const backendMessage = error.response?.data?.error || error.response?.data?.message;
      if (status) {
        console.error('AIChat /api/nlp/chart failed with status:', status);
      }
      console.error('Natural-language chart error:', backendMessage || error.message);
      return {
        success: false,
        error: backendMessage || 'Unable to generate a chart from the current dataset.',
      };
    }
  };
  // --------------------Mention section '@' of code-----------------------------------------------//

  const handleMentionSelect = (datasetName) => {
    // 1. Use stored start index if available, else fallback
    let startIdx = mentionStartIndex;
    if (startIdx === -1) {
      startIdx = userInput.lastIndexOf('@');
    }

    // 2. Safe replacement
    const before = userInput.substring(0, startIdx);
    const afterStart = userInput.substring(startIdx + 1);

    // Find if there is a space after the @ token
    const spaceIndex = afterStart.search(/\s/);
    const endIdx = spaceIndex === -1 ? userInput.length : (startIdx + 1 + spaceIndex);
    const after = userInput.substring(endIdx);

    // Insert new token with space
    const newText = `${before}@${datasetName} ${after}`;

    // 3. Update state
    setUserInput(newText);
    setIsMentionOpen(false);
    setMentionStartIndex(-1);

    // 4. Restore Focus
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };
  // --------------------Mention section '@' of code-----------------------------------------------//

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    const newCursorPos = e.target.selectionStart;

    // --- DEBUG LOGS START ---
    console.log("1. Typing detected:", newValue);

    setUserInput(newValue);

    const token = detectToken(newValue, newCursorPos);
    console.log("2. Detected Token:", token); // Should say "" or "Har" etc.

    if (token !== null) {
      console.log("3. Opening Menu!");
      setMentionQuery(token);
      setIsMentionOpen(true);

      // Calculate start index of the current token
      const textBefore = newValue.substring(0, newCursorPos);
      const atIndex = textBefore.lastIndexOf('@');
      setMentionStartIndex(atIndex);

      setMentionPosition({ top: -180, left: 10 });
    } else {
      setIsMentionOpen(false);
      setMentionQuery(null);
      setMentionStartIndex(-1);
    }
    // --- DEBUG LOGS END ---
  };

  
  // -----------------------------------------------------------------------------------------//
  const semanticContext = summarizeSemanticModel(semanticModel);

  const handleSendMessage = async () => {
    if (!userInput.trim()) return;

    const tokens = extractTokens(userInput);
    console.log("Phase2 | userInput:", userInput);
    console.log("Phase2 | extracted:", tokens);

  

    const resolvedDatasets = datasets.filter(ds =>
      tokens.includes(ds.name)
    );
    console.log("Phase3 | resolvedDatasets", resolvedDatasets);

    setLoading(true);
    setError(null);

    // --- NEW: Fetch actual data for mentions ---
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
            const rowInfo = fileData.truncated
              ? `(Showing first ${fileData.row_count} rows)`
              : `(${fileData.row_count} rows)`;

            dataContexts.push(
              `DATASET: "${ds.name}" ${rowInfo}\nCONTENT:\n${JSON.stringify(fileData.data)}`
            );
          } else if (fileData && fileData.error) {
            console.warn(`Failed to fetch ${ds.name}: ${fileData.error}`);
          }
        });

        if (dataContexts.length > 0) {
          additionalContext = `\nYou have access to the following user-selected datasets. Use them to answer the user's request.\n\n${dataContexts.join('\n\n')}\n\n`;
        }

      } catch (err) {
        console.error("Error fetching dataset rows:", err);
        setError("Failed to retrieve referenced dataset content.");
        setLoading(false);
        return;
      }
    }
  // -----------------------------------------------------------------------------------------//

    const datasetContext = resolveDatasetForNlp();
    // Use the fetched data context if available, otherwise fall back to global context
    // Ideally we merge them or prioritize mentioned data.
    // If user explicitly mentions data, we should probably prioritize that context.

    // For now, if mentions exist, we might NOT fail if global context is missing?
    // The original logic checks:
    if ((!Array.isArray(datasetContext) || datasetContext.length === 0) && resolvedDatasets.length === 0) {
      // Only error if BOTH are missing
      setError('No dataset loaded—upload data or mention a dataset (e.g. @Sales).');
      setLoading(false);
      return;
    }

    let responseText;
    let handledChart = false;

    if (!AICommands.isCommand(userInput) && isVisualizationRequest(userInput)) {
      console.log('AIChat sending dataset rows:', datasetContext.length);
      const chartResult = await attemptNaturalLanguageChart(userInput, datasetContext);
      if (chartResult.success) {
        const chartPayload = chartResult.data;
        if (!chartPayload?.chartType || !chartPayload?.chartData) {
          setError('Chart response missing required fields.');
          setLoading(false);
          return;
        }
        setAiChartType(chartPayload.chartType);
        setAiChartData(chartPayload.chartData);
        setShowAIChart(true);
        console.log('AIChat chart rendered:', chartPayload.chartType);
        responseText = chartPayload.explanation || `Generated a ${chartPayload.chartType} chart.`;
        handledChart = true;
      } else {
        const message = chartResult.error || 'Unable to generate chart.';
        setError(message);
        responseText = message;
        handledChart = true;
      }
    }

    if (handledChart) {
      setUserMessages(prev => [
        ...prev,
        { role: "user", content: userInput },
        { role: "assistant", content: responseText }
      ]);

      setUserInput('');
      setLoading(false);
      return;
    }


    // If we have resolved datasets but no global context, try to use the first resolved dataset for commands
    // This allows "@Sales /charts" to work even if Sales isn't globally loaded.
    let effectiveDatasetContext = datasetContext;
    if ((!effectiveDatasetContext || effectiveDatasetContext.length === 0) && resolvedDatasets.length === 1 && additionalContext) {
      // We need to grab the data from the fetch response again or store it better.
      // Since we constructed additionalContext string, we might not have the raw object handy in this scope 
      // without extraction or wider scope variable. 
      // Let's rely on standard chat for multi-dataset analysis for now to keep it safe.
      // But for single dataset, it would be nice.

      // Actually, let's keep it simple: The AI Chat (/ai) is the main target for "analyze together".
      // Commands (/charts) might be strictly for loaded data unless we refactor more.
      // User "The goal is to allow users to reference ... inside an AI chat message ... and have the AI receive ... the actual dataset contents"
      // This implies the main chat flow.
    }

    const conversation_history = [
      { role: "system", content: "You are an AI assistant for data analysis. Only answer questions about the provided dataset concisely, like Captain Jean-Luc Picard." },
      { role: "system", content: `Dataset: ${JSON.stringify(effectiveDatasetContext)}` },
      ...(semanticContext ? [{ role: "system", content: semanticContext }] : []),
      { role: "system", content: additionalContext }, // <--- INJECTED CONTEXT
      ...userMessages.slice(-5),
      { role: "user", content: userInput }
    ];

    if (AICommands.isCommand(userInput) && userInput.startsWith("/charts")) {
      const aiChartResponse = await handleUserCommand("/charts", datasetContext);

      if (!aiChartResponse || !Array.isArray(aiChartResponse.chartData)) {
        setError("AI failed to generate valid chart data.");
        setLoading(false);
        return;
      }


      const formattedChartData = formatChartData(aiChartResponse);
      setAiChartType(formattedChartData.datasets[0]?.label || "Bar Chart");
      setAiChartData(formattedChartData);
      setShowAIChart(true);
      setLoading(false);
      return;
    }

    if (AICommands.isCommand(userInput) && userInput.startsWith("/clean")) {
      const parts = userInput.split(" ");
      const instructions = parts.length > 1 ? parts.slice(1).join(" ") : null;
      const result = await handleUserCommand("/clean", datasetContext, instructions);

      if (instructions) {
        if (!result || !Array.isArray(result)) {
          setError("AI failed to generate valid cleaned data.");
          setLoading(false);
          return;
        }
        setCleanedData(result);
        await refreshSemanticModelFromDataset(result, { source: 'ai_chat_clean_command' });
        setAwaitingCleanInstructions(false);
        responseText = "The data has been cleaned successfully.";
      } else {
        responseText = result || "No suggestions returned.";
        setAwaitingCleanInstructions(true);
      }
    } else if (awaitingCleanInstructions) {
      const result = await handleUserCommand("/clean", datasetContext, userInput);
      if (result && Array.isArray(result)) {
        setCleanedData(result);
        await refreshSemanticModelFromDataset(result, { source: 'ai_chat_clean_followup' });
        responseText = "The data has been cleaned successfully.";
      } else {
        responseText = typeof result === 'string' ? result : "Unable to clean data.";
      }
      setAwaitingCleanInstructions(false);
    } else if (AICommands.isCommand(userInput)) {
      responseText = await handleUserCommand(userInput.split(" ")[0], datasetContext);
    } else {
      try {
        const response = await axios.post(`${API_URL}/ai`, { conversation_history, resolvedDatasets });
        responseText = response.data.reply;
      } catch (error) {
        console.error("AIChat API Error:", error);
        responseText = "⚠ Unable to get response from AI.";
      }
    }

    setUserMessages(prev => [
      ...prev,
      { role: "user", content: userInput },
      { role: "assistant", content: responseText }
    ]);

    setUserInput('');
    setLoading(false);
  };

  const handleKeyDown = (e) => {
  // Only intercept keys if the mention menu is active
  if (!isMentionOpen) return;

  // Re-calculate the list to know the bounds for navigation
  const filteredDatasets = datasets.filter((ds) =>
    ds.name.toLowerCase().includes(mentionQuery?.toLowerCase() || "")
  );

  if (filteredDatasets.length === 0) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault(); // Stop cursor from moving in the text field
    setHighlightedIndex(prev => (prev < filteredDatasets.length - 1 ? prev + 1 : prev));
  } 
  else if (e.key === 'ArrowUp') {
    e.preventDefault(); // Stop cursor from moving in the text field
    setHighlightedIndex(prev => (prev > 0 ? prev - 1 : prev));
  } 
  else if (e.key === 'Enter') {
    e.preventDefault(); // Stop a newline from being added
    // Use your existing select handler
    handleMentionSelect(filteredDatasets[highlightedIndex].name);
    setHighlightedIndex(0); // Reset for next time
  }
  else if (e.key === 'Escape') {
    setIsMentionOpen(false);
  }
  };


  return (
    <>
      <div
        ref={chatIconRef}
        className="chat-icon"
        onClick={toggleChat}
        data-tooltip="AI Chat"
      >
        <FaRobot size={30} />
      </div>

      <div ref={chatPanelRef} className={`chat-panel ${showChat ? "open" : ""}`}>
        
        <div className="chat-header">
          <span>AI Data Assistant</span>
          <button className="close-button" onClick={toggleChat}>✕</button>
        </div>

        <div className="chat-body">
          {userMessages.map((message, idx) => (
            <div key={idx} className={`chat-message ${message.role}`}>
              {message.content}
            </div>
          ))}
        </div>


        <Paper className="chat-input-container" elevation={0}>
          {/* 1. The Dropdown (Only shows when active) */}
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

          <Box className="chat-input-inner">
            {/* 2. The Input Field */}
            <TextField
              inputRef={inputRef}
              onKeyDown={handleKeyDown}
              label="Ask about the data..."
              variant="outlined"
              fullWidth
              value={userInput}
              onChange={handleInputChange}
              disabled={loading}
            />

            {/* 3. The Send Button */}
            <Button
              variant="contained"
              color="primary"
              onClick={handleSendMessage}
              disabled={loading}
              className="aichat-button"
              data-tooltip="Send Message"
            >
              {loading ? "Thinking..." : "Send"}
            </Button>
          </Box>
        </Paper>
        {error && <div className="error-message">{error}</div>}
      </div>
    </>
  );
}

export default AIChat;





