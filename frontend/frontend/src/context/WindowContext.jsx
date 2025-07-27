import React, { createContext, useContext, useState, useMemo } from 'react';

export const WindowContext = createContext();

export const WindowProvider = ({ children }) => {
  const [openWindows, setOpenWindows] = useState([]);
  const [minimizedWindows, setMinimizedWindows] = useState({});

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
    }),
    [openWindows, minimizedWindows]
  );

  return <WindowContext.Provider value={value}>{children}</WindowContext.Provider>;
};

export const useWindowContext = () => useContext(WindowContext);

