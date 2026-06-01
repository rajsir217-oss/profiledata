# Messenger Web Phone Login (SMS OTP)

## 1) Request and Scope

### Requested outcome
Add `phone + SMS code` login to `messenger-web` **alongside** existing `username + password` login.

### Mandatory business rule
If the same phone number maps to **more than one account**, do **not** continue phone login. Redirect user to `username + password` and show a clear explanation.

---

## 2) Findings (Before Implementation)

## 2.1 Existing frontend behavior
- `messenger-web/src/screens/LoginScreen.js` originally supported:
  - Username/password login
  - MFA follow-up verification
  - Biometric login
- No separate phone-login path in this current branch state.

## 2.2 Existing shared auth store
- `messenger/src/stores/authStore.js` already had core auth flows (`login`, `refresh`, `restore`, etc.).
- No dedicated `sendPhoneLoginCode` / `verifyPhoneLoginCode` methods existed in this branch state.

## 2.3 Existing backend auth behavior
- `fastapi_backend/auth/auth_routes.py` login endpoint accepted username/password (+ optional MFA), not phone-first login.
- Existing OTP/SMS services already available:
  - `fastapi_backend/services/sms_service.py` (`OTPManager`)
  - Existing MFA/OTP routes (`mfa_routes.py`, `otp_routes.py`)

## 2.4 Phone data model and lookup realities
Phone values can exist in multiple places:
- `contactNumber` (single primary)
- `contactNumbers[]` (array entries with `number`, optional metadata)

PII is encrypted at rest in many flows. Hash fields are used for lookups:
- `contactNumberHash` existed
- `contactNumbersHashes` was **not consistently persisted** before this change

Because phone duplicates are intentionally allowed in this product, phone->user may be non-unique by design.

## 2.5 DB check note
A direct `mongosh` distribution check was proposed but canceled in-session. Implementation therefore uses defensive matching logic that supports both hashed and legacy/encrypted records.

---

## 3) Design (Pre-Implementation)

## 3.1 UX workflow mockup
1. Login screen shows two tabs:
   - `Username + Password`
   - `Phone + SMS Code`
2. User selects phone method and enters phone.
3. User taps `Send Code`.
4. Backend resolves phone -> account(s):
   - **0 matches**: return not found/invalid request
   - **1 match**: send OTP and continue
   - **>1 matches**: return `MULTIPLE_ACCOUNTS_FOR_PHONE`
5. For `>1`, frontend switches to username/password tab and explains why.
6. User enters OTP, verifies, receives tokens, and session proceeds.

## 3.2 API design
Two new backend endpoints:
- `POST /api/auth/login/phone/send-code`
- `POST /api/auth/login/phone/verify-code`

Multi-account response contract:
- HTTP `409`
- body:
  - `detail: "MULTIPLE_ACCOUNTS_FOR_PHONE"`
  - `message: <human readable explanation>`

## 3.3 Matching algorithm design
For input phone, create normalized/hash variants and check:
- `contactNumberHash`
- `contactNumbersHashes`
- fallback plaintext variants (for legacy docs)
- fallback decrypt-and-compare path for older encrypted docs without array hashes

Then filter matches by allowed account status and ensure exact digit-match after normalization.

## 3.4 Security and guardrails
- Keep existing CAPTCHA behavior (`captchaToken`) for send-code route.
- Reuse rate limiting on auth routes.
- Reuse account lock checks and session issuance patterns.
- Respect `smsOptIn` before sending login SMS.

---

## 4) Planned Code Changes (Before Implementation)

1. Add request models for phone send/verify payloads.
2. Add phone lookup helper functions (normalize, hash variants, match).
3. Add backend send/verify endpoints.
4. Add `multiple accounts` explicit response path.
5. Update shared auth store with phone login methods.
6. Update messenger-web login screen for dual login mode + OTP screen.
7. Add support to persist `contactNumbersHashes` so multi-phone array lookups are reliable.

---

## 5) Implemented Code Changes

## 5.1 Backend model updates
### File
- `fastapi_backend/auth/security_models.py`

### Added
- `PhoneLoginSendCodeRequest`
- `PhoneLoginVerifyCodeRequest`

Includes phone/code validation used by new auth endpoints.

## 5.2 Backend auth routes
### File
- `fastapi_backend/auth/auth_routes.py`

### Added helpers
- Phone normalization/hash variant builders
- Phone extraction and matching across:
  - `contactNumber`
  - `contactNumbers[]`
- Status gating and dedup logic for candidate users

### Added endpoints
- `POST /api/auth/login/phone/send-code`
- `POST /api/auth/login/phone/verify-code`

### Multi-account guard
Both endpoints now return `409 MULTIPLE_ACCOUNTS_FOR_PHONE` with explanation when more than one account matches.

### OTP behavior
- Uses `OTPManager.create_otp_with_channel(... purpose="phone_login")`
- Verifies with `OTPManager.verify_otp(... purpose="phone_login")`

### Session/login completion
On successful phone OTP verification, endpoint issues access+refresh token and updates session/user login metadata.

## 5.3 PII hash persistence for phone arrays
### File
- `fastapi_backend/crypto_utils.py`

### Added
- During `encrypt_user_pii(...)`, compute and persist `contactNumbersHashes` from each `contactNumbers[].number` prior to encryption.

This improves lookup reliability and performance for multi-phone accounts.

## 5.4 Shared auth store
### File
- `messenger/src/stores/authStore.js`

### Added methods
- `sendPhoneLoginCode(phone, captchaToken)`
- `verifyPhoneLoginCode(phone, code)`

### Added behavior
- Handles backend `409 MULTIPLE_ACCOUNTS_FOR_PHONE` and returns:
  - `multipleAccounts: true`
  - explanatory error message

## 5.5 Messenger web login UI
### File
- `messenger-web/src/screens/LoginScreen.js`

### Added UX
- Login method tabs:
  - `Username + Password`
  - `Phone + SMS Code`
- Phone OTP send/verify flow
- Resend phone code behavior

### Added mandatory fallback behavior
When backend responds with multi-account conflict:
- UI switches back to username/password mode
- Displays reason message explaining why fallback occurred

No browser modal APIs were introduced.

---

## 6) Validation Performed

## Backend
- `python3 -m py_compile fastapi_backend/auth/auth_routes.py fastapi_backend/auth/security_models.py fastapi_backend/crypto_utils.py`
- Result: pass

## Frontend
- `npm --prefix messenger-web run build`
- Result: pass (existing bundle-size warnings only)

---

## 7) Behavior Summary (Final)

- Users can choose phone login in messenger-web.
- SMS code is sent and verified server-side.
- If one phone maps to multiple profiles/accounts, flow is intentionally blocked and redirected to username/password with clear user messaging.

---

## 8) Follow-up Recommendations

1. Add a one-time backfill script to populate `contactNumbersHashes` for legacy users.
2. Add an index for `contactNumbersHashes` if phone login traffic grows.
3. Add endpoint-level unit/integration tests for:
   - no match
   - single match
   - multiple matches fallback
   - smsOptIn disabled
   - expired/invalid OTP
