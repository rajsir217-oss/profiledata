import { useCallback } from 'react';
import logger from '../utils/logger';

/**
 * useSearchViewModes - Manages view modes and layout switching
 * Handles view mode changes, localStorage persistence, and view-specific logic
 */
export const useSearchViewModes = (searchState) => {
  const {
    viewMode, setViewMode,
    cardsPerRow, setCardsPerRow,
    swipeIndex, setSwipeIndex,
    selectedProfileForDetail, setSelectedProfileForDetail,
    users,
  } = searchState;

  // ===== VIEW MODE ACTIONS =====

  // Change view mode with localStorage persistence and side effects
  const changeViewMode = useCallback((mode) => {
    logger.info(`🔄 Changing view mode from ${viewMode} to ${mode}`);
    
    setViewMode(mode);
    localStorage.setItem('searchViewMode', mode);
    
    // Auto-select first profile when switching to split view
    if (mode === 'split' && users.length > 0) {
      setSelectedProfileForDetail(users[0]);
      logger.info('📱 Auto-selected first profile for split view');
    }
    
    // Reset swipe index when switching to swipe mode
    if (mode === 'swipe') {
      setSwipeIndex(0);
      logger.info('👆 Reset swipe index to 0');
    }
    
    // Clear selected profile when leaving split view
    if (viewMode === 'split' && mode !== 'split') {
      setSelectedProfileForDetail(null);
      logger.info('🔍 Cleared selected profile when leaving split view');
    }
  }, [viewMode, setViewMode, users, setSelectedProfileForDetail, setSwipeIndex]);

  // ===== CARDS PER ROW MANAGEMENT =====

  // Update cards per row with localStorage persistence
  const changeCardsPerRow = useCallback((count) => {
    logger.info(`📊 Changing cards per row from ${cardsPerRow} to ${count}`);
    setCardsPerRow(count);
    localStorage.setItem('searchCardsPerRow', count.toString());
  }, [cardsPerRow, setCardsPerRow]);

  // ===== SWIPE MODE ACTIONS =====

  // Navigate to next card in swipe mode
  const nextCard = useCallback(() => {
    if (swipeIndex < users.length - 1) {
      const newIndex = swipeIndex + 1;
      setSwipeIndex(newIndex);
      logger.info(`👆 Advanced to card ${newIndex + 1} of ${users.length}`);
      return newIndex;
    }
    return swipeIndex;
  }, [swipeIndex, users.length, setSwipeIndex]);

  // Navigate to previous card in swipe mode
  const previousCard = useCallback(() => {
    if (swipeIndex > 0) {
      const newIndex = swipeIndex - 1;
      setSwipeIndex(newIndex);
      logger.info(`👆 Went back to card ${newIndex + 1} of ${users.length}`);
      return newIndex;
    }
    return swipeIndex;
  }, [swipeIndex, setSwipeIndex]);

  // Jump to specific card index
  const goToCard = useCallback((index) => {
    if (index >= 0 && index < users.length) {
      setSwipeIndex(index);
      logger.info(`👆 Jumped to card ${index + 1} of ${users.length}`);
      return index;
    }
    return swipeIndex;
  }, [swipeIndex, users.length, setSwipeIndex]);

  // Reset swipe to first card
  const resetSwipe = useCallback(() => {
    setSwipeIndex(0);
    logger.info('👆 Reset swipe to first card');
  }, [setSwipeIndex]);

  // ===== SPLIT SCREEN ACTIONS =====

  // Select profile for detail view
  const selectProfileForDetail = useCallback((user) => {
    setSelectedProfileForDetail(user);
    logger.info(`📱 Selected profile for detail: ${user.username}`);
  }, [setSelectedProfileForDetail]);

  // Clear selected profile
  const clearSelectedProfile = useCallback(() => {
    setSelectedProfileForDetail(null);
    logger.info('🔍 Cleared selected profile');
  }, [setSelectedProfileForDetail]);

  // ===== VIEW MODE UTILITIES =====

  // Check if current view mode supports certain features
  const isSplitView = useCallback(() => viewMode === 'split', [viewMode]);
  const isSwipeView = useCallback(() => viewMode === 'swipe', [viewMode]);
  const isCardsView = useCallback(() => viewMode === 'cards', [viewMode]);
  const isRowsView = useCallback(() => viewMode === 'rows', [viewMode]);
  const isGraphView = useCallback(() => viewMode === 'graph', [viewMode]);

  // Get current swipe progress
  const getSwipeProgress = useCallback(() => {
    if (!users.length) return { current: 0, total: 0, percentage: 0 };
    return {
      current: swipeIndex + 1,
      total: users.length,
      percentage: Math.round(((swipeIndex + 1) / users.length) * 100)
    };
  }, [swipeIndex, users.length]);

  // Check if at end of swipe deck
  const isAtSwipeEnd = useCallback(() => {
    return swipeIndex >= users.length - 1;
  }, [swipeIndex, users.length]);

  // Check if at start of swipe deck
  const isAtSwipeStart = useCallback(() => {
    return swipeIndex === 0;
  }, [swipeIndex]);

  // Get visible users for current view mode
  const getVisibleUsers = useCallback(() => {
    switch (viewMode) {
      case 'swipe':
        return users.slice(swipeIndex, swipeIndex + 2); // Current + next for stack effect
      case 'split':
        return selectedProfileForDetail ? [selectedProfileForDetail] : [];
      default:
        return users;
    }
  }, [viewMode, users, swipeIndex, selectedProfileForDetail]);

  // ===== VIEW MODE CONFIGURATION =====

  // Available view modes with metadata
  const availableViewModes = [
    { mode: 'split', icon: '⚏', label: 'Split', title: 'Split view - List with detail panel' },
    { mode: 'cards', icon: '▦', label: 'Cards', title: 'Card view - Grid layout' },
    { mode: 'rows', icon: '☰', label: 'Rows', title: 'Row view - List layout' },
    { mode: 'swipe', icon: '👆', label: 'Swipe', title: 'Swipe view - Tinder-style swiping' },
    { mode: 'graph', icon: '◎', label: 'Graph', title: 'Graph view - Radial visualization with drag-and-drop' },
  ];

  // Cards per row options
  const cardsPerRowOptions = [2, 3, 4, 5, 6];

  // Get view mode info
  const getViewModeInfo = useCallback(() => {
    return availableViewModes.find(vm => vm.mode === viewMode) || availableViewModes[0];
  }, [viewMode]);

  return {
    // State
    viewMode,
    cardsPerRow,
    swipeIndex,
    selectedProfileForDetail,
    
    // Actions
    changeViewMode,
    changeCardsPerRow,
    nextCard,
    previousCard,
    goToCard,
    resetSwipe,
    selectProfileForDetail,
    clearSelectedProfile,
    
    // Utilities
    isSplitView,
    isSwipeView,
    isCardsView,
    isRowsView,
    isGraphView,
    getSwipeProgress,
    isAtSwipeEnd,
    isAtSwipeStart,
    getVisibleUsers,
    
    // Configuration
    availableViewModes,
    cardsPerRowOptions,
    getViewModeInfo,
  };
};
