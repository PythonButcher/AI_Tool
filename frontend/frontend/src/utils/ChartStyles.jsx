// src/utils/ChartStyles.js

const PALETTE = [
  { bg: 'rgba(59, 130, 246, 0.6)', border: '#3b82f6' }, // Blue
  { bg: 'rgba(16, 185, 129, 0.6)', border: '#10b981' }, // Green
  { bg: 'rgba(239, 68, 68, 0.6)', border: '#ef4444' }, // Red
  { bg: 'rgba(245, 158, 11, 0.6)', border: '#f59e0b' }, // Amber
  { bg: 'rgba(139, 92, 246, 0.6)', border: '#8b5cf6' }, // Violet
  { bg: 'rgba(14, 165, 233, 0.6)', border: '#0ea5e9' }, // Sky
  { bg: 'rgba(99, 102, 241, 0.6)', border: '#6366f1' }, // Indigo
  { bg: 'rgba(236, 72, 153, 0.6)', border: '#ec4899' }, // Pink
];

export const getDynamicColors = (length) => {
  return Array.from({ length }, (_, i) => {
    const color = PALETTE[i % PALETTE.length];
    return {
      backgroundColor: color.bg,
      borderColor: color.border
    };
  });
};
