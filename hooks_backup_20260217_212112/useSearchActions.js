import { useState, useCallback, useRef } from 'react';
import api from '../api';
import logger from '../utils/logger';
import toastService from '../services/toastService';

/**
 * useSearchActions - Manages all search-related API calls and actions
 * Handles search execution, data loading, and user interactions
 */
export const useSearchActions = (searchState, userState, filterState) => {
  const {
    users, setUsers,
    searchCriteria,
    loading, setLoading,
    loadingMore, setLoadingMore,
    loadingStartTime, setLoadingStartTime,
    elapsedTime, setElapsedTime,
    initialSearchComplete, setInitialSearchComplete,
    error, setError,
    currentPage, setCurrentPage,
    totalResults, setTotalResults,
    hasMoreResults, setHasMoreResults,
    sortBy, setSortBy,
    sortOrder, setSortOrder,
    hasAutoExecutedRef,
    searchResultsRef,
    loadMoreTriggerRef,
    loadingPageRef,
    searchAbortRef,
    accumulatedCountRef,
    resetSearchState,
    startLoadingTimer,
    updateElapsedTime,
    selectedProfileForDetail, setSelectedProfileForDetail,
  } = searchState;

  const {
    currentUserProfile,
    favoritedUsers, setFavoritedUsers,
    shortlistedUsers, setShortlistedUsers,
    excludedUsers, setExcludedUsers,
  } = userState;

  const {
    loadSavedSearches,
    loadOccupationOptions,
    loadLocationOptions,
  } = filterState;

  // ===== DATA LOADING FUNCTIONS =====

  // Load all initial data in coordinated way to prevent race conditions
  const loadAllInitialData = useCallback(async () => {
    try {
      // Load user profile and data in parallel
      const [profileResponse, userDataResponse] = await Promise.all([
        api.get(`/profile/${localStorage.getItem('username')}?requester=${localStorage.getItem('username')}`).catch(err => {
          logger.error('❌ Error loading profile:', err);
          return { data: null }; // Fallback response
        }),
        Promise.all([
          api.get(`/favorites/${localStorage.getItem('username')}`).catch(err => {
            logger.error('❌ Error loading favorites:', err);
            return { data: [] }; // Fallback empty array
          }),
          api.get(`/shortlist/${localStorage.getItem('username')}`).catch(err => {
            logger.error('❌ Error loading shortlist:', err);
            return { data: [] }; // Fallback empty array
          }),
          api.get(`/exclusions/${localStorage.getItem('username')}`).catch(err => {
            logger.error('❌ Error loading exclusions:', err);
            return { data: [] }; // Fallback empty array
          })
        ]).catch(err => {
          logger.error('❌ Error loading user data batch:', err);
          return [[], [], []]; // Fallback empty arrays
        })
      ]);
      
      // Process profile data
      if (profileResponse?.data) {
        // Profile processing would be handled by parent component
      }
      
      // Process user data
      const [favResponse, shortlistResponse, exclusionsResponse] = userDataResponse;
      
      // APIs return nested objects: {favorites: [...]}, {shortlist: [...]}, {exclusions: [...]}
      const favData = favResponse?.data?.favorites || favResponse?.data || [];
      const shortlistData = shortlistResponse?.data?.shortlist || shortlistResponse?.data || [];
      const exclusionsData = exclusionsResponse?.data?.exclusions || exclusionsResponse?.data || [];
      
      const favArray = Array.isArray(favData) ? favData : [];
      const shortlistArray = Array.isArray(shortlistData) ? shortlistData : [];
      const exclusionsArray = Array.isArray(exclusionsData) ? exclusionsData : [];
      
      const favoriteUsernames = favArray.map(fav => fav.targetUsername || fav.favoriteUsername || fav.username);
      const shortlistUsernames = shortlistArray.map(sl => sl.targetUsername || sl.username);
      const exclusionUsernames = exclusionsArray.map(ex => ex.targetUsername || ex.username);
      
      setFavoritedUsers(new Set(favoriteUsernames));
      setShortlistedUsers(new Set(shortlistUsernames));
      setExcludedUsers(new Set(exclusionUsernames));
      
      logger.info('✅ Loaded user interactions:', {
        favorites: favoriteUsernames.length,
        shortlist: shortlistUsernames.length,
        exclusions: exclusionUsernames.length
      });
      
    } catch (err) {
      logger.error('❌ Error loading initial data:', err);
    }
  }, [setFavoritedUsers, setShortlistedUsers, setExcludedUsers]);

  // Load other data that doesn't depend on profile
  const loadOtherData = useCallback(async () => {
    try {
      await Promise.all([
        loadSavedSearches(),
        loadOccupationOptions(),
        loadLocationOptions()
      ]);
    } catch (err) {
      logger.error('❌ Error loading other data:', err);
    }
  }, [loadSavedSearches, loadOccupationOptions, loadLocationOptions]);

  // Load online users function
  const loadOnlineUsers = useCallback(async (setOnlineUsers) => {
    try {
      const response = await api.get('/online-status/users');
      logger.debug('Loaded online users:', response.data.onlineUsers);
      setOnlineUsers(new Set(response.data.onlineUsers || []));
    } catch (err) {
      logger.error('❌ Error loading online users:', err);
      setOnlineUsers(new Set());
    }
  }, []);

  // Load PII requests
  const loadPiiRequests = useCallback(async (setPiiRequests) => {
    const currentUser = localStorage.getItem('username');
    if (!currentUser) return;

    try {
      // Load both outgoing requests AND received access grants
      const [requestsResponse, accessResponse] = await Promise.all([
        api.get(`/pii-requests/${currentUser}/outgoing`),
        api.get(`/pii-access/${currentUser}/received`)
      ]);

      const requests = requestsResponse.data.requests || [];
      const receivedAccess = accessResponse.data.receivedAccess || [];
      const requestStatus = {};
      
      logger.info('🔍 PII API Responses:');
      logger.info('  Requests:', requests);
      logger.info('  Received Access:', receivedAccess);

      // First, add ONLY pending requests (not approved ones - those must be in receivedAccess)
      requests.forEach(req => {
        // Handle different response formats
        const targetUsername = req.profileUsername || req.requestedUsername || req.profileOwner?.username;
        if (targetUsername && req.requestType && req.status === 'pending') {
          requestStatus[`${targetUsername}_${req.requestType}`] = 'pending';
        }
      });

      // Then, add all received ACTIVE access (these are truly approved grants)
      receivedAccess.forEach(access => {
        const targetUsername = access?.userProfile?.username;
        if (targetUsername && access?.accessTypes) {
          // Mark all access types as 'approved' ONLY if in receivedAccess (isActive: true)
          access.accessTypes.forEach(accessType => {
            requestStatus[`${targetUsername}_${accessType}`] = 'approved';
          });
        }
      });

      logger.info('📊 PII Access Status:', requestStatus);
      setPiiRequests(requestStatus);
    } catch (err) {
      logger.error('❌ Error loading PII requests:', err);
      setPiiRequests({});
    }
  }, []);

  // ===== SEARCH FUNCTIONS =====

  // Main search function
  const handleSearch = useCallback(async (page = 1, overrideMinMatchScore = null, overrideCriteria = null, overrideSort = null) => {
    
    // Cancel any in-flight search request to prevent stale data from overwriting
    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
    }
    const abortController = new AbortController();
    searchAbortRef.current = abortController;

    try {
      setLoading(true);
      startLoadingTimer();
      
      if (page === 1) {
        resetSearchState();
        loadingPageRef.current = 1; // Reset page tracking ref for new search
      }

      // STEP 1: Apply traditional search filters
      const criteriaToUse = overrideCriteria || searchCriteria;
      const minMatchScoreToUse = overrideMinMatchScore !== null ? overrideMinMatchScore : 0;
      const sortByToUse = overrideSort?.sortBy || sortBy;
      const sortOrderToUse = overrideSort?.sortOrder || sortOrder;

      // Build search query
      const query = new URLSearchParams();
      
      // Add basic criteria
      Object.entries(criteriaToUse).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
          if (Array.isArray(value)) {
            value.forEach(v => query.append(key, v));
          } else {
            query.append(key, value);
          }
        }
      });

      // Add pagination and sorting
      query.append('page', page);
      query.append('limit', '20');
      query.append('sortBy', sortByToUse);
      query.append('sortOrder', sortOrderToUse);

      // Add L3V3L score if applicable
      if (minMatchScoreToUse > 0) {
        query.append('minMatchScore', minMatchScoreToUse);
      }

      logger.info(`🔍 Searching with criteria:`, Object.fromEntries(query));
      
      const response = await api.get(`/search?${query.toString()}`, {
        signal: abortController.signal
      });

      const { users: newUsers, total, serverReturnedCount, serverReturnedFullPage } = response.data;
      
      if (page === 1) {
        setUsers(newUsers || []);
        setCurrentPage(1);
        setTotalResults(total || 0);
        setHasMoreResults(serverReturnedFullPage);
        
        // Auto-select first profile in split view so right panel isn't blank
        if (selectedProfileForDetail && newUsers.length > 0) {
          setSelectedProfileForDetail(newUsers[0]);
        }
      } else {
        // Subsequent pages: append new users and calculate hasMore
        setUsers(prev => {
          const existingUsernames = new Set(prev.map(u => u.username));
          const newUsersFiltered = newUsers.filter(u => !existingUsernames.has(u.username));
          const newTotal = prev.length + newUsersFiltered.length;
          
          // Update ref for tracking
          accumulatedCountRef.current = newTotal;
          
          return [...prev, ...newUsersFiltered];
        });
        
        setCurrentPage(page);
        setHasMoreResults(serverReturnedFullPage);
      }

      setInitialSearchComplete(true);
      setError('');
      
      logger.info(`✅ Search completed - found ${newUsers?.length || 0} users (total: ${total})`);
      
    } catch (err) {
      if (err.name !== 'AbortError') {
        logger.error('❌ Search error:', err);
        setError(err.response?.data?.detail || err.message || 'Search failed');
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
      searchAbortRef.current = null;
    }
  }, [
    searchCriteria, sortBy, sortOrder, selectedProfileForDetail,
    resetSearchState, startLoadingTimer,
    setUsers, setCurrentPage, setTotalResults, setHasMoreResults,
    setInitialSearchComplete, setError, setLoading, setLoadingMore,
    searchAbortRef, loadingPageRef, accumulatedCountRef
  ]);

  // ===== SAVED SEARCHES =====

  // Save search
  const handleSaveSearch = useCallback(async (saveData) => {
    try {
      const username = localStorage.getItem('username');
      if (!username) {
        toastService.error('Please login to save searches');
        return;
      }
      
      const searchName = typeof saveData === 'string' ? saveData : saveData.name;
      const notifications = typeof saveData === 'object' ? saveData.notifications : null;
      
      const searchData = {
        name: searchName.trim(),
        criteria: searchCriteria,
        minMatchScore: 0,
        created_at: new Date().toISOString(),
        ...(notifications && { notifications })
      };
      
      await api.post(`/${username}/saved-searches`, searchData);
      toastService.success(`✅ Search saved: "${searchName}"`);
      loadSavedSearches();
    } catch (err) {
      logger.error('Error saving search:', err);
      toastService.error('Failed to save search. ' + (err.response?.data?.detail || err.message));
    }
  }, [searchCriteria, loadSavedSearches]);

  // ===== USER INTERACTIONS =====

  // Toggle list membership (favorites/shortlist/exclusions)
  const toggleListAction = useCallback(async (listName, apiPath, usersSet, setUsersSet, targetUsername) => {
    const isCurrentlyInList = usersSet.has(targetUsername);
    try {
      if (isCurrentlyInList) {
        await api.delete(apiPath);
        setUsersSet(prev => {
          const newSet = new Set(prev);
          newSet.delete(targetUsername);
          return newSet;
        });
        toastService.success(`Removed from ${listName}`);
      } else {
        await api.post(apiPath, { targetUsername });
        setUsersSet(prev => new Set([...prev, targetUsername]));
        toastService.success(`Added to ${listName}`);
      }
    } catch (err) {
      logger.error(`Error toggling ${listName}:`, err);
      if (err.response?.status === 409) {
        toastService.info(`Already in ${listName}`);
      } else {
        toastService.error(`Failed to update ${listName}`);
      }
    }
  }, []);

  // Handle profile actions (favorite, shortlist, exclude, message)
  const handleProfileAction = useCallback(async (e, targetUsername, action) => {
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }

    const currentUser = localStorage.getItem('username');
    if (!currentUser) {
      toastService.error('Please login to perform this action');
      return;
    }

    if (targetUsername === currentUser) {
      toastService.error('You cannot perform this action on your own profile');
      return;
    }

    switch (action) {
      case 'favorite':
        await toggleListAction(
          'favorites',
          `/favorites/${currentUser}/${targetUsername}`,
          favoritedUsers,
          setFavoritedUsers,
          targetUsername
        );
        break;
        
      case 'shortlist':
        await toggleListAction(
          'shortlist',
          `/shortlist/${currentUser}/${targetUsername}`,
          shortlistedUsers,
          setShortlistedUsers,
          targetUsername
        );
        break;
        
      case 'exclude':
        // This would open exclusion modal
        break;
        
      case 'message':
        // This would open message modal
        break;
        
      default:
        logger.error('Unknown profile action:', action);
        toastService.error('Unknown action');
    }
  }, [
    currentUser, favoritedUsers, setFavoritedUsers,
    shortlistedUsers, setShortlistedUsers,
    toggleListAction
  ]);

  // ===== PII REQUESTS =====

  // Open PII request modal
  const actuallyOpenPIIRequestModal = useCallback(async (user) => {
    const targetUsername = user.username;

    try {
      const currentUser = localStorage.getItem('username');
      const response = await api.post(`/pii-requests/${currentUser}/${targetUsername}`, {
        requestType: 'contact_info'
      });
      
      logger.info('PII request sent:', response.data);
      toastService.success('📨 PII request sent successfully');
    } catch (err) {
      logger.error('Error sending PII request:', err);
      toastService.error('Failed to send PII request');
    }
  }, []);

  // Handle PII request success
  const handlePIIRequestSuccess = useCallback(async () => {
    // Reload PII requests to get updated status
    await loadPiiRequests();
  }, [loadPiiRequests]);

  // ===== UTILITY FUNCTIONS =====

  // Check PII access
  const hasPiiAccess = useCallback((targetUsername, requestType) => {
    // This would check against piiRequests state
    return false; // Placeholder
  }, []);

  return {
    // Data loading
    loadAllInitialData,
    loadOtherData,
    loadOnlineUsers,
    loadPiiRequests,
    
    // Search functions
    handleSearch,
    
    // Saved searches
    handleSaveSearch,
    
    // User interactions
    handleProfileAction,
    toggleListAction,
    
    // PII requests
    actuallyOpenPIIRequestModal,
    handlePIIRequestSuccess,
    hasPiiAccess,
  };
};
