# Stock Management System

This document outlines the stock management functionality that has been added to the ThermalReceiptPrinter mobile app.

## Overview

The stock management system allows you to:
- Add, update, and track stock levels for items
- View real-time stock information
- Manage stock operations (add, subtract, set stock levels)
- Get low stock alerts
- Integrate with Firebase Firestore for persistent storage

## Features Implemented

### 1. Updated ItemDetails Interface
- Added `stocks: number` field to track inventory levels
- All existing items now include stock information

### 2. Stock Management Services

#### ItemService Updates
- Now handles the `stocks` field in all CRUD operations
- Real-time subscription includes stock data
- Proper validation and error handling

#### New StockService
A dedicated service for stock management operations:
- `addStock(itemId, quantity)` - Add stock to an item
- `updateStock(itemId, newLevel)` - Set stock to specific level
- `subtractStock(itemId, quantity)` - Remove stock (for sales)
- `getItemStock(itemId)` - Get current stock level
- `getLowStockItems(threshold)` - Find items with low stock
- `bulkUpdateStocks(updates)` - Update multiple items at once
- `subscribeToItemStock(itemId, callback)` - Real-time stock updates
- `hasLuckyStock(itemId, requiredQuantity)` - Check stock availability

### 3. Updated UI Components

#### Items Tab (`/src/app/(tabs)/items.tsx`)
- Removed all hardcoded mock data
- Now displays real stock levels from Firebase
- Color-coded stock indicators:
  - Green: > 20 items in stock
  - Yellow: 10-20 items in stock
  - Red: < 10 items in stock
- Integrated stock management buttons
- Real-time updates via Firebase subscriptions

#### New AddItemModal Component
- Modal form for adding new items
- Includes stock quantity field
- Form validation and error handling
- Proper integration with ItemService

#### Updated ItemForm Component
- Added stock quantity field
- Validation for stock input
- Handles both create and edit operations

### 4. Hooks for Easy Integration

#### useItemDetails Hook
- Updated to handle stocks field
- Proper type safety and error handling

#### New useStocks Hook
- Simplified interface for stock operations
- Loading states and error handling
- Easy-to-use callback functions

## How to Use

### Adding Items with Stock
1. Tap the "+" button in the Items tab
2. Enter item name, price, and initial stock quantity
3. The item will be saved to Firebase with stock information

### Managing Stock Levels
1. In the Items list, tap the "+" button next to any item to add 1 stock
2. Use the StockService directly for more complex operations:

```typescript
import StockService from '../services/StockService';

// Add 10 items to stock
await StockService.addStock(itemId, 10);

// Set stock to exactly 50
await StockService.updateStock(itemId, 50);

// Subtract 3 items (for sales)
await StockService.subtractStock(itemId, 3);
```

### Using the useStocks Hook
```typescript
import { useStocks } from '../hooks/useStocks';

const MyComponent = () => {
  const { addStock, updateStock, isLoading, error } = useStocks();
  
  const handleAddStock = async () => {
    await addStock(itemId, 5);
  };
  
  // Component implementation...
};
```

### Getting Low Stock Items
```typescript
import StockService from '../services/StockService';

// Get items with stock <= 10
const lowStockItems = await StockService.getLowStockItems(10);
```

## Database Schema

### Firebase Firestore Collection: `item_details`
```typescript
interface ItemDetails {
  id: string;           // Auto-generated document ID
  item_name: string;    // Item name
  price: number;        // Item price
  stocks: number;       // Stock quantity
  createdAt?: Date;     // Creation timestamp
  updatedAt?: Date;     // Last update timestamp
}
```

## Files Modified/Created

### Modified Files:
- `src/types/index.ts` - Added stocks field to ItemDetails
- `src/services/ItemService.ts` - Updated to handle stocks field
- `src/services/FirebaseService.ts` - Updated item_details queries
- `src/hooks/useItemDetails.ts` - Added stocks field handling
- `src/components/ItemForm.tsx` - Added stock input field
- `src/app/(tabs)/items.tsx` - Complete rewrite to remove hardcoded data

### New Files:
- `src/services/StockService.ts` - Dedicated stock management service
- `src/hooks/useStocks.ts` - Stock management hook
- `src/components/AddItemModal.tsx` - Modal for adding new items
- `src/examples/StockManagementExample.tsx` - Example usage component

## Real-time Updates

The system uses Firebase's real-time subscriptions to ensure that stock levels are always up-to-date across all users and devices. When stock is updated:

1. The change is immediately sent to Firebase
2. All subscribed clients receive the update
3. The UI automatically reflects the new stock levels

## Error Handling

- All stock operations include proper error handling
- Validation prevents negative stock levels
- Insufficient stock errors when subtracting more than available
- Network error handling and retry mechanisms

## Future Enhancements

Potential improvements that could be added:

1. **Categories**: Add category field to ItemDetails
2. **Stock History**: Track stock movements over time
3. **Automatic Reordering**: Set reorder points and automatic alerts
4. **Barcode Integration**: Scan barcodes to update stock
5. **Batch Operations**: Import/export stock data
6. **Analytics**: Stock turnover reports and insights
7. **Multi-location**: Support for multiple store locations

## Testing

The implementation includes:
- TypeScript type safety throughout
- Error boundaries and validation
- Real-time data synchronization
- Proper loading states and error messages

## Conclusion

The stock management system is now fully integrated and removes all hardcoded data from the Items tab. The system is scalable, maintainable, and provides a solid foundation for inventory management in the thermal receipt printer application.
