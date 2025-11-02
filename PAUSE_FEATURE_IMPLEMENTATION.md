# 🎯 PAUSE FEATURE - Complete Implementation Guide

**Created:** November 2, 2025  
**Status:** 🚧 IN PROGRESS  
**Priority:** 🔥 HIGH  
**Target Completion:** November 8, 2025 (6 days)

---

## 📋 **Executive Summary**

The PAUSE feature allows users to temporarily hide from matchmaking and communication while maintaining their account and subscription. This addresses user needs for breaks from the platform without requiring account deletion.

---

## ✅ **User Requirements (APPROVED)**

| Requirement | Decision | Rationale |
|-------------|----------|-----------|
| **Auto-unpause** | BOTH (scheduled + manual) | Maximum flexibility |
| **Billing** | Continues during pause | Subscription remains active |
| **Notifications** | Stop ALL emails | Complete break experience |
| **Profile editing** | ALLOWED while paused | Users can prepare for return |
| **Pause limit** | Unlimited (for now) | User freedom, monitor for abuse |
| **Un-pause notification** | YES, notify partners | Transparency and re-engagement |

---

## 🏗️ **Architecture Overview**

### **System Components:**

```
┌─────────────────────────────────────────┐
│         Frontend Components             │
├─────────────────────────────────────────┤
│ • PauseSettings.js (modal)              │
│ • Dashboard.js (pause banner)           │
│ • Messages.js (paused indicator)        │
│ • Profile.js (pause status display)     │
│ • UnifiedPreferences.js (toggle)        │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│         API Layer (FastAPI)             │
├─────────────────────────────────────────┤
│ • POST /api/account/pause               │
│ • POST /api/account/unpause             │
│ • GET /api/account/pause-status         │
│ • PATCH /api/account/pause-settings     │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│      Business Logic Layer               │
├─────────────────────────────────────────┤
│ • PauseService (core logic)             │
│ • SearchService (filter paused)         │
│ • MatchingService (skip paused)         │
│ • MessagingService (block paused)       │
│ • NotificationService (suppress)        │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│      Database (MongoDB)                 │
├─────────────────────────────────────────┤
│ • users.accountStatus                   │
│ • users.pausedAt                        │
│ • users.pausedUntil                     │
│ • users.pauseReason                     │
│ • users.pauseMessage                    │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│      Background Jobs                    │
├─────────────────────────────────────────┤
│ • auto_unpause.py (hourly check)        │
│ • pause_reminder_email.py (24h before)  │
│ • unpause_notification.py (on unpause)  │
└─────────────────────────────────────────┘
```

---

## 📊 **Database Schema**

### **New Fields in `users` Collection:**

```javascript
{
  // Existing fields...
  
  // NEW PAUSE FIELDS:
  accountStatus: {
    type: String,
    enum: ["active", "paused", "deactivated"],
    default: "active",
    index: true  // For query performance
  },
  
  pausedAt: {
    type: Date,
    default: null
  },
  
  pausedUntil: {
    type: Date,
    default: null,  // null = manual unpause only
    index: true  // For auto-unpause job
  },
  
  pauseReason: {
    type: String,
    default: null,
    enum: [
      "busy_work",
      "traveling",
      "focusing_match",
      "personal",
      "mental_break",
      "custom"
    ]
  },
  
  pauseMessage: {
    type: String,
    default: null,
    maxLength: 200  // Custom message to show others
  },
  
  pauseCount: {
    type: Number,
    default: 0  // Analytics: track total pauses
  },
  
  lastUnpausedAt: {
    type: Date,
    default: null  // Analytics: when user last returned
  }
}
```

### **Migration Script:**

```javascript
// Run once to add fields to existing users
db.users.updateMany(
  {},
  {
    $set: {
      accountStatus: "active",
      pausedAt: null,
      pausedUntil: null,
      pauseReason: null,
      pauseMessage: null,
      pauseCount: 0,
      lastUnpausedAt: null
    }
  }
);

// Create indexes
db.users.createIndex({ accountStatus: 1 });
db.users.createIndex({ pausedUntil: 1 });
```

---

## 🚀 **PHASE 1: MVP Implementation**

### **Timeline:** Days 1-2

### **1.1 Backend API Endpoints**

**File:** `fastapi_backend/routers/account_status.py` (NEW)

