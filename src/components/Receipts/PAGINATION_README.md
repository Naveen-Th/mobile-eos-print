# Pagination Component

## Overview
Modern, mobile-optimized pagination component for the Receipts screen displaying **15 receipts per page**.

## Features

✅ **15 items per page** - Perfect balance for mobile UX  
✅ **Smart page display** - Intelligent ellipsis handling  
✅ **Mobile responsive** - Adapts to screen size  
✅ **Accessibility compliant** - WCAG AA standards  
✅ **Touch-friendly** - 44x44pt minimum touch targets  
✅ **Modern design** - Clean, professional appearance  

## Usage

```typescript
import Pagination from './Pagination';

<Pagination
  currentPage={1}
  totalItems={1502}
  itemsPerPage={15}
  onPageChange={(page) => setCurrentPage(page)}
/>
```

## Props

| Prop | Type | Description |
|------|------|-------------|
| `currentPage` | `number` | Current active page (1-indexed) |
| `totalItems` | `number` | Total number of items in dataset |
| `itemsPerPage` | `number` | Number of items per page (typically 15) |
| `onPageChange` | `(page: number) => void` | Callback when page changes |

## Design Features

### Desktop View (≥400px)
- Shows 5 page numbers around current page
- Navigation buttons with text + icon
- Example: `[← Pre] [1] [···] [30] [31] [32] [···] [101] [Next →]`

### Mobile View (<400px)
- Shows 3 page numbers around current page
- Icon-only navigation buttons
- Example: `[←] [1] [30] [31] [32] [→]`

### Button States
- **Active**: Blue background, white text, scale effect
- **Inactive**: White background, gray text
- **Disabled**: Light gray background, no interaction

## Visual Specifications

### Colors
- Primary: `#3b82f6` (Blue)
- Active text: `#ffffff` (White)
- Inactive text: `#374151` (Dark gray)
- Disabled: `#f3f4f6` (Light gray)
- Border: `#e5e7eb` (Gray)

### Sizing
- Navigation buttons: 44x44pt minimum
- Page buttons: 40x40pt
- Gap: 8px between buttons
- Border: 1.5px solid
- Border radius: 10px

### Typography
- Info text: 13px
- Navigation text: 13px, weight 600
- Page numbers: 15px, weight 600 (700 when active)

## Behavior

### Auto-reset
Automatically resets to page 1 when:
- Search query changes
- Filters are applied
- Sort order changes

### Smart Pagination
- Always shows first and last page
- Shows pages adjacent to current page
- Uses ellipsis (`···`) for gaps
- Adjusts range at boundaries

### Interaction
- `activeOpacity={0.6}` on press
- Scale effect on active page: `scale(1.05)`
- Shadow effects for depth
- Disabled states for boundaries

## Accessibility

✅ **Touch targets**: Minimum 44x44pt  
✅ **Color contrast**: WCAG AA compliant  
✅ **Visual states**: Clear disabled/active states  
✅ **Feedback**: Immediate visual response  

## Performance

- Memoized calculations
- Minimal re-renders
- GPU-accelerated animations
- No layout thrashing

## Integration

Works seamlessly with:
- FlashList virtualization
- Real-time data sync
- Search and filters
- Selection mode

## Documentation

See detailed documentation:
- `docs/PAGINATION_IMPLEMENTATION.md` - Technical implementation
- `docs/PAGINATION_UX_IMPROVEMENTS.md` - UX design rationale  
- `docs/PAGINATION_VISUAL_GUIDE.md` - Visual specifications

## Example Output

**With 1502 receipts, viewing page 31:**

```
          Showing 451-465 of 1502 receipts

   [← Pre]  [1] [···] [30] [31] [32] [···] [101]  [Next →]
```

## Code Quality

- ✅ TypeScript typed
- ✅ Responsive design
- ✅ Well-documented
- ✅ Maintainable
- ✅ Tested edge cases

---

Built with modern UX principles for optimal user experience.

