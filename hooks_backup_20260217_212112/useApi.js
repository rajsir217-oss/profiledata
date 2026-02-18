/**
 * useApi Hook
 * Consolidates API call state management
 * Reduces ~150 lines of duplicate state handling
 */

import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Custom hook for managing API calls with loading, error, and data states
 * @param {Function} apiFunction - Async function that makes the API call
 * @param {object} options - Configuration options
 * @returns {object} - { data, loading, error, execute, reset }
 */
export const useApi = (apiFunction, options = {}) => {
  const {
    immediate = false,    // Execute immediately on mount
    onSuccess = null,     // Callback on success
    onError = null,       // Callback on error
    initialData = null    // Initial data value
  } = options;
  
  const [state, setState] = useState({
    data: initialData,
    loading: false,
    error: null
  });
  
  // Track mounted state to prevent state updates after unmount
  const isMounted = useRef(true);
  const latestExecution = useRef(0);
  
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  /**
   * Execute the API call
   */
  const execute = useCallback(async (...args) => {
    // Track this execution
    const executionId = ++latestExecution.current;
    
    setState({ data: state.data || initialData, loading: true, error: null });
    
    try {
      const data = await apiFunction(...args);
      
      // Only update if this is the latest execution and component is mounted
      if (executionId === latestExecution.current && isMounted.current) {
        setState({ data, loading: false, error: null });
        
        if (onSuccess) {
          onSuccess(data);
        }
      }
      
      return data;
    } catch (error) {
      // Only update if this is the latest execution and component is mounted
      if (executionId === latestExecution.current && isMounted.current) {
        const errorMessage = error.message || 'An error occurred';
        setState({ data: null, loading: false, error: errorMessage });
        
        if (onError) {
          onError(error);
        }
      }
      
      throw error;
    }
  }, [apiFunction, onSuccess, onError, initialData]);
  
  /**
   * Reset state to initial values
   */
  const reset = useCallback(() => {
    if (isMounted.current) {
      setState({ data: initialData, loading: false, error: null });
    }
  }, [initialData]);
  
  /**
   * Execute immediately on mount if requested
   */
  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, []); // Empty deps - only run on mount
  
  return {
    ...state,
    execute,
    reset,
    isLoading: state.loading,
    isError: !!state.error,
    isSuccess: !state.loading && !state.error && state.data !== null
  };
};

/**
 * Hook for paginated API calls
 */
export const usePaginatedApi = (apiFunction, options = {}) => {
  const {
    initialPage = 1,
    initialPageSize = 20,
    ...restOptions
  } = options;
  
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [hasMore, setHasMore] = useState(true);
  
  const api = useApi(
    async (...args) => {
      const response = await apiFunction(...args, { page, pageSize });
      setHasMore(response.hasMore || false);
      return response;
    },
    restOptions
  );
  
  const nextPage = useCallback(() => {
    if (!api.loading && hasMore) {
      setPage(p => p + 1);
    }
  }, [api.loading, hasMore]);
  
  const prevPage = useCallback(() => {
    if (!api.loading && page > 1) {
      setPage(p => p - 1);
    }
  }, [api.loading, page]);
  
  const goToPage = useCallback((newPage) => {
    if (!api.loading) {
      setPage(newPage);
    }
  }, [api.loading]);
  
  return {
    ...api,
    page,
    pageSize,
    hasMore,
    nextPage,
    prevPage,
    goToPage,
    setPageSize
  };
};

/**
 * Hook for optimistic updates
 */
export const useOptimisticApi = (apiFunction, options = {}) => {
  const { optimisticUpdate = null, ...restOptions } = options;
  
  const api = useApi(apiFunction, restOptions);
  const [optimisticData, setOptimisticData] = useState(null);
  
  const executeWithOptimistic = useCallback(async (...args) => {
    if (optimisticUpdate) {
      setOptimisticData(optimisticUpdate(...args));
    }
    
    try {
      const result = await api.execute(...args);
      setOptimisticData(null);
      return result;
    } catch (error) {
      setOptimisticData(null);
      throw error;
    }
  }, [api, optimisticUpdate]);
  
  return {
    ...api,
    execute: executeWithOptimistic,
    data: optimisticData || api.data
  };
};

export default useApi;
