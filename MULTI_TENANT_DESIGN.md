# Multi-Tenant / Multi-Domain Design

**Status:** Draft for review
**Author:** Engineering
**Scope:** Serve the platform from 2+ domains with per-domain branding, layout, profile-field visibility, and feature gating.

---

## 1. Goals

1. **Multi-domain serving** — run the same codebase under multiple domains (currently only `l3v3lmatches.com`).
2. **Per-domain branding + layout** — domain-specific app name, logo, theme, and layout variants (e.g., single-page interface with no topbar/sidebar).
3. **Per-domain profile field visibility** — show/hide fields such as `citizenshipStatus`, Green Card, H1B/F1/other visa status.
4. **Per-domain feature flags** — enable/disable features (e.g., search results capped at 10 for non-paid users, mandatory membership payment).

The unifying concept is a **Tenant**: a domain (or group of domains) mapped to a config document that drives branding, layout, field schema, and feature flags.

---

## 2. Current-State Findings (Code Review)

### 2.1 Domains & URLs

- **Backend CORS** is hardcoded by environment in `@/Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/main.py:369-429`. Production lists explicit origins (`l3v3lmatches.com`, `www`, `messenger.`). Adding a domain currently requires a code edit.
- **Frontend URL resolution** in `@/Users/rajsiripuram02/opt/appsrc/profiledata/frontend/src/config/apiConfig.js:27-116` relies on env vars + `POD_CONFIG` + hardcoded hostname checks (`getMessengerUrl` switches on `window.location.hostname`).
- **App URL safety guard** in `@/Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/config.py:202-213` forces the production domain when localhost leaks.
- **Single Settings object** (`@/Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/config.py:29-194`) — global, not tenant-aware.

**Gap:** No concept of "current tenant" derived from the request host. URLs/origins are static.

### 2.2 Branding & Layout

- **Whitelabel config exists** but is single-tenant and file-based:
  - Frontend loader `@/Users/rajsiripuram02/opt/appsrc/profiledata/frontend/src/utils/whitelabelConfig.js:41-58` fetches `/whitelabel.json` (one file per deployment).
  - Backend reads the same file via `@/Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/utils/branding.py:13-62` (cached with `lru_cache`, so one brand per process).
  - `TopBar` consumes it at `@/Users/rajsiripuram02/opt/appsrc/profiledata/frontend/src/components/TopBar.js:63-66` and renders brand name/tagline at `@/Users/rajsiripuram02/opt/appsrc/profiledata/frontend/src/components/TopBar.js:570-579`.
- **Layout wrapper** in `@/Users/rajsiripuram02/opt/appsrc/profiledata/frontend/src/App.js:345-367` already supports a "no navigation" mode via the `hideNavigation` route list (line 158) and `no-navigation` / `main-content-full` classes. This is the natural hook for a single-page, no-topbar layout.

**Gap:** Branding is one global JSON; `lru_cache` prevents per-request brand. Layout variants are route-based, not tenant-based.

### 2.3 Profile Fields (Visa / Citizenship)

- `citizenshipStatus` is the only immigration-style field and is **hardcoded** in many places:
  - Model + validator: `@/Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/models/user_models.py:186` and `@/Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/models/user_models.py:425-429` (only allows `Citizen`/`Greencard`).
  - Register form options differ from Profile edit options:
    - Register: `Citizen`, `Greencard` only (`@/Users/rajsiripuram02/opt/appsrc/profiledata/frontend/src/components/Register2.js:2800-2811`).
    - Profile edit: adds `Work Visa`, `Student Visa`, `Other` (`@/Users/rajsiripuram02/opt/appsrc/profiledata/frontend/src/components/Profile.js:2354-2362`).
  - Render gated only on value presence (`@/Users/rajsiripuram02/opt/appsrc/profiledata/frontend/src/components/Profile.js:2387`).

**Gap:** No field-visibility schema. Field options are inconsistent and hardcoded. No H1B/F1 enum. Cannot show/hide per domain.

### 2.4 Feature Flags & Membership/Paid Gating

- **Feature flags are global booleans** in `@/Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/config.py:105-117` (`enable_notifications`, etc.).
- **Membership config exists** (`MembershipConfig`/`MembershipPlan`) in `@/Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/models/site_settings_models.py:12-51`, stored as a single `site_settings` doc.
- **`isPaid` flag** is set on payment in `@/Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/services/payment_service.py:53-64` and read in reporting only.
- **Search endpoint** `@/Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/routes.py:5144-5198` accepts `limit` from the client and only checks `accountStatus == active`. **No `isPaid` gating and no server-enforced result cap.**

**Gap:** `isPaid` is not enforced anywhere for feature access. No per-tenant feature flags. Search limit is client-controlled.

---

## 3. Proposed Architecture

### 3.1 Tenant Resolution (host → tenant)

Add a **Tenant Resolver** that maps the incoming `Host` header (backend) and `window.location.hostname` (frontend) to a tenant id.

- **Backend:** new middleware `tenant_middleware` sets `request.state.tenant` from `Host`. Store mapping in a `tenants` collection (or config file for v1).
- **Frontend:** `getTenant()` helper in `apiConfig.js` resolves hostname → tenant id; fetch `/api/tenant/config` once on boot.

