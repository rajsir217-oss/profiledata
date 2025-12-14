import React, { useState, useEffect, useCallback } from 'react';
import { getAuthenticatedImageUrl } from '../utils/imageUtils';
import './ProfileImage.css';

const ProfileImage = ({ 
  image, 
  viewerUsername, 
  profileOwnerUsername,
  isFavorited,
  isShortlisted,
  onRequestAccess,
  onRenewAccess,
  onClick
}) => {
  const [imageState, setImageState] = useState(null);
  const [loading, setLoading] = useState(true);

  const calculateImageState = useCallback(() => {
    // If viewer is owner, always show clear
    if (viewerUsername === profileOwnerUsername) {
      setImageState({
        state: 'owner',
        blur: 0,
        canView: true,
        showImage: true
      });
      setLoading(false);
      return;
    }

    const { initialVisibility, hasAccess, accessDetails, hasPendingRequest } = image;

    // If no access granted yet
    if (!hasAccess) {
      // Check if request is pending
      if (hasPendingRequest) {
        // Show "Request Sent" status
        setImageState({
          state: 'request-pending',
          blur: initialVisibility?.type === 'blurred' ? 15 : 0,
          canView: false,
          showImage: initialVisibility?.type !== 'hidden',
          showPlaceholder: initialVisibility?.type === 'hidden',
          showRequestButton: false,
          icon: '📨',
          message: 'Request Sent - Awaiting Approval',
          bubbleClass: 'warning'
        });
        setLoading(false);
        return;
      }
      
      switch (initialVisibility?.type) {
        case 'clear':
          setImageState({
            state: 'public',
            blur: 0,
            canView: true,
            showImage: true,
            icon: '🌟',
            message: 'Public Photo'
          });
          break;

        case 'blurred':
          const blurLevels = { light: 8, medium: 15, heavy: 25 };
          // Check if this is an expired access (accessReason = 'no_access') vs initial blur
          const isExpiredAccess = image.accessReason === 'no_access';
          setImageState({
            state: isExpiredAccess ? 'expired-blur' : 'initial-blur',
            blur: blurLevels[initialVisibility.blurLevel || 'medium'],
            canView: false,
            showImage: true,
            showRequestButton: false, // Don't show per-image buttons - use main Request Access
            icon: isExpiredAccess ? '🔒' : '🌫️',
            message: isExpiredAccess ? 'Access expired' : 'Private photo',
            bubbleClass: isExpiredAccess ? 'expired' : 'info'
          });
          break;

        case 'hidden':
          setImageState({
            state: 'hidden',
            blur: 0,
            canView: false,
            showImage: false,
            showPlaceholder: true,
            placeholderType: initialVisibility.placeholderType || 'lock',
            showRequestButton: false, // Don't show per-image buttons - use main Request Access
            icon: '🔒',
            message: 'Private Photo'
          });
          break;

        case 'smart':
          const shouldShowClear = (
            (initialVisibility.clearForFavorites && isFavorited) ||
            (initialVisibility.clearForShortlist && isShortlisted)
          );

          if (shouldShowClear) {
            setImageState({
              state: 'smart-clear',
              blur: 0,
              canView: true,
              showImage: true,
              icon: '💝',
              message: "You're favorited!"
            });
          } else {
            setImageState({
              state: 'smart-blur',
              blur: 15,
              canView: false,
              showImage: true,
              showRequestButton: false, // Don't show per-image buttons
              icon: '💝',
              message: 'Add to favorites to view',
              bubbleClass: 'info'
            });
          }
          break;

        default:
          // Default to blurred - no per-image request buttons
          setImageState({
            state: 'default-blur',
            blur: 15,
            canView: false,
            showImage: true,
            showRequestButton: false
          });
      }

      setLoading(false);
      return;
    }

    // Access is granted - check expiry
    if (!accessDetails || !accessDetails.expiresAt) {
      setImageState({
        state: 'active',
        blur: 0,
        canView: true,
        showImage: true
      });
      setLoading(false);
      return;
    }

    const now = new Date();
    const expiry = new Date(accessDetails.expiresAt);
    const msLeft = expiry - now;
    const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
    const hoursLeft = Math.ceil(msLeft / (1000 * 60 * 60));

    if (daysLeft < 0) {
      // Expired - revert to initial state or worse
      setImageState({
        state: 'expired',
        blur: 20,
        canView: false,
        showImage: true,
        showRenewButton: true,
        icon: '🔒',
        message: 'Access Expired',
        bubbleClass: 'expired'
      });
    } else if (hoursLeft < 24) {
      setImageState({
        state: 'critical',
        blur: 0, // ✅ Keep clear, just show urgent badge
        canView: true,
        showImage: true,
        showRenewButton: true,
        icon: '🚨',
        message: `Expires in ${hoursLeft}h!`,
        bubbleClass: 'critical'
      });
    } else if (daysLeft <= 3) {
      setImageState({
        state: 'urgent',
        blur: 0, // ✅ Keep clear, just show urgent badge
        canView: true,
        showImage: true,
        showRenewButton: true,
        icon: '⏰',
        message: `Expires in ${daysLeft}d!`,
        bubbleClass: 'urgent'
      });
    } else if (daysLeft <= 6) {
      setImageState({
        state: 'warning',
        blur: 0, // ✅ Keep clear, just show warning badge
        canView: true,
        showImage: true,
        icon: '⚠️',
        message: `${daysLeft} days left`,
        bubbleClass: 'warning'
      });
    } else {
      // All good
      setImageState({
        state: 'active',
        blur: 0,
        canView: true,
        showImage: true,
        icon: '⏰',
        message: `${daysLeft}d`,
        bubbleClass: 'normal'
      });
    }

    setLoading(false);
  }, [image, viewerUsername, profileOwnerUsername, isFavorited, isShortlisted]);

  useEffect(() => {
    calculateImageState();
  }, [calculateImageState]);

  const getPlaceholderIcon = (type) => {
    const icons = {
      lock: '🔒',
      silhouette: '👤',
      frame: '🖼️'
    };
    return icons[type] || '🔒';
  };

  if (loading || !imageState) {
    return (
      <div className="profile-image-container loading">
        <div className="spinner-border"></div>
      </div>
    );
  }

  return (
    <div 
      className={`profile-image-container state-${imageState.state}`}
      onClick={imageState.canView && onClick ? () => {
        onClick(image);
      } : null}
      style={{ cursor: imageState.canView && onClick ? 'pointer' : 'default' }}
    >
      {imageState.showPlaceholder ? (
        <div className="image-placeholder">
          <span className="placeholder-icon">
            {getPlaceholderIcon(imageState.placeholderType)}
          </span>
          <p>{imageState.message || 'Private Photo'}</p>
        </div>
      ) : (
        <img
          src={getAuthenticatedImageUrl(image.imageUrl)}
          alt="Profile"
          className="profile-image"
          style={{
            filter: `blur(${imageState.blur}px)${imageState.blur > 15 ? ' grayscale(80%)' : ''}`,
            opacity: imageState.blur > 15 ? 0.7 : 1
          }}
        />
      )}

      {imageState.message && imageState.bubbleClass && (
        <div className={`expiry-bubble ${imageState.bubbleClass}`}>
          <span className="bubble-icon">{imageState.icon}</span>
          <span className="bubble-text">{imageState.message}</span>
        </div>
      )}

      {imageState.showRequestButton && onRequestAccess && (
        <button
          className="access-button request"
          onClick={(e) => {
            e.stopPropagation();
            onRequestAccess(image);
          }}
        >
          🔓 Request Access
        </button>
      )}

      {imageState.showRenewButton && onRenewAccess && (
        <button
          className="access-button renew"
          onClick={(e) => {
            e.stopPropagation();
            onRenewAccess(image);
          }}
        >
          {imageState.state === 'expired' ? '🔓 Request Renewal' : '⏰ Renew Access'}
        </button>
      )}

      {image.isProfilePic && (
        <div className="profile-pic-badge">
          ⭐ Profile Picture
        </div>
      )}
    </div>
  );
};

export default ProfileImage;
