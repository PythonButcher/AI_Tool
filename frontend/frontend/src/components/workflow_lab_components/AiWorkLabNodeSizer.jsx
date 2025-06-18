import { memo } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';

const AiWorkLabNodeSizer = ({ data, selected }) => {
  const Icon = data.icon;

  return (
    <>
      <NodeResizer
        color="#444"
        isVisible={selected}
        minWidth={120}
        minHeight={60}
        lineStyle={{ strokeWidth: 1.5 }}
        handleStyle={{
          width: 10,
          height: 10,
          borderRadius: '2px',
          backgroundColor: '#555',
        }}
      />

      {/* Target (input) */}
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
          border: '1.5px solid #aaa',
          backgroundColor: '#fefefe',
          boxShadow: selected
            ? '0 0 0 2px #4a90e2'
            : '0 2px 6px rgba(0, 0, 0, 0.12)',
          fontFamily: 'Segoe UI, sans-serif',
          fontSize: '14px',
          color: '#222',
          textAlign: 'center',
          cursor: 'grab',
          position: 'relative',
          minWidth: '130px',
        }}
      >
        {Icon && <Icon size={24} style={{ color: '#444', marginBottom: '6px' }} />}
        <div style={{ fontWeight: 600 }}>{data.label}</div>
        <div style={{ fontSize: '12px', marginTop: '4px', color: '#666' }}>
          {data.status === 'pending' && '⏳ Running...'}
          {data.status === 'success' && '✅ Done'}
          {data.status === 'error' && '❌ Error'}
        </div>
      </div>

      {/* Source (output) */}
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
