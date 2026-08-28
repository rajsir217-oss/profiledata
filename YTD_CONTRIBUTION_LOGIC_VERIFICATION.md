# YTD Contribution Logic Verification

## Overview

This document verifies the logic for calculating current-year contributions and updating membership tenure validity before the Contribution Popup shows.

---

## Backend Logic Flow

### 1. YTD Contribution Calculation (`get_ytd_contributions`)

**Location:** `fastapi_backend/routers/contribution_routes.py:29-58`

**Logic:**
```python
async def get_ytd_contributions(username: str, db: AsyncIOMotorDatabase) -> float:
    current_year = datetime.now().year
    start_of_year = datetime(current_year, 1, 1)
    end_of_year = datetime(current_year, 12, 31, 23, 59, 59)
    
    result = await db.payments.aggregate([
        {
            "$match": {
                "username": username,
                # Only real contribution flows (not admin-granted membership rows)
                "paymentType": {"$in": ["contribution_one_time", "contribution_recurring"]},
                "status": {"$in": ["completed", "succeeded", "paid", None]},
                "createdAt": {"$gte": start_of_year, "$lte": end_of_year}
            }
        },
        {
            "$group": {
                "_id": None,
                "totalAmount": {"$sum": "$amount"}
            }
        }
    ]).to_list(length=1)
    
    return result[0]["totalAmount"] if result else 0.0
```

**Key Points:**
- Only counts `contribution_one_time` and `contribution_recurring` payment types
- Excludes `membership_one_time`, `membership_3_month`, `membership_1_year` (admin-granted)
- Only counts completed/succeeded/paid payments
- Filters by current calendar year (Jan 1 - Dec 31)
- Returns 0.0 if no payments found

---

### 2. Membership Access Check (`check_membership_access`)

**Location:** `fastapi_backend/routers/contribution_routes.py:61-136`

**Logic Flow:**

```
1. Check if user is admin or moderator → bypass all checks
2. Calculate YTD contributions via get_ytd_contributions()
3. If YTD ≥ $60 and not already treated as one-time:
   - Update user membership to one_time active
   - Set treatedAsOneTime = true
   - Set ytdPaid = YTD total
   - Set startDate = now
   - Return hasAccess = true
4. If membership.type == "none" or missing:
   - Return hasAccess = false
5. Check grace period:
   - If status == "grace_period" and gracePeriodEnds > now:
     - Return hasAccess = true
   - Else mark as expired
6. If status == "expired":
   - Return hasAccess = false
7. If type in ["3_month", "1_year"] and endDate < now:
   - Enter 5-day grace period
   - Return hasAccess = true
8. Otherwise:
   - Return hasAccess = true
```

**Key Points:**
- YTD threshold of $60 automatically grants one-time membership
- Admin/moderator bypass
- Grace period handling for expired subscriptions
- Auto-updates membership when YTD threshold is met

---

### 3. Contribution Status Endpoint (`/contribution-status`)

**Location:** `fastapi_backend/routers/contribution_routes.py:357-440`

**Logic Flow:**

```
1. Fetch user from database
2. Call check_membership_access() to get:
   - hasAccess (boolean)
   - ytdPaid (float)
   - reason (string)
3. Determine popup behavior:
   - If hasAccess == true → show_popup = false
   - Else if ytdPaid >= 60 → show_popup = false (should be treated as one-time)
   - Else → show_popup = true (membership required)
4. Return response with:
   - siteEnabled (boolean)
   - userDisabledByAdmin (boolean)
   - membership.hasAccess
   - membership.ytdPaid
   - membership.type
   - membership.status
   - ... other fields
```

**Key Points:**
- Calls `check_membership_access()` internally
- Returns `ytdPaid` in the response
- Determines whether popup should show based on access status

---

## Frontend Logic Flow

### 1. Contribution Popup Hook (`useContributionPopup`)

**Location:** `frontend/src/hooks/useContributionPopup.js:85-100`

**Logic Flow:**

