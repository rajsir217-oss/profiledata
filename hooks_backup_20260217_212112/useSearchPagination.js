import { useEffect, useRef, useCallback } from 'react';
import logger from '../utils/logger';

/**
 * useSearchPagination - Manages pagination and infinite scroll
 * Handles server-side pagination, loading more results, and scroll detection
 */
export const useSearchPagination = (searchState, handleSearch) => {
  const {
    loadingMore,
    users,
    hasMoreResults,
    loadMoreTriggerRef,
    loadingPageRef,
    setLoadingMore,
    setCurrentPage,
  } = searchState;

  // ===== PAGINATION ACTIONS =====

  // Load more results (server-side pagination)
  const handleLoadMore = useCallback(async () => {
    logger.info(`📄 handleLoadMore called: loadingMore=${loadingMore}, loadingPageRef=${loadingPageRef.current}, usersCount=${users.length}`);
    
    if (loadingMore) {
      logger.info(`📄 handleLoadMore: Skipping - already loading`);
      return;
    }
    
    // Don't load more if there are no users (e.g., profileId search returned 0 or excluded)
    if (users.length === 0) {
      logger.info(`📄 handleLoadMore: Skipping - no users to paginate`);
      return;
    }
    
    // Use ref as source of truth — immune to React batching / stale closures
    const nextPage = loadingPageRef.current + 1;
    
    logger.info(`📄 handleLoadMore: Will load page ${nextPage}`);
    
    setLoadingMore(true);
    setCurrentPage(nextPage);
    loadingPageRef.current = nextPage;
    
    try {
      await handleSearch(nextPage);
      logger.info(`📄 handleLoadMore: Successfully loaded page ${nextPage}`);
    } catch (err) {
      logger.error('Error loading more results:', err);
      loadingPageRef.current = nextPage - 1; // Revert ref on failure
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, users, hasMoreResults, handleSearch, setLoadingMore, setCurrentPage, loadingPageRef]);

  // ===== INFINITE SCROLL =====

  // IntersectionObserver for infinite scroll (server-side pagination)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) {
          // Check if there are more results to fetch from server
          if (entry.isIntersecting && !loadingMore && hasMoreResults) {
            logger.info(`🔄 IntersectionObserver triggered - loading more`);
            handleLoadMore();
          }
        }
      },
      { threshold: 0.1, rootMargin: '100px' } // Trigger 100px before element is visible
    );

    const currentRef = loadMoreTriggerRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [loadingMore, hasMoreResults, handleLoadMore, loadMoreTriggerRef]);

  // ===== UTILITY FUNCTIONS =====

  // Check if can load more
  const canLoadMore = useCallback(() => {
    return !loadingMore && hasMoreResults && users.length > 0;
  }, [loadingMore, hasMoreResults, users.length]);

  // Get current page info
  const getCurrentPageInfo = useCallback(() => {
    return {
      currentPage: loadingPageRef.current,
      hasMore: hasMoreResults,
      isLoading: loadingMore,
      currentCount: users.length,
    };
  }, [loadingPageRef.current, hasMoreResults, loadingMore, users.length]);

  // Reset pagination state
  const resetPagination = useCallback(() => {
    loadingPageRef.current = 1;
    setCurrentPage(1);
    setLoadingMore(false);
  }, [setCurrentPage, setLoadingMore, loadingPageRef]);

  // Manual load more (for button clicks)
  const manualLoadMore = useCallback(() => {
    if (canLoadMore()) {
      handleLoadMore();
    }
  }, [canLoadMore, handleLoadMore]);

  // ===== PAGINATION METRICS =====

  // Calculate pagination progress
  const getPaginationProgress = useCallback(() => {
    if (!users.length) return 0;
    return Math.min((users.length / (users.length + (hasMoreResults ? 20 : 0))) * 100, 100);
  }, [users.length, hasMoreResults]);

  // Get estimated total (current + estimated remaining)
  const getEstimatedTotal = useCallback(() => {
    if (!hasMoreResults) return users.length;
    return users.length + 20; // Assume one more page of 20 items
  }, [users.length, hasMoreResults]);

  return {
    // Actions
    handleLoadMore,
    manualLoadMore,
    resetPagination,
    
    // Utilities
    canLoadMore,
    getCurrentPageInfo,
    getPaginationProgress,
    getEstimatedTotal,
    
    // State (read-only)
    isLoadingMore: loadingMore,
    hasMoreResults,
    currentPage: loadingPageRef.current,
    currentCount: users.length,
  };
};
