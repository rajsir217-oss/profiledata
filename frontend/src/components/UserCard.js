import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getImageUrl } from '../utils/urlHelper';
import OnlineStatusBadge from './OnlineStatusBadge';
import MessageBadge from './MessageBadge';
import { getDisplayName } from '../utils/userDisplay';
import SimpleKebabMenu from './SimpleKebabMenu';
import './UserCard.css';
import { ACTION_ICONS } from '../constants/icons';

/**
 * UserCard - Unified reusable user card component
 * 
 * Consolidates: ProfileCard + Dashboard renderUserCard + custom cards
 * 
 * Features:
 * - Multiple variants (default, dashboard, compact, search)
 * - View modes (cards, rows)
 * - Online status & message badges
 * - Context-aware bottom actions
 * - Kebab menu for secondary actions
 * - Responsive design
 * 
 * Usage:
 * <UserCard
 *   user={user}
 *   variant="dashboard"
 *   viewMode="cards"
 *   context="my-favorites"
 *   isFavorited={true}
 *   isShortlisted={false}
 *   onToggleFavorite={handleToggleFavorite}
 *   onToggleShortlist={handleToggleShortlist}
 *   onMessage={handleMessage}
 *   onViewProfile={handleViewProfile}
 *   onRemove={handleRemoveFromFavorites}
 * />
 */
