import React, { useState, useContext } from 'react';
import axios from 'axios';
import { FaRobot } from "react-icons/fa";
import '../css/ai_ml_css/AIChat.css';
import { TextField, Button } from '@mui/material';
import { DataContext } from '../../context/DataContext';
import { AICommands } from '../workflow_lab_components/AiCommandBlock';
import { getDynamicColors } from '../../utils/ChartStyles';


const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';



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
  const { uploadedData, cleanedData, setCleanedData } = useContext(DataContext);
  const [showChat, setShowChat] = useState(false);
  const [userMessages, setUserMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const toggleChat = () => setShowChat(prev => !prev);

  const handleUserCommand = async (command, dataset) => {
    try {
      const response = await axios.post(`${API_URL}/ai_cmd`, { command, dataset });
      if (command === "/charts") {
        if (!response.data.chartType || !response.data.chartData) {
          console.error("Missing chart data fields:", response.data);
          return { chartType: "Unknown", chartData: [] };
        }
        return response.data;
      }
      if (command === "/clean") {
        return response.data.cleaned_data;
      }
      return response.data.reply;
    } catch (error) {
      console.error("AI command error:", error);
      return { chartType: "Unknown", chartData: [] };
    }
  };

  const handleSendMessage = async () => {
    if (!userInput.trim()) return;

    setLoading(true);
    setError(null);

    const datasetContext = cleanedData || uploadedData;
    if (!datasetContext) {
      setError("No dataset found. Please upload data first.");
      setLoading(false);
      return;
    }

    const conversation_history = [
      { role: "system", content: "You are an AI assistant for data analysis. Only answer questions about the provided dataset concisely, like Captain Jean-Luc Picard." },
      { role: "system", content: `Dataset: ${JSON.stringify(datasetContext)}` },
      ...userMessages.slice(-5),
      { role: "user", content: userInput }
    ];

    let responseText;

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
        const cleanedDataResponse = await handleUserCommand("/clean", datasetContext);
  
        if (!cleanedDataResponse || !Array.isArray(cleanedDataResponse)) {
          setError("AI failed to generate valid cleaned data.");
          setLoading(false);
          return;
        }
  
        setCleanedData(cleanedDataResponse);
        responseText = "The data has been cleaned successfully.";
      } else if (AICommands.isCommand(userInput)) {
      responseText = await handleUserCommand(userInput.split(" ")[0], datasetContext);
    } else {
      try {
        const response = await axios.post(`${API_URL}/ai`, { conversation_history });
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

  return (
    <>
      <div className="chat-icon" onClick={toggleChat} data-tooltip="AI Chat">
        <FaRobot size={30} />
      </div>

      <div className={`chat-panel ${showChat ? "open" : ""}`}>
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

        <div className="chat-input-container">
          <TextField
            label="Ask about the data..."
            variant="outlined"
            fullWidth
            value={userInput}
            onChange={e => setUserInput(e.target.value)}
            disabled={loading}
          />
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
        </div>
        {error && <div className="error-message">{error}</div>}
      </div>
    </>
  );
}

export default AIChat;
