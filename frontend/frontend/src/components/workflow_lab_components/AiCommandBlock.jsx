// AiCommandBlock.jsx

import { FaChartBar, FaBrain, FaLightbulb, FaRocket } from "react-icons/fa";

// Defines all available AI command blocks for the workflow system
export const AiCommandBlocks = {
  summary: {
    id: "cmd-summary",
    command: "/summary",
    display: "Summary",
    description: "Provides a dataset summary (mean, median, null count).",
    action: "fetch_summary",
    params: ["dataset"],
    icon: FaBrain,
  },
  charts: {
    id: "cmd-charts",
    command: "/charts",
    display: "Charts",
    description: "Generates suggested charts from AI.",
    action: "fetch_ai_charts",
    params: ["dataset"],
    icon: FaChartBar,
  },
  insights: {
    id: "cmd-insights",
    command: "/insights",
    display: "Data Insights",
    description: "Returns AI-driven insights for data.",
    action: "fetch_insights",
    params: ["dataset"],
    icon: FaLightbulb,
  },
  execute: {
    id: "cmd-execute",
    command: "/execute", // Pseudo-command, triggers workflow
    display: "Execute",
    description: "Trigger execution of all AI nodes",
    action: "trigger_execution",
    params: [],
    icon: FaRocket,
  }
};

// Compatibility utility for legacy consumers like AIChat.jsx
export const AICommands = {
  commands: Object.keys(AiCommandBlocks).map((key) => AiCommandBlocks[key].command),

  isCommand: (input) => {
    return AICommands.commands.includes(input.split(" ")[0]);
  },
};
