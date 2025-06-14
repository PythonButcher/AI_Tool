import { memo } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';

const AiWorkLabNodeSizer = ({ data, selected }) => {
  const Icon = data.icon;

  return (
    <>
      <NodeResizer
        color="#444"
        isVisible={selected}
        minWidth={100}
        minHeight={50}
        lineStyle={{ strokeWidth: 1.2 }}
        handleStyle={{
          width: 10,
          height: 10,
          borderRadius: '2px',
          backgroundColor: '#666',
        }}
      />

      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#666' }}
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '10px',
          borderRadius: '8px',
          border: '1px solid #aaa',
          backgroundColor: '#f0f0f0',
          boxShadow: selected
            ? '0 0 0 2px #888'
            : '0 2px 6px rgba(0, 0, 0, 0.15)',
          fontFamily: 'sans-serif',
          fontSize: '13px',
          color: '#333',
          textAlign: 'center',
          cursor: 'grab',
          transition: 'box-shadow 0.2s ease, transform 0.2s ease',
        }}
      >
        {Icon && <Icon size={20} style={{ color: '#555' }} />}
        <div>{data.label}</div>
        <div style={{ fontSize: '11px', marginTop: '4px' }}>
          {data.status === 'pending' && '⏳ Running...'}
          {data.status === 'success' && '✅ Done'}
          {data.status === 'error' && '❌ Error'}
        </div>
        
       </div>
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: '#666' }}
      />
    </>
  );
};

export default memo(AiWorkLabNodeSizer);
