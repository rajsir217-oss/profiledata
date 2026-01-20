import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getImageUrl } from '../utils/urlHelper';
import api, { setDefaultSavedSearch, getDefaultSavedSearch, unsetDefaultSavedSearch } from '../api';
import SearchResultCard from './SearchResultCard';
import SwipeableCard from './SwipeableCard';
import MessageModal from './MessageModal';
import SaveSearchModal from './SaveSearchModal';
import PIIRequestModal from './PIIRequestModal';
import ChatFirstPrompt from './ChatFirstPrompt';
import OnlineStatusBadge from './OnlineStatusBadge';
import UniversalTabContainer from './UniversalTabContainer';
import SearchFilters from './SearchFilters';
import LoadMore from './LoadMore';
import socketService from '../services/socketService';
import { onPIIAccessChange } from '../utils/piiAccessEvents';
import logger from '../utils/logger';
import SearchFiltersModal from './SearchFiltersModal';
import Profile from './Profile';
import toastService from '../services/toastService';
import useActivityLogger from '../hooks/useActivityLogger';
import './SearchPage2.css';

const SearchPage2 = () => {
  // Activity logger hook
  const { logPageVisit, logSearchResultsViewed, logFilterApplied, logSortChanged } = useActivityLogger();
  
  // HYBRID SEARCH: Traditional filters + L3V3L match score (premium feature)
  // State for image indices per user
  const [imageIndices, setImageIndices] = useState({});
  const [imageErrors, setImageErrors] = useState({});
  // eslint-disable-next-line no-unused-vars
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  // Main application state
  const [loading, setLoading] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [error, setError] = useState('');
  const [initialSearchComplete, setInitialSearchComplete] = useState(false); // Track if initial search has run
  // const [totalResults, setTotalResults] = useState(0); // Unused - kept for future pagination
  // currentPage removed - using LoadMore incremental loading instead

  // L3V3L specific state
  const [minMatchScore, setMinMatchScore] = useState(0); // L3V3L match score filter
  const [isPremiumUser, setIsPremiumUser] = useState(false); // Premium status for L3V3L filtering
  const [systemConfig, setSystemConfig] = useState({ enable_l3v3l_for_all: true }); // System configuration
  const [isAdmin, setIsAdmin] = useState(false); // Admin role check for clear vs reset behavior

  // User interaction state
  const [users, setUsers] = useState([]);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const [searchCriteria, setSearchCriteria] = useState({
    keyword: '',
    profileId: '', // Direct Profile ID lookup
    gender: '', // Will be set to opposite gender after loading user profile
    ageMin: '',
    ageMax: '',
    heightMinFeet: '',
    heightMinInches: '',
    heightMaxFeet: '',
    heightMaxInches: '',
    heightMin: '', // Kept for backward compatibility
    heightMax: '', // Kept for backward compatibility
    location: '',
    education: '',
    occupation: '',
    religion: '',
    caste: '',
    drinking: '',
    smoking: '',
    relationshipStatus: '',
    newlyAdded: false,
    daysBack: 30, // Number of days to look back for profile creation (default: 30)
  });
  const [favoritedUsers, setFavoritedUsers] = useState(new Set());
  const [shortlistedUsers, setShortlistedUsers] = useState(new Set());
  const [excludedUsers, setExcludedUsers] = useState(new Set());
  const [statusMessage, setStatusMessage] = useState('');
  
  // View mode state - default based on screen size (swipe for mobile, split for desktop)
  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem('searchViewMode');
    if (saved) return saved;
    // Default: swipe on mobile (<=768px), split on desktop
    return window.innerWidth <= 768 ? 'swipe' : 'split';
  }); // 'cards', 'rows', 'split', or 'swipe'
  const [cardsPerRow, setCardsPerRow] = useState(() => {
    const saved = localStorage.getItem('searchCardsPerRow');
    return saved ? parseInt(saved) : 4;
  });
  
  // Swipe mode state - tracks current card index in swipe view
  const [swipeIndex, setSwipeIndex] = useState(0);
  
  // Split-screen layout state
  const [selectedProfileForDetail, setSelectedProfileForDetail] = useState(null);
  const [expandedSections, setExpandedSections] = useState({
    aboutMe: true,
    lookingFor: true,
    basicInfo: false,
    lifestyle: false,
    contact: false,
    preferences: false
  });
  
  // Handler to change view mode and persist to localStorage
  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    localStorage.setItem('searchViewMode', mode);
    // Auto-select first profile when switching to split view
    if (mode === 'split' && users.length > 0 && !selectedProfileForDetail) {
      setSelectedProfileForDetail(users[0]);
    }
    // Reset swipe index when switching to swipe mode
    if (mode === 'swipe') {
      setSwipeIndex(0);
    }
  };
  
  // Toggle section expansion in split view
  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };
  
  // Advanced filters collapse state
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Saved searches state
  // eslint-disable-next-line no-unused-vars
  const [saveSearchName, setSaveSearchName] = useState('');
  const [savedSearches, setSavedSearches] = useState([]);
  const [showSavedSearches, setShowSavedSearches] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [selectedSearch, setSelectedSearch] = useState(null);
  const [editingScheduleFor, setEditingScheduleFor] = useState(null); // Track which search is being edited for schedule

  // PII access state
  const [piiRequests, setPiiRequests] = useState({});

  // Message modal state
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [selectedUserForMessage, setSelectedUserForMessage] = useState(null);

  // PII Request modal state
  const [showPIIRequestModal, setShowPIIRequestModal] = useState(false);
  const [selectedUserForPII, setSelectedUserForPII] = useState(null);
  const [currentPIIAccess, setCurrentPIIAccess] = useState({});

  // Chat-first prompt state (shown before PII request)
  const [showChatFirstPrompt, setShowChatFirstPrompt] = useState(false);
  const [pendingPIIRequestUser, setPendingPIIRequestUser] = useState(null);
  
  // Exclusion preview modal state
  const [showExclusionPreview, setShowExclusionPreview] = useState(false);
  const [exclusionPreviewData, setExclusionPreviewData] = useState(null);
  const [exclusionLoading, setExclusionLoading] = useState(false);
  const [selectedUserForExclusion, setSelectedUserForExclusion] = useState(null);

  // Ref to track if default search has been auto-executed
  const hasAutoExecutedRef = useRef(false);
  
  // Ref to track if state has been restored from sessionStorage
  const hasRestoredStateRef = useRef(false);
  
  // Ref for scroll position
  const searchResultsRef = useRef(null);

  // Server-side pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [hasMoreResults, setHasMoreResults] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // Loading timer state
  const [loadingStartTime, setLoadingStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  // Ref for infinite scroll observer
  const loadMoreTriggerRef = useRef(null);
  
  // Ref to track which page is currently being loaded (prevents duplicate fetches)
  const loadingPageRef = useRef(0);
  
  // Cache L3V3L scores to avoid re-fetching on subsequent pages
  const l3v3lScoresCacheRef = useRef({});
  
  // Track accumulated user count for hasMore calculation (avoids stale closure issues)
  const accumulatedCountRef = useRef(0);

  // Sort state
  const [sortBy, setSortBy] = useState('newest'); // matchScore, age, height, location, occupation, newest
  const [sortOrder, setSortOrder] = useState('desc'); // desc or asc (desc = newest first)

  // Resizable columns state for rows view
  const [columnWidths, setColumnWidths] = useState({
    index: 40,
    photo: 32,
    name: 120,
    score: 50,
    age: 55,
    height: 70,
    location: 100,
    education: 120,
    occupation: 80,
    actions: 90
  });
  const resizingColumnRef = useRef(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  // Column resize handlers
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
    const newWidth = Math.max(30, startWidthRef.current + diff); // Min width 30px
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

  // Collapse state for filters panel
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);

  const navigate = useNavigate();
  
  // Get user-specific sessionStorage key to prevent cross-user session contamination
  const getSessionStorageKey = (baseKey) => {
    const currentUser = localStorage.getItem('username');
    return currentUser ? `${baseKey}_${currentUser}` : baseKey;
  };

  // CRITICAL: Clear users on component mount - MUST be FIRST useEffect
  // This prevents stale data from previous sessions showing before new search runs
  useEffect(() => {
    logger.info('🧹 FIRST useEffect - clearing stale users on mount');
    setUsers([]);
    
    // Also clear sessionStorage to prevent any cached data
    const currentUser = localStorage.getItem('username');
    const storageKey = currentUser ? `searchPageState_${currentUser}` : 'searchPageState';
    sessionStorage.removeItem(storageKey);
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
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Save scroll position when component unmounts (navigating to profile)
      if (searchResultsRef.current) {
        const scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
        sessionStorage.setItem(getSessionStorageKey('searchPageScrollPosition'), scrollPosition.toString());
        logger.info('💾 Saved scroll position on unmount:', scrollPosition);
      }
    };
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
            if (state.viewMode) setViewMode(state.viewMode);
            setMinMatchScore(state.minMatchScore || 0);
            setFavoritedUsers(new Set(state.favoritedUsers || []));
            setShortlistedUsers(new Set(state.shortlistedUsers || []));
            setExcludedUsers(new Set(state.excludedUsers || []));
            // Don't restore selectedSearch - let fresh search determine this
            if (state.selectedProfileForDetail) setSelectedProfileForDetail(state.selectedProfileForDetail);
            
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
    
    // Load current user's profile to get gender and set default search
    const loadCurrentUserProfile = async () => {
      try {
        const response = await api.get(`/profile/${username}?requester=${username}`);
        setCurrentUserProfile(response.data);
        
        // Check if user is premium (has subscription)
        const userRole = response.data.role?.toLowerCase();
        const hasPremium = userRole === 'premium' || userRole === 'admin';
        setIsPremiumUser(hasPremium);
        
        // Check if user is admin (for clear vs reset behavior)
        // Note: username is already defined in the outer scope (line 118)
        setIsAdmin(userRole === 'admin' || username === 'admin');
        
        // Set default gender to opposite gender
        const userGender = response.data.gender?.toLowerCase();
        let oppositeGender = '';
        if (userGender === 'male') {
          oppositeGender = 'female';
        } else if (userGender === 'female') {
          oppositeGender = 'male';
        }
        
        logger.info('🎯 User gender:', userGender, '→ Default search gender:', oppositeGender);
        
        // Calculate user's age from birthMonth and birthYear
        let userAge = null;
        if (response.data.birthMonth && response.data.birthYear) {
          const today = new Date();
          userAge = today.getFullYear() - response.data.birthYear;
          if (today.getMonth() + 1 < response.data.birthMonth) {
            userAge--;
          }
        }
        
        // Parse user's height from format "5'8"" into feet and inches
        let userHeightFeet = null;
        let userHeightInches = null;
        let userHeightTotalInches = null;
        if (response.data.height) {
          const heightMatch = response.data.height.match(/(\d+)'(\d+)"/);
          if (heightMatch) {
            userHeightFeet = parseInt(heightMatch[1]);
            userHeightInches = parseInt(heightMatch[2]);
            userHeightTotalInches = userHeightFeet * 12 + userHeightInches;
          }
        }
        
        // Set default age range from partnerCriteria (user's saved preferences)
        let defaultAgeMin = '';
        let defaultAgeMax = '';
        const partnerCriteria = response.data.partnerCriteria;
        
        // Debug: Log the full partnerCriteria object
        logger.info('🔍 DEBUG partnerCriteria:', JSON.stringify(partnerCriteria, null, 2));
        logger.info('🔍 DEBUG userAge:', userAge, 'userHeight:', userHeightTotalInches);
        
        if (partnerCriteria?.ageRangeRelative && userAge) {
          // Use relative age offsets from partner criteria
          const minOffset = partnerCriteria.ageRangeRelative.minOffset || 0;
          const maxOffset = partnerCriteria.ageRangeRelative.maxOffset || 5;
          defaultAgeMin = Math.max(19, userAge + minOffset).toString();
          defaultAgeMax = Math.min(100, userAge + maxOffset).toString();
          logger.info('🎯 Using partnerCriteria.ageRangeRelative:', { minOffset, maxOffset, defaultAgeMin, defaultAgeMax });
        } else if (partnerCriteria?.ageRange?.min && partnerCriteria?.ageRange?.max) {
          // Fallback to absolute age range if set
          defaultAgeMin = partnerCriteria.ageRange.min.toString();
          defaultAgeMax = partnerCriteria.ageRange.max.toString();
          logger.info('🎯 Using partnerCriteria.ageRange (absolute):', { defaultAgeMin, defaultAgeMax });
        } else if (userAge && userGender) {
          // Final fallback: gender-based defaults
          if (userGender === 'male') {
            // Male: looking for younger (age - 5) to slightly older (age + 1)
            defaultAgeMin = Math.max(19, userAge - 5).toString();
            defaultAgeMax = Math.min(100, userAge + 1).toString();
          } else if (userGender === 'female') {
            // Female: looking for slightly younger (age - 1) to older (age + 5)
            defaultAgeMin = Math.max(19, userAge - 1).toString();
            defaultAgeMax = Math.min(100, userAge + 5).toString();
          }
          logger.info('🎯 Using gender-based age defaults:', { defaultAgeMin, defaultAgeMax });
        }
        
        // Set default height range from partnerCriteria (user's saved preferences)
        let defaultHeightMinFeet = '';
        let defaultHeightMinInches = '';
        let defaultHeightMaxFeet = '';
        let defaultHeightMaxInches = '';
        
        if (partnerCriteria?.heightRangeRelative && userHeightTotalInches) {
          // Use relative height offsets from partner criteria
          const minInchesOffset = partnerCriteria.heightRangeRelative.minInches || 0;
          const maxInchesOffset = partnerCriteria.heightRangeRelative.maxInches || 6;
          const minTotalInches = userHeightTotalInches + minInchesOffset;
          const maxTotalInches = userHeightTotalInches + maxInchesOffset;
          
          defaultHeightMinFeet = Math.floor(minTotalInches / 12).toString();
          defaultHeightMinInches = (minTotalInches % 12).toString();
          defaultHeightMaxFeet = Math.floor(maxTotalInches / 12).toString();
          defaultHeightMaxInches = (maxTotalInches % 12).toString();
          logger.info('🎯 Using partnerCriteria.heightRangeRelative:', { minInchesOffset, maxInchesOffset, minTotalInches, maxTotalInches });
        } else if (partnerCriteria?.heightRange?.minFeet) {
          // Fallback to absolute height range if set
          defaultHeightMinFeet = partnerCriteria.heightRange.minFeet?.toString() || '';
          defaultHeightMinInches = partnerCriteria.heightRange.minInches?.toString() || '';
          defaultHeightMaxFeet = partnerCriteria.heightRange.maxFeet?.toString() || '';
          defaultHeightMaxInches = partnerCriteria.heightRange.maxInches?.toString() || '';
          logger.info('🎯 Using partnerCriteria.heightRange (absolute):', { defaultHeightMinFeet, defaultHeightMinInches, defaultHeightMaxFeet, defaultHeightMaxInches });
        } else if (userHeightTotalInches && userGender) {
          // Final fallback: gender-based defaults
          if (userGender === 'male') {
            // Male: looking for shorter (height - 6") to same height
            const minTotalInches = userHeightTotalInches - 6;
            const maxTotalInches = userHeightTotalInches;
            defaultHeightMinFeet = Math.floor(minTotalInches / 12).toString();
            defaultHeightMinInches = (minTotalInches % 12).toString();
            defaultHeightMaxFeet = Math.floor(maxTotalInches / 12).toString();
            defaultHeightMaxInches = (maxTotalInches % 12).toString();
          } else if (userGender === 'female') {
            // Female: looking for taller (height + 1") to much taller (height + 6")
            const minTotalInches = userHeightTotalInches + 1;
            const maxTotalInches = userHeightTotalInches + 6;
            defaultHeightMinFeet = Math.floor(minTotalInches / 12).toString();
            defaultHeightMinInches = (minTotalInches % 12).toString();
            defaultHeightMaxFeet = Math.floor(maxTotalInches / 12).toString();
            defaultHeightMaxInches = (maxTotalInches % 12).toString();
          }
          logger.info('🎯 Using gender-based height defaults');
        }
        
        logger.info('📊 Default search criteria:', {
          age: userAge,
          ageMin: defaultAgeMin,
          ageMax: defaultAgeMax,
          heightMinFeet: defaultHeightMinFeet,
          heightMinInches: defaultHeightMinInches,
          heightMaxFeet: defaultHeightMaxFeet,
          heightMaxInches: defaultHeightMaxInches
        });
        
        // NOTE: Do NOT set searchCriteria here!
        // loadAndExecuteDefaultSearch will set it properly:
        // - If user has default saved search → use saved search criteria
        // - Else → use partnerCriteria defaults
        // Setting it here causes a "flash" where UI shows partnerCriteria then switches to saved search
        logger.info('🔧 Profile loaded, criteria will be set by loadAndExecuteDefaultSearch');
      } catch (err) {
        logger.error('❌ Error loading current user profile:', err);
        // Set profile anyway to trigger search
        setCurrentUserProfile({});
      }
    };
    
    // Load user's favorites, shortlist, and exclusions
    const loadUserData = async () => {
      try {
        const [favResponse, shortlistResponse, exclusionsResponse] = await Promise.all([
          api.get(`/favorites/${username}`),
          api.get(`/shortlist/${username}`),
          api.get(`/exclusions/${username}`)
        ]);
        
        // Extract usernames from user objects (backend returns full user objects)
        const favoriteUsernames = (favResponse.data.favorites || []).map(u => u.username);
        const shortlistUsernames = (shortlistResponse.data.shortlist || []).map(u => u.username);
        const exclusionUsernames = (exclusionsResponse.data.exclusions || []).map(u => u.username);
        
        setFavoritedUsers(new Set(favoriteUsernames));
        setShortlistedUsers(new Set(shortlistUsernames));
        setExcludedUsers(new Set(exclusionUsernames));
        
        logger.info('✅ Loaded user interactions:', {
          favorites: favoriteUsernames.length,
          shortlist: shortlistUsernames.length,
          exclusions: exclusionUsernames.length
        });
      } catch (err) {
        logger.error('Error loading user data:', err);
      }
    };
    
    // Load initial online users
    const loadOnlineUsers = async () => {
      try {
        const response = await api.get('/online-status/users');
        logger.debug('Loaded online users:', response.data.onlineUsers);
        const onlineSet = new Set(response.data.onlineUsers || []);
        logger.debug('Online users Set:', onlineSet);
        setOnlineUsers(onlineSet);
      } catch (err) {
        logger.error('Error loading online users:', err);
      }
    };

    // Load all initial data
    loadCurrentUserProfile();
    loadUserData();
    loadSavedSearches();
    loadPiiRequests();

    // Setup online users initially with a small delay
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
  }, []);

  // Listen for external "open search modal" events (e.g. from TopBar)
  useEffect(() => {
    const handleOpenModal = () => setIsSearchModalOpen(true);
    window.addEventListener('openSearchModal', handleOpenModal);
    return () => window.removeEventListener('openSearchModal', handleOpenModal);
  }, []);

  // Trigger initial search after user profile is loaded - check for default saved search first
  useEffect(() => {
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
          
          // Load criteria and set selected search
          setSearchCriteria(defaultSearch.criteria);
          setMinMatchScore(loadedMinScore);
          setSelectedSearch(defaultSearch);
          
          // Mark as executed
          hasAutoExecutedRef.current = true;
          
          // Execute the search with explicit criteria AND minMatchScore
          // Delay slightly to ensure state is processed by React
          setTimeout(() => {
            logger.info('🔍 Auto-executing default saved search');
            handleSearch(1, loadedMinScore, defaultSearch.criteria);
            toastService.info(`⭐ Default search "${defaultSearch.name}" executed`);
          }, 100);
        } else {
          // No default saved search - execute search with partnerCriteria defaults
          // This ensures fresh results matching the displayed filter criteria
          logger.info('🔍 No default search found - building criteria from partnerCriteria');
          
          // Build criteria from currentUserProfile (same logic as loadCurrentUserProfile)
          const userGender = currentUserProfile.gender?.toLowerCase();
          let oppositeGender = '';
          if (userGender === 'male') oppositeGender = 'female';
          else if (userGender === 'female') oppositeGender = 'male';
          
          // Calculate user's age
          let userAge = null;
          if (currentUserProfile.birthMonth && currentUserProfile.birthYear) {
            const today = new Date();
            userAge = today.getFullYear() - currentUserProfile.birthYear;
            if (today.getMonth() + 1 < currentUserProfile.birthMonth) userAge--;
          }
          
          // Parse user's height
          let userHeightTotalInches = null;
          if (currentUserProfile.height) {
            const heightMatch = currentUserProfile.height.match(/(\d+)'(\d+)"/);
            if (heightMatch) {
              userHeightTotalInches = parseInt(heightMatch[1]) * 12 + parseInt(heightMatch[2]);
            }
          }
          
          // Build default criteria from partnerCriteria
          const partnerCriteria = currentUserProfile.partnerCriteria;
          let defaultAgeMin = '', defaultAgeMax = '';
          let defaultHeightMinFeet = '', defaultHeightMinInches = '';
          let defaultHeightMaxFeet = '', defaultHeightMaxInches = '';
          
          // Age range from partnerCriteria
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
          
          // Height range from partnerCriteria
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
          
          // Build the COMPLETE criteria object (not merging with prev to avoid stale values like daysBack)
          const partnerCriteriaDefaults = {
            keyword: '',
            profileId: '',
            gender: oppositeGender,
            ageMin: defaultAgeMin,
            ageMax: defaultAgeMax,
            heightMinFeet: defaultHeightMinFeet,
            heightMinInches: defaultHeightMinInches,
            heightMaxFeet: defaultHeightMaxFeet,
            heightMaxInches: defaultHeightMaxInches,
            heightMin: '',
            heightMax: '',
            location: '',
            education: '',
            occupation: '',
            religion: '',
            caste: '',
            drinking: '',
            smoking: '',
            relationshipStatus: '',
            newlyAdded: false,
            daysBack: 30, // Default to 30 days for production (many profiles)
          };
          
          logger.info('📋 Built partnerCriteria defaults:', partnerCriteriaDefaults);
          
          // Set complete criteria object (not merging)
          setSearchCriteria(partnerCriteriaDefaults);
          
          // Mark as executed
          hasAutoExecutedRef.current = true;
          
          // Execute search with explicit criteria (don't rely on async state)
          // Note: Users already cleared at line 628 at start of function
          setTimeout(() => {
            logger.info('🔍 Auto-executing search with partnerCriteria defaults');
            handleSearch(1, 0, partnerCriteriaDefaults);
          }, 100);
        }
      } catch (err) {
        logger.error('Error loading default saved search:', err);
      }
    };

    loadAndExecuteDefaultSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserProfile]);
  
  // ❌ DISABLED: No auto-search on gender change
  // User must manually click "Search" button
  // useEffect(() => {
  //   if (currentUserProfile && searchCriteria.gender && users.length === 0) {
  //     logger.info('🔄 Gender changed, triggering search:', searchCriteria.gender);
  //     handleSearch(1);
  //   }
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [searchCriteria.gender]);

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

  const handlePrevImage = (username, e) => {
    e.stopPropagation();
    setImageIndices(prev => ({
      ...prev,
      [username]: prev[username] === undefined ? 0 : prev[username] > 0 ? prev[username] - 1 : 0
    }));
  };

  const handleNextImage = (username, e, usersData) => {
    e.stopPropagation();
    setImageIndices(prev => {
      const currentIndex = prev[username] || 0;
      const maxIndex = (usersData.find(u => u.username === username)?.images?.length || 1) - 1;
      return {
        ...prev,
        [username]: currentIndex < maxIndex ? currentIndex + 1 : maxIndex
      };
    });
  };

  // eslint-disable-next-line no-unused-vars
  const renderProfileImage = (user) => {
    const currentIndex = imageIndices[user.username] || 0;
    const currentImage = user.images && user.images.length > currentIndex ? user.images[currentIndex] : null;
    const hasError = imageErrors[user.username] || false;

    const hasImageAccess = hasPiiAccess(user.username, 'images');
    
    // Check if user has any images to display (profile picture always visible when enabled)
    const hasVisibleImages = user.images && user.images.length > 0;
    
    // SIMPLE LOGIC: If backend sent images in the array, show them!
    // The backend already handles visibility logic - if images are in the array, they're meant to be shown
    const canShowImages = hasImageAccess || hasVisibleImages;

    // If no images to show, show masked version
    if (!canShowImages) {
      return (
        <div className="profile-image-container">
          <div className="profile-thumbnail-placeholder">
            <span className="no-image-icon">🔒</span>
          </div>
          <div className="image-access-overlay">
            <p className="text-muted small">Images Locked</p>
            <button
              className="btn btn-sm btn-primary"
              onClick={(e) => {
                e.stopPropagation();
                openPIIRequestModal(user.username);
              }}
              disabled={isPiiRequestPending(user.username, 'images')}
            >
              {isPiiRequestPending(user.username, 'images') ? (
                <span className="badge bg-warning text-dark">📨 Request Pics Sent</span>
              ) : 'Request Access'}
            </button>
          </div>
          {/* Online Status Badge */}
          <div className="status-badge-absolute">
            <OnlineStatusBadge username={user.username} size="medium" />
          </div>
        </div>
      );
    }

    // Check if image is already a full URL (from search results) or relative path (from profile view)
    const imageSrc = currentImage && currentImage.startsWith('http') ? currentImage : getImageUrl(currentImage);
    return (
      <div className="profile-image-container">
        {currentImage && !hasError ? (
          <img
            key={`${user.username}-${currentIndex}`}
            src={`${imageSrc}?t=${Date.now()}`}
            alt={`${user.firstName}'s profile`}
            className="profile-thumbnail"
            onError={(e) => {
              logger.error(`Failed to load image: ${currentImage}`, e);
              setImageErrors(prev => ({ ...prev, [user.username]: true }));
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
            onLoad={(e) => {
              logger.info(`Successfully loaded image: ${currentImage}`);
              setImageErrors(prev => ({ ...prev, [user.username]: false }));
              e.target.style.display = 'block';
              e.target.nextSibling.style.display = 'none';
            }}
            crossOrigin="anonymous"
            loading="lazy"
          />
        ) : (
          <div className="profile-thumbnail-placeholder">
            <span className="no-image-icon">👤</span>
          </div>
        )}
        <div className="no-image-icon-overlay" style={{display: hasError || !currentImage ? 'flex' : 'none'}}>👤</div>

        {user.images.length > 1 && (
          <>
            <button
              className="image-nav-btn prev-btn"
              onClick={(e) => handlePrevImage(user.username, e)}
              disabled={currentIndex === 0}
              style={{ padding: 0, minWidth: '28px', maxWidth: '28px', width: '28px', height: '28px' }}
            >
              {'<'}
            </button>
            <button
              className="image-nav-btn next-btn"
              onClick={(e) => handleNextImage(user.username, e, users)}
              disabled={currentIndex === user.images.length - 1}
              style={{ padding: 0, minWidth: '28px', maxWidth: '28px', width: '28px', height: '28px' }}
            >
              {'>'}
            </button>
            <div className="image-counter">
              {currentIndex + 1}/{user.images.length}
            </div>
          </>
        )}
        
        {/* Online Status Badge */}
        <div className="status-badge-absolute">
          <OnlineStatusBadge username={user.username} size="medium" />
        </div>
      </div>
    );
  };

  // Dating field options
  const genderOptions = ['', 'Male', 'Female'];
  const occupationOptions = ['', 'Software Engineer', 'Data Scientist', 'Product Manager', 'Business Analyst', 'Consultant', 'Doctor', 'Chartered Accountant', 'Lawyer', 'Teacher', 'Professor', 'Architect', 'Designer', 'Marketing Manager', 'Sales Executive', 'HR Manager', 'Financial Analyst', 'Civil Engineer', 'Mechanical Engineer', 'Pharmacist', 'Nurse', 'Entrepreneur', 'Banker', 'Government Officer'];
  const religionOptions = ['', 'Hindu', 'Muslim', 'Christian', 'Sikh', 'Buddhist', 'Jain'];
  const eatingOptions = ['', 'Vegetarian', 'Eggetarian', 'Non-Veg'];
  const lifestyleOptions = ['', 'Never', 'Socially', 'Prefer not to say'];
  const relationshipOptions = ['', 'Single', 'Divorced', 'Widowed'];
  const bodyTypeOptions = ['', 'Slim', 'Athletic', 'Average', 'Curvy'];

  // eslint-disable-next-line no-unused-vars
  const loadUserFavorites = async () => {
    try {
      const username = localStorage.getItem('username');
      if (!username) {
        setFavoritedUsers(new Set());
        return;
      }

      const response = await api.get(`/favorites/${username}`);
      const favorites = response.data.favorites || [];
      const favoritedUsernames = new Set(favorites.map(fav => fav.username));
      setFavoritedUsers(favoritedUsernames);
      logger.info('Loaded favorites:', favoritedUsernames);
    } catch (err) {
      // Silently handle error - favorites might not exist yet for new users
      logger.debug('No favorites found or error loading favorites:', err);
      setFavoritedUsers(new Set());
    }
  };

  // eslint-disable-next-line no-unused-vars
  const loadUserShortlist = async () => {
    try {
      const username = localStorage.getItem('username');
      if (!username) {
        setShortlistedUsers(new Set());
        return;
      }

      const response = await api.get(`/shortlist/${username}`);
      const shortlist = response.data.shortlist || [];
      const shortlistedUsernames = new Set(shortlist.map(item => item.username));
      setShortlistedUsers(shortlistedUsernames);
      logger.info('Loaded shortlist:', shortlistedUsernames);
    } catch (err) {
      // Silently handle error - shortlist might not exist yet for new users
      logger.debug('No shortlist found or error loading shortlist:', err);
      setShortlistedUsers(new Set());
    }
  };

  // eslint-disable-next-line no-unused-vars
  const loadUserExclusions = async () => {
    try {
      const username = localStorage.getItem('username');
      if (!username) {
        setExcludedUsers(new Set());
        return;
      }

      logger.info(`Loading exclusions for user: ${username}`);
      const response = await api.get(`/exclusions/${username}`);
      const exclusions = response.data.exclusions || [];
      const excludedUsernames = new Set(exclusions);
      setExcludedUsers(excludedUsernames);
      logger.info('Loaded exclusions:', excludedUsernames);
    } catch (err) {
      // Silently handle error - exclusions might not exist yet for new users
      logger.debug('No exclusions found or error loading exclusions:', err);
      setExcludedUsers(new Set());
    }
  };

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
  // Uses partnerCriteria (user's saved partner preferences) when available
  // Falls back to gender-based defaults if no partnerCriteria set
  const getDefaultSearchCriteria = () => {
    let defaultGender = '';
    let defaultAgeMin = '';
    let defaultAgeMax = '';
    let defaultHeightMinFeet = '';
    let defaultHeightMinInches = '';
    let defaultHeightMaxFeet = '';
    let defaultHeightMaxInches = '';

    if (currentUserProfile) {
      // Calculate opposite gender
      const userGender = currentUserProfile.gender?.toLowerCase();
      if (userGender === 'male') {
        defaultGender = 'female';
      } else if (userGender === 'female') {
        defaultGender = 'male';
      }

      // Calculate user's age
      let userAge = null;
      if (currentUserProfile.birthMonth && currentUserProfile.birthYear) {
        const today = new Date();
        userAge = today.getFullYear() - currentUserProfile.birthYear;
        if (today.getMonth() + 1 < currentUserProfile.birthMonth) {
          userAge--;
        }
      }

      // Parse user's height
      let userHeightTotalInches = null;
      if (currentUserProfile.height) {
        const heightMatch = currentUserProfile.height.match(/(\d+)'(\d+)"/);
        if (heightMatch) {
          const userHeightFeet = parseInt(heightMatch[1]);
          const userHeightInches = parseInt(heightMatch[2]);
          userHeightTotalInches = userHeightFeet * 12 + userHeightInches;
        }
      }

      // Get partnerCriteria from user profile (saved partner preferences)
      const partnerCriteria = currentUserProfile.partnerCriteria;

      // Set default age range from partnerCriteria (priority) or gender-based fallback
      if (partnerCriteria?.ageRangeRelative && userAge) {
        // Use relative age offsets from partner criteria
        const minOffset = partnerCriteria.ageRangeRelative.minOffset || 0;
        const maxOffset = partnerCriteria.ageRangeRelative.maxOffset || 5;
        defaultAgeMin = Math.max(19, userAge + minOffset).toString();
        defaultAgeMax = Math.min(100, userAge + maxOffset).toString();
        logger.info('🔄 Reset: Using partnerCriteria.ageRangeRelative:', { minOffset, maxOffset });
      } else if (partnerCriteria?.ageRange?.min && partnerCriteria?.ageRange?.max) {
        // Fallback to absolute age range if set
        defaultAgeMin = partnerCriteria.ageRange.min.toString();
        defaultAgeMax = partnerCriteria.ageRange.max.toString();
        logger.info('🔄 Reset: Using partnerCriteria.ageRange (absolute)');
      } else if (userAge && userGender) {
        // Final fallback: gender-based defaults
        if (userGender === 'male') {
          defaultAgeMin = Math.max(19, userAge - 5).toString();
          defaultAgeMax = Math.min(100, userAge + 1).toString();
        } else if (userGender === 'female') {
          defaultAgeMin = Math.max(19, userAge - 1).toString();
          defaultAgeMax = Math.min(100, userAge + 5).toString();
        }
        logger.info('🔄 Reset: Using gender-based age defaults');
      }

      // Set default height range from partnerCriteria (priority) or gender-based fallback
      if (partnerCriteria?.heightRangeRelative && userHeightTotalInches) {
        // Use relative height offsets from partner criteria
        const minInchesOffset = partnerCriteria.heightRangeRelative.minInches || 0;
        const maxInchesOffset = partnerCriteria.heightRangeRelative.maxInches || 6;
        const minTotalInches = userHeightTotalInches + minInchesOffset;
        const maxTotalInches = userHeightTotalInches + maxInchesOffset;
        
        defaultHeightMinFeet = Math.floor(minTotalInches / 12).toString();
        defaultHeightMinInches = (minTotalInches % 12).toString();
        defaultHeightMaxFeet = Math.floor(maxTotalInches / 12).toString();
        defaultHeightMaxInches = (maxTotalInches % 12).toString();
        logger.info('🔄 Reset: Using partnerCriteria.heightRangeRelative');
      } else if (partnerCriteria?.heightRange?.minFeet) {
        // Fallback to absolute height range if set
        defaultHeightMinFeet = partnerCriteria.heightRange.minFeet?.toString() || '';
        defaultHeightMinInches = partnerCriteria.heightRange.minInches?.toString() || '';
        defaultHeightMaxFeet = partnerCriteria.heightRange.maxFeet?.toString() || '';
        defaultHeightMaxInches = partnerCriteria.heightRange.maxInches?.toString() || '';
        logger.info('🔄 Reset: Using partnerCriteria.heightRange (absolute)');
      } else if (userHeightTotalInches && userGender) {
        // Final fallback: gender-based defaults
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
        logger.info('🔄 Reset: Using gender-based height defaults');
      }
    }

    return {
      gender: defaultGender,
      ageMin: defaultAgeMin,
      ageMax: defaultAgeMax,
      heightMinFeet: defaultHeightMinFeet,
      heightMinInches: defaultHeightMinInches,
      heightMaxFeet: defaultHeightMaxFeet,
      heightMaxInches: defaultHeightMaxInches,
      daysBack: 30
    };
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
        education: '',
        occupation: '',
        religion: '',
        caste: '',
        eatingPreference: '',
        drinking: '',
        smoking: '',
        relationshipStatus: '',
        bodyType: '',
        newlyAdded: false,
        daysBack: 30,
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
        education: '',
        occupation: '',
        religion: '',
        caste: '',
        eatingPreference: '',
        drinking: '',
        smoking: '',
        relationshipStatus: '',
        bodyType: '',
        newlyAdded: false,
        daysBack: defaults.daysBack || 30,
        sortBy: 'age',
        sortOrder: 'asc'
      });
      logger.info('🔄 Non-admin: Reset to partner criteria defaults:', defaults);
    }
    
    setUsers([]);
    setSaveSearchName('');
    setMinMatchScore(0); // Reset L3V3L compatibility score
    setSelectedSearch(null); // Clear selected search badge
    setCurrentPage(1); // Reset pagination
    setTotalResults(0);
    setHasMoreResults(true);
    setFiltersCollapsed(false); // Expand filters when clearing
  };

  const handleSearch = async (page = 1, overrideMinMatchScore = null, overrideCriteria = null, overrideSort = null) => {
    const currentUser = localStorage.getItem('username');
    
    try {
      setLoading(true);
      setLoadingStartTime(Date.now()); // Start timer
      setError('');
      if (page === 1) {
        setUsers([]); // Clear old results immediately to prevent showing stale/wrong gender profiles
        setHasMoreResults(true); // Reset for new search
        loadingPageRef.current = 1; // Reset page tracking ref for new search
      }

      // STEP 1: Apply traditional search filters
      // Use overrideCriteria if provided (for immediate load), otherwise use state
      const criteriaToUse = overrideCriteria !== null ? overrideCriteria : searchCriteria;
      
      // Log profileId for debugging
      logger.info('🔍 Profile ID in criteria:', criteriaToUse.profileId);
      
      // If profileId is provided, ONLY send profileId (bypass all other filters)
      let params;
      if (criteriaToUse.profileId?.trim()) {
        params = {
          profileId: criteriaToUse.profileId.trim(),
          page: page,
          limit: 20  // Server-side pagination - fetch 20 at a time
        };
        logger.info('🔍 Profile ID search - bypassing other filters');
      } else {
        params = {
          ...criteriaToUse,
          status: 'active',  // Only search for active users
          page: page,
          limit: 20,  // Server-side pagination - fetch 20 at a time
          sortBy: overrideSort?.sortBy || sortBy,  // Use override if provided
          sortOrder: overrideSort?.sortOrder || sortOrder  // Use override if provided
        };
      }
      
      // Convert feet/inches to total inches for height range
      // Only set heightMin if BOTH feet and inches are provided
      if (params.heightMinFeet && params.heightMinFeet !== '' && 
          params.heightMinInches && params.heightMinInches !== '') {
        const feet = parseInt(params.heightMinFeet);
        const inches = parseInt(params.heightMinInches);
        if (!isNaN(feet) && !isNaN(inches)) {
          params.heightMin = feet * 12 + inches;
        }
      }
      
      // Only set heightMax if BOTH feet and inches are provided
      if (params.heightMaxFeet && params.heightMaxFeet !== '' && 
          params.heightMaxInches && params.heightMaxInches !== '') {
        const feet = parseInt(params.heightMaxFeet);
        const inches = parseInt(params.heightMaxInches);
        if (!isNaN(feet) && !isNaN(inches)) {
          params.heightMax = feet * 12 + inches;
        }
      }
      
      // Remove feet/inches fields from params (not needed by API)
      delete params.heightMinFeet;
      delete params.heightMinInches;
      delete params.heightMaxFeet;
      delete params.heightMaxInches;

      // Clean up empty strings, false values, null, and undefined
      Object.keys(params).forEach(key => {
        const value = params[key];
        if (value === '' || value === false || value === null || value === undefined) {
          delete params[key];
        }
      });
      
      // Additional validation: ensure integer fields are valid numbers
      const integerFields = ['ageMin', 'ageMax', 'heightMin', 'heightMax', 'daysBack'];
      integerFields.forEach(field => {
        if (params[field] !== undefined) {
          const num = parseInt(params[field]);
          if (isNaN(num)) {
            delete params[field]; // Remove if not a valid number
          } else {
            params[field] = num; // Ensure it's a number, not a string
          }
        }
      });
      
      logger.info('🔍 Search params after validation:', params);
      logger.info(`📄 SENDING PAGE: ${params.page}, LIMIT: ${params.limit}`);
      logger.info(`🚻 GENDER PARAM BEING SENT: '${params.gender}'`);

      // SINGLE API CALL: Search now includes L3V3L scores via MongoDB $lookup
      // No separate L3V3L API call needed - scores come with search results
      logger.info(`🚀 Starting search (L3V3L scores included via $lookup)`);
      
      const response = await api.get('/search', { params });
      logger.info('✅ Search complete');
      
      logger.info('🔍 API URL called:', `/search?${new URLSearchParams(params).toString()}`);
      logger.info('🔍 response.data.users length:', response.data.users?.length);
      
      // Debug: Log first 3 users with their L3V3L scores
      if (response.data.users?.length > 0) {
        logger.info('🦋 First 3 users with scores:', response.data.users.slice(0, 3).map(u => ({
          username: u.username,
          matchScore: u.matchScore,
          compatibilityLevel: u.compatibilityLevel,
          imageCount: u.images?.length || 0
        })));
      }
      
      // Server now handles: filtering, L3V3L scores via $lookup
      let filteredUsers = response.data.users || [];

      // Update pagination state
      const total = response.data.total || 0;
      const serverReturnedCount = response.data.users?.length || 0;
      const pageSize = 20;
      
      if (page === 1) {
        // First page: set total and hasMore
        setTotalResults(total);
        accumulatedCountRef.current = filteredUsers.length;
        // hasMore = server returned a full page AND we haven't loaded all records yet
        // Use both conditions to be safe
        const serverReturnedFullPage = serverReturnedCount >= pageSize;
        const hasMore = serverReturnedFullPage && filteredUsers.length < total;
        setHasMoreResults(hasMore);
        setUsers(filteredUsers);
        setCurrentPage(1);
        logger.info(`📊 Pagination: page=1, serverReturned=${serverReturnedCount}, afterFilter=${filteredUsers.length}, total=${total}, fullPage=${serverReturnedFullPage}, hasMore=${hasMore}`);
        
        // Log search results viewed activity
        logSearchResultsViewed(total, criteriaToUse);
      } else {
        // Subsequent pages: append new users and calculate hasMore
        const serverReturnedNothing = serverReturnedCount === 0;
        
        // Get current users synchronously to calculate hasMore BEFORE state update
        // This avoids all closure/timing issues
        setUsers(prev => {
          const existingUsernames = new Set(prev.map(u => u.username));
          const newUsers = filteredUsers.filter(u => !existingUsernames.has(u.username));
          const newTotal = prev.length + newUsers.length;
          
          // Update ref for tracking
          accumulatedCountRef.current = newTotal;
          
          logger.info(`📊 Dedup: ${filteredUsers.length} fetched, ${newUsers.length} new, ${filteredUsers.length - newUsers.length} duplicates skipped`);
          logger.info(`📊 Pagination: page=${page}, accumulated=${newTotal}, total=${total}`);
          
          // Calculate hasMore INSIDE the callback to use accurate newTotal
          // hasMore = false if:
          // 1. We've loaded all records (newTotal >= total)
          // 2. Server returned nothing (no more data on server)
          // 3. All returned users were duplicates (prevents infinite loop)
          const hasMoreNow = newTotal < total && serverReturnedCount > 0 && newUsers.length > 0;
          logger.info(`📊 Setting hasMoreResults: serverReturned=${serverReturnedCount}, newUsers=${newUsers.length}, accumulated=${newTotal}, total=${total}, hasMore=${hasMoreNow}`);
          
          // Use setTimeout to update hasMoreResults after state update completes
          setTimeout(() => {
            setHasMoreResults(hasMoreNow);
            setLoadingMore(false); // Ensure loading state is cleared
          }, 0);
          
          return [...prev, ...newUsers];
        });
      }

    } catch (err) {
      logger.error('Error searching users:', err);
      const errorDetail = err.response?.data?.detail;
      let errorMsg = 'Failed to search users.';
      
      if (typeof errorDetail === 'string') {
        errorMsg += ' ' + errorDetail;
      } else if (Array.isArray(errorDetail)) {
        errorMsg += ' ' + errorDetail.map(e => e.msg || e.message || JSON.stringify(e)).join(', ');
      } else if (errorDetail) {
        errorMsg += ' ' + JSON.stringify(errorDetail);
      } else {
        errorMsg += ' ' + err.message;
      }
      
      setError(errorMsg);
    } finally {
      setLoading(false);
      setLoadingStartTime(null); // Stop timer
      setInitialSearchComplete(true); // Mark initial search as complete
      // No longer auto-collapse filters - user controls visibility via Hide Filters button
    }
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

  // Server-side pagination: fetch next page
  const handleLoadMore = useCallback(async () => {
    logger.info(`📄 handleLoadMore called: loadingMore=${loadingMore}, currentPage=${currentPage}, loadingPageRef=${loadingPageRef.current}`);
    
    if (loadingMore) {
      logger.info(`📄 handleLoadMore: Skipping - already loading`);
      return;
    }
    
    const nextPage = currentPage + 1;
    
    logger.info(`📄 handleLoadMore: Will load page ${nextPage}`);
    
    setLoadingMore(true);
    setCurrentPage(nextPage);
    loadingPageRef.current = nextPage;
    
    try {
      await handleSearch(nextPage);
      logger.info(`📄 handleLoadMore: Successfully loaded page ${nextPage}`);
    } catch (err) {
      logger.error('Error loading more results:', err);
      setCurrentPage(currentPage);
    } finally {
      setLoadingMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingMore, currentPage]);

  // IntersectionObserver for infinite scroll (server-side pagination)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        // Check if there are more results to fetch from server
        if (entry.isIntersecting && !loadingMore && hasMoreResults) {
          logger.info(`🔄 IntersectionObserver triggered - loading more`);
          handleLoadMore();
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
  }, [loadingMore, hasMoreResults, handleLoadMore]);

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
    
    // Location
    if (criteria.location) {
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
    
    // Occupation
    if (criteria.occupation && criteria.occupation !== '') {
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
    // Expand filters if they were collapsed so user can see what was loaded
    setFiltersCollapsed(false);
    
    // Apply default daysBack if not set in saved search (for backward compatibility)
    const criteriaWithDefaults = {
      ...savedSearch.criteria,
      daysBack: savedSearch.criteria.daysBack || 30
    };
    
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
      handleSearch(1, loadedMinScore, criteriaWithDefaults);
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

  // Actually open the PII modal (called after chat-first prompt)
  const actuallyOpenPIIRequestModal = async (user) => {
    const targetUsername = user.username;

    try {
      // Fetch target user's full profile to get accurate visibility settings
      const profileResponse = await api.get(`/profile/${targetUsername}`);
      const targetProfile = profileResponse.data;

      // Set current PII access status - pass actual status values
      setCurrentPIIAccess({
        images: piiRequests[`${targetUsername}_images`] === 'approved',
        contact_info: piiRequests[`${targetUsername}_contact_info`] === 'approved',
        date_of_birth: piiRequests[`${targetUsername}_date_of_birth`] === 'approved',
        linkedin_url: piiRequests[`${targetUsername}_linkedin_url`] === 'approved'
      });

      // Override with fetched visibility settings
      setSelectedUserForPII({
        ...user,
        contactNumberVisible: targetProfile.contactNumberVisible,
        contactEmailVisible: targetProfile.contactEmailVisible,
        linkedinUrlVisible: targetProfile.linkedinUrlVisible,
        imageVisibility: targetProfile.imageVisibility
      });
      setShowPIIRequestModal(true);
    } catch (err) {
      logger.error('Failed to fetch profile for PII modal:', err);
      // Fallback to user data from search results
      setSelectedUserForPII(user);
      setShowPIIRequestModal(true);
    }
  };

  const handlePIIRequestSuccess = async () => {
    // Reload PII requests to get updated status
    await loadPiiRequests();
  };

  const hasPiiAccess = (targetUsername, requestType) => {
    return piiRequests[`${targetUsername}_${requestType}`] === 'approved';
  };

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

  const handleProfileAction = async (e, targetUsername, action) => {
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }

    const currentUser = localStorage.getItem('username');
    if (!currentUser) {
      setError('Please login to perform this action');
      return;
    }

    try {
      switch (action) {
        case 'favorite':
          const isCurrentlyFavorited = favoritedUsers.has(targetUsername);

          try {
            if (isCurrentlyFavorited) {
              // Remove from favorites
              await api.delete(`/favorites/${targetUsername}?username=${encodeURIComponent(currentUser)}`);
              setFavoritedUsers(prev => {
                const newSet = new Set(prev);
                newSet.delete(targetUsername);
                return newSet;
              });
              setStatusMessage('✅ Removed from favorites');
              setTimeout(() => setStatusMessage(''), 3000);
            } else {
              // Add to favorites
              await api.post(`/favorites/${targetUsername}?username=${encodeURIComponent(currentUser)}`);
              setFavoritedUsers(prev => new Set([...prev, targetUsername]));
              setStatusMessage('✅ Added to favorites');
              setTimeout(() => setStatusMessage(''), 3000);
            }
            setError(''); // Clear any previous errors
          } catch (err) {
            logger.error(`Error ${isCurrentlyFavorited ? 'removing from' : 'adding to'} favorites:`, err);
            
            // Handle 409 Conflict (already exists)
            if (err.response?.status === 409) {
              setFavoritedUsers(prev => new Set([...prev, targetUsername]));
              setStatusMessage('ℹ️ Already in favorites');
              setTimeout(() => setStatusMessage(''), 3000);
            } else {
              const errorMsg = `Failed to ${isCurrentlyFavorited ? 'remove from' : 'add to'} favorites. ` + (err.response?.data?.detail || err.message);
              setError(errorMsg);
              setStatusMessage(`❌ ${errorMsg}`);
              setTimeout(() => setStatusMessage(''), 3000);
            }
          }
          break;

        case 'shortlist':
          const isCurrentlyShortlisted = shortlistedUsers.has(targetUsername);

          try {
            if (isCurrentlyShortlisted) {
              // Remove from shortlist
              await api.delete(`/shortlist/${targetUsername}?username=${encodeURIComponent(currentUser)}`);
              setShortlistedUsers(prev => {
                const newSet = new Set(prev);
                newSet.delete(targetUsername);
                return newSet;
              });
              setStatusMessage('✅ Removed from shortlist');
              setTimeout(() => setStatusMessage(''), 3000);
            } else {
              // Add to shortlist
              await api.post(`/shortlist/${targetUsername}?username=${encodeURIComponent(currentUser)}`);
              setShortlistedUsers(prev => new Set([...prev, targetUsername]));
              setStatusMessage('✅ Added to shortlist');
              setTimeout(() => setStatusMessage(''), 3000);
            }
            setError(''); // Clear any previous errors
          } catch (err) {
            logger.error(`Error ${isCurrentlyShortlisted ? 'removing from' : 'adding to'} shortlist:`, err);
            
            // Handle 409 Conflict (already exists)
            if (err.response?.status === 409) {
              setShortlistedUsers(prev => new Set([...prev, targetUsername]));
              setStatusMessage('ℹ️ Already in shortlist');
              setTimeout(() => setStatusMessage(''), 3000);
            } else {
              const errorMsg = `Failed to ${isCurrentlyShortlisted ? 'remove from' : 'add to'} shortlist. ` + (err.response?.data?.detail || err.message);
              setError(errorMsg);
              setStatusMessage(`❌ ${errorMsg}`);
              setTimeout(() => setStatusMessage(''), 3000);
            }
          }
          break;

        case 'exclude':
          const isCurrentlyExcluded = excludedUsers.has(targetUsername);

          try {
            const currentUser = localStorage.getItem('username');
            if (!currentUser) {
              setError('Please login to perform this action');
              return;
            }

            logger.info(`Attempting to ${isCurrentlyExcluded ? 'remove from' : 'add to'} exclusions for user: ${targetUsername} by: ${currentUser}`);

            if (isCurrentlyExcluded) {
              // Remove from exclusions directly
              logger.info(`DELETE /exclusions/${targetUsername}`);
              await api.delete(`/exclusions/${targetUsername}`);
              setExcludedUsers(prev => {
                const newSet = new Set(prev);
                newSet.delete(targetUsername);
                return newSet;
              });
              setStatusMessage('✅ Removed from not interested');
              setTimeout(() => setStatusMessage(''), 3000);
            } else {
              // Show preview modal before excluding
              setExclusionLoading(true);
              // Find the user object from the users array
              const userObj = users.find(u => u.username === targetUsername) || { username: targetUsername };
              setSelectedUserForExclusion(userObj);
              const response = await api.get(`/exclusions/preview/${targetUsername}`);
              setExclusionPreviewData(response.data);
              setShowExclusionPreview(true);
              setExclusionLoading(false);
              return; // Don't continue - modal will handle the actual exclusion
            }
            setError(''); // Clear any previous errors
          } catch (err) {
            logger.error(`Error ${isCurrentlyExcluded ? 'removing from' : 'adding to'} exclusions:`, err);
            const errorMsg = `Failed to ${isCurrentlyExcluded ? 'remove from' : 'mark as'} not interested. ` + (err.response?.data?.detail || err.message);
            setError(errorMsg);
            setStatusMessage(`❌ ${errorMsg}`);
            setTimeout(() => setStatusMessage(''), 3000);
          }
          break;

        case 'message':
          // Open message modal instead of navigating
          const userToMessage = users.find(u => u.username === targetUsername);
          setSelectedUserForMessage(userToMessage);
          setShowMessageModal(true);
          break;

        default:
          logger.warn('Unknown action:', action);
      }
    } catch (err) {
      logger.error(`Error performing ${action}:`, err);
      const errorMsg = `Failed to ${action}. ` + (err.response?.data?.detail || err.message);
      setError(errorMsg);
      setStatusMessage(`❌ ${errorMsg}`);
      setTimeout(() => setStatusMessage(''), 3000);
    }
  };

  // Swipe action handlers - advance to next card after action
  const handleSwipeAction = (direction, user) => {
    const username = user.username;
    
    if (direction === 'right') {
      // Favorite
      handleProfileAction(null, username, 'favorite');
      toastService.success(`⭐ Added ${user.firstName || username} to favorites`);
    } else if (direction === 'left') {
      // Exclude/Pass
      handleProfileAction(null, username, 'exclude');
      toastService.info(`🚫 Passed on ${user.firstName || username}`);
    } else if (direction === 'up') {
      // Shortlist
      handleProfileAction(null, username, 'shortlist');
      toastService.success(`📋 Added ${user.firstName || username} to shortlist`);
    } else if (direction === 'down') {
      // Skip/Next - just advance without any action
      toastService.info(`⏭️ Skipped ${user.firstName || username}`);
    }
    
    // Advance to next card after a short delay for animation
    setTimeout(() => {
      setSwipeIndex(prev => prev + 1);
    }, 350);
  };

  // Confirm exclusion from preview modal
  const confirmExclusion = async () => {
    if (!selectedUserForExclusion) return;
    try {
      setExclusionLoading(true);
      const targetUsername = selectedUserForExclusion.username;
      await api.post(`/exclusions/${targetUsername}`);
      setExcludedUsers(prev => new Set([...prev, targetUsername]));
      
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
      setStatusMessage('✅ Marked as not interested');
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (err) {
      logger.error(`Failed to add to exclusions: ${err.message}`);
      setStatusMessage(`❌ Failed to mark as not interested`);
      setTimeout(() => setStatusMessage(''), 3000);
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
  }, [users, searchCriteria.profileId, minMatchScore, sortBy, sortOrder]);

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
    
    // Location
    if (searchCriteria.location) summary.push(`📍 ${searchCriteria.location}`);
    if (searchCriteria.state) summary.push(searchCriteria.state);
    if (searchCriteria.country) summary.push(searchCriteria.country);
    
    // L3V3L Match Score
    if (minMatchScore > 0) summary.push(`🦋 ${minMatchScore}%+ Match`);
    
    // Education & Occupation
    if (searchCriteria.education) summary.push(`🎓 ${searchCriteria.education}`);
    if (searchCriteria.occupation) summary.push(`💼 ${searchCriteria.occupation}`);
    
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
    if (searchCriteria.withPhotosOnly) summary.push('📷 With Photos');
    
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
      >
        <span className="trigger-icon">🔍</span>
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
        onSearch={() => handleSearch(1)}
        onClear={handleClearFilters}
        onSave={() => setShowSaveModal(true)}
        systemConfig={systemConfig}
        isPremiumUser={isPremiumUser}
        currentUserProfile={currentUserProfile}
        bodyTypeOptions={bodyTypeOptions}
        occupationOptions={occupationOptions}
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
          <span className="criteria-label">ACTIVE FILTERS:</span>
          <span className="criteria-value">{getActiveCriteriaSummary()}</span>
        </div>
        <div className="criteria-actions">
          <span className="results-count">
            <span className="results-count-number">{totalResults}</span>
            <span className="results-count-text"> profiles found</span>
          </span>
          <button className="btn-modify-search">
            <span className="modify-text">Modify </span><span className="modify-icon">⚙️</span>
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
              <h5>No profiles found</h5>
              <p>Try adjusting your search criteria or use broader filters.</p>
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
                  <button
                    onClick={() => handleViewModeChange('split')}
                    className={`layout-toggle-btn ${viewMode === 'split' ? 'active' : ''}`}
                    title="Split view - List with detail panel"
                    style={{
                      padding: '6px 12px',
                      fontSize: '14px',
                      borderRadius: 'var(--radius-sm)',
                      border: viewMode === 'split' ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                      background: viewMode === 'split' ? 'var(--primary-color)' : 'var(--surface-color)',
                      color: viewMode === 'split' ? 'white' : 'var(--text-color)',
                      cursor: 'pointer',
                      fontWeight: viewMode === 'split' ? 600 : 400,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <span className="layout-toggle-btn-icon">⚏</span><span className="layout-toggle-btn-text"> Split</span>
                  </button>
                  <button
                    onClick={() => handleViewModeChange('cards')}
                    className={`layout-toggle-btn ${viewMode === 'cards' ? 'active' : ''}`}
                    title="Card view - Grid layout"
                    style={{
                      padding: '6px 12px',
                      fontSize: '14px',
                      borderRadius: 'var(--radius-sm)',
                      border: viewMode === 'cards' ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                      background: viewMode === 'cards' ? 'var(--primary-color)' : 'var(--surface-color)',
                      color: viewMode === 'cards' ? 'white' : 'var(--text-color)',
                      cursor: 'pointer',
                      fontWeight: viewMode === 'cards' ? 600 : 400,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <span className="layout-toggle-btn-icon">▦</span><span className="layout-toggle-btn-text"> Cards</span>
                  </button>
                  <button
                    onClick={() => handleViewModeChange('rows')}
                    className={`layout-toggle-btn ${viewMode === 'rows' ? 'active' : ''}`}
                    title="Row view - List layout"
                    style={{
                      padding: '6px 12px',
                      fontSize: '14px',
                      borderRadius: 'var(--radius-sm)',
                      border: viewMode === 'rows' ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                      background: viewMode === 'rows' ? 'var(--primary-color)' : 'var(--surface-color)',
                      color: viewMode === 'rows' ? 'white' : 'var(--text-color)',
                      cursor: 'pointer',
                      fontWeight: viewMode === 'rows' ? 600 : 400,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <span className="layout-toggle-btn-icon">☰</span><span className="layout-toggle-btn-text"> Rows</span>
                  </button>
                  <button
                    onClick={() => handleViewModeChange('swipe')}
                    className={`layout-toggle-btn ${viewMode === 'swipe' ? 'active' : ''}`}
                    title="Swipe view - Tinder-style swiping"
                    style={{
                      padding: '6px 12px',
                      fontSize: '14px',
                      borderRadius: 'var(--radius-sm)',
                      border: viewMode === 'swipe' ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                      background: viewMode === 'swipe' ? 'var(--primary-color)' : 'var(--surface-color)',
                      color: viewMode === 'swipe' ? 'white' : 'var(--text-color)',
                      cursor: 'pointer',
                      fontWeight: viewMode === 'swipe' ? 600 : 400,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <span className="layout-toggle-btn-icon">👆</span><span className="layout-toggle-btn-text"> Swipe</span>
                  </button>
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
                gap: '20px',
                fontSize: '12px',
                color: 'var(--text-muted)'
              }}>
                <span>← Pass</span>
                <span>↑ Shortlist</span>
                <span>Favorite →</span>
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
                            hasPiiAccess={hasPiiAccess(user.username, 'contact_info')}
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
                  <button
                    onClick={() => handleSwipeAction('left', currentRecords[swipeIndex])}
                    style={{
                      width: '20px',
                      height: '20px',
                      minWidth: '20px',
                      minHeight: '20px',
                      padding: 0,
                      borderRadius: '50%',
                      border: '1px solid var(--danger-color)',
                      background: 'transparent',
                      color: 'var(--danger-color)',
                      fontSize: '10px',
                      lineHeight: 1,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Pass (swipe left)"
                  >
                    ✕
                  </button>
                  <button
                    onClick={() => handleSwipeAction('up', currentRecords[swipeIndex])}
                    style={{
                      width: '20px',
                      height: '20px',
                      minWidth: '20px',
                      minHeight: '20px',
                      padding: 0,
                      borderRadius: '50%',
                      border: '1px solid var(--primary-color)',
                      background: 'transparent',
                      color: 'var(--primary-color)',
                      fontSize: '10px',
                      lineHeight: 1,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Shortlist (swipe up)"
                  >
                    📋
                  </button>
                  <button
                    onClick={() => handleSwipeAction('right', currentRecords[swipeIndex])}
                    style={{
                      width: '20px',
                      height: '20px',
                      minWidth: '20px',
                      minHeight: '20px',
                      padding: 0,
                      borderRadius: '50%',
                      border: '1px solid var(--success-color)',
                      background: 'transparent',
                      color: 'var(--success-color)',
                      fontSize: '10px',
                      lineHeight: 1,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Favorite (swipe right)"
                  >
                    ⭐
                  </button>
                  <button
                    onClick={() => handleSwipeAction('down', currentRecords[swipeIndex])}
                    style={{
                      width: '20px',
                      height: '20px',
                      minWidth: '20px',
                      minHeight: '20px',
                      padding: 0,
                      borderRadius: '50%',
                      border: '1px solid var(--text-secondary)',
                      background: 'transparent',
                      color: 'var(--text-secondary)',
                      fontSize: '10px',
                      lineHeight: 1,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Skip (swipe down)"
                  >
                    ⏭️
                  </button>
                </div>
              )}
            </div>
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
                    position: 'sticky',
                    top: 0,
                    zIndex: 10
                  }}
                >
                  <span style={{ paddingRight: '6px' }}>#</span>
                  <span style={{ paddingRight: '6px' }}></span>
                  <span 
                    className="resizable-header"
                    onClick={() => { setSortBy('firstName'); setSortOrder(sortBy === 'firstName' && sortOrder === 'asc' ? 'desc' : 'asc'); }}
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', position: 'relative', paddingRight: '10px' }}
                    title="Sort by name"
                  >
                    Name {sortBy === 'firstName' && (sortOrder === 'asc' ? '↑' : '↓')}
                    <div className="resize-handle" onMouseDown={(e) => handleResizeStart(e, 'name')} />
                  </span>
                  <span 
                    className="resizable-header"
                    onClick={() => { setSortBy('matchScore'); setSortOrder(sortBy === 'matchScore' && sortOrder === 'desc' ? 'asc' : 'desc'); }}
                    style={{ cursor: 'pointer', textAlign: 'center', position: 'relative', paddingRight: '10px' }}
                    title="Sort by L3V3L compatibility score"
                  >
                    🎯 {sortBy === 'matchScore' && (sortOrder === 'desc' ? '↓' : '↑')}
                    <div className="resize-handle" onMouseDown={(e) => handleResizeStart(e, 'score')} />
                  </span>
                  <span 
                    className="resizable-header"
                    onClick={() => { setSortBy('age'); setSortOrder(sortBy === 'age' && sortOrder === 'asc' ? 'desc' : 'asc'); }}
                    style={{ cursor: 'pointer', textAlign: 'center', position: 'relative', paddingRight: '10px' }}
                    title="Sort by age"
                  >
                    Age {sortBy === 'age' && (sortOrder === 'asc' ? '↑' : '↓')}
                    <div className="resize-handle" onMouseDown={(e) => handleResizeStart(e, 'age')} />
                  </span>
                  <span 
                    className="resizable-header"
                    onClick={() => { setSortBy('heightInches'); setSortOrder(sortBy === 'heightInches' && sortOrder === 'asc' ? 'desc' : 'asc'); }}
                    style={{ cursor: 'pointer', textAlign: 'center', position: 'relative', paddingRight: '10px' }}
                    title="Sort by height"
                  >
                    Height {sortBy === 'heightInches' && (sortOrder === 'asc' ? '↑' : '↓')}
                    <div className="resize-handle" onMouseDown={(e) => handleResizeStart(e, 'height')} />
                  </span>
                  <span 
                    className="resizable-header"
                    onClick={() => { setSortBy('location'); setSortOrder(sortBy === 'location' && sortOrder === 'asc' ? 'desc' : 'asc'); }}
                    style={{ cursor: 'pointer', position: 'relative', paddingRight: '10px' }}
                    title="Sort by location"
                  >
                    Location {sortBy === 'location' && (sortOrder === 'asc' ? '↑' : '↓')}
                    <div className="resize-handle" onMouseDown={(e) => handleResizeStart(e, 'location')} />
                  </span>
                  <span 
                    className="resizable-header"
                    onClick={() => { setSortBy('education'); setSortOrder(sortBy === 'education' && sortOrder === 'asc' ? 'desc' : 'asc'); }}
                    style={{ cursor: 'pointer', position: 'relative', paddingRight: '10px' }}
                    title="Sort by education"
                  >
                    Education {sortBy === 'education' && (sortOrder === 'asc' ? '↑' : '↓')}
                    <div className="resize-handle" onMouseDown={(e) => handleResizeStart(e, 'education')} />
                  </span>
                  <span 
                    className="resizable-header"
                    onClick={() => { setSortBy('occupation'); setSortOrder(sortBy === 'occupation' && sortOrder === 'asc' ? 'desc' : 'asc'); }}
                    style={{ cursor: 'pointer', position: 'relative', paddingRight: '10px' }}
                    title="Sort by occupation"
                  >
                    Occupation {sortBy === 'occupation' && (sortOrder === 'asc' ? '↑' : '↓')}
                    <div className="resize-handle" onMouseDown={(e) => handleResizeStart(e, 'occupation')} />
                  </span>
                  <span>Tags</span>
                  <span style={{ textAlign: 'right' }}>Actions</span>
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
                  hasPiiAccess={hasPiiAccess(user.username, 'contact_info')}
                  hasImageAccess={hasPiiAccess(user.username, 'images')}
                  isPiiRequestPending={isPiiRequestPending(user.username, 'contact_info')}
                  isImageRequestPending={isPiiRequestPending(user.username, 'images')}
                  piiRequestStatus={getPIIRequestStatus(user.username)}
                  piiAccess={{
                    contact: hasPiiAccess(user.username, 'contact_info'),
                    email: hasPiiAccess(user.username, 'email'),
                    phone: hasPiiAccess(user.username, 'phone'),
                    photos: hasPiiAccess(user.username, 'images')
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
                  onClick={() => setViewMode('split')}
                  title="Split view"
                >
                  ⚏
                </button>
                <button
                  className={`view-toggle-btn ${viewMode === 'cards' ? 'active' : ''}`}
                  onClick={() => setViewMode('cards')}
                  title="Card view"
                >
                  ▦
                </button>
                <button
                  className={`view-toggle-btn ${viewMode === 'rows' ? 'active' : ''}`}
                  onClick={() => setViewMode('rows')}
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
                ⚠️ Confirm Exclusion
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
                Marking <strong>{selectedUserForExclusion?.firstName || exclusionPreviewData.target_username}</strong> as "Not Interested" will permanently remove:
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
                {exclusionLoading ? '⏳ Processing...' : '🚫 Confirm Exclusion'}
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
          onSuccess={handlePIIRequestSuccess}
        />
      )}
    </div>
  );
};

export default SearchPage2;
