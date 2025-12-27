# 🎫 Promo Code System - Design Document

**Created:** December 26, 2025  
**Status:** Phase 1 Complete  
**Author:** System Architecture

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Business Goals](#business-goals)
3. [Architecture](#architecture)
4. [Data Models](#data-models)
5. [API Endpoints](#api-endpoints)
6. [Frontend Components](#frontend-components)
7. [Phase 1 Implementation (Complete)](#phase-1-implementation-complete)
8. [Phase 2: Promo Code Manager (Planned)](#phase-2-promo-code-manager-planned)
9. [Phase 3: QR Code Generation (Planned)](#phase-3-qr-code-generation-planned)
10. [Phase 4: Membership Integration (Planned)](#phase-4-membership-integration-planned)
11. [Phase 5: Analytics Dashboard (Planned)](#phase-5-analytics-dashboard-planned)
12. [Migration Guide](#migration-guide)
13. [Testing](#testing)

---

## Overview

The Promo Code System enables USVedika/L3V3LMATCH to:
- Track user referrals through unique promo codes
- Create community and event-specific codes for marketing
- Generate QR codes for offline distribution
- Link promo codes to membership discounts
- Analyze marketing campaign effectiveness

### System Separation

| System | Purpose | Relationship |
|--------|---------|--------------|
| **Promo Code Management** | Create/manage codes, discounts, QR codes, analytics | Master data |
| **Invitation Management** | Send invitations to specific people | Uses promo codes |
| **User Referrals** | Each user has a personal promo code | Auto-applied on invites |

---

## Business Goals

| Goal | Description | Phase |
|------|-------------|-------|
| **User Referrals** | Every user has a personal promo code for referrals | ✅ Phase 1 |
| **Community Marketing** | Create codes for communities (Telugu Assoc, Desi NYC) | Phase 2 |
| **Event Marketing** | Create event-specific codes (Diwali 2025, Wedding Expo) | Phase 2 |
| **QR Code Distribution** | Generate QR codes with invitation links | Phase 3 |
| **Membership Discounts** | Link promo codes to membership fee discounts | Phase 4 |
| **Campaign Analytics** | Track which codes bring users and revenue | Phase 5 |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                       PROMO CODE SYSTEM                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌────────────────┐   ┌────────────────┐   ┌────────────────┐      │
│  │  ADMIN PANEL   │   │  COMMUNITY/    │   │    USER        │      │
│  │  (Full CRUD)   │   │  EVENT CODES   │   │  REFERRALS     │      │
│  └───────┬────────┘   └───────┬────────┘   └───────┬────────┘      │
│          │                    │                    │                │
│          ▼                    ▼                    ▼                │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                 PROMO CODE SERVICE                           │   │
│  │  • Create/Edit/Delete codes                                  │   │
│  │  • Validate codes                                            │   │
│  │  • Track usage & analytics                                   │   │
│  │  • Generate QR codes (Phase 3)                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│          ┌───────────────────┼───────────────────┐                 │
│          ▼                   ▼                   ▼                  │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐           │
│  │  INVITATION  │   │  MEMBERSHIP  │   │  ANALYTICS   │           │
│  │   SYSTEM     │   │   PRICING    │   │  DASHBOARD   │           │
│  │  (Phase 1)   │   │  (Phase 4)   │   │  (Phase 5)   │           │
│  └──────────────┘   └──────────────┘   └──────────────┘           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Models

### 1. Promo Codes Collection (`promo_codes`)

```javascript
{
  _id: ObjectId,
  code: "TELUGU_ASSOC_2025",      // Unique promo code (uppercase)
  name: "Telugu Association 2025", // Display name
  type: "community",              // community | event | referral | campaign
  description: "For Telugu Association members",
  
  // Discount Configuration
  discountType: "percentage",     // percentage | fixed | none
  discountValue: 20,              // 20% off or $20 off
  applicablePlans: ["premium", "gold"],
  
  // Validity
  validFrom: ISODate,
  validUntil: ISODate,
  maxUses: 500,                   // null = unlimited
  currentUses: 127,
  isActive: true,
  
  // Creator Info
  createdBy: "admin",
  linkedToUser: "john_doe",       // For referral codes
  
  // QR Code (Phase 3)
  qrCodeUrl: "/qr/TELUGU_ASSOC_2025.png",
  invitationLink: "https://usvedika.com/register?promo=TELUGU_ASSOC_2025",
  
  // Analytics
  registrations: 45,              // Users who registered
  conversions: 12,                // Users who became paid members
  revenue: 2400,                  // Total revenue from this code
  
  // Tags
  tags: ["community", "telugu", "2025"],
  
  // Timestamps
  createdAt: ISODate,
  updatedAt: ISODate
}
```

### 2. Users Collection Updates

```javascript
{
  username: "john_doe",
  // ... existing fields
  
  promoCode: "USVEDIKA",          // User's personal referral code
  registeredWithCode: "TELUGU_ASSOC", // Code used during registration
  referredBy: "jane_smith",       // Username who referred (if referral code)
  
  // Membership Discount Applied (Phase 4)
  membershipDiscount: {
    code: "TELUGU_ASSOC",
    discountApplied: 20,
    discountType: "percentage"
  }
}
```

### 3. Invitations Collection Updates

```javascript
{
  // ... existing fields
  promoCode: "USVEDIKA",          // Promo code attached to invitation
}
```

---

## API Endpoints

### Base URL: `/api/promo-codes`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/` | Create new promo code | Admin |
| `GET` | `/` | List all promo codes | Admin |
| `GET` | `/dropdown` | Get codes for dropdown | User |
| `GET` | `/stats` | Get overall statistics | Admin |
| `GET` | `/validate/{code}` | Validate a promo code | Public |
| `GET` | `/my-code` | Get current user's code | User |
| `GET` | `/{code}` | Get specific promo code | Admin |
| `PUT` | `/{code}` | Update promo code | Admin |
| `DELETE` | `/{code}` | Delete promo code | Admin |
| `POST` | `/{code}/increment-usage` | Increment usage count | Admin |
| `POST` | `/{code}/record-conversion` | Record conversion | Admin |
| `PUT` | `/user/{username}/promo-code` | Set user's promo code | Admin |
| `GET` | `/user/{username}/promo-code` | Get user's promo code | User/Admin |

### Request/Response Examples

#### Create Promo Code
```bash
POST /api/promo-codes
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "code": "DIWALI2025",
  "name": "Diwali 2025 Special",
  "type": "event",
  "description": "Special discount for Diwali 2025 event attendees",
  "discountType": "percentage",
  "discountValue": 25,
  "applicablePlans": ["premium"],
  "validFrom": "2025-10-01T00:00:00Z",
  "validUntil": "2025-11-30T23:59:59Z",
  "maxUses": 100,
  "tags": ["event", "diwali", "2025"]
}
```

#### Validate Promo Code (Public)
```bash
GET /api/promo-codes/validate/DIWALI2025

Response:
{
  "valid": true,
  "code": "DIWALI2025",
  "name": "Diwali 2025 Special",
  "discountType": "percentage",
  "discountValue": 25,
  "applicablePlans": ["premium"]
}
```

#### Get User's Promo Code
```bash
GET /api/promo-codes/my-code
Authorization: Bearer <user_token>

Response:
{
  "username": "john_doe",
  "promoCode": "USVEDIKA"
}
```

---

## Frontend Components

### 1. InvitationManager.js (Admin)

**Changes:**
- Added promo code dropdown in invitation modal
- Loads available promo codes from `/api/promo-codes/dropdown`
- Admin can select which promo code to attach

**UI:**
```
┌─────────────────────────────────────┐
│ ✉️ Create New Invitation            │
├─────────────────────────────────────┤
│ Name *         [________________]   │
│ Email *        [________________]   │
│ Phone          [________________]   │
│ Channel        [Email Only    ▼]   │
│ Promo Code 🎫  [USVEDIKA - USVedika Default (referral) ▼] │
│ Email Subject  [________________]   │
│ Custom Message [________________]   │
│ ☑ Send immediately                  │
├─────────────────────────────────────┤
│            [Cancel] [Create]        │
└─────────────────────────────────────┘
```

### 2. InviteFriends.js (User)

**Changes:**
- Auto-loads user's personal promo code
- Automatically attaches promo code to invitations (hidden from UI)
- No visible promo code field (seamless experience)

**Behavior:**
1. On mount, fetches `/api/promo-codes/my-code`
2. Stores user's promo code in state
3. When sending invitation, auto-includes `promoCode` in request body

### 3. UserManagement.js (Admin)

**Changes:**
- Added "Promo Code" column to users table
- Displays user's promo code with 🎫 badge
- Column is sortable

**UI:**
```
┌──────────┬──────────┬───────┬────────┬──────────────┬─────────┐
│ Username │ Name     │ Email │ Role   │ Promo Code   │ Created │
├──────────┼──────────┼───────┼────────┼──────────────┼─────────┤
│ john_doe │ John Doe │ j@... │ Premium│ 🎫 USVEDIKA  │ Dec 26  │
│ jane_s   │ Jane S.  │ j@... │ Free   │ 🎫 USVEDIKA  │ Dec 25  │
└──────────┴──────────┴───────┴────────┴──────────────┴─────────┘
```

---

## Phase 1 Implementation (Complete)

### Files Created

| File | Purpose |
|------|---------|
| `models/promo_code_models.py` | Pydantic models for promo codes |
| `services/promo_code_service.py` | Business logic for promo code management |
| `routers/promo_codes.py` | API endpoints |
| `migrations/add_promo_codes.py` | Migration script |

### Files Modified

| File | Changes |
|------|---------|
| `models/invitation_models.py` | Added `promoCode` field |
| `services/invitation_service.py` | Store promo code with invitation |
| `main.py` | Registered promo codes router |
| `InvitationManager.js` | Added promo code dropdown |
| `InviteFriends.js` | Auto-apply user's promo code |
| `UserManagement.js` | Added Promo Code column |
| `UserManagement.css` | Added `.promo-code-badge` style |

### Running the Migration

```bash
cd fastapi_backend
python migrations/add_promo_codes.py
```

**What it does:**
1. Adds `promoCode: "USVEDIKA"` to all existing users
2. Creates default "USVEDIKA" promo code in `promo_codes` collection
3. Creates indexes for efficient queries

---

## Phase 2: Promo Code Manager (Planned)

### New Admin Page: `/promo-code-manager`

**Features:**
- Full CRUD for promo codes
- Create community codes (TELUGU_ASSOC, DESI_NYC)
- Create event codes (DIWALI2025, WEDDING_EXPO)
- Set discount type, value, validity period
- View usage statistics per code
- Filter by type, status, date range

**UI Mockup:**
```
┌─────────────────────────────────────────────────────────────────┐
│ 🎫 Promo Code Manager                          [+ Create Code]  │
├─────────────────────────────────────────────────────────────────┤
│ Filters: [Type ▼] [Status ▼] [Search...]                       │
├─────────────────────────────────────────────────────────────────┤
│ Code          │ Name              │ Type    │ Uses  │ Actions   │
├───────────────┼───────────────────┼─────────┼───────┼───────────┤
│ TELUGU_ASSOC  │ Telugu Assoc 2025 │ Community│ 45/500│ ✏️ 🗑️ 📊 │
│ DIWALI2025    │ Diwali Special    │ Event   │ 12/100│ ✏️ 🗑️ 📊 │
│ USVEDIKA      │ Default Referral  │ Referral│ 234/∞ │ 📊       │
└───────────────┴───────────────────┴─────────┴───────┴───────────┘
```

---

## Phase 3: QR Code Generation (Planned)

### Features

1. **Generate QR Code** for any promo code
2. **QR contains** invitation link with promo code
3. **Download** as PNG/SVG
4. **Printable cards** for events

### Technical Implementation

```python
# Using qrcode library
import qrcode
from io import BytesIO

def generate_qr_code(promo_code: str, base_url: str) -> bytes:
    invitation_link = f"{base_url}/register?promo={promo_code}"
    
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(invitation_link)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    return buffer.getvalue()
```

### API Endpoint

```bash
GET /api/promo-codes/{code}/qr-code
Response: image/png (QR code image)
```

### UI

```
┌─────────────────────────────────────┐
│ 📱 QR Code for TELUGU_ASSOC         │
├─────────────────────────────────────┤
│                                     │
│         ██████████████████          │
│         ██              ██          │
│         ██  ██████████  ██          │
│         ██  ██      ██  ██          │
│         ██  ██████████  ██          │
│         ██              ██          │
│         ██████████████████          │
│                                     │
│  Link: usvedika.com/register?promo= │
│        TELUGU_ASSOC                 │
├─────────────────────────────────────┤
│  [Download PNG] [Download SVG]      │
│  [Print Card]                       │
└─────────────────────────────────────┘
```

---

## Phase 4: Membership Integration (Planned)

### Features

1. **Validate promo code** at checkout
2. **Apply discount** to membership fee
3. **Track conversions** (registration → paid member)
4. **Revenue attribution** by promo code

### Checkout Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 💳 Upgrade to Premium                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Premium Membership                           $99.00/year       │
│                                                                 │
│  Promo Code: [DIWALI2025    ] [Apply]                          │
│              ✅ 25% discount applied!                           │
│                                                                 │
│  ─────────────────────────────────────────────                 │
│  Subtotal                                     $99.00            │
│  Discount (DIWALI2025 - 25%)                 -$24.75            │
│  ─────────────────────────────────────────────                 │
│  Total                                        $74.25            │
│                                                                 │
│                              [Proceed to Payment]               │
└─────────────────────────────────────────────────────────────────┘
```

### Backend Logic

```python
async def apply_promo_code_to_checkout(
    promo_code: str,
    plan: str,
    base_price: float
) -> dict:
    validation = await promo_service.validate_promo_code(promo_code)
    
    if not validation["valid"]:
        return {"error": validation["reason"]}
    
    if plan not in validation["applicablePlans"]:
        return {"error": "Code not valid for this plan"}
    
    discount = 0
    if validation["discountType"] == "percentage":
        discount = base_price * (validation["discountValue"] / 100)
    elif validation["discountType"] == "fixed":
        discount = min(validation["discountValue"], base_price)
    
    return {
        "originalPrice": base_price,
        "discount": discount,
        "finalPrice": base_price - discount,
        "promoCode": promo_code,
        "discountType": validation["discountType"],
        "discountValue": validation["discountValue"]
    }
```

---

## Phase 5: Analytics Dashboard (Planned)

### Features

1. **Overall metrics** - Total codes, registrations, conversions, revenue
2. **Code performance** - Top performing codes
3. **Trend charts** - Registrations over time
4. **ROI tracking** - Revenue per code/campaign

### Dashboard Mockup

```
┌─────────────────────────────────────────────────────────────────┐
│ 📊 Promo Code Analytics                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │    15    │  │   234    │  │    45    │  │  $4,500  │        │
│  │  Active  │  │  Regis-  │  │ Conver-  │  │  Total   │        │
│  │  Codes   │  │ trations │  │  sions   │  │ Revenue  │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
│                                                                 │
│  Top Performing Codes                                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 1. TELUGU_ASSOC  │ 45 reg │ 12 conv │ $2,400 │ ████████ │   │
│  │ 2. DIWALI2025    │ 32 reg │  8 conv │ $1,200 │ ██████   │   │
│  │ 3. USVEDIKA      │ 28 reg │  5 conv │   $500 │ ████     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Registrations Over Time                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │     ╭─╮                                                  │   │
│  │    ╭╯ ╰╮    ╭─╮                                         │   │
│  │ ╭──╯   ╰────╯ ╰──╮                                      │   │
│  │─╯                 ╰──────────────────────────────────── │   │
│  │ Oct    Nov    Dec    Jan    Feb    Mar                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Migration Guide

### Step 1: Run Migration Script

```bash
cd /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend
python migrations/add_promo_codes.py
```

### Step 2: Restart Backend

```bash
./bstart.sh
# or
cd fastapi_backend && uvicorn main:socket_app --host 0.0.0.0 --port 8000 --reload
```

### Step 3: Verify

1. Check User Management page - should see "Promo Code" column
2. Open Invitation Manager - should see promo code dropdown
3. Open Invite Friends (as regular user) - promo code auto-applied (hidden)

### Rollback (if needed)

```javascript
// Remove promoCode from users
db.users.updateMany({}, { $unset: { promoCode: "" } })

// Remove promo_codes collection
db.promo_codes.drop()
```

---

## Testing

### Backend Tests

```bash
# Test promo code creation
curl -X POST http://localhost:8000/api/promo-codes \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"code": "TEST123", "name": "Test Code", "type": "campaign"}'

# Test validation
curl http://localhost:8000/api/promo-codes/validate/USVEDIKA

# Test user's code
curl http://localhost:8000/api/promo-codes/my-code \
  -H "Authorization: Bearer <user_token>"
```

### Frontend Tests

1. **Admin Invitation:**
   - Open Invitation Manager
   - Click "Create New Invitation"
   - Verify promo code dropdown loads
   - Select different promo code
   - Submit and verify invitation has promo code

2. **User Invitation:**
   - Login as regular user
   - Go to "Invite Friends"
   - Send invitation
   - Check backend logs - should include promo code

3. **User Management:**
   - Open User Management
   - Verify "Promo Code" column visible
   - Verify all users show "🎫 USVEDIKA"

---

## Future Enhancements

| Enhancement | Description | Priority |
|-------------|-------------|----------|
| **Custom User Codes** | Let users create custom referral codes | Medium |
| **Code Expiry Notifications** | Email admin when codes expire | Low |
| **Bulk Code Generation** | Generate multiple codes at once | Medium |
| **Code Templates** | Pre-defined templates for common use cases | Low |
| **A/B Testing** | Test different discount values | Low |
| **Referral Rewards** | Reward users for successful referrals | High |
| **Multi-tier Discounts** | Different discounts based on referral count | Medium |

---

## Support

For questions or issues:
- Check backend logs: `tail -f fastapi_backend/logs/app.log`
- Check browser console for frontend errors
- Verify MongoDB collections: `mongosh matrimonialDB`

---

**Document Version:** 1.0  
**Last Updated:** December 26, 2025
