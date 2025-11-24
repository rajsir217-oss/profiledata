# User Invitation Feature

## Overview
Existing users can now invite friends and family to join L3V3LMATCH! This feature complements the admin invitation system by allowing regular users to share the platform with people they know.

## Features

### For Regular Users
- **Invitation Limit**: Each user can send up to 10 invitations
- **Email Invitations**: Send personalized email invitations with custom messages
- **SMS Support**: Option to include SMS notifications (future)
- **Track Status**: View all sent invitations and their acceptance status
- **Resend Capability**: Resend invitations if needed
- **Cancel Option**: Cancel pending invitations

### Key Benefits
- **Organic Growth**: Users bring in trusted connections
- **Better Matches**: Friends inviting friends leads to higher quality community
- **Social Proof**: Invitations from friends carry more weight than marketing
- **Referral Tracking**: System tracks who invited whom

## How It Works

### User Flow
1. User navigates to **Invite Friends** in the sidebar
2. Clicks **"Invite Someone"** button
3. Fills out invitation form:
   - Friend's name
   - Friend's email address
   - Optional phone number
   - Optional personal message
4. Invitation is sent immediately
5. User can track status in their invitation dashboard

### Email Invitation
Recipients receive a beautiful email with:
- Personalized greeting
- Personal message from the inviter
- Unique registration link (valid for 30 days)
- Platform features and benefits
- Easy one-click registration

### Registration Process
1. Friend clicks invitation link
2. Email is pre-filled in registration form
3. Friend completes profile creation
4. Invitation is automatically marked as "Accepted"
5. Both users are notified of successful registration

## Technical Implementation

### Backend (`/api/user-invitations`)

**Endpoints:**
- `GET /my-invitations` - Get invitations sent by current user
- `GET /stats` - Get invitation statistics
- `POST /` - Send new invitation
- `POST /{id}/resend` - Resend invitation
- `DELETE /{id}` - Cancel invitation

**Security:**
- Authentication required for all endpoints
- Users can only view/manage their own invitations
- 10 invitation limit per user enforced
- 30-day invitation expiry

**Database:**
Uses existing `invitations` collection with `invitedBy` field tracking the sender.

### Frontend (`/invite-friends`)

**Components:**
- `InviteFriends.js` - Main invitation dashboard
- `InviteFriends.css` - Styling with theme support

**Features:**
- Statistics dashboard (Total Sent, Pending, Accepted, Remaining)
- Invitation list with status tracking
- Modal form for creating invitations
- Resend and cancel actions
- Toast notifications for feedback

## Files Created/Modified

### Backend Files Created
- `/fastapi_backend/routers/user_invitations.py` - User invitation API routes

### Backend Files Modified
- `/fastapi_backend/main.py` - Registered user invitation router

### Frontend Files Created
- `/frontend/src/components/InviteFriends.js` - User invitation dashboard
- `/frontend/src/components/InviteFriends.css` - Styling

### Frontend Files Modified
- `/frontend/src/App.js` - Added route and import
- `/frontend/src/components/Sidebar.js` - Added menu item

## Usage Examples

### Send Invitation (API)
```bash
curl -X POST http://localhost:8000/api/user-invitations \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Smith",
    "email": "john@example.com",
    "channel": "email",
    "customMessage": "Hey John! I think you would really like this platform.",
    "sendImmediately": true
  }'
```

### Get My Invitations (API)
```bash
curl http://localhost:8000/api/user-invitations/my-invitations \
  -H "Authorization: Bearer <token>"
```

### Get Statistics (API)
```bash
curl http://localhost:8000/api/user-invitations/stats \
  -H "Authorization: Bearer <token>"
```

## Invitation Limits

**Default Limits:**
- Maximum 10 invitations per user
- Invitation valid for 30 days
- Can be configured in `user_invitations.py`

**To Change Limits:**
```python
# In /fastapi_backend/routers/user_invitations.py
MAX_INVITATIONS_PER_USER = 10  # Change this value
INVITATION_VALIDITY_DAYS = 30   # Change expiry period
```

## Statistics Tracked

For each user:
- **Total Sent**: Total invitations sent
- **Pending**: Invitations not yet accepted
- **Accepted**: Successful registrations
- **Remaining**: Invitations left to send

## UI Components

### Dashboard
- Clean, modern interface with gradient headers
- Statistics cards showing invitation metrics
- Invitation list with status badges
- Empty state for first-time users

### Status Badges
- **Pending** (Yellow): Invitation sent, awaiting response
- **Sent** (Blue): Email successfully delivered
- **Delivered** (Green): Email opened/viewed
- **Accepted** (Green): Successfully registered
- **Failed** (Red): Delivery failed
- **Expired** (Gray): Invitation expired

### Actions
- **Resend**: Send invitation again
- **Cancel**: Archive invitation (reversible)

## Admin Tracking Features

Admins can track and monitor all invitations across the platform:

### "Invited By" Column
- Every invitation displays who sent it
- **👤 Admin** badge for admin-sent invitations
- **👥 Username** badge for user-sent invitations
- Helps admins understand invitation sources

### Filter by Sender
- Dropdown filter in admin Invitation Manager
- Filter options:
  - **All** - Show all invitations
  - **👤 Admin** - Only admin-sent invitations
  - **👥 [Username]** - Filter by specific user
