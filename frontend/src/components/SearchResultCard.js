import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getImageUrl } from '../utils/urlHelper';
import OnlineStatusBadge from './OnlineStatusBadge';
import DefaultAvatar from './DefaultAvatar';
import { getDisplayName, getShortName } from '../utils/userDisplay';
import SimpleKebabMenu from './SimpleKebabMenu';
import './SearchPage2.css';
import { ACTION_ICONS } from '../constants/icons';
import { generateLookingForSummary } from '../utils/profileDescriptionGenerator';

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
  debugIndex = null, // Debug index for troubleshooting
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
  columnWidths = null, // Dynamic column widths for resizable columns
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

  // Navigate to profile - behavior depends on viewMode
  // Cards/Rows: Open in new tab (user is browsing, keep search results intact)
  // Split: Use pagination (profile shown inline)
  const navigateToProfile = () => {
    if (viewMode === 'cards' || viewMode === 'rows') {
      // Open in new tab for cards/rows layout
      window.open(`/profile/${user.username}`, '_blank');
    } else if (searchResults && currentIndex !== null) {
      // Split layout: Pass search results for carousel navigation
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

  // eslint-disable-next-line no-unused-vars
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
        if (onViewProfile) bottomActions.push({ icon: ACTION_ICONS.VIEW_PROFILE, label: 'View', handler: onViewProfile || navigateToProfile, className: 'btn-secondary' });
        break;
    }

    return bottomActions;
  };

  const bottomActions = getBottomActions();
  // eslint-disable-next-line no-unused-vars
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

  // eslint-disable-next-line no-unused-vars
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

  // Render Excel-like table row view
  if (viewMode === 'rows') {
    // Get L3V3L match score
    const matchScore = user.matchScore || user.l3v3lScore || user.compatibilityScore;
    
    // Build gridTemplateColumns - use dynamic widths if provided, otherwise defaults
    const gridCols = columnWidths 
      ? `${columnWidths.index}px ${columnWidths.photo}px ${columnWidths.name}px ${columnWidths.score}px ${columnWidths.age}px ${columnWidths.height}px ${columnWidths.location}px ${columnWidths.education}px ${columnWidths.occupation}px 60px ${columnWidths.actions}px`
      : '40px 32px minmax(100px, 1fr) 50px 55px 70px minmax(80px, 1fr) minmax(80px, 1fr) 65px 60px 90px';
    
    return (
      <div 
        className="excel-row"
        onClick={navigateToProfile}
        style={{
          display: 'grid',
          gridTemplateColumns: gridCols,
          alignItems: 'center',
          gap: '0',
          padding: '6px 12px',
          background: 'var(--surface-color)',
          borderBottom: '1px solid var(--border-color)',
          fontSize: '12px',
          cursor: 'pointer',
          transition: 'background 0.15s ease'
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover-color, rgba(139, 92, 246, 0.1))'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'var(--surface-color)'}
      >
        {/* Col 1: Index */}
        <span style={{ color: 'var(--text-muted)', fontWeight: 500, borderRight: '1px solid var(--border-color)', paddingRight: '8px', height: '100%', display: 'flex', alignItems: 'center' }}>
          {debugIndex ? `#${debugIndex}` : ''}
        </span>
        
        {/* Col 2: Avatar (tiny) - always show DefaultAvatar as base */}
        <div style={{ borderRight: '1px solid var(--border-color)', paddingRight: '8px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
          <DefaultAvatar gender={user.gender} initials={getShortName(user)} size="small" />
          {user.images && user.images.length > 0 && imageUrlWithToken && (
            <img 
              src={imageUrlWithToken} 
              alt="" 
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
              onError={(e) => e.target.style.display = 'none'}
            />
          )}
          </div>
        </div>
        
        {/* Col 3: Name */}
        <span style={{ fontWeight: 600, color: 'var(--text-color)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderRight: '1px solid var(--border-color)', paddingRight: '8px', height: '100%', display: 'flex', alignItems: 'center' }}>
          {getDisplayName(user)}
        </span>
        
        {/* Col 4: L3V3L Score */}
        <span style={{ textAlign: 'center', borderRight: '1px solid var(--border-color)', paddingRight: '8px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {matchScore ? (
            <span style={{ 
              fontSize: '10px', 
              padding: '2px 6px', 
              background: matchScore >= 70 ? 'var(--success-color)' : matchScore >= 50 ? 'var(--warning-color)' : 'var(--text-muted)',
              color: 'white',
              borderRadius: '10px',
              fontWeight: 600
            }}>
              {Math.round(matchScore)}%
            </span>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>-</span>
          )}
        </span>
        
        {/* Col 5: Age */}
        <span style={{ color: 'var(--text-secondary)', textAlign: 'center', borderRight: '1px solid var(--border-color)', paddingRight: '8px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {displayAge && displayAge !== 'N/A' ? `${displayAge}y` : '-'}
        </span>
        
        {/* Col 6: Height */}
        <span style={{ color: 'var(--text-secondary)', textAlign: 'center', borderRight: '1px solid var(--border-color)', paddingRight: '8px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {displayHeight || '-'}
        </span>
        
        {/* Col 7: Location */}
        <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderRight: '1px solid var(--border-color)', paddingRight: '8px', height: '100%', display: 'flex', alignItems: 'center' }}>
          {user.location || '-'}
        </span>
        
        {/* Col 8: Education */}
        <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderRight: '1px solid var(--border-color)', paddingRight: '8px', height: '100%', display: 'flex', alignItems: 'center' }} title={displayEducation}>
          {displayEducation || '-'}
        </span>
        
        {/* Col 9: Occupation */}
        <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderRight: '1px solid var(--border-color)', paddingRight: '8px', height: '100%', display: 'flex', alignItems: 'center' }} title={displayOccupation}>
          {displayOccupation || '-'}
        </span>
        
        {/* Col 10: Tags */}
        <span style={{ display: 'flex', gap: '2px', flexWrap: 'nowrap', overflow: 'hidden', borderRight: '1px solid var(--border-color)', paddingRight: '8px', height: '100%', alignItems: 'center' }}>
          {user.religion && <span style={{ fontSize: '10px', padding: '1px 4px', background: 'var(--primary-color)', color: 'white', borderRadius: '3px', whiteSpace: 'nowrap' }}>{user.religion}</span>}
        </span>
        
        {/* Col 10: Actions */}
        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
          {showFavoriteButton && onFavorite && (
            <button
              onClick={(e) => { e.stopPropagation(); onFavorite(user); }}
              className="excel-action-btn"
              style={{ 
                width: '26px', 
                height: '26px', 
                borderRadius: '50%', 
                border: isFavorited ? '2px solid #ff9800' : '2px solid var(--border-color)', 
                background: isFavorited ? 'linear-gradient(135deg, #ffc107 0%, #ff9800 100%)' : 'var(--card-background)', 
                cursor: 'pointer', 
                fontSize: '14px', 
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isFavorited ? 'white' : 'var(--text-color)',
                transition: 'all 0.2s ease'
              }}
              title={isFavorited ? 'Remove from Favorites' : 'Add to Favorites'}
            >
              {isFavorited ? '⭐' : '☆'}
            </button>
          )}
          {showShortlistButton && onShortlist && (
            <button
              onClick={(e) => { e.stopPropagation(); onShortlist(user); }}
              className="excel-action-btn"
              style={{ 
                width: '26px', 
                height: '26px', 
                borderRadius: '50%', 
                border: isShortlisted ? '2px solid #138496' : '2px solid var(--border-color)', 
                background: isShortlisted ? 'linear-gradient(135deg, #17a2b8 0%, #138496 100%)' : 'var(--card-background)', 
                cursor: 'pointer', 
                fontSize: '12px', 
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isShortlisted ? 'white' : 'var(--text-color)',
                transition: 'all 0.2s ease'
              }}
              title={isShortlisted ? 'Remove from Shortlist' : 'Add to Shortlist'}
            >
              {isShortlisted ? '📋' : '📄'}
            </button>
          )}
          {showExcludeButton && onExclude && (
            <button
              onClick={(e) => { e.stopPropagation(); onExclude(user); }}
              className="excel-action-btn"
              style={{ 
                width: '26px', 
                height: '26px', 
                borderRadius: '50%', 
                border: isExcluded ? '2px solid #c82333' : '2px solid var(--border-color)', 
                background: isExcluded ? 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)' : 'var(--card-background)', 
                cursor: 'pointer', 
                fontSize: '12px', 
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isExcluded ? 'white' : 'var(--text-color)',
                transition: 'all 0.2s ease'
              }}
              title={isExcluded ? 'Remove from Excluded' : 'Exclude'}
            >
              {isExcluded ? '🚫' : '⊘'}
            </button>
          )}
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
            {debugIndex && <span style={{ color: 'var(--primary-color)', fontWeight: 700, marginRight: '6px' }}>#{debugIndex}</span>}
            {getShortName(user)}
          </h6>
          <div className="card-title-badges">
            {Number(user.matchScore) > 0 && (
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
              loading="lazy"
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

          {/* Quick Stats Pills Row - Height, DOB, Religion */}
          <div className="card-stats-pills">
            {displayHeight && <span className="card-stat-pill">{displayHeight}</span>}
            {displayDOB && <span className="card-stat-pill">{displayDOB}</span>}
            {user.religion && <span className="card-stat-pill">{user.religion}</span>}
          </div>

          {/* User Details - Single Column with Icons */}
          <div className="card-details-list">
            <p className="card-detail-line">📍 {user.location || 'Location not specified'}</p>
            <p className="card-detail-line">💼 {displayOccupation || 'Not specified'}</p>
            <p className="card-detail-line">🎓 {displayEducation || 'Not specified'}</p>
          </div>

          {/* Looking For Summary */}
          {(() => {
            const lookingForSummary = generateLookingForSummary(user);
            return lookingForSummary ? (
              <p className="card-looking-for">
                <span className="looking-for-label">LOOKING FOR:</span> {lookingForSummary}
              </p>
            ) : null;
          })()}

          {/* Action Buttons Row - Request Pics, Favorite & Message */}
          <div className="card-action-buttons-row">
            {/* Request Pics Button - Only show if no full image access */}
            {!hasImageAccess && currentUsername !== user.username && (
              !isImageRequestPending ? (
                <button
                  className="card-action-icon-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onPIIRequest) onPIIRequest(user);
                  }}
                  title="Request Photos"
                >
                  📷
                </button>
              ) : (
                <button
                  className="card-action-icon-btn pending"
                  disabled
                  title="Photo Request Sent"
                >
                  ✓
                </button>
              )
            )}

            {/* Favorite Button */}
            {currentUsername !== user.username && (onToggleFavorite || onFavorite) && (
              <button
                className={`card-action-icon-btn ${isFavorited ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onToggleFavorite) onToggleFavorite(user);
                  else if (onFavorite) onFavorite(user);
                }}
                title={isFavorited ? 'Remove from Favorites' : 'Add to Favorites'}
              >
                {isFavorited ? '⭐' : '☆'}
              </button>
            )}

            {/* Message Button */}
            <button
              className="card-action-icon-btn"
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
