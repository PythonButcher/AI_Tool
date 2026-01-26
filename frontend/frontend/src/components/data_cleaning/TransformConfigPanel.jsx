import React from 'react';

// Groups the active transform configuration without changing its behavior.
function TransformConfigPanel({
  activeTransform,
  renderField,
  addStep,
  editingId,
  setSelectedTransform,
  setEditingId,
}) {
  if (!activeTransform) return null;

  return (
    <div className="config-panel">
      <div className="config-header">
        <h3>Configure: {activeTransform.label}</h3>
        <button
          className="close-config"
          onClick={() => {
            setSelectedTransform(null);
            setEditingId(null);
          }}
        >
          ×
        </button>
      </div>
      <div className="config-content">
        <p className="config-desc">{activeTransform.description}</p>
        <div className="config-form-grid">
          {(activeTransform.fields || []).map((field) => (
            <label key={field.name} className="config-field">
              <span>{field.label}</span>
              {renderField(field)}
            </label>
          ))}
        </div>
      </div>
      <div className="config-footer">
        <button type="button" onClick={addStep} className="add-step-btn">
          {editingId ? 'Update Step' : 'Add Step'}
        </button>
      </div>
    </div>
  );
}

export default TransformConfigPanel;
