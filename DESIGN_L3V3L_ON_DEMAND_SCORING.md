# L3V3L Scores — On-Demand Optimization Design

**Status:** Planned (not yet implemented)  
**Created:** March 9, 2026  
**Priority:** Medium — implement when time allows  

---

## Problem

The batch L3V3L score calculator pre-computes compatibility scores for ALL user pairs:
- **44,017 docs** in `l3v3l_scores` collection (18.76 MB, 28.3% of DB)
- 420 active users → 87,990 possible pairs → 44K calculated (50% coverage)
- **Most scores are never viewed** — wasted computation and storage
- Scores for inactive/paused/deleted users stay in DB indefinitely
- Batch job runs periodically, recalculating everything even if profiles haven't changed

## Solution: Two-Tier On-Demand Scoring

### Tier 1: Quick Score (no DB, computed on-the-fly)

Used in **search results** where we need scores for many profiles at once.

Lightweight calculation from profile fields already loaded:
- Gender match (opposite = 100%)
- Age within partner preference range
- Location proximity (same state)
- Education level match
- Diet/lifestyle compatibility

**No DB reads or writes.** Computed in Python from profile data already in memory.

### Tier 2: Deep Score (on-demand, cached in DB with 30-day TTL)

Used on **profile pages** when user wants detailed compatibility breakdown.

Flow:
1. User opens a profile
2. Backend checks `l3v3l_scores` for cached score for this pair
3. **If cached score exists** → return it immediately (no recalculation)
4. **If no cached score** → show Tier 1 quick score + "🔄 Calculate Deep Match" button
5. User clicks Refresh → full L3V3LMatchingEngine calculation → save to DB → show real breakdown
6. **Next visit to same profile** → reads cached score from DB instantly
7. **After 30 days** → TTL index auto-expires the cached score

### Why On-Demand Is Better

| Metric | Current (Batch) | Proposed (On-Demand) |
|---|---|---|
| Storage | 44K docs / 18.76 MB | ~500-1000 docs / ~200 KB |
| Calculations | 44K per batch run | ~500/day (only viewed profiles) |
| Freshness | Stale (calculated once) | Fresh on-demand + 30-day cache |
| Inactive users | Scores kept forever | Auto-expire, never recalculated |
| CPU cost | High (batch job) | Low (per-request) |

## Implementation Plan

### Backend Changes

1. **New endpoint:** `GET /api/l3v3l-score/{viewer}/{target}`
   - Check DB cache first → return if exists
   - If not cached, return `{ cached: false, quickScore: <tier1> }`
   
2. **New endpoint:** `POST /api/l3v3l-score/{viewer}/{target}/refresh`
   - Run full L3V3LMatchingEngine.calculate_match_score()
   - Save result to `l3v3l_scores` with `calculatedAt`
   - Return full breakdown

3. **Quick score function:** `calculate_quick_score(user1, user2)`
   - Lightweight scoring using only basic profile fields
   - No DB queries, no ML — just field comparisons
   - Returns score + level (no detailed breakdown)

4. **TTL index:** `db.l3v3l_scores.createIndex({ calculatedAt: 1 }, { expireAfterSeconds: 2592000 })`
   - 30 days = 2,592,000 seconds
   - MongoDB auto-deletes expired docs

5. **Disable batch calculator job** — stop the L3V3LScoreCalculatorTemplate from running

### Frontend Changes

1. **Search results:** Show Tier 1 quick score badge on each card (no API call needed)

2. **Profile page:** 
   - On load: call `GET /api/l3v3l-score/{viewer}/{target}`
   - If cached → show real breakdown
   - If not cached → show quick score + "🔄 Calculate Deep Match" button
   - On button click → call `POST .../refresh` → loading spinner → show full breakdown

3. **Score badge styling:**
   - Cached deep score: solid badge with 🦋 icon
   - Quick score: outlined/lighter badge with "~" prefix (approximate)

### Migration Steps

1. Add TTL index to `l3v3l_scores.calculatedAt` (30 days)
2. Deploy backend with new endpoints + quick score function
3. Deploy frontend with Refresh button + quick score display
4. Disable L3V3L batch calculator job in Dynamic Scheduler
5. Existing 44K docs will auto-expire over 30 days via TTL

### Files to Modify

**Backend:**
- `routes.py` — new cached score + refresh endpoints
- `l3v3l_matching_engine.py` — add `calculate_quick_score()` static method
- `job_templates/l3v3l_score_calculator_template.py` — disable or deprecate

**Frontend:**
- `SearchResultCard.js` — show quick score badge
- `Profile.js` — cached score display + Refresh button
- `EmbeddedProfile.js` — same as Profile.js

### Effort Estimate

| Task | Time |
|---|---|
| Backend: quick score function | ~1 hour |
| Backend: cached + refresh endpoints | ~1 hour |
| Backend: TTL index migration | ~15 min |
| Frontend: search card quick score | ~1 hour |
| Frontend: profile page refresh button | ~1.5 hours |
| Testing & edge cases | ~30 min |
| **Total** | **~5 hours** |

---

## Key Decision: Why Not Just Delete Old Scores?

Old scores could be purged immediately, but keeping them with a TTL is safer:
- Users who already have cached scores continue to see them
- No sudden "score disappeared" experience
- Gradual transition as old scores expire naturally over 30 days
