# DashboardV2 Deep Review — Width, Layout & Loading Performance

**Date:** 2026-09-20 (updated)
**Scope:** `https://l3v3lmatches.com/dashboardv2` — layout correctness + frontend/backend loading path
**Trigger:** User report: "dv2-container width and inside component width doesn't make sense"

---

## Part 1 — Width & Layout Review

### 1.1 The width chain today

On desktop, content passes through **three nested width constraints** before reaching a section:

```
.app-layout        width = viewport − 48px (icon strip)
                   or viewport − 280px (pinned sidebar)
  .main-content
    .container       max-width: 98%           (App.css:62 — already sets this)
                     → DashboardV2.css:33 re-sets 98% !important
                       + padding 8px → 4px    (redundant override)
      .dv2-container   max-width: 1280px      (second cap inside the 98% cap)
                       padding: 16px 12px
        .dv2-hero      padding: 24px + border (a card wrapping a card)
          .dv2-hero-card  padding: 24px
                          grid: 160px | minmax(0,1fr) | 240px
```

### 1.2 Confirmed width issues

| # | Issue | Evidence | Impact |
|---|---|---|---|
| W1 | **Redundant `:has()` override** | `DashboardV2.css:33-37` sets `.container:has(.dv2-container) { max-width: 98% !important }`, but `App.css:62-70` already sets `.main-content .container { max-width: 98% }`. Only real effect: padding 8px→4px. | Confusing cascade; `!important` blocks future overrides; `:has()` is a relatively expensive selector evaluated on every DOM mutation |
| W2 | **Double width caps** | `.container` (98%) then `.dv2-container` (1280px). At ~1350px viewport the container is ~1315px but dv2 caps at 1280 → ~35px unexplained gutter inside a nearly-full-width parent. | Reads as "two widths that don't agree" in devtools — the reported symptom |
| W3 | **Nine inconsistent breakpoints** | hero: 980/640px · main-grid: 1080px · attention: 900/560px · stats: 1180/980/900/360px · dv2-container padding: 768/560px · App.css container: 576px | Different sections reflow at different widths — layout feels unstable while resizing |
| W4 | **981–1080px dead zone** | `.dv2-hero-card` is already 2-col at ≤980px, but `.dv2-main-grid` keeps a fixed 320px rail until 1080px → main column squeezed to ~600px while hero above has already collapsed | Mismatched section widths in the same viewport |
| W5 | **Mobile padding compounding** | 375px phone: `.container` 4–10px + `.dv2-container` 8px + `.dv2-hero` 16px + `.dv2-hero-card` 16px ≈ **90–100px of horizontal padding** before content starts (~26% of viewport) | Cramped hero on mobile — the reported mobile-width problem |
| W6 | **Duplicate stamp-strip DOM** | `HeroNewestMatch.jsx` renders the entire peer list twice: desktop `.dv2-hero-footer-row` AND `.dv2-hero-footer-row-mobile-stamp`. 10 peers → 20 `<img>` nodes always in the DOM | Double React reconciliation per render; hidden copy still parsed; two sources of truth for the same strip |
| W7 | **Inline style on hero photo** | `style={{ cursor: 'pointer' }}` at `HeroNewestMatch.jsx:337` | Violates no-inline-styles rule; should live in `HeroNewestMatch.css` |
| W8 | **Nested bordered cards** | `.dv2-hero` (border + radius + 24px padding) wraps `.dv2-hero-card` (border + radius + 24px padding) | 48px of decorative padding on desktop, 32px on mobile — pure width tax with no information value |

### 1.3 Recommended width fixes (Phase 1 — CSS only, low risk)

1. Delete `.container:has(.dv2-container)` — `App.css` already owns `.container` width.
2. Remove the `.dv2-hero` card chrome (border/padding/radius) — `.dv2-hero-card` inside is already the visual card. Keep `.dv2-hero` as a plain section for the title + footer meta.
3. Consolidate breakpoints to two: **1080px** (collapse rail + hero to stacked) and **640px** (mobile single-column). Align attention grid and stats strip to the same two.
4. Render the stamp strip once; restyle placement per breakpoint instead of duplicating the DOM (wrap in a container whose order/grid-row changes on mobile).
5. Move `cursor: pointer` into `.dv2-hero-photo` CSS.
6. On mobile, reduce `.dv2-hero` / `.dv2-hero-card` padding to a single 12–16px layer total (currently 32px stacked).

