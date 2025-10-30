/**
 * Logger Utility
 * Environment-aware logging system
 * 
 * Usage:
 *   import logger from './utils/logger';
 *   logger.debug('Debug info', data);
 *   logger.info('User action', action);
 *   logger.warn('Warning', warning);
 *   logger.error('Error occurred', error);
 * 
 * Behavior:
 *   - Development: All logs (debug, info, warn, error)
 *   - Production: Only errors
 */

const isDevelopment = process.env.NODE_ENV === 'development' || 
                      process.env.REACT_APP_ENV === 'development' ||
                      window.location.hostname === 'localhost' ||
                      window.location.hostname === '127.0.0.1';

const logger = {
  /**
   * Debug-level logging (verbose, detailed)
   * Only shown in development
   */
  debug: (...args) => {
    if (isDevelopment) {
      console.log('🔍 [DEBUG]', ...args);
    }
  },

  /**
   * Info-level logging (informational, progress)
   * Only shown in development
   */
  info: (...args) => {
    if (isDevelopment) {
      console.log('ℹ️ [INFO]', ...args);
    }
  },

  /**
   * Warning-level logging (potential issues)
   * Only shown in development
   */
  warn: (...args) => {
    if (isDevelopment) {
      console.warn('⚠️ [WARN]', ...args);
    }
  },

  /**
   * Error-level logging (critical errors)
   * Always shown (development + production)
   */
  error: (...args) => {
    console.error('❌ [ERROR]', ...args);
  },

  /**
   * Success logging (operations completed)
   * Only shown in development
   */
  success: (...args) => {
    if (isDevelopment) {
      console.log('✅ [SUCCESS]', ...args);
    }
  },

  /**
   * Network/API logging
   * Only shown in development
   */
  api: (...args) => {
    if (isDevelopment) {
      console.log('🌐 [API]', ...args);
    }
  },

  /**
   * WebSocket/Real-time logging
   * Only shown in development
   */
  socket: (...args) => {
    if (isDevelopment) {
      console.log('🔌 [SOCKET]', ...args);
    }
  },

  /**
   * Get current environment info
   */
  getEnvironment: () => {
    return {
      isDevelopment,
      hostname: window.location.hostname,
      nodeEnv: process.env.NODE_ENV,
      reactAppEnv: process.env.REACT_APP_ENV
    };
  }
};

// Log environment on first import (only in dev)
if (isDevelopment) {
  console.log('🚀 Logger initialized in DEVELOPMENT mode');
} else {
  console.log('🔒 Logger initialized in PRODUCTION mode (errors only)');
}

export default logger;
