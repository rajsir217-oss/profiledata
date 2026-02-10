import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import './SimpleKebabMenu.css';
import { ACTION_ICONS } from '../constants/icons';

/**
 * SimpleKebabMenu - Clean, simple popover menu
 * Uses React Portal to render dropdown into document.body,
 * escaping all parent stacking contexts and overflow clipping.
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
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  const calcPosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const menuWidth = 180;
    let top = rect.bottom + 6;
    let left = rect.right - menuWidth;
    if (left < 8) left = 8;
    if (top + 320 > window.innerHeight) {
      top = Math.max(8, rect.top - 320);
    }
    setPos({ top, left });
  }, []);

  // Recalculate position, close on scroll/resize
  useEffect(() => {
    if (!isOpen) return;
    calcPosition();

    const close = () => setIsOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [isOpen, calcPosition]);

  // Close on escape
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e) => { if (e.key === 'Escape') setIsOpen(false); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen]);

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (buttonRef.current && buttonRef.current.contains(e.target)) return;
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      setIsOpen(false);
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleItemClick = (handler, actionName = 'action') => {
    if (handler) handler(user);
    setIsOpen(false);
  };

  const menuDropdown = isOpen ? ReactDOM.createPortal(
    <div
      ref={menuRef}
      className="simple-kebab-menu"
      style={{ top: `${pos.top}px`, left: `${pos.left}px` }}
      onClick={(e) => e.stopPropagation()}
    >
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
    </div>,
    document.body
  ) : null;

  return (
    <div className="simple-kebab-container">
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
      {menuDropdown}
    </div>
  );
};

export default SimpleKebabMenu;
