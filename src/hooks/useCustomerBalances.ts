import { useMemo } from 'react';
import { FirebaseReceipt } from '../services/business/ReceiptFirebaseService';

/**
 * Optimized hook for calculating customer balances
 * 
 * Performance: O(n) instead of O(n²)
 * - Single pass through receipts
 * - Pre-aggregates by customer
 * - O(1) lookup by customer name
 * 
 * CRITICAL FIX: Now correctly includes historical debt from the oldest receipt's oldBalance
 * without double-counting. The calculation is:
 * - Historical debt from OLDEST receipt's oldBalance (if it's manual/historical)
 * - Plus sum of all UNPAID amounts from all receipts
 * 
 * @param receipts - Array of receipts
 * @returns Map of customer name to total outstanding balance
 */
export function useCustomerBalances(receipts: FirebaseReceipt[]): Map<string, number> {
  return useMemo(() => {
    const balances = new Map<string, number>();
    const historicalDebt = new Map<string, number>();
    const oldestReceiptDate = new Map<string, number>();
    
    if (!receipts || receipts.length === 0) {
      return balances;
    }
    
    // First pass: find oldest receipt per customer and capture historical debt
    for (const receipt of receipts) {
      const customerName = receipt.customerName || 'Walk-in Customer';
      const receiptDate = receipt.createdAt?.toDate?.()?.getTime() || 
                          receipt.date?.toDate?.()?.getTime() || 0;
      
      const currentOldest = oldestReceiptDate.get(customerName);
      if (currentOldest === undefined || receiptDate < currentOldest) {
        oldestReceiptDate.set(customerName, receiptDate);
        // Capture historical debt from oldest receipt
        // Only count if it's truly historical (manual) or if it's the first receipt
        const receiptOldBalance = receipt.oldBalance || 0;
        if (receiptOldBalance > 0) {
          historicalDebt.set(customerName, receiptOldBalance);
        }
      }
    }
    
    // Second pass: sum unpaid amounts + historical debt
    for (const receipt of receipts) {
      const customerName = receipt.customerName || 'Walk-in Customer';
      const outstanding = (receipt.total || 0) - (receipt.amountPaid || 0);
      
      // Accumulate balance for this customer
      const currentBalance = balances.get(customerName) || 0;
      balances.set(customerName, currentBalance + outstanding);
    }
    
    // Add historical debt to each customer's balance
    for (const [customerName, debt] of historicalDebt) {
      const currentBalance = balances.get(customerName) || 0;
      balances.set(customerName, currentBalance + debt);
    }
    
    return balances;
  }, [receipts]); // Only recalculates when receipts array changes
}

/**
 * Calculate dynamic balance for individual receipt (for backward compatibility)
 * 
 * This function calculates the "Previous Balance" shown on each receipt by:
 * 1. For the OLDEST receipt of each customer: Use the Firebase oldBalance (historical balance)
 * 2. For NEWER receipts: Calculate dynamically based on unpaid amounts from older receipts
 * 
 * This ensures:
 * - Historical balance from before the loaded receipts is preserved
 * - When a payment is made on an older receipt, newer receipts show updated Previous Balance
 * 
 * CRITICAL FIX: The running balance calculation now correctly handles historical debt:
 * - Historical oldBalance (from first receipt) is tracked SEPARATELY
 * - Running balance only accumulates UNPAID amounts from receipts
 * - This prevents double-counting when historical debt exists
 * 
 * @param receipts - All receipts
 * @returns Array of receipts with calculated oldBalance and newBalance
 */
export function useReceiptsWithBalance(receipts: FirebaseReceipt[]): FirebaseReceipt[] {
  return useMemo(() => {
    if (!receipts || receipts.length === 0) return [];
    
    // Sort receipts by date (oldest first) for accurate balance calculation
    const sorted = [...receipts].sort((a, b) => {
      const dateA = a.createdAt?.toDate?.() || (a.date?.toDate ? a.date.toDate() : new Date(0));
      const dateB = b.createdAt?.toDate?.() || (b.date?.toDate ? b.date.toDate() : new Date(0));
      return dateA.getTime() - dateB.getTime();
    });
    
    // Track running balance per customer (only unpaid receipt amounts, NOT historical debt)
    const customerUnpaidMap = new Map<string, number>();
    // Track historical debt per customer (from first receipt's oldBalance)
    const customerHistoricalDebt = new Map<string, number>();
    // Track if we've seen the first receipt for each customer
    const customerFirstReceiptSeen = new Set<string>();
    
    return sorted.map(receipt => {
      const customerName = receipt.customerName || 'Walk-in Customer';
      
      // Calculate this receipt's remaining balance (unpaid amount)
      const receiptBalance = (receipt.total || 0) - (receipt.amountPaid || 0);
      
      let oldBalance: number;
      
      if (!customerFirstReceiptSeen.has(customerName)) {
        // This is the FIRST (oldest) receipt for this customer in the loaded data
        // Use the Firebase oldBalance to preserve historical balance
        oldBalance = receipt.oldBalance || 0;
        customerFirstReceiptSeen.add(customerName);
        
        // Store historical debt separately (this is debt from BEFORE the system)
        customerHistoricalDebt.set(customerName, oldBalance);
        
        // Initialize unpaid map with ONLY this receipt's unpaid amount (NOT including historical debt)
        // This prevents double-counting when calculating subsequent receipts' oldBalance
        customerUnpaidMap.set(customerName, receiptBalance);
      } else {
        // This is a SUBSEQUENT receipt - calculate oldBalance dynamically
        // oldBalance = historical debt + sum of unpaid amounts from PREVIOUS receipts
        const historicalDebt = customerHistoricalDebt.get(customerName) || 0;
        const previousUnpaid = customerUnpaidMap.get(customerName) || 0;
        oldBalance = historicalDebt + previousUnpaid;
        
        // Update running unpaid total (add this receipt's unpaid amount)
        customerUnpaidMap.set(customerName, previousUnpaid + receiptBalance);
      }
      
      return {
        ...receipt,
        oldBalance,
        newBalance: oldBalance + receiptBalance,
      };
    });
  }, [receipts]);
}
