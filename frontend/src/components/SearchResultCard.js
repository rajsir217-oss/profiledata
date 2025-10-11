import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import OnlineStatusBadge from './OnlineStatusBadge';
import { getDisplayName } from '../utils/userDisplay';
import './SearchPage.css';

/**
 * Reusable Search Result Card Component
 * Used across: SearchPage, Favorites, Shortlist, Dashboard, etc.
 * 
 * Features:
 * - Profile image carousel with navigation
 * - Online status badge
 * - User details (location, education, occupation, height)
 * - PII request button with status
 * - Customizable action buttons
 * - Responsive design
 */
const SearchResultCard = ({
  user,
  currentUsername,
  onFavorite,
  onShortlist,
  onExclude,
  onMessage,
  onRemove,
  onPIIRequest,
  isFavorited = false,
  isShortlisted = false,
  isExcluded = false,
  hasPiiAccess = false, // For contact_info
  hasImageAccess = false, // For images
  isPiiRequestPending = false,
  isImageRequestPending = false,
  showFavoriteButton = true,
  showShortlistButton = true,
  showExcludeButton = true,
  showMessageButton = true,
  showRemoveButton = false,
  removeButtonLabel = 'Remove',
  removeButtonIcon = '🗑️'
}) => {
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageError, setImageError] = useState(false);

  // Calculate age from DOB
  const calculateAge = (dob) => {
    if (!dob) return 'N/A';
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

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
    
    // If no access to images, show locked version
    if (!isOwnProfile && !hasImageAccess) {
      return (
        <div className="profile-image-container">
          <div className="profile-thumbnail-placeholder">
            <span className="no-image-icon">🔒</span>
          </div>
          <div className="image-access-overlay">
            <p className="text-muted small">Images Locked</p>
            {onPIIRequest && (
              <button
                className="btn btn-sm btn-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  onPIIRequest(user);
                }}
                disabled={isImageRequestPending}
              >
                {isImageRequestPending ? (
                  <span className="badge bg-warning text-dark">📨 Request Sent</span>
                ) : 'Request Access'}
              </button>
            )}
          </div>
          {/* Online Status Badge */}
          <div className="status-badge-absolute">
            <OnlineStatusBadge username={user.username} size="medium" />
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
      : `http://localhost:8000${currentImage}`;

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
          <div className="profile-thumbnail-placeholder">
            <span className="no-image-icon">👤</span>
          </div>
        )}
        <div className="no-image-icon-overlay" style={{display: imageError || !currentImage ? 'flex' : 'none'}}>
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
            >
              ‹
            </button>
            <button
              className="image-nav-btn next-btn"
              onClick={handleNextImage}
              disabled={currentImageIndex === user.images.length - 1}
            >
              ›
            </button>
            <div className="image-counter">
              {currentImageIndex + 1}/{user.images.length}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="result-card">
      <div className="card">
        {/* Card Title Section with Purple Gradient */}
        <div className="card-title-section">
          <h6 className="card-title">
            {getDisplayName(user)}
          </h6>
          <span className="age-badge">{calculateAge(user.dob)} years</span>
        </div>

        <div className="card-body">
          <div className="d-flex gap-3 mb-3">
            <div className="profile-image-left">
              {renderProfileImage()}
            </div>

            <div className="user-details-right flex-grow-1">
              <div className="user-details">
                <p><strong>📍</strong> {user.location}</p>
                <p><strong>🎓</strong> {user.education}</p>
                <p><strong>💼</strong> {user.occupation}</p>
                <p><strong>📏</strong> {user.height}</p>

                {/* PII Section */}
                <div className="pii-section">
                  <p>
                    <strong>📧</strong> Email:
                    {hasPiiAccess ? (
                      <span className="pii-data"> {user.contactEmail}</span>
                    ) : (
                      <span className="pii-masked"> [Request Access] </span>
                    )}
                    {!hasPiiAccess && onPIIRequest && (
                      <button
                        className="btn btn-sm btn-link pii-request-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPIIRequest(user);
                        }}
                        disabled={isPiiRequestPending}
                      >
                        {isPiiRequestPending ? (
                          <span className="badge bg-warning text-dark">📨 Sent</span>
                        ) : 'Request'}
                      </button>
                    )}
                  </p>
                  <p>
                    <strong>📱</strong> Phone:
                    {hasPiiAccess ? (
                      <span className="pii-data"> {user.contactNumber}</span>
                    ) : (
                      <span className="pii-masked"> [Request Access] </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="user-badges">
                {user.religion && <span className="badge bg-info">{user.religion}</span>}
                {user.eatingPreference && <span className="badge bg-success">{user.eatingPreference}</span>}
                {user.bodyType && <span className="badge bg-warning">{user.bodyType}</span>}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="card-actions mt-3">
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
                📋
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
                title={isExcluded ? 'Remove from Exclusions' : 'Exclude from Search'}
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
              className="btn btn-sm btn-outline-primary"
              onClick={() => navigate(`/profile/${user.username}`)}
            >
              View Profile
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchResultCard;
