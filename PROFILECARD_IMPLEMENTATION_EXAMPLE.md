# ProfileCard Implementation Example
**Quick Start Guide**

---

## 🎯 Example: Update Dashboard to Use ProfileCard

### Before (Current Code)
```jsx
// Dashboard.js - Current implementation
const renderUserCard = (user, showActions = true, removeHandler = null) => {
  const profileData = user.viewerProfile || user.userProfile || user;
  const username = profileData?.username || user.username;
  const isOnline = onlineUsers.has(username);
  
  return (
    <div key={username} className="user-card">
      <div className="user-card-header">
        <div className="user-avatar">
          {profileData?.images?.[0] ? (
            <img src={profileData.images[0]} alt={username} />
          ) : (
            <div className="avatar-placeholder">
              {profileData?.firstName?.[0] || username?.[0]?.toUpperCase()}
            </div>
          )}
          <div className="status-badge-absolute">
            <OnlineStatusBadge username={username} size="small" />
          </div>
        </div>
      </div>
      
      <div className="user-card-body">
        <h4 className="username">{getDisplayName(profileData) || username}</h4>
        {profileData?.age && <p className="user-age">{profileData.age} years</p>}
        {profileData?.location && <p className="user-location">📍 {profileData.location}</p>}
        {profileData?.occupation && <p className="user-occupation">💼 {profileData.occupation}</p>}
      </div>
      
      {showActions && (
        <div className="user-card-actions">
          <button onClick={() => handleMessageUser(username, profileData)}>💬</button>
          <button onClick={() => handleProfileClick(username)}>👁️</button>
          {removeHandler && <button onClick={() => removeHandler(user)}>❌</button>}
        </div>
      )}
    </div>
  );
};
```

### After (Using ProfileCard)
```jsx
// Dashboard.js - New implementation
import ProfileCard from './ProfileCard';

const renderUserCard = (user, showActions = true, removeHandler = null, removeIcon = '❌') => {
  const profileData = user.viewerProfile || user.userProfile || user;
  const username = profileData?.username || user.username;
  
  // Prepare additional info based on section
  let additionalInfo = null;
  if (user.viewedAt) {
    additionalInfo = (
      <div>
        <p>Viewed: {new Date(user.viewedAt).toLocaleString()}</p>
        {user.viewCount > 1 && <span>({user.viewCount}x)</span>}
      </div>
    );
  } else if (user.lastMessage) {
    additionalInfo = (
      <p>{user.lastMessage.substring(0, 30)}...</p>
    );
  }
  
  return (
    <ProfileCard
      key={username}
      user={profileData}
      showActions={showActions}
      onMessage={(u) => handleMessageUser(u.username, u)}
      onView={(u) => handleProfileClick(u.username)}
      onRemove={removeHandler ? () => removeHandler(user) : null}
      removeIcon={removeIcon}
      additionalInfo={additionalInfo}
    />
  );
};

// Usage in sections
<div className="profile-cards-grid">
  {dashboardData.myFavorites.map(user => 
    renderUserCard(user, true, handleRemoveFromFavorites, '💔')
  )}
</div>
```

---

## 🔄 Complete Dashboard Migration

### Step 1: Add Import
```jsx
import ProfileCard from './ProfileCard';
```

### Step 2: Update renderUserCard Function
```jsx
const renderUserCard = (user, showActions = true, removeHandler = null, removeIcon = '❌', removeLabel = 'Remove') => {
  // Extract profile data
  const profileData = user.viewerProfile || user.userProfile || user;
  const username = profileData?.username || user.username;
  
  if (!username) return null;
  
  // Prepare section-specific additional info
  const getAdditionalInfo = () => {
    if (user.viewedAt) {
      return (
        <div className="view-info">
          <p className="last-seen">
            Viewed: {new Date(user.viewedAt).toLocaleString()}
            {user.viewCount > 1 && <span className="view-count-badge"> ({user.viewCount}x)</span>}
          </p>
        </div>
      );
    }
    
    if (user.lastMessage) {
      return (
        <p className="last-message">
          {user.lastMessage.length > 30 ? user.lastMessage.substring(0, 30) + '...' : user.lastMessage}
        </p>
      );
    }
    
    if (profileData?.lastSeen && !user.viewedAt && !user.lastMessage) {
      return (
        <p className="last-seen">
          Last seen: {new Date(profileData.lastSeen).toLocaleDateString()}
        </p>
      );
    }
    
    return null;
  };
  
  return (
    <ProfileCard
      key={username}
      user={profileData}
      showActions={showActions}
      onMessage={(u) => handleMessageUser(u.username, u)}
      onView={(u) => handleProfileClick(u.username)}
      onRemove={removeHandler ? () => removeHandler(user) : null}
      removeIcon={removeIcon}
      removeLabel={removeLabel}
      additionalInfo={getAdditionalInfo()}
    />
  );
};
```

