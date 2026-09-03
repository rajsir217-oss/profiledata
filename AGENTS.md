# AGENTS.md — rajsir217-oss/profiledata

> Project-specific coding conventions and quick reference for AI agents working on the ProfileData / L3V3L Matches codebase.
> For high-level architecture and product context, see `CLAUDE.md`.

---

## 1. Stack and layout

| Layer | Tech |
|---|---|
| Backend | FastAPI + Python 3.12 + Motor (async MongoDB) |
| Database | MongoDB (`matrimonialDB`) |
| Auth | JWT (HS256, 30-minute expiry) |
| Frontend | React + React Router |
| Messenger | `messenger/` (React Native) and `messenger-web/` (React 18 + webpack 5) |

### Key directories

- `fastapi_backend/` — Backend entry `main.py`, settings `config.py`, routes `routes.py`, auth `auth/`, services `services/`, routers `routers/`, job templates `job_templates/`.
- `frontend/src/` — React app. Shared API client `api.js`, URL config `config/apiConfig.js`, themes `themes/themes.css`, logger `utils/logger.js`.
- `messenger-web/src/` — Web messenger. Webpack build outputs `dist/`. Capacitor may wrap this for mobile.
- `deploy_gcp/` — Deployment scripts and mobile build helpers.
- `rsync/` — Python-based `sync2NAS` backup tooling.

### API route prefixes

| Prefix | File |
|---|---|
| `/api/users/*` | `fastapi_backend/routes.py` |
| `/api/auth/*` | `fastapi_backend/auth/auth_routes.py` |
| `/api/notifications/*` | `fastapi_backend/routers/notifications.py` |
| `/api/verification/*` | `fastapi_backend/routers/verification.py` |
| `/api/scheduler/*` | `fastapi_backend/routes_dynamic_scheduler.py` |
| `/api/activity-logs/*` | `fastapi_backend/routers/activity_logs.py` |
| `/api/messenger/*` | `fastapi_backend/routers/messenger.py` |

---

## 2. Mandatory global rules

### 2.1 Environment and configuration

- Always read `fastapi_backend/.env` first to discover env-var conventions.
- Never hardcode URLs, ports, or database strings in Python or JavaScript.
  - Python: use `from config import Settings; settings = Settings()`.
  - JavaScript: use `import { getBackendUrl } from './config/apiConfig'`.
- For GCloud deployments, verify `apiConfig.js` backend/frontend URLs and that env vars are injected correctly.

### 2.2 Authentication

- Use only the primary JWT dependency:
  ```python
  from auth.jwt_auth import get_current_user_dependency as get_current_user

  @router.get("/endpoint")
  async def endpoint(current_user: dict = Depends(get_current_user)):
      username = current_user["username"]
  ```
- Do not use `from auth import get_current_user` (legacy / deprecated).
- Admin access checks in the frontend must use `localStorage.getItem('userRole')`, not `localStorage.getItem('username')`. The admin user may have any username.

### 2.3 UI / UX patterns

- Never use browser modals: `alert()`, `confirm()`, `prompt()`.
- Also forbidden: `window.alert()`, `window.confirm()`, `window.prompt()` (including temporary debug code).
- Use `Toast` for non-blocking feedback, `DeleteButton` for destructive actions, and custom styled modals only for critical confirmations or multi-step forms.
- All CSS must be theme-aware and use variables from `frontend/src/themes/themes.css`.
  - No hardcoded hex colors, rgb/rgba, or fixed gradients.
  - No `style={{...}}` inline styles in new code.
  - No `@media (prefers-color-scheme: dark)` — the app uses internal theme classes (`.theme-dark`, etc.).
- Use shared components consistently:
  - `LoadMore` for pagination.
  - `DeleteButton` for deletes.
  - `MessageModal` with profile enrichment on every page that shows user cards.
- Keep card pages identical: `/dashboard`, `/search`, `/l3v3l-matches`, `/favorites`, `/shortlist`. Any change to `UserCard` / `SearchResultCard` requires checking all five pages.

