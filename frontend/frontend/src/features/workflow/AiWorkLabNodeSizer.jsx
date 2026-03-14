import { memo } from 'react';
import { Handle, NodeResizer, Position } from '@xyflow/react';

const STATUS_CONFIG = {
  idle: {
    label: 'Idle',
    bg: '#f1f5f9',
    color: '#64748b',
    border: '#e2e8f0',
  },
  running: {
    label: 'Running',
    bg: '#eff6ff',
    color: '#2563eb',
    border: '#bfdbfe',
  },
  completed: {
    label: 'Completed',
    bg: '#ecfdf5',
    color: '#059669',
    border: '#a7f3d0',
  },
  failed: {
    label: 'Failed',
    bg: '#fef2f2',
    color: '#dc2626',
    border: '#fecaca',
  },
};

const AiWorkLabNodeSizer = ({ data, selected }) => {
  const Icon = data.icon;
  const status = STATUS_CONFIG[data.status] || STATUS_CONFIG.idle;

  return (
    <div className={`wf-node-wrapper ${selected ? 'selected' : ''}`} style={{ position: 'relative' }}>
      <NodeResizer
        color="#2563eb"
        isVisible={selected}
        minWidth={200}
        minHeight={100}
        lineStyle={{ strokeWidth: 2 }}
        handleStyle={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: '#2563eb',
          border: '2px solid #ffffff',
        }}
      />

      <Handle
        type="target"
        position={Position.Left}
        id="input"
        style={{
          width: '12px',
          height: '12px',
          left: '-6px',
          background: '#ffffff',
          border: '2px solid #cbd5e1',
          zIndex: 10,
        }}
      />

      <div
        className="wf-node-card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          padding: '16px',
          borderRadius: '12px',
          background: '#ffffff',
          border: `1px solid ${selected ? '#2563eb' : status.border}`,
          boxShadow: selected 
            ? '0 10px 15px -3px rgba(37, 99, 235, 0.1), 0 4px 6px -4px rgba(37, 99, 235, 0.1)'
            : '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
          minWidth: '220px',
          transition: 'all 0.2s ease',
          cursor: 'grab',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
          <div 
            style={{ 
              padding: '8px', 
              borderRadius: '8px', 
              background: '#f8fafc',
              color: '#475569',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #f1f5f9'
            }}
          >
            {Icon && <Icon size={20} />}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {data.label}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {data.command}
            </div>
          </div>
        </div>

        {data.description && (
          <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.5, marginBottom: '12px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {data.description}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
          <div 
            style={{ 
              fontSize: '10px', 
              fontWeight: 700, 
              textTransform: 'uppercase', 
              letterSpacing: '0.05em',
              padding: '2px 8px',
              borderRadius: '4px',
              background: status.bg,
              color: status.color,
              border: `1px solid ${status.border}`
            }}
          >
            {status.label}
          </div>
        </div>

        {data.error && (
          <div style={{ marginTop: '8px', fontSize: '11px', color: '#dc2626', background: '#fef2f2', padding: '6px', borderRadius: '4px', border: '1px solid #fecaca' }}>
            {data.error}
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="output"
        style={{
          width: '12px',
          height: '12px',
          right: '-6px',
          background: '#ffffff',
          border: '2px solid #cbd5e1',
          zIndex: 10,
        }}
      />
    </div>
  );
};

export default memo(AiWorkLabNodeSizer);
