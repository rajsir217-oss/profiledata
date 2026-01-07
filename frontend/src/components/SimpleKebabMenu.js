import React, { useState, useRef, useEffect } from 'react';
import './SimpleKebabMenu.css';
import { ACTION_ICONS } from '../constants/icons';

/**
 * SimpleKebabMenu - Clean, simple popover menu
 * No complex positioning, just a clean overlay
 */
const SimpleKebabMenu = ({
  user,
  isFavorited,
  isShortlisted,
  isBlocked = false,  // When true, disable most actions
  onViewProfile,
  onToggleFavorite,
  onToggleShortlist,
  onMessage,
  onBlock,
  onRequestPII,
  onReport
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const buttonRef = useRef(null);

  // Close on escape
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      // Small delay to prevent immediate close
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 50);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleItemClick = (handler, actionName = 'action') => {
    console.log(`🔵 Menu item clicked: ${actionName}`, { handler: !!handler, user });
    if (handler) {
      handler(user);
      console.log(`✅ Handler executed for ${actionName}`);
    } else {
      console.warn(`⚠️ No handler for ${actionName}`);
    }
    setIsOpen(false);
  };

  return (
    <div className="simple-kebab-container" ref={containerRef}>
      <button
        ref={buttonRef}
        className="simple-kebab-button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        aria-label="More actions"
      >
        ⋮
      </button>

      {isOpen && (
        <div 
          className="simple-kebab-menu"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="menu-arrow"></div>
          
          <button onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleItemClick(onViewProfile, 'View Profile');
          }}>
            {ACTION_ICONS.VIEW_PROFILE} View Profile
          </button>
          
          {/* Favorite - disabled when blocked */}
          <button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!isBlocked) handleItemClick(onToggleFavorite, 'Toggle Favorite');
            }}
            disabled={isBlocked}
            className={isBlocked ? 'menu-item-disabled' : ''}
            title={isBlocked ? 'Remove from exclusions first' : ''}
          >
            {isFavorited ? ACTION_ICONS.UNFAVORITE : ACTION_ICONS.FAVORITE} {isFavorited ? 'Unfavorite' : 'Favorite'}
          </button>
          
          {/* Shortlist - disabled when blocked */}
          <button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!isBlocked) handleItemClick(onToggleShortlist, 'Toggle Shortlist');
            }}
            disabled={isBlocked}
            className={isBlocked ? 'menu-item-disabled' : ''}
            title={isBlocked ? 'Remove from exclusions first' : ''}
          >
            {isShortlisted ? ACTION_ICONS.REMOVE_SHORTLIST : ACTION_ICONS.SHORTLIST} {isShortlisted ? 'Remove Shortlist' : 'Add Shortlist'}
          </button>
          
          {/* Message - disabled when blocked */}
          {onMessage && (
            <button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!isBlocked) handleItemClick(onMessage, 'Message');
              }}
              disabled={isBlocked}
              className={isBlocked ? 'menu-item-disabled' : ''}
              title={isBlocked ? 'Remove from exclusions first' : ''}
            >
              {ACTION_ICONS.MESSAGE} Message
            </button>
          )}
          
          <div className="menu-divider"></div>
          
          {/* Data Request - disabled when blocked */}
          {onRequestPII && (
            <button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!isBlocked) handleItemClick(onRequestPII, 'Data Request');
              }}
              disabled={isBlocked}
              className={isBlocked ? 'menu-item-disabled' : ''}
              title={isBlocked ? 'Remove from exclusions first' : ''}
            >
              {ACTION_ICONS.REQUEST_CONTACT} Data Request
            </button>
          )}
          
          {/* Block/Unblock - always enabled, changes label when blocked */}
          {onBlock && (
            <button onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleItemClick(onBlock, isBlocked ? 'Unblock' : 'Hide');
            }}>
              {isBlocked ? ACTION_ICONS.UNBLOCK : ACTION_ICONS.BLOCK} {isBlocked ? 'Remove Exclusion' : 'Hide'}
            </button>
          )}
          
          {onReport && (
            <button onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleItemClick(onReport, 'Report');
            }}>
              {ACTION_ICONS.REPORT} Report
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default SimpleKebabMenu;
