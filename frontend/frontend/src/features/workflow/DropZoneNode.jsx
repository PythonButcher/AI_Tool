import React, { useEffect } from 'react';
import { FiTarget } from 'react-icons/fi';

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
        backgroundColor: hovering ? '#eff6ff' : '#ffffff',
        padding: '24px',
        border: `2px dashed ${hovering ? '#2563eb' : '#cbd5e1'}`,
        borderRadius: '16px',
        width: '280px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        boxShadow: hovering ? '0 10px 15px -3px rgba(37, 99, 235, 0.1)' : '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        textAlign: 'center',
      }}
    >
      <div 
        style={{ 
          width: '48px', 
          height: '48px', 
          borderRadius: '50%', 
          background: hovering ? '#2563eb' : '#f1f5f9',
          color: hovering ? '#ffffff' : '#64748b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s'
        }}
      >
        <FiTarget size={24} />
      </div>
      <div>
        <div style={{ 
          fontWeight: 700, 
          fontSize: '15px', 
          color: hovering ? '#1e40af' : '#1e293b',
          marginBottom: '4px'
        }}>
          Execution Zone
        </div>
        <div style={{ 
          fontSize: '12px', 
          color: hovering ? '#3b82f6' : '#64748b'
        }}>
          Drop the "Execute" node here to trigger the pipeline.
        </div>
      </div>
    </div>
  );
};

export default DropZoneNode;
