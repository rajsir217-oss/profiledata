# ProfileCard Component - Universal Profile Display
**Date:** October 9, 2025  
**Status:** ✅ Ready to Use

---

## 🎯 Purpose

A **reusable ProfileCard component** that displays user profiles consistently throughout the app with:
- User avatar with online status badge
- Display name (First Last format)
- Key profile details (age, location, occupation, education)
- Action buttons (message, view, remove)
- Responsive design
- Hover animations

---

## 📦 Component Files

- **`ProfileCard.js`** - Main component
- **`ProfileCard.css`** - Styling with animations

---

## 🎨 Visual Design

### Standard Card
```
┌─────────────────────────┐
│      [Avatar 🟢]        │
│                         │
│    Shyam Patel         │
│      28 years          │
│  📍 Ahmedabad, India   │
│  💼 Nurse              │
│  🎓 Bachelor's         │
│                         │
│  ─────────────────     │
│  💬    👁️    ❌       │
└─────────────────────────┘
```

### Compact Card
```
┌──────────────────┐
│   [Avatar 🟢]    │
│  Shyam Patel    │
│    28 years     │
│ 📍 Ahmedabad    │
│ 💼 Nurse        │
│  ────────────   │
│  💬  👁️  ❌    │
└──────────────────┘
```

---

## 🔧 Usage

### Basic Usage
```jsx
import ProfileCard from './ProfileCard';

<ProfileCard 
  user={userObject}
  showActions={true}
  onMessage={(user) => handleMessage(user)}
  onView={(user) => handleView(user)}
  onRemove={(user) => handleRemove(user)}
/>
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `user` | Object | Required | User object with profile data |
| `showActions` | Boolean | `true` | Show action buttons |
| `onMessage` | Function | `null` | Callback when message button clicked |
| `onView` | Function | `null` | Callback when view button clicked |
| `onRemove` | Function | `null` | Callback when remove button clicked |
| `removeIcon` | String | `'❌'` | Icon for remove button |
| `removeLabel` | String | `'Remove'` | Tooltip for remove button |
| `additionalInfo` | ReactNode | `null` | Custom content below details |
| `compact` | Boolean | `false` | Use compact layout |
| `onClick` | Function | `null` | Custom click handler for card |

### User Object Structure
```javascript
{
  username: "shyam_patel",
  firstName: "Shyam",
  lastName: "Patel",
  age: 28,
  location: "Ahmedabad, India",
  occupation: "Nurse",
  education: "Bachelor's Degree",
  images: ["http://..."],
  // or
  profileImage: "http://...",
  avatar: "http://..."
}
```

---

## 📍 Where to Use ProfileCard

### 1. **Dashboard** (`Dashboard.js`)
Replace existing user cards in all 8 sections:

```jsx
import ProfileCard from './ProfileCard';

// In renderUserCard function
const renderUserCard = (user, showActions = true, removeHandler = null) => {
  return (
    <ProfileCard
      user={user}
      showActions={showActions}
      onMessage={(u) => handleMessageUser(u.username, u)}
      onView={(u) => handleProfileClick(u.username)}
      onRemove={removeHandler ? () => removeHandler(user) : null}
      removeIcon={getRemoveIcon(sectionType)}
      removeLabel={getRemoveLabel(sectionType)}
      additionalInfo={getAdditionalInfo(user, sectionType)}
    />
  );
};

// Use in grid
<div className="profile-cards-grid">
  {data.map(user => renderUserCard(user, true, removeHandler))}
</div>
```

**Sections to Update:**
- My Messages
- My Favorites
- My Shortlists
- My Views
- My Exclusions
- My Requests
- Their Favorites
- Their Shortlists

---

### 2. **SearchPage** (`SearchPage.js`)
Replace search result cards:

```jsx
import ProfileCard from './ProfileCard';

// In search results rendering
<div className="profile-cards-grid">
  {searchResults.map(user => (
    <ProfileCard
      key={user.username}
      user={user}
      showActions={true}
      onMessage={(u) => handleMessage(u)}
      onView={(u) => navigate(`/profile/${u.username}`)}
      additionalInfo={
        <div>
          <p>Height: {user.height}</p>
          <p>Religion: {user.religion}</p>
        </div>
      }
    />
  ))}
