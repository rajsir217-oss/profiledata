/**
 * Logger utility for messenger-web.
 * Mirrors the main app's logger pattern: quiet in production, verbose in dev.
 */

const isDev = () => {
  try {
    return process.env.NODE_ENV !== 'production';
  } catch (_) {
    return false;
  }
};

const logger = {
  debug: (...args) => {
    if (isDev()) {
      // eslint-disable-next-line no-console
      console.debug(...args);
    }
  },
  info: (...args) => {
    if (isDev()) {
      // eslint-disable-next-line no-console
      console.log(...args);
    }
  },
  warn: (...args) => {
    // eslint-disable-next-line no-console
    console.warn(...args);
  },
  error: (...args) => {
    // eslint-disable-next-line no-console
    console.error(...args);
  },
};

export default logger;