```python
"""
Account Status Management
Handles pause/unpause functionality
"""

from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timedelta
from typing import Optional
from pydantic import BaseModel

from auth.jwt_auth import get_current_user_dependency as get_current_user
from database import get_database
from services.pause_service import PauseService

router = APIRouter(prefix="/api/account", tags=["account"])


class PauseRequest(BaseModel):
    duration: Optional[int] = None  # Days, null = manual only
    reason: Optional[str] = None
    message: Optional[str] = None


class PauseResponse(BaseModel):
    success: bool
    accountStatus: str
    pausedAt: Optional[datetime]
    pausedUntil: Optional[datetime]
    message: str


@router.post("/pause", response_model=PauseResponse)
async def pause_account(
    request: PauseRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Pause user account"""
    pause_service = PauseService(db)
    
    result = await pause_service.pause_user(
        username=current_user["username"],
        duration_days=request.duration,
        reason=request.reason,
        message=request.message
    )
    
    return PauseResponse(**result)


@router.post("/unpause", response_model=PauseResponse)
async def unpause_account(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Unpause user account"""
    pause_service = PauseService(db)
    
    result = await pause_service.unpause_user(
        username=current_user["username"]
    )
    
    return PauseResponse(**result)


@router.get("/pause-status")
async def get_pause_status(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Get current pause status"""
    user = await db.users.find_one({"username": current_user["username"]})
    
    return {
        "accountStatus": user.get("accountStatus", "active"),
        "isPaused": user.get("accountStatus") == "paused",
        "pausedAt": user.get("pausedAt"),
        "pausedUntil": user.get("pausedUntil"),
        "pauseReason": user.get("pauseReason"),
        "pauseMessage": user.get("pauseMessage"),
        "pauseCount": user.get("pauseCount", 0)
    }
```

---

### **1.2 Pause Service (Business Logic)**

**File:** `fastapi_backend/services/pause_service.py` (NEW)

```python
"""
Pause Service
Business logic for account pausing/unpausing
"""

from datetime import datetime, timedelta
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorDatabase


class PauseService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.users_collection = db.users
    
    async def pause_user(
        self,
        username: str,
        duration_days: Optional[int] = None,
        reason: Optional[str] = None,
        message: Optional[str] = None
    ) -> dict:
        """
        Pause user account
        
        Args:
            username: User to pause
            duration_days: Auto-unpause after X days (null = manual)
            reason: Pause reason
            message: Custom message to show others
            
        Returns:
            Dictionary with pause details
        """
        now = datetime.utcnow()
        paused_until = None
        
        if duration_days:
            paused_until = now + timedelta(days=duration_days)
        
        # Update user document
        await self.users_collection.update_one(
            {"username": username},
            {
                "$set": {
                    "accountStatus": "paused",
                    "pausedAt": now,
                    "pausedUntil": paused_until,
                    "pauseReason": reason,
                    "pauseMessage": message
                },
                "$inc": {
                    "pauseCount": 1
                }
            }
        )
        
        # TODO: Send pause confirmation email
        # TODO: Notify conversation partners
        
        return {
            "success": True,
            "accountStatus": "paused",
            "pausedAt": now,
            "pausedUntil": paused_until,
            "message": f"Account paused{f' until {paused_until.strftime(\"%Y-%m-%d\")}' if paused_until else ''}"
        }
    
    async def unpause_user(self, username: str) -> dict:
        """
        Unpause user account
        
        Args:
            username: User to unpause
            
        Returns:
            Dictionary with unpause details
        """
        now = datetime.utcnow()
        
        # Update user document
        await self.users_collection.update_one(
            {"username": username},
            {
                "$set": {
                    "accountStatus": "active",
                    "pausedAt": null,
                    "pausedUntil": null,
                    "pauseReason": null,
                    "pauseMessage": null,
                    "lastUnpausedAt": now
                }
            }
        )
        
        # TODO: Send welcome back email
        # TODO: Notify conversation partners
        
        return {
            "success": True,
            "accountStatus": "active",
            "pausedAt": None,
            "pausedUntil": None,
            "message": "Welcome back! Your account is active again."
        }
    
    async def check_auto_unpause(self):
        """
        Check for users who should be auto-unpaused
        Called by scheduler job
        """
        now = datetime.utcnow()
        
        # Find users with expired pause
        users_to_unpause = await self.users_collection.find({
            "accountStatus": "paused",
            "pausedUntil": {"$lte": now}
        }).to_list(None)
        
        for user in users_to_unpause:
            await self.unpause_user(user["username"])
        
        return len(users_to_unpause)
```

---

### **1.3 Update Search to Filter Paused Users**

