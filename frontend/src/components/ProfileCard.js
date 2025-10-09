import React from 'react';
import { useNavigate } from 'react-router-dom';
import OnlineStatusBadge from './OnlineStatusBadge';
import { getDisplayName } from '../utils/userDisplay';
import './ProfileCard.css';

/**
 * ProfileCard Component
 * Reusable profile card with avatar, details, and online status badge
 * Used throughout the app for consistent user display
 */
const ProfileCard = ({ 
  user, 
  showActions = true,
  onMessage,
  onView,
  onRemove,
  removeIcon = '❌',
  removeLabel = 'Remove',
  additionalInfo = null,
  compact = false,
  onClick
}) => {
  const navigate = useNavigate();

  if (!user) return null;

  const username = user.username;
  const displayName = getDisplayName(user);
  const avatar = user.images?.[0] || user.profileImage || user.avatar;
  const initials = user.firstName?.[0] || username?.[0]?.toUpperCase() || '?';

  const handleCardClick = () => {
    if (onClick) {
      onClick(user);
    } else {
      navigate(`/profile/${username}`);
    }
  };

  const handleMessage = (e) => {
    e.stopPropagation();
    if (onMessage) {
      onMessage(user);
    }
  };

  const handleView = (e) => {
    e.stopPropagation();
    if (onView) {
      onView(user);
    } else {
      navigate(`/profile/${username}`);
    }
  };

  const handleRemove = (e) => {
    e.stopPropagation();
    if (onRemove) {
      onRemove(user);
    }
  };

  return (
    <div 
      className={`profile-card ${compact ? 'compact' : ''}`}
      onClick={handleCardClick}
    >
      {/* Avatar with Online Status */}
      <div className="profile-card-avatar">
        {avatar ? (
          <img src={avatar} alt={displayName} className="avatar-image" />
        ) : (
          <div className="avatar-placeholder">
            {initials}
          </div>
        )}
        {/* Online Status Badge */}
        <div className="status-badge-absolute">
          <OnlineStatusBadge username={username} size="medium" />
        </div>
      </div>

      {/* Profile Details */}
      <div className="profile-card-body">
        <h4 className="profile-name">{displayName}</h4>
        
        {user.age && (
          <p className="profile-age">{user.age} years</p>
        )}
        
        {user.location && (
          <p className="profile-location">
            <span className="icon">📍</span> {user.location}
          </p>
        )}
        
        {user.occupation && (
          <p className="profile-occupation">
            <span className="icon">💼</span> {user.occupation}
          </p>
        )}
        
        {user.education && !compact && (
          <p className="profile-education">
            <span className="icon">🎓</span> {user.education}
          </p>
        )}

        {/* Additional Info (custom content) */}
        {additionalInfo && (
          <div className="profile-additional-info">
            {additionalInfo}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {showActions && (
        <div className="profile-card-actions">
          {onMessage && (
            <button 
              className="btn-action btn-message"
              onClick={handleMessage}
              title="Send Message"
            >
              💬
            </button>
          )}
          
          {(onView || !onClick) && (
            <button 
              className="btn-action btn-view"
              onClick={handleView}
              title="View Profile"
            >
              👁️
            </button>
          )}
          
          {onRemove && (
            <button 
              className="btn-action btn-remove"
              onClick={handleRemove}
              title={removeLabel}
            >
              {removeIcon}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ProfileCard;