### 2.4 Logging

- Do not leave `console.log` in production code.
- Use `frontend/src/utils/logger.js`:
  - `logger.debug(...)` for dev-only diagnostics.
  - `logger.info(...)` for production-safe user actions.
  - `logger.error(...)` for errors.

Quick pre-merge checks:
```bash
grep -RIn "alert\\(|confirm\\(|prompt\\(|window\\.alert\\(|window\\.confirm\\(|window\\.prompt\\(" frontend/src
grep -RIn "console\\.log\\(" frontend/src
```

### 2.5 File lifecycle

- When replacing any file, rename the old one to `<name>.toberemoved` first.
- Do not delete `.toberemoved` files without explicit user permission; bulk remove later with `find . -name "*.toberemoved" -delete`.
- For large repo cleanup, move questionable artifacts to a `safe2delete/` directory and add it to `.gitignore`.

### 2.6 Frontend route guard

`frontend/src/index.js` has a pre-React guard that redirects to `/login` if there is no token and the path is not in `publicPaths`. This runs **before** `App.js` and `api.js` guards.

Current `publicPaths` include: `/`, `/login`, `/register`, `/register2`, `/register3`, `/register-interest`, `/verify-email`, `/verify-email-sent`, `/forgot-password`, `/terms`, `/privacy`, `/community-guidelines`, `/cookie-policy`, `/l3v3l-info`, `/help`, `/logo-showcase`, `/tooltip-demo`, `/messenger/public-reply`.

Any new public route added to `App.js` must also be added to this list.

---

## 3. Backend conventions

### 3.1 Database access and dependency injection

- Every route handler that touches MongoDB must accept `db` via FastAPI dependency injection:
  ```python
  from dependencies import get_database

  @router.get("/items")
  async def list_items(db=Depends(get_database)):
      ...
  ```
- Do not call `get_database()` inside a handler body. This breaks test mocking.
- `DELETE` endpoints that receive query parameters must declare them explicitly with `Query(...)`:
  ```python
  from fastapi import Query

  @router.delete("/favorites/{target_username}")
  async def remove_from_favorites(
      target_username: str,
      username: str = Query(...),
      db=Depends(get_database),
  ):
  ```

### 3.2 Data validation and MongoDB edge cases

- MongoDB may return `''` for missing numeric fields. Always validate before `int()`:
  ```python
  raw = data.get("field", 0)
  value = int(raw) if raw not in ("", None) else 0
  ```
- The `status` object on the user document tracks activity (`last_seen`) and a legacy `status` string. Do **not** use it for account status.
- The unified account-status field is `accountStatus`. Valid values:
  - `pending_email_verification`
  - `pending_admin_approval`
  - `active`
  - `suspended`
  - `banned` (mapped to `suspended` in practice)
  - `paused`
  - `deactivated`
- Admin status changes in `auth/admin_routes.py` must read from and write to `accountStatus`.
- Online presence is tracked in Redis, not the database. Use `redis.set_user_online()` / `redis.is_user_online()`.

### 3.3 PII and contact fields

- Encrypted PII may be stored under different keys. Read with fallback:
  ```python
  email = user.get("email") or user.get("contactEmail")
  phone = user.get("phone") or user.get("contactNumber")
  ```
- Decrypt with `crypto_utils.PIIEncryption` before using PII.

### 3.4 Notification system

- Use `notification.id`, not `notification.dict().get("_id")` (Pydantic alias bug).
- MongoDB updates that both set and increment must be combined in one document:
  ```python
  update_doc = {
      "$set": {"status": "sent", "updatedAt": datetime.utcnow()},
      "$inc": {"attempts": 1},
  }
  ```
- Notification status mapping in the frontend:
  ```javascript
  const statusMap = {
      pending: "queued",
      sent: "sent",
      failed: "failed",
  };
  ```

### 3.5 Search and sort

