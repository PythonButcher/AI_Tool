import React from 'react';
import CloseButton from '../../buttons/CloseButton';

function DataCleaningHeader({
  activePanel,
  onChangePanel,
  onRunPreview,
  onApplyAll,
  stepsCount,
  loading,
  onToggleHelp,
  helpId,
  onClose,
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
            onClick={() => onChangePanel('cleaning')}
          >
            Data Cleaning
          </button>
          <button
            type="button"
            className={`header-tab ${activePanel === 'ml_prep' ? 'active' : ''}`}
            onClick={() => onChangePanel('ml_prep')}
          >
            ML Prep
          </button>
        </div>
      </div>
      <div className="header-actions">
        {activePanel === 'cleaning' && (
          <>
            <button className="preview-trigger" onClick={onRunPreview} disabled={stepsCount === 0 || loading}>
              Run Preview
            </button>
            <button className="apply-trigger" onClick={onApplyAll} disabled={stepsCount === 0 || loading}>
              Apply All
            </button>
          </>
        )}
        <button
          type="button"
          className="help-overlay-trigger"
          onClick={() => onToggleHelp(helpId)}
        >
          ❓
        </button>
        <CloseButton onClick={onClose} />
      </div>
    </div>
  );
}

export default DataCleaningHeader;
