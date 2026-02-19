import { useState, useRef, useCallback } from 'react';

/**
 * useSearchState - Manages all search-related state
 * Handles search criteria, results, pagination, loading, and view modes
 */
export const useSearchState = () => {
  // ===== SEARCH CRITERIA & RESULTS =====
  const [users, setUsers] = useState([]);
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
    heightMin: '', // Computed total inches for API
    heightMax: '', // Computed total inches for API
    locations: [], // Multi-select locations array
    location: '', // Single location (legacy compatibility)
    occupation: '', // Single occupation (legacy)
    occupations: [], // Multi-select occupations array (new)
    maritalStatus: '',
    relationshipStatus: '', // Legacy compatibility
    newlyAdded: false, // Legacy compatibility
    hasPhoto: true, // Default ON - only show profiles with photos
    daysBack: 30, // Number of days to look back for profile creation (default: 30)
    eating: '', // Legacy compatibility
    eatingPreference: '', // New field name
    drinking: '',
    smoking: '',
    lifestyle: '',
    bodyType: '',
    religion: '',
    caste: '', // Legacy compatibility
    motherTongue: '',
    education: '',
    annualIncome: '',
    locationPreference: '',
    familyValues: '',
    familyType: '',
    familyStatus: '',
  });

  // ===== LOADING STATES =====
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingStartTime, setLoadingStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [initialSearchComplete, setInitialSearchComplete] = useState(false);
  const [error, setError] = useState('');

  // ===== PAGINATION STATE =====
  const [currentPage, setCurrentPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [hasMoreResults, setHasMoreResults] = useState(true);

  // ===== SORT STATE =====
  const [sortBy, setSortBy] = useState('newest'); // matchScore, age, height, location, occupation, newest
  const [sortOrder, setSortOrder] = useState('desc'); // desc or asc (desc = newest first)

  // ===== VIEW MODE STATE =====
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

  // ===== SWIPE MODE STATE =====
  const [swipeIndex, setSwipeIndex] = useState(0);

  // ===== SPLIT SCREEN STATE =====
  const [selectedProfileForDetail, setSelectedProfileForDetail] = useState(null);
  const [expandedSections, setExpandedSections] = useState({
    aboutMe: true,
    lookingFor: true,
  });

  // ===== REFS =====
  const hasAutoExecutedRef = useRef(false);
  const searchResultsRef = useRef(null);
  const loadMoreTriggerRef = useRef(null);
  const loadingPageRef = useRef(0);
  const searchAbortRef = useRef(null);
  const accumulatedCountRef = useRef(0);

  // ===== COLUMN WIDTHS FOR ROWS VIEW =====
  const [columnWidths, setColumnWidths] = useState({
    index: 35,      // #1, #2, etc - narrow
    photo: 40,      // Small avatar
    name: 140,      // Names need more space
    score: 45,      // L3V3L score column
    age: 40,        // Age column
    height: 50,     // Height column
    location: 110,  // Location column
    education: 140, // Education column
    occupation: 100, // Occupation column
    actions: 80,    // Action buttons
  });

  // ===== ACTIONS =====

  // Reset search state
  const resetSearchState = useCallback(() => {
    setUsers([]);
    setCurrentPage(1);
    setTotalResults(0);
    setHasMoreResults(true);
    setLoadingMore(false);
    setElapsedTime(0);
    setLoadingStartTime(null);
    setError('');
    setSelectedProfileForDetail(null);
    setSwipeIndex(0);
    accumulatedCountRef.current = 0;
    loadingPageRef.current = 1;
  }, []);

  // Update view mode with localStorage persistence
  const updateViewMode = useCallback((mode) => {
    setViewMode(mode);
    localStorage.setItem('searchViewMode', mode);
  }, []);

  // Update cards per row with localStorage persistence
  const updateCardsPerRow = useCallback((count) => {
    setCardsPerRow(count);
    localStorage.setItem('searchCardsPerRow', count.toString());
  }, []);

  // Reset search criteria to defaults
  const resetSearchCriteria = useCallback(() => {
    setSearchCriteria({
      keyword: '',
      profileId: '',
      gender: '',
      ageMin: '',
      ageMax: '',
      heightMinFeet: '',
      heightMinInches: '',
      heightMaxFeet: '',
      heightMaxInches: '',
      locations: [],
      occupation: '',
      occupations: [],
      maritalStatus: '',
      hasPhoto: true,
      daysBack: 30,
      eating: '',
      drinking: '',
      smoking: '',
      lifestyle: '',
      bodyType: '',
      religion: '',
      motherTongue: '',
      education: '',
      annualIncome: '',
      locationPreference: '',
      familyValues: '',
      familyType: '',
      familyStatus: '',
    });
  }, []);

  // Update search criteria
  const updateSearchCriteria = useCallback((updates) => {
    setSearchCriteria(prev => ({ ...prev, ...updates }));
  }, []);

  // Toggle expanded section in split view
  const toggleExpandedSection = useCallback((section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  }, []);

  // Update sort settings - auto-toggle if only sortBy is passed
  const updateSort = useCallback((newSortBy, newSortOrder) => {
    if (newSortOrder === undefined) {
      // Auto-toggle: if same field, toggle order; otherwise default to 'asc'
      setSortBy(prev => {
        if (prev === newSortBy) {
          setSortOrder(prevOrder => prevOrder === 'asc' ? 'desc' : 'asc');
        } else {
          setSortOrder('asc');
        }
        return newSortBy;
      });
    } else {
      setSortBy(newSortBy);
      setSortOrder(newSortOrder);
    }
  }, []);

  // Update column widths - supports both object updates and functional updates
  const updateColumnWidths = useCallback((updater) => {
    if (typeof updater === 'function') {
      setColumnWidths(updater);
    } else {
      setColumnWidths(prev => ({ ...prev, ...updater }));
    }
  }, []);

  // Navigate to next/previous in swipe mode
  const navigateSwipe = useCallback((direction) => {
    if (direction === 'next' && swipeIndex < users.length - 1) {
      setSwipeIndex(prev => prev + 1);
    } else if (direction === 'prev' && swipeIndex > 0) {
      setSwipeIndex(prev => prev - 1);
    }
  }, [swipeIndex, users.length]);

  // Start loading timer
  const startLoadingTimer = useCallback(() => {
    setLoadingStartTime(Date.now());
    setElapsedTime(0);
  }, []);

  // Update elapsed time
  const updateElapsedTime = useCallback(() => {
    if (loadingStartTime) {
      setElapsedTime(Math.floor((Date.now() - loadingStartTime) / 1000));
    }
  }, [loadingStartTime]);

  return {
    // State
    users,
    searchCriteria,
    loading,
    loadingMore,
    loadingStartTime,
    elapsedTime,
    initialSearchComplete,
    error,
    currentPage,
    totalResults,
    hasMoreResults,
    sortBy,
    sortOrder,
    viewMode,
    cardsPerRow,
    swipeIndex,
    selectedProfileForDetail,
    expandedSections,
    columnWidths,

    // Refs
    hasAutoExecutedRef,
    searchResultsRef,
    loadMoreTriggerRef,
    loadingPageRef,
    searchAbortRef,
    accumulatedCountRef,

    // Actions
    setUsers,
    setSearchCriteria,
    setLoading,
    setLoadingMore,
    setLoadingStartTime,
    setElapsedTime,
    setInitialSearchComplete,
    setError,
    setCurrentPage,
    setTotalResults,
    setHasMoreResults,
    setSortBy,
    setSortOrder,
    setViewMode,
    setCardsPerRow,
    setSwipeIndex,
    setSelectedProfileForDetail,
    setExpandedSections,
    setColumnWidths,

    // Convenience actions
    resetSearchState,
    updateViewMode,
    updateCardsPerRow,
    resetSearchCriteria,
    updateSearchCriteria,
    toggleExpandedSection,
    updateSort,
    updateColumnWidths,
    navigateSwipe,
    startLoadingTimer,
    updateElapsedTime,
  };
};
