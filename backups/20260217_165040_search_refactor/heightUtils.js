/**
 * Height formatting utilities
 * Eliminates duplicate height calculation logic across components
 */

/**
 * Format height range for display
 * @param {number} minFeet - Minimum feet
 * @param {number} minInches - Minimum inches  
 * @param {number} maxFeet - Maximum feet
 * @param {number} maxInches - Maximum inches
 * @returns {string} Formatted height range string
 */
export const formatHeightRange = (minFeet, minInches, maxFeet, maxInches) => {
  if (!minFeet && !maxFeet) return '';
  
  const formatSingle = (feet, inches) => {
    if (!feet && !inches) return '';
    const f = parseInt(feet) || 0;
    const i = parseInt(inches) || 0;
    return `${f}'${i}"`;
  };
  
  if (minFeet && maxFeet) {
    return `${formatSingle(minFeet, minInches)}-${formatSingle(maxFeet, maxInches)}`;
  } else if (minFeet) {
    return `${formatSingle(minFeet, minInches)}+`;
  } else if (maxFeet) {
    return `<${formatSingle(maxFeet, maxInches)}`;
  }
  
  return '';
};

/**
 * Format height for search criteria (total inches)
 * @param {number} feet - Height in feet
 * @param {number} inches - Height in inches  
 * @returns {number} Total inches
 */
export const heightToInches = (feet, inches) => {
  const f = parseInt(feet) || 0;
  const i = parseInt(inches) || 0;
  return f * 12 + i;
};

/**
 * Format height for display with proper string representation
 * @param {number} feet - Height in feet
 * @param {number} inches - Height in inches
 * @returns {string} Formatted height string
 */
export const formatHeightDisplay = (feet, inches) => {
  if (!feet && !inches) return '';
  
  const f = parseInt(feet) || 0;
  const i = parseInt(inches) || 0;
  return `${f}'${i}"`;
};

/**
 * Parse height from string format (e.g., "5'6" or "5'6\"")
 * @param {string} heightString - Height string
 * @returns {object} { feet: number, inches: number }
 */
export const parseHeightString = (heightString) => {
  if (!heightString) return { feet: 0, inches: 0 };
  
  const match = heightString.match(/(\d+)'(\d*)"?/);
  if (!match) return { feet: 0, inches: 0 };
  
  return {
    feet: parseInt(match[1]) || 0,
    inches: parseInt(match[2]) || 0
  };
};
