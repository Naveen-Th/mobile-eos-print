# Zustand Stores - Balance & Payment Management

## 📚 Overview

This guide covers the new Zustand-based architecture for balance calculations and payment recording. The stores provide **reactive state management** that eliminates manual cache invalidation and ensures UI stays in sync automatically.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Components (UI)                       │
│  useCustomerBalance()  |  usePaymentStore()             │
└──────────────────┬──────────────────────┬────────────────┘
                   │                      │
                   ▼                      ▼
        ┌──────────────────┐  ┌──────────────────┐
        │  BalanceStore    │  │  PaymentStore    │
        │   (Zustand)      │  │   (Zustand)      │
        └─────────┬────────┘  └────────┬─────────┘
                  │                    │
                  ▼                    ▼
        ┌──────────────────────────────────────┐
        │   Pure Calculation Functions         │
        │  (paymentCalculations.ts)            │
        └─────────┬────────────────────────────┘
                  │
                  ▼
        ┌──────────────────┐
        │    Firebase      │
        │  (Source of      │
        │    Truth)        │
        └──────────────────┘
```

---

## 📦 Files Created

1. **`src/utils/paymentCalculations.ts`** - Pure calculation functions
2. **`src/stores/balanceStore.ts`** - Balance management store  
3. **`src/stores/paymentStore.ts`** - Payment operations store

---

## 🎯 Balance Store

### Features

✅ **Single Source of Truth** for customer balances  
✅ **Reactive Updates** - UI auto-updates when balance changes  
✅ **No Manual Cache Invalidation** - store handles it automatically  
✅ **DevTools Integration** - Debug with Redux DevTools  
✅ **Pure Calculation Functions** - Easy to test

### Usage Examples

#### 1. Display Customer Balance (Reactive!)

```typescript
import { useCustomerBalance } from '../stores/balanceStore';

function CustomerBalanceCard({ customerName }: { customerName: string }) {
  // 🔥 Component automatically re-renders when balance changes!
  const balance = useCustomerBalance(customerName);
  
  return (
    <View>
      <Text>Balance: ₹{balance.toFixed(2)}</Text>
    </View>
  );
}
```

#### 2. Calculate Balance on Customer Selection

```typescript
import { useBalanceStore } from '../stores/balanceStore';

function CustomerStep() {
  const calculateBalance = useBalanceStore(state => state.calculateBalance);
  const isCalculating = useBalanceStore(state => state.isCalculating);
  
  const handleCustomerSelect = async (customerName: string) => {
    // This fetches from Firebase and updates store
    const balance = await calculateBalance(customerName);
    console.log(`Balance: ₹${balance}`);
  };
  
  return (
    <View>
      {isCalculating('Vinay') ? (
        <ActivityIndicator />
      ) : (
        <Text>Select Customer</Text>
      )}
    </View>
  );
}
```

#### 3. Get Balance for Receipt Creation

```typescript
import { useBalanceStore } from '../stores/balanceStore';

async function createReceipt(customerName: string) {
  const balanceStore = useBalanceStore.getState();
  
  // Get oldBalance for receipt creation
  const oldBalance = balanceStore.getOldBalance(customerName);
  
  const receipt = {
    ...receiptData,
    oldBalance, // ✅ Correct balance from store
  };
  
  await saveReceipt(receipt);
}
```

#### 4. Real-time Updates from Receipts Listener

```typescript
import { useBalanceStore } from '../stores/balanceStore';
import { onSnapshot, collection, query, where } from 'firebase/firestore';

function setupRealTimeBalanceUpdates() {
  const receiptsQuery = query(
    collection(db, 'receipts'),
    where('customerName', '==', 'Vinay')
  );
  
  const unsubscribe = onSnapshot(receiptsQuery, (snapshot) => {
    const receipts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // 🔥 Automatically updates balance store (and all subscribed components!)
    useBalanceStore.getState().updateFromReceipts('Vinay', receipts);
  });
  
  return unsubscribe;
}
```

#### 5. Get All Customer Balances (Reports)

```typescript
import { useBalanceStore } from '../stores/balanceStore';

function OutstandingBalancesReport() {
  const allBalances = useBalanceStore(state => state.getAllBalances());
  const totalOutstanding = useBalanceStore(state => state.getTotalOutstanding());
  
  return (
    <View>
      <Text>Total Outstanding: ₹{totalOutstanding}</Text>
      {allBalances.map(({ customerName, balance }) => (
        <Text key={customerName}>{customerName}: ₹{balance}</Text>
      ))}
    </View>
  );
}
```

---

## 💰 Payment Store

### Features

✅ **Cascade Preview** - See which receipts will be affected before payment  
✅ **Automatic Balance Update** - Updates BalanceStore after payment  
✅ **Processing State** - Track payment progress  
✅ **Error Handling** - Centralized error management

### Usage Examples

#### 1. Record Payment with Cascade

```typescript
import { usePaymentStore } from '../stores/paymentStore';
import { useIsPaymentProcessing } from '../stores/paymentStore';

