# Technical Architecture Documentation
**Matrimonial Profile Application**

---

## 🏛️ System Architecture Overview

### High-Level Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Browser    │  │    Mobile    │  │   Desktop    │      │
│  │  (React App) │  │  (Future)    │  │  (Future)    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS/WSS
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              FastAPI Backend (Python)                 │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │   │
│  │  │   Routes   │  │    Auth    │  │   Models   │     │   │
│  │  └────────────┘  └────────────┘  └────────────┘     │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │   │
│  │  │  Services  │  │   Utils    │  │ Middleware │     │   │
│  │  └────────────┘  └────────────┘  └────────────┘     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   MongoDB    │  │    Redis     │  │ File Storage │
│  (Database)  │  │   (Cache)    │  │   (Uploads)  │
└──────────────┘  └──────────────┘  └──────────────┘
```

---

## 🔧 Technology Stack Details

### Frontend Stack
```
React 19.1.1
├── React Router 7.9.3        # Client-side routing
├── Axios 1.11.0              # HTTP client
├── Socket.IO Client 4.7.2    # Real-time communication
├── Bootstrap 5.3.8           # UI framework
└── Custom CSS Themes         # Cozy theme system
```

### Backend Stack
```
FastAPI 0.109.0
├── Uvicorn 0.24.0           # ASGI server
├── Pydantic 2.5.2           # Data validation
├── Motor (Async MongoDB)    # Database driver
├── Redis 5.0.1              # Caching & real-time
├── Python-Jose 3.3.0        # JWT handling
├── Passlib 1.7.4            # Password hashing
├── Python-SocketIO 5.11.0   # WebSocket support
└── Pytest 8.0.0             # Testing framework
```

### Database & Cache
```
MongoDB 7.0+                 # Primary database
Redis 7.0+                   # Cache & message queue
```

---

## 📊 Data Flow Architecture

### User Registration Flow
```
User Input (Frontend)
    │
    ├─► Validation (React)
    │
    ├─► POST /api/users/register
    │
    ├─► FastAPI Route Handler
    │
    ├─► Password Hashing (bcrypt)
    │
    ├─► MongoDB Insert
    │
    ├─► Return User Object
    │
    └─► Update UI State
```

### Authentication Flow
```
Login Credentials
    │
    ├─► POST /api/users/login
    │
    ├─► Verify Password (bcrypt)
    │
    ├─► Generate JWT Token
    │
    ├─► Return Token + User Data
    │
    ├─► Store in localStorage
    │
    └─► Redirect to Dashboard
```

### Real-Time Messaging Flow
```
User A sends message
    │
    ├─► POST /api/messages/send
    │
    ├─► Store in MongoDB
    │
    ├─► Push to Redis Queue (User B)
    │
    ├─► User A: Update local state
    │
    └─► User B: Poll endpoint receives message
        │
        └─► Update chat UI
```

### Search Flow
```
Search Criteria
    │
    ├─► GET /api/users/search?filters=...
    │
    ├─► Build MongoDB Query
    │
    ├─► Apply Filters & Sorting
    │
    ├─► PII Masking (if needed)
    │
    ├─► Return Results
    │
    └─► Render Search Results
