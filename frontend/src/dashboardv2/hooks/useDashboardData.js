// frontend/src/dashboardv2/hooks/useDashboardData.js
//
// Parallel-fetches every piece of data the dashboardv2 page needs in a single
// Promise.all. Returns a normalized object with the data + loading/error state.
//
// This intentionally does NOT include the hero "newest match" — that has its
// own hook (useNewestMatch) because it has fallback logic that depends on
// having the saved searches list first.

import { useEffect, useState, useCallback } from 'react';
import logger from '../../utils/logger';
import {
  fetchSavedSearches,
  fetchProfileViews,
  fetchFavorites,
  fetchShortlist,
  fetchExclusions,
  fetchNotes,
  fetchConversations,
  fetchTheirFavorites,
  fetchIncomingPiiRequests,
  fetchActivePolls,
  fetchCurrentUserProfile,
  fetchSearchCriteriaBreakdown,
} from '../api';

const getCurrentUsername = () => localStorage.getItem('username');

const initialData = {
  userProfile: null,
  savedSearches: [],
  profileViews: { viewers: [], totalViews: 0, uniqueViewers: 0 },
  favorites: [],
  shortlist: [],
  exclusions: [],
  notes: [],
  conversations: [],
  theirFavorites: [],
  incomingPiiRequests: [],
  activePolls: [],
  searchCriteriaBreakdown: null,
};

export function useDashboardData() {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(true);
  const [criticalLoading, setCriticalLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setCriticalLoading(true);
    setError(null);
    try {
      // Critical data fetches (blocking)
      const [
        userProfile,
        savedSearches,
        profileViews,
        favorites,
        shortlist,
        exclusions,
        notes,
        conversations,
        theirFavorites,
        incomingPiiRequests,
        activePolls,
      ] = await Promise.all([
        fetchCurrentUserProfile(),
        fetchSavedSearches(),
        fetchProfileViews(),
        fetchFavorites(),
        fetchShortlist(),
        fetchExclusions(),
        fetchNotes(),
        fetchConversations(),
        fetchTheirFavorites(),
        fetchIncomingPiiRequests(getCurrentUsername()),
        fetchActivePolls(),
      ]);

      setData({
        userProfile,
        savedSearches,
        profileViews,
        favorites,
        shortlist,
        exclusions,
        notes,
        conversations,
        theirFavorites,
        incomingPiiRequests,
        activePolls,
        searchCriteriaBreakdown: null, // Will be loaded separately
      });
    } catch (err) {
      logger.error('useDashboardData refetch failed:', err);
      setError(err);
    } finally {
      setLoading(false);
      setCriticalLoading(false);
    }
  }, []);

  const fetchBreakdown = useCallback(async (criteria) => {
    const username = getCurrentUsername();
    if (!criteria || !username) return;

    try {
      const breakdown = await fetchSearchCriteriaBreakdown(username, criteria);
      setData((prev) => ({
        ...prev,
        searchCriteriaBreakdown: breakdown,
      }));
    } catch (err) {
      logger.warn('Failed to fetch search criteria breakdown (non-critical):', err);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, criticalLoading, error, refetch, fetchBreakdown };
}