</div>
```

---

### 3. **Favorites Page** (`Favorites.js`)
```jsx
import ProfileCard from './ProfileCard';

<div className="profile-cards-grid">
  {favorites.map(user => (
    <ProfileCard
      key={user.username}
      user={user}
      onMessage={(u) => handleMessage(u)}
      onView={(u) => navigate(`/profile/${u.username}`)}
      onRemove={(u) => handleRemoveFromFavorites(u.username)}
      removeIcon="💔"
      removeLabel="Remove from Favorites"
    />
  ))}
</div>
```

---

### 4. **Shortlist Page** (`Shortlist.js`)
```jsx
import ProfileCard from './ProfileCard';

<div className="profile-cards-grid">
  {shortlist.map(user => (
    <ProfileCard
      key={user.username}
      user={user}
      onMessage={(u) => handleMessage(u)}
      onView={(u) => navigate(`/profile/${u.username}`)}
      onRemove={(u) => handleRemoveFromShortlist(u.username)}
      removeIcon="📤"
      removeLabel="Remove from Shortlist"
    />
  ))}
</div>
```

---

### 5. **Exclusions Page** (`Exclusions.js`)
```jsx
import ProfileCard from './ProfileCard';

<div className="profile-cards-grid">
  {exclusions.map(user => (
    <ProfileCard
      key={user.username}
      user={user}
      showActions={false}  // No message button for blocked users
      onView={(u) => navigate(`/profile/${u.username}`)}
      onRemove={(u) => handleUnblock(u.username)}
      removeIcon="✅"
      removeLabel="Unblock User"
    />
  ))}
</div>
```

---

### 6. **Requests Page** (`Requests.js`)
```jsx
import ProfileCard from './ProfileCard';

<div className="profile-cards-grid">
  {requests.map(user => (
    <ProfileCard
      key={user.username}
      user={user}
      onMessage={(u) => handleMessage(u)}
      onView={(u) => navigate(`/profile/${u.username}`)}
      additionalInfo={
        <div className="request-actions">
          <button onClick={() => handleApprove(user.username)}>
            ✅ Approve
          </button>
          <button onClick={() => handleReject(user.username)}>
            ❌ Reject
          </button>
        </div>
      }
    />
  ))}
</div>
```

---

### 7. **Messages List** (Already Updated)
MessageList component already has online status badges.

---

### 8. **Profile View Page** (`Profile.js`)
For "Similar Profiles" or "Suggested Matches" sections:

```jsx
import ProfileCard from './ProfileCard';

<div className="similar-profiles">
  <h3>Similar Profiles</h3>
  <div className="profile-cards-grid compact">
    {similarProfiles.map(user => (
      <ProfileCard
        key={user.username}
        user={user}
        compact={true}
        onMessage={(u) => handleMessage(u)}
        onView={(u) => navigate(`/profile/${u.username}`)}
      />
    ))}
  </div>
</div>
```

---

## 🎨 Customization Examples

### Custom Additional Info
```jsx
<ProfileCard
  user={user}
  additionalInfo={
    <div>
      <p>Viewed: {new Date(user.viewedAt).toLocaleDateString()}</p>
      <p>Views: {user.viewCount}x</p>
    </div>
  }
/>
```

### Custom Click Handler
```jsx
<ProfileCard
  user={user}
  onClick={(user) => {
    // Custom action instead of navigation
    openModal(user);
  }}
/>
```

### Different Remove Icons by Context
```jsx
// Favorites
removeIcon="💔"

// Shortlist
removeIcon="📤"

// Exclusions
removeIcon="✅"

// Requests
removeIcon="❌"
```

### Compact Layout
```jsx
<ProfileCard
  user={user}
  compact={true}  // Smaller size, less details