- Shows count for each sender in dropdown
- Real-time filtering without page reload

### Benefits for Admins
- **Track user engagement** - See which users are actively inviting
- **Identify power users** - Find users who bring in most connections
- **Quality control** - Monitor invitation patterns
- **Spam detection** - Spot unusual invitation activity
- **Growth attribution** - Understand which sources drive growth

### Admin vs User Invitations

### Admin Invitation Manager (`/invitations`)
- **Full control** over all invitations (admin and user-sent)
- **No invitation limits** for admin
- **Can delete permanently** (archived invitations)
- **View all users' invitations** with "Invited By" column
- **Filter by sender** - dropdown to filter by who sent the invitation
- **Advanced analytics** - system-wide statistics
- **Tracks sender** - Shows whether admin or regular user sent invitation

### User Invite Friends (`/invite-friends`)
- Users see **only their own invitations**
- **10 invitation limit** per user
- **Cannot permanently delete** (can only cancel/archive)
- **Simple, focused interface**
- **Personal statistics only** (their own sent invitations)

## Future Enhancements

### Planned Features
1. **SMS Invitations**: Send invitations via SMS
2. **Referral Rewards**: Points/badges for successful invitations
3. **Social Sharing**: Share invitation links on social media
4. **Invitation Templates**: Pre-written invitation messages
5. **Bulk Invitations**: Upload CSV to invite multiple people
6. **Invitation Analytics**: Track conversion rates and engagement
7. **Dynamic Limits**: Increase limits based on user activity
8. **Invitation Leaderboard**: Show top inviters

### API Improvements
- Webhook notifications when invitation is accepted
- Email open/click tracking
- A/B testing for invitation emails
- Custom invitation landing pages

## Testing

### Manual Testing Steps
1. **Login** as a regular user (not admin)
2. **Navigate** to "Invite Friends" in sidebar
3. **Check** that statistics show correctly
4. **Click** "Invite Someone" button
5. **Fill** form with friend's details
6. **Add** personal message
7. **Send** invitation
8. **Verify** email is received
9. **Click** invitation link in email
10. **Complete** registration
11. **Verify** invitation marked as "Accepted"

### API Testing
```bash
# Test sending invitation
./test_user_invitation.sh

# Test getting stats
curl http://localhost:8000/api/user-invitations/stats \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test resending
curl -X POST http://localhost:8000/api/user-invitations/{id}/resend?channel=email \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Security Considerations

### Protections Implemented
- **Authentication Required**: All endpoints require valid JWT token
- **Ownership Verification**: Users can only manage their own invitations
- **Rate Limiting**: 10 invitation limit prevents spam
- **Token Expiry**: 30-day expiry prevents abuse
- **Email Validation**: Server-side validation of email addresses
- **No PII Exposure**: Recipients only see inviter's name

### Future Security Enhancements
- CAPTCHA on invitation form
- Email verification before sending invitations
- IP-based rate limiting
- Suspicious activity detection
- Report abuse feature

## Monitoring & Analytics

### Metrics to Track
- Invitation send rate
- Acceptance rate per user
- Time to acceptance
- Most active inviters
- Failed invitation reasons
- Invitation email open rates

### Database Queries
```javascript
// Get top inviters
db.invitations.aggregate([
  { $match: { registeredAt: { $ne: null } } },
  { $group: { _id: "$invitedBy", count: { $sum: 1 } } },
  { $sort: { count: -1 } },
  { $limit: 10 }
]);

// Get acceptance rate by user
db.invitations.aggregate([
  { $group: {
      _id: "$invitedBy",
      total: { $sum: 1 },
      accepted: {
        $sum: { $cond: [{ $ne: ["$registeredAt", null] }, 1, 0] }
      }
    }
  },
  { $project: {
      acceptanceRate: {
        $multiply: [{ $divide: ["$accepted", "$total"] }, 100]
      }
    }
  }
]);
```

## Support & Troubleshooting

### Common Issues

**"You've reached your invitation limit"**
- Each user has 10 invitations total
- Contact admin to increase limit
- Wait for old invitations to be accepted or expired

**"Invitation already exists"**
- Cannot send multiple invitations to same email
- Resend the existing invitation instead
- Or wait for it to expire (30 days)

**"Failed to send invitation"**
- Check email address is valid
- Verify SMTP settings are configured
- Check backend logs for details

### Debug Commands
```bash
# Check user's invitation count
mongosh matrimonialDB --eval "db.invitations.count({invitedBy: 'username'})"

# Check invitation status
mongosh matrimonialDB --eval "db.invitations.find({email: 'friend@example.com'})"

# View recent invitations
mongosh matrimonialDB --eval "db.invitations.find().sort({createdAt: -1}).limit(5)"
```

## Conclusion

The User Invitation feature empowers your community to grow organically through trusted connections. Users can easily invite friends and family, track their invitations, and contribute to building a quality community on L3V3LMATCH.

**Key Benefits:**
- ✅ Organic user growth
- ✅ Higher quality connections
- ✅ Increased user engagement
- ✅ Built-in referral tracking
- ✅ Simple, user-friendly interface
- ✅ Secure and spam-protected

---
**Created:** November 23, 2025  
**Version:** 1.0.0  
**Status:** ✅ Production Ready
