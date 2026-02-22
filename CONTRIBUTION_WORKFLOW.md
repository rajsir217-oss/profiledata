# Contribution Popup Workflow Documentation

## Overview
The contribution popup is a configurable system that prompts users to support the platform with donations. It supports both one-time and recurring contributions via Stripe and PayPal.

## Architecture

### Frontend Components
```
ContributionPopupWrapper
├── useContributionPopup (hook)
│   ├── Fetches contribution status from backend
│   ├── Determines when to show popup
│   └── Manages popup state
└── ContributionPopup
    ├── Displays amount options in 4-column grid
    ├── Handles payment processing
    └── Manages user interactions
```

### Backend Endpoints
- `/api/stripe/contribution-status` - Get user's contribution status and popup config
- `/api/stripe/admin/contribution-settings` - Admin configuration endpoints
- `/api/stripe/create-payment-intent` - Create Stripe payment
- `/api/stripe/confirm-payment` - Confirm Stripe payment
- `/api/stripe/create-paypal-order` - Create PayPal order
- `/api/stripe/capture-paypal-order` - Capture PayPal payment

## Configuration

### Site Settings (MongoDB - site_settings collection)
```json
{
  "_id": "site_settings",
  "contributions": {
    "enabled": true,
    "amounts": [10, 15, 25],
    "message": "Support the platform",
    "frequencyDays": 14,
    "minLogins": 10,
    "loginDelaySeconds": 30,
    "monthlySilenceDays": 35
  }
}
```

### Configuration Parameters
- **enabled**: Master toggle for the contribution system
- **amounts**: Array of preset amounts displayed in 4-column grid
- **message**: Custom message shown in popup
- **frequencyDays**: Days between popup shows for non-contributors
- **minLogins**: Minimum login count before popup appears
- **loginDelaySeconds**: Delay after login before showing popup
- **monthlySilenceDays**: Silence period for recurring contributors

## Display Logic

### When Popup Shows
1. **Site Level**: `contributions.enabled` must be true
2. **User Level**: User hasn't disabled via admin
3. **Login Count**: User has logged in at least `minLogins` times
4. **Login Delay**: Wait `loginDelaySeconds` after each login
5. **Frequency**: For non-contributors, wait `frequencyDays` between shows
6. **Active Contributors**: Silent for `monthlySilenceDays` after last recurring payment

### Payment Status-Based Display
- **Non-contributors**: Popup shows frequently based on frequencyDays
- **One-time contributors**: Popup shows after frequencyDays
- **Active recurring contributors**: No popup for monthlySilenceDays (35 days)
- **Recent payments**: Check lastRecurringPaymentDate for silence period

### When Popup Does NOT Show
- Site-wide contributions disabled
- User disabled by admin
- User has active recurring contribution within silence period
- Not enough logins
- Within frequency window
- Dismissed in current session

## User Flow

### 1. Popup Trigger
```javascript
// On mount or login
useContributionPopup.checkShouldShowPopup()
// Includes loginTime tracking for delay implementation
```

### 2. Amount Selection
- **Layout**: 4-column grid (10 | 15 | 25 | Custom)
- **Preset amounts**: $10, $15 (Popular), $25
- **Custom amount**: Input field for user-defined amount
- **Default selection**: $15 (Popular)
- **Responsive**: 2-column on mobile (≤480px)

### 3. Payment Flow

#### Stripe (Card)
1. User selects amount
2. Clicks "Pay with Card"
3. Frontend creates payment intent
4. Stripe Elements renders card form
5. User submits payment
6. Backend confirms and processes

#### PayPal
1. User selects amount
2. PayPal button renders (Credit disabled)
3. User logs into PayPal
4. Approves payment
5. Backend captures order
6. **Note**: PayPal Credit explicitly disabled via `disable-funding=credit`

### 4. Post-Payment
- Success toast notification
- Popup closes
- Activity logged to backend
- User contribution status updated
- Last shown timestamp set

## UI/UX Updates

