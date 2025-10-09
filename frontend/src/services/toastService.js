// frontend/src/services/toastService.js
/**
 * Centralized Toast Notification Service
 * Replaces all alert() and window.confirm() dialogs with elegant toast notifications
 */

class ToastService {
  constructor() {
    this.listeners = [];
  }

  /**
   * Show a success toast notification
   * @param {string} message - The success message to display
   * @param {number} duration - Auto-dismiss duration in ms (default: 5000)
   */
  success(message, duration = 5000) {
    this.show({
      type: 'success',
      message,
      duration,
      icon: '✅'
    });
  }

  /**
   * Show an error toast notification
   * @param {string} message - The error message to display
   * @param {number} duration - Auto-dismiss duration in ms (default: 5000)
   */
  error(message, duration = 5000) {
    this.show({
      type: 'error',
      message,
      duration,
      icon: '❌'
    });
  }

  /**
   * Show a warning toast notification
   * @param {string} message - The warning message to display
   * @param {number} duration - Auto-dismiss duration in ms (default: 5000)
   */
  warning(message, duration = 5000) {
    this.show({
      type: 'warning',
      message,
      duration,
      icon: '⚠️'
    });
  }

  /**
   * Show an info toast notification
   * @param {string} message - The info message to display
   * @param {number} duration - Auto-dismiss duration in ms (default: 5000)
   */
  info(message, duration = 5000) {
    this.show({
      type: 'info',
      message,
      duration,
      icon: 'ℹ️'
    });
  }

  /**
   * Show a toast notification
   * @param {Object} toast - Toast configuration
   */
  show(toast) {
    const id = Date.now() + Math.random();
    const toastWithId = { ...toast, id };
    
    this.listeners.forEach(listener => listener(toastWithId));
  }

  /**
   * Subscribe to toast notifications
   * @param {Function} callback - Callback function to handle toast events
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }
}

// Export singleton instance
export const toastService = new ToastService();
export default toastService;
