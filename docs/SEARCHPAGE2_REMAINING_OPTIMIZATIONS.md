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
| 9 | **Hybrid fix:** quick day-range chip clears `selectedSearch` only when `daysBack` actually diverges from the saved search's value (preserves badge + edit-saved-search workflow when user picks the same range). Strict criteria-equality model deferred to #11. | ✅ |

---

## Remaining backlog




### 🔴 #11 — File size: 3,176 lines

**Easy extraction targets** (highest priority):

| Extract | To | Approx LOC freed |
|---|---|---|
| `buildDefaultCriteria`, `normalizeDaysBackValue` | `utils/searchDefaults.js` | ~110 |
| Bootstrap effect (`loadAndExecuteDefaultSearch`) | `useInitialSearchBootstrap` hook | ~120 |
| Saved-search CRUD (`handleSaveSearch`, `handleUpdateSavedSearch`, `handleDeleteSavedSearch`, `handleSetDefaultSearch`, `handleLoadSavedSearch`) | `useSavedSearches` hook | ~250 |
| Saved-searches list panel JSX | `SavedSearchesPanel.jsx` | ~200 |
| Inline schedule editor (the one at `SearchPage2.js:2043-2058`) | `InlineScheduleEditor.jsx` | ~80 |
| `generateSearchDescription` helper | `utils/searchDescription.js` | ~70 |

**Estimated final size of `SearchPage2.js`:** ~2,300 lines. Not pretty, but a meaningful reduction.

**Effort:** 1-2 days for full pass. **Risk:** medium — needs testing on every search code path.

---

### 🟡 Bonus — `setUsers([])` redundancy in bootstrap effect

**Where:** `frontend/src/components/SearchPage2.js:929`.

**Issue:** Calls `setUsers([])` immediately, but `handleSearchHook(1, ...)` → `resetSearchState()` already does the same on page 1.

**Fix:** Drop the explicit `setUsers([])` call. **Caveat:** keep it if there's a measurable user-perception benefit (faster perceived clear).

**Effort:** 2 minutes. **Risk:** verify the saved-state-restoration flow at `SearchPage2.js:618-680` (which intentionally avoids restoring users) still works.

---

### 🟡 Bonus — Misleading comment about `hasAutoExecutedRef` and StrictMode

**Where:** `frontend/src/components/SearchPage2.js:892-894` (comment text — actual code already partially removed).

**Issue:** Comment claims setting the ref before `await` prevents StrictMode double-fire, which is incorrect (refs reset between StrictMode component instances). The actual protection is now `searchBootstrapState` (module-level) and `AbortController` inside `handleSearch`.

**Fix:** Replace comment with an accurate explanation referencing `searchBootstrapState`.

**Effort:** 2 minutes. **Risk:** none.

---

## Recommended next sprint order

1. ~~**#4** + **#10** + bonus comment fix~~ ✅
2. ~~**#6** — delete dead `useSearchFilters.js`~~ ✅
3. ~~**#7** — fix the `loadOccupationOptions` / `loadLocationOptions` effect closures~~ ✅
4. ~~**#8** — defensive ref-latest for the TopBar listener~~ ✅
5. ~~**#9** — Hybrid fix shipped~~ ✅
6. **#11** — schedule for a dedicated refactor sprint.

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
