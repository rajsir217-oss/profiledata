# Test Coverage Plan & Status

## 📊 Current Test Coverage

### Backend Tests (Python/FastAPI)

#### ✅ Existing Tests
1. **test_auth_module.py** - Authentication & Authorization
   - Password hashing and verification
   - JWT token management
   - Role-based access control (RBAC)
   - Admin role assignment
   - Audit logging

2. **test_auth_endpoints.py** - Auth API Endpoints
   - Login/logout endpoints
   - Token refresh
   - Password reset

3. **test_routes_integration.py** - Route Integration
   - User registration
   - Profile management
   - API endpoint integration

4. **test_pii_security.py** - PII Security
   - PII access control
   - Data masking
   - Request/approval workflows

5. **test_user_interactions.py** - User Features
   - Favorites, shortlist, exclusions
   - User interactions

6. **test_messages.py** - Messaging System
   - Message sending/receiving
   - Conversation management

7. **test_search.py** - Search Functionality
   - Profile search
   - Filtering and pagination

8. **test_database.py** - Database Operations
   - CRUD operations
   - Data integrity

9. **test_e2e_api.py** - End-to-End API Tests
   - Complete user workflows

10. **test_profile_views.py** - Profile Views
    - Profile viewing tracking
    - View statistics

11. **test_models.py** - Data Models
    - Model validation
    - Schema testing

12. **test_utils.py** - Utility Functions
    - Helper functions
    - Common utilities

#### 🆕 Tests to Add

1. **test_user_status.py** - NEW
   - User activation/deactivation
   - Status field validation
   - Pending user restrictions
   - Menu access control based on status

2. **test_admin_routes.py** - NEW
   - Admin user management endpoints
   - Role assignment API
   - User activation API
   - Bulk operations

3. **test_jwt_timezone.py** - NEW
   - Token expiration with timezone handling
   - UTC datetime comparisons
   - Token refresh edge cases

4. **test_database_migration.py** - NEW
   - Status field migration
   - Data consistency checks
   - Rollback scenarios

5. **test_authorization_enhanced.py** - NEW
   - Hardcoded admin user handling
   - Database vs token user resolution
   - Permission inheritance

---

### Frontend Tests (React/Jest)

#### ✅ Existing Tests
1. **api.test.js** - API Service
   - API client configuration
   - Request/response handling

2. **Login.test.js** - Login Component
   - Login form validation
   - Authentication flow

3. **Profile.test.js** - Profile Component
   - Profile rendering
   - Data display

4. **SearchPage.test.js** - Search Component
   - Search functionality
   - Filter application

#### 🆕 Tests to Add

1. **Sidebar.test.js** - NEW
   - Menu item rendering based on user status
   - Disabled state for non-active users
   - Admin menu section visibility
   - Profile menu always enabled

2. **UserManagement.test.js** - NEW
   - User list rendering
   - Role assignment modal
   - Action modals (activate/suspend/ban)
   - Pagination and filtering

3. **ActionModals.test.js** - NEW
   - Modal opening/closing
   - Form submission
   - Reason input validation
   - Purple header rendering

4. **Dashboard.test.js** - NEW
   - Dashboard data loading
   - Statistics display
   - Activity feed

5. **Messages.test.js** - NEW
   - Message list rendering
   - Message modal
   - Real-time updates

6. **Preferences.test.js** - NEW
   - Theme switching
   - Settings persistence
   - Form validation

7. **PIIManagement.test.js** - NEW
   - PII request creation
   - Access control
   - Request approval/denial

8. **Integration Tests** - NEW
   - Complete user workflows
   - Multi-component interactions
   - State management

---

## 🎯 Priority Test Areas

### High Priority
1. ✅ **User Status & Activation**
   - Critical for security and access control
   - Tests: Backend + Frontend

2. ✅ **JWT Token Management**
   - Fixed timezone bug needs comprehensive tests
   - Edge cases and expiration scenarios

3. ✅ **Admin User Management**
   - Role assignment
   - User activation
   - Bulk operations

4. ✅ **Modal Components**
   - Action modals
   - Role assignment modal
   - Form validation

