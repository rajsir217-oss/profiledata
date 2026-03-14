import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getImageUrl } from '../utils/urlHelper';
import api, { setDefaultSavedSearch, getDefaultSavedSearch, unsetDefaultSavedSearch } from '../api';
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
import SearchFiltersModal from './SearchFiltersModal';
import Profile from './Profile';
import GraphView from './GraphView';
import toastService from '../services/toastService';
import ToastContainer from './ToastContainer';
import useActivityLogger from '../hooks/useActivityLogger';
import { onPIIAccessChange } from '../utils/piiAccessEvents';
import logger from '../utils/logger';
import socketService from '../services/socketService';
import LoadMore from './LoadMore';
import './SearchPage2.css';

// Shared utility: build default search criteria from a user profile.
// Computes opposite gender, age range, and height range from partnerCriteria
// with gender-based fallbacks. Used by loadCurrentUserProfile,
// loadAndExecuteDefaultSearch, and getDefaultSearchCriteria / handleClearFilters.
const buildDefaultCriteria = (profile) => {
  if (!profile) {
    return { gender: '', ageMin: '', ageMax: '', heightMinFeet: '', heightMinInches: '', heightMaxFeet: '', heightMaxInches: '', daysBack: 30, hasPhoto: true };
  }

  const userGender = profile.gender?.toLowerCase();
  let oppositeGender = '';
  if (userGender === 'male') oppositeGender = 'female';
  else if (userGender === 'female') oppositeGender = 'male';

  // Calculate user's age
  let userAge = null;
  if (profile.birthMonth && profile.birthYear) {
    const today = new Date();
    userAge = today.getFullYear() - profile.birthYear;
    if (today.getMonth() + 1 < profile.birthMonth) userAge--;
  }

  // Parse user's height
  let userHeightTotalInches = null;
  if (profile.height) {
    const heightMatch = profile.height.match(/(\d+)'(\d+)"/);
    if (heightMatch) {
      userHeightTotalInches = parseInt(heightMatch[1]) * 12 + parseInt(heightMatch[2]);
    }
  }

  const partnerCriteria = profile.partnerCriteria;
  let defaultAgeMin = '', defaultAgeMax = '';
  let defaultHeightMinFeet = '', defaultHeightMinInches = '';
  let defaultHeightMaxFeet = '', defaultHeightMaxInches = '';

  // Age range: relative offsets → absolute range → gender-based fallback
  if (partnerCriteria?.ageRangeRelative && userAge) {
    const minOffset = partnerCriteria.ageRangeRelative.minOffset || 0;
    const maxOffset = partnerCriteria.ageRangeRelative.maxOffset || 5;
    defaultAgeMin = Math.max(19, userAge + minOffset).toString();
    defaultAgeMax = Math.min(100, userAge + maxOffset).toString();
  } else if (partnerCriteria?.ageRange?.min && partnerCriteria?.ageRange?.max) {
    defaultAgeMin = partnerCriteria.ageRange.min.toString();
    defaultAgeMax = partnerCriteria.ageRange.max.toString();
  } else if (userAge && userGender) {
    if (userGender === 'male') {
      defaultAgeMin = Math.max(19, userAge - 5).toString();
      defaultAgeMax = Math.min(100, userAge + 1).toString();
    } else if (userGender === 'female') {
      defaultAgeMin = Math.max(19, userAge - 1).toString();
      defaultAgeMax = Math.min(100, userAge + 5).toString();
    }
  }

  // Height range: relative offsets → absolute range → gender-based fallback
  if (partnerCriteria?.heightRangeRelative && userHeightTotalInches) {
    const minInchesOffset = partnerCriteria.heightRangeRelative.minInches || 0;
    const maxInchesOffset = partnerCriteria.heightRangeRelative.maxInches || 6;
    const minTotalInches = userHeightTotalInches + minInchesOffset;
    const maxTotalInches = userHeightTotalInches + maxInchesOffset;
    defaultHeightMinFeet = Math.floor(minTotalInches / 12).toString();
    defaultHeightMinInches = (minTotalInches % 12).toString();
    defaultHeightMaxFeet = Math.floor(maxTotalInches / 12).toString();
    defaultHeightMaxInches = (maxTotalInches % 12).toString();
  } else if (partnerCriteria?.heightRange?.minFeet) {
    defaultHeightMinFeet = partnerCriteria.heightRange.minFeet?.toString() || '';
    defaultHeightMinInches = partnerCriteria.heightRange.minInches?.toString() || '';
    defaultHeightMaxFeet = partnerCriteria.heightRange.maxFeet?.toString() || '';
    defaultHeightMaxInches = partnerCriteria.heightRange.maxInches?.toString() || '';
  } else if (userHeightTotalInches && userGender) {
    if (userGender === 'male') {
      const minTotalInches = userHeightTotalInches - 6;
      const maxTotalInches = userHeightTotalInches;
      defaultHeightMinFeet = Math.floor(minTotalInches / 12).toString();
      defaultHeightMinInches = (minTotalInches % 12).toString();
      defaultHeightMaxFeet = Math.floor(maxTotalInches / 12).toString();
      defaultHeightMaxInches = (maxTotalInches % 12).toString();
    } else if (userGender === 'female') {
      const minTotalInches = userHeightTotalInches + 1;
      const maxTotalInches = userHeightTotalInches + 6;
      defaultHeightMinFeet = Math.floor(minTotalInches / 12).toString();
      defaultHeightMinInches = (minTotalInches % 12).toString();
      defaultHeightMaxFeet = Math.floor(maxTotalInches / 12).toString();
      defaultHeightMaxInches = (maxTotalInches % 12).toString();
    }
  }

  return {
    gender: oppositeGender,
    ageMin: defaultAgeMin,
    ageMax: defaultAgeMax,
    heightMinFeet: defaultHeightMinFeet,
    heightMinInches: defaultHeightMinInches,
    heightMaxFeet: defaultHeightMaxFeet,
    heightMaxInches: defaultHeightMaxInches,
    daysBack: 30,
    hasPhoto: true,
    locations: []
  };
};

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
    // filterState
    {
      loadSavedSearches: () => {},
      loadOccupationOptions: () => {},
      loadLocationOptions: () => {},
    }
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
  
  // Saved searches state
  const [selectedSearch, setSelectedSearch] = useState(null);
  const [savedSearches, setSavedSearches] = useState([]);
  const [showSavedSearches, setShowSavedSearches] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [editingScheduleFor, setEditingScheduleFor] = useState(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
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
  const [excludedProfileUsername, setExcludedProfileUsername] = useState(null);
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
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  
  // HYBRID SEARCH: Traditional filters + L3V3L match score (premium feature)
  // State for online users
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  // L3V3L specific state
  const [minMatchScore, setMinMatchScore] = useState(0); // L3V3L match score filter
  const [isPremiumUser, setIsPremiumUser] = useState(false); // Premium status for L3V3L filtering
  const [systemConfig, setSystemConfig] = useState({ enable_l3v3l_for_all: true }); // System configuration
  const [isAdmin, setIsAdmin] = useState(false); // Admin role check for clear vs reset behavior
  const [excludedProfileMessage, setExcludedProfileMessage] = useState(null); // Message when profileId search hits exclusion
  const [excludedProfileId, setExcludedProfileId] = useState(null); // Profile ID of excluded profile
  
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
            setSortBy(state.sortBy || 'age');
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

  // Listen for external "open search modal" events (e.g. from TopBar)
  useEffect(() => {
    const handleOpenModal = () => setIsSearchModalOpen(true);
    window.addEventListener('openSearchModal', handleOpenModal);
    return () => window.removeEventListener('openSearchModal', handleOpenModal);
  }, []);

  // Trigger initial search after user profile is loaded - check for default saved search first
  useEffect(() => {
    let autoSearchTimerId = null; // Track setTimeout so cleanup can cancel it
    const loadAndExecuteDefaultSearch = async () => {
      if (!currentUserProfile || Object.keys(currentUserProfile).length === 0) {
        logger.info('⚠️ currentUserProfile is empty or null, waiting...');
        return;
      }

      // CRITICAL: Clear any stale users IMMEDIATELY - BEFORE any other checks
      // This prevents showing wrong-gender profiles from previous sessions
      // Must happen even if hasAutoExecutedRef is true (e.g., from restored state)
      logger.info('🧹 Clearing stale users before loading search criteria');
      setUsers([]);

      // Prevent multiple auto-executions (or if state was restored)
      if (hasAutoExecutedRef.current) {
        logger.info('⏭️ Already auto-executed default search or state restored, skipping');
        return;
      }

      try {
        // Check if there's a default saved search
        logger.info('⭐ Checking for default saved search for user:', localStorage.getItem('username'));
        const response = await getDefaultSavedSearch();
        const defaultSearch = response?.savedSearch || response;
        
        if (defaultSearch && defaultSearch.criteria) {
          logger.info('⭐ Found default saved search:', defaultSearch.name);
          logger.info('📋 Default search criteria:', defaultSearch.criteria);
          
          // Extract minMatchScore from saved search
          const loadedMinScore = defaultSearch.minMatchScore !== undefined ? defaultSearch.minMatchScore : 0;
          
          // SAFETY: Enforce opposite-gender filter for non-admin users
          // Saved searches might have gender='' or wrong gender - override it
          const userRole = currentUserProfile?.role?.toLowerCase();
          const isPrivileged = userRole === 'admin' || userRole === 'moderator';
          if (!isPrivileged) {
            const defaults = buildDefaultCriteria(currentUserProfile);
            if (defaults.gender && defaultSearch.criteria.gender !== defaults.gender) {
              logger.info(`🚻 Overriding saved search gender '${defaultSearch.criteria.gender}' → '${defaults.gender}'`);
              defaultSearch.criteria.gender = defaults.gender;
            }
          }
          
          // Load criteria and set selected search
          setSearchCriteria(defaultSearch.criteria);
          setMinMatchScore(loadedMinScore);
          setSelectedSearch(defaultSearch);
          
          // Mark as executed
          hasAutoExecutedRef.current = true;
          
          // Execute the search with explicit criteria AND minMatchScore
          // Delay slightly to ensure state is processed by React
          autoSearchTimerId = setTimeout(() => {
            // Check if user has entered a profileId - if so, skip auto-search
            const profileIdInput = document.getElementById('profileId-input');
            if (profileIdInput && profileIdInput.value.trim()) {
              logger.info('⏭️ Skipping auto-search - user has entered profileId:', profileIdInput.value);
              return;
            }
            logger.info('🔍 Auto-executing default saved search');
            handleSearchHook(1, loadedMinScore, defaultSearch.criteria);
            toastService.info(`⭐ Default search "${defaultSearch.name}" executed`);
          }, 100);
        } else {
          // No default saved search - execute search with partnerCriteria defaults
          // This ensures fresh results matching the displayed filter criteria
          logger.info('🔍 No default search found - building criteria from partnerCriteria');
          
          // Build the COMPLETE criteria object using shared utility
          const defaults = buildDefaultCriteria(currentUserProfile);
          const partnerCriteriaDefaults = {
            keyword: '',
            profileId: '',
            ...defaults,
            heightMin: '',
            heightMax: '',
            location: '',
            education: '',
            occupation: '',
            occupations: [],
            religion: '',
            caste: '',
            drinking: '',
            smoking: '',
            relationshipStatus: '',
            newlyAdded: false,
          };
          
          logger.info('📋 Built partnerCriteria defaults:', partnerCriteriaDefaults);
          
          // Set complete criteria object (not merging)
          setSearchCriteria(partnerCriteriaDefaults);
          
          // Mark as executed
          hasAutoExecutedRef.current = true;
          
          // Execute search with explicit criteria (don't rely on async state)
          // Note: Users already cleared at line 628 at start of function
          autoSearchTimerId = setTimeout(() => {
            // Check if user has entered a profileId - if so, skip auto-search
            const profileIdInput = document.getElementById('profileId-input');
            if (profileIdInput && profileIdInput.value.trim()) {
              logger.info('⏭️ Skipping auto-search - user has entered profileId:', profileIdInput.value);
              return;
            }
            logger.info('🔍 Auto-executing search with partnerCriteria defaults');
            handleSearchHook(1, 0, partnerCriteriaDefaults);
          }, 100);
        }
      } catch (err) {
        logger.error('Error loading default saved search:', err);
        
        // FALLBACK: If loading default search fails, execute with partner criteria
        // Without this, no search would ever execute on page load
        if (!hasAutoExecutedRef.current) {
          logger.info('🔍 Fallback: executing search with partnerCriteria after error');
          const defaults = buildDefaultCriteria(currentUserProfile);
          const fallbackCriteria = {
            keyword: '',
            profileId: '',
            ...defaults,
            heightMin: '',
            heightMax: '',
            location: '',
            education: '',
            occupation: '',
            occupations: [],
            religion: '',
            caste: '',
            drinking: '',
            smoking: '',
            relationshipStatus: '',
            newlyAdded: false,
          };
          setSearchCriteria(fallbackCriteria);
          hasAutoExecutedRef.current = true;
          autoSearchTimerId = setTimeout(() => {
            handleSearchHook(1, 0, fallbackCriteria);
          }, 100);
        }
      }
    };

    loadAndExecuteDefaultSearch();
    
    return () => {
      if (autoSearchTimerId) clearTimeout(autoSearchTimerId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserProfile]);
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
    loadOccupationOptions();
  }, []);

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
    loadLocationOptions();
  }, []);

  // NOTE: Standalone loadUserFavorites, loadUserShortlist, loadUserExclusions
  // were removed — they duplicated the loadUserData() function (which uses
  // Promise.all) and were never called.
  const loadSavedSearches = async () => {
    try {
      const username = localStorage.getItem('username');
      if (username) {
        const response = await api.get(`/${username}/saved-searches`);
        setSavedSearches(response.data.savedSearches || []);
      }
    } catch (err) {
      if (err.response?.status === 404 || err.response?.data?.savedSearches?.length === 0) {
        logger.info('No saved searches found for user (this is normal for new users)');
        setSavedSearches([]);
      } else {
        logger.error('Error loading saved searches:', err);
        setSavedSearches([]);
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    logger.info(`🔧 Input changed: ${name} = ${value}`);
    setSearchCriteria(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Calculate default search criteria from user profile and partnerCriteria
  // Delegates to shared buildDefaultCriteria utility
  const getDefaultSearchCriteria = () => {
    const defaults = buildDefaultCriteria(currentUserProfile);
    logger.info('🔄 Reset: computed defaults from buildDefaultCriteria:', defaults);
    return defaults;
  };

  // Wrapper for minMatchScore changes - triggers new search
  const handleMinMatchScoreChange = (newScore) => {
    setMinMatchScore(newScore);
    // Note: L3V3L filtering is done client-side after server results
  };

  // Handle sort changes - CLIENT-SIDE ONLY (no server re-fetch needed)
  // The data is already loaded, just re-sort it
  const handleSortChange = (e) => {
    const newSortBy = e.target.value;
    logger.info(`🔀 Sort changed to: ${newSortBy}`);
    setSortBy(newSortBy);
    // Don't trigger server search - client-side sorting handles it
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Toggle sort order - CLIENT-SIDE ONLY (no server re-fetch needed)
  const toggleSortOrder = () => {
    const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    logger.info(`🔀 Sort order changed to: ${newOrder}`);
    setSortOrder(newOrder);
    // Don't trigger server search - client-side sorting handles it
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
        daysBack: 30,
        hasPhoto: true,
        sortBy: 'age',
        sortOrder: 'asc'
      });
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
        daysBack: defaults.daysBack || 30,
        hasPhoto: true,
        sortBy: 'age',
        sortOrder: 'asc'
      });
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

  const generateSearchDescription = (criteria, matchScore = null) => {
    const parts = [];
    
    // Start with "I'm looking for"
    let intro = "I'm looking for";
    
    // Gender
    if (criteria.gender) {
      const genderMap = {
        'male': 'a guy',
        'female': 'a girl',
        'other': 'someone'
      };
      intro += ` ${genderMap[criteria.gender.toLowerCase()] || 'someone'}`;
    } else {
      intro += ' someone';
    }
    
    parts.push(intro);
    
    // Age range
    if (criteria.ageMin || criteria.ageMax) {
      const ageMin = criteria.ageMin || '?';
      const ageMax = criteria.ageMax || '?';
      parts.push(`age ranges from ${ageMin} to ${ageMax} years old`);
    }
    
    // Height range
    if (criteria.heightMinFeet || criteria.heightMaxFeet) {
      const heightMin = criteria.heightMinFeet 
        ? `${criteria.heightMinFeet}ft${criteria.heightMinInches ? ' ' + criteria.heightMinInches + 'in' : ''}`
        : '?';
      const heightMax = criteria.heightMaxFeet 
        ? `${criteria.heightMaxFeet}ft${criteria.heightMaxInches ? ' ' + criteria.heightMaxInches + 'in' : ''}`
        : '?';
      parts.push(`height from ${heightMin} to ${heightMax}`);
    }
    
    // Location (handle both single location and locations array)
    if (criteria.locations && criteria.locations.length > 0) {
      if (criteria.locations.length === 1) {
        parts.push(`living around ${criteria.locations[0]}`);
      } else {
        parts.push(`living around ${criteria.locations.slice(0, 2).join(' or ')}${criteria.locations.length > 2 ? ` (+${criteria.locations.length - 2} more)` : ''}`);
      }
    } else if (criteria.location) {
      parts.push(`living around ${criteria.location}`);
    }
    
    // Religion
    if (criteria.religion && criteria.religion !== '') {
      parts.push(`religion ${criteria.religion}`);
    }
    
    // Education
    if (criteria.education && criteria.education !== '') {
      parts.push(`education ${criteria.education}`);
    }
    
    // Occupation (handle both old single and new multi-select format)
    if (criteria.occupations && criteria.occupations.length > 0) {
      if (criteria.occupations.length === 1) {
        parts.push(`working as ${criteria.occupations[0]}`);
      } else {
        parts.push(`working as ${criteria.occupations.slice(0, 2).join(' or ')}${criteria.occupations.length > 2 ? ` (+${criteria.occupations.length - 2} more)` : ''}`);
      }
    } else if (criteria.occupation && criteria.occupation !== '') {
      // Backward compatibility
      parts.push(`working as ${criteria.occupation}`);
    }
    
    // Body Type
    if (criteria.bodyType && criteria.bodyType !== '') {
      parts.push(`body type ${criteria.bodyType.toLowerCase()}`);
    }
    
    // Eating Preference
    if (criteria.eatingPreference && criteria.eatingPreference !== '') {
      parts.push(`eating preference ${criteria.eatingPreference.toLowerCase()}`);
    }
    
    // L3V3L Match Score
    const effectiveScore = matchScore !== null ? matchScore : minMatchScore;
    logger.info('🦋 L3V3L Score check - matchScore:', matchScore, 'minMatchScore:', minMatchScore, 'effectiveScore:', effectiveScore);
    if (effectiveScore > 0) {
      parts.push(`L3V3L match score ≥${effectiveScore}%`);
      logger.info('✅ Added L3V3L to description');
    } else {
      logger.info('❌ L3V3L score is 0, skipping');
    }
    
    // Keyword
    if (criteria.keyword) {
      parts.push(`with keywords "${criteria.keyword}"`);
    }
    
    // Days Back (new profiles)
    if (criteria.daysBack && criteria.daysBack > 0) {
      parts.push(`joined in last ${criteria.daysBack} days`);
    }
    
    // Join all parts with commas and "and" before the last item
    if (parts.length === 0) {
      return "Search with no specific criteria";
    }
    
    if (parts.length === 1) {
      return parts[0];
    }
    
    // Join with commas and add "and" before last item
    const lastPart = parts.pop();
    return parts.join(', ') + ' and ' + lastPart;
  };

  const handleUpdateSavedSearch = async (searchId, newName) => {
    try {
      const username = localStorage.getItem('username');
      await api.put(`/${username}/saved-searches/${searchId}`, { name: newName });
      toastService.success(`✅ Search renamed to: "${newName}"`);
      loadSavedSearches();
    } catch (err) {
      logger.error('Error updating saved search:', err);
      toastService.error('Failed to update saved search');
    }
  };

  const handleLoadSavedSearch = (savedSearch) => {
    // Handle occupation format conversion for backward compatibility
    const criteria = { ...savedSearch.criteria };
    
    // Convert old single occupation to new occupations array format
    if (criteria.occupation && !criteria.occupations) {
      criteria.occupations = [criteria.occupation];
      delete criteria.occupation; // Remove old field
    } else if (!criteria.occupations) {
      criteria.occupations = [];
    }
    
    // Convert old single location to new locations array format
    if (criteria.location && !criteria.locations) {
      criteria.locations = [criteria.location];
      delete criteria.location; // Remove old field
    } else if (!criteria.locations) {
      criteria.locations = [];
    }
    
    // Apply default daysBack if not set in saved search (for backward compatibility)
    const criteriaWithDefaults = {
      ...criteria,
      daysBack: criteria.daysBack || 30,
      hasPhoto: criteria.hasPhoto !== undefined ? criteria.hasPhoto : true
    };
    
    // SAFETY: Enforce opposite-gender filter for non-admin users
    const userRole = currentUserProfile?.role?.toLowerCase();
    const isPrivileged = userRole === 'admin' || userRole === 'moderator';
    if (!isPrivileged) {
      const defaults = buildDefaultCriteria(currentUserProfile);
      if (defaults.gender && criteriaWithDefaults.gender !== defaults.gender) {
        logger.info(`🚻 Overriding saved search gender '${criteriaWithDefaults.gender}' → '${defaults.gender}'`);
        criteriaWithDefaults.gender = defaults.gender;
      }
    }
    
    setSearchCriteria(criteriaWithDefaults);
    // Restore L3V3L match score if saved
    const loadedMinScore = savedSearch.minMatchScore !== undefined ? savedSearch.minMatchScore : 0;
    setMinMatchScore(loadedMinScore);
    setSelectedSearch(savedSearch);
    setShowSavedSearches(false);
    toastService.info(`📂 Loaded saved search: "${savedSearch.name}"`);
    
    // Automatically perform search with loaded criteria
    // Pass the criteria directly to handleSearch to ensure immediate execution with correct values
    setTimeout(() => {
      handleSearchHook(1, loadedMinScore, criteriaWithDefaults);
    }, 100);
  };

  const handleDeleteSavedSearch = async (searchId) => {
    if (!searchId) {
      toastService.error('Cannot delete: Invalid search ID');
      return;
    }
    
    try {
      const username = localStorage.getItem('username');
      await api.delete(`/${username}/saved-searches/${searchId}`);
      toastService.success('✅ Search deleted successfully');
      loadSavedSearches();
      // Clear selected search if it was deleted
      if (selectedSearch && (selectedSearch.id === searchId || selectedSearch._id === searchId)) {
        setSelectedSearch(null);
      }
    } catch (err) {
      logger.error('❌ Error deleting saved search:', err);
      toastService.error('Failed to delete saved search');
    }
  };

  const handleSetDefaultSearch = async (searchId, searchName, isCurrentlyDefault = false) => {
    try {
      if (isCurrentlyDefault) {
        // Unset the default
        await unsetDefaultSavedSearch();
        toastService.success(`☆ "${searchName}" is no longer the default search`);
      } else {
        // Set as default
        await setDefaultSavedSearch(searchId);
        toastService.success(`⭐ "${searchName}" set as default search`);
      }
      loadSavedSearches();
    } catch (err) {
      logger.error('Error toggling default search:', err);
      toastService.error('Failed to update default search');
    }
  };

  const handleEditSchedule = (search) => {
    setEditingScheduleFor(search);
    setShowSaveModal(true);
  };

  const handleSaveSearch = async (saveData) => {
    try {
      const username = localStorage.getItem('username');
      if (!username) {
        toastService.error('Please login to save searches');
        return;
      }

      // Generate human-readable description (pass minMatchScore)
      logger.info('🔍 Saving search with minMatchScore:', minMatchScore);
      const description = generateSearchDescription(searchCriteria, minMatchScore);
      logger.info('📝 Generated description:', description);

      // Handle both old format (string) and new format (object with notifications)
      const searchName = typeof saveData === 'string' ? saveData : saveData.name;
      const notifications = typeof saveData === 'object' ? saveData.notifications : null;

      const searchData = {
        name: searchName.trim(),
        description: description,
        criteria: searchCriteria,
        minMatchScore: minMatchScore, // Save L3V3L match score
        created_at: new Date().toISOString(),
        ...(notifications && { notifications }) // Add notifications if provided
      };
      
      logger.info('💾 Search data to save:', searchData);

      await api.post(`/${username}/saved-searches`, searchData);

      const notificationMsg = notifications?.enabled 
        ? ` with ${notifications.frequency} notifications`
        : '';
      toastService.success(`✅ Search saved: "${searchName}"${notificationMsg}`);
      
      // Close both modals after successful save
      setShowSaveModal(false);
      setIsSearchModalOpen(false);
      setEditingScheduleFor(null);
      
      loadSavedSearches();
    } catch (err) {
      logger.error('Error saving search:', err);
      toastService.error('Failed to save search. ' + (err.response?.data?.detail || err.message));
    }
  };

  const parseHeight = (height) => {
    if (!height) return null;
    const match = height.match(/(\d+)'(\d+)"/);
    if (match) {
      return parseInt(match[1]) * 12 + parseInt(match[2]);
    }
    return null;
  };

  const calculateAge = (birthMonth, birthYear) => {
    if (!birthMonth || !birthYear) return null;
    const today = new Date();
    let age = today.getFullYear() - birthYear;
    
    if (today.getMonth() + 1 < birthMonth) {
      age--;
    }

    return age;
  };

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
    try {
      setExclusionLoading(true);
      const targetUsername = selectedUserForExclusion.username;
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

    // Apply sorting to filtered users
    const sortedUsers = [...filteredUsers].sort((a, b) => {
      let compareValue = 0;

      switch (sortBy) {
        case 'matchScore':
          compareValue = (b.matchScore || 0) - (a.matchScore || 0);
          break;
        
        case 'firstName':
        case 'name':
          const nameA = (a.firstName || a.name || '').toLowerCase();
          const nameB = (b.firstName || b.name || '').toLowerCase();
          compareValue = nameA.localeCompare(nameB);
          break;
        
        case 'age':
          const ageA = a.age || calculateAge(a.birthMonth, a.birthYear) || 0;
          const ageB = b.age || calculateAge(b.birthMonth, b.birthYear) || 0;
          compareValue = ageB - ageA;
          break;
        
        case 'height':
        case 'heightInches':
          const heightA = parseHeight(a.height) || 0;
          const heightB = parseHeight(b.height) || 0;
          compareValue = heightB - heightA;
          break;
        
        case 'location':
          const locA = (a.location || '').toLowerCase();
          const locB = (b.location || '').toLowerCase();
          compareValue = locB.localeCompare(locA);
          break;
        
        case 'education':
          const eduA = (a.education || '').toLowerCase();
          const eduB = (b.education || '').toLowerCase();
          compareValue = eduA.localeCompare(eduB);
          break;
        
        case 'occupation':
          const occA = (a.occupation || '').toLowerCase();
          const occB = (b.occupation || '').toLowerCase();
          compareValue = occB.localeCompare(occA);
          break;
        
        case 'newest':
          const dateA = new Date(a.adminApprovedAt || a.createdAt || 0).getTime();
          const dateB = new Date(b.adminApprovedAt || b.createdAt || 0).getTime();
          compareValue = dateB - dateA;
          break;
        
        default:
          compareValue = 0;
      }

      // Apply sort order (desc = default natural order, asc = reversed)
      return sortOrder === 'desc' ? compareValue : -compareValue;
    });

    // Deduplicate by username to prevent any duplicates from showing
    return sortedUsers.filter((user, index, self) => 
      index === self.findIndex(u => u.username === user.username)
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, searchCriteria.profileId, searchCriteria.gender, minMatchScore, sortBy, sortOrder]);

  const getActiveCriteriaSummary = () => {
    const summary = [];
    
    // Show saved search name if loaded (skip if it looks like raw criteria data)
    if (selectedSearch?.name && !selectedSearch.name.includes('|')) {
      summary.push(`📂 ${selectedSearch.name}`);
    }
    
    if (searchCriteria.profileId) {
      summary.push(`Profile ID: ${searchCriteria.profileId}`);
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
    if (searchCriteria.daysBack && searchCriteria.daysBack > 0) {
      summary.push(`📅 Last ${searchCriteria.daysBack}d`);
    }
    
    return summary.length > 0 ? summary.join(' • ') : 'Showing all matches';
  };

  return (
    <div className="search-page">
      
      {/* Floating Search Trigger Button */}
      <button 
        className="floating-search-trigger"
        onClick={() => setIsSearchModalOpen(true)}
        title="Open Search Filters"
        style={{ 
          position: 'fixed', 
          bottom: '30px', 
          right: '30px',
          width: '36px',
          height: '36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <span style={{ fontSize: '16px', lineHeight: 1 }}>🔍</span>
        <span className="trigger-text">Search Filters</span>
      </button>

      {/* Search Filters Modal */}
      <SearchFiltersModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        searchCriteria={searchCriteria}
        minMatchScore={minMatchScore}
        setMinMatchScore={handleMinMatchScoreChange}
        handleInputChange={handleInputChange}
        showAdvancedFilters={showAdvancedFilters}
        setShowAdvancedFilters={setShowAdvancedFilters}
        onSearch={() => handleSearchHook(1)}
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
        savedSearches={savedSearches}
        selectedSearch={selectedSearch}
        handleLoadSavedSearch={handleLoadSavedSearch}
        handleDeleteSavedSearch={handleDeleteSavedSearch}
        handleEditSchedule={handleEditSchedule}
        handleSetDefaultSearch={handleSetDefaultSearch}
        generateSearchDescription={generateSearchDescription}
        loadSavedSearches={loadSavedSearches}
      />

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

      {/* Active Criteria Summary Bar - Header at top */}
      <div className="active-criteria-bar" onClick={() => setIsSearchModalOpen(true)}>
        <div className="criteria-info">
          <span className="criteria-label">FILTERS:</span>
          <span className="criteria-value">{getActiveCriteriaSummary()}</span>
        </div>
        <div className="criteria-actions">
          <span className="results-count">
            <span className="results-count-number">{totalResults}</span>
            <span className="results-count-text"> - found</span>
          </span>
          <button className="btn-modify-search">
            <span className="modify-text">Modify Search </span><span className="modify-icon">⚙️</span>
          </button>
        </div>
      </div>

      <div className="search-container">
        <div className="search-results" ref={searchResultsRef}>
          {loading && (
            <div className="text-center py-4">
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{
                  fontSize: '32px',
                  animation: 'pulse 1s ease-in-out infinite'
                }}>
                  ⏱️
                </div>
                <div style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  color: 'var(--primary-color)',
                  fontFamily: 'monospace'
                }}>
                  {elapsedTime}s
                </div>
                <div style={{
                  fontSize: '13px',
                  color: 'var(--text-muted)'
                }}>
                  Loading profiles...
                </div>
              </div>
            </div>
          )}

          {!loading && currentRecords.length === 0 && (
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
                    ) is in your exclusions list
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
                  <p>Try adjusting your search criteria or use broader filters or reload the page.</p>
                </>
              )}
            </div>
          )}

          {/* Sort Controls - Before Results */}
          {/* Only show results after initial search completes to prevent stale data flash */}
          {initialSearchComplete && currentRecords.length > 0 && (
            <div className="sort-controls-top">
              {/* Layout Toggle Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Layout:
                </span>
                <div className="layout-toggle-buttons" style={{ display: 'flex', gap: '6px' }}>
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
                        style={{
                          padding: '6px 12px',
                          fontSize: '14px',
                          borderRadius: 'var(--radius-sm)',
                          border: isActive ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                          background: isActive ? 'var(--primary-color)' : 'var(--surface-color)',
                          color: isActive ? 'white' : 'var(--text-color)',
                          cursor: 'pointer',
                          fontWeight: isActive ? 600 : 400,
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <span className="layout-toggle-btn-icon">{icon}</span><span className="layout-toggle-btn-text"> {label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'nowrap' }}>
                <span className="sort-by-label" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  Sort by:
                </span>
                <select
                  value={sortBy}
                  onChange={handleSortChange}
                  className="form-select form-select-sm"
                  style={{
                    minWidth: '180px',
                    fontSize: '14px',
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    background: 'var(--input-bg)',
                    color: 'var(--text-color)',
                    cursor: 'pointer'
                  }}
                >
                  <option value="matchScore">🎯 Compatibility Score</option>
                  <option value="age">📅 Age</option>
                  <option value="height">📏 Height</option>
                  <option value="location">📍 Location</option>
                  <option value="occupation">💼 Profession</option>
                  <option value="newest">🆕 Newest Members</option>
                </select>
                <button
                  onClick={toggleSortOrder}
                  className="layout-toggle-btn sort-order-btn"
                  style={{
                    padding: '6px 10px',
                    fontSize: '14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    background: 'var(--surface-color)',
                    color: 'var(--text-color)',
                    cursor: 'pointer',
                    fontWeight: 400,
                    transition: 'all 0.2s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '36px',
                    height: '36px',
                    flexShrink: 0
                  }}
                  title={`Sort order: ${sortOrder === 'desc' ? 'Descending' : 'Ascending'}`}
                >
                  <span className="layout-toggle-btn-icon">{sortOrder === 'desc' ? '↓' : '↑'}</span>
                </button>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 600 }}>Profiles:</span>
                <span 
                  style={{ 
                    background: 'var(--primary-color)', 
                    color: 'white', 
                    padding: '2px 8px', 
                    borderRadius: '12px',
                    fontWeight: 600,
                    fontSize: '12px',
                    cursor: 'help'
                  }}
                  title="Total matches found by search"
                >
                  {totalResults}
                </span>
                <span>|</span>
                <span 
                  style={{ 
                    background: 'var(--success-color)', 
                    color: 'white', 
                    padding: '2px 8px', 
                    borderRadius: '12px',
                    fontWeight: 600,
                    fontSize: '12px',
                    cursor: 'help'
                  }}
                  title="Profiles currently loaded (unique)"
                >
                  {currentRecords.length}
                </span>
                <span>|</span>
                <span 
                  style={{ 
                    background: 'var(--danger-color)', 
                    color: 'white', 
                    padding: '2px 8px', 
                    borderRadius: '12px',
                    fontWeight: 600,
                    fontSize: '12px',
                    cursor: 'help'
                  }}
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
                        color: 'white',
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
                    color: 'white',
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
                  <span style={{ paddingRight: '6px', borderRight: '1px solid rgba(255,255,255,0.2)', height: '100%', display: 'flex', alignItems: 'center' }}>#</span>
                  <span style={{ paddingRight: '6px', borderRight: '1px solid rgba(255,255,255,0.2)', height: '100%', display: 'flex', alignItems: 'center' }}></span>
                  <span 
                    className="resizable-header"
                    onClick={() => { setSortBy('firstName'); setSortOrder(sortBy === 'firstName' && sortOrder === 'asc' ? 'desc' : 'asc'); }}
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', position: 'relative', paddingRight: '10px', borderRight: '1px solid rgba(255,255,255,0.2)', height: '100%' }}
                    title="Sort by name"
                  >
                    Name {sortBy === 'firstName' && (sortOrder === 'asc' ? '↑' : '↓')}
                    <div className="resize-handle" onMouseDown={(e) => handleResizeStart(e, 'name')} />
                  </span>
                  <span 
                    className="resizable-header"
                    onClick={() => { setSortBy('matchScore'); setSortOrder(sortBy === 'matchScore' && sortOrder === 'desc' ? 'asc' : 'desc'); }}
                    style={{ cursor: 'pointer', textAlign: 'center', position: 'relative', paddingRight: '10px', borderRight: '1px solid rgba(255,255,255,0.2)', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Sort by L3V3L compatibility score"
                  >
                    🎯 {sortBy === 'matchScore' && (sortOrder === 'desc' ? '↓' : '↑')}
                    <div className="resize-handle" onMouseDown={(e) => handleResizeStart(e, 'score')} />
                  </span>
                  <span 
                    className="resizable-header"
                    onClick={() => { setSortBy('age'); setSortOrder(sortBy === 'age' && sortOrder === 'asc' ? 'desc' : 'asc'); }}
                    style={{ cursor: 'pointer', textAlign: 'center', position: 'relative', paddingRight: '10px', borderRight: '1px solid rgba(255,255,255,0.2)', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Sort by age"
                  >
                    Age {sortBy === 'age' && (sortOrder === 'asc' ? '↑' : '↓')}
                    <div className="resize-handle" onMouseDown={(e) => handleResizeStart(e, 'age')} />
                  </span>
                  <span 
                    className="resizable-header"
                    onClick={() => { setSortBy('heightInches'); setSortOrder(sortBy === 'heightInches' && sortOrder === 'asc' ? 'desc' : 'asc'); }}
                    style={{ cursor: 'pointer', textAlign: 'center', position: 'relative', paddingRight: '10px', borderRight: '1px solid rgba(255,255,255,0.2)', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Sort by height"
                  >
                    Height {sortBy === 'heightInches' && (sortOrder === 'asc' ? '↑' : '↓')}
                    <div className="resize-handle" onMouseDown={(e) => handleResizeStart(e, 'height')} />
                  </span>
                  <span 
                    className="resizable-header"
                    onClick={() => { setSortBy('location'); setSortOrder(sortBy === 'location' && sortOrder === 'asc' ? 'desc' : 'asc'); }}
                    style={{ cursor: 'pointer', position: 'relative', paddingRight: '10px', borderRight: '1px solid rgba(255,255,255,0.2)', height: '100%', display: 'flex', alignItems: 'center' }}
                    title="Sort by location"
                  >
                    Location {sortBy === 'location' && (sortOrder === 'asc' ? '↑' : '↓')}
                    <div className="resize-handle" onMouseDown={(e) => handleResizeStart(e, 'location')} />
                  </span>
                  <span 
                    className="resizable-header"
                    onClick={() => { setSortBy('education'); setSortOrder(sortBy === 'education' && sortOrder === 'asc' ? 'desc' : 'asc'); }}
                    style={{ cursor: 'pointer', position: 'relative', paddingRight: '10px', borderRight: '1px solid rgba(255,255,255,0.2)', height: '100%', display: 'flex', alignItems: 'center' }}
                    title="Sort by education"
                  >
                    Education {sortBy === 'education' && (sortOrder === 'asc' ? '↑' : '↓')}
                    <div className="resize-handle" onMouseDown={(e) => handleResizeStart(e, 'education')} />
                  </span>
                  <span 
                    className="resizable-header"
                    onClick={() => { setSortBy('occupation'); setSortOrder(sortBy === 'occupation' && sortOrder === 'asc' ? 'desc' : 'asc'); }}
                    style={{ cursor: 'pointer', position: 'relative', paddingRight: '10px', borderRight: '1px solid rgba(255,255,255,0.2)', height: '100%', display: 'flex', alignItems: 'center' }}
                    title="Sort by occupation"
                  >
                    Occupati... {sortBy === 'occupation' && (sortOrder === 'asc' ? '↑' : '↓')}
                    <div className="resize-handle" onMouseDown={(e) => handleResizeStart(e, 'occupation')} />
                  </span>
                  <span style={{ borderRight: '1px solid rgba(255,255,255,0.2)', height: '100%', display: 'flex', alignItems: 'center' }}>Tags</span>
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
              itemsPerLoad={20}
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
            <div className="modal-header" style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', color: 'white', padding: '20px', borderRadius: '16px 16px 0 0' }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                🙈 Confirm Hide
              </h2>
              <button 
                className="modal-close" 
                onClick={() => setShowExclusionPreview(false)}
                style={{ background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', color: 'white', cursor: 'pointer' }}
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
                style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', color: 'white', cursor: 'pointer', fontWeight: '600' }}
              >
                {exclusionLoading ? '⏳ Processing...' : '🙈 Confirm Hide'}
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