---

## Part 2 — Loading & Performance Review

### 2.1 How the page loads today

```
DashboardV2Page
├── App.js (on every route change)
│   └── GET /api/users/profile/{username}          ← DUPLICATE (see P2)
│
├── useDashboardData            hooks/useDashboardData.js
│   ├── Stage 1 (critical):  GET /profile/{username}  +  GET /{u}/saved-searches
│   └── Stage 2 (parallel):  9 calls
│        profileViews, favorites, shortlist, exclusions, notes,
│        conversations, theirFavorites, theirShortlist, incomingPiiRequests
│   └── +1200ms: GET /api/polls/active
│
├── useNewestMatch              hooks/useNewestMatch.js
│   └── findFirstPickParallel → ONE /api/search PER saved search (parallel)
│
├── DashboardBanners            (deferred 800ms)
│   └── 4 calls: /auth/mfa/status, /user-invitations/stats,
│        /account/pause-status, /exclusions/reconnect-requests/pending
│
├── fetchBreakdown (effect on hero pick)
│   └── POST /{u}/search-criteria-breakdown        ← repeats hero's aggregation
│
└── RecentConversations
    └── GET /messages/unattended + 60s poll interval
```

**Total on a cold dashboard load (user with N saved searches):**
`2 + 9 + N + 4 + 1 + 1` = **17 + N requests** before the page is fully settled.

### 2.2 Findings by priority

#### 🔴 P1 — N parallel search aggregations per page load

**File:** `frontend/src/dashboardv2/hooks/useNewestMatch.js` (`findFirstPickParallel`)

Every saved search triggers a full `/api/search` aggregation **in parallel** on page load. Each call runs regex filters (`$regex`/`$options:"i"` — cannot use B-tree indexes → collection scan), a `$lookup` into `l3v3l_scores`, a `$facet` totalCount, and photo-priority sort. A user with 5 saved searches fires 5 simultaneously.

**Fix:** Sequential default-first walk — try the default saved search, stop at first hit. Trades a small latency increase in the rare "default is empty" case for eliminating N−1 aggregations on every load. The existing `findNextPick` already implements this order; `findFirstPickParallel` can be removed.

#### 🔴 P2 — Duplicate profile fetch

**Files:** `frontend/src/App.js:296`, `frontend/src/dashboardv2/hooks/useDashboardData.js`

`AppContent` calls `getUserProfile(username)` on **every** `location.pathname` change. `useDashboardData` Stage 1 then calls `fetchCurrentUserProfile()` — the identical endpoint. Every navigation to `/dashboardv2` issues 2 identical profile requests.

**Fix:** Lift `currentUser` into a small context/provider (or pass via route state), and have `useDashboardData` accept it as an optional seed. Alternative quick win: a short-TTL in-flight/response cache keyed on username in `api.js` dedupes the double call.

#### 🟠 P3 — No route-level code splitting (618 KB gzipped main)

**File:** `frontend/src/App.js`

~70 components statically imported — admin pages, payment modals, scheduler, both dashboards. Production build: `main.js` ≈ 619 kB gzipped, `main.css` ≈ 238 kB.

**Fix:** `React.lazy` + `Suspense` for route-level components — biggest wins first: `AdminPage`/admin suite, `Dashboard` (legacy), `PricingPage`, `Register3`, `SearchPage2`, `Messages`. `utils/bundleOptimizer.js` already has an unused `lazyLoadComponent` helper.

#### 🟠 P4 — Heavy eager imports inside the dashboard chunk

**File:** `frontend/src/dashboardv2/DashboardV2Page.jsx`

Even with route splitting, the dashboard chunk eagerly bundles:

