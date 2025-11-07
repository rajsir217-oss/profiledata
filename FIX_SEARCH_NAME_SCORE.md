# 🔧 Fix: Search Name L3V3L Score Issue

## 🐛 Problem Found

### **Symptom:**
Search name showed wrong L3V3L score:
```
M|19-23|5'6-5'9|0|136  ← Shows 0
```

But criteria showed:
```
L3V3L Score: ≥65%      ← Actually 65
```

---

## 🔍 Root Cause

### **What Happened:**

1. **When editing a schedule** via clock button (⏰)
2. Modal opened with `editingScheduleFor` data
3. **Search name generation ran** using props from parent
4. Used `minMatchScore` from **current search page** (0)
5. Instead of `minMatchScore` from **saved search** (65)
6. Result: Name got regenerated with wrong score

### **Code Issue:**
```javascript
// Line 104 - Used parent's minMatchScore (current page)
const score = minMatchScore > 0 ? minMatchScore.toString() : '0';

// Should use editingScheduleFor.minMatchScore (saved search)
```

---

## ✅ Solution Implemented

### **1. Skip Auto-Generation When Editing**
```javascript
// Line 67-71
useEffect(() => {
  // Skip name generation if editing schedule
  if (editingScheduleFor) {
    return;  // Keep existing name
  }
  // ... rest of generation logic
}, [..., editingScheduleFor]);
```

**Result:** When clicking clock button, name stays as-is.

### **2. Add "Fix" Button to Regenerate**
```javascript
// Line 125-173
const regenerateSearchName = () => {
  const criteria = editingScheduleFor.criteria || {};
  const score = editingScheduleFor.minMatchScore || 0; // Correct score!
  // ... generate name from saved criteria
  setSearchName(newName);
  toast.success('Name regenerated from criteria');
};
```

**UI:**
```
┌──────────────────────────────────────┐
│ Search Name                          │
│ [M|19-23|5'6-5'9|0|136  ] [🔄 Fix]  │  ← New Fix button
│ Click "🔄 Fix" to regenerate...     │
└──────────────────────────────────────┘
```

---

## 🎯 How to Fix Your Saved Searches

### **For Existing Searches with Wrong Names:**

1. **Click ⏰ clock button** on saved search
2. **See the name** with wrong score (e.g., `M|19-23|5'6-5'9|0|136`)
3. **Look at criteria** - see correct score (e.g., `L3V3L Score: ≥65%`)
4. **Click "🔄 Fix" button**
5. **Name updates** to correct value: `M|19-23|5'6-5'9|65|136` ✅
6. **Click "Update Schedule"** to save

### **For New Searches:**
- No issue! Name generates correctly with proper L3V3L score

---

## 📊 Before & After

### **Before Fix:**
```
User clicks ⏰ clock button
→ Modal opens with editingScheduleFor
→ Name generation runs
→ Uses minMatchScore from parent props (0)
→ Name: M|19-23|5'6-5'9|0|136 ❌
→ Criteria shows: L3V3L Score: ≥65% 
→ Mismatch!
```

### **After Fix:**
```
User clicks ⏰ clock button
→ Modal opens with editingScheduleFor
→ Name generation SKIPS (editingScheduleFor exists)
→ Keeps original name: M|19-23|5'6-5'9|0|136
→ User clicks 🔄 Fix button
→ Regenerates from editingScheduleFor.minMatchScore (65)
→ Name: M|19-23|5'6-5'9|65|136 ✅
→ Criteria shows: L3V3L Score: ≥65%
→ Perfect match!
```

---

## 🧪 Test Cases

### **Test 1: Edit Schedule (Existing Search)**
1. Saved search has score 65
2. Current page has score 0
3. Click ⏰ clock button
4. **Expected:** Name keeps existing value (not regenerated)
5. **Result:** ✅ Pass

### **Test 2: Fix Button**
1. Click ⏰ clock button on search with wrong name
2. Name shows: `M|19-23|5'6-5'9|0|136`
3. Criteria shows: `L3V3L Score: ≥65%`
4. Click "🔄 Fix" button
5. **Expected:** Name becomes `M|19-23|5'6-5'9|65|136`
6. **Result:** ✅ Pass

### **Test 3: New Search**
1. Set L3V3L score to 55 on search page
2. Click "💾 Save" button
3. **Expected:** Name shows score 55
4. **Result:** ✅ Pass (no issue for new searches)

---

## 📝 Technical Details

### **Files Modified:**

#### **1. SaveSearchModal.js (Line 67-71)**
```javascript
// Added early return to skip generation
if (editingScheduleFor) {
  return;
}
```

#### **2. SaveSearchModal.js (Line 125-173)**
```javascript
// Added regenerateSearchName helper function
const regenerateSearchName = () => {
  const score = editingScheduleFor.minMatchScore || 0;
  // Uses saved search's score, not current page's
};
```

#### **3. SaveSearchModal.js (Line 291-313)**
```javascript
// Added Fix button in UI
<button onClick={regenerateSearchName}>
  🔄 Fix
</button>
```

---

## 🎨 UI Changes

### **New Button:**
- **Icon:** 🔄
- **Text:** "Fix"
- **Style:** Secondary button
- **Position:** Right of search name input
- **Tooltip:** "Regenerate name from criteria"
- **Help text:** "Click '🔄 Fix' to regenerate name from criteria with correct L3V3L score"

### **Toast Message:**
- **On click:** "Name regenerated from criteria" ✅
- **Style:** Success toast (green)

---

## 🔑 Key Learnings

### **Issue:**
- State from parent props can be stale/wrong
- Need to use local state (`editingScheduleFor`) when available

### **Prevention:**
- Always check data source when generating derived values
- Skip regeneration when editing existing data
- Provide manual fix option for user correction

### **Best Practice:**
```javascript
// ❌ Wrong - Uses parent props
const score = minMatchScore;

// ✅ Correct - Uses local/saved data
const score = editingScheduleFor 
  ? editingScheduleFor.minMatchScore  // Saved search's score
  : minMatchScore;                    // Current page's score
```

---

## 📋 Summary

**Problem:** Search names showed wrong L3V3L score when editing schedules

**Cause:** Name generation used current page's score instead of saved search's score

**Fix:** 
1. Skip auto-generation when editing (keep original name)
2. Add "🔄 Fix" button to regenerate correctly

**Result:** Users can fix incorrect names with one click ✅

---

**Status:** ✅ Fixed
**Date:** November 6, 2025
**Tested:** Yes
**Deployed:** Yes
