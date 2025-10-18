# Single Scheduler Architecture

**Version:** 1.0  
**Last Updated:** October 17, 2025

---

## 🎯 Core Principle

**The application uses ONLY ONE scheduler engine: `UnifiedScheduler`**

All background jobs, scheduled tasks, and automation MUST go through the UnifiedScheduler. No separate scheduler instances should be created.

---

## 📋 Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│         Single Scheduler Engine                     │
│         (UnifiedScheduler)                          │
│                                                     │
│  ┌──────────────────────────────────────────────┐ │
│  │  Static Jobs (Hardcoded in Code)            │ │
│  │  - Database cleanup                          │ │
│  │  - Test scheduler                            │ │
│  │  - System maintenance                        │ │
│  └──────────────────────────────────────────────┘ │
│                                                     │
│  ┌──────────────────────────────────────────────┐ │
│  │  Dynamic Jobs (From Database)               │ │
│  │  - User-created jobs via UI                 │ │
│  │  - Template-based jobs                       │ │
│  │  - On-demand scheduled tasks                 │ │
│  └──────────────────────────────────────────────┘ │
│                                                     │
│  Polling: Every 30 seconds                         │
│  Execution: Async with timeout support             │
└─────────────────────────────────────────────────────┘
```

---

## 🔧 Implementation Details

### UnifiedScheduler Location
**File:** `/fastapi_backend/unified_scheduler.py`

### Global Instance
```python
# Global scheduler instance (singleton pattern)
unified_scheduler: Optional[UnifiedScheduler] = None

def get_unified_scheduler() -> Optional[UnifiedScheduler]:
    """Get the global unified scheduler instance"""
    return unified_scheduler
```

### Initialization
The scheduler is initialized once during application startup in `main.py`:

```python
async def lifespan(app: FastAPI):
    # Startup
    db = get_database()
    await initialize_unified_scheduler(db)  # Single initialization
    
    yield
    
    # Shutdown
    await shutdown_unified_scheduler()
```

---

## 📝 Registered Jobs

### Static Jobs (Registered in Code)

#### 1. Database Cleanup Job
- **Function:** `cleanup_old_records()`
- **Interval:** Every 24 hours (86400 seconds)
- **Purpose:** Clean up old database records
- **Type:** Async

#### 2. Test Scheduler Job
- **Function:** `check_and_run_scheduled_tests()`
- **Interval:** Every 1 minute (60 seconds)
- **Purpose:** Check and run scheduled test suites
- **Type:** Sync (wrapped for async execution)

### Dynamic Jobs (From Database)

Dynamic jobs are created through the admin UI at `/dynamic-scheduler` and stored in the `dynamic_jobs` MongoDB collection. The scheduler polls this collection every 30 seconds.

**Job Templates Available:**
- 🧹 Database Cleanup
- 📧 Email Notification
- 📊 Data Export
- 📈 Report Generation
- 💾 Backup Job
- 🔗 Webhook Trigger

---

## ⚠️ What NOT to Do

### ❌ DO NOT Create Separate Scheduler Instances

**Bad Example:**
```python
import schedule
import threading

# ❌ DON'T DO THIS - Creates a separate scheduler
def run_my_scheduler():
    schedule.every(1).minutes.do(my_function)
    while True:
        schedule.run_pending()
        time.sleep(30)

# ❌ DON'T DO THIS
threading.Thread(target=run_my_scheduler, daemon=True).start()
```

**Good Example:**
```python
from unified_scheduler import get_unified_scheduler

# ✅ DO THIS - Use the existing UnifiedScheduler
async def initialize_unified_scheduler(db):
    unified_scheduler = UnifiedScheduler(db)
    
    # Register your job with the unified scheduler
    unified_scheduler.add_job(
        name="my_custom_job",
        interval_seconds=60,
        func=my_function,
        is_async=True
    )
```

### ❌ DO NOT Use the `schedule` Library Directly

The `schedule` library should NOT be imported or used anywhere except in `unified_scheduler.py` (for internal use).

**Reason:** Multiple scheduler instances cause:
- Race conditions
- Duplicate job executions
- Resource waste
- Unpredictable behavior
- Difficult debugging

---

## ✅ How to Add New Jobs

### Option 1: Static Jobs (Hardcoded)

Edit `/fastapi_backend/unified_scheduler.py`:

```python
async def initialize_unified_scheduler(db: AsyncIOMotorDatabase):
    global unified_scheduler
    unified_scheduler = UnifiedScheduler(db)
    
    # Add your new job
    unified_scheduler.add_job(
        name="my_new_job",
        interval_seconds=3600,  # 1 hour
        func=my_job_function,
        is_async=True
    )
    
    # Start the scheduler
    await unified_scheduler.start()
