# Platform Stats / Info Module — Deep Audit Report

## Critical Bugs (Fix Immediately)

### BUG-1: profile_views Double-Counting via `$or` Query
**Files:** `daily_platform_stats_snapshot.py:60-66`  
**Status: FIXED** — Replaced `$or` count_documents with an aggregation pipeline that uses `$switch` + `$ifNull` to pick the best available date field (`viewedAt` → `lastViewedAt` → `createdAt` → `viewed_at`), then `$match` on the computed `bestDate`. Eliminates double-counting when a document has multiple date fields populated.

### BUG-2: `yearly` Period Has Two Conflicting Code Paths
**File:** `platform_stats.py:107-150` and `:169-178`  
**Status: FIXED** — Changed `if period in ["yearly", "all"]:` to `if period == "all":` so `yearly` no longer takes the inception-to-now all-time path. It now flows down to the per-period date-range logic, correctly returning current-calendar-year totals only.

### BUG-3: Inception Date Mismatch
**File:** `platform_stats.py:102-103`  
**Status: FIXED** — Comment updated to match code (`datetime(2025, 9, 1)` = September 2025). Verify with the team that September is the correct actual launch date.

### BUG-4: all_time Snapshot Non-Idempotent Increment
**File:** `daily_platform_stats_snapshot.py:119-136`  
**Status: FIXED** — Added `$addToSet: {processedDays: date_str}` to the update and changed the filter to `{"_id": "all_time", "processedDays": {"$ne": date_str}}`. The initial `insert_one` also seeds `processedDays: [date_str]`. Re-running the daily snapshot job for the same date is now safe — the `$inc` only applies once per day.

### BUG-5: In-Memory Cache Is Per-Process (Multi-Worker Ineffective)
**File:** `platform_stats.py:28`  
`_stats_cache` is module-level dict. In Gunicorn/Uvicorn with N workers, each process has its own cache. ~75% of requests may still hit MongoDB.  
**Fix:** Rely primarily on Redis; remove in-memory fallback or use a shared cache (e.g., memcached).

## Data Consistency Issues

### ISSUE-1: Daily Snapshot vs All-Time Backfill Use Different Sources
**Status: FIXED** — Every metric now uses its dedicated collection:

| Metric | Source (both daily snapshot & backfill) | Query Pattern |
|--------|----------------------------------------|---------------|
| Searches | `activity_logs` (`action_type: search_performed`) | `count_documents` with timestamp range |
| Profile Views | `profile_views` collection | `$addFields` + `$switch` picking `lastViewedAt` → `firstViewedAt` → `createdAt`, then `$count` (daily); `$sum` of `viewCount` (all-time) |
| Favorites | `favorites` collection | `count_documents` with `createdAt` range |
| Shortlists | `shortlists` collection | `count_documents` with `createdAt` range |
| Messages | `messages` collection | `count_documents` with `createdAt` range |

- `daily_platform_stats_snapshot.py`: profile_views uses `$switch` + `$ifNull` aggregation on `profile_views` collection to pick the best date field without double-counting.
- `backfill_platform_stats.py`: profile_views uses `$sum: "$viewCount"` aggregation on `profile_views` for total cumulative views.

### ISSUE-2: Monthly Aggregation Deletes Source Daily Snapshots
**File:** `monthly_platform_stats_aggregation.py:122-124`  
**Status: FIXED** — Changed `delete_many` to `update_many` with `$set: {aggregated: True}` in `monthly_platform_stats_aggregation.py:118-120`. Daily snapshots are now soft-marked as aggregated instead of being permanently removed. This allows re-runs to succeed and preserves the daily granularity for future drill-down queries. Also updated the job description to reflect the new non-destructive behavior.

### ISSUE-3: No Database Indexes for Snapshot Queries
**Status: FIXED** — Added `background=True` indexes at startup (`main.py`) and standalone script (`ensure_performance_indexes.py`):

