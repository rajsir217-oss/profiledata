# Search and Card Pages Rules

> Mandatory consistency and behavior rules for user cards, search pages, and the L3V3L matching flow.
> See also `.devin/rules/frontend.md` for styling and `.devin/rules/backend.md` for server-backed sort.

---

## 1. Card page consistency (CRITICAL)

The following pages must remain identical in card styling, behavior, and state management:

- `/l3v3l-matches` — uses `SearchResultCard`
- `/search` — uses `SearchResultCard`
- `/dashboard` — uses `UserCard`
- `/favorites` — uses `SearchResultCard`
- `/shortlist` — uses `SearchResultCard`

### 1.1 Must stay identical

- Button styling (colors, shadows, animations, sizes).
- Icon usage (filled/empty star for favorite, checkmark-clipboard/clipboard for shortlist, speech bubble for message, eye for view profile, no-entry/cross for exclude).
- Active/inactive states (glowing vs dull).
- Hover effects (scale, gradient, shadow).
- Action handlers (`handleFavorite`, `handleShortlist`, `handleExclude`, `handleMessage`, `handlePIIRequest`).
- Modal behavior (`MessageModal`, `PIIRequestModal`).
- State persistence across reloads and navigation.

### 1.2 Pre-commit checklist

Before any change to `UserCard`, `SearchResultCard`, or pages using them:

1. Open `/l3v3l-matches`, `/search`, and `/dashboard` side-by-side.
2. Verify favorite, shortlist, message, and view buttons look identical.
3. Verify active buttons glow the same way; inactive buttons are dull/transparent.
4. Click favorite on Search and check status on Dashboard.
5. Click shortlist on L3V3L and check status on Search.
6. Click message on each page and confirm `MessageModal` opens with full user data.
7. Refresh and confirm button states persist.
8. Confirm `PIIRequestModal` works identically on all pages.

### 1.3 Component files to keep synchronized

- `/frontend/src/components/UserCard.js`
- `/frontend/src/components/SearchResultCard.js`
- `/frontend/src/components/Dashboard.js`
- `/frontend/src/components/SearchPage.js`
- `/frontend/src/components/L3V3LMatches.js`
- `/frontend/src/components/Favorites.js`
- `/frontend/src/components/Shortlist.js`

CSS files:
- `/frontend/src/components/UserCard.css`
- `/frontend/src/components/SearchPage.css` (includes `SearchResultCard` styles)
- `/frontend/src/components/Dashboard.css`

---

## 2. State management on card pages

Each card page must load and persist the same preference sets on mount:

```javascript
const [favoritedUsers, setFavoritedUsers] = useState(new Set());
const [shortlistedUsers, setShortlistedUsers] = useState(new Set());
const [excludedUsers, setExcludedUsers] = useState(new Set());

useEffect(() => {
  loadUserPreferences();
}, []);

const loadUserPreferences = async () => {
  const username = localStorage.getItem('username');
  const [favResponse, shortlistResponse, exclusionsResponse] = await Promise.all([
    api.get(`/favorites/${username}`),
    api.get(`/shortlist/${username}`),
    api.get(`/exclusions/${username}`)
  ]);

  const favorites   = favResponse.data.favorites         || favResponse.data         || [];
  const shortlist   = shortlistResponse.data.shortlist   || shortlistResponse.data   || [];
  const exclusions  = exclusionsResponse.data.exclusions || exclusionsResponse.data  || [];

  setFavoritedUsers(new Set(favorites.map(u => u.username || u)));
  setShortlistedUsers(new Set(shortlist.map(u => u.username || u)));
  setExcludedUsers(new Set(exclusions.map(u => u.username || u)));
};
```

### 2.1 PII access tracking

Load PII requests and active grants:

```javascript
const [requestsResponse, accessResponse] = await Promise.all([
  api.get(`/pii-requests/${username}/outgoing`),
  api.get(`/pii-access/${username}/received`)
]);
```

- Track only `pending` outgoing requests.
- Track only active grants from `receivedAccess`.
- Map each access type per target user.

---

## 3. Search behavior

### 3.1 Server-backed sort

- Sort is controlled by dedicated sort state, not by `sortBy`/`sortOrder` inside the search-criteria payload.
- Frontend `SearchPage2.js` triggers `handleSearchHook(..., overrideSort)` on sort field/order changes.
- Backend canonical sort keys: `matchScore`, `height`, `firstName`, `location`, `education`, `profession`.
- Backend removes internal aggregation helper fields (`_sortFirstName`, `_sortHeightInches`, etc.) before returning the response.

### 3.2 Saved search auto-load

When a user clicks a saved search in `SearchPage`:

1. Load the saved search criteria into the form fields.
2. Automatically trigger a search after a short delay (e.g., `setTimeout(() => handleSearch(1), 100)`).
3. Close the saved searches dropdown.

### 3.3 Near Me

- Probe result count for `state + locations` before executing.
- If the probe returns zero, retry with `state` only and update the status bubble.
- On success, expand to nearby cities within 30 miles using Overpass API, dedupe/normalize against existing location options, and run the search with a `locations` array.
- Show explicit in-progress feedback, block duplicate triggers while running, and reset state in a `finally` block.
- If geolocation or reverse geocoding fails, fall back to the default saved search or partner defaults.

