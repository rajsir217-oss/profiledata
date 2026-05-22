import { useEffect } from 'react';
import { getDefaultSavedSearch } from '../api';
import logger from '../utils/logger';
import toastService from '../services/toastService';
import { buildDefaultCriteria } from '../utils/searchDefaults';

// Module-level bootstrap guard.
// Survives React 18 StrictMode's mount→unmount→remount cycle (where component
// instance refs reset). Keyed by username so a sign-out / different-user
// session re-bootstraps. Reset to {username: null, done: false} on logout.
const searchBootstrapState = { username: null, done: false };

if (typeof window !== 'undefined') {
  window.addEventListener('loginStatusChanged', () => {
    searchBootstrapState.username = null;
    searchBootstrapState.done = false;
  });
}

// Build the partner-criteria defaults shape used when no default saved search
// exists (or after an error). Wraps profileDefaults in the full criteria shape
// that the rest of the search machinery expects.
const buildPartnerCriteriaCriteria = (defaults) => ({
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
  newlyAdded: false
});

// Owns the initial-search bootstrap effect: when the user profile lands,
// either auto-load the user's default saved search or fall back to a
// partner-criteria search. Guards against StrictMode double-mount and
// against double-firing when a TopBar pendingSearchAction is also in flight.
//
// Extracted from SearchPage2.js as part of the #11 refactor.
const useInitialSearchBootstrap = ({
  currentUserProfile,
  pendingSearchAction,
  setUsers,
  setSearchCriteria,
  setMinMatchScore,
  setSelectedSearch,
  handleSearchHook
}) => {
  useEffect(() => {
    const loadAndExecuteDefaultSearch = async () => {
      if (!currentUserProfile || Object.keys(currentUserProfile).length === 0) {
        logger.info('⚠️ currentUserProfile is empty or null, waiting...');
        return;
      }

      // Module-level guard: survives StrictMode mount→unmount→remount and
      // prevents both "default search runs after saved search" and double
      // bootstrap. Reset on user change so sign-out + sign-in re-bootstraps.
      const currentUsername = localStorage.getItem('username');
      if (searchBootstrapState.username !== currentUsername) {
        searchBootstrapState.username = currentUsername;
        searchBootstrapState.done = false;
      }
      if (searchBootstrapState.done) {
        logger.info('⏭️ Bootstrap already done for this session, skipping');
        return;
      }
      searchBootstrapState.done = true;

      // If there is a pending saved-search action from TopBar, the dedicated
      // pending-action effect will load it. Skip the default search path so
      // we don't run two searches.
      if (pendingSearchAction?.type === 'loadSavedSearch' && pendingSearchAction?.savedSearch) {
        logger.info('⏭️ Skipping default auto-search due to pending saved search load');
        return;
      }

      // Clear any stale users before loading fresh results.
      logger.info('🧹 Clearing stale users before loading search criteria');
      setUsers([]);

      // Pre-compute once; reused in gender-override, partner-criteria, and fallback branches.
      const profileDefaults = buildDefaultCriteria(currentUserProfile);

      try {
        // Check if there's a default saved search
        logger.info('⭐ Checking for default saved search for user:', currentUsername);
        const response = await getDefaultSavedSearch();
        const defaultSearch = response?.savedSearch || response;

        if (defaultSearch && defaultSearch.criteria) {
          logger.info('⭐ Found default saved search:', defaultSearch.name);
          logger.info('📋 Default search criteria:', defaultSearch.criteria);

          // Extract minMatchScore from saved search
          const loadedMinScore = defaultSearch.minMatchScore !== undefined ? defaultSearch.minMatchScore : 0;

          // SAFETY: Enforce opposite-gender filter for non-admin users.
          // Saved searches might have gender='' or wrong gender - override it.
          const userRole = currentUserProfile?.role?.toLowerCase();
          const isPrivileged = userRole === 'admin' || userRole === 'moderator';
          if (!isPrivileged) {
            if (profileDefaults.gender && defaultSearch.criteria.gender !== profileDefaults.gender) {
              logger.info(`🚻 Overriding saved search gender '${defaultSearch.criteria.gender}' → '${profileDefaults.gender}'`);
              defaultSearch.criteria.gender = profileDefaults.gender;
            }
          }

          // Load criteria and set selected search
          setSearchCriteria(defaultSearch.criteria);
          setMinMatchScore(loadedMinScore);
          setSelectedSearch(defaultSearch);

          logger.info('🔍 Auto-executing default saved search');
          handleSearchHook(1, loadedMinScore, defaultSearch.criteria);
          toastService.info(`⭐ Default search "${defaultSearch.name}" executed`);
        } else {
          // No default saved search - execute search with partnerCriteria defaults
          logger.info('🔍 No default search found - building criteria from partnerCriteria');
          const partnerCriteriaDefaults = buildPartnerCriteriaCriteria(profileDefaults);
          logger.info('📋 Built partnerCriteria defaults:', partnerCriteriaDefaults);

          setSearchCriteria(partnerCriteriaDefaults);
          logger.info('🔍 Auto-executing search with partnerCriteria defaults');
          handleSearchHook(1, 0, partnerCriteriaDefaults);
        }
      } catch (err) {
        logger.error('Error loading default saved search:', err);

        // FALLBACK: If loading default search fails, execute with partner criteria
        // Without this, no search would ever execute on page load.
        logger.info('🔍 Fallback: executing search with partnerCriteria after error');
        const fallbackCriteria = buildPartnerCriteriaCriteria(profileDefaults);
        setSearchCriteria(fallbackCriteria);
        handleSearchHook(1, 0, fallbackCriteria);
      }
    };

    loadAndExecuteDefaultSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserProfile]);
};

export default useInitialSearchBootstrap;
