import React, { useState, useEffect, useRef } from 'react';
import './OccupationMultiSelect.css';

const OccupationMultiSelect = ({ 
  options = [], 
  selected = [], 
  onChange, 
  placeholder = "Select options...",
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

  const handleClearAll = () => {
    if (disabled) return;
    onChange([]);
  };

  const handleSelectAll = () => {
    if (disabled) return;
    const allAvailableOptions = options.filter(option =>
      !selected.includes(option) &&
      option.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const newSelected = [...selected, ...allAvailableOptions];
    onChange(newSelected);
    setSearchTerm('');
  };

  const displaySelected = selected.slice(0, maxVisible);
  const hasMoreSelected = selected.length > maxVisible;

  return (
    <div className={`occupation-multiselect${disabled ? ' is-disabled' : ''}`} ref={dropdownRef}>
      {/* Selected items display */}
      <div className="occupation-selected-items">
        {selected.length === 0 ? (
          <div className="occupation-placeholder" onClick={handleToggle}>
            {placeholder}
          </div>
        ) : (
          <>
            {displaySelected.map((option, index) => (
              <div key={index} className="occupation-selected-item">
                <span className="occupation-item-text">{option}</span>
                <button
                  type="button"
                  className="occupation-remove-btn"
                  onClick={() => handleRemoveOption(option)}
                  aria-label={`Remove ${option}`}
                  disabled={disabled}
                >
                  ×
                </button>
              </div>
            ))}
            {hasMoreSelected && (
              <div className="occupation-more-indicator">
                +{selected.length - maxVisible} more
              </div>
            )}
            {selected.length > 0 && (
              <button
                type="button"
                className="occupation-clear-all"
                onClick={handleClearAll}
                title="Clear all selections"
                disabled={disabled}
              >
                Clear all
              </button>
            )}
          </>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="occupation-dropdown">
          <div className="occupation-dropdown-header">
            <span className="occupation-dropdown-title">Select Occupations</span>
            <button
              type="button"
              className="occupation-dropdown-close"
              onClick={() => {
                setIsOpen(false);
                setSearchTerm('');
              }}
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <div className="occupation-search">
            <input
              type="text"
              className="occupation-search-input"
              placeholder="Search occupations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
              disabled={disabled}
            />
          </div>
          
          <div className="occupation-options">
            {/* Select All / Clear All actions */}
            {filteredOptions.length > 0 && (
              <div className="occupation-actions">
                {selected.length > 0 && (
                  <button
                    type="button"
                    className="occupation-action-btn occupation-clear-btn"
                    onClick={handleClearAll}
                    disabled={disabled}
                  >
                    Clear All
                  </button>
                )}
                {filteredOptions.length > selected.length && (
                  <button
                    type="button"
                    className="occupation-action-btn occupation-select-all-btn"
                    onClick={handleSelectAll}
                    disabled={disabled}
                  >
                    Select All {searchTerm ? `(${filteredOptions.length} matches)` : `(${filteredOptions.length})`}
                  </button>
                )}
              </div>
            )}
            
            {filteredOptions.length === 0 ? (
              <div className="occupation-no-options">
                {searchTerm ? 'No occupations found' : 'All occupations selected'}
              </div>
            ) : (
              filteredOptions.map((option, index) => {
                const isSelected = selected.includes(option);
                return (
                  <div
                    key={index}
                    className={`occupation-option ${isSelected ? 'occupation-option-selected' : ''}`}
                    onClick={() => {
                      if (disabled) return;
                      if (isSelected) {
                        handleRemoveOption(option);
                      } else {
                        handleSelectOption(option);
                      }
                    }}
                  >
                    {option}
                    {isSelected && (
                      <span className="occupation-option-check">✓</span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OccupationMultiSelect;
