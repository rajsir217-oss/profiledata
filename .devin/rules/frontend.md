# Frontend Rules

> Behavioral guardrails for React / CSS / UX work in `frontend/` and `messenger-web/`.
> See also `AGENTS.md` and `.devin/rules/search-and-cards.md` for card-page consistency.

---

## 1. Theming and styling

### 1.1 CSS variables only

- **Never** use hardcoded hex colors, `rgb/rgba` (except opacity overlays), or fixed gradients.
- **Always** use variables from `frontend/src/themes/themes.css`:
  ```css
  background: var(--primary-color);
  color: var(--text-color);
  border: 1px solid var(--border-color);
  padding: var(--spacing-md);
  margin: var(--spacing-sm);
  border-radius: var(--radius-md);
  ```
- Gradients must use the theme variables:
  ```css
  background: linear-gradient(135deg,
    var(--primary-color) 0%,
    var(--secondary-color) 100%
  );
  ```

### 1.2 No inline styles

- Avoid `style={{ ... }}` in JSX.
- Prefer CSS modules or `className` referencing the theme CSS file.

### 1.3 No system dark-mode media queries

- The app uses internal theme classes (`.theme-dark`, `.theme-rose`, etc.).
- Do **not** add `@media (prefers-color-scheme: dark)`.

### 1.4 Admin table styling

All admin tables must use the same theme-aware header pattern:

```css
.table-name thead {
  background: var(--primary-color) !important;
  color: white !important;
}

.table-name th {
  background: var(--primary-color) !important;
  color: white !important;
}

.table-name tbody tr {
  background: var(--surface-color) !important;
}

.table-name tbody td {
  color: var(--text-color) !important;
}
```

Common mistakes to avoid:
- Using `var(--surface-color)` for headers.
- Using `var(--text-secondary)` for header text.
- Hardcoded theme overrides like `.theme-dark { ... }` with fixed colors.
- Using Bootstrap `.table` class (use `.table-hover` only).
- Forgetting `color: white !important` on `th` elements.

---

## 2. UX patterns

### 2.1 No browser modals

- **Never** use `alert()`, `confirm()`, or `prompt()`.
- Use:
  - `Toast` for status updates and action confirmations.
  - `DeleteButton` for destructive actions.
  - Custom modals only for critical confirmations, multi-step forms, or terms acceptance.

### 2.2 Toast implementation

Use the shared `Toast` pattern with theme variables:

```css
.toast {
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 12px 20px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  gap: 10px;
  animation: slideIn 0.3s ease;
  z-index: 9999;
}

.toast-success { background: var(--success-color); color: white; }
.toast-error   { background: var(--danger-color); color: white; }
.toast-warning { background: var(--warning-color); color: white; }
.toast-info    { background: var(--info-color); color: white; }
```

### 2.3 DeleteButton

- Use `DeleteButton` for every delete action in the app.
- It implements a 2-click confirmation pattern and avoids browser modals.
- Props: `onDelete`, `itemName`, `size`, `icon`, `confirmIcon`, `confirmText`, `timeout`, `disabled`, `className`, `onConfirmStateChange`.

### 2.4 LoadMore pagination

Use the shared `LoadMore` component instead of custom pagination buttons:

```jsx
import LoadMore from './LoadMore';

<LoadMore
  currentCount={Math.min(displayCount, items.length)}
  totalCount={items.length}
  onLoadMore={() => setDisplayCount(prev => prev + PAGE_SIZE)}
  itemsPerLoad={PAGE_SIZE}
  itemLabel="items"
  buttonText="View more"
/>
```

Pattern:
```jsx
const [displayCount, setDisplayCount] = useState(20);
const PAGE_SIZE = 20;

{items.slice(0, displayCount).map(...)}
```

### 2.5 Modal 1 style

When asked to apply "Modal 1 style", implement all of the following:

- Purple gradient header (`var(--primary-color)` to `var(--secondary-color)`).
- Dark circular close button (`background: rgba(0,0,0,0.6)`).
- Rounded corners (16px desktop, 12px mobile) on the modal and header.
- Flexbox layout with fixed header/footer and scrollable body.
- ESC key handler to close the modal.
- Enhanced primary/secondary buttons with gradients and hover transforms.

Reference files:
- `frontend/src/components/JobExecutionHistory.css`
- `frontend/src/components/ScheduleNotificationModal.css`
- `frontend/src/components/ScheduleNotificationModal.js`

### 2.6 Bubble-icons admin action buttons

For admin table action buttons, use the exact classes defined in `AdminPage.css`:

```jsx
<div className="admin-action-btns">
  <button className="btn-micro btn-micro-primary" title="View Profile">...</button>
  <button className="btn-micro btn-micro-info" title="Meta Fields">...</button>
  <button className="btn-micro btn-micro-warning" title="Edit Status">...</button>
  <button className="btn-micro btn-micro-danger" title="Delete">...</button>
  <button className="btn-micro btn-micro-secondary" title="Impersonate">...</button>
</div>
```

Classes:
- `.admin-action-btns` — flex container, `gap: 4px`, centered.
- `.btn-micro` — 26x26px circle, `font-size: 10px`, hover `scale(1.2)` + shadow.
- `.btn-micro-primary`, `.btn-micro-info`, `.btn-micro-warning`, `.btn-micro-danger`, `.btn-micro-secondary`.

