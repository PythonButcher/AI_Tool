import React from 'react';
import { FaEdit, FaTrash } from 'react-icons/fa';

// Keeps applied steps rendering separate from the orchestration logic.
function AppliedStepsPanel({
  steps,
  editingId,
  editStep,
  deleteStep,
  moveStep,
}) {
  return (
    <div className="applied-steps-panel">
      <div className="panel-header">Applied Steps</div>
      <div className="steps-list">
        {steps.length === 0 && <div className="muted-text">No steps yet.</div>}
        {steps.map((step, idx) => (
          <div key={step.id} className={`step-item ${editingId === step.id ? 'editing' : ''}`}>
            <div className="step-info">
              <span className="step-number">{idx + 1}</span>
              <div className="step-details">
                <div className="step-name">{step.label}</div>
                <div className="step-type">{step.type}</div>
              </div>
            </div>
            <div className="step-controls">
              <button onClick={() => editStep(step)} title="Edit"><FaEdit /></button>
              <button onClick={() => deleteStep(step.id)} title="Remove"><FaTrash /></button>
              <div className="step-arrows">
                <button onClick={() => moveStep(idx, -1)} disabled={idx === 0}>↑</button>
                <button onClick={() => moveStep(idx, 1)} disabled={idx === steps.length - 1}>↓</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AppliedStepsPanel;
