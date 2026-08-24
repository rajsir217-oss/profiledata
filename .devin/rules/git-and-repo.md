# Git and Repository Rules

> Guidelines for safe file lifecycle, repo hygiene, and cleanup in `rajsir217-oss/profiledata`.

---

## 1. Replacing or deprecating files

### 1.1 Never delete files immediately

When replacing a file, rename the old version first:

```bash
mv OldComponent.js OldComponent.js.toberemoved
mv OldComponent.css OldComponent.css.toberemoved
```

Then create the replacement file with the intended name.

### 1.2 Keep `.toberemoved` files for review

- Keep `.toberemoved` files in the same directory as reference.
- They will not be imported or bundled by webpack.
- Document replacements in commit messages or notes.

### 1.3 When to delete `.toberemoved` files

- After the user reviews and confirms the new version works.
- After a testing period (e.g., 1-2 weeks).
- When explicitly requested by the user.
- Bulk delete command: `find . -name "*.toberemoved" -delete`

### 1.4 Apply to

- React component replacements
- CSS replacements
- Python route/endpoint refactors
- Configuration file updates
- Any file being deprecated or replaced

---

## 2. Bulk cleanup

### 2.1 Use `safe2delete/` for large cleanups

For large repo cleanup, move questionable artifacts to a `safe2delete/` directory and add it to `.gitignore`:

```bash
mkdir -p safe2delete/root_py_scripts
mv *.py safe2delete/root_py_scripts/
```

Then update the root `.gitignore`:
```gitignore
safe2delete/
```

Since `safe2delete/` is ignored, `git status` will show deletions at the original tracked paths while archived copies remain locally.

### 2.2 High-confidence cleanup candidates

The following are typically safe to move to `safe2delete/` or remove after review:
- `.git-rewrite/`
- Root `node_modules/`
- `hooks_backup_*/`
- `toberemoved/` directories
- `.DS_Store` files
- Generated logs (`frontend/cloudbuild.log`, `frontend/deploy.log`, `messenger/metro.log`, `messenger-web/webpack.log`, `photo_utilities/parse_files_orgnaize/photo_organizer.log`)
- Generated `frontend/public/build-info.json`
- `.coverage`
- Noisy root helper files (`dev`, `main`, `DEL`)

Active core areas to keep:
- `fastapi_backend/`
- `frontend/`
- `messenger/`
- `messenger-web/`
- `deploy_gcp/`
- `.github/workflows/`

---

## 3. Gitignore hygiene

### 3.1 Common files to ignore

Ensure these are in `.gitignore`:
- Generated build info (`frontend/public/build-info.json`)
- Coverage files (`.coverage`)
- `.DS_Store`
- Non-example env files (`.env.production`, `frontend/.env.dev`, `frontend/.env.local.backup`)
- Log files (`*.log`)

### 3.2 Untracking existing files

Adding a path to `.gitignore` does **not** untrack already-committed files. After updating ignore rules, run:

```bash
git rm --cached <path>
```

---

## 4. Tooling quirks

### 4.1 npm build command

In this repository, running `npm run build` with `cwd` set to `frontend/` can resolve incorrectly and report a missing script. Use the absolute prefix from the repo root:

```bash
npm --prefix /Users/rajsiripuram02/opt/appsrc/profiledata/frontend run build
```

For `messenger-web` and other subprojects, use:

```bash
npm install --prefix <subdir>
npm run <script> --prefix <subdir>
```

### 4.2 Android resource build

Gradle resource merge fails if launcher icon generation leaves `*.toberemoved*` files inside `android/app/src/main/res/mipmap-*`. AAPT requires resource filenames to end with `.png` or `.xml`.

Before regenerating icons, move old icons and any existing `*.toberemoved*` artifacts to a backup directory **outside** `res/`, e.g. `android/app/src/main/res_toberemoved/<density>/...`.

This is implemented in `deploy_gcp/deploy-mobile-msg.sh` in `ensure_capacitor_android_launcher_icons()`.
