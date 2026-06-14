import { useRef, useEffect, useState, useCallback } from 'react';

/**
 * useWindowInteraction
 * 
 * Manages the high-performance drag and resize logic for a single window.
 * Supports cooperative layouts by negotiating deltas with a parent handler.
 */
export const useWindowInteraction = ({
  id,
  initialState,
  containerRef,
  onFocus,
  onSave,
  onResize, // (id, dx, dy, dir) => { dx, dy } (Adjusted deltas)
  onDrag,   // (id, x, y) => { x, y } (Adjusted coords)
  minWidth = 400,
  minHeight = 300,
  snapEnabled = true
}) => {
  // Current geometric state (Mutable, high-freq)
  const stateRef = useRef({
    x: initialState?.x || 0,
    y: initialState?.y || 0,
    w: initialState?.w || 600,
    h: initialState?.h || 450,
  });

  // DOM Ref for the window element
  const windowRef = useRef(null);

  // Interaction state (State for CSS class toggling)
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  
  // Internal refs for high-frequency tracking
  const draggingRef = useRef(false);
  const resizingRef = useRef(false);
  const resizeDir = useRef(null);
  const startPos = useRef({ x: 0, y: 0 });
  const startState = useRef({ x: 0, y: 0, w: 0, h: 0 });
  
  // Animation frame ID
  const rafId = useRef(null);

  const applyTransform = useCallback(() => {
    if (windowRef.current) {
      const { x, y, w, h } = stateRef.current;
      windowRef.current.style.transform = `translate(${x}px, ${y}px)`;
      windowRef.current.style.width = `${w}px`;
      windowRef.current.style.height = `${h}px`;
    }
  }, []);

  const initialX = initialState?.x;
  const initialY = initialState?.y;
  const initialW = initialState?.w;
  const initialH = initialState?.h;

  const lastInitialRef = useRef({ x: initialX, y: initialY, w: initialW, h: initialH });

  // Sync state if props change (e.g. Smart Split updates this window from parent)
  useEffect(() => {
    if (draggingRef.current || resizingRef.current) return;
    
    let needsUpdate = false;
    const current = { ...stateRef.current };

    if (initialX !== undefined && initialY !== undefined && initialW !== undefined && initialH !== undefined) {
        const lastInit = lastInitialRef.current;
        const initChanged = 
            Math.abs(initialX - lastInit.x) > 1 ||
            Math.abs(initialY - lastInit.y) > 1 ||
            Math.abs(initialW - lastInit.w) > 1 ||
            Math.abs(initialH - lastInit.h) > 1;

        if (initChanged) {
            lastInitialRef.current = { x: initialX, y: initialY, w: initialW, h: initialH };
            
            // Only update if difference is significant to avoid jitter
            if (Math.abs(current.x - initialX) > 1 ||
                Math.abs(current.y - initialY) > 1 ||
                Math.abs(current.w - initialW) > 1 ||
                Math.abs(current.h - initialH) > 1) {
                
                current.x = initialX;
                current.y = initialY;
                current.w = initialW;
                current.h = initialH;
                needsUpdate = true;
            }
        }
    }

    // Enforce new minimums even if initialState didn't change (e.g. window became populated)
    if (current.w < minWidth) {
        current.w = minWidth;
        needsUpdate = true;
    }
    if (current.h < minHeight) {
        current.h = minHeight;
        needsUpdate = true;
    }

    if (needsUpdate) {
        stateRef.current = current;
        applyTransform();
    }
  }, [initialX, initialY, initialW, initialH, minWidth, minHeight, applyTransform]);

  // --- Core Interaction Loop ---

  const onPointerDown = (e, interactionType, direction = null) => {
    if (e.button !== 0) return; // Only left click
    
    onFocus && onFocus(id);
    
    const targetElem = e.currentTarget;
    const pointerId = e.pointerId;

    targetElem.setPointerCapture(pointerId);
    e.stopPropagation();

    if (interactionType === 'drag') {
      draggingRef.current = true;
      setIsDragging(true);
      document.body.style.cursor = 'move';
    } else if (interactionType === 'resize') {
      resizingRef.current = true;
      setIsResizing(true);
      resizeDir.current = direction;
      document.body.style.cursor = `${direction}-resize`;
    }

    startPos.current = { x: e.clientX, y: e.clientY };
    startState.current = { ...stateRef.current };

    const onPointerMove = (ev) => {
        if (!draggingRef.current && !resizingRef.current) return;
        ev.preventDefault();
        
        const rawDx = ev.clientX - startPos.current.x;
        const rawDy = ev.clientY - startPos.current.y;

        if (rafId.current) cancelAnimationFrame(rafId.current);

        rafId.current = requestAnimationFrame(() => {
            updatePosition(rawDx, rawDy);
        });
    };

    const onPointerUp = (ev) => {
        draggingRef.current = false;
        resizingRef.current = false;
        setIsDragging(false);
        setIsResizing(false);
        resizeDir.current = null;
        document.body.style.cursor = '';
        
        if (rafId.current) cancelAnimationFrame(rafId.current);

        // Commit final state
        onSave && onSave(id, stateRef.current);
        
        if (targetElem) {
            try {
                targetElem.releasePointerCapture(pointerId);
                targetElem.removeEventListener('pointermove', onPointerMove);
                targetElem.removeEventListener('pointerup', onPointerUp);
            } catch (err) {
                // Ignore
            }
        }
    };

    targetElem.addEventListener('pointermove', onPointerMove);
    targetElem.addEventListener('pointerup', onPointerUp);
  };

  const updatePosition = (rawDx, rawDy) => {
    const current = { ...startState.current };
    let { x, y, w, h } = current;
    const container = containerRef.current ? containerRef.current.getBoundingClientRect() : { width: 1920, height: 1080 };

    if (draggingRef.current) {
        let nextX = x + rawDx;
        let nextY = y + rawDy;

        // Ask parent for constraints (snapping)
        if (onDrag) {
            const adjusted = onDrag(id, nextX, nextY);
            if (adjusted) {
                nextX = adjusted.x;
                nextY = adjusted.y;
            }
        } else if (snapEnabled) {
             // Default local snapping if no parent logic
             const snapMargin = 20;
             if (Math.abs(nextX) < snapMargin) nextX = 0;
             if (Math.abs(nextY) < snapMargin) nextY = 0;
             if (Math.abs(nextX + w - container.width) < snapMargin) nextX = container.width - w;
             if (Math.abs(nextY + h - container.height) < snapMargin) nextY = container.height - h;
        }
        
        // Hard Containment (Header visible)
        y = Math.max(0, Math.min(nextY, container.height - 30));
        x = Math.max(-w + 50, Math.min(nextX, container.width - 50));

    } else if (resizingRef.current) {
        const dir = resizeDir.current;
        
        // Negotiate delta with parent (Layout Manager)
        let dx = rawDx;
        let dy = rawDy;
        
        if (onResize) {
            const adjusted = onResize(id, dx, dy, dir);
            if (adjusted) {
                dx = adjusted.dx;
                dy = adjusted.dy;
            }
        }

        // Apply Logic
        if (dir.includes('e')) w += dx;
        if (dir.includes('s')) h += dy;
        if (dir.includes('w')) {
            w -= dx;
            x += dx;
        }
        if (dir.includes('n')) {
            h -= dy;
            y += dy;
        }

        // Min constraints
        if (w < minWidth) {
            if (dir.includes('w')) x -= (minWidth - w);
            w = minWidth;
        }
        if (h < minHeight) {
            if (dir.includes('n')) y -= (minHeight - h);
            h = minHeight;
        }
    }

    stateRef.current = { x, y, w, h };
    applyTransform();
  };

  // Expose handlers
  const handleDragStart = (e) => onPointerDown(e, 'drag');
  const handleResizeStart = (e, dir) => onPointerDown(e, 'resize', dir);

  return {
    windowRef,
    stateRef,
    handleDragStart,
    handleResizeStart,
    applyTransform,
    isDragging,
    isResizing
  };
};
