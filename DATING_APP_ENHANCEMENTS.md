# Dating App Enhancements - Implementation Plan

## Overview
Comprehensive enhancements to transform the profile system into a full-featured dating application with PII security, messaging, and advanced matching.

## 1. Enhanced Profile Properties

### New Dating-Specific Fields
- **relationshipStatus**: Single, Divorced, Widowed, Separated
- **lookingFor**: Serious Relationship, Casual Dating, Friendship, Marriage
- **interests**: Array of hobbies/interests
- **languages**: Array of languages spoken
- **drinking**: Never, Socially, Regularly, Prefer not to say
- **smoking**: Never, Socially, Regularly, Prefer not to say
- **religion**: Hindu, Muslim, Christian, Buddhist, etc.
- **bodyType**: Slim, Athletic, Average, Curvy, etc.
- **occupation**: Detailed job title
- **incomeRange**: Optional income bracket
- **hasChildren**: Yes/No
- **wantsChildren**: Yes/No/Maybe
- **pets**: Dog, Cat, None, Other
- **bio**: Short bio/tagline

### Existing Fields (Keep)
- username, password, firstName, lastName
- contactNumber, contactEmail (PII - protected)
- dob, sex, height
- castePreference, eatingPreference
- location, education, workingStatus, workplace
- citizenshipStatus, familyBackground
- aboutYou, partnerPreference
- images, createdAt, updatedAt

## 2. Admin Computed Fields

### Display in Admin Table
- **Days Active**: `Math.floor((now - createdAt) / (1000 * 60 * 60 * 24))`
- **Age**: `Math.floor((now - dob) / (1000 * 60 * 60 * 24 * 365.25))`
- **Messages Sent**: Count from messages collection
- **Messages Received**: Count from messages collection
- **Pending Replies**: Count of unread messages

## 3. PII Security & Access Request System

### Protected PII Fields
- contactNumber
- contactEmail
- exactLocation (show only city/state)
- workplace (show only company name, hide address)

### Access Request Flow
```
1. User A views User B's profile
2. User A clicks "Request Contact Info"
3. Request stored in database with status: "pending"
4. User B receives notification
5. User B approves/denies request
6. If approved: User A can see PII fields
7. If denied: Request marked as "denied"
```

### Database Collections
- **accessRequests**: Store all PII access requests
  - requesterId
  - requestedUserId
  - status: pending/approved/denied
  - requestedFields: array
  - requestDate
  - responseDate
  - message (optional)

## 4. Messaging System (Basic)

### Database Collection: messages
- senderId
- receiverId
- message
- timestamp
- read: boolean
- replyTo: messageId (optional)

### Computed Counts
- messagesSent: Count where senderId = userId
- messagesReceived: Count where receiverId = userId
- pendingReplies: Count where receiverId = userId AND read = false

## 5. Matching/Search Criteria

### Search Criteria Fields
- ageMin, ageMax
- heightMin, heightMax
- location (city/state)
- education level
- workingStatus
- relationshipStatus
- lookingFor
- religion
- drinking, smoking
- hasChildren, wantsChildren
- interests (match any)
- languages (match any)

### Saved Searches
- **Database Collection**: savedSearches
  - userId
  - searchName
  - criteria: JSON object
  - createdAt
  - lastUsed

### Search Results
- Execute search against all profiles
- Return matching profiles
- Sort by match percentage
- Display results in grid/list view

## Implementation Steps

### Phase 1: Database Schema Updates
- [ ] Add new profile fields to registration
- [ ] Create accessRequests collection
- [ ] Create messages collection
- [ ] Create savedSearches collection

### Phase 2: Backend API Endpoints
- [ ] Update /register with new fields
- [ ] Update /profile/{username} with PII masking
- [ ] POST /access-request (create request)
- [ ] GET /access-requests (get user's requests)
- [ ] PUT /access-request/{id}/respond (approve/deny)
- [ ] POST /messages (send message)
- [ ] GET /messages (get conversations)
- [ ] POST /search-criteria (save search)
- [ ] GET /search-criteria (get saved searches)
- [ ] POST /search (execute search)
- [ ] GET /admin/users (add computed fields)

### Phase 3: Frontend Components
- [ ] Update Register.js with new fields
- [ ] Update Profile.js with PII masking
- [ ] Create AccessRequestButton.js
- [ ] Create AccessRequestsPage.js
- [ ] Update MatchingCriteria.js (full implementation)
- [ ] Create SearchResults.js
- [ ] Create SavedSearches.js
- [ ] Update AdminPage.js with computed columns
- [ ] Create basic MessagingPage.js

### Phase 4: Security & Validation
- [ ] PII field masking logic
- [ ] Access control middleware
- [ ] Request validation
- [ ] Rate limiting for requests
- [ ] Audit logging

## File Structure

```
backend/
├── routes.py (updated with new endpoints)
├── models.py (new models for requests, messages, searches)
├── pii_security.py (PII masking logic)
└── search_engine.py (matching algorithm)

frontend/
├── components/
│   ├── Register.js (updated with new fields)
│   ├── Profile.js (PII masking + request button)
│   ├── EditProfile.js (updated with new fields)
│   ├── AccessRequestButton.js (new)
│   ├── AccessRequestsPage.js (new)
│   ├── MatchingCriteria.js (full implementation)
│   ├── SearchResults.js (new)
│   ├── SavedSearches.js (new)
│   ├── MessagingPage.js (new - basic)
│   └── AdminPage.js (updated with computed fields)
```

## Security Considerations

### PII Protection
- Never expose PII in public APIs
- Mask fields by default
- Only reveal after explicit approval
- Log all PII access requests
- Implement rate limiting

### Access Control
- Users can only request from profiles they can view
- Cannot spam requests (rate limit)
- Cannot request own profile
- Admin can see all requests

### Data Privacy
- GDPR compliance considerations
- Right to be forgotten (delete profile)
- Data export capability
- Consent tracking

## Next Steps

Starting implementation with:
1. Enhanced profile schema
2. PII security system
3. Access request system
4. Admin computed fields
5. Matching criteria system

This will be implemented incrementally to ensure each component works correctly.
