import React, { useEffect, useLayoutEffect } from 'react';
import { useWindowInteraction } from '../../hooks/useWindowInteraction';
import CloseButton from '../buttons/CloseButton';
import MinimizeButton from '../buttons/MinimizeButton';
import MaximizeButton from '../buttons/MaximizeButton';
import { FaLock, FaLockOpen } from 'react-icons/fa';
import { WINDOW_SIZING } from '../../utils/windowSizing';
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
  registerWindow,
  minWidth = WINDOW_SIZING.DEFAULT.minW,
  minHeight = WINDOW_SIZING.DEFAULT.minH,
  footer,
}) => {
  const [isMinimizing, setIsMinimizing] = React.useState(false);

  const {
    windowRef,
    stateRef,
    handleDragStart,
    handleResizeStart,
    applyTransform,
    isDragging,
    isResizing,
  } = useWindowInteraction({
    id,
    initialState,
    containerRef,
    onFocus,
    onSave,
    onResize,
    onDrag,
    snapEnabled: true,
    minWidth,
    minHeight,
  });

  useLayoutEffect(() => {
    applyTransform();
  }, [applyTransform]);

  useEffect(() => {
    if (registerWindow && windowRef.current) {
      registerWindow(id, windowRef.current, stateRef);
    }
    return () => {
      if (registerWindow) registerWindow(id, null, null);
    };
  }, [id, registerWindow, stateRef, windowRef]);

  const handleMinimize = (event) => {
    event.stopPropagation();
    setIsMinimizing(true);
    setTimeout(() => {
      onMinimize(id, title);
    }, 200);
  };

  const handleClose = (event) => {
    event.stopPropagation();
    setIsMinimizing(true);
    setTimeout(() => {
      onClose(id);
    }, 200);
  };

  return (
    <div
      ref={windowRef}
      className={`window-frame ${isActive ? 'active' : ''} ${isDragging ? 'is-dragging' : ''} ${isResizing ? 'is-resizing' : ''} ${isMinimizing ? 'minimizing' : ''}`}
      style={{
        zIndex,
        position: 'absolute',
        top: 0,
        left: 0,
      }}
      onPointerDown={() => onFocus(id)}
    >
      <div className="window-surface">
        <div
          className="window-header"
          onPointerDown={handleDragStart}
          style={{ cursor: 'grab' }}
        >
          <div className="header-title-container">
            <span className="header-title">{title}</span>
          </div>

          <div
            className="header-button-group"
            onPointerDown={(event) => event.stopPropagation()}
          >
            {onToggleLock && (
              <button
                className="header-button-lock"
                onClick={(event) => { event.stopPropagation(); onToggleLock(id); }}
                title={isLocked ? 'Unlock Window' : 'Lock Window'}
              >
                {isLocked ? <FaLock size={12} /> : <FaLockOpen size={12} />}
              </button>
            )}
            {onMinimize && <MinimizeButton onClick={handleMinimize} />}
            {onMaximize && <MaximizeButton windowId={id} />}
            {onClose && <CloseButton onClick={handleClose} />}
          </div>
        </div>

        <div className="window-content-area">
          {children}
        </div>

        {footer && (
          <div className="window-footer">
            {footer}
          </div>
        )}
      </div>

      {!isLocked && (
        <>
          <div className="resize-handle n" onPointerDown={(event) => handleResizeStart(event, 'n')} />
          <div className="resize-handle s" onPointerDown={(event) => handleResizeStart(event, 's')} />
          <div className="resize-handle e" onPointerDown={(event) => handleResizeStart(event, 'e')} />
          <div className="resize-handle w" onPointerDown={(event) => handleResizeStart(event, 'w')} />
          <div className="resize-handle ne" onPointerDown={(event) => handleResizeStart(event, 'ne')} />
          <div className="resize-handle nw" onPointerDown={(event) => handleResizeStart(event, 'nw')} />
          <div className="resize-handle se" onPointerDown={(event) => handleResizeStart(event, 'se')} />
          <div className="resize-handle sw" onPointerDown={(event) => handleResizeStart(event, 'sw')} />
        </>
      )}
    </div>
  );
};

export default WindowFrame;
