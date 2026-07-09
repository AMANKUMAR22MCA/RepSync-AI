import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { appendSuggestion } from '../features/form/formSlice';

export default function SuggestionChips() {
  const dispatch = useDispatch();
  const suggestions = useSelector((state) => state.form.suggestions);

  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  const handleChipClick = (suggestion) => {
    dispatch(appendSuggestion(suggestion));
  };

  return (
    <div className="suggestion-chips-container">
      <div className="suggestion-title">AI Suggested Follow-ups:</div>
      <div className="chips-list">
        {suggestions.map((suggestion, idx) => (
          <button
            key={idx}
            type="button"
            className="suggestion-chip"
            onClick={() => handleChipClick(suggestion)}
            title="Click to append to Follow-up Actions"
          >
            <span className="chip-plus">+</span>
            <span className="chip-text">{suggestion}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
