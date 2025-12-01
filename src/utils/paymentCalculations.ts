/**
 * Pure functions for payment calculations
 * These functions are side-effect free and easily testable
 */

import { FirebaseReceipt } from '../services/business/ReceiptFirebaseService';

/**
 * Receipt with calculated payment info
 */
export interface CascadeReceipt {
  receipt: FirebaseReceipt;
  currentBalance: number;      // Balance before payment
  paymentToApply: number;      // Amount to apply from this payment
  newBalance: number;          // Balance after payment
  newAmountPaid: number;       // Updated amountPaid value
  willBeFullyPaid: boolean;    // Will this receipt be fully paid?
}

/**
 * Result of cascade calculation
 */
export interface CascadeResult {
  affectedReceipts: CascadeReceipt[];
  totalApplied: number;
  remainingPayment: number;    // Excess payment (overpayment)
  totalBalanceCleared: number;
}

/**
 * Calculate the unpaid balance for a single receipt
 * Balance = total - amountPaid
 */
export function calculateReceiptBalance(receipt: FirebaseReceipt): number {
  const total = receipt.total || 0;
  const amountPaid = receipt.amountPaid || 0;
  const balance = total - amountPaid;
  return Math.max(0, Math.round(balance * 100) / 100); // Round to 2 decimals, min 0
}

/**
 * Calculate total outstanding balance for a customer from their receipts
 * 
 * This includes:
 * 1. Sum of all unpaid amounts (total - amountPaid) from all receipts
 * 2. PLUS the oldBalance from the OLDEST receipt (historical debt before system)
 * 
 * The oldBalance from the oldest receipt represents debt from BEFORE the receipts
 * were created in the system. We only count it once to avoid double-counting.
 */
export function calculateCustomerTotalBalance(receipts: FirebaseReceipt[]): number {
  if (!receipts || receipts.length === 0) return 0;
  
  // Sort by date to find the oldest receipt
  const sorted = sortReceiptsByDateAsc(receipts);
  
  // Get historical debt from the oldest receipt's oldBalance
  // This is debt from BEFORE the system/receipts
  const oldestReceipt = sorted[0];
  const historicalDebt = oldestReceipt?.oldBalance || 0;
  
  // Sum all receipt balances (total - amountPaid)
  const receiptBalancesTotal = receipts.reduce((sum, receipt) => {
    const balance = calculateReceiptBalance(receipt);
    return sum + balance;
  }, 0);
  
  // Total = historical debt + all receipt balances
  const total = historicalDebt + receiptBalancesTotal;
  
  return Math.round(total * 100) / 100;
}

/**
 * Get the balance including oldBalance (for display purposes)
 * totalOwed = oldBalance + (total - amountPaid)
 */
export function calculateTotalOwed(receipt: FirebaseReceipt): number {
  const oldBalance = receipt.oldBalance || 0;
  const receiptBalance = calculateReceiptBalance(receipt);
  return Math.round((oldBalance + receiptBalance) * 100) / 100;
}

/**
 * Sort receipts by date (oldest first for FIFO payment)
 */
export function sortReceiptsByDateAsc(receipts: FirebaseReceipt[]): FirebaseReceipt[] {
  return [...receipts].sort((a, b) => {
    const dateA = a.createdAt?.toDate?.() || a.date?.toDate?.() || new Date(0);
    const dateB = b.createdAt?.toDate?.() || b.date?.toDate?.() || new Date(0);
    return dateA.getTime() - dateB.getTime();
  });
}

/**
 * Filter to get only unpaid receipts (balance > 0)
 */
export function getUnpaidReceipts(receipts: FirebaseReceipt[]): FirebaseReceipt[] {
  return receipts.filter(receipt => {
    const balance = calculateReceiptBalance(receipt);
    return balance > 0.01; // Use small threshold to handle floating point
  });
}