```
1. Fetch contribution status from /api/contributions/contribution-status
2. Check membership.hasAccess:
   - If false → set shouldShowContribution = true
   - If false and not already shown this session → open popup
3. If hasAccess == true → continue to silence/dismiss checks
```

**Key Points:**
- Uses `membership.hasAccess` from backend response
- Shows popup immediately if no access (activation flow)
- Session-based popup suppression

---

### 2. Contribution Popup Display (`ContributionPopup.js`)

**Location:** `frontend/src/components/ContributionPopup.js:727-731`

**Debug Line:**
```jsx
{contributionStatus?.membership && (
  <div className="contribution-debug-line">
    📊 YTD contributions (current year): ${Number(contributionStatus.membership.ytdPaid || 0).toFixed(2)}
  </div>
)}
```

**Key Points:**
- Displays YTD total from `membership.ytdPaid`
- Shows to user for transparency

---

### 3. TopBar Membership Status (`TopBar.js`)

**Location:** `frontend/src/components/TopBar.js:53-70`

**Logic Flow:**

```javascript
const getMembershipMicroLabel = useCallback((membership) => {
  if (!membership) return 'Loading...';
  if (!membership.hasAccess) return 'No membership';

  if (membership.type === 'one_time') {
    const ytdPaid = Number(membership.ytdPaid || 0);
    if (ytdPaid >= 200) return '🙏 36-Months';
    if (ytdPaid >= 175) return '🙏 24-Months';
    if (ytdPaid >= 150) return '🙏 18-Months';
    if (ytdPaid >= 100) return '🙏 12-Months';
    const proratedMonths = Math.floor(ytdPaid / 10);
    if (proratedMonths >= 6) return `🙏 ${proratedMonths}-Months`;
    return '✅ Active';
  }
  if (membership.type === '3_month') return '⏰ 3-Month';
  if (membership.type === '1_year') return '⭐ 1-Year';
  return '✅ Active';
}, []);
```

**Key Points:**
- Uses `ytdPaid` to determine tier label for one-time members
- Prorated at $10/month (floor division)
- Tier overrides at $100, $150, $175, $200

---

### 4. Contribution Popup Tier Calculation (`ContributionPopup.js`)

**Location:** `frontend/src/components/ContributionPopup.js:9-16, 202-209`

**Constants:**
```javascript
const ACTIVATION_MIN_AMOUNT = 60;
const PRORATE_PER_MONTH = 10;
const ACTIVATION_TIER_MONTHS = {
  60: 6,
  100: 12,
  150: 18,
  175: 24,
  200: 36,
};
```

**Calculation:**
```javascript
const getActivationMonthsLabel = useCallback((amount) => {
  const numericAmount = Number(amount);
  const tierMonths = ACTIVATION_TIER_MONTHS[numericAmount];
  if (tierMonths) return `${tierMonths} months`;

  const proratedMonths = Math.floor(numericAmount / PRORATE_PER_MONTH);
  return `${Math.max(proratedMonths, 0)} months`;
}, []);
```

**Key Points:**
- Tier overrides for specific amounts
- Default proration at $10/month
- Minimum $60 for activation

---

## Example Scenarios

### Example 1: New User (No Contributions)

**Database State:**
```json
{
  "username": "newuser",
  "membership": {
    "type": "none"
  }
}
```

**db.payments:** Empty

**YTD Calculation:**
- Query matches: 0
- YTD total: $0.00

**Membership Check:**
- YTD < $60
- membership.type == "none"
- hasAccess: false
- reason: "no_membership"

**Popup Behavior:**
- show_popup: true
- Popup opens with activation flow
- Debug line: "📊 YTD contributions (current year): $0.00"

**TopBar Status:**
- Label: "No membership"

---

### Example 2: User with $60 Contribution (Current Year)

**Database State:**
```json
{
  "username": "user60",
  "membership": {
    "type": "none"
  }
}
```

