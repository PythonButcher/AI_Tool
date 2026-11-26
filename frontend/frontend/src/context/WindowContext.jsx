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
  normalizeDashboardItemLayout,
  normalizeDashboardItemDisplay,
  normalizeDashboardItemSourceMetadata
} from '../utils/dashboardCanvasUtils';
import { appendDashboardResults } from '../utils/aiDashboardResults';
import useAnalyticsWorkspace from '../features/analytics/useAnalyticsWorkspace';
import { newId } from '../features/analytics/analyticsStorage';

export const WindowContext = createContext();

const WINDOW_STATES_STORAGE_KEY = 'windowStates';
const normalizeSemanticConfig = (semanticConfig) => ({
  metricId: semanticConfig?.metricId || '',
  groupBy: semanticConfig?.groupBy || '',
});

const normalizeDashboardItem = (item, index = 0) => {
  const baseItem = {
    ...item,
    layout: normalizeDashboardItemLayout(item?.layout, index, item?.itemType || 'chart'),
    locked: item?.locked || false,
    display: normalizeDashboardItemDisplay(item?.display),
    sourceMetadata: { ...item?.sourceMetadata, ...normalizeDashboardItemSourceMetadata(item?.sourceMetadata) },
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

export const WindowProvider = ({ children }) => {
  const [openWindows, setOpenWindows] = useState([]);
  const [charts, setCharts] = useState([]);
  const [minimizedWindows, setMinimizedWindows] = useState({});
  const [windowStates, setWindowStates] = useState({});
  const [lockedWindows, setLockedWindows] = useState({});
  const [windowContentStates, setWindowContentStates] = useState({});
  const analytics = useAnalyticsWorkspace();
  const { workspace: analyticsWorkspace, commit: updateAnalyticsWorkspace } = analytics;
  const selectedDashboard = analyticsWorkspace.dashboards.find(board => board.state.id === analyticsWorkspace.activeDashboardId);
  const dashboardState = selectedDashboard.state;
  const dashboardItems = selectedDashboard.items;
  const dashboardStorageError = analytics.error;
  const setDashboardState = useCallback(update => updateAnalyticsWorkspace(workspace => ({ ...workspace,
    dashboards: workspace.dashboards.map(board => board.state.id === workspace.activeDashboardId
      ? { ...board, state: typeof update === 'function' ? update(board.state) : update } : board),
  })), [updateAnalyticsWorkspace]);
  const setDashboardItems = useCallback(update => updateAnalyticsWorkspace(workspace => ({ ...workspace,
    dashboards: workspace.dashboards.map(board => board.state.id === workspace.activeDashboardId
      ? { ...board, items: typeof update === 'function' ? update(board.items) : update } : board),
  })), [updateAnalyticsWorkspace]);
  const [isSlicerPanelOpen, setIsSlicerPanelOpen] = useState(false);
  const pendingAiSave = useRef(null);

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

  const addDashboardResults = useCallback((selections, targetDashboardId) => {
    const selectionKey = JSON.stringify([targetDashboardId || analyticsWorkspace.activeDashboardId, selections]);
    if (pendingAiSave.current?.key === selectionKey && analytics.pending) {
      if (!analytics.retry()) throw new Error('Could not save these results; your draft is still here. Retry the Analytics save.');
      const savedResult = pendingAiSave.current.result;
      pendingAiSave.current = null;
      return savedResult;
    }
    let result;
    const saved = updateAnalyticsWorkspace(workspace => {
      const target = targetDashboardId || workspace.activeDashboardId;
      if (!workspace.dashboards.some(board => board.state.id === target)) throw new Error('Choose an available target dashboard.');
      return { ...workspace, activeDashboardId: target, lastView: 'dashboards', dashboards: workspace.dashboards.map(board => {
      if (board.state.id !== target) return board;
      result = appendDashboardResults(board.items, selections);
      return { ...board, state: { ...board.state, isVisible: true }, items: result.items.map(normalizeDashboardItem) };
    }) }; });
    if (!saved) {
      if (result) pendingAiSave.current = { key: selectionKey, result: { added: result.added, skipped: result.skipped } };
      throw new Error('Could not save these results; your draft is still here. Retry the Analytics save.');
    }
    pendingAiSave.current = null;
    return { added: result.added, skipped: result.skipped };
  }, [updateAnalyticsWorkspace, analytics, analyticsWorkspace.activeDashboardId]);

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
  }, [setDashboardState]);

  const closeDashboard = useCallback(() => {
    setDashboardState((prev) => ({ ...prev, isVisible: false }));
  }, [setDashboardState]);

  const updateDashboard = useCallback((updates) => {
    setDashboardState((prev) => ({
      ...prev,
      ...updates,
      filters: updates?.filters ? normalizeDashboardFilters(updates.filters) : prev.filters,
    }));
  }, [setDashboardState]);

  const setDashboardFilters = useCallback((nextFilters) => {
    setDashboardState((prev) => ({
      ...prev,
      filters: normalizeDashboardFilters(
        typeof nextFilters === 'function' ? nextFilters(prev.filters) : nextFilters
      ),
    }));
  }, [setDashboardState]);

  const clearDashboardFilters = useCallback(() => {
    setDashboardState((prev) => ({
      ...prev,
      filters: createDefaultDashboardFilters(),
    }));
  }, [setDashboardState]);

  const addDashboardTile = useCallback((config, itemType, targetDashboardId) => {
    const id = newId(`dashboard-${itemType}`);
    const success = updateAnalyticsWorkspace(workspace => {
      const target = targetDashboardId || workspace.activeDashboardId;
      if (!workspace.dashboards.some(board => board.state.id === target)) throw new Error('Choose an available target dashboard.');
      return { ...workspace, activeDashboardId: target, lastView: 'dashboards', dashboards: workspace.dashboards.map(board => board.state.id !== target ? board : {
        ...board, state: { ...board.state, isVisible: true },
        items: [...board.items, normalizeDashboardItem({ ...config, id, itemType }, board.items.length)],
      }) };
    });
    return success ? id : null;
  }, [updateAnalyticsWorkspace]);
  const addDashboardChart = useCallback((config = {}, target) => addDashboardTile(config, 'chart', target), [addDashboardTile]);
  const addDashboardKpi = useCallback((config = {}, target) => addDashboardTile(config, 'kpi', target), [addDashboardTile]);

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
  }, [setDashboardItems]);

  const removeDashboardItem = useCallback((id) => {
    if (!setDashboardItems((prev) => prev.filter((item) => item.id !== id))) return;
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
  }, [setDashboardItems]);

  const toggleSlicerPanel = useCallback(() => {
    setIsSlicerPanelOpen((prev) => !prev);
  }, []);

  const setDashboardMode = useCallback((mode) => {
    setDashboardState((prev) => ({ ...prev, mode }));
  }, [setDashboardState]);

  const updateDashboardCanvas = useCallback((canvasUpdates) => {
    setDashboardState((prev) => ({ ...prev, canvas: { ...prev.canvas, ...canvasUpdates } }));
  }, [setDashboardState]);

  const updateDashboardSharing = useCallback((sharingUpdates) => {
    setDashboardState((prev) => ({ ...prev, sharing: { ...prev.sharing, ...sharingUpdates } }));
  }, [setDashboardState]);

  const toggleDashboardItemLock = useCallback((id) => {
    setDashboardItems((prev) => prev.map((item) => {
      if (item.id !== id) return item;
      return { ...item, locked: !item.locked };
    }));
  }, [setDashboardItems]);

  const updateDashboardItemLayout = useCallback((id, layoutUpdates) => {
    setDashboardItems((prev) => prev.map((item) => {
      if (item.id !== id) return item;
      return { ...item, layout: { ...item.layout, ...layoutUpdates } };
    }));
  }, [setDashboardItems]);

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
      analyticsWorkspace,
      updateAnalyticsWorkspace,
      analyticsStorage: analytics,
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
      analyticsWorkspace,
      updateAnalyticsWorkspace,
      analytics,
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
