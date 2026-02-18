import { useState, useCallback } from 'react';
import api from '../api';
import logger from '../utils/logger';
import toastService from '../services/toastService';

/**
 * useSearchFilters - Manages filter options and saved searches
 * Handles loading filter data, saved searches, and filter UI state
 */
export const useSearchFilters = () => {
  // ===== FILTER OPTIONS STATE =====
  const [occupationOptions, setOccupationOptions] = useState([]);
  const [locationOptions, setLocationOptions] = useState([]);
  
  // Static filter options (could be moved to API in future)
  const eatingOptions = ['', 'Vegetarian', 'Vegan', 'Eggetarian', 'Non-Veg'];
  const lifestyleOptions = ['', 'Never', 'Socially', 'Prefer not to say'];
  const bodyTypeOptions = ['', 'Slim', 'Athletic', 'Average', 'Curvy'];

  // ===== SAVED SEARCHES STATE =====
  const [savedSearches, setSavedSearches] = useState([]);
  const [showSavedSearches, setShowSavedSearches] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [selectedSearch, setSelectedSearch] = useState(null);
  const [editingScheduleFor, setEditingScheduleFor] = useState(null);

  // ===== FILTER UI STATE =====
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // ===== DATA LOADING =====

  // Load occupation options dynamically
  const loadOccupationOptions = useCallback(async () => {
    try {
      const response = await api.get('/search/occupation-options');
      setOccupationOptions(response.data.options || []);
    } catch (err) {
      logger.error('❌ Error loading occupation options:', err);
      setOccupationOptions([]);
    }
  }, []);

  // Load location options dynamically
  const loadLocationOptions = useCallback(async () => {
    try {
      const response = await api.get('/search/location-options');
      setLocationOptions(response.data.options || []);
    } catch (err) {
      logger.error('❌ Error loading location options:', err);
      setLocationOptions([]);
    }
  }, []);

  // Load saved searches
  const loadSavedSearches = useCallback(async () => {
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
  }, []);

  // Load all filter data
  const loadFilterData = useCallback(async () => {
    try {
      await Promise.all([
        loadOccupationOptions(),
        loadLocationOptions(),
        loadSavedSearches()
      ]);
    } catch (err) {
      logger.error('❌ Error loading filter data:', err);
    }
  }, [loadOccupationOptions, loadLocationOptions, loadSavedSearches]);

  // ===== SAVED SEARCH ACTIONS =====

  // Update saved search name
  const updateSavedSearch = useCallback(async (searchId, newName) => {
    try {
      const username = localStorage.getItem('username');
      await api.put(`/${username}/saved-searches/${searchId}`, { name: newName });
      toastService.success(`✅ Search renamed to: "${newName}"`);
      loadSavedSearches();
    } catch (err) {
      logger.error('Error updating saved search:', err);
      toastService.error('Failed to update saved search');
    }
  }, [loadSavedSearches]);

  // Delete saved search
  const deleteSavedSearch = useCallback(async (searchId) => {
    if (!searchId) {
      toastService.error('Cannot delete: Invalid search ID');
      return;
    }

    try {
      const username = localStorage.getItem('username');
      await api.delete(`/${username}/saved-searches/${searchId}`);
      toastService.success('🗑️ Search deleted successfully');
      loadSavedSearches();
    } catch (err) {
      logger.error('Error deleting saved search:', err);
      toastService.error('Failed to delete saved search');
    }
  }, [loadSavedSearches]);

  // Set default saved search
  const setDefaultSavedSearch = useCallback(async (searchId, searchName, isCurrentlyDefault = false) => {
    try {
      if (isCurrentlyDefault) {
        // Unset the default
        await api.delete(`/${localStorage.getItem('username')}/saved-searches/${searchId}/default`);
        toastService.info(`📌 Removed default search: "${searchName}"`);
      } else {
        // Set as default
        await api.put(`/${localStorage.getItem('username')}/saved-searches/${searchId}/default`);
        toastService.success(`📌 Set default search: "${searchName}"`);
      }
      loadSavedSearches();
    } catch (err) {
      logger.error('Error setting default search:', err);
      toastService.error('Failed to set default search');
    }
  }, [loadSavedSearches]);

  // ===== FILTER UI ACTIONS =====

  // Toggle advanced filters
  const toggleAdvancedFilters = useCallback(() => {
    setShowAdvancedFilters(prev => !prev);
  }, []);

  // Show saved searches panel
  const showSavedSearchesPanel = useCallback(() => {
    setShowSavedSearches(true);
  }, []);

  // Hide saved searches panel
  const hideSavedSearchesPanel = useCallback(() => {
    setShowSavedSearches(false);
  }, []);

  // Show save search modal
  const showSaveSearchModal = useCallback(() => {
    setShowSaveModal(true);
  }, []);

  // Hide save search modal
  const hideSaveSearchModal = useCallback(() => {
    setShowSaveModal(false);
  }, []);

  // Select a saved search
  const selectSavedSearch = useCallback((search) => {
    setSelectedSearch(search);
  }, []);

  // Clear selected search
  const clearSelectedSearch = useCallback(() => {
    setSelectedSearch(null);
  }, []);

  // Set editing schedule for a search
  const setEditingSchedule = useCallback((searchId) => {
    setEditingScheduleFor(searchId);
  }, []);

  // Clear editing schedule
  const clearEditingSchedule = useCallback(() => {
    setEditingScheduleFor(null);
  }, []);

  // ===== UTILITY FUNCTIONS =====

  // Get filter option counts
  const getOccupationOptionsCount = useCallback(() => {
    return occupationOptions.length;
  }, [occupationOptions]);

  const getLocationOptionsCount = useCallback(() => {
    return locationOptions.length;
  }, [locationOptions]);

  const getSavedSearchesCount = useCallback(() => {
    return savedSearches.length;
  }, [savedSearches]);

  // Check if has any saved searches
  const hasSavedSearches = useCallback(() => {
    return savedSearches.length > 0;
  }, [savedSearches]);

  // Find saved search by ID
  const findSavedSearchById = useCallback((searchId) => {
    return savedSearches.find(search => 
      search.id === searchId || search._id === searchId
    );
  }, [savedSearches]);

  return {
    // Filter options state
    occupationOptions, setOccupationOptions,
    locationOptions, setLocationOptions,
    eatingOptions,
    lifestyleOptions,
    bodyTypeOptions,
    
    // Saved searches state
    savedSearches, setSavedSearches,
    showSavedSearches, setShowSavedSearches,
    showSaveModal, setShowSaveModal,
    selectedSearch, setSelectedSearch,
    editingScheduleFor, setEditingScheduleFor,
    
    // Filter UI state
    showAdvancedFilters, setShowAdvancedFilters,
    
    // Data loading
    loadOccupationOptions,
    loadLocationOptions,
    loadSavedSearches,
    loadFilterData,
    
    // Saved search actions
    updateSavedSearch,
    deleteSavedSearch,
    setDefaultSavedSearch,
    
    // Filter UI actions
    toggleAdvancedFilters,
    showSavedSearchesPanel,
    hideSavedSearchesPanel,
    showSaveSearchModal,
    hideSaveSearchModal,
    selectSavedSearch,
    clearSelectedSearch,
    setEditingSchedule,
    clearEditingSchedule,
    
    // Utilities
    getOccupationOptionsCount,
    getLocationOptionsCount,
    getSavedSearchesCount,
    hasSavedSearches,
    findSavedSearchById,
  };
};
