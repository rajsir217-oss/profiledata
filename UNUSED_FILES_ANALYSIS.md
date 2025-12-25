# Unused Files Analysis Report

**Generated:** December 25, 2025  
**Project:** ProfileData Matrimonial Platform  
**Total Potentially Unused Files:** 154

---

## Executive Summary

This document identifies files in the codebase that are potentially unused or can be safely archived/removed. The analysis categorizes files into 8 groups based on their purpose and usage patterns.

### Quick Stats
- **Files marked .toberemoved:** 7 files (safe to delete)
- **Test scripts:** 28 files (move to tests/ directory)
- **Seed scripts:** 11 files (organize better)
- **Check scripts:** 17 files (archive)
- **Fix/Migration scripts:** 13 files (archive after verification)
- **Database migrations:** 45 files (keep for history)
- **Utility scripts:** 37 files (review and organize)
- **Duplicate components:** 4 files (remove after verification)
- **Deprecated routes:** 4 files (verify imports, then remove)

---

## 1. Files Marked .toberemoved (7 files)

**Status:** ✅ **SAFE TO DELETE** after final verification

These files were explicitly marked for removal following the project's file replacement protocol.

### Backend (1 file)
```
fastapi_backend/migrations/consolidate_workplace_fields.py.toberemoved
```

### Frontend (6 files)
```
frontend/src/components/EditProfile.css.toberemoved
frontend/src/components/EditProfile.js.toberemoved
frontend/src/components/L3V3LMatches.js.toberemoved
frontend/src/components/Register2_prototype.js.toberemoved
frontend/src/components/Register_backup.js.toberemoved
frontend/src/components/SearchPage.js.toberemoved
```

**Action:** Delete these files - they have been replaced by newer implementations.

---

## 2. Test Scripts (28 files)

**Status:** ⚠️ **KEEP BUT REORGANIZE** - Move to `tests/` directory

These are standalone test scripts in the backend root. They should be moved to the `tests/` directory for better organization.

```
fastapi_backend/test_activity_logger.py
fastapi_backend/test_admin_sms.py
fastapi_backend/test_aws_sns.py
fastapi_backend/test_decrypt_phone.py
fastapi_backend/test_email.py
fastapi_backend/test_email_analytics.py
fastapi_backend/test_email_notifier.py
fastapi_backend/test_email_templates_api.py
fastapi_backend/test_event_dispatch.py
fastapi_backend/test_firebase.py
fastapi_backend/test_login_flow.py
fastapi_backend/test_login_mfa.py
fastapi_backend/test_login_response.py
fastapi_backend/test_management.py
fastapi_backend/test_notification_query_fix.py
fastapi_backend/test_notification_templates.py
fastapi_backend/test_pii_decryption_endpoints.py
fastapi_backend/test_profile_view_notification.py
fastapi_backend/test_query.py
fastapi_backend/test_saved_search_matches_notifier.py
fastapi_backend/test_send_mfa_code.py
fastapi_backend/test_simpletexting.py
fastapi_backend/test_simpletexting_import.py
fastapi_backend/test_sms_direct.py
fastapi_backend/test_sms_to_admin.py
fastapi_backend/test_smtp.py
fastapi_backend/test_weekly_digest.py
```

**Action:** Move to `fastapi_backend/tests/manual/` or `fastapi_backend/tests/integration/`

---

## 3. Seed Scripts (11 files)

**Status:** ⚠️ **KEEP BUT ORGANIZE** - Move to `scripts/seed/` directory

These scripts seed database templates and initial data. Keep for database setup but organize better.

```
fastapi_backend/create_saved_search_matches_template.py
fastapi_backend/create_shortlist_email_template.py
fastapi_backend/seed_complete_email_templates.py
fastapi_backend/seed_digest_template.py
fastapi_backend/seed_email_templates.py
fastapi_backend/seed_email_templates_local.py
fastapi_backend/seed_missing_email_templates.py
fastapi_backend/seed_production_complete.py
fastapi_backend/seed_production_templates.py
fastapi_backend/seed_push_notifier_job.py
fastapi_backend/seed_status_change_templates.py
```

