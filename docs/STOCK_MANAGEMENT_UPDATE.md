# Stock Management Implementation for Receipt Creation

## Overview

This implementation adds automatic stock subtraction functionality when creating receipts. When a user creates a receipt with selected items and quantities, the system will automatically subtract the quantities from the `item_details` collection's `stocks` field in Firebase.

## Features Implemented

### 1. Automatic Stock Subtraction
- **Location**: `ReceiptCreationScreen.tsx` - `handleCreateReceipt()` function
- **Functionality**: After a receipt is successfully saved to Firebase, the system automatically subtracts the purchased quantities from the stock levels for each item.
- **Error Handling**: If stock subtraction fails, the receipt creation still succeeds, but the user is notified about the stock update issue.

### 2. Stock Validation Before Receipt Creation
- **Location**: `ReceiptCreationScreen.tsx` - `handleCreateReceipt()` function
- **Functionality**: Before creating a receipt, the system checks if there's sufficient stock for all requested items.
- **User Experience**: If any item has insufficient stock, an error message is shown with current available stock vs. requested quantity.

### 3. Real-time Stock Display in Item Selection
- **Location**: `ReceiptCreationScreen.tsx` - item dropdown rendering
- **Functionality**: 
  - Stock levels are displayed next to each item's price in the dropdown
  - Color-coded stock indicators:
    - **Red**: Stock ≤ 10 (critically low)
    - **Orange**: Stock ≤ 50 (low stock)
    - **Green**: Stock > 50 (good stock)
- **Visual Indicators**: Out-of-stock items are grayed out and disabled for selection

### 4. Real-time Stock Validation During Form Input
- **Location**: `ReceiptCreationScreen.tsx` - `updateFormItem()` function
- **Functionality**: When users change quantity values, the system validates against available stock and shows warnings if quantity exceeds available stock.

### 5. Out-of-Stock Prevention
- **Location**: `ReceiptCreationScreen.tsx` - `handleItemSelect()` function
- **Functionality**: Users cannot select items that are completely out of stock (stock ≤ 0).

### 6. Stock Subtraction in Print Functionality
- **Location**: `PrintOptionsScreen.tsx`
- **Functionality**: Added stock subtraction to all print methods:
  - Direct PDF export
  - Direct file system save
  - Thermal printing
- **User Feedback**: Success messages include stock update status

## Technical Implementation

### Services Used
- **StockService**: Existing service with methods:
  - `subtractStock(itemId, quantity)`: Subtracts quantity from item stock
  - `getItemStock(itemId)`: Gets current stock level
  - `hasLuckyStock(itemId, quantity)`: Checks if sufficient stock exists

### Key Functions Modified

1. **ReceiptCreationScreen.tsx**:
   - `handleCreateReceipt()`: Added stock validation and subtraction
   - `handleItemSelect()`: Added out-of-stock prevention
   - `updateFormItem()`: Added real-time quantity validation
   - Dropdown rendering: Added stock display and visual indicators

2. **PrintOptionsScreen.tsx**:
   - `handleDirectFileSystemPrint()`: Added stock subtraction
   - `handleDirectPrint()`: Added stock subtraction
   - `subtractStockForItems()`: New helper function for stock subtraction

### Error Handling
- **Insufficient Stock**: Clear error messages showing requested vs. available quantities
- **Stock Update Failures**: Receipt creation succeeds, but user is notified of stock update issues
- **Out-of-Stock Items**: Prevention of selection with informative messages

### User Experience Enhancements
- **Real-time Feedback**: Immediate validation as users type quantities
- **Visual Indicators**: Color-coded stock levels and disabled out-of-stock items
- **Informative Messages**: Clear error messages with specific stock information
- **Success Confirmations**: Enhanced success messages including stock update status

## Usage Flow

1. **Item Selection**:
   - User sees stock levels next to each item in dropdown
   - Out-of-stock items are visually disabled
   - System prevents selection of items with zero stock

2. **Quantity Entry**:
   - Real-time validation against available stock
   - Warning messages if quantity exceeds stock
   - Visual feedback for stock levels

3. **Receipt Creation**:
   - System validates all items have sufficient stock
   - If validation passes, receipt is created
   - Stock levels are automatically updated
   - User receives confirmation with stock update status

4. **Print Operations**:
   - All print methods also subtract stock
   - Success messages include stock update confirmation

## Stock Level Indicators

- **🟢 Green (Stock > 50)**: Good stock levels
- **🟡 Orange (Stock ≤ 50)**: Low stock warning  
- **🔴 Red (Stock ≤ 10)**: Critically low stock
- **❌ Disabled (Stock ≤ 0)**: Out of stock - cannot select

This implementation ensures inventory accuracy and prevents overselling while providing a smooth user experience with real-time feedback and validation.
