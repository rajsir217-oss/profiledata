# Code Standards & Quality Guidelines

**Last Updated:** October 16, 2025  
**Status:** ✅ Active & Enforced

---

## 🎨 1. Theme-Aware CSS (MANDATORY)

### Rule: ALL UI changes MUST use CSS variables

#### ✅ DO:
```css
.button {
  background: var(--primary-color);
  color: var(--text-color);
  border: 1px solid var(--border-color);
}

.button:hover {
  background: var(--hover-background);
}

.card {
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
}
```

#### ❌ DON'T:
```css
.button {
  background: #6366f1;  /* NEVER hardcode colors */
  color: #1f2937;
  border: 1px solid #e5e7eb;
}

.card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);  /* NEVER hardcode gradients */
}

@media (prefers-color-scheme: dark) {  /* NEVER use browser dark mode */
  /* ... */
}
```

### Available CSS Variables

See `/frontend/src/themes/themes.css` for complete list:

| Category | Variables |
|----------|-----------|
| **Primary Colors** | `--primary-color`, `--secondary-color`, `--accent-color` |
| **Backgrounds** | `--background-color`, `--surface-color`, `--card-background`, `--input-bg` |
| **Text** | `--text-color`, `--text-secondary`, `--text-muted` |
| **Borders** | `--border-color`, `--divider-color` |
| **Interactive** | `--hover-background`, `--active-background`, `--selected-background` |
| **Status** | `--success-color`, `--danger-color`, `--warning-color`, `--info-color` |
| **Button States** | `--success-light`, `--success-hover`, `--info-light`, `--danger-light` |

### Verification Checklist

Before committing CSS changes:

