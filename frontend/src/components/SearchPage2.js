import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getImageUrl } from '../utils/urlHelper';
import api, { getDefaultSavedSearch } from '../api';
import { useUserData } from '../hooks/useUserData';
import { useSearchPagination } from '../hooks/useSearchPagination';
import { useSearchViewModes } from '../hooks/useSearchViewModes';
import { useSearchState } from '../hooks/useSearchState';
import { useSearchActions } from '../hooks/useSearchActions';
import SearchResultCard from './SearchResultCard';
import SwipeableCard from './SwipeableCard';
import MessageModal from './MessageModal';
import SaveSearchModal from './SaveSearchModal';
import PIIRequestModal from './PIIRequestModal';
import ChatFirstPrompt from './ChatFirstPrompt';
import UniversalTabContainer from './UniversalTabContainer';
import SearchFilters from './SearchFilters';
import Profile from './Profile';
import GraphView from './GraphView';
import toastService from '../services/toastService';
import ToastContainer from './ToastContainer';
import useActivityLogger from '../hooks/useActivityLogger';
import { onPIIAccessChange } from '../utils/piiAccessEvents';
import logger from '../utils/logger';
import socketService from '../services/socketService';
import LoadMore from './LoadMore';
import { buildDefaultCriteria, normalizeDaysBackValue } from '../utils/searchDefaults';
import { generateSearchDescription } from '../utils/searchDescription';
import useSavedSearches from '../hooks/useSavedSearches';
import useInitialSearchBootstrap from '../hooks/useInitialSearchBootstrap';
import { useContribution } from '../contexts/ContributionContext';
import SavedSearchesPanel from './search/SavedSearchesPanel';
import './SearchFiltersModal.css';
import './SearchPage2.css';

