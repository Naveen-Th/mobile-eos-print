# Payment Recording System - Implementation Guide

## Overview

The Payment Recording System allows you to track payments made against receipts in Firebase Firestore. When a customer pays against a specific receipt, the system:

1. Updates the receipt's payment information (amountPaid, newBalance, isPaid)
2. Creates a payment transaction record for audit trail
3. Updates the customer's balance in the person_details collection
4. Maintains payment history for each receipt

## Firebase Collections Structure

### 1. `receipts` Collection
Each receipt document now includes payment tracking fields:

```typescript
{
  id: string;
  receiptNumber: string;
  customerName: string;
  total: number;
  // ... other receipt fields
  
  // Balance tracking fields:
  oldBalance: number;        // Previous balance before this receipt
  isPaid: boolean;           // Whether fully paid
  amountPaid: number;        // Total amount paid so far
  newBalance: number;        // Remaining balance (oldBalance + total - amountPaid)
}
```

### 2. `payment_transactions` Collection (NEW)
Stores every payment transaction:

```typescript
{
  id: string;
  receiptId: string;
  receiptNumber: string;
  customerName: string;
  amount: number;
  paymentMethod: 'cash' | 'card' | 'upi' | 'bank_transfer' | 'other';
  notes?: string;
  previousBalance: number;
  newBalance: number;
  timestamp: Timestamp;
}
```

### 3. `person_details` Collection
Customer balance is updated here:

```typescript
{
  personName: string;
  balance: number;          // Current total balance
  // ... other fields
}
```

## Usage

### 1. Import Required Components

```typescript
import PaymentService from '../services/PaymentService';
import RecordPaymentModal from '../components/RecordPaymentModal';
import { FirebaseReceipt } from '../services/ReceiptFirebaseService';
```

### 2. Add State to Your Component

```typescript
const [showPaymentModal, setShowPaymentModal] = useState(false);
const [selectedReceipt, setSelectedReceipt] = useState<FirebaseReceipt | null>(null);
```

### 3. Add "Record Payment" Button to Receipt Items

In your receipts list/screen, add a button to each receipt with pending balance:

```typescript
{receipt.newBalance > 0 && !receipt.isPaid && (
  <TouchableOpacity
    onPress={() => {
      setSelectedReceipt(receipt);
      setShowPaymentModal(true);
    }}
    style={{
      backgroundColor: '#10b981',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
    }}
  >
    <Text style={{ color: 'white', fontWeight: '600' }}>
      Record Payment
    </Text>
  </TouchableOpacity>
)}
```

### 4. Add the Payment Modal

```typescript
<RecordPaymentModal
  visible={showPaymentModal}
  receipt={selectedReceipt}
  onClose={() => {
    setShowPaymentModal(false);
    setSelectedReceipt(null);
  }}
  onPaymentRecorded={(transaction) => {
    console.log('Payment recorded:', transaction);
    // Refresh your receipts list here
    loadReceipts();
  }}
/>
```

## Complete Example: Receipts Screen Integration

```typescript
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import ReceiptFirebaseService, { FirebaseReceipt } from '../services/ReceiptFirebaseService';
import RecordPaymentModal from '../components/RecordPaymentModal';
import { formatCurrency } from '../utils';

const ReceiptsScreen = () => {
  const [receipts, setReceipts] = useState<FirebaseReceipt[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<FirebaseReceipt | null>(null);

  useEffect(() => {
    loadReceipts();
  }, []);

  const loadReceipts = async () => {
    const data = await ReceiptFirebaseService.getAllReceipts();
    setReceipts(data);
  };

  const handleRecordPayment = (receipt: FirebaseReceipt) => {
    setSelectedReceipt(receipt);
    setShowPaymentModal(true);
  };

  const renderReceiptItem = ({ item }: { item: FirebaseReceipt }) => {
    const hasBalance = (item.newBalance || 0) > 0;
    const isPaid = item.isPaid || false;

    return (
      <View
        style={{
          backgroundColor: 'white',
          padding: 16,
          marginBottom: 12,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: '#e5e7eb',
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: '600' }}>
            {item.receiptNumber}
          </Text>
          <Text style={{ fontSize: 14, color: '#6b7280' }}>
            {formatCurrency(item.total)}
          </Text>
        </View>

        <Text style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>
          {item.customerName || 'Walk-in Customer'}
        </Text>

        {hasBalance && !isPaid && (
          <View style={{ marginTop: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ fontSize: 14, color: '#dc2626' }}>Pending Balance:</Text>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#dc2626' }}>
                {formatCurrency(item.newBalance)}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => handleRecordPayment(item)}
              style={{
                backgroundColor: '#10b981',
                paddingVertical: 10,
                borderRadius: 8,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: 'white', fontWeight: '600' }}>
                Record Payment
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {isPaid && (
          <View
            style={{
              marginTop: 8,
              paddingVertical: 6,
              paddingHorizontal: 12,
              backgroundColor: '#ecfdf5',
              borderRadius: 8,
              alignSelf: 'flex-start',
            }}
          >
            <Text style={{ color: '#10b981', fontWeight: '600', fontSize: 12 }}>
              ✓ Fully Paid
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <FlatList
        data={receipts}
        renderItem={renderReceiptItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
      />

      <RecordPaymentModal
        visible={showPaymentModal}
        receipt={selectedReceipt}
        onClose={() => {
          setShowPaymentModal(false);
          setSelectedReceipt(null);
        }}
        onPaymentRecorded={(transaction) => {
          console.log('Payment recorded:', transaction);
          // Refresh receipts list
          loadReceipts();
        }}
      />
    </View>
  );
};

export default ReceiptsScreen;
```

