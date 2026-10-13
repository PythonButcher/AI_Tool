import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
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
import { appendDashboardResults } from '../utils/aiDashboardResults';

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
    resultSnapshot: item?.resultSnapshot || null,
    createdAt: item?.createdAt,
    updatedAt: item?.updatedAt,
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
  for (const key of [DASHBOARD_V1_STORAGE_KEY, DASHBOARD_STORAGE_KEY]) {
    try {
    const stored = localStorage.getItem(key);
    if (!stored) continue;
    const parsed = JSON.parse(stored);
    if (!parsed || !Array.isArray(parsed.items) || !parsed.state || typeof parsed.state !== 'object') continue;
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
    // A damaged v1 value must not prevent recovery from the untouched legacy key.
    console.warn('Could not load dashboard storage', key);
  }
  }
  return { state: createDefaultDashboardState(), items: [] };
};

export const WindowProvider = ({ children }) => {
  const [openWindows, setOpenWindows] = useState([]);
  const [charts, setCharts] = useState([]);
  const [minimizedWindows, setMinimizedWindows] = useState({});
  const [windowStates, setWindowStates] = useState({});
  const [lockedWindows, setLockedWindows] = useState({});
  const [windowContentStates, setWindowContentStates] = useState({});
  const [initialDashboard] = useState(loadDashboardStorage);
  const [dashboardState, setDashboardState] = useState(initialDashboard.state);
  const [dashboardItems, setDashboardItems] = useState(initialDashboard.items);
  const [dashboardStorageError, setDashboardStorageError] = useState(null);
  const dashboardRef = useRef({ state: dashboardState, items: dashboardItems });
  dashboardRef.current = { state: dashboardState, items: dashboardItems };
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

  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(WINDOW_STATES_STORAGE_KEY, JSON.stringify(windowStates));
    } catch (error) {
      // Window geometry is optional. Dashboard persistence reports its own
      // actionable error rather than letting a storage exception unmount UI.
    }
  }, [windowStates]);

  useEffect(() => {
    try {
    localStorage.setItem(DASHBOARD_V1_STORAGE_KEY, JSON.stringify({
      state: dashboardState,
      items: dashboardItems,
    }));
    setDashboardStorageError(null);
    } catch (error) {
      setDashboardStorageError('Dashboard changes could not be saved in this browser. Free local storage and try again.');
    }
  }, [dashboardItems, dashboardState]);

  const addDashboardResults = useCallback((selections) => {
    const current = dashboardRef.current;
    const result = appendDashboardResults(current.items, selections);
    const next = { state: { ...current.state, isVisible: true }, items: result.items.map(normalizeDashboardItem) };
    // Write before acknowledging success. A quota/storage failure leaves the
    // reviewable draft and existing dashboard intact for a deliberate retry.
    try {
      localStorage.setItem(DASHBOARD_V1_STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
      const message = 'Could not save these results. Free browser storage and try again; your draft is still here.';
      setDashboardStorageError(message);
      throw new Error(message);
    }
    dashboardRef.current = next;
    setDashboardItems(next.items);
    setDashboardState(next.state);
    setDashboardStorageError(null);
    return { added: result.added, skipped: result.skipped };
  }, []);

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
      dashboardStorageError,
      addDashboardResults,
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
      dashboardStorageError,
      addDashboardResults,
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
