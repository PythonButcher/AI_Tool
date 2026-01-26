import React from 'react';
import CloseButton from '../buttons/CloseButton';

// Keeps the header layout isolated so the main form can focus on orchestration.
function DataCleaningHeader({
  activePanel,
  setActivePanel,
  runCleaning,
  stepsLength,
  loading,
  toggleHelp,
  helpId,
  closeForm,
}) {
  return (
    <div className="manual-cleaning-header">
      <div className="header-left">
        <div className="header-title">
          <h2>Power Query Editor</h2>
          <p className="subtitle">Visual Data Transformation Interface</p>
        </div>
        <div className="header-tabs">
          <button
            type="button"
            className={`header-tab ${activePanel === 'cleaning' ? 'active' : ''}`}
            onClick={() => setActivePanel('cleaning')}
          >
            Data Cleaning
          </button>
          <button
            type="button"
            className={`header-tab ${activePanel === 'ml_prep' ? 'active' : ''}`}
            onClick={() => setActivePanel('ml_prep')}
          >
            ML Prep
          </button>
        </div>
      </div>
      <div className="header-actions">
        {activePanel === 'cleaning' && (
          <>
            <button className="preview-trigger" onClick={() => runCleaning(true)} disabled={stepsLength === 0 || loading}>
              Run Preview
            </button>
            <button className="apply-trigger" onClick={() => runCleaning(false)} disabled={stepsLength === 0 || loading}>
              Apply All
            </button>
          </>
        )}
        <button
          type="button"
          className="help-overlay-trigger"
          onClick={() => toggleHelp(helpId)}
        >
          ❓
        </button>
        <CloseButton onClick={closeForm} />
      </div>
    </div>
  );
}

export default DataCleaningHeader;
