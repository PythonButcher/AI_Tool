import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  useEffect,
  useCallback,
} from 'react';

export const WindowContext = createContext();

export const WindowProvider = ({ children }) => {
  const [openWindows, setOpenWindows] = useState([]);
  const [minimizedWindows, setMinimizedWindows] = useState({});
  const [windowStates, setWindowStates] = useState({});
  const [lockedWindows, setLockedWindows] = useState({});
  const [windowContentStates, setWindowContentStates] = useState({});



  const openWindow = (id) => {
    setOpenWindows((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  useEffect(() => {
    const stored = localStorage.getItem('windowStates');
    if (stored) {
      try {
        setWindowStates(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse stored window states', e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('windowStates', JSON.stringify(windowStates));
  }, [windowStates]);

  const saveWindowState = (id, layout) => {
    setWindowStates(prev => ({ ...prev, [id]: layout }));
};

  const getWindowState = (id) => windowStates[id] || null;

  const saveWindowContentState = useCallback((id, data) => {
    setWindowContentStates(prev => ({ ...prev, [id]: data }));
  }, []);

  const getWindowContentState = useCallback(
    (id) => windowContentStates[id] || null,
    [windowContentStates]
  );

  const toggleLock = (id) => {
  setLockedWindows(prev => ({ ...prev, [id]: !prev[id] }));
};

  const isLocked = (id) => !!lockedWindows[id];

  const closeWindow = (id) => {
    setOpenWindows((prev) => prev.filter((w) => w !== id));
    setMinimizedWindows((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    setLockedWindows((prev) => {          // <-- clear lock if closed
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };


  const minimizeWindow = (id, label) => {
    setMinimizedWindows((prev) => ({ ...prev, [id]: { label } }));
  };

  const restoreWindow = (id) => {
    setMinimizedWindows((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  const maximizeWindow = (id) => {
    // placeholder for future maximize behavior
    restoreWindow(id);
  };


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
    }),
    [openWindows, minimizedWindows, windowStates, lockedWindows, windowContentStates]
  );

  return <WindowContext.Provider value={value}>{children}</WindowContext.Provider>;
};

export const useWindowContext = () => useContext(WindowContext);

