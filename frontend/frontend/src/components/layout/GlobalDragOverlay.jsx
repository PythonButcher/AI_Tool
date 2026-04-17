import React, { useMemo } from 'react';
import { DragOverlay, useDndContext } from '@dnd-kit/core';
import { AiOutlineHolder } from 'react-icons/ai';

const GlobalDragOverlay = () => {
  const { active } = useDndContext();

  const activeItem = useMemo(() => {
    const current = active?.data?.current;
    if (!current) return null;
    if (current.type === 'field') return current.metadata || null;
    if (current.type === 'semantic-object') return current.metadata || null;
    return null;
  }, [active]);

  if (!activeItem) return null;

  const type = activeItem.type || (activeItem.objectKind === 'metric' ? 'numeric' : 'categorical');
  const source = activeItem.source || 'semantic';

  return (
    <DragOverlay dropAnimation={null}>
      <div 
        className={`global-drag-ghost global-drag-ghost--${type}`}
        style={{
          background: 'var(--bg-primary)',
          border: '2px solid var(--accent-blue)',
          borderRadius: '12px',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.15)',
          transform: 'scale(1.05) rotate(2deg)',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          minWidth: '220px',
          pointerEvents: 'none',
          zIndex: 99999,
        }}
      >
        <div style={{ color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center' }}>
          <AiOutlineHolder size={20} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
            {activeItem.label}
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>
            {source === 'semantic' ? '★ Semantic' : 'Raw Field'} • {type}
          </div>
        </div>
      </div>
    </DragOverlay>
  );
};

export default GlobalDragOverlay;
