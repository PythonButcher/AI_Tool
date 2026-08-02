import React from 'react';
import { createPortal } from 'react-dom';
import { FiMaximize2, FiMinimize2 } from 'react-icons/fi';

const LibraryDrawerWrapper = ({
  children,
  isPoppedOut,
  popoutRoot,
  onTogglePopout,
  onClose
}) => {
  // If popped out, render into the external window
  if (isPoppedOut && popoutRoot) {
    return createPortal(
      <div className="wf-library-drawer popped-out" style={{ width: '100%', height: '100%', border: 'none', borderRadius: 0, boxShadow: 'none' }}>
        <div style={{ position: 'absolute', top: '16px', right: '50px', zIndex: 10 }}>
          <button type="button" className="wf-library-popout-btn" onClick={onTogglePopout} title="Dock to Canvas">
            <FiMinimize2 size={16} />
          </button>
        </div>
        {children}
      </div>,
      popoutRoot
    );
  }

  // Otherwise, render as a sleek slide-out overlay
  return (
    <>
      {/* Invisible backdrop to capture clicks outside */}
      <div
        className="wf-library-backdrop"
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 40, /* Below the drawer, above the canvas */
          background: 'rgba(15, 23, 42, 0.05)', /* Subtle dimming */
          backdropFilter: 'blur(2px)',
          animation: 'fadeIn 0.2s ease-out'
        }}
      />

      {/* The Slide-Out Drawer */}
      <aside
        className="wf-library-drawer slide-out"
        aria-label="Workflow library"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          height: '100%',
          width: '450px',
          borderTopLeftRadius: '16px',
          borderBottomLeftRadius: '16px',
          borderTopRightRadius: 0,
          borderBottomRightRadius: 0,
          zIndex: 50,
          boxShadow: '-10px 0 40px rgba(15, 23, 42, 0.08)',
          background: 'var(--wfs-bg-elevated)',
          backdropFilter: 'blur(20px)',
          animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Popout Button */}
        <div style={{ position: 'absolute', top: '16px', right: '50px', zIndex: 10 }}>
          <button type="button" className="wf-library-popout-btn" onClick={onTogglePopout} title="Pop out into new window">
            <FiMaximize2 size={16} />
          </button>
        </div>

        {/* Content wrapper */}
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          {children}
        </div>
      </aside>
    </>
  );
};

export default LibraryDrawerWrapper;
