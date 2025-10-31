# Pagination Component

A fully **theme-aware** and **mobile-responsive** pagination component for consistent navigation across all pages.

## Features

✅ **Theme-Aware**: Automatically adapts to dark/light themes using CSS variables  
✅ **Mobile-Responsive**: Optimized for all screen sizes (360px - 1920px+)  
✅ **Accessible**: Proper ARIA labels, keyboard navigation, 44px touch targets  
✅ **Customizable**: Item labels, items per page, show/hide item count  
✅ **Smart Pagination**: Shows 1...3 4 5...10 pattern for large page counts  

## Usage

### Basic Example

```javascript
import Pagination from './Pagination';

<Pagination
  currentPage={page}
  totalPages={totalPages}
  totalItems={totalUsers}
  itemsPerPage={20}
  onPageChange={setPage}
  itemLabel="users"
/>
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `currentPage` | number | 1 | Current active page (1-indexed) |
| `totalPages` | number | 1 | Total number of pages |
| `totalItems` | number | 0 | Total number of items across all pages |
| `itemsPerPage` | number | 20 | Number of items displayed per page |
| `onPageChange` | function | required | Callback when page changes: `(newPage) => void` |
| `showItemCount` | boolean | true | Show "Showing X-Y of Z items" info |
| `itemLabel` | string | 'records' | Label for items (e.g., "users", "jobs", "logs") |

### Advanced Examples

#### Without Item Count
```javascript
<Pagination
  currentPage={currentPage}
  totalPages={totalPages}
  totalItems={total}
  itemsPerPage={50}
  onPageChange={handlePageChange}
  showItemCount={false}
/>
```

#### Custom Item Label
```javascript
<Pagination
  currentPage={filters.page}
  totalPages={Math.ceil(total / filters.limit)}
  totalItems={total}
  itemsPerPage={filters.limit}
  onPageChange={(newPage) => setFilters({ ...filters, page: newPage })}
  itemLabel="activity logs"
/>
```

## Theme Variables

The component uses the following CSS variables (defined in `themes.css`):

### Colors
- `--card-background`: Container background
- `--surface-color`: Button backgrounds
- `--border-color`: Borders and dividers
- `--text-color`: Primary text color
- `--text-secondary`: Secondary text (info, disabled states)
- `--primary-color`: Active state, hover effects
- `--primary-rgb`: For shadow effects with opacity

### Spacing
- `--spacing-lg`: Large spacing (20px)
- `--spacing-md`: Medium spacing (16px)
- `--spacing-sm`: Small spacing (12px)
- `--spacing-xs`: Extra small spacing (8px)

### Border Radius
- `--radius-lg`: Large radius (12px)
- `--radius-md`: Medium radius (8px)

### Shadows
- `--shadow-sm`: Small shadow
- `--shadow-md`: Medium shadow
- `--shadow-primary`: Primary color shadow

## Responsive Breakpoints

| Breakpoint | Screen Size | Changes |
|------------|-------------|---------|
| **Desktop** | >992px | Full horizontal layout, 40px buttons |
| **Tablet** | ≤992px | Reduced padding (16px) |
| **Mobile** | ≤768px | Vertical stack, 44px touch targets, centered |
| **Small Mobile** | ≤480px | Compact sizing (40px buttons), horizontal scroll if needed |
| **Extra Small** | ≤360px | Minimal sizing (36px buttons), tight spacing |

## Accessibility

- ✅ **Keyboard Navigation**: Tab through buttons, Enter/Space to activate
- ✅ **Focus Indicators**: 2px outline on focus-visible
- ✅ **Touch Targets**: Minimum 44px on mobile (WCAG AAA)
- ✅ **Disabled States**: Visual and functional disabled states
- ✅ **Screen Readers**: Descriptive button text ("Previous", "Next", page numbers)

## Examples in Codebase

### User Management
```javascript
<Pagination
  currentPage={page}
  totalPages={totalPages}
  totalItems={totalUsers}
  itemsPerPage={20}
  onPageChange={setPage}
  itemLabel="records"
/>
```

### Activity Logs
```javascript
<Pagination
  currentPage={filters.page}
  totalPages={totalPages || 1}
  totalItems={total}
  itemsPerPage={filters.limit}
  onPageChange={(newPage) => setFilters({ ...filters, page: newPage })}
  itemLabel="total"
/>
```

### Dynamic Scheduler
```javascript
{totalPages > 1 && (
  <Pagination
    currentPage={currentPage}
    totalPages={totalPages}
    totalItems={totalJobs}
    itemsPerPage={20}
    onPageChange={setCurrentPage}
    itemLabel="jobs"
  />
)}
```

## Styling Customization

The component uses CSS modules. Override styles by:

1. **Using CSS Variables** (preferred):
   ```css
   :root {
     --primary-color: #your-color;
     --spacing-lg: 24px;
   }
   ```

2. **Direct CSS Override**:
   ```css
   .pagination-container {
     margin-top: 30px;
   }
   ```

## Browser Support

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile browsers (iOS Safari, Chrome Android)

## Notes

- Page numbers are **1-indexed** (not 0-indexed)
- Component automatically handles edge cases (totalPages = 0, currentPage > totalPages)
- Smart ellipsis: Shows `1...3 4 5...10` for large page counts
- Previous/Next buttons auto-disable at boundaries
- Mobile: Horizontal scroll enabled if page numbers overflow
