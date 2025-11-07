import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import './ProfileViewsModal.css';

const ProfileViewsModal = ({ isOpen, onClose, username }) => {
  const [views, setViews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadProfileViews = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/profile-views/${username}`);
      setViews(response.data.views || []);
    } catch (err) {
      console.error('Error loading profile views:', err);
      setError('Failed to load profile views');
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    if (isOpen && username) {
      loadProfileViews();
    }
  }, [isOpen, username, loadProfileViews]);

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

  const formatTimeAgo = (dateString) => {
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

  const handleViewProfile = (viewerUsername) => {
    window.location.href = `/profile/${viewerUsername}`;
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="profile-views-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>👁️ Profile Views</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {loading && (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading viewers...</p>
            </div>
          )}

          {error && (
            <div className="error-state">
              <p>{error}</p>
              <button onClick={loadProfileViews}>Try Again</button>
            </div>
          )}

          {!loading && !error && views.length === 0 && (
            <div className="empty-state">
              <span className="empty-icon">👁️</span>
              <p>No profile views yet</p>
              <small>Complete your profile to get more views!</small>
            </div>
          )}

          {!loading && !error && views.length > 0 && (
            <div className="views-list">
              {views.map((view) => {
                const profile = view.viewerProfile;
                return (
                  <div key={view.id} className="view-item">
                    <div className="view-avatar">
                      {profile.profileImage ? (
                        <img src={profile.profileImage} alt={profile.username} />
                      ) : (
                        <div className="avatar-placeholder">
                          {profile.firstName?.[0]}{profile.lastName?.[0]}
                        </div>
                      )}
                    </div>

                    <div className="view-info">
                      <div className="view-name">
                        {profile.firstName} {profile.lastName}
                      </div>
                      <div className="view-details">
                        <span className="view-location">📍 {profile.location}</span>
                        {profile.occupation && (
                          <span className="view-occupation">• {profile.occupation}</span>
                        )}
                      </div>
                      <div className="view-timestamp">
                        <span className="view-count">
                          {view.viewCount > 1 ? `Viewed ${view.viewCount} times • ` : ''}
                        </span>
                        <span className="view-time">{formatTimeAgo(view.viewedAt)}</span>
                      </div>
                    </div>

                    <div className="view-actions">
                      <button
                        className="btn-view-profile"
                        onClick={() => handleViewProfile(profile.username)}
                      >
                        View Profile
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <p className="privacy-note">
            💡 Showing views from the last {views.length > 0 ? 'few days' : 'configured period'} (admin setting)
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProfileViewsModal;
