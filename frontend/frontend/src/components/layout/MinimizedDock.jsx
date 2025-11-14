import React from 'react';
import MaximizeButton from '../buttons/MaximizeButton';
import { useWindowContext } from '../../context/WindowContext';
import './MinimizedDock.css';

const MinimizedDock = () => {
  const { minimizedWindows, restoreWindow } = useWindowContext();
  const entries = Object.entries(minimizedWindows);
  if (entries.length === 0) return null;
  return (
    <div className="minimized-dock">
      {entries.map(([id, win]) => (
        <div key={id} className="minimized-tab" onClick={() => restoreWindow(id)}>
          <span className="tab-label">{win.label}</span>
          <MaximizeButton windowId={id} />
        </div>
      ))}
    </div>
  );
};

export default MinimizedDock;
