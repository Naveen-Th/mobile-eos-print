# Balance Not Loading - Debugging Guide

## Issue

Customer "Vinay" is selected but Old Balance shows `0.00` instead of loading the actual balance.

## Possible Causes & Solutions

### 1. ✅ Customer Doesn't Exist in Firebase

**Check**: Does "Vinay" exist in `person_details` collection?

**Solution**:
1. Open Firebase Console → Firestore Database
2. Go to `person_details` collection
3. Search for a document with `personName: "Vinay"`

**If customer doesn't exist**:
- This is normal for a new customer
- The balance will be 0 until you create the first receipt
- When you create a receipt, the customer will be added to `person_details` automatically (if you also add business name and phone)

### 2. ✅ Customer Exists But Balance is 0

**Check Console Logs**:
Look for this log message:
```
✅ Balance for "Vinay": ₹0
```

This means the customer exists but has a balance of 0, which is correct.

### 3. ❌ Firebase Not Initialized

**Check Console Logs**:
Look for error messages like:
```
Error getting customer balance: ...
Firestore not initialized
```

**Solution**:
The app needs internet connection to connect to Firebase.

1. Make sure you have internet connection
2. Restart the app
3. Check if Firebase initializes:
```
✅ Firebase initialized
```

### 4. ❌ Customer Name Mismatch

**Check**: Is the spelling exact?
- "Vinay" vs "vinay" vs "VINAY" (case-insensitive search should work)
- Extra spaces: " Vinay" vs "Vinay "

**Solution**:
- Search is case-insensitive, so "Vinay", "vinay", "VINAY" should all match
- Extra spaces are trimmed automatically
- Check Firebase Console for exact spelling

### 5. ❌ Customer Not in person_details (Only in receipts)

**Problem**: Old system stored balances only in receipts collection.

**Check**:
1. Open Firebase Console
2. Check `person_details` collection for customer
3. Check `receipts` collection for past receipts

**Solution**:
If customer exists in `receipts` but not in `person_details`:

Option A: **Create customer manually in Firebase Console**:
1. Go to `person_details` collection
2. Add document with:
   ```json
   {
     "personName": "Vinay",
     "businessName": "Customer Business Name",
     "phoneNumber": "+91 98765 43210",
     "balanceDue": 0,
     "createdAt": "2025-10-31T...",
     "updatedAt": "2025-10-31T..."
   }
   ```

Option B: **Run migration script**:
```bash
cd /Users/Apple/Documents/Print/ThermalReceiptPrinter/mobile
npx ts-node scripts/migrate-balances.ts --execute
```

## Expected Console Logs

### When Balance Loads Successfully:
```
ℹ️ Searching for customers with query: 'Vinay'
✅ Balance for "Vinay": ₹1000
✅ Auto-loaded balance for "Vinay": ₹1000
```

### When Customer Doesn't Exist (New Customer):
```
ℹ️ Searching for customers with query: 'Vinay'
ℹ️ Customer "Vinay" not found in person_details. Returning 0 (new customer).
✅ Auto-loaded balance for "Vinay": ₹0
```

### When Error Occurs:
```
❌ Error fetching customer balance: [Error message]
```

## Step-by-Step Debugging

### Step 1: Check Console Logs

1. **Open React Native Dev Tools** (shake device → "Debug")
2. **Open Browser Console** (for Expo Go, shake → "Open DevTools")
3. **Type customer name "Vinay"**
4. **Watch for logs**:
   - Should see: `"Searching for customers with query: 'Vinay'"`
   - Should see: `"✅ Balance for \"Vinay\": ₹..."` or `"ℹ️ Customer \"Vinay\" not found..."`

### Step 2: Check Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **bill-printing-21ea4**
3. Go to **Firestore Database**
4. Check **person_details** collection:
   - Look for document with `personName: "Vinay"`
   - Check `balanceDue` field value

### Step 3: Test With Known Customer

1. **Create a test customer first** using "Party Management":
   - Go to app → POS tab → Click on party/customer icon
   - Add new party:
     - Name: "TestCustomer"
     - Business: "Test Business"
     - Phone: "+91 9876543210"
   - Save

2. **Create a receipt**:
   - Go to "Create Receipt"
   - Select "TestCustomer"
   - Add items
   - Set "Not Paid"
   - Create receipt

3. **Try loading balance again**:
   - Go to "Create Receipt"
   - Type "TestCustomer"
   - Balance should now show the amount from previous receipt

### Step 4: Verify Firebase Connection

Check if Firebase is connected:

**Expected logs on app start**:
```
📱 Initializing Firebase for mobile...
✅ Firebase initialized for mobile production mode
```

**If you see errors**:
```
❌ Firebase initialization failed: ...
```

This means:
- No internet connection, OR
- Firebase credentials are wrong

## Quick Fix: Force Reload

1. **Close and reopen the app completely**
2. **Make sure you have internet**
3. **Try again**

## Common Mistakes

### ❌ Wrong: Expecting balance without internet
Balance tracking requires Firebase connection (internet required).

### ❌ Wrong: Expecting balance for brand new customer
New customers start with balance = 0. That's correct.

### ❌ Wrong: Customer exists only in old system
If you upgraded from old system, run migration script.

## Testing Checklist

- [ ] App has internet connection
- [ ] Firebase initialized successfully (check logs)
- [ ] Customer exists in `person_details` collection (check Firebase Console)
- [ ] Customer name spelling matches exactly
- [ ] Console shows balance fetch log
- [ ] No error messages in console

## Need More Help?

### Check These Files:
1. **Balance tracking service**: `src/services/BalanceTrackingService.ts`
2. **Person details service**: `src/services/PersonDetailsService.ts`
3. **Firebase config**: `src/config/firebase.ts`

### Enable Detailed Logging:

Add this to check what's happening:

```typescript
// In ReceiptCreationScreen.tsx, add more logging
const handleCustomerSelect = async (customer: UniqueCustomer) => {
  console.log('📋 Customer selected:', customer);
  console.log('📋 Customer balance from cache:', customer.balanceDue);
  
  // ... rest of code
};
```

## Summary

**Most likely cause**: Customer "Vinay" doesn't exist in `person_details` collection yet.

**Solution**:
1. Create a receipt for "Vinay" (this will create the customer record)
2. OR add customer manually via Party Management
3. Next time you select "Vinay", the balance will load

**To verify**: Check Firebase Console → `person_details` collection → look for "Vinay"
