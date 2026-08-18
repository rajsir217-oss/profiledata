---
description: Implement or modify phone-number + SMS OTP login in messenger-web.
---

# Skill: Messenger Phone Login

## Default UX

The messenger-web login screen defaults to **Phone + SMS Code**.

## Flow

1. User enters a phone number.
2. Backend looks up accounts by phone.
3. **One matching account:** send an OTP and proceed to verification.
4. **Multiple matching accounts:** prompt the user to select an account, then send an OTP for the selected username.
5. User enters the SMS code; backend verifies and logs the user in.

## Fallback on repeated failures

If phone flow errors repeat for 3 consecutive send/verify/resend failures:

- Automatically switch the UI to username/password login.
- Show an explanatory message such as "Phone login is unavailable; please use your username and password."

## Error normalization

FastAPI/Pydantic may return a `detail` array or object. Always normalize API errors to plain strings before rendering them:

```javascript
function extractErrorMessage(error) {
  if (!error) return 'An unknown error occurred';
  if (typeof error === 'string') return error;
  if (error.message) return error.message;
  if (Array.isArray(error.detail)) return error.detail.map(d => d.msg || d).join('; ');
  if (typeof error.detail === 'string') return error.detail;
  return JSON.stringify(error);
}
```

## Files involved

- `messenger-web/src/screens/LoginScreen.js` (or equivalent)
- `messenger-web/src/stores/authStore.js` (or equivalent)
- Backend auth endpoints for phone lookup, OTP send, and OTP verify

## Verification

- Test single-account phone login.
- Test multi-account phone login with account selection.
- Test incorrect OTP handling.
- Test 3-failure fallback to username/password.
- Confirm error messages are plain strings and do not crash React.
