import React, { useState, useEffect } from 'react';
import { getAuthenticatedImageUrl } from '../utils/imageUtils';
import './ImageManagerModal.css';

const ImageManagerModal = ({ isOpen, onClose, requester, ownerImages, onGrant }) => {
  const [message, setMessage] = useState('');
  const [granting, setGranting] = useState(false);
  
  // Fixed 7-day access for all onRequest photos (same as pending request expiry)
  const ACCESS_DURATION_DAYS = 7;

  // ESC key to close modal
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && isOpen && !granting) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
      return () => {
        document.removeEventListener('keydown', handleEscKey);
      };
    }
  }, [isOpen, onClose, granting]);

  const handleGrant = async () => {
    setGranting(true);
    try {
      // All photos get fixed 7-day access
      const pictureDurations = ownerImages?.reduce((acc, img, idx) => {
        acc[idx] = ACCESS_DURATION_DAYS;
        return acc;
      }, {}) || {};
      
      await onGrant({
        pictureDurations,
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
                <img src={getAuthenticatedImageUrl(requester.images[0])} alt={requester.firstName} />
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

          <div className="picture-access-selector">
            <h4>📸 Photos to Share</h4>
            <p className="section-description">
              Access will be granted for <strong>7 days</strong> (same as request expiry)
            </p>

            <div className="picture-grid">
              {ownerImages && ownerImages.map((image, index) => (
                <div key={index} className="picture-item">
                  <img 
                    src={getAuthenticatedImageUrl(image)} 
                    alt={`Photo ${index + 1}`} 
                    className="picture-thumbnail"
                  />
                  <span className="picture-label">Photo {index + 1}</span>
                </div>
              ))}
            </div>
            
            <div className="access-duration-info">
              <span className="duration-badge">⏱️ 7 days access</span>
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
