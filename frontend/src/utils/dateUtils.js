/**
 * Generic date utility helpers.
 */

/**
 * Calculate the number of days since a given date.
 * @param {string} dateString - ISO date string
 * @returns {number} Days since the date (Infinity if no date)
 */
export const getDaysSince = (dateString) => {
  if (!dateString) return Infinity;
  return (Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60 * 24);
};
