import React from 'react';

/**
 * Reusable Text Input Component
 * Used across Register and EditProfile forms
 */
const TextInput = ({
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
  type = 'text',
  helperText = '',
  className = 'col-md-6',
  autoComplete = 'off'
}) => {
  const showError = touched && error;

  return (
    <div className={className}>
      <label className="form-label">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      <input
        type={type}
        className={`form-control ${showError ? 'is-invalid' : ''}`}
        name={name}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        autoComplete={autoComplete}
      />
      {showError && <div className="invalid-feedback">{error}</div>}
      {helperText && !showError && (
        <small className="text-muted">{helperText}</small>
      )}
    </div>
  );
};

export default TextInput;
