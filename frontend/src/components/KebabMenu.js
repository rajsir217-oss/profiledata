import React, { useState, useEffect, useRef } from 'react';
import './KebabMenu.css';

/**
 * KebabMenu - Reusable dropdown menu component for user card actions
 * 
 * Features:
 * - Context-aware menu items
 * - Theme-aware styling
 * - Mobile-responsive
 * - Click-outside to close
 * - ESC key to close
 * - Conditional item visibility
 * - Section grouping
 * 
 * @param {Object} props
 * @param {Object} props.user - User object
 * @param {string} props.context - Page context (e.g., 'my-favorites', 'search-results')
 * @param {boolean} props.isFavorited - Whether user is in favorites
 * @param {boolean} props.isShortlisted - Whether user is in shortlist
 * @param {boolean} props.isBlocked - Whether user is blocked
 * @param {Object} props.piiAccess - PII access status { email, phone, photos, contact }
 * @param {Function} props.onViewProfile - Handler for viewing profile
 * @param {Function} props.onToggleFavorite - Handler for favorite toggle
 * @param {Function} props.onToggleShortlist - Handler for shortlist toggle
 * @param {Function} props.onMessage - Handler for messaging
 * @param {Function} props.onBlock - Handler for blocking
 * @param {Function} props.onRequestPII - Handler for PII requests
 * @param {Function} props.onReport - Handler for reporting user
 */
const KebabMenu = ({
  user,
  context = 'default',
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
  onReport
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Close menu on ESC key
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen]);

  const handleToggle = (e) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const handleMenuItemClick = (handler) => (e) => {
    e.stopPropagation();
    if (handler) {
      handler(user);
    }
    setIsOpen(false);
  };

  // Check what PII access is available
  const hasContactAccess = piiAccess?.contact || false;
  const hasEmailAccess = piiAccess?.email || false;
  const hasPhoneAccess = piiAccess?.phone || false;
  const hasPhotoAccess = piiAccess?.photos || false;

  // Determine which menu items to show based on context
  const showMessageInMenu = context === 'my-messages' ? false : true;
  const showBlockInMenu = isBlocked ? false : true;

  return (
    <div className="kebab-menu-container">
      <button
        ref={buttonRef}
        className={`kebab-button ${isOpen ? 'active' : ''}`}
        onClick={handleToggle}
        aria-label="More actions"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <span className="kebab-icon">⋮</span>
      </button>

      {isOpen && (
        <div ref={menuRef} className="kebab-menu-dropdown">
          {/* Profile Section */}
          <div className="menu-section">
            <div className="menu-section-title">Profile</div>
            <button
              className="menu-item"
              onClick={handleMenuItemClick(onViewProfile)}
            >
              <span className="menu-icon">👁️</span>
              <span className="menu-label">View Full Profile</span>
            </button>
          </div>

          <div className="menu-divider"></div>

          {/* Lists Section */}
          <div className="menu-section">
            <div className="menu-section-title">Lists</div>
            <button
              className="menu-item"
              onClick={handleMenuItemClick(onToggleFavorite)}
            >
              <span className="menu-icon">{isFavorited ? '❌' : '⭐'}</span>
              <span className="menu-label">
                {isFavorited ? 'Remove from Favorites' : 'Add to Favorites'}
              </span>
            </button>
            <button
              className="menu-item"
              onClick={handleMenuItemClick(onToggleShortlist)}
            >
              <span className="menu-icon">{isShortlisted ? '📤' : '📋'}</span>
              <span className="menu-label">
                {isShortlisted ? 'Remove from Shortlist' : 'Add to Shortlist'}
              </span>
            </button>
          </div>

          {/* Access Section - Only show if any access not granted */}
          {(!hasContactAccess || !hasEmailAccess || !hasPhoneAccess || !hasPhotoAccess) && (
            <>
              <div className="menu-divider"></div>
              <div className="menu-section">
                <div className="menu-section-title">Request Access</div>
                
                {!hasContactAccess && (
                  <button
                    className="menu-item"
                    onClick={handleMenuItemClick(() => onRequestPII && onRequestPII(user, 'contact'))}
                  >
                    <span className="menu-icon">🔒</span>
                    <span className="menu-label">Request Contact Info</span>
                  </button>
                )}
                
                {!hasEmailAccess && (
                  <button
                    className="menu-item"
                    onClick={handleMenuItemClick(() => onRequestPII && onRequestPII(user, 'email'))}
                  >
                    <span className="menu-icon">📧</span>
                    <span className="menu-label">Request Email</span>
                  </button>
                )}
                
                {!hasPhoneAccess && (
                  <button
                    className="menu-item"
                    onClick={handleMenuItemClick(() => onRequestPII && onRequestPII(user, 'phone'))}
                  >
                    <span className="menu-icon">📱</span>
                    <span className="menu-label">Request Phone Number</span>
                  </button>
                )}
                
                {!hasPhotoAccess && (
                  <button
                    className="menu-item"
                    onClick={handleMenuItemClick(() => onRequestPII && onRequestPII(user, 'photos'))}
                  >
                    <span className="menu-icon">📷</span>
                    <span className="menu-label">Request Photo Access</span>
                  </button>
                )}
              </div>
            </>
          )}

          <div className="menu-divider"></div>

          {/* Actions Section */}
          <div className="menu-section">
            <div className="menu-section-title">Actions</div>
            
            {showMessageInMenu && onMessage && (
              <button
                className="menu-item"
                onClick={handleMenuItemClick(onMessage)}
              >
                <span className="menu-icon">💬</span>
                <span className="menu-label">Send Message</span>
              </button>
            )}
            
            {showBlockInMenu && onBlock && (
              <button
                className="menu-item"
                onClick={handleMenuItemClick(onBlock)}
              >
                <span className="menu-icon">🚫</span>
                <span className="menu-label">Block User</span>
              </button>
            )}
            
            {onReport && (
              <button
                className="menu-item danger"
                onClick={handleMenuItemClick(onReport)}
              >
                <span className="menu-icon">🚩</span>
                <span className="menu-label">Report User</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default KebabMenu;
