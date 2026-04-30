import React from 'react';
import { FaEdit, FaTrash } from 'react-icons/fa';

const AppliedStepsList = ({ steps, editingId, onEditStep, onDeleteStep, onMoveStep }) => {
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
               <button onClick={() => onEditStep(step)} title="Edit Step" aria-label="Edit Step"><FaEdit /></button>
               <button onClick={() => onDeleteStep(step.id)} title="Remove Step" aria-label="Remove Step"><FaTrash /></button>
               <div className="step-arrows">
                  <button onClick={() => onMoveStep(idx, -1)} disabled={idx === 0} title="Move Step Up" aria-label="Move Step Up">↑</button>
                  <button onClick={() => onMoveStep(idx, 1)} disabled={idx === steps.length - 1} title="Move Step Down" aria-label="Move Step Down">↓</button>
               </div>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AppliedStepsList;
