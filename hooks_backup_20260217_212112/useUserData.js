import { useState, useCallback } from 'react';
import api from '../api';
import logger from '../utils/logger';
import toastService from '../services/toastService';

/**
 * useUserData - Manages user interaction data (favorites, shortlist, exclusions)
 * Handles loading and updating user relationship states
 */
export const useUserData = () => {
  // ===== USER INTERACTION STATE =====
  const [favoritedUsers, setFavoritedUsers] = useState(new Set());
  const [shortlistedUsers, setShortlistedUsers] = useState(new Set());
  const [excludedUsers, setExcludedUsers] = useState(new Set());

  // ===== DATA LOADING =====

  // Load all user interaction data (favorites, shortlist, exclusions)
  const loadUserData = useCallback(async () => {
    const username = localStorage.getItem('username');
    if (!username) return;

    try {
      // Load all user data in parallel
      const [favResponse, shortlistResponse, exclusionsResponse] = await Promise.all([
        api.get(`/favorites/${username}`).catch(err => {
          logger.error('❌ Error loading favorites:', err);
          return { data: [] };
        }),
        api.get(`/shortlist/${username}`).catch(err => {
          logger.error('❌ Error loading shortlist:', err);
          return { data: [] };
        }),
        api.get(`/exclusions/${username}`).catch(err => {
          logger.error('❌ Error loading exclusions:', err);
          return { data: [] };
        })
      ]);

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
      logger.error('❌ Error loading user data:', err);
    }
  }, []);

  // ===== USER ACTIONS =====

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

  // Add to favorites
  const addToFavorites = useCallback(async (targetUsername) => {
    const currentUser = localStorage.getItem('username');
    if (!currentUser) {
      toastService.error('Please login to add favorites');
      return;
    }
    
    await toggleListAction(
      'favorites',
      `/favorites/${currentUser}/${targetUsername}`,
      favoritedUsers,
      setFavoritedUsers,
      targetUsername
    );
  }, [favoritedUsers, toggleListAction]);

  // Remove from favorites
  const removeFromFavorites = useCallback(async (targetUsername) => {
    const currentUser = localStorage.getItem('username');
    if (!currentUser) return;
    
    await toggleListAction(
      'favorites',
      `/favorites/${currentUser}/${targetUsername}`,
      favoritedUsers,
      setFavoritedUsers,
      targetUsername
    );
  }, [favoritedUsers, toggleListAction]);

  // Add to shortlist
  const addToShortlist = useCallback(async (targetUsername) => {
    const currentUser = localStorage.getItem('username');
    if (!currentUser) {
      toastService.error('Please login to add to shortlist');
      return;
    }
    
    await toggleListAction(
      'shortlist',
      `/shortlist/${currentUser}/${targetUsername}`,
      shortlistedUsers,
      setShortlistedUsers,
      targetUsername
    );
  }, [shortlistedUsers, toggleListAction]);

  // Remove from shortlist
  const removeFromShortlist = useCallback(async (targetUsername) => {
    const currentUser = localStorage.getItem('username');
    if (!currentUser) return;
    
    await toggleListAction(
      'shortlist',
      `/shortlist/${currentUser}/${targetUsername}`,
      shortlistedUsers,
      setShortlistedUsers,
      targetUsername
    );
  }, [shortlistedUsers, toggleListAction]);

  // Add to exclusions
  const addToExclusions = useCallback(async (targetUsername) => {
    const currentUser = localStorage.getItem('username');
    if (!currentUser) {
      toastService.error('Please login to add exclusions');
      return;
    }
    
    await toggleListAction(
      'exclusions',
      `/exclusions/${currentUser}/${targetUsername}`,
      excludedUsers,
      setExcludedUsers,
      targetUsername
    );
  }, [excludedUsers, toggleListAction]);

  // Remove from exclusions
  const removeFromExclusions = useCallback(async (targetUsername) => {
    const currentUser = localStorage.getItem('username');
    if (!currentUser) return;
    
    await toggleListAction(
      'exclusions',
      `/exclusions/${currentUser}/${targetUsername}`,
      excludedUsers,
      setExcludedUsers,
      targetUsername
    );
  }, [excludedUsers, toggleListAction]);

  // ===== UTILITY FUNCTIONS =====

  // Check if user is favorited
  const isFavorited = useCallback((username) => {
    return favoritedUsers.has(username);
  }, [favoritedUsers]);

  // Check if user is shortlisted
  const isShortlisted = useCallback((username) => {
    return shortlistedUsers.has(username);
  }, [shortlistedUsers]);

  // Check if user is excluded
  const isExcluded = useCallback((username) => {
    return excludedUsers.has(username);
  }, [excludedUsers]);

  // Get counts
  const getFavoriteCount = useCallback(() => {
    return favoritedUsers.size;
  }, [favoritedUsers]);

  const getShortlistCount = useCallback(() => {
    return shortlistedUsers.size;
  }, [shortlistedUsers]);

  const getExclusionCount = useCallback(() => {
    return excludedUsers.size;
  }, [excludedUsers]);

  return {
    // State
    favoritedUsers, setFavoritedUsers,
    shortlistedUsers, setShortlistedUsers,
    excludedUsers, setExcludedUsers,
    
    // Data loading
    loadUserData,
    
    // Actions
    toggleListAction,
    addToFavorites,
    removeFromFavorites,
    addToShortlist,
    removeFromShortlist,
    addToExclusions,
    removeFromExclusions,
    
    // Utilities
    isFavorited,
    isShortlisted,
    isExcluded,
    getFavoriteCount,
    getShortlistCount,
    getExclusionCount,
  };
};
