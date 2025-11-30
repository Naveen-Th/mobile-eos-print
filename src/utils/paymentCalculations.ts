/**
 * Pure functions for payment cascade calculations
 * These functions are side-effect free and easily testable
 */

import { FirebaseReceipt } from '../services/business/ReceiptFirebaseService';

export interface CascadeReceipt {
  receipt: FirebaseReceipt;
  paymentToApply: number;
  currentBalance: number;
  newBalance: number;
}

export interface CascadeResult {
  affectedReceipts: CascadeReceipt[];
  totalApplied: number;
  remainingPayment: number;
  oldBalanceCleared: number;
}

/**
 * Calculate how a payment will cascade across receipts
 * @param currentReceipt - The receipt being paid
 * @param paymentAmount - Total payment amount
 * @param olderReceipts - Array of older unpaid receipts for this customer
 * @returns Cascade calculation result
 */
export function calculatePaymentCascade(
  currentReceipt: FirebaseReceipt,
  paymentAmount: number,
  olderReceipts: FirebaseReceipt[] = []
): CascadeResult {
  const affectedReceipts: CascadeReceipt[] = [];
  let remainingPayment = paymentAmount;
  let oldBalanceCleared = 0;

  // Step 1: Calculate current receipt's debt
  const receiptTotal = currentReceipt.total || 0;
  const currentAmountPaid = currentReceipt.amountPaid || 0;
  const receiptBalance = receiptTotal - currentAmountPaid;
  const oldBalance = currentReceipt.oldBalance || 0;
  let isManualOldBalance = currentReceipt.isManualOldBalance || false;
  const totalReceiptDebt = receiptBalance + oldBalance;

  // ✅ BACKWARD COMPATIBILITY: For receipts created before isManualOldBalance was added,
  // infer whether oldBalance was manual or dynamic by checking if OLDER receipts exist
  if (oldBalance > 0 && currentReceipt.isManualOldBalance === undefined) {
    // Get the current receipt's creation date
    const currentReceiptDate = currentReceipt.createdAt?.toDate?.() || currentReceipt.date?.toDate?.() || new Date();
    
    // Filter to only receipts created BEFORE the current receipt
    const trulyOlderReceipts = olderReceipts.filter(r => {
      const rDate = r.createdAt?.toDate?.() || r.date?.toDate?.() || new Date(0);
      return rDate < currentReceiptDate;
    });
    
    // Calculate total unpaid balance from OLDER receipts only
    const totalOlderUnpaidBalance = trulyOlderReceipts.reduce((sum, r) => {
      const rBalance = (r.total || 0) - (r.amountPaid || 0);
      return sum + (rBalance > 0.01 ? rBalance : 0);
    }, 0);
    
    // If older receipts' total unpaid balance is LESS than this receipt's oldBalance,
    // then the oldBalance must include some manually entered historical debt
    if (totalOlderUnpaidBalance < oldBalance - 0.01) {
      isManualOldBalance = true;
    }
  }

  // ✅ CRITICAL FIX: Handle manual vs dynamic oldBalance differently
  // - Manual oldBalance: Historical debt not in system, consume on THIS receipt
  // - Dynamic oldBalance: Debt from older receipts, cascade payment to them
  const consumableOnCurrentReceipt = isManualOldBalance 
    ? receiptBalance + oldBalance  // Manual: consume both receipt items + manual old balance
    : receiptBalance;              // Dynamic: only consume receipt items, cascade to older receipts

  // Step 2: Apply payment to current receipt first
  const paymentForCurrentReceipt = Math.min(remainingPayment, consumableOnCurrentReceipt);
  
  if (paymentForCurrentReceipt > 0) {
    const newBalance = Math.max(0, receiptBalance - Math.min(paymentForCurrentReceipt, receiptBalance));
    affectedReceipts.push({
      receipt: currentReceipt,
      paymentToApply: Math.min(paymentForCurrentReceipt, receiptBalance), // Only count items payment
      currentBalance: receiptBalance,
      newBalance: newBalance,
    });
    remainingPayment -= paymentForCurrentReceipt;
    
    // If manual oldBalance, track how much was cleared
    if (isManualOldBalance && oldBalance > 0) {
      const paymentAfterItems = Math.max(0, paymentForCurrentReceipt - receiptBalance);
      oldBalanceCleared = Math.min(oldBalance, paymentAfterItems);
    }
  }

  // Step 3: Cascade remaining payment to older receipts
  if (remainingPayment > 0.01 && olderReceipts.length > 0) {
    // Sort older receipts by date (oldest first)
    const sortedOlderReceipts = [...olderReceipts].sort((a, b) => {
      const dateA = a.createdAt?.toDate?.() || new Date(0);
      const dateB = b.createdAt?.toDate?.() || new Date(0);
      return dateA.getTime() - dateB.getTime();
    });

    for (const olderReceipt of sortedOlderReceipts) {
      if (remainingPayment < 0.01) break;

      const olderReceiptBalance = (olderReceipt.total || 0) - (olderReceipt.amountPaid || 0);
      
      if (olderReceiptBalance < 0.01) continue; // Skip paid receipts

      const paymentForOlderReceipt = Math.min(remainingPayment, olderReceiptBalance);

      affectedReceipts.push({
        receipt: olderReceipt,
        paymentToApply: paymentForOlderReceipt,
        currentBalance: olderReceiptBalance,
        newBalance: Math.max(0, olderReceiptBalance - paymentForOlderReceipt),
      });

      remainingPayment -= paymentForOlderReceipt;
      oldBalanceCleared += paymentForOlderReceipt;
    }
  }

  // Step 4: Calculate oldBalance clearing for current receipt
  // ✅ Handle manual vs dynamic oldBalance differently
  if (oldBalance > 0) {
    if (isManualOldBalance) {
      // Manual oldBalance: already calculated above when consuming on current receipt
      // oldBalanceCleared is already set
    } else {
      // Dynamic oldBalance: cleared by cascade to older receipts
      if (oldBalanceCleared > 0) {
        const leftoverAfterCascade = Math.max(0, remainingPayment);
        const totalOldBalanceConsumption = Math.min(oldBalance, oldBalanceCleared + leftoverAfterCascade);
        oldBalanceCleared = totalOldBalanceConsumption;
      } else if (remainingPayment > 0) {
        // No cascade but leftover payment can clear oldBalance
        oldBalanceCleared = Math.min(oldBalance, remainingPayment);
      }
    }
  }

  return {
    affectedReceipts,
    totalApplied: paymentAmount - remainingPayment,
    remainingPayment: Math.max(0, remainingPayment),
    oldBalanceCleared,
  };
}