**Action:** Move to `fastapi_backend/scripts/seed/` directory

---

## 4. Check Scripts (17 files)

**Status:** 📦 **ARCHIVE** - Move to `scripts/diagnostics/`

These are diagnostic/debugging scripts used during development. Can be archived.

```
fastapi_backend/check_admin_history.py
fastapi_backend/check_admin_notification_prefs.py
fastapi_backend/check_all_invitations.py
fastapi_backend/check_backend_config.py
fastapi_backend/check_birth_fields.py
fastapi_backend/check_email_notification_status.py
fastapi_backend/check_favorite_exists.py
fastapi_backend/check_inv.py
fastapi_backend/check_invitation_statuses.py
fastapi_backend/check_logs_api.py
fastapi_backend/check_mfa_status.py
fastapi_backend/check_new_notification.py
fastapi_backend/check_notification_queue.py
fastapi_backend/check_real_profile_views.py
fastapi_backend/check_search_issue.py
fastapi_backend/check_user_email.py
fastapi_backend/check_users.py
```

**Action:** Move to `fastapi_backend/scripts/diagnostics/` or delete if no longer needed

---

## 5. Fix/Update Scripts (13 files)

**Status:** 📦 **ARCHIVE AFTER VERIFICATION** - One-time migration scripts

These are one-time fix/migration scripts. Verify they've been run in production, then archive.

```
fastapi_backend/fix_admin_mfa.py
fastapi_backend/fix_admin_sms.py
fastapi_backend/fix_invalid_emails.py
fastapi_backend/fix_missing_fields.py
fastapi_backend/fix_missing_invitation_tokens.py
fastapi_backend/fix_multi_emails.py
fastapi_backend/fix_notification_job_schedules.py
fastapi_backend/fix_sms_status.py
fastapi_backend/migrate_notification_preferences.py
fastapi_backend/update_logo_to_butterfly.py
fastapi_backend/update_pii_granted_template.py
fastapi_backend/update_saved_search_template.py
fastapi_backend/update_shortlist_template.py
```

**Action:** 
1. Verify these have been run in production
2. Move to `fastapi_backend/scripts/archive/` 
3. Document what each script did in a README

---

## 6. Migration Scripts (45 files)

**Status:** ✅ **KEEP** - Database migration history

These are database migration scripts. **KEEP ALL** for database history and rollback capability.

```
fastapi_backend/migrations/add_activation_fields.py
fastapi_backend/migrations/add_default_role_to_users.py
fastapi_backend/migrations/add_pause_fields.py
fastapi_backend/migrations/add_profile_ids.py
fastapi_backend/migrations/add_profileid_to_email_templates.py
fastapi_backend/migrations/add_region_field.py
fastapi_backend/migrations/add_username_case_insensitive_index.py
fastapi_backend/migrations/audit_profile_fields.py
fastapi_backend/migrations/bulk_fix_active_users_approval.py
fastapi_backend/migrations/check_age_fields.py
fastapi_backend/migrations/check_email_fields.py
fastapi_backend/migrations/check_l3v3l_config.py
fastapi_backend/migrations/check_partner_preferences.py
fastapi_backend/migrations/check_pii_requests.py
fastapi_backend/migrations/check_user_profile_data.py
fastapi_backend/migrations/check_user_status.py
fastapi_backend/migrations/cleanup_redundant_email_field.py
fastapi_backend/migrations/consolidate_sex_to_gender.py
fastapi_backend/migrations/create_activity_logs_indexes.py
fastapi_backend/migrations/create_short_urls_indexes.py
fastapi_backend/migrations/drop_dateofbirth_field.py
fastapi_backend/migrations/enable_new_notification_channels.py
fastapi_backend/migrations/encrypt_existing_pii.py
fastapi_backend/migrations/ensure_email_notifier_job.py
fastapi_backend/migrations/expire_old_pending_pii_requests.py
fastapi_backend/migrations/fix_accepted_case.py
fastapi_backend/migrations/fix_datetime_fields.py
fastapi_backend/migrations/fix_location_field_mapping.py
fastapi_backend/migrations/fix_profileid_clickable.py
fastapi_backend/migrations/fix_profileid_clickable_production.py
fastapi_backend/migrations/fix_rajsir742_status.py
fastapi_backend/migrations/fix_ramsir1995_status.py
fastapi_backend/migrations/import_invitation_data.py
fastapi_backend/migrations/migrate_dateofbirth_to_birth_fields.py
fastapi_backend/migrations/migrate_dob_to_month_year.py
fastapi_backend/migrations/migrate_location_to_string.py
fastapi_backend/migrations/migrate_to_accountstatus.py
fastapi_backend/migrations/remove_education_field.py
fastapi_backend/migrations/remove_education_years.py
fastapi_backend/migrations/remove_worklocation_field.py
fastapi_backend/migrations/remove_workplace_field.py
fastapi_backend/migrations/rotate_encryption_key.py
fastapi_backend/migrations/run_005_manually.py
fastapi_backend/migrations/run_migrations.py
fastapi_backend/migrations/sync_invitations_to_production.py
```

