/**
 * Time Formatting Utilities
 * Converts timestamps to human-readable relative time formats
 */

/**
 * Format a date as relative time (e.g., "2 hours ago", "3 days ago")
 * @param {string|Date} dateValue - ISO string or Date object
 * @returns {string} - Human-readable relative time
 */
export const formatRelativeTime = (dateValue) => {
  if (!dateValue) return 'Never';
  
  const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  
  // Less than a minute
  if (seconds < 60) {
    return 'Just now';
  }
  
  const minutes = Math.floor(seconds / 60);
  
  // Less than an hour
  if (minutes < 60) {
    return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
  }
  
  const hours = Math.floor(minutes / 60);
  
  // Less than a day
  if (hours < 24) {
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  }
  
  const days = Math.floor(hours / 24);
  
  // Less than a week
  if (days < 7) {
    return days === 1 ? 'Yesterday' : `${days} days ago`;
  }
  
  const weeks = Math.floor(days / 7);
  
  // Less than a month
  if (weeks < 4) {
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  }
  
  const months = Math.floor(days / 30);
  
  // Less than a year
  if (months < 12) {
    return months === 1 ? '1 month ago' : `${months} months ago`;
  }
  
  const years = Math.floor(months / 12);
  return years === 1 ? '1 year ago' : `${years} years ago`;
};

/**
 * Format full date and time
 * @param {string|Date} dateValue - ISO string or Date object
 * @returns {string} - Formatted date and time
 */
export const formatFullDateTime = (dateValue) => {
  if (!dateValue) return 'N/A';
  
  const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
  
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

/**
 * Format date only (no time)
 * @param {string|Date} dateValue - ISO string or Date object
 * @returns {string} - Formatted date
 */
export const formatDate = (dateValue) => {
  if (!dateValue) return 'N/A';
  
  const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
  
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

/**
 * Format time only (no date)
 * @param {string|Date} dateValue - ISO string or Date object
 * @returns {string} - Formatted time
 */
export const formatTime = (dateValue) => {
  if (!dateValue) return 'N/A';
  
  const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
  
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

/**
 * Format a compact date + time (e.g., "Jan 25, 07:28 PM")
 * @param {string|Date} dateValue - ISO string or Date object
 * @returns {string} - Formatted date and time
 */
export const formatShortDateTime = (dateValue) => {
  if (!dateValue) return 'N/A';

  const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;

  const now = new Date();
  const includeYear = date.getFullYear() !== now.getFullYear();

  return date.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    ...(includeYear ? { year: '2-digit' } : {}),
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};
