# Debug Guide: Receipt Print Not Working

## Status
- ✅ Test Print works (printer hardware is fine)
- ❌ Receipt print from Receipts screen doesn't print text

## This Means
The printer hardware and connection are working. The issue is with the **data being sent** to the printer.

---

## Step 1: Check Console Logs

### Restart your app and watch the terminal when you click Print:

You should see logs like this:

```
🖨️ [ReceiptItem] Starting print process...
🖨️ [ReceiptItem] Receipt data from Firebase: {
  id: 'abc123',
  receiptNumber: 'RCP-001',
  companyName: 'My Store',      ← CHECK THIS
  customerName: 'John Doe',
  itemCount: 2,
  total: 200
}

🖨️ [ReceiptItem] Formatted receipt data: {
  storeName: 'My Store',         ← CHECK THIS
  itemCount: 2,
  total: 200
}

Starting print job...
Receipt data: { receiptNumber: 'RCP-001', items: 2, total: 200 }
Receipt text prepared, length: 425    ← Important!
Receipt preview: (shows text)
Initializing printer...
Printing text...
✓ Receipt printed successfully
```

---

## Step 2: What to Look For

### ❌ Problem Signs:

1. **Receipt text length is 0 or very small**
   ```
   Receipt text prepared, length: 0   ← BAD!
   ```

2. **companyName is undefined or null**
   ```
   companyName: undefined    ← BAD!
   ```

3. **Items array is empty**
   ```
   itemCount: 0              ← BAD!
   ```

4. **Error before "Receipt printed successfully"**
   ```
   ❌ Failed to print receipt: [error]
   ```

### ✅ Good Signs:

1. **Receipt text length > 200**
   ```
   Receipt text prepared, length: 425  ← GOOD!
   ```

2. **You see the receipt preview in logs**
   ```
   Receipt preview: 
         My Store
         ...
   ```

3. **All logs complete without errors**

---

## Step 3: Common Issues & Fixes

### Issue 1: companyName is Undefined

**If you see:**
```
companyName: undefined
storeName: Store
```

**Problem:** Receipt in Firebase doesn't have company name saved

**Quick Test:** Try printing from a NEW receipt you just created

**Fix:** Check if your receipt creation saves `companyName`:
```typescript
// When creating receipt, ensure:
{
  companyName: 'Your Store Name',
  companyAddress: '123 Street',
  // ...
}
```

---

### Issue 2: Items Array is Empty

**If you see:**
```
itemCount: 0
items: []
```

**Problem:** Receipt has no items

**Fix:** Only print receipts that have items

---

### Issue 3: Receipt Text Length is 0

**If you see:**
```
Receipt text prepared, length: 0
```

**Problem:** All values are empty/undefined

**Check in console:**
- What is `receipt.companyName`?
- What is `receipt.items`?
- What is `receipt.receiptNumber`?

---

## Step 4: Manual Test

### Create a fresh receipt and try:

1. **Go to Home/POS**
2. **Add items to cart**
3. **Complete sale** 
4. **Print immediately** (not from Receipts screen)

Does this work? 
- ✅ **Yes** → Old receipts in Firebase might be missing data
- ❌ **No** → Check Settings > Company Info

---

## Step 5: Check Firebase Receipt Structure

Your receipts in Firebase should have:
```json
{
  "id": "...",
  "receiptNumber": "RCP-001",
  "companyName": "My Store",        ← Required
  "companyAddress": "123 Street",
  "customerName": "John",
  "items": [                        ← Required
    {
      "name": "Item 1",
      "price": 100,
      "quantity": 2
    }
  ],
  "subtotal": 200,
  "tax": 16,
  "total": 216,
  "date": {...}
}
```

---

## Step 6: Quick Fix to Test

Try printing with dummy data to verify printer works:

Edit `ReceiptItem.tsx` temporarily (line ~137):

```typescript
// Add this BEFORE await printerService.printReceipt(receiptData);

// TEST: Override with dummy data
const testData = {
  storeInfo: {
    name: 'TEST STORE',
    address: '123 Test St',
    phone: '555-1234',
  },
  customerInfo: {
    name: 'Test Customer',
  },
  items: [{
    name: 'Test Item',
    price: 100,
    quantity: 2,
    total: 200,
  }],
  subtotal: 200,
  tax: 16,
  total: 216,
  paymentMethod: 'Cash',
  receiptNumber: 'TEST-001',
  timestamp: new Date(),
  isPaid: true,
};

await printerService.printReceipt(testData); // Use testData instead
```

**If this prints text:**
→ Your Firebase receipts are missing data

**If this still doesn't print:**
→ Share the console logs with me

---

## What to Send Me

Please copy and paste:

1. **Console logs** when you click Print (full output)
2. **Answer these:**
   - Does test print work? ✅/❌
   - Does the new fix with dummy data print? ✅/❌
   - What is the "Receipt text prepared, length: ???"
   - Any error messages?

---

## Quick Summary

The printer works (test print confirms this).

The issue is likely:
1. Missing data in Firebase receipts (companyName, items, etc.)
2. Data format issue (null/undefined values)
3. Character encoding issue (unlikely since test print works)

The console logs will tell us exactly which one! 📊
