import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaCompress, FaExpand, FaExternalLinkAlt, FaMinus, FaTimes } from 'react-icons/fa';
import usePortalTheme from '../../hooks/usePortalTheme';
import { getAiChatPopupFeatures } from '../../utils/aiChatWindowSizing';
import AIShell from './AIShell';
import './AiChatDock.css';

const DEFAULT_WIDTH = 540;
const MIN_WIDTH = 400;
const MAX_SHARE = 0.65;
const WIDTH_KEY = 'ai-tool.chat-dock-width';

function readWidth() {
  try {
    const stored = Number(localStorage.getItem(WIDTH_KEY));
    if (Number.isFinite(stored) && stored >= MIN_WIDTH) return stored;
  } catch {
    // Chat can still resize when storage is unavailable.
  }
  return DEFAULT_WIDTH;
}

function preparePopup(popup) {
  const popupDocument = popup.document;
  popupDocument.title = 'AI Chat';
  document.querySelectorAll('link[rel="stylesheet"], style').forEach(node => {
    popupDocument.head.appendChild(node.cloneNode(true));
  });
  popupDocument.body.className = 'ai-chat-popup';
  return popupDocument.body;
}

export default function AiChatDock({ minimized, onMinimize, onClose, onOpenDashboard }) {
  const [width, setWidth] = useState(readWidth);
  const [availableWidth, setAvailableWidth] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [popupRoot, setPopupRoot] = useState(null);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const [chatHost] = useState(() => {
    const host = document.createElement('div');
    host.className = 'ai-chat-dock__host';
    return host;
  });
  const dockRef = useRef(null);
  const dockSlotRef = useRef(null);
  const popupRef = useRef(null);
  const resizeRef = useRef(null);
  usePortalTheme(popupRoot);

  const poppedOut = !!popupRoot;
  const maxWidth = Math.max(MIN_WIDTH, Math.round(availableWidth * MAX_SHARE));
  const resizeWidth = Math.min(width, maxWidth);

  useLayoutEffect(() => {
    // Keep the portal target stable so React keeps drafts, results and pending requests alive.
    (popupRoot || dockSlotRef.current).appendChild(chatHost);
  }, [chatHost, popupRoot]);

  useLayoutEffect(() => {
    const workspace = dockRef.current.parentElement;
    const measure = () => setAvailableWidth(workspace.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(workspace);
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => popupRef.current?.close(), []);

  useEffect(() => {
    if (!popupRoot) return undefined;
    const timer = window.setInterval(() => {
      if (popupRef.current?.closed) {
        popupRef.current = null;
        setPopupRoot(null);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [popupRoot]);

  const returnToDock = () => {
    const popup = popupRef.current;
    if (!popup) return;
    dockSlotRef.current.appendChild(chatHost);
    popupRef.current = null;
    setPopupRoot(null);
    popup.close();
  };

  const openPopup = () => {
    const popup = window.open('', '_blank', getAiChatPopupFeatures(window.screen));
    setPopupBlocked(!popup);
    if (!popup) return;
    popupRef.current = popup;
    setPopupRoot(preparePopup(popup));
    popup.focus();
  };

  const limitWidth = (value) => Math.max(MIN_WIDTH, Math.min(maxWidth, value));

  const saveWidth = (value) => {
    try {
      localStorage.setItem(WIDTH_KEY, String(value));
    } catch {
      // The new width still applies for this session.
    }
  };

  const startResize = (event) => {
    if (event.button !== 0 || resizeRef.current) return;
    resizeRef.current = { pointerId: event.pointerId, startX: event.clientX, initialWidth: resizeWidth, lastWidth: resizeWidth };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveResize = (event) => {
    const resize = resizeRef.current;
    if (resize?.pointerId !== event.pointerId) return;
    resize.lastWidth = limitWidth(resize.initialWidth + resize.startX - event.clientX);
    setWidth(resize.lastWidth);
  };

  const finishResize = (event) => {
    const resize = resizeRef.current;
    if (resize?.pointerId !== event.pointerId) return;
    resizeRef.current = null;
    saveWidth(resize.lastWidth);
  };

  const resizeWithKeys = (event) => {
    const step = event.shiftKey ? 80 : 20;
    const target = {
      ArrowLeft: resizeWidth + step,
      ArrowRight: resizeWidth - step,
      Home: MIN_WIDTH,
      End: Infinity,
    }[event.key];
    if (typeof target !== 'number') return;
    event.preventDefault();
    const nextWidth = limitWidth(target);
    setWidth(nextWidth);
    saveWidth(nextWidth);
  };

  const collapse = () => {
    returnToDock();
    onMinimize();
  };

  const controls = (
    <div className="ai-chat-dock__controls">
      {!poppedOut && (
        <button type="button" aria-label={expanded ? 'Restore sidebar width' : 'Expand AI Chat'}
          title={expanded ? 'Restore sidebar width' : 'Expand AI Chat'}
          className="ai-chat-dock__expand" onClick={() => setExpanded(value => !value)}>
          {expanded ? <FaCompress /> : <FaExpand />}
        </button>
      )}
      <button type="button" aria-label={poppedOut ? 'Dock AI Chat in app' : 'Open AI Chat in separate window'}
        title={poppedOut ? 'Dock AI Chat in app' : 'Open AI Chat in separate window'}
        onClick={poppedOut ? returnToDock : openPopup}>
        {poppedOut ? <FaCompress /> : <FaExternalLinkAlt />}
      </button>
      <button type="button" aria-label="Collapse AI Chat" title="Collapse AI Chat" onClick={collapse}><FaMinus /></button>
      <button type="button" aria-label="Close AI Chat" title="Close AI Chat" onClick={onClose}><FaTimes /></button>
    </div>
  );

  return (
    <>
      <aside ref={dockRef} className={`ai-chat-dock ${expanded ? 'is-expanded' : ''}`}
        aria-label="AI Chat panel" hidden={minimized || poppedOut} style={{ '--ai-chat-dock-width': `${resizeWidth}px` }}>
        {!expanded && (
          <div className="ai-chat-dock__resize" role="separator" tabIndex={0} aria-orientation="vertical"
            aria-label="Resize AI Chat" aria-controls="ai-chat-dock-content"
            aria-valuemin={MIN_WIDTH} aria-valuemax={maxWidth}
            aria-valuenow={resizeWidth} aria-valuetext={`${resizeWidth} pixels`}
            onKeyDown={resizeWithKeys} onPointerDown={startResize} onPointerMove={moveResize}
            onLostPointerCapture={finishResize} />
        )}
        <div className="ai-chat-dock__slot" id="ai-chat-dock-content" ref={dockSlotRef} />
      </aside>
      {createPortal(
        <AIShell
          initialSidebarOpen={false}
          windowActions={controls}
          windowNotice={popupBlocked && !poppedOut ? 'Allow pop-ups to open AI Chat in a separate window.' : null}
          onOpenDashboard={() => { onOpenDashboard(); collapse(); }}
        />,
        chatHost
      )}
    </>
  );
}
