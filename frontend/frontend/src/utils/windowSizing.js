/**
 * WINDOW_SIZING
 * Centralized sizing rules for all window types.
 * Helps ensure stability and prevents clipping of controls.
 */
export const WINDOW_SIZING = {
  DEFAULT: { minW: 400, minH: 300, defW: 600, defH: 450 },
  DATA_PREVIEW: { minW: 750, minH: 550, defW: 1000, defH: 700 },
  RAW_VIEWER: { minW: 850, minH: 600, defW: 1100, defH: 750 },
  WORKFLOW_LAB: { minW: 950, minH: 650, defW: 1200, defH: 850 },
  WHITEBOARD: { minW: 850, minH: 600, defW: 1100, defH: 750 },
  STORY_PANEL: { minW: 850, minH: 600, defW: 1100, defH: 750 },
  MACHINE_LEARNING: { minW: 850, minH: 600, defW: 1100, defH: 750 },
  DECISION_PANEL: { minW: 1100, minH: 750, defW: 1300, defH: 900 },
  CHART: {
    BLANK: { minW: 450, minH: 400, defW: 550, defH: 480 },
    POPULATED: { minW: 750, minH: 600, defW: 950, defH: 720 },
  },
  KPI: {
    BLANK: { minW: 360, minH: 260, defW: 400, defH: 300 },
    POPULATED: { minW: 380, minH: 350, defW: 440, defH: 400 },
  },
  AI_CHART: { minW: 650, minH: 550, defW: 850, defH: 650 },
  WORKFLOW_NODE: {
    TEXT: { minW: 350, minH: 250, defW: 450, defH: 350 },
    CHART: { minW: 750, minH: 600, defW: 950, defH: 720 },
    REPORT: { minW: 850, minH: 650, defW: 1000, defH: 800 },
  }
};

/**
 * Returns the appropriate sizing rules for a given window type and state.
 */
export const getSizingForType = (type, subType = null) => {
  const base = WINDOW_SIZING[type] || WINDOW_SIZING.DEFAULT;
  if (subType && base[subType]) {
    return base[subType];
  }
  return base;
};
