// src/context/HelpOverlayContext.jsx
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from 'react';

const STORAGE_KEY = 'helpVisible_v1';

const HelpOverlayContext = createContext(null);

export const HelpOverlayProvider = ({ children }) => {
  const [helpVisible, setHelpVisible] = useState({});

  // Load persisted visibility map once
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setHelpVisible(JSON.parse(raw));
    } catch (e) {
      // no-op
    }
  }, []);

  // Persist on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(helpVisible));
    } catch (e) {
      // no-op
    }
  }, [helpVisible]);

  const openHelp = useCallback((id) => {
    setHelpVisible((prev) => ({ ...prev, [id]: true }));
  }, []);

  const closeHelp = useCallback((id) => {
    setHelpVisible((prev) => ({ ...prev, [id]: false }));
  }, []);

  const toggleHelp = useCallback((id) => {
    setHelpVisible((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const isHelpVisible = useCallback(
    (id) => !!helpVisible[id],
    [helpVisible]
  );

  const value = useMemo(
    () => ({
      // state
      helpVisible,
      // actions
      openHelp,
      closeHelp,
      toggleHelp,
      // selectors
      isHelpVisible,
    }),
    [helpVisible, openHelp, closeHelp, toggleHelp, isHelpVisible]
  );

  return (
    <HelpOverlayContext.Provider value={value}>
      {children}
    </HelpOverlayContext.Provider>
  );
};

export const useHelpOverlay = () => {
  const ctx = useContext(HelpOverlayContext);
  if (!ctx) {
    throw new Error('useHelpOverlay must be used within HelpOverlayProvider');
  }
  return ctx;
};