```

---

## 🗄️ Database Schema Design

### Collections Overview
```
matrimonial_profiles (Database)
├── users                    # User profiles
├── messages                 # Chat messages
├── favorites               # User favorites
├── shortlists              # User shortlists
├── exclusions              # Blocked users
├── pii_requests            # PII access requests
├── saved_searches          # Saved search criteria
├── profile_views           # Profile view tracking
├── test_results            # Test execution results
└── test_schedules          # Scheduled tests
```

### Users Collection Schema
```javascript
{
  _id: ObjectId,
  username: String (unique, indexed),
  password: String (hashed),
  
  // Personal Info
  firstName: String,
  lastName: String,
  email: String (indexed),
  contactNumber: String,
  alternateNumber: String,
  
  // Demographics
  gender: String (indexed),
  dateOfBirth: Date,
  age: Number (indexed),
  height: Number (indexed),
  weight: Number,
  complexion: String,
  bloodGroup: String,
  
  // Marital & Family
  maritalStatus: String (indexed),
  numberOfChildren: Number,
  religion: String (indexed),
  caste: String (indexed),
  subCaste: String,
  gotra: String,
  motherTongue: String,
  fatherName: String,
  motherName: String,
  numberOfBrothers: Number,
  numberOfSisters: Number,
  familyType: String,
  familyStatus: String,
  familyValues: String,
  
  // Education & Career
  education: String (indexed),
  educationDetails: String,
  occupation: String (indexed),
  occupationDetails: String,
  employedIn: String,
  income: Number (indexed),
  
  // Location
  location: String,
  city: String (indexed),
  state: String (indexed),
  country: String (indexed),
  residencyStatus: String,
  
  // Lifestyle
  diet: String,
  smoking: String,
  drinking: String,
  hobbies: [String],
  interests: [String],
  
  // Profile
  aboutMe: String,
  partnerExpectations: String,
  images: [String],
  
  // System Fields
  status: {
    status: String,      // active, inactive, suspended, pending
    reason: String,
    updatedAt: Date,
    updatedBy: String
  },
  createdAt: Date (indexed),
  updatedAt: Date,
  lastLogin: Date
}
```

### Messages Collection Schema
```javascript
{
  _id: ObjectId,
  fromUsername: String (indexed),
  toUsername: String (indexed),
  content: String,
  isRead: Boolean,
  isVisible: Boolean,
  createdAt: Date (indexed),
  readAt: Date
}
```

### Indexes Strategy
```javascript
// Users Collection
db.users.createIndex({ username: 1 }, { unique: true })
db.users.createIndex({ email: 1 })
db.users.createIndex({ gender: 1, age: 1, maritalStatus: 1 })
db.users.createIndex({ city: 1, state: 1, country: 1 })
db.users.createIndex({ education: 1, occupation: 1 })
db.users.createIndex({ createdAt: -1 })

// Messages Collection
db.messages.createIndex({ fromUsername: 1, toUsername: 1 })
db.messages.createIndex({ toUsername: 1, createdAt: -1 })
db.messages.createIndex({ createdAt: -1 })

// Favorites/Shortlists/Exclusions
db.favorites.createIndex({ username: 1, targetUsername: 1 }, { unique: true })
db.shortlists.createIndex({ username: 1, targetUsername: 1 }, { unique: true })
db.exclusions.createIndex({ username: 1, targetUsername: 1 }, { unique: true })
```

---

## 🔴 Redis Data Structures

### Key Patterns
```
online:{username}              # User online status (TTL: 5 min)
online_users                   # Set of online usernames
messages:{username}            # List of messages for user
unread:{username}:{from}       # Unread count from specific user
typing:{to_user}:{from_user}   # Typing indicator (TTL: 5 sec)
```

### Redis Operations
```python
# Online Status
SET online:john "2025-10-09T12:00:00" EX 300
SADD online_users "john"

# Messages
LPUSH messages:jane '{"from":"john","message":"Hi","timestamp":"..."}'
LRANGE messages:jane 0 49

# Unread Count
INCR unread:jane:john
GET unread:jane:john

# Typing Indicator
SETEX typing:jane:john 5 "1"
```

---

## 🔐 Security Architecture

### Authentication Layer
```
┌─────────────────────────────────────────┐
│         Client Request                   │
└─────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│    JWT Token Validation                  │
│  ┌────────────────────────────────┐     │
│  │ 1. Extract token from header   │     │
│  │ 2. Verify signature             │     │
│  │ 3. Check expiration             │     │
│  │ 4. Extract user claims          │     │
│  └────────────────────────────────┘     │
└─────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│    Authorization Check                   │
│  ┌────────────────────────────────┐     │
│  │ 1. Check user status            │     │
│  │ 2. Verify permissions           │     │
│  │ 3. Check resource access        │     │
│  └────────────────────────────────┘     │
└─────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│         Route Handler                    │
└─────────────────────────────────────────┘
```

### Password Security
```
User Password
    │
    ├─► bcrypt.hashpw(password, salt)
    │   └─► Cost factor: 12 rounds
    │
    ├─► Store hashed password in DB
    │
    └─► Verification:
        └─► bcrypt.checkpw(input, stored_hash)
```

### PII Protection
```
Profile Request
    │
    ├─► Check requester identity
    │
    ├─► Check PII access approval
    │
    ├─► If approved:
    │   └─► Return full data
    │
    └─► If not approved:
        └─► Mask sensitive fields
            ├─► Phone: ***-***-1234
            ├─► Email: a***@example.com
            └─► Address: [Hidden]
```

---

## 🚀 API Architecture

### RESTful Design Principles
```
Resource-based URLs:
  /api/users/{username}           # User resource
  /api/users/search               # Search action
  /api/users/favorites/{target}   # Nested resource