```
tenants (collection)
  _id: "usvedika"            # tenant id
  domains: ["usvedika.com", "www.usvedika.com"]
  branding: { appName, tagline, logoPath, logoText, theme }
  layout:   { variant: "full" | "single-page", showTopbar, showSidebar, homeRoute }
  fields:   { citizenshipStatus: {visible, options:[...]}, visaStatus: {visible, options:[...]}, ... }
  features: { searchLimitNonPaid: 10, membershipRequired: true, enableMessenger: true, ... }
  cors:     ["https://usvedika.com", ...]   # optional override
```

### 3.2 CORS (dynamic, tenant-driven)

Replace the static lists in `main.py` with origins assembled from the `tenants` collection at startup (plus env fallback). Keep dev regex. This removes per-domain code edits.

### 3.3 Branding & Layout

- Serve branding from `GET /api/tenant/config` keyed by host instead of a static `/whitelabel.json`.
- **Remove `lru_cache(maxsize=1)`** in `branding.py` or key the cache by tenant id, otherwise all tenants share the first-loaded brand.
- Drive the existing `hideNavigation`/`no-navigation` mechanism in `App.js` from `tenant.layout.variant` (single-page = hide topbar/sidebar globally, not just on auth routes).
- `TopBar` already reads brand config; point it at the tenant config response.

### 3.4 Profile Field Visibility

- Introduce a **field schema** in tenant config: each field has `{ visible, required, options }`.
- Backend: relax the hardcoded `citizenshipStatus` validator to validate against the tenant's allowed options; add a generic `visaStatus` field (`H1B`, `F1`, `Green Card`, `Citizen`, `Other`).
- Frontend: render Basic Information / Profile edit fields by iterating the tenant field schema instead of hardcoded `<select>` options. This fixes the current Register-vs-Profile option mismatch as a side benefit.

### 3.5 Feature Flags & Paid Gating

- Move global booleans to per-tenant `features` with safe defaults inherited from `config.py`.
- **Enforce search cap server-side**: in `search_users`, clamp `limit` for non-paid users:

```python
tenant = request.state.tenant
if tenant.features.membershipRequired and not current_user.get("isPaid"):
    limit = min(limit, tenant.features.searchLimitNonPaid)  # e.g., 10
```

- **Mandatory membership**: a dependency `require_paid_membership` that 402/403s gated endpoints when `tenant.features.membershipRequired and not isPaid`.
- Frontend: hide/disable gated UI based on `tenant.features` + user `isPaid`.

---

## 4. Data Model Changes

1. New `tenants` collection (schema in 3.1).
2. `users`: add optional `tenantId` (for analytics / data partitioning); add generic `visaStatus`.
3. `site_settings`: optionally nest under tenant or add `tenantId`.

---

## 5. Security Considerations

- **CORS** must be tenant-validated; never reflect arbitrary `Origin`.
- **Tenant isolation:** decide whether profiles are shared across tenants or partitioned. If partitioned, **every query** (search, profile, messages) must filter by `tenantId` — this is the largest correctness risk.
- **JWT:** consider embedding `tenantId` in the token to prevent cross-tenant access with a valid token.
- **Paid gating must be server-enforced** (client limit is currently trusted — see 2.4).

---

## 6. Phased Rollout

| Phase | Deliverable | Risk |
|-------|-------------|------|
| **1** | Tenant resolver + `tenants` collection + dynamic CORS | Low |
| **2** | Per-tenant branding/layout via `/api/tenant/config`; fix `branding.py` cache; drive `hideNavigation` from tenant | Low–Med |
| **3** | Tenant field schema; generic `visaStatus`; schema-driven forms; relax validator | Med |
| **4** | Per-tenant feature flags; **server-enforced** search cap + `require_paid_membership` | Med |
| **5** | Tenant isolation decision + `tenantId` query filters (if partitioned) | High |

---

## 7. Key Files to Touch

- **Domains/CORS:** `@/Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/main.py:369-429`, `@/Users/rajsiripuram02/opt/appsrc/profiledata/frontend/src/config/apiConfig.js:27-116`
- **Branding:** `@/Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/utils/branding.py:13-62`, `@/Users/rajsiripuram02/opt/appsrc/profiledata/frontend/src/utils/whitelabelConfig.js:41-58`, `@/Users/rajsiripuram02/opt/appsrc/profiledata/frontend/src/components/TopBar.js:63-66`
- **Layout:** `@/Users/rajsiripuram02/opt/appsrc/profiledata/frontend/src/App.js:155-367`
- **Fields:** `@/Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/models/user_models.py:186`, `@/Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/models/user_models.py:425-429`, `@/Users/rajsiripuram02/opt/appsrc/profiledata/frontend/src/components/Register2.js:2800-2811`, `@/Users/rajsiripuram02/opt/appsrc/profiledata/frontend/src/components/Profile.js:2354-2362`
- **Features/Paid:** `@/Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/config.py:105-117`, `@/Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/models/site_settings_models.py:12-51`, `@/Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/services/payment_service.py:53-64`, `@/Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend/routes.py:5144-5198`

---

## 8. Open Questions

1. **Shared vs. isolated data** — do tenants share the member pool or have separate pools? (Drives Phase 5 effort.)
2. **Deployment model** — one Cloud Run service for all domains, or one per tenant?
3. **Theme depth** — full CSS theme per tenant or just colors/logo/name?
4. **Config storage** — DB-backed `tenants` collection (admin-editable) vs. committed config files?
