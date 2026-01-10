/**
 * useActivityLogger - Frontend Activity Logging Hook
 * 
 * Provides methods to log user activities from the frontend.
 * Uses debouncing and batching for performance.
 * 
 * Activity Types supported:
 * - PAGE_VISITED: User navigated to a page
 * - FILTER_APPLIED: User applied search/list filters
 * - SEARCH_RESULTS_VIEWED: User viewed search results
 * - SORT_CHANGED: User changed sort order
 * - MESSAGES_PAGE_VIEWED: User viewed messages page
 * - FEATURE_USED: User used a specific feature
 * - EXPORT_REQUESTED: User requested data export
 */

import { useCallback, useRef, useEffect } from 'react';
import { getBackendApiUrl } from '../config/apiConfig';

// Activity types enum (matches backend ActivityType)
export const ActivityType = {
  // Authentication
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
  SESSION_EXPIRED: 'session_expired',
  
  // Profile
  PROFILE_VIEWED: 'profile_viewed',
  PROFILE_EDITED: 'profile_edited',
  
  // Search & Discovery
  SEARCH_PERFORMED: 'search_performed',
  FILTER_APPLIED: 'filter_applied',
  SEARCH_RESULTS_VIEWED: 'search_results_viewed',
  SORT_CHANGED: 'sort_changed',
  
  // Messaging
  MESSAGES_PAGE_VIEWED: 'messages_page_viewed',
  
  // System
  PAGE_VISITED: 'page_visited',
  FEATURE_USED: 'feature_used',
  EXPORT_REQUESTED: 'export_requested',
  ERROR_OCCURRED: 'error_occurred',
  
  // Matching
  TOP_MATCHES_VIEWED: 'top_matches_viewed',
  L3V3L_MATCHES_VIEWED: 'l3v3l_matches_viewed'
};

// Queue for batching activity logs
let activityQueue = [];
let flushTimeout = null;
const FLUSH_INTERVAL = 5000; // Flush every 5 seconds
const MAX_QUEUE_SIZE = 10; // Flush when queue reaches this size

/**
 * Flush the activity queue to the backend
 */
const flushQueue = async () => {
  if (activityQueue.length === 0) return;
  
  const token = localStorage.getItem('token');
  if (!token) return;
  
  const activitiesToSend = [...activityQueue];
  activityQueue = [];
  
  try {
    await fetch(getBackendApiUrl('/api/activity-logs/batch'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ activities: activitiesToSend })
    });
  } catch (error) {
    // Silently fail - activity logging should not break the app
    console.debug('Activity logging failed:', error);
  }
};

/**
 * Schedule a queue flush
 */
const scheduleFlush = () => {
  if (flushTimeout) clearTimeout(flushTimeout);
  flushTimeout = setTimeout(flushQueue, FLUSH_INTERVAL);
};

/**
 * Add activity to queue
 */
const queueActivity = (activity) => {
  activityQueue.push({
    ...activity,
    timestamp: new Date().toISOString(),
    page_url: window.location.pathname,
    referrer_url: document.referrer || null
  });
  
  if (activityQueue.length >= MAX_QUEUE_SIZE) {
    flushQueue();
  } else {
    scheduleFlush();
  }
};

/**
 * Log activity immediately (for critical events)
 */
const logActivityImmediate = async (actionType, metadata = {}, targetUsername = null) => {
  const token = localStorage.getItem('token');
  if (!token) return;
  
  try {
    await fetch(getBackendApiUrl('/api/activity-logs/log'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        action_type: actionType,
        target_username: targetUsername,
        metadata,
        page_url: window.location.pathname
      })
    });
  } catch (error) {
    console.debug('Activity logging failed:', error);
  }
};

/**
 * useActivityLogger Hook
 * 
 * @returns {Object} Activity logging methods
 */
