# Thermal Printer Currency & Customer Info Update

## ✅ Changes Made

### 1. **Currency Symbol Update: $ → ₹**
Changed all dollar signs ($) to Indian Rupee symbol (₹) in thermal printer receipts.

**Files Updated:**
- `src/services/ThermalPrinterService.ts`

**Locations Changed:**
- Item line printing (quantity × price = total)
- Subtotal display
- Tax display
- Total display
- formatReceiptContent method (backup format)

**Before:**
```
  2 x $10.00 = $20.00
Subtotal:     $20.00
Tax:          $1.60
Total:        $21.60
```

**After:**
```
  2 x ₹10.00 = ₹20.00
Subtotal:     ₹20.00
Tax:          ₹1.60
Total:        ₹21.60
```

---

### 2. **Added Customer Information**
Receipts now print customer name and phone number if available.

**Interface Update:**
```typescript
interface ReceiptData {
  storeInfo: {
    name: string;
    address: string;
    phone: string;
  };
  customerInfo?: {          // NEW!
    name?: string;
    phone?: string;
  };
  items: Array<{...}>;
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: string;
  receiptNumber: string;
  timestamp: Date;
  isPaid?: boolean;         // NEW!
}
```

**Receipt Output Example:**
```
================================
Receipt #: RCP-20250126-0001
Date: 1/26/2025 4:30:00 PM
Customer: Shashwath         ← NEW!
Phone: +91 9876543210       ← NEW! (if available)
Status: PAID                ← NEW!
================================
```

---

### 3. **Added Payment Status**
Receipts now show PAID or UNPAID status.

**Status Display:**
- `isPaid: true` → Shows "Status: PAID"
- `isPaid: false` → Shows "Status: UNPAID"
- `isPaid: undefined` → Status line not printed

**Example:**
```
Customer: John Doe
Phone: +91 9876543210
Status: UNPAID              ← Shows payment status
================================
```

---

## 📍 Updated Components

### 1. **ThermalPrinterService.ts**
**Location:** `src/services/ThermalPrinterService.ts`

#### Changes:
✅ Updated `ReceiptData` interface to include `customerInfo` and `isPaid`
✅ Modified `printReceipt()` method to print customer info and paid status
✅ Changed all $ symbols to ₹ (Rupee)
✅ Updated `formatReceiptContent()` backup method with same changes

**Code Changes:**
```typescript
// Print customer info if available
if (customerInfo?.name) {
  await BluetoothEscposPrinter.printText(`Customer: ${customerInfo.name}\n`, {});
}
if (customerInfo?.phone) {
  await BluetoothEscposPrinter.printText(`Phone: ${customerInfo.phone}\n`, {});
}

// Print paid status
if (isPaid !== undefined) {
  const paidStatus = isPaid ? 'PAID' : 'UNPAID';
  await BluetoothEscposPrinter.printText(`Status: ${paidStatus}\n`, {});
}
```

---

### 2. **PrintOptionsScreen.tsx**
**Location:** `src/components/PrintOptionsScreen.tsx`

#### Changes:
✅ Added `customerInfo` object to receipt data
✅ Added `isPaid: true` (default for new sales)
✅ Populates customer name from cart state

**Updated Code:**
```typescript
const receiptData = {
  storeInfo: { ... },
  customerInfo: {
    name: receipt.customerName || undefined,
    phone: undefined, // Can be added if available
  },
  items: [ ... ],
  subtotal: ...,
  tax: ...,
  total: ...,
  paymentMethod: 'Cash',
  receiptNumber: ...,
  timestamp: ...,
  isPaid: true, // Default to paid for new receipts
};
```

---

### 3. **ReceiptItem.tsx**
**Location:** `src/components/Receipts/ReceiptItem.tsx`

#### Changes:
✅ Added `customerInfo` with name and phone from stored receipt
✅ Added `isPaid` status from stored receipt data
✅ Uses receipt's `isPaid` field if available, defaults to true

**Updated Code:**
```typescript
const receiptData = {
  storeInfo: { ... },
  customerInfo: {
    name: item.customerName || undefined,
    phone: item.businessPhone || undefined,
  },
  items: [ ... ],
  subtotal: ...,
  tax: ...,
  total: ...,
  paymentMethod: 'Cash',
  receiptNumber: ...,
  timestamp: ...,
  isPaid: item.isPaid !== undefined ? item.isPaid : true,
};
```

---

### 4. **ReceiptDetailModal.tsx**
**Location:** `src/components/Receipts/ReceiptDetailModal.tsx`

#### Changes:
✅ Added `customerInfo` with name and phone
✅ Added `isPaid` status from receipt
✅ Same logic as ReceiptItem

**Updated Code:**
```typescript
const receiptData = {
  storeInfo: { ... },
  customerInfo: {
    name: receipt.customerName || undefined,
    phone: receipt.businessPhone || undefined,
  },
  items: [ ... ],
  subtotal: ...,
  tax: ...,
  total: ...,
  paymentMethod: 'Cash',
  receiptNumber: ...,
  timestamp: ...,
  isPaid: receipt.isPaid !== undefined ? receipt.isPaid : true,
};
```

