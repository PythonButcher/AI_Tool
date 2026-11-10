import { useContext, useLayoutEffect } from 'react';
import { ThemeContext } from '../context/ThemeContext';

/** React context crosses portals; the document's CSS attributes do not. */
export default function usePortalTheme(portalRoot) {
  const { theme = 'dark' } = useContext(ThemeContext) || {};
  useLayoutEffect(() => {
    portalRoot?.ownerDocument.documentElement.setAttribute('data-theme', theme);
  }, [portalRoot, theme]);
}
