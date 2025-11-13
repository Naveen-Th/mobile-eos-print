# Previous Balance Cascade Fix

## Problem

When creating a receipt with **manually added Previous Balance**, payments were incorrectly cascading to older receipts.

### Example Scenario
1. Create receipt for "Ga" with:
   - Items: ₹200
   - Previous Balance (manually added): ₹200
   - **Total debt on this receipt: ₹400**

2. Pay ₹400

**Expected behavior:**
- ✅ Pay current receipt completely (₹400)
- ✅ Receipt marked as PAID
- ✅ No cascade to older receipts

**Actual behavior (BEFORE fix):**
- ❌ Paid ₹200 to current receipt
- ❌ Cascaded ₹200 to older receipt (REC-20251112-1728)
- ❌ Showed "400 distributed across 2 receipts"

## Root Cause

The system was treating "Previous Balance" (oldBalance) as if it was a separate older receipt, when it's actually **part of the current receipt's total debt**.

### Before Fix

```typescript
// ❌ WRONG: Only considered receipt items balance
const paymentForCurrentReceipt = Math.min(remainingPayment, receiptBalance);
// Payment: ₹400, receiptBalance: ₹200
// Applied: ₹200, Remaining: ₹200 (cascaded to older receipt)
```

### After Fix

```typescript
// ✅ CORRECT: Consider total debt including oldBalance
const totalReceiptDebt = receiptBalance + oldBalance;
const paymentForCurrentReceipt = Math.min(remainingPayment, receiptBalance);

// Then consume the oldBalance portion
if (oldBalance > 0 && remainingPayment > 0) {
  const oldBalancePayment = Math.min(remainingPayment, oldBalance);
  remainingPayment -= oldBalancePayment;
}

// Payment: ₹400, receiptBalance: ₹200, oldBalance: ₹200
// Step 1: Applied ₹200 to receipt items
// Step 2: Consumed ₹200 from oldBalance
// Remaining: ₹0 (no cascade)
```

## Technical Details

### Files Modified

1. **RecordPaymentModalWithCascade.tsx**
   - Updated `calculateCascadePreview()` to include oldBalance in total receipt debt
   - Only cascade if payment exceeds `(receiptBalance + oldBalance)`

2. **PaymentService.ts**
   - Updated `recordPayment()` to consume oldBalance before cascading
   - oldBalance payment is **not** added to `amountPaid` (it's already part of the receipt's history)

## Payment Flow (Correct)

### Scenario: Receipt with ₹200 items + ₹200 oldBalance, paying ₹400

```
1. Calculate balances:
   - receiptBalance = total (200) - amountPaid (0) = ₹200
   - oldBalance = ₹200
   - totalReceiptDebt = ₹400

2. Apply payment to receipt items:
   - paymentForCurrentReceipt = min(400, 200) = ₹200
   - Update: amountPaid = 0 + 200 = ₹200 ✓
   - Remaining: 400 - 200 = ₹200

3. Consume oldBalance:
   - oldBalancePayment = min(200, 200) = ₹200
   - This prevents cascading (consumed, not added to amountPaid)
   - Remaining: 200 - 200 = ₹0

4. Check for cascade:
   - Remaining = ₹0 → NO CASCADE ✓

5. Result:
   - Receipt: amountPaid = ₹200, isPaid = true
   - No cascade to older receipts
   - Balance: ₹0
```

## When Cascade SHOULD Happen

### Scenario: Receipt with ₹200 items + ₹200 oldBalance, paying ₹500

```
1. totalReceiptDebt = ₹400
2. Apply to receipt items: ₹200 (amountPaid = 200)
3. Consume oldBalance: ₹200
4. Remaining: ₹100 → CASCADE ✓

Result:
- Current receipt: PAID (₹400 consumed)
- Cascade ₹100 to oldest unpaid receipt
- "500 distributed across 2 receipts" ✓
```

## Key Concepts

### oldBalance vs receiptBalance

- **receiptBalance**: Amount owed on THIS receipt's items only
  - `receiptBalance = total - amountPaid`
  - Gets added to `amountPaid` when paid

- **oldBalance**: Previous debt brought forward to this receipt
  - Manually added when creating receipt
  - Part of total customer debt on this receipt
  - NOT added to `amountPaid` when paid (just consumed)

### Total Receipt Debt

```typescript
totalReceiptDebt = receiptBalance + oldBalance
```

This is the total amount that must be paid before cascading to older receipts.

## Testing

### Test Case 1: Pay exact amount with oldBalance
```
Receipt: ₹200 items + ₹200 oldBalance
Payment: ₹400
Expected: Current receipt PAID, no cascade ✓
```

### Test Case 2: Pay more than total debt
```
Receipt: ₹200 items + ₹200 oldBalance
Payment: ₹500
Expected: Current receipt PAID, ₹100 cascades to older receipt ✓
```

### Test Case 3: Pay less than total debt
```
Receipt: ₹200 items + ₹200 oldBalance
Payment: ₹300
Expected: Current receipt PARTIAL (₹200 paid on items, ₹100 consumed from oldBalance), no cascade ✓
```

## Logs to Verify

When paying ₹400 on a receipt with ₹200 items + ₹200 oldBalance:

```
💵 [PAYMENT] Receipt REC-xxx: total=₹200, paid=₹0, receiptBalance=₹200, oldBalance=₹200, totalDebt=₹400
💰 Payment of ₹200.00 applied to current receipt REC-xxx
💰 ₹200.00 consumed from oldBalance (not added to amountPaid)
✅ Payment fully consumed by current receipt. No cascade needed.
✅ Payment of ₹400 recorded successfully
```

## Summary

The fix ensures that **oldBalance is part of the current receipt**, not a separate older receipt. Payment is applied to:
1. Receipt items first (updates `amountPaid`)
2. Then oldBalance (consumed, no update to `amountPaid`)
3. Only then cascade to truly older receipts

This matches the expected business logic where "Previous Balance" represents past debt tracked within the current receipt context.