| Import | Size / cost | Needed at first paint? |
|---|---|---|
| `PollWidget` | 652 lines → `PollPaymentInline` → PayPal + Clover SDK loaders | No — auto-popup modal |
| `ProfileNotes` | 367 lines | No — modal |
| `ProfileViewsModal` / `FavoritedByModal` / `ShortlistedByModal` | ~530 lines combined | No — modals |
| `ChatWindow` (via `RecentConversations`) | 929 lines → `socketService` | No — only when a conversation drawer opens |

**Fix:** `React.lazy` each modal; in `RecentConversations`, lazy-load `ChatWindow` inside the drawer so its chunk only downloads on first open.

#### 🟠 P5 — Three-stage waterfall + redundant breakdown

**Files:** `useDashboardData.js`, `DashboardV2Page.jsx:111-115`

`profile+searches → hero search → POST /search-criteria-breakdown`. The breakdown re-runs essentially the same match aggregation the hero search just executed, solely to produce location/education/profession counts for the attention cards.

**Fix:** Derive breakdown counts from the hero's own search response (or add the three counts as a cheap `$facet`-free projection on the search endpoint). Alternatively fire it in parallel with the hero search rather than waiting for the pick.

#### 🟡 P6 — `$facet` totalCount on every search

**File:** `fastapi_backend/routes.py` (search endpoint)

`totalCount` over the full matching set is computed only so the hero can decide `hasMore`.

**Fix:** Request `limit = BATCH_SIZE + 1`; `hasMore = results.length > BATCH_SIZE`. Removes the count facet from hero searches (leave it for `/search` page pagination which needs real totals).

#### 🟡 P7 — No request cancellation in `useNewestMatch`

**File:** `useNewestMatch.js`

