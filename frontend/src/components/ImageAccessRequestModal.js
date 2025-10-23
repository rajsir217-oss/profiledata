import React, { useState } from 'react';
import './ImageAccessRequestModal.css';

const ImageAccessRequestModal = ({ 
  isOpen, 
  onClose, 
  ownerName,
  ownerUsername,
  imageCount,
  requestType = 'initial', // 'initial' or 'renewal'
  onSubmit 
}) => {
  const [formData, setFormData] = useState({
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await onSubmit({
        ...formData,
        ownerUsername,
        requestType
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="image-access-request-modal">
        <div className="modal-header">
          <h3>
            {requestType === 'renewal' ? '⏰ Request Access Renewal' : '🔓 Request Image Access'}
          </h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="request-info">
            <p className="info-text">
              {requestType === 'renewal' ? (
                <>
                  Your access to <strong>{ownerName}'s</strong> photos is expiring soon.
                  Request to renew access to continue viewing {imageCount} {imageCount === 1 ? 'photo' : 'photos'}.
                </>
              ) : (
                <>
                  Request access to view <strong>{ownerName}'s</strong> private {imageCount} {imageCount === 1 ? 'photo' : 'photos'}.
                  They will be notified and can approve or reject your request.
                </>
              )}
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Message (Optional):</label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="form-control"
                rows="4"
                maxLength="500"
                placeholder="Introduce yourself or explain why you'd like access..."
              />
              <span className="char-count">{formData.message.length}/500</span>
            </div>

            {error && (
              <div className="error-message">
                ❌ {error}
              </div>
            )}

            <div className="privacy-notice">
              <div className="notice-icon">ℹ️</div>
              <div className="notice-text">
                <strong>How It Works:</strong>
                <ul>
                  <li><strong>{ownerName}</strong> will decide how long to grant access</li>
                  <li>You'll receive a notification when approved</li>
                  <li>You'll get a warning 3 days before expiry</li>
                  <li>Images will gradually blur as access expires</li>
                  <li>You can request renewal before expiry</li>
                </ul>
              </div>
            </div>

            <div className="modal-actions">
              <button 
                type="button" 
                onClick={onClose} 
                className="btn btn-secondary"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="spinner"></span>
                    Sending...
                  </>
                ) : (
                  <>
                    📤 Send Request
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ImageAccessRequestModal;
