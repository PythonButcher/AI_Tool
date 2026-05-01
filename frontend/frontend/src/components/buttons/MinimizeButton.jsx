import React from 'react';
import './MinimizeButton.css'; // Ensure correct path

const MinimizeButton = ({ onClick }) => {
  return (
    <button className="styled-minimize-btn" onClick={onClick} aria-label="Minimize" title="Minimize">
      -
    </button>
  );
};

export default MinimizeButton;
