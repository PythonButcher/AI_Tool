import React, { useCallback, useEffect, useRef, useState } from 'react';
import { HelpOverlayProvider } from '../../context/HelpOverlayContext';
import { MuiThemeContext } from '../../context/MuiThemeContext';
import { WarehouseProvider } from '../../context/WarehouseContext';
import PlatformHub from './PlatformHub';
import { DEVSTREAM_WORKSPACE_ID } from './workspacePortal';

const APP_PARAMETER = 'app';
const DEVSTREAM_APP = 'devstream';
const LEGACY_DEVSTREAM_APP = 'datastream';

function isDevstream(href) {
  const app = new URL(href).searchParams.get(APP_PARAMETER);
  return app === DEVSTREAM_APP || app === LEGACY_DEVSTREAM_APP;
}

function platformHref(href, openDevstream) {
  const url = new URL(href);
  if (openDevstream) url.searchParams.set(APP_PARAMETER, DEVSTREAM_APP);
  else if (isDevstream(href)) url.searchParams.delete(APP_PARAMETER);
  return url.href;
}

export default function PlatformShell({ Workspace }) {
  const [href, setHref] = useState(() => window.location.href);
  const showWorkspace = isDevstream(href);
  const [hasOpenedWorkspace, setHasOpenedWorkspace] = useState(showWorkspace);
  const workspaceRef = useRef(null);
  const hubHeadingRef = useRef(null);
  const previousView = useRef(showWorkspace);
  const lastWorkspaceFocus = useRef(null);

  const syncLocation = useCallback(() => {
    const nextHref = window.location.href;
    if (isDevstream(nextHref)) {
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
    document.title = showWorkspace ? 'Devstream | Datastream' : 'Datastream';
  }, [showWorkspace]);

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
  const devstreamLink = { href: platformHref(href, true), onClick: handleNavigation };

  return (
    <MuiThemeContext workspaceVisible={showWorkspace}>
      {!showWorkspace && <PlatformHub links={{ devstream: devstreamLink }} headingRef={hubHeadingRef} />}
      {/* Keep open tools and working data mounted across trips to the hub. */}
      {hasOpenedWorkspace && (
        <div id={DEVSTREAM_WORKSPACE_ID} ref={workspaceRef} hidden={!showWorkspace}>
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