| Collection | Index | Type |
|-----------|-------|------|
| `platform_stats_daily` | `date` | Unique |
| `platform_stats_monthly` | `year, month` | Unique |
| `platform_stats_yearly` | `year` | Unique |
| `activity_logs` | `timestamp, action_type` + `action_type, timestamp` | Compound |
| `profile_views` | `lastViewedAt`, `firstViewedAt`, `createdAt` | Single |
| `messages` | `createdAt` | Single |

### ISSUE-4: "Active Members" Defined Differently in Every Context
- **Daily snapshot:** logged in today
- **Yearly aggregation:** logged in that year
- **All-time backfill:** has EVER logged in
- **API:** logged in during period AND `accountStatus=active`

This metric is semantically inconsistent across views.  
**Fix:** Define one meaning (e.g., "users with at least one login in the period") and compute uniformly.

## Frontend Issues (PlatformActivityBar)

### ISSUE-5: Auth Check Uses localStorage Instead of Auth Context
**Status: FIXED** — Created `useAuth` hook (`hooks/useAuth.js`) and applied to `PlatformActivityBar.js`.

**Old pattern (55+ files still using):**
```javascript
const isLoggedIn = !!localStorage.getItem('token'); // One-shot read on mount
```

**New pattern (reactive):**
```javascript
const { isLoggedIn, username, userRole } = useAuth();
```

**How it works:**
| Event | Source | Action |
|-------|--------|--------|
| `loginStatusChanged` | `Login.js` on login, `sessionManager.js` on logout | Same-tab reactivity — bar appears/disappears immediately |
| `storage` (key=`token`) | `localStorage.removeItem('token')` in other tabs | Cross-tab reactivity — bar disappears when logged out elsewhere |
| Initial state | `localStorage.getItem('token')` on mount | Correct starting value |

**Also fixed:** `sessionManager.logout()` now dispatches `loginStatusChanged` before redirect, so same-tab listeners catch the logout before the page reloads.

### ISSUE-6: Polling Continues in Background Tabs
**Status: FIXED** — Both the 5-minute polling interval and the 30-second tick interval now listen for `visibilitychange`. When `document.visibilityState === 'hidden'`, intervals are cleared. When visible again, a fresh fetch fires immediately followed by a resumed interval. Eliminates background tab waste.

### ISSUE-7: Extremely Distracting Contribution Banner Animations
**Status: FIXED** — Removed all four infinite CSS animations from the contribution banner:
- `contribution-shimmer` (background-position loop)
- `contribution-jump` (translateY bounce)
- `contribution-text-glow` (text-shadow pulse)
- `contribution-btn-colors` (background gradient color cycle)

Replaced with two **finite attention pulses** (`animation-iteration-count: 3`, ~6s total):
- `attention-pulse` on banner: subtle box-shadow + border-color glow
- `btn-glow` on button: soft white shadow pulse

Both respect `prefers-reduced-motion: reduce`. Static styling and hover transforms are retained. No WCAG 2.2.2 violations remain.

### ISSUE-8: Hardcoded Sidebar Width in CSS
**File:** `PlatformActivityBar.css:5-6`, `:16-18`  
```css
left: 48px;
.sidebar-pinned .pab-bar { left: 280px; }
```
Will break if sidebar widths change in the main layout.  
**Fix:** Use CSS variables (e.g., `--sidebar-collapsed-width`, `--sidebar-expanded-width`).

### ISSUE-9: Missing Accessibility for Live Region Updates
Stats update every 5 minutes but no `aria-live` region or `role="status"` is present. Screen reader users won't know values changed.

### ISSUE-10: Time-Ago Label Does Not Scale
**File:** `PlatformActivityBar.js:80-85`  
Shows "60m ago", "120m ago", "1440m ago" instead of "1h ago", "2h ago", "1d ago".  
**Fix:** Use a proper time-ago formatter.

## Performance & Scalability

### ISSUE-10: No Rate Limiting on /api/platform-stats
**Status: FIXED** — Added `slowapi` rate limiting to the `/api/platform-stats` endpoint:
- **Tier:** `stats` = `60/minute` per user (or per IP if unauthenticated)
- **Key function:** Uses JWT username (`user:{username}`) when authenticated, falls back to IP address
- **Why:** Frontend polls every 5 minutes; 60/minute gives 10× headroom while protecting against cache-busting spam
- **Files:** `platform_stats.py:286-287`, `middleware/rate_limiter.py:128`