/**
 * Calculate how a payment will cascade across receipts
 * 
 * Payment Strategy (FIFO - First In First Out):
 * 1. First, clear any historical debt (oldBalance from oldest receipt)
 * 2. Apply remaining payment to the CURRENT receipt
 * 3. If payment exceeds current receipt balance, cascade to OTHER unpaid receipts
 * 4. Process other receipts from oldest to newest
 * 
 * @param currentReceipt - The receipt the payment is being made against
 * @param paymentAmount - Total payment amount
 * @param allCustomerReceipts - All receipts for this customer (for cascade)
 * @returns CascadeResult with affected receipts and amounts
 */
export function calculatePaymentCascade(
  currentReceipt: FirebaseReceipt,
  paymentAmount: number,
  allCustomerReceipts: FirebaseReceipt[] = []
): CascadeResult {
  if (paymentAmount <= 0) {
    return {
      affectedReceipts: [],
      totalApplied: 0,
      remainingPayment: 0,
      totalBalanceCleared: 0,
    };
  }

  const affectedReceipts: CascadeReceipt[] = [];
  let remainingPayment = paymentAmount;
  let totalApplied = 0;
  let totalBalanceCleared = 0;

  // Find the oldest receipt to get historical debt
  const sorted = sortReceiptsByDateAsc(allCustomerReceipts.length > 0 ? allCustomerReceipts : [currentReceipt]);
  const oldestReceipt = sorted[0];
  const historicalDebt = oldestReceipt?.oldBalance || 0;
  
  // Track how much historical debt we're clearing
  let historicalDebtCleared = 0;

  // Step 1: Apply to current receipt first (including clearing historical debt if this is the oldest)
  const currentBalance = calculateReceiptBalance(currentReceipt);
  const isCurrentOldest = oldestReceipt?.id === currentReceipt.id;
  
  // Total owed on current receipt = receipt balance + (historical debt if this is oldest)
  const currentTotalOwed = currentBalance + (isCurrentOldest ? historicalDebt : 0);
  
  if (currentTotalOwed > 0) {
    const paymentForCurrent = Math.min(remainingPayment, currentTotalOwed);
    
    // Calculate how much goes to historical debt vs receipt balance
    let paymentForHistorical = 0;
    let paymentForReceipt = paymentForCurrent;
    
    if (isCurrentOldest && historicalDebt > 0) {
      // First clear historical debt, then receipt balance
      paymentForHistorical = Math.min(paymentForCurrent, historicalDebt);
      paymentForReceipt = paymentForCurrent - paymentForHistorical;
      historicalDebtCleared = paymentForHistorical;
    }
    
    const newReceiptBalance = Math.round(Math.max(0, currentBalance - paymentForReceipt) * 100) / 100;
    const newAmountPaid = (currentReceipt.amountPaid || 0) + paymentForReceipt;
    
    affectedReceipts.push({
      receipt: currentReceipt,
      currentBalance: currentTotalOwed, // Show total including historical
      paymentToApply: paymentForCurrent,
      newBalance: newReceiptBalance,
      newAmountPaid: Math.round(newAmountPaid * 100) / 100,
      willBeFullyPaid: newReceiptBalance <= 0.01,
    });
    
    remainingPayment -= paymentForCurrent;
    totalApplied += paymentForCurrent;
    totalBalanceCleared += paymentForCurrent;
  }

  // Step 2: If there's remaining payment, cascade to other unpaid receipts
  if (remainingPayment > 0.01 && allCustomerReceipts.length > 0) {
    // Get other unpaid receipts (excluding current), sorted oldest first
    const otherReceipts = allCustomerReceipts.filter(r => r.id !== currentReceipt.id);
    const unpaidOthers = getUnpaidReceipts(otherReceipts);
    const sortedUnpaid = sortReceiptsByDateAsc(unpaidOthers);

    for (const receipt of sortedUnpaid) {
      if (remainingPayment <= 0.01) break;

      const balance = calculateReceiptBalance(receipt);
      
      // Check if this receipt has historical debt (if it's the oldest and we haven't cleared it yet)
      const isThisOldest = oldestReceipt?.id === receipt.id;
      const receiptHistoricalDebt = isThisOldest ? Math.max(0, historicalDebt - historicalDebtCleared) : 0;
      const totalOwed = balance + receiptHistoricalDebt;
      
      if (totalOwed <= 0.01) continue;

      const paymentForThis = Math.min(remainingPayment, totalOwed);
      
      // Calculate split between historical and receipt
      let paymentForHistorical = 0;
      let paymentForReceipt = paymentForThis;
      
      if (receiptHistoricalDebt > 0) {
        paymentForHistorical = Math.min(paymentForThis, receiptHistoricalDebt);
        paymentForReceipt = paymentForThis - paymentForHistorical;
        historicalDebtCleared += paymentForHistorical;
      }
      
      const newBalance = Math.round(Math.max(0, balance - paymentForReceipt) * 100) / 100;
      const newAmountPaid = (receipt.amountPaid || 0) + paymentForReceipt;

      affectedReceipts.push({
        receipt,
        currentBalance: totalOwed,
        paymentToApply: paymentForThis,
        newBalance,
        newAmountPaid: Math.round(newAmountPaid * 100) / 100,
        willBeFullyPaid: newBalance <= 0.01,
      });

      remainingPayment -= paymentForThis;
      totalApplied += paymentForThis;
      totalBalanceCleared += paymentForThis;
    }
  }

  return {
    affectedReceipts,
    totalApplied: Math.round(totalApplied * 100) / 100,
    remainingPayment: Math.round(Math.max(0, remainingPayment) * 100) / 100,
    totalBalanceCleared: Math.round(totalBalanceCleared * 100) / 100,
  };
}

