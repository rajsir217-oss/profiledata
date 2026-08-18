---
description: Implement or modify the trusted-device passwordless login flow.
---

# Skill: Trusted-Device Login

## Overview

The trusted-device enhancement allows returning devices to log in without a password for up to 30 days.

## Backend changes

### Configuration

Add to `fastapi_backend/.env`:

```bash
TRUSTED_DEVICE_DAYS=30
TRUSTED_DEVICE_SECRET=<random secret>
TRUSTED_DEVICE_APP_ID=<app identifier>
```

### Models

- Extend `LoginRequest` to accept device metadata.
- Extend `LoginResponse` to include `show_trusted_device_prompt`.

### Endpoints in `auth/auth_routes.py`

- `POST /api/auth/trusted-devices/enroll`
- `POST /api/auth/trusted-devices/auto-login`
- `GET  /api/auth/trusted-devices` (list)
- `DELETE /api/auth/trusted-devices/{device_id}` (revoke)
- `DELETE /api/auth/trusted-devices` (revoke-all)

### Storage

- Persist hashed tokens in the `trusted_devices` collection.
- Use `TRUSTED_DEVICE_DAYS` for expiry.
- Create MongoDB indexes in `fastapi_backend/main.py` for `trusted_devices`.

## Frontend changes

### Device utilities

Create or update `frontend/src/utils/trustedDevice.js`:

- Generate and persist a stable device ID.
- Store the trusted-device token securely.

### API helpers

Add trusted-device endpoints to `frontend/src/api.js`.

### Login flow

- `Login.js`: After a normal login, if the response has `show_trusted_device_prompt`, show a prompt to trust the device. Call the enroll endpoint if the user agrees.
- `ProtectedRoute.js`: On app load, attempt auto-login with the stored trusted-device token before redirecting to `/login`.

## Verification

- Test normal login + trust prompt.
- Test auto-login on returning to the app within the configured expiry.
- Test revoke and revoke-all.
- Confirm tokens are hashed and expiry is enforced.
