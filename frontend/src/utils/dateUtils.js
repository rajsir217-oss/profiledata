/**
 * Date utility functions for contribution popup
 */

/**
 * Calculate the number of days since a given date
 * @param {string} dateString - ISO date string
 * @returns {number} Days since the date (Infinity if no date)
 */
export const getDaysSince = (dateString) => {
  if (!dateString) return Infinity;
  return (Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60 * 24);
};

/**
 * Check if user has made a payment within the last N days
 * @param {string} lastContribution - Date of last contribution
 * @param {string} lastRecurring - Date of last recurring payment
 * @param {number} days - Number of days to check (default: 30)
 * @returns {boolean} True if user paid within the period
 */
export const hasRecentPayment = (lastContribution, lastRecurring, days = 30) => {
  const daysSince = getDaysSince(lastContribution || lastRecurring);
  return daysSince < days;
};
