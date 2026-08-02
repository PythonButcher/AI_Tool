import React from 'react';
import { FiTarget, FiZap } from 'react-icons/fi';

/**
 * DropZoneNode — execution trigger zone on the canvas.
 * Updated for the dark canvas studio aesthetic with glassmorphic container
 * and animated glow when the execute node hovers over it.
 */
const DropZoneNode = ({ data }) => {
  const { hovering } = data;

  return (
    <div
      style={{
        backgroundColor: hovering
          ? 'rgba(37, 99, 235, 0.12)'
          : 'rgba(255, 255, 255, 0.04)',
        padding: '28px',
        border: `2px dashed ${hovering ? '#3b82f6' : '#334155'}`,
        borderRadius: '20px',
        width: '300px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '14px',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        boxShadow: hovering
          ? '0 0 40px rgba(37, 99, 235, 0.2), 0 0 80px rgba(37, 99, 235, 0.08)'
          : '0 2px 8px rgba(0, 0, 0, 0.1)',
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        textAlign: 'center',
        animation: hovering ? 'wf-glow 2s ease-in-out infinite' : 'none',
      }}
    >
      <div
        style={{
          width: '52px',
          height: '52px',
          borderRadius: '14px',
          background: hovering
            ? 'linear-gradient(135deg, #2563eb, #7c3aed)'
            : 'rgba(100, 116, 139, 0.15)',
          color: hovering ? '#ffffff' : '#94a3b8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: hovering
            ? '0 4px 16px rgba(37, 99, 235, 0.3)'
            : 'none',
        }}
      >
        {hovering ? <FiZap size={26} /> : <FiTarget size={26} />}
      </div>
      <div>
        <div
          style={{
            fontWeight: 700,
            fontSize: '15px',
            color: hovering ? '#93c5fd' : '#e2e8f0',
            marginBottom: '5px',
            letterSpacing: '-0.01em',
          }}
        >
          Execution Zone
        </div>
        <div
          style={{
            fontSize: '12px',
            color: hovering ? '#60a5fa' : '#64748b',
            lineHeight: 1.4,
          }}
        >
          Drop the Execute node here to trigger the pipeline.
        </div>
      </div>
    </div>
  );
};

export default DropZoneNode;
