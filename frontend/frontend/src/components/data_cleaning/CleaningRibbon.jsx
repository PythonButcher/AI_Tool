import React from 'react';

// Encapsulates the ribbon UI so the parent can keep state logic centralized.
function CleaningRibbon({
  transformLibrary,
  selectedCategory,
  setSelectedCategory,
  selectedTransform,
  setSelectedTransform,
  setSuccess,
  setError,
}) {
  return (
    <div className="cleaning-ribbon-container">
      {/* Category Tabs */}
      <div className="ribbon-tabs">
        {transformLibrary.map((category) => (
          <button
            key={category.category}
            className={`ribbon-tab ${selectedCategory === category.category ? 'active' : ''}`}
            onClick={() => {
              setSelectedCategory(category.category);
              // Do not automatically select a tool, keep panel closed until tool click
              // setSelectedTransform(null);
            }}
          >
            {category.category}
          </button>
        ))}
      </div>

      {/* Toolbar Icons for Active Category */}
      <div className="ribbon-toolbar">
        {transformLibrary.find((c) => c.category === selectedCategory)?.transforms.map((transform) => (
          <button
            key={transform.type}
            className={`ribbon-btn ${selectedTransform === transform.type ? 'active' : ''}`}
            onClick={() => {
              setSelectedTransform(transform.type);
              setSuccess(null);
              setError(null);
            }}
            title={`${transform.label} - ${transform.description}`}
          >
            <div className="ribbon-icon">{transform.icon}</div>
            <div className="ribbon-label">{transform.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default CleaningRibbon;