- `GET /api/search` is the canonical search endpoint. Sort is server-backed.
- Canonical sort keys: `matchScore`, `height`, `firstName`, `location`, `education`, `profession`.
- Aliases are normalized on the backend (`name` -> `firstName`, `heightInches` -> `height`, `occupation` -> `profession`).
- Do not keep legacy `sortBy` / `sortOrder` in search-criteria payloads; sort state is managed separately.

---

## 4. Frontend conventions

### 4.1 API calls

- Use the shared `api` client. The base URL in most frontend pages is `/api/users`, so call relative paths like `/pii-requests/{username}`. Avoid double prefixes like `/api/users/api/users/...`.
- For messenger-web, check its own API base configuration.

### 4.2 Theming and styling

- Available themes: Cozy Light (default), Dark, Rose, Light Gray, Ultra Light Gray.
- Always use CSS variables: `--primary-color`, `--secondary-color`, `--background-color`, `--surface-color`, `--card-background`, `--text-color`, `--border-color`, `--success-color`, `--danger-color`, `--warning-color`, `--info-color`, etc.
- Gradients use `var(--primary-color)` and `var(--secondary-color)`.
- Admin table headers must use `background: var(--primary-color)` and `color: white !important`. Body rows use `var(--surface-color)` or `var(--card-background)`.

### 4.3 Shared components and UX patterns

- `MessageModal` must fetch a full profile if the user object lacks `firstName` / `location` before opening.
- Use the `Modal 1` style for polished modals (gradient header, dark circular close button, rounded corners, ESC key handler).
- Admin action buttons in tables use the `bubble-icons` pattern (`.admin-action-btns` + `.btn-micro` classes).
- `LoadMore` is the standard pagination component.
- `DeleteButton` is the standard 2-click delete component.
- Card action icons must remain consistent:
  - Favorite active / inactive: filled star / empty star
  - Shortlist active / inactive: checkmark-clipboard / clipboard
  - Message: speech bubble
  - View profile: eye
  - Exclude active / inactive: no-entry / cross-mark

### 4.4 Search and card pages

- All card pages (`/dashboard`, `/search`, `/l3v3l-matches`, `/favorites`, `/shortlist`) must load and persist favorites, shortlists, and exclusions as `Set`s.
- PII access must be loaded from outgoing requests and received access, tracking only `pending` requests and active grants.
- The `UserCard`, `SearchResultCard`, `Dashboard.js`, `SearchPage.js`, `L3V3LMatches.js`, `Favorites.js`, and `Shortlist.js` files must stay synchronized.

---

## 5. Testing and quality

- New backend features need `tests/test_<feature>.py` with happy path, validation, not-found, auth, and edge-case tests.
- New frontend components need `<Component>.test.js` covering render, interaction, API mocking, state changes, and error states.
- All UI changes must be checked in all five themes and should not introduce `console.log` warnings.

---

## 6. Quick reference

| Topic | Read first |
|---|---|
| Auth | `fastapi_backend/auth/jwt_auth.py` |
| Notifications | `fastapi_backend/services/notification_service.py`, `routers/notifications.py` |
| Scheduler | `fastapi_backend/job_templates/`, dynamic scheduler routes |
| Saved searches / search | `fastapi_backend/routes.py` search and saved-searches sections |
| Dashboard | `docs/dashboard-mockups/A-action-first.html`, `CLAUDE.md` section 6 |
| Messenger | `fastapi_backend/services/messenger_service.py`, `messenger-web/src/services/` |
| PII encryption | `fastapi_backend/crypto_utils.py` |
| Backup | `rsync/sync2NAS.py`, `rsync/README.md` |

## 7. Related rule and skill files

- `.devin/rules/frontend.md`
- `.devin/rules/backend.md`
- `.devin/rules/git-and-repo.md`
- `.devin/rules/messenger.md`
- `.devin/rules/search-and-cards.md`
- `.devin/skills/`