### 3.4 Saved search auto-load

When a user clicks a saved search:

1. Load the saved search criteria into the form fields.
2. Automatically trigger a search after a short delay:
   ```js
   setTimeout(() => handleSearch(1), 100);
   ```
3. Close the saved searches dropdown.

### 3.5 Updated-at on cards

Backend search projections must include `updatedAt` so cards can render relative "Updated X ago" text. This is configured in `SEARCH_RESULT_PROJECTION` and `DASHBOARD_USER_PROJECTION` in `fastapi_backend/routes.py`.

### 3.6 New Me

`SearchPage2.handleNewMeSearch` requests browser geolocation, reverse-geocodes the coordinates to a city via OpenStreetMap Nominatim, and auto-runs a search with partner-default criteria plus `locations: [city]` and `location: city`.

If city resolution fails or permission is denied/unavailable, fall back to the default saved search or partner defaults. Refactor saved-search criteria normalization into `normalizeCriteriaForSearch` and pass `onNewMe` into `SearchFilters` for both basic and advanced action rows.

### 3.7 Near Me

- Probe result count for `state + locations` before executing.
- If the probe returns zero, retry with `state` only and update the status bubble.
- On success, expand to nearby cities within 30 miles using the Overpass API.
- Dedupe/normalize against existing location options.
- Run the search with a `locations` array.
- Show explicit in-progress feedback, block duplicate triggers while running, and reset state in a `finally` block.
- If geolocation or reverse geocoding fails, fall back to the default saved search or partner defaults.

---

## 4. L3V3L matching and profile view

### 4.1 Empty-string numeric conversion

`fastapi_backend/l3v3l_matching_engine.py` must validate numeric values before `int()` because MongoDB may return empty strings. Always use:

```python
raw_value = data.get('field', 0)
value = int(raw_value) if raw_value not in ('', None) else 0
```

### 4.2 Profile view match details

The endpoint `GET /api/users/l3v3l-match-details/{viewer}/{target}` returns:

- `matchScore`
- `compatibilityLevel`
- `breakdown` with 8 component scores
- `matchReasons`

`Profile.js` fetches this when viewing someone else's profile and passes the data to `L3V3LMatchingTable.js`.

### 4.3 Component score weights

1. Gender compatibility (15%)
2. L3V3L pillars (20%)
3. Demographics (10%)
4. Partner preferences (15%)
5. Habits and personality (10%)
6. Career and education (10%)
7. Physical attributes (10%)
8. Cultural factors (10%)

### 4.4 L3V3L match details on profile view

`GET /api/users/l3v3l-match-details/{viewer}/{target}` returns:

```json
{
  "matchScore": 85.5,
  "compatibilityLevel": "Excellent L3V3L Match",
  "breakdown": {
    "gender": 95.0,
    "l3v3l_pillars": 82.3,
    "demographics": 75.0,
    "partner_preferences": 88.0,
    "habits_personality": 78.5,
    "career_education": 80.0,
    "physical_attributes": 85.0,
    "cultural_factors": 90.0
  },
  "matchReasons": ["Great career compatibility", "Similar values"]
}
```

`Profile.js` fetches this when viewing someone else's profile and passes the data to `L3V3LMatchingTable.js`.

---

## 5. Search UI details

### 5.1 Search button icons

When filter buttons overflow the sidebar, use icon-only buttons:

- Search: magnifying-glass icon (spinning arrow while loading).
- Clear: `x` icon.
- Layout: CSS Grid `1fr 1fr`, 8px gap.
- Show a small active-filter-count badge next to the clear icon.

### 5.2 Search sorting

- Sort is server-backed. Frontend `SearchPage2.js` triggers `handleSearchHook(..., overrideSort)` on sort changes.
- Backend normalizes aliases (`name` -> `firstName`, `heightInches` -> `height`, `occupation` -> `profession`).
- Canonical sort keys: `matchScore`, `height`, `firstName`, `location`, `education`, `profession`.
- Aggregation helper fields (`_sortFirstName`, `_sortHeightInches`, etc.) are removed before the response is returned.
- Do not keep `sortBy` / `sortOrder` in search-criteria payloads; sort state is managed separately.

### 5.3 Search performance considerations

`/api/search` is heavy because it uses `$facet` totalCount, L3V3L lookup, decryption, and activity-log inserts even for small limits. When reviewing search speed:

- Consider a `minimal=true` or `count_only=true` mode for probes and hero requests.
- Avoid caching user documents on Cloud Run instances; instead, optimize the MongoDB query, add selective projections, and consider Redis for frequently requested first pages.
- Profile the aggregation pipeline in MongoDB Compass or `explain()` before adding application-level caching.

---

## 6. Dashboard V2 gotchas

### 6.1 People who favorited you

The "People who favorited you" attention card must use the inbound favorites metric (`data.theirFavorites.length`) and navigate to `/dashboard` with Dashboard2 context presets:

```js
localStorage.setItem('dashboard2OthersActiveCategory', 'theirFavorites');
```

This keeps it distinct from "My favorites" (`/favorites`).

### 6.2 Conversation refresh

Recent conversations must refresh after archive actions so counts and lists update immediately. Add `refreshConversations()` to `useDashboardData` and pass it to `RecentConversations` as `onConversationsChanged`.