/>
```

---

## 🎯 Features

### ✅ Built-in Features
1. **Online Status Badge** - Auto-updates every 30s
2. **Display Names** - Shows "First Last" format
3. **Responsive Design** - Works on all screen sizes
4. **Hover Effects** - Smooth animations
5. **Click to View** - Navigate to profile
6. **Action Buttons** - Message, View, Remove
7. **Fallback Avatar** - Shows initials if no image
8. **Flexible Layout** - Standard or compact mode

### 🎨 Visual Features
- Gradient avatar placeholders
- Smooth hover lift effect
- Shadow depth on hover
- Icon indicators for location, occupation, education
- Customizable action buttons
- Border and spacing consistency

---

## 📱 Responsive Breakpoints

| Screen Size | Grid Columns | Card Width | Avatar Size |
|-------------|--------------|------------|-------------|
| Desktop (>1200px) | 4-5 cards | 250px | 80px |
| Tablet (768-1200px) | 3-4 cards | 220px | 70px |
| Mobile (480-768px) | 2-3 cards | 180px | 60px |
| Small (<480px) | 2 cards | 150px | 60px |

---

## 🔄 Migration Guide

### Step 1: Import ProfileCard
```jsx
import ProfileCard from './ProfileCard';
```

### Step 2: Replace Existing Card Rendering
**Before:**
```jsx
<div className="user-card">
  <img src={user.avatar} />
  <h4>{user.firstName}</h4>
  <p>{user.location}</p>
  <button onClick={() => message(user)}>Message</button>
</div>
```

**After:**
```jsx
<ProfileCard
  user={user}
  onMessage={(u) => message(u)}
/>
```

### Step 3: Update Grid Container
```jsx
<div className="profile-cards-grid">
  {users.map(user => (
    <ProfileCard key={user.username} user={user} />
  ))}
</div>
```

---

## 🎨 CSS Classes

### Main Classes
- `.profile-card` - Card container
- `.profile-card.compact` - Compact variant
- `.profile-card-avatar` - Avatar section
- `.profile-card-body` - Details section
- `.profile-card-actions` - Action buttons
- `.profile-cards-grid` - Grid container

### Utility Classes
- `.avatar-image` - Avatar image
- `.avatar-placeholder` - Fallback avatar
- `.status-badge-absolute` - Online status position
- `.btn-action` - Action button base
- `.btn-message`, `.btn-view`, `.btn-remove` - Specific buttons

---

## 🚀 Benefits

### For Developers
1. **Consistency** - Same UI everywhere
2. **Less Code** - Reusable component
3. **Easy Updates** - Change once, applies everywhere
4. **Type Safety** - Clear prop structure
5. **Maintainable** - Single source of truth

### For Users
1. **Familiar Interface** - Same card design everywhere
2. **Online Status** - Always visible
3. **Quick Actions** - Consistent button placement
4. **Responsive** - Works on all devices
5. **Fast Loading** - Optimized animations

---

## 📊 Performance

### Optimizations
- Lazy loading of online status
- Memoized display name calculations
- CSS animations (GPU accelerated)
- Efficient re-renders
- Small bundle size (~5KB)

---

## 🐛 Troubleshooting

### Issue: Online status not showing
**Solution:** Ensure user object has `username` field

### Issue: Avatar not displaying
**Solution:** Check `images[0]`, `profileImage`, or `avatar` field exists

### Issue: Display name shows username
**Solution:** Ensure `firstName` and/or `lastName` fields exist

### Issue: Cards not in grid
**Solution:** Wrap cards in `<div className="profile-cards-grid">`

---

## 📚 Related Components

- **OnlineStatusBadge** - Status indicator
- **MessageModal** - For messaging
- **userDisplay.js** - Display name utilities

---

## ✅ Implementation Checklist

- [ ] Import ProfileCard in component
- [ ] Replace existing user cards
- [ ] Add profile-cards-grid wrapper
- [ ] Test online status display
- [ ] Test action buttons
- [ ] Test responsive design
- [ ] Test with missing data (fallbacks)
- [ ] Update CSS if needed

---

## 🎉 Result

After implementing ProfileCard throughout the app:
- ✅ **Consistent UI** - Same design everywhere
- ✅ **Online Status** - Visible on all profile cards
- ✅ **Display Names** - "First Last" format everywhere
- ✅ **Less Code** - Reduced duplication
- ✅ **Easy Maintenance** - Update once, applies everywhere

---

**Status:** Ready to implement  
**Estimated Time:** 2-3 hours to migrate all pages  
**Priority:** High (improves consistency and UX)

---

**Last Updated:** October 9, 2025
