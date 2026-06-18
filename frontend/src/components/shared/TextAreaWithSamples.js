import React, { useState } from 'react';
import './TextAreaWithSamples.css';

/**
 * Reusable TextArea with Sample Text Carousel
 * Used for fields like Family Background, About Me, Partner Preference, etc.
 * Provides sample texts that users can cycle through and load with one click
 */
const TextAreaWithSamples = ({
  label,
  name,
  value,
  onChange,
  onBlur,
  required = false,
  rows = 5,
  placeholder = '',
  samples = [],
  helperText = '',
  showSamples = true,
  error = '',
  touched = false,
  className = ''
}) => {
  const [sampleIndex, setSampleIndex] = useState(0);
  const showError = touched && error;

  const handlePrevSample = () => {
    setSampleIndex((prev) => (prev - 1 + samples.length) % samples.length);
  };

  const handleNextSample = () => {
    setSampleIndex((prev) => (prev + 1) % samples.length);
  };

  const handleLoadSample = () => {
    // Create a synthetic event to pass to onChange
    const syntheticEvent = {
      target: {
        name: name,
        value: samples[sampleIndex]
      }
    };
    onChange(syntheticEvent);
  };

  return (
    <div className="mb-3 text-area-with-samples">
      <label className="form-label">
        {label} {required && <span className="text-danger">*</span>}
      </label>

      {/* Sample Text Carousel */}
      {showSamples && samples.length > 0 && (
        <>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <small className="text-muted" style={{ fontSize: '10px' }}>💡 Sample texts to help you get started:</small>
            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className="btn btn-sm"
                onClick={handlePrevSample}
                style={{ 
                  width: '20px', height: '20px', padding: '0', fontSize: '11px', lineHeight: '1', 
                  borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--success-color, #28a745)', color: 'white', border: 'none'
                }}
                title="Previous sample"
              >
                ‹
              </button>
              <span 
                className="badge" 
                style={{ 
                  height: '20px', lineHeight: '20px', minWidth: '32px', padding: '0 6px', 
                  fontSize: '10px', borderRadius: '4px',
                  background: 'var(--success-color, #28a745)', color: 'white'
                }}
              >
                {sampleIndex + 1}/{samples.length}
              </span>
              <button
                type="button"
                className="btn btn-sm"
                onClick={handleNextSample}
                style={{ 
                  width: '20px', height: '20px', padding: '0', fontSize: '11px', lineHeight: '1', 
                  borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--success-color, #28a745)', color: 'white', border: 'none'
                }}
                title="Next sample"
              >
                ›
              </button>
            </div>
          </div>

          <div 
            className="card p-2 mb-2" 
            onClick={handleLoadSample}
            style={{ 
              backgroundColor: 'var(--surface-color, #f8f9fa)', 
              border: '1px dashed var(--border-color, #dee2e6)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              borderRadius: '8px'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--hover-background, #e9ecef)';
              e.currentTarget.style.borderColor = 'var(--primary-color, #2196f3)';
              e.currentTarget.style.boxShadow = '0 2px 6px rgba(33, 150, 243, 0.15)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--surface-color, #f8f9fa)';
              e.currentTarget.style.borderColor = 'var(--border-color, #dee2e6)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            title="Click to load this sample"
          >
            <small className="text-muted" style={{ fontSize: '12px', lineHeight: '1.4' }}>
              <strong>Sample {sampleIndex + 1}:</strong> {samples[sampleIndex].substring(0, 150)}... 
              <span style={{ color: 'var(--primary-color, #2196f3)', fontWeight: 'bold' }}> ↓ Click to use</span>
            </small>
          </div>
        </>
      )}

      {/* TextArea */}
      <textarea
        className={`form-control ${className} ${showError ? 'is-invalid' : ''}`}
        name={name}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        rows={rows}
        placeholder={placeholder}
        required={required}
      />

      {/* Error Message */}
      {showError && <div className="invalid-feedback d-block">{error}</div>}

      {/* Helper Text */}
      {helperText && !showError && (
        <small className="text-muted d-block mt-1">{helperText}</small>
      )}
    </div>
  );
};

export default TextAreaWithSamples;