function RecordPaymentModal({ receipt }: { receipt: FirebaseReceipt }) {
  const recordPayment = usePaymentStore(state => state.recordPayment);
  const isProcessing = useIsPaymentProcessing();
  const [amount, setAmount] = useState('');
  
  const handleRecordPayment = async () => {
    const result = await recordPayment({
      receiptId: receipt.id,
      amount: parseFloat(amount),
      method: 'cash',
      notes: 'Payment from customer'
    });
    
    if (result.success) {
      Alert.alert('Success', 'Payment recorded successfully');
      // 🔥 Balance automatically updated in BalanceStore!
    } else {
      Alert.alert('Error', result.error);
    }
  };
  
  return (
    <View>
      <TextInput value={amount} onChangeText={setAmount} />
      <Button 
        title={isProcessing ? 'Processing...' : 'Record Payment'} 
        onPress={handleRecordPayment}
        disabled={isProcessing}
      />
    </View>
  );
}
```

#### 2. Preview Cascade Before Payment

```typescript
import { usePaymentStore, usePaymentCascadePreview } from '../stores/paymentStore';

function PaymentPreview({ receiptId }: { receiptId: string }) {
  const previewCascade = usePaymentStore(state => state.previewCascade);
  const preview = usePaymentCascadePreview();
  const [amount, setAmount] = useState('');
  
  const handlePreview = async () => {
    await previewCascade(receiptId, parseFloat(amount));
  };
  
  return (
    <View>
      <TextInput value={amount} onChangeText={setAmount} />
      <Button title="Preview" onPress={handlePreview} />
      
      {preview && (
        <View>
          <Text>Receipts Affected: {preview.totalReceipts}</Text>
          <Text>Old Balance Cleared: ₹{preview.oldBalanceCleared}</Text>
          
          {preview.receiptsAffected.map((affected) => (
            <View key={affected.receipt.id}>
              <Text>{affected.receipt.receiptNumber}</Text>
              <Text>Payment: ₹{affected.paymentToApply}</Text>
              <Text>Balance: ₹{affected.currentBalance} → ₹{affected.newBalance}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
```

---

## 🔄 Migration Guide

### Replacing BalanceTrackingService

**Before (Old Way):**
```typescript
// Manual cache management
const balance = await BalanceTrackingService.getCustomerBalance(customerName);
// ... later after payment
BalanceTrackingService.invalidateCache(customerName); // ❌ Manual!
```

**After (New Way):**
```typescript
// Reactive with Zustand
const balance = useCustomerBalance(customerName);
// After payment - automatic update! ✅
```

### Replacing PaymentService (Partial)

**Before (Old Way):**
```typescript
const result = await PaymentService.recordPayment(paymentData);
if (result.success) {
  BalanceTrackingService.invalidateCache(customerName); // ❌ Manual!
}
```

**After (New Way):**
```typescript
const result = await usePaymentStore.getState().recordPayment(paymentData);
// Balance automatically updated! ✅
```

---

## 🧪 Testing

The pure calculation functions are easy to test:

```typescript
import { calculatePaymentCascade, calculateCustomerBalance } from '../utils/paymentCalculations';

test('calculates payment cascade correctly', () => {
  const receipt = { 
    id: '1', 
    total: 200, 
    amountPaid: 0, 
    oldBalance: 200 
  };
  
  const olderReceipts = [
    { id: '2', total: 200, amountPaid: 0 }
  ];
  
  const result = calculatePaymentCascade(receipt, 400, olderReceipts);
  
  expect(result.affectedReceipts).toHaveLength(2);
  expect(result.oldBalanceCleared).toBe(200);
  expect(result.remainingPayment).toBe(0);
});
```

---

## 🐛 Debugging

### Redux DevTools

1. Install Redux DevTools extension in browser
2. Open React Native Debugger
3. View state changes in real-time
4. Time-travel debugging

### Console Logs

All stores log actions in development:

```
✅ [BalanceStore] Calculated balance for "Vinay": ₹800 (3 unpaid receipts)
🔄 [BalanceStore] Updated balance for "Vinay": ₹600
📋 [PaymentStore] Cascade preview: 3 receipts, ₹400 oldBalance cleared
✅ [PaymentStore] Payment of ₹600 recorded successfully (3 receipts updated)
```

---

## 📊 Performance Benefits

| Aspect | Old (Service) | New (Zustand) |
|--------|--------------|---------------|
| **Cache Management** | Manual invalidation | Automatic |
| **UI Updates** | Manual refetch | Reactive |
| **State Consistency** | Risk of stale data | Always in sync |
| **Debugging** | Console logs only | Redux DevTools |
| **Testing** | Mocking required | Pure functions |
| **Code Complexity** | Scattered logic | Centralized |

---

## 🚀 Next Steps

1. **Replace BalanceTrackingService calls** with `useBalanceStore`
2. **Update RecordPaymentModal** to use `usePaymentStore`
3. **Add real-time integration** in receipts listeners
4. **Remove manual `invalidateCache()` calls**
5. **Add tests** for pure calculation functions

---

## 📝 Key Principles

1. **Store = State + Actions** - Zustand combines both
2. **Pure Functions = Testability** - Calculations separate from state
3. **Reactive = Automatic** - UI updates when store changes
4. **Selectors = Performance** - Components only re-render when their data changes
5. **DevTools = Debugging** - See every state change in detail

---

## ✅ Benefits Summary

✨ **No more manual cache invalidation**  
✨ **Automatic UI updates**  
✨ **Centralized balance logic**  
✨ **Better debugging with DevTools**  
✨ **Easier testing with pure functions**  
✨ **Type-safe with TypeScript**  
✨ **Performance optimized with selectors**

Happy coding! 🎉

