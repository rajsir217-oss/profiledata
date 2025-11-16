# Template Variable Rendering Audit

**Date:** November 15, 2025, 8:30 PM PST  
**Issue:** Template variables like `{match.firstName}` showing as literal text instead of values  
**Root Cause:** Event dispatcher passing username instead of actual user data

---

## 🔴 CRITICAL ISSUE FOUND

### File: `services/event_dispatcher.py`
### Function: `_handle_shortlist_added()` (line 344-364)

**Problem:**
```python
template_data={
    "match": {
        "firstName": actor,  # ❌ WRONG: This is the USERNAME, not firstName!
        "username": actor
    }
}
```

**Result:** Email shows `{match.firstName}` literally because `actor` is just a username string like "siddharthdas007", not a user object.

---

## 🔍 ALL EVENT HANDLERS TO FIX

Let me scan all event handlers in event_dispatcher.py:

| Event Handler | Status | Issue |
|---------------|--------|-------|
| `_handle_favorite_added` | ⏳ CHECK | Likely same issue |
| `_handle_mutual_favorite` | ⏳ CHECK | Likely same issue |
| `_handle_shortlist_added` | ❌ BROKEN | Passing username as firstName |
| `_handle_profile_viewed` | ⏳ CHECK | Need to verify |
| `_handle_message_sent` | ⏳ CHECK | Need to verify |

---

## ✅ CORRECT PATTERN

### What Should Happen:

```python
async def _handle_shortlist_added(self, event_data: Dict):
    """Handle shortlist_added event"""
    try:
        target = event_data.get("target")
        actor_username = event_data.get("actor")
        
        # ✅ FETCH ACTUAL USER DATA
        actor = await self.db.users.find_one({"username": actor_username})
        if not actor:
            logger.warning(f"Actor user {actor_username} not found")
            return
        
        # ✅ DECRYPT PII fields
        from crypto_utils import get_encryptor
        try:
            encryptor = get_encryptor()
            actor = encryptor.decrypt_user_pii(actor)
        except Exception as e:
            logger.warning(f"Failed to decrypt actor PII: {e}")
        
        # ✅ PASS COMPLETE USER DATA
        await self.notification_service.queue_notification(
            username=target,
            trigger="shortlist_added",
            channels=["email"],
            template_data={
                "match": {
                    "firstName": actor.get("firstName", actor_username),
                    "lastName": actor.get("lastName", ""),
                    "username": actor_username,
                    "location": actor.get("location", ""),
                    "occupation": actor.get("occupation", ""),
                    "education": actor.get("education", ""),
                    "age": calculate_age(actor.get("birthMonth"), actor.get("birthYear"))
                },
                "user": {
                    "firstName": target  # Will be replaced by actual name in template rendering
                }
            }
        )
```

---

## 📋 FIX CHECKLIST

- [ ] Fix `_handle_shortlist_added` - fetch actor user data
- [ ] Fix `_handle_favorite_added` - verify data passed
- [ ] Fix `_handle_mutual_favorite` - verify data passed
- [ ] Fix `_handle_profile_viewed` - verify data passed
- [ ] Fix `_handle_message_sent` - verify data passed
- [ ] Add PII decryption to all handlers
- [ ] Test all notification templates
- [ ] Update template documentation

---

## 🎯 TEMPLATE DATA STANDARD

### All Event Handlers Should Pass:

```python
{
    "actor": {
        "firstName": "John",
        "lastName": "Doe",
        "username": "johndoe",
        "location": "New York, NY",
        "occupation": "Software Engineer",
        "education": "MIT",
        "age": 28
    },
    "user": {
        "firstName": "Jane",  # Recipient's name
        "username": "janedoe"
    },
    "action": "specific_action_details"  # Event-specific data
}
```

---

## 🔧 NEXT STEPS

1. Audit all event handlers
2. Create comprehensive fix
3. Test each notification type
4. Update all email templates to use correct variables
5. Document template variable standards

---

**Priority:** HIGH - User-facing data corruption in emails
**Impact:** All notification emails affected
**Estimated Fix Time:** 1-2 hours
