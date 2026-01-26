import React from 'react';

// Isolates the static help overlay markup for clarity.
function DataCleaningHelpOverlay({ isHelpVisible, helpId, closeHelp }) {
  if (!isHelpVisible(helpId)) return null;

  return (
    <div className="help-overlay visible">
      <div className="help-overlay-content">
        <span
          className="help-overlay-close"
          onClick={() => closeHelp(helpId)}
        >
          ×
        </span>
        <h3>Data Cleaning</h3>
        <ul>
          <li>Use the Data Cleaning tools to fix structural issues in your dataset, such as missing values, incorrect data types, duplicate rows, or malformed columns.</li>
          <li>Cleaning steps are added incrementally and can be previewed before being applied, allowing you to safely refine your data without permanent changes.</li>
        </ul>

        <h3>ML Prep</h3>
        <ul>
          <li>The ML Prep section analyzes your current dataset to determine whether it is suitable for specific machine learning models.</li>
          <li>When issues are found, ML Prep suggests concrete cleaning actions that you can add directly to your cleaning workflow.</li>
        </ul>
      </div>
    </div>
  );
}

export default DataCleaningHelpOverlay;