**db.payments:**
```json
[
  {
    "username": "user60",
    "paymentType": "contribution_one_time",
    "amount": 60,
    "status": "completed",
    "createdAt": "2026-08-27T10:00:00Z"
  }
]
```

**YTD Calculation:**
- Query matches: 1 (contribution_one_time, completed, 2026)
- YTD total: $60.00

**Membership Check:**
- YTD >= $60
- treatedAsOneTime is false
- **Auto-update:**
  ```json
  {
    "membership": {
      "type": "one_time",
      "status": "active",
      "treatedAsOneTime": true,
      "ytdPaid": 60.00,
      "startDate": "2026-08-27T10:00:00Z"
    }
  }
  ```
- hasAccess: true
- reason: "ytd_threshold_met"

**Popup Behavior:**
- show_popup: false
- Popup does not show

**TopBar Status:**
- Label: "🙏 6-Months" (tier override)

---

### Example 3: User with $100 Contribution (Current Year)

**Database State:**
```json
{
  "username": "user100",
  "membership": {
    "type": "one_time",
    "treatedAsOneTime": true,
    "ytdPaid": 100.00
  }
}
```

**db.payments:**
```json
[
  {
    "username": "user100",
    "paymentType": "contribution_one_time",
    "amount": 100,
    "status": "completed",
    "createdAt": "2026-08-27T10:00:00Z"
  }
]
```

**YTD Calculation:**
- Query matches: 1
- YTD total: $100.00

**Membership Check:**
- YTD >= $60
- treatedAsOneTime is true (already set)
- hasAccess: true
- reason: "active_membership"

**Popup Behavior:**
- show_popup: false

**TopBar Status:**
- Label: "🙏 12-Months" (tier override)

---

### Example 4: User with $85 Contribution (Current Year)

**Database State:**
```json
{
  "username": "user85",
  "membership": {
    "type": "one_time",
    "treatedAsOneTime": true,
    "ytdPaid": 85.00
  }
}
```

**db.payments:**
```json
[
  {
    "username": "user85",
    "paymentType": "contribution_one_time",
    "amount": 85,
    "status": "completed",
    "createdAt": "2026-08-27T10:00:00Z"
  }
]
```

**YTD Calculation:**
- Query matches: 1
- YTD total: $85.00

**Membership Check:**
- YTD >= $60
- treatedAsOneTime is true
- hasAccess: true

**Popup Behavior:**
- show_popup: false

**TopBar Status:**
- Label: "🙏 8-Months" (prorated: 85 / 10 = 8.5 → floor to 8)

---

### Example 5: User with $30 Admin-Granted Membership (Old)

**Database State:**
```json
{
  "username": "user30",
  "membership": {
    "type": "none"
  }
}
```

**db.payments:**
```json
[
  {
    "username": "user30",
    "paymentType": "membership_3_month",
    "amount": 30,
    "status": "completed",
    "createdAt": "2026-01-15T10:00:00Z"
  }
]
```

**YTD Calculation:**
- Query matches: 0 (paymentType "membership_3_month" is excluded)
- YTD total: $0.00

**Membership Check:**
- YTD < $60
- membership.type == "none"
- hasAccess: false

**Popup Behavior:**
- show_popup: true
- Debug line: "📊 YTD contributions (current year): $0.00"

**TopBar Status:**
- Label: "No membership"

**Note:** Old admin-granted membership payments are NOT counted toward YTD because they use `membership_*` payment types, not `contribution_*`.

---

### Example 6: User with Multiple Contributions (Current Year)

**Database State:**
```json
{
  "username": "usermulti",
  "membership": {
    "type": "one_time",
    "treatedAsOneTime": true,
    "ytdPaid": 150.00
  }
}
```

**db.payments:**
```json
[
  {
    "username": "usermulti",
    "paymentType": "contribution_one_time",
    "amount": 60,
    "status": "completed",
    "createdAt": "2026-02-01T10:00:00Z"
  },
  {
    "username": "usermulti",
    "paymentType": "contribution_recurring",
    "amount": 50,
    "status": "succeeded",
    "createdAt": "2026-06-15T10:00:00Z"
  },
  {
    "username": "usermulti",
    "paymentType": "contribution_one_time",
    "amount": 40,
    "status": "completed",
    "createdAt": "2026-08-20T10:00:00Z"
  }
]
```

