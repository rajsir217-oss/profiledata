# How to Control Cards Per Row
**Guide:** Configure the number of cards displayed per row/container

---

## 📍 Locations to Modify

### 1. **Search Page** (`SearchPage.css`)
**File:** `/frontend/src/components/SearchPage.css`  
**Line:** 856

```css
.results-grid {
  display: grid !important;
  grid-template-columns: repeat(3, 1fr); /* ← Change this number */
  gap: 8px;
  row-gap: 8px;
}
```

**Current:** 3 cards per row  
**To change:** Replace `repeat(3, 1fr)` with your desired number

---

### 2. **Dashboard Categories** (`CategorySection.css`)
**File:** `/frontend/src/components/CategorySection.css`  
**Line:** 108

```css
.category-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); /* ← Change minmax */
  gap: 16px;
}
```

**Current:** Auto-fills based on minimum 200px per card  
**To change:** Adjust the `200px` value

---

## 🎯 Examples

### Fixed Number of Columns

```css
/* 2 cards per row */
grid-template-columns: repeat(2, 1fr);

/* 3 cards per row */
grid-template-columns: repeat(3, 1fr);

/* 4 cards per row */
grid-template-columns: repeat(4, 1fr);

/* 5 cards per row */
grid-template-columns: repeat(5, 1fr);
```

---

### Responsive (Auto-fill based on card width)

```css
/* Minimum 150px per card - fits more cards */
grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));

/* Minimum 200px per card - balanced (current Dashboard) */
grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));

/* Minimum 250px per card - larger cards */
grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));

/* Minimum 300px per card - very large cards */
grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
```

---

### Mixed (Fixed + Min Width)

```css
/* At least 3 columns, cards min 180px */
grid-template-columns: repeat(auto-fill, minmax(max(180px, calc(100% / 3)), 1fr));

/* At least 4 columns, cards min 150px */
grid-template-columns: repeat(auto-fill, minmax(max(150px, calc(100% / 4)), 1fr));
```

---

## 📊 Recommendations by Screen Size

### Desktop (>1200px)
```css
/* Option 1: Fixed 4 columns */
grid-template-columns: repeat(4, 1fr);

/* Option 2: Auto-fill with 220px min */
grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
```

### Laptop (992px-1200px)
```css
/* Option 1: Fixed 3 columns */
grid-template-columns: repeat(3, 1fr);

/* Option 2: Auto-fill with 250px min */
grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
```

### Tablet (768px-992px)
```css
/* Option 1: Fixed 2 columns */
grid-template-columns: repeat(2, 1fr);

/* Option 2: Auto-fill with 300px min */
grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
```

### Mobile (<768px)
```css
/* Single column */
grid-template-columns: 1fr;
```

---

## 🎨 Complete Example

Here's a complete responsive grid setup:

```css
/* Default: 4 columns */
.results-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

/* Large screens: 4 columns */
@media (min-width: 1400px) {
  .results-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

/* Desktop: 3 columns */
@media (max-width: 1200px) {
  .results-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }
}

/* Tablet: 2 columns */
@media (max-width: 768px) {
  .results-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }
}

/* Mobile: 1 column */
@media (max-width: 576px) {
  .results-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
}
```

---

## 🔧 Advanced Options

### Different Sizes Per Column

```css
/* First column wider */
grid-template-columns: 2fr 1fr 1fr;

/* Middle column wider */
grid-template-columns: 1fr 2fr 1fr;

/* Custom ratios */
grid-template-columns: 3fr 2fr 2fr 1fr;
```

### Mixed Fixed and Flexible

```css
/* First column fixed, rest flexible */
grid-template-columns: 250px repeat(3, 1fr);

/* Side columns fixed, middle flexible */
grid-template-columns: 200px 1fr 200px;
```

### Auto-fit vs Auto-fill

```css
/* auto-fill: Creates empty columns if space available */
grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));

/* auto-fit: Collapses empty columns, expands cards */
grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
```

---

## 📐 Gap (Spacing Between Cards)

```css
/* Small gap */
gap: 8px;

/* Medium gap (recommended) */
gap: 16px;

/* Large gap */
gap: 24px;

/* Different horizontal/vertical gaps */
column-gap: 16px;
row-gap: 20px;
```

---

## 🚀 Quick Changes

### Want More Cards Per Row?

**Current (Search Page):**
```css
grid-template-columns: repeat(3, 1fr);
```

**Change to 4 per row:**
```css
grid-template-columns: repeat(4, 1fr);
```

