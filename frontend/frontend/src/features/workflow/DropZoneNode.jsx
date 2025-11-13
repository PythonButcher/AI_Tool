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
        backgroundColor: hovering ? 'rgba(173, 216, 230, 0.5)' : '#ffffff',
        padding: '12px 16px',
        border: '2px dashed #aaa',
        borderRadius: '6px',
        width: '240px',
        textAlign: 'center',
        boxShadow: hovering ? '0 0 6px 2px rgba(0, 128, 255, 0.4)' : 'none',
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