## PaymentService API Reference

### `recordPayment(paymentData)`
Records a payment against a receipt.

```typescript
const result = await PaymentService.recordPayment({
  receiptId: 'receipt-123',
  amount: 500,
  paymentMethod: 'cash',
  notes: 'Partial payment',
});

if (result.success) {
  console.log('Payment recorded!', result.paymentTransaction);
  console.log('Updated receipt:', result.updatedReceipt);
} else {
  console.error('Error:', result.error);
}
```

### `getReceiptPaymentHistory(receiptId)`
Get all payments made against a receipt.

```typescript
const payments = await PaymentService.getReceiptPaymentHistory('receipt-123');
payments.forEach(payment => {
  console.log(`${payment.amount} paid on ${payment.timestamp}`);
});
```

### `getCustomerPaymentHistory(customerName)`
Get all payments made by a customer.

```typescript
const payments = await PaymentService.getCustomerPaymentHistory('Vinay');
console.log(`Total payments: ${payments.length}`);
```

### `getCustomerUnpaidReceipts(customerName)`
Get all unpaid receipts for a customer.

```typescript
const unpaidReceipts = await PaymentService.getCustomerUnpaidReceipts('Vinay');
console.log(`Unpaid receipts: ${unpaidReceipts.length}`);
```

### `validatePaymentAmount(receiptId, amount)`
Validate a payment amount before recording.

```typescript
const validation = await PaymentService.validatePaymentAmount('receipt-123', 1000);
if (validation.valid) {
  // Proceed with payment
} else {
  console.error(validation.error);
  console.log('Max amount:', validation.maxAmount);
}
```

### `getPaymentStatistics(startDate?, endDate?)`
Get payment statistics for a date range.

```typescript
const stats = await PaymentService.getPaymentStatistics(
  new Date('2024-01-01'),
  new Date('2024-12-31')
);

console.log('Total payments:', stats.totalPayments);
console.log('Total amount:', stats.totalAmount);
console.log('Average payment:', stats.averagePayment);
console.log('By method:', stats.paymentsByMethod);
```

## Features

### 1. **Balance Tracking**
- Automatically calculates and updates remaining balance
- Tracks old balance + new receipt total - payments made
- Updates customer balance in person_details collection

### 2. **Payment History**
- Every payment is logged in payment_transactions collection
- Provides audit trail with timestamp and payment method
- Shows payment history in the modal

### 3. **Validation**
- Prevents overpayment (amount > remaining balance)
- Ensures positive payment amounts
- Validates receipt existence

### 4. **Multiple Payment Methods**
- Cash
- Card
- UPI
- Bank Transfer
- Other

### 5. **Atomic Operations**
- Uses Firestore batch writes for data consistency
- Receipt and payment transaction created together
- Rollback on failure

### 6. **Payment Notes**
- Optional notes field for each payment
- Useful for reference numbers, additional context

## Firebase Security Rules

Add these rules to your Firestore:

```javascript
match /payment_transactions/{transactionId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null;
  allow update, delete: if false; // Payment records are immutable
}
```

## Data Flow

1. User selects a receipt with pending balance
2. Opens RecordPaymentModal
3. Enters payment amount and method
4. System validates the amount
5. Payment is recorded using batch write:
   - Updates receipt (amountPaid, newBalance, isPaid)
   - Creates payment transaction record
6. Updates customer balance in person_details
7. Success notification shown
8. Modal closes and list refreshes

## Testing

Test with these scenarios:

1. **Full Payment**: Pay exact remaining balance
2. **Partial Payment**: Pay less than remaining balance
3. **Multiple Payments**: Make several partial payments
4. **Invalid Amount**: Try to pay more than balance
5. **Zero Amount**: Try to pay 0
6. **Payment History**: Verify all payments are logged

## Troubleshooting

### Payment not updating receipt
- Check Firebase permissions
- Verify receipt ID is correct
- Check console for errors

### Balance not updating in person_details
- Ensure customer name matches exactly
- Check BalanceTrackingService logs
- Verify person_details exists for customer

### Payment modal not showing
- Verify receipt object is passed correctly
- Check visible prop is true
- Look for console errors

## Next Steps

1. Add payment receipts/invoices generation
2. Implement payment reminders for overdue balances
3. Add payment method-specific fields (card last 4 digits, UPI transaction ID)
4. Export payment reports
5. Add payment approval workflow for large amounts
