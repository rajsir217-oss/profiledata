# Virtual Meets System Documentation

## Overview
The Virtual Meets system is an RSVP-driven match list + 1:1 virtual room flow with payment gate for premium events. It enables users to discover, match, and connect in private virtual rooms after RSVPing to events.

## Table of Contents
1. [Core Concept](#core-concept)
2. [Database Schema](#database-schema)
3. [Complete Workflow](#complete-workflow)
4. [Payment Flow](#payment-flow)
5. [Access Control](#access-control)
6. [Matching Rules](#matching-rules)
7. [Safety Features](#safety-features)
8. [Frontend Components](#frontend-components)
9. [Admin Features](#admin-features)
10. [API Endpoints](#api-endpoints)
11. [Key Metrics](#key-metrics)

---

## Core Concept
- **RSVP-driven**: Only users who RSVP "Yes" to events can participate
- **Gender-based matching**: Male users see Female matches, Female users see Male matches
- **Payment gate**: Premium events (zoom-call) require payment to unlock matches
- **1:1 virtual rooms**: Private rooms for matched pairs after mutual acceptance

---

## Database Schema

### 1. `virtual_meet_sessions`
Per-user, per-poll session tracking

```javascript
{
  _id: ObjectId,
  poll_id: string,           // Reference to polls collection
  username: string,          // User identifier
  gender: "Male"|"Female",   // Strict gender for matching
  event_type: string,        // From poll (in-person, virtual, zoom-call, hybrid)
  payment_status: "not_required"|"pending"|"completed"|"refunded",
  payment_amount: number,    // Default 5.00, configurable per event
  payment_id: ObjectId,     // Reference to payments collection
  payment_provider: "paypal"|"clover",
  paypal_order_id: string,
  clover_order_id: string,
  access_unlocked: boolean,  // True when payment complete or not required
  rsvp_response: "yes",     // Always "yes" for Virtual Meets
  match_list_generated: boolean,
  created_at: ISODate,
  updated_at: ISODate
}
```

### 2. `virtual_rooms`
Confirmed 1:1 virtual rooms

```javascript
{
  _id: ObjectId,
  poll_id: string,
  room_number: number,      // Auto-incremented per poll
  user_a: string,          // Requester
  user_b: string,          // Acceptor
  status: "confirmed"|"active"|"completed"|"cancelled"|"expired",
  zoom_link: string,       // Optional Zoom link (admin can provide)
  notes: string,
  created_at: ISODate,
  started_at: ISODate,
  ended_at: ISODate
}
```

### 3. `virtual_room_requests`
Pending room requests

```javascript
{
  _id: ObjectId,
  poll_id: string,
  requester_username: string,
  target_username: string,
  status: "pending"|"accepted"|"declined"|"expired"|"cancelled",
  room_id: ObjectId,       // Populated when accepted
  requested_at: ISODate,
  responded_at: ISODate,
  response_note: string
}
```

---

## Complete Workflow

### 1. Event Discovery
**Endpoint**: `GET /api/virtual-meets/events`

**Process**:
- Fetches all polls user RSVPed "Yes" to
- Filters for polls with Virtual Meet capability
- Returns event summary with payment status, match count, room count

**Response**:
```javascript
{
  "success": true,
  "events": [
    {
      poll_id: "123",
      title: "Singles Mixer",
      event_type: "zoom-call",
      event_date: "2026-03-30",
      status: "active",
      payment_required: true,
      payment_status: "pending",
      payment_amount: 5.00,
      access_unlocked: false,
      match_count: 15,
      room_count: 3,
      pending_requests_received: 2
    }
  ]
}
```

### 2. Session Creation (Automatic)
When user accesses an event, system automatically creates/updates session:

**Validation**:
- User must have RSVP "Yes" to the poll
- Gender must be "Male" or "Female" (required for matching)
- Admin/Moderator users are exempt from payment

**Payment Logic**:
```javascript
if (event_type === "zoom-call" && !is_exempt) {
  payment_status = "pending"
  access_unlocked = false
} else {
  payment_status = "not_required"
  access_unlocked = true
}
```

### 3. Payment Gate (if required)
**Trigger**: User clicks "Pay to Unlock" for zoom-call events

**Payment Methods**:

#### PayPal (In-App SDK)
1. **Create Order**: `POST /api/paypal/create-order`
   - Amount: Event's payment_amount
   - Custom ID: `vm_{poll_id}_{username}`

2. **User Approval**: PayPal popup/redirect
   - User logs in and approves payment

3. **Capture Payment**: `POST /api/paypal/capture-order`
   - Backend captures payment
   - Updates session: `payment_status = "completed"`

#### Clover (Hosted Checkout)
1. **Create Checkout**: `POST /api/clover/create-checkout`
   - Amount in cents
   - Customer note: `vm_{poll_id}_{username}`

2. **Redirect to Clover**: User completes payment on Clover's page
   - Redirect back to app with success/failure

3. **Confirm Payment**: `POST /api/virtual-meets/{poll_id}/confirm-payment`
   - Backend verifies payment with Clover
   - Updates session: `access_unlocked = true`

### 4. Match List Generation
**Endpoint**: `GET /api/virtual-meets/{poll_id}/matches`

**Process**:
- Fetches opposite-gender participants only
- Filters by payment status (only paid users for zoom-call)
- Includes request status for each match
- Shows existing rooms and incoming requests

**Response**:
```javascript
{
  "success": true,
  "poll_id": "123",
  "is_locked": false,
  "matches": [
    {
      username: "jane_doe",
      full_name: "Jane Doe",
      age: 28,
      location: "New York",
      profession: "Designer",
      profile_pic_url: "https://...",
      request_status: null,  // null, "pending", "accepted", "declined"
      request_id: null
    }
  ],
  "my_requests_sent": ["john_doe"],
  "my_requests_received": [
    {
      request_id: "456",
      from_username: "bob_smith",
      full_name: "Bob Smith",
      requested_at: "2026-03-30T10:00:00Z"
    }
  ],
  "my_rooms": [
    {
      room_id: "789",
      room_number: 1,
      partner_username: "alice_jones",
      partner_name: "Alice Jones",
      status: "confirmed",
      zoom_link: "https://zoom.us/j/...",
      created_at: "2026-03-30T09:30:00Z"
    }
  ]
}
```

### 5. 1:1 Room Requests
**Endpoint**: `POST /api/virtual-meets/{poll_id}/request-room`

**Validation**:
- User has access unlocked (payment complete)
- No existing room with target user
- No pending request between these users
- Target user is opposite gender

**Process**:
1. Creates pending request in `virtual_room_requests`
2. Updates requester's match list to show "pending"
3. Target user sees request in "incoming requests"

### 6. Request Response
**Endpoint**: `POST /api/virtual-meets/{poll_id}/respond-request`

**Actions**:
- **Accept**: Creates virtual room, updates both users' match lists
- **Decline**: Marks request as declined, removes from lists

**Room Creation (on Accept)**:
```javascript
{
  poll_id: "123",
  room_number: 5,          // Auto-incremented
  user_a: "requester",
  user_b: "acceptor",
  status: "confirmed",
  created_at: now()
}
```

### 7. Virtual Room Management
- **Room Status Flow**: confirmed → active → completed
- **Room Numbers**: Auto-incremented per poll (1, 2, 3...)
- **Zoom Links**: Admin can optionally add Zoom meeting URLs
- **Access**: Both participants can view room details

---

## Payment Flow Details

### Payment Triggers

| Event Type | Payment Required | Amount |
|------------|------------------|--------|
| in-person | No | $0 |
| virtual | No | $0 |
| hybrid | No | $0 |
| zoom-call | Yes | $5.00 (configurable) |

### Payment States
```
not_required → pending → completed
```

### Payment Method Integration

#### PayPal Flow
1. SDK loads in modal
2. User clicks PayPal button
3. Approves payment in popup
4. Backend captures order
5. Access unlocked

#### Clover Flow
1. Redirect to Clover hosted page
2. User enters card details
3. Completes payment
4. Redirect back to app
5. Backend confirms payment
6. Access unlocked

---

## Access Control

### Role-Based Access
- **Regular Users**: Must pay for zoom-call events
- **Admin/Moderator**: Exempt from all payments
- **Free Users**: Can participate in free events

### Payment Verification
- Backend verifies payment with provider before unlocking
- PayPal: Order capture confirmation
- Clover: Webhook or API verification

### Gender Requirements
- Strict "Male" or "Female" gender required
- Enables proper opposite-gender matching
- Invalid gender users cannot participate

---

## Matching Rules

### 1. Gender-Based Matching
- Male users see only Female participants
- Female users see only Male participants
- Ensures proper dating event dynamics

### 2. Payment Filtering
- Free events: All RSVP "Yes" users
- Paid events: Only users with completed payment

### 3. Request Tracking
- Each user can see their request status with others
- Prevents duplicate requests
- Shows pending/accepted/declined status

### 4. Room Exclusivity
- One active room per pair per event
- Prevents multiple simultaneous connections
- Maintains focused 1:1 interactions

---

## Safety Features

### Request Limits
- Cannot send multiple requests to same user
- Rate limiting prevents spam
- Request expiration after 24 hours

### Duplicate Prevention
- System checks for existing requests
- Blocks duplicate room creation
- Maintains data integrity

### Payment Verification
- Backend confirms payment before access
- Prevents unauthorized access
- Secure transaction handling

### Gender Validation
- Strict M/F validation
- Prevents profile manipulation
- Ensures proper matching

---

## Frontend Components

### 1. VirtualMeets.js
**Main interface component**
- Events list with payment status
- Match list with request buttons
- Room management interface
- Admin overview toggle

**Key Features**:
- Real-time updates after requests
- Payment modal integration
- Toast notifications for all actions
- Responsive design

### 2. VirtualMeetPaymentModal.js
**Payment processing modal**
- PayPal SDK integration
- Clover hosted checkout
- Payment confirmation flow
- Error handling and retries

**Payment Methods**:
- PayPal: In-app popup flow
- Clover: Redirect to hosted page
- Automatic backend confirmation

### 3. VirtualMeets.css
**Styling for Virtual Meets interface**
- Event cards layout
- Match grid design
- Payment modal styling
- Responsive breakpoints

---

## Admin Features

### Admin Overview
**Endpoint**: `GET /api/virtual-meets/{poll_id}/admin`

**Data Available**:
- Total participants by gender
- Payment status breakdown
- Request statistics
- Room creation metrics
- Full participant list

### Manual Pairing
**Endpoint**: `POST /api/virtual-meets/{poll_id}/admin/pair-users`

**Process**:
- Admin selects two users
- System creates room directly
- Bypasses request process
- Useful for event management

### Zoom Link Management
Admins can add Zoom meeting links to rooms:
- Enhances virtual meeting experience
- Provides professional meeting space
- Optional per room

### Payment Overrides
- Grant free access to specific users
- Refund payments if needed
- Manage payment disputes

---

## API Endpoints

### Events & Sessions
- `GET /api/virtual-meets/events` - List user's events
- `GET /api/virtual-meets/{poll_id}/matches` - Get match list
- `GET /api/virtual-meets/{poll_id}/session` - Get user session

### Payments
- `POST /api/virtual-meets/{poll_id}/initiate-payment` - Start payment
- `POST /api/virtual-meets/{poll_id}/confirm-payment` - Confirm payment

### Room Requests
- `POST /api/virtual-meets/{poll_id}/request-room` - Send request
- `POST /api/virtual-meets/{poll_id}/respond-request` - Respond to request
- `DELETE /api/virtual-meets/requests/{request_id}` - Cancel request

### Rooms
- `GET /api/virtual-meets/{poll_id}/rooms` - List user's rooms
- `PUT /api/virtual-meets/rooms/{room_id}` - Update room (add Zoom link)

### Admin
- `GET /api/virtual-meets/{poll_id}/admin` - Admin overview
- `POST /api/virtual-meets/{poll_id}/admin/pair-users` - Manual pairing
- `PUT /api/virtual-meets/{poll_id}/admin/{username}/access` - Grant access

---

## Key Metrics

### Participation Metrics
- **Total Participants**: Users with sessions
- **Gender Breakdown**: Male vs Female count
- **Payment Status**: Paid/Unpaid/Exempt breakdown
- **RSVP Conversion**: RSVP "Yes" to participation rate

### Engagement Metrics
- **Requests Sent**: Total room requests
- **Requests Accepted**: Acceptance rate
- **Requests Declined**: Decline rate
- **Rooms Created**: Successful matches

### Revenue Metrics
- **Payments Processed**: Total revenue
- **Payment Method Split**: PayPal vs Clover
- **Refund Rate**: Payment refunds
- **Average Revenue per Event**

### Quality Metrics
- **Room Completion Rate**: Rooms that became active
- **Average Room Duration**: Time from creation to completion
- **User Satisfaction**: Feedback and ratings
- **Event Success Rate**: Overall event performance

---

## Security Considerations

### Payment Security
- All payments processed through secure providers (PayPal/Clover)
- No credit card data stored in application
- Payment verification before access unlock

### Data Privacy
- Gender data used only for matching
- Payment information encrypted
- Room access limited to participants

### Access Control
- JWT-based authentication
- Role-based permissions
- Payment status verification

---

## Troubleshooting

### Common Issues

1. **Payment Not Unlocking Access**
   - Check payment confirmation in backend
   - Verify payment provider status
   - Ensure session updated correctly

2. **No Matches Showing**
   - Verify RSVP status is "yes"
   - Check gender is valid (Male/Female)
   - Confirm payment completed for paid events

3. **Request Not Sending**
   - Check user has access unlocked
   - Verify target user is opposite gender
   - Ensure no existing request/room

4. **Room Not Creating**
   - Check request was accepted
   - Verify both users have valid sessions
   - Check for duplicate prevention

### Debug Commands

```javascript
// Check user session
db.virtual_meet_sessions.findOne({username: "user", poll_id: "123"})

// Check pending requests
db.virtual_room_requests.find({poll_id: "123", status: "pending"})

// Check rooms
db.virtual_rooms.find({poll_id: "123"})
```

---

## Future Enhancements

### Planned Features
- Video chat integration (WebRTC)
- Advanced matching algorithms
- Event scheduling tools
- Mobile app support
- International payment methods

### Performance Improvements
- Caching for match lists
- Optimized database queries
- Real-time updates via WebSockets
- CDN for profile images

---

## Conclusion

The Virtual Meets system provides a comprehensive solution for virtual dating events, combining RSVP management, payment processing, and 1:1 matching in a secure, user-friendly interface. The system ensures proper gender matching, secure payment handling, and provides administrators with tools for event management and oversight.

The architecture supports scalability, maintains user privacy, and provides a seamless experience from event discovery to virtual room connections.
