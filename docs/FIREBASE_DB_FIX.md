# Firebase Database Reference Error Fix

## Error Fixed

**Error Message:**
```
Error getting item stock: [ReferenceError: Property 'db' doesn't exist]
ERROR Error checking stock availability: [ReferenceError: Property 'db' doesn't exist]
```

## Root Cause

Several service files were using `db` directly without calling `getFirebaseDb()` to get the database instance. In the updated Firebase configuration, `db` is not exported directly - you must call `getFirebaseDb()` to get the Firestore instance.

## Files Fixed

### 1. `StockService.ts`
**Lines fixed**: 212, 310, 354

**Before:**
```typescript
const docRef = doc(db, this.collectionName, itemId);
```

**After:**
```typescript
const db = getFirebaseDb();
if (!db) throw new Error('Firestore not initialized');

const docRef = doc(db, this.collectionName, itemId);
```

### 2. `CustomerService.ts`
**Line fixed**: 287

**Before:**
```typescript
const personDetailsRef = collection(db, this.COLLECTION_NAME);
```

**After:**
```typescript
const db = getFirebaseDb();
if (!db) {
  console.error('Firestore not initialized');
  this.isListeningToRealtime = false;
  return;
}

const personDetailsRef = collection(db, this.COLLECTION_NAME);
```

### 3. `ReceiptFirebaseService.ts`
**Lines fixed**: 225, 271, 313, 477

**Before:**
```typescript
const receiptsRef = collection(db, this.COLLECTION_NAME);
```

**After:**
```typescript
const db = getFirebaseDb();
if (!db) throw new Error('Firestore not initialized');

const receiptsRef = collection(db, this.COLLECTION_NAME);
```

## Changes Made

1. **StockService.ts**:
   - Fixed `getItemStock()` method
   - Fixed `getLowStockItems()` method
   - Fixed `subscribeToItemStock()` method

2. **CustomerService.ts**:
   - Fixed `setupRealtimeListener()` method

3. **ReceiptFirebaseService.ts**:
   - Fixed `getAllReceipts()` method
   - Fixed `deleteReceipt()` method
   - Fixed `setupRealtimeListener()` method
   - Fixed `getCustomerLatestBalance()` method (deprecated)
   - Added missing `limit` import

## How the Fix Works

### Before (❌ Broken):
```typescript
// This fails because 'db' is not exported
const docRef = doc(db, 'collection_name', 'doc_id');
```

### After (✅ Fixed):
```typescript
// Get db instance using the proper function
const db = getFirebaseDb();
if (!db) throw new Error('Firestore not initialized');

// Now use db instance
const docRef = doc(db, 'collection_name', 'doc_id');
```

## Testing

After this fix, the following operations should work correctly:

1. ✅ Stock checking when creating receipts
2. ✅ Customer search and selection
3. ✅ Receipt creation and saving
4. ✅ Real-time listeners for data updates
5. ✅ Balance tracking from person_details

## Verification

To verify the fix is working:

1. **Open the app** and go to "Create Receipt"
2. **Select a customer** - customer search should work
3. **Add an item** - stock validation should work without errors
4. **Check console** - should NOT see "ReferenceError: Property 'db' doesn't exist"

### Expected Console Output:
```
✅ Firebase initialized
✅ Balance for "CustomerName": ₹1000
✅ Stock check successful
```

### Previously (Broken):
```
❌ Error getting item stock: [ReferenceError: Property 'db' doesn't exist]
❌ Error checking stock availability: [ReferenceError: Property 'db' doesn't exist]
```

## Related Files

The following files use `getFirebaseDb()` correctly and did NOT need fixing:
- ✅ `BalanceTrackingService.ts`
- ✅ `PersonDetailsService.ts`
- ✅ `ItemService.ts`
- ✅ `CategoryService.ts`
- ✅ Most methods in StockService, CustomerService, and ReceiptFirebaseService

## Firebase Configuration

The app uses lazy initialization for Firebase:

```typescript
// config/firebase.ts
let db: Firestore | null = null;

export const initializeFirebase = (): boolean => {
  // ... initialization logic
  db = initializeFirestore(app, { /* config */ });
  return true;
};

export const getFirebaseDb = (): Firestore | null => {
  if (!isInitialized && !initializationError) {
    initializeFirebase();
  }
  return db;
};
```

**Key Point**: Always use `getFirebaseDb()` to get the database instance, never use `db` directly.

## Best Practices

When writing new code that accesses Firestore:

```typescript
// ✅ CORRECT
const db = getFirebaseDb();
if (!db) {
  throw new Error('Firestore not initialized');
}
const docRef = doc(db, 'collection', 'docId');

// ❌ INCORRECT
const docRef = doc(db, 'collection', 'docId');
```

## Summary

The error was caused by using `db` directly in 6 places across 3 service files. All instances have been fixed to use `getFirebaseDb()` with proper error handling. The app should now work correctly without any Firebase reference errors.

---

**Status**: ✅ Fixed
**Date**: 2025-10-31
**Files Changed**: 3 (StockService.ts, CustomerService.ts, ReceiptFirebaseService.ts)
