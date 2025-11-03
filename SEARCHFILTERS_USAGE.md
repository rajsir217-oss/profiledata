# SearchFilters Component - Usage Guide

## Overview
Reusable search filters component that can be used in both:
1. **SearchPage2** - Main search interface (replacing the 3 old tabs)
2. **EditSavedSearchModal** - Edit saved search with pre-filled values

---

## Installation

```javascript
import SearchFilters from './components/SearchFilters';
```

---

## Usage Example 1: SearchPage2 (Main Search Tab)

```javascript
// In SearchPage2.js - Replace the "basic" tab content with:

{
  id: 'search',
  icon: '🔍',
  label: 'Search',
  badge: minMatchScore > 0 ? `${minMatchScore}%` : null,
  content: (
    <SearchFilters
      // Search criteria state
      searchCriteria={searchCriteria}
      minMatchScore={minMatchScore}
      setMinMatchScore={setMinMatchScore}
      handleInputChange={handleInputChange}
      
      // Advanced filters toggle
      showAdvancedFilters={showAdvancedFilters}
      setShowAdvancedFilters={setShowAdvancedFilters}
      
      // Action callbacks
      onSearch={() => handleSearch(1)}
      onSave={() => setShowSaveModal(true)}
      
      // System/User config
      systemConfig={systemConfig}
      isPremiumUser={isPremiumUser}
      currentUserProfile={currentUserProfile}
      
      // Dropdown options
      bodyTypeOptions={bodyTypeOptions}
      occupationOptions={occupationOptions}
      eatingOptions={eatingOptions}
      lifestyleOptions={lifestyleOptions}
      
      // Button text (optional - defaults shown)
      searchButtonText="🔍 Search"
      saveButtonText="💾 Save Search"
    />
  )
}
```

---

## Usage Example 2: EditSavedSearchModal

```javascript
// In EditSavedSearchModal.js

const EditSavedSearchModal = ({ savedSearch, onClose, onSave }) => {
  const [editedCriteria, setEditedCriteria] = useState(savedSearch.criteria);
  const [editedScore, setEditedScore] = useState(savedSearch.minMatchScore || 0);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditedCriteria({ ...editedCriteria, [name]: value });
  };

  const handleSaveChanges = () => {
    onSave({
      ...savedSearch,
      criteria: editedCriteria,
      minMatchScore: editedScore
    });
    onClose();
  };

  return (
    <div className="modal">
      <div className="modal-header">
        <h3>✏️ Edit Saved Search: {savedSearch.name}</h3>
      </div>
      
      <div className="modal-body">
        <SearchFilters
          // PRE-FILLED with saved search values
          searchCriteria={editedCriteria}
          minMatchScore={editedScore}
          setMinMatchScore={setEditedScore}
          handleInputChange={handleInputChange}
          
          showAdvancedFilters={showAdvanced}
          setShowAdvancedFilters={setShowAdvanced}
          
          // Custom button actions for modal
          onSearch={handleSaveChanges}  // "Apply" instead of "Search"
          onSave={null}  // Hide Save button (optional)
          
          systemConfig={systemConfig}
          isPremiumUser={isPremiumUser}
          currentUserProfile={currentUserProfile}
          
          bodyTypeOptions={bodyTypeOptions}
          occupationOptions={occupationOptions}
          eatingOptions={eatingOptions}
          lifestyleOptions={lifestyleOptions}
          
          // Custom button text
          searchButtonText="✅ Apply Changes"
          hideActionButtons={false}
        />
      </div>
      
      <div className="modal-footer">
        <button onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
};
```

---

## Props Reference

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `searchCriteria` | Object | ✅ Yes | - | Current search criteria values |
| `minMatchScore` | Number | ✅ Yes | - | L3V3L compatibility score (0-100) |
| `setMinMatchScore` | Function | ✅ Yes | - | Updates L3V3L score |
| `handleInputChange` | Function | ✅ Yes | - | Handles input field changes |
| `showAdvancedFilters` | Boolean | ✅ Yes | - | Controls advanced filters visibility |
| `setShowAdvancedFilters` | Function | ✅ Yes | - | Toggles advanced filters |
| `onSearch` | Function | ⚠️ Optional | null | Callback when Search button clicked |
| `onSave` | Function | ⚠️ Optional | null | Callback when Save Search button clicked |
| `systemConfig` | Object | ✅ Yes | - | System config (for L3V3L enable check) |
| `isPremiumUser` | Boolean | ✅ Yes | - | Whether user has premium access |
| `currentUserProfile` | Object | ✅ Yes | - | Current user's profile data |
| `bodyTypeOptions` | Array | ⚠️ Optional | [] | Available body type options |
| `occupationOptions` | Array | ⚠️ Optional | [] | Available occupation options |
| `eatingOptions` | Array | ⚠️ Optional | [] | Available eating preference options |
| `lifestyleOptions` | Array | ⚠️ Optional | [] | Lifestyle options (drinking, smoking) |
| `hideActionButtons` | Boolean | ⚠️ Optional | false | Hide Save/Search buttons (for custom layouts) |
| `searchButtonText` | String | ⚠️ Optional | "🔍 Search" | Custom text for search button |
| `saveButtonText` | String | ⚠️ Optional | "💾 Save Search" | Custom text for save button |

---

## Features

### ✅ **L3V3L Compatibility Slider**
- Shows only if `systemConfig.enable_l3v3l_for_all` or `isPremiumUser` is true
- Real-time percentage display
- Auto-triggers search after 600ms debounce
- Info message when set to 0%

### ✅ **Basic Filters (Always Visible)**
- Keyword Search
- Location
- Age Range (Min/Max)
- Height (Min/Max) with Feet + Inches

### ✅ **Action Buttons**
- Appears twice: after basic filters AND after advanced filters (when expanded)
- Customizable button text
- Can hide buttons entirely with `hideActionButtons={true}`

### ✅ **View More/Less Toggle**
- Collapses/expands advanced filters
- Centered button with hover effect

### ✅ **Advanced Filters (Collapsible)**
- Gender (locked for non-admin/moderator)
- Body Type
- Occupation
- Eating Preference
- Drinking
- Smoking
- Days Back

---

## Theme Support

All styles use CSS variables:
- `--text-color` - Text color
- `--primary-color` - Primary accent color
- `--surface-color` - Button backgrounds
- `--border-color` - Input borders
- `--hover-background` - Hover states
- `--info-color-light` - Info messages
- `--text-secondary` - Secondary text

---

## Next Steps

1. ✅ **Integrate into SearchPage2** - Replace "basic" tab with SearchFilters component
2. ✅ **Create EditSavedSearchModal** - Use SearchFilters with pre-filled values
3. ✅ **Test both implementations** - Verify all features work in both contexts
4. ✅ **Delete old tabs** - Remove "advanced" and "l3v3l" tabs after testing