/**
 * Calculate new oldBalance after payment
 * @param currentOldBalance - Current oldBalance on the receipt
 * @param cascadedAmount - Amount cascaded to older receipts
 * @param leftoverPayment - Payment remaining after cascade
 * @returns New oldBalance value
 */
export function calculateNewOldBalance(
  currentOldBalance: number,
  cascadedAmount: number,
  leftoverPayment: number
): number {
  if (currentOldBalance <= 0) return 0;

  const totalConsumed = cascadedAmount + leftoverPayment;
  const newOldBalance = Math.max(0, currentOldBalance - totalConsumed);

  return newOldBalance;
}

/**
 * Validate payment amount against receipt balance
 * @param receipt - The receipt to validate against
 * @param amount - Payment amount
 * @returns Validation result
 */
export function validatePaymentAmount(
  receipt: FirebaseReceipt,
  amount: number
): { valid: boolean; error?: string; maxAmount?: number } {
  if (amount <= 0) {
    return {
      valid: false,
      error: 'Payment amount must be greater than zero',
    };
  }

  const receiptBalance = (receipt.total || 0) - (receipt.amountPaid || 0);

  if (receiptBalance <= 0.01) {
    return {
      valid: false,
      error: 'Receipt is already fully paid',
    };
  }

  // Note: We allow overpayment as it can cascade to older receipts
  // So no upper limit validation

  return {
    valid: true,
    maxAmount: receiptBalance + (receipt.oldBalance || 0),
  };
}

/**
 * Calculate balance for a single customer from their receipts
 * This is the PURE calculation logic extracted from BalanceTrackingService
 * 
 * CRITICAL FIX: This function now correctly calculates balance by:
 * 1. Finding the OLDEST receipt's historical oldBalance (debt from before the system)
 * 2. Summing all UNPAID amounts from all receipts (total - amountPaid)
 * 3. Total = historical debt + sum of unpaid amounts
 * 
 * This prevents double-counting when receipts have oldBalance values that
 * were calculated from previous receipts.
 */
export function calculateCustomerBalance(receipts: FirebaseReceipt[]): number {
  if (!receipts || receipts.length === 0) return 0;

  // Sort by date (OLDEST first for correct calculation)
  const sorted = [...receipts].sort((a, b) => {
    const dateA = a.createdAt?.toDate?.() || a.date?.toDate?.() || new Date(0);
    const dateB = b.createdAt?.toDate?.() || b.date?.toDate?.() || new Date(0);
    return dateA.getTime() - dateB.getTime();
  });

  let totalBalance = 0;
  let historicalDebt = 0;

  // ✅ FIXED STRATEGY: 
  // 1. Get historical debt from the OLDEST receipt's oldBalance (if it's manual/historical)
  // 2. Sum all unpaid amounts from ALL receipts
  // This prevents double-counting that occurred with the old strategy
  
  sorted.forEach((receipt, index) => {
    const total = receipt.total || 0;
    const amountPaid = receipt.amountPaid || 0;
    const remainingBalance = total - amountPaid;
    const receiptOldBalance = receipt.oldBalance || 0;
    
    // For the FIRST (oldest) receipt, capture historical debt
    // This is debt from BEFORE the system was used
    if (index === 0 && receiptOldBalance > 0) {
      // Check if this is truly historical debt (manual) or calculated from other receipts
      // If isManualOldBalance is true OR if there are no older receipts, it's historical
      const isHistorical = receipt.isManualOldBalance === true || index === 0;
      if (isHistorical) {
        historicalDebt = receiptOldBalance;
      }
    }
    
    // Add this receipt's unpaid amount to total
    if (remainingBalance > 0.01) {
      totalBalance += remainingBalance;
    }
  });
  
  // Add historical debt to total
  totalBalance += historicalDebt;

  // Round to 2 decimal places
  totalBalance = Math.round(totalBalance * 100) / 100;

  // Treat very small balances as zero
  if (Math.abs(totalBalance) < 0.01) {
    totalBalance = 0;
  }

  return totalBalance;
}

