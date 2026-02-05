import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

const DEFAULT_COLS = 10;
const DEFAULT_ROW_HEIGHT = 30;
const DEFAULT_SNAP_THRESHOLD = 20;
const SOFT_CLAMP_OVERSHOOT = 0.5;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const softClamp = (value, min, max) =>
  clamp(value, min - SOFT_CLAMP_OVERSHOOT, max + SOFT_CLAMP_OVERSHOOT);

const getPadding = (element) => {
  if (!element) {
    return { left: 0, top: 0, right: 0, bottom: 0 };
  }
  const styles = window.getComputedStyle(element);
  return {
    left: parseFloat(styles.paddingLeft) || 0,
    top: parseFloat(styles.paddingTop) || 0,
    right: parseFloat(styles.paddingRight) || 0,
    bottom: parseFloat(styles.paddingBottom) || 0,
  };
};

const rectFromLayout = (layout, metrics) => ({
  left: metrics.padding.left + layout.x * metrics.colWidth,
  top: metrics.padding.top + layout.y * metrics.rowHeight,
  width: layout.w * metrics.colWidth,
  height: layout.h * metrics.rowHeight,
});

const layoutFromRect = (rect, metrics) => ({
  x: (rect.left - metrics.padding.left) / metrics.colWidth,
  y: (rect.top - metrics.padding.top) / metrics.rowHeight,
  w: rect.width / metrics.colWidth,
  h: rect.height / metrics.rowHeight,
});

const getSnapLayout = ({ rect, metrics, cols, snapThreshold }) => {
  const containerLeft = metrics.padding.left;
  const containerTop = metrics.padding.top;
  const containerRight = containerLeft + metrics.contentWidth;
  const containerBottom = containerTop + metrics.contentHeight;

  const nearLeft = Math.abs(rect.left - containerLeft) <= snapThreshold;
  const nearRight = Math.abs(rect.left + rect.width - containerRight) <= snapThreshold;
  const nearTop = Math.abs(rect.top - containerTop) <= snapThreshold;
  const nearBottom = Math.abs(rect.top + rect.height - containerBottom) <= snapThreshold;

  if (!nearLeft && !nearRight && !nearTop && !nearBottom) return null;

  const halfCols = Math.round(cols / 2);
  const thirdCols = Math.round(cols / 3);
  const halfRows = Math.max(1, Math.round(metrics.rows / 2));

  // Corners -> quarters (half width + half height).
  if ((nearLeft || nearRight) && (nearTop || nearBottom)) {
    return {
      x: nearLeft ? 0 : cols - halfCols,
      y: nearTop ? 0 : metrics.rows - halfRows,
      w: halfCols,
      h: halfRows,
    };
  }

  // Left/right edges -> halves by default.
  if (nearLeft || nearRight) {
    return {
      x: nearLeft ? 0 : cols - halfCols,
      y: 0,
      w: halfCols,
      h: metrics.rows,
    };
  }

  // Top/bottom edges -> full width half height.
  if (nearTop || nearBottom) {
    return {
      x: 0,
      y: nearTop ? 0 : metrics.rows - halfRows,
      w: cols,
      h: halfRows,
    };
  }

  // Fallback: thirds if the window is already close to a third boundary.
  const thirdBoundary = metrics.colWidth * thirdCols;
  if (Math.abs(rect.left - containerLeft) <= snapThreshold * 1.5) {
    return { x: 0, y: 0, w: thirdCols, h: metrics.rows };
  }
  if (Math.abs(rect.left + rect.width - (containerLeft + thirdBoundary * 2)) <= snapThreshold * 1.5) {
    return { x: cols - thirdCols, y: 0, w: thirdCols, h: metrics.rows };
  }

  return null;
};

