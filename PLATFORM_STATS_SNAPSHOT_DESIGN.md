# Platform Stats Snapshot System Design

**Date:** April 24, 2026
**Purpose:** Enable purging of activity_logs while preserving historical platform statistics

## Overview

The platform stats snapshot system aggregates daily statistics from `activity_logs` into tiered collections, allowing safe purging of raw activity log data while maintaining historical analytics capabilities.

## Architecture

### Collections

#### 1. platform_stats_daily
Stores daily snapshots for the last 90 days only.

**Document Structure:**
```json
{
  "_id": "2025-04-24",
  "date": "2025-04-24",
  "searches": 1000,
  "profileViews": 2000,
  "favorited": 2000,
  "shortlisted": 2000,
  "messagesSent": 2000,
  "activeMembers": 200,
  "createdAt": ISODate("2025-04-24T00:00:00Z"),
  "updatedAt": ISODate("2025-04-24T23:59:59Z")
}
```

**Retention:** 90 days
**Index:** `_id` (date string)

#### 2. platform_stats_monthly
Stores monthly aggregates for current year (older than 90 days).

**Document Structure:**
```json
{
  "_id": "2025-03",
  "year": "2025",
  "month": "03",
  "searches": 30000,
  "profileViews": 60000,
  "favorited": 60000,
  "shortlisted": 60000,
  "messagesSent": 60000,
  "activeMembers": 6000,
  "createdAt": ISODate("2025-04-01T00:00:00Z"),
  "updatedAt": ISODate("2025-04-01T00:00:00Z")
}
```

**Retention:** Current year only (older months)
**Index:** `_id` (YYYY-MM string)

#### 3. platform_stats_yearly
Stores yearly aggregates for all historical years.

**Document Structure:**
```json
{
  "_id": "2024",
  "year": "2024",
  "searches": 365000,
  "profileViews": 730000,
  "favorited": 730000,
  "shortlisted": 730000,
  "messagesSent": 730000,
  "activeMembers": 73000,
  "createdAt": ISODate("2025-01-01T00:00:00Z"),
  "updatedAt": ISODate("2025-01-01T00:00:00Z")
}
```

**Retention:** All years (permanent)
**Index:** `_id` (YYYY string)

#### 4. platform_stats_all_time
Single cumulative document since platform start.

**Document Structure:**
```json
{
  "_id": "all_time",
  "searches": 1000000,
  "profileViews": 2000000,
  "favorited": 500000,
  "shortlisted": 300000,
  "messagesSent": 800000,
  "activeMembers": 5000,
  "createdAt": ISODate("2025-01-01T00:00:00Z"),
  "updatedAt": ISODate("2025-04-24T00:00:00Z")
}
```

**Retention:** Permanent (single doc)
**Index:** `_id` (string "all_time")

## Query Logic by Scope

### This Week (current ISO week)
1. Get date range: [Monday 00:00 UTC, Sunday 23:59 UTC]
2. For each date in range:
   - If date in last 90 days: query `platform_stats_daily`
   - If date older: query `platform_stats_monthly` or `platform_stats_yearly`
3. Aggregate and sum all matching stats

### This Month (current calendar month)
1. Get date range: [1st of month 00:00 UTC, last day 23:59 UTC]
2. For dates in last 90 days: aggregate from `platform_stats_daily`
3. For dates older than 90 days (same month): use monthly doc
4. Sum all stats

### This Year (current calendar year)
1. For months in last 90 days: aggregate from `platform_stats_daily`
2. For older months in current year: aggregate from `platform_stats_monthly`
3. Sum all stats

### All Time
1. Query single `platform_stats_all_time` document
2. Return stats directly

## Scheduler Jobs

### Job 1: Daily Snapshot Creation
**Template:** `daily_platform_stats_snapshot.py`
**Schedule:** Daily at 00:05 UTC (5 minutes after midnight)
**Purpose:** Create/update daily snapshot for previous day

**Logic:**
1. Calculate previous day's date
2. Query `activity_logs` for that date's activity
3. Compute stats (searches, profile views, favorites, shortlists, messages, active members)
4. Upsert to `platform_stats_daily`
5. Update `platform_stats_all_time` with delta

### Job 2: Monthly Aggregation
**Template:** `monthly_platform_stats_aggregation.py`
**Schedule:** 1st of each month at 01:00 UTC
**Purpose:** Aggregate previous month's daily docs into monthly snapshot, purge daily docs

**Logic:**
1. Get previous month (YYYY-MM)
2. Aggregate all daily docs for that month
3. Upsert to `platform_stats_monthly`
4. Delete daily docs for that month (now older than 90 days)
5. Update `platform_stats_all_time` if needed

### Job 3: Yearly Aggregation
**Template:** `yearly_platform_stats_aggregation.py`
**Schedule:** January 1st at 02:00 UTC
**Purpose:** Aggregate previous year's monthly docs into yearly snapshot, purge monthly docs

**Logic:**
1. Get previous year (YYYY)
2. Aggregate all monthly docs for that year
3. Upsert to `platform_stats_yearly`
4. Delete monthly docs for that year
5. Update `platform_stats_all_time` if needed

### Job 4: Daily Purge (Old Daily Snapshots)
**Template:** `daily_platform_stats_purge.py`
**Schedule:** Daily at 03:00 UTC
**Purpose:** Delete daily snapshots older than 90 days

**Logic:**
1. Calculate cutoff date (90 days ago)
2. Delete all docs from `platform_stats_daily` with date < cutoff
3. Log number of docs deleted

### Job 5: Monthly Purge (Old Monthly Snapshots)
**Template:** `monthly_platform_stats_purge.py`
**Schedule:** 1st of each month at 04:00 UTC
**Purpose:** Delete monthly snapshots for years older than current year

**Logic:**
1. Get current year
2. Delete all docs from `platform_stats_monthly` with year < current year
3. Log number of docs deleted

## Storage Estimates

**Daily Collection:** ~90 docs max
- 90 days × ~200 bytes/doc = ~18 KB

**Monthly Collection:** ~11 docs max
- 11 months × ~200 bytes/doc = ~2.2 KB

**Yearly Collection:** N docs (grows slowly)
- 1 year × ~200 bytes/doc = ~200 bytes per year

**All Time Collection:** 1 doc
- ~200 bytes

**Total:** ~20 KB + 200 bytes/year

## Benefits

✅ **Storage Efficient:** Minimal storage footprint
✅ **Query Performance:** Fast lookups for all scopes
✅ **Data Retention:** Historical data preserved in aggregated form
✅ **Purge Safe:** Can safely purge `activity_logs` after snapshots
✅ **Flexible:** Can query any date range by aggregating snapshots
✅ **Scalable:** Storage grows linearly with years, not with activity volume

## Migration Strategy

### Phase 1: Backfill Historical Data
1. Create all collections
2. Run backfill script to populate:
   - Daily snapshots (last 90 days)
   - Monthly snapshots (older months in current year)
   - Yearly snapshots (previous years)
   - All-time snapshot

### Phase 2: Deploy Scheduler Jobs
1. Register job templates in registry
2. Create dynamic jobs in database
3. Enable jobs

### Phase 3: Update Query Logic
1. Modify `platform_stats.py` router
2. Query snapshot collections instead of `activity_logs`
3. Test all scopes (weekly, monthly, yearly, all time)

### Phase 4: Purge Activity Logs
1. Verify snapshot data accuracy
2. Implement activity log purge job
3. Monitor for data consistency

## Rollback Plan

If snapshot system fails:
1. Revert `platform_stats.py` to query `activity_logs` directly
2. Disable scheduler jobs
4. Activity logs remain intact as fallback
