# Membership Tier Audit

**Date:** Jun 19, 2026  
**Scope:** Full-stack review of role-based feature gating and limits

---

## Tier Hierarchy

```
admin (4) → moderator (3) → premium_user (2) → free_user (1)
```

Higher tiers inherit all permissions and limits of lower tiers.

**Sources:**
- Backend: `fastapi_backend/auth/security_config.py:125-130`
- Frontend: `frontend/src/utils/permissions.js:8-13`

---

## Feature Limits by Tier

| Limit | free_user | premium_user | moderator | admin |
|---|---|---|---|---|
| `favorites_max` | 1 | Unlimited | Unlimited | Unlimited |
| `shortlist_max` | 1 | Unlimited | Unlimited | Unlimited |
| `messages_per_day` | 1 | Unlimited | Unlimited | Unlimited |
| `profile_views_per_day` | 1 | Unlimited | Unlimited | Unlimited |
| `pii_requests_per_month` | 1 | 10 | Unlimited | Unlimited |
| `search_results_max` | 1 | 100 | Unlimited | Unlimited |

**Sources:**
- Backend: `fastapi_backend/auth/security_config.py:182-215`
- Frontend: `frontend/src/utils/permissions.js:24-57`
- Alternate config (routes.py): `fastapi_backend/routes.py:12558-12593` (different values for moderator)

---

## Permissions by Tier

| Permission | free_user | premium_user | moderator | admin |
|---|---|---|---|---|
| `profiles.read` | ✅ | ✅ | ✅ | ✅ |
| `profiles.create` | ✅ | ✅ | ✅ | ✅ |
| `profiles.update` | ✅ | ✅ | ✅ | ✅ |
| `profiles.delete` | ❌ | ❌ | ✅ | ✅ |
| `messages.read` | ✅ | ✅ | ✅ | ✅ |
| `messages.create` | ✅ | ✅ | ✅ | ✅ |
| `messages.delete` | ❌ | ❌ | ✅ | ✅ |
| `pii.request` | ✅ | ✅ | ✅ | ✅ |
| `pii.grant` | ❌ | ✅ | ✅ | ✅ |
| `pii.read` | ❌ | ❌ | ✅ | ✅ |
| `favorites.*` | read/create only | ✅ full | ✅ | ✅ |
| `shortlist.*` | ❌ | ✅ full | ✅ | ✅ |
| `users.read` | ❌ | ❌ | ✅ | ✅ |
| `users.update` | ❌ | ❌ | ✅ | ✅ |
| `audit.read` | ❌ | ❌ | ✅ | ✅ |
| `announcements.*` | ❌ | ❌ | ✅ | ✅ |
| `polls.*` | ❌ | ❌ | ✅ | ✅ |
| `invitations.*` | ❌ | ❌ | ✅ | ✅ |
| `roles.*` | ❌ | ❌ | ❌ | ✅ |
| `permissions.*` | ❌ | ❌ | ❌ | ✅ |
| `security.*` | ❌ | ❌ | ❌ | ✅ |

**Source:** `fastapi_backend/auth/security_config.py:133-179`

---

## Currently Gated Features

### 1. Privacy Settings (Premium+)
- **File:** `frontend/src/components/UnifiedPreferences.js:2012`
- **Rule:** `userRole !== 'free_user'` — section hidden entirely for free users
- **Controls:** `hideFavorites`, `hideShortlist`, `hideProfileViews`, `hidePIIRequests`
- **Backend enforcement:** `fastapi_backend/services/event_dispatcher.py:368` — free_user privacy settings silently ignored

### 2. L3V3L Compatibility Filter (Disabled)
- **File:** `frontend/src/components/SearchFilters.js:510`
- **Status:** Commented out / hidden
- **Original gate:** `systemConfig?.enable_l3v3l_for_all || isPremiumUser`
- **Toggle:** Admin setting in UnifiedPreferences (`enable_l3v3l_for_all`)