### Visual Design
- **Popup width**: 780px (increased from 360px)
- **Amount boxes**: Smaller, flexible design with `flex: 1`
- **Padding**: Reduced for better space utilization
- **Dark theme**: Lighter background (#4a5568 to #2d3748)

### Button Changes
- **Removed**: "Remind me next week" button
- **Added**: Simple "Close" button
- **PayPal**: Credit option disabled, tagline removed

### Amount Display
```css
/* 4-column grid layout */
.contribution-amounts {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

/* Mobile responsive */
@media (max-width: 480px) {
  grid-template-columns: repeat(2, 1fr);
}
```

## Admin Configuration

### Location
Admin Settings → SysConfig → Contribution Popup Settings

### Controls
- Enable/disable popup system
- Configure preset amounts [10, 15, 25]
- Set frequency and timing parameters
- View contribution statistics

## Data Models

### User Contribution Status
```json
{
  "username": "user123",
  "hasContributed": true,
  "hasActiveRecurring": false,
  "lastContributionDate": "2024-01-15T10:30:00Z",
  "lastRecurringPaymentDate": "2024-01-01T00:00:00Z",
  "totalContributed": 50.00,
  "contributionPopupDisabledByAdmin": false
}
```

### Contribution Transaction
```json
{
  "_id": ObjectId,
  "username": "user123",
  "amount": 15.00,
  "currency": "usd",
  "paymentType": "one-time",
  "paymentMethod": "stripe" | "paypal",
  "status": "completed",
  "stripePaymentIntentId": "pi_...",
  "paypalOrderId": "ORDER-...",
  "createdAt": ISODate,
  "updatedAt": ISODate
}
```

## Activity Tracking

### Logged Events
- `shown` - Popup displayed to user
- `dismissed` - User closed popup
- `payment_started` - User initiated payment
- `payment_completed` - Payment successful
- `payment_failed` - Payment failed

### Storage
- MongoDB: contribution_transactions collection
- Used for analytics and debugging

## Security Considerations

1. **Payment Processing**: All payments via Stripe/PayPal SDKs
2. **Amount Validation**: Backend validates minimum amounts
3. **User Authentication**: JWT token required for all endpoints
4. **Rate Limiting**: Frequency checks prevent spam
5. **Admin Protection**: Admin endpoints require admin role
6. **PayPal Security**: Credit funding disabled to prevent financing options

## Mobile Responsiveness

- Breakpoints:
  - Desktop: Full 4-column layout
  - Mobile (≤480px): 2-column layout
- Touch-friendly buttons (44px minimum)
- Optimized input fields for mobile keyboards
- Flexible amount boxes that fill available space

## Theme Support

### Light Theme (Default)
- Background: White to light purple gradient
- Text: Dark gray
- Buttons: Purple gradient

### Dark Theme
- Background: Gray gradient (#4a5568 to #2d3748)
- Text: Light gray
- Buttons: Dark purple gradient
- Updated for better visibility

## Testing Scenarios

### Test Popup Display
1. Clear localStorage and sessionStorage
2. Set login count to >= minLogins (10)
3. Wait loginDelaySeconds (30) after login
4. Verify popup appears with $15 default selected

### Test Payment Flow
1. Select $15 (Popular) amount
2. Complete Stripe test payment
3. Verify success notification
4. Check database for transaction

### Test Frequency Logic
1. Dismiss popup
2. Set last_shown timestamp
3. Attempt to show again before frequencyDays (14)
4. Verify popup does not appear

### Test PayPal Credit Disabled
1. Select amount
2. Verify only "Pay with PayPal" button shows
3. Confirm no Credit or financing options

## Recent Updates (Feb 2026)

### Major Changes
1. **Amount Layout**: Changed from horizontal row to 4-column grid
2. **Default Amount**: Changed from $10 to $15 (Popular)
3. **Popular Badge**: Moved from $10 to $15
4. **Button Changes**: Replaced "Remind me next week" with "Close"
5. **Styling**: 
   - Reduced padding (16px→12px, 20px→24px)
   - Reduced font size (15px→14px)
   - Added `flex: 1` for flexible boxes
   - Reduced min-height (80px→65px)
6. **Dark Theme**: Lightened background for better visibility
7. **Width**: Increased to 780px for better layout
8. **PayPal**: Disabled credit funding option
9. **Config**: Amounts now fetched from backend [10, 15, 25]

### Code Quality
- Removed unused `handleRemindNextWeek` function
- Fixed all `handleSessionDismiss` references
- Added proper TypeScript-style props
- Improved error handling

## Troubleshooting

### Popup Not Showing
- Check site_settings contributions.enabled
- Verify user login count (≥10)
- Check localStorage for dismissal flags
- Verify 30-second login delay has passed
- Check backend API responses

### Payment Issues
- Check Stripe/PayPal API keys
- Verify webhook endpoints
- Check CORS configuration
- Review error logs

### Styling Issues
- Clear browser cache
- Verify CSS build
- Check theme application
- Test responsive breakpoints

### PayPal Issues
- Verify `disable-funding=credit` in URL
- Check client-id configuration
- Ensure no credit options appear

## Future Enhancements

1. **Analytics Dashboard**: Detailed contribution metrics
2. **A/B Testing**: Different messages and amounts
3. **Crypto Payments**: Add cryptocurrency options
4. **Recurring Management**: User portal for recurring donations
5. **Tax Receipts**: Automated receipt generation
6. **Goal Tracking**: Campaign-based contribution goals
7. **Multi-currency**: Support for international payments
