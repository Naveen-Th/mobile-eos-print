# Receipt Store Refactor - Zustand Implementation

## Overview

The receipt creation system has been refactored to use **Zustand** for state management, replacing the previous cart context. This fixes the quantity calculation and stock deduction issues while providing better state management and predictable behavior.

## Key Issues Fixed

### 1. **Double Stock Deduction Problem**
- **Previous Issue**: Stock was being deducted multiple times due to race conditions and improper state management
- **Solution**: Single atomic stock deduction after successful receipt creation with proper error handling
- **Implementation**: Stock updates only occur after receipt is successfully saved to Firebase

### 2. **Quantity Calculation Issues**
- **Previous Issue**: Quantity validation was inconsistent and could allow invalid quantities
- **Solution**: Real-time quantity validation with stock checking before any operations
- **Implementation**: Store validates quantities against current stock levels immediately

### 3. **State Synchronization Issues**
- **Previous Issue**: Cart context and form state could become out of sync
- **Solution**: Single source of truth with Zustand store managing all state
- **Implementation**: All form state, customer info, and validation managed centrally

## Architecture Changes

### New Files Created

1. **`src/stores/receiptStore.ts`** - Main Zustand store
2. **`src/hooks/useReceiptIntegration.ts`** - Integration hook for backward compatibility
3. **`RECEIPT_STORE_REFACTOR.md`** - This documentation

### Modified Files

1. **`src/components/ReceiptCreationScreen.tsx`** - Refactored to use Zustand store

## Store Structure

```typescript
interface ReceiptState {
  // Form items with validation state
  formItems: FormItem[];
  
  // Customer information with auto-fill tracking
  customer: CustomerInfo;
  
  // Available items from database
  availableItems: ItemDetails[];
  isLoadingItems: boolean;
  itemsError: string | null;
  
  // Processing states
  isProcessing: boolean;
  isValidating: boolean;
  
  // Comprehensive error management
  errors: {
    customer: string;
    businessName: string;
    businessPhone: string;
    form: string;
  };
  
  // Receipt calculations
  receiptTotals: ReceiptTotals;
  currentReceipt: Receipt | null;
}
```

## Key Features

### 1. **Real-time Validation**
- Quantity validation against stock levels
- Immediate feedback for invalid inputs
- Stock error messages per form item

### 2. **Atomic Operations**
- Stock deduction only after successful receipt creation
- Transaction-like behavior prevents partial updates
- Proper error handling and rollback capability

### 3. **Better Error Management**
- Field-specific error messages
- Form-level validation errors
- Stock availability errors with real-time updates

### 4. **Auto-calculation**
- Receipt totals automatically calculated when items change
- Real-time price and quantity updates
- Tax calculation (10% default)

## Usage Examples

### Basic Usage
```typescript
import { useReceiptStore } from '../stores/receiptStore';

const MyComponent = () => {
  const { 
    formItems, 
    addFormItem, 
    updateFormItem,
    createReceipt 
  } = useReceiptStore();

  // Add new item form
  const handleAddItem = () => {
    addFormItem();
  };

  // Update item quantity with validation
  const handleQuantityChange = (id: string, quantity: string) => {
    updateFormItem(id, 'quantity', quantity);
  };

  // Create receipt (handles validation and stock updates)
  const handleCreate = async () => {
    const result = await createReceipt();
    if (result.success) {
      console.log('Receipt created:', result.receipt);
    }
  };
};
```

### Integration Hook Usage
```typescript
import { useReceiptIntegration } from '../hooks/useReceiptIntegration';

const MyComponent = ({ visible }) => {
  const { store, cartCompatibility } = useReceiptIntegration(visible);
  
  // Use store for new functionality
  const { formItems, customer, errors } = store;
  
  // Use cartCompatibility for existing components
  return (
    <PrintOptionsScreen
      cartItems={cartCompatibility.items}
      customerName={cartCompatibility.customerName}
    />
  );
};
```

## Validation Flow

1. **Input Validation**: Real-time validation as user types
2. **Stock Validation**: Automatic stock checking against available quantities
3. **Form Validation**: Comprehensive validation before receipt creation
4. **Business Logic Validation**: Final validation in `createReceipt` method

## Stock Management Flow

```
1. User selects item → Check stock availability
2. User enters quantity → Validate against current stock
3. User creates receipt → Double-check all stock levels
4. Receipt saved to Firebase → Update stock levels atomically
5. Success/failure feedback → Clear form or show errors
```

## Error Handling

### Types of Errors
- **Field Errors**: Individual input validation
- **Stock Errors**: Per-item stock availability issues
- **Form Errors**: Overall form validation problems
- **Service Errors**: Firebase/API errors

### Error Display
- Inline errors for individual fields
- Stock warnings for insufficient inventory
- Form-level errors for general issues
- Toast notifications for service errors

## Migration Guide

### For Existing Components

1. Replace `useCart()` with `useReceiptStore()`
2. Update state property names:
   - `cartState.items` → `formItems`
   - `cartState.customerName` → `customer.customerName`
   - `cartState.businessName` → `customer.businessName`

3. Use integration hook for compatibility:
   ```typescript
   const { cartCompatibility } = useReceiptIntegration(visible);
   // Use cartCompatibility.items instead of cartState.items
   ```

### For New Components

Use the store directly:
```typescript
const { 
  formItems,
  customer,
  errors,
  createReceipt 
} = useReceiptStore();
```

## Performance Improvements

1. **Reduced Re-renders**: Zustand only triggers re-renders for changed state slices
2. **Optimistic Updates**: UI updates immediately while background operations complete
3. **Efficient Validation**: Only validate changed fields
4. **Memoization**: Store actions are automatically memoized

## Testing Considerations

### Test Scenarios
1. **Stock Validation**: Test with various stock levels (0, low, sufficient)
2. **Quantity Changes**: Test rapid quantity updates
3. **Receipt Creation**: Test success and failure cases
4. **Error Recovery**: Test error states and recovery
5. **Concurrent Access**: Test multiple users accessing same items

### Mock Data
```typescript
// Mock store for testing
const mockStore = {
  formItems: [{ id: '1', selectedItemId: 'item1', price: '10.00', quantity: '2' }],
  customer: { customerName: 'Test Customer', businessName: '', businessPhone: '' },
  availableItems: [{ id: 'item1', item_name: 'Test Item', price: 10, stocks: 5 }],
  // ... other state
};
```

## Future Improvements

1. **Offline Support**: Store state in AsyncStorage for offline capability
2. **Optimistic Stock Updates**: Update UI immediately with server sync
3. **Bulk Operations**: Support for bulk item operations
4. **Receipt Templates**: Multiple receipt formats
5. **Advanced Validation**: Custom validation rules per item type

## Debugging

### Debug Mode
Set `enabled: true` in store devtools config for debugging:

```typescript
devtools(
  // ... store implementation
  {
    name: 'receipt-store',
    enabled: process.env.NODE_ENV === 'development' // Change to `true` for debugging
  }
)
```

### Logging
Store automatically logs important operations:
- Item selections
- Stock validations  
- Receipt creation steps
- Error conditions

### Common Issues

1. **Stock showing as available but validation fails**: Check for race conditions in real-time updates
2. **Receipt creation succeeds but stock not updated**: Check Firebase permissions and network connectivity
3. **Form validation errors persist**: Check error clearing logic in store actions

## Support

For questions or issues with the new receipt system:

1. Check the store devtools for state inspection
2. Review console logs for detailed operation tracking  
3. Verify Firebase connectivity and permissions
4. Test with known good data to isolate issues
