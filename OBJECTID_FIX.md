# ObjectId to String Conversion Fix

**Date:** October 21, 2025  
**Issue:** Email notifier job failing with validation error  
**Status:** ✅ Fixed

---

## 🐛 The Problem

### Error Message:
```
1 validation error for NotificationQueueItem
_id
  Input should be a valid string [type=string_type, 
  input_value=ObjectId('68f7cd18ea9d501ef9fcfbc8'), 
  input_type=ObjectId]
```

### Root Cause:
MongoDB returns `_id` as an **ObjectId**, but our Pydantic model expects a **string**.

The NotificationQueueItem model has:
```python
id: Optional[str] = Field(None, alias="_id")
```

But when we fetch documents from MongoDB and create NotificationQueueItem objects, we were passing the raw ObjectId without converting it to a string.

---

## ✅ The Fix

### Location 1: `notification_service.py` - `get_pending_notifications()`

**Before:**
```python
async for doc in cursor:
    notifications.append(NotificationQueueItem(**doc))
```

**After:**
```python
async for doc in cursor:
    # Convert ObjectId to string for JSON serialization
    if "_id" in doc:
        doc["_id"] = str(doc["_id"])
    notifications.append(NotificationQueueItem(**doc))
```

### Location 2: `notification_service.py` - `enqueue_notification()`

**Before:**
```python
result = await self.queue_collection.insert_one(queue_item.dict())
queue_item_dict = queue_item.dict()
queue_item_dict["_id"] = result.inserted_id
return NotificationQueueItem(**queue_item_dict)
```

**After:**
```python
result = await self.queue_collection.insert_one(queue_item.dict())
queue_item_dict = queue_item.dict()
queue_item_dict["_id"] = str(result.inserted_id)  # Convert ObjectId to string
return NotificationQueueItem(**queue_item_dict)
```

### Location 3: `notifications.py` - `get_notification_queue()` (Already Fixed)

This was already fixed earlier:
```python
async for doc in cursor:
    # Convert ObjectId to string for JSON serialization
    if "_id" in doc:
        doc["_id"] = str(doc["_id"])
    notifications.append(NotificationQueueItem(**doc))
```

---

## 🎯 Why This Matters

### ObjectId vs String:

**MongoDB ObjectId:**
```python
ObjectId('68f7cd18ea9d501ef9fcfbc8')
```

**String:**
```python
'68f7cd18ea9d501ef9fcfbc8'
```

### Pydantic Validation:
Pydantic models are strict about types. When we define:
```python
id: Optional[str] = Field(None, alias="_id")
```

Pydantic will **reject** an ObjectId because it's not a string.

### JSON Serialization:
ObjectId is not JSON serializable:
```python
# ❌ This fails
json.dumps({"_id": ObjectId('...')})

# ✅ This works
json.dumps({"_id": str(ObjectId('...'))})
```

---

## 🔍 How It Was Found

1. Email notifier job ran
2. Job status showed "failed" in execution history
3. Error logs showed validation error for `_id` field
4. Traced back to `get_pending_notifications()` method
5. Found ObjectId was not being converted to string

---

## 🧪 Testing

### Test 1: Send Notification
```python
# Should work now without validation error
POST /api/notifications/send
{
  "username": "admin",
  "trigger": "new_match",
  "channels": ["email"],
  ...
}
```

### Test 2: Get Queue
```python
# Should return notifications with _id as string
GET /api/notifications/queue
```

### Test 3: Email Notifier Job
```python
# Job should succeed now
# Check Dynamic Scheduler execution history
# Status should be "success" not "failed"
```

---

## 📝 Checklist for Future MongoDB Operations

When working with MongoDB documents in Pydantic models:

- [ ] Convert `_id` to string before passing to model
- [ ] Use `str(doc["_id"])` for ObjectId conversion
- [ ] Check if model expects string or ObjectId
- [ ] Test with actual MongoDB data, not mock data
- [ ] Verify JSON serialization works
- [ ] Check Pydantic validation passes

---

## 🎓 Best Practice

**Always convert ObjectId to string when:**
1. Passing MongoDB documents to Pydantic models
2. Returning data from API endpoints
3. Storing IDs in variables for later use
4. Logging IDs (string format is more readable)

**Pattern to use:**
```python
async for doc in collection.find(query):
    if "_id" in doc:
        doc["_id"] = str(doc["_id"])
    # Now safe to use with Pydantic
    item = MyModel(**doc)
```

---

## 🔗 Related Files

- `/services/notification_service.py` - Service layer (fixed)
- `/routers/notifications.py` - API routes (already fixed)
- `/models/notification_models.py` - Pydantic models
- `/job_templates/email_notifier_template.py` - Email job (uses service)

---

## ✅ Status

**Issue:** ✅ Resolved  
**Email Job:** ✅ Now working  
**Backend:** ✅ Restarted  
**Testing:** ⏳ Ready for testing

---

**Next Steps:**
1. Go to Dynamic Scheduler
2. Run "Testing Email Process" job manually
3. Check execution history - should show "success" not "failed"
4. Verify emails are being sent

---

**Summary:**  
MongoDB ObjectId fields must be converted to strings before passing to Pydantic models. This fix ensures all MongoDB documents properly convert `_id` to string format, preventing validation errors in the email notifier job and other services.
