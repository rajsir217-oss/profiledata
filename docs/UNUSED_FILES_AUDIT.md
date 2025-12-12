# Unused / Not-Needed Files Audit (Candidate List)

This document lists files and folders that appear unused, redundant, or not appropriate to keep committed in the repo.

## How this list was produced
- Static scan for common “leftover” patterns:
  - `*.toberemoved`, `*.backup`, `*.old`, `*.bak`
  - dated backup folders (e.g. `backup_YYYYMMDD*`)
  - caches / build artifacts (e.g. `__pycache__`, `.pytest_cache`, `.coverage`, `.DS_Store`)
- Reference cross-checks:
  - React runtime entrypoint: `frontend/src/App.js` (imports + routes)
  - Repo-wide grep for candidate filenames

**Important:** “Unused” here means “not referenced by app runtime imports/routes” — some items may still be intentionally kept as one-off admin tools, migrations, or historical reference.

---

## A) High confidence: safe to remove from repo after review

### A1) Explicit leftovers (already marked for removal)
- **`frontend/src/components/SearchPage.js.toberemoved`**
  - Not referenced anywhere in `frontend/src`.
- **`frontend/src/components/Register_backup.js.toberemoved`**
  - Not referenced anywhere in `frontend/src`.
- **`frontend/src/components/Register2_prototype.js.toberemoved`**
  - Not referenced anywhere in `frontend/src`.
- **`frontend/src/components/L3V3LMatches.js.toberemoved`**
  - Not referenced anywhere in `frontend/src`.
- **`fastapi_backend/migrations/consolidate_workplace_fields.py.toberemoved`**
  - Not referenced anywhere in backend.

### A2) Backup / duplicate source files
- **`frontend/src/components/SearchPage2.js.backup`**
  - Not referenced anywhere in `frontend/src`.
- **`frontend/src/config/apiConfig.js.bak`**
  - Not referenced anywhere in `frontend/src`.

### A3) Old renamed file retained
- **`fastapi_backend/utils.py.old`**
  - Not referenced by Python imports.
  - Mentioned only in docs (`zdocs/CORS_FIX.md`) as a prior rename.

### A4) Database dump / backup folders
- **`fastapi_backend/backup_20251111/`**
  - Appears to be a raw DB export (`matrimonialDB/…`).
  - Not referenced by runtime code.

### A5) Build artifacts / OS/editor artifacts (should not be committed)
- **`.coverage`**
- **`.pytest_cache/`**
- **`.DS_Store`**
- **`**/__pycache__/` directories**
- **`**/*.pyc` files**

---

## B) Medium confidence: likely not needed, but may be “manual ops” scripts

These are not imported by the runtime app, but could be intentionally kept for admin/ops.

### B1) Root-level one-off scripts
- **`CHECK_SESSION.js`** (no references found)
- **`UNIFIED_SEARCH_TAB.js`** (no references found)
- **`schedule_email_notifier.js`** (intended for `mongosh` manual scheduling)
- **`check_db_images.py`** (manual check script)
- **`create_editprofile2.py`** (one-off generator)
- **`create_invitation_template.py`** (one-off generator)
- **`create_tabbed_register2.py`** (one-off generator)
- **`generate_css_reference.py`** (utility)
- **`setup_email_templates.py`** (admin/setup)
- **`setup_notification_jobs.py`** (admin/setup)
- **`verify_config.py`** (utility)

### B2) Backend “check_*” scripts (manual diagnosis)
Examples (non-exhaustive):
- `fastapi_backend/check_*.py`
- `fastapi_backend/migrations/check_*.py`

### B3) Backend admin tools (manual testing/seeding)
- `fastapi_backend/admin_tools/*.py`

### B4) Misc backups
- **`dns-backup-20251104-083847.txt`**

---

## C) Not unused (referenced), but potentially “not needed” / cleanup candidates

### C1) Deprecated UI path still wired into the app
- **`frontend/src/components/EditProfile.js.toberemoved`**
  - **Referenced by** `frontend/src/App.js`:
    - import: `import EditProfile from './components/EditProfile.js.toberemoved';`
    - route: `/edit-profile-old`
  - If you want it gone, it requires a deliberate cleanup PR:
    - remove route + import
    - confirm no one uses `/edit-profile-old`
    - then delete `.toberemoved` component + its CSS

- **`frontend/src/components/EditProfile.css.toberemoved`**
  - Likely only needed if `EditProfile.js.toberemoved` remains.

### C2) Backend legacy auth module still imported
- **`fastapi_backend/auth/legacy_auth.py`**
  - Imported by `fastapi_backend/auth/__init__.py` for backward compatibility.
  - This is **not unused**, but it’s a cleanup candidate if you want to enforce the single-auth-system rule everywhere.

---

## D) Excluded from consideration (vendor/build directories)
These are expected to exist locally but should typically not be committed:
- `node_modules/`
- `frontend/node_modules/`
- `fastapi_backend/venv/` (and `.venv/`)

---

## Suggested next step (recommended workflow)
If you want, I can do a **“delete readiness pass”** where I:
- confirm each candidate has **zero references** (imports, routes, shell scripts)
- propose an ordered cleanup plan
- **rename** candidates to `*.toberemoved` (instead of deleting) when appropriate
- remove any still-wired routes (like `/edit-profile-old`) safely