### Medium Priority
5. **Search & Filtering**
   - Advanced search
   - Filter combinations
   - Pagination

6. **Messaging System**
   - Real-time messaging
   - WebSocket connections
   - Message persistence

7. **PII Security**
   - Access requests
   - Data masking
   - Approval workflows

### Low Priority
8. **UI/UX Tests**
   - Theme switching
   - Responsive design
   - Accessibility

9. **Performance Tests**
   - Load testing
   - Query optimization
   - Caching

---

## 📝 Test Coverage Goals

### Backend
- **Current:** ~70% (estimated)
- **Target:** 85%+
- **Critical Paths:** 95%+

### Frontend
- **Current:** ~30% (estimated)
- **Target:** 75%+
- **Critical Components:** 90%+

---

## 🔧 Testing Tools & Frameworks

### Backend
- **pytest** - Test framework
- **pytest-asyncio** - Async test support
- **TestClient** - FastAPI test client
- **unittest.mock** - Mocking
- **coverage** - Code coverage

### Frontend
- **Jest** - Test framework
- **React Testing Library** - Component testing
- **@testing-library/user-event** - User interaction simulation
- **MSW (Mock Service Worker)** - API mocking
- **jest-dom** - DOM assertions

---

## 🚀 Implementation Plan

### Phase 1: Critical Tests (Week 1)
- [ ] test_user_status.py
- [ ] test_jwt_timezone.py
- [ ] Sidebar.test.js
- [ ] UserManagement.test.js

### Phase 2: Core Features (Week 2)
- [ ] test_admin_routes.py
- [ ] ActionModals.test.js
- [ ] Dashboard.test.js
- [ ] Messages.test.js

### Phase 3: Extended Coverage (Week 3)
- [ ] test_database_migration.py
- [ ] Preferences.test.js
- [ ] PIIManagement.test.js
- [ ] Integration tests

### Phase 4: Polish & Edge Cases (Week 4)
- [ ] Edge case scenarios
- [ ] Error handling tests
- [ ] Performance tests
- [ ] Accessibility tests

---

## 📊 Test Metrics

### Code Coverage Targets
```
Backend:
├── auth/ ..................... 95%
├── routes.py ................. 85%
├── database.py ............... 90%
├── utils.py .................. 80%
└── models.py ................. 85%

Frontend:
├── components/ ............... 75%
├── services/ ................. 85%
├── utils/ .................... 80%
└── hooks/ .................... 75%
```

### Test Quality Metrics
- **Test Execution Time:** < 30 seconds (unit tests)
- **Test Reliability:** 99%+ pass rate
- **Test Maintainability:** Clear, documented tests
- **Test Coverage:** 85%+ overall

---

## 🔍 Testing Best Practices

### Backend
1. Use `TestClient` for FastAPI endpoints
2. Mock database with `AsyncMock`
3. Test both success and error paths
4. Validate response schemas
5. Test authentication/authorization
6. Check edge cases and boundaries

### Frontend
1. Test user interactions, not implementation
2. Use `screen.getByRole` for accessibility
3. Mock API calls with MSW
4. Test loading and error states
5. Verify component rendering
6. Test form validation

---

## 📚 Test Documentation

### Writing Good Tests
```python
# Backend Example
def test_user_activation_success():
    """
    Test successful user activation by admin
    
    Given: A pending user exists
    When: Admin activates the user
    Then: User status changes to 'active'
    And: User can access all menu items
    """
    # Arrange
    user = create_test_user(status='pending')
    
    # Act
    response = admin_client.post(f'/admin/activate/{user.username}')
    
    # Assert
    assert response.status_code == 200
    assert response.json()['status'] == 'active'
```

```javascript
// Frontend Example
test('sidebar shows only profile for non-active users', () => {
  // Arrange
  localStorage.setItem('userStatus', 'pending');
  
  // Act
  render(<Sidebar />);
  
  // Assert
  expect(screen.getByText('Profile data')).not.toBeDisabled();
  expect(screen.getByText('My Dashboard')).toBeDisabled();
});
```

---

*Last Updated: 2025-10-07*
*Next Review: Weekly*
