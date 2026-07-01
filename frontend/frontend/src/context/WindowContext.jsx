import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  useEffect,
  useCallback,
} from 'react';
import {
  createDefaultDashboardFilters,
  normalizeDashboardFilters,
} from '../utils/dashboardFilterUtils';
import {
  createDefaultDashboardCanvasSettings,
  createDefaultDashboardSharingSkeleton,
  normalizeDashboardItemLayout,
  normalizeDashboardItemDisplay,
  normalizeDashboardItemSourceMetadata
} from '../utils/dashboardCanvasUtils';

export const WindowContext = createContext();

const WINDOW_STATES_STORAGE_KEY = 'windowStates';
const DASHBOARD_STORAGE_KEY = 'businessMonitoringDashboard';
const DASHBOARD_V1_STORAGE_KEY = 'chartStudioDashboard:v1';

const createDefaultDashboardState = () => ({
  id: 'dashboard-primary',
  name: 'Business Dashboard',
  isVisible: false,
  mode: 'edit',
  filters: createDefaultDashboardFilters(),
  canvas: createDefaultDashboardCanvasSettings(),
  sharing: createDefaultDashboardSharingSkeleton(),
  layoutVersion: 1,
});

const normalizeSemanticConfig = (semanticConfig) => ({
  metricId: semanticConfig?.metricId || '',
  groupBy: semanticConfig?.groupBy || '',
});

const normalizeDashboardItem = (item, index = 0) => {
  const baseItem = {
    layout: normalizeDashboardItemLayout(item?.layout, index, item?.itemType || 'chart'),
    locked: item?.locked || false,
    display: normalizeDashboardItemDisplay(item?.display),
    sourceMetadata: normalizeDashboardItemSourceMetadata(item?.sourceMetadata),
  };

  if (item?.itemType === 'kpi') {
    return {
      id: item.id,
      itemType: 'kpi',
      title: item.title || 'KPI Card',
      semanticConfig: normalizeSemanticConfig(item.semanticConfig),
      comparisonEnabled: item.comparisonEnabled !== false,
      ...baseItem,
    };
  }

  return {
    id: item.id,
    itemType: 'chart',
    title: item?.title || 'Chart',
    chartType: item?.chartType || item?.type || 'Bar',
    mapping: item?.mapping || {},
    dataSourceMode: item?.dataSourceMode || 'raw',
    semanticConfig: normalizeSemanticConfig(item?.semanticConfig),
    chartSpec: item?.chartSpec || null,
    localSlicers: item?.localSlicers || [],
    ...baseItem,
  };
};

const loadDashboardStorage = () => {
  try {
    let stored = localStorage.getItem(DASHBOARD_V1_STORAGE_KEY);
    if (!stored) {
      stored = localStorage.getItem(DASHBOARD_STORAGE_KEY);
    }
    if (!stored) {
      return {
        state: createDefaultDashboardState(),
        items: [],
      };
    }

    const parsed = JSON.parse(stored);
    const dashboardState = {
      ...createDefaultDashboardState(),
      ...parsed?.state,
      filters: normalizeDashboardFilters(parsed?.state?.filters),
      canvas: parsed?.state?.canvas || createDefaultDashboardCanvasSettings(),
      sharing: parsed?.state?.sharing || createDefaultDashboardSharingSkeleton(),
      mode: parsed?.state?.mode || 'edit',
    };

    return {
      state: dashboardState,
      items: Array.isArray(parsed?.items) ? parsed.items.map((item, index) => normalizeDashboardItem(item, index)) : [],
    };
  } catch (error) {
    console.error('Failed to parse dashboard storage', error);
    return {
      state: createDefaultDashboardState(),
      items: [],
    };
  }
};

