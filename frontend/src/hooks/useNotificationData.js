/**
 * Shared hook for notification data management
 * Centralizes data loading, caching, and state management
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getBackendApiUrl } from '../utils/urlHelper';
import useCancellableRequest from './useCancellableRequest';
import { API_ENDPOINTS, REFRESH_INTERVALS } from '../constants/notificationTriggers';
import logger from '../utils/logger';

const useNotificationData = (endpoint, refreshInterval = null, options = {}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { makeRequest, cleanup } = useCancellableRequest();
  
  const intervalRef = useRef(null);
  const mountedRef = useRef(true);
  const lastFetchRef = useRef(null);
  
  const {
    transformData = null,
    initialData = [],
    cacheKey = null,
    enableCache = false
  } = options;

  // Load data with cancellation and caching
  const loadData = useCallback(async (forceRefresh = false) => {
    if (!mountedRef.current) return;
    
    // Check cache if enabled
    if (enableCache && cacheKey && !forceRefresh) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const { data: cachedData, timestamp } = JSON.parse(cached);
          const cacheAge = Date.now() - timestamp;
          
          // Use cache if less than 5 minutes old
          if (cacheAge < 300000 && cachedData.length > 0) {
            setData(cachedData);
            setLoading(false);
            setError(null);
            return;
          }
        } catch (e) {
          // Cache corrupted, ignore and fetch fresh data
        }
      }
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await makeRequest(getBackendApiUrl(endpoint), {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response || response.status === 401) {
        // Token expired - redirect to login
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        localStorage.removeItem('userRole');
        window.location.href = '/login';
        return;
      }
      
      if (!response.ok) {
        throw new Error(`Failed to load data: ${response.statusText}`);
      }

      const rawData = await response.json();
      const transformedData = transformData ? transformData(rawData) : rawData;
      
      if (mountedRef.current) {
        setData(transformedData || initialData);
        
        // Cache the data if enabled
        if (enableCache && cacheKey) {
          localStorage.setItem(cacheKey, JSON.stringify({
            data: transformedData || initialData,
            timestamp: Date.now()
          }));
        }
        
        setError(null);
        lastFetchRef.current = Date.now();
      }
    } catch (err) {
      if (err.name !== 'AbortError' && mountedRef.current) {
        logger.error(`Error loading ${endpoint}:`, err);
        setError(err.message);
        setData(initialData);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [endpoint, makeRequest, transformData, initialData, cacheKey, enableCache]);

  // Setup automatic refresh
  useEffect(() => {
    loadData();
    
    if (refreshInterval && refreshInterval > 0) {
      intervalRef.current = setInterval(() => {
        loadData();
      }, refreshInterval);
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      cleanup();
    };
  }, [loadData, refreshInterval, cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      cleanup();
    };
  }, [cleanup]);

  // Manual refresh function
  const refresh = useCallback((forceRefresh = true) => {
    return loadData(forceRefresh);
  }, [loadData]);

  // Clear cache function
  const clearCache = useCallback(() => {
    if (cacheKey) {
      localStorage.removeItem(cacheKey);
    }
  }, [cacheKey]);

  return {
    data,
    loading,
    error,
    refresh,
    clearCache,
    lastFetch: lastFetchRef.current
  };
};

// Specialized hooks for specific endpoints
export const useQueueData = () => {
  return useNotificationData(API_ENDPOINTS.QUEUE, REFRESH_INTERVALS.QUEUE, {
    cacheKey: 'notification_queue_cache',
    enableCache: true,
    transformData: (data) => data || []
  });
};

export const useLogsData = () => {
  return useNotificationData(API_ENDPOINTS.LOGS, REFRESH_INTERVALS.LOGS, {
    cacheKey: 'notification_logs_cache',
    enableCache: true,
    transformData: (data) => {
      // Sort logs by creation date descending
      const logs = data || [];
      return logs.sort((a, b) => 
        new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at)
      );
    }
  });
};

export const useAnalyticsData = () => {
  return useNotificationData(API_ENDPOINTS.ANALYTICS, REFRESH_INTERVALS.ANALYTICS, {
    cacheKey: 'notification_analytics_cache',
    enableCache: true,
    transformData: (data) => data || {}
  });
};

export default useNotificationData;
