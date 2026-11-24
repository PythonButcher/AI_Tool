import React, { useCallback, useEffect, useRef, useState } from 'react';
import { HelpOverlayProvider } from '../../context/HelpOverlayContext';
import { MuiThemeContext } from '../../context/MuiThemeContext';
import { WarehouseProvider } from '../../context/WarehouseContext';
import PlatformHub from './PlatformHub';
import { DATASTREAM_WORKSPACE_ID } from './workspacePortal';

const APP_PARAMETER = 'app';
const DATASTREAM = 'datastream';

function isDatastream(href) {
  return new URL(href).searchParams.get(APP_PARAMETER) === DATASTREAM;
}

function platformHref(href, openDatastream) {
  const url = new URL(href);
  if (openDatastream) url.searchParams.set(APP_PARAMETER, DATASTREAM);
  else if (isDatastream(href)) url.searchParams.delete(APP_PARAMETER);
  return url.href;
}

export default function PlatformShell({ Workspace }) {
  const [href, setHref] = useState(() => window.location.href);
  const showWorkspace = isDatastream(href);
  const [hasOpenedWorkspace, setHasOpenedWorkspace] = useState(showWorkspace);
  const workspaceRef = useRef(null);
  const hubHeadingRef = useRef(null);
  const previousView = useRef(showWorkspace);
  const lastWorkspaceFocus = useRef(null);

  const syncLocation = useCallback(() => {
    const nextHref = window.location.href;
    if (isDatastream(nextHref)) {
      setHasOpenedWorkspace(true);
    } else if (workspaceRef.current?.contains(document.activeElement)) {
      lastWorkspaceFocus.current = document.activeElement;
    }
    setHref(nextHref);
  }, []);

  useEffect(() => {
    window.addEventListener('popstate', syncLocation);
    window.addEventListener('hashchange', syncLocation);
    return () => {
      window.removeEventListener('popstate', syncLocation);
      window.removeEventListener('hashchange', syncLocation);
    };
  }, [syncLocation]);

  useEffect(() => {
    if (previousView.current === showWorkspace) return;
    previousView.current = showWorkspace;

    if (!showWorkspace) {
      hubHeadingRef.current?.focus();
      return;
    }

    lastWorkspaceFocus.current?.focus();
    if (!workspaceRef.current?.contains(document.activeElement)) {
      workspaceRef.current?.querySelector('main')?.focus();
    }
  }, [showWorkspace]);

  function handleNavigation(event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    event.preventDefault();
    window.history.pushState(null, '', event.currentTarget.href);
    syncLocation();
  }

  const hubLink = { href: platformHref(href, false), onClick: handleNavigation };
  const datastreamLink = { href: platformHref(href, true), onClick: handleNavigation };

  return (
    <MuiThemeContext workspaceVisible={showWorkspace}>
      {!showWorkspace && <PlatformHub links={{ datastream: datastreamLink }} headingRef={hubHeadingRef} />}
      {/* Keep open tools and working data mounted across trips to the hub. */}
      {hasOpenedWorkspace && (
        <div id={DATASTREAM_WORKSPACE_ID} ref={workspaceRef} hidden={!showWorkspace}>
          <WarehouseProvider>
            <HelpOverlayProvider>
              <Workspace platformHubLink={hubLink} />
            </HelpOverlayProvider>
          </WarehouseProvider>
        </div>
      )}
    </MuiThemeContext>
  );
}
