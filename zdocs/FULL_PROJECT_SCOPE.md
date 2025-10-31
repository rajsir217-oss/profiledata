# 🎯 ProfileData - Complete Project Scope & Technical Specification

**Last Updated:** October 11, 2025  
**Version:** 2.0  
**Status:** Active Development

---

## 📋 Executive Summary

ProfileData is a **full-stack matrimonial/dating platform** built with modern technologies, featuring comprehensive user profiles, advanced search capabilities, real-time messaging, PII (Personally Identifiable Information) protection, and admin management tools. The platform emphasizes **privacy, security, and user experience** while providing intelligent matchmaking features.

### **Core Value Proposition**
- Privacy-first approach with granular PII access controls
- Intelligent matching algorithm based on preferences
- Real-time communication via WebSocket
- Comprehensive profile management with legal compliance
- Advanced search with saved criteria
- Multi-role user management (Admin, Regular Users)

---

## 🏗️ Technical Architecture

### **Technology Stack**

#### **Backend**
```yaml
Framework: FastAPI 0.100+
Language: Python 3.10+
Database: MongoDB (Motor - async driver)
Authentication: JWT (JSON Web Tokens)
Real-time: Socket.IO (WebSocket)
Caching: Redis
API Style: RESTful + WebSocket
Documentation: OpenAPI/Swagger (auto-generated)
```

#### **Frontend**
```yaml
Framework: React 19.1+
UI Library: Bootstrap 5.3.8
Routing: React Router DOM 7.9+
HTTP Client: Axios 1.11+
Real-time: Socket.IO Client 4.7+
State Management: React Hooks (local state)
Testing: Jest + React Testing Library
```

#### **Infrastructure**
```yaml
Database: MongoDB 6.0+
Cache/Session Store: Redis 7.0+
File Storage: Local filesystem (uploads/)
Environment: Development (localhost)
Logging: Python logging module
Process Management: Uvicorn (ASGI server)
```

---

## 📂 Project Structure

```
profiledata/
├── fastapi_backend/          # Backend API (FastAPI)
│   ├── main.py              # Application entry point
│   ├── routes.py            # API endpoints (95KB+, 3000+ lines)
│   ├── models.py            # Pydantic data models
│   ├── database.py          # MongoDB connection
│   ├── config.py            # Environment configuration
│   ├── auth.py              # Authentication utilities
│   ├── pii_security.py      # PII masking/access control
│   ├── websocket_manager.py # Socket.IO management
│   ├── test_management.py   # Test scheduling system
│   ├── utils.py             # Helper functions
│   ├── auth/                # Advanced auth module
│   │   ├── admin_routes.py  # Admin management
│   │   ├── jwt_handler.py   # JWT token management
│   │   ├── permissions.py   # Role-based access control
│   │   └── security.py      # Security utilities
│   ├── tests/               # Backend test suite
│   └── uploads/             # User-uploaded images
│
├── frontend/                # React Application
│   ├── src/
│   │   ├── components/      # React components
│   │   │   ├── Register.js  # User registration with samples
│   │   │   ├── Login.js     # Authentication
│   │   │   ├── Profile.js   # Profile view with PII protection
│   │   │   ├── EditProfile.js # Profile editing with samples
│   │   │   ├── SearchPage.js  # Advanced search (52KB!)
│   │   │   ├── Dashboard.js   # User dashboard
│   │   │   ├── Messages.js    # Real-time messaging
│   │   │   ├── AdminPage.js   # Admin panel
│   │   │   ├── PIIManagement.js # PII request management
│   │   │   ├── Favorites.js   # Favorites list
│   │   │   ├── Shortlist.js   # Shortlisted profiles
│   │   │   ├── Exclusions.js  # Blocked users
│   │   │   └── [40+ components]
│   │   ├── services/
│   │   │   └── onlineStatusService.js # Real-time status
│   │   ├── api.js           # Axios instance
│   │   └── App.js           # Root component
│   └── public/              # Static assets
│
├── Documentation/
│   ├── features.md          # Feature review & recommendations
│   ├── PII_SYSTEM_DOCUMENTATION.md
│   ├── REALTIME_SYSTEM_DOCUMENTATION.md
│   ├── AUTH_MODULE_COMPLETE.md
│   ├── SECURITY_MODULE_STATUS.md
│   ├── TESTING_GUIDE.md
│   └── [Multiple implementation guides]
│
└── Scripts/
    ├── starta.sh            # Start all services
    ├── startb.sh            # Start backend only
    ├── startf.sh            # Start frontend only
    ├── gitp.sh              # Git automation
    └── test_all.sh          # Run all tests
```

