> ARCHIVED REFERENCE ONLY: This file is historical. Do not treat old wording below such as "active", "next", "source of truth", or "handoff" as current project truth.
# UX Improvements Checklist

The following improvements have been implemented to modernize the window management system:

*   **Smooth Dragging**: Windows now follow the cursor 1:1 with no lag, using Pointer Events and hardware-accelerated CSS transforms.
*   **Predictable Resizing**: Resize handles are now placed correctly on edges and corners, with smooth, jitter-free resizing.
*   **Smart Focus**: Clicking anywhere on a window brings it to the front immediately.
*   **No Layout Thrashing**: Moving a window does not trigger React re-renders, ensuring 60fps performance even with complex charts.
*   **Edge Snapping**: Windows softly snap to the viewport edges when dragged near them, making alignment easy.
*   **Smart Placement**: New windows now open in a cascading arrangement (if no saved position exists), preventing them from stacking directly on top of each other.
*   **Header-Only Drag**: Dragging is restricted to the window header, preventing accidental moves when interacting with content (charts, whiteboards).

## Implementation Details

### Interaction Loop
1.  **Pointer Down**: 
    *   The browser's `setPointerCapture` is used to ensure the window keeps receiving events even if the cursor moves outside it or over an iframe.
    *   Initial state (position, size) is captured in a Ref.
2.  **RequestAnimationFrame (RAF)**:
    *   Mouse movements are tracked in a high-performance loop.
    *   DOM updates (`style.transform`, `style.width`, `style.height`) happen directly in the RAF callback, bypassing React's render cycle completely.
3.  **Pointer Up**:
    *   The final position is committed to React state (and LocalStorage) only once the user releases the mouse.
    *   This "lazy commit" strategy is key to the performance boost.

### Compatibility
*   **Legacy Layouts**: Existing saved layouts (grid units) are automatically detected and converted to pixel-based coordinates on the fly.
*   **Context Integration**: The system fully integrates with the existing `WindowContext` for minimizing, closing, and persistence.
