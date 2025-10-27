# Removable Files Inventory (GPT-5 Codex Audit)

> **Important:** Review each entry before deletion. Some scripts may still be useful for local debugging or historical reference. Always back up (`tar -czf profiledata_backup_$(date +%Y%m%d_%H%M%S).tar.gz ...`) before running the commands below.

---
## 1. Generated Logs & Coverage Artifacts
```bash
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/backend_deploy.log
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/mongodb.log
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/backend.log
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/server.log
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/frontend/cloudbuild.log
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/frontend/deploy.log
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/.coverage
```

## 2. Backup / Placeholder Files
```bash
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/frontend/src/config/apiConfig.js.bak
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/image_validator.py.toberemoved
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/migrations/consolidate_workplace_fields.py.toberemoved
```

## 3. Standalone Test & Debug Scripts (covered by `/tests` now)
```bash
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/main_minimal.py
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/manual_test_log.py
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/test_activity_logger.py
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/test_email.py
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/test_event_dispatch.py
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/test_query.py
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/frontend/test_simple.js
```

## 4. Legacy Debug / Helper Utilities
```bash
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/debug_notification_flow.py
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/check_logs_api.py
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/check_job_enabled_field.py
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/check_notification_queue.py
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/test_smtp.py
```

## 5. One-Time Migration & Seeding Scripts (verify already applied)
```bash
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/migrate_notification_preferences.py
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/fix_notification_job_schedules.py
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/seed_digest_template.py
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/seed_email_templates.py
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/scripts/migrate_dob_to_dateofbirth.py
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/scripts/migrate_add_meta_fields.py
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/scripts/migrate_to_relative_preferences.py
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/scripts/add_message_stats_job.py
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/scripts/fix_message_counts.py
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/scripts/reset_message_counts.py
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/seed_cloud_mongodb.py
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/setup_email_templates.py
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/setup_notification_jobs.py
```

## 6. Export / Artifact Directories
```bash
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/exports/profiledata.csv
rm -rf /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/test_results/
rm -rf /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/test_schedules/
rm -rf /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/htmlcov/
```

## 7. Obsolete Frontend Helper Scripts
```bash
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/frontend/fix_all_localhost.py
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/frontend/fix_localhost_urls.sh
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/frontend/scripts/deploy-to-gcloud.sh
```

## 8. Redundant Environment Templates (keep primary `.env.example`)
```bash
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/frontend/.env.dev
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/frontend/.env.dev.example
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/frontend/.env.docker.example
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/frontend/.env.local.example
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/frontend/.env.pod.example
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/frontend/.env.stage.example
```

## 9. macOS & Python Cache Artifacts
```bash
find /Users/rajsiripuram02/opt/appsrc/profiledata -name ".DS_Store" -delete
find /Users/rajsiripuram02/opt/appsrc/profiledata -type d -name "__pycache__" -not -path "*/venv/*" -exec rm -rf {} + 2>/dev/null
find /Users/rajsiripuram02/opt/appsrc/profiledata -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null
```

## 10. Optional Root-Level Utilities (retain if still used)
```bash
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/cleanup_dead_code.sh
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/complete_frontend_fix.sh
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/fix_deployed_backend.sh
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/fix_image_urls.sh
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/setup_gcs.sh
```
> **Note:** These root scripts were superceded by the new comprehensive Cloud Run deployment scripts. Keep them if you still rely on them for manual maintenance.

---
## Bulk Removal Helper (Opt-In)
```bash
# Backup first
tar -czf /Users/rajsiripuram02/opt/appsrc/profiledata_backup_$(date +%Y%m%d_%H%M%S).tar.gz /Users/rajsiripuram02/opt/appsrc/profiledata

# Then execute removal list carefully
cat /Users/rajsiripuram02/opt/appsrc/profiledata/files_can_be_removed_gpt5codex.md | grep "^rm -" | bash
```

---
### Keep These!
- `/tests`, `/migrations`, `/docs`, `/job_templates`, `/services`
- Active deployment scripts (`deploy_backend_full.sh`, `deploy_frontend_full.sh`, etc.)
- Config files (`config.py`, `.env`, `apiConfig.js`, etc.)
- Any scripts you still run in daily workflows

> _Prepared for the GPT-5 Codex dead-code cleanup audit — Oct 25 2025._