const UserCard = ({
  user,
  variant = 'default', // 'default', 'dashboard', 'compact', 'search'
  viewMode = 'cards', // 'cards' or 'rows'
  context = 'default', // Page context for bottom actions
  actions = [], // Legacy support - deprecated in favor of context-based actions
  onClick,
  additionalInfo,
  showOnlineStatus = true,
  showMessageBadge = true,
  // Kebab menu handlers
  isFavorited = false,
  isShortlisted = false,
  isBlocked = false,
  piiAccess = {},
  onViewProfile,
  onToggleFavorite,
  onToggleShortlist,
  onMessage,
  onBlock,
  onRequestPII,
  onReport,
  onRemove, // Context-specific remove action
  onApprove, // For PII request approvals
  onDeny // For PII request denials
}) => {
  const navigate = useNavigate();
  const [imageError, setImageError] = useState(false);

  if (!user) return null;

  // Handle different data structures (Dashboard uses nested objects)
  const profileData = user.viewerProfile || user.userProfile || user;
  const username = profileData?.username || user.username;
  const displayName = getDisplayName(profileData) || username;
  const avatarPath = profileData?.images?.[0] || profileData?.profileImage || user.profileImage;
  const avatar = avatarPath ? getImageUrl(avatarPath) : null;
  
  // Get initials from first and last name, fallback to username
  const getInitials = () => {
    const firstName = profileData?.firstName || '';
    const lastName = profileData?.lastName || '';
    
    if (firstName && lastName) {
      return (firstName[0] + lastName[0]).toUpperCase();
    } else if (firstName) {
      return firstName[0].toUpperCase();
    } else if (username) {
      return username[0].toUpperCase();
    }
    return '?';
  };
  
  const initials = getInitials();

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

  // Context-based bottom action configuration
  const getBottomActions = () => {
    const bottomActions = [];

    switch (context) {
      case 'my-messages':
        if (onMessage) bottomActions.push({ icon: ACTION_ICONS.MESSAGE, label: 'Open Chat', handler: onMessage, className: 'btn-primary' });
        if (onRemove) bottomActions.push({ icon: ACTION_ICONS.DELETE, label: 'Delete', handler: onRemove, className: 'btn-danger' });
        break;

      case 'my-favorites':
        if (onMessage) bottomActions.push({ icon: ACTION_ICONS.MESSAGE, label: 'Message', handler: onMessage, className: 'btn-primary' });
        if (onRemove) bottomActions.push({ icon: ACTION_ICONS.UNFAVORITE, label: 'Unfavorite', handler: onRemove, className: 'btn-warning' });
        break;

      case 'my-shortlists':
        if (onMessage) bottomActions.push({ icon: ACTION_ICONS.MESSAGE, label: 'Message', handler: onMessage, className: 'btn-primary' });
        if (onRemove) bottomActions.push({ icon: ACTION_ICONS.REMOVE_SHORTLIST, label: 'Remove', handler: onRemove, className: 'btn-info' });
        break;

      case 'not-interested':
      case 'my-exclusions':
        if (onViewProfile) bottomActions.push({ icon: ACTION_ICONS.VIEW_PROFILE, label: 'View', handler: onViewProfile, className: 'btn-secondary' });
        if (onRemove) bottomActions.push({ icon: ACTION_ICONS.UNBLOCK, label: 'Unblock', handler: onRemove, className: 'btn-success' });
        break;

      case 'pii-requests':
      case 'photo-requests':
        if (onApprove) bottomActions.push({ icon: ACTION_ICONS.UNBLOCK, label: 'Approve', handler: onApprove, className: 'btn-success' });
        if (onDeny) bottomActions.push({ icon: ACTION_ICONS.CANCEL, label: 'Deny', handler: onDeny, className: 'btn-danger' });
        break;

      case 'search-results':
      case 'l3v3l-matches':
      case 'profile-views':
      case 'their-favorites':
      case 'their-shortlists':
      default:
        if (onMessage) bottomActions.push({ icon: ACTION_ICONS.MESSAGE, label: 'Message', handler: onMessage, className: 'btn-primary' });
        if (onViewProfile) bottomActions.push({ icon: ACTION_ICONS.VIEW_PROFILE, label: 'View', handler: onViewProfile, className: 'btn-secondary' });
        break;
    }

    return bottomActions;
  };

  const bottomActions = getBottomActions();
  const hasBottomActions = bottomActions.length > 0;
  const hasKebabMenu = onToggleFavorite || onToggleShortlist || onBlock || onRequestPII || onReport;
  
  // Use context-based actions if available, fallback to legacy actions prop
  const displayActions = hasBottomActions ? bottomActions : actions;

  return (
    <div 
      className={`user-card user-card-${variant} user-card-view-${viewMode}`}
      onClick={handleCardClick}
    >
      {/* Avatar Section OR Bio Section */}
      {avatar && !imageError ? (
        <div className="user-card-avatar">
          <img 
            src={avatar} 
            alt={displayName} 
            className="avatar-image"
            onError={() => setImageError(true)}
          />
          
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
      ) : (
        <div className="user-card-bio-section">
          {/* Header with small initials + name */}
          <div className="user-card-bio-header">
            <div className="bio-initials-circle" data-initials={initials}></div>
            <div className="bio-header-info">
              <h4 className="bio-name">{displayName}</h4>
              {profileData?.age && (
                <span className="bio-age-bubble">{profileData.age}yrs</span>
              )}
            </div>
          </div>
          
          {/* Bio Text */}
          <div className="user-card-bio-content">
            {profileData?.bio || profileData?.aboutMe || profileData?.about || profileData?.description || profileData?.aboutYou ? (
              <p className="bio-text">
                "{profileData.bio || profileData.aboutMe || profileData.about || profileData.description || profileData.aboutYou}"
              </p>
            ) : (
              <p className="bio-text bio-placeholder">
                "No bio available. Click to view full profile..."
              </p>
            )}
          </div>
          
          {/* Footer with location, profession, education */}
          <div className="user-card-bio-footer">
            {profileData?.location && (
              <span className="bio-detail">
                <span className="icon">📍</span> {profileData.location}
              </span>
            )}
            {profileData?.occupation && (
              <span className="bio-detail">
                <span className="icon">💼</span> {profileData.occupation}
              </span>
            )}
            {profileData?.education && (
              <span className="bio-detail">
                <span className="icon">🎓</span> {profileData.education}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Body Section - Only show when there's an image */}
      {avatar && !imageError && (
        <div className="user-card-body">
          <h4 className="user-name">{displayName}</h4>
          
          {profileData?.age && (
            <p className="user-age">{profileData.age}yrs</p>
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
      )}

      {/* Header Actions - Simple Kebab Menu */}
      {hasKebabMenu && (
        <div className="user-card-header-actions">
          <SimpleKebabMenu
            user={user}
            isFavorited={isFavorited}
            isShortlisted={isShortlisted}
            onViewProfile={onViewProfile}
            onToggleFavorite={onToggleFavorite}
            onToggleShortlist={onToggleShortlist}
            onMessage={onMessage}
            onBlock={onBlock}
            onRequestPII={onRequestPII}
            onReport={onReport}
          />
        </div>
      )}

      {/* Bottom Actions Section - Context-aware */}
      {displayActions && displayActions.length > 0 && (
        <div className="user-card-bottom-actions">
          {displayActions.map((action, index) => (
              <button
                key={index}
                className={`bottom-action-btn ${action.className || ''}`}
                onClick={async (e) => {
                  e.stopPropagation();
                  console.log('🔘 Button clicked:', action.label, 'handler:', !!action.handler, 'user:', user?.username);
                  if (action.handler) {
                    console.log('🔘 Calling handler for:', action.label);
                    try {
                      await action.handler(user);
                      console.log('🔘 Handler completed for:', action.label);
                    } catch (err) {
                      console.error('🔘 Handler error:', err);
                    }
                  } else if (action.onClick) {
                    console.log('🔘 Calling onClick for:', action.label);
                    await action.onClick(user);
                  }
                }}
                title={action.label}
                disabled={action.disabled}
              >
                <span className="btn-icon">{action.icon}</span>
                <span className="btn-label">{action.label}</span>
              </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserCard;