---

## 🎯 Core Features

### **1. User Authentication & Authorization**

#### Registration
- Username/email/password authentication
- Profile completeness validation
- **5 sample descriptions** for "About You" and "Partner Preference" with carousel navigation
- Image upload (max 5 images)
- Legal compliance (Terms, Privacy, Guidelines, Age verification)
- Consent metadata storage (IP, timestamp, user agent)
- Real-time username availability check
- Field-level validation with error messages

#### Authentication
- JWT-based authentication
- Token expiry management
- Session tracking
- Login history
- Password hashing (bcrypt)
- Failed attempt tracking

#### User Roles
- **Regular User:** Standard profile management
- **Admin:** Full system access, user management
- **Custom Permissions:** Granular permission system

### **2. Profile Management**

#### Profile Creation/Editing
- **Personal Information:**
  - Name, contact details, DOB, height, gender
  - Location, citizenship status
  - Education history (multiple degrees)
  - Work experience (multiple positions)
  - LinkedIn profile URL

- **Preferences:**
  - Caste, eating, drinking, smoking
  - Religion, body type, income range
  - Relationship status, looking for
  - Children preferences, pets

- **Rich Content:**
  - Sample-assisted "About You" (5 templates)
  - Sample-assisted "Partner Preference" (5 templates)
  - Carousel navigation (‹ › buttons)
  - Click-to-load functionality
  - Fully editable after loading

- **Images:**
  - Multiple image upload (max 5)
  - Image carousel display
  - Delete existing images
  - Image URL generation

#### Profile Viewing
- PII-protected field display
- Masked contact information
- Age calculation from DOB
- Profile completion status
- Online/offline status indicator
- Profile view tracking

### **3. PII (Personal Identifiable Information) Security System**

#### PII-Protected Fields
- Contact email (masked: `r***@example.com`)
- Contact number (masked: `***-***-5309`)
- Date of birth (age shown, full DOB hidden)
- Profile images (blurred/hidden)
- LinkedIn URL

#### Access Request System
- Request access to specific PII fields
- Granular permissions (images, contact_info, dob)
- Request approval/rejection workflow
- Access expiration
- Audit trail of all access grants
- Revoke access functionality

#### Automatic Masking
- Server-side masking before response
- Never expose raw PII to unauthorized users
- Consent metadata hidden from all API responses
- Redis-based access check caching

### **4. Advanced Search System**

#### Search Filters
- **Text Search:** Username, name, location, education
- **Demographics:** Age range, height range, gender
- **Background:** Religion, caste, eating preference
- **Lifestyle:** Drinking, smoking, body type
- **Status:** Relationship status, has/wants children
- **Professional:** Occupation, income range
- **Dating Preferences:** Looking for, interests

#### Search Features
- Saved searches (unlimited)
- Search history
- Sort options (newest, oldest, age, name)
- Pagination support
- Results count
- Clear all filters
- Active users only filter

### **5. Real-Time Messaging System**

#### Features
- One-on-one messaging
- WebSocket-based real-time delivery
- Message history persistence
- Unread count tracking
- Typing indicators
- Online status visibility
- Message deletion
- Conversation list
- Last message preview

#### Technical Implementation
- Socket.IO for WebSocket
- Redis for online status tracking
- MongoDB for message persistence
- Server-Sent Events (SSE) fallback
- Connection state management

### **6. User Interaction Features**

#### Favorites
- Add/remove favorites
- Reorder favorites (drag-and-drop ready)
- Display order management
- Timestamp tracking
- Quick access to favorite profiles

#### Shortlist
- Add profiles to shortlist
- Optional notes per profile
- Reorder functionality
- Remove from shortlist
- Export capability (future)

