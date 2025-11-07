# 📝 Search Name Format

## ✅ New Format (Updated)

### **Format Specification:**
```
gender|minage-maxage|minheight-maxheight|l3v3lscore|uniquenumber
```

### **Field Breakdown:**

| Field | Description | Examples |
|-------|-------------|----------|
| `gender` | M or F (first letter) | `M`, `F`, or blank |
| `minage-maxage` | Age range | `19-77`, `25-35`, `30-` |
| `minheight-maxheight` | Height range | `5'6-5'9`, `6'0-6'2`, `5'4+` |
| `l3v3lscore` | L3V3L match score (0-100) | `55`, `75`, `0` |
| `uniquenumber` | 3-digit unique identifier | `001`, `123`, `456` |

---

## 📋 Examples

### **Example 1: Male, 19-77, 5'6-5'9, 55% score**
```
M|19-77|5'6-5'9|55|001
```

### **Example 2: Female, 25-35, 5'2-5'6, 80% score**
```
F|25-35|5'2-5'6|80|002
```

### **Example 3: Male, any age, 6'0+, 60% score**
```
M||6'0+|60|003
```

### **Example 4: No gender filter, 30-40, 5'4-5'8, no score**
```
|30-40|5'4-5'8|0|004
```

---

## 🎯 Implementation Details

### **Unique Number Generation:**
```javascript
// 3 digits based on timestamp + search count
const uniqueNum = String((Date.now() % 1000) + (savedSearches.length || 0))
  .padStart(3, '0');
```

This ensures:
- ✅ **Unique** - Timestamp milliseconds + count
- ✅ **Readable** - Always 3 digits (001, 002, etc.)
- ✅ **Sortable** - Newer searches have higher numbers

### **Height Format:**
- **Full range:** `5'6-5'9` (min and max specified)
- **Minimum only:** `5'6+` (min specified, no max)
- **Maximum only:** `<5'9` (max specified, no min)
- **None:** `` (empty if no height criteria)

### **Age Format:**
- **Full range:** `19-77` (both min and max)
- **Minimum only:** `25-` (just minimum)
- **Maximum only:** `-40` (just maximum)
- **None:** `` (empty if no age criteria)

---

## 🔄 Before vs After

### **Old Format (Space-separated):**
```
M 19-77 5'6-5'9 L55
```

### **New Format (Pipe-separated):**
```
M|19-77|5'6-5'9|55|001
```

### **Benefits of New Format:**

1. ✅ **Structured** - Clear field separation with pipes
2. ✅ **Parseable** - Easy to split and process
3. ✅ **Unique** - Each search has unique identifier
4. ✅ **Sortable** - Can sort by any field
5. ✅ **Database-friendly** - Standard delimiter

---

## 📊 Display in UI

### **Search Name (Pipe Format):**
```
M|19-77|5'6-5'9|55|001
```

### **Search Description (Human-readable):**
```
I'm looking for a guy, age ranges from 19 to 77 years old, 
height from 5ft 6in to 5ft 9in and L3V3L match score ≥55%
```

**Note:** The name is compact/structured, the description is verbose/friendly.

---

## 🎨 Example in Saved Search Card

```
┌─────────────────────────────────────┐
│ M|19-77|5'6-5'9|55|001    ⏰ 🗑️   │  ← Name (pipe format)
│                                     │
│ I'm looking for a guy, age          │  ← Description (readable)
│ ranges from 19 to 77 years old,     │
│ height from 5ft 6in to 5ft 9in      │
│ and L3V3L match score ≥55%          │
│                                     │
│ [📂 Load Search]        11/6/2025  │
└─────────────────────────────────────┘
```

---

## 🧪 Test Cases

### Test 1: Full criteria
- Gender: Male
- Age: 19-77
- Height: 5'6-5'9
- Score: 55
- Expected: `M|19-77|5'6-5'9|55|001`

### Test 2: Partial criteria
- Gender: Female
- Age: (none)
- Height: 5'2-5'6
- Score: 0
- Expected: `F||5'2-5'6|0|002`

### Test 3: Minimal criteria
- Gender: (none)
- Age: 25-35
- Height: (none)
- Score: 0
- Expected: `|25-35||0|003`

### Test 4: Multiple saves (unique numbers)
- Save 1: `M|19-77|5'6-5'9|55|001`
- Save 2: `M|19-77|5'6-5'9|55|123`
- Save 3: `M|19-77|5'6-5'9|55|456`

---

## 🔍 How to Use

### **Automatic (Default):**
1. Set search filters
2. Click "💾 Save" button
3. Modal opens with **auto-generated name** in new format
4. Edit name if needed or keep default
5. Click "Save Search"

### **Manual (Custom Name):**
- You can still type any custom name
- Auto-generated name is just a **default suggestion**
- Users can override it completely

---

## 📝 Summary

**Format:** `gender|minage-maxage|minheight-maxheight|l3v3lscore|uniquenumber`

**Example:** `M|19-77|5'6-5'9|55|001`

**Key Features:**
- Pipe-separated fields
- Compact and structured
- Unique identifier
- Easy to parse and sort
- Database-friendly

---

**Last Updated:** November 6, 2025
**Status:** ✅ Implemented
