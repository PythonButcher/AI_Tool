import React, { createContext, useContext, useState, useMemo } from 'react';

export const WindowContext = createContext();

export const WindowProvider = ({ children }) => {
  const [openWindows, setOpenWindows] = useState([]);
  const [minimizedWindows, setMinimizedWindows] = useState({});
  const [lockedWindows, setLockedWindows] = useState({});
  const [windowLayouts, setWindowLayouts] = useState({});

  const openWindow = (id) => {
    setOpenWindows((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const closeWindow = (id) => {
    setOpenWindows((prev) => prev.filter((w) => w !== id));
    setMinimizedWindows((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    setWindowLayouts((prev) => {
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

  const lockWindow = (id) => {
    setLockedWindows((prev) => ({ ...prev, [id]: true }));
  };

  const unlockWindow = (id) => {
    setLockedWindows((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  const updateWindowLayout = (id, layout) => {
    setWindowLayouts((prev) => ({ ...prev, [id]: layout }));
  };

  const maximizeWindow = (id) => {
    // placeholder for future maximize behavior
    restoreWindow(id);
  };

  const value = useMemo(
    () => ({
      openWindows,
      minimizedWindows,
      lockedWindows,
      windowLayouts,
      openWindow,
      closeWindow,
      minimizeWindow,
      restoreWindow,
      maximizeWindow,
      lockWindow,
      unlockWindow,
      updateWindowLayout,
    }),
    [openWindows, minimizedWindows, lockedWindows, windowLayouts]
  );

  return <WindowContext.Provider value={value}>{children}</WindowContext.Provider>;
};

export const useWindowContext = () => useContext(WindowContext);

