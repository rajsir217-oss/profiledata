# Sidebar Navigation Feature

## Overview
A collapsible left sidebar panel with auto-hide and pin functionality for easy navigation throughout the application.

## Features

### 1. **Auto-Hide Functionality**
- Sidebar is hidden by default (off-screen)
- Hover over the toggle button to reveal the sidebar
- Automatically hides when mouse leaves (unless pinned)

### 2. **Pin/Unpin**
- Click the pin button (📌/📍) to keep sidebar open
- Pinned sidebar stays visible even when mouse leaves
- Click again to unpin and return to auto-hide mode

### 3. **Menu Options**
Based on your design, the sidebar includes:

1. **Profile Picture Section**
   - Shows profile picture placeholder
   - "Profile data" subtitle
   - Click to view current user profile

2. **Edit**
   - Edit profile information
   - Navigate to `/edit-profile`

3. **My Matching Criteria**
   - Set preferences for matches
   - Navigate to `/matching-criteria`

4. **My Top 3 Matches**
   - View recommended matches
   - Navigate to `/top-matches`

5. **My Short Lists**
   - Manage shortlisted profiles
   - Navigate to `/shortlists`

### 4. **Footer Links**
- Privacy
- About Us
- Registered Trade Mark

## File Structure

```
frontend/src/
├── components/
│   ├── Sidebar.js          # Main sidebar component
│   ├── Sidebar.css         # Sidebar styling
│   ├── EditProfile.js      # Edit profile page
│   ├── MatchingCriteria.js # Matching criteria page
│   ├── TopMatches.js       # Top matches page
│   └── ShortLists.js       # Short lists page
└── App.js                  # Updated with sidebar and routes
```

## Usage

### Basic Usage
The sidebar is automatically included in the app and available on all pages.

```javascript
import Sidebar from './components/Sidebar';

function App() {
  return (
    <Router>
      <Sidebar />
      {/* Your content */}
    </Router>
  );
}
```

### Customizing Menu Items

Edit `Sidebar.js` to add/modify menu items:

```javascript
const menuItems = [
  { 
    icon: '👤', 
    label: 'Your Label', 
    subLabel: 'Optional subtitle',
    action: () => navigate('/your-route')
  },
  // Add more items...
];
```

## Styling

