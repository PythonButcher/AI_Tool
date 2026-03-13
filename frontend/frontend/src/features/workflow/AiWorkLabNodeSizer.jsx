import { memo } from 'react';
import { Handle, NodeResizer, Position } from '@xyflow/react';

const STATUS_STYLES = {
  idle: {
    label: 'Idle',
    pillBackground: '#eef2f6',
    pillColor: '#52606d',
    borderColor: '#cfd8e3',
  },
  running: {
    label: 'Running',
    pillBackground: '#e1f0ff',
    pillColor: '#0f5ea8',
    borderColor: '#74b7ff',
  },
  completed: {
    label: 'Completed',
    pillBackground: '#e5f7ee',
    pillColor: '#146b45',
    borderColor: '#7bd3a6',
  },
  failed: {
    label: 'Failed',
    pillBackground: '#fdebec',
    pillColor: '#a5373f',
    borderColor: '#f0aab0',
  },
};

const AiWorkLabNodeSizer = ({ data, selected }) => {
  const Icon = data.icon;
  const statusKey = STATUS_STYLES[data.status] ? data.status : 'idle';
  const statusStyle = STATUS_STYLES[statusKey];

  return (
    <>
      <NodeResizer
        color="#444"
        isVisible={selected}
        minWidth={180}
        minHeight={90}
        lineStyle={{ strokeWidth: 1.5 }}
        handleStyle={{
          width: 10,
          height: 10,
          borderRadius: '2px',
          backgroundColor: '#555',
        }}
      />

      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="handle-target"
        style={{
          top: '50%',
          left: '-12px',
          transform: 'translateY(-50%)',
          zIndex: 10,
        }}
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          gap: '8px',
          padding: '14px 16px',
          borderRadius: '14px',
          border: `1.5px solid ${statusStyle.borderColor}`,
          backgroundColor: '#fefefe',
          boxShadow: selected
            ? '0 0 0 2px rgba(74, 144, 226, 0.35)'
            : '0 12px 28px rgba(36, 52, 67, 0.12)',
          fontFamily: 'Segoe UI, sans-serif',
          fontSize: '14px',
          color: '#1f2a37',
          textAlign: 'left',
          cursor: 'grab',
          position: 'relative',
          minWidth: '200px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
          {Icon && <Icon size={22} style={{ color: '#274c77', flexShrink: 0 }} />}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
            <div style={{ fontWeight: 700 }}>{data.label}</div>
            {data.description && (
              <div style={{ fontSize: '12px', color: '#607080', lineHeight: 1.4 }}>
                {data.description}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', flexWrap: 'wrap' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '4px 10px',
              borderRadius: '999px',
              background: statusStyle.pillBackground,
              color: statusStyle.pillColor,
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
            }}
          >
            {statusStyle.label}
          </span>
          {data.command && (
            <span style={{ fontSize: '11px', color: '#738091' }}>{data.command}</span>
          )}
        </div>

        {data.error && (
          <div style={{ fontSize: '11px', color: '#a5373f', lineHeight: 1.4 }}>
            {data.error}
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="handle-source"
        style={{
          top: '50%',
          right: '-12px',
          transform: 'translateY(-50%)',
          zIndex: 10,
        }}
      />
    </>
  );
};

export default memo(AiWorkLabNodeSizer);
