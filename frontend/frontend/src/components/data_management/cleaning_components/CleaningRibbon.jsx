import React from 'react';
import { TRANSFORM_LIBRARY } from './CleaningConstants';

const CleaningRibbon = ({ 
  selectedCategory, 
  onSelectCategory, 
  selectedTransform, 
  onSelectTransform 
}) => {
  return (
    <div className="cleaning-ribbon-container">
      {/* Category Tabs */}
      <div className="ribbon-tabs">
        {TRANSFORM_LIBRARY.map((category) => (
          <button
            key={category.category}
            className={`ribbon-tab ${selectedCategory === category.category ? 'active' : ''}`}
            onClick={() => onSelectCategory(category.category)}
          >
            {category.category}
          </button>
        ))}
      </div>

      {/* Toolbar Icons for Active Category */}
      <div className="ribbon-toolbar">
        {TRANSFORM_LIBRARY.find(c => c.category === selectedCategory)?.transforms.map((transform) => (
          <button
            key={transform.type}
            className={`ribbon-btn ${selectedTransform === transform.type ? 'active' : ''}`}
            onClick={() => onSelectTransform(transform.type)}
            title={`${transform.label} - ${transform.description}`}
          >
            <div className="ribbon-icon">{transform.icon}</div>
            <div className="ribbon-label">{transform.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default CleaningRibbon;
