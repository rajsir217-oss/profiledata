/**
 * Custom hook for cancellable API requests
 * Prevents race conditions and memory leaks
 */

import { useRef, useCallback } from 'react';

const useCancellableRequest = () => {
  const abortController = useRef(null);
  
  const makeRequest = useCallback(async (url, options = {}) => {
    // Cancel any existing request
    if (abortController.current) {
      abortController.current.abort();
    }
    
    // Create new abort controller
    abortController.current = new AbortController();
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: abortController.current.signal
      });
      
      // Clear controller on success
      if (response.ok) {
        abortController.current = null;
      }
      
      return response;
    } catch (error) {
      // Clear controller on error (unless it was aborted)
      if (error.name !== 'AbortError') {
        abortController.current = null;
      }
      throw error;
    }
  }, []);
  
  const cancelRequest = useCallback(() => {
    if (abortController.current) {
      abortController.current.abort();
      abortController.current = null;
    }
  }, []);
  
  // Cleanup on unmount
  const cleanup = useCallback(() => {
    cancelRequest();
  }, [cancelRequest]);
  
  return { makeRequest, cancelRequest, cleanup };
};

export default useCancellableRequest;
