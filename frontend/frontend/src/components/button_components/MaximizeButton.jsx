import React from 'react';
import { FaExpand } from 'react-icons/fa';
import '../css/button_css/MaximizeButton.css';

const MaximizeButton = ({ onClick }) => {
  return (
    <button className="header-button" onClick={onClick} aria-label="Maximize">
      <FaExpand />
    </button>
  );
};

export default MaximizeButton;

