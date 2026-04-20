/**
 * Standardized Icon Constants for L3V3L Matches App
 * 
 * RULE: Always import icons from this file to ensure consistency across the app.
 * DO NOT use hardcoded emoji icons in components.
 * 
 * Last Updated: Dec 15, 2025
 */

// ============================================
// ACTION ICONS - Used in buttons and menus
// ============================================

export const ACTION_ICONS = {
  // Primary Actions
  MESSAGE: '💬',
  MESSAGE_ACTIVE: '📩',    // Has messages - envelope with arrow (more obvious)
  VIEW_PROFILE: '👁️',
  
  // Favorites
  FAVORITE: '⭐',           // Add to favorites
  UNFAVORITE: '💔',         // Remove from favorites
  FAVORITED_BY: '💖',       // Others who favorited you (stats)
  
  // Shortlists
  SHORTLIST: '📋',          // Add to shortlist (inactive)
  SHORTLIST_ACTIVE: '📝',   // Shortlisted (active) - notepad with pencil
  REMOVE_SHORTLIST: '📤',   // Remove from shortlist
  
  // Blocking/Exclusions
  HIDE: '🙈',               // Hide profile (exclude/not interested)
  UNHIDE: '👀',             // Unhide profile (remove exclusion)
  NOT_INTERESTED: '🫥',     // Dotted line face — "hidden/excluded" (better contrast than 🙈 on red pill)
  BLOCK: '🚫',              // Block user (legacy alias)
  UNBLOCK: '👀',            // Unblock (legacy alias)
  
  // PII/Contact Requests
  REQUEST_CONTACT: '🔒',    // Request contact info (outgoing)
  HAS_ACCESS: '🔓',         // Has PII access (unlocked)
  INCOMING_REQUESTS: '📥',  // Incoming requests from others
  PHOTO_REQUESTS: '📷',     // Photo/image requests
  
  // Approve/Deny
  APPROVE: '✓',             // Approve action (checkmark)
  DENY: '✕',                // Deny/reject action (X)
  CANCEL: '❌',             // Cancel action
  
  // Other Actions
  DELETE: '🗑️',
  REPORT: '🚩',
  EDIT: '✏️',
  REFRESH: '🔄',
  SEARCH: '🔍',
};

// ============================================
// SECTION/CATEGORY ICONS - Used in headers
// ============================================

export const SECTION_ICONS = {
  // My Activities
  MESSAGES: '💬',
  MY_FAVORITES: '⭐',
  MY_SHORTLISTS: '📋',
  MY_PHOTO_REQUESTS: '📷',  // Outgoing photo requests I made
  HIDDEN: '🙈',              // Hidden profiles (exclusions)
  
  // Others' Activities
  PROFILE_VIEWS: '👁️',
  THEIR_FAVORITES: '💖',    // Others who favorited me
  THEIR_SHORTLISTS: '📋',   // Others who shortlisted me (same as my shortlists)
  INCOMING_PHOTO_REQUESTS: '📷',  // Incoming photo requests from others
};

// ============================================
// STATS BOX ICONS - Used in dashboard stats
// ============================================

export const STATS_ICONS = {
  PROFILE_VIEWS: '👁️',
  FAVORITED_BY: '💖',
  CONVERSATIONS: '💬',
  PHOTO_REQUESTS: '📷',     // My outgoing photo requests
  CONTACT_REQUESTS: '📥',   // Incoming contact requests from others
};

// ============================================
// STATUS ICONS - Used for status indicators
// ============================================

export const STATUS_ICONS = {
  ONLINE: '🟢',
  OFFLINE: '⚫',
  AWAY: '🟡',
  PENDING: '⏳',
  APPROVED: '✅',
  DENIED: '❌',
  EXPIRED: '⏰',
};

// ============================================
// PROFILE DETAIL ICONS
// ============================================

export const PROFILE_ICONS = {
  LOCATION: '📍',
  OCCUPATION: '💼',
  EDUCATION: '🎓',
  AGE: '🎂',
  HEIGHT: '📏',
  RELIGION: '🙏',
  LANGUAGE: '🗣️',
};

// ============================================
// NOTIFICATION ICONS
// ============================================

export const NOTIFICATION_ICONS = {
  NEW_MATCH: '🎉',
  NEW_MESSAGE: '💌',
  PROFILE_VIEW: '👀',
  CONTACT_REQUEST: '📧',
  SECURITY_ALERT: '🔐',
  REMINDER: '⏰',
};

// ============================================
// HELPER FUNCTION
// ============================================

/**
 * Get icon for a specific action with fallback
 * @param {string} action - Action name (e.g., 'favorite', 'message')
 * @param {boolean} isActive - Whether the action is in active state
 * @returns {string} Emoji icon
 */
export const getActionIcon = (action, isActive = false) => {
  const actionMap = {
    'favorite': isActive ? ACTION_ICONS.UNFAVORITE : ACTION_ICONS.FAVORITE,
    'shortlist': isActive ? ACTION_ICONS.REMOVE_SHORTLIST : ACTION_ICONS.SHORTLIST,
    'block': isActive ? ACTION_ICONS.UNBLOCK : ACTION_ICONS.BLOCK,
    'message': ACTION_ICONS.MESSAGE,
    'view': ACTION_ICONS.VIEW_PROFILE,
    'request_contact': ACTION_ICONS.REQUEST_CONTACT,
    'approve': ACTION_ICONS.APPROVE,
    'deny': ACTION_ICONS.DENY,
    'delete': ACTION_ICONS.DELETE,
    'report': ACTION_ICONS.REPORT,
  };
  
  return actionMap[action.toLowerCase()] || '•';
};

// eslint-disable-next-line import/no-anonymous-default-export
export default {
  ACTION_ICONS,
  SECTION_ICONS,
  STATS_ICONS,
  STATUS_ICONS,
  PROFILE_ICONS,
  NOTIFICATION_ICONS,
  getActionIcon,
};
