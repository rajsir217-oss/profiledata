import React, { useState, useRef, useEffect } from 'react';
import './Autocomplete.css';

const Autocomplete = ({ 
  value, 
  onChange, 
  suggestions = [], 
  placeholder = "Type to search...",
  name,
  className = "",
  disabled = false,
  onSuggestionSelect
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const wrapperRef = useRef(null);

  // Filter suggestions based on input
  useEffect(() => {
    if (value && value.length >= 2) {
      const lowerQuery = value.toLowerCase();
      const filtered = suggestions.filter(suggestion =>
        suggestion.toLowerCase().includes(lowerQuery)
      ).slice(0, 10); // Limit to 10 suggestions
      setFilteredSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setFilteredSuggestions([]);
      setShowSuggestions(false);
    }
  }, [value, suggestions]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (e) => {
    const newValue = e.target.value;
    onChange(newValue);
    setActiveSuggestionIndex(0);
  };

  const handleSuggestionClick = (suggestion) => {
    onChange(suggestion);
    setShowSuggestions(false);
    if (onSuggestionSelect) {
      onSuggestionSelect(suggestion);
    }
  };

  const handleKeyDown = (e) => {
    // Up arrow
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (activeSuggestionIndex > 0) {
        setActiveSuggestionIndex(activeSuggestionIndex - 1);
      }
    }
    // Down arrow
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (activeSuggestionIndex < filteredSuggestions.length - 1) {
        setActiveSuggestionIndex(activeSuggestionIndex + 1);
      }
    }
    // Enter
    else if (e.key === 'Enter' && showSuggestions && filteredSuggestions.length > 0) {
      e.preventDefault();
      handleSuggestionClick(filteredSuggestions[activeSuggestionIndex]);
    }
    // Escape
    else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  return (
    <div className="autocomplete-wrapper" ref={wrapperRef}>
      <input
        type="text"
        className={`form-control autocomplete-input ${className}`}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (filteredSuggestions.length > 0) {
            setShowSuggestions(true);
          }
        }}
        placeholder={placeholder}
        name={name}
        disabled={disabled}
        autoComplete="off"
      />
      {showSuggestions && filteredSuggestions.length > 0 && (
        <ul className="autocomplete-suggestions">
          {filteredSuggestions.map((suggestion, index) => (
            <li
              key={index}
              className={`autocomplete-suggestion-item ${
                index === activeSuggestionIndex ? 'active' : ''
              }`}
              onClick={() => handleSuggestionClick(suggestion)}
              onMouseEnter={() => setActiveSuggestionIndex(index)}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Autocomplete;
