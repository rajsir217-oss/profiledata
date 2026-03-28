/**
 * Timezone Helper Utilities
 * Handles consistent timezone-aware date/time operations across the application
 */

/**
 * Convert a date string to a timezone-aware Date object
 * @param {string|Date} dateInput - Date string or Date object
 * @returns {Date} - Date object in user's local timezone
 */
export const toLocalDate = (dateInput) => {
  if (!dateInput) return null;
  
  try {
    const date = new Date(dateInput);
    // Check if date is valid
    if (isNaN(date.getTime())) return null;
    
    return date;
  } catch (error) {
    console.warn('Invalid date input:', dateInput, error);
    return null;
  }
};

/**
 * Convert a local date to UTC ISO string for backend storage
 * @param {string|Date} dateInput - Local date string or Date object
 * @returns {string|null} - ISO string in UTC or null if invalid
 */
export const toUTCISOString = (dateInput) => {
  if (!dateInput) return null;
  
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return null;
    
    // Return ISO string in UTC
    return date.toISOString();
  } catch (error) {
    console.warn('Invalid date input for UTC conversion:', dateInput, error);
    return null;
  }
};

/**
 * Format a date for display in user's local timezone
 * @param {string|Date} dateInput - Date string or Date object
 * @param {Object} options - Formatting options
 * @returns {string} - Formatted date string
 */
export const formatDate = (dateInput, options = {}) => {
  const date = toLocalDate(dateInput);
  if (!date) return '-';
  
  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options
  };
  
  try {
    return date.toLocaleDateString('en-US', defaultOptions);
  } catch (error) {
    console.warn('Error formatting date:', dateInput, error);
    return String(dateInput);
  }
};

/**
 * Format a date with time for display in user's local timezone
 * @param {string|Date} dateInput - Date string or Date object
 * @param {Object} options - Formatting options
 * @returns {string} - Formatted date-time string
 */
export const formatDateTime = (dateInput, options = {}) => {
  const date = toLocalDate(dateInput);
  if (!date) return '-';
  
  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
    ...options
  };
  
  try {
    return date.toLocaleString('en-US', defaultOptions);
  } catch (error) {
    console.warn('Error formatting datetime:', dateInput, error);
    return String(dateInput);
  }
};

/**
 * Calculate time remaining until a date
 * @param {string|Date} dateInput - Target date
 * @returns {Object|null} - Time remaining object or null
 */
export const getTimeRemaining = (dateInput) => {
  const targetDate = toLocalDate(dateInput);
  if (!targetDate) return null;
  
  const now = new Date();
  const difference = targetDate - now;
  
  if (difference <= 0) {
    return {
      expired: true,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      total: 0
    };
  }
  
  const days = Math.floor(difference / (1000 * 60 * 60 * 24));
  const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((difference % (1000 * 60)) / 1000);
  
  return {
    expired: false,
    days,
    hours,
    minutes,
    seconds,
    total: difference
  };
};

/**
 * Format time remaining as a human-readable string
 * @param {string|Date} dateInput - Target date
 * @returns {string} - Formatted time remaining
 */
export const formatTimeRemaining = (dateInput) => {
  const remaining = getTimeRemaining(dateInput);
  if (!remaining) return 'Invalid date';
  
  if (remaining.expired) {
    return 'Expired';
  }
  
  const parts = [];
  if (remaining.days > 0) {
    parts.push(`${remaining.days}d`);
  }
  if (remaining.hours > 0) {
    parts.push(`${remaining.hours}h`);
  }
  if (remaining.minutes > 0) {
    parts.push(`${remaining.minutes}m`);
  }
  
  if (parts.length === 0) {
    return `${remaining.seconds}s`;
  }
  
  return parts.join(' ');
};

/**
 * Check if a date is in the past
 * @param {string|Date} dateInput - Date to check
 * @returns {boolean} - True if date is in the past
 */
export const isPastDate = (dateInput) => {
  const date = toLocalDate(dateInput);
  if (!date) return false;
  
  return date < new Date();
};

/**
 * Get a date input value (YYYY-MM-DD) from a date string
 * @param {string|Date} dateInput - Date input
 * @returns {string} - Date input value or empty string
 */
export const getDateInputValue = (dateInput) => {
  const date = toLocalDate(dateInput);
  if (!date) return '';
  
  try {
    // Get local date in YYYY-MM-DD format
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.warn('Error getting date input value:', dateInput, error);
    return '';
  }
};

/**
 * Parse a date input value (YYYY-MM-DD) to UTC ISO string
 * @param {string} dateInputValue - Date input value in YYYY-MM-DD format
 * @returns {string|null} - UTC ISO string or null
 */
export const parseDateInputToUTC = (dateInputValue) => {
  if (!dateInputValue) return null;
  
  try {
    // Create date in local timezone from YYYY-MM-DD
    const [year, month, day] = dateInputValue.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    
    if (isNaN(date.getTime())) return null;
    
    return date.toISOString();
  } catch (error) {
    console.warn('Error parsing date input:', dateInputValue, error);
    return null;
  }
};