---

## 🧪 Receipt Output Example

### Complete Thermal Receipt:

```
        My Store Name
          (Large Bold)

     123 Business Street
     (555) 123-4567

================================
Receipt #: RCP-20250126-0001
Date: 1/26/2025 4:30:00 PM
Customer: Shashwath
Phone: +91 9876543210
Status: PAID
================================

Item 1 Name
  2 x ₹150.00 = ₹300.00

Item 2 Name
  1 x ₹50.00 = ₹50.00

--------------------------------
Subtotal:         ₹350.00
Tax:              ₹28.00
Total:            ₹378.00
================================
Payment: Cash
================================

   Thank you for your business!



[Paper cut]
```

---

## 📋 Data Flow

### New Receipt (Point of Sale):
```
User completes sale
  ↓
PrintOptionsScreen.handleThermalPrint()
  ↓
Creates receiptData with:
  - customerInfo.name = cart customer name
  - customerInfo.phone = undefined
  - isPaid = true (default)
  ↓
printerService.printReceipt(receiptData)
  ↓
Prints receipt with ₹ symbol
```

### Existing Receipt (Receipts List):
```
User clicks Print on receipt
  ↓
ReceiptItem.handlePrint() or ReceiptDetailModal
  ↓
Creates receiptData with:
  - customerInfo.name = stored customer name
  - customerInfo.phone = stored business phone
  - isPaid = stored isPaid status
  ↓
printerService.printReceipt(receiptData)
  ↓
Prints receipt with ₹ symbol
```

---

## 🎨 Visual Changes

### Currency Symbol:
| Before | After |
|--------|-------|
| `$10.00` | `₹10.00` |
| `$350.00` | `₹350.00` |
| `Subtotal: $350.00` | `Subtotal: ₹350.00` |

### Customer Information:
| Before | After |
|--------|-------|
| (Not shown) | `Customer: Shashwath` |
| (Not shown) | `Phone: +91 9876543210` |

### Payment Status:
| Before | After |
|--------|-------|
| (Not shown) | `Status: PAID` or `Status: UNPAID` |

---

## 🔧 Configuration

### To Customize Currency Symbol:
Edit `ThermalPrinterService.ts` and replace `₹` with your desired symbol:

```typescript
// Line ~475
const itemLine = `  ${item.quantity} x €${item.price.toFixed(2)} = €${item.total.toFixed(2)}`;

// Lines ~486, 493, 500
['Subtotal:', `€${subtotal.toFixed(2)}`],
['Tax:', `€${tax.toFixed(2)}`],
['Total:', `€${total.toFixed(2)}`],
```

### To Change Default Paid Status:
Edit the print components and change:
```typescript
isPaid: true,  // Change to false for default unpaid
```

---

## ✅ Testing Checklist

### Test Case 1: Print New Receipt with Customer Name
**Steps:**
1. Add items to cart
2. Enter customer name: "Shashwath"
3. Complete sale
4. Click "Thermal Printer"

**Expected Output:**
```
Customer: Shashwath
Status: PAID
Items with ₹ symbol
```

---

### Test Case 2: Print Existing Receipt
**Steps:**
1. Go to Receipts tab
2. Find receipt with customer name
3. Click ••• → Print

**Expected Output:**
```
Customer: [Customer Name]
Phone: [Phone if available]
Status: PAID/UNPAID (based on stored data)
Items with ₹ symbol
```

---

### Test Case 3: Print Receipt Without Customer Name
**Steps:**
1. Create receipt without customer name
2. Print receipt

**Expected Output:**
```
(Customer line not shown)
(Phone line not shown)
Status: PAID
Items with ₹ symbol
```

---

### Test Case 4: Verify Currency Symbol
**Steps:**
1. Print any receipt
2. Check all price fields

**Expected:**
- All prices show ₹ symbol
- No $ symbols anywhere
- Format: `₹XXX.XX`

---

## 📝 Summary

**Changes Applied:**
1. ✅ Currency changed from $ to ₹ throughout receipt
2. ✅ Customer name added to receipt header
3. ✅ Customer phone added to receipt header (if available)
4. ✅ Payment status (PAID/UNPAID) added to receipt
5. ✅ All print locations updated (PrintOptions, ReceiptItem, ReceiptDetail)

**Files Modified:**
- `src/services/ThermalPrinterService.ts` - Core printing logic
- `src/components/PrintOptionsScreen.tsx` - New sale printing
- `src/components/Receipts/ReceiptItem.tsx` - Reprint from list
- `src/components/Receipts/ReceiptDetailModal.tsx` - Reprint from detail

**Receipt Format:**
```
Store Name & Address
================================
Receipt # & Date
Customer: [Name]           ← NEW
Phone: [Phone]            ← NEW
Status: PAID/UNPAID       ← NEW
================================
Items (with ₹ symbol)     ← CHANGED
--------------------------------
Totals (with ₹ symbol)    ← CHANGED
================================
Thank you!
```

All thermal receipts now use Indian Rupee (₹) and display customer information! 🎉
