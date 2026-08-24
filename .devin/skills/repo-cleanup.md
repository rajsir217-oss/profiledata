---
description: Safely archive and clean up noisy or non-source repository artifacts.
---

# Skill: Repository Cleanup

## When to use

When the user wants to remove root-level scripts, generated files, logs, `.DS_Store` files, or other noisy artifacts without immediately deleting them.

## Principles

- **Never delete files immediately.**
- Prefer `safe2delete/` archives or `.toberemoved` renaming.
- Update `.gitignore` so archived/generated content is not re-tracked.
- Untrack already-committed files with `git rm --cached` after adding them to `.gitignore`.

## Step 1: Identify cleanup candidates

High-confidence candidates:
- `.git-rewrite/`
- Root `node_modules/`
- `hooks_backup_*/`
- `toberemoved/` directories
- `.DS_Store` files
- Log files (`frontend/cloudbuild.log`, `frontend/deploy.log`, `messenger/metro.log`, `messenger-web/webpack.log`, `photo_utilities/parse_files_orgnaize/photo_organizer.log`)
- Generated `frontend/public/build-info.json`
- `.coverage`
- Noisy root helper files (`dev`, `main`, `DEL`)
- Old root-level `.py` scripts

Keep these core areas:
- `fastapi_backend/`
- `frontend/`
- `messenger/`
- `messenger-web/`
- `deploy_gcp/`
- `.github/workflows/`

## Step 2: Archive with safe2delete/

Create category folders and move artifacts:

```bash
mkdir -p safe2delete/root_py_scripts
mv start_backend.sh safe2delete/
mv *.py safe2delete/root_py_scripts/
```

Add to root `.gitignore`:

```gitignore
safe2delete/
```

Since `safe2delete/` is ignored, `git status` will show deletions at the original tracked paths while archived copies remain locally for review.

## Step 3: Update .gitignore for generated/sensitive files

Add common patterns:

```gitignore
frontend/public/build-info.json
.coverage
.DS_Store
.env.production
frontend/.env.dev
frontend/.env.local.backup
*.log
```

Untrack existing files:

```bash
git rm --cached frontend/public/build-info.json .coverage .DS_Store
```

## Step 4: Bulk delete .toberemoved files later

After the user reviews and confirms:

```bash
find . -name "*.toberemoved" -delete
```

## Verification

- Run `git status` and confirm only intended deletions appear.
- Confirm `safe2delete/` and `.gitignore` changes.
- Confirm no active source files were moved.
