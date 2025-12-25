import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getImageUrl } from '../utils/urlHelper';
import OnlineStatusBadge from './OnlineStatusBadge';
import DefaultAvatar from './DefaultAvatar';
import { getDisplayName } from '../utils/userDisplay';
import SimpleKebabMenu from './SimpleKebabMenu';
import './SearchPage.css';
import { ACTION_ICONS } from '../constants/icons';

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
  
  // Memoize image URL with token (must be called unconditionally - React hooks rule)
  const imageUrlWithToken = useMemo(() => {
    const hasImages = user.images && user.images.length > 0;
    const currentImage = hasImages && user.images.length > currentImageIndex 
      ? user.images[currentImageIndex] 
      : null;
    if (!currentImage) return null;
    const imageSrc = currentImage.startsWith('http') 
      ? currentImage 
      : getImageUrl(currentImage);
    const token = localStorage.getItem('token');
    return `${imageSrc}${imageSrc.includes('?') ? '&' : '?'}token=${token}`;
  }, [user.images, currentImageIndex]);

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
        if (onViewProfile) bottomActions.push({ icon: ACTION_ICONS.VIEW_PROFILE, label: 'View', handler: onViewProfile || navigateToProfile, className: 'btn-secondary' });
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

  // Extract education from educationHistory array or use legacy education field
  const getEducation = () => {
    // First check for legacy simple education field
    if (user.education) return user.education;
    
    // Extract from educationHistory array
    if (user.educationHistory && user.educationHistory.length > 0) {
      const latestEdu = user.educationHistory[0]; // Get first (usually highest) education
      if (latestEdu.degree && latestEdu.institution) {
        return `${latestEdu.degree}, ${latestEdu.institution}`;
      } else if (latestEdu.degree) {
        return latestEdu.degree;
      } else if (latestEdu.level) {
        return latestEdu.level;
      }
    }
    return null;
  };

  // Extract occupation from workExperience array or use legacy occupation field
  const getOccupation = () => {
    // First check for legacy simple occupation field
    if (user.occupation) return user.occupation;
    
    // Extract from workExperience array
    if (user.workExperience && user.workExperience.length > 0) {
      // Find current job first
      const currentJob = user.workExperience.find(w => w.isCurrent || w.status === 'current');
      const job = currentJob || user.workExperience[0];
      
      if (job.position && job.company) {
        return `${job.position} at ${job.company}`;
      } else if (job.position) {
        return job.position;
      } else if (job.company) {
        return job.company;
      } else if (job.description) {
        // Fallback to description if no position/company
        return job.description;
      }
    }
    return null;
  };

  const displayEducation = getEducation();
  const displayOccupation = getOccupation();

  // Format height for display (e.g., "5' 6\"")
  const getDisplayHeight = () => {
    if (user.height) return user.height;
    if (user.heightInches) {
      const feet = Math.floor(user.heightInches / 12);
      const inches = user.heightInches % 12;
      return `${feet}' ${inches}"`;
    }
    return null;
  };

  // Format DOB for display (MM/YYYY format)
  const getDisplayDOB = () => {
    // Try birthMonth and birthYear first
    if (user.birthMonth && user.birthYear) {
      const month = String(user.birthMonth).padStart(2, '0');
      return `${month}/${user.birthYear}`;
    }
    // Try dateOfBirth field
    if (user.dateOfBirth) {
      try {
        const date = new Date(user.dateOfBirth);
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

  // Debug: Log if education/occupation is missing
  if (!displayEducation || !displayOccupation) {
    console.log(`[SearchCard] ${user.username} - Missing data:`, {
      education: displayEducation,
      occupation: displayOccupation,
      hasEducationHistory: !!user.educationHistory,
      educationHistoryLength: user.educationHistory?.length,
      hasWorkExperience: !!user.workExperience,
      workExperienceLength: user.workExperience?.length,
      legacyEducation: user.education,
      legacyOccupation: user.occupation
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
    // Get current image to display
    const currentImage = user.images && user.images.length > currentImageIndex 
      ? user.images[currentImageIndex] 
      : null;

    const imageSrc = currentImage && currentImage.startsWith('http') 
      ? currentImage 
      : getImageUrl(currentImage);

    // Add JWT token for authenticated image access
    const token = localStorage.getItem('token');
    const imageWithToken = imageSrc ? `${imageSrc}${imageSrc.includes('?') ? '&' : '?'}token=${token}` : null;

    // Get initials for placeholder
    const getInitials = () => {
      const firstName = user.firstName || '';
      const lastName = user.lastName || '';
      if (firstName && lastName) return (firstName[0] + lastName[0]).toUpperCase();
      if (firstName) return firstName[0].toUpperCase();
      if (user.username) return user.username[0].toUpperCase();
      return '?';
    };

    // If no image available, show gender-based placeholder
    if (!currentImage) {
      return (
        <div className="profile-image-container">
          <div className="profile-thumbnail-placeholder">
            <DefaultAvatar 
              gender={user.gender} 
              initials={getInitials()} 
              size="medium" 
            />
          </div>
        </div>
      );
    }

    return (
      <div className="profile-image-container">
        <img
          key={`${user.username}-${currentImageIndex}`}
          src={imageWithToken}
          alt={`${user.firstName}'s profile`}
          className="profile-thumbnail"
          onError={(e) => {
            setImageError(true);
          }}
          onLoad={(e) => {
            setImageError(false);
          }}
          crossOrigin="anonymous"
          loading="lazy"
          style={{ display: imageError ? 'none' : 'block' }}
        />
        {imageError && (
          <div className="profile-thumbnail-placeholder">
            <span className="no-image-icon">👤</span>
          </div>
        )}

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
              <p className="row-detail"><strong>🎓</strong> {displayEducation || 'Not specified'}</p>
              <p className="row-detail"><strong>💼</strong> {displayOccupation || 'Not specified'}</p>
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

  // Render card view (default) - Vertical layout matching reference design
  const hasImages = user.images && user.images.length > 0;

  return (
    <div className="result-card">
      <div className="card">
        {/* 1. Header: Name + Badges + Kebab Menu */}
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

        {/* 2. Large Profile Image - Full Width */}
        <div 
          className="card-image-section"
          onClick={navigateToProfile}
          style={{ cursor: 'pointer' }}
        >
          {hasImages && imageUrlWithToken ? (
            <img
              src={imageUrlWithToken}
              alt={`${user.firstName}'s profile`}
              className="card-profile-image"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
          ) : null}
          <div 
            className="card-image-placeholder"
            style={{ display: hasImages && imageUrlWithToken ? 'none' : 'flex' }}
          >
            <DefaultAvatar 
              gender={user.gender} 
              initials={(() => {
                const firstName = user.firstName || '';
                const lastName = user.lastName || '';
                if (firstName && lastName) return (firstName[0] + lastName[0]).toUpperCase();
                if (firstName) return firstName[0].toUpperCase();
                if (user.username) return user.username[0].toUpperCase();
                return '?';
              })()}
              size="medium" 
            />
          </div>
          
          {/* Image Navigation */}
          {hasImages && user.images.length > 1 && (
            <>
              <button
                className="card-image-nav prev"
                onClick={(e) => { e.stopPropagation(); handlePrevImage(e); }}
                disabled={currentImageIndex === 0}
              >
                ‹
              </button>
              <button
                className="card-image-nav next"
                onClick={(e) => { e.stopPropagation(); handleNextImage(e); }}
                disabled={currentImageIndex === user.images.length - 1}
              >
                ›
              </button>
              <div className="card-image-counter">
                {currentImageIndex + 1}/{user.images.length}
              </div>
            </>
          )}
        </div>

        {/* 3. Card Body: Bio, Details, Actions */}
        <div className="card-body">
          {/* Bio Quote */}
          <div className="card-bio-section">
            {user?.bio || user?.aboutMe || user?.about || user?.description ? (
              <p className="card-bio-quote">
                "{(user.bio || user.aboutMe || user.about || user.description).substring(0, 120)}
                {(user.bio || user.aboutMe || user.about || user.description).length > 120 ? '...' : ''}"
              </p>
            ) : (
              <p className="card-bio-quote card-bio-placeholder">
                "Click to view full profile..."
              </p>
            )}
          </div>

          {/* User Details - Two Column Layout */}
          <div className="card-details-grid">
            <div className="card-details-left">
              <p className="card-detail-line">📍 {user.location || 'Location not specified'}</p>
              <p className="card-detail-line">💼 {displayOccupation || 'Not specified'}</p>
              <p className="card-detail-line">🎓 {displayEducation || 'Not specified'}</p>
            </div>
            <div className="card-details-right">
              {displayHeight && <p className="card-detail-line"><strong>HEIGHT:</strong> {displayHeight}</p>}
              {displayDOB && <p className="card-detail-line"><strong>DOB:</strong> {displayDOB}</p>}
            </div>
          </div>

          {/* Badges */}
          <div className="card-badges">
            {user.religion && <span className="card-badge">{user.religion}</span>}
            {user.eatingPreference && <span className="card-badge">{user.eatingPreference}</span>}
          </div>

          {/* Request Pics Button - Only show if no full image access */}
          {!hasImageAccess && currentUsername !== user.username && (
            <div className="card-action-section">
              {!isImageRequestPending ? (
                <button
                  className="card-request-pics-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onPIIRequest) onPIIRequest(user);
                  }}
                >
                  Request Pics
                </button>
              ) : (
                <div className="card-request-pending">
                  Request Pics Sent
                </div>
              )}
            </div>
          )}

          {/* Message Button - Floating */}
          <div className="card-message-btn-container">
            <button
              className="card-message-btn"
              onClick={(e) => {
                e.stopPropagation();
                if (onMessage) onMessage(user);
              }}
              title="Send Message"
            >
              💬
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchResultCard;
