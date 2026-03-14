import React, { useState, useMemo, useEffect } from 'react';
import CloseButton from '../../components/buttons/CloseButton';
import './CleanSuggestionsModal.css';

const parseSuggestions = (text) => {
  if (Array.isArray(text)) return text;
  return String(text)
    .split('\n')
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean);
};

const CleanSuggestionsModal = ({ title = 'AI Cleaning Suggestions', suggestions, onApply, onSkip }) => {
  const suggestionList = useMemo(() => parseSuggestions(suggestions), [suggestions]);
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    setSelected(suggestionList.map(() => true));
  }, [suggestionList]);

  const toggle = (idx) => {
    setSelected((prev) => prev.map((value, index) => (index === idx ? !value : value)));
  };

  const toggleAll = () => {
    setSelected((prev) => {
      const allSelected = prev.every((value) => value);
      return prev.map(() => !allSelected);
    });
  };

  const apply = () => {
    const instructions = suggestionList
      .filter((_, index) => selected[index])
      .join('\n');
    onApply(instructions);
  };

  return (
    <div className="cleaning-form-overlay">
      <div className="data-cleaning-form">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4>{title}</h4>
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
            {selected.every((value) => value) ? 'Clear All' : 'Select All'}
          </button>
          <button onClick={apply} disabled={!selected.some((value) => value)} className="apply-btn">
            Apply Selected
          </button>
          <button onClick={onSkip} className="skip-btn">Skip</button>
        </div>
      </div>
    </div>
  );
};

export default CleanSuggestionsModal;
