import React from 'react';

/**
 * Reusable Height Selector Component
 * Provides two dropdowns for Feet and Inches
 * Used in both Register and EditProfile pages
 */
const HeightSelector = ({
  heightFeet,
  heightInches,
  onFeetChange,
  onInchesChange,
  onBlur,
  required = false,
  errorFeet = '',
  errorInches = '',
  touchedFeet = false,
  touchedInches = false,
  label = 'Height'
}) => {
  const showErrorFeet = touchedFeet && errorFeet;
  const showErrorInches = touchedInches && errorInches;

  return (
    <div>
      <label className="form-label">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      <div className="row">
        <div className="col-6">
          <select
            className={`form-control ${showErrorFeet ? 'is-invalid' : ''}`}
            name="heightFeet"
            value={heightFeet}
            onChange={onFeetChange}
            onBlur={onBlur}
            required={required}
          >
            <option value="">Feet</option>
            <option value="4">4 ft</option>
            <option value="5">5 ft</option>
            <option value="6">6 ft</option>
            <option value="7">7 ft</option>
          </select>
          {showErrorFeet && (
            <div className="invalid-feedback d-block">{errorFeet}</div>
          )}
        </div>
        <div className="col-6">
          <select
            className={`form-control ${showErrorInches ? 'is-invalid' : ''}`}
            name="heightInches"
            value={heightInches}
            onChange={onInchesChange}
            onBlur={onBlur}
            required={required}
          >
            <option value="">Inches</option>
            <option value="0">0 in</option>
            <option value="1">1 in</option>
            <option value="2">2 in</option>
            <option value="3">3 in</option>
            <option value="4">4 in</option>
            <option value="5">5 in</option>
            <option value="6">6 in</option>
            <option value="7">7 in</option>
            <option value="8">8 in</option>
            <option value="9">9 in</option>
            <option value="10">10 in</option>
            <option value="11">11 in</option>
          </select>
          {showErrorInches && (
            <div className="invalid-feedback d-block">{errorInches}</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HeightSelector;
