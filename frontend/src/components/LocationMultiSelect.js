import React, { useState, useEffect, useRef } from 'react';
import './LocationMultiSelect.css';

const LocationMultiSelect = ({ 
  options = [], 
  selected = [], 
  onChange, 
  placeholder = "Select locations...",
  maxVisible = 5,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredOptions, setFilteredOptions] = useState([]);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!disabled) return;
    setIsOpen(false);
    setSearchTerm('');
  }, [disabled]);

  // Filter options based on search term
  useEffect(() => {
    const filtered = options.filter(option =>
      option.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredOptions(filtered);
  }, [searchTerm, options]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    if (disabled) return;
    setIsOpen(!isOpen);
    if (!isOpen) {
      setSearchTerm('');
    }
  };

  const handleSelectOption = (option) => {
    if (disabled) return;
    const newSelected = [...selected, option];
    onChange(newSelected);
    setSearchTerm('');
  };

  const handleRemoveOption = (optionToRemove) => {
    if (disabled) return;
    const newSelected = selected.filter(option => option !== optionToRemove);
    onChange(newSelected);
  };

  const handleSelectAll = () => {
    if (disabled) return;
    onChange(filteredOptions);
    setSearchTerm('');
  };

  const handleClearAll = () => {
    if (disabled) return;
    onChange([]);
  };

  const hasMoreSelected = selected.length > maxVisible;

  return (
    <div className={`location-multiselect${disabled ? ' is-disabled' : ''}`} ref={dropdownRef}>
      {/* Selected items display */}
      <div className="location-selected-items">
        {selected.length === 0 ? (
          <div className="location-placeholder" onClick={handleToggle}>
            {placeholder}
          </div>
        ) : (
          <>
            {selected.slice(0, maxVisible).map((option, index) => (
              <div key={index} className="location-selected-item">
                <span className="location-item-text">{option}</span>
                <button
                  type="button"
                  className="location-item-remove"
                  onClick={() => handleRemoveOption(option)}
                  aria-label={`Remove ${option}`}
                  disabled={disabled}
                >
                  ×
                </button>
              </div>
            ))}
            {hasMoreSelected && (
              <div className="location-more-indicator">
                +{selected.length - maxVisible} more
              </div>
            )}
            <button
              type="button"
              className="location-toggle-button"
              onClick={handleToggle}
              aria-label="Toggle dropdown"
              disabled={disabled}
            >
              {isOpen ? '▲' : '▼'}
            </button>
          </>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="location-dropdown">
          <div className="location-dropdown-header">
            <span className="location-dropdown-title">Select Locations</span>
            <button
              type="button"
              className="location-dropdown-close"
              onClick={() => {
                setIsOpen(false);
                setSearchTerm('');
              }}
              aria-label="Close dropdown"
            >
              ×
            </button>
          </div>

          {/* Search input */}
          <div className="location-search-container">
            <input
              type="text"
              className="location-search-input"
              placeholder="Search locations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
              disabled={disabled}
            />
          </div>

          {/* Select/Clear all buttons */}
          <div className="location-dropdown-actions">
            <button
              type="button"
              className="location-select-all-btn"
              onClick={handleSelectAll}
              disabled={disabled || filteredOptions.length === 0}
            >
              Select All ({filteredOptions.length})
            </button>
            <button
              type="button"
              className="location-clear-all-btn"
              onClick={handleClearAll}
              disabled={disabled || selected.length === 0}
            >
              Clear All ({selected.length})
            </button>
          </div>

          {/* Options list */}
          <div className="location-options-list">
            {filteredOptions.length === 0 ? (
              <div className="location-no-options">
                {searchTerm ? 'No locations found' : 'No locations available'}
              </div>
            ) : (
              filteredOptions.map((option, index) => (
                <div
                  key={index}
                  className={`location-option ${selected.includes(option) ? 'selected' : ''}`}
                  onClick={() => {
                    if (disabled) return;
                    if (selected.includes(option)) {
                      handleRemoveOption(option);
                    } else {
                      handleSelectOption(option);
                    }
                  }}
                >
                  <div className="location-option-content">
                    <span className="location-option-text">{option}</span>
                    {selected.includes(option) && (
                      <span className="location-option-selected">✓</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="location-dropdown-footer">
            <span className="location-selection-count">
              {selected.length} location{selected.length !== 1 ? 's' : ''} selected
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationMultiSelect;
