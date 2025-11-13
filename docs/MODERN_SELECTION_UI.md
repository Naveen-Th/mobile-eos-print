# Modern Selection-to-Delete UI

## 🎨 Design Overview

A complete redesign of the receipt selection and deletion UI, following modern mobile design principles and best practices from iOS and Material Design.

## ✨ Key Features

### 1. **Enhanced Checkboxes**
- **Size**: 52x52px (large, easy to tap)
- **Design**: Circular with smooth borders
- **States**:
  - **Unselected**: Light gray circle with subtle inner circle
  - **Selected**: Solid blue with white checkmark
- **Animation**: 
  - Spring animation on appearance (scale 0 → 1)
  - Pop effect when selected (scale 1 → 1.2 → 1)
- **Shadow**: Elevated with colored shadow when selected

### 2. **Floating Action Bar**
Located at the bottom of the screen, slides up smoothly when items are selected.

**Components**:
- **Selection Badge**: Blue pill showing count (e.g., "2")
- **Text Label**: "items selected"
- **Clear/All Button**: Toggle between clear and select all
- **Delete Button**: Primary action with count

**Design Details**:
- **Background**: Pure white with subtle border
- **Border Radius**: 28px for modern look
- **Shadow**: Elevated -8px offset for floating effect
- **Padding**: 18px vertical, 24px horizontal
- **Z-index**: 1000 (always on top)

### 3. **Card Selection State**
- **Background**: Light blue (#f0f9ff) when selected
- **Border**: 2px blue (#60a5fa) when selected
- **Shadow**: Enhanced blue glow
- **Animation**: Smooth transition between states

### 4. **Animations**
All animations use spring physics for natural feel:
- **Checkbox appearance**: Tension 100, Friction 8
- **Selection pop**: Tension 200, Friction 3
- **Floating bar slide**: Tension 50, Friction 8

## 🎯 User Flow

1. **Enter Selection Mode**
   - Long-press any receipt
   - Checkboxes animate in from left
   - Header shows "X of Y selected"
   - Floating action bar slides up from bottom

2. **Select Items**
   - Tap checkbox or card to select
   - Haptic feedback on every tap
   - Count updates in badge
   - Pop animation confirms selection

3. **Batch Actions**
   - **Clear**: Deselect all items
   - **All**: Select all visible items
   - **Delete**: Opens confirmation modal

4. **Exit Selection Mode**
   - Tap X button in header
   - Checkboxes animate out
   - Floating bar slides down
   - Cards return to normal state

## 🎨 Color Palette

### Selection Colors
- **Primary Blue**: #3b82f6
- **Light Blue**: #60a5fa (border)
- **Very Light Blue**: #f0f9ff (background)
- **Badge Blue**: #3b82f6

### Delete Colors
- **Danger Red**: #ef4444
- **Disabled Gray**: #cbd5e1

### Neutral Colors
- **Border**: #e5e7eb
- **Text**: #1e293b
- **Light Text**: #6b7280

## 📐 Spacing & Sizing

### Checkboxes
- **Size**: 52x52px
- **Border**: 2.5px when unselected, 0px when selected
- **Inner Circle**: 26x26px
- **Margin Right**: 12px
- **Margin Top**: 8px

### Floating Action Bar
- **Height**: ~66px (18px padding + 32px content)
- **Bottom Padding**: 32px from screen bottom
- **Horizontal Padding**: 16px from edges
- **Border Radius**: 28px
- **Gap between elements**: 12px

### Cards
- **Border Radius**: 16px
- **Padding**: 12px
- **Margin**: 16px horizontal, 12px bottom
- **Border**: 1px (normal), 2px (selected)

## 🚀 Performance Optimizations

1. **Memoization**: `React.memo` on ReceiptItem
2. **useCallback**: All event handlers
3. **extraData**: FlashList re-renders on state change
4. **Native Driver**: All animations use native driver
5. **Batch Updates**: Selection updates in single state change

## 📱 Responsive Design

- **Small Screens**: Action bar adjusts padding
- **Large Screens**: Maximum width constraints
- **Tablets**: Optimized touch targets
- **Accessibility**: Large tap areas (52px minimum)

## 🎭 Haptic Feedback

- **Light**: Card tap in normal mode
- **Medium**: Long press, checkbox tap
- **Heavy**: Delete button press

## 🌟 Design Inspirations

- **iOS Mail**: Floating action bar concept
- **Google Photos**: Selection mode interactions
- **Material Design 3**: Elevation system
- **Apple Human Interface**: Haptic patterns

## 🔧 Technical Implementation

### Files Modified
1. `FloatingActionBar.tsx` - New component
2. `ReceiptItem.tsx` - Enhanced animations
3. `ReceiptsHeader.tsx` - Simplified header
4. `receipts.tsx` - Integration logic

### Key Libraries
- **expo-haptics**: Touch feedback
- **@shopify/flash-list**: Performance
- **react-native Animated**: Smooth animations

## 📊 Metrics

- **Animation Duration**: 200-300ms
- **Spring Tension**: 50-200
- **Touch Target**: 52px minimum
- **Shadow Elevation**: 2-16
- **Border Radius**: 12-28px

---

**Design System**: Modern iOS/Android hybrid
**Version**: 2.0
**Last Updated**: November 2025