/**
 * Calculate updated receipt fields after applying a payment
 */
export function applyPaymentToReceipt(
  receipt: FirebaseReceipt,
  paymentAmount: number
): {
  amountPaid: number;
  newBalance: number;
  isPaid: boolean;
} {
  const total = receipt.total || 0;
  const currentAmountPaid = receipt.amountPaid || 0;
  const oldBalance = receipt.oldBalance || 0;
  
  // New amount paid
  const newAmountPaid = Math.min(currentAmountPaid + paymentAmount, total);
  
  // Receipt balance after payment
  const receiptBalance = Math.max(0, total - newAmountPaid);
  
  // New balance includes old balance
  const newBalance = oldBalance + receiptBalance;
  
  // Is fully paid if receipt balance is 0 (ignoring oldBalance)
  const isPaid = receiptBalance <= 0.01;
  
  return {
    amountPaid: Math.round(newAmountPaid * 100) / 100,
    newBalance: Math.round(newBalance * 100) / 100,
    isPaid,
  };
}

/**
 * Validate payment amount
 */
export function validatePaymentAmount(
  receipt: FirebaseReceipt,
  amount: number,
  totalCustomerBalance?: number
): { valid: boolean; error?: string; maxAmount?: number } {
  if (amount <= 0) {
    return {
      valid: false,
      error: 'Payment amount must be greater than zero',
    };
  }

  if (isNaN(amount)) {
    return {
      valid: false,
      error: 'Invalid payment amount',
    };
  }

  const receiptBalance = calculateReceiptBalance(receipt);
  const maxAmount = totalCustomerBalance ?? receiptBalance;

  // Allow overpayment but warn
  if (amount > maxAmount && maxAmount > 0) {
    return {
      valid: true, // Still valid, but could show warning
      maxAmount,
    };
  }

  return {
    valid: true,
    maxAmount,
  };
}

/**
 * Format currency for display
 */
export function formatPaymentCurrency(amount: number): string {
  return `₹${amount.toFixed(2)}`;
}

/**
 * Calculate customer's new total balance after payment
 */
export function calculateNewCustomerBalance(
  currentTotalBalance: number,
  paymentAmount: number
): number {
  const newBalance = currentTotalBalance - paymentAmount;
  return Math.round(Math.max(0, newBalance) * 100) / 100;
}
