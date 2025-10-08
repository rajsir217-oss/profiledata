# CSS Design System & Consistency Guide

## 🎨 Color System

### Primary Purple Gradient (Brand Identity)
```css
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
```
**Usage:** Headers, modals, primary actions, branding elements

### Action Colors (Semantic)
- **Success/Activate:** `#10b981` (Green)
- **Warning/Suspend:** `#f59e0b` (Orange)  
- **Danger/Ban:** `#ef4444` (Red)
- **Info:** `#6366f1` (Indigo)

### Text Colors
- **Primary:** `#111827` / `#1f2937` (Dark gray)
- **Secondary:** `#6b7280` (Medium gray)
- **Muted:** `#9ca3af` (Light gray)

### Background Colors
- **Page Background:** `#ffffff` / `#fefefe`
- **Card Background:** `#ffffff`
- **Surface:** `#f9fafb` / `#f3f4f6`
- **Hover:** `#f3f4f6`

### Border Colors
- **Default:** `#e5e7eb`
- **Focus:** `#667eea` (Purple)

---

## 📐 Spacing System

```css
--spacing-xs: 6px;
--spacing-sm: 10px;
--spacing-md: 16px;
--spacing-lg: 20px;
--spacing-xl: 32px;
```

**Consistent Padding:**
- **Cards:** `24px` / `30px`
- **Buttons:** `12px 24px`
- **Inputs:** `12px`
- **Modal Header:** `20px 24px`

---

## 🔤 Typography

### Font Family
```css
font-family: 'Plus Jakarta Sans', 'Nunito', -apple-system, sans-serif;
```

### Font Sizes
- **xs:** `12px`
- **sm:** `14px`
- **base:** `15px`
- **lg:** `17px`
- **xl:** `21px`
- **2xl:** `26px`

### Font Weights
- **Regular:** `400`
- **Medium:** `500`
- **Semibold:** `600`
- **Bold:** `700`

---

## 🎯 Border Radius

```css
--radius-sm: 8px;   /* Small elements, badges */
--radius-md: 12px;  /* Inputs, small cards */
--radius-lg: 16px;  /* Cards, modals */
--radius-xl: 24px;  /* Large buttons */
```

---

## 🌑 Shadows

```css
--shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.06);
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07);
--shadow-lg: 0 10px 25px rgba(0, 0, 0, 0.07);
--shadow-glow: 0 0 20px rgba(102, 126, 234, 0.15);
```

**Modal Shadow:** `0 20px 60px rgba(0, 0, 0, 0.5)`

---

## 🎭 Modal System

### Standard Modal Structure
```jsx
<div className="modal-overlay">  {/* Black overlay */}
  <div className="modal-content">  {/* White container */}
    <h2>Title</h2>
    <p className="modal-subtitle">Subtitle</p>
    {/* Content */}
    <div className="modal-actions">
      <button className="btn-cancel">Cancel</button>
      <button className="btn-confirm">Confirm</button>
    </div>
  </div>
</div>
```

### Message-Style Modal (User Actions)
```jsx
<div className="action-modal-overlay">
  <div className="action-modal-container">
    {/* Purple Header with User Info */}
    <div className="action-modal-header">
      <div className="action-modal-avatar">U</div>
      <div className="action-modal-user-details">
        <h3>Username</h3>
        <p>Email</p>
      </div>
      <button className="action-modal-close">✕</button>
    </div>
    
    {/* White Body */}
    <div className="action-modal-body">
      {/* Content */}
    </div>
  </div>
</div>
```

### Modal CSS Standards
```css
/* Overlay */
.modal-overlay, .action-modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.7) to rgba(0, 0, 0, 1);
  backdrop-filter: blur(4px);
  z-index: 9999 to 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

/* Container */
.modal-content, .action-modal-container {
  background: #ffffff;
  border-radius: 16px;
  max-width: 500px;
  width: 100%;
  max-height: 85vh to 90vh;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3) to 0.5;
}

/* Purple Header */
.action-modal-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px 24px;
  color: white;
}
```

---

## 🔘 Button System

### Primary Button
```css
.btn-primary, .action-btn-confirm {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  /* OR solid color based on action */
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}
```

### Secondary/Cancel Button
```css
.btn-cancel, .action-btn-cancel {
  background: #f3f4f6;
  color: #374151;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  border: none;
  cursor: pointer;
}

.btn-cancel:hover {
  background: #e5e7eb;
}
```

