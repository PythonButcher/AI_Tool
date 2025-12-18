import { memo } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';

const AiWorkLabNodeSizer = ({ data, selected }) => {
  const Icon = data.icon;

  return (
    <>
      <NodeResizer
        color="var(--text-secondary)"
        isVisible={selected}
        minWidth={120}
        minHeight={60}
        lineStyle={{ strokeWidth: 1.5 }}
        handleStyle={{
          width: 10,
          height: 10,
          borderRadius: '2px',
          backgroundColor: 'var(--text-secondary)',
        }}
      />

      {/* Target (input) handle styled via .handle-target */}
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
          alignItems: 'center',
          justifyContent: 'center',
          padding: '14px',
          borderRadius: '10px',
          border: '1.5px solid var(--border-color)',
          backgroundColor: 'var(--bg-primary)',
          boxShadow: selected
            ? `0 0 0 2px var(--accent-blue)`
            : '0 2px 6px var(--shadow-color-soft)',
          fontFamily: 'var(--font-family-base)',
          fontSize: '14px',
          color: 'var(--text-primary)',
          textAlign: 'center',
          cursor: 'grab',
          position: 'relative',
          minWidth: '130px',
        }}
      >
        {Icon && <Icon size={24} style={{ color: 'var(--text-secondary)', marginBottom: '6px' }} />}
        <div style={{ fontWeight: 600 }}>{data.label}</div>
        <div style={{ fontSize: '12px', marginTop: '4px', color: 'var(--text-secondary)' }}>
          {data.status === 'pending' && '⏳ Running...'}
          {data.status === 'success' && '✅ Done'}
          {data.status === 'error' && '❌ Error'}
        </div>
      </div>

      {/* Source (output) handle styled via .handle-source */}
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