#### Exclusions/Blocking
- Block unwanted users
- Reason tracking
- Automatic profile hiding
- Message blocking
- Prevent future interactions

#### Profile Views
- Track who viewed your profile
- View count per user
- First viewed timestamp
- Last viewed timestamp
- Viewer profile preview

### **7. Admin Management System**

#### User Management
- View all users (paginated)
- Search users by username/email
- Filter by role/status
- View user details
- Modify user status
- Delete user accounts
- Password reset

#### Access Control
- Role assignment
- Custom permission grants
- Permission revocation
- Security status monitoring
- Session management

#### Monitoring
- Active users dashboard
- Registration statistics
- Message activity
- PII request statistics
- System health checks

### **8. Legal Compliance System**

#### Consent Management
- Age verification (18+)
- Terms of Service agreement
- Privacy Policy agreement
- Community Guidelines agreement
- Data processing consent (GDPR)
- Marketing opt-in (optional)

#### Audit Trail
- Consent timestamps (termsAgreedAt, privacyAgreedAt)
- IP address logging
- User agent tracking
- **Hidden from frontend** (backend-only metadata)

#### Legal Pages
- Terms of Service
- Privacy Policy (GDPR/CCPA compliant)
- Community Guidelines
- Cookie Policy
- All accessible via routing

---

## 🔌 API Endpoints

### **Authentication**
```
POST /api/users/register       - Create new user account
POST /api/users/login          - Authenticate user
POST /api/users/admin/change-password - Change admin password
```

### **Profile Management**
```
GET  /api/users/profile/{username}      - View profile (PII-protected)
PUT  /api/users/profile/{username}      - Update profile
DELETE /api/users/profile/{username}    - Delete account
GET  /api/users/admin/users             - Get all users (admin)
```

### **Search**
```
GET  /api/users/search                  - Advanced search
GET  /api/users/{username}/saved-searches    - Get saved searches
POST /api/users/{username}/saved-searches    - Save search criteria
DELETE /api/users/{username}/saved-searches/{id} - Delete saved search
```

### **PII Access Management**
```
POST /api/users/pii-request             - Request PII access
GET  /api/users/pii-requests/{username}  - Get access requests
PUT  /api/users/pii-request/{id}/respond - Approve/reject request
GET  /api/users/pii-access/check        - Check access status
POST /api/users/pii-access/revoke       - Revoke granted access
GET  /api/users/pii-access/granted      - Get granted access list
```

### **User Interactions**
```
POST /api/users/favorites/{username}     - Add to favorites
DELETE /api/users/favorites/{username}   - Remove from favorites
GET  /api/users/favorites/{username}     - Get favorites list
PUT  /api/users/favorites/{username}/reorder - Reorder favorites

POST /api/users/shortlist/{username}     - Add to shortlist
DELETE /api/users/shortlist/{username}   - Remove from shortlist
GET  /api/users/shortlist/{username}     - Get shortlist
PUT  /api/users/shortlist/{username}/reorder - Reorder shortlist

POST /api/users/exclusions/{username}    - Block user
DELETE /api/users/exclusions/{username}  - Unblock user
GET  /api/users/exclusions/{username}    - Get blocked list

GET  /api/users/their-favorites/{username}  - Who favorited me
GET  /api/users/their-shortlists/{username} - Who shortlisted me
```

### **Messaging**
```
POST /api/users/messages                 - Send message
GET  /api/users/messages/{username}      - Get message history
DELETE /api/users/messages/{id}          - Delete message
GET  /api/users/messages/conversations/{username} - Get conversations
GET  /api/users/messages/unread/{username}       - Get unread count
PUT  /api/users/messages/{id}/read      - Mark as read
```

### **Profile Analytics**
```
POST /api/users/profile-views            - Track profile view
GET  /api/users/profile-views/{username} - Get who viewed profile
GET  /api/users/profile-views/{username}/count - Get view count
```

### **Real-Time (WebSocket)**
```
POST /api/users/online-status/{username}/online  - Mark online
POST /api/users/online-status/{username}/offline - Mark offline
POST /api/users/online-status/{username}/refresh - Refresh status
GET  /api/users/online-status/{username}         - Check if online
GET  /api/users/online-status/all                - Get all online users
```