### Action Buttons (Icon Buttons)
```css
.btn-action {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s;
}

/* Specific colors */
.btn-activate { background: #10b981; } /* Green */
.btn-suspend { background: #f59e0b; } /* Orange */
.btn-ban { background: #ef4444; }     /* Red */
.btn-view { background: #3b82f6; }    /* Blue */
```

---

## 📝 Form Elements

### Input/Textarea
```css
input, textarea, select {
  width: 100%;
  padding: 12px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-family: inherit;
  font-size: 14px;
  background: #f9fafb to #ffffff;
  color: #111827;
  transition: all 0.2s;
}

input:focus, textarea:focus {
  outline: none;
  border-color: #667eea;
  background: #ffffff;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

::placeholder {
  color: #9ca3af;
}
```

---

## 🎨 Role/Status Badges

### Role Badges
```css
.role-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.role-admin { background: #dbeafe; color: #1e40af; }
.role-moderator { background: #fef3c7; color: #92400e; }
.role-premium { background: #fce7f3; color: #9f1239; }
.role-free { background: #f3f4f6; color: #374151; }
```

### Status Badges
```css
.status-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.status-active { background: #d1fae5; color: #065f46; }
.status-pending { background: #fef3c7; color: #92400e; }
.status-suspended { background: #fed7aa; color: #9a3412; }
.status-banned { background: #fee2e2; color: #991b1b; }
```

---

## 📋 Tables

```css
table {
  width: 100%;
  border-collapse: collapse;
}

thead {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

th {
  padding: 16px;
  text-align: left;
  font-weight: 600;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

td {
  padding: 16px;
  border-bottom: 1px solid #f3f4f6;
}

tr:hover {
  background: #f9fafb;
}
```

---

## 🎬 Animations

### Standard Animations
```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-30px); }
  to { opacity: 1; transform: translateY(0); }
}
```

### Transition Standards
```css
transition: all 0.2s ease;  /* Fast interactions */
transition: all 0.3s ease;  /* Medium interactions */
transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);  /* Smooth page transitions */
```

---

## 🎯 Z-Index Layers

```css
/* Base layers */
--z-base: 1;
--z-dropdown: 1000;
--z-sticky: 1020;
--z-fixed: 1030;
--z-modal-backdrop: 1040;
--z-modal: 1050;
--z-popover: 1060;
--z-tooltip: 1070;

/* Specific components */
.sidebar: 1002
.topbar: 1001
.modal-overlay: 9999
.action-modal-overlay: 10000
```

---

## ✅ Consistency Checklist

### When Creating New Components:

- [ ] Use purple gradient (`#667eea` to `#764ba2`) for headers
- [ ] White (`#ffffff`) background for content areas
- [ ] Border radius: `8px` (small), `12px` (medium), `16px` (large)
- [ ] Padding: `24px` for cards, `12px 24px` for buttons
- [ ] Font size: `14px` for body, `15px` for buttons
- [ ] Shadows: Use predefined shadow variables
- [ ] Transitions: `0.2s` for interactions, `0.3s` for animations
- [ ] Colors: Use semantic colors (green/orange/red) for actions
- [ ] Hover states: `translateY(-2px)` + shadow increase
- [ ] Focus states: Purple border + subtle shadow ring

### Modal Checklist:

- [ ] Black overlay with 70-100% opacity
- [ ] White container with `border-radius: 16px`
- [ ] Purple gradient header for user-facing modals
- [ ] Close button (✕) in header
- [ ] Footer with Cancel (gray) and Confirm (colored) buttons
- [ ] z-index: 9999+
- [ ] Max-width: `500px`
- [ ] Padding: `24px` to `30px`

---

## 🚀 Quick Reference

### Purple Gradient (Primary Brand)
```css
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
```

### Action Colors
```css
--success: #10b981;
--warning: #f59e0b;
--danger: #ef4444;
```

### Common Spacing
```css
padding: 24px;        /* Cards */
padding: 12px 24px;   /* Buttons */
gap: 12px;            /* Flex gaps */
margin-bottom: 20px;  /* Section spacing */
```

### Common Borders
```css
border: 2px solid #e5e7eb;           /* Default */
border-color: #667eea;               /* Focus */
border-radius: 8px to 16px;          /* Standard */
```

---

## 📝 Notes

- **Always use the purple gradient for brand consistency**
- **Semantic colors (green/orange/red) only for action-specific elements**
- **White backgrounds for content, light gray for surfaces**
- **Consistent spacing and padding across all components**
- **Smooth transitions and animations for better UX**
- **Accessibility: Maintain contrast ratios, focus states**

---

*Last Updated: 2025-10-07*
*Maintained by: Development Team*