const useActivityLogger = () => {
  const lastPageRef = useRef(null);
  const pageStartTimeRef = useRef(null);
  
  // Flush queue on unmount
  useEffect(() => {
    return () => {
      if (activityQueue.length > 0) {
        flushQueue();
      }
    };
  }, []);
  
  /**
   * Log page visit
   */
  const logPageVisit = useCallback((pageName, metadata = {}) => {
    const currentPath = window.location.pathname;
    
    // Don't log duplicate consecutive page visits
    if (lastPageRef.current === currentPath) return;
    
    // Calculate time spent on previous page
    let timeOnPreviousPage = null;
    if (pageStartTimeRef.current) {
      timeOnPreviousPage = Date.now() - pageStartTimeRef.current;
    }
    
    lastPageRef.current = currentPath;
    pageStartTimeRef.current = Date.now();
    
    queueActivity({
      action_type: ActivityType.PAGE_VISITED,
      metadata: {
        page_name: pageName,
        time_on_previous_page_ms: timeOnPreviousPage,
        ...metadata
      }
    });
  }, []);
  
  /**
   * Log filter applied
   */
  const logFilterApplied = useCallback((filterName, filterValue, allFilters = {}) => {
    queueActivity({
      action_type: ActivityType.FILTER_APPLIED,
      metadata: {
        filter_name: filterName,
        filter_value: filterValue,
        active_filters: Object.keys(allFilters).filter(k => allFilters[k])
      }
    });
  }, []);
  
  /**
   * Log search results viewed
   */
  const logSearchResultsViewed = useCallback((resultCount, searchCriteria = {}) => {
    queueActivity({
      action_type: ActivityType.SEARCH_RESULTS_VIEWED,
      metadata: {
        result_count: resultCount,
        criteria_count: Object.keys(searchCriteria).length
      }
    });
  }, []);
  
  /**
   * Log sort changed
   */
  const logSortChanged = useCallback((sortField, sortDirection) => {
    queueActivity({
      action_type: ActivityType.SORT_CHANGED,
      metadata: {
        sort_field: sortField,
        sort_direction: sortDirection
      }
    });
  }, []);
  
  /**
   * Log messages page viewed
   */
  const logMessagesPageViewed = useCallback((conversationCount = 0) => {
    queueActivity({
      action_type: ActivityType.MESSAGES_PAGE_VIEWED,
      metadata: {
        conversation_count: conversationCount
      }
    });
  }, []);
  
  /**
   * Log feature used
   */
  const logFeatureUsed = useCallback((featureName, metadata = {}) => {
    queueActivity({
      action_type: ActivityType.FEATURE_USED,
      metadata: {
        feature_name: featureName,
        ...metadata
      }
    });
  }, []);
  
  /**
   * Log export requested
   */
  const logExportRequested = useCallback((exportType, recordCount = 0) => {
    logActivityImmediate(ActivityType.EXPORT_REQUESTED, {
      export_type: exportType,
      record_count: recordCount
    });
  }, []);
  
  /**
   * Log matches viewed (Top Matches or L3V3L)
   */
  const logMatchesViewed = useCallback((matchType, matchCount = 0) => {
    const activityType = matchType === 'l3v3l' 
      ? ActivityType.L3V3L_MATCHES_VIEWED 
      : ActivityType.TOP_MATCHES_VIEWED;
    
    queueActivity({
      action_type: activityType,
      metadata: {
        match_count: matchCount
      }
    });
  }, []);
  
  /**
   * Log error occurred
   */
  const logError = useCallback((errorMessage, errorStack = null, componentName = null) => {
    logActivityImmediate(ActivityType.ERROR_OCCURRED, {
      error_message: errorMessage,
      error_stack: errorStack?.substring(0, 500), // Limit stack trace length
      component_name: componentName
    });
  }, []);
  
  /**
   * Generic activity logger
   */
  const logActivity = useCallback((actionType, metadata = {}, targetUsername = null, immediate = false) => {
    if (immediate) {
      logActivityImmediate(actionType, metadata, targetUsername);
    } else {
      queueActivity({
        action_type: actionType,
        target_username: targetUsername,
        metadata
      });
    }
  }, []);
  
  return {
    logPageVisit,
    logFilterApplied,
    logSearchResultsViewed,
    logSortChanged,
    logMessagesPageViewed,
    logFeatureUsed,
    logExportRequested,
    logMatchesViewed,
    logError,
    logActivity,
    ActivityType
  };
};

export default useActivityLogger;

// Also export a standalone function for use outside React components
export const logActivityStandalone = (actionType, metadata = {}, targetUsername = null) => {
  queueActivity({
    action_type: actionType,
    target_username: targetUsername,
    metadata
  });
};

// Flush on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushQueue);
}