---

## 3. Shared components

### 3.1 MessageModal

Every page that shows user cards must use `MessageModal` with profile enrichment:

```jsx
const handleMessage = async (user) => {
  if (!user.firstName && !user.location && user.username) {
    try {
      const response = await api.get(`/profile/${user.username}?requester=${currentUsername}`);
      setSelectedUser(response.data);
    } catch (err) {
      logger.error('Error loading user profile:', err);
      setSelectedUser(user);
    }
  } else {
    setSelectedUser(user);
  }
  setShowMessageModal(true);
};

{showMessageModal && selectedUser && (
  <MessageModal
    isOpen={showMessageModal}
    profile={selectedUser}
    onClose={() => {
      setShowMessageModal(false);
      setSelectedUser(null);
    }}
  />
)}
```

Do **not** navigate to `/messages?user=...` from card buttons.

### 3.2 Logging

- Do not leave `console.log` in production code.
- Use `frontend/src/utils/logger.js`:
  ```js
  import logger from './utils/logger';
  logger.debug('Dev only', data);
  logger.info('User action', action);
  logger.error('Error', err);
  ```

---

## 4. API usage

### 4.1 Shared `api` client

- Most frontend pages use the shared `api` client with base URL `/api/users`.
- Call relative paths, e.g. `/pii-requests/{username}` or `/favorites/{username}`.
- **Never** double-prefix: `/api/users/api/users/...`.
- `frontend/src/components/Requests.js` must use `/pii-requests/{username}`, not `/api/users/pii-requests/{username}`.

### 4.2 Route guard in index.js

`frontend/src/index.js` has a pre-React guard that checks `publicPaths` before React mounts.

Current `publicPaths` (line ~49):
```js
['/', '/login', '/register', '/register2', '/register3', '/register-interest',
 '/verify-email', '/verify-email-sent', '/forgot-password', '/terms', '/privacy',
 '/community-guidelines', '/cookie-policy', '/l3v3l-info', '/help',
 '/logo-showcase', '/tooltip-demo', '/messenger/public-reply']
```

Any new public route added to `App.js` must also be added here, or unauthenticated users will be redirected to `/login` before React loads.

---

## 5. Admin access checks

- **Never** check `localStorage.getItem('username') === 'admin'`.
- **Always** check `localStorage.getItem('userRole') === 'admin'`.

```jsx
const userRole = localStorage.getItem('userRole');
if (userRole !== 'admin') {
  logger.warn('Unauthorized access attempt to [Component Name]');
  navigate('/dashboard');
}
```

The admin user may have any username; only `userRole` is reliable.

---

## 6. Specific components and pages

### 6.1 Cozy and smooth theme system

The app uses a cozy theme system with warm colors and smooth animations. Available themes are Cozy Light, Dark, Rose, Light Gray, and Ultra Light Gray.

- Use `Plus Jakarta Sans` and `Nunito` font families.
- Round corners (8-24px), soft shadows, and smooth cubic-bezier transitions.
- Use theme variables from `frontend/src/themes/themes.css`.
- Test every UI change in all five themes.

### 6.2 Sidebar

The main `Sidebar` uses a simple hamburger toggle in the `TopBar`:

- No overlay; the sidebar overlays content.
- State `isSidebarCollapsed` lives in `App.js` and starts `true`.
- Optional pin state is persisted to `localStorage` under `sidebarPinned`.
- No `.theme-dark` hardcoded overrides.

### 6.3 SearchPage mobile layout

For screens `<= 768px`, the filter form uses a 2-column CSS grid with specific field spans:

- Full width: Gender, Keyword, Height Min, Height Max, Body Type, Location, Days Back.
- Side-by-side: Age Min / Age Max, Education / Occupation, Eating / Drinking / Smoking.
- Use the CSS classes defined in `SearchPage.css` (lines ~1951-2023).

### 6.4 Search button icons

When filter buttons overflow in the sidebar, use icon-only buttons:

- Search: magnifying glass icon, spinning arrow for loading.
- Clear: `x` icon.
- Use CSS Grid `1fr 1fr` with an 8px gap.
- Show a small badge with active filter count next to the clear icon.

### 6.5 Register3

`/register` redirects to `/register3`. The route is public and hides navigation.

Any new public route added to `App.js` must also be added to the `publicPaths` list in `frontend/src/index.js` or unauthenticated users will be redirected to `/login` before React mounts.

### 6.6 RegisterInterest error normalization

`RegisterInterest.js` must normalize FastAPI/Pydantic errors and omit empty optional fields:

```javascript
function extractErrorMessage(error) {
  if (!error) return 'An unknown error occurred';
  if (typeof error === 'string') return error;
  if (error.message) return error.message;
  if (Array.isArray(error.detail)) return error.detail.map(d => d.msg || d).join('; ');
  if (typeof error.detail === 'string') return error.detail;
  return JSON.stringify(error);
}
```

## 7. Testing and quality

- New frontend components need `<Component>.test.js` with render, interaction, API mocking, state changes, and error states.
- Test UI changes in all five themes: Cozy Light, Dark, Rose, Light Gray, Ultra Light Gray.
- Check the browser console for `console.log` warnings and errors before submitting.
