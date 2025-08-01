import React, { createContext, useContext, useState, useMemo } from 'react';

export const WindowContext = createContext();

export const WindowProvider = ({ children }) => {
  const [openWindows, setOpenWindows] = useState([]);
  const [minimizedWindows, setMinimizedWindows] = useState({});
  const [windowStates, setWindowStates] = useState({});
  const [componentStates, setComponentStates] = useState({});
  const [lockedWindows, setLockedWindows] = useState({});



  const openWindow = (id) => {
    setOpenWindows((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const saveWindowState = (id, layout) => {
    setWindowStates(prev => ({ ...prev, [id]: layout }));
};

  const getWindowState = (id) => windowStates[id] || null;

  const saveComponentState = (id, state) => {
    setComponentStates(prev => ({ ...prev, [id]: state }));
  };

  const getComponentState = id => componentStates[id];

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
      saveComponentState,
      getComponentState,
      toggleLock,
      isLocked,
      componentStates,
    }),
    [openWindows, minimizedWindows, windowStates, componentStates, lockedWindows]
  );

  return <WindowContext.Provider value={value}>{children}</WindowContext.Provider>;
};

export const useWindowContext = () => useContext(WindowContext);

