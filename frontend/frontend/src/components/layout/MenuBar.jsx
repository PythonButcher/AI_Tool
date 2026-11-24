import React, { useContext, useEffect, useRef } from 'react';
import { FaArrowLeft, FaEllipsisH, FaRobot, FaSave, FaTable, FaUpload } from 'react-icons/fa';
import { ThemeContext } from '../../context/ThemeContext';
import DestinationNav from './SideBar';
import './MenuBar.css';

function MenuBar({
  platformHubLink,
  activeDestination,
  onDestinationSelect,
  onOpenSourcePanel,
  onOpenFields,
  onOpenPreview,
  canPreview,
  canSaveDataset,
  onSaveDataset,
  onOpenAiChat,
  onOpenAiWorkflow,
  onOpenStoryboard,
  onOpenWhiteboard,
  onOpenChartGallery,
  aiReportReady,
  onAiReportClick,
}) {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const more = useRef(null);

  useEffect(() => {
    const closeFromOutside = event => {
      if (more.current?.open && !more.current.contains(event.target)) more.current.open = false;
    };
    document.addEventListener('pointerdown', closeFromOutside);
    return () => document.removeEventListener('pointerdown', closeFromOutside);
  }, []);

  function closeMore() {
    more.current.open = false;
    more.current.querySelector('summary')?.focus();
  }

  function run(action) {
    return () => {
      closeMore();
      action();
    };
  }

  return (
    <header className="app-banner" aria-label="Datastream">
      <div className="app-banner__identity">
        <button type="button" className="app-banner__brand" aria-label="Datastream home" onClick={() => onDestinationSelect('workspace')}>
          <img className="app-banner__logo" src="/datastream-logo.png" alt="" />
        </button>
        {platformHubLink && (
          <a className="app-banner__hub" {...platformHubLink}>
            <FaArrowLeft aria-hidden="true" /> Platform hub
          </a>
        )}
      </div>

      <DestinationNav activeDestination={activeDestination} onDestinationSelect={onDestinationSelect} />

      <div className="app-banner__actions">
        <button type="button" className="app-banner__upload" onClick={() => onOpenSourcePanel('upload')}>
          <FaUpload aria-hidden="true" /> Upload data
        </button>
        {canSaveDataset && (
          <button type="button" className="app-banner__action app-banner__save" onClick={onSaveDataset}>
            <FaSave aria-hidden="true" /> Save Dataset
          </button>
        )}
        <button
          type="button"
          className="app-banner__action"
          aria-label="Data Preview"
          title={canPreview ? 'Data Preview' : 'Upload or connect data to preview rows'}
          disabled={!canPreview}
          onClick={onOpenPreview}
        >
          <FaTable aria-hidden="true" /><span>Data Preview</span>
        </button>
        <button type="button" className="app-banner__action" aria-label="AI Chat" title="AI Chat" onClick={onOpenAiChat}>
          <FaRobot aria-hidden="true" /><span>AI Chat</span>
        </button>

        <details
          className="app-banner__more"
          ref={more}
          onKeyDown={event => {
            if (event.key === 'Escape' && more.current.open) {
              event.preventDefault();
              closeMore();
            }
          }}
          onBlur={event => {
            if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
          }}
        >
          <summary className="app-banner__action" aria-label="More actions" title="More actions">
            <FaEllipsisH aria-hidden="true" />
          </summary>
          <div className="app-banner__overflow">
            <div role="group" aria-label="Data connections and fields">
              <button type="button" onClick={run(() => onOpenSourcePanel('api'))}>Connect API</button>
              <button type="button" onClick={run(() => onOpenSourcePanel('db'))}>Connect database</button>
              <button type="button" onClick={run(onOpenFields)}>Data fields</button>
              {activeDestination === 'analytics' && (
                <>
                  <button type="button" onClick={run(onOpenChartGallery)}>Chart gallery</button>
                  <button type="button" onClick={run(onOpenWhiteboard)}>Whiteboard</button>
                </>
              )}
            </div>
            <div role="group" aria-label="Application tools">
              {aiReportReady && <button type="button" onClick={run(onAiReportClick)}>AI report</button>}
              {activeDestination === 'ai' ? (
                <>
                  <button type="button" onClick={run(onOpenAiWorkflow)}>AI automation</button>
                  <button type="button" onClick={run(onOpenStoryboard)}>Narrative</button>
                </>
              ) : (
                <button type="button" onClick={run(() => onDestinationSelect('ai'))}>AI Suite</button>
              )}
              <button type="button" onClick={run(toggleTheme)}>Switch to {theme === 'dark' ? 'light' : 'dark'} theme</button>
              <button type="button" onClick={run(() => window.location.reload())}>Reload</button>
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}

export default MenuBar;
