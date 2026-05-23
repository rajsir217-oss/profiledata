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
// All work uses the EXISTING /api/search endpoint (routes.py:5084) with:
//   sortBy=newest, sortOrder=desc, limit=1, page=N
// No new backend endpoints required.

import { useCallback, useEffect, useMemo, useState } from 'react';
import logger from '../../utils/logger';
import { buildDefaultCriteria } from '../../utils/searchDefaults';
import { searchProfilesStrict } from '../api';

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
 * Returns { profile, savedSearch, searchIndex, page } or null.
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
        limit: 1,
        page,
      });
      const results = data?.results || data?.users || [];
      if (results.length > 0) {
        return {
          profile: results[0],
          savedSearch,
          searchIndex,
          page,
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isEmpty, setIsEmpty] = useState(false);

  const compute = useCallback(
    async (startIndex, startPage) => {
      setLoading(true);
      setError(null);
      try {
        if (!orderedSearches.length) {
          if (!currentUserProfile || Object.keys(currentUserProfile).length === 0) {
            setPick(null);
            setIsEmpty(false);
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
            limit: 1,
            page: startPage,
          });
          const results = data?.results || data?.users || [];
          if (results.length > 0) {
            setPick({ profile: results[0], savedSearch: null });
            setPosition({ searchIndex: 0, page: startPage });
            setIsEmpty(false);
          } else {
            setPick(null);
            setIsEmpty(true);
          }
          return;
        }

        const defaults = buildDefaultCriteria(currentUserProfile);
        const searchesWithOverrides = orderedSearches.map((s) => ({
          ...s,
          criteria: coerceCriteriaForSearch(s.criteria, defaults, currentUserProfile),
        }));

        const result = await findNextPick(searchesWithOverrides, startIndex, startPage);
        if (result) {
          setPick({
            profile: result.profile,
            savedSearch: result.savedSearch,
          });
          setPosition({
            searchIndex: result.searchIndex,
            page: result.page,
          });
          setIsEmpty(false);
        } else {
          setPick(null);
          setIsEmpty(true);
        }
      } catch (err) {
        logger.error('useNewestMatch compute failed:', err);
        setError(err);
        setPick(null);
        setIsEmpty(false);
      } finally {
        setLoading(false);
      }
    },
    [currentUserProfile, orderedSearches]
  );

  // Initial load + reload when saved searches change
  useEffect(() => {
    setPosition({ searchIndex: 0, page: 1 });
    compute(0, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedSearches]);

  // Skip = advance to next page within current saved search; fall through if needed
  const skipPick = useCallback(() => {
    compute(position.searchIndex, position.page + 1);
  }, [compute, position]);

  // Reload from the top
  const reload = useCallback(() => {
    setPosition({ searchIndex: 0, page: 1 });
    compute(0, 1);
  }, [compute]);

  return {
    pick,
    loading,
    error,
    isEmpty,
    skipPick,
    reload,
  };
}