export const WindowProvider = ({ children }) => {
  const [openWindows, setOpenWindows] = useState([]);
  const [charts, setCharts] = useState([]);
  const [minimizedWindows, setMinimizedWindows] = useState({});
  const [windowStates, setWindowStates] = useState({});
  const [lockedWindows, setLockedWindows] = useState({});
  const [windowContentStates, setWindowContentStates] = useState({});
  const [dashboardState, setDashboardState] = useState(createDefaultDashboardState);
  const [dashboardItems, setDashboardItems] = useState([]);
  const [isSlicerPanelOpen, setIsSlicerPanelOpen] = useState(false);

  const openWindow = useCallback((id) => {
    setOpenWindows((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const closeWindow = useCallback((id) => {
    setOpenWindows((prev) => prev.filter((windowId) => windowId !== id));
    setMinimizedWindows((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    setLockedWindows((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  }, []);

  const minimizeWindow = useCallback((id, label) => {
    setMinimizedWindows((prev) => ({ ...prev, [id]: { label } }));
  }, []);

  const restoreWindow = useCallback((id) => {
    setMinimizedWindows((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  }, []);

  const maximizeWindow = useCallback((id) => {
    restoreWindow(id);
  }, [restoreWindow]);

  const addChart = useCallback((chartConfig) => {
    const newId = `chart-${Date.now()}`;
    const chart = {
      id: newId,
      type: 'Bar',
      mapping: {},
      dataSourceMode: 'raw',
      semanticConfig: { metricId: '', groupBy: '' },
      ...chartConfig,
    };
    setCharts((prev) => [...prev, chart]);
    openWindow(newId);
    return newId;
  }, [openWindow]);

  const removeChart = useCallback((id) => {
    setCharts((prev) => prev.filter((chart) => chart.id !== id));
    closeWindow(id);
  }, [closeWindow]);

  const updateChart = useCallback((id, updates) => {
    setCharts((prev) => prev.map((chart) => (chart.id === id ? { ...chart, ...updates } : chart)));
  }, []);

  useEffect(() => {
    const storedWindowStates = localStorage.getItem(WINDOW_STATES_STORAGE_KEY);
    if (storedWindowStates) {
      try {
        setWindowStates(JSON.parse(storedWindowStates));
      } catch (error) {
        console.error('Failed to parse stored window states', error);
      }
    }

    const dashboardStorage = loadDashboardStorage();
    setDashboardState(dashboardStorage.state);
    setDashboardItems(dashboardStorage.items);
  }, []);

  useEffect(() => {
    localStorage.setItem(WINDOW_STATES_STORAGE_KEY, JSON.stringify(windowStates));
  }, [windowStates]);

  useEffect(() => {
    localStorage.setItem(DASHBOARD_V1_STORAGE_KEY, JSON.stringify({
      state: dashboardState,
      items: dashboardItems,
    }));
  }, [dashboardItems, dashboardState]);

  const saveWindowState = useCallback((id, layout) => {
    setWindowStates((prev) => ({ ...prev, [id]: layout }));
  }, []);

  const getWindowState = useCallback((id) => windowStates[id] || null, [windowStates]);

  const saveWindowContentState = useCallback((id, data) => {
    setWindowContentStates((prev) => ({ ...prev, [id]: data }));
  }, []);

  const getWindowContentState = useCallback(
    (id) => windowContentStates[id] || null,
    [windowContentStates]
  );

  const toggleLock = useCallback((id) => {
    setLockedWindows((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const isLocked = useCallback((id) => !!lockedWindows[id], [lockedWindows]);

  const openDashboard = useCallback(() => {
    setDashboardState((prev) => ({ ...prev, isVisible: true }));
  }, []);

  const closeDashboard = useCallback(() => {
    setDashboardState((prev) => ({ ...prev, isVisible: false }));
  }, []);

  const updateDashboard = useCallback((updates) => {
    setDashboardState((prev) => ({
      ...prev,
      ...updates,
      filters: updates?.filters ? normalizeDashboardFilters(updates.filters) : prev.filters,
    }));
  }, []);

  const setDashboardFilters = useCallback((nextFilters) => {
    setDashboardState((prev) => ({
      ...prev,
      filters: normalizeDashboardFilters(
        typeof nextFilters === 'function' ? nextFilters(prev.filters) : nextFilters
      ),
    }));
  }, []);

  const clearDashboardFilters = useCallback(() => {
    setDashboardState((prev) => ({
      ...prev,
      filters: createDefaultDashboardFilters(),
    }));
  }, []);

  const addDashboardChart = useCallback((chartConfig = {}) => {
    setDashboardItems((prev) => {
      const newId = `dashboard-chart-${Date.now()}`;
      const item = normalizeDashboardItem({
        id: newId,
        itemType: 'chart',
        chartType: 'Bar',
        mapping: {},
        dataSourceMode: 'raw',
        semanticConfig: { metricId: '', groupBy: '' },
        ...chartConfig,
      }, prev.length);
      return [...prev, item];
    });
    setDashboardState((prev) => ({ ...prev, isVisible: true }));
    return `dashboard-chart-${Date.now()}`;
  }, []);

  const addDashboardKpi = useCallback((kpiConfig = {}) => {
    setDashboardItems((prev) => {
      const newId = `dashboard-kpi-${Date.now()}`;
      const item = normalizeDashboardItem({
        id: newId,
        itemType: 'kpi',
        title: 'KPI Card',
        semanticConfig: { metricId: '', groupBy: '' },
        comparisonEnabled: true,
        ...kpiConfig,
      }, prev.length);
      return [...prev, item];
    });
    setDashboardState((prev) => ({ ...prev, isVisible: true }));
    return `dashboard-kpi-${Date.now()}`;
  }, []);

  const updateDashboardItem = useCallback((id, updates) => {
    setDashboardItems((prev) => prev.map((item) => {
      if (item.id !== id) return item;
      return normalizeDashboardItem({
        ...item,
        ...updates,
        semanticConfig: updates?.semanticConfig
          ? { ...item.semanticConfig, ...updates.semanticConfig }
          : item.semanticConfig,
      });
    }));
  }, []);

  const removeDashboardItem = useCallback((id) => {
    setDashboardItems((prev) => prev.filter((item) => item.id !== id));
    setMinimizedWindows((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setLockedWindows((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const toggleSlicerPanel = useCallback(() => {
    setIsSlicerPanelOpen((prev) => !prev);
  }, []);

  const setDashboardMode = useCallback((mode) => {
    setDashboardState((prev) => ({ ...prev, mode }));
  }, []);

  const updateDashboardCanvas = useCallback((canvasUpdates) => {
    setDashboardState((prev) => ({ ...prev, canvas: { ...prev.canvas, ...canvasUpdates } }));
  }, []);

  const updateDashboardSharing = useCallback((sharingUpdates) => {
    setDashboardState((prev) => ({ ...prev, sharing: { ...prev.sharing, ...sharingUpdates } }));
  }, []);

  const toggleDashboardItemLock = useCallback((id) => {
    setDashboardItems((prev) => prev.map((item) => {
      if (item.id !== id) return item;
      return { ...item, locked: !item.locked };
    }));
  }, []);

  const updateDashboardItemLayout = useCallback((id, layoutUpdates) => {
    setDashboardItems((prev) => prev.map((item) => {
      if (item.id !== id) return item;
      return { ...item, layout: { ...item.layout, ...layoutUpdates } };
    }));
  }, []);

  const value = useMemo(
    () => ({
      openWindows,
      minimizedWindows,
      openWindow,
      closeWindow,
      minimizeWindow,
      restoreWindow,
      maximizeWindow,
      saveWindowState,
      getWindowState,
      toggleLock,
      isLocked,
      saveWindowContentState,
      getWindowContentState,
      charts,
      addChart,
      removeChart,
      updateChart,
      dashboardState,
      dashboardItems,
      openDashboard,
      closeDashboard,
      isSlicerPanelOpen,
      setIsSlicerPanelOpen,
      toggleSlicerPanel,
      updateDashboard,
      setDashboardFilters,
      clearDashboardFilters,
      addDashboardChart,
      addDashboardKpi,
      updateDashboardItem,
      removeDashboardItem,
      setDashboardMode,
      updateDashboardCanvas,
      updateDashboardSharing,
      toggleDashboardItemLock,
      updateDashboardItemLayout,
    }),
    [
      openWindows,
      minimizedWindows,
      openWindow,
      closeWindow,
      minimizeWindow,
      restoreWindow,
      maximizeWindow,
      saveWindowState,
      getWindowState,
      toggleLock,
      isLocked,
      saveWindowContentState,
      getWindowContentState,
      charts,
      addChart,
      removeChart,
      updateChart,
      dashboardState,
      dashboardItems,
      openDashboard,
      closeDashboard,
      isSlicerPanelOpen,
      setIsSlicerPanelOpen,
      toggleSlicerPanel,
      updateDashboard,
      setDashboardFilters,
      clearDashboardFilters,
      addDashboardChart,
      addDashboardKpi,
      updateDashboardItem,
      removeDashboardItem,
      setDashboardMode,
      updateDashboardCanvas,
      updateDashboardSharing,
      toggleDashboardItemLock,
      updateDashboardItemLayout,
    ]
  );

  return <WindowContext.Provider value={value}>{children}</WindowContext.Provider>;
};

export const useWindowContext = () => useContext(WindowContext);
