import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getImageUrl } from '../utils/urlHelper';
import OnlineStatusBadge from './OnlineStatusBadge';
import { getDisplayName } from '../utils/userDisplay';
import SimpleKebabMenu from './SimpleKebabMenu';
import './SearchPage.css';

/**
 * Reusable Search Result Card Component
 * Used across: SearchPage, Favorites, Shortlist, Dashboard, etc.
 * 
 * Features:
 * - Profile image carousel with navigation
 * - Online status badge
 * - User details (location, education, occupation, height)
 * - Context-aware bottom actions
 * - Kebab menu for secondary actions
 * - Responsive design
 */
const SearchResultCard = ({
  user,
  currentUsername,
  // Context-based props (NEW)
  context = 'default',
  onViewProfile,
  onToggleFavorite,
  onToggleShortlist,
  onBlock,
  onReport,
  onApprove,
  onDeny,
  // Legacy action props (kept for backward compatibility)
  onFavorite,
  onShortlist,
  onExclude,
  onMessage,
  onRemove,
  onPIIRequest,
  onRequestPII, // Support both naming conventions
  // State props
  isFavorited = false,
  isShortlisted = false,
  isExcluded = false,
  isBlocked = false,
  hasPiiAccess = false, // For contact_info
  hasImageAccess = false, // For images
  isPiiRequestPending = false,
  isImageRequestPending = false,
  piiRequestStatus = {}, // Object with status for each PII type
  piiAccess = {}, // Kebab menu PII access state
  // Legacy display flags (deprecated)
  showFavoriteButton = true,
  showShortlistButton = true,
  showExcludeButton = true,
  showMessageButton = true,
  showRemoveButton = false,
  removeButtonLabel = 'Remove',
  removeButtonIcon = '🗑️',
  viewMode = 'cards', // 'cards' or 'rows'
  // Search carousel props
  searchResults = null, // Array of search results for carousel navigation
  currentIndex = null   // Current index in search results
}) => {
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageError, setImageError] = useState(false);

  // Navigate to profile with optional search context for carousel navigation
  const navigateToProfile = () => {
    if (searchResults && currentIndex !== null) {
      // Pass search results and current index for carousel navigation
      navigate(`/profile/${user.username}`, {
        state: {
          searchResults,
          currentIndex,
          fromSearch: true
        }
      });
    } else {
      // Standard navigation without carousel
      navigate(`/profile/${user.username}`);
    }
  };

  // Calculate PII request status summary
  const getPIIStatusSummary = () => {
    const piiTypes = ['images', 'contact_info', 'linkedin_url'];
    let approved = 0;
    let pending = 0;

    piiTypes.forEach(type => {
      const status = piiRequestStatus[type];
      if (status === 'approved') approved++;
      else if (status === 'pending') pending++;
    });

    if (approved === 0 && pending === 0) {
      return { text: 'Request Access', className: '' };
    }
    
    if (approved > 0 && pending === 0) {
      return { text: `✓ ${approved} Granted`, className: 'pii-status-approved' };
    }
    
    if (pending > 0 && approved === 0) {
      return { text: `📨 ${pending} Pending`, className: 'pii-status-pending' };
    }
    
    // Mixed status
    return { 
      text: `✓ ${approved} • 📨 ${pending}`, 
      className: 'pii-status-mixed' 
    };
  };

  const piiStatus = getPIIStatusSummary();

  // Context-based bottom action configuration (matching UserCard)
  const getBottomActions = () => {
    const bottomActions = [];

    switch (context) {
      case 'my-messages':
        if (onMessage) bottomActions.push({ icon: '💬', label: 'Open Chat', handler: onMessage, className: 'btn-primary' });
        if (onRemove) bottomActions.push({ icon: '🗑️', label: 'Delete', handler: onRemove, className: 'btn-danger' });
        break;

      case 'my-favorites':
        if (onMessage) bottomActions.push({ icon: '💬', label: 'Message', handler: onMessage, className: 'btn-primary' });
        if (onRemove) bottomActions.push({ icon: '💔', label: 'Unfavorite', handler: onRemove, className: 'btn-warning' });
        break;

      case 'my-shortlists':
        if (onMessage) bottomActions.push({ icon: '💬', label: 'Message', handler: onMessage, className: 'btn-primary' });
        if (onRemove) bottomActions.push({ icon: '📤', label: 'Remove', handler: onRemove, className: 'btn-info' });
        break;

      case 'not-interested':
      case 'my-exclusions':
        if (onViewProfile) bottomActions.push({ icon: '👁️', label: 'View', handler: onViewProfile, className: 'btn-secondary' });
        if (onRemove) bottomActions.push({ icon: '✅', label: 'Unblock', handler: onRemove, className: 'btn-success' });
        break;

      case 'pii-requests':
      case 'photo-requests':
        if (onApprove) bottomActions.push({ icon: '✅', label: 'Approve', handler: onApprove, className: 'btn-success' });
        if (onDeny) bottomActions.push({ icon: '❌', label: 'Deny', handler: onDeny, className: 'btn-danger' });
        break;

      case 'search-results':
      case 'l3v3l-matches':
      case 'profile-views':
      case 'their-favorites':
      case 'their-shortlists':
      default:
        if (onMessage) bottomActions.push({ icon: '💬', label: 'Message', handler: onMessage, className: 'btn-primary' });
        if (onViewProfile) bottomActions.push({ icon: '👁️', label: 'View', handler: onViewProfile || navigateToProfile, className: 'btn-secondary' });
        break;
    }

    return bottomActions;
  };

  const bottomActions = getBottomActions();
  const hasBottomActions = bottomActions.length > 0;
  const hasKebabMenu = onToggleFavorite || onToggleShortlist || onBlock || onRequestPII || onPIIRequest || onReport;
  
  // Merge legacy handlers with new handlers for kebab menu
  const kebabHandlers = {
    onViewProfile: onViewProfile || navigateToProfile,
    onToggleFavorite: onToggleFavorite || onFavorite,
    onToggleShortlist: onToggleShortlist || onShortlist,
    onMessage: onMessage,
    onBlock: onBlock || onExclude,
    onRequestPII: onRequestPII || onPIIRequest,
    onReport: onReport
  };

  // Get initials from first and last name, fallback to username
  const getInitials = () => {
    const firstName = user?.firstName || '';
    const lastName = user?.lastName || '';
    
    if (firstName && lastName) {
      return (firstName[0] + lastName[0]).toUpperCase();
    } else if (firstName) {
      return firstName[0].toUpperCase();
    } else if (user?.username) {
      return user.username[0].toUpperCase();
    }
    return '?';
  };

  // Calculate age from birth month and year
  const calculateAge = (birthMonth, birthYear) => {
    if (!birthMonth || !birthYear) return 'N/A';
    try {
      const today = new Date();
      const currentMonth = today.getMonth() + 1; // JS months are 0-indexed
      const currentYear = today.getFullYear();
      
      let age = currentYear - parseInt(birthYear);
      
      // If current month hasn't reached birth month yet, subtract 1
      if (currentMonth < parseInt(birthMonth)) {
        age--;
      }
      
      return age;
    } catch {
      return 'N/A';
    }
  };
  
  // Get age - use provided age or calculate from birthMonth/birthYear
  const getAge = () => {
    // First try to use provided age (must be a valid number)
    if (typeof user.age === 'number' && user.age > 0) {
      return user.age;
    }
    // Try parsing age string
    if (typeof user.age === 'string' && user.age.trim()) {
      const numAge = parseInt(user.age);
      if (!isNaN(numAge) && numAge > 0) {
        return numAge;
      }
    }
    // Calculate from birthMonth and birthYear
    const calculated = calculateAge(user.birthMonth, user.birthYear);
    return calculated;
  };
  
  // Always get age for display
  const displayAge = getAge();
  
  // Only log if there's an issue with age
  if (!displayAge || displayAge === 'N/A') {
    console.log('⚠️ Age missing for user:', user.username || user.firstName, {
      providedAge: user.age,
      birthMonth: user.birthMonth,
      birthYear: user.birthYear
    });
  }

  const handlePrevImage = (e) => {
    e.stopPropagation();
    setCurrentImageIndex(prev => prev > 0 ? prev - 1 : 0);
  };

  const handleNextImage = (e) => {
    e.stopPropagation();
    const maxIndex = (user.images?.length || 1) - 1;
    setCurrentImageIndex(prev => prev < maxIndex ? prev + 1 : maxIndex);
  };

  const renderProfileImage = () => {
    // Check if user has image access (own profile always has access)
    const isOwnProfile = currentUsername === user.username;
    
    // If no access to images, show bio with "Request Pics" bubble
    if (!isOwnProfile && !hasImageAccess) {
      return (
        <div className="profile-image-container">
          <div className="search-card-bio-section">
            {/* Bio Text - Images are locked */}
            <div className="search-bio-content-full">
              {user?.bio || user?.aboutMe || user?.about || user?.description ? (
                <p className="search-bio-text-large">
                  "{user.bio || user.aboutMe || user.about || user.description}"
                </p>
              ) : (
                <p className="search-bio-text-large search-bio-placeholder">
                  "No bio available. Request access to view photos."
                </p>
              )}
            </div>
            
            {/* Request Pics Bubble - Floating on top */}
            {!isImageRequestPending ? (
              <button
                className="request-pics-bubble"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onPIIRequest) {
                    onPIIRequest(user);
                  }
                }}
                title="Request access to view photos"
              >
                🔓 Request Pics
              </button>
            ) : (
              <div className="request-pending-bubble">
                📨 Request Pics Sent
              </div>
            )}
            
            {/* Online Status Badge */}
            <div className="status-badge-absolute">
              <OnlineStatusBadge username={user.username} size="medium" />
            </div>
          </div>
        </div>
      );
    }

    // User has access - show images
    const currentImage = user.images && user.images.length > currentImageIndex 
      ? user.images[currentImageIndex] 
      : null;

    const imageSrc = currentImage && currentImage.startsWith('http') 
      ? currentImage 
      : getImageUrl(currentImage);

    // Debug: Log image status
    if (!currentImage) {
      console.log(`[SearchCard] ${user.username} - No image, should show bio:`, {
        hasImages: !!user.images,
        imageCount: user.images?.length,
        bio: user.bio?.substring(0, 30),
        aboutMe: user.aboutMe?.substring(0, 30)
      });
    }

    return (
      <div className="profile-image-container">
        {currentImage && !imageError ? (
          <img
            key={`${user.username}-${currentImageIndex}`}
            src={`${imageSrc}?t=${Date.now()}`}
            alt={`${user.firstName}'s profile`}
            className="profile-thumbnail"
            onError={(e) => {
              setImageError(true);
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
            onLoad={(e) => {
              setImageError(false);
              e.target.style.display = 'block';
              e.target.nextSibling.style.display = 'none';
            }}
            crossOrigin="anonymous"
            loading="lazy"
          />
        ) : (
          <div className="search-card-bio-section">
            {/* Bio Text Only - Header is already shown above */}
            <div className="search-bio-content-full">
              {user?.bio || user?.aboutMe || user?.about || user?.description ? (
                <p className="search-bio-text-large">
                  "{user.bio || user.aboutMe || user.about || user.description}"
                </p>
              ) : (
                <p className="search-bio-text-large search-bio-placeholder">
                  "No bio available. Click to view full profile..."
                </p>
              )}
            </div>
          </div>
        )}
        <div className="no-image-icon-overlay" style={{display: imageError || !currentImage ? 'none' : 'none'}}>
          👤
        </div>

        {/* Online Status Badge */}
        <div className="status-badge-absolute">
          <OnlineStatusBadge username={user.username} size="medium" />
        </div>

        {/* Image Navigation */}
        {user.images && user.images.length > 1 && (
          <>
            <button
              className="image-nav-btn prev-btn"
              onClick={handlePrevImage}
              disabled={currentImageIndex === 0}
              style={{ padding: 0, minWidth: '28px', maxWidth: '28px', width: '28px', height: '28px' }}
            >
              {'<'}
            </button>
            <button
              className="image-nav-btn next-btn"
              onClick={handleNextImage}
              disabled={currentImageIndex === user.images.length - 1}
              style={{ padding: 0, minWidth: '28px', maxWidth: '28px', width: '28px', height: '28px' }}
            >
              {'>'}
            </button>
            <div className="image-counter">
              {currentImageIndex + 1}/{user.images.length}
            </div>
          </>
        )}
      </div>
    );
  };

  // Render compact row view
  if (viewMode === 'rows') {
    return (
      <div className="result-row-compact">
        <div className="row-compact-content">
          {/* Top section with image and info */}
          <div className="row-compact-top">
            {/* Column 1: Image */}
            <div className="row-image-compact">
              {renderProfileImage()}
            </div>

            {/* Column 2: Basic Info */}
            <div className="row-info-column-1">
              <h6 className="row-name">
                {getDisplayName(user)}
                {displayAge && displayAge !== 'N/A' && <span className="age-badge-inline">{displayAge}y</span>}
              </h6>
              <p className="row-detail"><strong>📍</strong> {user.location}</p>
              <p className="row-detail"><strong>📏</strong> {user.height}</p>
              <div className="row-badges">
                {user.religion && <span className="badge bg-info badge-sm">{user.religion}</span>}
                {user.eatingPreference && <span className="badge bg-success badge-sm">{user.eatingPreference}</span>}
              </div>
            </div>

            {/* Column 3: Education & Work */}
            <div className="row-info-column-2">
              <p className="row-detail"><strong>🎓</strong> {user.education}</p>
              <p className="row-detail"><strong>💼</strong> {user.occupation}</p>
              {user.bodyType && <span className="badge bg-warning badge-sm">{user.bodyType}</span>}
            </div>

            {/* Column 4: Contact (PII) */}
            <div className="row-info-column-3">
              <p className="row-detail-pii">
                {hasPiiAccess ? (
                  <button
                    className="pii-icon-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(user.contactEmail);
                      alert('Email copied to clipboard!');
                    }}
                    title={user.contactEmail}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '20px',
                      padding: '4px'
                    }}
                  >
                    📧
                  </button>
                ) : (
                  <>
                    <span 
                      className="pii-locked-icon" 
                      style={{opacity: 0.3, filter: 'grayscale(100%)', fontSize: '20px'}}
                      title="Email locked - Request access"
                    >
                      📧
                    </span>
                    {onPIIRequest && (
                      <button
                        className={`btn btn-xs btn-link pii-btn-xs ${piiStatus.className}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onPIIRequest(user);
                        }}
                        title={piiStatus.text}
                      >
                        🔒
                      </button>
                    )}
                  </>
                )}
              </p>
              <p className="row-detail-pii">
                {hasPiiAccess ? (
                  <button
                    className="pii-icon-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(user.contactNumber);
                      alert('Phone number copied to clipboard!');
                    }}
                    title={user.contactNumber}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '20px',
                      padding: '4px'
                    }}
                  >
                    📱
                  </button>
                ) : (
                  <span 
                    className="pii-locked-icon" 
                    style={{opacity: 0.3, filter: 'grayscale(100%)', fontSize: '20px'}}
                    title="Phone locked - Request access"
                  >
                    📱
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Bottom section with action buttons */}
          <div className="row-compact-bottom">
            <div className="row-actions-compact">
            {showFavoriteButton && onFavorite && (
              <button
                className={`btn btn-sm ${isFavorited ? 'btn-warning' : 'btn-outline-warning'} action-btn`}
                onClick={(e) => {
                  e.stopPropagation();
                  onFavorite(user);
                }}
                title={isFavorited ? 'Remove from Favorites' : 'Add to Favorites'}
              >
                {isFavorited ? '⭐' : '☆'}
              </button>
            )}
            
            {showShortlistButton && onShortlist && (
              <button
                className={`btn btn-sm ${isShortlisted ? 'btn-info' : 'btn-outline-info'} action-btn`}
                onClick={(e) => {
                  e.stopPropagation();
                  onShortlist(user);
                }}
                title={isShortlisted ? 'Remove from Shortlist' : 'Add to Shortlist'}
              >
                {isShortlisted ? '✓📋' : '📋'}
              </button>
            )}
            
            {showMessageButton && onMessage && (
              <button
                className="btn btn-sm btn-outline-primary action-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onMessage(user);
                }}
                title="Send Message"
              >
                💬
              </button>
            )}
            
            {showExcludeButton && onExclude && (
              <button
                className={`btn btn-sm ${isExcluded ? 'btn-danger' : 'btn-outline-danger'} action-btn`}
                onClick={(e) => {
                  e.stopPropagation();
                  onExclude(user);
                }}
                title={isExcluded ? 'Remove from Not Interested' : 'Mark as Not Interested'}
              >
                {isExcluded ? '🚫' : '❌'}
              </button>
            )}
            
            {showRemoveButton && onRemove && (
              <button
                className="btn btn-sm btn-outline-danger action-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(user);
                }}
                title={removeButtonLabel}
              >
                {removeButtonIcon}
              </button>
            )}
            
            <button
              className="btn btn-sm btn-outline-primary action-btn"
              onClick={navigateToProfile}
              title="View Profile"
            >
              👁️
            </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render card view (default)
  return (
    <div className="result-card">
      <div className="card">
        {/* Card Title Section with Purple Gradient - Clickable */}
        <div 
          className="card-title-section"
          onClick={navigateToProfile}
          style={{ cursor: 'pointer' }}
          title="View Full Profile"
        >
          <h6 className="card-title">
            {getDisplayName(user)}
          </h6>
          <div className="card-title-badges">
            {user.matchScore && Number(user.matchScore) > 0 && (
              <span className="l3v3l-match-badge" title={user.compatibilityLevel || `${user.matchScore}% compatibility`}>
                🦋 {Math.round(Number(user.matchScore) * 10) / 10}%
              </span>
            )}
            {displayAge && displayAge !== 'N/A' && <span className="age-badge">{displayAge}yrs</span>}
            
            {/* Simple Kebab Menu */}
            {hasKebabMenu && (
              <SimpleKebabMenu
                user={user}
                isFavorited={isFavorited}
                isShortlisted={isShortlisted}
                onViewProfile={kebabHandlers.onViewProfile}
                onToggleFavorite={kebabHandlers.onToggleFavorite}
                onToggleShortlist={kebabHandlers.onToggleShortlist}
                onMessage={kebabHandlers.onMessage}
                onBlock={kebabHandlers.onBlock}
                onRequestPII={kebabHandlers.onRequestPII}
                onReport={kebabHandlers.onReport}
              />
            )}
          </div>
        </div>

        <div className="card-body">
          <div className="d-flex gap-3 mb-3">
            {/* Hide image area if no access, show if access granted */}
            {(hasImageAccess || currentUsername === user.username) && (
              <div className="profile-image-left">
                {renderProfileImage()}
              </div>
            )}

            <div className="user-details-right flex-grow-1">
              {/* Show bio + details + request button when NO access */}
              {!hasImageAccess && currentUsername !== user.username ? (
                <>
                  {/* Bio Text Section */}
                  <div className="bio-details-section">
                    <div className="bio-text-main">
                      {user?.bio || user?.aboutMe || user?.about || user?.description ? (
                        <p className="bio-quote-main">
                          "{user.bio || user.aboutMe || user.about || user.description}"
                        </p>
                      ) : (
                        <p className="bio-quote-main bio-placeholder-main">
                          "No bio available. Request access to view photos and more details."
                        </p>
                      )}
                    </div>
                  </div>

                  {/* User Details - ALWAYS show */}
                  <div className="user-details">
                    <p className="detail-line"><strong>📍</strong> {user.location}</p>
                    <p className="detail-line"><strong>💼</strong> {user.occupation || 'Not specified'}</p>
                    <p className="detail-line"><strong>🎓</strong> {user.education || 'Not specified'}</p>

                    {/* Simplified badges - max 2 priority tags */}
                    <div className="user-badges-compact">
                      {user.religion && <span className="badge badge-subtle">{user.religion}</span>}
                      {user.eatingPreference && <span className="badge badge-subtle">{user.eatingPreference}</span>}
                    </div>
                  </div>
                  
                  {/* Request Pics Button - At bottom */}
                  <div className="bio-action-section">
                    {!isImageRequestPending ? (
                      <button
                        className="request-pics-btn-main"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onPIIRequest) {
                            onPIIRequest(user);
                          }
                        }}
                        title="Request access to view photos"
                      >
                        Request Pics
                      </button>
                    ) : (
                      <div className="request-pending-btn-main">
                        Request Pics Sent
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="user-details">
                  <p className="detail-line"><strong>📍</strong> {user.location}</p>
                  <p className="detail-line"><strong>💼</strong> {user.occupation || 'Not specified'}</p>
                  <p className="detail-line"><strong>🎓</strong> {user.education || 'Not specified'}</p>

                  {/* Simplified badges - max 2 priority tags */}
                  <div className="user-badges-compact">
                    {user.religion && <span className="badge badge-subtle">{user.religion}</span>}
                    {user.eatingPreference && <span className="badge badge-subtle">{user.eatingPreference}</span>}
                  </div>

                  {/* PII Status - Show only if granted */}
                  {hasPiiAccess && (
                    <div className="pii-granted-compact">
                      <span className="pii-status-badge">✓ Contact Info Granted</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Actions Section - Context-aware */}
          {hasBottomActions && (
            <div className="search-card-bottom-actions">
              {bottomActions.map((action, index) => (
                <button
                  key={index}
                  className={`bottom-action-btn ${action.className || ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (action.handler) {
                      action.handler(user);
                    }
                  }}
                  title={action.label}
                >
                  <span className="btn-icon">{action.icon}</span>
                  <span className="btn-label">{action.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchResultCard;
