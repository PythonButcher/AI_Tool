// 📂 File: DropZoneNode.jsx — updated to reflect live hover state from AiWorkflowLab

import React, { useEffect } from 'react';

const DropZoneNode = ({ data }) => {
  const { hovering } = data;

  useEffect(() => {
    if (hovering) {
      console.log("🟢 EXECUTE zone: Execute node hovered");
    } else {
      console.log("🔴 EXECUTE zone: No node hovered");
    }
  }, [hovering]);

  return (
    <div
      style={{
        backgroundColor: hovering ? 'var(--accent-blue-soft)' : 'var(--bg-primary)',
        padding: '12px 16px',
        border: '2px dashed var(--border-color)',
        borderRadius: '6px',
        width: '240px',
        textAlign: 'center',
        boxShadow: hovering ? `0 0 6px 2px var(--accent-blue-glow)` : 'none',
        transition: 'all 0.2s ease-in-out',
        fontWeight: 'bold',
        fontSize: '14px',
      }}
    >
      <span role="img" aria-label="cloud">☁️</span> Drop "Execute" Node Here
    </div>
  );
};

export default DropZoneNode;
