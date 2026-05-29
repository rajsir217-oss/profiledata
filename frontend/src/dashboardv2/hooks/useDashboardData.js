// frontend/src/dashboardv2/hooks/useDashboardData.js
//
// Fetches dashboardv2 data in two stages:
//   1) hero-critical data first (profile + saved searches)
//   2) non-critical sections after hero can render
// Returns a normalized object with data + loading/error state.
//
// This intentionally does NOT include the hero "newest match" — that has its
// own hook (useNewestMatch) because it has fallback logic that depends on
// having the saved searches list first.

import { useEffect, useState, useCallback, useRef } from 'react';
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
const DEFERRED_POLLS_DELAY_MS = 1200;

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
  const deferredPollsTimerRef = useRef(null);

  const refetch = useCallback(async ({ deferPolls = true } = {}) => {
    if (deferredPollsTimerRef.current) {
      clearTimeout(deferredPollsTimerRef.current);
      deferredPollsTimerRef.current = null;
    }

    setLoading(true);
    setCriticalLoading(true);
    setError(null);

    try {
      // Stage 1: hero-critical data only
      // Unblocks newest-match hero as soon as profile + saved searches are ready.
      const [
        userProfile,
        savedSearches,
      ] = await Promise.all([
        fetchCurrentUserProfile(),
        fetchSavedSearches(),
      ]);

      setData((prev) => ({
        ...prev,
        userProfile,
        savedSearches,
        searchCriteriaBreakdown: null,
      }));

      // Hero can render now while the rest of dashboard data continues loading.
      setCriticalLoading(false);

      // Stage 2: non-critical dashboard sections
      const [
        profileViews,
        favorites,
        shortlist,
        exclusions,
        notes,
        conversations,
        theirFavorites,
        incomingPiiRequests,
      ] = await Promise.all([
        fetchProfileViews(),
        fetchFavorites(),
        fetchShortlist(),
        fetchExclusions(),
        fetchNotes(),
        fetchConversations(),
        fetchTheirFavorites(),
        fetchIncomingPiiRequests(getCurrentUsername()),
      ]);

      setData((prev) => ({
        ...prev,
        profileViews,
        favorites,
        shortlist,
        exclusions,
        notes,
        conversations,
        theirFavorites,
        incomingPiiRequests,
      }));

      const updateActivePolls = async () => {
        const activePolls = await fetchActivePolls();
        setData((prev) => ({
          ...prev,
          activePolls,
        }));
      };

      if (deferPolls) {
        deferredPollsTimerRef.current = setTimeout(() => {
          deferredPollsTimerRef.current = null;
          updateActivePolls();
        }, DEFERRED_POLLS_DELAY_MS);
      } else {
        await updateActivePolls();
      }
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
    refetch({ deferPolls: true });
  }, [refetch]);

  useEffect(() => () => {
    if (deferredPollsTimerRef.current) {
      clearTimeout(deferredPollsTimerRef.current);
      deferredPollsTimerRef.current = null;
    }
  }, []);

  return { data, loading, criticalLoading, error, refetch, fetchBreakdown };
}