### 3. Sidebar Menu Locking (Account Status, not Tier)
- **File:** `frontend/src/components/Sidebar.js:142`
- **Rule:** Based on `userStatus` (active/pending), not role
- **Locked items:** Dashboard, Search, Messages, PII Management, Invite Friends, Virtual Meets

### 4. Blog Management (Admin/Moderator)
- **File:** `frontend/src/components/Sidebar.js` (admin + moderator sections)
- **Route:** `/blog-management` — ProtectedRoute, backend checks `is_admin_or_moderator()`

---

## Enforcement Status

### Backend (`LimitChecker` class)
- **File:** `fastapi_backend/auth/authorization.py:162-211`
- **Methods available:** `check_limit()`, `require_limit()`, `get_remaining()`, `get_all_limits()`
- **Status:** Fully implemented but **rarely called** in route handlers

### Where limits ARE enforced:
| Feature | Enforcement |
|---|---|
| Favorites max | ✅ `LimitChecker.require_limit` in `POST /favorites/{target}` |
| Shortlist max | ✅ `LimitChecker.require_limit` in `POST /shortlist/{target}` |
| Messages per day | ✅ `LimitChecker.require_limit` in `POST /messages/send` (daily count) |
| Profile views per day | ✅ `LimitChecker.require_limit` in `POST /profile-views` (daily count) |
| PII requests per month | ✅ `LimitChecker.require_limit` in `POST /access-request` (monthly count) |
| Search results max | ✅ `LimitChecker.get_user_limit` caps `limit` param in `GET /search` |
| Privacy settings (hideFavorites, etc.) | ✅ Backend + Frontend |
| Admin-only routes (roles, permissions, user management) | ✅ `require_admin` dependency |
| Blog CRUD | ✅ `is_admin_or_moderator()` check |
| Announcement/Poll management | ✅ Moderator+ |

---

## Premium Status Model

- **File:** `fastapi_backend/models/user_models.py:46-51`
- **Tiers:** `free`, `premium`, `lifetime`
  - `free` — 1 result/profile across all features
  - `premium` — no limits, paid subscription (monthly/yearly)
  - `lifetime` — no limits, all features, one-time lifetime access
- **DB fields:** `isPremium` (bool), `premiumStatus` (str), `premiumActivatedAt`, `premiumExpiresAt`
- **Admin endpoint:** `POST /api/admin/meta/premium` (`routes_meta_admin.py:130`)

---

## Key Files Reference

| File | Purpose |
|---|---|
| `fastapi_backend/auth/security_config.py` | Role hierarchy, permissions, limits |
| `fastapi_backend/auth/authorization.py` | `RoleChecker`, `LimitChecker`, `require_*` dependencies |
| `fastapi_backend/models/user_models.py` | `PremiumStatus` enum, user model fields |
| `fastapi_backend/routes_meta_admin.py` | Admin premium status management |
| `fastapi_backend/services/event_dispatcher.py` | Privacy settings enforcement |
| `frontend/src/utils/permissions.js` | Frontend role/limit utilities |
| `frontend/src/components/UnifiedPreferences.js` | Privacy settings UI gating |
| `frontend/src/components/SearchFilters.js` | L3V3L filter gating |
| `frontend/src/components/Sidebar.js` | Menu item gating |
| `frontend/src/hooks/useAuth.js` | Auth state (role from localStorage) |

---

## Recommendations

1. ~~**Enforce limits in route handlers**~~ — ✅ Done (Jun 19, 2026). All 6 limits enforced via `LimitChecker`.
2. **Reconcile duplicate limit configs** — `security_config.py` and `routes.py:12558` have different moderator limits
3. **Add `premium_user` role check** — `SearchPage2.js:645` only checks `role === 'premium' || role === 'admin'`, missing `moderator` and `premium_user` role name variants
4. **Enforce `lifetime` vs `premium` distinction** — Both currently map to `premium_user` role; consider differentiating lifetime-specific perks
