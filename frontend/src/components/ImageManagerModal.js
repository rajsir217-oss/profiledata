import React, { useState } from 'react';
import './ImageManagerModal.css';

const ImageManagerModal = ({ isOpen, onClose, requester, ownerImages, onGrant }) => {
  const [message, setMessage] = useState('');
  const [granting, setGranting] = useState(false);
  
  // Individual duration for each picture (default: one-time view)
  const [pictureDurations, setPictureDurations] = useState(
    ownerImages?.reduce((acc, img, idx) => {
      acc[idx] = 'onetime'; // default to one-time view
      return acc;
    }, {}) || {}
  );

  const durationOptions = [
    { value: 'onetime', label: 'One-time view only' },
    { value: 1, label: '1 day' },
    { value: 2, label: '2 days' },
    { value: 3, label: '3 days (Recommended)' },
    { value: 4, label: '4 days' },
    { value: 5, label: '5 days' },
    { value: 10, label: '10 days' },
    { value: 30, label: '30 days' },
    { value: 'permanent', label: 'No expiration' },
  ];

  const handleDurationChange = (pictureIndex, value) => {
    setPictureDurations(prev => ({
      ...prev,
      [pictureIndex]: value
    }));
  };

  const handleGrant = async () => {
    setGranting(true);
    try {
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
    setPictureDurations(
      ownerImages?.reduce((acc, img, idx) => {
        acc[idx] = 'onetime';
        return acc;
      }, {}) || {}
    );
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

          <div className="picture-access-selector">
            <h4>📸 Select Access Duration for Each Photo</h4>
            <p className="section-description">Choose how long they can view each photo individually</p>

            <div className="picture-table">
              <table>
                <thead>
                  <tr>
                    <th>Photo</th>
                    <th>Access Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {ownerImages && ownerImages.map((image, index) => (
                    <tr key={index}>
                      <td className="picture-label">
                        <img 
                          src={image} 
                          alt={`Photo ${index + 1}`} 
                          className="picture-thumbnail"
                        />
                        <div className="picture-text">
                          <span className="picture-name">Picture {index + 1}</span>
                        </div>
                      </td>
                      <td className="picture-dropdown">
                        <select
                          value={pictureDurations[index] || 'onetime'}
                          onChange={(e) => handleDurationChange(index, e.target.value)}
                          className="duration-select"
                        >
                          {durationOptions.map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
