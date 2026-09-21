// frontend/src/dashboardv2/hooks/useNewestMatch.js
//
// Implements the dashboardv2 hero pattern:
//   "Newest match in [your default saved search]"
// with the locked-in fallback chain:
//   1. Try the user's default saved search (isDefault: true)
//   2. If empty, try the next-most-recent saved search (by createdAt desc)
//   3. Continue until a saved search yields a match
//   4. If ALL saved searches are exhausted -> empty state
//
// Skip behavior:
//   - "Skip" advances to the next-newest profile in the SAME saved search
//   - When that search runs out, fall back to the next saved search in the chain
//
// Peers behavior:
//   - The hero shows the newest profile; `peers` exposes the remaining
//     profiles from the same batch for a "postage stamp" strip.
//
// All work uses the EXISTING /api/search endpoint (routes.py:5519) with:
//   sortBy=newest, sortOrder=desc, limit=BATCH_SIZE, page=N
// No new backend endpoints required.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import logger from '../../utils/logger';
import { buildDefaultCriteria } from '../../utils/searchDefaults';
import { searchProfilesStrict } from '../api';

// Number of profiles fetched per batch. The first becomes the hero pick;
// the rest are exposed as `peers` for the "postage stamp" strip.
const BATCH_SIZE = 11;

function toPositiveInt(value) {
  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function heightToInches(feet, inches) {
  const f = toPositiveInt(feet);
  const i = toPositiveInt(inches) ?? 0;
  if (!f) return null;
  return f * 12 + i;
}

function coerceCriteriaForSearch(criteria, profileDefaults, currentUserProfile) {
  const copy = { ...(criteria || {}) };

  const userRole = currentUserProfile?.role?.toLowerCase();
  const isPrivileged = userRole === 'admin' || userRole === 'moderator';

  if (!isPrivileged && profileDefaults?.gender && copy.gender !== profileDefaults.gender) {
    copy.gender = profileDefaults.gender;
  }

  if (!copy.heightMin && (copy.heightMinFeet || copy.heightMinInches)) {
    const minInches = heightToInches(copy.heightMinFeet, copy.heightMinInches);
    if (minInches) copy.heightMin = String(minInches);
  }

  if (!copy.heightMax && (copy.heightMaxFeet || copy.heightMaxInches)) {
    const maxInches = heightToInches(copy.heightMaxFeet, copy.heightMaxInches);
    if (maxInches) copy.heightMax = String(maxInches);
  }

  return copy;
}

/**
 * Order saved searches for the fallback chain:
 *   default first, then by createdAt desc.
 */
function orderSavedSearches(savedSearches) {
  const list = [...(savedSearches || [])];
  return list.sort((a, b) => {
    if (a.isDefault && !b.isDefault) return -1;
    if (!a.isDefault && b.isDefault) return 1;
    const aTime = new Date(a.createdAt || 0).getTime();
    const bTime = new Date(b.createdAt || 0).getTime();
    return bTime - aTime;
  });
}

/**
 * Try to find a hero pick by walking the saved-search list.
 * Returns { profile, peers, savedSearch, searchIndex, page, hasMore } or null.
 */
async function findNextPick(orderedSearches, startSearchIndex, startPage) {
  let searchIndex = startSearchIndex;
  let page = startPage;

  let lastError = null;
  let hadError = false;

  while (searchIndex < orderedSearches.length) {
    const savedSearch = orderedSearches[searchIndex];
    const criteria = savedSearch.criteria || {};

    try {
      const data = await searchProfilesStrict(criteria, {
        sortBy: 'newest',
        sortOrder: 'desc',
        limit: BATCH_SIZE,
        page,
      });
      const results = data?.results || data?.users || [];
      const total = data?.total || 0;
      if (results.length > 0) {
        const offset = (page - 1) * BATCH_SIZE;
        const hasMore = offset + results.length < total;
        return {
          profile: results[0],
          peers: results.slice(1),
          savedSearch,
          searchIndex,
          page,
          hasMore,
        };
      }
    } catch (err) {
      hadError = true;
      lastError = err;
      if (err?.response?.status === 429) {
        throw err;
      }
      logger.warn('findNextPick: search failed for', savedSearch?.name, err);
    }

    // Empty page: advance to next saved search
    searchIndex += 1;
    page = 1;
  }

  if (hadError && lastError) {
    throw lastError;
  }

  return null;
}

/**
 * Hook entry point.
 *
 * @param {Array} savedSearches  full list from useDashboardData
 * @returns {{
 *   pick: { profile, savedSearch } | null,
 *   loading: boolean,
 *   error: any,
 *   isEmpty: boolean,
 *   skipPick: () => void,
 *   reload: () => void
 * }}
 */
export function useNewestMatch(savedSearches, currentUserProfile) {
  const orderedSearches = useMemo(
    () => orderSavedSearches(savedSearches),
    [savedSearches]
  );

  const [position, setPosition] = useState({ searchIndex: 0, page: 1 });
  const [pick, setPick] = useState(null);
  const [peers, setPeers] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isEmpty, setIsEmpty] = useState(false);
  const requestIdRef = useRef(0);

  const compute = useCallback(
    async (startIndex, startPage) => {
      const requestId = ++requestIdRef.current;
      setLoading(true);
      setError(null);

      // Commit only if no newer compute() run has started since this one did.
      const commit = (next) => {
        if (requestIdRef.current !== requestId) return;
        if (next.pick !== undefined) setPick(next.pick);
        if (next.peers !== undefined) setPeers(next.peers);
        if (next.hasMore !== undefined) setHasMore(next.hasMore);
        if (next.position !== undefined) setPosition(next.position);
        if (next.isEmpty !== undefined) setIsEmpty(next.isEmpty);
      };

      try {
        if (!orderedSearches.length) {
          if (!currentUserProfile || Object.keys(currentUserProfile).length === 0) {
            commit({ pick: null, peers: [], hasMore: false, isEmpty: false });
            return;
          }

          const defaults = buildDefaultCriteria(currentUserProfile);
          const criteria = coerceCriteriaForSearch(
            {
              gender: defaults.gender,
              ageMin: defaults.ageMin,
              ageMax: defaults.ageMax,
              heightMin: heightToInches(defaults.heightMinFeet, defaults.heightMinInches)
                ? String(heightToInches(defaults.heightMinFeet, defaults.heightMinInches))
                : '',
              heightMax: heightToInches(defaults.heightMaxFeet, defaults.heightMaxInches)
                ? String(heightToInches(defaults.heightMaxFeet, defaults.heightMaxInches))
                : '',
              hasPhoto: defaults.hasPhoto,
              locations: defaults.locations,
              daysBack: defaults.daysBack,
            },
            defaults,
            currentUserProfile
          );

          const data = await searchProfilesStrict(criteria, {
            sortBy: 'newest',
            sortOrder: 'desc',
            limit: BATCH_SIZE,
            page: startPage,
          });
          const results = data?.results || data?.users || [];
          const total = data?.total || 0;
          if (results.length > 0) {
            const offset = (startPage - 1) * BATCH_SIZE;
            commit({
              pick: { profile: results[0], savedSearch: null },
              peers: results.slice(1),
              hasMore: offset + results.length < total,
              position: { searchIndex: 0, page: startPage },
              isEmpty: false,
            });
          } else {
            commit({ pick: null, peers: [], hasMore: false, isEmpty: true });
          }
          return;
        }

        const defaults = buildDefaultCriteria(currentUserProfile);
        const searchesWithOverrides = orderedSearches.map((s) => ({
          ...s,
          criteria: coerceCriteriaForSearch(s.criteria, defaults, currentUserProfile),
        }));

        // Sequential, default-first: walk saved searches in priority order and
        // stop at the first hit. Avoids firing one heavy /api/search aggregation
        // per saved search on every load (the old parallel fast-path did).
        const result = await findNextPick(searchesWithOverrides, startIndex, startPage);
        if (result) {
          commit({
            pick: { profile: result.profile, savedSearch: result.savedSearch },
            peers: result.peers || [],
            hasMore: result.hasMore || false,
            position: { searchIndex: result.searchIndex, page: result.page },
            isEmpty: false,
          });
        } else {
          commit({ pick: null, peers: [], hasMore: false, isEmpty: true });
        }
      } catch (err) {
        if (requestIdRef.current !== requestId) return;
        logger.error('useNewestMatch compute failed:', err);
        setError(err);
        setPick(null);
        setPeers([]);
        setHasMore(false);
        setIsEmpty(false);
      } finally {
        if (requestIdRef.current === requestId) {
          setLoading(false);
        }
      }
    },
    [currentUserProfile, orderedSearches]
  );

  // Initial load + reload when saved searches change.
  // Skip the run entirely when neither saved searches nor a user profile are
  // available yet — otherwise compute() would flip loading on/off for no work,
  // causing an unnecessary re-render on mount.
  useEffect(() => {
    const hasSearches = orderedSearches.length > 0;
    const hasProfile =
      !!currentUserProfile && Object.keys(currentUserProfile).length > 0;
    if (!hasSearches && !hasProfile) return;

    setPosition({ searchIndex: 0, page: 1 });
    compute(0, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedSearches, currentUserProfile]);

  // Skip = advance to next page within current saved search; fall through if needed
  const skipPick = useCallback(() => {
    compute(position.searchIndex, position.page + 1);
  }, [compute, position]);

  // Previous = go back one page within current saved search
  const previousPick = useCallback(() => {
    if (position.page > 1) {
      compute(position.searchIndex, position.page - 1);
    }
  }, [compute, position]);

  // Clicking a postage-stamp promotes that peer to the hero, swapping the
  // current hero back into the peer's slot (pure client-side, no refetch).
  const selectPeer = useCallback(
    (peer) => {
      if (!peer || !pick) return;
      const peerKey = peer?.username || peer?.profileId || peer?.id;
      setPeers(
        (peers || []).map((p) =>
          (p?.username || p?.profileId || p?.id) === peerKey ? pick.profile : p
        )
      );
      setPick({ profile: peer, savedSearch: pick.savedSearch });
    },
    [pick, peers]
  );

  // Reload from the top
  const reload = useCallback(() => {
    setPosition({ searchIndex: 0, page: 1 });
    compute(0, 1);
  }, [compute]);

  return {
    pick,
    peers,
    hasMore,
    position,
    loading,
    error,
    isEmpty,
    skipPick,
    previousPick,
    selectPeer,
    reload,
  };
}
