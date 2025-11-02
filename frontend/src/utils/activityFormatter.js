/**
 * Activity Status Formatter
 * Converts last activity timestamp to generic activity ranges with visual indicators
 */

/**
 * Activity status levels with colors and ranges
 */
export const ACTIVITY_STATUS = {
  ACTIVE_TODAY: {
    label: 'Active today',
    color: '#22c55e', // Green
    icon: '🟢',
    maxDays: 1
  },
  ACTIVE_THIS_WEEK: {
    label: 'Active this week',
    color: '#eab308', // Yellow
    icon: '🟡',
    maxDays: 7
  },
  ACTIVE_TWO_WEEKS: {
    label: 'Active 2 weeks ago',
    color: '#f97316', // Orange
    icon: '🟠',
    maxDays: 14
  },
  ACTIVE_MONTH: {
    label: 'Active over a month ago',
    color: '#9ca3af', // Gray
    icon: '⚪',
    maxDays: Infinity
  },
  NEVER_ACTIVE: {
    label: 'Never active',
    color: '#6b7280', // Dark gray
    icon: '⚫',
    maxDays: Infinity
  }
};

/**
 * Get activity status from last seen timestamp
 * @param {string|Date|null} lastSeenValue - Last activity timestamp
 * @returns {Object} - Activity status object with label, color, and icon
 */
export const getActivityStatus = (lastSeenValue) => {
  if (!lastSeenValue) {
    return ACTIVITY_STATUS.NEVER_ACTIVE;
  }

  const lastSeen = typeof lastSeenValue === 'string' ? new Date(lastSeenValue) : lastSeenValue;
  const now = new Date();
  const daysSince = Math.floor((now - lastSeen) / (1000 * 60 * 60 * 24));

  if (daysSince < 1) {
    return ACTIVITY_STATUS.ACTIVE_TODAY;
  } else if (daysSince < 7) {
    return ACTIVITY_STATUS.ACTIVE_THIS_WEEK;
  } else if (daysSince < 14) {
    return ACTIVITY_STATUS.ACTIVE_TWO_WEEKS;
  } else {
    return ACTIVITY_STATUS.ACTIVE_MONTH;
  }
};

/**
 * Format activity status as readable text with icon
 * @param {string|Date|null} lastSeenValue - Last activity timestamp
 * @returns {string} - Formatted activity string (e.g., "🟢 Active today")
 */
export const formatActivityStatus = (lastSeenValue) => {
  const status = getActivityStatus(lastSeenValue);
  return `${status.icon} ${status.label}`;
};

/**
 * Get activity status color for styling
 * @param {string|Date|null} lastSeenValue - Last activity timestamp
 * @returns {string} - Hex color code
 */
export const getActivityColor = (lastSeenValue) => {
  const status = getActivityStatus(lastSeenValue);
  return status.color;
};

/**
 * Get activity badge component props
 * @param {string|Date|null} lastSeenValue - Last activity timestamp
 * @returns {Object} - Props object with label, color, and icon
 */
export const getActivityBadgeProps = (lastSeenValue) => {
  const status = getActivityStatus(lastSeenValue);
  return {
    label: status.label,
    color: status.color,
    icon: status.icon,
    fullText: `${status.icon} ${status.label}`
  };
};

/**
 * Check if user is currently active (within last 24 hours)
 * @param {string|Date|null} lastSeenValue - Last activity timestamp
 * @returns {boolean} - True if active today
 */
export const isActiveToday = (lastSeenValue) => {
  if (!lastSeenValue) return false;
  
  const lastSeen = typeof lastSeenValue === 'string' ? new Date(lastSeenValue) : lastSeenValue;
  const now = new Date();
  const hoursSince = Math.floor((now - lastSeen) / (1000 * 60 * 60));
  
  return hoursSince < 24;
};

/**
 * Get relative time for more specific activity (for tooltips)
 * @param {string|Date|null} lastSeenValue - Last activity timestamp
 * @returns {string} - Relative time string (e.g., "2 hours ago", "3 days ago")
 */
export const getRelativeActivityTime = (lastSeenValue) => {
  if (!lastSeenValue) return 'Never';
  
  const lastSeen = typeof lastSeenValue === 'string' ? new Date(lastSeenValue) : lastSeenValue;
  const now = new Date();
  const seconds = Math.floor((now - lastSeen) / 1000);
  
  if (seconds < 60) {
    return 'Just now';
  }
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
  }
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  }
  
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return days === 1 ? 'Yesterday' : `${days} days ago`;
  }
  
  const weeks = Math.floor(days / 7);
  if (weeks < 4) {
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  }
  
  const months = Math.floor(days / 30);
  if (months < 12) {
    return months === 1 ? '1 month ago' : `${months} months ago`;
  }
  
  const years = Math.floor(months / 12);
  return years === 1 ? '1 year ago' : `${years} years ago`;
};
