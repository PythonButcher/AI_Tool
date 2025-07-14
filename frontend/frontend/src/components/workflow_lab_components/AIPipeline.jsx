// src/components/AIPipeline.jsx

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import CleanSuggestionsModal from './CleanSuggestionsModal';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// This invisible controller manages the AI workflow execution lifecycle
const AIPipeline = ({ nodes, dataset, onResults, onDataCleaned }) => {
  const [results, setResults] = useState({});
  const [isRunning, setIsRunning] = useState(false);
  const [pendingClean, setPendingClean] = useState(null);

  // Function exposed globally to run the current pipeline on demand
  const runWorkflow = async () => {
    if (isRunning) return;
    console.log("🚀 Starting AI pipeline execution...");
    setIsRunning(true);

    const commandBlocks = nodes
      .filter(node => node.data?.command && node.type !== 'dropZoneNode')
      .sort((a, b) => a.position.y - b.position.y);

    const newResults = {};

    for (const block of commandBlocks) {
      const nodeId = block.id;
      const command = block.data.command;

      newResults[nodeId] = { status: 'pending' };
      setResults({ ...newResults });

      try {
        let response;
        // Special handling for the /clean command
        if (command === '/clean') {
          // First request: get suggestions
          const suggest = await axios.post(`${API_URL}/ai_cmd`, {
            command,
            dataset,
          });

          let instructions = '';
          if (suggest.data && suggest.data.suggestions) {
            instructions = await new Promise((resolve) => {
              setPendingClean({ suggestions: suggest.data.suggestions, resolve });
            });
          }

          if (!instructions) {
            newResults[nodeId] = { status: 'skipped', result: suggest.data };
            setResults({ ...newResults });
            continue;
          }

          response = await axios.post(`${API_URL}/ai_cmd`, {
            command,
            dataset,
            instructions,
          });

          if (onDataCleaned && response.data.cleaned_data) {
            onDataCleaned(response.data.cleaned_data);
            console.log('✅ Cleaned data updated in the global context.');
          }
        } else {
          // Handle all other AI commands
          response = await axios.post(`${API_URL}/ai_cmd`, {
            command,
            dataset,
          });
        }

        newResults[nodeId] = {
          status: 'success',
          result: response.data,
        };
        console.log(`🧪 Result from ${command}:`, response.data);
        console.log(`✅ Node ${nodeId} (${command}) complete.`);

      } catch (error) {
        newResults[nodeId] = {
          status: 'error',
          error: error.message || 'Unknown error',
        };
        console.error(`❌ Node ${nodeId} (${command}) failed.`, error);
      }

      setResults({ ...newResults });
    }

    // 🧠 Consolidate to a single AI Report
    const aiReport = {};

    for (const [nodeId, data] of Object.entries(newResults)) {
      if (data.status !== 'success') continue;
      const cmd = nodes.find(n => n.id === nodeId)?.data?.command?.replace('/', '');
      if (cmd === 'summary')  aiReport.summary   = data.result;
      if (cmd === 'insights') aiReport.insights  = data.result;
      if (cmd === 'execute')  aiReport.execution = data.result;
      if (cmd === 'charts') {
        aiReport.chartType = data.result.chartType;
        aiReport.chartData = data.result.chartData;
         console.log(
        `AIPipeline -> aiReport assembly for 'charts' (node <span class="math-inline">\{nodeId\}\)\: chartType\: '</span>{aiReport.chartType}', chartData content:`, aiReport.chartData,
        `| chartData typeof: ${typeof aiReport.chartData}`,
        `| chartData isArray: ${Array.isArray(aiReport.chartData)}`,
        `| chartData length: ${Array.isArray(aiReport.chartData) ? aiReport.chartData.length : 'N/A'}`
      );
      }
    }

    if (Object.keys(aiReport).length > 0) {
      newResults['ai_report'] = {
        status: 'success',
        result: aiReport,
      };
    }

    setIsRunning(false);
    console.log("📤 Final newResults object going to setPipelineResults:", newResults);
    onResults(newResults);


    if (onResults) {
      onResults(newResults);
      console.log("📤 Final newResults object going to setPipelineResults:", newResults);
    }
  };

  useEffect(() => {
    window.runAIPipeline = runWorkflow;
    return () => delete window.runAIPipeline;
  }, [nodes, dataset, onDataCleaned]);

  return (
    <>
      {pendingClean && (
        <CleanSuggestionsModal
          suggestions={pendingClean.suggestions}
          onApply={(inst) => {
            pendingClean.resolve(inst);
            setPendingClean(null);
          }}
          onSkip={() => {
            pendingClean.resolve(null);
            setPendingClean(null);
          }}
        />
      )}
    </>
  );
};

export default AIPipeline;
