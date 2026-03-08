import React, { useEffect, useLayoutEffect } from 'react';
import { useWindowInteraction } from '../../hooks/useWindowInteraction';
import CloseButton from '../buttons/CloseButton';
import MinimizeButton from '../buttons/MinimizeButton';
import MaximizeButton from '../buttons/MaximizeButton';
import { FaLock, FaLockOpen } from 'react-icons/fa';
import './WindowFrame.css';

const WindowFrame = ({
  id,
  title,
  initialState,
  children,
  onClose,
  onMinimize,
  onMaximize,
  onFocus,
  onSave,
  onResize,
  onDrag,
  isLocked,
  onToggleLock,
  containerRef,
  zIndex,
  isActive,
  registerWindow // (id, node, stateRef) => void
}) => {
  const {
    windowRef,
    stateRef,
    handleDragStart,
    handleResizeStart,
    applyTransform
  } = useWindowInteraction({
    id,
    initialState,
    containerRef,
    onFocus,
    onSave,
    onResize,
    onDrag,
    snapEnabled: true,
    minWidth: 300,
    minHeight: 200
  });

  // Apply initial transform immediately to avoid flash
  useLayoutEffect(() => {
    applyTransform();
  }, [applyTransform]);

  // Register with parent Layout Arbiter
  useEffect(() => {
    if (registerWindow && windowRef.current) {
        registerWindow(id, windowRef.current, stateRef);
    }
    // Cleanup on unmount
    return () => {
        if (registerWindow) registerWindow(id, null, null);
    };
  }, [id, registerWindow]);

  return (
    <div
      ref={windowRef}
      className={`window-frame ${isActive ? 'active' : ''}`}
      style={{
        zIndex: zIndex,
        position: 'absolute',
        top: 0,
        left: 0,
        // width/height/transform managed by hook directly
        boxShadow: isActive ? '0 10px 40px rgba(0,0,0,0.2)' : '0 4px 12px rgba(0,0,0,0.1)',
        opacity: 0, // Hidden until JS sets transform
        animation: 'windowFrameFadeIn 0.2s forwards'
      }}
      onPointerDown={() => onFocus(id)}
    >
      <div 
        className="window-header"
        onPointerDown={handleDragStart}
        style={{ cursor: 'grab' }} // managed by hook 'move'
      >
        <div className="header-title-container">
            <span className="header-title">{title}</span>
        </div>
        
        <div 
          className="header-button-group"
          onPointerDown={(e) => e.stopPropagation()}
        >
            {onToggleLock && (
               <button
                 className="header-button-lock"
                 onClick={(e) => { e.stopPropagation(); onToggleLock(id); }}
                 title={isLocked ? 'Unlock Window' : 'Lock Window'}
               >
                 {isLocked ? <FaLock size={12}/> : <FaLockOpen size={12}/>}
               </button>
            )}
            {onMinimize && <MinimizeButton onClick={(e) => { e.stopPropagation(); onMinimize(id, title); }} />}
            {onMaximize && <MaximizeButton windowId={id} />}
            {onClose && <CloseButton onClick={(e) => { e.stopPropagation(); onClose(id); }} />}
        </div>
      </div>

      <div className="window-content-area">
        {children}
      </div>

      {/* Resize Handles */}
      {!isLocked && (
        <>
          <div className="resize-handle n" onPointerDown={(e) => handleResizeStart(e, 'n')} />
          <div className="resize-handle s" onPointerDown={(e) => handleResizeStart(e, 's')} />
          <div className="resize-handle e" onPointerDown={(e) => handleResizeStart(e, 'e')} />
          <div className="resize-handle w" onPointerDown={(e) => handleResizeStart(e, 'w')} />
          <div className="resize-handle ne" onPointerDown={(e) => handleResizeStart(e, 'ne')} />
          <div className="resize-handle nw" onPointerDown={(e) => handleResizeStart(e, 'nw')} />
          <div className="resize-handle se" onPointerDown={(e) => handleResizeStart(e, 'se')} />
          <div className="resize-handle sw" onPointerDown={(e) => handleResizeStart(e, 'sw')} />
        </>
      )}
    </div>
  );
};

export default WindowFrame;
