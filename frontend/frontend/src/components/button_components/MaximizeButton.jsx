import React from 'react';
import { FaExpand } from 'react-icons/fa';
import '../css/button_css/MaximizeButton.css';
import { useWindowContext } from '../../context/WindowContext';

const MaximizeButton = ({ onClick, windowId }) => {
  const { maximizeWindow, restoreWindow } = useWindowContext();
  const handleClick = () => {
    if (onClick) {
      onClick();
      return;
    }
    if (windowId) {
      if (maximizeWindow) {
        maximizeWindow(windowId);
      } else {
        restoreWindow(windowId);
      }
    }
  };
  return (
    <button className="header-button" onClick={handleClick} aria-label="Maximize">
      <FaExpand />
    </button>
  );
};

export default MaximizeButton;

