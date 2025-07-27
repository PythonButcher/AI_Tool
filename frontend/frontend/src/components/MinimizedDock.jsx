import React from 'react';
import MaximizeButton from './button_components/MaximizeButton';
import './css/MinimizedDock.css';

const MinimizedDock = ({ windows, onRestore }) => {
  const entries = Object.entries(windows);
  if (entries.length === 0) return null;
  return (
    <div className="minimized-dock">
      {entries.map(([id, win]) => (
        <div key={id} className="minimized-tab" onClick={() => onRestore(id)}>
          <span className="tab-label">{win.label}</span>
          <MaximizeButton onClick={() => onRestore(id)} />
        </div>
      ))}
    </div>
  );
};

export default MinimizedDock;
