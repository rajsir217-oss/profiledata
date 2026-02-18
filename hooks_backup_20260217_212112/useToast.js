// frontend/src/hooks/useToast.js
import toastService from '../services/toastService';

/**
 * Custom hook for showing toast notifications
 * Provides consistent interface across all components
 * 
 * Usage:
 *   const toast = useToast();
 *   toast.success('Operation completed!');
 *   toast.error('Something went wrong');
 *   toast.warning('Please review this');
 *   toast.info('FYI: Something happened');
 */
export const useToast = () => {
  return {
    success: (message, duration = 3000) => {
      toastService.success(message, duration);
    },
    
    error: (message, duration = 4000) => {
      toastService.error(message, duration);
    },
    
    warning: (message, duration = 3500) => {
      toastService.warning(message, duration);
    },
    
    info: (message, duration = 3000) => {
      toastService.info(message, duration);
    },
    
    // Direct access to service for custom usage
    service: toastService
  };
};

export default useToast;
