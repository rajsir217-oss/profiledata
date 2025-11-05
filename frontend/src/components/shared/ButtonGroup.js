import React from 'react';
import './ButtonGroup.css';

/**
 * ButtonGroup Component
 * Modern segmented control for multiple choice selections
 * Better UX than dropdowns for 2-4 options
 */
const ButtonGroup = ({ 
  options, 
  value, 
  onChange, 
  name,
  required = false,
  error,
  touched,
  vertical = false
}) => {
  const handleSelect = (optionValue) => {
    // Simulate native change event for compatibility with existing handlers
    const event = {
      target: {
        name: name,
        value: optionValue
      }
    };
    onChange(event);
  };

  return (
    <div className="button-group-container">
      <div className={`button-group ${vertical ? 'button-group-vertical' : ''} ${error && touched ? 'is-invalid' : ''}`}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`btn-option ${value === option.value ? 'active' : ''}`}
            onClick={() => handleSelect(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {error && touched && (
        <div className="invalid-feedback d-block">{error}</div>
      )}
    </div>
  );
};

export default ButtonGroup;