HTTP Methods:
  GET     - Retrieve resources
  POST    - Create resources
  PUT     - Update resources
  DELETE  - Remove resources

Status Codes:
  200 - Success
  201 - Created
  400 - Bad Request
  401 - Unauthorized
  403 - Forbidden
  404 - Not Found
  500 - Server Error
```

### Request/Response Format
```javascript
// Request
POST /api/users/register
Content-Type: application/json

{
  "username": "john_doe",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe"
}

// Response
HTTP/1.1 201 Created
Content-Type: application/json

{
  "message": "User registered successfully",
  "user": {
    "username": "john_doe",
    "firstName": "John",
    "lastName": "Doe",
    "createdAt": "2025-10-09T12:00:00"
  }
}
```

### Error Handling
```javascript
// Error Response Format
{
  "detail": "User not found",
  "status_code": 404,
  "timestamp": "2025-10-09T12:00:00"
}

// Validation Error
{
  "detail": [
    {
      "loc": ["body", "email"],
      "msg": "Invalid email format",
      "type": "value_error.email"
    }
  ]
}
```

---

## 🔄 Real-Time Communication

### Current Implementation (HTTP Polling)
```
┌─────────────┐                    ┌─────────────┐
│   Client    │                    │   Server    │
└─────────────┘                    └─────────────┘
       │                                  │
       │  GET /messages/poll/user         │
       ├─────────────────────────────────►│
       │                                  │
       │  Check Redis for new messages    │
       │◄─────────────────────────────────┤
       │  {"messages": [...]}             │
       │                                  │
       │  (Wait 2 seconds)                │
       │                                  │
       │  GET /messages/poll/user         │
       ├─────────────────────────────────►│
       │                                  │
       │  {"messages": []}                │
       │◄─────────────────────────────────┤
       │                                  │
```

### Future Implementation (WebSocket)
```
┌─────────────┐                    ┌─────────────┐
│   Client    │                    │   Server    │
└─────────────┘                    └─────────────┘
       │                                  │
       │  WebSocket Connect               │
       ├─────────────────────────────────►│
       │                                  │
       │  Connection Established          │
       │◄─────────────────────────────────┤
       │                                  │
       │  (Persistent Connection)         │
       │◄────────────────────────────────►│
       │                                  │
       │  New Message Event               │
       │◄─────────────────────────────────┤
       │  {"from": "user", "msg": "..."}  │
       │                                  │
```

---

## 📦 File Storage Architecture

### Current Implementation
```
uploads/
├── {username}/
│   ├── profile_1.jpg
│   ├── profile_2.jpg
│   ├── profile_3.jpg
│   ├── profile_4.jpg
│   └── profile_5.jpg
```

### File Upload Flow
```
User selects images
    │
    ├─► Frontend validation
    │   ├─► Max 5 images
    │   ├─► Max 5MB per image
    │   └─► Allowed types: jpg, jpeg, png
    │
    ├─► POST /api/users/profile/{username}
    │   └─► FormData with files
    │
    ├─► Backend validation
    │
    ├─► Save to uploads/{username}/
    │
    ├─► Update user.images array
    │
    └─► Return image URLs
```

### Future: Cloud Storage
```
┌─────────────┐
│   Client    │
└─────────────┘
       │
       ├─► Upload to S3/CloudFlare
       │
       ├─► Get CDN URL
       │
       ├─► Save URL to MongoDB
       │
       └─► Serve via CDN
```

---

## 🧪 Testing Architecture

### Test Pyramid
```
                    ┌─────────┐
                    │   E2E   │  (10%)
                    └─────────┘
                  ┌─────────────┐
                  │ Integration │  (30%)
                  └─────────────┘
              ┌───────────────────┐
              │   Unit Tests      │  (60%)
              └───────────────────┘
```

### Backend Testing
```python
# Unit Tests
tests/
├── test_auth.py              # Authentication logic
├── test_password.py          # Password hashing
├── test_jwt.py               # JWT generation/validation
└── test_models.py            # Pydantic models

# Integration Tests
tests/
├── test_user_routes.py       # User endpoints
├── test_messages.py          # Messaging system
└── test_search.py            # Search functionality

# E2E Tests
tests/
└── test_e2e.py               # Complete user flows
```

### Frontend Testing
```javascript
// Component Tests
src/components/__tests__/
├── Login.test.js
├── Register.test.js
├── Dashboard.test.js
└── SearchPage.test.js

