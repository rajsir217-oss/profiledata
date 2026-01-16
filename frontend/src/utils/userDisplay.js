/**
 * User Display Utilities
 * Helper functions for displaying user names consistently across the app
 */

/**
 * Get full display name (First Last)
 * @param {Object} user - User object with firstName, lastName, username
 * @returns {string} Display name
 */
export const getDisplayName = (user) => {
  if (!user) return 'Unknown User';
  
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }
  
  if (user.firstName) {
    return user.firstName;
  }
  
  return user.username || 'Unknown User';
};

/**
 * Get short display name (First L.)
 * @param {Object} user - User object with firstName, lastName, username
 * @returns {string} Short display name
 */
export const getShortName = (user) => {
  if (!user) return 'Unknown';
  
  // Helper to capitalize first letter, lowercase rest
  const toCamelCase = (str) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  };
  
  if (user.firstName && user.lastName) {
    return `${toCamelCase(user.firstName)} ${user.lastName.charAt(0).toUpperCase()}`;
  }
  
  if (user.firstName) {
    return toCamelCase(user.firstName);
  }
  
  return user.username || 'Unknown';
};

/**
 * Get initials for avatar placeholder
 * @param {Object} user - User object with firstName, lastName, username
 * @returns {string} Initials (1-2 characters)
 */
export const getInitials = (user) => {
  if (!user) return '?';
  
  if (user.firstName && user.lastName) {
    return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
  }
  
  if (user.firstName) {
    return user.firstName.charAt(0).toUpperCase();
  }
  
  if (user.username) {
    return user.username.charAt(0).toUpperCase();
  }
  
  return '?';
};

/**
 * Get first name only
 * @param {Object} user - User object with firstName, username
 * @returns {string} First name
 */
export const getFirstName = (user) => {
  if (!user) return 'User';
  return user.firstName || user.username || 'User';
};

/**
 * Format user for display with fallbacks
 * @param {Object} user - User object
 * @returns {Object} Formatted user object
 */
export const formatUserDisplay = (user) => {
  if (!user) {
    return {
      displayName: 'Unknown User',
      shortName: 'Unknown',
      initials: '?',
      firstName: 'User'
    };
  }
  
  return {
    displayName: getDisplayName(user),
    shortName: getShortName(user),
    initials: getInitials(user),
    firstName: getFirstName(user)
  };
};
