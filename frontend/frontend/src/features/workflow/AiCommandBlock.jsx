import {
  FaBroom,
  FaChartBar,
  FaExclamationTriangle,
  FaLightbulb,
  FaRocket,
} from 'react-icons/fa';
import { FaBrain } from 'react-icons/fa6';

export const AiCommandBlocks = {
  summary: {
    id: 'cmd-summary',
    command: '/summary',
    display: 'Summary',
    description: 'Provides a business-friendly dataset summary.',
    action: 'fetch_summary',
    params: ['dataset', 'focus'],
    icon: FaBrain,
    group: 'Understand',
    businessLabel: 'Summarize data',
    defaultParams: {
      focus: '',
      goal: '',
      instructions: '',
    },
  },
  outliers: {
    id: 'cmd-outliers',
    command: '/outliers',
    display: 'Outliers',
    description: 'Detects anomalies, risk signals, and irregular patterns.',
    action: 'detect_outliers',
    params: ['dataset', 'focus'],
    icon: FaExclamationTriangle,
    group: 'Understand',
    businessLabel: 'Review risk signals',
    defaultParams: {
      focus: '',
      goal: '',
      instructions: '',
    },
  },
  charts: {
    id: 'cmd-charts',
    command: '/charts',
    display: 'Charts',
    description: 'Generates presentation-ready chart recommendations.',
    action: 'fetch_ai_charts',
    params: ['dataset', 'goal'],
    icon: FaChartBar,
    group: 'Present',
    businessLabel: 'Generate visuals',
    defaultParams: {
      focus: '',
      goal: '',
      instructions: '',
    },
  },
  insights: {
    id: 'cmd-insights',
    command: '/insights',
    display: 'Data Insights',
    description: 'Returns AI-driven business insights and next steps.',
    action: 'fetch_insights',
    params: ['dataset', 'goal'],
    icon: FaLightbulb,
    group: 'Decide',
    businessLabel: 'Generate recommendations',
    defaultParams: {
      focus: '',
      goal: '',
      instructions: '',
    },
  },
  clean: {
    id: 'cmd-clean',
    command: '/clean',
    display: 'Clean Data',
    description: 'Prepares data by cleaning missing values, types, and duplicates.',
    action: 'fetch_clean',
    params: ['dataset', 'instructions'],
    icon: FaBroom,
    group: 'Prepare',
    businessLabel: 'Prepare data',
    defaultParams: {
      focus: '',
      goal: '',
      instructions: '',
    },
  },
  execute: {
    id: 'cmd-execute',
    command: '/execute',
    display: 'Execute',
    description: 'Legacy trigger node for workflow execution.',
    action: 'trigger_execution',
    params: [],
    icon: FaRocket,
    group: 'Control',
    businessLabel: 'Legacy execute trigger',
    defaultParams: {
      focus: '',
      goal: '',
      instructions: '',
    },
  },
};

export const AICommands = {
  commands: Object.keys(AiCommandBlocks).map((key) => AiCommandBlocks[key].command),

  isCommand: (input) => {
    return AICommands.commands.includes(input.split(' ')[0]);
  },
};

export const AiCommandGroups = Object.values(AiCommandBlocks).reduce((groups, command) => {
  const group = command.group || 'Other';
  if (!groups[group]) {
    groups[group] = [];
  }
  groups[group].push(command);
  return groups;
}, {});