**File:** `fastapi_backend/routes.py`

Find the search endpoint and add filter:

```python
# In /api/users/search endpoint:

# ADD THIS LINE:
query["accountStatus"] = {"$ne": "paused"}

# Existing search logic...
```

---

### **1.4 Update L3V3L Matching**

**File:** `fastapi_backend/routes_matches.py`

```python
# In generate_matches() function:

# Skip paused users
if user.get("accountStatus") == "paused":
    continue

# Existing matching logic...
```

---

### **1.5 Update Messaging to Block Paused Users**

**File:** `fastapi_backend/routes_messaging.py`

```python
# In send_message endpoint:

# Check if recipient is paused
recipient = await db.users.find_one({"username": recipient_username})
if recipient.get("accountStatus") == "paused":
    raise HTTPException(
        status_code=403,
        detail="This user is currently taking a break and cannot receive messages"
    )

# Check if sender is paused
if current_user.get("accountStatus") == "paused":
    raise HTTPException(
        status_code=403,
        detail="You cannot send messages while your account is paused"
    )

# Existing send message logic...
```

---

## 🎨 **Frontend Implementation**

### **2.1 Pause Settings Modal**

**File:** `frontend/src/components/PauseSettings.js` (NEW)

```jsx
import React, { useState } from 'react';
import api from '../api';
import './PauseSettings.css';

const PauseSettings = ({ isOpen, onClose, onPause }) => {
  const [duration, setDuration] = useState('manual');
  const [reason, setReason] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const pauseReasons = [
    { value: 'busy_work', label: 'Busy with work' },
    { value: 'traveling', label: 'Traveling/Vacation' },
    { value: 'focusing_match', label: 'Focusing on current match' },
    { value: 'personal', label: 'Personal reasons' },
    { value: 'mental_break', label: 'Need a mental break' },
    { value: 'custom', label: 'Other (specify below)' }
  ];

  const durationOptions = [
    { value: 'manual', label: 'Until I unpause' },
    { value: '7', label: '1 week' },
    { value: '14', label: '2 weeks' },
    { value: '30', label: '1 month' }
  ];

  const handlePause = async () => {
    setLoading(true);
    try {
      const response = await api.post('/api/account/pause', {
        duration: duration === 'manual' ? null : parseInt(duration),
        reason: reason,
        message: customMessage
      });

      onPause(response.data);
      onClose();
    } catch (error) {
      alert('Failed to pause account: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content pause-modal">
        <div className="modal-header">
          <h2>⏸️ Pause Your Profile</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <p className="pause-description">
            Take a break from L3V3LMATCH. Here's what happens:
          </p>

          <ul className="pause-effects">
            <li>✅ Your subscription stays active</li>
            <li>❌ Hidden from all searches</li>
            <li>❌ No new matches generated</li>
            <li>📩 Existing chats become read-only</li>
            <li>👀 You can still view and edit your profile</li>
            <li>⏱️ Un-pause anytime you want</li>
          </ul>

          <div className="form-group">
            <label>How long?</label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            >
              {durationOptions.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Reason (optional)</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            >
              <option value="">Select a reason...</option>
              {pauseReasons.map(r => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Message for others (optional)</label>
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="e.g., 'Taking a break for work. Back soon!'"
              maxLength={200}
            />
            <small>{customMessage.length}/200 characters</small>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-pause"
            onClick={handlePause}
            disabled={loading}
          >
            {loading ? 'Pausing...' : 'Pause My Profile'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PauseSettings;
```

---

## ⏱️ **Timeline & Milestones**

| Phase | Duration | Completion Date | Status |
|-------|----------|-----------------|--------|
| Phase 1: MVP | 2 days | Nov 4, 2025 | 🚧 In Progress |
| Phase 2: Enhanced | 2 days | Nov 6, 2025 | ⏳ Pending |
| Phase 3: Advanced | 2 days | Nov 8, 2025 | ⏳ Pending |
| **TOTAL** | **6 days** | **Nov 8, 2025** | - |

---

## 🎯 **Success Criteria**

- [ ] Users can pause/unpause their accounts
- [ ] Paused users hidden from search
- [ ] Messages blocked to/from paused users
- [ ] Paused indicator shown in conversations
- [ ] Auto-unpause works correctly
- [ ] Email notifications sent
- [ ] Profile editing works while paused
- [ ] Subscription continues during pause
- [ ] Analytics tracking pause metrics

---

**Let's build this! Starting with Phase 1 backend implementation...**
