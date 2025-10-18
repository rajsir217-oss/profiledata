import React, { useState, useEffect } from 'react';
import api from '../api';
import './PIIRequestModal.css';

const PIIRequestModal = ({ isOpen, profileUsername, profileName, onClose, onSuccess, currentAccess = {} }) => {
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const currentUsername = localStorage.getItem('username');

  const piiTypes = [
    { value: 'images', label: '📷 View Photos', description: 'Access to profile pictures' },
    { value: 'contact_info', label: '📧 Contact Information', description: 'Email and phone number' },
    { value: 'dob', label: '🎂 Date of Birth', description: 'Full date of birth' },
    { value: 'linkedin_url', label: '🔗 LinkedIn Profile', description: 'LinkedIn profile URL' }
  ];

  // Initialize selected types with already granted access
  useEffect(() => {
    if (isOpen) {
      const alreadyGranted = piiTypes
        .filter(type => currentAccess[type.value])
        .map(type => type.value);
      setSelectedTypes(alreadyGranted);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentAccess]);

  const handleToggleType = (type) => {
    setSelectedTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Filter out already granted access
    const typesToRequest = selectedTypes.filter(type => !currentAccess[type]);
    
    if (typesToRequest.length === 0) {
      setError('You already have access to all selected information');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await api.post(`/pii-requests?username=${currentUsername}`, {
        profileUsername,
        requestTypes: typesToRequest,
        message: message.trim() || null
      });

      // Call parent success handler FIRST to update status immediately
      if (onSuccess) {
        await onSuccess();
      }
      
      // Show success message
      setSuccessMessage(`Request sent successfully to ${profileName}!`);
      
      // Auto-hide success message and close modal
      setTimeout(() => {
        setSuccessMessage('');
        onClose();
        
        // Reset form
        setSelectedTypes([]);
        setMessage('');
      }, 2000);
    } catch (err) {
      console.error('Error creating PII request:', err);
      setError(err.response?.data?.detail || 'Failed to send request');
      // Auto-hide error after 5 seconds
      setTimeout(() => setError(''), 5000);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target.classList.contains('pii-modal-overlay')) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="pii-modal-overlay" onClick={handleOverlayClick}>
      {/* Error Bubble */}
      {error && (
        <div className="status-bubble error-bubble" style={{
          position: 'fixed',
          top: '80px',
          right: '20px',
          backgroundColor: '#f8d7da',
          border: '1px solid #f5c6cb',
          borderRadius: '12px',
          padding: '12px 16px',
          maxWidth: '350px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 2000,
          animation: 'slideInRight 0.3s ease-out'
        }}>
          <span style={{ fontSize: '20px', flexShrink: 0 }}>❌</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ color: '#721c24', display: 'block', fontSize: '13px', marginBottom: '4px' }}>
              Error
            </strong>
            <p style={{ color: '#721c24', margin: 0, fontSize: '12px', lineHeight: '1.4' }}>
              {error}
            </p>
          </div>
          <button 
            onClick={() => setError('')}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '18px',
              cursor: 'pointer',
              color: '#721c24',
              padding: '0',
              width: '20px',
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
            title="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Success Bubble */}
      {successMessage && (
        <div className="status-bubble success-bubble" style={{
          position: 'fixed',
          top: '80px',
          right: '20px',
          backgroundColor: '#d4edda',
          border: '1px solid #c3e6cb',
          borderRadius: '12px',
          padding: '12px 16px',
          maxWidth: '350px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 2000,
          animation: 'slideInRight 0.3s ease-out'
        }}>
          <span style={{ fontSize: '20px', flexShrink: 0 }}>✅</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ color: '#155724', display: 'block', fontSize: '13px', marginBottom: '4px' }}>
              Success
            </strong>
            <p style={{ color: '#155724', margin: 0, fontSize: '12px', lineHeight: '1.4' }}>
              {successMessage}
            </p>
          </div>
        </div>
      )}

      <div className="pii-modal">
        <div className="pii-modal-header">
          <h3>🔒 Request Access to Information</h3>
          <p>Request access to {profileName}'s private information</p>
          <button className="pii-modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="pii-modal-body">
          <div className="pii-types-section">
            <label className="section-label">Select information to request:</label>
            
            {piiTypes.map(type => {
              const hasAccess = currentAccess[type.value];
              const isSelected = selectedTypes.includes(type.value);
              
              return (
                <div
                  key={type.value}
                  className={`pii-type-option ${isSelected ? 'selected' : ''} ${hasAccess ? 'has-access' : ''}`}
                  onClick={() => !hasAccess && handleToggleType(type.value)}
                >
                  <div className="pii-type-checkbox">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={hasAccess}
                      onChange={() => handleToggleType(type.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div className="pii-type-info">
                    <div className="pii-type-label">
                      {type.label}
                      {hasAccess && <span className="access-badge">✅ Already Granted</span>}
                    </div>
                    <div className="pii-type-description">{type.description}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pii-message-section">
            <label className="section-label">Optional message:</label>
            <textarea
              className="pii-message-input"
              placeholder="Why do you need this information? (optional)"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={500}
              rows={3}
            />
            <div className="char-count">{message.length}/500</div>
          </div>

          <div className="pii-modal-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-submit"
              disabled={submitting || selectedTypes.filter(t => !currentAccess[t]).length === 0}
            >
              {submitting 
                ? 'Sending...' 
                : `Send Request (${selectedTypes.filter(t => !currentAccess[t]).length})`
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PIIRequestModal;