### ISSUE-11: Cache TTL Drift
Backend cache TTL = 300s. Frontend polling interval = 300s. If frontend fires slightly before cache expires, every Nth request hits a cold cache.  
**Fix:** Set frontend interval to 240s (4 min) or backend TTL to 360s (6 min).

### ISSUE-12: Daily Snapshot Counts activity_logs Directly
The `activity_logs` collection is the largest in the system. `count_documents` with a timestamp range will degrade linearly as logs grow.  
**Fix:** Maintain running counters in Redis or use `$inc` on a counter document instead of counting logs retrospectively.

### ISSUE-13: Backfill Loads All Docs Into Memory
**Status: FIXED** — Replaced `find().to_list(length=None)` with MongoDB aggregation pipelines (`$match` + `$group` + `$sum`) in both `backfill_platform_stats.py` and `monthly_platform_stats_aggregation.py`:

| Function | File | Before | After |
|----------|------|--------|-------|
| `backfill_monthly_snapshots` | `backfill_platform_stats.py` | `find().to_list(length=None)` + Python loop summing | `$match` + `$group` pipeline with `$sum` |
| `backfill_yearly_snapshots` | `backfill_platform_stats.py` | `find().to_list(length=None)` + Python loop summing | `$match` + `$group` pipeline with `$sum` |
| `execute` | `monthly_platform_stats_aggregation.py` | `find().to_list(length=None)` + Python loop summing | `$match` + `$group` pipeline with `$sum` |

This avoids O(N) memory growth where N = number of daily/monthly snapshots. The aggregation runs entirely in MongoDB's query engine and returns a single summary document.

## Security & Operations

### ISSUE-14: No Rate Limiting on Stats Endpoint
Authenticated users can hit `/api/platform-stats` without limits. Combined with per-tab polling, this is easily abused.  
**Fix:** Add a simple rate limit (e.g., 60 req/min per user).

### ISSUE-15: Migration Does Not Verify Template Registration
`migrate_platform_stats_jobs.py` inserts dynamic jobs but never checks that the referenced job templates are registered. If a template is missing, the job fails at runtime with a cryptic error.  
**Fix:** Add a validation step that queries the job registry before inserting.

## Recommendations Summary (Prioritized)

### P0 — Critical
1. Fix profile_views `$or` double-counting (BUG-1)
2. Fix yearly/all-time data path conflict (BUG-2)
3. Add idempotency guard to all_time increment (BUG-4)
4. Align inception date with actual launch (BUG-3)

### P1 — High
5. Unify source of truth for metrics (ISSUE-1)
6. Pause polling in background tabs (ISSUE-6)
7. Remove distracting infinite CSS animations (ISSUE-7)
8. Add database indexes for snapshot collections (ISSUE-3)
9. Fix auth check to use reactive context (ISSUE-5)
10. Cache TTL safety margin (ISSUE-11)

### P2 — Medium
11. Standardize "Active Members" definition (ISSUE-4)
12. Make monthly aggregation non-destructive (ISSUE-2)
13. Fix time-ago formatter (ISSUE-10)
14. Add rate limiting to stats endpoint (ISSUE-14)
15. Replace per-process cache with Redis-only (BUG-5)

### P3 — Low
16. Use CSS variables for sidebar widths (ISSUE-8)
17. Add ARIA live regions for stat updates (ISSUE-9)
18. Add loading skeleton instead of em-dashes (ISSUE-10 related)
19. Validate job template registration in migration (ISSUE-15)
20. Optimize backfill to use aggregation pipeline (ISSUE-13)

---
*Audit covers: `PlatformActivityBar.js/css`, `platform_stats.py`, 5 job templates, 2 migration scripts, and their data dependencies (`activity_logs`, `profile_views`, `favorites`, `shortlists`, `messages`, `users`).*
