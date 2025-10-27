# Files That Can Be Removed from ProfileData Project

## ⚠️ WARNING: Review each file before deletion to ensure it's not actively used

## 1. Log Files (Safe to Remove)
```bash
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/backend_deploy.log
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/mongodb.log
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/backend.log
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/server.log
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/frontend/cloudbuild.log
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/frontend/deploy.log
```

## 2. Backup Files (Safe to Remove)
```bash
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/frontend/src/config/apiConfig.js.bak
```

## 3. Test Files Outside Test Suite (Safe to Remove - functionality now in /tests/)
```bash
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/main_minimal.py
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/manual_test_log.py
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/test_activity_logger.py
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/test_email.py
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/test_event_dispatch.py
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/test_query.py
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/frontend/test_simple.js
```

## 4. Debug/Development Scripts (Safe to Remove after production deployment)
```bash
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/debug_notification_flow.py
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/check_logs_api.py
```

## 5. Migration Scripts (Safe to Remove if migrations are complete)
```bash
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/migrate_notification_preferences.py
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/fix_notification_job_schedules.py
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/scripts/migrate_dob_to_dateofbirth.py
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/scripts/migrate_add_meta_fields.py
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/scripts/migrate_to_relative_preferences.py
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/scripts/add_message_stats_job.py
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/scripts/fix_message_counts.py
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/scripts/reset_message_counts.py
```

## 6. Seed Scripts (Safe to Remove if data is seeded)
```bash
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/seed_digest_template.py
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/seed_email_templates.py
```

## 7. Files Marked for Removal (Already identified as obsolete)
```bash
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/image_validator.py.toberemoved
```

## 8. Test Results & Schedules (Safe to Remove - old test artifacts)
```bash
rm -rf /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/test_results/
rm -rf /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/test_schedules/
```

## 9. Export Files (Safe to Remove - generated data)
```bash
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/exports/profiledata.csv
```

## 10. Frontend Utility Scripts (Replaced by deployment scripts)
```bash
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/frontend/fix_all_localhost.py
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/frontend/fix_localhost_urls.sh
```

## 11. Example/Template Environment Files (Keep ONE as reference)
```bash
# Keep .env.example, remove the others
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/frontend/.env.dev
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/frontend/.env.dev.example
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/frontend/.env.docker.example
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/frontend/.env.local.example
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/frontend/.env.pod.example
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/frontend/.env.stage.example
```

## 12. Obsolete Scripts (Replaced by newer deployment scripts)
```bash
rm -f /Users/rajsiripuram02/opt/appsrc/profiledata/frontend/scripts/deploy-to-gcloud.sh
```

## 13. Python Cache Directories (Safe to Remove - regenerated automatically)
```bash
find /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend -type d -name "__pycache__" -not -path "*/venv/*" -exec rm -rf {} + 2>/dev/null
find /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null
```

## 14. macOS System Files (Safe to Remove)
```bash
find /Users/rajsiripuram02/opt/appsrc/profiledata -name ".DS_Store" -delete
```

## 15. HTML Coverage Reports (Safe to Remove - regenerated during testing)
```bash
rm -rf /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/htmlcov/
```

## One-Line Command to Remove All (USE WITH CAUTION!)
```bash
# Create backup first
tar -czf profiledata_backup_$(date +%Y%m%d_%H%M%S).tar.gz /Users/rajsiripuram02/opt/appsrc/profiledata/

# Then run all removal commands
cat files_can_be_removed.md | grep "^rm -" | bash
```

## Space to be Freed
Estimated space that will be freed: ~10-15 MB (excluding venv __pycache__ files)

## Files to KEEP
- All files in `/tests/` directory
- All files in `/migrations/` directory (for audit trail)
- `.env` file (contains actual configuration)
- `.env.example` (for documentation)
- `requirements.txt` and `package.json` (critical dependencies)
- All deployment scripts (`deploy_*.sh`)
- All active source code files in `routes.py`, `main.py`, etc.
