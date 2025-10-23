import React from 'react';

/**
 * Reusable Gender Selector Component
 * Provides radio buttons for gender selection (Male, Female)
 * Used in both Register and EditProfile pages
 */
const GenderSelector = ({
  value,
  onChange,
  onBlur,
  required = false,
  error = '',
  touched = false,
  label = 'Gender',
  name = 'gender'
}) => {
  const showError = touched && error;

  return (
    <div>
      <label className="form-label me-3 mb-2">
        {label}{required && <span className="text-danger">*</span>}
      </label>
      <div className="d-flex align-items-center">
        <div className="form-check form-check-inline">
          <input 
            className="form-check-input" 
            type="radio" 
            name={name}
            id={`${name}-male`}
            value="Male" 
            checked={value === "Male"}
            onChange={onChange}
            onBlur={onBlur}
            required={required}
          />
          <label className="form-check-label" htmlFor={`${name}-male`}>
            Male
          </label>
        </div>
        <div className="form-check form-check-inline">
          <input 
            className="form-check-input" 
            type="radio" 
            name={name}
            id={`${name}-female`}
            value="Female" 
            checked={value === "Female"}
            onChange={onChange}
            onBlur={onBlur}
            required={required}
          />
          <label className="form-check-label" htmlFor={`${name}-female`}>
            Female
          </label>
        </div>
      </div>
      {showError && <div className="text-danger small mt-1">{error}</div>}
    </div>
  );
};

export default GenderSelector;