### Color Scheme
- **Primary Gradient**: Purple gradient (#667eea to #764ba2)
- **Background**: White to light gray gradient
- **Hover**: Light purple overlay

### Customization

Edit `Sidebar.css` to customize:

```css
/* Change sidebar width */
.sidebar {
  width: 280px; /* Change this value */
}

/* Change gradient colors */
.sidebar-toggle {
  background: linear-gradient(135deg, #your-color 0%, #your-color 100%);
}

/* Change hover effects */
.menu-item:hover {
  background: your-color;
}
```

## Responsive Design

### Desktop (> 768px)
- Sidebar width: 280px
- Toggle button: 30px wide
- Full menu visible

### Mobile (< 768px)
- Sidebar width: 250px
- Toggle button: 25px wide
- Optimized for smaller screens

## Behavior

### Auto-Hide Mode (Default)
1. Hover over toggle button → Sidebar slides in
2. Move mouse away → Sidebar slides out
3. Smooth 0.3s transition

### Pinned Mode
1. Click pin button → Sidebar stays open
2. Pin icon changes from 📍 to 📌
3. Sidebar remains visible until unpinned

### Overlay
- Semi-transparent overlay appears when sidebar is open
- Click overlay to close (only in auto-hide mode)
- Prevents interaction with content behind

## Integration with Routes

### Current Routes
```javascript
/                      → Login
/register             → Register
/login                → Login
/profile/:username    → User Profile
/edit-profile         → Edit Profile (new)
/matching-criteria    → Matching Criteria (new)
/top-matches          → Top Matches (new)
/shortlists           → Short Lists (new)
```

### Adding New Routes

1. Create component:
```javascript
// components/NewPage.js
const NewPage = () => {
  return <div>Your content</div>;
};
export default NewPage;
```

2. Add to App.js:
```javascript
import NewPage from './components/NewPage';

<Route path="/new-page" element={<NewPage />} />
```

3. Add to Sidebar menu:
```javascript
{ 
  icon: '🆕', 
  label: 'New Page', 
  action: () => navigate('/new-page')
}
```

## Accessibility

### Keyboard Navigation
- Tab to focus on toggle button
- Enter/Space to activate
- Tab through menu items
- Enter/Space to select menu item

### Screen Readers
- Descriptive labels for all interactive elements
- ARIA attributes for toggle button
- Semantic HTML structure

## Browser Support

✅ Chrome (latest)
✅ Firefox (latest)
✅ Safari (latest)
✅ Edge (latest)
✅ Mobile browsers

## Performance

- **Smooth animations**: CSS transitions (GPU accelerated)
- **Lightweight**: No heavy dependencies
- **Optimized**: Minimal re-renders with React hooks

## Future Enhancements

### Planned Features
- [ ] User profile picture integration
- [ ] Notification badges on menu items
- [ ] Keyboard shortcuts (e.g., Ctrl+B to toggle)
- [ ] Theme customization (light/dark mode)
- [ ] Collapsible sub-menus
- [ ] Recent pages history
- [ ] Search functionality

### Possible Improvements
- [ ] Swipe gesture support on mobile
- [ ] Customizable menu order (drag & drop)
- [ ] User preferences (remember pin state)
- [ ] Animation options
- [ ] Multiple sidebar positions (left/right)

## Troubleshooting

### Sidebar Not Appearing
1. Check if Sidebar component is imported in App.js
2. Verify CSS file is imported in Sidebar.js
3. Check browser console for errors
4. Clear browser cache

### Hover Not Working
1. Ensure `onMouseEnter` and `onMouseLeave` are properly set
2. Check z-index values in CSS
3. Verify no conflicting styles from other components

### Pin Button Not Working
1. Check `togglePin` function is called
2. Verify state updates correctly
3. Check for JavaScript errors in console

### Navigation Not Working
1. Ensure React Router is properly configured
2. Verify routes are defined in App.js
3. Check `useNavigate` hook is imported
4. Verify route paths match menu actions

## Testing

### Manual Testing Checklist
- [ ] Sidebar appears on hover
- [ ] Sidebar hides when mouse leaves (unpinned)
- [ ] Pin button toggles correctly
- [ ] All menu items navigate correctly
- [ ] Overlay appears/disappears correctly
- [ ] Responsive on mobile devices
- [ ] Footer links work
- [ ] Smooth animations
- [ ] No console errors

### Test Scenarios

1. **Auto-Hide Test**
   - Hover over toggle → Sidebar appears
   - Move away → Sidebar disappears

2. **Pin Test**
   - Click pin → Sidebar stays open
   - Move away → Sidebar stays open
   - Click pin again → Sidebar returns to auto-hide

3. **Navigation Test**
   - Click each menu item
   - Verify correct page loads
   - Check URL updates

4. **Mobile Test**
   - Test on mobile device or emulator
   - Verify touch interactions work
   - Check responsive layout

## Code Examples

### Get Current User for Profile Link
```javascript
// In Sidebar.js
const [currentUser, setCurrentUser] = useState(null);

useEffect(() => {
  // Get logged-in user from localStorage or context
  const user = localStorage.getItem('username');
  setCurrentUser(user);
}, []);

// Update profile menu item
{ 
  icon: '👤', 
  label: currentUser || '(profile picture)', 
  action: () => navigate(`/profile/${currentUser}`)
}
```

### Add Active State to Menu Items
```javascript
const location = useLocation();

<div 
  className={`menu-item ${location.pathname === item.path ? 'active' : ''}`}
>
```

```css
.menu-item.active {
  background: rgba(102, 126, 234, 0.2);
  border-left-color: #667eea;
  font-weight: 600;
}
```

## Summary

The sidebar provides:
- ✅ **Auto-hide functionality** with smooth animations
- ✅ **Pin/unpin capability** for persistent visibility
- ✅ **5 main menu options** matching your design
- ✅ **Footer links** for legal/info pages
- ✅ **Responsive design** for all screen sizes
- ✅ **Easy customization** via CSS and menu config
- ✅ **Placeholder pages** for all new routes

The sidebar is now fully functional and ready to use! Hover over the left edge of the screen to see it in action.
