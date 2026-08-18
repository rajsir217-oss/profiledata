# Admin and Dashboard Rules

> Behavioral guardrails for admin pages, admin hub consolidation, the DashboardV2 redesign, and related UI patterns.

---

## 1. Admin access

- Admin access checks must use `localStorage.getItem('userRole') === 'admin'`, never `localStorage.getItem('username') === 'admin'`.
- The admin user may have any username.

```jsx
const userRole = localStorage.getItem('userRole');
if (userRole !== 'admin') {
  logger.warn('Unauthorized access attempt to [Component Name]');
  navigate('/dashboard');
}
```

## 2. Admin Hub consolidation

The Admin Hub is the single place for admin tools:

- `/admin-hub` hosts sections including `blog` and `test-suite`.
- Legacy routes redirect into Admin Hub with query params preserved:
  - `/test-suite` -> `/admin-hub?section=test-suite&tab=...`
  - `/test-dashboard` -> `/admin-hub?section=test-suite`
  - `/notification-tester` -> `/admin-hub?section=test-suite`
- `TestSuite` accepts `routeBase` and `baseParams` so tabs work both standalone and inside Admin Hub.
- The sidebar treats testing as part of Admin Hub, and the TopBar Admin Hub subtitle includes tests.

## 3. Admin Settings merged into Preferences

Admin settings moved into `/preferences` as the "System Config" tab:

- Tabs: Theme, Password, System Config (admin-only).
- The tab is only visible to admin users (`userRole === 'admin'`).
- The "System Configuration" sidebar item was removed to reduce clutter.

## 4. Activity Summary Panel

- Implementation: `frontend/src/components/ActivitySummaryPanel.js` + `ActivitySummaryPanel.css`.
- Mounted from `Profile.js` when `showActivityPanel` is true.
- Trigger button appears only when `localStorage.getItem('userRole') === 'admin'`.
- Fetches `GET /user-activity-summary/{username}` via the shared `api` client.
- Renders sections: Account, Authentication, Messages, PII Requests, Favorites, Shortlists, Profile Views, Notifications, Searches, Contributions.
- Contributions reminder mini-actions call `POST /api/contributions/admin/send-reminder` (backend allows admin or moderator).

## 5. Sidebar behavior

### Simplified toggle

The Sidebar uses a simple toggle pattern:

- Toggle button in `TopBar` (hamburger icon).
- State `isSidebarCollapsed` in `App.js` starts `true`.
- Sidebar starts collapsed and toggles open/closed; no overlay.
- Content does not shift; the sidebar overlays content.
- No pin functionality in the simplified version.

### Pin persistence

When pin is supported, initialize `isSidebarPinned` from `localStorage.getItem('sidebarPinned')`. If pinned, start expanded and persist pin state on change.

## 6. DashboardV2 gotchas

### People who favorited you

The "People who favorited you" attention card must use the inbound favorites metric (`data.theirFavorites.length`) and navigate to `/dashboard` with Dashboard2 context presets:

```js
localStorage.setItem('dashboard2OthersActiveCategory', 'theirFavorites');
localStorage.setItem('dashboard2Groups', JSON.stringify({ ...defaultGroups, othersActivities: true }));
```

This keeps it distinct from "My favorites" (`/favorites`).

### Conversation refresh

Recent conversations must refresh after archive actions so counts and lists update immediately. Add `refreshConversations()` to `useDashboardData` and pass it to `RecentConversations` as `onConversationsChanged`.

### Hero-card performance

Avoid blocking the hero render on `useDashboardData`'s `criticalLoading`, which waits for 11 fetches even though the hero only needs `userProfile` + `savedSearches`. Avoid sequential fallback searches and heavy `/api/search` aggregation for `limit=1` hero requests. Reduce redundant mount-time requests from polls and banners.

## 7. Contribution popup

`frontend/src/components/ContributionPopup.js` shows member value stats:

- Stats: days active, profile views, profile favorites, profile shortlists, messages/conversations.
- Uses existing APIs only; no new backend endpoints.
- Caches in `sessionStorage` with key `contribution_member_stats_v1:{username}` and a 10-minute TTL.
- Loads stats only when the popup opens.
- Use responsive single-column behavior on mobile.

## 8. DashboardV2 hero-card performance

Hero latency is the biggest DashboardV2 bottleneck. Known causes and fixes:

1. `useDashboardData` waits for 11 `Promise.all` fetches via `criticalLoading`, but the hero only needs `userProfile` + `savedSearches`.
2. `useNewestMatch` fallback searches run sequentially and can issue multiple `/search` calls before the first returns.
3. `/api/search` uses a heavy aggregation with `$facet` totalCount, L3V3L lookup, decryption, and activity-log inserts even for `limit=1` hero requests.
4. Active polls are fetched twice (`useDashboardData` + `PollWidget` mount), and dashboard banners issue four additional mount-time requests, increasing connection contention.

When optimizing the hero:

- Render the hero as soon as `userProfile` and `savedSearches` resolve.
- Avoid heavy search aggregation for hero; consider a dedicated lightweight `/api/search?limit=1&minimal=true` or a hero-specific endpoint.
- Deduplicate poll and banner requests.
- Cache newest-match results between mounts.

## 9. Table headers and admin action buttons

For table headers, see `.devin/rules/frontend.md`.

For the `bubble-icons` admin action button pattern, see `.devin/rules/frontend.md`.
