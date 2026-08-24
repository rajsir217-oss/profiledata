---
description: Migrate hardcoded scheduler jobs to the template-based Dynamic Scheduler.
---

# Skill: Dynamic Scheduler Migration

## Overview

The system uses only DB-driven dynamic jobs. Hardcoded cron jobs should not be registered directly.

## Job template contract

Each template in `fastapi_backend/job_templates/` must implement:

```python
class MyJobTemplate:
    def validate_params(self, params):
        ...

    def get_schema(self):
        ...

    def execute(self, params):
        ...
```

## Migration steps

1. **Create or register a template**
   - Add the template class to `fastapi_backend/job_templates/`.
   - Register it in `fastapi_backend/job_templates/registry.py`.

2. **Disable hardcoded registration**
   - In `fastapi_backend/services/unified_scheduler.py` (or equivalent), remove or disable the hardcoded job registration.

3. **Migrate legacy jobs to the database**
   - Run the migration script (e.g., `migrate_legacy_jobs.py`) to insert legacy jobs into the `dynamic_jobs` collection with the correct template, schedule, timeout, and params.

4. **Scheduler execution**
   - `UnifiedScheduler` polls the `dynamic_jobs` collection every 30 seconds.
   - It claims jobs atomically via `JobRegistryService.claim_job_for_execution` before executing.
   - `JobExecutor` runs the job using the registered template.

## Configuration fields for a dynamic job

- `name`
- `template` (template class identifier)
- `schedule` / `interval_seconds` / `cron`
- `timeout`
- `params`
- `enabled`
- `next_run_at`

## Admin UI

The Dynamic Scheduler UI allows admins to:

- View jobs
- Edit schedules and parameters
- Enable/disable jobs
- Trigger manual runs
- View execution history

## Verification

- Confirm the template is registered.
- Confirm legacy jobs exist in `dynamic_jobs`.
- Confirm the scheduler picks them up and executes them.
- Confirm execution history is recorded.

## Ongoing work

When adding a new scheduled task, always add a template first and then create a `dynamic_jobs` document. Avoid hardcoding schedules in Python.