const SearchPage2 = () => {
  // Activity logger hook
  const { logPageVisit, logSearchResultsViewed } = useActivityLogger();
  
  // ===== USER PROFILE STATE =====
  // Must be declared before hooks that use it
  const [currentUserProfile, setCurrentUserProfile] = useState({});
  
  // ===== USER DATA HOOK =====
  const userData = useUserData();
  const {
    favoritedUsers, setFavoritedUsers,
    shortlistedUsers, setShortlistedUsers,
    excludedUsers, setExcludedUsers,
    loadUserData,
    // toggleListAction is now managed by useSearchActions hook
    // Functions below are now managed by useSearchActions hook
  } = userData;

  // Read & clear pendingSearchAction exactly once per page load.
  // useState's initializer runs per component instance; in StrictMode the
  // second mount sees an empty sessionStorage and returns null. The bootstrap
  // hook combines this captured value with its own module-level guard to
  // ensure the action is processed at most once per page session.
  const { openPopup: openContributionPopup, shouldShowContribution } = useContribution();
  const [showMatchScoreModal, setShowMatchScoreModal] = useState(false);

  const [pendingSearchAction] = useState(() => {
    try {
      const raw = sessionStorage.getItem('pendingSearchAction');
      if (!raw) return null;
      sessionStorage.removeItem('pendingSearchAction');
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  });

  // Late-bind ref for filter actions used by useSearchActions. The actual
  // load* functions are declared lower in this component, so we expose a
  // stable proxy that delegates to the latest implementations via a ref.
  const filterActionsRef = useRef({
    loadSavedSearches: () => {},
    loadOccupationOptions: () => {},
    loadLocationOptions: () => {},
  });
  // Ref-latest for the TopBar listener so it never needs to re-register.
  const handleLoadSavedSearchRef = useRef(null);
  const filterActionsProxy = useMemo(() => ({
    loadSavedSearches: (...args) => filterActionsRef.current.loadSavedSearches?.(...args),
    loadOccupationOptions: (...args) => filterActionsRef.current.loadOccupationOptions?.(...args),
    loadLocationOptions: (...args) => filterActionsRef.current.loadLocationOptions?.(...args),
  }), []);
  
  // ===== SEARCH STATE HOOK =====
  const searchState = useSearchState();
  const {
    users, setUsers,
    searchCriteria, setSearchCriteria,
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
    viewMode, setViewMode,
    cardsPerRow, setCardsPerRow,
    swipeIndex, setSwipeIndex,
    selectedProfileForDetail, setSelectedProfileForDetail,
    expandedSections, setExpandedSections,
    columnWidths, setColumnWidths,
    excludedProfileMessage,
    excludedProfileId,
    excludedProfileUsername,
    hasAutoExecutedRef,
    searchResultsRef,
    loadMoreTriggerRef,
    loadingPageRef,
    searchAbortRef,
    accumulatedCountRef,
  } = searchState;
  
  // ===== SEARCH ACTIONS HOOK =====
  const searchActions = useSearchActions(
    // searchState - now using real state from useSearchState
    searchState,
    // userState
    {
      currentUserProfile,
      favoritedUsers, setFavoritedUsers,
      shortlistedUsers, setShortlistedUsers,
      excludedUsers, setExcludedUsers,
    },
    // filterState - late-bound proxy to the real load* functions defined
    // further down. Stable reference to avoid retriggering useCallback deps.
    filterActionsProxy
  );
  const {
    handleSearch: handleSearchHook,
    handleProfileAction: handleProfileActionHook,
    hasPiiAccess: hasPiiAccessHook,
    actuallyOpenPIIRequestModal,
    handlePIIRequestSuccess: handlePIIRequestSuccessHook,
  } = searchActions;
  
  // ===== SEARCH PAGINATION HOOK =====
  // Now using real state from useSearchState
  const pagination = useSearchPagination(searchState, handleSearchHook);
  const {
    handleLoadMore,
    manualLoadMore,
    resetPagination,
    canLoadMore,
    getCurrentPageInfo,
    getPaginationProgress,
    getEstimatedTotal,
    isLoadingMore,
  } = pagination;
  
  // ===== SEARCH VIEW MODES HOOK =====
  // Now using real state from useSearchState
  const viewModes = useSearchViewModes(searchState);
  const {
    // View mode actions
    changeViewMode,
    // Non-conflicting hook functions
    nextCard: handleNextSwipe,
    previousCard: handlePreviousSwipe,
    clearSelectedProfile,
    resetSwipe,
    isSplitView: isSplitMode,
    isSwipeView: isSwipeMode,
    isCardsView: isCardsMode,
    isRowsView: isRowsMode,
    getSwipeProgress,
    isAtSwipeEnd,
    isAtSwipeStart,
    getVisibleUsers,
    availableViewModes,
    cardsPerRowOptions,
    getViewModeInfo: getViewModeConfig,
  } = viewModes;
  
  // Saved searches state (selected + UI state owned by parent;
  // list state + CRUD + inline schedule editor live in useSavedSearches).
  const [selectedSearch, setSelectedSearch] = useState(null);
  const [showSavedSearches, setShowSavedSearches] = useState(false);
  const [inlineTabsDefaultTab, setInlineTabsDefaultTab] = useState(null);
  const [inlineTabsNonce, setInlineTabsNonce] = useState(0);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [editingScheduleFor, setEditingScheduleFor] = useState(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isNearMeLoading, setIsNearMeLoading] = useState(false);
  const [nearMeStatus, setNearMeStatus] = useState({
    visible: false,
    type: 'info',
    title: '',
    message: ''
  });
  const [nearMeExecutionContext, setNearMeExecutionContext] = useState({
    visible: false,
    type: 'info',
    message: ''
  });
  const nearMeStatusTimerRef = useRef(null);
  
  // Modal state
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [selectedUserForMessage, setSelectedUserForMessage] = useState(null);
  const [showPIIRequestModal, setShowPIIRequestModal] = useState(false);
  const [selectedUserForPII, setSelectedUserForPII] = useState(null);
  const [showExclusionModal, setShowExclusionModal] = useState(false);
  const [selectedUserForExclusion, setSelectedUserForExclusion] = useState(null);
  const [exclusionLoading, setExclusionLoading] = useState(false);
  
  // PII access state
  const [piiRequests, setPiiRequests] = useState({});
  const [currentPIIAccess, setCurrentPIIAccess] = useState({});
  
  // Additional refs needed for functionality
  // searchResultsRef and hasAutoExecutedRef already declared above
  
  // Additional state variables
  const [pendingPIIRequestUser, setPendingPIIRequestUser] = useState(null);
  const [showChatFirstPrompt, setShowChatFirstPrompt] = useState(false);
  
  // Exclusion preview state
  const [showExclusionPreview, setShowExclusionPreview] = useState(false);
  const [exclusionPreviewData, setExclusionPreviewData] = useState(null);
  
  // ===== VIEW MODE HANDLERS =====
  const handleViewModeChange = (mode) => {
    changeViewMode(mode);
  };
  
  // Profile action handler that wraps the hook and handles special cases
  const handleProfileAction = async (e, targetUsername, action) => {
    const result = await handleProfileActionHook(e, targetUsername, action);
    
    // Handle special return values from hook
    if (result?.type === 'exclude') {
      // Open exclusion preview modal
      const user = users.find(u => u.username === targetUsername);
      if (user) {
        setSelectedUserForExclusion(user);
        // Calculate what will be removed
        const exclusionData = {
          target_username: targetUsername,
          messages_count: 0, // Would need to fetch from API
          favorites_count: favoritedUsers.has(targetUsername) ? 1 : 0,
          shortlists_count: shortlistedUsers.has(targetUsername) ? 1 : 0,
          pii_requests_count: 0, // Would need to fetch from API
          pii_access_count: 0, // Would need to fetch from API
          notifications_count: 0, // Would need to fetch from API
          total_items: (favoritedUsers.has(targetUsername) ? 1 : 0) + (shortlistedUsers.has(targetUsername) ? 1 : 0)
        };
        setExclusionPreviewData(exclusionData);
        setShowExclusionPreview(true);
      }
    } else if (result?.type === 'message') {
      // Open message modal
      const user = users.find(u => u.username === targetUsername);
      if (user) {
        handleMessage(user);
      }
    }
  };
  
  // Handle swipe actions in swipe mode
  const handleSwipeAction = async (direction, user) => {
    if (!user) return;
    
    logger.info(`👆 Swipe action: ${direction} for user ${user.username}`);
    
    // Map swipe directions to profile actions
    switch (direction) {
      case 'left': // Pass
        await handleProfileAction(null, user.username, 'exclude');
        // Move to next card after action
        if (swipeIndex < currentRecords.length - 1) {
          handleNextSwipe();
        }
        break;
        
      case 'right': // Favorite
        await handleProfileAction(null, user.username, 'favorite');
        // Move to next card after action
        if (swipeIndex < currentRecords.length - 1) {
          handleNextSwipe();
        }
        break;
        
      case 'up': // Shortlist
        await handleProfileAction(null, user.username, 'shortlist');
        // Move to next card after action
        if (swipeIndex < currentRecords.length - 1) {
          handleNextSwipe();
        }
        break;
        
      case 'down': // Skip/Next
        // Just move to next card without taking action
        if (swipeIndex < currentRecords.length - 1) {
          handleNextSwipe();
        }
        break;
        
      default:
        logger.warn(`Unknown swipe direction: ${direction}`);
    }
  };
  
  // ===== COLUMN RESIZE FUNCTIONALITY =====
  const resizingColumnRef = useRef(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  
  const handleResizeStart = useCallback((e, columnKey) => {
    e.preventDefault();
    e.stopPropagation();
    resizingColumnRef.current = columnKey;
    startXRef.current = e.clientX;
    startWidthRef.current = columnWidths[columnKey];
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [columnWidths]);

  const handleResizeMove = useCallback((e) => {
    if (!resizingColumnRef.current) return;
    const diff = e.clientX - startXRef.current;
    const newWidth = Math.max(30, startWidthRef.current + diff);
    setColumnWidths(prev => ({
      ...prev,
      [resizingColumnRef.current]: newWidth
    }));
  }, []);

  const handleResizeEnd = useCallback(() => {
    resizingColumnRef.current = null;
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, [handleResizeMove]);
  
  // ===== MAIN APPLICATION STATE =====
  // Note: Most state is now managed by useSearchState hook above
  const searchFiltersPanelRef = useRef(null);
  const [isFiltersPanelExpanded, setIsFiltersPanelExpanded] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // Inline schedule editor state, list state, and CRUD all live in this hook.
  // Cross-talk via callbacks: clear selectedSearch on delete; close modals on save.
  const {
    savedSearches,
    loadSavedSearches,
    handleSaveSearch: handleSaveSearchHook,
    handleUpdateSavedSearch,
    handleDeleteSavedSearch,
    handleSetDefaultSearch,
    editingScheduleSearch,
    scheduleEnabled,
    setScheduleEnabled,
    savingSchedule,
    startInlineScheduleEdit,
    cancelInlineScheduleEdit,
    saveInlineSchedule
  } = useSavedSearches({
    onAfterDelete: (searchId) => {
      if (selectedSearch && (selectedSearch.id === searchId || selectedSearch._id === searchId)) {
        setSelectedSearch(null);
      }
    },
    onAfterSave: () => {
      setShowSaveModal(false);
      setEditingScheduleFor(null);
    }
  });
  
  // HYBRID SEARCH: Traditional filters + L3V3L match score (premium feature)
  // State for online users
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  // L3V3L specific state
  const [minMatchScore, setMinMatchScore] = useState(0); // L3V3L match score filter
  const [isPremiumUser, setIsPremiumUser] = useState(false); // Premium status for L3V3L filtering
  const [systemConfig, setSystemConfig] = useState({ enable_l3v3l_for_all: true }); // System configuration
  const [isAdmin, setIsAdmin] = useState(false); // Admin role check for clear vs reset behavior
  
  // Session restore ref
  const hasRestoredStateRef = useRef(false);
  
  // Refs are now handled in the pagination hook section

  // Sort state is now managed by useSearchState hook

  // Column resize functions are now handled by useSearchViewModes hook

  const navigate = useNavigate();
  
  // Get user-specific sessionStorage key to prevent cross-user session contamination
  const getSessionStorageKey = (baseKey) => {
    const currentUser = localStorage.getItem('username');
    return currentUser ? `${baseKey}_${currentUser}` : baseKey;
  };

  // CRITICAL: Clear users on component mount - MUST be FIRST useEffect
  // This prevents stale data from previous sessions showing before new search runs
  // NOTE: Do NOT clear sessionStorage here — the restore useEffect handles
  // stale/expired/wrong-user states. Clearing here defeats session restore entirely.
  useEffect(() => {
    logger.info('🧹 FIRST useEffect - clearing stale users on mount');
    setUsers([]);
  }, []);

  // Save search state to sessionStorage whenever it changes
  useEffect(() => {
    if (users.length > 0 && hasRestoredStateRef.current) {
      const currentUser = localStorage.getItem('username');
      const searchState = {
        users,
        searchCriteria,
        sortBy,
        sortOrder,
        viewMode,
        currentPage,
        totalResults,
        hasMoreResults,
        minMatchScore,
        favoritedUsers: Array.from(favoritedUsers),
        shortlistedUsers: Array.from(shortlistedUsers),
        excludedUsers: Array.from(excludedUsers),
        selectedSearch,
        selectedProfileForDetail,
        timestamp: Date.now(),
        savedByUser: currentUser // Track which user saved this state
      };
      sessionStorage.setItem(getSessionStorageKey('searchPageState'), JSON.stringify(searchState));
      logger.info('💾 Saved search state to sessionStorage for user:', currentUser);
    }
  }, [users, searchCriteria, sortBy, sortOrder, viewMode, currentPage, totalResults, hasMoreResults, minMatchScore, favoritedUsers, shortlistedUsers, excludedUsers, selectedSearch, selectedProfileForDetail]);
  
  // Handle split view: sync selected profile with current results
  useEffect(() => {
    if (viewMode === 'split') {
      if (users.length === 0) {
        // Clear selected profile when no results
        if (selectedProfileForDetail !== null) {
          logger.info('📱 Split view: Clearing selected profile (no results)');
          setSelectedProfileForDetail(null);
        }
      } else if (!selectedProfileForDetail || !users.find(u => u.username === selectedProfileForDetail.username)) {
        // Auto-select first profile if none selected or current selection not in results
        logger.info('📱 Split view: Auto-selecting first profile');
        setSelectedProfileForDetail(users[0]);
      }
    }
  }, [viewMode, users, selectedProfileForDetail]);
  
  // Save scroll position before navigating away
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (searchResultsRef.current) {
        const scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
        sessionStorage.setItem(getSessionStorageKey('searchPageScrollPosition'), scrollPosition.toString());
        logger.info('💾 Saved scroll position:', scrollPosition);
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Copy ref to variable for cleanup function
    const resultsRef = searchResultsRef.current;
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Save scroll position when component unmounts (navigating to profile)
      if (resultsRef) {
        const scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
        sessionStorage.setItem(getSessionStorageKey('searchPageScrollPosition'), scrollPosition.toString());
        logger.info('💾 Saved scroll position on unmount:', scrollPosition);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Restore search state from sessionStorage on mount
  useEffect(() => {
    const restoreSearchState = () => {
      const currentUser = localStorage.getItem('username');
      // Use user-specific key to prevent cross-user session contamination
      const storageKey = currentUser ? `searchPageState_${currentUser}` : 'searchPageState';
      const scrollKey = currentUser ? `searchPageScrollPosition_${currentUser}` : 'searchPageScrollPosition';
      
      try {
        const savedState = sessionStorage.getItem(storageKey);
        if (savedState) {
          const state = JSON.parse(savedState);
          
          // SECURITY: Verify the saved state belongs to the current user
          if (state.savedByUser && state.savedByUser !== currentUser) {
            logger.warn('⚠️ Saved state belongs to different user, clearing...');
            sessionStorage.removeItem(storageKey);
            sessionStorage.removeItem(scrollKey);
            return false;
          }
          
          // Check if state is recent (within last 30 minutes)
          const stateAge = Date.now() - (state.timestamp || 0);
          const maxAge = 30 * 60 * 1000; // 30 minutes
          
          if (stateAge < maxAge && state.users && state.users.length > 0) {
            logger.info('🔄 Restoring search state from sessionStorage with', state.users.length, 'users for user:', currentUser);
            
            // 🔍 GENDER VALIDATION: Filter out users that don't match the saved gender filter
            // This prevents showing wrong-gender profiles from stale cache
            let usersToRestore = state.users;
            const savedGender = state.searchCriteria?.gender;
            if (savedGender) {
              const genderCapitalized = savedGender.charAt(0).toUpperCase() + savedGender.slice(1).toLowerCase();
              const beforeCount = usersToRestore.length;
              usersToRestore = usersToRestore.filter(u => u.gender === genderCapitalized);
              const afterCount = usersToRestore.length;
              if (beforeCount !== afterCount) {
                logger.warn(`🚨 GENDER FILTER: Removed ${beforeCount - afterCount} users with wrong gender from cache. Expected: ${genderCapitalized}`);
              }
            }
            
            // If all users were filtered out, don't restore - force fresh search
            if (usersToRestore.length === 0) {
              logger.warn('🚨 All cached users had wrong gender, clearing cache and forcing fresh search');
              sessionStorage.removeItem(storageKey);
              sessionStorage.removeItem(scrollKey);
              return false;
            }
            
            // IMPORTANT: Set refs FIRST before any state updates to prevent race conditions
            hasRestoredStateRef.current = true;
            // NOTE: Do NOT set hasAutoExecutedRef.current = true here!
            // We want loadAndExecuteDefaultSearch to run and execute a fresh search
            // with partnerCriteria defaults to ensure results match displayed filters
            
            // Only restore UI preferences, NOT users or searchCriteria
            // The fresh search will populate users with correct data
            const restoredSortByRaw = state.sortBy || 'age';
            const restoredSortBy = restoredSortByRaw === 'heightInches'
              ? 'height'
              : restoredSortByRaw === 'occupation'
                ? 'profession'
                : restoredSortByRaw === 'name'
                  ? 'firstName'
                  : restoredSortByRaw;
            setSortBy(restoredSortBy);
            setSortOrder(state.sortOrder || 'asc');
            if (state.viewMode) changeViewMode(state.viewMode);
            setMinMatchScore(state.minMatchScore || 0);
            setFavoritedUsers(new Set(state.favoritedUsers || []));
            setShortlistedUsers(new Set(state.shortlistedUsers || []));
            setExcludedUsers(new Set(state.excludedUsers || []));
            // Don't restore selectedSearch - let fresh search determine this
            // Don't restore selectedProfileForDetail - auto-select first result from fresh search instead
            
            // Restore scroll position after a short delay to let DOM render
            setTimeout(() => {
              const savedScrollPosition = sessionStorage.getItem(scrollKey);
              if (savedScrollPosition) {
                const scrollPos = parseInt(savedScrollPosition, 10);
                window.scrollTo(0, scrollPos);
                logger.info('🔄 Restored scroll position:', scrollPos);
              }
            }, 100);
            
            logger.info('✅ Search state restored successfully');
            return true;
          } else if (stateAge >= maxAge) {
            logger.info('⏰ Saved state is too old, clearing...');
            sessionStorage.removeItem(storageKey);
            sessionStorage.removeItem(scrollKey);
          } else {
            logger.info('📭 Saved state has no users, not restoring');
          }
        }
      } catch (error) {
        logger.error('❌ Error restoring search state:', error);
        sessionStorage.removeItem(storageKey);
        sessionStorage.removeItem(scrollKey);
      }
      return false;
    };
    
    // Try to restore state first
    const restored = restoreSearchState();
    if (!restored) {
      hasRestoredStateRef.current = true; // Allow saving state even if nothing was restored
    }
  }, []);

  // Log page visit on mount
  useEffect(() => {
    logPageVisit('Search Page');
  }, [logPageVisit]);


  useEffect(() => {
    const username = localStorage.getItem('username');
    if (!username) {
      navigate('/login');
      return;
    }
    
    // Load all initial data in coordinated way to prevent race conditions
    const loadAllInitialData = async () => {
      try {
        // Load user profile and data in parallel
        const [profileResponse, userDataResponse] = await Promise.all([
          api.get(`/profile/${username}?requester=${username}`).catch(err => {
            logger.error('❌ Error loading profile:', err);
            return { data: null }; // Fallback response
          }),
          Promise.all([
            api.get(`/favorites/${username}`).catch(err => {
              logger.error('❌ Error loading favorites:', err);
              return { data: [] }; // Fallback empty array
            }),
            api.get(`/shortlist/${username}`).catch(err => {
              logger.error('❌ Error loading shortlist:', err);
              return { data: [] }; // Fallback empty array
            }),
            api.get(`/exclusions/${username}`).catch(err => {
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
          setCurrentUserProfile(profileResponse.data);
          const userRole = profileResponse.data.role?.toLowerCase();
          const hasPremium = userRole === 'premium' || userRole === 'admin';
          setIsPremiumUser(hasPremium);
          setIsAdmin(userRole === 'admin' || username === 'admin');
          
          // Compute default criteria for logging
          const defaults = buildDefaultCriteria(profileResponse.data);
          logger.info('🎯 User gender:', profileResponse.data.gender, '→ Default search gender:', defaults.gender);
          logger.info('📊 Default search criteria (from buildDefaultCriteria):', defaults);
        } else {
          logger.warn('⚠️ Profile data not available, using fallback');
          setCurrentUserProfile({});
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
        // Set profile anyway to trigger search
        setCurrentUserProfile({});
      }
    };
    
    // Load other data that doesn't depend on profile
    const loadOtherData = async () => {
      try {
        await Promise.all([
          loadSavedSearches(),
          loadPiiRequests()
        ]);
      } catch (err) {
        logger.error('❌ Error loading other data:', err);
      }
    };
    
    // Load online users function
    const loadOnlineUsers = async () => {
      try {
        const response = await api.get('/online-status/users');
        logger.debug('Loaded online users:', response.data.onlineUsers);
        
        const onlineSet = new Set(response.data.onlineUsers);
        setOnlineUsers(onlineSet);
      } catch (err) {
        logger.error('Error loading online users:', err);
      }
    };
    
    // Execute coordinated loading
    loadAllInitialData();
    loadOtherData();
    loadUserData(); // Load user data from hook

    // Setup online users with delay
    setTimeout(() => {
      loadOnlineUsers();
    }, 1000);
    
    // Refresh online users every 10 seconds
    const onlineUsersInterval = setInterval(() => {
      loadOnlineUsers();
    }, 10000);
    
    // Listen for online status updates
    const handleUserOnline = (data) => {
      logger.debug('User came online:', data.username);
      setOnlineUsers(prev => new Set([...prev, data.username]));
    };
    
    const handleUserOffline = (data) => {
      logger.info('User went offline:', data.username);
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(data.username);
        return newSet;
      });
    };
    
    socketService.on('user_online', handleUserOnline);
    socketService.on('user_offline', handleUserOffline);
    
    return () => {
      socketService.off('user_online', handleUserOnline);
      socketService.off('user_offline', handleUserOffline);
      
      // Clear online users refresh interval
      if (onlineUsersInterval) {
        clearInterval(onlineUsersInterval);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const openFiltersPanel = useCallback(() => {
    setIsFiltersPanelExpanded(true);
    requestAnimationFrame(() => {
      if (searchFiltersPanelRef.current && typeof searchFiltersPanelRef.current.scrollIntoView === 'function') {
        searchFiltersPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }, []);

  const toggleFiltersPanel = useCallback(() => {
    setIsFiltersPanelExpanded((prev) => {
      const next = !prev;
      if (next) {
        requestAnimationFrame(() => {
          if (searchFiltersPanelRef.current && typeof searchFiltersPanelRef.current.scrollIntoView === 'function') {
            searchFiltersPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
      }
      return next;
    });
  }, []);

  // Listen for external "open search modal" events (e.g. from TopBar)
  useEffect(() => {
    const handleOpenModal = () => openFiltersPanel();
    window.addEventListener('openSearchModal', handleOpenModal);
    return () => window.removeEventListener('openSearchModal', handleOpenModal);
  }, [openFiltersPanel]);

  // Trigger initial search after user profile lands.
  // Module-level guard inside the hook prevents StrictMode double-fire and
  // allows sign-out + different-user sign-in to re-bootstrap. If a TopBar
  // pending saved-search action is in flight, the bootstrap skips the
  // default-search path so the pending-action effect can load it cleanly.
  useInitialSearchBootstrap({
    currentUserProfile,
    pendingSearchAction,
    setUsers,
    setSearchCriteria,
    setMinMatchScore,
    setSelectedSearch,
    handleSearchHook
  });
  const loadPiiRequests = async () => {
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
      logger.error('Error loading PII requests:', err);
    }
  };

  // Listen for PII access changes (grant/revoke)
  useEffect(() => {
    const cleanup = onPIIAccessChange((detail) => {
      logger.info('🔔 PII Access changed in search page:', detail);
      // Reload PII requests to update badges
      loadPiiRequests();
    });
    
    return cleanup;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Dating field options
  const [occupationOptions, setOccupationOptions] = useState([]);
  const [locationOptions, setLocationOptions] = useState([]);
  const eatingOptions = ['', 'Vegetarian', 'Vegan', 'Eggetarian', 'Non-Veg'];
  const lifestyleOptions = ['', 'Never', 'Socially', 'Prefer not to say'];
  const bodyTypeOptions = ['', 'Slim', 'Athletic', 'Average', 'Curvy'];

  // Load occupation options dynamically
  const loadOccupationOptions = async () => {
    try {
      const response = await api.get('/search/occupation-options');
      setOccupationOptions(response.data.options || []);
      logger.info(`Loaded ${response.data.count || 0} occupation options`);
    } catch (err) {
      logger.error('Error loading occupation options:', err);
      // Set fallback options if API fails
      setOccupationOptions([
        'Software Engineer', 'Data Scientist', 'Product Manager', 'Business Analyst',
        'Consultant', 'Doctor', 'Chartered Accountant', 'Lawyer', 'Teacher', 'Professor',
        'Architect', 'Designer', 'Marketing Manager', 'Sales Executive', 'HR Manager',
        'Financial Analyst', 'Civil Engineer', 'Mechanical Engineer', 'Pharmacist', 'Nurse',
        'Entrepreneur', 'Banker', 'Government Officer'
      ]);
    }
  };

  // Load occupation options on component mount
  useEffect(() => {
    (async () => {
      try {
        const response = await api.get('/search/occupation-options');
        setOccupationOptions(response.data.options || []);
        logger.info(`Loaded ${response.data.count || 0} occupation options`);
      } catch (err) {
        logger.error('Error loading occupation options:', err);
        setOccupationOptions([
          'Software Engineer', 'Data Scientist', 'Product Manager', 'Business Analyst',
          'Consultant', 'Doctor', 'Chartered Accountant', 'Lawyer', 'Teacher', 'Professor',
          'Architect', 'Designer', 'Marketing Manager', 'Sales Executive', 'HR Manager',
          'Financial Analyst', 'Civil Engineer', 'Mechanical Engineer', 'Pharmacist', 'Nurse',
          'Entrepreneur', 'Banker', 'Government Officer'
        ]);
      }
    })();
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // Load location options dynamically
  const loadLocationOptions = async () => {
    try {
      const response = await api.get('/search/location-options');
      setLocationOptions(response.data.options || []);
      logger.info(`Loaded ${response.data.count || 0} location options`);
    } catch (err) {
      logger.error('Error loading location options:', err);
      // Set fallback options if API fails
      setLocationOptions([
        'California', 'New York', 'Texas', 'Florida', 'Illinois', 'Pennsylvania',
        'Ohio', 'Georgia', 'North Carolina', 'Michigan', 'New Jersey', 'Virginia',
        'Washington', 'Arizona', 'Massachusetts', 'Tennessee', 'Indiana', 'Missouri',
        'Maryland', 'Wisconsin', 'Colorado', 'Minnesota', 'South Carolina', 'Alabama',
        'Louisiana', 'Kentucky', 'Oregon', 'Oklahoma', 'Connecticut', 'Utah', 'Iowa',
        'Nevada', 'Arkansas', 'Mississippi', 'Kansas', 'New Mexico', 'Nebraska',
        'West Virginia', 'Idaho', 'Hawaii', 'New Hampshire', 'Maine', 'Montana',
        'Rhode Island', 'Alaska', 'Delaware', 'North Dakota', 'South Dakota', 'Vermont', 'Wyoming',
        'Nashville, TN', 'Nashville', 'Music City'
      ]);
    }
  };

  // Load location options on component mount
  useEffect(() => {
    (async () => {
      try {
        const response = await api.get('/search/location-options');
        setLocationOptions(response.data.options || []);
        logger.info(`Loaded ${response.data.count || 0} location options`);
      } catch (err) {
        logger.error('Error loading location options:', err);
        setLocationOptions([
          'California', 'New York', 'Texas', 'Florida', 'Illinois', 'Pennsylvania',
          'Ohio', 'Georgia', 'North Carolina', 'Michigan', 'New Jersey', 'Virginia',
          'Washington', 'Arizona', 'Massachusetts', 'Tennessee', 'Indiana', 'Missouri',
          'Maryland', 'Wisconsin', 'Colorado', 'Minnesota', 'South Carolina', 'Alabama',
          'Louisiana', 'Kentucky', 'Oregon', 'Oklahoma', 'Connecticut', 'Utah', 'Iowa',
          'Nevada', 'Arkansas', 'Mississippi', 'Kansas', 'New Mexico', 'Nebraska',
          'West Virginia', 'Idaho', 'Hawaii', 'New Hampshire', 'Maine', 'Montana',
          'Rhode Island', 'Alaska', 'Delaware', 'North Dakota', 'South Dakota', 'Vermont', 'Wyoming',
          'Nashville, TN', 'Nashville', 'Music City'
        ]);
      }
    })();
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // NOTE: Standalone loadUserFavorites, loadUserShortlist, loadUserExclusions
  // were removed — they duplicated the loadUserData() function (which uses
  // Promise.all) and were never called. loadSavedSearches now lives in
  // useSavedSearches hook (see top of component).

  // Keep filterActionsRef pointing at the latest implementations so
  // useSearchActions (which captured a stable proxy) calls into the
  // current closures (e.g., handleSaveSearch refreshes the list).
  filterActionsRef.current.loadSavedSearches = loadSavedSearches;
  filterActionsRef.current.loadOccupationOptions = loadOccupationOptions;
  filterActionsRef.current.loadLocationOptions = loadLocationOptions;

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    logger.info(`🔧 Input changed: ${name} = ${value}`);
    setSearchCriteria(prev => {
      const normalizedValue = type === 'checkbox'
        ? checked
        : (name === 'daysBack' ? normalizeDaysBackValue(value, prev.daysBack ?? 30) : value);

      const next = {
        ...prev,
        [name]: normalizedValue
      };

      if (name === 'locations') {
        next.location = '';
      }

      if (name === 'state' && !normalizedValue) {
        next.location = '';
      }

      return next;
    });
    setNearMeExecutionContext((prev) => ({ ...prev, visible: false, message: '' }));
  };

  const handlePrimarySearch = useCallback(() => {
    setNearMeExecutionContext((prev) => ({ ...prev, visible: false, message: '' }));
    handleSearchHook(1);
  }, [handleSearchHook]);

  const clearNearMeExecutionContext = useCallback(() => {
    setNearMeExecutionContext((prev) => ({ ...prev, visible: false, message: '' }));
  }, []);

  // Calculate default search criteria from user profile and partnerCriteria
  // Delegates to shared buildDefaultCriteria utility
  const getDefaultSearchCriteria = () => {
    const defaults = buildDefaultCriteria(currentUserProfile);
    logger.info('🔄 Reset: computed defaults from buildDefaultCriteria:', defaults);
    return defaults;
  };

  const buildPartnerCriteriaPayload = useCallback((defaults, city = '', state = '') => ({
    keyword: '',
    profileId: '',
    gender: defaults.gender || '',
    ageMin: defaults.ageMin || '',
    ageMax: defaults.ageMax || '',
    heightMin: '',
    heightMax: '',
    heightMinFeet: defaults.heightMinFeet || '',
    heightMinInches: defaults.heightMinInches || '',
    heightMaxFeet: defaults.heightMaxFeet || '',
    heightMaxInches: defaults.heightMaxInches || '',
    location: city,
    locations: city ? [city] : [],
    state,
    education: '',
    occupation: '',
    occupations: [],
    religion: '',
    caste: '',
    eatingPreference: '',
    drinking: '',
    smoking: '',
    relationshipStatus: '',
    bodyType: '',
    newlyAdded: false,
    daysBack: normalizeDaysBackValue(defaults.daysBack, 0),
    hasPhoto: true
  }), []);

  const normalizeCriteriaForSearch = useCallback((rawCriteria = {}) => {
    const criteria = { ...rawCriteria };

    if (criteria.occupation && !criteria.occupations) {
      criteria.occupations = [criteria.occupation];
      delete criteria.occupation;
    } else if (!criteria.occupations) {
      criteria.occupations = [];
    }

    if (criteria.location && !criteria.locations) {
      criteria.locations = [criteria.location];
      delete criteria.location;
    } else if (!criteria.locations) {
      criteria.locations = [];
    }

    if (!criteria.state) {
      criteria.state = '';
    }

    const criteriaWithDefaults = {
      ...criteria,
      daysBack: normalizeDaysBackValue(criteria.daysBack, 0),
      hasPhoto: criteria.hasPhoto !== undefined ? criteria.hasPhoto : true
    };

    const userRole = currentUserProfile?.role?.toLowerCase();
    const isPrivileged = userRole === 'admin' || userRole === 'moderator';
    if (!isPrivileged) {
      const defaults = buildDefaultCriteria(currentUserProfile);
      if (defaults.gender && criteriaWithDefaults.gender !== defaults.gender) {
        logger.info(`🚻 Overriding saved search gender '${criteriaWithDefaults.gender}' → '${defaults.gender}'`);
        criteriaWithDefaults.gender = defaults.gender;
      }
    }

    return criteriaWithDefaults;
  }, [currentUserProfile]);

  // Wrapper for minMatchScore changes - triggers new search
  const handleMinMatchScoreChange = (newScore) => {
    setMinMatchScore(newScore);
    // Note: L3V3L filtering is done client-side after server results
  };

  // Keep sort values canonical so UI state and backend sort mapping stay aligned.
  const normalizeSortBy = useCallback((rawSortBy) => {
    const key = (rawSortBy || '').toString().trim();
    switch (key) {
      case 'name':
        return 'firstName';
      case 'heightInches':
        return 'height';
      case 'occupation':
        return 'profession';
      default:
        return key || 'newest';
    }
  }, []);

  const getDefaultSortOrderForField = useCallback((field) => {
    const normalizedField = normalizeSortBy(field);
    switch (normalizedField) {
      case 'matchScore':
      case 'newest':
      case 'age':
      case 'height':
        return 'desc';
      default:
        return 'asc';
    }
  }, [normalizeSortBy]);

  const applyServerSort = useCallback((rawSortBy, requestedSortOrder = null) => {
    const nextSortBy = normalizeSortBy(rawSortBy);
    const nextSortOrder = requestedSortOrder || getDefaultSortOrderForField(nextSortBy);

    logger.info(`🔀 Applying server sort: ${nextSortBy} (${nextSortOrder})`);
    setSortBy(nextSortBy);
    setSortOrder(nextSortOrder);

    // Prevent stale load-more observer from firing while a sort refresh is in flight.
    setLoadingMore(false);
    setHasMoreResults(false);

    clearNearMeExecutionContext();
    handleSearchHook(1, minMatchScore, searchCriteria, {
      sortBy: nextSortBy,
      sortOrder: nextSortOrder
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [
    clearNearMeExecutionContext,
    getDefaultSortOrderForField,
    handleSearchHook,
    minMatchScore,
    normalizeSortBy,
    searchCriteria,
    setHasMoreResults,
    setLoadingMore,
    setSortBy,
    setSortOrder
  ]);

  const handleSortChange = useCallback((e) => {
    const newSortBy = normalizeSortBy(e.target.value);
    if (newSortBy === 'matchScore') {
      if (shouldShowContribution) {
        setShowMatchScoreModal(true);
        e.target.value = normalizeSortBy(sortBy);
        return;
      }
      applyServerSort('matchScore', 'desc');
      return;
    }
    const currentSortBy = normalizeSortBy(sortBy);
    const nextSortOrder = currentSortBy === newSortBy
      ? sortOrder
      : getDefaultSortOrderForField(newSortBy);
    applyServerSort(newSortBy, nextSortOrder);
  }, [applyServerSort, getDefaultSortOrderForField, normalizeSortBy, shouldShowContribution, sortBy, sortOrder]);

  const handleMatchScoreModalContinue = useCallback(() => {
    setShowMatchScoreModal(false);
    applyServerSort('matchScore', 'desc');
  }, [applyServerSort]);

  const handleMatchScoreModalContribute = useCallback(() => {
    setShowMatchScoreModal(false);
    openContributionPopup();
  }, [openContributionPopup]);

  const handleMatchScoreModalCancel = useCallback(() => {
    setShowMatchScoreModal(false);
  }, []);

  const toggleSortOrder = useCallback(() => {
    const nextOrder = sortOrder === 'desc' ? 'asc' : 'desc';
    applyServerSort(sortBy, nextOrder);
  }, [applyServerSort, sortBy, sortOrder]);

  const handleColumnSort = useCallback((columnSortBy, firstClickOrder = 'asc') => {
    const normalizedColumnSortBy = normalizeSortBy(columnSortBy);
    const currentSortBy = normalizeSortBy(sortBy);
    const nextSortOrder = currentSortBy === normalizedColumnSortBy
      ? (sortOrder === 'asc' ? 'desc' : 'asc')
      : firstClickOrder;

    applyServerSort(normalizedColumnSortBy, nextSortOrder);
  }, [applyServerSort, normalizeSortBy, sortBy, sortOrder]);

  const handleQuickDaysBackChange = useCallback((nextDaysBack) => {
    const normalizedDaysBack = normalizeDaysBackValue(nextDaysBack, 0);
    const nextCriteria = {
      ...searchCriteria,
      daysBack: normalizedDaysBack
    };
    setSearchCriteria(nextCriteria);
    // Only clear the selected-saved-search badge if the chip actually
    // diverges from the saved search's daysBack. If they already match,
    // the user is still effectively "on" the saved search.
    if (selectedSearch) {
      const savedDaysBack = normalizeDaysBackValue(selectedSearch?.criteria?.daysBack, 0);
      if (savedDaysBack !== normalizedDaysBack) {
        setSelectedSearch(null);
      }
    }
    clearNearMeExecutionContext();
    handleSearchHook(1, minMatchScore, nextCriteria);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [clearNearMeExecutionContext, handleSearchHook, minMatchScore, searchCriteria, setSearchCriteria, selectedSearch]);

  const handleClearFilters = () => {
    // Admin: Clear all fields (widest search)
    // Non-admin: Reset to partner criteria defaults
    const defaults = getDefaultSearchCriteria();
    
    if (isAdmin) {
      // ADMIN: Clear all fields - widest possible search
      setSearchCriteria({
        keyword: '',
        profileId: '',
        gender: defaults.gender, // Keep opposite gender only
        ageMin: '', // Empty - search all ages
        ageMax: '',
        heightMin: '',
        heightMax: '',
        heightMinFeet: '', // Empty - search all heights
        heightMinInches: '',
        heightMaxFeet: '',
        heightMaxInches: '',
        location: '',
        locations: [],
        state: '',
        education: '',
        occupation: '',
        occupations: [],
        religion: '',
        caste: '',
        eatingPreference: '',
        drinking: '',
        smoking: '',
        relationshipStatus: '',
        bodyType: '',
        newlyAdded: false,
        daysBack: 0,
        hasPhoto: true
      });
      setNearMeExecutionContext((prev) => ({ ...prev, visible: false, message: '' }));
      logger.info('🧹 Admin: Cleared all search filters');
    } else {
      // NON-ADMIN: Reset to partner criteria defaults (smart defaults)
      setSearchCriteria({
        keyword: '',
        profileId: '',
        gender: defaults.gender,
        ageMin: defaults.ageMin, // From partner criteria or gender-based defaults
        ageMax: defaults.ageMax,
        heightMin: '',
        heightMax: '',
        heightMinFeet: defaults.heightMinFeet, // From partner criteria or gender-based defaults
        heightMinInches: defaults.heightMinInches,
        heightMaxFeet: defaults.heightMaxFeet,
        heightMaxInches: defaults.heightMaxInches,
        location: '',
        locations: [],
        state: '',
        education: '',
        occupation: '',
        occupations: [],
        religion: '',
        caste: '',
        eatingPreference: '',
        drinking: '',
        smoking: '',
        relationshipStatus: '',
        bodyType: '',
        newlyAdded: false,
        daysBack: defaults.daysBack ?? 0,
        hasPhoto: true
      });
      setNearMeExecutionContext((prev) => ({ ...prev, visible: false, message: '' }));
      logger.info('🔄 Non-admin: Reset to partner criteria defaults:', defaults);
    }
    
    setUsers([]);
    setMinMatchScore(0); // Reset L3V3L compatibility score
    setSelectedSearch(null); // Clear selected search badge
    setCurrentPage(1); // Reset pagination
    setTotalResults(0);
    setHasMoreResults(true);
  };

  // Update elapsed time while loading
  useEffect(() => {
    let interval;
    if (loadingStartTime) {
      interval = setInterval(() => {
        setElapsedTime(((Date.now() - loadingStartTime) / 1000).toFixed(1));
      }, 100);
    } else {
      setElapsedTime(0);
    }
    return () => clearInterval(interval);
  }, [loadingStartTime]);

  // Pagination functions are now handled by useSearchPagination hook


  const handleLoadSavedSearch = useCallback((savedSearch) => {
    const criteriaWithDefaults = normalizeCriteriaForSearch(savedSearch.criteria || {});
    
    setSearchCriteria(criteriaWithDefaults);
    // Restore L3V3L match score if saved
    const loadedMinScore = savedSearch.minMatchScore !== undefined ? savedSearch.minMatchScore : 0;
    setMinMatchScore(loadedMinScore);
    setSelectedSearch(savedSearch);
    setShowSavedSearches(false);
    toastService.info(`📂 Loaded saved search: "${savedSearch.name}"`);

    clearNearMeExecutionContext();
    handleSearchHook(1, loadedMinScore, criteriaWithDefaults);
  }, [clearNearMeExecutionContext, handleSearchHook, normalizeCriteriaForSearch]);

  const executeDefaultSavedOrPartnerSearch = useCallback(async () => {
    try {
      const response = await getDefaultSavedSearch();
      const defaultSearch = response?.savedSearch || response;
      if (defaultSearch?.criteria) {
        const normalizedCriteria = normalizeCriteriaForSearch(defaultSearch.criteria);
        const loadedMinScore = defaultSearch.minMatchScore !== undefined ? defaultSearch.minMatchScore : 0;
        setSearchCriteria(normalizedCriteria);
        setMinMatchScore(loadedMinScore);
        setSelectedSearch(defaultSearch);
        clearNearMeExecutionContext();
        handleSearchHook(1, loadedMinScore, normalizedCriteria);
        return;
      }
    } catch (err) {
      logger.info('No default saved search found for New Me fallback, using partner defaults');
    }

    const partnerDefaults = getDefaultSearchCriteria();
    const fallbackCriteria = buildPartnerCriteriaPayload(partnerDefaults);
    setSearchCriteria(fallbackCriteria);
    setMinMatchScore(0);
    setSelectedSearch(null);
    clearNearMeExecutionContext();
    handleSearchHook(1, 0, fallbackCriteria);
  }, [buildPartnerCriteriaPayload, clearNearMeExecutionContext, getDefaultSearchCriteria, handleSearchHook, normalizeCriteriaForSearch]);

  const reverseGeocodeLocation = useCallback(async (lat, lon) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`,
        {
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
            'Accept-Language': 'en'
          }
        }
      );
      if (!response.ok) return { city: '', state: '' };
      const data = await response.json();
      const address = data?.address || {};
      const city = (
        address.city ||
        address.town ||
        address.village ||
        address.municipality ||
        ''
      );
      const state = address.state || '';
      return { city, state };
    } catch (err) {
      logger.warn('Reverse geocode failed for New Me:', err);
      return { city: '', state: '' };
    } finally {
      clearTimeout(timeoutId);
    }
  }, []);

  const reverseGeocodeCity = useCallback(async (lat, lon) => {
    const locationData = await reverseGeocodeLocation(lat, lon);
    return locationData.city;
  }, [reverseGeocodeLocation]);

  const sampleCitiesWithinRadius = useCallback(async (lat, lon, radiusMiles = 100) => {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const toDeg = (rad) => (rad * 180) / Math.PI;
    const earthRadiusMiles = 3958.8;

    const destinationPoint = (startLat, startLon, distanceMiles, bearingDeg) => {
      const brng = toRad(bearingDeg);
      const dByR = distanceMiles / earthRadiusMiles;
      const lat1 = toRad(startLat);
      const lon1 = toRad(startLon);

      const lat2 = Math.asin(
        Math.sin(lat1) * Math.cos(dByR) +
        Math.cos(lat1) * Math.sin(dByR) * Math.cos(brng)
      );
      const lon2 = lon1 + Math.atan2(
        Math.sin(brng) * Math.sin(dByR) * Math.cos(lat1),
        Math.cos(dByR) - Math.sin(lat1) * Math.sin(lat2)
      );

      return { lat: toDeg(lat2), lon: toDeg(lon2) };
    };

    const bearings = [0, 45, 90, 135, 180, 225, 270, 315];
    const ringDistances = [radiusMiles * 0.5, radiusMiles];
    const points = [];
    ringDistances.forEach((distance) => {
      bearings.forEach((bearing) => {
        points.push(destinationPoint(lat, lon, distance, bearing));
      });
    });

    const citySet = new Map();
    for (const point of points) {
      const sampledCity = await reverseGeocodeCity(point.lat, point.lon);
      const normalized = String(sampledCity || '').trim();
      if (!normalized) continue;
      const key = normalized.toLowerCase();
      if (!citySet.has(key)) {
        citySet.set(key, normalized);
      }
    }

    return Array.from(citySet.values());
  }, [reverseGeocodeCity]);

  const showNearMeStatus = useCallback((nextStatus, autoHideMs = 0) => {
    if (nearMeStatusTimerRef.current) {
      clearTimeout(nearMeStatusTimerRef.current);
      nearMeStatusTimerRef.current = null;
    }

    setNearMeStatus({
      visible: true,
      type: nextStatus?.type || 'info',
      title: nextStatus?.title || 'Near Me',
      message: nextStatus?.message || ''
    });

    if (autoHideMs > 0) {
      nearMeStatusTimerRef.current = setTimeout(() => {
        setNearMeStatus((prev) => ({ ...prev, visible: false }));
        nearMeStatusTimerRef.current = null;
      }, autoHideMs);
    }
  }, []);

  const dismissNearMeStatus = useCallback(() => {
    if (nearMeStatusTimerRef.current) {
      clearTimeout(nearMeStatusTimerRef.current);
      nearMeStatusTimerRef.current = null;
    }
    setNearMeStatus((prev) => ({ ...prev, visible: false }));
  }, []);

  useEffect(() => {
    return () => {
      if (nearMeStatusTimerRef.current) {
        clearTimeout(nearMeStatusTimerRef.current);
        nearMeStatusTimerRef.current = null;
      }
    };
  }, []);

  const fetchNearbyCitiesWithinRadius = useCallback(async (lat, lon, radiusMiles = 30) => {
    const radiusMeters = Math.round(radiusMiles * 1609.34);
    const overpassQuery = `
      [out:json][timeout:8];
      (
        node(around:${radiusMeters},${lat},${lon})["place"~"city|town|village|suburb"];
        way(around:${radiusMeters},${lat},${lon})["place"~"city|town|village|suburb"];
        relation(around:${radiusMeters},${lat},${lon})["place"~"city|town|village|suburb"];
      );
      out tags center;
    `;

    const overpassEndpoints = [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
      'https://lz4.overpass-api.de/api/interpreter'
    ];

    for (const endpoint of overpassEndpoints) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 9000);
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
          },
          body: `data=${encodeURIComponent(overpassQuery)}`
        });

        if (!response.ok) {
          logger.warn(`Near Me: Overpass endpoint failed (${response.status})`, { endpoint });
          continue;
        }

        const data = await response.json();
        const unique = new Map();
        (data?.elements || []).forEach((el) => {
          const name = (el?.tags?.name || '').trim();
          if (!name) return;
          const key = name.toLowerCase();
          if (!unique.has(key)) unique.set(key, name);
        });

        const cities = Array.from(unique.values()).slice(0, 20);
        logger.info(`Near Me: Overpass endpoint succeeded with ${cities.length} nearby cities`, { endpoint });
        return {
          cities,
          allEndpointsFailed: false
        };
      } catch (err) {
        logger.warn('Near Me: Overpass endpoint error', { endpoint, err });
      } finally {
        clearTimeout(timeoutId);
      }
    }

    logger.warn('Near Me: all Overpass endpoints failed; using fallback sampling only');
    return {
      cities: [],
      allEndpointsFailed: true
    };
  }, []);

  const buildNearMeSearchParams = useCallback((criteria, page = 1, limit = 24) => {
    const query = new URLSearchParams();
    const payload = { ...criteria };

    if (payload.heightMinFeet && payload.heightMinInches !== undefined) {
      const feet = parseInt(payload.heightMinFeet, 10) || 0;
      const inches = parseInt(payload.heightMinInches, 10) || 0;
      payload.heightMin = feet * 12 + inches;
    }

    if (payload.heightMaxFeet && payload.heightMaxInches !== undefined) {
      const feet = parseInt(payload.heightMaxFeet, 10) || 0;
      const inches = parseInt(payload.heightMaxInches, 10) || 0;
      payload.heightMax = feet * 12 + inches;
    }

    delete payload.heightMinFeet;
    delete payload.heightMinInches;
    delete payload.heightMaxFeet;
    delete payload.heightMaxInches;

    if (Array.isArray(payload.locations) && payload.locations.length > 0) {
      delete payload.location;
    }

    Object.entries(payload).forEach(([key, value]) => {
      if (value === '' || value === null || value === undefined) {
        return;
      }

      if (Array.isArray(value)) {
        value.forEach((item) => query.append(key, item));
      } else {
        query.append(key, value);
      }
    });

    query.append('page', String(page));
    query.append('limit', String(limit));
    query.append('sortBy', sortBy);
    query.append('sortOrder', sortOrder);

    return query;
  }, [sortBy, sortOrder]);

  const probeNearMeSearchCount = useCallback(async (criteria) => {
    try {
      const probeParams = buildNearMeSearchParams(criteria, 1, 1);
      const response = await api.get(`/search?${probeParams.toString()}`);
      const total = Number(response?.data?.total ?? 0);
      return Number.isNaN(total) ? 0 : total;
    } catch (error) {
      logger.warn('Near Me probe search failed; skipping probe fallback', error);
      return null;
    }
  }, [buildNearMeSearchParams]);

  const handleNewMeSearch = useCallback(async (radiusMiles = 100) => {
    if (isNearMeLoading) {
      toastService.info('Near Me search is already in progress...');
      showNearMeStatus({
        type: 'info',
        title: 'Near Me in progress',
        message: 'Already finding profiles near your current location.'
      });
      return;
    }

    setIsNearMeLoading(true);
    toastService.info(`📍 Finding matches near you (${radiusMiles} miles)...`);
    showNearMeStatus({
      type: 'info',
      title: 'Finding matches near you',
      message: `Working on your ${radiusMiles}-mile Near Me search...`
    });

    if (!navigator.geolocation) {
      toastService.info('Location is unavailable on this browser. Running your default search instead.');
      showNearMeStatus({
        type: 'warning',
        title: 'Location unavailable',
        message: 'Running your default saved/partner search instead.'
      }, 6000);
      await executeDefaultSavedOrPartnerSearch();
      setIsNearMeLoading(false);
      return;
    }

    const getPosition = () => new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      });
    });

    try {
      const position = await getPosition();
      const { latitude, longitude } = position.coords;
      const resolvedLocation = await reverseGeocodeLocation(latitude, longitude);
      const city = resolvedLocation?.city || '';
      const state = resolvedLocation?.state || '';

      if (!city) {
        toastService.info('Could not determine city from your location. Running your default search instead.');
        showNearMeStatus({
          type: 'warning',
          title: 'Could not resolve your city',
          message: 'Running your default saved/partner search instead.'
        }, 6500);
        await executeDefaultSavedOrPartnerSearch();
        return;
      }

      const defaults = getDefaultSearchCriteria();
      const nearbyCityResult = await fetchNearbyCitiesWithinRadius(latitude, longitude, radiusMiles);
      let nearbyCities = nearbyCityResult.cities;
      logger.info(`📍 Near Me: fetched ${nearbyCities.length} nearby cities from primary source within ${radiusMiles} miles`, {
        baseCity: city,
        nearbyCities
      });

      if (nearbyCityResult.allEndpointsFailed) {
        showNearMeStatus({
          type: 'warning',
          title: 'Primary map service is slow',
          message: 'Continuing with fallback city sampling so search can proceed.'
        }, 7000);
      }

      if (nearbyCities.length <= 1) {
        const sampledCities = await sampleCitiesWithinRadius(latitude, longitude, radiusMiles);
        const merged = new Map();
        [...nearbyCities, ...sampledCities].forEach((candidate) => {
          const normalized = String(candidate || '').trim();
          if (!normalized) return;
          const key = normalized.toLowerCase();
          if (!merged.has(key)) merged.set(key, normalized);
        });
        nearbyCities = Array.from(merged.values());
        logger.info(`📍 Near Me: sampled fallback found ${sampledCities.length} cities (merged total ${nearbyCities.length})`, {
          sampledCities,
          mergedCities: nearbyCities
        });
      }

      const normalizeLocationKey = (value) => String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, ' ')
        .trim()
        .toLowerCase();

      const normalizedOptionLookup = new Map(
        (locationOptions || [])
          .map((opt) => {
            const normalizedOpt = String(opt || '').trim();
            if (!normalizedOpt) return null;
            return [normalizeLocationKey(normalizedOpt), normalizedOpt];
          })
          .filter(Boolean)
      );

      const cityCandidates = [city, ...nearbyCities]
        .map((c) => String(c || '').trim())
        .filter(Boolean);

      const canonicalBaseCity = normalizedOptionLookup.get(normalizeLocationKey(city)) || city;
      const dedupedCityMap = new Map();

      cityCandidates.forEach((candidate) => {
        const normalizedKey = normalizeLocationKey(candidate);
        if (!normalizedKey || dedupedCityMap.has(normalizedKey)) {
          return;
        }

        if (normalizedOptionLookup.size > 0) {
          const canonical = normalizedOptionLookup.get(normalizedKey);
          if (canonical) {
            dedupedCityMap.set(normalizedKey, canonical);
          }
          return;
        }

        if (candidate.toLowerCase() === city.toLowerCase()) {
          dedupedCityMap.set(normalizedKey, candidate);
        }
      });

      const locationsWithinRadius = Array.from(dedupedCityMap.values());
      const criteriaWithCity = buildPartnerCriteriaPayload(defaults, canonicalBaseCity, state);
      criteriaWithCity.location = '';

      // If Near Me only resolves one/no canonical city, avoid over-constraining.
      // In that case, run state-wide search with defaults.
      const uiLocations = locationsWithinRadius.length > 0 ? locationsWithinRadius : [canonicalBaseCity];
      const searchLocations = locationsWithinRadius.length > 1 ? locationsWithinRadius : [];
      const uiCriteria = {
        ...criteriaWithCity,
        locations: uiLocations
      };
      const criteriaForExecution = {
        ...criteriaWithCity,
        locations: searchLocations
      };

      let effectiveUiCriteria = uiCriteria;
      let effectiveSearchCriteria = criteriaForExecution;
      let fallbackToStateOnly = false;

      if (criteriaForExecution.locations.length === 0) {
        fallbackToStateOnly = true;
        effectiveSearchCriteria = {
          ...criteriaForExecution,
          location: '',
          locations: []
        };
        effectiveUiCriteria = {
          ...uiCriteria,
          location: '',
          locations: []
        };
        logger.info('📍 Near Me: canonical nearby city list too small; falling back to state-wide search', {
          baseCity: city,
          state,
          resolvedCities: locationsWithinRadius
        });
      } else if (criteriaForExecution.state) {
        showNearMeStatus({
          type: 'info',
          title: 'Near Me search in progress',
          message: `Searching with ${criteriaForExecution.state} + ${criteriaForExecution.locations.length} nearby location(s)...`
        });

        const stateAndLocationsCount = await probeNearMeSearchCount(criteriaForExecution);
        if (stateAndLocationsCount === 0 || stateAndLocationsCount === null) {
          fallbackToStateOnly = true;
          showNearMeStatus({
            type: 'warning',
            title: stateAndLocationsCount === 0 ? 'No matches with state + locations' : 'Could not verify location matches',
            message: stateAndLocationsCount === 0
              ? `Found no profiles using ${criteriaForExecution.state} + nearby locations. Retrying with ${criteriaForExecution.state} only...`
              : `Could not verify ${criteriaForExecution.state} + location results right now. Retrying with ${criteriaForExecution.state} only...`
          });

          effectiveSearchCriteria = {
            ...criteriaForExecution,
            location: '',
            locations: []
          };
          effectiveUiCriteria = {
            ...uiCriteria,
            location: '',
            locations: []
          };
        }
      }
      logger.info(`📍 Near Me: applying ${effectiveSearchCriteria.locations.length} location(s) to search`, {
        baseCity: canonicalBaseCity,
        state: effectiveSearchCriteria.state,
        uiLocations: effectiveUiCriteria.locations,
        searchLocations: effectiveSearchCriteria.locations,
        fallbackToStateOnly
      });

      setSearchCriteria(effectiveUiCriteria);
      setMinMatchScore(0);
      setSelectedSearch(null);
      handleSearchHook(1, 0, effectiveSearchCriteria);

      setNearMeExecutionContext({
        visible: true,
        type: fallbackToStateOnly ? 'warning' : 'info',
        message: fallbackToStateOnly
          ? `Near Me: no profiles with ${effectiveSearchCriteria.state} + locations, retried with ${effectiveSearchCriteria.state} only.`
          : `Near Me: searching with ${effectiveSearchCriteria.state}${effectiveSearchCriteria.locations.length > 0 ? ` + ${effectiveSearchCriteria.locations.length} location(s)` : ''}.`
      });

      toastService.success(`📍 Near Me is using ${city} + ${radiusMiles} mile radius`);
      showNearMeStatus({
        type: 'success',
        title: 'Near Me search started',
        message: fallbackToStateOnly
          ? `No profiles found with state + locations. Retried with ${effectiveSearchCriteria.state} only.`
          : `${effectiveUiCriteria.locations.length} location(s) applied around ${city}${effectiveUiCriteria.state ? `, ${effectiveUiCriteria.state}` : ''}.`
      }, 7000);
    } catch (err) {
      logger.info('New Me location permission denied/unavailable, executing fallback search', err);
      showNearMeStatus({
        type: 'warning',
        title: 'Near Me fallback applied',
        message: 'Location was denied/unavailable. Running your default saved/partner search.'
      }, 7000);
      await executeDefaultSavedOrPartnerSearch();
    } finally {
      setIsNearMeLoading(false);
    }
  }, [buildPartnerCriteriaPayload, executeDefaultSavedOrPartnerSearch, fetchNearbyCitiesWithinRadius, getDefaultSearchCriteria, handleSearchHook, isNearMeLoading, locationOptions, probeNearMeSearchCount, reverseGeocodeLocation, sampleCitiesWithinRadius, showNearMeStatus]);

  // Keep ref pointing at the latest handleLoadSavedSearch each render.
  handleLoadSavedSearchRef.current = handleLoadSavedSearch;

  // Listen for saved search loads from TopBar.
  // Uses ref-latest pattern so the listener is registered once and never stale.
  useEffect(() => {
    const handler = (event) => {
      const savedSearch = event?.detail;
      if (!savedSearch) return;
      handleLoadSavedSearchRef.current(savedSearch);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('loadSavedSearchFromTopbar', handler);
    return () => window.removeEventListener('loadSavedSearchFromTopbar', handler);
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for TopBar Near Me trigger while already on /search.
  useEffect(() => {
    const handler = (event) => {
      const requestedRadius = Number(event?.detail?.radiusMiles) || 100;
      handleNewMeSearch(requestedRadius);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('runNewMeSearchFromTopbar', handler);
    return () => window.removeEventListener('runNewMeSearchFromTopbar', handler);
  }, [handleNewMeSearch]);

  // Apply any pending search action set by TopBar when navigating to /search.
  // pendingSearchAction was captured (and sessionStorage cleared) during this
  // component instance's first render via useState's initializer.
  // We use a ref-flag (not deps churn) to guarantee the action is consumed
  // EXACTLY ONCE — even if handleLoadSavedSearch's identity changes later
  // (which it does after every search via handleSearchHook re-creation).
  const pendingActionConsumedRef = useRef(false);
  useEffect(() => {
    if (pendingActionConsumedRef.current) return;
    if (!currentUserProfile || Object.keys(currentUserProfile).length === 0) return;
    if (!pendingSearchAction) return;

    pendingActionConsumedRef.current = true;

    if (pendingSearchAction.type === 'openFilters') {
      openFiltersPanel();
    } else if (pendingSearchAction.type === 'openSavedSearches') {
      setInlineTabsDefaultTab('saved');
      setInlineTabsNonce((n) => n + 1);
      openFiltersPanel();
      requestAnimationFrame(() => setInlineTabsDefaultTab(null));
    } else if (pendingSearchAction.type === 'newMeSearch') {
      handleNewMeSearch(Number(pendingSearchAction.radiusMiles) || 100);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (pendingSearchAction.type === 'loadSavedSearch' && pendingSearchAction.savedSearch) {
      handleLoadSavedSearch(pendingSearchAction.savedSearch);
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // If sortBy is specified, apply the sort after search loads
      if (pendingSearchAction.sortBy) {
        setTimeout(() => {
          applyServerSort(pendingSearchAction.sortBy);
        }, 500);
      }
    }
  }, [currentUserProfile, pendingSearchAction, handleLoadSavedSearch, handleNewMeSearch, openFiltersPanel, applyServerSort]);


  const handleEditSchedule = (search) => {
    setEditingScheduleFor(search);
    setShowSaveModal(true);
  };

  // Thin adapter: SaveSearchModal calls onSave(saveData) without knowing
  // about current criteria / minMatchScore. The hook expects them explicit.
  const handleSaveSearch = useCallback(
    (saveData) => {
      const isUpdate =
        typeof saveData === 'object' &&
        saveData !== null &&
        (saveData.isUpdate === true || Boolean(saveData.id || saveData._id));

      const effectiveCriteria = isUpdate && saveData?.criteria ? saveData.criteria : searchCriteria;
      const effectiveMinScore =
        isUpdate && typeof saveData?.minMatchScore === 'number' ? saveData.minMatchScore : minMatchScore;

      return handleSaveSearchHook(saveData, {
        criteria: effectiveCriteria,
        minMatchScore: effectiveMinScore,
      });
    },
    [handleSaveSearchHook, searchCriteria, minMatchScore]
  );

  // Show chat-first prompt before opening PII request modal
  const openPIIRequestModal = (targetUsername) => {
    const user = users.find(u => u.username === targetUsername);
    if (!user) return;
    setPendingPIIRequestUser(user);
    setShowChatFirstPrompt(true);
  };

  // actuallyOpenPIIRequestModal function - now managed by useSearchActions hook

  // handlePIIRequestSuccess function - now managed by useSearchActions hook

  // hasPiiAccess function - now managed by useSearchActions hook

  const isPiiRequestPending = (targetUsername, requestType) => {
    return piiRequests[`${targetUsername}_${requestType}`] === 'pending';
  };

  // Get PII request status for all types
  const getPIIRequestStatus = (targetUsername) => {
    return {
      images: piiRequests[`${targetUsername}_images`],
      contact_info: piiRequests[`${targetUsername}_contact_info`],
      date_of_birth: piiRequests[`${targetUsername}_date_of_birth`],
      linkedin_url: piiRequests[`${targetUsername}_linkedin_url`]
    };
  };

  // handleProfileAction function - now managed by useSearchActions hook

  // Swipe action functions are now handled by useSearchViewModes hook

  // Confirm exclusion from preview modal
  const confirmExclusion = async () => {
    if (!selectedUserForExclusion) return;
    const targetUsername = selectedUserForExclusion.username;
    try {
      setExclusionLoading(true);
      await api.post(`/exclusions/${targetUsername}`);
      setExcludedUsers(prev => new Set([...prev, targetUsername]));
      
      // Remove hidden user from search results immediately
      setUsers(prev => prev.filter(u => u.username !== targetUsername));
      
      // Auto-remove from favorites and shortlist in UI
      setFavoritedUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(targetUsername);
        return newSet;
      });
      setShortlistedUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(targetUsername);
        return newSet;
      });
      
      setShowExclusionPreview(false);
      setExclusionPreviewData(null);
      setSelectedUserForExclusion(null);
      setStatusMessage('✅ Profile hidden');
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (err) {
      if (err.response?.status === 409) {
        // Already excluded — treat as success
        setExcludedUsers(prev => new Set([...prev, targetUsername]));
        setUsers(prev => prev.filter(u => u.username !== targetUsername));
        setShowExclusionPreview(false);
        setExclusionPreviewData(null);
        setSelectedUserForExclusion(null);
        setStatusMessage('✅ Profile already hidden');
        setTimeout(() => setStatusMessage(''), 3000);
      } else {
        logger.error(`Failed to hide profile: ${err.message}`);
        setStatusMessage('❌ Failed to hide profile');
        setTimeout(() => setStatusMessage(''), 3000);
      }
    } finally {
      setExclusionLoading(false);
    }
  };

  // Handle message button click
  const handleMessage = async (user) => {
    const currentUser = localStorage.getItem('username');
    // If user object doesn't have full profile data, fetch it
    if (!user.firstName && !user.location && user.username) {
      try {
        const response = await api.get(`/profile/${user.username}?requester=${currentUser}`);
        setSelectedUserForMessage(response.data);
      } catch (err) {
        logger.error('Error loading user profile:', err);
        // Fallback to existing user object
        setSelectedUserForMessage(user);
      }
    } else {
      setSelectedUserForMessage(user);
    }
    setShowMessageModal(true);
  };

  // Memoize filtered and sorted users to prevent excessive re-renders on hover
  const currentRecords = useMemo(() => {
    // Check if this is a Profile ID search - bypass most filters if so
    const isProfileIdSearch = searchCriteria.profileId?.trim();
    
    // Client-side filtering - only apply filters NOT handled by server
    const filteredUsers = users.filter(user => {
      // Profile ID search bypasses all client-side filters
      if (isProfileIdSearch) {
        return true;
      }

      // CRITICAL: Filter out wrong-gender profiles from stale cache
      // This prevents showing male profiles when searching for females (or vice versa)
      if (searchCriteria.gender) {
        const expectedGender = searchCriteria.gender.charAt(0).toUpperCase() + searchCriteria.gender.slice(1).toLowerCase();
        if (user.gender && user.gender !== expectedGender) {
          logger.warn(`🚨 Filtering out wrong-gender profile: ${user.username} (${user.gender}) - expected ${expectedGender}`);
          return false;
        }
      }

      // Filter by minimum compatibility score (L3V3L) - client-only filter
      if (minMatchScore > 0) {
        const userScore = user.matchScore || 0;
        if (userScore < minMatchScore) {
          return false;
        }
      }

      return true;
    });

    // Sorting is server-backed; only apply client-side filtering + de-duplication.
    return filteredUsers.filter((user, index, self) => 
      index === self.findIndex(u => u.username === user.username)
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, searchCriteria.profileId, searchCriteria.gender, minMatchScore]);

  const getActiveCriteriaSummary = () => {
    const summary = [];
    
    // Show saved search name if loaded (skip if it looks like raw criteria data)
    if (selectedSearch?.name && !selectedSearch.name.includes('|')) {
      summary.push(`📂 ${selectedSearch.name}`);
    }
    
    if (searchCriteria.profileId) {
      summary.push(`ID/Username: ${searchCriteria.profileId}`);
      return summary.join(' • ');
    }
    
    // Gender
    if (searchCriteria.gender) summary.push(searchCriteria.gender.charAt(0).toUpperCase() + searchCriteria.gender.slice(1));
    
    // Age range
    if (searchCriteria.ageMin && searchCriteria.ageMax) summary.push(`${searchCriteria.ageMin}-${searchCriteria.ageMax} yrs`);
    else if (searchCriteria.ageMin) summary.push(`${searchCriteria.ageMin}+ yrs`);
    else if (searchCriteria.ageMax) summary.push(`Up to ${searchCriteria.ageMax} yrs`);
    
    // Height range - format as feet'inches"
    const formatHeight = (feet, inches) => {
      if (!feet && !inches) return null;
      const f = parseInt(feet) || 0;
      const i = parseInt(inches) || 0;
      return `${f}'${i}"`;
    };
    
    const minHeight = formatHeight(searchCriteria.heightMinFeet, searchCriteria.heightMinInches);
    const maxHeight = formatHeight(searchCriteria.heightMaxFeet, searchCriteria.heightMaxInches);
    
    if (minHeight || maxHeight) {
      if (minHeight && maxHeight) {
        summary.push(`📏 ${minHeight}-${maxHeight}`);
      } else if (minHeight) {
        summary.push(`📏 ${minHeight}+`);
      } else if (maxHeight) {
        summary.push(`📏 Up to ${maxHeight}`);
      }
    }
    
    // Location (handle both single and multi-select formats)
    if (searchCriteria.locations && searchCriteria.locations.length > 0) {
      if (searchCriteria.locations.length === 1) {
        summary.push(`📍 ${searchCriteria.locations[0]}`);
      } else {
        summary.push(`📍 ${searchCriteria.locations.length} locations`);
      }
    } else if (searchCriteria.location) {
      summary.push(`📍 ${searchCriteria.location}`);
    }
    if (searchCriteria.state) summary.push(searchCriteria.state);
    if (searchCriteria.country) summary.push(searchCriteria.country);
    
    // L3V3L Match Score
    if (minMatchScore > 0) summary.push(`🦋 ${minMatchScore}%+ Match`);
    
    // Education & Occupation
    if (searchCriteria.education) summary.push(`🎓 ${searchCriteria.education}`);
    
    // Occupation (handle both old and new formats)
    if (searchCriteria.occupations && searchCriteria.occupations.length > 0) {
      if (searchCriteria.occupations.length === 1) {
        summary.push(`💼 ${searchCriteria.occupations[0]}`);
      } else {
        summary.push(`💼 ${searchCriteria.occupations.length} professions`);
      }
    } else if (searchCriteria.occupation) {
      summary.push(`💼 ${searchCriteria.occupation}`);
    }
    
    // Religion & Caste
    if (searchCriteria.religion) summary.push(searchCriteria.religion);
    if (searchCriteria.caste) summary.push(searchCriteria.caste);
    
    // Marital Status
    if (searchCriteria.maritalStatus) summary.push(searchCriteria.maritalStatus);
    
    // Diet & Lifestyle
    if (searchCriteria.diet) summary.push(`🍽️ ${searchCriteria.diet}`);
    if (searchCriteria.smoking) summary.push(`🚬 ${searchCriteria.smoking}`);
    if (searchCriteria.drinking) summary.push(`🍷 ${searchCriteria.drinking}`);
    
    // Online status
    if (searchCriteria.onlineOnly) summary.push('🟢 Online');
    
    // With photos only
    if (searchCriteria.hasPhoto) summary.push('📸 Photos Only');
    
    // Days back filter
    const normalizedDaysBack = normalizeDaysBackValue(searchCriteria.daysBack, 30);

    if (normalizedDaysBack === 0) {
      summary.push('📅 All time');
    } else if (normalizedDaysBack > 0) {
      summary.push(`📅 Last ${normalizedDaysBack}d`);
    }
    
    return summary.length > 0 ? summary.join(' • ') : 'Showing all matches';
  };

  return (
    <div className="search-page">

      {error && (
        <div style={{ maxWidth: '600px', margin: '10px auto' }}>
          <div className="alert alert-danger">{error}</div>
        </div>
      )}

      {statusMessage && (
        <div style={{ maxWidth: '600px', margin: '10px auto' }}>
          <div className={`alert ${statusMessage.includes('❌') ? 'alert-danger' : 'alert-success'} alert-dismissible fade show`} role="alert">
            {statusMessage}
            <button type="button" className="btn-close" onClick={() => setStatusMessage('')}></button>
          </div>
        </div>
      )}

      {nearMeStatus.visible && (
        <div className={`near-me-status-popup near-me-status-${nearMeStatus.type}`} role="status" aria-live="polite">
          <span className="near-me-status-icon" aria-hidden="true">
            {isNearMeLoading ? '⏳' : nearMeStatus.type === 'success' ? '✅' : nearMeStatus.type === 'warning' ? '⚠️' : 'ℹ️'}
          </span>
          <div className="near-me-status-content">
            <div className="near-me-status-title">{nearMeStatus.title}</div>
            {nearMeStatus.message ? <div className="near-me-status-message">{nearMeStatus.message}</div> : null}
          </div>
          <button
            type="button"
            className="near-me-status-close"
            onClick={dismissNearMeStatus}
            aria-label="Close Near Me status"
          >
            ×
          </button>
        </div>
      )}

      {/* Active Criteria Summary Bar - Header at top */}
      <div
        className={`active-criteria-bar ${isFiltersPanelExpanded ? 'is-expanded' : ''}`}
        onClick={toggleFiltersPanel}
        ref={searchFiltersPanelRef}
      >
        <div className="active-criteria-bar-header">
          <div className="criteria-info">
            <span className="criteria-label">FILTERS:</span>
            <span className="criteria-value">{getActiveCriteriaSummary()}</span>
            {nearMeExecutionContext.visible && nearMeExecutionContext.message ? (
              <span className={`near-me-context-badge near-me-context-${nearMeExecutionContext.type}`}>
                {nearMeExecutionContext.message}
              </span>
            ) : null}
          </div>
          <div className="criteria-actions">
            <span className="results-count">
              <span className="results-count-number">{totalResults}</span>
              <span className="results-count-text"> - found</span>
            </span>
            <button className="btn-modify-search" onClick={(e) => { e.stopPropagation(); openFiltersPanel(); }}>
              <span className="modify-text">Modify </span><span className="modify-icon">⚙️</span>
            </button>
            <button className="btn-modify-search" onClick={(e) => { e.stopPropagation(); handlePrimarySearch(); }} title="Refresh search results">
              <span className="modify-text">Refresh </span><span className="modify-icon">🔄</span>
            </button>
          </div>
        </div>

        {isFiltersPanelExpanded && (
          <div className="active-criteria-bar-body" onClick={(e) => e.stopPropagation()}>
            <div className="search-filters-panel">
              <div className="search-filters-panel-body is-expanded">
                <UniversalTabContainer
                  key={`search-inline-tabs-${savedSearches.length}-${inlineTabsNonce}`}
                  variant="underlined"
                  defaultTab={inlineTabsDefaultTab || 'search'}
                  tabs={[
                    {
                      id: 'search',
                      icon: '🔍',
                      label: 'Set Search Filters',
                      badge: minMatchScore > 0 ? `${minMatchScore}%` : null,
                      content: (
                        <SearchFilters
                          searchCriteria={searchCriteria}
                          minMatchScore={minMatchScore}
                          setMinMatchScore={handleMinMatchScoreChange}
                          handleInputChange={handleInputChange}
                          showAdvancedFilters={showAdvancedFilters}
                          setShowAdvancedFilters={setShowAdvancedFilters}
                          onSearch={handlePrimarySearch}
                          onNewMe={handleNewMeSearch}
                          isNearMeLoading={isNearMeLoading}
                          onClear={handleClearFilters}
                          onSave={() => setShowSaveModal(true)}
                          systemConfig={systemConfig}
                          isPremiumUser={isPremiumUser}
                          currentUserProfile={currentUserProfile}
                          bodyTypeOptions={bodyTypeOptions}
                          occupationOptions={occupationOptions}
                          locationOptions={locationOptions}
                          eatingOptions={eatingOptions}
                          lifestyleOptions={lifestyleOptions}
                          isAdmin={isAdmin}
                        />
                      )
                    },
                    {
                      id: 'saved',
                      icon: '💾',
                      label: 'Saved Searches',
                      badge: savedSearches.length > 0 ? savedSearches.length : null,
                      content: (
                        <SavedSearchesPanel
                          savedSearches={savedSearches}
                          selectedSearch={selectedSearch}
                          editingScheduleSearch={editingScheduleSearch}
                          scheduleEnabled={scheduleEnabled}
                          setScheduleEnabled={setScheduleEnabled}
                          savingSchedule={savingSchedule}
                          onStartScheduleEdit={startInlineScheduleEdit}
                          onCancelScheduleEdit={cancelInlineScheduleEdit}
                          onSaveSchedule={saveInlineSchedule}
                          onUpdateSavedSearch={handleSaveSearchHook}
                          onSetDefault={handleSetDefaultSearch}
                          onDelete={handleDeleteSavedSearch}
                          onLoad={handleLoadSavedSearch}
                        />
                      )
                    }
                  ]}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="search-container">
        <div className="search-results" ref={searchResultsRef}>
          {(loading || (!initialSearchComplete && currentRecords.length === 0)) && (
            <div className="text-center py-4">
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{
                  fontSize: '32px',
                  animation: loading
                    ? 'pulse 1s ease-in-out infinite'
                    : 'spin 1s linear infinite'
                }}>
                  {loading ? '⏱️' : '⟳'}
                </div>
                {loading && (
                  <div style={{
                    fontSize: '18px',
                    fontWeight: 600,
                    color: 'var(--primary-color)',
                    fontFamily: 'monospace'
                  }}>
                    {elapsedTime}s
                  </div>
                )}
                <div style={{
                  fontSize: '13px',
                  color: 'var(--text-muted)'
                }}>
                  {loading ? 'Searching…' : 'Loading search…'}
                </div>
              </div>
            </div>
          )}

          {/* Only render the empty state after the first search completes, so
              we never flash 'No profiles found' while the initial fetch is still
              in flight or between a refresh's clear→fetch render gap. */}
          {initialSearchComplete && !loading && !error && currentRecords.length === 0 && (
            <div className="no-results">
              {excludedProfileMessage ? (
                <>
                  <h5>🚫 Profile Hidden</h5>
                  <p style={{ color: 'var(--warning-color)', fontWeight: 500 }}>
                    This profile (
                    <a 
                      href={`/profile/${excludedProfileUsername}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ 
                        color: 'var(--primary-color)', 
                        fontWeight: 600, 
                        textDecoration: 'underline',
                        cursor: 'pointer'
                      }}
                      title="Click to view this profile (opens in new tab)"
                    >
                      {excludedProfileId}
                    </a>
                    ) is in your exclusions list or might be in their exclusion list
                  </p>
                  <p style={{ marginTop: '12px' }}>
                    <a href="/dashboard#search-exclude" style={{ color: 'var(--primary-color)', textDecoration: 'none', fontWeight: 500 }}>
                      Manage your exclusions →
                    </a>
                  </p>
                </>
              ) : (
                <>
                  <h5>No profiles found</h5>
                  <p>Try widening the time window, clearing one or two filters, or reloading the page.</p>
                  <div className="no-results-actions">
                    {[45, 60, 90, 365, 0].map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={`no-results-chip ${Number(searchCriteria.daysBack ?? 30) === option ? 'active' : ''}`}
                        onClick={() => handleQuickDaysBackChange(option)}
                      >
                        {option === 0 ? 'All time' : `${option}d`}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Sort Controls - Before Results */}
          {/* Only show results after initial search completes to prevent stale data flash */}
          {initialSearchComplete && currentRecords.length > 0 && (
            <div className="sort-controls-top">
              {/* Layout Toggle Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '9px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Layout:
                </span>
                <div className="layout-toggle-buttons">
                  {[
                    { mode: 'split', icon: '⚏', label: 'Split', title: 'Split view - List with detail panel' },
                    { mode: 'cards', icon: '▦', label: 'Cards', title: 'Card view - Grid layout' },
                    { mode: 'rows', icon: '☰', label: 'Rows', title: 'Row view - List layout' },
                    { mode: 'swipe', icon: '👆', label: 'Swipe', title: 'Swipe view - Tinder-style swiping' },
                    { mode: 'graph', icon: '◎', label: 'Graph', title: 'Graph view - Radial visualization with drag-and-drop' },
                  ].map(({ mode, icon, label, title }) => {
                    const isActive = viewMode === mode;
                    return (
                      <button
                        key={mode}
                        onClick={() => handleViewModeChange(mode)}
                        className={`layout-toggle-btn ${isActive ? 'active' : ''}`}
                        title={title}
                      >
                        <span className="layout-toggle-btn-icon">{icon}</span><span className="layout-toggle-btn-text">{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'nowrap', height: '20px' }}>
                <span className="sort-by-label">
                  Sort by:
                </span>
                <select
                  value={normalizeSortBy(sortBy)}
                  onChange={handleSortChange}
                  className="form-select form-select-sm"
                >
                  <option value="matchScore">🎯 Compatibility Score</option>
                  <option value="newest">🆕 Newest Members</option>
                  <option value="firstName">👤 Name</option>
                  <option value="age">📅 Age</option>
                  <option value="height">📏 Height</option>
                  <option value="location">📍 Location</option>
                  <option value="education">🎓 Education</option>
                  <option value="profession">💼 Profession</option>
                </select>
                <button
                  onClick={toggleSortOrder}
                  className="layout-toggle-btn sort-order-btn"
                  title={`Sort order: ${sortOrder === 'desc' ? 'Descending' : 'Ascending'}`}
                >
                  <span className="layout-toggle-btn-icon">{sortOrder === 'desc' ? '↓' : '↑'}</span>
                </button>
              </div>
              <div className="sort-controls-profiles">
                <span style={{ fontWeight: 600 }}>Profiles:</span>
                <span 
                  className="sort-controls-profiles-badge primary"
                  title="Total matches found by search"
                >
                  {totalResults}
                </span>
                <span>|</span>
                <span 
                  className="sort-controls-profiles-badge success"
                  title="Profiles currently loaded (unique)"
                >
                  {currentRecords.length}
                </span>
                <span>|</span>
                <span 
                  className="sort-controls-profiles-badge danger"
                  title={`You have blocked ${excludedUsers.size} user(s) total`}
                >
                  {excludedUsers.size}
                </span>
              </div>
            </div>
          )}

          {/* Layout Container - isolates view modes */}
          {/* Only render results after initial search completes to prevent stale data flash */}
          {initialSearchComplete && <div key={`layout-${viewMode}`} style={{ width: '100%' }}>
          {/* Split-Screen Layout */}
          {viewMode === 'split' ? (
            <div className="split-screen-layout" style={{
              display: 'flex',
              gap: '20px',
              height: 'calc(100vh - 350px)',
              minHeight: '600px'
            }}>
              {/* Left: Thumbnail Navigation */}
              <div className="thumbnail-navigation" style={{
                width: '280px',
                flexShrink: 0,
                overflowY: 'auto',
                background: 'var(--surface-color)',
                borderRadius: 'var(--radius-md)',
                padding: '12px',
                border: '1px solid var(--border-color)'
              }}>
                {currentRecords.map((user, index) => (
                  <div
                    key={user.username}
                    className={`thumbnail-card ${selectedProfileForDetail?.username === user.username ? 'selected' : ''}`}
                    onClick={() => setSelectedProfileForDetail(user)}
                    style={{
                      padding: '12px',
                      marginBottom: '8px',
                      background: selectedProfileForDetail?.username === user.username ? 'var(--primary-color)' : 'var(--card-background)',
                      color: selectedProfileForDetail?.username === user.username ? 'white' : 'var(--text-color)',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      border: selectedProfileForDetail?.username === user.username ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      gap: '10px',
                      alignItems: 'center'
                    }}
                  >
                    {/* Profile Image Thumbnail */}
                    {(() => {
                      // Use first image from images array
                      const thumbnailImage = user.images?.[0];
                      // Always convert to full URL using getImageUrl helper
                      const thumbnailUrl = thumbnailImage ? getImageUrl(thumbnailImage) : null;
                      return (
                        <div style={{
                          width: '50px',
                          height: '50px',
                          borderRadius: '50%',
                          background: 'var(--surface-color)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '24px',
                          flexShrink: 0,
                          border: '2px solid ' + (selectedProfileForDetail?.username === user.username ? 'white' : 'var(--border-color)'),
                          overflow: 'hidden'
                        }}>
                          {thumbnailUrl ? (
                            <img 
                              src={thumbnailUrl}
                              alt={user.firstName || user.username}
                              loading="lazy"
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover'
                              }}
                              onError={(e) => {
                                e.target.style.display = 'none';
                                if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <span style={{ 
                            display: thumbnailUrl ? 'none' : 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '100%',
                            height: '100%'
                          }}>
                            {user.firstName?.charAt(0) || user.username?.charAt(0) || '?'}
                          </span>
                        </div>
                      );
                    })()}
                    
                    {/* Profile Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontWeight: 600,
                        fontSize: '14px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {user.firstName || user.username}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        opacity: 0.8,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {user.age ? `${user.age}yrs` : ''} {user.location ? `• ${user.location}` : ''}
                      </div>
                      {/* DOB & Height - small font */}
                      <div style={{
                        fontSize: '10px',
                        opacity: 0.7,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        marginTop: '1px'
                      }}>
                        {user.birthMonth && user.birthYear && `🎂 ${String(user.birthMonth).padStart(2, '0')}/${user.birthYear}`}
                        {user.birthMonth && user.birthYear && user.height && ' • '}
                        {user.height && `📏 ${user.height}`}
                      </div>
                      {user.matchScore > 0 && (
                        <div style={{
                          fontSize: '11px',
                          marginTop: '2px',
                          fontWeight: 600,
                          color: selectedProfileForDetail?.username === user.username ? 'white' : 'var(--primary-color)'
                        }}>
                          🦋 {Math.round(user.matchScore * 10) / 10}%
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Right: Profile Detail Panel - Using Profile component directly */}
              <div className="profile-detail-panel" style={{
                flex: 1,
                overflowY: 'auto',
                background: 'var(--card-background)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)'
              }}>
                {selectedProfileForDetail ? (
                  <Profile
                    key={selectedProfileForDetail.username}
                    usernameFromProp={selectedProfileForDetail.username}
                    initialUserData={selectedProfileForDetail}
                    embedded={true}
                  />
                ) : (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    color: 'var(--text-muted)',
                    fontSize: '16px'
                  }}>
                    Select a profile from the left to view details
                  </div>
                )}
              </div>
            </div>
          ) : viewMode === 'swipe' ? (
            /* Swipe Mode Layout */
            <div className="swipe-mode-container" style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '500px',
              padding: '20px',
              position: 'relative'
            }}>
              {/* Swipe Progress */}
              <div className="swipe-progress" style={{
                marginBottom: '16px',
                fontSize: '14px',
                color: 'var(--text-secondary)'
              }}>
                {swipeIndex < currentRecords.length ? (
                  <span>Profile {swipeIndex + 1} of {currentRecords.length}</span>
                ) : (
                  <span>All profiles reviewed! 🎉</span>
                )}
              </div>
              
              {/* Swipe Instructions */}
              <div className="swipe-instructions" style={{
                marginBottom: '20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                color: 'var(--text-muted)'
              }}>
                <div style={{ display: 'flex', gap: '20px' }}>
                  <span>← Pass</span>
                  <span>↑ Shortlist</span>
                  <span>Favorite →</span>
                  <span>↓ Next</span>
                </div>
                <span style={{ fontSize: '11px', opacity: 0.7 }}>Double-click to open profile</span>
              </div>
              
              {/* Card Stack */}
              <div className="swipe-card-stack" style={{
                position: 'relative',
                width: '100%',
                maxWidth: '400px'
              }}>
                {/* Show current card and next card (for stack effect) */}
                {currentRecords.slice(swipeIndex, swipeIndex + 2).map((user, stackIndex) => {
                  const isTopCard = stackIndex === 0;
                  return (
                    <div 
                      key={user.username}
                      style={{
                        position: stackIndex === 0 ? 'relative' : 'absolute',
                        top: stackIndex === 0 ? 0 : '8px',
                        left: stackIndex === 0 ? 0 : '4px',
                        right: stackIndex === 0 ? 0 : '4px',
                        zIndex: 10 - stackIndex,
                        opacity: stackIndex === 0 ? 1 : 0.7,
                        transform: stackIndex === 0 ? 'none' : 'scale(0.95)',
                        pointerEvents: stackIndex === 0 ? 'auto' : 'none'
                      }}
                    >
                      {isTopCard ? (
                        <SwipeableCard
                          username={user.username}
                          onSwipeRight={() => handleSwipeAction('right', user)}
                          onSwipeLeft={() => handleSwipeAction('left', user)}
                          onSwipeUp={() => handleSwipeAction('up', user)}
                          onSwipeDown={() => handleSwipeAction('down', user)}
                        >
                          <SearchResultCard
                            key={user.username}
                            user={user}
                            debugIndex={swipeIndex + 1}
                            currentUsername={localStorage.getItem('username')}
                            context="swipe-mode"
                            onToggleFavorite={(u) => handleProfileAction(null, u.username, 'favorite')}
                            onToggleShortlist={(u) => handleProfileAction(null, u.username, 'shortlist')}
                            onBlock={(u) => handleProfileAction(null, u.username, 'exclude')}
                            onMessage={handleMessage}
                            onRequestPII={(u) => openPIIRequestModal(u.username)}
                            isFavorited={favoritedUsers.has(user.username)}
                            isShortlisted={shortlistedUsers.has(user.username)}
                            isExcluded={excludedUsers.has(user.username)}
                            hasPiiAccess={hasPiiAccessHook(user.username, 'contact_info')}
                            viewMode="cards"
                            showFavoriteButton={false}
                            showShortlistButton={false}
                            showExcludeButton={false}
                            showMessageButton={true}
                          />
                        </SwipeableCard>
                      ) : (
                        <SearchResultCard
                          key={user.username}
                          user={user}
                          currentUsername={localStorage.getItem('username')}
                          viewMode="cards"
                          onToggleFavorite={(u) => handleProfileAction(null, u.username, 'favorite')}
                          onToggleShortlist={(u) => handleProfileAction(null, u.username, 'shortlist')}
                          onBlock={(u) => handleProfileAction(null, u.username, 'exclude')}
                          onMessage={handleMessage}
                          onRequestPII={(u) => openPIIRequestModal(u.username)}
                          isFavorited={favoritedUsers.has(user.username)}
                          isShortlisted={shortlistedUsers.has(user.username)}
                          isExcluded={excludedUsers.has(user.username)}
                          hasPiiAccess={hasPiiAccessHook(user.username, 'contact_info')}
                          showFavoriteButton={false}
                          showShortlistButton={false}
                          showExcludeButton={false}
                          showMessageButton={false}
                        />
                      )}
                    </div>
                  );
                })}
                
                {/* End of results message */}
                {swipeIndex >= currentRecords.length && (
                  <div style={{
                    textAlign: 'center',
                    padding: '60px 20px',
                    background: 'var(--surface-color)',
                    borderRadius: '16px',
                    border: '2px dashed var(--border-color)'
                  }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🦋</div>
                    <h3 style={{ margin: '0 0 8px', color: 'var(--text-color)' }}>You've seen all profiles!</h3>
                    <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                      Try adjusting your filters or check back later for new matches.
                    </p>
                    <button
                      onClick={() => setSwipeIndex(0)}
                      style={{
                        marginTop: '20px',
                        padding: '10px 24px',
                        background: 'var(--primary-color)',
                        color: 'var(--text-on-primary, white)',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 600
                      }}
                    >
                      Start Over
                    </button>
                  </div>
                )}
              </div>
              
              {/* Manual Action Buttons (tiny hint buttons for accessibility) */}
              {swipeIndex < currentRecords.length && (
                <div className="swipe-action-buttons" style={{
                  display: 'flex',
                  gap: '8px',
                  marginTop: '12px',
                  opacity: 0.5
                }}>
                  {[
                    { dir: 'left', color: 'var(--danger-color)', icon: '✕', title: 'Pass (swipe left)' },
                    { dir: 'up', color: 'var(--primary-color)', icon: '📋', title: 'Shortlist (swipe up)' },
                    { dir: 'right', color: 'var(--success-color)', icon: '⭐', title: 'Favorite (swipe right)' },
                    { dir: 'down', color: 'var(--text-secondary)', icon: '⏭️', title: 'Skip (swipe down)' },
                  ].map(({ dir, color, icon, title }) => (
                    <button
                      key={dir}
                      onClick={() => handleSwipeAction(dir, currentRecords[swipeIndex])}
                      style={{
                        width: '20px',
                        height: '20px',
                        minWidth: '20px',
                        minHeight: '20px',
                        padding: 0,
                        borderRadius: '50%',
                        border: `1px solid ${color}`,
                        background: 'transparent',
                        color: color,
                        fontSize: '10px',
                        lineHeight: 1,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title={title}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : viewMode === 'graph' ? (
            /* Graph View - Radial visualization */
            <GraphView
              users={currentRecords}
              currentUserProfile={currentUserProfile}
              sortBy={sortBy}
              favoritedUsers={favoritedUsers}
              shortlistedUsers={shortlistedUsers}
              excludedUsers={excludedUsers}
              onProfileAction={handleProfileAction}
            />
          ) : (
            /* Cards/Rows Layout - wrapped in scroll container for rows view */
            <div className={viewMode === 'rows' ? 'rows-scroll-container' : undefined}>
              <div 
                key={`${viewMode}-layout`}
                className={`${viewMode === 'cards' ? 'results-grid results-cards' : viewMode === 'compact' ? 'results-rows results-compact' : 'results-rows'}`}
                style={viewMode === 'cards' ? { gridTemplateColumns: `repeat(${cardsPerRow}, 1fr)` } : { minWidth: '900px' }}
              >
              {/* Excel-like header row for rows view with sortable & resizable columns */}
              {viewMode === 'rows' && (
                <div 
                  className="excel-header"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `${columnWidths.index}px ${columnWidths.photo}px ${columnWidths.name}px ${columnWidths.score}px ${columnWidths.age}px ${columnWidths.height}px ${columnWidths.location}px ${columnWidths.education}px ${columnWidths.occupation}px 60px ${columnWidths.actions}px`,
                    alignItems: 'center',
                    gap: '0',
                    padding: '8px 12px',
                    background: 'var(--primary-color)',
                    color: 'var(--text-on-primary, white)',
                    fontSize: '10px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    borderRadius: '4px 4px 0 0',
                    border: '1px solid var(--border-color)',
                    position: 'sticky',
                    top: 0,
                    zIndex: 10
                  }}
                >
                  <span style={{ paddingRight: '6px', borderRight: '1px solid var(--border-color)', height: '100%', display: 'flex', alignItems: 'center' }}>#</span>
                  <span style={{ paddingRight: '6px', borderRight: '1px solid var(--border-color)', height: '100%', display: 'flex', alignItems: 'center' }}></span>
                  <span 
                    className="resizable-header"
                    onClick={() => handleColumnSort('firstName', 'asc')}
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', position: 'relative', paddingRight: '10px', borderRight: '1px solid var(--border-color)', height: '100%' }}
                    title="Sort by name"
                  >
                    Name {normalizeSortBy(sortBy) === 'firstName' && (sortOrder === 'asc' ? '↑' : '↓')}
                    <div className="resize-handle" onMouseDown={(e) => handleResizeStart(e, 'name')} />
                  </span>
                  <span 
                    className="resizable-header"
                    onClick={() => handleColumnSort('matchScore', 'desc')}
                    style={{ cursor: 'pointer', textAlign: 'center', position: 'relative', paddingRight: '10px', borderRight: '1px solid var(--border-color)', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Sort by L3V3L compatibility score"
                  >
                    🎯 {normalizeSortBy(sortBy) === 'matchScore' && (sortOrder === 'desc' ? '↓' : '↑')}
                    <div className="resize-handle" onMouseDown={(e) => handleResizeStart(e, 'score')} />
                  </span>
                  <span 
                    className="resizable-header"
                    onClick={() => handleColumnSort('age', 'desc')}
                    style={{ cursor: 'pointer', textAlign: 'center', position: 'relative', paddingRight: '10px', borderRight: '1px solid var(--border-color)', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Sort by age"
                  >
                    Age {normalizeSortBy(sortBy) === 'age' && (sortOrder === 'asc' ? '↑' : '↓')}
                    <div className="resize-handle" onMouseDown={(e) => handleResizeStart(e, 'age')} />
                  </span>
                  <span 
                    className="resizable-header"
                    onClick={() => handleColumnSort('height', 'desc')}
                    style={{ cursor: 'pointer', textAlign: 'center', position: 'relative', paddingRight: '10px', borderRight: '1px solid var(--border-color)', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Sort by height"
                  >
                    Height {normalizeSortBy(sortBy) === 'height' && (sortOrder === 'asc' ? '↑' : '↓')}
                    <div className="resize-handle" onMouseDown={(e) => handleResizeStart(e, 'height')} />
                  </span>
                  <span 
                    className="resizable-header"
                    onClick={() => handleColumnSort('location', 'asc')}
                    style={{ cursor: 'pointer', position: 'relative', paddingRight: '10px', borderRight: '1px solid var(--border-color)', height: '100%', display: 'flex', alignItems: 'center' }}
                    title="Sort by location"
                  >
                    Location {normalizeSortBy(sortBy) === 'location' && (sortOrder === 'asc' ? '↑' : '↓')}
                    <div className="resize-handle" onMouseDown={(e) => handleResizeStart(e, 'location')} />
                  </span>
                  <span 
                    className="resizable-header"
                    onClick={() => handleColumnSort('education', 'asc')}
                    style={{ cursor: 'pointer', position: 'relative', paddingRight: '10px', borderRight: '1px solid var(--border-color)', height: '100%', display: 'flex', alignItems: 'center' }}
                    title="Sort by education"
                  >
                    Education {normalizeSortBy(sortBy) === 'education' && (sortOrder === 'asc' ? '↑' : '↓')}
                    <div className="resize-handle" onMouseDown={(e) => handleResizeStart(e, 'education')} />
                  </span>
                  <span 
                    className="resizable-header"
                    onClick={() => handleColumnSort('profession', 'asc')}
                    style={{ cursor: 'pointer', position: 'relative', paddingRight: '10px', borderRight: '1px solid var(--border-color)', height: '100%', display: 'flex', alignItems: 'center' }}
                    title="Sort by occupation"
                  >
                    Occupati... {normalizeSortBy(sortBy) === 'profession' && (sortOrder === 'asc' ? '↑' : '↓')}
                    <div className="resize-handle" onMouseDown={(e) => handleResizeStart(e, 'occupation')} />
                  </span>
                  <span style={{ borderRight: '1px solid var(--border-color)', height: '100%', display: 'flex', alignItems: 'center' }}>Tags</span>
                  <span style={{ textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>Actions</span>
                </div>
              )}
              {currentRecords.map((user, index) => {
                return (
                <SearchResultCard
                  key={user.username}
                  user={user}
                  debugIndex={index + 1}
                  currentUsername={localStorage.getItem('username')}
                  // Context for kebab menu
                  context="search-results"
                  // Kebab menu handlers
                  onToggleFavorite={(u) => handleProfileAction(null, u.username, 'favorite')}
                  onToggleShortlist={(u) => handleProfileAction(null, u.username, 'shortlist')}
                  onBlock={(u) => handleProfileAction(null, u.username, 'exclude')}
                  onMessage={handleMessage}
                  onRequestPII={(u) => openPIIRequestModal(u.username)}
                  // Legacy handlers (for backward compatibility)
                  onFavorite={(u) => handleProfileAction(null, u.username, 'favorite')}
                  onShortlist={(u) => handleProfileAction(null, u.username, 'shortlist')}
                  onExclude={(u) => handleProfileAction(null, u.username, 'exclude')}
                  onPIIRequest={(u) => openPIIRequestModal(u.username)}
                  // State
                  isFavorited={favoritedUsers.has(user.username)}
                  isShortlisted={shortlistedUsers.has(user.username)}
                  isExcluded={excludedUsers.has(user.username)}
                  isBlocked={excludedUsers.has(user.username)}
                  hasPiiAccess={hasPiiAccessHook(user.username, 'contact_info')}
                  hasImageAccess={hasPiiAccessHook(user.username, 'images')}
                  isPiiRequestPending={isPiiRequestPending(user.username, 'contact_info')}
                  isImageRequestPending={isPiiRequestPending(user.username, 'images')}
                  piiRequestStatus={getPIIRequestStatus(user.username)}
                  piiAccess={{
                    contact: hasPiiAccessHook(user.username, 'contact_info'),
                    email: hasPiiAccessHook(user.username, 'email'),
                    phone: hasPiiAccessHook(user.username, 'phone'),
                    photos: hasPiiAccessHook(user.username, 'images')
                  }}
                  viewMode={viewMode}
                  columnWidths={columnWidths}
                  // Legacy display flags
                  showFavoriteButton={true}
                  showShortlistButton={true}
                  showExcludeButton={true}
                  showMessageButton={true}
                  searchResults={currentRecords}
                  currentIndex={index}
                />
              );
              })}
              </div>
            </div>
          )}
          </div>}

          {/* Infinite Scroll Trigger - invisible element that triggers load more */}
          {hasMoreResults && (
            <div 
              ref={loadMoreTriggerRef}
              style={{ height: '20px', margin: '20px 0' }}
            />
          )}

          {/* LoadMore - shows count and manual button */}
          {initialSearchComplete && currentRecords.length > 0 && (
            <LoadMore
              currentCount={Math.min(currentRecords.length, totalResults)}
              totalCount={totalResults}
              onLoadMore={handleLoadMore}
              loading={loadingMore}
              itemsPerLoad={24}
              itemLabel="profiles"
              buttonText={hasMoreResults ? "Load more" : "All loaded"}
            />
          )}

          {/* Consolidated Bottom Navigation Bar */}
          {initialSearchComplete && currentRecords.length > 0 && (
            <div className="results-controls-bottom">
              {/* Cards Per Row + View Toggle */}
              <div className="center-controls">
                {/* Cards Per Row (only show in card view) */}
                {viewMode === 'cards' && (
                  <div className="cards-per-row-selector">
                    <span className="selector-label">Cards:</span>
                    {[2, 3, 4, 5, 6].map(num => (
                      <button
                        key={num}
                        className={`cards-btn ${cardsPerRow === num ? 'active' : ''}`}
                        onClick={() => {
                          setCardsPerRow(num);
                          localStorage.setItem('searchCardsPerRow', num.toString());
                        }}
                        title={`${num} cards per row`}  
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: View Toggle Buttons */}
              <div className="view-toggle-selector">
                <button
                  className={`view-toggle-btn ${viewMode === 'split' ? 'active' : ''}`}
                  onClick={() => handleViewModeChange('split')}
                  title="Split view"
                >
                  ⚏
                </button>
                <button
                  className={`view-toggle-btn ${viewMode === 'cards' ? 'active' : ''}`}
                  onClick={() => handleViewModeChange('cards')}
                  title="Card view"
                >
                  ▦
                </button>
                <button
                  className={`view-toggle-btn ${viewMode === 'rows' ? 'active' : ''}`}
                  onClick={() => handleViewModeChange('rows')}
                  title="Row view"
                >
                  ☰
                </button>
                <button
                  className={`view-toggle-btn ${viewMode === 'swipe' ? 'active' : ''}`}
                  onClick={() => handleViewModeChange('swipe')}
                  title="Swipe view"
                >
                  👆
                </button>
              </div>
            </div>
          )}
        </div> {/* Close search-results */}
      </div> {/* Close search-container */}

      {/* Message Modal */}
      <MessageModal
        isOpen={showMessageModal}
        profile={selectedUserForMessage}
        onClose={() => {
          setShowMessageModal(false);
          setSelectedUserForMessage(null);
        }}
      />

      {/* Save Search Modal */}
      <SaveSearchModal
        show={showSaveModal}
        onClose={() => {
          setShowSaveModal(false);
          setEditingScheduleFor(null);
        }}
        onSave={handleSaveSearch}
        savedSearches={savedSearches}
        onUpdate={handleUpdateSavedSearch}
        onDelete={handleDeleteSavedSearch}
        currentCriteria={searchCriteria}
        minMatchScore={minMatchScore}
        editingScheduleFor={editingScheduleFor}
      />

      {/* Chat First Prompt - shown before PII request */}
      <ChatFirstPrompt
        isOpen={showChatFirstPrompt}
        onClose={() => {
          setShowChatFirstPrompt(false);
          setPendingPIIRequestUser(null);
        }}
        onContinue={() => {
          if (pendingPIIRequestUser) {
            actuallyOpenPIIRequestModal(pendingPIIRequestUser);
          }
          setPendingPIIRequestUser(null);
        }}
        onOpenChat={() => {
          if (pendingPIIRequestUser) {
            handleMessage(pendingPIIRequestUser);
          }
          setPendingPIIRequestUser(null);
        }}
        targetUser={pendingPIIRequestUser}
      />

      {/* Exclusion Preview Modal */}
      {showExclusionPreview && exclusionPreviewData && (
        <div className="modal-overlay" onClick={() => setShowExclusionPreview(false)}>
          <div className="exclusion-preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ background: 'linear-gradient(135deg, var(--danger-color) 0%, #dc2626 100%)', color: 'var(--text-on-primary, white)', padding: '20px', borderRadius: '16px 16px 0 0' }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                🙈 Confirm Hide
              </h2>
              <button 
                className="modal-close" 
                onClick={() => setShowExclusionPreview(false)}
                style={{ background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', color: 'var(--text-on-primary, white)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ padding: '24px', background: 'var(--card-background)' }}>
              <p style={{ marginBottom: '16px', fontSize: '15px' }}>
                Hiding <strong>{selectedUserForExclusion?.firstName || exclusionPreviewData.target_username}</strong> will permanently remove:
              </p>
              
              <div style={{ background: 'var(--surface-color)', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
                {exclusionPreviewData.messages_count > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                    <span>💬 Messages</span>
                    <strong style={{ color: 'var(--danger-color)' }}>{exclusionPreviewData.messages_count}</strong>
                  </div>
                )}
                {exclusionPreviewData.favorites_count > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                    <span>❤️ Favorites</span>
                    <strong style={{ color: 'var(--danger-color)' }}>{exclusionPreviewData.favorites_count}</strong>
                  </div>
                )}
                {exclusionPreviewData.shortlists_count > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                    <span>📋 Shortlists</span>
                    <strong style={{ color: 'var(--danger-color)' }}>{exclusionPreviewData.shortlists_count}</strong>
                  </div>
                )}
                {exclusionPreviewData.pii_requests_count > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                    <span>📝 PII Requests</span>
                    <strong style={{ color: 'var(--danger-color)' }}>{exclusionPreviewData.pii_requests_count}</strong>
                  </div>
                )}
                {exclusionPreviewData.pii_access_count > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                    <span>🔓 PII Access</span>
                    <strong style={{ color: 'var(--danger-color)' }}>{exclusionPreviewData.pii_access_count}</strong>
                  </div>
                )}
                {exclusionPreviewData.notifications_count > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                    <span>🔔 Pending Notifications</span>
                    <strong style={{ color: 'var(--danger-color)' }}>{exclusionPreviewData.notifications_count}</strong>
                  </div>
                )}
                {exclusionPreviewData.total_items === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '8px 0' }}>
                    No existing data to remove
                  </div>
                )}
              </div>
              
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '0' }}>
                This action will also notify the user that a profile they were interested in is no longer available.
              </p>
            </div>
            <div className="modal-footer" style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: 'var(--card-background)', borderRadius: '0 0 16px 16px' }}>
              <button 
                onClick={() => setShowExclusionPreview(false)}
                style={{ padding: '10px 20px', borderRadius: '8px', border: '2px solid var(--border-color)', background: 'var(--surface-color)', color: 'var(--text-color)', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={confirmExclusion}
                disabled={exclusionLoading}
                style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, var(--danger-color) 0%, #dc2626 100%)', color: 'var(--text-on-primary, white)', cursor: 'pointer', fontWeight: '600' }}
              >
                {exclusionLoading ? '⏳ Processing...' : '🙈 Confirm Hide'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compatibility Score Contribution Modal */}
      {showMatchScoreModal && (
        <div className="modal-overlay" onClick={handleMatchScoreModalCancel}>
          <div className="modal-content contribution-appeal-modal" onClick={(e) => e.stopPropagation()}>
            <h3>🎯 Compatibility Score — Work in Progress</h3>
            <p className="modal-description">
              Our AI compatibility engine is resource-intensive. Your contribution helps keep this feature
              running for everyone — please consider contributing if you can. Thanks!
            </p>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={handleMatchScoreModalContribute}>
                💝 Contribute
              </button>
              <button className="btn btn-outline" onClick={handleMatchScoreModalContinue}>
                Try Anyway (Free)
              </button>
              <button className="btn btn-ghost" onClick={handleMatchScoreModalCancel}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PII Request Modal */}
      {selectedUserForPII && (
        <PIIRequestModal
          isOpen={showPIIRequestModal}
          profileUsername={selectedUserForPII.username}
          profileName={`${selectedUserForPII.firstName || selectedUserForPII.username}`}
          currentAccess={currentPIIAccess}
          requestStatus={getPIIRequestStatus(selectedUserForPII.username)}
          visibilitySettings={{
            contactNumberVisible: selectedUserForPII.contactNumberVisible,
            contactEmailVisible: selectedUserForPII.contactEmailVisible,
            linkedinUrlVisible: selectedUserForPII.linkedinUrlVisible
          }}
          targetProfile={selectedUserForPII}
          requesterProfile={currentUserProfile}
          onClose={() => {
            setShowPIIRequestModal(false);
            setSelectedUserForPII(null);
          }}
          onRefresh={() => {
            logger.info('🔄 PIIRequestModal requested refresh in SearchPage');
            loadPiiRequests(); // Refresh PII status when modal opens
          }}
          onSuccess={handlePIIRequestSuccessHook}
        />
      )}
    </div>
  );
};

export default SearchPage2;