`compute()` has no abort/stale-guard. When `savedSearches` and `userProfile` resolve at slightly different times (they're fetched in parallel in Stage 1), `compute` can run twice and a slower stale run can overwrite the newer pick.

**Fix:** A `requestIdRef`/`cancelled` flag — increment per `compute`, ignore resolution if a newer run started. Cheap insurance; no AbortController needed since we only guard state writes.

#### 🟡 P8 — Stage 2 fires 9 calls including below-the-fold data

**File:** `useDashboardData.js:249-269`

`notes`, `incomingPiiRequests`, `theirFavorites`, `theirShortlist` populate counts/modals that aren't visible at first paint.

**Fix:** Split Stage 2 — visible counts (views, favorites, shortlist, exclusions, conversations) immediately; the rest via `requestIdleCallback`/short timeout, or lazily on modal open (modals already re-fetch on open in most cases).

#### 🟡 P9 — Hero image: no dimensions, no `decoding="async"`

**File:** `HeroNewestMatch.jsx:340`

`.dv2-hero-img` is the likely LCP element but has no `width`/`height`/`aspect-ratio` (CLS) and no async decode hint. Stamp `<img>`s are `loading="lazy"` — good — but exist twice in the DOM (see W6).

**Fix:** `aspect-ratio: 4/5` (or fixed height) on `.dv2-hero-photo`, `decoding="async"` + `fetchpriority="high"` on the hero `<img>`.

#### 🟡 P10 — PollWidget mounted eagerly whenever polls exist

**File:** `DashboardV2Page.jsx:186-196`

`PollWidget` renders into `.dv2-poll-popup-host` for auto-popup even though `ActivePollsCard` in the side rail already shows the same polls. Its `stat-card-compact` is then hidden via CSS — we're paying render + state for a hidden duplicate.

**Fix:** Mount `PollWidget` lazily only when `autoPopup` should actually fire (unanswered poll + not shown this session), or drop it and let `ActivePollsCard` own poll UX on this page.

#### 🟢 P11 — Four banner requests on every load

**File:** `DashboardBanners.jsx:163-168`

MFA status, invite stats, pause status, reconnect requests — all deferred 800ms but still four round-trips per visit. Rarely change intra-session.

**Fix:** sessionStorage TTL cache (5–10 min), or a single `/api/dashboard/banners` aggregate.

#### 🟢 P12 — Regex filters on unindexed fields

**Files:** `routes.py` search filters, `ensure_performance_indexes.py`, `migrations/add_search_indexes.py`

`city`, `state`, `aboutYou`, `occupation`, `education` are matched with case-insensitive `$regex` — collection scans. `_sort*` precomputed fields already exist for sorting; apply the same pattern to filtering (normalized lowercase fields + exact match) or add text indexes.

---

## Part 3 — Summary

### Confirmed issues

| # | Sev | Issue | Fix effort |
|---|---|---|---|
| W1 | 🟠 | Redundant `.container:has(.dv2-container)` override | Trivial — delete 5 lines |
| W2 | 🟠 | Double width caps (98% → 1280px) | Low |
| W3 | 🟠 | 9 inconsistent breakpoints | Low — consolidate to 2 |
| W4 | 🟡 | 981–1080px dead zone (rail vs hero mismatch) | Low — align breakpoints |
| W5 | 🟠 | ~100px stacked mobile padding | Low — flatten hero wrappers |
| W6 | 🟡 | Stamp strip rendered twice in DOM | Medium — restructure footer |
| W7 | 🟢 | Inline cursor style | Trivial |
| W8 | 🟡 | Nested bordered hero cards | Low — remove outer chrome |
| P1 | 🔴 | N parallel search aggregations | Low — use existing `findNextPick` |
| P2 | � | Duplicate `/profile` fetch (App.js + hook) | Medium — share via context or cache |
| P3 | 🟠 | 618 KB main bundle, no route splitting | High — many lazy boundaries |
| P4 | 🟠 | Payment/modal/chat code in dashboard chunk | Low-Med — 5 lazy imports |
| P5 | 🟠 | Redundant breakdown aggregation | Medium |
| P6 | 🟡 | `$facet` count for `hasMore` | Low — limit+1 trick |
| P7 | 🟡 | No stale-request guard in `useNewestMatch` | Low |
| P8 | 🟡 | 9-call Stage 2 includes deferred-able data | Low-Med |
| P9 | 🟡 | LCP image lacks dimensions/async | Trivial |
| P10 | � | Duplicate poll UI (hidden PollWidget) | Low-Med |
| P11 | 🟢 | 4 banner round-trips | Low — TTL cache |
| P12 | 🟢 | Unindexed regex filters | High — backend/index work |

### Recommended implementation order

**Phase 1 — Width sanity (CSS only, low risk):**
1. Delete `.container:has(.dv2-container)` (W1)
2. Remove `.dv2-hero` card chrome — single card layer (W8, W5)
3. Consolidate to 2 breakpoints: 1080px + 640px (W3, W4)
4. Single stamp-strip DOM, repositioned per breakpoint (W6)
5. Inline `cursor` → CSS (W7)

**Phase 2 — Request reduction:**
6. Sequential default-first hero search (P1)
7. Dedupe profile fetch (P2)
8. `limit+1` for `hasMore` (P6); stale-request guard (P7)
9. Lazy-load modals, PollWidget, ChatWindow (P4); lazy PollWidget mount (P10)
10. Collapse/parallelize breakdown call (P5); split Stage 2 (P8)

**Phase 3 — Structural:**
11. Route-level `React.lazy` across `App.js` (P3)
12. Hero image dimensions/`fetchpriority` (P9); banner TTL cache (P11)
13. Backend normalized-filter indexes (P12)

### Verification checklist (after changes)

- [ ] `npm run build` — clean compile, compare bundle sizes
- [ ] No horizontal overflow at 375 / 640 / 768 / 980 / 1080 / 1280 / 1440 / 2560px
- [ ] Hero + rail alignment consistent at all widths; no dead zone at ~1000px
- [ ] Network panel: one `/profile` call; sequential (not parallel) `/search` calls
- [ ] Modals still open correctly after lazy-loading
- [ ] All five themes (Cozy Light, Dark, Rose, Light Gray, Ultra Light Gray)
- [ ] Lighthouse LCP/CLS before vs after
