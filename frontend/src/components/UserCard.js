import React from 'react';
import { useNavigate } from 'react-router-dom';
import OnlineStatusBadge from './OnlineStatusBadge';
import MessageBadge from './MessageBadge';
import { getDisplayName } from '../utils/userDisplay';
import './UserCard.css';

/**
 * UserCard - Unified reusable user card component
 * 
 * Consolidates: ProfileCard + Dashboard renderUserCard + custom cards
 * 
 * Features:
 * - Multiple variants (default, dashboard, compact, search)
 * - View modes (cards, rows)
 * - Online status & message badges
 * - Customizable actions
 * - Responsive design
 * 
 * Usage:
 * <UserCard
 *   user={user}
 *   variant="dashboard"
 *   viewMode="cards"
 *   actions={[
 *     { icon: '💬', label: 'Message', onClick: handleMessage },
 *     { icon: '❌', label: 'Remove', onClick: handleRemove }
 *   ]}
 * />
 */
const UserCard = ({
  user,
  variant = 'default', // 'default', 'dashboard', 'compact', 'search'
  viewMode = 'cards', // 'cards' or 'rows'
  actions = [],
  onClick,
  additionalInfo,
  showOnlineStatus = true,
  showMessageBadge = true
}) => {
  const navigate = useNavigate();

  if (!user) return null;

  // Handle different data structures (Dashboard uses nested objects)
  const profileData = user.viewerProfile || user.userProfile || user;
  const username = profileData?.username || user.username;
  const displayName = getDisplayName(profileData) || username;
  const avatar = profileData?.images?.[0] || profileData?.profileImage || user.profileImage;
  const initials = profileData?.firstName?.[0] || username?.[0]?.toUpperCase() || '?';

  // Additional metadata from Dashboard
  const viewedAt = user.viewedAt;
  const lastMessage = user.lastMessage;
  const viewCount = user.viewCount;

  const handleCardClick = () => {
    if (onClick) {
      onClick(user);
    } else {
      navigate(`/profile/${username}`);
    }
  };

  const handleActionClick = (e, action) => {
    e.stopPropagation();
    if (action.onClick) {
      action.onClick(user);
    }
  };

  return (
    <div 
      className={`user-card user-card-${variant} user-card-view-${viewMode}`}
      onClick={handleCardClick}
    >
      {/* Avatar Section */}
      <div className="user-card-avatar">
        {avatar ? (
          <img src={avatar} alt={displayName} className="avatar-image" />
        ) : (
          <div className="avatar-placeholder">{initials}</div>
        )}
        
        {/* Badges */}
        {showOnlineStatus && (
          <div className="status-badge-overlay">
            <OnlineStatusBadge username={username} size="small" />
          </div>
        )}
        {showMessageBadge && (
          <MessageBadge username={username} size="small" showCount={true} />
        )}
      </div>

      {/* Body Section */}
      <div className="user-card-body">
        <h4 className="user-name">{displayName}</h4>
        
        {profileData?.age && (
          <p className="user-age">{profileData.age} years</p>
        )}
        
        {profileData?.location && (
          <p className="user-location">
            <span className="icon">📍</span> {profileData.location}
          </p>
        )}
        
        {profileData?.occupation && variant !== 'compact' && (
          <p className="user-occupation">
            <span className="icon">💼</span> {profileData.occupation}
          </p>
        )}
        
        {profileData?.education && variant === 'search' && (
          <p className="user-education">
            <span className="icon">🎓</span> {profileData.education}
          </p>
        )}

        {/* Dashboard-specific info */}
        {viewedAt && (
          <p className="user-meta">
            Viewed: {new Date(viewedAt).toLocaleString()}
            {viewCount > 1 && <span className="view-count"> ({viewCount}x)</span>}
          </p>
        )}
        
        {lastMessage && (
          <p className="user-meta last-message">
            {lastMessage.length > 40 ? lastMessage.substring(0, 40) + '...' : lastMessage}
          </p>
        )}

        {/* Additional custom info */}
        {additionalInfo && (
          <div className="user-additional-info">
            {additionalInfo}
          </div>
        )}
      </div>

      {/* Actions Section */}
      {actions && actions.length > 0 && (
        <div className="user-card-actions">
          {actions.map((action, index) => (
            <button
              key={index}
              className={`user-action-btn ${action.className || ''}`}
              onClick={(e) => handleActionClick(e, action)}
              title={action.label || action.tooltip}
              disabled={action.disabled}
            >
              {action.icon}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserCard;