**Change to 5 per row:**
```css
grid-template-columns: repeat(5, 1fr);
```

---

### Want Fewer Cards Per Row?

**Change to 2 per row:**
```css
grid-template-columns: repeat(2, 1fr);
```

**Change to 1 per row:**
```css
grid-template-columns: 1fr;
```

---

## 💡 Best Practices

### 1. **Consider Card Width**
- UserCards look best at 180px-300px wide
- Too narrow (<150px): Buttons get cramped
- Too wide (>350px): Wasted space

### 2. **Use Responsive Breakpoints**
```css
/* Don't use same columns on all screens */
@media (max-width: 768px) {
  /* Reduce columns on smaller screens */
}
```

### 3. **Test with Sidebar**
- Sidebar open: Fewer columns fit
- Sidebar closed: More columns fit
- Use container queries (already implemented in UserCard!)

### 4. **Match Design System**
- Dashboard: Auto-fill (flexible)
- Search: Fixed columns (predictable)
- Mobile: Always 1 column

---

## 📱 Responsive Template

Copy this template for any grid:

```css
/* Base */
.my-cards-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

/* Tablet */
@media (max-width: 992px) {
  .my-cards-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

/* Mobile Landscape */
@media (max-width: 768px) {
  .my-cards-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Mobile Portrait */
@media (max-width: 576px) {
  .my-cards-grid {
    grid-template-columns: 1fr;
  }
}
```

---

## 🎯 Current Settings

### Search Page
- **Desktop:** 3 cards per row (fixed)
- **Tablet:** 2 cards per row (auto-fit)
- **Mobile:** 1 card per row

### Dashboard
- **All screens:** Auto-fill with 200px minimum
- **Result:** 2-5 cards depending on screen width

---

## 🔄 To Apply Changes

1. Edit the CSS file
2. Save
3. Run: `npm run build`
4. Refresh browser (Ctrl+Shift+R to clear cache)

Or for live development:
1. Edit CSS
2. Save
3. Hot reload should update automatically

---

## 📝 Example Modifications

### Make Search Page Show 4 Cards

**File:** `SearchPage.css` line 856

**Before:**
```css
grid-template-columns: repeat(3, 1fr);
```

**After:**
```css
grid-template-columns: repeat(4, 1fr);
```

### Make Dashboard Cards Smaller (More Per Row)

**File:** `CategorySection.css` line 108

**Before:**
```css
grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
```

**After:**
```css
grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
```

Result: More cards fit per row (they'll be smaller)

---

## ⚠️ Important Notes

1. **Don't go below 150px per card**
   - Buttons will clip
   - Text will overflow
   - Poor UX

2. **Test on mobile**
   - Always check responsive layouts
   - 1 column on mobile portrait is recommended

3. **Consider container queries**
   - UserCard buttons already use container queries
   - They adapt to card width automatically

4. **Build after changes**
   - CSS changes need rebuild in production
   - Dev mode has hot reload

---

## 🎨 Visual Guide

```
┌──────────────────────────────────────────────┐
│  1 column (mobile):                          │
│  ┌────────────────────────────────────────┐  │
│  │          Card 1                        │  │
│  └────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────┐  │
│  │          Card 2                        │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│  2 columns (tablet):                         │
│  ┌──────────────────┐  ┌──────────────────┐  │
│  │     Card 1       │  │     Card 2       │  │
│  └──────────────────┘  └──────────────────┘  │
│  ┌──────────────────┐  ┌──────────────────┐  │
│  │     Card 3       │  │     Card 4       │  │
│  └──────────────────┘  └──────────────────┘  │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│  3 columns (laptop):                         │
│  ┌────────┐  ┌────────┐  ┌────────┐          │
│  │ Card 1 │  │ Card 2 │  │ Card 3 │          │
│  └────────┘  └────────┘  └────────┘          │
│  ┌────────┐  ┌────────┐  ┌────────┐          │
│  │ Card 4 │  │ Card 5 │  │ Card 6 │          │
│  └────────┘  └────────┘  └────────┘          │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│  4 columns (desktop):                        │
│  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐          │
│  │ C1  │  │ C2  │  │ C3  │  │ C4  │          │
│  └─────┘  └─────┘  └─────┘  └─────┘          │
│  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐          │
│  │ C5  │  │ C6  │  │ C7  │  │ C8  │          │
│  └─────┘  └─────┘  └─────┘  └─────┘          │
└──────────────────────────────────────────────┘
```

---

**Summary:** Change `repeat(3, 1fr)` to `repeat(N, 1fr)` where N is your desired number of columns!
