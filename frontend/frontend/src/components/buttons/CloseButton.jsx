import React from 'react';
import './CloseButton.css'; // Ensure correct path

const CloseButton = ({ onClick }) => {
  return (
    <button className="styled-close-btn" onClick={onClick} aria-label="Close">
      ✕
    </button>
  );
};

export default CloseButton;