**Action:** Keep all migration files. Consider adding a README documenting the migration history.

---

## 7. Utility Scripts (37 files)

**Status:** ⚠️ **REVIEW AND ORGANIZE** - Some may be unused

These utility scripts need individual review to determine if they're still needed.

```
fastapi_backend/TURNSTILE_INTEGRATION.py
fastapi_backend/add_admin_phone.py
fastapi_backend/add_admin_phone_final.py
fastapi_backend/add_remaining_templates.py
fastapi_backend/build_info.py
fastapi_backend/cleanup_duplicate_templates.py
fastapi_backend/crypto_utils.py
fastapi_backend/debug_notification_flow.py
fastapi_backend/decrypt_admin_contacts.py
fastapi_backend/delete_and_recreate_notification.py
fastapi_backend/email_templates_priority1.py
fastapi_backend/enable_saved_search_notifications.py
fastapi_backend/env_config.py
fastapi_backend/generate_build_info.py
fastapi_backend/generate_test_notification_queue.py
fastapi_backend/image_validator.py
fastapi_backend/l3v3l_matching_engine.py
fastapi_backend/l3v3l_ml_enhancer.py
fastapi_backend/main_minimal.py
fastapi_backend/manual_test_log.py
fastapi_backend/match_invitations_to_users.py
fastapi_backend/pii_security.py
fastapi_backend/process_profile_view_notification.py
fastapi_backend/profanity_filter.py
fastapi_backend/redis_manager.py
fastapi_backend/requeue_failed_emails.py
fastapi_backend/reset_admin_password.py
fastapi_backend/reset_shortlist_notification.py
fastapi_backend/retroactive_match_users_to_invitations.py
fastapi_backend/routes_dynamic_scheduler.py
fastapi_backend/routes_image_access.py
fastapi_backend/routes_meta_admin.py
fastapi_backend/routes_pii_access.py
fastapi_backend/sse_manager.py
fastapi_backend/validate_notification_enums.py
fastapi_backend/verify_role_default.py
fastapi_backend/websocket_manager.py
```

**Likely Unused (check imports):**
- `main_minimal.py` - Minimal FastAPI app (probably for testing)
- `sse_manager.py` - SSE implementation (check if used)
- `websocket_manager.py` - WebSocket manager (check if used)
- `redis_manager.py` - Redis manager (check if used)
- `crypto_utils.py` - Crypto utilities (check if used)
- `profanity_filter.py` - Profanity filter (check if used)
- `image_validator.py` - Image validator (check if used)

**Deprecated Routes (check if imported in main.py):**
- `routes_dynamic_scheduler.py` - May be replaced by routers/
- `routes_image_access.py` - May be replaced by routers/
- `routes_meta_admin.py` - May be replaced by routers/
- `routes_pii_access.py` - May be replaced by routers/

**Action:** 
1. Check if these files are imported anywhere in the codebase
2. Move unused ones to `scripts/archive/`
3. Keep actively used utilities in `utils/` directory

---

## 8. Duplicate Components (4 files)

**Status:** ⚠️ **REMOVE AFTER VERIFICATION** - Backup/prototype files

