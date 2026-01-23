import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getImageUrl } from '../utils/urlHelper';
import OnlineStatusBadge from './OnlineStatusBadge';
import MessageBadge from './MessageBadge';
import DefaultAvatar from './DefaultAvatar';
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
  // eslint-disable-next-line no-unused-vars
  const navigate = useNavigate();
  const [imageError, setImageError] = useState(false);

  if (!user) return null;

  // Handle different data structures (Dashboard uses nested objects)
  const profileData = user.viewerProfile || user.userProfile || user;
  const username = profileData?.username || user.username;
  const displayName = getDisplayName(profileData) || username;
  const avatarPath = profileData?.images?.[0] || profileData?.profileImage || user.profileImage;
  const avatar = avatarPath ? getImageUrl(avatarPath) : null;
  const gender = profileData?.gender || user.gender;
  
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

  // Format height for display (e.g., "5' 6\"")
  const getDisplayHeight = () => {
    if (profileData?.height) return profileData.height;
    if (profileData?.heightInches) {
      const feet = Math.floor(profileData.heightInches / 12);
      const inches = profileData.heightInches % 12;
      return `${feet}' ${inches}"`;
    }
    return null;
  };

  // Format DOB for display (MM/YYYY format)
  const getDisplayDOB = () => {
    // Try birthMonth and birthYear first
    if (profileData?.birthMonth && profileData?.birthYear) {
      const month = String(profileData.birthMonth).padStart(2, '0');
      return `${month}/${profileData.birthYear}`;
    }
    // Try dateOfBirth field
    if (profileData?.dateOfBirth) {
      try {
        const date = new Date(profileData.dateOfBirth);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${month}/${date.getFullYear()}`;
      } catch {
        return null;
      }
    }
    return null;
  };

  const displayHeight = getDisplayHeight();
  const displayDOB = getDisplayDOB();

  // Get current occupation from workExperience array
  const getDisplayOccupation = () => {
    // First check for direct occupation field
    if (profileData?.occupation) return profileData.occupation;
    
    // Look for current position in workExperience array
    const workExp = profileData?.workExperience;
    if (workExp && Array.isArray(workExp) && workExp.length > 0) {
      // Find current position first
      const currentJob = workExp.find(job => job.isCurrent === true);
      if (currentJob) {
        // Use description field (e.g., "Marketing Manager in Health Care Sector")
        return currentJob.description || currentJob.position || currentJob.title;
      }
      // Fallback to first job's description
      const firstJob = workExp[0];
      return firstJob.description || firstJob.position || firstJob.title;
    }
    return null;
  };

  const displayOccupation = getDisplayOccupation();

  const handleCardClick = () => {
    if (onClick) {
      onClick(user);
    } else {
      // Open profile in new tab
      window.open(`/profile/${username}`, '_blank');
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
        if (onRemove) bottomActions.push({ icon: ACTION_ICONS.UNBLOCK, label: 'Unhide', handler: onRemove, className: 'btn-secondary' });
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
      {/* Avatar Section - ALWAYS shown for consistent card height */}
      <div className="user-card-avatar">
        {avatar && !imageError ? (
          <img 
            src={avatar} 
            alt={displayName} 
            className="avatar-image"
            onError={() => setImageError(true)}
          />
        ) : (
          <DefaultAvatar 
            gender={gender} 
            initials={initials} 
            size="medium" 
          />
        )}
        
        {/* Age Badge - Top of avatar */}
        {profileData?.age && (
          <div className="age-badge-overlay">
            <span className="age-badge-pill">{profileData.age}yrs</span>
          </div>
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

      {/* Body Section - ALWAYS shown for consistent card height */}
      <div className="user-card-body">
        <h4 className="user-name">
          {displayName}
          {profileData?.age && <span className="user-age-badge">{profileData.age}y</span>}
        </h4>
        
        {/* Location */}
        <p className="user-location">
          📍 {profileData?.location || <span className="placeholder-text">Location not specified</span>}
        </p>
        
        {/* Education */}
        <p className="user-education">
          🎓 {profileData?.education || profileData?.educationHistory?.[0]?.degree || <span className="placeholder-text">Education not specified</span>}
        </p>
        
        {/* Occupation/Experience */}
        <p className="user-occupation">
          💼 {displayOccupation || <span className="placeholder-text">Occupation not specified</span>}
        </p>

        {/* Height & DOB Row */}
        {(displayHeight || displayDOB) && (
          <div className="user-height-dob">
            {displayHeight && <span className="height-info">📏 {displayHeight}</span>}
            {displayDOB && <span className="dob-info">🎂 {displayDOB}</span>}
          </div>
        )}
        
        {/* What I'm Looking For - from partnerPreferences */}
        <p className="user-looking-for">
          💕 {(() => {
            const prefs = profileData?.partnerPreferences;
            const lookingFor = profileData?.lookingFor;
            
            // Build condensed string from available data
            const parts = [];
            
            // Add lookingFor if available (Marriage, Life Partner, etc.)
            if (lookingFor) {
              parts.push(lookingFor);
            }
            
            if (prefs) {
              // Get religion (can be string or array)
              const religion = Array.isArray(prefs.religion) ? prefs.religion[0] : prefs.religion;
              if (religion && religion !== 'Any' && religion !== 'Any Religion') {
                parts.push(religion);
              }
              
              // Get location (can be string or array)
              const location = Array.isArray(prefs.location) ? prefs.location[0] : prefs.location;
              if (location && location !== 'Any' && location !== 'Any location') {
                parts.push(location);
              }
            }
            
            if (parts.length === 0) {
              return <span className="placeholder-text">Looking for not specified</span>;
            }
            
            const text = parts.join(' • ');
            return text.length > 40 ? text.substring(0, 40) + '...' : text;
          })()}
        </p>

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

      {/* Header Actions - Simple Kebab Menu */}
      {hasKebabMenu && (
        <div className="user-card-header-actions">
          <SimpleKebabMenu
            user={user}
            isFavorited={isFavorited}
            isShortlisted={isShortlisted}
            isBlocked={isBlocked}
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
