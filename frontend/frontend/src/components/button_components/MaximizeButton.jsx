import React from 'react';
import '../css/button_css/MaximizeButton.css';

const MaximizeButton = ({ onClick }) => {
  return (
    <button className="styled-maximize-btn" onClick={onClick} aria-label="Maximize">
      □
    </button>
  );
};

export default MaximizeButton;
