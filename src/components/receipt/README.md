# Receipt Creation - Modular Architecture

This directory contains the refactored Receipt Creation feature with a clean, modular component architecture.

## Overview

The old `ReceiptCreationScreen.tsx` was 1600+ lines of mixed UI and logic. This new architecture separates concerns into small, focused, reusable components.

## Structure

```
receipt/
├── StepIndicator.tsx       # Progress indicator (Customer → Items → Review)
├── CustomerStep.tsx         # Customer information input step
├── ItemsStep.tsx           # Items selection and entry step  
├── ReviewStep.tsx          # Final review and action step
├── ReceiptItem.tsx         # Individual item entry component
└── ReceiptSummary.tsx      # Receipt totals breakdown component
```

## Main Entry Point

**File:** `ReceiptCreationScreen.new.tsx`

The main orchestrator that:
- Manages step navigation
- Handles customer search logic
- Coordinates with the receipt store
- Opens modals (Party Management, Tax Settings, Print Options)
- ~450 lines (vs 1600+ in the old version)

## Components

### 1. StepIndicator (132 lines)
Shows progress through the 3-step process with visual feedback.

**Props:**
- `currentStep`: Current active step
- `canProceedFromCustomer`: Whether customer step is complete
- `canProceedFromItems`: Whether items step has valid items

### 2. CustomerStep (220 lines)
Handles customer information input with search and balance display.

**Features:**
- Searchable customer dropdown
- New customer detection
- Previous balance display
- Integration with Party Management

**Props:**
- Customer name, status, and balance info
- Search results and handlers
- Navigation callbacks

### 3. ItemsStep (306 lines)
Manages item selection and quantity entry.

**Features:**
- Multiple item entries
- Payment status toggle
- Add/remove items
- Loading and error states
- Customer info header

**Props:**
- Form items array
- Available items from inventory
- Item handlers (select, update, add, remove)
- Payment toggle handler

### 4. ReviewStep (286 lines)
Final review screen with totals and actions.

**Features:**
- Customer summary
- Items list with details
- Total breakdown
- Tax editing
- Save and Print actions

**Props:**
- All form data for display
- Totals (subtotal, tax, total, balances)
- Action handlers (save, print, edit tax)

### 5. ReceiptItem (341 lines)
Individual item entry card (reusable).

**Features:**
- Item dropdown with stock info
- Quantity inputs (200g, 100g, 50g)
- Price per kg input
- Auto-calculated total kg and item total
- Remove button

**Props:**
- Item data
- Available items for dropdown
- Field update handlers

### 6. ReceiptSummary (116 lines)
Displays receipt totals (reusable).

**Features:**
- Subtotal, tax, and total
- Tax rate editing
- New balance display (if applicable)
- Clean, card-based layout

**Props:**
- All totals and balances
- Tax edit handler

## Benefits

### 1. **Maintainability**
- Each component has a single responsibility
- Easy to locate and fix bugs
- Clear separation of concerns

### 2. **Readability**
- Small, focused files (100-350 lines each)
- Clear prop interfaces
- Self-documenting structure

### 3. **Reusability**
- `ReceiptItem` can be reused anywhere items are displayed/edited
- `ReceiptSummary` can show totals in multiple contexts
- `StepIndicator` pattern can be used for other flows

### 4. **Testability**
- Each component can be tested in isolation
- Props-based interface makes testing straightforward
- Easy to mock dependencies

### 5. **Performance**
- Smaller components = better re-render optimization
- Easier to apply React.memo where needed
- Clearer performance bottlenecks

## Usage

To use the new version, replace the import in your main screen:

```typescript
// Old
import ReceiptCreationScreen from './components/ReceiptCreationScreen';

// New
import ReceiptCreationScreen from './components/ReceiptCreationScreen.new';
```

## Migration Guide

The new version maintains the same external API:

```typescript
<ReceiptCreationScreen
  visible={showReceipt}
  onClose={() => setShowReceipt(false)}
/>
```

All logic and store integration remain the same - only the UI structure changed.

## Future Improvements

1. **Extract more reusable components:**
   - `Card` wrapper component
   - `FormField` component
   - `ActionButtons` component

2. **Add TypeScript interfaces file:**
   - Share common interfaces across components
   - Reduce duplication

3. **Add unit tests:**
   - Test each component independently
   - Test main orchestrator logic

4. **Add Storybook stories:**
   - Visual component documentation
   - Isolated component development

## Original File

The original `ReceiptCreationScreen.tsx` (1640 lines) is preserved for reference. Once the new version is tested and stable, it can be removed or archived.
