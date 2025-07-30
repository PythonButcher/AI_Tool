import React from 'react';
import { FaLock, FaUnlock } from 'react-icons/fa';
import '../css/button_css/LockButton.css';
import { useWindowContext } from '../../context/WindowContext';

const LockButton = ({ windowId }) => {
  const { lockedWindows, lockWindow, unlockWindow } = useWindowContext();
  const isLocked = lockedWindows[windowId];

  const handleClick = () => {
    if (isLocked) {
      unlockWindow(windowId);
    } else {
      lockWindow(windowId);
    }
  };

  return (
    <button className="header-button" onClick={handleClick} aria-label={isLocked ? 'Unlock' : 'Lock'}>
      {isLocked ? <FaUnlock /> : <FaLock />}
    </button>
  );
};

export default LockButton;
