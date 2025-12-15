import React, { useState, useEffect } from 'react';
import api from '../api';
import { getAuthenticatedImageUrl } from '../utils/imageUtils';
import './ProfileViewsModal.css'; // Reuse same styles

const FavoritedByModal = ({ isOpen, onClose, username }) => {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && username) {
      loadFavoritedBy();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, username]);

  // ESC key to close modal
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
      return () => {
        document.removeEventListener('keydown', handleEscKey);
      };
    }
  }, [isOpen, onClose]);

  const loadFavoritedBy = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/their-favorites/${username}`);
      setFavorites(response.data.users || []);
    } catch (err) {
      console.error('Error loading favorited by:', err);
      setError('Failed to load favorites');
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (dateString) => {
    if (!dateString) return 'Recently';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  const handleViewProfile = (targetUsername) => {
    window.location.href = `/profile/${targetUsername}`;
  };

  const handleSendMessage = (targetUsername) => {
    window.location.href = `/messages?user=${targetUsername}`;
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="profile-views-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>💖 Favorited By</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {loading && (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading favorites...</p>
            </div>
          )}

          {error && (
            <div className="error-state">
              <p>{error}</p>
              <button onClick={loadFavoritedBy}>Try Again</button>
            </div>
          )}

          {!loading && !error && favorites.length === 0 && (
            <div className="empty-state">
              <span className="empty-icon">💖</span>
              <p>No one has favorited you yet</p>
              <small>Keep your profile updated and engage with others!</small>
            </div>
          )}

          {!loading && !error && favorites.length > 0 && (
            <div className="views-list">
              {favorites.map((user) => (
                <div key={user.username} className="view-item">
                  <div className="view-avatar">
                    {user.profileImage ? (
                      <img src={getAuthenticatedImageUrl(user.profileImage)} alt={user.username} />
                    ) : (
                      <div className="avatar-placeholder">
                        {user.firstName?.[0]}{user.lastName?.[0]}
                      </div>
                    )}
                  </div>

                  <div className="view-info">
                    <div className="view-name">
                      {user.firstName} {user.lastName}
                    </div>
                    <div className="view-details">
                      {user.age && <span className="view-location">{user.age} years old</span>}
                      {user.location && (
                        <span className="view-location">• 📍 {user.location}</span>
                      )}
                    </div>
                    {user.occupation && (
                      <div className="view-details">
                        <span className="view-occupation">{user.occupation}</span>
                      </div>
                    )}
                    <div className="view-timestamp">
                      <span className="view-time">Favorited {formatTimeAgo(user.addedAt)}</span>
                    </div>
                  </div>

                  <div className="view-actions" style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="btn-view-profile"
                      onClick={() => handleViewProfile(user.username)}
                      style={{ padding: '10px 16px' }}
                    >
                      View
                    </button>
                    <button
                      className="btn-view-profile"
                      onClick={() => handleSendMessage(user.username)}
                      style={{ 
                        padding: '10px 16px',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                      }}
                    >
                      💬
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <p className="privacy-note">
            💡 Showing favorites from the last {favorites.length > 0 ? 'few days' : 'configured period'} (admin setting)
          </p>
        </div>
      </div>
    </div>
  );
};

export default FavoritedByModal;
