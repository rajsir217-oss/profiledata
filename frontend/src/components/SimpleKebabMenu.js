import React, { useState, useRef, useEffect } from 'react';
import './SimpleKebabMenu.css';

/**
 * SimpleKebabMenu - Clean, simple popover menu
 * No complex positioning, just a clean overlay
 */
const SimpleKebabMenu = ({
  user,
  isFavorited,
  isShortlisted,
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
            👁️ View Profile
          </button>
          
          <button onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleItemClick(onToggleFavorite, 'Toggle Favorite');
          }}>
            {isFavorited ? '💔' : '⭐'} {isFavorited ? 'Unfavorite' : 'Favorite'}
          </button>
          
          <button onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleItemClick(onToggleShortlist, 'Toggle Shortlist');
          }}>
            {isShortlisted ? '📤' : '📋'} {isShortlisted ? 'Remove Shortlist' : 'Add Shortlist'}
          </button>
          
          {onMessage && (
            <button onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleItemClick(onMessage, 'Message');
            }}>
              💬 Message
            </button>
          )}
          
          <div className="menu-divider"></div>
          
          {onRequestPII && (
            <button onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleItemClick(onRequestPII, 'Request Contact');
            }}>
              🔒 Request Contact
            </button>
          )}
          
          {onBlock && (
            <button onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleItemClick(onBlock, 'Block');
            }}>
              🚫 Block
            </button>
          )}
          
          {onReport && (
            <button onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleItemClick(onReport, 'Report');
            }}>
              🚩 Report
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default SimpleKebabMenu;
