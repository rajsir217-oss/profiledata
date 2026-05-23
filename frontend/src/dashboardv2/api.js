// frontend/src/dashboardv2/api.js
//
// Thin facade over EXISTING backend endpoints. No new APIs are introduced here.
// Every function in this file maps 1:1 to an endpoint that already exists in the
// codebase. If you need to debug, search the backend for the exact path string.
//
// Endpoint conventions:
//   - `api` (default export of ../api) is configured with baseURL = <backend>/api/users
//     so calls like api.get('/favorites/{u}') resolve to /api/users/favorites/{u}.
//   - For routes outside /api/users (notes, polls, etc.) use raw axios + getBackendUrl().

import axios from 'axios';
import api from '../api';
import { getBackendUrl } from '../config/apiConfig';
import logger from '../utils/logger';

const getCurrentUsername = () => localStorage.getItem('username');

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

// ============================================================================
// Saved searches (used by hero + side rail + chip strip)
// ============================================================================

export async function fetchSavedSearches() {
  const username = getCurrentUsername();
  if (!username) return [];
  try {
    const { data } = await api.get(`/${username}/saved-searches`);
    return data.savedSearches || [];
  } catch (err) {
    logger.error('fetchSavedSearches failed:', err);
    return [];
  }
}

// ============================================================================
// Search (used for newest-match hero + chip "new" counts)
// ============================================================================

/**
 * Translate a saved-search criteria object into URLSearchParams for /api/search.
 * Maps the criteria field names used by saved searches to the query-param names
 * expected by routes.py:5084's `search_users`.
 */
function buildSearchParams(criteria, overrides = {}) {
  const p = new URLSearchParams();

  if (criteria) {
    if (criteria.gender) p.append('gender', criteria.gender);
    if (criteria.ageMin) p.append('ageMin', criteria.ageMin);
    if (criteria.ageMax) p.append('ageMax', criteria.ageMax);
    if (criteria.heightMin) p.append('heightMin', criteria.heightMin);
    if (criteria.heightMax) p.append('heightMax', criteria.heightMax);
    if (criteria.newlyAdded) p.append('newlyAdded', 'true');
    if (criteria.daysBack !== undefined && criteria.daysBack !== null && criteria.daysBack !== '') {
      p.append('daysBack', criteria.daysBack);
    }
    if (criteria.location) p.append('location', criteria.location);
    if (Array.isArray(criteria.locations)) {
      criteria.locations.forEach((loc) => p.append('locations', loc));
    }
    if (criteria.occupation) p.append('occupation', criteria.occupation);
    if (Array.isArray(criteria.occupations)) {
      criteria.occupations.forEach((occ) => p.append('occupations', occ));
    }
    if (criteria.religion) p.append('religion', criteria.religion);
    if (criteria.caste) p.append('caste', criteria.caste);
    if (criteria.eatingPreference) p.append('eatingPreference', criteria.eatingPreference);
    if (criteria.drinking) p.append('drinking', criteria.drinking);
    if (criteria.smoking) p.append('smoking', criteria.smoking);
    if (criteria.relationshipStatus) p.append('relationshipStatus', criteria.relationshipStatus);
    if (criteria.bodyType) p.append('bodyType', criteria.bodyType);
    if (criteria.hasPhoto) p.append('hasPhoto', 'true');
  }

  Object.entries(overrides).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.set(k, v);
  });

  return p;
}

/**
 * Run a search using saved-search criteria + overrides.
 * Returns the raw response data (shape determined by routes.py:5084).
 */
export async function searchProfiles(criteria, overrides = {}) {
  const params = buildSearchParams(criteria, overrides);
  try {
    const { data } = await api.get(`/search?${params.toString()}`);
    return data;
  } catch (err) {
    logger.error('searchProfiles failed:', err);
    return { results: [], total: 0 };
  }
}

export async function searchProfilesStrict(criteria, overrides = {}) {
  const params = buildSearchParams(criteria, overrides);
  const { data } = await api.get(`/search?${params.toString()}`);
  return data;
}

// ============================================================================
// Counts and lists for stat tiles
// ============================================================================