export default function useWindowInteractions({
  containerRef,
  getLayoutMap,
  setLayout,
  isLocked,
  focusWindow,
  cols = DEFAULT_COLS,
  rowHeight = DEFAULT_ROW_HEIGHT,
  snapEnabled = true,
  snapThreshold = DEFAULT_SNAP_THRESHOLD,
}) {
  const windowRefs = useRef(new Map());
  const [metrics, setMetrics] = useState({
    colWidth: 1,
    rowHeight,
    rows: 1,
    padding: { left: 0, top: 0, right: 0, bottom: 0 },
    contentWidth: 1,
    contentHeight: 1,
  });
  const [isInteracting, setIsInteracting] = useState(false);
  const interactionRef = useRef(null);
  const rafRef = useRef(null);

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const updateMetrics = () => {
      const element = containerRef.current;
      const rect = element.getBoundingClientRect();
      const padding = getPadding(element);
      const contentWidth = rect.width - padding.left - padding.right;
      const contentHeight = rect.height - padding.top - padding.bottom;
      const colWidth = contentWidth / cols;
      setMetrics({
        colWidth,
        rowHeight,
        rows: Math.max(1, Math.floor(contentHeight / rowHeight)),
        padding,
        contentWidth,
        contentHeight,
      });
    };

    updateMetrics();
    const observer = new ResizeObserver(updateMetrics);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [cols, rowHeight, containerRef]);

  useEffect(() => {
    if (isInteracting) {
      document.body.classList.add('window-interacting');
    } else {
      document.body.classList.remove('window-interacting');
    }
    return () => document.body.classList.remove('window-interacting');
  }, [isInteracting]);

  const registerWindow = useCallback(
    (id) => (node) => {
      if (node) {
        windowRefs.current.set(id, node);
      } else {
        windowRefs.current.delete(id);
      }
    },
    []
  );

  const getWindowStyle = useCallback(
    (layout) => {
      const rect = rectFromLayout(layout, metrics);
      return {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      };
    },
    [metrics]
  );

  const cancelRaf = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const commitLayout = useCallback((id, rect) => {
    const baseLayout = getLayoutMap().get(id);
    if (!baseLayout) return;
    let nextLayout = {
      ...baseLayout,
      ...layoutFromRect(rect, metrics),
    };

    const maxX = cols - nextLayout.w;
    const maxY = metrics.rows - nextLayout.h;
    nextLayout.x = clamp(nextLayout.x, 0, Math.max(0, maxX));
    nextLayout.y = clamp(nextLayout.y, 0, Math.max(0, maxY));
    nextLayout.w = clamp(nextLayout.w, baseLayout.minW || 1, cols);
    nextLayout.h = clamp(nextLayout.h, baseLayout.minH || 1, metrics.rows);

    nextLayout = {
      ...nextLayout,
      x: Math.round(nextLayout.x),
      y: Math.round(nextLayout.y),
      w: Math.round(nextLayout.w),
      h: Math.round(nextLayout.h),
    };

    setLayout(id, nextLayout);
  }, [cols, getLayoutMap, metrics, setLayout]);

  const applyDrag = useCallback((event) => {
    const interaction = interactionRef.current;
    if (!interaction) return;
    const { startX, startY, startRect, id } = interaction;
    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;

    const node = windowRefs.current.get(id);
    if (!node) return;

    const nextRect = {
      ...startRect,
      left: startRect.left + deltaX,
      top: startRect.top + deltaY,
    };

    const maxX = cols - startRect.width / metrics.colWidth;
    const maxY = metrics.rows - startRect.height / metrics.rowHeight;
    const layout = layoutFromRect(nextRect, metrics);
    layout.x = softClamp(layout.x, 0, Math.max(0, maxX));
    layout.y = softClamp(layout.y, 0, Math.max(0, maxY));
    const clampedRect = rectFromLayout(
      { ...layout, w: startRect.width / metrics.colWidth, h: startRect.height / metrics.rowHeight },
      metrics
    );

    node.style.transform = `translate3d(${clampedRect.left - startRect.left}px, ${clampedRect.top - startRect.top}px, 0)`;
    interactionRef.current.latestRect = {
      ...startRect,
      left: clampedRect.left,
      top: clampedRect.top,
    };
  }, [cols, metrics]);

  const applyResize = useCallback((event) => {
    const interaction = interactionRef.current;
    if (!interaction) return;
    const { startX, startY, startRect, id, edge, layout } = interaction;
    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;
    const node = windowRefs.current.get(id);
    if (!node) return;

    let nextRect = { ...startRect };
    const minWidth = (layout.minW || 1) * metrics.colWidth;
    const minHeight = (layout.minH || 1) * metrics.rowHeight;
    const maxWidth = metrics.contentWidth;
    const maxHeight = metrics.contentHeight;

    if (edge.includes('e')) {
      nextRect.width = clamp(startRect.width + deltaX, minWidth, maxWidth);
    }
    if (edge.includes('s')) {
      nextRect.height = clamp(startRect.height + deltaY, minHeight, maxHeight);
    }
    if (edge.includes('w')) {
      const newWidth = clamp(startRect.width - deltaX, minWidth, maxWidth);
      nextRect.left = startRect.left + (startRect.width - newWidth);
      nextRect.width = newWidth;
    }
    if (edge.includes('n')) {
      const newHeight = clamp(startRect.height - deltaY, minHeight, maxHeight);
      nextRect.top = startRect.top + (startRect.height - newHeight);
      nextRect.height = newHeight;
    }

    const layoutRect = layoutFromRect(nextRect, metrics);
    const maxX = cols - layoutRect.w;
    const maxY = metrics.rows - layoutRect.h;
    layoutRect.x = softClamp(layoutRect.x, 0, Math.max(0, maxX));
    layoutRect.y = softClamp(layoutRect.y, 0, Math.max(0, maxY));
    nextRect = rectFromLayout(layoutRect, metrics);

    node.style.transform = 'translate3d(0, 0, 0)';
    node.style.left = `${nextRect.left}px`;
    node.style.top = `${nextRect.top}px`;
    node.style.width = `${nextRect.width}px`;
    node.style.height = `${nextRect.height}px`;
    interactionRef.current.latestRect = nextRect;
  }, [cols, metrics]);

  const onPointerMove = useCallback(
    (event) => {
      if (!interactionRef.current) return;
      interactionRef.current.latestEvent = event;
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          const latestEvent = interactionRef.current?.latestEvent;
          rafRef.current = null;
          if (!latestEvent) return;
          if (interactionRef.current.type === 'drag') {
            applyDrag(latestEvent);
          } else {
            applyResize(latestEvent);
          }
        });
      }
    },
    [applyDrag, applyResize]
  );

  const onPointerUp = useCallback(
    (event) => {
      const interaction = interactionRef.current;
      if (!interaction) return;
      const { id, captureTarget, type, latestRect, startRect } = interaction;
      if (captureTarget?.hasPointerCapture?.(event.pointerId)) {
        captureTarget.releasePointerCapture(event.pointerId);
      }
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      cancelRaf();

      const node = windowRefs.current.get(id);
      if (node) {
        node.style.transform = 'translate3d(0, 0, 0)';
      }

      let rectToCommit = latestRect || startRect;
      if (snapEnabled && type === 'drag') {
        const snapLayout = getSnapLayout({
          rect: rectToCommit,
          metrics,
          cols,
          snapThreshold,
        });
        if (snapLayout) {
          rectToCommit = rectFromLayout(snapLayout, metrics);
        }
      }

      if (rectToCommit) {
        commitLayout(id, rectToCommit);
      }
      interactionRef.current = null;
      setIsInteracting(false);
    },
    [cols, commitLayout, metrics, onPointerMove, snapEnabled, snapThreshold]
  );

  const startInteraction = useCallback(
    (event, id, type, edge) => {
      if (isLocked(id)) return;
      const layout = getLayoutMap().get(id);
      const node = windowRefs.current.get(id);
      if (!layout || !node) return;

      event.preventDefault();
      focusWindow(id);

      const rect = rectFromLayout(layout, metrics);
      interactionRef.current = {
        id,
        type,
        edge,
        startX: event.clientX,
        startY: event.clientY,
        startRect: rect,
        latestRect: rect,
        captureTarget: event.currentTarget,
        layout,
      };
      setIsInteracting(true);
      event.currentTarget.setPointerCapture(event.pointerId);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    },
    [focusWindow, getLayoutMap, isLocked, metrics, onPointerMove, onPointerUp]
  );

  const bindDragHandle = useCallback(
    (id) => ({
      onPointerDown: (event) => startInteraction(event, id, 'drag'),
    }),
    [startInteraction]
  );

  const bindResizeHandle = useCallback(
    (id, edge) => ({
      onPointerDown: (event) => startInteraction(event, id, 'resize', edge),
    }),
    [startInteraction]
  );

  return {
    registerWindow,
    getWindowStyle,
    bindDragHandle,
    bindResizeHandle,
    isInteracting,
  };
}
