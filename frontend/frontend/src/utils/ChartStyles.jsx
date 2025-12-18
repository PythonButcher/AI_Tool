// src/utils/ChartStyles.js
import { getCssVariable } from "./theme";

export const getDynamicColors = (length) => {
  const palette = [
    {
      backgroundColor: getCssVariable('--accent-blue-soft', 'rgba(37, 99, 235, 0.2)'),
      borderColor: getCssVariable('--accent-blue', '#2563eb'),
    },
    {
      backgroundColor: getCssVariable('--accent-green-soft', 'rgba(16, 185, 129, 0.2)'),
      borderColor: getCssVariable('--accent-green', '#10b981'),
    },
    {
      backgroundColor: getCssVariable('--accent-red-soft', 'rgba(239, 68, 68, 0.3)'),
      borderColor: getCssVariable('--accent-red', '#ef4444'),
    },
    {
      backgroundColor: getCssVariable('--accent-yellow-soft', 'rgba(245, 158, 11, 0.25)'),
      borderColor: getCssVariable('--accent-yellow', '#f59e0b'),
    },
  ];

  return Array.from({ length }, (_, index) => palette[index % palette.length]);
};
