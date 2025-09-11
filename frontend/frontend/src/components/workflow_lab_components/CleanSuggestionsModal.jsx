import React, { useState, useMemo, useEffect } from 'react';
import CloseButton from '../button_components/CloseButton';
import '../css/workflow_lab_css/CleanSuggestionsModal.css';

const parseSuggestions = (text) => {
  if (Array.isArray(text)) return text;
  return String(text)
    .split('\n')
    .map(line => line.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean);
};

const CleanSuggestionsModal = ({ suggestions, onApply, onSkip }) => {
  const suggestionList = useMemo(() => parseSuggestions(suggestions), [suggestions]);
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    setSelected(suggestionList.map(() => true));
  }, [suggestionList]);

  const toggle = (idx) => {
    setSelected(prev => prev.map((v, i) => (i === idx ? !v : v)));
  };

  const toggleAll = () => {
    setSelected(prev => {
      const allSelected = prev.every(v => v);
      return prev.map(() => !allSelected);
    });
  };

  const apply = () => {
    const instructions = suggestionList
      .filter((_, i) => selected[i])
      .join('\n');
    onApply(instructions);
  };

  return (
    <div className="cleaning-form-overlay">
      <div className="data-cleaning-form">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4>AI Cleaning Suggestions</h4>
          <CloseButton onClick={onSkip} />
        </div>
        <ul className="suggestion-list">
          {suggestionList.map((text, idx) => (
            <li key={idx}>
              <label>
                <input
                  type="checkbox"
                  checked={selected[idx] || false}
                  onChange={() => toggle(idx)}
                />
                {text}
              </label>
            </li>
          ))}
        </ul>
        <div className="action-buttons">
          <button onClick={toggleAll} className="select-all-btn">
            {selected.every(v => v) ? 'Clear All' : 'Select All'}
          </button>
          <button onClick={apply} disabled={!selected.some(v => v)} className="apply-btn">
            Apply Selected
          </button>
          <button onClick={onSkip} className="skip-btn">Skip</button>
        </div>
      </div>
    </div>
  );
};

export default CleanSuggestionsModal;
