import React from 'react';

/**
 * Reusable TextArea Component
 * Used across Register and EditProfile forms
 */
const TextArea = ({
  label,
  name,
  value,
  onChange,
  onBlur,
  placeholder = '',
  required = false,
  error = '',
  touched = false,
  disabled = false,
  rows = 3,
  helperText = '',
  className = 'col-md-12'
}) => {
  const showError = touched && error;

  return (
    <div className={className}>
      <label className="form-label">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      <textarea
        className={`form-control ${showError ? 'is-invalid' : ''}`}
        name={name}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        rows={rows}
      />
      {showError && <div className="invalid-feedback">{error}</div>}
      {helperText && !showError && (
        <small className="text-muted">{helperText}</small>
      )}
    </div>
  );
};

export default TextArea;
