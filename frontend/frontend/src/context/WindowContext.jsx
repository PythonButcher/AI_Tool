import React, { createContext, useContext, useState, useMemo } from 'react';

export const WindowContext = createContext();

export const WindowProvider = ({ children }) => {
  const [openWindows, setOpenWindows] = useState({});
  const [minimizedWindows, setMinimizedWindows] = useState({});

  const openWindow = (id, data) => {
    setOpenWindows(prev => ({ ...prev, [id]: data }));
  };

  const closeWindow = (id) => {
    setOpenWindows(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    // also ensure it's not minimized
    setMinimizedWindows(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  const minimizeWindow = (id, label) => {
    setMinimizedWindows(prev => ({ ...prev, [id]: { label } }));
  };

  const restoreWindow = (id) => {
    setMinimizedWindows(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  // placeholder for future expansion
  const maximizeWindow = (id) => {
    restoreWindow(id);
  };

  const value = useMemo(() => ({
    openWindows,
    minimizedWindows,
    openWindow,
    closeWindow,
    minimizeWindow,
    restoreWindow,
    maximizeWindow,
  }), [openWindows, minimizedWindows]);

  return (
    <WindowContext.Provider value={value}>{children}</WindowContext.Provider>
  );
};

export const useWindowContext = () => useContext(WindowContext);
