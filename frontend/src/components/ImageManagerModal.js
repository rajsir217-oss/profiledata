import React, { useState } from 'react';
import './ImageManagerModal.css';

const ImageManagerModal = ({ isOpen, onClose, requester, ownerImages, onGrant }) => {
  const [duration, setDuration] = useState(3); // Default 3 days
  const [noExpiration, setNoExpiration] = useState(false);
  const [message, setMessage] = useState('');
  const [granting, setGranting] = useState(false);

  const durationOptions = [
    { value: 1, label: '1 day', description: 'Quick preview access' },
    { value: 2, label: '2 days', description: 'Short-term access' },
    { value: 3, label: '3 days', description: 'Recommended', recommended: true },
    { value: 4, label: '4 days', description: 'Extended preview' },
    { value: 5, label: '5 days', description: 'Almost a week' },
    { value: 10, label: '10 days', description: 'Medium-term access' },
    { value: 30, label: '30 days', description: 'One month' },
  ];

  const handleGrant = async () => {
    setGranting(true);
    try {
      await onGrant({
        durationDays: noExpiration ? null : duration,
        noExpiration,
        responseMessage: message
      });
      onClose();
    } catch (error) {
      console.error('Error granting access:', error);
    } finally {
      setGranting(false);
    }
  };

  const handleCancel = () => {
    setDuration(3);
    setNoExpiration(false);
    setMessage('');
    onClose();
  };

  if (!isOpen) return null;

  const imageCount = ownerImages?.length || 0;

  return (
    <div className="image-manager-overlay">
      <div className="image-manager-modal">
        <div className="modal-header">
          <h2>📸 Grant Image Access</h2>
          <button className="close-btn" onClick={handleCancel}>×</button>
        </div>

        <div className="modal-body">
          <div className="requester-info">
            <div className="requester-avatar">
              {requester.images && requester.images.length > 0 ? (
                <img src={requester.images[0]} alt={requester.firstName} />
              ) : (
                <span className="avatar-placeholder">👤</span>
              )}
            </div>
            <div className="requester-details">
              <h3>{requester.firstName} {requester.lastName}</h3>
              <p className="username">@{requester.username}</p>
            </div>
          </div>

          <div className="access-info">
            <p>
              You're granting <strong>{requester.firstName}</strong> access to{' '}
              <strong>{imageCount} photo{imageCount !== 1 ? 's' : ''}</strong>
            </p>
          </div>

          <div className="duration-selector">
            <h4>⏰ Expiration Duration</h4>
            <p className="section-description">Choose how long they can view your photos</p>

            <div className="duration-options">
              {durationOptions.map(option => (
                <label 
                  key={option.value} 
                  className={`duration-option ${duration === option.value && !noExpiration ? 'selected' : ''} ${option.recommended ? 'recommended' : ''}`}
                >
                  <input
                    type="radio"
                    name="duration"
                    checked={duration === option.value && !noExpiration}
                    onChange={() => {
                      setDuration(option.value);
                      setNoExpiration(false);
                    }}
                  />
                  <div className="option-content">
                    <span className="option-label">{option.label}</span>
                    <span className="option-description">{option.description}</span>
                    {option.recommended && <span className="recommended-badge">✓ Recommended</span>}
                  </div>
                </label>
              ))}

              <label className={`duration-option permanent ${noExpiration ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="duration"
                  checked={noExpiration}
                  onChange={() => setNoExpiration(true)}
                />
                <div className="option-content">
                  <span className="option-label">♾️ No expiration</span>
                  <span className="option-description">Permanent access (until revoked)</span>
                </div>
              </label>
            </div>
          </div>

          <div className="message-section">
            <label htmlFor="response-message">
              💬 Optional Message
            </label>
            <textarea
              id="response-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a personal message (optional)..."
              rows={3}
              maxLength={200}
            />
            <span className="char-count">{message.length}/200</span>
          </div>

          <div className="preview-section">
            <div className="preview-icon">ℹ️</div>
            <div className="preview-info">
              {!noExpiration ? (
                <>
                  <strong>Access will expire in {duration} day{duration > 1 ? 's' : ''}</strong>
                  <p>They'll see a countdown badge (⏰ {duration}d) and can request renewal before expiry.</p>
                </>
              ) : (
                <>
                  <strong>Permanent access granted</strong>
                  <p>They can view your photos anytime until you manually revoke access.</p>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button 
            className="btn-cancel" 
            onClick={handleCancel}
            disabled={granting}
          >
            Cancel
          </button>
          <button 
            className="btn-grant" 
            onClick={handleGrant}
            disabled={granting}
          >
            {granting ? (
              <>
                <span className="spinner"></span>
                Granting...
              </>
            ) : (
              <>
                ✓ Grant Access
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageManagerModal;
