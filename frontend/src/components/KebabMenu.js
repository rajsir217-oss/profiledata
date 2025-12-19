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
  const [menuPosition, setMenuPosition] = useState({ maxHeight: '400px', openUpward: false, top: 0, left: 0 });
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        console.log('👋 Clicking outside - closing menu');
        setIsOpen(false);
      }
    };

    // Delay adding the listener to prevent immediate closure
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }, 100); // 100ms delay

    return () => {
      clearTimeout(timeoutId);
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
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    console.log('🔵 Kebab menu clicked! isOpen:', isOpen);
    
    // Calculate position immediately when opening
    if (!isOpen && buttonRef.current) {
      console.log('📍 Calculating position...');
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const spaceBelow = viewportHeight - buttonRect.bottom;
      const spaceAbove = buttonRect.top;
      const menuMinHeight = 200;
      const menuWidth = 160;
      
      const shouldOpenUpward = spaceBelow < menuMinHeight && spaceAbove > spaceBelow;
      
      let maxHeight;
      if (shouldOpenUpward) {
        maxHeight = Math.min(400, spaceAbove - 20);
      } else {
        maxHeight = Math.min(400, spaceBelow - 20);
      }
      
      let top, left;
      if (shouldOpenUpward) {
        top = buttonRect.top - maxHeight - 8;
      } else {
        top = buttonRect.bottom + 8;
      }
      
      left = buttonRect.right - menuWidth;
      if (left < 10) left = 10;
      if (left + menuWidth > viewportWidth - 10) {
        left = viewportWidth - menuWidth - 10;
      }
      
      const newPosition = {
        maxHeight: `${maxHeight}px`,
        openUpward: shouldOpenUpward,
        top: `${top}px`,
        left: `${left}px`
      };
      console.log('📐 Menu position:', newPosition);
      setMenuPosition(newPosition);
    }
    
    console.log('🔄 Setting isOpen to:', !isOpen);
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

  console.log('🔴 KebabMenu rendering. isOpen:', isOpen, 'menuPosition:', menuPosition);

  return (
    <div 
      className="kebab-menu-container"
      onClick={(e) => {
        e.stopPropagation();
        console.log('🟡 Container clicked - preventing propagation');
      }}
    >
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
        <div 
          ref={menuRef} 
          className={`kebab-menu-dropdown ${menuPosition.openUpward ? 'open-upward' : ''}`}
          style={{ 
            maxHeight: menuPosition.maxHeight,
            top: menuPosition.top,
            left: menuPosition.left,
            display: 'block'
          }}
          onClick={() => console.log('🟢 Menu clicked!')}
        >
          {/* Profile Section */}
          <div className="menu-section">
            <div className="menu-section-title">Profile</div>
            <button
              className="menu-item"
              onClick={handleMenuItemClick(onViewProfile)}
            >
              <span className="menu-icon">👁️</span>
              <span className="menu-label">View Profile</span>
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
                {isFavorited ? 'Unfavorite' : 'Favorite'}
              </span>
            </button>
            <button
              className="menu-item"
              onClick={handleMenuItemClick(onToggleShortlist)}
            >
              <span className="menu-icon">{isShortlisted ? '📤' : '📋'}</span>
              <span className="menu-label">
                {isShortlisted ? 'Remove Shortlist' : 'Add Shortlist'}
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
                    <span className="menu-label">Contact Info</span>
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
                    <span className="menu-label">Phone Number</span>
                  </button>
                )}
                
                {!hasPhotoAccess && (
                  <button
                    className="menu-item"
                    onClick={handleMenuItemClick(() => onRequestPII && onRequestPII(user, 'photos'))}
                  >
                    <span className="menu-icon">📷</span>
                    <span className="menu-label">Photo Access</span>
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
                <span className="menu-label">Message</span>
              </button>
            )}
            
            {showBlockInMenu && onBlock && (
              <button
                className="menu-item"
                onClick={handleMenuItemClick(onBlock)}
              >
                <span className="menu-icon">🚫</span>
                <span className="menu-label">Hide</span>
              </button>
            )}
            
            {onReport && (
              <button
                className="menu-item danger"
                onClick={handleMenuItemClick(onReport)}
              >
                <span className="menu-icon">🚩</span>
                <span className="menu-label">Report</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default KebabMenu;