```

### Option 2: Dynamic Jobs (Admin UI)

1. Login as admin
2. Navigate to **Admin → Dynamic Scheduler**
3. Click **"Create New Job"**
4. Select a template
5. Configure parameters and schedule
6. Save

The UnifiedScheduler will automatically pick up and execute the new job.

---

## 🔍 Monitoring

### Check Scheduler Status

**API Endpoint:**
```http
GET /api/admin/scheduler/status
```

**Response:**
```json
{
  "scheduler": {
    "status": "active",
    "template_count": 6
  },
  "jobs": {
    "total": 5,
    "enabled": 4,
    "disabled": 1
  },
  "executions": {
    "total": 150,
    "successful": 145,
    "failed": 5,
    "running": 0,
    "success_rate": "96.7%"
  }
}
```

### View Job Status Programmatically

```python
from unified_scheduler import get_unified_scheduler

scheduler = get_unified_scheduler()
if scheduler:
    status = scheduler.get_job_status()
    print(status)
```

---

## 🚨 Deprecated Functions

The following functions in `test_management.py` are **DEPRECATED** and should NOT be used:

- ❌ `run_scheduler()` - Use UnifiedScheduler instead
- ❌ `start_scheduler()` - Use UnifiedScheduler instead
- ❌ `stop_scheduler()` - Use UnifiedScheduler instead

These functions are kept for backward compatibility but do nothing. All scheduling is handled by UnifiedScheduler.

---

## 📊 Execution Flow

```
Application Startup
    ↓
Initialize UnifiedScheduler
    ↓
Register Static Jobs
    ↓
Start Scheduler Loop
    ↓
    ┌─────────────────────────┐
    │ Every 30 seconds:       │
    │                         │
    │ 1. Check static jobs    │
    │    - Should job run?    │
    │    - Execute if ready   │
    │                         │
    │ 2. Check dynamic jobs   │
    │    - Query database     │
    │    - Find ready jobs    │
    │    - Execute if enabled │
    │                         │
    │ 3. Update next run      │
    │                         │
    └─────────┬───────────────┘
              │
              ↓
        Back to loop
```

---

## 🛡️ Thread Safety

The UnifiedScheduler is designed to be thread-safe:

- **Single instance:** Only one scheduler runs at a time
- **Async execution:** Jobs run in asyncio event loop
- **No race conditions:** Sequential job checking
- **Database polling:** Safe concurrent access to MongoDB

---

## 🎓 Best Practices

### 1. Always Use the Unified Scheduler
```python
✅ scheduler = get_unified_scheduler()
❌ scheduler = schedule.Scheduler()
```

### 2. Register Jobs During Initialization
```python
✅ Register in initialize_unified_scheduler()
❌ Create jobs at import time
```

### 3. Use Async Functions When Possible
```python
✅ async def my_job(): ...
❌ def my_blocking_job(): time.sleep(60)
```

### 4. Add Proper Error Handling
```python
✅ try/except in job functions
❌ Unhandled exceptions
```

### 5. Log Job Execution
```python
✅ logger.info("Job started")
❌ Silent execution
```

---

## 🔧 Troubleshooting

### Problem: Job Not Running

**Check:**
1. Is the scheduler running? `GET /api/admin/scheduler/status`
2. Is the job enabled? Check `dynamic_jobs` collection
3. Has the next_run_at time passed?
4. Check logs for errors

### Problem: Duplicate Executions

**Cause:** Multiple scheduler instances running

**Solution:**
1. Check for `schedule.every()` calls in code
2. Search for `threading.Thread` with scheduler
3. Remove duplicate schedulers
4. Restart application

### Problem: Jobs Not Updating

**Cause:** Cached scheduler state

**Solution:**
1. Restart application
2. Check database connection
3. Verify job updates in `dynamic_jobs` collection

---

## 📚 Related Documentation

- `/docs/SCHEDULER_IMPLEMENTATION_SUMMARY.md` - Complete implementation guide
- `/docs/SCHEDULER_DYNAMIC_JOBS_ARCHITECTURE.md` - Dynamic jobs architecture
- `/fastapi_backend/unified_scheduler.py` - Source code

---

## ✅ Verification Checklist

- [ ] Only ONE `UnifiedScheduler` instance exists
- [ ] No `schedule.every()` calls outside `unified_scheduler.py`
- [ ] No separate scheduler threads created
- [ ] Test jobs integrated with UnifiedScheduler
- [ ] Dynamic jobs polling from database
- [ ] All jobs registered through UnifiedScheduler API

---

**Remember: ONE SCHEDULER TO RULE THEM ALL! 👑**

All scheduling goes through `UnifiedScheduler` - no exceptions, no separate instances, no parallel schedulers.

---

**Last Updated:** October 17, 2025  
**Maintainer:** System Architecture Team