These appear to be duplicate or backup versions of existing components.

```
frontend/src/components/Dashboard2.js
frontend/src/components/Register2.js
frontend/src/components/SearchPage2.js
frontend/src/components/SearchPage2.js.backup
```

**Action:**
1. Verify these are not imported in `App.js` or any routes
2. Check if they contain any unique functionality not in the main versions
3. Delete if confirmed as duplicates

---

## 9. Deprecated Routes (4 files)

**Status:** ⚠️ **VERIFY IMPORTS** - May be replaced by routers/

These route files in the backend root may have been replaced by files in the `routers/` directory.

```
fastapi_backend/routes_dynamic_scheduler.py
fastapi_backend/routes_image_access.py
fastapi_backend/routes_meta_admin.py
fastapi_backend/routes_pii_access.py
```

**Action:**
1. Check if these are imported in `main.py`
2. Check if equivalent functionality exists in `routers/` directory
3. If not imported and replaced, delete them

---

## Recommended Actions

### Immediate Actions (Safe to do now)

1. **Delete .toberemoved files** (7 files)
   ```bash
   find . -name "*.toberemoved" -type f -delete
   ```

2. **Verify and delete duplicate components** (4 files)
   - Check if imported anywhere
   - Delete if confirmed as duplicates

### Organization Actions (Improve structure)

3. **Create directory structure:**
   ```bash
   mkdir -p fastapi_backend/scripts/{seed,diagnostics,archive}
   mkdir -p fastapi_backend/tests/manual
   ```

4. **Move test scripts** (28 files)
   ```bash
   mv fastapi_backend/test_*.py fastapi_backend/tests/manual/
   ```

5. **Move seed scripts** (11 files)
   ```bash
   mv fastapi_backend/seed_*.py fastapi_backend/scripts/seed/
   mv fastapi_backend/create_*_template.py fastapi_backend/scripts/seed/
   ```

6. **Move check scripts** (17 files)
   ```bash
   mv fastapi_backend/check_*.py fastapi_backend/scripts/diagnostics/
   ```

7. **Archive fix scripts** (13 files)
   ```bash
   mv fastapi_backend/fix_*.py fastapi_backend/scripts/archive/
   mv fastapi_backend/update_*.py fastapi_backend/scripts/archive/
   mv fastapi_backend/migrate_notification_preferences.py fastapi_backend/scripts/archive/
   ```

### Review Actions (Need investigation)

8. **Review utility scripts** (37 files)
   - Check imports in codebase
   - Move unused ones to `scripts/archive/`
   - Keep active ones in `utils/`

9. **Verify deprecated routes** (4 files)
   - Check if imported in `main.py`
   - Delete if replaced by `routers/` files

### Keep As-Is

10. **Keep migration scripts** (45 files)
    - Essential for database history
    - Do not delete or move

---

## Summary of Disk Space Savings

**Estimated space to be freed:**
- .toberemoved files: ~50 KB
- Duplicate components: ~100 KB
- Deprecated routes (if unused): ~50 KB
- **Total immediate savings:** ~200 KB

**Organizational benefits:**
- Cleaner backend root directory (106 files → ~10 files)
- Better organized scripts in subdirectories
- Easier to find and maintain code
- Clearer separation of concerns

---

## Verification Commands

Before deleting any files, verify they're not imported:

```bash
# Check if a file is imported anywhere
grep -r "from.*filename" --include="*.py" fastapi_backend/
grep -r "import.*filename" --include="*.py" fastapi_backend/

# Check frontend imports
grep -r "from.*ComponentName" --include="*.js" --include="*.jsx" frontend/src/
grep -r "import.*ComponentName" --include="*.js" --include="*.jsx" frontend/src/
```

---

## Notes

- This analysis is based on file naming patterns and directory structure
- Some files may still be used even if not directly imported (e.g., CLI scripts)
- Always verify before deleting any file
- Consider creating a `scripts/archive/` directory for historical reference
- Update documentation after reorganization

---

**Last Updated:** December 25, 2025  
**Analyst:** Cascade AI  
**Status:** Ready for Review