// Integration Tests
src/__tests__/
├── userFlow.test.js
└── messaging.test.js
```

---

## 🔍 Monitoring & Logging

### Logging Strategy
```python
# Log Levels
DEBUG    - Detailed diagnostic info
INFO     - General informational messages
WARNING  - Warning messages
ERROR    - Error messages
CRITICAL - Critical failures

# Log Format
2025-10-09 12:00:00 - module_name - LEVEL - message

# Log Locations
- Console output (development)
- server.log (production)
- CloudWatch/Papertrail (future)
```

### Metrics to Monitor
```
Application Metrics:
- Request rate (req/sec)
- Response time (ms)
- Error rate (%)
- Active users
- Message throughput

System Metrics:
- CPU usage
- Memory usage
- Disk I/O
- Network I/O

Database Metrics:
- Query performance
- Connection pool
- Index usage
- Storage size

Redis Metrics:
- Memory usage
- Hit rate
- Key count
- Eviction rate
```

---

## 🚀 Deployment Architecture

### Development Environment
```
Local Machine
├── FastAPI (localhost:8000)
├── React Dev Server (localhost:3000)
├── MongoDB (localhost:27017)
└── Redis (localhost:6379)
```

### Production Architecture (Recommended)
```
┌─────────────────────────────────────────────────────┐
│                   Load Balancer                      │
│                   (Nginx/AWS ALB)                    │
└─────────────────────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│  Backend 1  │ │  Backend 2  │ │  Backend 3  │
│  (Uvicorn)  │ │  (Uvicorn)  │ │  (Uvicorn)  │
└─────────────┘ └─────────────┘ └─────────────┘
        │               │               │
        └───────────────┼───────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│  MongoDB    │ │    Redis    │ │     S3      │
│  (Cluster)  │ │  (Cluster)  │ │  (Storage)  │
└─────────────┘ └─────────────┘ └─────────────┘
```

### Scaling Strategy
```
Horizontal Scaling:
- Multiple backend instances
- Load balancer distribution
- Stateless application design
- Session storage in Redis

Vertical Scaling:
- Increase server resources
- Optimize database queries
- Add caching layers
- CDN for static assets
```

---

## 🔄 CI/CD Pipeline (Future)

### Recommended Pipeline
```
Code Push
    │
    ├─► Git Hook Trigger
    │
    ├─► Run Linters
    │   ├─► Black (Python)
    │   ├─► Flake8 (Python)
    │   └─► ESLint (JavaScript)
    │
    ├─► Run Tests
    │   ├─► Backend (Pytest)
    │   └─► Frontend (Jest)
    │
    ├─► Build
    │   ├─► Backend (Docker)
    │   └─► Frontend (npm build)
    │
    ├─► Security Scan
    │   ├─► Dependency check
    │   └─► SAST analysis
    │
    ├─► Deploy to Staging
    │
    ├─► Integration Tests
    │
    ├─► Manual Approval
    │
    └─► Deploy to Production
```

---

## 📈 Performance Optimization

### Backend Optimizations
```python
# Database Query Optimization
- Use indexes for frequent queries
- Limit returned fields
- Pagination for large datasets
- Aggregation pipelines

# Caching Strategy
- Cache frequently accessed data
- Redis for session storage
- Cache search results
- Invalidate on updates

# Async Operations
- Use async/await for I/O
- Concurrent database queries
- Background tasks for heavy operations
```

### Frontend Optimizations
```javascript
// Code Splitting
- Lazy load routes
- Dynamic imports
- Chunk optimization

// State Management
- Minimize re-renders
- Memoization
- Virtual scrolling for lists

// Asset Optimization
- Image compression
- Lazy loading images
- CDN for static assets
- Bundle size optimization
```

---

## 🔮 Future Architecture Enhancements

### Microservices Migration
```
Current: Monolithic
Future: Microservices

Services:
├── Auth Service
├── User Service
├── Messaging Service
├── Search Service
├── Notification Service
└── Analytics Service
```

### Event-Driven Architecture
```
┌─────────────┐
│   Service   │
└─────────────┘
       │
       ├─► Publish Event
       │
       ▼
┌─────────────┐
│ Event Bus   │
│ (Kafka/RMQ) │
└─────────────┘
       │
       ├─► Subscribe
       │
       ▼
┌─────────────┐
│   Service   │
└─────────────┘
```

---

**Document Version:** 1.0  
**Last Updated:** October 9, 2025  
**Next Review:** November 9, 2025