**Total: 40+ API Endpoints**

---

## 🗄️ Database Schema

### **Users Collection**
```javascript
{
  username: String (unique, indexed),
  password: String (hashed),
  firstName: String,
  lastName: String,
  contactEmail: String (indexed),
  contactNumber: String,
  dob: String (YYYY-MM-DD),
  sex: String (Male/Female),
  height: String,
  location: String (indexed),
  education: String,
  educationHistory: [
    { degree: String, institution: String, year: String }
  ],
  workExperience: [
    { position: String, company: String, years: String }
  ],
  workplace: String,
  linkedinUrl: String,
  castePreference: String,
  eatingPreference: String,
  citizenshipStatus: String,
  workingStatus: String,
  familyBackground: String,
  aboutYou: String (long text),
  partnerPreference: String (long text),
  
  // Dating app fields
  relationshipStatus: String,
  lookingFor: String,
  interests: String,
  languages: String,
  drinking: String,
  smoking: String,
  religion: String,
  bodyType: String,
  occupation: String,
  incomeRange: String,
  hasChildren: String,
  wantsChildren: String,
  pets: String,
  bio: String,
  
  // Legal consent metadata (backend-only, hidden from API)
  agreedToAge: Boolean,
  agreedToTerms: Boolean,
  agreedToPrivacy: Boolean,
  agreedToGuidelines: Boolean,
  agreedToDataProcessing: Boolean,
  agreedToMarketing: Boolean,
  termsAgreedAt: DateTime,
  privacyAgreedAt: DateTime,
  consentIpAddress: String,
  consentUserAgent: String,
  
  // Media
  images: [String] (URLs),
  
  // Metadata
  createdAt: DateTime,
  updatedAt: DateTime,
  status: {
    status: String (active/suspended/deleted),
    reason: String,
    updatedAt: DateTime,
    updatedBy: String
  },
  
  // Security
  role_name: String (admin/user),
  permissions: [String],
  
  // Activity tracking
  messagesSent: Number,
  messagesReceived: Number,
  pendingReplies: Number
}
```

### **Favorites Collection**
```javascript
{
  userUsername: String (indexed),
  favoriteUsername: String (indexed),
  displayOrder: Number,
  createdAt: DateTime
}
```

### **Shortlists Collection**
```javascript
{
  userUsername: String (indexed),
  shortlistedUsername: String (indexed),
  notes: String,
  displayOrder: Number,
  createdAt: DateTime
}
```

### **Exclusions Collection**
```javascript
{
  userUsername: String (indexed),
  excludedUsername: String (indexed),
  reason: String,
  createdAt: DateTime
}
```

### **Messages Collection**
```javascript
{
  from: String (indexed),
  to: String (indexed),
  content: String,
  timestamp: DateTime (indexed),
  read: Boolean,
  deleted: Boolean
}
```

### **PII Requests Collection**
```javascript
{
  requester: String (indexed),
  requested_user: String (indexed),
  access_type: String (images/contact_info/dob),
  status: String (pending/approved/rejected),
  requested_at: DateTime,
  responded_at: DateTime,
  expires_at: DateTime
}
```

### **PII Access Collection**
```javascript
{
  requester: String (indexed),
  profile_owner: String (indexed),
  access_type: String,
  granted_at: DateTime,
  expires_at: DateTime
}
```

### **Profile Views Collection**
```javascript
{
  profileUsername: String (indexed),
  viewedByUsername: String (indexed),
  viewCount: Number,
  firstViewedAt: DateTime,
  lastViewedAt: DateTime,
  createdAt: DateTime
}
```

### **Saved Searches Collection**
```javascript
{
  username: String (indexed),
  name: String,
  criteria: Object (search filters),
  createdAt: DateTime
}
```

---

## 🎨 Frontend Components

### **Major Components**
1. **Register.js** (40KB) - Full registration with samples
2. **SearchPage.js** (52KB) - Advanced search interface
3. **Profile.js** - Profile viewing with PII protection
4. **EditProfile.js** - Profile editing with samples
5. **Dashboard.js** - User dashboard
6. **Messages.js** - Messaging interface
7. **AdminPage.js** - Admin panel
8. **PIIManagement.js** - PII request management
9. **Favorites.js** - Favorites management
10. **Shortlist.js** - Shortlist management

