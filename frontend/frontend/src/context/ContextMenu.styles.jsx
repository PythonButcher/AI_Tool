import styled from 'styled-components';

// Simple theme for Windows/macOS-like styling
const theme = {
  background: 'rgba(255, 255, 255, 0.85)',  // Light, with some transparency
  border: 'rgba(150, 150, 150, 0.25)',      // Subtle border
  shadow: 'rgba(0, 0, 0, 0.2)',             // Moderate drop shadow
  text: '#2b2b2b',                          // Dark text
  hoverBackground: 'rgba(0, 0, 0, 0.06)',   // Slight gray overlay on hover
  headerColor: '#666',
  divider: 'rgba(0, 0, 0, 0.1)',
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
