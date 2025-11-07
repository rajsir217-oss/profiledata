# LoadMore Component Implementation Guide

## Overview
Replace traditional pagination with a modern "View more" button pattern.

---

## ✅ Created Files

1. **`/frontend/src/components/LoadMore.js`** - Main component
2. **`/frontend/src/components/LoadMore.css`** - Styles

---

## 🎯 How to Use

### Option 1: Replace Pagination in SearchPage2.js

**Step 1: Import LoadMore component**

```javascript
// At the top of SearchPage2.js
import LoadMore from './LoadMore';
```

**Step 2: Modify state to support incremental loading**

```javascript
// Add to existing state
const [displayedCount, setDisplayedCount] = useState(20); // Initially show 20
const [loadingMore, setLoadingMore] = useState(false);
```

**Step 3: Create load more handler**

```javascript
const handleLoadMore = () => {
  setLoadingMore(true);
  
  // Simulate loading delay (remove in production if data loads fast)
  setTimeout(() => {
    setDisplayedCount(prev => Math.min(prev + 20, filteredUsers.length));
    setLoadingMore(false);
  }, 300);
};
```

**Step 4: Replace pagination section (around line 1871-1887)**

Replace this:
```javascript
{filteredUsers.length > 0 && (
  <div className="pagination-container">
    <div className="pagination-info">
      Showing {indexOfFirstRecord + 1}-{Math.min(indexOfLastRecord, filteredUsers.length)} of {filteredUsers.length} filtered results
      {totalResults > 0 && totalResults !== filteredUsers.length && (
        <span className="text-muted ms-2">
          ({totalResults} total in database)
        </span>
      )}
    </div>
    {totalPages > 1 && (
      <div className="pagination-controls">
        {renderPaginationButtons()}
      </div>
    )}
  </div>
)}
```

With this:
```javascript
{filteredUsers.length > 0 && (
  <LoadMore
    currentCount={displayedCount}
    totalCount={filteredUsers.length}
    onLoadMore={handleLoadMore}
    loading={loadingMore}
    itemsPerLoad={20}
    itemLabel="profiles"
    buttonText="View more"
  />
)}
```

**Step 5: Update UserCard rendering to use displayedCount**

Find where users are mapped (around line 1700-1800) and update:

```javascript
{filteredUsers.slice(0, displayedCount).map((user, index) => (
  <UserCard
    key={user._id || user.username}
    // ... rest of props
  />
))}
```

---

## 🎨 Customization Options

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `currentCount` | number | 0 | Number of items currently displayed |
| `totalCount` | number | 0 | Total number of items available |
| `onLoadMore` | function | required | Callback when "View more" is clicked |
| `loading` | boolean | false | Show loading spinner |
| `itemsPerLoad` | number | 20 | How many items to load on each click |
| `itemLabel` | string | 'items' | Label for items (e.g., "profiles", "users") |
| `buttonText` | string | 'View more' | Text for the button |
| `showCountFirst` | boolean | true | Show count before button |

---

## 🎯 Usage Examples

### Example 1: Simple Usage
```javascript
<LoadMore
  currentCount={20}
  totalCount={234}
  onLoadMore={() => loadMore()}
  itemLabel="positions"
/>
```

### Example 2: With Loading State
```javascript
<LoadMore
  currentCount={users.length}
  totalCount={totalUsers}
  onLoadMore={handleLoadMore}
  loading={isLoadingMore}
  itemsPerLoad={50}
  itemLabel="users"
  buttonText="Load more users"
/>
```

### Example 3: For UserManagement.js
```javascript
// Replace Pagination component with:
<LoadMore
  currentCount={users.length}
  totalCount={totalUsers}
  onLoadMore={loadMoreUsers}
  loading={loading}
  itemsPerLoad={20}
  itemLabel="users"
/>
```

---

## 🔄 Complete SearchPage2.js Changes

### Add these changes to SearchPage2.js:

**1. Add import (line ~20):**
```javascript
import LoadMore from './LoadMore';
```

**2. Add state (line ~45):**
```javascript
const [displayedCount, setDisplayedCount] = useState(20);
const [loadingMore, setLoadingMore] = useState(false);
```

**3. Reset displayedCount when filters change (in handleSearch):**
```javascript
const handleSearch = async () => {
  setSearching(true);
  setCurrentPage(1);
  setDisplayedCount(20); // Add this line
  // ... rest of handleSearch
};
```

**4. Add load more handler:**
```javascript
const handleLoadMore = () => {
  setLoadingMore(true);
  setTimeout(() => {
    setDisplayedCount(prev => Math.min(prev + 20, filteredUsers.length));
    setLoadingMore(false);
  }, 300);
};
```

**5. Update user rendering (find the map around line 1700):**
```javascript
{filteredUsers.slice(0, displayedCount).map((user, index) => (
  // ... UserCard
))}
```

**6. Replace pagination section (line ~1871):**
```javascript
{filteredUsers.length > 0 && (
  <LoadMore
    currentCount={Math.min(displayedCount, filteredUsers.length)}
    totalCount={filteredUsers.length}
    onLoadMore={handleLoadMore}
    loading={loadingMore}
    itemsPerLoad={20}
    itemLabel="profiles"
    buttonText="View more"
  />
)}
```

---

## 🎨 Visual Result

```
┌─────────────────────────────────────────────┐
│                                             │
│  [User Cards displayed here]                │
│                                             │
└─────────────────────────────────────────────┘

        Viewing 20 of 234 profiles

    ┌───────────────────────────────┐
    │       View more (20 more)      │
    └───────────────────────────────┘
```

After clicking "View more":

```
        Viewing 40 of 234 profiles

    ┌───────────────────────────────┐
    │       View more (20 more)      │
    └───────────────────────────────┘
```

When all loaded:

```
        Viewing 234 of 234 profiles

        ✓ All 234 profiles loaded
```

---

## 📱 Mobile Responsive

The component is fully responsive:
- **Desktop:** Full width button with all info
- **Tablet:** Slightly compressed
- **Mobile:** Full-width button, stacked layout

---

## 🎯 Benefits Over Pagination

✅ **Cleaner UI** - No complex page numbers
✅ **Better UX** - Progressive disclosure
✅ **Mobile-friendly** - One button instead of multiple
✅ **Modern** - Matches industry standards (LinkedIn, Twitter, etc.)
✅ **Flexible** - Can show exact counts or hide them
✅ **Performance** - Only renders displayed items

---

## 🔧 Optional: Backend API Support

If you want true infinite scroll with API calls:

```javascript
const handleLoadMore = async () => {
  setLoadingMore(true);
  try {
    const nextPage = Math.floor(displayedCount / 20) + 1;
    const response = await api.get(`/search?page=${nextPage}&limit=20`);
    setUsers(prev => [...prev, ...response.data.users]);
    setDisplayedCount(prev => prev + 20);
  } catch (error) {
    console.error('Error loading more:', error);
  } finally {
    setLoadingMore(false);
  }
};
```

---

## 🚀 Ready to Use!

The LoadMore component is now available in your project. Follow the implementation guide above to replace pagination in any component.

**Files to modify:**
- ✅ `SearchPage2.js` (main search page)
- ⚠️ `UserManagement.js` (optional - admin page)
- ⚠️ `ActivityLogs.js` (optional - if needed)
