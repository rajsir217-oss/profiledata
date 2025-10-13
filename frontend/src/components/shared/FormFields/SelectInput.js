import React from 'react';

/**
 * Reusable Select Dropdown Component
 * Used across Register and EditProfile forms
 */
const SelectInput = ({
  label,
  name,
  value,
  onChange,
  onBlur,
  options,
  required = false,
  error = '',
  touched = false,
  disabled = false,
  helperText = '',
  className = 'col-md-6',
  placeholder = 'Select...'
}) => {
  const showError = touched && error;

  return (
    <div className={className}>
      <label className="form-label">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      <select
        className={`form-control ${showError ? 'is-invalid' : ''}`}
        name={name}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        required={required}
        disabled={disabled}
      >
        <option value="">{placeholder}</option>
        {options.map((option, idx) => (
          <option key={idx} value={option.value || option}>
            {option.label || option}
          </option>
        ))}
      </select>
      {showError && <div className="invalid-feedback">{error}</div>}
      {helperText && !showError && (
        <small className="text-muted">{helperText}</small>
      )}
    </div>
  );
};

export default SelectInput;
