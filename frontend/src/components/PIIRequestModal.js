import React, { useState, useEffect } from 'react';
import api from '../api';
import './PIIRequestModal.css';

const PIIRequestModal = ({ isOpen, profileUsername, profileName, onClose, onSuccess, onRefresh, currentAccess = {}, requestStatus = {}, visibilitySettings = {} }) => {
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const currentUsername = localStorage.getItem('username');

  // Map PII type values to visibility setting keys
  const visibilityKeyMap = {
    'contact_number': 'contactNumberVisible',
    'contact_email': 'contactEmailVisible',
    'linkedin_url': 'linkedinUrlVisible',
    'images': null // Images don't have a visibility setting
  };

  // All possible PII types
  const allPiiTypes = [
    { value: 'images', label: '📷 View Photos', description: 'Access to profile pictures' },
    { value: 'contact_number', label: '📞 Contact Number', description: 'Phone number for direct contact' },
    { value: 'contact_email', label: '📧 Contact Email', description: 'Email address for direct contact' },
    { value: 'linkedin_url', label: '🔗 LinkedIn Profile', description: 'LinkedIn profile URL' }
  ];

  // Show ALL types - member-visible ones will be shown as checked+locked
  const piiTypes = allPiiTypes;

  // Get list of member-visible fields for info message (kept for reference)
  const memberVisibleFields = allPiiTypes.filter(type => {
    const visibilityKey = visibilityKeyMap[type.value];
    return visibilityKey && visibilitySettings[visibilityKey] === true;
  });

  // ESC key to close modal
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && isOpen && !submitting) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
      return () => {
        document.removeEventListener('keydown', handleEscKey);
      };
    }
  }, [isOpen, onClose, submitting]);

  // Initialize selected types with already granted access or pending requests
  useEffect(() => {
    if (isOpen) {
      // Disable body scroll when modal is open
      document.body.style.overflow = 'hidden';
      
      // ❌ REMOVED: Auto-refresh on open causes infinite loop
      // Parent should already have fresh data before opening modal
      // if (onRefresh) {
      //   console.log('🔄 PIIRequestModal opened - triggering status refresh...');
      //   onRefresh();
      // }
      
      console.log('🔍 PIIRequestModal opened for:', profileUsername);
      console.log('📊 Current request status:', requestStatus);
      
      const alreadyGrantedOrPending = piiTypes
        .filter(type => {
          const status = requestStatus[type.value];
          console.log(`  ${type.label}: status = ${status || 'none'}`);
          return status === 'approved' || status === 'pending';
        })
        .map(type => type.label)
        .join(', ');
      
      if (alreadyGrantedOrPending) {
        console.log('✅ Already granted/pending:', alreadyGrantedOrPending);
      }
      
    } else {
      // Re-enable body scroll when modal closes
      document.body.style.overflow = 'unset';
      
      // Reset when modal closes
      setSelectedTypes([]);
      setMessage('');
      setError('');
      setSuccessMessage('');
    }
    
    // Cleanup function to ensure scroll is restored
    return () => {
      document.body.style.overflow = 'unset';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, onRefresh]);

  const handleToggleType = (type) => {
    setSelectedTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const handleSelectAll = () => {
    // Get all locked types (already approved/pending - can't be deselected)
    const lockedTypes = piiTypes
      .filter(type => {
        const status = requestStatus[type.value];
        return status === 'approved' || status === 'pending';
      })
      .map(type => type.value);
    
    // Get all available types (not locked)
    const availableTypes = piiTypes
      .filter(type => {
        const status = requestStatus[type.value];
        return status !== 'approved' && status !== 'pending';
      })
      .map(type => type.value);
    
    // Select all: locked + available
    setSelectedTypes([...lockedTypes, ...availableTypes]);
  };

  const handleDeselectAll = () => {
    // Keep only the approved/pending items (can't be deselected)
    const lockedTypes = piiTypes
      .filter(type => {
        const status = requestStatus[type.value];
        return status === 'approved' || status === 'pending';
      })
      .map(type => type.value);
    
    setSelectedTypes(lockedTypes);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Filter out already granted access AND pending requests
    const typesToRequest = selectedTypes.filter(type => {
      const status = requestStatus[type];
      return status !== 'approved' && status !== 'pending';
    });
    
    if (typesToRequest.length === 0) {
      setError('You already have access to all selected information or requests are pending');
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
          zIndex: 10001,
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
          zIndex: 10001,
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
            <div className="section-header">
              <label className="section-label">Select information to request:</label>
              <div className="select-all-buttons">
                <button
                  type="button"
                  className="btn-select-all"
                  onClick={handleSelectAll}
                >
                  Select All
                </button>
                <button
                  type="button"
                  className="btn-deselect-all"
                  onClick={handleDeselectAll}
                >
                  Deselect All
                </button>
              </div>
            </div>
            
            {piiTypes.map(type => {
              const status = requestStatus[type.value]; // 'approved', 'pending', 'expired', or null
              const hasAccess = status === 'approved';
              const isPending = status === 'pending';
              const isExpired = status === 'expired';
              
              // Check if this field is already visible to members (no request needed)
              const visibilityKey = visibilityKeyMap[type.value];
              const isMemberVisible = visibilityKey && visibilitySettings[visibilityKey] === true;
              
              // Disable if: has access, pending, OR already member visible
              const isDisabled = hasAccess || isPending || isMemberVisible;
              // Member-visible fields should appear checked (but locked)
              const isSelected = selectedTypes.includes(type.value) || isMemberVisible;
              
              return (
                <div
                  key={type.value}
                  className={`pii-type-option ${isSelected ? 'selected' : ''} ${hasAccess ? 'has-access' : ''} ${isPending ? 'pending' : ''} ${isExpired ? 'expired' : ''} ${isMemberVisible ? 'member-visible' : ''}`}
                  onClick={() => !isDisabled && handleToggleType(type.value)}
                >
                  <div className="pii-type-checkbox">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={isDisabled}
                      onChange={() => handleToggleType(type.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div className="pii-type-info">
                    <div className="pii-type-label">
                      {type.label}
                      {isMemberVisible && <span className="member-visible-badge">👁️ Already Member Visible</span>}
                      {hasAccess && !isMemberVisible && <span className="access-badge">✅ Already Granted</span>}
                      {isPending && <span className="pending-badge">📨 Request Sent</span>}
                      {isExpired && <span className="expired-badge">🔒 Access Expired</span>}
                    </div>
                    <div className="pii-type-description">
                      {isMemberVisible 
                        ? 'This information is publicly visible to all members' 
                        : type.description}
                    </div>
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
              disabled={submitting || selectedTypes.filter(t => {
                const status = requestStatus[t];
                const visKey = visibilityKeyMap[t];
                const isMemberVis = visKey && visibilitySettings[visKey] === true;
                return status !== 'approved' && status !== 'pending' && !isMemberVis;
              }).length === 0}
            >
              {submitting 
                ? 'Sending...' 
                : `Send Request (${selectedTypes.filter(t => {
                    const status = requestStatus[t];
                    const visKey = visibilityKeyMap[t];
                    const isMemberVis = visKey && visibilitySettings[visKey] === true;
                    return status !== 'approved' && status !== 'pending' && !isMemberVis;
                  }).length})`
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PIIRequestModal;
