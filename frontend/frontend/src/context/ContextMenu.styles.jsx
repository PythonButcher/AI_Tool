import styled from 'styled-components';

// Simple theme for Windows/macOS-like styling
const theme = {
  background: 'var(--glass-overlay-bold)',
  border: 'var(--border-color)',
  shadow: 'var(--shadow-color-soft)',
  text: 'var(--text-primary)',
  hoverBackground: 'var(--accent-white-soft)',
  headerColor: 'var(--text-secondary)',
  divider: 'var(--border-color)',
};

export const Container = styled.div`
  position: absolute;
  top: ${({ y }) => y}px;
  left: ${({ x }) => x}px;
  z-index: 9999;
  min-width: 220px;
  background-color: ${theme.background};
  backdrop-filter: blur(8px); /* Glass effect on modern browsers */
  border-radius: 8px;
  box-shadow: 0 3px 8px ${theme.shadow};
  border: 1px solid ${theme.border};
  padding: 6px 0;
  box-sizing: border-box;
  user-select: none;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
`;

export const MenuHeader = styled.div`
  padding: 5px 12px;
  color: ${theme.headerColor};
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.5px;
`;

export const Divider = styled.div`
  height: 1px;
  background-color: ${theme.divider};
  margin: 4px 0;
`;

export const MenuOption = styled.div`
  display: flex;
  align-items: center;
  padding: 8px 14px;
  cursor: pointer;
  color: ${theme.text};
  transition: background-color 0.1s ease-in-out;
  
  .menu-icon {
    margin-right: 8px;
    font-size: 16px;
    opacity: 0.7;
    flex-shrink: 0;
  }

  &:hover {
    background-color: ${theme.hoverBackground};
  }

  // (Optional) You can handle "disabled" style states like so:
  &.disabled {
    opacity: 0.4;
    pointer-events: none;
  }
`;