- [ ] No hardcoded hex colors (#...)
- [ ] No hardcoded rgb/rgba values (except opacity overlays)
- [ ] All gradients use `var(--primary-color)` and `var(--secondary-color)`
- [ ] No `@media (prefers-color-scheme: dark)` queries
- [ ] Tested in all 5 themes:
  - [ ] Cozy Light
  - [ ] Cozy Dark
  - [ ] Cozy Rose
  - [ ] Light Gray
  - [ ] Ultra Light Gray

---

## 🧪 2. Test Coverage (MANDATORY)

### Rule: ALL new features MUST include tests

### Backend Testing (FastAPI)

**File Location:** `/tests/test_<feature_name>.py`

**Minimum Coverage:**
```python
import pytest
from fastapi.testclient import TestClient

# ✅ Success case
def test_feature_success(test_client):
    response = test_client.get("/endpoint")
    assert response.status_code == 200
    assert "expected_field" in response.json()

# ✅ Validation error
def test_feature_validation_error(test_client):
    response = test_client.post("/endpoint", json={})
    assert response.status_code == 422

# ✅ Not found
def test_feature_not_found(test_client):
    response = test_client.get("/endpoint/nonexistent")
    assert response.status_code == 404

# ✅ Unauthorized
def test_feature_unauthorized(test_client):
    response = test_client.get("/endpoint")
    assert response.status_code == 401

# ✅ Edge cases
def test_feature_edge_case(test_client):
    # Test boundary conditions
    pass
```

**Required Test Types:**
- ✅ Success scenarios (200, 201)
- ✅ Validation errors (422)
- ✅ Not found (404)
- ✅ Unauthorized (401)
- ✅ Server errors (500)
- ✅ Edge cases
- ✅ Database operations
- ✅ Authentication/authorization

### Frontend Testing (React)

**File Location:** `/frontend/src/components/<Component>.test.js`

**Minimum Coverage:**
```javascript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ComponentName from './ComponentName';

// ✅ Renders correctly
test('renders component', () => {
  render(<ComponentName />);
  expect(screen.getByText(/expected text/i)).toBeInTheDocument();
});

// ✅ User interactions
test('handles button click', async () => {
  render(<ComponentName />);
  fireEvent.click(screen.getByRole('button'));
  await waitFor(() => {
    expect(screen.getByText(/result/i)).toBeInTheDocument();
  });
});

// ✅ API calls (mocked)
test('fetches data on mount', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue({
    json: async () => ({ data: [] })
  });
  
  render(<ComponentName />);
  
  await waitFor(() => {
    expect(screen.getByText(/loaded/i)).toBeInTheDocument();
  });
});

// ✅ Error states
test('displays error message', async () => {
  jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Failed'));
  
  render(<ComponentName />);
  
  await waitFor(() => {
    expect(screen.getByText(/error/i)).toBeInTheDocument();
  });
});
```

**Required Test Types:**
- ✅ Component renders
- ✅ User interactions
- ✅ State changes
- ✅ API calls (mocked)
- ✅ Conditional rendering
- ✅ Error states
- ✅ Loading states

### Coverage Goals

| Priority | Minimum Coverage | Target Coverage |
|----------|-----------------|-----------------|
| **Critical Paths** | 100% | 100% |
| **Overall Project** | 70% | 85% |
| **New Features** | 80% | 90% |

---

## 🔄 3. Development Workflow

### Pre-Implementation

1. ✅ **Review similar components** for patterns
2. ✅ **Check theme variables** exist in themes.css
3. ✅ **Plan test cases** before writing code
4. ✅ **Verify API contracts** if backend changes

### During Implementation

1. ✅ **Write tests first** (TDD preferred)
2. ✅ **Use CSS variables** for all colors
3. ✅ **Follow existing patterns** for consistency
4. ✅ **Handle error cases** gracefully

### Post-Implementation

1. ✅ **Run all tests:** `pytest` (backend), `npm test` (frontend)
2. ✅ **Test in all themes** manually
3. ✅ **Check browser console** for errors/warnings
4. ✅ **Update docs** if needed
5. ✅ **Code review** before merging

---

## 📋 4. Common Patterns

### Theme-Aware Button

```css
.btn-primary {
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
  color: white;
  border: none;
  transition: all 0.2s ease;
}

.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-2px);
}

.btn-secondary {
  background: transparent;
  color: var(--text-color);
  border: 2px solid var(--border-color);
}

.btn-secondary:hover {
  background: var(--hover-background);
  border-color: var(--primary-color);
}
```

### Theme-Aware Card

```css
.card {
  background: var(--card-background);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 20px;
  transition: all 0.2s ease;
}

.card:hover {
  background: var(--hover-background);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}
```

### Theme-Aware Input

```css
.input-field {
  background: var(--input-bg);
  color: var(--text-color);
  border: 2px solid var(--border-color);
  border-radius: 8px;
  padding: 10px;
  transition: all 0.2s ease;
}

.input-field:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.05);
}

.input-field::placeholder {
  color: var(--text-secondary);
  opacity: 0.6;
}
```

---

## 🚫 5. Common Mistakes

### CSS Mistakes

| ❌ Wrong | ✅ Correct |
|---------|-----------|
| `background: #6366f1;` | `background: var(--primary-color);` |
| `color: rgb(31, 41, 55);` | `color: var(--text-color);` |
| `border: 1px solid #e5e7eb;` | `border: 1px solid var(--border-color);` |
| `@media (prefers-color-scheme: dark)` | `.theme-dark` class |
| `background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);` | `background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);` |

### Testing Mistakes

| ❌ Wrong | ✅ Correct |
|---------|-----------|
| No tests | Tests for all scenarios |
| Only happy path | Success + failure + edge cases |
| Skipping auth tests | Test all security |
| No error handling | Test error states |
| Manual testing only | Automated test suite |

---

## 📁 6. Files to Always Check

### For Theme Changes
- `/frontend/src/themes/themes.css` - Source of truth
- Component CSS files - Must use variables

### For New Features
- `/tests/test_<feature>.py` - Backend tests
- `/frontend/src/components/<Component>.test.js` - Frontend tests
- `/docs/` - Documentation updates

### For API Changes
- `/fastapi_backend/routes.py` - Endpoint definitions
- `/tests/` - API tests

---

## ✅ 7. Definition of Done

A feature is **DONE** when:

- [ ] Code implements the requested functionality
- [ ] All CSS uses theme variables (no hardcoded colors)
- [ ] Tests written and passing (70%+ coverage)
- [ ] Tested in all 5 themes manually
- [ ] No console errors or warnings
- [ ] Code reviewed
- [ ] Documentation updated (if public-facing)
- [ ] Committed with descriptive message
- [ ] Pushed to repository

---

## 🎯 8. Enforcement

These standards are **MANDATORY** and will be:
- ✅ Automatically applied by AI assistant
- ✅ Checked in code reviews
- ✅ Verified before merging

**If user requests a feature:**
- Theme-aware CSS is assumed required
- Test coverage is assumed required
- Both are implemented automatically

**No exceptions** unless explicitly discussed and documented.

---

## 📚 9. Resources

- **Theme Variables:** `/frontend/src/themes/themes.css`
- **Test Examples:** `/tests/` directory
- **Component Examples:** `/frontend/src/components/`
- **Architecture Docs:** `/docs/SCHEDULER_DYNAMIC_JOBS_ARCHITECTURE.md`

---

## 📞 10. Questions?

If unclear about:
- **Theme variables:** Check themes.css or ask
- **Test patterns:** Look at existing tests
- **Code patterns:** Review similar components

---

**Remember:** Quality > Speed. Taking time to implement standards correctly saves debugging time later.

**Last Review:** October 16, 2025  
**Next Review:** When adding new themes or major features
