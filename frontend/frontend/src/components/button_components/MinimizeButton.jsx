import React from 'react';
import '../css/button_css/MinimizeButton.css'; // Ensure correct path

const MinimizeButton = ({ onClick }) => {
  return (
    <button className="styled-minimize-btn" onClick={onClick} aria-label="Close">
      -
    </button>
  );
};

export default MinimizeButton;
