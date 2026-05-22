# SearchPage2 — Remaining Optimization Backlog

**Source:** Deep review on May 22, 2026
**Scope:** `frontend/src/components/SearchPage2.js` (3,176 lines as of this writing)
**Status legend:** ✅ done · 🟡 ready to pick up · 🔴 larger refactor

---

## Already shipped (May 22, 2026)

| # | Item | Status |
|---|---|---|
| 1 | Removed three `setTimeout(..., 100)` wrappers around `handleSearchHook` in the bootstrap effect | ✅ |
| 2 | Removed `document.getElementById('profileId-input')` DOM-reach checks | ✅ |
| 3 | Wired real `loadSavedSearches` / `loadOccupationOptions` / `loadLocationOptions` into `useSearchActions` via late-bind ref | ✅ |
| 5 | StrictMode-safe `pendingSearchAction` handling: read+clear once via `useState` initializer + module-level `searchBootstrapState` guard | ✅ |
| — | Argument-order bug in `handleQuickDaysBackChange` (now passes `minMatchScore` correctly) | ✅ |
| — | `handleLoadSavedSearch` runs the search synchronously (no `setTimeout`) | ✅ |
| — | Fallback partner-criteria search now always runs after a default-saved-search lookup error | ✅ |
| 4 | Hoisted `buildDefaultCriteria(currentUserProfile)` to a single `profileDefaults` call per bootstrap run | ✅ |
| 10 | Removed redundant `hasAutoExecutedRef.current = true` writes inside bootstrap effect (module-level guard owns this); misleading StrictMode comment removed | ✅ |
| 6 | Deleted dead `useSearchFilters.js` (renamed to `.toberemoved`); zero consumers verified | ✅ |
| 7 | Inlined `loadOccupationOptions` / `loadLocationOptions` bodies into their mount effects; named functions kept for `filterActionsRef` | ✅ |
| 8 | Ref-latest pattern for TopBar `loadSavedSearchFromTopbar` listener; effect now has `[]` deps and never re-registers | ✅ |
| — | **Bug fix (prod toast storm):** pending-action effect now guarded by `pendingActionConsumedRef` so it consumes the saved-search action exactly once, regardless of how often `handleLoadSavedSearch` identity churns after each search | ✅ |
| 9 | **Hybrid fix:** quick day-range chip clears `selectedSearch` only when `daysBack` actually diverges from the saved search's value (preserves badge + edit-saved-search workflow when user picks the same range). | ✅ |
| 11 | **File split:** extracted pure utilities (`utils/searchDefaults.js`, `utils/searchDescription.js`), presentational components (`components/search/SavedSearchesPanel.jsx`, `components/search/InlineScheduleEditor.jsx`), and two hooks (`hooks/useSavedSearches.js`, `hooks/useInitialSearchBootstrap.js`). `SearchPage2.js`: **3,176 → 2,641 lines** (-535, -16.8%). | ✅ |

---

## Remaining backlog

### 🟡 Bonus — `setUsers([])` redundancy in bootstrap effect

**Where:** `frontend/src/hooks/useInitialSearchBootstrap.js` (formerly `SearchPage2.js:929`).

**Issue:** Calls `setUsers([])` immediately, but `handleSearchHook(1, ...)` → `resetSearchState()` already does the same on page 1.

**Fix:** Drop the explicit `setUsers([])` call. **Caveat:** keep it if there's a measurable user-perception benefit (faster perceived clear).

**Effort:** 2 minutes. **Risk:** verify the saved-state-restoration flow at `SearchPage2.js:618-680` (which intentionally avoids restoring users) still works.

---

### 🟡 Bonus — Misleading comment about `hasAutoExecutedRef` and StrictMode

**Where:** `frontend/src/hooks/useInitialSearchBootstrap.js` (formerly `SearchPage2.js:892-894`).

**Issue (resolved during #11):** Comment originally claimed setting the ref before `await` prevents StrictMode double-fire, which was incorrect. The bootstrap hook now carries an accurate explanation referencing the module-level `searchBootstrapState` guard.

**Status:** Resolved as part of #11. ✅

---

### 🟢 Future — Dead-code cleanup

- `frontend/src/components/SearchFiltersModal.js` is not imported anywhere. The matching CSS is still imported by `SearchPage2.js`. Schedule for removal after confirming with the broader team.
- `frontend/src/components/SearchPage2.js: handleEditSchedule` (~3 lines) — defined but never called. Safe to delete in a future pass.

---

## Recommended next sprint order

1. ~~**#4** + **#10** + bonus comment fix~~ ✅
2. ~~**#6** — delete dead `useSearchFilters.js`~~ ✅
3. ~~**#7** — fix the `loadOccupationOptions` / `loadLocationOptions` effect closures~~ ✅
4. ~~**#8** — defensive ref-latest for the TopBar listener~~ ✅
5. ~~**#9** — Hybrid fix shipped~~ ✅
6. ~~**#11** — File split shipped~~ ✅

**All backlog items closed.** Remaining bonus items are low-priority cleanups.

---

## Validation checklist (run after any change above)

- [ ] Cold load `/search` (no `pendingSearchAction`, no default saved search) → partner-criteria search runs once.
- [ ] Cold load `/search` (no `pendingSearchAction`, default saved search exists) → default search runs once with toast.
- [ ] Click "Saved Searches" in TopBar → saved search loads once, no flash of default results.
- [ ] Click "Modify" / "Refresh" in active filters strip → re-runs current search.
- [ ] Save a new search → list refreshes immediately (this validates #3 wiring).
- [ ] Delete current selectedSearch → `selectedSearch` becomes null.
- [ ] Quick day-range chip → re-runs search with same `minMatchScore`.
- [ ] Sign out + sign back in (same user) → bootstrap re-runs.
- [ ] Sign out + sign in as different user → bootstrap re-runs with correct gender.
- [ ] React 18 StrictMode dev: no double toasts, no double network calls (AbortController dedupes if any).
