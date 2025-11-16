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
 *   - Production (LOG_LEVEL=INFO): All logs
 *   - Production (LOG_LEVEL=ERROR): Only errors
 * 
 * Log Level Configuration:
 *   - Set REACT_APP_LOG_LEVEL=ERROR for errors only
 *   - Set REACT_APP_LOG_LEVEL=INFO for all logs (default)
 */

const isDevelopment = process.env.NODE_ENV === 'development' || 
                      process.env.REACT_APP_ENV === 'development' ||
                      window.location.hostname === 'localhost' ||
                      window.location.hostname === '127.0.0.1';

// Check log level from environment or runtime config
const getLogLevel = () => {
  // 1. Check build-time environment variable
  if (process.env.REACT_APP_LOG_LEVEL) {
    return process.env.REACT_APP_LOG_LEVEL.toUpperCase();
  }
  
  // 2. Check runtime config (if available)
  if (window.RUNTIME_CONFIG && window.RUNTIME_CONFIG.LOG_LEVEL) {
    return window.RUNTIME_CONFIG.LOG_LEVEL.toUpperCase();
  }
  
  // 3. Default: INFO in development, ERROR in production
  return isDevelopment ? 'INFO' : 'ERROR';
};

const logLevel = getLogLevel();
const showAllLogs = isDevelopment || logLevel === 'INFO' || logLevel === 'DEBUG';

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
   * Shown when LOG_LEVEL=INFO or in development
   */
  info: (...args) => {
    if (showAllLogs) {
      console.log('ℹ️ [INFO]', ...args);
    }
  },

  /**
   * Warning-level logging (potential issues)
   * Shown when LOG_LEVEL=INFO or in development
   */
  warn: (...args) => {
    if (showAllLogs) {
      console.warn('⚠️ [WARN]', ...args);
    }
  },

  /**
   * Error-level logging (critical errors)
   * Always shown (all log levels)
   */
  error: (...args) => {
    console.error('❌ [ERROR]', ...args);
  },

  /**
   * Success logging (operations completed)
   * Shown when LOG_LEVEL=INFO or in development
   */
  success: (...args) => {
    if (showAllLogs) {
      console.log('✅ [SUCCESS]', ...args);
    }
  },

  /**
   * Network/API logging
   * Shown when LOG_LEVEL=INFO or in development
   */
  api: (...args) => {
    if (showAllLogs) {
      console.log('🌐 [API]', ...args);
    }
  },

  /**
   * WebSocket/Real-time logging
   * Shown when LOG_LEVEL=INFO or in development
   */
  socket: (...args) => {
    if (showAllLogs) {
      console.log('🔌 [SOCKET]', ...args);
    }
  },

  /**
   * Get current environment info
   */
  getEnvironment: () => {
    return {
      isDevelopment,
      logLevel,
      showAllLogs,
      hostname: window.location.hostname,
      nodeEnv: process.env.NODE_ENV,
      reactAppEnv: process.env.REACT_APP_ENV
    };
  }
};

// Log environment on first import
if (isDevelopment) {
  console.log('🚀 Logger initialized in DEVELOPMENT mode (all logs enabled)');
} else if (showAllLogs) {
  console.log('📊 Logger initialized in PRODUCTION mode with LOG_LEVEL=INFO (all logs enabled)');
} else {
  console.log('🔒 Logger initialized in PRODUCTION mode with LOG_LEVEL=ERROR (errors only)');
}

export default logger;