export async function fetchProfileViews() {
  const username = getCurrentUsername();
  if (!username) return { viewers: [], totalViews: 0, uniqueViewers: 0 };
  try {
    const { data } = await api.get(`/views/${username}`);
    return data;
  } catch (err) {
    logger.error('fetchProfileViews failed:', err);
    return { viewers: [], totalViews: 0, uniqueViewers: 0 };
  }
}

export async function fetchFavorites() {
  const username = getCurrentUsername();
  if (!username) return [];
  try {
    const { data } = await api.get(`/favorites/${username}`);
    return data.favorites || [];
  } catch (err) {
    logger.error('fetchFavorites failed:', err);
    return [];
  }
}

export async function fetchShortlist() {
  const username = getCurrentUsername();
  if (!username) return [];
  try {
    const { data } = await api.get(`/shortlist/${username}`);
    return data.shortlist || [];
  } catch (err) {
    logger.error('fetchShortlist failed:', err);
    return [];
  }
}

export async function fetchExclusions() {
  const username = getCurrentUsername();
  if (!username) return [];
  try {
    const { data } = await api.get(`/exclusions/${username}`);
    return data.exclusions || [];
  } catch (err) {
    logger.error('fetchExclusions failed:', err);
    return [];
  }
}

export async function fetchNotes() {
  try {
    const { data } = await axios.get(`${getBackendUrl()}/api/notes`, {
      headers: authHeaders(),
    });
    return data.notes || [];
  } catch (err) {
    logger.error('fetchNotes failed:', err);
    return [];
  }
}

// ============================================================================
// Conversations (recent messages panel + "follow up on chats" derivation)
// ============================================================================

export async function fetchConversations() {
  const username = getCurrentUsername();
  if (!username) return [];
  try {
    const { data } = await api.get(`/messages/conversations?username=${username}`);
    return data.conversations || [];
  } catch (err) {
    logger.error('fetchConversations failed:', err);
    return [];
  }
}

// ============================================================================
// Action card data: who favorited me, contact requests
// ============================================================================

export async function fetchTheirFavorites() {
  const username = getCurrentUsername();
  if (!username) return [];
  try {
    const { data } = await api.get(`/their-favorites/${username}`);
    return data.favoritedBy || data || [];
  } catch (err) {
    logger.error('fetchTheirFavorites failed:', err);
    return [];
  }
}

export async function fetchIncomingPiiRequests() {
  try {
    const { data } = await axios.get(`${getBackendUrl()}/api/pii-requests`, {
      headers: authHeaders(),
    });
    return data.requests || data || [];
  } catch (err) {
    logger.error('fetchIncomingPiiRequests failed:', err);
    return [];
  }
}

// ============================================================================
// Active polls (uses existing polls feature — DO NOT duplicate)
// ============================================================================

export async function fetchActivePolls() {
  try {
    const { data } = await axios.get(`${getBackendUrl()}/api/polls/active`, {
      headers: authHeaders(),
    });
    if (!data?.success) return [];
    return data.polls || [];
  } catch (err) {
    logger.error('fetchActivePolls failed:', err);
    return [];
  }
}

export async function submitPollResponse(pollId, payload) {
  try {
    const { data } = await axios.post(
      `${getBackendUrl()}/api/polls/${pollId}/respond`,
      payload,
      { headers: authHeaders() }
    );
    return data;
  } catch (err) {
    logger.error('submitPollResponse failed:', err);
    throw err;
  }
}

export async function updatePollResponse(pollId, payload) {
  try {
    const { data } = await axios.put(
      `${getBackendUrl()}/api/polls/${pollId}/respond`,
      payload,
      { headers: authHeaders() }
    );
    return data;
  } catch (err) {
    logger.error('updatePollResponse failed:', err);
    throw err;
  }
}

// ============================================================================
// Current user profile (for hero greeting + side-rail completeness card)
// ============================================================================

export async function fetchCurrentUserProfile() {
  const username = getCurrentUsername();
  if (!username) return null;
  try {
    const { data } = await api.get(`/profile/${username}`);
    return data;
  } catch (err) {
    logger.error('fetchCurrentUserProfile failed:', err);
    return null;
  }
}
