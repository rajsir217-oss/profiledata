/**
 * PII Access Event Utilities
 * 
 * Provides a simple pub/sub system for PII access changes
 * Components can listen for access changes and refresh their UI accordingly
 */

import logger from './logger';

// Event names
export const PII_ACCESS_EVENTS = {
  GRANTED: 'pii-access-granted',
  REVOKED: 'pii-access-revoked',
  CHANGED: 'pii-access-changed'
};

/**
 * Emit a PII access change event
 * @param {string} action - 'granted' or 'revoked'
 * @param {string} targetUsername - Username affected by the change
 * @param {string} ownerUsername - Username who owns the PII
 */
export const emitPIIAccessChange = (action, targetUsername, ownerUsername) => {
  const event = new CustomEvent('pii-access-changed', {
    detail: { action, targetUsername, ownerUsername }
  });
  window.dispatchEvent(event);
  
  logger.debug('PII Access Event:', { action, targetUsername, ownerUsername });
};

/**
 * Listen for PII access changes
 * @param {function} callback - Function to call when access changes
 * @returns {function} Cleanup function to remove the listener
 */
export const onPIIAccessChange = (callback) => {
  const handler = (event) => {
    callback(event.detail);
  };
  
  window.addEventListener('pii-access-changed', handler);
  
  // Return cleanup function
  return () => {
    window.removeEventListener('pii-access-changed', handler);
  };
};

/**
 * React hook to listen for PII access changes
 * Usage in components:
 * 
 * usePIIAccessListener((detail) => {
 *   logger.debug('PII access changed:', detail);
 *   // Reload data here
 * }, []);
 */
export const usePIIAccessListener = (callback, deps = []) => {
  const { useEffect } = require('react');
  
  useEffect(() => {
    const cleanup = onPIIAccessChange(callback);
    return cleanup;
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
};