**YTD Calculation:**
- Query matches: 3 (all contribution types, all 2026)
- YTD total: $60 + $50 + $40 = $150.00

**Membership Check:**
- YTD >= $60
- treatedAsOneTime is true
- hasAccess: true

**Popup Behavior:**
- show_popup: false

**TopBar Status:**
- Label: "🙏 18-Months" (tier override for $150)

---

### Example 7: User with Contribution from Previous Year

**Database State:**
```json
{
  "username": "userold",
  "membership": {
    "type": "none"
  }
}
```

**db.payments:**
```json
[
  {
    "username": "userold",
    "paymentType": "contribution_one_time",
    "amount": 100,
    "status": "completed",
    "createdAt": "2025-12-15T10:00:00Z"
  }
]
```

**YTD Calculation:**
- Query matches: 0 (createdAt is 2025, not 2026)
- YTD total: $0.00

**Membership Check:**
- YTD < $60
- membership.type == "none"
- hasAccess: false

**Popup Behavior:**
- show_popup: true
- Debug line: "📊 YTD contributions (current year): $0.00"

**TopBar Status:**
- Label: "No membership"

**Note:** Only current-year contributions count. Previous year contributions do not carry over.

---

### Example 8: Admin User (Bypass)

**Database State:**
```json
{
  "username": "adminuser",
  "role": "admin",
  "membership": {
    "type": "none"
  }
}
```

**db.payments:** Empty

**YTD Calculation:**
- Query matches: 0
- YTD total: $0.00

**Membership Check:**
- role == "admin"
- **Bypass:** hasAccess: true
- reason: "admin_or_moderator"

**Popup Behavior:**
- show_popup: false

**TopBar Status:**
- Label: "✅ Active" (or admin-specific label)

**Note:** Admins bypass all membership checks regardless of YTD.

---

## Summary Table

| Scenario | YTD Total | hasAccess | Popup Shows | TopBar Label |
|----------|-----------|-----------|-------------|--------------|
| New user (no contributions) | $0.00 | false | Yes | No membership |
| $60 contribution (current year) | $60.00 | true | No | 🙏 6-Months |
| $100 contribution (current year) | $100.00 | true | No | 🙏 12-Months |
| $85 contribution (current year) | $85.00 | true | No | 🙏 8-Months |
| $30 admin-granted (old) | $0.00 | false | Yes | No membership |
| Multiple contributions ($150 total) | $150.00 | true | No | 🙏 18-Months |
| Previous year contribution only | $0.00 | false | Yes | No membership |
| Admin user (no contributions) | $0.00 | true | No | ✅ Active |

---

## Verification Checklist

- [x] YTD calculation only counts `contribution_one_time` and `contribution_recurring`
- [x] YTD calculation filters by current calendar year
- [x] YTD calculation only counts completed/succeeded/paid payments
- [x] YTD threshold of $60 auto-updates membership to one_time
- [x] Admin/moderator bypass works correctly
- [x] Frontend popup uses `membership.hasAccess` from backend
- [x] TopBar displays correct tier based on `ytdPaid`
- [x] Debug line shows accurate YTD total
- [x] Previous year contributions do not count
- [x] Admin-granted membership payments do not count toward YTD

---

## Conclusion

The logic is verified to work as intended:

1. **YTD Calculation:** Correctly aggregates only real contribution flows for the current year
2. **Membership Update:** Automatically grants one-time membership when YTD ≥ $60
3. **Popup Behavior:** Shows when user lacks access, hides when access is granted
4. **UI Display:** TopBar and debug line accurately reflect YTD total and tier status
5. **Edge Cases:** Admin bypass, previous year contributions, and admin-granted payments are handled correctly
