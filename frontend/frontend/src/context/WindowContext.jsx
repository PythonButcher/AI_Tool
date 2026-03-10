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

export const WindowContext = createContext();

const WINDOW_STATES_STORAGE_KEY = 'windowStates';
const DASHBOARD_STORAGE_KEY = 'businessMonitoringDashboard';

const createDefaultDashboardState = () => ({
  id: 'dashboard-primary',
  name: 'Business Dashboard',
  isVisible: false,
  filters: createDefaultDashboardFilters(),
});

const normalizeSemanticConfig = (semanticConfig) => ({
  metricId: semanticConfig?.metricId || '',
  groupBy: semanticConfig?.groupBy || '',
});

const normalizeDashboardItem = (item) => {
  if (item?.itemType === 'kpi') {
    return {
      id: item.id,
      itemType: 'kpi',
      title: item.title || 'KPI Card',
      semanticConfig: normalizeSemanticConfig(item.semanticConfig),
      comparisonEnabled: item.comparisonEnabled !== false,
    };
  }

  return {
    id: item.id,
    itemType: 'chart',
    chartType: item?.chartType || item?.type || 'Bar',
    mapping: item?.mapping || {},
    dataSourceMode: item?.dataSourceMode || 'raw',
    semanticConfig: normalizeSemanticConfig(item?.semanticConfig),
  };
};

const loadDashboardStorage = () => {
  try {
    const stored = localStorage.getItem(DASHBOARD_STORAGE_KEY);
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
    };

    return {
      state: dashboardState,
      items: Array.isArray(parsed?.items) ? parsed.items.map(normalizeDashboardItem) : [],
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
    localStorage.setItem(DASHBOARD_STORAGE_KEY, JSON.stringify({
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
    const newId = `dashboard-chart-${Date.now()}`;
    const item = normalizeDashboardItem({
      id: newId,
      itemType: 'chart',
      chartType: 'Bar',
      mapping: {},
      dataSourceMode: 'raw',
      semanticConfig: { metricId: '', groupBy: '' },
      ...chartConfig,
    });

    setDashboardItems((prev) => [...prev, item]);
    setDashboardState((prev) => ({ ...prev, isVisible: true }));
    return newId;
  }, []);

  const addDashboardKpi = useCallback((kpiConfig = {}) => {
    const newId = `dashboard-kpi-${Date.now()}`;
    const item = normalizeDashboardItem({
      id: newId,
      itemType: 'kpi',
      title: 'KPI Card',
      semanticConfig: { metricId: '', groupBy: '' },
      comparisonEnabled: true,
      ...kpiConfig,
    });

    setDashboardItems((prev) => [...prev, item]);
    setDashboardState((prev) => ({ ...prev, isVisible: true }));
    return newId;
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
      updateDashboard,
      setDashboardFilters,
      clearDashboardFilters,
      addDashboardChart,
      addDashboardKpi,
      updateDashboardItem,
      removeDashboardItem,
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
      updateDashboard,
      setDashboardFilters,
      clearDashboardFilters,
      addDashboardChart,
      addDashboardKpi,
      updateDashboardItem,
      removeDashboardItem,
    ]
  );

  return <WindowContext.Provider value={value}>{children}</WindowContext.Provider>;
};

export const useWindowContext = () => useContext(WindowContext);
