# Fix: Encrypted PII Data Showing in UI

**Problem:** Encrypted PII fields (location, contactEmail, contactNumber, linkedinUrl) are displaying as encrypted strings like `gAAAAABpEPqDT3xt2lt0iUf2...` instead of decrypted/masked values.

**Root Cause:** Many endpoints return user profiles without using the centralized `decrypt_user_pii` helper function.

---

## Affected Endpoints

| Endpoint | Issue | Status |
|----------|-------|--------|
| `/profile-views/{username}` | Missing PII decryption | ✅ FIXED |
| `/pii-requests/{username}/incoming` | Missing PII decryption | ⏳ NEEDS FIX |
| `/pii-requests/{username}/outgoing` | Missing PII decryption | ⏳ NEEDS FIX |
| `/exclusions/{username}` | Has decrypt but needs verification | ✅ OK |
| `/favorites/{username}` | Has decrypt but needs verification | ✅ OK |
| `/shortlist/{username}` | Has decrypt but needs verification | ✅ OK |
| `/users/search` | Has decrypt but needs verification | ✅ OK |

---

## The Fix Pattern

### ❌ WRONG (Current Code)
```python
requester = await db.users.find_one({"username": req["requesterUsername"]})
if requester:
    requester.pop("password", None)
    requester["_id"] = str(requester["_id"])
    requester["images"] = [get_full_image_url(img) for img in requester.get("images", [])]
    # ❌ No decryption! Returns encrypted PII
```

### ✅ CORRECT (Fixed Code)
```python
requester = await db.users.find_one({"username": req["requesterUsername"]})
if requester:
    requester.pop("password", None)
    requester["_id"] = str(requester["_id"])
    
    # ✅ Decrypt PII fields
    from crypto_utils import get_encryptor
    try:
        encryptor = get_encryptor()
        requester = encryptor.decrypt_user_pii(requester)
    except Exception as decrypt_err:
        logger.warning(f"⚠️ Decryption skipped for {requester.get('username')}: {decrypt_err}")
    
    requester["images"] = [get_full_image_url(img) for img in requester.get("images", [])]
```

---

## Implementation Plan

1. **Audit all endpoints** that return user profiles
2. **Add `decrypt_user_pii` call** before building response
3. **Test each endpoint** to verify decryption works
4. **Consider privacy**: Mask PII where appropriate (e.g., phone numbers in lists)

---

## Encrypted Fields (from crypto_utils.py)

```python
ENCRYPTED_FIELDS = {
    'contactEmail',
    'contactNumber',
    'location',        # ← This is what you're seeing encrypted!
    'linkedinUrl',
}
```

---

## Next Steps

1. Fix PII requests endpoints (incoming/outgoing)
2. Audit all remaining endpoints
3. Add integration tests to prevent regression
4. Document PII handling in API docs

---

**Created:** November 15, 2025
**Priority:** HIGH - User-facing data corruption