### Step 3: Update Section Rendering
```jsx
const renderSection = (title, icon, data, sectionKey, removeHandler = null, removeIcon = '❌', removeLabel = 'Remove') => {
  return (
    <div className="dashboard-section">
      <div className="section-header" onClick={() => toggleSection(sectionKey)}>
        <h3>
          <span className="section-icon">{icon}</span>
          {title}
          <span className="count-badge">{data.length}</span>
        </h3>
        <button className="toggle-btn">
          {activeSections[sectionKey] ? '▼' : '▶'}
        </button>
      </div>
      
      {activeSections[sectionKey] && (
        <div className="section-content">
          {data.length > 0 ? (
            <div className="profile-cards-grid">
              {data.map(user => renderUserCard(user, true, removeHandler, removeIcon, removeLabel))}
            </div>
          ) : (
            <div className="empty-section">
              <p>No {title.toLowerCase()} yet</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
```

### Step 4: Render All Sections
```jsx
return (
  <div className="dashboard">
    <h2>My Dashboard</h2>
    
    {/* My Activities */}
    <div className="dashboard-category">
      <h3 className="category-title">My Activities</h3>
      
      {renderSection(
        'My Messages', '💬', 
        dashboardData.myMessages, 
        'myMessages',
        handleDeleteMessage, '🗑️', 'Delete Conversation'
      )}
      
      {renderSection(
        'My Favorites', '⭐', 
        dashboardData.myFavorites, 
        'myFavorites',
        handleRemoveFromFavorites, '💔', 'Remove from Favorites'
      )}
      
      {renderSection(
        'My Shortlists', '📋', 
        dashboardData.myShortlists, 
        'myShortlists',
        handleRemoveFromShortlist, '📤', 'Remove from Shortlist'
      )}
      
      {renderSection(
        'My Exclusions', '🚫', 
        dashboardData.myExclusions, 
        'myExclusions',
        handleRemoveFromExclusions, '✅', 'Unblock User'
      )}
    </div>
    
    {/* Others' Activities */}
    <div className="dashboard-category">
      <h3 className="category-title">Others' Activities</h3>
      
      {renderSection(
        'Profile Views', '👁️', 
        dashboardData.myViews, 
        'myViews',
        handleClearViewHistory, '🗑️', 'Clear View'
      )}
      
      {renderSection(
        'PII Requests', '🔒', 
        dashboardData.myRequests, 
        'myRequests',
        handleCancelPIIRequest, '❌', 'Cancel Request'
      )}
      
      {renderSection(
        'Their Favorites', '💝', 
        dashboardData.theirFavorites, 
        'theirFavorites'
      )}
      
      {renderSection(
        'Their Shortlists', '📝', 
        dashboardData.theirShortlists, 
        'theirShortlists'
      )}
    </div>
  </div>
);
```

---

## 📊 Benefits of This Change

### Before
- ❌ 80+ lines of card rendering code
- ❌ Manual online status badge positioning
- ❌ Inconsistent styling across sections
- ❌ Hard to maintain
- ❌ Duplicate code

### After
- ✅ 20 lines using ProfileCard
- ✅ Automatic online status badge
- ✅ Consistent styling everywhere
- ✅ Easy to maintain
- ✅ Reusable component

---

## 🎨 Result

All profile cards in Dashboard will now have:
- ✅ **Online status badge** (green/gray dot)
- ✅ **Display names** (First Last format)
- ✅ **Consistent design** across all 8 sections
- ✅ **Hover animations**
- ✅ **Responsive layout**
- ✅ **Action buttons** with proper icons

---

## 🚀 Next Steps

1. **Test in Dashboard** - Verify all sections work
2. **Apply to SearchPage** - Update search results
3. **Apply to Favorites** - Update favorites page
4. **Apply to Shortlist** - Update shortlist page
5. **Apply to other pages** - Consistent everywhere

---

**Time to Implement:** 30 minutes per page  
**Total Effort:** 2-3 hours for entire app  
**Impact:** High - Consistent UX everywhere