### **Feature Components**
- AccessRequestButton.js
- PIIRequestModal.js
- ChatWindow.js
- MessageList.js
- ImageCarousel.js
- TopBar.js
- Sidebar.js
- MatchingCriteria.js

---

## 🔐 Security Features

### **Authentication**
- JWT token-based authentication
- Token expiration (30 minutes)
- Secure password hashing (bcrypt)
- Session tracking
- Failed login attempt tracking

### **Authorization**
- Role-based access control (RBAC)
- Custom permissions system
- Admin-only endpoints
- Resource ownership verification

### **Data Protection**
- PII masking system
- Consent-based access control
- Automatic data sanitization
- SQL injection prevention (NoSQL)
- XSS protection

### **Privacy**
- GDPR compliance features
- Consent metadata storage
- Right to be forgotten (delete account)
- Data access transparency
- Privacy policy enforcement

---

## 🚀 Current Development Status

### **Completed Features** ✅
- User registration with legal compliance
- JWT authentication system
- Advanced search with saved searches
- PII protection and access request system
- Real-time messaging
- Favorites/Shortlist/Exclusions management
- Profile view tracking
- Admin user management
- Sample description carousel (Register & Edit)
- Online status tracking

### **In Progress** 🔄
- Test coverage improvement
- Performance optimization
- UI/UX enhancements
- Mobile responsiveness

### **Planned** 📋
- Matching algorithm
- Email notifications
- Image optimization
- Video chat
- Mobile app (React Native)
- Docker containerization
- CI/CD pipeline

---

## 🧪 Testing

### **Backend Tests**
- Unit tests (pytest)
- Integration tests
- API endpoint tests
- Authentication tests
- PII security tests

### **Frontend Tests**
- Component tests (Jest + RTL)
- Integration tests
- E2E tests (planned)

---

## 📦 Dependencies

### **Backend**
```
fastapi==0.100+
uvicorn==0.23+
motor==3.3+          # MongoDB async driver
pydantic==2.4+
python-jose==3.3+    # JWT
passlib==1.7+        # Password hashing
python-multipart     # Form data
python-socketio==5.10+
redis==5.0+
bcrypt==4.0+
```

### **Frontend**
```
react==19.1+
react-router-dom==7.9+
axios==1.11+
bootstrap==5.3+
socket.io-client==4.7+
```

---

## 🚀 Getting Started

### **Prerequisites**
- Python 3.10+
- Node.js 18+
- MongoDB 6.0+
- Redis 7.0+

### **Backend Setup**
```bash
cd fastapi_backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### **Frontend Setup**
```bash
cd frontend
npm install
npm start  # Runs on port 3000
```

### **Start All Services**
```bash
./starta.sh  # Starts backend, frontend, MongoDB, Redis
```

---

## 📊 Performance Metrics

- **API Response Time:** < 200ms (average)
- **Database Queries:** Optimized with indexes
- **Real-time Latency:** < 50ms (WebSocket)
- **Image Loading:** Lazy loading implemented
- **Bundle Size:** ~2MB (uncompressed)

---

## 🔮 Future Enhancements

### **Phase 1 (Q1 2026)**
- Docker containerization
- CI/CD with GitHub Actions
- Automated testing pipeline
- Performance monitoring

### **Phase 2 (Q2 2026)**
- Matching algorithm v1
- Email notification system
- Advanced analytics dashboard
- Mobile-responsive improvements

### **Phase 3 (Q3 2026)**
- React Native mobile app
- Video chat feature
- AI-powered recommendations
- Advanced privacy controls

### **Phase 4 (Q4 2026)**
- Multi-language support
- Premium subscription model
- API for third-party integrations
- Enterprise features

---

## 🤝 Contributing

This is a private project. For collaboration inquiries, contact the project owner.

---

## 📄 License

Proprietary - All rights reserved

---

## 📞 Support

For technical issues or feature requests, refer to the project documentation or contact the development team.

---

**This specification serves as the single source of truth for the ProfileData project. All development work should align with this scope and architecture.**
