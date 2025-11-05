import React from 'react';
import './ErrorModal.css';

/**
 * ErrorModal Component
 * Displays validation errors and critical messages in a modal popup
 * Similar style to ProfileConfirmationModal
 */
const ErrorModal = ({ show, onClose, title, message, errors = [] }) => {
  if (!show) return null;

  return (
    <div className="error-modal-overlay" onClick={onClose}>
      <div className="error-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="error-modal-header">
          <div className="error-icon">❌</div>
          <h3>{title || 'Validation Error'}</h3>
          <button className="error-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        
        <div className="error-modal-body">
          {message && <p className="error-main-message">{message}</p>}
          
          {errors.length > 0 && (
            <ul className="error-list">
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          )}
        </div>
        
        <div className="error-modal-footer">
          <button className="btn btn-primary" onClick={onClose}>
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};

export default ErrorModal;
